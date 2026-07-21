import { useState } from 'react'
import type { FormEvent } from 'react'
import tcIcon from './assets/tc-icon.png'
import { submitStudentSurvey, submitTutorSurvey } from './api'
import './Survey.css'

/* ---------- Shared option sets (verbatim from the Bells survey) ---------- */

const FACULTIES = [
  'Faculty of Computing',
  'Faculty of Basic Medical Sciences',
  'Faculty of Nursing',
  'Faculty of Arts',
  'Faculty of Technology',
  'Faculty of Social Management and Sciences',
  'Faculty of Law',
  'Faculty of Education',
  'Faculty of Science',
  'Faculty of Pharmacy',
  'Faculty of Engineering',
  'College of Engineering (COLENG)',
  'College of Environmental Sciences (COLENVS)',
  'College of Management Sciences (COLMANS)',
  'College of Natural & Applied Sciences (COLNAS)',
]
const NIGERIAN_SCHOOLS = [
  'Abia State University',
  'Ahmadu Bello University',
  'Afe Babalola University',
  'Babcock University',
  'Bayero University Kano',
  'Bells University of Technology',
  'Bowen University',
  'Covenant University',
  'Federal University of Technology, Akure',
  'Federal University of Technology, Minna',
  'Federal University of Technology, Owerri',
  'Lagos State University',
  'Nnamdi Azikiwe University',
  'Obafemi Awolowo University',
  'Olabisi Onabanjo University',
  'Pan-Atlantic University',
  'Redeemer’s University',
  'University of Abuja',
  'University of Benin',
  'University of Calabar',
  'University of Ibadan',
  'University of Ilesa',
  'University of Ilorin',
  'University of Jos',
  'University of Lagos',
  'University of Nigeria, Nsukka',
  'University of Port Harcourt',
  'University of Uyo',
  'Other Nigerian institution',
]
const LEVELS = ['100L', '200L', '300L', '400L', '500L', 'MSC 1', 'MSC 2']
const RATES = [
  'Under ₦1,000',
  '₦1,000–₦2,000',
  '₦2,000–₦3,000',
  '₦3,000–₦5,000',
  'Above ₦5,000',
]
const FORMATS = ['Physical tutorials', 'Online tutorials', 'Both']

/* ---------- Reusable pieces ---------- */

type ChipGroupProps = {
  label: string
  required?: boolean
  options: string[]
  value: string
  onSelect: (v: string) => void
}

