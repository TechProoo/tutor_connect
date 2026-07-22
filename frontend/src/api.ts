// Small API client for the TutorConnect backend (NestJS on Render).
// VITE_API_URL overrides the target; dev falls back to the local backend.
const API_URL: string =
  import.meta.env.VITE_API_URL ??
  (import.meta.env.PROD
    ? 'https://tutor-connect-e57d.onrender.com'
    : 'http://localhost:3001')

/** Drop empty strings / empty arrays so optional fields stay unset. */
function compact(obj: Record<string, string | string[]>) {
  const out: Record<string, string | string[]> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (Array.isArray(v) ? v.length > 0 : v.trim() !== '') out[k] = v
  }
  return out
}

async function post(path: string, body: Record<string, string | string[]>) {
  let res: Response
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    throw new Error(
      "We couldn't reach the server. Check your connection and try again.",
    )
  }
  if (!res.ok) {
    throw new Error(
      'Something went wrong submitting your response. Please try again.',
    )
  }
  return res.json()
}

export interface StudentAnswers {
  school: string
  faculty: string
  dept: string
  level: string
  struggled: string
  courses: string[]
  runto: string
  wished: string
  woulduse: string
  rate: string
  trust: string[]
  timing: string
  format: string
  feature: string
  whatsapp: string
}

export interface TutorAnswers {
  school: string
  faculty: string
  dept: string
  level: string
  helped: string
  canteach: string
  interested: string
  why: string[]
  earn: string
  format: string
  stopyou: string
  join: string
  feature: string
  whatsapp: string
}

export function submitStudentSurvey(s: StudentAnswers) {
  return post(
    '/survey/student',
    compact({
      school: s.school,
      faculty: s.faculty,
      department: s.dept,
      level: s.level,
      struggled: s.struggled,
      courses: s.courses,
      runTo: s.runto,
      wished: s.wished,
      wouldUse: s.woulduse,
      rate: s.rate,
      trust: s.trust,
      timing: s.timing,
      format: s.format,
      feature: s.feature,
      suggestions: s.whatsapp,
    }),
  )
}

export function submitTutorSurvey(t: TutorAnswers) {
  return post(
    '/survey/tutor',
    compact({
      school: t.school,
      faculty: t.faculty,
      department: t.dept,
      level: t.level,
      helped: t.helped,
      canTeach: t.canteach,
      interested: t.interested,
      why: t.why,
      earn: t.earn,
      format: t.format,
      stopYou: t.stopyou,
      join: t.join,
      feature: t.feature,
      suggestions: t.whatsapp,
    }),
  )
}
