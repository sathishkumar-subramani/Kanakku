/**
 * A tiny in-memory MongoDB for tests.
 *
 * It speaks enough of the MongoDB wire protocol (OP_MSG + legacy OP_QUERY handshake) for the official
 * Node driver / Mongoose to connect, and implements the commands this API uses on top of `mingo`
 * (find / aggregate / update semantics). It is NOT a general MongoDB replacement — it exists so the
 * real Express + Mongoose code can be exercised end to end where no mongod binary is available.
 *
 * Usage:  const srv = await startFakeMongo(); await mongoose.connect(srv.uri); ... await srv.stop()
 */
import net from 'node:net'
import { deserialize, serialize, Long, ObjectId } from 'bson'
import mingo from 'mingo'

const OP_REPLY = 1
const OP_QUERY = 2004
const OP_MSG = 2013

// ---------- value normalisation: ObjectId <-> tagged string so mingo compares them as plain values ----------

const OID_RE = /^oid:([0-9a-f]{24})$/
const isPlain = (v) => v !== null && typeof v === 'object' && (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null)

function tag(v) {
  if (v instanceof ObjectId) return `oid:${v.toHexString()}`
  if (Array.isArray(v)) return v.map(tag)
  if (isPlain(v)) {
    const out = {}
    for (const k of Object.keys(v)) out[k] = tag(v[k])
    return out
  }
  return v
}

function untag(v) {
  if (typeof v === 'string') {
    const m = OID_RE.exec(v)
    return m ? new ObjectId(m[1]) : v
  }
  if (Array.isArray(v)) return v.map(untag)
  if (isPlain(v)) {
    const out = {}
    for (const k of Object.keys(v)) out[k] = untag(v[k])
    return out
  }
  return v
}

function clone(v) {
  if (Array.isArray(v)) return v.map(clone)
  if (v instanceof Date) return new Date(v.getTime())
  if (isPlain(v)) {
    const out = {}
    for (const k of Object.keys(v)) out[k] = clone(v[k])
    return out
  }
  return v
}

const getPath = (doc, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), doc)
const sameValue = (a, b) => JSON.stringify(a) === JSON.stringify(b)

// ---------- storage ----------

class Collection {
  constructor(ns) {
    this.ns = ns
    this.docs = []
    this.indexes = [{ v: 2, key: { _id: 1 }, name: '_id_' }]
  }

  /** Throws a duplicate-key error object if `doc` violates a unique index (ignoring `doc` itself). */
  checkUnique(doc) {
    for (const idx of this.indexes) {
      if (!idx.unique && idx.name !== '_id_') continue
      const fields = Object.keys(idx.key)
      const values = fields.map((f) => getPath(doc, f))
      if (values.every((v) => v === undefined)) continue
      const clash = this.docs.find((d) => d !== doc && fields.every((f, i) => sameValue(getPath(d, f), values[i])))
      if (clash) {
        const keyValue = Object.fromEntries(fields.map((f, i) => [f, values[i]]))
        return {
          code: 11000,
          codeName: 'DuplicateKey',
          errmsg: `E11000 duplicate key error collection: ${this.ns} index: ${idx.name} dup key: ${JSON.stringify(keyValue)}`,
          keyPattern: idx.key,
          keyValue,
        }
      }
    }
    return null
  }
}

class Database {
  constructor(name) {
    this.name = name
    this.collections = new Map()
  }
  coll(name, create = true) {
    let c = this.collections.get(name)
    if (!c && create) {
      c = new Collection(`${this.name}.${name}`)
      this.collections.set(name, c)
    }
    return c
  }
}

// ---------- command implementations ----------

const IGNORED_FIELDS = new Set(['$db', 'lsid', '$clusterTime', '$readPreference', 'apiVersion', 'txnNumber', 'autocommit', 'startTransaction', 'writeConcern', 'readConcern', 'maxTimeMS', 'comment', 'let', 'bypassDocumentValidation', 'ordered', 'collation'])

