import { motion, AnimatePresence } from 'framer-motion'
import { Icon, type IconName } from '../icons'

export type Section =
  | 'Overview'
  | 'Students'
  | 'Tutors'
  | 'Faculties'
  | 'Guides'
  | 'Codes'
  | 'Recovery'
  | 'Settings'

const NAV_ITEMS: { label: Section; icon: IconName; group?: string }[] = [
  { label: 'Overview', icon: 'grid' },
  { label: 'Students', icon: 'cap' },
  { label: 'Tutors', icon: 'book' },
  { label: 'Faculties', icon: 'building' },
  { label: 'Guides', icon: 'book', group: 'Courses' },
  { label: 'Codes', icon: 'shield' },
  { label: 'Recovery', icon: 'link' },
  { label: 'Settings', icon: 'gear', group: 'Workspace' },
]

interface SidebarProps {
  section: Section
  onNavigate: (section: Section) => void
  collapsed: boolean
  onToggle: () => void
  live: boolean
  /** Mobile drawer mode: fixed overlay that slides in/out. */
  isMobile?: boolean
  open?: boolean
  onClose?: () => void
}

const labelAnim = {
  initial: { opacity: 0, x: -8 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -8 },
  transition: { duration: 0.18 },
}

export function Sidebar({
  section,
  onNavigate,
  collapsed,
  onToggle,
  live,
  isMobile = false,
  open = false,
  onClose,
}: SidebarProps) {
  // On mobile the drawer always shows full-width labels (never the collapsed rail).
  const showLabels = isMobile ? true : !collapsed

  const desktopStyle: React.CSSProperties = {
    position: 'sticky',
    top: 0,
    height: '100vh',
  }
  const mobileStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    height: '100vh',
    width: 258,
    zIndex: 60,
    boxShadow: open ? '0 0 40px rgba(0,0,0,.35)' : 'none',
  }

  const navClick = (label: Section) => {
    onNavigate(label)
    if (isMobile) onClose?.()
  }

  return (
    <motion.aside
      animate={isMobile ? { x: open ? 0 : -272 } : { width: collapsed ? 78 : 230 }}
      transition={{ duration: 0.25, ease: 'easeInOut' }}
      style={{
        flexShrink: 0,
        background: 'var(--navy)',
        color: '#fff',
        padding: '24px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        overflow: 'hidden',
        ...(isMobile ? mobileStyle : desktopStyle),
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: showLabels ? 'space-between' : 'center',
          padding: '4px 4px 22px',
        }}
      >
        <AnimatePresence initial={false}>
          {showLabels && (
            <motion.div
              {...labelAnim}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                fontSize: 19,
                fontWeight: 800,
                letterSpacing: '-0.4px',
                whiteSpace: 'nowrap',
              }}
            >
              <img
                src="/tc-icon.png"
                alt="TutorConnect logo"
                style={{ width: 30, height: 30, objectFit: 'contain', flexShrink: 0 }}
              />
              <span>
                <span style={{ color: '#fff' }}>Tutor</span>
                <span style={{ color: 'var(--orange)' }}>Connect</span>
              </span>
            </motion.div>
          )}
        </AnimatePresence>
        <motion.button
          type="button"
          onClick={isMobile ? onClose : onToggle}
          title={isMobile ? 'Close menu' : 'Toggle sidebar'}
          whileHover={{ background: 'rgba(255,255,255,.16)' }}
          whileTap={{ scale: 0.92 }}
          style={{
            cursor: 'pointer',
            border: 'none',
            background: 'rgba(255,255,255,.08)',
            color: '#fff',
            width: 32,
            height: 32,
            borderRadius: 9,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon name={isMobile ? 'close' : collapsed ? 'chevR' : 'chevL'} />
        </motion.button>
      </div>

      {NAV_ITEMS.map((n) => {
        const active = section === n.label
        return (
          <div key={n.label}>
            {n.group && showLabels && (
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: 1.1,
                  textTransform: 'uppercase',
                  color: 'rgba(255,255,255,.4)',
                  padding: '14px 14px 6px',
                  whiteSpace: 'nowrap',
                }}
              >
                {n.group}
              </div>
            )}
            {n.group && !showLabels && (
              <div
                style={{
                  height: 1,
                  background: 'rgba(255,255,255,.14)',
                  margin: '10px 8px',
                }}
              />
            )}
          <motion.button
            type="button"
            title={n.label}
            onClick={() => navClick(n.label)}
            whileHover={active ? undefined : { background: 'rgba(255,255,255,.08)', color: '#fff' }}
            whileTap={{ scale: 0.97 }}
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: showLabels ? 'flex-start' : 'center',
              gap: 11,
              textAlign: 'left',
              cursor: 'pointer',
              border: 'none',
              borderRadius: 11,
              padding: '12px 14px',
              fontSize: 14,
              fontWeight: 600,
              background: 'transparent',
              color: active ? '#fff' : 'rgba(255,255,255,.72)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
            }}
          >
            {active && (
              <motion.span
                layoutId="nav-active"
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                style={{ position: 'absolute', inset: 0, borderRadius: 11, background: 'var(--orange)' }}
              />
            )}
            <span
              style={{
                position: 'relative',
                width: 18,
                flexShrink: 0,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name={n.icon} />
            </span>
            <AnimatePresence initial={false}>
              {showLabels && (
                <motion.span {...labelAnim} style={{ position: 'relative' }}>
                  {n.label}
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
          </div>
        )
      })}

      <AnimatePresence initial={false}>
        {showLabels && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.2 }}
            style={{
              marginTop: 'auto',
              background: 'rgba(255,255,255,.06)',
              borderRadius: 14,
              padding: 14,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,.65)', marginBottom: 8 }}>
              Live survey
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                fontSize: 12.5,
                fontWeight: 600,
                whiteSpace: 'nowrap',
              }}
            >
              <motion.span
                animate={live ? { scale: [1, 1.25, 1] } : {}}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: live ? '#3ddc84' : '#d64545',
                  boxShadow: live ? '0 0 0 3px rgba(61,220,132,.25)' : '0 0 0 3px rgba(214,69,69,.2)',
                  flexShrink: 0,
                }}
              />
              {live ? 'Accepting responses' : 'Responses paused'}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.aside>
  )
}
