// ---------------------------------------------------------------------------
// Admin API for the course-guide system (guides, access codes, recovery).
// Reuses the same admin key as the survey dashboard.
// ---------------------------------------------------------------------------

import { getAdminKey, UnauthorizedError } from './api'

const API_URL: string =
  import.meta.env.VITE_API_URL ??
  (import.meta.env.PROD
    ? 'https://tutor-connect-e57d.onrender.com'
    : 'http://localhost:3001')

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  const key = getAdminKey()
  if (key) headers.set('x-admin-key', key)
  if (init.body && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }

  let res: Response
  try {
    // Admin data changes constantly — never let the browser serve a cached
    // list back after a mutation.
    res = await fetch(`${API_URL}${path}`, { ...init, headers, cache: 'no-store' })
  } catch {
    throw new Error(`Could not reach the API at ${API_URL}`)
  }
  if (res.status === 401) throw new UnauthorizedError()
  if (!res.ok) {
    let message = `Request failed (${res.status})`
    try {
      const body = await res.json()
      if (typeof body?.message === 'string') message = body.message
      else if (Array.isArray(body?.message)) message = body.message.join(', ')
    } catch {
      /* keep default */
    }
    throw new Error(message)
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T)
}

const post = <T>(p: string, body?: unknown) =>
  call<T>(p, { method: 'POST', body: body ? JSON.stringify(body) : undefined })
const patch = <T>(p: string, body: unknown) =>
  call<T>(p, { method: 'PATCH', body: JSON.stringify(body) })
const del = <T>(p: string) => call<T>(p, { method: 'DELETE' })

// --- Guides -----------------------------------------------------------------

export type GuideStatus = 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED'

export interface Guide {
  id: string
  title: string
  courseCode: string
  subject: string | null
  description: string | null
  version: number
  published: boolean
  status: GuideStatus
  pageCount: number
  error: string | null
  createdAt: string
  updatedAt: string
  _count?: { codes: number }
}

export const listGuides = () => call<Guide[]>('/guides')
export const getGuide = (id: string) => call<Guide>(`/guides/${id}`)
export const createGuide = (b: {
  title: string
  courseCode: string
  subject?: string
  description?: string
}) => post<Guide>('/guides', b)
export const updateGuide = (id: string, b: Partial<Guide>) =>
  patch<Guide>(`/guides/${id}`, b)
export const deleteGuide = (id: string) => del<{ deleted: boolean }>(`/guides/${id}`)

export function uploadGuideFile(id: string, file: File) {
  const form = new FormData()
  form.append('file', file)
  return call<Guide>(`/guides/${id}/file`, { method: 'POST', body: form })
}

// --- Access codes -----------------------------------------------------------

export type CodeStatus = 'UNUSED' | 'REDEEMED' | 'DISABLED' | 'REVOKED'
export type EmailStatus = 'PENDING' | 'SENT' | 'FAILED' | 'SKIPPED'

export interface AccessCode {
  id: string
  codeLast4: string
  guideId: string
  buyerName: string
  buyerPhone: string
  buyerEmail: string
  status: CodeStatus
  deviceLabel: string | null
  deviceUa: string | null
  deviceIp: string | null
  redeemedAt: string | null
  lastAccessAt: string | null
  accessCount: number
  resetCount: number
  emailStatus: EmailStatus
  emailError: string | null
  emailSentAt: string | null
  createdAt: string
  guide: { id: string; title: string; courseCode: string }
  /** Only present in the response that creates or regenerates a code. */
  code?: string
}

export interface CodeStats {
  unused: number
  redeemed: number
  disabled: number
  revoked: number
  total: number
  guides: number
}

export function listCodes(params: {
  q?: string
  status?: CodeStatus
  guideId?: string
}) {
  const qs = new URLSearchParams()
  if (params.q) qs.set('q', params.q)
  if (params.status) qs.set('status', params.status)
  if (params.guideId) qs.set('guideId', params.guideId)
  const s = qs.toString()
  return call<AccessCode[]>(`/codes${s ? `?${s}` : ''}`)
}

export const codeStats = () => call<CodeStats>('/codes/stats')
export const createCode = (b: {
  guideId: string
  buyerName: string
  buyerPhone: string
  buyerEmail: string
}) => post<AccessCode>('/codes', b)
export const disableCode = (id: string) => post<AccessCode>(`/codes/${id}/disable`)
export const revokeCode = (id: string) => post<AccessCode>(`/codes/${id}/revoke`)
export const restoreCode = (id: string) => post<AccessCode>(`/codes/${id}/restore`)
export const resetCodeDevice = (id: string) =>
  post<AccessCode>(`/codes/${id}/reset-device`)
export const regenerateCode = (id: string) =>
  post<AccessCode>(`/codes/${id}/regenerate`)
export const deleteCode = (id: string) => del<{ deleted: boolean }>(`/codes/${id}`)
export const updateBuyer = (
  id: string,
  b: { buyerName?: string; buyerPhone?: string; buyerEmail?: string },
) => patch<AccessCode>(`/codes/${id}/buyer`, b)

// --- Recovery ---------------------------------------------------------------

export type RecoveryStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export interface RecoveryRequest {
  id: string
  name: string
  phone: string
  email: string
  codeHint: string | null
  reason: string | null
  status: RecoveryStatus
  adminNote: string | null
  createdAt: string
  resolvedAt: string | null
  guide: { id: string; title: string; courseCode: string } | null
}

export interface RecoveryMatch {
  id: string
  codeLast4: string
  buyerName: string
  buyerPhone: string
  buyerEmail: string
  status: CodeStatus
  deviceLabel: string | null
  redeemedAt: string | null
  resetCount: number
  guide: { id: string; title: string; courseCode: string }
}

export const listRecovery = (status?: RecoveryStatus) =>
  call<RecoveryRequest[]>(`/admin/recovery${status ? `?status=${status}` : ''}`)
export const recoveryMatches = (id: string) =>
  call<RecoveryMatch[]>(`/admin/recovery/${id}/matches`)
export const approveRecovery = (id: string, adminNote?: string) =>
  post<RecoveryRequest>(`/admin/recovery/${id}/approve`, { adminNote })
export const rejectRecovery = (id: string, adminNote?: string) =>
  post<RecoveryRequest>(`/admin/recovery/${id}/reject`, { adminNote })
export const deleteRecovery = (id: string) =>
  del<{ deleted: boolean }>(`/admin/recovery/${id}`)