class FakeMongo {
  constructor() {
    this.dbs = new Map()
    this.connectionId = 0
  }

  db(name) {
    let d = this.dbs.get(name)
    if (!d) {
      d = new Database(name)
      this.dbs.set(name, d)
    }
    return d
  }

  cursorReply(ns, batch, key = 'firstBatch') {
    return { cursor: { id: Long.ZERO, ns, [key]: batch.map((d) => untag(clone(d))) }, ok: 1 }
  }

  error(code, codeName, errmsg) {
    return { ok: 0, code, codeName, errmsg }
  }

  run(rawCmd, connId) {
    const dbName = rawCmd.$db ?? 'admin'
    const cmd = {}
    for (const k of Object.keys(rawCmd)) if (!IGNORED_FIELDS.has(k)) cmd[k] = rawCmd[k]
    const name = Object.keys(cmd)[0]
    const lname = name?.toLowerCase()
    const db = this.db(dbName)

    switch (lname) {
      case 'hello':
      case 'ismaster':
        return {
          helloOk: true,
          isWritablePrimary: true,
          ismaster: true,
          maxBsonObjectSize: 16777216,
          maxMessageSizeBytes: 48000000,
          maxWriteBatchSize: 100000,
          localTime: new Date(),
          logicalSessionTimeoutMinutes: 30,
          connectionId: connId,
          minWireVersion: 0,
          maxWireVersion: 21,
          readOnly: false,
          ok: 1,
        }
      case 'buildinfo':
        return { version: '7.0.0', versionArray: [7, 0, 0, 0], gitVersion: 'fake', modules: [], maxBsonObjectSize: 16777216, ok: 1 }
      case 'ping':
      case 'endsessions':
      case 'create':
      case 'dropindexes':
        return { ok: 1 }
      case 'killcursors':
        return { cursorsKilled: [], cursorsNotFound: cmd.cursors ?? [], cursorsAlive: [], cursorsUnknown: [], ok: 1 }
      case 'getmore':
        return this.cursorReply(`${dbName}.${cmd.collection}`, [], 'nextBatch')
      case 'drop':
        db.collections.delete(cmd.drop)
        return { ok: 1 }
      case 'dropdatabase':
        this.dbs.delete(dbName)
        return { ok: 1, dropped: dbName }
      case 'listcollections': {
        const filterName = cmd.filter?.name
        const items = [...db.collections.keys()]
          .filter((n) => !filterName || n === filterName)
          .map((n) => ({ name: n, type: 'collection', options: {}, info: { readOnly: false }, idIndex: { v: 2, key: { _id: 1 }, name: '_id_' } }))
        return this.cursorReply(`${dbName}.$cmd.listCollections`, items)
      }
      case 'listindexes': {
        const coll = db.coll(cmd.listIndexes)
        return this.cursorReply(`${dbName}.${cmd.listIndexes}`, coll.indexes.map((i) => clone(i)))
      }
      case 'createindexes': {
        const coll = db.coll(cmd.createIndexes)
        const before = coll.indexes.length
        for (const spec of cmd.indexes ?? []) {
          if (coll.indexes.some((i) => i.name === spec.name)) continue
          const idx = { v: 2, key: tag(spec.key), name: spec.name }
          if (spec.unique) idx.unique = true
          if (spec.sparse) idx.sparse = true
          if (spec.expireAfterSeconds != null) idx.expireAfterSeconds = spec.expireAfterSeconds
          coll.indexes.push(idx)
        }
        return { numIndexesBefore: before, numIndexesAfter: coll.indexes.length, ok: 1 }
      }
      case 'find': {
        const coll = db.coll(cmd.find)
        const filter = tag(cmd.filter ?? {})
        const projection = cmd.projection && Object.keys(cmd.projection).length ? cmd.projection : undefined
        let cursor = mingo.find(coll.docs, filter, projection)
        if (cmd.sort && Object.keys(cmd.sort).length) cursor = cursor.sort(cmd.sort)
        if (cmd.skip) cursor = cursor.skip(cmd.skip)
        const limit = Math.abs(Number(cmd.limit ?? 0))
        if (limit > 0) cursor = cursor.limit(limit)
        return this.cursorReply(coll.ns, cursor.all())
      }
      case 'aggregate': {
        const coll = db.coll(cmd.aggregate)
        const out = mingo.aggregate(coll.docs.map(clone), tag(cmd.pipeline ?? []))
        return this.cursorReply(coll.ns, out)
      }
      case 'count': {
        const coll = db.coll(cmd.count)
        return { n: mingo.find(coll.docs, tag(cmd.query ?? {})).all().length, ok: 1 }
      }
      case 'distinct': {
        const coll = db.coll(cmd.distinct)
        const values = new Set()
        for (const d of mingo.find(coll.docs, tag(cmd.query ?? {})).all()) {
          const v = getPath(d, cmd.key)
          if (Array.isArray(v)) v.forEach((x) => values.add(JSON.stringify(x)))
          else if (v !== undefined) values.add(JSON.stringify(v))
        }
        return { values: [...values].map((s) => untag(JSON.parse(s))), ok: 1 }
      }
      case 'insert': {
        const coll = db.coll(cmd.insert)
        const writeErrors = []
        let n = 0
        for (const [i, raw] of (cmd.documents ?? []).entries()) {
          const doc = tag(clone(raw))
          if (doc._id === undefined) doc._id = tag(new ObjectId())
          const dup = coll.checkUnique(doc)
          if (dup) {
            writeErrors.push({ index: i, ...dup })
            if (rawCmd.ordered !== false) break
            continue
          }
          coll.docs.push(doc)
          n++
        }
        const res = { n, ok: 1 }
        if (writeErrors.length) res.writeErrors = writeErrors
        return res
      }
      case 'update': {
        const coll = db.coll(cmd.update)
        const writeErrors = []
        const upserted = []
        let n = 0
        let nModified = 0
        for (const [i, u] of (cmd.updates ?? []).entries()) {
          const q = tag(u.q ?? {})
          const matches = mingo.find(coll.docs, q).all()
          const targets = u.multi ? matches : matches.slice(0, 1)
          if (targets.length === 0 && u.upsert) {
            const doc = {}
            for (const [k, v] of Object.entries(q)) {
              if (k.startsWith('$')) continue
              if (isPlain(v) && Object.keys(v).some((x) => x.startsWith('$'))) {
                if (v.$eq !== undefined) doc[k] = v.$eq
                continue
              }
              doc[k] = v
            }
            const err = this.applyUpdate(doc, tag(u.u), u.arrayFilters, q, true)
            if (err) return err
            if (doc._id === undefined) doc._id = tag(new ObjectId())
            const dup = coll.checkUnique(doc)
            if (dup) {
              writeErrors.push({ index: i, ...dup })
              break
            }
            coll.docs.push(doc)
            upserted.push({ index: i, _id: untag(doc._id) })
            n++
            continue
          }
          for (const doc of targets) {
            const before = clone(doc)
            const err = this.applyUpdate(doc, tag(u.u), u.arrayFilters, q, false)
            if (err) return err
            const dup = coll.checkUnique(doc)
            if (dup) {
              Object.keys(doc).forEach((k) => delete doc[k])
              Object.assign(doc, before)
              writeErrors.push({ index: i, ...dup })
              break
            }
            n++
            if (!sameValue(before, doc)) nModified++
          }
        }
        const res = { n, nModified, ok: 1 }
        if (upserted.length) res.upserted = upserted
        if (writeErrors.length) res.writeErrors = writeErrors
        return res
      }
      case 'delete': {
        const coll = db.coll(cmd.delete)
        let n = 0
        for (const d of cmd.deletes ?? []) {
          const matches = mingo.find(coll.docs, tag(d.q ?? {})).all()
          const targets = d.limit === 1 ? matches.slice(0, 1) : matches
          const set = new Set(targets)
          coll.docs = coll.docs.filter((doc) => !set.has(doc))
          n += targets.length
        }
        return { n, ok: 1 }
      }
      case 'findandmodify': {
        const coll = db.coll(cmd.findAndModify)
        const q = tag(cmd.query ?? {})
        let cursor = mingo.find(coll.docs, q)
        if (cmd.sort && Object.keys(cmd.sort).length) cursor = cursor.sort(cmd.sort)
        const doc = cursor.limit(1).all()[0]
        if (!doc) {
          if (cmd.upsert && cmd.update) {
            const created = {}
            for (const [k, v] of Object.entries(q)) if (!k.startsWith('$') && !(isPlain(v) && Object.keys(v).some((x) => x.startsWith('$')))) created[k] = v
            const err = this.applyUpdate(created, tag(cmd.update), cmd.arrayFilters, q, true)
            if (err) return err
            if (created._id === undefined) created._id = tag(new ObjectId())
            coll.docs.push(created)
            return { value: cmd.new ? untag(clone(created)) : null, lastErrorObject: { n: 1, updatedExisting: false, upserted: untag(created._id) }, ok: 1 }
          }
          return { value: null, lastErrorObject: { n: 0, updatedExisting: false }, ok: 1 }
        }
        const before = clone(doc)
        if (cmd.remove) {
          coll.docs = coll.docs.filter((d) => d !== doc)
          return { value: untag(before), lastErrorObject: { n: 1 }, ok: 1 }
        }
        const err = this.applyUpdate(doc, tag(cmd.update), cmd.arrayFilters, q, false)
        if (err) return err
        return { value: untag(clone(cmd.new ? doc : before)), lastErrorObject: { n: 1, updatedExisting: true }, ok: 1 }
      }
      default:
        return this.error(59, 'CommandNotFound', `no such command: '${name}'`)
    }
  }

