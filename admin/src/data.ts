// ---------------------------------------------------------------------------
// TutorConnect Admin — data layer
// Types and pure helpers over the real survey responses fetched from the
// backend (see api.ts). Every page derives its numbers from the same array.
// ---------------------------------------------------------------------------

export type Role = 'Student' | 'Tutor'

/** One question → answer pair for the detail view. `freeText` marks the
 *  open-ended "message" answers (feature ideas, suggestions, etc.). */
export interface Answer {
  label: string
  value: string
  freeText?: boolean
}

/** A student or tutor survey response, normalised for the dashboard. */
export interface SurveyResponse {
  id: string
  role: Role
  /** School / university attended ('' if not recorded). */
  school: string
  /** Full faculty name, e.g. "Faculty of Computing" ('' if not recorded). */
  faculty: string
  /** Faculty without the "Faculty of " prefix, for compact display. */
  facultyShort: string
  dept: string
  level: string
  /**
   * Phone / WhatsApp number from the optional "get notified before launch"
   * field ('' when not given). Stored in the survey's `suggestions` column.
   */
  phone: string
  /** Students: courses they struggle with · Tutors: courses they can teach. */
  focus: string
  /** Students: willing-to-pay rate · Tutors: expected earning rate. */
  rate: string
  format: string
  submittedAt: Date
  /** True when at least two-thirds of the optional questions were answered. */
  completed: boolean
  /** Every question → answer for this response, in survey order. */
  answers: Answer[]
}

/** Fixed faculty list (mirrors the survey form) for filters. */
export const FACULTIES = [
  'Faculty of Computing',
  'Faculty of Basic Medical Sciences',
  'Faculty of Nursing',
  'Faculty of Arts',
  'Faculty of Technology',
  'Faculty of Social Management and Sciences',
  'Faculty of Law',
  'Faculty of Education',
  'Faculty of Science',
  'Faculty of Pharmacy',
  'Faculty of Engineering',
]

export function facultyShortName(faculty: string): string {
  const short = faculty.replace(/^Faculty of /i, '').trim()
  return short || '—'
}

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

export function rangeResponses(all: SurveyResponse[], days: RangeDays): SurveyResponse[] {
  return all.filter((r) => inRange(r, days))
}

/** Responses from the equally-sized period immediately before the range. */
export function previousRangeResponses(all: SurveyResponse[], days: RangeDays): SurveyResponse[] {
  const end = new Date()
  end.setDate(end.getDate() - days)
  end.setHours(0, 0, 0, 0)
  const start = new Date(end)
  start.setDate(start.getDate() - days)
  return all.filter((r) => r.submittedAt >= start && r.submittedAt < end)
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

export function dailyBuckets(all: SurveyResponse[], days: RangeDays): DayBucket[] {
  const buckets: DayBucket[] = []
  const now = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(now.getDate() - i)
    d.setHours(0, 0, 0, 0)
    buckets.push({ day: 'SMTWTFS'[d.getDay()], date: d, students: 0, tutors: 0 })
  }
  const first = buckets[0].date
  for (const r of all) {
    if (r.submittedAt < first) continue
    const idx = Math.floor((r.submittedAt.getTime() - first.getTime()) / 86_400_000)
    const b = buckets[idx]
    if (!b) continue
    if (r.role === 'Student') b.students++
    else b.tutors++
  }
  return buckets
}

export function facultyLeaderboard(
  all: SurveyResponse[],
  days: RangeDays,
): { name: string; short: string; count: number }[] {
  const counts = new Map<string, { name: string; short: string; count: number }>()
  for (const r of rangeResponses(all, days)) {
    if (!r.faculty) continue
    const entry = counts.get(r.faculty) ?? { name: r.faculty, short: r.facultyShort, count: 0 }
    entry.count++
    counts.set(r.faculty, entry)
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

/**
 * Render a phone number as a cell that keeps its leading zero.
 *
 * These numbers are Nigerian and written as 08012345678. Left as a bare value,
 * Excel and Google Sheets read the cell as a number and drop the leading zero,
 * which quietly turns every exported number into an unusable one. An explicit
 * text formula is the portable way to stop that.
 *
 * The number is reduced to phone characters first: the field is free text from
 * a public form, so this also means a submitted value can never break out of
 * the formula it is being placed in.
 */
function phoneCell(phone: string): string {
  const clean = phone.replace(/[^\d+\-() ]/g, '').trim()
  return clean ? `="${clean}"` : ''
}

/** Download an array of responses as a CSV file. */
export function exportCsv(rows: SurveyResponse[], filename: string) {
  const header = ['Role', 'Phone', 'School', 'Faculty', 'Department', 'Level', 'Focus', 'Rate', 'Format', 'Status', 'Submitted']
  const escape = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
  const lines = [
    header.join(','),
    ...rows.map((r) =>
      [
        escape(r.role),
        // Already a complete cell, so it must not be escaped again.
        phoneCell(r.phone),
        escape(r.school),
        escape(r.faculty),
        escape(r.dept),
        escape(r.level),
        escape(r.focus),
        escape(r.rate),
        escape(r.format),
        escape(r.completed ? 'Completed' : 'Partial'),
        escape(r.submittedAt.toISOString()),
      ].join(','),
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
