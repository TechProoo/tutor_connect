import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FACULTIES, timeAgo, exportCsv, type Role, type SurveyResponse } from '../data'
import { StatCard, PageHeader, PrimaryButton, RolePill, ResponseModal, type Stat } from '../components/ui'
import { Icon } from '../icons'

const PAGE_SIZE = 10
// Snapshot "now" once per load so week-based stats stay stable across re-renders.
const LOADED_AT = Date.now()

export function People({ role, responses }: { role: Role; responses: SurveyResponse[] }) {
  const [query, setQuery] = useState('')
  const [faculty, setFaculty] = useState('All faculties')
  const [selected, setSelected] = useState<SurveyResponse | null>(null)

  // Paging keyed to the active filters: when role/query/faculty change, the
  // stored key no longer matches and the page derives back to 0 — no effect needed.
  const filterKey = `${role}|${query}|${faculty}`
  const [paging, setPaging] = useState({ key: filterKey, page: 0 })
  const page = paging.key === filterKey ? paging.page : 0
  const setPage = (fn: (p: number) => number) => setPaging({ key: filterKey, page: fn(page) })

  const plural = role === 'Student' ? 'Students' : 'Tutors'
  const all = useMemo(() => responses.filter((r) => r.role === role), [responses, role])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return all.filter(
      (r) =>
        (faculty === 'All faculties' || r.faculty === faculty) &&
        (!q ||
          r.school.toLowerCase().includes(q) ||
          r.faculty.toLowerCase().includes(q) ||
          r.dept.toLowerCase().includes(q) ||
          r.level.toLowerCase().includes(q) ||
          r.focus.toLowerCase().includes(q) ||
          r.rate.toLowerCase().includes(q)),
    )
  }, [all, query, faculty])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const rows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const stats: Stat[] = useMemo(() => {
    const completed = all.filter((r) => r.completed).length
    const week = all.filter((r) => LOADED_AT - r.submittedAt.getTime() < 7 * 86_400_000).length
    const facultyCount = new Set(all.map((r) => r.faculty).filter(Boolean)).size
    return [
      { label: `Total ${plural.toLowerCase()}`, value: all.length, icon: role === 'Student' ? 'cap' : 'book', accent: 'var(--navy)', iconBg: 'var(--navy-tint)', delta: `${filtered.length.toLocaleString('en-US')} matching filters`, deltaUp: true },
      { label: 'New this week', value: week, icon: 'trend', accent: 'var(--orange)', iconBg: 'var(--orange-tint)', delta: 'last 7 days', deltaUp: true },
      { label: 'Completed surveys', value: completed, icon: 'check', accent: 'var(--navy)', iconBg: 'var(--navy-tint)', delta: `${Math.round((completed / Math.max(all.length, 1)) * 100)}% completion`, deltaUp: true },
      { label: 'Faculties reached', value: facultyCount, icon: 'building', accent: 'var(--orange)', iconBg: 'var(--orange-tint)', delta: 'across Bells', deltaUp: true },
    ]
  }, [all, filtered.length, plural, role])

  return (
    <>
      <PageHeader kicker={`${plural} · Responses`} title={`${plural} Responses`}>
        <PrimaryButton
          icon="download"
          onClick={() => exportCsv(filtered, `tutorconnect-${plural.toLowerCase()}.csv`)}
        >
          Export {plural}
        </PrimaryButton>
      </PageHeader>

      <div className="stats-grid">
        {stats.map((s, i) => (
          <StatCard key={s.label} stat={s} index={i} />
        ))}
      </div>

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
            flexWrap: 'wrap',
            gap: 14,
            marginBottom: 18,
          }}
        >
          <div style={{ position: 'relative', flex: '1 1 220px', maxWidth: 340 }}>
            <span
              style={{
                position: 'absolute',
                left: 13,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--muted)',
                display: 'inline-flex',
              }}
            >
              <Icon name="search" size={15} />
            </span>
            <input
              className="text-input"
              style={{ width: '100%', paddingLeft: 38 }}
              placeholder={`Search ${plural.toLowerCase()} by faculty, dept, focus…`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <select
            className="text-input"
            style={{ cursor: 'pointer' }}
            value={faculty}
            onChange={(e) => setFaculty(e.target.value)}
          >
            <option>All faculties</option>
            {FACULTIES.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
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
                <th style={{ padding: '10px 12px' }}>Faculty</th>
                <th style={{ padding: '10px 12px' }}>Role</th>
                <th style={{ padding: '10px 12px' }}>Department</th>
                <th style={{ padding: '10px 12px' }}>
                  {role === 'Student' ? 'Struggling with' : 'Can teach'}
                </th>
                <th style={{ padding: '10px 12px' }}>
                  {role === 'Student' ? 'Will pay' : 'Wants to earn'}
                </th>
                <th style={{ padding: '10px 12px' }}>Status</th>
                <th style={{ padding: '10px 12px' }}>Submitted</th>
                <th style={{ padding: '10px 12px' }}></th>
              </tr>
            </thead>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.tbody
                key={`${role}-${page}-${query}-${faculty}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
              >
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    className="data-row"
                    onClick={() => setSelected(r)}
                    title="Click to read the full response"
                    style={{
                      borderTop: '1px solid var(--bg)',
                      fontSize: 13.5,
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    <td style={{ padding: '13px 12px', fontWeight: 700 }}>
                      {r.facultyShort}
                      <div style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--muted)' }}>{r.school || '—'}</div>
                    </td>
                    <td style={{ padding: '13px 12px' }}>
                      <RolePill role={r.role} />
                    </td>
                    <td style={{ padding: '13px 12px', color: 'var(--body)' }}>
                      {r.level ? `${r.dept}, ${r.level}` : r.dept}
                    </td>
                    <td style={{ padding: '13px 12px', color: 'var(--body)', maxWidth: 240 }}>{r.focus}</td>
                    <td style={{ padding: '13px 12px', color: 'var(--body)', whiteSpace: 'nowrap' }}>{r.rate || '—'}</td>
                    <td style={{ padding: '13px 12px' }}>
                      <span
                        style={{
                          fontSize: 11.5,
                          fontWeight: 700,
                          padding: '4px 11px',
                          borderRadius: 999,
                          background: r.completed ? 'rgba(31,157,85,.1)' : 'rgba(214,69,69,.09)',
                          color: r.completed ? 'var(--green)' : 'var(--red)',
                        }}
                      >
                        {r.completed ? 'Completed' : 'Partial'}
                      </span>
                    </td>
                    <td style={{ padding: '13px 12px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                      {timeAgo(r.submittedAt)}
                    </td>
                    <td style={{ padding: '13px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <span className="data-row-read">
                        Read <Icon name="chevR" size={13} />
                      </span>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      style={{ padding: '34px 12px', textAlign: 'center', color: 'var(--muted)', fontWeight: 600 }}
                    >
                      {all.length === 0
                        ? `No ${plural.toLowerCase()} yet — share the survey link!`
                        : `No ${plural.toLowerCase()} match “${query}”`}
                    </td>
                  </tr>
                )}
              </motion.tbody>
            </AnimatePresence>
          </table>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 16,
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--muted)' }}>
            Showing {filtered.length === 0 ? 0 : page * PAGE_SIZE + 1}–
            {Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length.toLocaleString('en-US')}
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <PagerButton disabled={page === 0} onClick={() => setPage((p) => p - 1)} icon="chevL" />
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '0 12px',
                fontSize: 12.5,
                fontWeight: 700,
                color: 'var(--body)',
              }}
            >
              {page + 1} / {pageCount}
            </span>
            <PagerButton disabled={page >= pageCount - 1} onClick={() => setPage((p) => p + 1)} icon="chevR" />
          </div>
        </div>
      </motion.div>

      <ResponseModal response={selected} onClose={() => setSelected(null)} />
    </>
  )
}

function PagerButton({
  disabled,
  onClick,
  icon,
}: {
  disabled: boolean
  onClick: () => void
  icon: 'chevL' | 'chevR'
}) {
  return (
    <motion.button
      type="button"
      disabled={disabled}
      onClick={onClick}
      whileHover={disabled ? undefined : { scale: 1.06 }}
      whileTap={disabled ? undefined : { scale: 0.94 }}
      style={{
        cursor: disabled ? 'default' : 'pointer',
        border: '1.5px solid var(--border)',
        background: '#fff',
        color: disabled ? '#cfd8e3' : 'var(--navy)',
        width: 34,
        height: 34,
        borderRadius: 10,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon name={icon} size={16} />
    </motion.button>
  )
}