  /** Applies an update document (operators or replacement) in place. Returns an error reply or null. */
  applyUpdate(doc, u, arrayFilters, condition, isInsert) {
    try {
      if (Array.isArray(u)) return this.error(2, 'BadValue', 'pipeline updates are not supported by the fake server')
      const keys = Object.keys(u)
      const hasOps = keys.some((k) => k.startsWith('$'))
      if (!hasOps) {
        const id = doc._id
        for (const k of Object.keys(doc)) delete doc[k]
        Object.assign(doc, clone(u))
        if (id !== undefined) doc._id = id
        return null
      }
      const modifier = {}
      for (const k of keys) {
        if (k === '$setOnInsert') {
          if (isInsert) Object.assign(doc, clone(u[k]))
          continue
        }
        modifier[k] = u[k]
      }
      if (Object.keys(modifier).length) mingo.update(doc, modifier, arrayFilters ? tag(arrayFilters) : undefined, condition, { cloneMode: 'deep' })
      return null
    } catch (err) {
      return this.error(2, 'BadValue', `update failed: ${err?.message ?? err}`)
    }
  }
}

// ---------- wire protocol ----------

function parseOpMsg(buf) {
  const flags = buf.readUInt32LE(16)
  const checksum = flags & 1 ? 4 : 0
  let offset = 20
  const end = buf.length - checksum
  let body = null
  const sequences = {}
  while (offset < end) {
    const kind = buf.readUInt8(offset)
    offset += 1
    if (kind === 0) {
      const len = buf.readInt32LE(offset)
      body = deserialize(buf.subarray(offset, offset + len))
      offset += len
    } else if (kind === 1) {
      const size = buf.readInt32LE(offset)
      const sectionEnd = offset + size
      offset += 4
      const zero = buf.indexOf(0, offset)
      const identifier = buf.toString('utf8', offset, zero)
      offset = zero + 1
      const docs = []
      while (offset < sectionEnd) {
        const len = buf.readInt32LE(offset)
        docs.push(deserialize(buf.subarray(offset, offset + len)))
        offset += len
      }
      sequences[identifier] = docs
    } else {
      throw new Error(`Unknown OP_MSG section kind ${kind}`)
    }
  }
  return { ...body, ...sequences }
}

