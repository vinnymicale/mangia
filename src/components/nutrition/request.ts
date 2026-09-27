/**
 * JSON in, JSON out, with the route's own error message when it gave one.
 * Every nutrition control talks to its route the same way, and each shows the
 * failure inline rather than throwing.
 */
export async function requestJson<T>(
  url: string,
  init: { method?: string; body?: unknown } = {},
): Promise<{ ok: true; data: T } | { ok: false; error: string; status: number }> {
  try {
    const response = await fetch(url, {
      method: init.method ?? 'GET',
      headers: init.body === undefined ? undefined : { 'content-type': 'application/json' },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    })
    const data = await response.json().catch(() => null)
    if (!response.ok) {
      const error = typeof data?.error === 'string' ? data.error : 'Something went wrong.'
      return { ok: false, error, status: response.status }
    }
    return { ok: true, data: data as T }
  } catch {
    return { ok: false, error: 'Could not reach the server.', status: 0 }
  }
}
