const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

export async function api<T>(path: string, token?: string | null, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers)
  if (options.body) headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)

  let response: Response
  try {
    response = await fetch(`${API_URL}/api${path}`, { ...options, headers })
  } catch {
    throw new Error('Could not reach the MilkRoute server. Check your connection and server URL.')
  }

  let payload: { message?: string }
  try {
    payload = await response.json() as { message?: string }
  } catch {
    throw new Error('The MilkRoute server returned an unreadable response.')
  }
  if (!response.ok) throw new Error(payload.message ?? `Request failed (${response.status}).`)
  return payload as T
}