function parseOpQuery(buf) {
  let offset = 20
  const zero = buf.indexOf(0, offset)
  const fullCollectionName = buf.toString('utf8', offset, zero)
  offset = zero + 1 + 8 // skip numberToSkip + numberToReturn
  const len = buf.readInt32LE(offset)
  const query = deserialize(buf.subarray(offset, offset + len))
  const dbName = fullCollectionName.split('.')[0]
  return { ...query, $db: query.$db ?? dbName }
}

function encodeOpMsg(requestId, responseTo, doc) {
  const body = Buffer.from(serialize(doc))
  const msg = Buffer.alloc(16 + 4 + 1 + body.length)
  msg.writeInt32LE(msg.length, 0)
  msg.writeInt32LE(requestId, 4)
  msg.writeInt32LE(responseTo, 8)
  msg.writeInt32LE(OP_MSG, 12)
  msg.writeUInt32LE(0, 16)
  msg.writeUInt8(0, 20)
  body.copy(msg, 21)
  return msg
}

function encodeOpReply(requestId, responseTo, doc) {
  const body = Buffer.from(serialize(doc))
  const msg = Buffer.alloc(16 + 20 + body.length)
  msg.writeInt32LE(msg.length, 0)
  msg.writeInt32LE(requestId, 4)
  msg.writeInt32LE(responseTo, 8)
  msg.writeInt32LE(OP_REPLY, 12)
  msg.writeInt32LE(0, 16) // responseFlags
  msg.writeBigInt64LE(0n, 20) // cursorID
  msg.writeInt32LE(0, 28) // startingFrom
  msg.writeInt32LE(1, 32) // numberReturned
  body.copy(msg, 36)
  return msg
}

