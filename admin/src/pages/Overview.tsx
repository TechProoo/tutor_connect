import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  rangeResponses,
  previousRangeResponses,
  pctDelta,
  dailyBuckets,
  campusLeaderboard,
  timeAgo,
  exportCsv,
  type RangeDays,
} from '../data'
import {
  StatCard,
  Segmented,
  BarChart,
  CampusBars,
  RolePill,
  PageHeader,
  PrimaryButton,
  type Stat,
} from '../components/ui'

const RANGE_LABELS = ['7 days', '14 days', '30 days'] as const
type RangeLabel = (typeof RANGE_LABELS)[number]
const RANGE_MAP: Record<RangeLabel, RangeDays> = { '7 days': 7, '14 days': 14, '30 days': 30 }

const FILTERS = ['All', 'Students', 'Tutors'] as const
type Filter = (typeof FILTERS)[number]

export function Overview() {
  const [rangeLabel, setRangeLabel] = useState<RangeLabel>('14 days')
  const [filter, setFilter] = useState<Filter>('All')
  const days = RANGE_MAP[rangeLabel]

  const current = useMemo(() => rangeResponses(days), [days])
  const previous = useMemo(() => previousRangeResponses(days), [days])
  const chart = useMemo(() => dailyBuckets(days), [days])
  const campuses = useMemo(() => campusLeaderboard(days).slice(0, 5), [days])

  const stats: Stat[] = useMemo(() => {
    const count = (rs: typeof current, pred: (r: (typeof current)[number]) => boolean) => rs.filter(pred).length
    const totalDelta = pctDelta(current.length, previous.length)
    const stuDelta = pctDelta(count(current, (r) => r.role === 'Student'), count(previous, (r) => r.role === 'Student'))
    const tutDelta = pctDelta(count(current, (r) => r.role === 'Tutor'), count(previous, (r) => r.role === 'Tutor'))
    const rate = (rs: typeof current) => (rs.length ? Math.round((count(rs, (r) => r.completed) / rs.length) * 100) : 0)
    const rateDelta = pctDelta(rate(current), rate(previous))
    return [
      { label: 'Total responses', value: current.length, icon: 'chart', accent: 'var(--navy)', iconBg: 'var(--navy-tint)', delta: totalDelta.text, deltaUp: totalDelta.up, trend: totalDelta.trend ?? undefined },
      { label: 'Student surveys', value: count(current, (r) => r.role === 'Student'), icon: 'cap', accent: 'var(--orange)', iconBg: 'var(--orange-tint)', delta: stuDelta.text, deltaUp: stuDelta.up, trend: stuDelta.trend ?? undefined },
      { label: 'Tutor surveys', value: count(current, (r) => r.role === 'Tutor'), icon: 'book', accent: 'var(--navy)', iconBg: 'var(--navy-tint)', delta: tutDelta.text, deltaUp: tutDelta.up, trend: tutDelta.trend ?? undefined },
      { label: 'Completion rate', value: rate(current), suffix: '%', icon: 'check', accent: 'var(--orange)', iconBg: 'var(--orange-tint)', delta: rateDelta.text, deltaUp: rateDelta.up, trend: rateDelta.trend ?? undefined },
    ]
  }, [current, previous])

  const rows = useMemo(
    () =>
      current
        .filter(
          (r) =>
            filter === 'All' ||
            (filter === 'Students' && r.role === 'Student') ||
            (filter === 'Tutors' && r.role === 'Tutor'),
        )
        .slice(0, 7),
    [current, filter],
  )

  return (
    <>
      <PageHeader kicker="Survey Dashboard" title="Response Overview">
        <Segmented options={RANGE_LABELS} value={rangeLabel} onChange={setRangeLabel} variant="outline" layoutId="range-seg" />
        <PrimaryButton icon="download" onClick={() => exportCsv(current, `tutorconnect-responses-${days}d.csv`)}>
          Export CSV
        </PrimaryButton>
      </PageHeader>

      <div className="stats-grid">
        {stats.map((s, i) => (
          <StatCard key={s.label} stat={s} index={i} />
        ))}
      </div>

      <div className="tc-grid">
        <motion.div
          className="card"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.15 }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 20,
              flexWrap: 'wrap',
              gap: 10,
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 800 }}>Responses over the last {rangeLabel}</div>
            <div style={{ display: 'flex', gap: 14, fontSize: 12, fontWeight: 600 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--navy)' }} />
                Students
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--orange)' }} />
                Tutors
              </span>
            </div>
          </div>
          <BarChart data={chart} />
        </motion.div>

        <motion.div
          className="card"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.2 }}
        >
          <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 18 }}>Top campuses</div>
          <CampusBars campuses={campuses} />
        </motion.div>
      </div>

      <motion.div
        className="card"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.25 }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 14,
            marginBottom: 18,
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 800 }}>Recent responses</div>
          <Segmented options={FILTERS} value={filter} onChange={setFilter} variant="tint" layoutId="filter-seg" />
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
            <thead>
              <tr
                style={{
                  textAlign: 'left',
                  fontSize: 11.5,
                  fontWeight: 700,
                  color: 'var(--muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                <th style={{ padding: '10px 12px' }}>Name</th>
                <th style={{ padding: '10px 12px' }}>Role</th>
                <th style={{ padding: '10px 12px' }}>Campus</th>
                <th style={{ padding: '10px 12px' }}>Department</th>
                <th style={{ padding: '10px 12px' }}>Focus</th>
                <th style={{ padding: '10px 12px' }}>Submitted</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <motion.tr
                  key={r.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: i * 0.04 }}
                  style={{ borderTop: '1px solid var(--bg)', fontSize: 13.5, fontWeight: 500 }}
                >
                  <td style={{ padding: '13px 12px', fontWeight: 700 }}>{r.name}</td>
                  <td style={{ padding: '13px 12px' }}>
                    <RolePill role={r.role} />
                  </td>
                  <td style={{ padding: '13px 12px', color: 'var(--body)' }}>{r.campus}</td>
                  <td style={{ padding: '13px 12px', color: 'var(--body)' }}>{`${r.dept}, ${r.level}`}</td>
                  <td style={{ padding: '13px 12px', color: 'var(--body)' }}>{r.focus}</td>
                  <td style={{ padding: '13px 12px', color: 'var(--muted)' }}>{timeAgo(r.submittedAt)}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </>
  )
}
