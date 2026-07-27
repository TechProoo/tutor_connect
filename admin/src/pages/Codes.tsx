import { useCallback, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  codeStats,
  createCode,
  deleteCode,
  disableCode,
  listCodes,
  listGuides,
  regenerateCode,
  resetCodeDevice,
  restoreCode,
  revokeCode,
  type AccessCode,
  type CodeStats,
  type CodeStatus,
  type Guide,
} from '../coursesApi'
import { PageHeader, PrimaryButton, StatCard, type Stat } from '../components/ui'
import { Icon } from '../icons'
import { timeAgo } from '../data'

const STATUS_STYLE: Record<CodeStatus, { bg: string; color: string }> = {
  UNUSED: { bg: 'var(--navy-tint)', color: 'var(--navy)' },
  REDEEMED: { bg: 'rgba(31,157,85,.1)', color: 'var(--green)' },
  DISABLED: { bg: 'var(--bg)', color: 'var(--muted)' },
  REVOKED: { bg: 'rgba(214,69,69,.09)', color: 'var(--red)' },
}

const FILTERS: (CodeStatus | 'ALL')[] = ['ALL', 'UNUSED', 'REDEEMED', 'DISABLED', 'REVOKED']

export function Codes() {
  const [codes, setCodes] = useState<AccessCode[]>([])
  const [guides, setGuides] = useState<Guide[]>([])
  const [stats, setStats] = useState<CodeStats | null>(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<CodeStatus | 'ALL'>('ALL')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)
  /** The plaintext code, shown exactly once after creation. */
  const [issued, setIssued] = useState<AccessCode | null>(null)
  /** Bumped after any mutation so the effect below refetches deterministically. */
  const [refreshKey, setRefreshKey] = useState(0)
  const refresh = useCallback(() => setRefreshKey((k) => k + 1), [])

  const load = useCallback(async () => {
    try {
      const [c, s] = await Promise.all([
        listCodes({
          q: query.trim() || undefined,
          status: filter === 'ALL' ? undefined : filter,
        }),
        codeStats(),
      ])
      setCodes(c)
      setStats(s)
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load codes')
    } finally {
      setLoading(false)
    }
  }, [query, filter])

  useEffect(() => {
    const t = setTimeout(load, query ? 300 : 0)
    return () => clearTimeout(t)
  }, [load, query, refreshKey])

  useEffect(() => {
    listGuides()
      .then(setGuides)
      .catch(() => setGuides([]))
  }, [])

  const act = async (id: string, fn: () => Promise<unknown>) => {
    setBusyId(id)
    setError('')
    try {
      const r = (await fn()) as AccessCode
      if (r?.code) setIssued(r)
      refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed')
    } finally {
      setBusyId(null)
    }
  }

  const statCards: Stat[] = stats
    ? [
        { label: 'Total codes', value: stats.total, icon: 'grid', accent: 'var(--navy)', iconBg: 'var(--navy-tint)', delta: `${stats.guides} guides`, deltaUp: true },
        { label: 'Unused', value: stats.unused, icon: 'book', accent: 'var(--orange)', iconBg: 'var(--orange-tint)', delta: 'awaiting redemption', deltaUp: true },
        { label: 'Redeemed', value: stats.redeemed, icon: 'check', accent: 'var(--navy)', iconBg: 'var(--navy-tint)', delta: 'active readers', deltaUp: true },
        { label: 'Blocked', value: stats.disabled + stats.revoked, icon: 'shield', accent: 'var(--orange)', iconBg: 'var(--orange-tint)', delta: 'disabled or revoked', deltaUp: true },
      ]
    : []

  return (
    <>
      <PageHeader kicker="Courses · Access" title="Access Codes">
        <PrimaryButton icon="download" onClick={refresh}>
          Refresh
        </PrimaryButton>
        <PrimaryButton icon="mail" onClick={() => setShowNew((s) => !s)}>
          {showNew ? 'Close' : 'Generate code'}
        </PrimaryButton>
      </PageHeader>

      {error && (
        <div className="card" style={{ marginBottom: 16, color: 'var(--red)', fontWeight: 600, fontSize: 13.5 }}>
          {error}
        </div>
      )}

      <AnimatePresence>
        {issued?.code && (
          <motion.div
            className="card"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            style={{
              marginBottom: 16,
              border: '2px dashed var(--orange)',
              background: 'var(--orange-tint)',
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--orange)', letterSpacing: 1, textTransform: 'uppercase' }}>
              Code for {issued.buyerName} — shown once
            </div>
            <div
              style={{
                fontSize: 30,
                fontWeight: 800,
                letterSpacing: 3,
                color: 'var(--navy)',
                fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
                margin: '10px 0',
              }}
            >
              {issued.code}
            </div>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--body)', marginBottom: 12 }}>
              Email delivery:{' '}
              <strong
                style={{
                  color:
                    issued.emailStatus === 'SENT'
                      ? 'var(--green)'
                      : issued.emailStatus === 'FAILED'
                        ? 'var(--red)'
                        : 'var(--orange)',
                }}
              >
                {issued.emailStatus}
              </strong>
              {issued.emailStatus !== 'SENT' && ' — copy the code and send it manually.'}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(issued.code!)}
                style={{
                  cursor: 'pointer',
                  background: 'var(--navy)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 10,
                  padding: '10px 18px',
                  fontSize: 12.5,
                  fontWeight: 700,
                }}
              >
                Copy code
              </button>
              <button
                type="button"
                onClick={() => setIssued(null)}
                style={{
                  cursor: 'pointer',
                  background: '#fff',
                  color: 'var(--navy)',
                  border: '1.5px solid var(--border)',
                  borderRadius: 10,
                  padding: '10px 18px',
                  fontSize: 12.5,
                  fontWeight: 700,
                }}
              >
                Done
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {showNew && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <NewCodeForm
              guides={guides}
              onIssued={(c) => {
                setIssued(c)
                setShowNew(false)
                refresh()
              }}
              onError={setError}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {stats && (
        <div className="stats-grid">
          {statCards.map((s, i) => (
            <StatCard key={s.label} stat={s} index={i} />
          ))}
        </div>
      )}

      <div className="card">
        <div
          style={{
            display: 'flex',
            gap: 12,
            flexWrap: 'wrap',
            alignItems: 'center',
            marginBottom: 16,
          }}
        >
          <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: 360 }}>
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
              placeholder="Search phone, email, name or full code…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <select
            className="text-input"
            style={{ cursor: 'pointer' }}
            value={filter}
            onChange={(e) => setFilter(e.target.value as CodeStatus | 'ALL')}
          >
            {FILTERS.map((f) => (
              <option key={f} value={f}>
                {f === 'ALL' ? 'All statuses' : f.charAt(0) + f.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 860 }}>
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
                <th style={{ padding: '10px 12px' }}>Buyer</th>
                <th style={{ padding: '10px 12px' }}>Guide</th>
                <th style={{ padding: '10px 12px' }}>Code</th>
                <th style={{ padding: '10px 12px' }}>Status</th>
                <th style={{ padding: '10px 12px' }}>Device</th>
                <th style={{ padding: '10px 12px' }}>Email</th>
                <th style={{ padding: '10px 12px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {codes.map((c) => (
                <tr
                  key={c.id}
                  style={{ borderTop: '1px solid var(--bg)', fontSize: 13, fontWeight: 500 }}
                >
                  <td style={{ padding: '13px 12px' }}>
                    <div style={{ fontWeight: 700 }}>{c.buyerName}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 500 }}>
                      {c.buyerPhone}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 500 }}>
                      {c.buyerEmail}
                    </div>
                  </td>
                  <td style={{ padding: '13px 12px', color: 'var(--body)' }}>
                    <div style={{ fontWeight: 700, color: 'var(--orange)', fontSize: 11.5 }}>
                      {c.guide.courseCode}
                    </div>
                    {c.guide.title}
                  </td>
                  <td
                    style={{
                      padding: '13px 12px',
                      fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
                      color: 'var(--body)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    ••••{c.codeLast4}
                  </td>
                  <td style={{ padding: '13px 12px' }}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '4px 10px',
                        borderRadius: 999,
                        ...STATUS_STYLE[c.status],
                      }}
                    >
                      {c.status}
                    </span>
                    {c.resetCount > 0 && (
                      <div style={{ fontSize: 10.5, color: 'var(--muted)', fontWeight: 600, marginTop: 4 }}>
                        {c.resetCount} reset{c.resetCount > 1 ? 's' : ''}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '13px 12px', color: 'var(--body)', fontSize: 12 }}>
                    {c.deviceLabel ?? '—'}
                    {c.redeemedAt && (
                      <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>
                        {timeAgo(new Date(c.redeemedAt))}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '13px 12px', fontSize: 12 }}>
                    <span
                      style={{
                        fontWeight: 700,
                        color:
                          c.emailStatus === 'SENT'
                            ? 'var(--green)'
                            : c.emailStatus === 'FAILED'
                              ? 'var(--red)'
                              : 'var(--muted)',
                      }}
                    >
                      {c.emailStatus}
                    </span>
                  </td>
                  <td style={{ padding: '13px 12px' }}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {c.status === 'UNUSED' && (
                        <RowBtn busy={busyId === c.id} onClick={() => act(c.id, () => disableCode(c.id))}>
                          Disable
                        </RowBtn>
                      )}
                      {c.status === 'REDEEMED' && (
                        <>
                          <RowBtn busy={busyId === c.id} onClick={() => act(c.id, () => resetCodeDevice(c.id))}>
                            Reset device
                          </RowBtn>
                          <RowBtn danger busy={busyId === c.id} onClick={() => act(c.id, () => revokeCode(c.id))}>
                            Revoke
                          </RowBtn>
                        </>
                      )}
                      {(c.status === 'DISABLED' || c.status === 'REVOKED') && (
                        <RowBtn busy={busyId === c.id} onClick={() => act(c.id, () => restoreCode(c.id))}>
                          Restore
                        </RowBtn>
                      )}
                      {c.status !== 'REDEEMED' && (
                        <RowBtn
                          busy={busyId === c.id}
                          onClick={() => {
                            if (confirm('Invalidate the old code and email a fresh one?')) {
                              act(c.id, () => regenerateCode(c.id))
                            }
                          }}
                        >
                          Resend new
                        </RowBtn>
                      )}
                      <RowBtn
                        danger
                        busy={busyId === c.id}
                        onClick={() => {
                          if (confirm(`Delete the code for ${c.buyerName}? This cannot be undone.`)) {
                            act(c.id, () => deleteCode(c.id))
                          }
                        }}
                      >
                        Delete
                      </RowBtn>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && codes.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    style={{ padding: '34px 12px', textAlign: 'center', color: 'var(--muted)', fontWeight: 600 }}
                  >
                    {query ? `No codes match “${query}”` : 'No access codes yet — generate one above.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

function RowBtn({
  children,
  onClick,
  busy,
  danger,
}: {
  children: React.ReactNode
  onClick: () => void
  busy?: boolean
  danger?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      style={{
        cursor: busy ? 'wait' : 'pointer',
        opacity: busy ? 0.5 : 1,
        border: `1.4px solid ${danger ? 'rgba(214,69,69,.3)' : 'var(--border)'}`,
        background: '#fff',
        color: danger ? 'var(--red)' : 'var(--navy)',
        borderRadius: 8,
        padding: '6px 11px',
        fontSize: 11.5,
        fontWeight: 700,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  )
}

function NewCodeForm({
  guides,
  onIssued,
  onError,
}: {
  guides: Guide[]
  onIssued: (c: AccessCode) => void
  onError: (m: string) => void
}) {
  const [form, setForm] = useState({
    guideId: '',
    buyerName: '',
    buyerPhone: '',
    buyerEmail: '',
  })
  const [busy, setBusy] = useState(false)
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    try {
      const created = await createCode({
        guideId: form.guideId,
        buyerName: form.buyerName.trim(),
        buyerPhone: form.buyerPhone.trim(),
        buyerEmail: form.buyerEmail.trim(),
      })
      setForm({ guideId: form.guideId, buyerName: '', buyerPhone: '', buyerEmail: '' })
      onIssued(created)
    } catch (e2) {
      onError(e2 instanceof Error ? e2.message : 'Could not create code')
    } finally {
      setBusy(false)
    }
  }

  const publishable = guides.filter((g) => g.status === 'READY')

  return (
    <form className="card" onSubmit={submit} style={{ marginBottom: 18, display: 'grid', gap: 12 }}>
      <div style={{ fontSize: 15, fontWeight: 800 }}>Generate &amp; email an access code</div>
      {publishable.length === 0 && (
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--red)' }}>
          Upload and process a guide first — codes must point at a ready guide.
        </div>
      )}
      <select className="text-input" required value={form.guideId} onChange={set('guideId')}>
        <option value="">Select the purchased guide…</option>
        {publishable.map((g) => (
          <option key={g.id} value={g.id}>
            {g.courseCode} — {g.title}
            {g.published ? '' : ' (unpublished)'}
          </option>
        ))}
      </select>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <input
          className="text-input"
          style={{ flex: '1 1 180px' }}
          required
          placeholder="Buyer name"
          value={form.buyerName}
          onChange={set('buyerName')}
        />
        <input
          className="text-input"
          style={{ flex: '1 1 160px' }}
          required
          type="tel"
          placeholder="Phone (shown in the watermark)"
          value={form.buyerPhone}
          onChange={set('buyerPhone')}
        />
        <input
          className="text-input"
          style={{ flex: '1 1 200px' }}
          required
          type="email"
          placeholder="Email (the code is sent here)"
          value={form.buyerEmail}
          onChange={set('buyerEmail')}
        />
      </div>
      <div>
        <button
          type="submit"
          disabled={busy || publishable.length === 0}
          style={{
            cursor: busy ? 'wait' : 'pointer',
            opacity: publishable.length === 0 ? 0.5 : 1,
            background: 'var(--orange)',
            color: '#fff',
            border: 'none',
            borderRadius: 11,
            padding: '11px 22px',
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          {busy ? 'Generating…' : 'Generate & send'}
        </button>
      </div>
    </form>
  )
}