export async function startFakeMongo({ port = 0, log = false } = {}) {
  const store = new FakeMongo()
  let nextRequestId = 1

  const server = net.createServer((socket) => {
    const connId = ++store.connectionId
    let buffer = Buffer.alloc(0)
    socket.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk])
      while (buffer.length >= 16) {
        const len = buffer.readInt32LE(0)
        if (buffer.length < len) break
        const msg = buffer.subarray(0, len)
        buffer = buffer.subarray(len)
        const requestId = msg.readInt32LE(4)
        const opCode = msg.readInt32LE(12)
        let reply
        try {
          if (opCode === OP_MSG) {
            const cmd = parseOpMsg(msg)
            if (log) console.log('>', JSON.stringify(cmd).slice(0, 300))
            reply = encodeOpMsg(nextRequestId++, requestId, store.run(cmd, connId))
          } else if (opCode === OP_QUERY) {
            const cmd = parseOpQuery(msg)
            if (log) console.log('>q', JSON.stringify(cmd).slice(0, 300))
            reply = encodeOpReply(nextRequestId++, requestId, store.run(cmd, connId))
          } else {
            reply = encodeOpMsg(nextRequestId++, requestId, store.error(2, 'BadValue', `unsupported opcode ${opCode}`))
          }
        } catch (err) {
          if (log) console.error('fake mongo error', err)
          reply = encodeOpMsg(nextRequestId++, requestId, store.error(1, 'InternalError', String(err?.message ?? err)))
        }
        socket.write(reply)
      }
    })
    socket.on('error', () => {})
  })

  await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve))
  const address = server.address()
  return {
    uri: `mongodb://127.0.0.1:${address.port}/?directConnection=true`,
    port: address.port,
    store,
    reset() {
      store.dbs.clear()
    },
    stop() {
      return new Promise((resolve) => server.close(() => resolve()))
    },
  }
}
