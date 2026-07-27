import { useState } from 'react'
import { submitRecovery } from './api'
import { ChevronLeft, ShieldIcon } from './icons'

const SUPPORT_EMAIL =
  import.meta.env.VITE_SUPPORT_EMAIL ?? 'support@tutorconnect.ng'
const SUPPORT_WHATSAPP = import.meta.env.VITE_SUPPORT_WHATSAPP ?? ''

/**
 * "I lost access" form. Device resets are deliberately manual — an automatic
 * reset would let one code be shared across many phones.
 */
export function Recovery({ onBack }: { onBack: () => void }) {
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    codeHint: '',
    reason: '',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await submitRecovery({
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        codeHint: form.codeHint.trim() || undefined,
        reason: form.reason.trim() || undefined,
      })
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="aurora">
      <div className="shell">
        <header className="topbar">
          <a className="brand" href="/">
            <img src="/tc-icon.png" alt="" />
            <span className="brand-name">
              Tutor<span className="o">Connect</span>
            </span>
          </a>
          <button className="top-help" onClick={onBack}>
            <ChevronLeft size={13} /> Back to code
          </button>
        </header>

        <div className="center" style={{ minHeight: 'auto', marginTop: 34 }}>
          <div className="card">
            {done ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 38, marginBottom: 8 }}>📩</div>
                <h2 className="card-title">Request received</h2>
                <p className="card-sub" style={{ marginBottom: 20 }}>
                  We'll verify your purchase and get back to you by email, usually
                  within 24 hours. If it's approved we'll send a fresh code for
                  your new device.
                </p>
                <button className="btn btn-ghost" onClick={onBack}>
                  Back to code entry
                </button>
              </div>
            ) : (
              <>
                <h2 className="card-title">Lost access to your guide?</h2>
                <p className="card-sub">
                  If you cleared your browser, changed phone, or your code was used
                  on another device, tell us below. We'll verify your purchase and
                  restore your access.
                </p>

                <form onSubmit={submit} className="form-grid">
                  <div>
                    <label className="field-label" htmlFor="rname">
                      Full name
                    </label>
                    <input
                      id="rname"
                      className="text-input"
                      required
                      value={form.name}
                      onChange={set('name')}
                      placeholder="e.g. Amaka Obi"
                    />
                  </div>

                  <div>
                    <label className="field-label" htmlFor="rphone">
                      Phone number used at purchase
                    </label>
                    <input
                      id="rphone"
                      className="text-input"
                      required
                      type="tel"
                      inputMode="tel"
                      value={form.phone}
                      onChange={set('phone')}
                      placeholder="e.g. 08012345678"
                    />
                  </div>

                  <div>
                    <label className="field-label" htmlFor="remail">
                      Email used at purchase
                    </label>
                    <input
                      id="remail"
                      className="text-input"
                      required
                      type="email"
                      value={form.email}
                      onChange={set('email')}
                      placeholder="you@example.com"
                    />
                  </div>

                  <div>
                    <label className="field-label" htmlFor="rcode">
                      Your access code (if you still have it)
                    </label>
                    <input
                      id="rcode"
                      className="text-input"
                      value={form.codeHint}
                      onChange={set('codeHint')}
                      placeholder="TC-XXXX-XXXX"
                    />
                  </div>

                  <div>
                    <label className="field-label" htmlFor="rreason">
                      What happened?
                    </label>
                    <textarea
                      id="rreason"
                      className="text-input"
                      rows={3}
                      value={form.reason}
                      onChange={set('reason')}
                      placeholder="e.g. I changed my phone and can't open the guide anymore."
                    />
                  </div>

                  {error && <div className="error">{error}</div>}

                  <button className="btn" type="submit" disabled={busy}>
                    {busy ? 'Sending…' : 'Send recovery request'}
                  </button>
                </form>

                <div className="support-row">
                  {SUPPORT_WHATSAPP && (
                    <a
                      className="support-btn"
                      href={`https://wa.me/${SUPPORT_WHATSAPP.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Chat on WhatsApp
                    </a>
                  )}
                  <a className="support-btn" href={`mailto:${SUPPORT_EMAIL}`}>
                    Email support
                  </a>
                </div>

                <p
                  className="card-sub"
                  style={{ marginTop: 16, marginBottom: 0, fontSize: 12.5 }}
                >
                  <ShieldIcon size={12} /> Device resets are approved manually so
                  your purchase can't be shared.
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
