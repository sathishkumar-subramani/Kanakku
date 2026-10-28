import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import PDFDocument from 'pdfkit'
import { dayShort, isZero, money } from '../lib/util.js'

const FONTS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'fonts')
const FONT = { regular: path.join(FONTS_DIR, 'NotoSans-Regular.ttf'), semibold: path.join(FONTS_DIR, 'NotoSans-SemiBold.ttf'), bold: path.join(FONTS_DIR, 'NotoSans-Bold.ttf') }
const HAS_FONTS = Object.values(FONT).every((f) => fs.existsSync(f))

const INK = '#1B1C24'
const MUTED = '#6C6F7C'
const BORDER = '#E3DFD5'
const PAPER = '#F6F4EE'
const ACCENT = '#E2590B'
const POSITIVE = '#1D8F62'
const NEGATIVE = '#CF3E38'

const CATEGORY_LABELS = { food: 'Food', groceries: 'Groceries', rent: 'Rent', utilities: 'Utilities', travel: 'Travel', entertainment: 'Entertainment', shopping: 'Shopping', health: 'Health', household: 'Household', other: 'Other' }
const label = (c) => CATEGORY_LABELS[c] ?? c

/** Renders a MonthlyReport (services/reports.js) to a PDF buffer. */
export function reportToPdf(r) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margins: { top: 40, bottom: 48, left: 36, right: 36 }, info: { Title: `Kanakku — ${r.monthLabel}`, Author: 'Kanakku' }, bufferPages: true })
    const chunks = []
    doc.on('data', (c) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    if (HAS_FONTS) {
      doc.registerFont('R', FONT.regular)
      doc.registerFont('S', FONT.semibold)
      doc.registerFont('B', FONT.bold)
    } else {
      doc.registerFont('R', 'Helvetica')
      doc.registerFont('S', 'Helvetica-Bold')
      doc.registerFont('B', 'Helvetica-Bold')
    }

    const M = (v) => money(v, r.currency)
    const left = doc.page.margins.left
    const width = doc.page.width - left - doc.page.margins.right
    const bottom = () => doc.page.height - doc.page.margins.bottom

    const ensure = (h) => {
      if (doc.y + h > bottom()) doc.addPage()
    }

    // ---------- header ----------
    doc.font('B').fontSize(20).fillColor(ACCENT).text('Kanakku', left, doc.y, { continued: false })
    doc.font('S').fontSize(13).fillColor(INK).text(`Monthly report — ${r.monthLabel}`)
    const headerBottom = doc.y
    doc.font('S').fontSize(9).fillColor(INK).text(r.userName, left, 40, { width, align: 'right' })
    doc.font('R').fontSize(9).fillColor(MUTED).text(r.scope, { width, align: 'right' })
    doc.fontSize(8).text(`Generated ${dayShort(new Date())} ${new Date().getUTCFullYear()}`, { width, align: 'right' })
    doc.y = Math.max(headerBottom, doc.y) + 8
    hr(doc, left, width)
    doc.moveDown(0.8)

    // ---------- summary tiles ----------
    const tiles = [
      ['Total this month', M(r.totalSpent), ACCENT],
      ['My share of group spend', M(r.groupShare), INK],
      ['Personal expenses', M(r.personalSpent), INK],
      ['I paid for the group', M(r.iPaid), INK],
    ]
    const gap = 8
    const tw = (width - gap * (tiles.length - 1)) / tiles.length
    const ty = doc.y
    tiles.forEach(([t, v, color], i) => {
      const x = left + i * (tw + gap)
      doc.save().roundedRect(x, ty, tw, 50, 6).fillAndStroke(PAPER, BORDER).restore()
      doc.font('R').fontSize(7.5).fillColor(MUTED).text(t, x + 10, ty + 9, { width: tw - 20, lineBreak: false, ellipsis: true })
      doc.font('B').fontSize(13).fillColor(color).text(v, x + 10, ty + 24, { width: tw - 20 })
    })
    doc.y = ty + 50 + 16

    // ---------- by group / by category ----------
    const colW = (width - 14) / 2
    const startY = doc.y
    sectionTitle(doc, 'Spend by group', left, colW)
    const yAfterGroup = bucketTable(doc, r.byGroup, r.totalSpent, M, (n) => n, left, colW)
    doc.y = startY
    sectionTitle(doc, 'Spend by category', left + colW + 14, colW)
    const yAfterCat = bucketTable(doc, r.byCategory, r.totalSpent, M, label, left + colW + 14, colW)
    doc.y = Math.max(yAfterGroup, yAfterCat) + 16

    // ---------- expenses ----------
    ensure(60)
    sectionTitle(doc, `Expenses (${r.lines.length})`, left, width)
    if (r.lines.length === 0) {
      doc.font('R').fontSize(9).fillColor(MUTED).text('No expenses this month.', left)
    } else {
      table(doc, {
        x: left,
        width,
        columns: [
          { key: 'date', label: 'Date', width: 46, color: MUTED },
          { key: 'group', label: 'Group', width: 76 },
          { key: 'description', label: 'Description', flex: 1 },
          { key: 'category', label: 'Category', width: 62, color: MUTED },
          { key: 'paidBy', label: 'Paid by', width: 60 },
          { key: 'total', label: 'Total', width: 70, align: 'right', color: MUTED },
          { key: 'myShare', label: 'My share', width: 70, align: 'right', font: 'S' },
        ],
        rows: r.lines.map((l) => ({
          date: dayShort(l.date),
          group: l.group,
          description: l.notes ? `${l.description} — ${l.notes}` : l.description,
          category: label(l.category),
          paidBy: l.paidBy,
          total: M(l.total),
          myShare: M(l.myShare),
        })),
        footer: { description: 'Total', total: M(r.lines.reduce((t, l) => t + l.total, 0)), myShare: M(r.totalSpent) },
      })
    }
    doc.moveDown(1.2)

    // ---------- settlements ----------
    ensure(60)
    sectionTitle(doc, `Payments recorded (${r.settlements.length})`, left, width)
    if (r.settlements.length === 0) {
      doc.font('R').fontSize(9).fillColor(MUTED).text('No payments this month.', left)
    } else {
      table(doc, {
        x: left,
        width,
        columns: [
          { key: 'date', label: 'Date', width: 46, color: MUTED },
          { key: 'group', label: 'Group', width: 110 },
          { key: 'payment', label: 'Payment', flex: 1 },
          { key: 'amount', label: 'Amount', width: 80, align: 'right', font: 'S' },
        ],
        rows: r.settlements.map((s) => ({ date: dayShort(s.date), group: s.group, payment: `${s.from} paid ${s.to}`, amount: M(s.amount) })),
      })
    }
    doc.moveDown(1.2)

    // ---------- balances ----------
    if (r.balances.length) {
      ensure(60)
      sectionTitle(doc, 'Current balances (as of today)', left, width)
      table(doc, {
        x: left,
        width,
        columns: [
          { key: 'group', label: 'Group', flex: 1 },
          { key: 'balance', label: 'Balance', width: 170, align: 'right', font: 'S', colorOf: (row) => row.tone },
        ],
        rows: r.balances.map((b) => ({
          group: b.group,
          balance: isZero(b.balance) ? 'settled up' : b.balance > 0 ? `you are owed ${M(b.balance)}` : `you owe ${M(-b.balance)}`,
          tone: isZero(b.balance) ? MUTED : b.balance > 0 ? POSITIVE : NEGATIVE,
        })),
        header: false,
      })
    }

    // ---------- footer on every page ----------
    const range = doc.bufferedPageRange()
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i)
      // Writing inside the bottom margin would make pdfkit start a new page; lift the margin while we draw the footer.
      const savedBottom = doc.page.margins.bottom
      doc.page.margins.bottom = 0
      doc.font('R').fontSize(8).fillColor(MUTED)
      doc.text(`Kanakku · ${r.monthLabel} · page ${i - range.start + 1} of ${range.count}`, left, doc.page.height - savedBottom + 16, { width, align: 'center', lineBreak: false })
      doc.page.margins.bottom = savedBottom
    }
    doc.end()
  })
}

