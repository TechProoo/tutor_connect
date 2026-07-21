// ---------------------------------------------------------------------------
// TutorConnect Admin — data layer
// A deterministic, realistic survey-response dataset that every page derives
// its numbers from, so ranges / filters / charts all recompute for real.
// Swap `generateResponses` for an API call when the backend ships endpoints.
// ---------------------------------------------------------------------------

export type Role = 'Student' | 'Tutor'

export interface SurveyResponse {
  id: number
  name: string
  role: Role
  campus: string
  campusFull: string
  dept: string
  level: string
  focus: string
  email: string
  submittedAt: Date
  completed: boolean
}

export const CAMPUSES: { short: string; full: string; weight: number }[] = [
  { short: 'UNILAG', full: 'University of Lagos', weight: 26 },
  { short: 'OAU', full: 'Obafemi Awolowo Univ.', weight: 21 },
  { short: 'UI', full: 'University of Ibadan', weight: 17 },
  { short: 'UNIBEN', full: 'University of Benin', weight: 15 },
  { short: 'ABU Zaria', full: 'Ahmadu Bello Univ.', weight: 12 },
  { short: 'Bells Univ.', full: 'Bells University of Technology', weight: 9 },
]

const FIRST_NAMES = [
  'Amaka', 'Tunde', 'Aisha', 'Chidi', 'Ngozi', 'Femi', 'Blessing', 'Emeka',
  'Fatima', 'Segun', 'Chioma', 'Ibrahim', 'Yemi', 'Halima', 'Obinna', 'Kemi',
  'Musa', 'Adaeze', 'Kunle', 'Zainab', 'Ifeanyi', 'Bola', 'Nneka', 'Sani',
  'Tola', 'Uche', 'Funke', 'Dayo', 'Amina', 'Chinedu',
]
const LAST_NAMES = [
  'Obi', 'Bello', 'Yusuf', 'Nwosu', 'Eze', 'Adeyemi', 'Okafor', 'Ibrahim',
  'Adebayo', 'Okonkwo', 'Lawal', 'Balogun', 'Chukwu', 'Mohammed', 'Ogunleye',
  'Danladi', 'Anyanwu', 'Oyelaran', 'Abubakar', 'Nnamdi',
]

const STUDENT_TRACKS: { dept: string; focus: string }[] = [
  { dept: 'Computer Science', focus: 'Calculus, Algorithms' },
  { dept: 'Biochemistry', focus: 'Organic Chemistry' },
  { dept: 'Economics', focus: 'Microeconomics' },
  { dept: 'Law', focus: 'Constitutional Law' },
  { dept: 'Mech. Engineering', focus: 'Thermodynamics' },
  { dept: 'Accounting', focus: 'Financial Accounting' },
  { dept: 'Medicine', focus: 'Anatomy, Physiology' },
  { dept: 'Mass Comm.', focus: 'Media Writing' },
  { dept: 'Elect. Engineering', focus: 'Circuit Theory' },
  { dept: 'Statistics', focus: 'Probability Theory' },
]

const TUTOR_TRACKS: { dept: string; focus: string }[] = [
  { dept: 'Mech. Engineering', focus: 'Physics, Statistics' },
  { dept: 'Mathematics', focus: 'Maths, Further Maths' },
  { dept: 'Comp. Science', focus: 'Python, Data Structures' },
  { dept: 'Chemistry', focus: 'Organic & Inorganic Chem.' },
  { dept: 'Economics', focus: 'Econometrics' },
  { dept: 'Physics', focus: 'Mechanics, Electricity' },
  { dept: 'English', focus: 'Essay Writing, Use of English' },
  { dept: 'Accounting', focus: 'Cost Accounting, Taxation' },
]

// Deterministic PRNG so numbers are stable across reloads (mulberry32).
function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pick<T>(rand: () => number, arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)]
}

function pickCampus(rand: () => number) {
  const total = CAMPUSES.reduce((s, c) => s + c.weight, 0)
  let roll = rand() * total
  for (const c of CAMPUSES) {
    roll -= c.weight
    if (roll <= 0) return c
  }
  return CAMPUSES[0]
}

