import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { exportCsv, type SurveyResponse } from '../data'
import { PageHeader, PrimaryButton, CountUp } from '../components/ui'
import { Icon } from '../icons'

interface Group {
  full: string
  subtitle: string
  total: number
  students: number
  tutors: number
  completion: number
  topLabel: string
  top: string
}

/** Group responses by `keyOf`, with the most common `topOf` value per group. */
function buildGroups(
  responses: SurveyResponse[],
  keyOf: (r: SurveyResponse) => string,
  subtitleOf: (rs: SurveyResponse[]) => string,
  topLabel: string,
  topOf: (r: SurveyResponse) => string,
): Group[] {
  const groups = new Map<string, SurveyResponse[]>()
  for (const r of responses) {
    const k = keyOf(r)
    if (!k) continue
    const list = groups.get(k) ?? []
    list.push(r)
    groups.set(k, list)
  }
  return [...groups.entries()]
    .map(([full, rs]) => {
      const students = rs.filter((r) => r.role === 'Student').length
      const counts = new Map<string, number>()
      for (const r of rs) {
        const t = topOf(r)
        if (t) counts.set(t, (counts.get(t) ?? 0) + 1)
      }
      const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—'
      return {
        full,
        subtitle: subtitleOf(rs),
        total: rs.length,
        students,
        tutors: rs.length - students,
        completion: rs.length ? Math.round((rs.filter((r) => r.completed).length / rs.length) * 100) : 0,
        topLabel,
        top,
      }
    })
    .sort((a, b) => b.total - a.total)
}

export function Faculties({ responses }: { responses: SurveyResponse[] }) {
  const universities = useMemo(
    () =>
      buildGroups(
        responses,
        (r) => r.school,
        () => 'University',
        'Top faculty',
        (r) => r.facultyShort,
      ),
    [responses],
  )
  const faculties = useMemo(
    () =>
      buildGroups(
        responses,
        (r) => r.faculty,
        (rs) => rs[0].facultyShort,
        'Top dept',
        (r) => r.dept,
      ),
    [responses],
  )

  const total = responses.length

  return (
    <>
      <PageHeader kicker="Reach · Breakdown" title="Reach Breakdown">
        <PrimaryButton icon="download" onClick={() => exportCsv(responses, 'tutorconnect-all-responses.csv')}>
          Export All
        </PrimaryButton>
      </PageHeader>

      <motion.div
        className="card"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        style={{ marginBottom: 26, display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}
      >
        <span
          style={{
            width: 44,
            height: 44,
            borderRadius: 13,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--orange-tint)',
            color: 'var(--orange)',
            flexShrink: 0,
          }}
        >
          <Icon name="building" size={21} />
        </span>
        <div>
          <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.8px', lineHeight: 1.1 }}>
            <CountUp value={total} /> responses
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)' }}>
            across {universities.length} {universities.length === 1 ? 'university' : 'universities'} ·{' '}
            {faculties.length} {faculties.length === 1 ? 'faculty' : 'faculties'}
          </div>
        </div>
      </motion.div>

      <Section title="University Breakdown" subtitle="Responses grouped by school attended">
        {universities.length === 0 ? (
          <EmptyNote text="No responses yet — university stats appear as surveys come in." />
        ) : (
          <BreakdownGrid groups={universities} />
        )}
      </Section>

      <Section title="Faculty Breakdown" subtitle="Responses grouped by faculty or college">
        {faculties.length === 0 ? (
          <EmptyNote text="No responses yet — faculty stats appear as surveys come in." />
        ) : (
          <BreakdownGrid groups={faculties} />
        )}
      </Section>
    </>
  )
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <div style={{ marginBottom: 30 }}>
      <div style={{ marginBottom: 14 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, letterSpacing: '-0.4px' }}>{title}</h2>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--muted)', marginTop: 2 }}>{subtitle}</div>
      </div>
      {children}
    </div>
  )
}

function EmptyNote({ text }: { text: string }) {
  return (
    <div className="card" style={{ textAlign: 'center', color: 'var(--muted)', fontWeight: 600, padding: 32 }}>
      {text}
    </div>
  )
}

function BreakdownGrid({ groups }: { groups: Group[] }) {
  const max = Math.max(...groups.map((g) => g.total), 1)
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
        gap: 16,
      }}
    >
      {groups.map((c, i) => (
        <motion.div
          key={c.full}
          className="card"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.05 + i * 0.05 }}
          whileHover={{ y: -3, boxShadow: '0 8px 22px rgba(26,58,92,.10)' }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 10,
              marginBottom: 14,
            }}
          >
            <div>
              <div style={{ fontSize: 15.5, fontWeight: 800, lineHeight: 1.25 }}>{c.full}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>{c.subtitle}</div>
            </div>
            <span
              style={{
                fontSize: 11.5,
                fontWeight: 700,
                padding: '4px 11px',
                borderRadius: 999,
                background: i === 0 ? 'var(--orange-tint)' : 'var(--navy-tint)',
                color: i === 0 ? 'var(--orange)' : 'var(--navy)',
                whiteSpace: 'nowrap',
              }}
            >
              #{i + 1}
            </span>
          </div>

          <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-1px', lineHeight: 1 }}>
            <CountUp value={c.total} />
          </div>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--muted)', margin: '6px 0 14px' }}>
            {c.students.toLocaleString('en-US')} students · {c.tutors.toLocaleString('en-US')} tutors
          </div>

          <div
            title={`${c.students} students / ${c.tutors} tutors`}
            style={{
              height: 8,
              background: 'var(--bg)',
              borderRadius: 999,
              overflow: 'hidden',
              display: 'flex',
              marginBottom: 14,
            }}
          >
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(c.students / max) * 100}%` }}
              transition={{ duration: 0.6, delay: 0.12 + i * 0.05, ease: 'easeOut' }}
              style={{ height: '100%', background: 'var(--navy)' }}
            />
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(c.tutors / max) * 100}%` }}
              transition={{ duration: 0.6, delay: 0.12 + i * 0.05, ease: 'easeOut' }}
              style={{ height: '100%', background: 'var(--orange)' }}
            />
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 12.5,
              fontWeight: 600,
              color: 'var(--body)',
              borderTop: '1px solid var(--bg)',
              paddingTop: 12,
              gap: 10,
              flexWrap: 'wrap',
            }}
          >
            <span>
              {c.topLabel}: <strong style={{ color: 'var(--navy)' }}>{c.top}</strong>
            </span>
            <span style={{ color: c.completion >= 90 ? 'var(--green)' : 'var(--orange)' }}>
              {c.completion}% completed
            </span>
          </div>
        </motion.div>
      ))}
    </div>
  )
}
