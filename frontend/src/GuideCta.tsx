/**
 * Sales contact for revision-guide buyers. Digits only, international format;
 * override per-deploy with VITE_SALES_WHATSAPP.
 */
const SALES_WHATSAPP = import.meta.env.VITE_SALES_WHATSAPP ?? '2347049460213'
const NUMBER = SALES_WHATSAPP.replace(/\D/g, '')

/** 2347049460213 -> +234 704 946 0213 */
function prettyNumber(digits: string) {
  const m = digits.match(/^234(\d{3})(\d{3})(\d{4})$/)
  return m ? `+234 ${m[1]} ${m[2]} ${m[3]}` : `+${digits}`
}

const MESSAGE = encodeURIComponent(
  "Hi Tutor Connect! I'd like to get the complete Revision Guide.",
)

function WhatsappIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.65.08-.3-.15-1.25-.46-2.39-1.47-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.06 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.42-.07-.13-.27-.2-.57-.35z" />
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.87 9.87 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2zm0 18.15h-.01a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.19 8.19 0 0 1-1.26-4.38c0-4.54 3.7-8.23 8.24-8.23 2.2 0 4.27.86 5.83 2.41a8.19 8.19 0 0 1 2.41 5.83c0 4.54-3.7 8.23-8.24 8.23z" />
    </svg>
  )
}

/** Sells the revision guides to visitors who came for the survey. */
export function GuideCta() {
  return (
    <section className="tc-cta">
      <div className="tc-cta-text">
        <span className="tc-cta-kicker">📘 Revision guides</span>
        <h2 className="tc-cta-title">Get Your Revision Guide</h2>
        <p className="tc-cta-sub">
          Need the complete Physics or Chemistry Revision Guide? Message us on
          WhatsApp and we'll send your access code straight away.
        </p>
      </div>

      <a
        className="tc-cta-btn"
        href={`https://wa.me/${NUMBER}?text=${MESSAGE}`}
        target="_blank"
        rel="noreferrer"
      >
        <WhatsappIcon size={20} />
        <span className="tc-cta-btn-text">
          <small>WhatsApp us</small>
          <strong>{prettyNumber(NUMBER)}</strong>
        </span>
      </a>
    </section>
  )
}
