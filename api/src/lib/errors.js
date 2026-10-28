import { ZodError } from 'zod'

const titles = {
  400: 'Validation failed',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not found',
  409: 'Conflict',
  500: 'Server error',
}

/** An error that becomes an RFC 7807 problem response: { status, title, detail, errors }. */
export class ApiError extends Error {
  constructor(status, detail, { title, errors, field } = {}) {
    super(detail)
    this.status = status
    this.title = title ?? titles[status] ?? 'Error'
    this.errors = errors ?? (field ? { [field]: [detail] } : undefined)
  }

  static badRequest(detail, field) {
    return new ApiError(400, detail, { field })
  }
  static unauthorized(detail = 'Please sign in.', title) {
    return new ApiError(401, detail, { title })
  }
  static forbidden(detail = 'You are not allowed to do that.') {
    return new ApiError(403, detail)
  }
  static notFound(what = 'Resource') {
    return new ApiError(404, what.endsWith('.') ? what : `${what} not found.`)
  }
  static conflict(detail) {
    return new ApiError(409, detail)
  }
}

/** Turns a ZodError into the same shape: detail = first message, errors = { field: [messages] }. */
function fromZod(err) {
  const errors = {}
  for (const issue of err.issues) {
    const path = issue.path.length ? String(issue.path[issue.path.length - 1]) : 'body'
    ;(errors[path] ??= []).push(issue.message)
  }
  const detail = err.issues[0]?.message ?? 'Please check the form.'
  return new ApiError(400, detail, { errors })
}

export function notFoundHandler(req, _res, next) {
  next(new ApiError(404, `No route for ${req.method} ${req.path}.`))
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  let error = err
  if (err instanceof ZodError) error = fromZod(err)
  else if (err?.type === 'entity.parse.failed') error = new ApiError(400, 'The request body is not valid JSON.')
  else if (err?.type === 'entity.too.large') error = new ApiError(413, 'Request body too large.', { title: 'Payload too large' })
  else if (err?.code === 11000) error = new ApiError(409, 'That value is already taken.')
  else if (err?.name === 'CastError') error = ApiError.notFound('Resource')

  if (!(error instanceof ApiError)) {
    req.log?.error({ err }, 'Unhandled error')
    error = new ApiError(500, 'Something went wrong on the server. Please try again.')
  }

  if (res.headersSent) return
  res.status(error.status).type('application/problem+json').json({
    status: error.status,
    title: error.title,
    detail: error.message,
    errors: error.errors ?? null,
  })
}
