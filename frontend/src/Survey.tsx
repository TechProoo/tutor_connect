import { useState } from 'react'
import type { FormEvent } from 'react'
import tcIcon from './assets/tc-icon.png'
import './Survey.css'

type ChipGroupProps = {
  label: string
  options: string[]
  value: string
  onSelect: (v: string) => void
}

function ChipGroup({ label, options, value, onSelect }: ChipGroupProps) {
  return (
    <div className="sv-group">
      <span className="sv-label">{label}</span>
      <div className="sv-chips">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            className={`sv-chip${value === o ? ' sv-chip-active' : ''}`}
            onClick={() => onSelect(o)}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  )
}

function Section({
  step,
  title,
  children,
}: {
  step: string
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="sv-section">
      <div className="sv-section-head">
        <span className="sv-step">{step}</span>
        <span className="sv-section-title">{title}</span>
      </div>
      <div className="sv-section-body">{children}</div>
    </section>
  )
}

function Progress({ value }: { value: number }) {
  return (
    <div className="sv-progress">
      <div className="sv-progress-track">
        <div className="sv-progress-fill" style={{ width: `${value}%` }} />
      </div>
      <span className="sv-progress-label">{value}% done</span>
    </div>
  )
}

type FieldProps = {
  label: string
  optional?: boolean
  children: React.ReactNode
}

function Field({ label, optional, children }: FieldProps) {
  return (
    <label className="sv-field">
      <span className="sv-label">
        {label} {optional && <span className="sv-optional">(optional)</span>}
      </span>
      {children}
    </label>
  )
}

const HEARD_OPTIONS = ['WhatsApp', 'Friend', 'Notice Board', 'Social Media', 'Other']

