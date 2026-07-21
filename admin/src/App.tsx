import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sidebar, type Section } from './components/Sidebar'
import { Overview } from './pages/Overview'
import { People } from './pages/People'
import { Faculties } from './pages/Faculties'
import { Settings } from './pages/Settings'
import { loadSettings, saveSettings, type AdminSettings } from './settings'
import { loadResponses, setAdminKey, getAdminKey, UnauthorizedError } from './api'
import type { SurveyResponse } from './data'

type Phase = 'loading' | 'locked' | 'ready' | 'error'

function App() {
  const [section, setSection] = useState<Section>('Overview')
  const [collapsed, setCollapsed] = useState(false)
  const [settings, setSettings] = useState<AdminSettings>(loadSettings)

  const [phase, setPhase] = useState<Phase>('loading')
  const [responses, setResponses] = useState<SurveyResponse[]>([])
  const [loadError, setLoadError] = useState('')

  const load = useCallback(async () => {
    setPhase('loading')
    try {
      setResponses(await loadResponses())
      setPhase('ready')
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        setPhase('locked')
      } else {
        setLoadError(err instanceof Error ? err.message : 'Failed to load data')
        setPhase('error')
      }
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => saveSettings(settings), [settings])

  const patchSettings = (patch: Partial<AdminSettings>) => setSettings((s) => ({ ...s, ...patch }))

  if (phase !== 'ready') {
    return <Gate phase={phase} error={loadError} onUnlock={load} onRetry={load} />
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar
        section={section}
        onNavigate={setSection}
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
        live={settings.live}
      />

      <main style={{ flex: 1, minWidth: 0, padding: '26px 30px 44px' }}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={section}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
            {section === 'Overview' && <Overview responses={responses} onRefresh={load} />}
            {section === 'Students' && <People role="Student" responses={responses} />}
            {section === 'Tutors' && <People role="Tutor" responses={responses} />}
            {section === 'Faculties' && <Faculties responses={responses} />}
            {section === 'Settings' && <Settings settings={settings} onChange={patchSettings} />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Loading / unlock / error screens (shown before the dashboard mounts)
// ---------------------------------------------------------------------------

function Gate({
  phase,
  error,
  onUnlock,
  onRetry,
}: {
  phase: Phase
  error: string
  onUnlock: () => void
  onRetry: () => void
}) {
  const [key, setKey] = useState('')
  const hadKey = getAdminKey() !== ''

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!key.trim()) return
    setAdminKey(key.trim())
    onUnlock()
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--navy)',
        padding: 20,
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        style={{
          background: '#fff',
          borderRadius: 20,
          padding: '34px 32px',
          width: 380,
          maxWidth: '100%',
          boxShadow: '0 24px 60px rgba(0,0,0,.35)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 20,
            fontWeight: 800,
            letterSpacing: '-0.4px',
            marginBottom: 6,
          }}
        >
          <img src="/tc-icon.png" alt="" style={{ width: 30, height: 30, objectFit: 'contain' }} />
          <span>
            <span style={{ color: 'var(--navy)' }}>Tutor</span>
            <span style={{ color: 'var(--orange)' }}>Connect</span>
          </span>
        </div>

        {phase === 'loading' && (
          <div style={{ padding: '18px 0 6px', color: 'var(--muted)', fontWeight: 600, fontSize: 14 }}>
            <motion.span
              animate={{ opacity: [0.45, 1, 0.45] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
            >
              Loading survey responses…
            </motion.span>
          </div>
        )}

        {phase === 'locked' && (
          <form onSubmit={submit}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--body)', margin: '10px 0 16px', lineHeight: 1.5 }}>
              {hadKey
                ? 'That admin key was rejected. Enter the current key to continue.'
                : 'Enter the admin key to open the dashboard.'}
            </div>
            <input
              className="text-input"
              type="password"
              autoFocus
              placeholder="Admin key"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              style={{ width: '100%', marginBottom: 12 }}
            />
            <button
              type="submit"
              style={{
                cursor: 'pointer',
                width: '100%',
                background: 'var(--orange)',
                color: '#fff',
                border: 'none',
                borderRadius: 11,
                padding: '12px 18px',
                fontSize: 14,
                fontWeight: 700,
              }}
            >
              Unlock dashboard
            </button>
          </form>
        )}

        {phase === 'error' && (
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--red)', margin: '10px 0 16px', lineHeight: 1.5 }}>
              {error}
            </div>
            <button
              type="button"
              onClick={onRetry}
              style={{
                cursor: 'pointer',
                width: '100%',
                background: 'var(--navy)',
                color: '#fff',
                border: 'none',
                borderRadius: 11,
                padding: '12px 18px',
                fontSize: 14,
                fontWeight: 700,
              }}
            >
              Try again
            </button>
          </div>
        )}
      </motion.div>
    </div>
  )
}

export default App
