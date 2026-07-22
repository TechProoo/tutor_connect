import { useEffect, useRef, useState } from 'react'
import { motion, useMotionValue, useSpring, AnimatePresence } from 'framer-motion'
import { Icon, type IconName } from '../icons'
import { timeAgo, type SurveyResponse } from '../data'

// ---------------------------------------------------------------------------
// Response detail modal — read one person's full survey answers
// ---------------------------------------------------------------------------

export function ResponseModal({
  response,
  onClose,
}: {
  response: SurveyResponse | null
  onClose: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <AnimatePresence>
      {response && (
        <motion.div
          className="rm-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
        >
          <motion.div
            className="rm-panel"
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="rm-head">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <RolePill role={response.role} />
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--muted)' }}>
                    {response.submittedAt.toLocaleString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}{' '}
                    · {timeAgo(response.submittedAt)}
                  </span>
                </div>
                <div style={{ fontSize: 17, fontWeight: 800, marginTop: 8 }}>
                  {response.facultyShort}
                  {response.dept ? ` · ${response.dept}` : ''}
                </div>
              </div>
              <button type="button" className="rm-close" aria-label="Close" onClick={onClose}>
                <Icon name="close" size={18} />
              </button>
            </div>

            <div className="rm-body">
              {response.answers.map((a) => (
                <div key={a.label} className={`rm-row${a.freeText ? ' rm-row-free' : ''}`}>
                  <div className="rm-label">{a.label}</div>
                  <div className={`rm-value${a.value ? '' : ' rm-empty'}`}>
                    {a.value || 'Not answered'}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ---------------------------------------------------------------------------
// Count-up number
// ---------------------------------------------------------------------------

export function CountUp({ value, suffix = '' }: { value: number; suffix?: string }) {
  const mv = useMotionValue(0)
  const spring = useSpring(mv, { stiffness: 90, damping: 22 })
  const [display, setDisplay] = useState('0')
  const first = useRef(true)

  useEffect(() => {
    if (first.current) {
      first.current = false
      mv.jump(0)
    }
    mv.set(value)
  }, [value, mv])

  useEffect(
    () => spring.on('change', (v) => setDisplay(Math.round(v).toLocaleString('en-US'))),
    [spring],
  )

  return (
    <span>
      {display}
      {suffix}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------

export interface Stat {
  label: string
  value: number
  suffix?: string
  icon: IconName
  accent: string
  iconBg: string
  delta: string
  deltaUp: boolean
  /** When set, a caret up/down icon precedes the delta text. */
  trend?: 'up' | 'down'
}

export function StatCard({ stat, index }: { stat: Stat; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.07, ease: 'easeOut' }}
      whileHover={{ y: -3, boxShadow: '0 8px 22px rgba(26,58,92,.10)' }}
      style={{
        background: '#fff',
        borderRadius: 18,
        padding: 20,
        boxShadow: 'var(--shadow)',
        borderLeft: `4px solid ${stat.accent}`,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 14,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)' }}>{stat.label}</span>
        <span
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: stat.iconBg,
            color: stat.accent,
          }}
        >
          <Icon name={stat.icon} />
        </span>
      </div>
      <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-1px', lineHeight: 1 }}>
        <CountUp value={stat.value} suffix={stat.suffix} />
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          fontSize: 12.5,
          fontWeight: 600,
          color: stat.deltaUp ? 'var(--green)' : 'var(--red)',
          marginTop: 8,
        }}
      >
        {stat.trend && <Icon name={stat.trend === 'up' ? 'caretUp' : 'caretDown'} size={13} />}
        {stat.delta}
      </div>
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// Segmented control (range picker / table filter)
// ---------------------------------------------------------------------------

interface SegmentedProps<T extends string> {
  options: readonly T[]
  value: T
  onChange: (v: T) => void
  variant: 'outline' | 'tint'
  layoutId: string
}

export function Segmented<T extends string>({ options, value, onChange, variant, layoutId }: SegmentedProps<T>) {
  const outline = variant === 'outline'
  return (
    <div
      style={
        outline
          ? { display: 'flex', background: '#fff', border: '1.5px solid var(--border)', borderRadius: 11, overflow: 'hidden' }
          : { display: 'flex', background: 'var(--bg)', borderRadius: 10, padding: 3 }
      }
    >
      {options.map((label) => {
        const on = value === label
        return (
          <button
            key={label}
            type="button"
            onClick={() => onChange(label)}
            style={{
              position: 'relative',
              cursor: 'pointer',
              border: 'none',
              borderRadius: outline ? 0 : 8,
              padding: outline ? '10px 15px' : '8px 16px',
              fontSize: outline ? 13 : 12.5,
              fontWeight: 700,
              background: 'transparent',
              color: on ? (outline ? '#fff' : 'var(--navy)') : outline ? 'var(--body)' : 'var(--muted)',
              transition: 'color .18s',
            }}
          >
            {on && (
              <motion.span
                layoutId={layoutId}
                transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: outline ? 'var(--navy)' : '#fff',
                  borderRadius: outline ? 0 : 8,
                  boxShadow: outline ? 'none' : '0 1px 4px rgba(26,58,92,.12)',
                }}
              />
            )}
            <span style={{ position: 'relative' }}>{label}</span>
          </button>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Grouped bar chart (students / tutors per day)
// ---------------------------------------------------------------------------

export interface ChartDay {
  day: string
  date: Date
  students: number
  tutors: number
}

export function BarChart({ data }: { data: ChartDay[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(...data.map((d) => d.students + d.tutors), 1)

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: data.length > 20 ? 4 : 8, height: 180 }}>
      {data.map((d, i) => {
        const total = d.students + d.tutors
        const hovered = hover === i
        return (
          <div
            key={i}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 6,
              height: '100%',
              justifyContent: 'flex-end',
              position: 'relative',
              cursor: 'default',
            }}
          >
            <AnimatePresence>
              {hovered && (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.9 }}
                  transition={{ duration: 0.15 }}
                  style={{
                    position: 'absolute',
                    bottom: '100%',
                    marginBottom: 6,
                    background: 'var(--navy)',
                    color: '#fff',
                    borderRadius: 9,
                    padding: '7px 10px',
                    fontSize: 11,
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    zIndex: 5,
                    pointerEvents: 'none',
                    boxShadow: '0 6px 18px rgba(26,58,92,.28)',
                  }}
                >
                  <div style={{ fontWeight: 800, marginBottom: 2 }}>
                    {d.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {total}
                  </div>
                  <div style={{ color: '#9fc0e6' }}>{d.students} students</div>
                  <div style={{ color: '#ffc79b' }}>{d.tutors} tutors</div>
                </motion.div>
              )}
            </AnimatePresence>
            <div
              style={{
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
                gap: 2,
                height: '100%',
                opacity: hover === null || hovered ? 1 : 0.45,
                transition: 'opacity .15s',
              }}
            >
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${(d.tutors / max) * 100}%` }}
                transition={{ duration: 0.5, delay: i * 0.025, ease: 'easeOut' }}
                style={{ width: '100%', background: 'var(--orange)', borderRadius: '3px 3px 0 0', minHeight: d.tutors > 0 ? 2 : 0 }}
              />
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${(d.students / max) * 100}%` }}
                transition={{ duration: 0.5, delay: i * 0.025, ease: 'easeOut' }}
                style={{ width: '100%', background: 'var(--navy)', borderRadius: '0 0 3px 3px', minHeight: d.students > 0 ? 2 : 0 }}
              />
            </div>
            <span style={{ fontSize: 9.5, fontWeight: 600, color: '#a3b0bf' }}>{d.day}</span>
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Campus progress bars
// ---------------------------------------------------------------------------

export function CampusBars({ campuses }: { campuses: { name: string; count: number }[] }) {
  const max = Math.max(...campuses.map((c) => c.count), 1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
      {campuses.map((c, i) => (
        <div key={c.name}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 6,
            }}
          >
            <span>{c.name}</span>
            <span style={{ color: 'var(--muted)' }}>{c.count.toLocaleString('en-US')}</span>
          </div>
          <div style={{ height: 8, background: 'var(--bg)', borderRadius: 999, overflow: 'hidden' }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(c.count / max) * 100}%` }}
              transition={{ duration: 0.6, delay: 0.1 + i * 0.08, ease: 'easeOut' }}
              style={{ height: '100%', background: 'var(--orange)', borderRadius: 999 }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Role pill
// ---------------------------------------------------------------------------

export function RolePill({ role }: { role: 'Student' | 'Tutor' }) {
  const student = role === 'Student'
  return (
    <span
      style={{
        fontSize: 11.5,
        fontWeight: 700,
        padding: '4px 11px',
        borderRadius: 999,
        background: student ? 'var(--navy-tint)' : 'var(--orange-tint)',
        color: student ? 'var(--navy)' : 'var(--orange)',
      }}
    >
      {role}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Page header
// ---------------------------------------------------------------------------

export function PageHeader({
  kicker,
  title,
  children,
}: {
  kicker: string
  title: string
  children?: React.ReactNode
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16,
        marginBottom: 24,
      }}
    >
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', marginBottom: 4 }}>{kicker}</div>
        <h1 style={{ margin: 0, fontSize: 27, fontWeight: 800, letterSpacing: '-0.6px' }}>{title}</h1>
      </div>
      {children && <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>{children}</div>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Primary button
// ---------------------------------------------------------------------------

export function PrimaryButton({
  onClick,
  icon,
  children,
}: {
  onClick?: () => void
  icon?: IconName
  children: React.ReactNode
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ scale: 1.03, background: 'var(--orange-dark)' }}
      whileTap={{ scale: 0.96 }}
      style={{
        cursor: 'pointer',
        background: 'var(--orange)',
        color: '#fff',
        border: 'none',
        borderRadius: 11,
        padding: '10px 18px',
        fontSize: 13,
        fontWeight: 700,
        display: 'flex',
        alignItems: 'center',
        gap: 7,
      }}
    >
      {icon && <Icon name={icon} size={15} strokeWidth={2.2} />}
      {children}
    </motion.button>
  )
}
