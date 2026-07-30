import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sidebar, type Section } from './components/Sidebar'
import { BouncingDots } from './components/ui'
import { Overview } from './pages/Overview'
import { People } from './pages/People'
import { Faculties } from './pages/Faculties'
import { Guides } from './pages/Guides'
import { Codes } from './pages/Codes'
import { RecoveryPage } from './pages/RecoveryPage'
import { Settings } from './pages/Settings'
import { Icon } from './icons'
import { loadSettings, saveSettings, type AdminSettings } from './settings'
import { loadResponses, setAdminKey, getAdminKey, UnauthorizedError } from './api'
import type { SurveyResponse } from './data'

type Phase = 'loading' | 'locked' | 'ready' | 'error'

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches,
  )
  useEffect(() => {
    const mql = window.matchMedia(query)
    const handler = () => setMatches(mql.matches)
    handler()
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [query])
  return matches
}

function App() {
  const [section, setSection] = useState<Section>('Overview')
  const [collapsed, setCollapsed] = useState(false)
  const [settings, setSettings] = useState<AdminSettings>(loadSettings)
  const isMobile = useMediaQuery('(max-width: 820px)')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  const [phase, setPhase] = useState<Phase>('loading')
  const [responses, setResponses] = useState<SurveyResponse[]>([])
  const [loadError, setLoadError] = useState('')

  /**
   * Fetch the responses behind the dashboard.
   *
   * A silent load leaves the dashboard on screen and lets the caller show its
   * own progress. Without it a reload drops back to the full-page loading
   * screen, which throws away the reader's scroll position and filters — and
   * unmounts the very button that would report the reload.
   */
  const load = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) setPhase('loading')
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

  const reload = useCallback(() => load({ silent: true }), [load])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => saveSettings(settings), [settings])

  const patchSettings = (patch: Partial<AdminSettings>) => setSettings((s) => ({ ...s, ...patch }))

  if (phase !== 'ready') {
    return <Gate phase={phase} error={loadError} onUnlock={load} onRetry={load} />
  }

  const navigate = (s: Section) => {
    setSection(s)
    setMobileNavOpen(false)
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      {isMobile && (
        <header className="admin-topbar">
          <button
            type="button"
            className="admin-hamburger"
            aria-label="Open menu"
            onClick={() => setMobileNavOpen(true)}
          >
            <Icon name="menu" size={22} />
          </button>
          <div className="admin-topbar-brand">
            <img src="/tc-icon.png" alt="" style={{ width: 26, height: 26, objectFit: 'contain' }} />
            <span>
              <span style={{ color: 'var(--navy)' }}>Tutor</span>
              <span style={{ color: 'var(--orange)' }}>Connect</span>
            </span>
          </div>
          <span
            title={settings.live ? 'Accepting responses' : 'Responses paused'}
            style={{
              width: 9,
              height: 9,
              borderRadius: '50%',
              background: settings.live ? '#3ddc84' : '#d64545',
              boxShadow: settings.live ? '0 0 0 3px rgba(61,220,132,.22)' : '0 0 0 3px rgba(214,69,69,.2)',
            }}
          />
        </header>
      )}

      <div style={{ display: 'flex', minHeight: isMobile ? 'auto' : '100vh' }}>
        <Sidebar
          section={section}
          onNavigate={navigate}
          collapsed={collapsed}
          onToggle={() => setCollapsed((c) => !c)}
          live={settings.live}
          isMobile={isMobile}
          open={mobileNavOpen}
          onClose={() => setMobileNavOpen(false)}
        />

        <AnimatePresence>
          {isMobile && mobileNavOpen && (
            <motion.div
              className="admin-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setMobileNavOpen(false)}
            />
          )}
        </AnimatePresence>

        <main className="admin-main">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={section}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
            >
              {section === 'Overview' && <Overview responses={responses} onRefresh={reload} />}
              {section === 'Students' && <People role="Student" responses={responses} />}
              {section === 'Tutors' && <People role="Tutor" responses={responses} />}
              {section === 'Faculties' && <Faculties responses={responses} />}
              {section === 'Guides' && <Guides />}
              {section === 'Codes' && <Codes />}
              {section === 'Recovery' && <RecoveryPage />}
              {section === 'Settings' && <Settings settings={settings} onChange={patchSettings} />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
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
          <div
            style={{
              padding: '18px 0 6px',
              color: 'var(--muted)',
              fontWeight: 600,
              fontSize: 14,
              display: 'flex',
              alignItems: 'center',
              gap: 11,
            }}
          >
            <BouncingDots />
            Loading survey responses
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
