import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { exportCsv, type SurveyResponse } from '../data'
import { PageHeader, PrimaryButton, CountUp } from '../components/ui'
import { Icon } from '../icons'

interface FacultyRow {
  short: string
  full: string
  total: number
  students: number
  tutors: number
  completion: number
  topDept: string
}

export function Faculties({ responses }: { responses: SurveyResponse[] }) {
  const faculties: FacultyRow[] = useMemo(() => {
    const groups = new Map<string, SurveyResponse[]>()
    for (const r of responses) {
      if (!r.faculty) continue
      const list = groups.get(r.faculty) ?? []
      list.push(r)
      groups.set(r.faculty, list)
    }
    return [...groups.entries()]
      .map(([full, rs]) => {
        const students = rs.filter((r) => r.role === 'Student').length
        const deptCounts = new Map<string, number>()
        for (const r of rs) if (r.dept) deptCounts.set(r.dept, (deptCounts.get(r.dept) ?? 0) + 1)
        const topDept = [...deptCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—'
        return {
          short: rs[0].facultyShort,
          full,
          total: rs.length,
          students,
          tutors: rs.length - students,
          completion: rs.length ? Math.round((rs.filter((r) => r.completed).length / rs.length) * 100) : 0,
          topDept,
        }
      })
      .sort((a, b) => b.total - a.total)
  }, [responses])

  const max = Math.max(...faculties.map((c) => c.total), 1)
  const total = faculties.reduce((s, c) => s + c.total, 0)

  return (
    <>
      <PageHeader kicker="Faculties · Reach" title="Faculty Breakdown">
        <PrimaryButton icon="download" onClick={() => exportCsv(responses, 'tutorconnect-all-faculties.csv')}>
          Export All
        </PrimaryButton>
      </PageHeader>

      <motion.div
        className="card"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        style={{ marginBottom: 22, display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}
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
            across {faculties.length} {faculties.length === 1 ? 'faculty' : 'faculties'} at Bells
          </div>
        </div>
      </motion.div>

      {faculties.length === 0 && (
        <div className="card" style={{ textAlign: 'center', color: 'var(--muted)', fontWeight: 600, padding: 40 }}>
          No responses yet — faculty stats will appear as surveys come in.
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: 16,
        }}
      >
        {faculties.map((c, i) => (
          <motion.div
            key={c.full}
            className="card"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.08 + i * 0.06 }}
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
                <div style={{ fontSize: 15.5, fontWeight: 800 }}>{c.full}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>{c.short}</div>
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
                #{i + 1} faculty
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
                transition={{ duration: 0.6, delay: 0.15 + i * 0.06, ease: 'easeOut' }}
                style={{ height: '100%', background: 'var(--navy)' }}
              />
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(c.tutors / max) * 100}%` }}
                transition={{ duration: 0.6, delay: 0.15 + i * 0.06, ease: 'easeOut' }}
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
                Top dept: <strong style={{ color: 'var(--navy)' }}>{c.topDept}</strong>
              </span>
              <span style={{ color: c.completion >= 90 ? 'var(--green)' : 'var(--orange)' }}>
                {c.completion}% completed
              </span>
            </div>
          </motion.div>
        ))}
      </div>
    </>
  )
}
