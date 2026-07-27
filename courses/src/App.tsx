import { useCallback, useEffect, useState } from 'react'
import { getSession, clearToken, getToken, type Session } from './api'
import { Gate } from './Gate'
import { Reader } from './Reader'

type Phase = 'checking' | 'locked' | 'unlocked'

export default function App() {
  const [phase, setPhase] = useState<Phase>(getToken() ? 'checking' : 'locked')
  const [session, setSession] = useState<Session | null>(null)
  const [notice, setNotice] = useState('')

  // A returning browser already holds a device token — restore its access.
  useEffect(() => {
    if (!getToken()) {
      setPhase('locked')
      return
    }
    let cancelled = false
    getSession()
      .then((s) => {
        if (cancelled) return
        setSession(s)
        setPhase('unlocked')
      })
      .catch((err) => {
        if (cancelled) return
        // 403 means the token is dead (revoked or device reset) — start over.
        if (err?.status === 403) {
          clearToken()
          setNotice(
            'Your access on this browser is no longer active. Enter your code again, or request recovery below.',
          )
        }
        setPhase('locked')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const onUnlocked = useCallback((s: Session) => {
    setSession(s)
    setNotice('')
    setPhase('unlocked')
  }, [])

  const onLock = useCallback(() => {
    clearToken()
    setSession(null)
    setPhase('locked')
    setNotice('You have been signed out on this device.')
  }, [])

  if (phase === 'checking') {
    return (
      <div className="aurora">
        <div className="center">
          <div className="card" style={{ textAlign: 'center' }}>
            <div className="spinner" />
            <div className="card-title" style={{ fontSize: 16 }}>
              Checking your access…
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (phase === 'unlocked' && session) {
    return <Reader session={session} onLock={onLock} />
  }

  return <Gate notice={notice} onUnlocked={onUnlocked} />
}
