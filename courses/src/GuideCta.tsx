import { WhatsappIcon } from './icons'

/**
 * Sales contact for students who land here without a code. Defaults to the
 * Tutor Connect line; override per-deploy with VITE_SALES_WHATSAPP.
 * Digits only, international format.
 */
const SALES_WHATSAPP =
  import.meta.env.VITE_SALES_WHATSAPP ??
  import.meta.env.VITE_SUPPORT_WHATSAPP ??
  '2347049460213'

const NUMBER = SALES_WHATSAPP.replace(/\D/g, '')

/** +2347049460213 -> +234 704 946 0213 */
function prettyNumber(digits: string) {
  const m = digits.match(/^234(\d{3})(\d{3})(\d{4})$/)
  return m ? `+234 ${m[1]} ${m[2]} ${m[3]}` : `+${digits}`
}

const MESSAGE = encodeURIComponent(
  "Hi Tutor Connect! I'd like to get the complete Revision Guide.",
)

/**
 * Shown above the code box: plenty of visitors arrive having heard about a
 * guide but without having bought one yet, and this is their way in.
 */
export function GuideCta() {
  return (
    <aside className="cta">
      <div className="cta-head">
        <span className="cta-emoji" aria-hidden="true">
          📘
        </span>
        <div>
          <h2 className="cta-title">Get Your Revision Guide</h2>
          <p className="cta-sub">
            Need the complete Physics or Chemistry Revision Guide? Message us on
            WhatsApp and we'll send your access code.
          </p>
        </div>
      </div>

      <a
        className="cta-btn"
        href={`https://wa.me/${NUMBER}?text=${MESSAGE}`}
        target="_blank"
        rel="noreferrer"
      >
        <WhatsappIcon size={19} />
        <span>
          WhatsApp <strong>{prettyNumber(NUMBER)}</strong>
        </span>
      </a>
    </aside>
  )
}
