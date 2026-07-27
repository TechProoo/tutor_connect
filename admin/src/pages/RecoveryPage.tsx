import { useCallback, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  approveRecovery,
  deleteRecovery,
  listRecovery,
  recoveryMatches,
  rejectRecovery,
  resetCodeDevice,
  type RecoveryMatch,
  type RecoveryRequest,
  type RecoveryStatus,
} from '../coursesApi'
import { PageHeader, PrimaryButton } from '../components/ui'
import { timeAgo } from '../data'

const FILTERS: (RecoveryStatus | 'ALL')[] = ['PENDING', 'APPROVED', 'REJECTED', 'ALL']

const STATUS_STYLE: Record<RecoveryStatus, { bg: string; color: string }> = {
  PENDING: { bg: 'var(--orange-tint)', color: 'var(--orange)' },
  APPROVED: { bg: 'rgba(31,157,85,.1)', color: 'var(--green)' },
  REJECTED: { bg: 'rgba(214,69,69,.09)', color: 'var(--red)' },
}

export function RecoveryPage() {
  const [items, setItems] = useState<RecoveryRequest[]>([])
  const [filter, setFilter] = useState<RecoveryStatus | 'ALL'>('PENDING')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [matches, setMatches] = useState<Record<string, RecoveryMatch[]>>({})
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      setItems(await listRecovery(filter === 'ALL' ? undefined : filter))
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load requests')
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    load()
  }, [load])

  const open = async (id: string) => {
    if (openId === id) {
      setOpenId(null)
      return
    }
    setOpenId(id)
    if (!matches[id]) {
      try {
        const found = await recoveryMatches(id)
        setMatches((m) => ({ ...m, [id]: found }))
      } catch {
        setMatches((m) => ({ ...m, [id]: [] }))
      }
    }
  }

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    setError('')
    try {
      await fn()
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader kicker="Courses · Support" title="Access Recovery">
        <select
          className="text-input"
          style={{ cursor: 'pointer' }}
          value={filter}
          onChange={(e) => setFilter(e.target.value as RecoveryStatus | 'ALL')}
        >
          {FILTERS.map((f) => (
            <option key={f} value={f}>
              {f === 'ALL' ? 'All requests' : f.charAt(0) + f.slice(1).toLowerCase()}
            </option>
          ))}
        </select>
        <PrimaryButton icon="download" onClick={load}>
          Refresh
        </PrimaryButton>
      </PageHeader>

      {error && (
        <div className="card" style={{ marginBottom: 16, color: 'var(--red)', fontWeight: 600, fontSize: 13.5 }}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="card" style={{ color: 'var(--muted)', fontWeight: 600 }}>
          Loading requests…
        </div>
      ) : items.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 30, marginBottom: 8 }}>✅</div>
          <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>Nothing to review</div>
          <div style={{ color: 'var(--muted)', fontWeight: 600, fontSize: 13.5 }}>
            Recovery requests from students appear here.
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 14 }}>
          {items.map((r) => (
            <motion.div
              className="card"
              key={r.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28 }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 16, fontWeight: 800 }}>{r.name}</span>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '3px 10px',
                        borderRadius: 999,
                        ...STATUS_STYLE[r.status],
                      }}
                    >
                      {r.status}
                    </span>
                    <span style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 600 }}>
                      {timeAgo(new Date(r.createdAt))}
                    </span>
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--body)', fontWeight: 600, marginTop: 5 }}>
                    {r.phone} · {r.email}
                    {r.codeHint ? ` · code: ${r.codeHint}` : ''}
                  </div>
                  {r.reason && (
                    <div
                      style={{
                        fontSize: 13,
                        color: 'var(--body)',
                        fontWeight: 500,
                        marginTop: 8,
                        background: 'var(--bg)',
                        borderRadius: 10,
                        padding: '10px 12px',
                        lineHeight: 1.5,
                      }}
                    >
                      “{r.reason}”
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  <Btn onClick={() => open(r.id)}>
                    {openId === r.id ? 'Hide purchases' : 'Verify purchase'}
                  </Btn>
                  {r.status === 'PENDING' && (
                    <>
                      <Btn busy={busy} onClick={() => act(() => approveRecovery(r.id))}>
                        Approve
                      </Btn>
                      <Btn danger busy={busy} onClick={() => act(() => rejectRecovery(r.id))}>
                        Reject
                      </Btn>
                    </>
                  )}
                  <Btn
                    danger
                    busy={busy}
                    onClick={() => {
                      if (confirm('Delete this recovery request?')) {
                        act(() => deleteRecovery(r.id))
                      }
                    }}
                  >
                    Delete
                  </Btn>
                </div>
              </div>

              <AnimatePresence initial={false}>
                {openId === r.id && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    style={{ overflow: 'hidden' }}
                  >
                    <div style={{ borderTop: '1px solid var(--bg)', marginTop: 14, paddingTop: 14 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 }}>
                        Matching purchases
                      </div>
                      {!matches[r.id] ? (
                        <div style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}>Looking up…</div>
                      ) : matches[r.id].length === 0 ? (
                        <div style={{ fontSize: 13, color: 'var(--red)', fontWeight: 600 }}>
                          No purchase found for this phone or email — verify manually before approving.
                        </div>
                      ) : (
                        <div style={{ display: 'grid', gap: 10 }}>
                          {matches[r.id].map((m) => (
                            <div
                              key={m.id}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                gap: 12,
                                flexWrap: 'wrap',
                                alignItems: 'center',
                                background: 'var(--bg)',
                                borderRadius: 12,
                                padding: '12px 14px',
                              }}
                            >
                              <div>
                                <div style={{ fontSize: 13.5, fontWeight: 700 }}>
                                  {m.guide.courseCode} — {m.guide.title}
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--body)', fontWeight: 600, marginTop: 3 }}>
                                  ••••{m.codeLast4} · {m.status}
                                  {m.deviceLabel ? ` · ${m.deviceLabel}` : ''}
                                  {m.resetCount > 0 ? ` · ${m.resetCount} reset(s)` : ''}
                                </div>
                                <div style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 500, marginTop: 2 }}>
                                  {m.buyerName} · {m.buyerPhone} · {m.buyerEmail}
                                </div>
                              </div>
                              {m.status === 'REDEEMED' && (
                                <Btn
                                  busy={busy}
                                  onClick={() => {
                                    if (
                                      confirm(
                                        `Release the device lock for ${m.buyerName}? They can then redeem code ••••${m.codeLast4} once more on a new browser.`,
                                      )
                                    ) {
                                      act(async () => {
                                        await resetCodeDevice(m.id)
                                        await approveRecovery(r.id, 'Device reset granted.')
                                        setMatches((mm) => {
                                          const next = { ...mm }
                                          delete next[r.id]
                                          return next
                                        })
                                      })
                                    }
                                  }}
                                >
                                  Reset device &amp; approve
                                </Btn>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      )}
    </>
  )
}

function Btn({
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
        opacity: busy ? 0.55 : 1,
        border: `1.5px solid ${danger ? 'rgba(214,69,69,.32)' : 'var(--border)'}`,
        background: '#fff',
        color: danger ? 'var(--red)' : 'var(--navy)',
        borderRadius: 10,
        padding: '9px 14px',
        fontSize: 12.5,
        fontWeight: 700,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  )
}
