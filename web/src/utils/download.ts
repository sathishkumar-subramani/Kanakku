import { API_URL, getAccessToken, refreshSession } from '@/api/session'

async function authedFetch(path: string): Promise<Response> {
  const go = () =>
    fetch(`${API_URL}${path}`, {
      headers: { Authorization: `Bearer ${getAccessToken() ?? ''}` },
    })
  let res = await go()
  if (res.status === 401 && (await refreshSession())) res = await go()
  return res
}

function filenameFrom(res: Response, fallback: string) {
  const cd = res.headers.get('Content-Disposition') ?? ''
  const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(cd)
  return m ? decodeURIComponent(m[1]) : fallback
}

/** Downloads a monthly report. scope: undefined = everything, "personal", or a group id. */
export async function downloadReport(month: string, format: 'pdf' | 'csv', scope?: string): Promise<void> {
  const params = new URLSearchParams({ month, format })
  if (scope) params.set('groupId', scope)
  const res = await authedFetch(`/reports/monthly?${params.toString()}`)
  if (!res.ok) {
    let detail = `Download failed (${res.status}).`
    try {
      const body = (await res.json()) as { detail?: string }
      if (body.detail) detail = body.detail
    } catch {
      /* not json */
    }
    throw new Error(detail)
  }
  const blob = await res.blob()
  const name = filenameFrom(res, `kanakku-${month}.${format}`)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
