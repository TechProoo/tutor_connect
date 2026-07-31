import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent,
} from 'react'
import { createPortal } from 'react-dom'
import type { CatalogItem } from './api'
import { ArrowIcon, PagesIcon, WhatsappIcon } from './icons'

const SALES_WHATSAPP =
  import.meta.env.VITE_SALES_WHATSAPP ??
  import.meta.env.VITE_SUPPORT_WHATSAPP ??
  '2347049460213'

const NUMBER = SALES_WHATSAPP.replace(/\D/g, '')
const GUIDE_PRICE = '₦1,500'
const BANK_NAME = 'Kuda Bank'
const ACCOUNT_NAME = 'Jamiu Oyewo'
const ACCOUNT_NUMBER = '2060848178'
const BUSINESS_ADDRESS =
  '36 Lekki-Epe Expressway, Wing A, 2nd Floor, Lekki Swiss Mall, Lekki/Epe Road, Lagos.'

type CopyStatus = 'idle' | 'copied' | 'failed'

function shouldOpenPayment() {
  return new URLSearchParams(window.location.search).get('buy') === '1'
}

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value)
    return
  } catch {
    const input = document.createElement('textarea')
    input.value = value
    input.setAttribute('readonly', '')
    input.style.position = 'fixed'
    input.style.opacity = '0'
    document.body.appendChild(input)
    input.select()
    const copied = document.execCommand('copy')
    input.remove()
    if (!copied) throw new Error('Copy failed')
  }
}