function generateResponses(): SurveyResponse[] {
  const rand = mulberry32(20260721)
  const now = new Date()
  const responses: SurveyResponse[] = []
  let id = 1

  // 30 days of history; volume ramps up towards today (the launch gained
  // traction), with weekday peaks and weekend dips.
  for (let daysAgo = 29; daysAgo >= 0; daysAgo--) {
    const date = new Date(now)
    date.setDate(now.getDate() - daysAgo)
    const dow = date.getDay()
    const weekend = dow === 0 || dow === 6
    const ramp = 1 + (29 - daysAgo) / 14 // growth factor
    const base = weekend ? 18 : 34
    const count = Math.round(base * ramp * (0.75 + rand() * 0.5))

    for (let i = 0; i < count; i++) {
      const role: Role = rand() < 0.655 ? 'Student' : 'Tutor'
      const campus = pickCampus(rand)
      const track = role === 'Student' ? pick(rand, STUDENT_TRACKS) : pick(rand, TUTOR_TRACKS)
      const level =
        role === 'Student'
          ? pick(rand, ['100L', '200L', '200L', '300L', '300L', '400L'])
          : pick(rand, ['300L', '400L', '400L', '500L', '500L', 'Graduate'])
      const first = pick(rand, FIRST_NAMES)
      const last = pick(rand, LAST_NAMES)
      const at = new Date(date)
      at.setHours(Math.floor(8 + rand() * 14), Math.floor(rand() * 60), Math.floor(rand() * 60), 0)
      responses.push({
        id: id++,
        name: `${first} ${last}`,
        role,
        campus: campus.short,
        campusFull: campus.full,
        dept: track.dept,
        level,
        focus: track.focus,
        email: `${first.toLowerCase()}.${last.toLowerCase()}${id}@student.edu.ng`,
        submittedAt: at,
        completed: rand() < 0.91,
      })
    }
  }

  return responses.sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime())
}

export const RESPONSES: SurveyResponse[] = generateResponses()

// ---------------------------------------------------------------------------
// Derived helpers
// ---------------------------------------------------------------------------

export type RangeDays = 7 | 14 | 30

export function inRange(r: SurveyResponse, days: RangeDays): boolean {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  cutoff.setHours(0, 0, 0, 0)
  return r.submittedAt >= cutoff
}

export function rangeResponses(days: RangeDays): SurveyResponse[] {
  return RESPONSES.filter((r) => inRange(r, days))
}

/** Responses from the equally-sized period immediately before the range. */
export function previousRangeResponses(days: RangeDays): SurveyResponse[] {
  const end = new Date()
  end.setDate(end.getDate() - days)
  end.setHours(0, 0, 0, 0)
  const start = new Date(end)
  start.setDate(start.getDate() - days)
  return RESPONSES.filter((r) => r.submittedAt >= start && r.submittedAt < end)
}

export function pctDelta(
  current: number,
  previous: number,
): { text: string; up: boolean; trend: 'up' | 'down' | null } {
  if (previous === 0) return { text: 'new this period', up: true, trend: null }
  const pct = Math.round(((current - previous) / previous) * 100)
  return { text: `${Math.abs(pct)}% vs. last period`, up: pct >= 0, trend: pct >= 0 ? 'up' : 'down' }
}

export interface DayBucket {
  day: string
  date: Date
  students: number
  tutors: number
}

export function dailyBuckets(days: RangeDays): DayBucket[] {
  const buckets: DayBucket[] = []
  const now = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(now.getDate() - i)
    d.setHours(0, 0, 0, 0)
    buckets.push({ day: 'SMTWTFS'[d.getDay()], date: d, students: 0, tutors: 0 })
  }
  const first = buckets[0].date
  for (const r of RESPONSES) {
    if (r.submittedAt < first) continue
    const idx = Math.floor((r.submittedAt.getTime() - first.getTime()) / 86_400_000)
    const b = buckets[idx]
    if (!b) continue
    if (r.role === 'Student') b.students++
    else b.tutors++
  }
  return buckets
}

export function campusLeaderboard(days: RangeDays): { name: string; short: string; count: number }[] {
  const counts = new Map<string, { name: string; short: string; count: number }>()
  for (const r of rangeResponses(days)) {
    const entry = counts.get(r.campus) ?? { name: r.campusFull, short: r.campus, count: 0 }
    entry.count++
    counts.set(r.campus, entry)
  }
  return [...counts.values()].sort((a, b) => b.count - a.count)
}

export function timeAgo(date: Date): string {
  const secs = Math.floor((Date.now() - date.getTime()) / 1000)
  if (secs < 60) return 'just now'
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} hr ago`
  const d = Math.floor(hrs / 24)
  if (d === 1) return 'yesterday'
  return `${d} days ago`
}

export function formatNumber(n: number): string {
  return n.toLocaleString('en-US')
}

/** Download an array of responses as a CSV file. */
export function exportCsv(rows: SurveyResponse[], filename: string) {
  const header = ['Name', 'Role', 'Campus', 'Department', 'Level', 'Focus', 'Email', 'Submitted', 'Completed']
  const escape = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
  const lines = [
    header.join(','),
    ...rows.map((r) =>
      [
        r.name,
        r.role,
        r.campusFull,
        r.dept,
        r.level,
        r.focus,
        r.email,
        r.submittedAt.toISOString(),
        r.completed ? 'Yes' : 'No',
      ]
        .map(escape)
        .join(','),
    ),
  ]
  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
