import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  createGuide,
  deleteGuide,
  listGuides,
  updateGuide,
  uploadGuideFile,
  type Guide,
  type GuideStatus,
} from '../coursesApi'
import { BouncingDots, LoadingCard, PageHeader, PrimaryButton } from '../components/ui'
import { Icon } from '../icons'

const STATUS_STYLE: Record<GuideStatus, { bg: string; color: string; label: string }> = {
  PENDING: { bg: 'var(--bg)', color: 'var(--muted)', label: 'No file yet' },
  PROCESSING: { bg: 'var(--orange-tint)', color: 'var(--orange)', label: 'Processing' },
  READY: { bg: 'rgba(31,157,85,.1)', color: 'var(--green)', label: 'Ready' },
  FAILED: { bg: 'rgba(214,69,69,.09)', color: 'var(--red)', label: 'Failed' },
}

/** What a card is currently doing, so the wait can be named rather than guessed. */
interface Busy {
  id: string
  label: string
}

export function Guides() {
  const [guides, setGuides] = useState<Guide[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [busy, setBusy] = useState<Busy | null>(null)

  const load = useCallback(async () => {
    try {
      setGuides(await listGuides())
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load guides')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  /** Reload from the Refresh button, which reports its own progress. */
  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await load()
    } finally {
      setRefreshing(false)
    }
  }, [load])

  // Poll while any guide is still rasterising. This deliberately calls `load`
  // rather than `refresh`, so background polling never lights up the button.
  const processing = guides.some((g) => g.status === 'PROCESSING')
  useEffect(() => {
    if (!processing) return
    const t = setInterval(load, 2500)
    return () => clearInterval(t)
  }, [processing, load])

  const act = async (id: string, label: string, fn: () => Promise<unknown>) => {
    setBusy({ id, label })
    setError('')
    try {
      await fn()
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed')
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <PageHeader kicker="Courses · Library" title="Study Guides">
        <PrimaryButton icon="download" onClick={refresh} busy={refreshing}>
          Refresh
        </PrimaryButton>
        <PrimaryButton icon="chart" onClick={() => setShowNew((s) => !s)}>
          {showNew ? 'Close' : 'New guide'}
        </PrimaryButton>
      </PageHeader>

      {error && (
        <div className="card" style={{ marginBottom: 16, color: 'var(--red)', fontWeight: 600, fontSize: 13.5 }}>
          {error}
        </div>
      )}

      <AnimatePresence initial={false}>
        {showNew && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <NewGuideForm
              onCreated={async () => {
                setShowNew(false)
                await load()
              }}
              onError={setError}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <LoadingCard>Loading guides</LoadingCard>
      ) : guides.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 30, marginBottom: 8 }}>📚</div>
          <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>No guides yet</div>
          <div style={{ color: 'var(--muted)', fontWeight: 600, fontSize: 13.5 }}>
            Create a guide, upload its PDF, then publish it to start selling access.
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 14 }}>
          {guides.map((g, i) => (
            <GuideCard
              key={g.id}
              guide={g}
              index={i}
              busyLabel={busy?.id === g.id ? busy.label : null}
              onAct={act}
            />
          ))}
        </div>
      )}
    </>
  )
}