function hr(doc, x, width, color = BORDER) {
  doc.save().moveTo(x, doc.y).lineTo(x + width, doc.y).lineWidth(0.8).strokeColor(color).stroke().restore()
}

function sectionTitle(doc, text, x, width) {
  doc.font('S').fontSize(11).fillColor(INK).text(text, x, doc.y, { width })
  doc.moveDown(0.3)
}

function bucketTable(doc, buckets, total, M, labelOf, x, width) {
  if (!buckets.length) {
    doc.font('R').fontSize(9).fillColor(MUTED).text('Nothing here this month.', x, doc.y, { width })
    return doc.y
  }
  table(doc, {
    x,
    width,
    columns: [
      { key: 'name', label: 'Name', flex: 1 },
      { key: 'count', label: '#', width: 26, align: 'right', color: MUTED },
      { key: 'amount', label: 'Amount', width: 72, align: 'right', font: 'S' },
      { key: 'pct', label: '%', width: 36, align: 'right', color: MUTED },
    ],
    rows: buckets.map((b) => ({ name: labelOf(b.name), count: String(b.count), amount: M(b.amount), pct: `${total > 0 ? Math.round((b.amount / total) * 100) : 0}%` })),
  })
  return doc.y
}

/** Minimal table renderer: header row, hairline rows, automatic page breaks, optional footer row. */
function table(doc, { x, width, columns, rows, footer, header = true }) {
  const fixed = columns.reduce((t, c) => t + (c.width ?? 0), 0)
  const flexTotal = columns.reduce((t, c) => t + (c.flex ?? 0), 0)
  const widths = columns.map((c) => c.width ?? ((width - fixed) * (c.flex ?? 0)) / (flexTotal || 1))
  const padX = 3
  const bottom = doc.page.height - doc.page.margins.bottom

  const drawHeader = () => {
    const y = doc.y
    let cx = x
    doc.font('S').fontSize(8).fillColor(MUTED)
    columns.forEach((c, i) => {
      doc.text(c.label, cx + padX, y + 3, { width: widths[i] - padX * 2, align: c.align ?? 'left', lineBreak: false })
      cx += widths[i]
    })
    doc.y = y + 16
    hr(doc, x, width)
    doc.y += 2
  }

  const rowHeight = (row) => {
    let h = 0
    columns.forEach((c, i) => {
      doc.font(c.font ?? 'R').fontSize(8.5)
      h = Math.max(h, doc.heightOfString(String(row[c.key] ?? ''), { width: widths[i] - padX * 2 }))
    })
    return h + 8
  }

  const drawRow = (row, { bold = false, topRule = false } = {}) => {
    const h = rowHeight(row)
    if (doc.y + h > bottom) {
      doc.addPage()
      if (header) drawHeader()
    }
    const y = doc.y
    if (topRule) {
      doc.save().moveTo(x, y).lineTo(x + width, y).lineWidth(0.8).strokeColor(INK).stroke().restore()
    }
    let cx = x
    columns.forEach((c, i) => {
      const color = c.colorOf ? c.colorOf(row) : (c.color ?? INK)
      doc.font(bold ? 'S' : (c.font ?? 'R')).fontSize(8.5).fillColor(color)
      doc.text(String(row[c.key] ?? ''), cx + padX, y + 4, { width: widths[i] - padX * 2, align: c.align ?? 'left' })
      cx += widths[i]
    })
    doc.y = y + h
    if (!topRule) {
      doc.save().moveTo(x, doc.y).lineTo(x + width, doc.y).lineWidth(0.4).strokeColor(BORDER).stroke().restore()
    }
  }

  if (header) drawHeader()
  for (const row of rows) drawRow(row)
  if (footer) drawRow(footer, { bold: true, topRule: true })
}
