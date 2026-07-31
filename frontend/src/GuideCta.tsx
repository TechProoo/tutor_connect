const COURSES_URL = (
  import.meta.env.VITE_COURSES_URL ?? 'https://courses.tutorconnect.ng'
).replace(/\/+$/, '')

const PAYMENT_URL = `${COURSES_URL}/?buy=1`

function GuideIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5.5 4.5A2.5 2.5 0 0 1 8 2h10.5v17H8a2.5 2.5 0 0 0-2.5 2.5v-17Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M5.5 21.5A2.5 2.5 0 0 1 8 19h10.5v3H8a2.5 2.5 0 0 1-2.5-.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M9 7h6M9 10h5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  )
}

function ArrowIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M7 17 17 7M8 7h9v9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Sends guide buyers into the complete payment flow on the course portal. */
export function GuideCta() {
  return (
    <section className="tc-cta">
      <div className="tc-cta-main">
        <span className="tc-cta-icon">
          <GuideIcon />
        </span>
        <div className="tc-cta-text">
          <span className="tc-cta-kicker">Revision guides</span>
          <h2 className="tc-cta-title">Get Your Revision Guide</h2>
          <p className="tc-cta-sub">
            Each guide costs ₦1,500. View the payment details, send your receipt,
            and receive your personal access code by email.
          </p>
        </div>
      </div>

      <a className="tc-cta-btn" href={PAYMENT_URL}>
        <span className="tc-cta-btn-text">
          <small>₦1,500 per guide</small>
          <strong>Complete your payment</strong>
        </span>
        <ArrowIcon />
      </a>
    </section>
  )
}
