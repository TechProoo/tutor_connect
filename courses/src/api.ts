// API client for the Tutor Connect guide portal.
// The device token is the student's only credential: it is issued once at
// redemption and replayed on every request from that browser.

const API_URL: string =
  import.meta.env.VITE_API_URL ??
  (import.meta.env.PROD
    ? 'https://tutor-connect-e57d.onrender.com'
    : 'http://localhost:3001')

const TOKEN_KEY = 'tc-device-token'

export function getToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? ''
  } catch {
    return ''
  }
}

export function setToken(token: string) {
  try {
    localStorage.setItem(TOKEN_KEY, token)
  } catch {
    /* private mode — the HTTP-only cookie is the fallback */
  }
}

export function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* ignore */
  }
}

export interface Session {
  buyer: { name: string; phone: string }
  guide: {
    id: string
    title: string
    courseCode: string
    subject: string | null
    description: string | null
    pageCount: number
    version: number
    ready: boolean
  }
  redeemedAt: string | null
  deviceLabel: string | null
}

export interface CatalogItem {
  id: string
  title: string
  courseCode: string
  subject: string | null
  description: string | null
  pageCount: number
}

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  const token = getToken()
  if (token) headers.set('x-device-token', token)
  if (init.body) headers.set('Content-Type', 'application/json')

  let res: Response
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers,
      credentials: 'include',
    })
  } catch {
    throw new ApiError(
      "We couldn't reach the server. Check your connection and try again.",
      0,
    )
  }

  if (!res.ok) {
    let message = 'Something went wrong. Please try again.'
    try {
      const body = await res.json()
      if (typeof body?.message === 'string') message = body.message
      else if (Array.isArray(body?.message)) message = body.message[0]
    } catch {
      /* keep the default */
    }
    throw new ApiError(message, res.status)
  }

  return res.json() as Promise<T>
}

export function redeem(code: string) {
  return request<Session & { deviceToken?: string }>('/access/redeem', {
    method: 'POST',
    body: JSON.stringify({ code }),
  })
}

export function getSession() {
  return request<Session>('/access/session')
}

export function getCatalog() {
  return request<CatalogItem[]>('/access/catalog')
}

export function submitRecovery(input: {
  name: string
  phone: string
  email: string
  codeHint?: string
  reason?: string
}) {
  return request<{ id: string; status: string }>('/recovery', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/**
 * Fetch one watermarked page as a blob URL. Pages are authenticated, so they
 * can't be loaded through a plain <img src> pointing at the API.
 */
export async function fetchPage(n: number, signal?: AbortSignal): Promise<string> {
  const headers = new Headers()
  const token = getToken()
  if (token) headers.set('x-device-token', token)

  const res = await fetch(`${API_URL}/access/page/${n}`, {
    headers,
    credentials: 'include',
    signal,
  })
  if (!res.ok) throw new ApiError('Could not load this page.', res.status)
  return URL.createObjectURL(await res.blob())
}
