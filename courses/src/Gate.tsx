import { useEffect, useRef, useState } from 'react'
import {
  getCatalog,
  redeem,
  setToken,
  type CatalogItem,
  type Session,
} from './api'
import { Recovery } from './Recovery'
import { Sparkle, LockIcon, ShieldIcon, PhoneIcon, ArrowIcon } from './icons'

/** Codes are `TC-XXXX-XXXX`; format as the student types. */
function formatCode(raw: string): string {
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10)
  const parts = [clean.slice(0, 2), clean.slice(2, 6), clean.slice(6, 10)]
  return parts.filter(Boolean).join('-')
}

export function Gate({
  notice,
  onUnlocked,
}: {
  notice: string
  onUnlocked: (s: Session) => void
}) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [shake, setShake] = useState(false)
  const [showRecovery, setShowRecovery] = useState(false)
  const [catalog, setCatalog] = useState<CatalogItem[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    getCatalog()
      .then(setCatalog)
      .catch(() => setCatalog([]))
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    const trimmed = code.trim()
    if (trimmed.replace(/[^A-Z0-9]/gi, '').length < 6) {
      setError('Please enter the full access code from your email.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const session = await redeem(trimmed)
      if (session.deviceToken) setToken(session.deviceToken)
      onUnlocked(session)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
      setShake(true)
      setTimeout(() => setShake(false), 450)
      inputRef.current?.focus()
    } finally {
      setBusy(false)
    }
  }

  if (showRecovery) {
    return <Recovery onBack={() => setShowRecovery(false)} />
  }

  return (
    <div className="aurora">
      <Sparkle className="spark spark-a" />
      <Sparkle className="spark spark-b" />

      <div className="shell">
        <header className="topbar">
          <a className="brand" href="/">
            <img src="/tc-icon.png" alt="" />
            <span className="brand-name">
              Tutor<span className="o">Connect</span>
            </span>
          </a>
          <button className="top-help" onClick={() => setShowRecovery(true)}>
            Need help?
          </button>
        </header>

        <main className="gate">
          <section className="gate-copy">
            <span className="kicker">
              <LockIcon size={13} /> One-time access
            </span>
            <h1 className="headline">
              Your study guide is{' '}
              <span className="pill">one code</span> away.
            </h1>
            <p className="lede">
              Enter the access code we emailed you after your purchase. Your guide
              unlocks instantly and stays unlocked on this device — no account, no
              password to remember.
            </p>
            <div className="trust-row">
              <span className="trust">
                <ShieldIcon size={14} /> Secure &amp; personal
              </span>
              <span className="trust">
                <PhoneIcon size={14} /> Built for your phone
              </span>
              <span className="trust">
                <LockIcon size={14} /> Works once, on one device
              </span>
            </div>
          </section>

          <section className="card">
            <h2 className="card-title">Unlock your guide</h2>
            <p className="card-sub">
              Check your email for a code that looks like{' '}
              <strong style={{ color: 'var(--navy)' }}>TC-4K7M-92QD</strong>.
            </p>

            <form onSubmit={submit}>
              <label className="field-label" htmlFor="code">
                Access code
              </label>
              <input
                id="code"
                ref={inputRef}
                className={`code-input${shake ? ' shake' : ''}`}
                value={code}
                onChange={(e) => setCode(formatCode(e.target.value))}
                placeholder="TC-XXXX-XXXX"
                autoComplete="one-time-code"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                inputMode="text"
                disabled={busy}
                autoFocus
              />

              {notice && !error && <div className="notice">{notice}</div>}
              {error && <div className="error">{error}</div>}

              <button className="btn" type="submit" disabled={busy}>
                {busy ? 'Unlocking…' : 'Unlock my guide'}
                {!busy && <ArrowIcon size={16} />}
              </button>
            </form>

            <button className="help-link" onClick={() => setShowRecovery(true)}>
              Lost access or changed your browser?
            </button>
          </section>
        </main>

        {catalog.length > 0 && (
          <section className="catalog">
            <div className="catalog-head">Available guides</div>
            <div className="catalog-grid">
              {catalog.map((g) => (
                <article className="catalog-item" key={g.id}>
                  <div className="catalog-code">{g.courseCode}</div>
                  <div className="catalog-title">{g.title}</div>
                  <div className="catalog-meta">
                    {g.subject ? `${g.subject} · ` : ''}
                    {g.pageCount} pages
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        <p className="footer-note">
          Tutor Connect · Learn Better. Achieve More.
          <br />
          Guides are for online viewing only and are watermarked with the buyer's
          details.
        </p>
      </div>
    </div>
  )
}