function HeardSelect({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  return (
    <Field label="How did you hear about TutorConnect?">
      <select
        className="sv-input sv-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Select one</option>
        {HEARD_OPTIONS.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </Field>
  )
}

function ThankYou({ onReset }: { onReset: () => void }) {
  return (
    <div className="sv-thanks">
      <div className="sv-thanks-emoji">🎓</div>
      <div className="sv-thanks-title">
        Thank you! We'll be in touch via WhatsApp within 48 hours.
      </div>
      <button type="button" className="sv-thanks-btn" onClick={onReset}>
        Submit another response
      </button>
    </div>
  )
}

const blankStudent = {
  name: '',
  campus: '',
  dept: '',
  subjects: '',
  frequency: '',
  format: '',
  pay: '',
  heard: '',
  comments: '',
}

const blankTutor = {
  name: '',
  campus: '',
  dept: '',
  subjects: '',
  cgpa: '',
  hours: '',
  format: '',
  earn: '',
  whatsapp: '',
  heard: '',
  other: '',
}

function Survey() {
  const [tab, setTab] = useState<'student' | 'tutor'>('student')
  const [student, setStudent] = useState(blankStudent)
  const [tutor, setTutor] = useState(blankTutor)
  const [studentSubmitted, setStudentSubmitted] = useState(false)
  const [tutorSubmitted, setTutorSubmitted] = useState(false)

  const setS = (field: keyof typeof blankStudent) => (v: string) =>
    setStudent((s) => ({ ...s, [field]: v }))
  const setT = (field: keyof typeof blankTutor) => (v: string) =>
    setTutor((t) => ({ ...t, [field]: v }))

  const pct = (fields: string[]) =>
    Math.round((fields.filter((f) => f.trim() !== '').length / fields.length) * 100)

  const studentPct = pct([
    student.name,
    student.campus,
    student.dept,
    student.subjects,
    student.frequency,
    student.format,
    student.pay,
    student.heard,
  ])
  const tutorPct = pct([
    tutor.name,
    tutor.campus,
    tutor.dept,
    tutor.subjects,
    tutor.cgpa,
    tutor.hours,
    tutor.format,
    tutor.earn,
    tutor.whatsapp,
    tutor.heard,
  ])

  const submitStudent = (e: FormEvent) => {
    e.preventDefault()
    setStudentSubmitted(true)
    setStudent(blankStudent)
  }
  const submitTutor = (e: FormEvent) => {
    e.preventDefault()
    setTutorSubmitted(true)
    setTutor(blankTutor)
  }

  return (
    <div className="sv-page">
      <header className="sv-header">
        <svg className="sv-doodles" viewBox="0 0 680 300" aria-hidden="true">
          <g
            fill="none"
            stroke="rgba(255,255,255,0.16)"
            strokeWidth="1.6"
            strokeLinecap="round"
          >
            <path d="M596 40c14-12 30-12 40 0" />
            <path d="M602 52c9-8 20-8 28 0" />
            <circle cx="60" cy="196" r="15" />
            <path d="M46 196h28M60 182v28" />
            <path d="M508 236c10 10 24 10 36 0" />
            <path d="M120 60l6 14 14 6-14 6-6 14-6-14-14-6 14-6 6-14Z" />
            <path d="M652 160l4 9 9 4-9 4-4 9-4-9-9-4 9-4 4-9Z" />
          </g>
          <g
            fill="rgba(255,255,255,0.14)"
            fontFamily="'Plus Jakarta Sans',sans-serif"
            fontWeight="700"
          >
            <text x="170" y="42" fontSize="26" transform="rotate(-8 170 42)">
              ∑
            </text>
            <text x="620" y="120" fontSize="22" transform="rotate(10 620 120)">
              π
            </text>
            <text x="256" y="250" fontSize="19" transform="rotate(-6 256 250)">
              √x
            </text>
            <text x="426" y="60" fontSize="17" transform="rotate(7 426 60)">
              a²+b²
            </text>
            <text x="352" y="268" fontSize="20" transform="rotate(5 352 268)">
              ÷
            </text>
            <text x="34" y="120" fontSize="17" transform="rotate(-10 34 120)">
              x=?
            </text>
          </g>
        </svg>

        <div className="sv-header-top">
          <a href="#" className="sv-brand">
            <img src={tcIcon} alt="" className="sv-brand-icon" />
            <span>
              <span className="sv-brand-white">Tutor</span>
              {' '}
              <span className="sv-brand-orange">Connect</span>
            </span>
          </a>
          <a href="#" className="sv-back">
            ← Back to home
          </a>
        </div>

        <div className="sv-hero-row">
          <div>
            <h1 className="sv-title">
              Help us build something{' '}
              <span className="sv-underline">
                made for you
                <svg viewBox="0 0 220 20" className="sv-underline-swoosh" aria-hidden="true">
                  <path
                    d="M6 14 C60 6, 150 4, 214 10"
                    fill="none"
                    stroke="#F47B20"
                    strokeWidth="6"
                    strokeLinecap="round"
                  />
                  <path
                    d="M26 18 C80 11, 150 10, 196 14"
                    fill="none"
                    stroke="rgba(244,123,32,0.45)"
                    strokeWidth="4"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
            </h1>
            <p className="sv-lede">
              2 minutes. Anonymous. Your voice shapes TutorConnect on your
              campus.
            </p>
          </div>

          <div className="sv-orbit">
            <svg viewBox="0 0 100 100" className="sv-orbit-svg">
              <defs>
                <path
                  id="svorb"
                  d="M50,50 m-38,0 a38,38 0 1,1 76,0 a38,38 0 1,1 -76,0"
                />
              </defs>
              <text
                fontSize="9.6"
                fontWeight="700"
                letterSpacing="1.6"
                fill="rgba(255,255,255,0.8)"
                fontFamily="'Plus Jakarta Sans',sans-serif"
              >
                <textPath href="#svorb">2 minutes · anonymous · honest · </textPath>
              </text>
            </svg>
            <div className="sv-orbit-center">🎓</div>
          </div>
        </div>

        <div className="sv-tabs">
          <button
            type="button"
            className={`sv-tab${tab === 'student' ? ' sv-tab-active' : ''}`}
            onClick={() => setTab('student')}
          >
            🎒 I'm a Student
          </button>
          <button
            type="button"
            className={`sv-tab${tab === 'tutor' ? ' sv-tab-active' : ''}`}
            onClick={() => setTab('tutor')}
          >
            📚 I'm a Tutor
          </button>
        </div>
      </header>

      <div className="sv-strip">
        <div className="sv-strip-track">
          {Array.from({ length: 6 }).map((_, i) => (
            <span key={i}>
              Takes 2 minutes&nbsp;✦&nbsp;100% Anonymous&nbsp;✦&nbsp;No sign-up
              needed&nbsp;✦&nbsp;
            </span>
          ))}
        </div>
      </div>

      <main className="sv-body">
        {tab === 'student' && (
          <div className="sv-card" key="student">
            {studentSubmitted ? (
              <ThankYou onReset={() => setStudentSubmitted(false)} />
            ) : (
              <form className="sv-form" onSubmit={submitStudent}>
                <div className="sv-form-head">
                  <div>
                    <div className="sv-form-title">Student Survey</div>
                    <div className="sv-form-sub">
                      Tell us how you currently study and what you need in a
                      tutor. Your feedback will help us design the best
                      matching system.
                    </div>
                  </div>
                  <Progress value={studentPct} />
                </div>

                <Section step="01" title="About you">
                  <div className="sv-row">
                    <Field label="Full Name">
                      <input
                        className="sv-input"
                        placeholder="e.g. Amaka Obi"
                        value={student.name}
                        onChange={(e) => setS('name')(e.target.value)}
                      />
                    </Field>
                    <Field label="University / Campus">
                      <input
                        className="sv-input"
                        placeholder="e.g. University of Lagos"
                        value={student.campus}
                        onChange={(e) => setS('campus')(e.target.value)}
                      />
                    </Field>
                  </div>

                  <Field label="Department & Level">
                    <input
                      className="sv-input"
                      placeholder="e.g. Computer Science, 300L"
                      value={student.dept}
                      onChange={(e) => setS('dept')(e.target.value)}
                    />
                  </Field>
                </Section>

                <Section step="02" title="Your study needs">
                  <Field label="Which subjects are you currently struggling with?">
                    <textarea
                      className="sv-input"
                      rows={3}
                      placeholder="e.g. Calculus, Organic Chemistry…"
                      value={student.subjects}
                      onChange={(e) => setS('subjects')(e.target.value)}
                    />
                  </Field>

                  <ChipGroup
                    label="How often do you need tutoring help?"
                    options={[
                      'Once a week',
                      '2–3 times a week',
                      'Only before exams',
                      "Anytime I'm stuck",
                    ]}
                    value={student.frequency}
                    onSelect={setS('frequency')}
                  />
                  <ChipGroup
                    label="What format do you prefer?"
                    options={[
                      '1-on-1 with a tutor',
                      'Small group session',
                      'Either works for me',
                    ]}
                    value={student.format}
                    onSelect={setS('format')}
                  />
                  <ChipGroup
                    label="How much are you willing to pay per session?"
                    options={[
                      '₦1,000–₦2,000',
                      '₦2,000–₦3,500',
                      '₦3,500–₦5,000',
                      'Whatever is fair',
                    ]}
                    value={student.pay}
                    onSelect={setS('pay')}
                  />
                </Section>

                <Section step="03" title="Finishing up">
                  <HeardSelect value={student.heard} onChange={setS('heard')} />

                  <Field label="Any other comments or requests?" optional>
                    <textarea
                      className="sv-input"
                      rows={2}
                      placeholder="Tell us anything…"
                      value={student.comments}
                      onChange={(e) => setS('comments')(e.target.value)}
                    />
                  </Field>
                </Section>

                <button type="submit" className="sv-submit">
                  Submit Student Survey <span className="sv-submit-arrow">↗</span>
                </button>
              </form>
            )}
          </div>
        )}

        {tab === 'tutor' && (
          <div className="sv-card" key="tutor">
            {tutorSubmitted ? (
              <ThankYou onReset={() => setTutorSubmitted(false)} />
            ) : (
              <form className="sv-form" onSubmit={submitTutor}>
                <div className="sv-form-head">
                  <div>
                    <div className="sv-form-title">Tutor Survey</div>
                    <div className="sv-form-sub">
                      Share what you teach and help shape tutoring on your campus.
                    </div>
                  </div>
                  <Progress value={tutorPct} />
                </div>

                <Section step="01" title="About you">
                  <div className="sv-row">
                    <Field label="Full Name">
                      <input
                        className="sv-input"
                        placeholder="e.g. Tunde Bello"
                        value={tutor.name}
                        onChange={(e) => setT('name')(e.target.value)}
                      />
                    </Field>
                    <Field label="University / Campus">
                      <input
                        className="sv-input"
                        placeholder="e.g. University of Ibadan"
                        value={tutor.campus}
                        onChange={(e) => setT('campus')(e.target.value)}
                      />
                    </Field>
                  </div>

                  <Field label="Department & Level">
                    <input
                      className="sv-input"
                      placeholder="e.g. Mechanical Engineering, 500L"
                      value={tutor.dept}
                      onChange={(e) => setT('dept')(e.target.value)}
                    />
                  </Field>
                </Section>

                <Section step="02" title="Your tutoring">
                  <Field label="What subjects can you confidently tutor?">
                    <textarea
                      className="sv-input"
                      rows={3}
                      placeholder="e.g. Physics, Statistics, Python…"
                      value={tutor.subjects}
                      onChange={(e) => setT('subjects')(e.target.value)}
                    />
                  </Field>

                  <ChipGroup
                    label="What is your current CGPA or grade class?"
                    options={[
                      'First Class',
                      'Second Class Upper',
                      'Second Class Lower',
                      'Other',
                    ]}
                    value={tutor.cgpa}
                    onSelect={setT('cgpa')}
                  />
                  <ChipGroup
                    label="How many hours per week can you tutor?"
                    options={['1–3 hrs', '4–6 hrs', '7–10 hrs', '10+ hrs']}
                    value={tutor.hours}
                    onSelect={setT('hours')}
                  />
                  <ChipGroup
                    label="What session format do you prefer?"
                    options={['1-on-1 only', 'Group sessions only', 'Both']}
                    value={tutor.format}
                    onSelect={setT('format')}
                  />
                  <ChipGroup
                    label="How much would you like to earn per session?"
                    options={[
                      '₦2,000–₦3,000',
                      '₦3,000–₦5,000',
                      '₦5,000+',
                      'Open to discussion',
                    ]}
                    value={tutor.earn}
                    onSelect={setT('earn')}
                  />
                </Section>

                <Section step="03" title="Finishing up">
                  <Field label="Do you have a WhatsApp number we can reach you on?">
                    <input
                      className="sv-input"
                      placeholder="e.g. 0803 123 4567"
                      value={tutor.whatsapp}
                      onChange={(e) => setT('whatsapp')(e.target.value)}
                    />
                  </Field>

                  <HeardSelect value={tutor.heard} onChange={setT('heard')} />

                  <Field label="Anything else you want us to know?" optional>
                    <textarea
                      className="sv-input"
                      rows={2}
                      placeholder="Tell us anything…"
                      value={tutor.other}
                      onChange={(e) => setT('other')(e.target.value)}
                    />
                  </Field>
                </Section>

                <button type="submit" className="sv-submit sv-submit-tutor">
                  Submit Tutor Survey <span className="sv-submit-arrow">↗</span>
                </button>
              </form>
            )}
          </div>
        )}
      </main>

      <footer className="sv-footer">
        <div className="sv-footer-title">
          TutorConnect Nigeria&nbsp;·&nbsp;Learn Better. Achieve More.
        </div>
        <div className="sv-footer-note">
          Your responses are private and used only to match you with the right
          person on your campus.
        </div>
      </footer>
    </div>
  )
}

export default Survey