export function GuideCta({ guides }: { guides: CatalogItem[] }) {
  const [showPayment, setShowPayment] = useState(shouldOpenPayment)
  const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle')
  const [buyerName, setBuyerName] = useState('')
  const [buyerEmail, setBuyerEmail] = useState('')
  const [guideName, setGuideName] = useState('')
  const dialogRef = useRef<HTMLElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)

  const closePayment = useCallback(() => {
    setShowPayment(false)
    const url = new URL(window.location.href)
    if (url.searchParams.has('buy')) {
      url.searchParams.delete('buy')
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
    }
  }, [])

  useEffect(() => {
    if (!showPayment) return

    returnFocusRef.current = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closePayment()
        return
      }

      if (event.key !== 'Tab' || !dialogRef.current) return
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled])',
        ),
      )
      if (focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      returnFocusRef.current?.focus()
    }
  }, [closePayment, showPayment])

  const copyAccountNumber = async () => {
    try {
      await copyText(ACCOUNT_NUMBER)
      setCopyStatus('copied')
      window.setTimeout(() => setCopyStatus('idle'), 1800)
    } catch {
      setCopyStatus('failed')
    }
  }

  const handleBackdropClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) closePayment()
  }

  const sendReceipt = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const message = [
      'Hello Tutor Connect, I have paid ₦1,500 for a study guide.',
      '',
      `Guide: ${guideName.trim()}`,
      `Name: ${buyerName.trim()}`,
      `Email for my access code: ${buyerEmail.trim()}`,
      '',
      'I am sending my payment receipt for verification.',
    ].join('\n')

    window.open(
      `https://wa.me/${NUMBER}?text=${encodeURIComponent(message)}`,
      '_blank',
      'noopener,noreferrer',
    )
  }

  const paymentDialog = showPayment
    ? createPortal(
        <div className="payment-backdrop" onMouseDown={handleBackdropClick}>
          <section
            ref={dialogRef}
            className="payment-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="payment-title"
            aria-describedby="payment-description"
          >
            <div className="payment-accent" />
            <header className="payment-header">
              <div className="payment-brand">
                <img src="/tc-icon.png" alt="" />
                <div>
                  <span>Tutor <strong>Connect</strong></span>
                  <small>Revision guides</small>
                </div>
              </div>
              <button
                ref={closeRef}
                className="payment-close"
                type="button"
                onClick={closePayment}
                aria-label="Close payment details"
              >
                <span aria-hidden="true">×</span>
              </button>
            </header>

            <div className="payment-body">
              <div className="payment-intro">
                <div>
                  <span className="payment-kicker">Complete your payment</span>
                  <h2 id="payment-title">Get your study guide.</h2>
                  <p id="payment-description">
                    Choose one guide, make a bank transfer, then send your receipt
                    for verification.
                  </p>
                </div>
                <div className="payment-price">
                  <strong>{GUIDE_PRICE}</strong>
                  <span>per guide</span>
                </div>
              </div>

              <section className="bank-card" aria-labelledby="bank-details-title">
                <div className="bank-card-head">
                  <div>
                    <span className="bank-label">Bank transfer</span>
                    <h3 id="bank-details-title">Payment details</h3>
                  </div>
                  <span className="bank-name">{BANK_NAME}</span>
                </div>

                <div className="bank-account-name">
                  <span>Account name</span>
                  <strong>{ACCOUNT_NAME}</strong>
                </div>

                <div className="bank-number-row">
                  <div>
                    <span>Account number</span>
                    <strong>{ACCOUNT_NUMBER}</strong>
                  </div>
                  <button type="button" onClick={copyAccountNumber}>
                    {copyStatus === 'copied' ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <div className="copy-status" role="status" aria-live="polite">
                  {copyStatus === 'copied' && 'Account number copied.'}
                  {copyStatus === 'failed' &&
                    'Copy did not work. Press and hold the number to copy it.'}
                </div>
              </section>

              <div className="payment-note">
                <span aria-hidden="true">i</span>
                <p>
                  Pay <strong>{GUIDE_PRICE}</strong> for each guide. Every guide is
                  verified separately and receives its own access code.
                </p>
              </div>

              <form className="receipt-form" onSubmit={sendReceipt}>
                <div className="receipt-form-heading">
                  <span>Receipt details</span>
                  <p>We will use these details to verify your payment and email your code.</p>
                </div>

                <div className="payment-fields">
                  <label>
                    <span>Full name</span>
                    <input
                      type="text"
                      value={buyerName}
                      onChange={(event) => setBuyerName(event.target.value)}
                      placeholder="Your full name"
                      autoComplete="name"
                      required
                    />
                  </label>

                  <label>
                    <span>Email for access code</span>
                    <input
                      type="email"
                      value={buyerEmail}
                      onChange={(event) => setBuyerEmail(event.target.value)}
                      placeholder="you@example.com"
                      autoComplete="email"
                      inputMode="email"
                      required
                    />
                  </label>

                  <label className="payment-guide-field">
                    <span>Guide purchased</span>
                    <input
                      type="text"
                      list="payment-guide-options"
                      value={guideName}
                      onChange={(event) => setGuideName(event.target.value)}
                      placeholder="e.g. CHM 201 Revision Guide"
                      required
                    />
                    <datalist id="payment-guide-options">
                      {guides.map((guide) => (
                        <option
                          key={guide.id}
                          value={`${guide.courseCode} | ${guide.title}`}
                        />
                      ))}
                    </datalist>
                  </label>
                </div>

                <ol className="payment-steps">
                  <li>
                    <span>1</span>
                    <p><strong>Make the transfer</strong> using the account above.</p>
                  </li>
                  <li>
                    <span>2</span>
                    <p><strong>Open WhatsApp</strong> and attach your payment receipt.</p>
                  </li>
                  <li>
                    <span>3</span>
                    <p><strong>Receive your code</strong> by email once payment is verified.</p>
                  </li>
                </ol>

                <button className="receipt-button" type="submit">
                  <span className="receipt-whatsapp">
                    <WhatsappIcon size={18} />
                  </span>
                  <span>
                    <strong>Send receipt on WhatsApp</strong>
                    <small>Attach your receipt before sending</small>
                  </span>
                  <ArrowIcon size={17} />
                </button>
              </form>

              <address className="payment-address">
                <span>Tutor Connect</span>
                {BUSINESS_ADDRESS}
              </address>
            </div>
          </section>
        </div>,
        document.body,
      )
    : null

  return (
    <>
      <aside className="cta">
        <div className="cta-head">
          <span className="cta-icon" aria-hidden="true">
            <PagesIcon size={21} />
          </span>
          <div>
            <span className="cta-kicker">{GUIDE_PRICE} per guide</span>
            <h2 className="cta-title">Get Your Revision Guide</h2>
            <p className="cta-sub">
              Pay securely by bank transfer, send your receipt, and receive your
              personal access code by email.
            </p>
          </div>
        </div>

        <button
          className="cta-btn"
          type="button"
          onClick={() => setShowPayment(true)}
        >
          <span className="cta-icon-mini" aria-hidden="true">
            <PagesIcon size={17} />
          </span>
          <span className="cta-btn-copy">
            <span>Complete your payment</span>
            <strong>View account and receipt details</strong>
          </span>
          <ArrowIcon size={17} className="cta-arrow" />
        </button>
      </aside>
      {paymentDialog}
    </>
  )
}
