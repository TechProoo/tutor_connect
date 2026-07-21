// ---------------------------------------------------------------------------
// TutorConnect Admin — backend API client
// Fetches the real survey responses and normalises them into SurveyResponse.
// GET routes are protected with the x-admin-key header; the key is entered
// once in the unlock screen and kept in localStorage.
// ---------------------------------------------------------------------------

import { facultyShortName, type Role, type SurveyResponse } from './data'

const API_URL: string =
  import.meta.env.VITE_API_URL ??
  (import.meta.env.PROD
    ? 'https://tutorconnect-backend.onrender.com'
    : 'http://localhost:3001')

const KEY_STORAGE = 'tc-admin-key'

export function getAdminKey(): string {
  try {
    return localStorage.getItem(KEY_STORAGE) ?? ''
  } catch {
    return ''
  }
}

export function setAdminKey(key: string) {
  try {
    localStorage.setItem(KEY_STORAGE, key)
  } catch {
    // private mode — key stays for this page load only via closure below
  }
}

export class UnauthorizedError extends Error {
  constructor() {
    super('Invalid or missing admin key')
  }
}

async function get<T>(path: string): Promise<T> {
  const headers: Record<string, string> = {}
  const key = getAdminKey()
  if (key) headers['x-admin-key'] = key

  let res: Response
  try {
    res = await fetch(`${API_URL}${path}`, { headers })
  } catch {
    throw new Error(`Could not reach the API at ${API_URL}`)
  }
  if (res.status === 401) throw new UnauthorizedError()
  if (!res.ok) throw new Error(`API error ${res.status} on ${path}`)
  return res.json() as Promise<T>
}

// Raw records as returned by the backend (Prisma nullables come back null).
interface RawStudent {
  id: string
  school: string
  faculty: string
  department: string
  level: string | null
  struggled: string | null
  courses: string[]
  runTo: string | null
  wished: string | null
  wouldUse: string | null
  rate: string | null
  trust: string[]
  timing: string | null
  format: string | null
  feature: string | null
  suggestions: string | null
  createdAt: string
}

interface RawTutor {
  id: string
  school: string
  faculty: string
  department: string
  level: string | null
  helped: string | null
  canTeach: string | null
  interested: string | null
  why: string[]
  earn: string | null
  format: string | null
  stopYou: string | null
  join: string | null
  feature: string | null
  suggestions: string | null
  createdAt: string
}

function answeredRatio(fields: Array<string | null | string[]>): number {
  const filled = fields.filter((f) =>
    Array.isArray(f) ? f.length > 0 : (f ?? '').trim() !== '',
  ).length
  return fields.length === 0 ? 1 : filled / fields.length
}

function base(
  r: RawStudent | RawTutor,
  role: Role,
): Pick<
  SurveyResponse,
  'id' | 'role' | 'school' | 'faculty' | 'facultyShort' | 'dept' | 'level' | 'submittedAt'
> {
  return {
    id: r.id,
    role,
    school: r.school ?? '',
    faculty: r.faculty,
    facultyShort: facultyShortName(r.faculty),
    dept: r.department,
    level: r.level ?? '',
    submittedAt: new Date(r.createdAt),
  }
}

function mapStudent(r: RawStudent): SurveyResponse {
  const ratio = answeredRatio([
    r.level, r.struggled, r.courses, r.runTo, r.wished, r.wouldUse,
    r.rate, r.trust, r.timing, r.format,
  ])
  return {
    ...base(r, 'Student'),
    focus: r.courses.join(', ') || '—',
    rate: r.rate ?? '',
    format: r.format ?? '',
    completed: ratio >= 2 / 3,
  }
}

function mapTutor(r: RawTutor): SurveyResponse {
  const ratio = answeredRatio([
    r.level, r.helped, r.canTeach, r.interested, r.why,
    r.earn, r.format, r.stopYou, r.join,
  ])
  return {
    ...base(r, 'Tutor'),
    focus: r.canTeach ?? '—',
    rate: r.earn ?? '',
    format: r.format ?? '',
    completed: ratio >= 2 / 3,
  }
}

/** Fetch every response (students + tutors), newest first. */
export async function loadResponses(): Promise<SurveyResponse[]> {
  const [students, tutors] = await Promise.all([
    get<RawStudent[]>('/survey/student'),
    get<RawTutor[]>('/survey/tutor'),
  ])
  return [...students.map(mapStudent), ...tutors.map(mapTutor)].sort(
    (a, b) => b.submittedAt.getTime() - a.submittedAt.getTime(),
  )
}