function ChipGroup({ label, required, options, value, onSelect }: ChipGroupProps) {
  return (
    <div className="sv-group">
      <span className="sv-label">
        {label}
        {required && <span className="sv-req">*</span>}
      </span>
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

type MultiChipGroupProps = {
  label: string
  hint?: string
  options: string[]
  values: string[]
  max?: number
  onToggle: (v: string) => void
}

function MultiChipGroup({
  label,
  hint,
  options,
  values,
  max,
  onToggle,
}: MultiChipGroupProps) {
  const atMax = max !== undefined && values.length >= max
  return (
    <div className="sv-group">
      <span className="sv-label">
        {label} {hint && <span className="sv-optional">{hint}</span>}
      </span>
      <div className="sv-chips">
        {options.map((o) => {
          const active = values.includes(o)
          return (
            <button
              key={o}
              type="button"
              disabled={!active && atMax}
              className={`sv-chip sv-chip-multi${active ? ' sv-chip-active' : ''}`}
              onClick={() => onToggle(o)}
            >
              {active && <span className="sv-chip-check">✓</span>}
              {o}
            </button>
          )
        })}
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
  required?: boolean
  children: React.ReactNode
}

function Field({ label, optional, required, children }: FieldProps) {
  return (
    <label className="sv-field">
      <span className="sv-label">
        {label}
        {required && <span className="sv-req">*</span>}
        {optional && <span className="sv-optional">(optional)</span>}
      </span>
      {children}
    </label>
  )
}

function FacultySelect({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  return (
    <Field label="What faculty or college are you in?" required>
      <select
        className="sv-input sv-select"
        value={value}
        required
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Select your faculty or college</option>
        {FACULTIES.map((faculty) => (
          <option key={faculty}>{faculty}</option>
        ))}
      </select>
    </Field>
  )
}

function SchoolSelect({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  return (
    <Field label="Which school do you attend?" required>
      <select
        className="sv-input sv-select"
        value={value}
        required
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Select your school</option>
        {NIGERIAN_SCHOOLS.map((school) => (
          <option key={school}>{school}</option>
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
        Thank you for filling out our survey. Your feedback will help us shape
        TutorConnect.
      </div>
      <button type="button" className="sv-thanks-btn" onClick={onReset}>
        Submit another response
      </button>
    </div>
  )
}

/* ---------- Form state ---------- */

const blankStudent = {
  school: '',
  faculty: '',
  dept: '',
  level: '',
  struggled: '',
  courses: [] as string[],
  runto: '',
  wished: '',
  woulduse: '',
  rate: '',
  trust: [] as string[],
  timing: '',
  format: '',
  feature: '',
  suggestions: '',
}

const blankTutor = {
  school: '',
  faculty: '',
  dept: '',
  level: '',
  helped: '',
  canteach: '',
  interested: '',
  why: [] as string[],
  earn: '',
  format: '',
  stopyou: '',
  join: '',
  feature: '',
  suggestions: '',
}

type StringKeys<T> = {
  [K in keyof T]: T[K] extends string ? K : never
}[keyof T]

const filled = (vals: Array<string | string[]>) =>
  vals.filter((v) => (Array.isArray(v) ? v.length > 0 : v.trim() !== '')).length
const pctOf = (vals: Array<string | string[]>) =>
  Math.round((filled(vals) / vals.length) * 100)

function Survey() {
  const [tab, setTab] = useState<'student' | 'tutor'>('student')
  const [student, setStudent] = useState(blankStudent)
  const [tutor, setTutor] = useState(blankTutor)
  const [studentSubmitted, setStudentSubmitted] = useState(false)
  const [tutorSubmitted, setTutorSubmitted] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const switchTab = (t: 'student' | 'tutor') => {
    setTab(t)
    setError(null)
  }

  const setS = (field: StringKeys<typeof blankStudent>) => (v: string) =>
    setStudent((s) => ({ ...s, [field]: v }))
  const setT = (field: StringKeys<typeof blankTutor>) => (v: string) =>
    setTutor((t) => ({ ...t, [field]: v }))

  const toggleStudent =
    (field: 'courses' | 'trust', max?: number) => (v: string) =>
      setStudent((s) => {
        const arr = s[field]
        if (arr.includes(v)) return { ...s, [field]: arr.filter((x) => x !== v) }
        if (max && arr.length >= max) return s
        return { ...s, [field]: [...arr, v] }
      })

  const toggleTutor = (field: 'why') => (v: string) =>
    setTutor((t) => {
      const arr = t[field]
      if (arr.includes(v)) return { ...t, [field]: arr.filter((x) => x !== v) }
      return { ...t, [field]: [...arr, v] }
    })

  const studentPct = pctOf([
    student.school,
    student.faculty,
    student.dept,
    student.level,
    student.struggled,
    student.courses,
    student.runto,
    student.wished,
    student.woulduse,
    student.rate,
    student.trust,
    student.timing,
    student.format,
  ])
  const tutorPct = pctOf([
    tutor.school,
    tutor.faculty,
    tutor.dept,
    tutor.level,
    tutor.helped,
    tutor.canteach,
    tutor.interested,
    tutor.why,
    tutor.earn,
    tutor.format,
    tutor.join,
  ])

  const submitStudent = async (e: FormEvent) => {
    e.preventDefault()
    if (sending) return
    setSending(true)
    setError(null)
    try {
      await submitStudentSurvey(student)
      setStudentSubmitted(true)
      setStudent(blankStudent)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setSending(false)
    }
  }
  const submitTutor = async (e: FormEvent) => {
    e.preventDefault()
    if (sending) return
    setSending(true)
    setError(null)
    try {
      await submitTutorSurvey(tutor)
      setTutorSubmitted(true)
      setTutor(blankTutor)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setSending(false)
    }
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
              <span className="sv-brand-white">Tutor</span>{' '}
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
                <svg
                  viewBox="0 0 220 20"
                  className="sv-underline-swoosh"
                  aria-hidden="true"
                >
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
            onClick={() => switchTab('student')}
          >
            🎒 I'm a Student
          </button>
          <button
            type="button"
            className={`sv-tab${tab === 'tutor' ? ' sv-tab-active' : ''}`}
            onClick={() => switchTab('tutor')}
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
                  <SchoolSelect
                    value={student.school}
                    onChange={setS('school')}
                  />
                  <FacultySelect
                    value={student.faculty}
                    onChange={setS('faculty')}
                  />
                  <Field label="Department" required>
                    <input
                      className="sv-input"
                      placeholder="e.g. Mechanical Engineering"
                      required
                      value={student.dept}
                      onChange={(e) => setS('dept')(e.target.value)}
                    />
                  </Field>
                  <ChipGroup
                    label="Level"
                    options={LEVELS}
                    value={student.level}
                    onSelect={setS('level')}
                  />
                </Section>

                <Section step="02" title="Your experience">
                  <ChipGroup
                    label="Have you ever struggled with a course?"
                    options={['Yes 😂', 'Yes 😭', 'No']}
                    value={student.struggled}
                    onSelect={setS('struggled')}
                  />
                  <MultiChipGroup
                    label="Which course(s) stressed you the most?"
                    hint="(select all that apply)"
                    options={[
                      'Engineering Mathematics',
                      'Calculus',
                      'Architectural Design Studio',
                      'Surveying',
                      'Fluid Mechanics',
                      'Financial Accounting',
                      'Microeconomics',
                      'Other',
                    ]}
                    values={student.courses}
                    onToggle={toggleStudent('courses')}
                  />
                  <ChipGroup
                    label="When you're confused in class, who do you normally run to?"
                    required
                    options={[
                      'My lecturer',
                      'YouTube',
                      'My friends',
                      'ChatGPT/AI',
                      'Private tutor',
                      'I just read alone',
                      'My course mates',
                    ]}
                    value={student.runto}
                    onSelect={setS('runto')}
                  />
                  <ChipGroup
                    label="Have you ever wished someone could explain a course better than your lecturer?"
                    options={['Yes', 'Sometimes', 'No']}
                    value={student.wished}
                    onSelect={setS('wished')}
                  />
                </Section>

                <Section step="03" title="About the platform">
                  <ChipGroup
                    label="If there was a platform where you could easily find trusted student tutors, would you use it?"
                    options={[
                      'Definitely',
                      'Probably',
                      'Maybe',
                      'Not really',
                      'Never',
                    ]}
                    value={student.woulduse}
                    onSelect={setS('woulduse')}
                  />
                  <ChipGroup
                    label="How much would you realistically pay for a one-hour tutorial?"
                    options={RATES}
                    value={student.rate}
                    onSelect={setS('rate')}
                  />
                  <MultiChipGroup
                    label="What would make you trust a tutor?"
                    hint="(check up to 3)"
                    max={3}
                    options={[
                      'CGPA',
                      'Department',
                      'Recommendations',
                      'Reviews',
                      'Affordability',
                      'Friendliness',
                      'Explanation quality',
                    ]}
                    values={student.trust}
                    onToggle={toggleStudent('trust', 3)}
                  />
                  <ChipGroup
                    label="During which period would you need tutorials the most?"
                    options={[
                      'Beginning of semester',
                      'Before CA',
                      'Before Exams',
                      'Throughout the semester',
                    ]}
                    value={student.timing}
                    onSelect={setS('timing')}
                  />
                  <ChipGroup
                    label="Would you prefer"
                    options={FORMATS}
                    value={student.format}
                    onSelect={setS('format')}
                  />
                </Section>

                <Section step="04" title="Your ideas">
                  <Field
                    label="If Tutor Connect existed today, what feature would make you use it?"
                    optional
                  >
                    <textarea
                      className="sv-input"
                      rows={2}
                      placeholder="Tell us the one thing…"
                      value={student.feature}
                      onChange={(e) => setS('feature')(e.target.value)}
                    />
                  </Field>
                  <Field label="Any other suggestions?" optional>
                    <textarea
                      className="sv-input"
                      rows={2}
                      placeholder="Anything else on your mind…"
                      value={student.suggestions}
                      onChange={(e) => setS('suggestions')(e.target.value)}
                    />
                  </Field>
                </Section>

                {error && <div className="sv-error">{error}</div>}
                <button type="submit" className="sv-submit" disabled={sending}>
                  {sending ? 'Submitting…' : 'Submit Student Survey'}{' '}
                  {!sending && <span className="sv-submit-arrow">↗</span>}
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
                  <SchoolSelect
                    value={tutor.school}
                    onChange={setT('school')}
                  />
                  <FacultySelect
                    value={tutor.faculty}
                    onChange={setT('faculty')}
                  />
                  <Field label="Department" required>
                    <input
                      className="sv-input"
                      placeholder="e.g. Computer Science"
                      required
                      value={tutor.dept}
                      onChange={(e) => setT('dept')(e.target.value)}
                    />
                  </Field>
                  <ChipGroup
                    label="Level"
                    options={LEVELS}
                    value={tutor.level}
                    onSelect={setT('level')}
                  />
                </Section>

                <Section step="02" title="Your teaching">
                  <ChipGroup
                    label="Have you ever helped someone understand a course before?"
                    options={['Yes', 'Many Times', 'Not Really']}
                    value={tutor.helped}
                    onSelect={setT('helped')}
                  />
                  <Field label="Which courses can you confidently teach?" optional>
                    <textarea
                      className="sv-input"
                      rows={2}
                      placeholder="e.g. Engineering Mathematics, Calculus, Python…"
                      value={tutor.canteach}
                      onChange={(e) => setT('canteach')(e.target.value)}
                    />
                  </Field>
                  <ChipGroup
                    label="Would you be interested in making extra money by tutoring?"
                    required
                    options={['Yes', 'Maybe', 'No']}
                    value={tutor.interested}
                    onSelect={setT('interested')}
                  />
                  <MultiChipGroup
                    label="Why would you like to tutor?"
                    hint="(check all that apply)"
                    options={[
                      'Extra Cash',
                      'I enjoy teaching',
                      'To build experience',
                      'To meet people',
                    ]}
                    values={tutor.why}
                    onToggle={toggleTutor('why')}
                  />
                </Section>

                <Section step="03" title="The details">
                  <ChipGroup
                    label="How much would you expect to earn per hour?"
                    options={RATES}
                    value={tutor.earn}
                    onSelect={setT('earn')}
                  />
                  <ChipGroup
                    label="Would you prefer"
                    options={FORMATS}
                    value={tutor.format}
                    onSelect={setT('format')}
                  />
                  <Field label="What would stop you from becoming a tutor?" optional>
                    <textarea
                      className="sv-input"
                      rows={2}
                      placeholder="e.g. Time, workload, unsure how to start…"
                      value={tutor.stopyou}
                      onChange={(e) => setT('stopyou')(e.target.value)}
                    />
                  </Field>
                  <ChipGroup
                    label="If Tutor Connect launched at Bells, would you join as a tutor?"
                    options={['Definitely', 'Probably', 'Maybe', 'No']}
                    value={tutor.join}
                    onSelect={setT('join')}
                  />
                </Section>

                <Section step="04" title="Your ideas">
                  <Field
                    label="If Tutor Connect existed today, what feature would make you use it?"
                    optional
                  >
                    <textarea
                      className="sv-input"
                      rows={2}
                      placeholder="Tell us the one thing…"
                      value={tutor.feature}
                      onChange={(e) => setT('feature')(e.target.value)}
                    />
                  </Field>
                  <Field label="Any other suggestions?" optional>
                    <textarea
                      className="sv-input"
                      rows={2}
                      placeholder="Anything else on your mind…"
                      value={tutor.suggestions}
                      onChange={(e) => setT('suggestions')(e.target.value)}
                    />
                  </Field>
                </Section>

                {error && <div className="sv-error">{error}</div>}
                <button
                  type="submit"
                  className="sv-submit sv-submit-tutor"
                  disabled={sending}
                >
                  {sending ? 'Submitting…' : 'Submit Tutor Survey'}{' '}
                  {!sending && <span className="sv-submit-arrow">↗</span>}
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