function GuideCard({
  guide: g,
  index,
  busyLabel,
  onAct,
}: {
  guide: Guide
  index: number
  /** Non-null while this card has an action in flight, naming what it is. */
  busyLabel: string | null
  onAct: (id: string, label: string, fn: () => Promise<unknown>) => Promise<void>
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const style = STATUS_STYLE[g.status]
  const busy = busyLabel !== null

  return (
    <motion.div
      className="card"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.05, 0.3) }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--orange)', letterSpacing: 0.6 }}>
              {g.courseCode}
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: '3px 10px',
                borderRadius: 999,
                background: style.bg,
                color: style.color,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {style.label}
              {/* Rasterising a long guide runs for minutes, so keep the badge
                  itself alive rather than leaving a static "Processing". */}
              {g.status === 'PROCESSING' && <BouncingDots />}
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: '3px 10px',
                borderRadius: 999,
                background: g.published ? 'rgba(31,157,85,.1)' : 'var(--bg)',
                color: g.published ? 'var(--green)' : 'var(--muted)',
              }}
            >
              {g.published ? 'Published' : 'Unpublished'}
            </span>
          </div>
          <div style={{ fontSize: 16.5, fontWeight: 800, marginTop: 6 }}>{g.title}</div>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--muted)', marginTop: 3 }}>
            {g.subject ? `${g.subject} · ` : ''}
            {g.pageCount} pages · v{g.version}
            {g._count ? ` · ${g._count.codes} codes issued` : ''}
          </div>
          {g.error && (
            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--red)', marginTop: 6 }}>
              {g.error}
            </div>
          )}
          {busy && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 9,
                marginTop: 8,
                fontSize: 12.5,
                fontWeight: 700,
                color: 'var(--orange)',
              }}
            >
              <BouncingDots />
              {busyLabel}
              {busyLabel === 'Uploading' && (
                <span style={{ color: 'var(--muted)', fontWeight: 600 }}>
                  — a long PDF can take a few minutes, keep this page open
                </span>
              )}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,.pdf"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) onAct(g.id, 'Uploading', () => uploadGuideFile(g.id, file))
              e.target.value = ''
            }}
          />
          <SmallBtn
            disabled={busy}
            busy={busyLabel === 'Uploading'}
            onClick={() => fileRef.current?.click()}
            icon="download"
          >
            {g.status === 'PENDING' ? 'Upload PDF' : 'Replace PDF'}
          </SmallBtn>

          <SmallBtn
            disabled={busy || g.status !== 'READY'}
            busy={busyLabel === 'Publishing' || busyLabel === 'Unpublishing'}
            onClick={() =>
              onAct(g.id, g.published ? 'Unpublishing' : 'Publishing', () =>
                updateGuide(g.id, { published: !g.published }),
              )
            }
            icon={g.published ? 'shield' : 'check'}
          >
            {g.published ? 'Unpublish' : 'Publish'}
          </SmallBtn>

          <SmallBtn
            disabled={busy}
            busy={busyLabel === 'Deleting'}
            danger
            onClick={() => {
              if (
                confirm(
                  `Delete "${g.title}"? This removes its pages and every access code for it.`,
                )
              ) {
                onAct(g.id, 'Deleting', () => deleteGuide(g.id))
              }
            }}
          >
            Delete
          </SmallBtn>
        </div>
      </div>
    </motion.div>
  )
}

function SmallBtn({
  children,
  onClick,
  disabled,
  busy,
  danger,
  icon,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  /** Shows dots in place of the icon, for the action actually in flight. */
  busy?: boolean
  danger?: boolean
  icon?: 'download' | 'check' | 'shield'
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-busy={busy || undefined}
      style={{
        cursor: busy ? 'progress' : disabled ? 'default' : 'pointer',
        // A busy button stays legible; the others fade back out of the way.
        opacity: busy ? 1 : disabled ? 0.5 : 1,
        border: `1.5px solid ${danger ? 'rgba(214,69,69,.35)' : 'var(--border)'}`,
        background: '#fff',
        color: danger ? 'var(--red)' : 'var(--navy)',
        borderRadius: 10,
        padding: '9px 14px',
        fontSize: 12.5,
        fontWeight: 700,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        whiteSpace: 'nowrap',
      }}
    >
      {busy ? <BouncingDots /> : icon && <Icon name={icon} size={14} />}
      {children}
    </button>
  )
}

function NewGuideForm({
  onCreated,
  onError,
}: {
  onCreated: () => void
  onError: (m: string) => void
}) {
  const [form, setForm] = useState({
    title: '',
    courseCode: '',
    subject: '',
    description: '',
  })
  const [busy, setBusy] = useState(false)
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    try {
      await createGuide({
        title: form.title.trim(),
        courseCode: form.courseCode.trim(),
        subject: form.subject.trim() || undefined,
        description: form.description.trim() || undefined,
      })
      setForm({ title: '', courseCode: '', subject: '', description: '' })
      onCreated()
    } catch (e2) {
      onError(e2 instanceof Error ? e2.message : 'Could not create guide')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="card" onSubmit={submit} style={{ marginBottom: 18, display: 'grid', gap: 12 }}>
      <div style={{ fontSize: 15, fontWeight: 800 }}>New guide</div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <input
          className="text-input"
          style={{ flex: '2 1 240px' }}
          required
          placeholder="Title, e.g. Organic Chemistry Made Simple"
          value={form.title}
          onChange={set('title')}
        />
        <input
          className="text-input"
          style={{ flex: '1 1 130px' }}
          required
          placeholder="Course code, e.g. CHM201"
          value={form.courseCode}
          onChange={set('courseCode')}
        />
        <input
          className="text-input"
          style={{ flex: '1 1 130px' }}
          placeholder="Subject (optional)"
          value={form.subject}
          onChange={set('subject')}
        />
      </div>
      <textarea
        className="text-input"
        rows={2}
        placeholder="Short description shown on the portal (optional)"
        value={form.description}
        onChange={set('description')}
      />
      <div>
        <button
          type="submit"
          disabled={busy}
          aria-busy={busy || undefined}
          style={{
            cursor: busy ? 'progress' : 'pointer',
            background: 'var(--orange)',
            color: '#fff',
            border: 'none',
            borderRadius: 11,
            padding: '11px 22px',
            fontSize: 13,
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {busy && <BouncingDots />}
          {busy ? 'Creating' : 'Create guide'}
        </button>
      </div>
    </form>
  )
}
