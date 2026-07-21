import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { PageHeader } from '../components/ui'
import { Icon, type IconName } from '../icons'
import type { AdminSettings } from '../settings'

interface SettingsPageProps {
  settings: AdminSettings
  onChange: (patch: Partial<AdminSettings>) => void
}

const SURVEY_URL = 'https://tutorconnect.ng/survey'

export function Settings({ settings, onChange }: SettingsPageProps) {
  const [copied, setCopied] = useState(false)
  const [saved, setSaved] = useState(false)

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(SURVEY_URL)
    } catch {
      // Clipboard API unavailable (http / permissions) — fall back silently
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  const save = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 1800)
  }

  return (
    <>
      <PageHeader kicker="Workspace" title="Settings" />

      <div style={{ display: 'grid', gap: 16, maxWidth: 760 }}>
        <SettingsCard icon="link" title="Survey link" delay={0}>
          <p style={{ margin: '0 0 14px', fontSize: 13.5, color: 'var(--body)', fontWeight: 500 }}>
            Share this link with students and tutors to collect responses.
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <input className="text-input" readOnly value={SURVEY_URL} style={{ flex: '1 1 260px' }} />
            <motion.button
              type="button"
              onClick={copyLink}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.96 }}
              style={{
                cursor: 'pointer',
                background: copied ? 'var(--green)' : 'var(--navy)',
                color: '#fff',
                border: 'none',
                borderRadius: 11,
                padding: '10px 18px',
                fontSize: 13,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                minWidth: 120,
                justifyContent: 'center',
                transition: 'background .2s',
              }}
            >
              <Icon name={copied ? 'check' : 'copy'} size={15} />
              {copied ? 'Copied!' : 'Copy link'}
            </motion.button>
          </div>
        </SettingsCard>

        <SettingsCard icon="shield" title="Survey status" delay={0.07}>
          <ToggleRow
            label="Accepting responses"
            hint={
              settings.live
                ? 'The survey is live — new submissions are being collected.'
                : 'The survey is paused — visitors will see a “closed” notice.'
            }
            checked={settings.live}
            onChange={(v) => onChange({ live: v })}
          />
          <ToggleRow
            label="Require campus email"
            hint="Only allow submissions from verified university email addresses."
            checked={settings.requireCampusEmail}
            onChange={(v) => onChange({ requireCampusEmail: v })}
          />
        </SettingsCard>

        <SettingsCard icon="bell" title="Notifications" delay={0.14}>
          <ToggleRow
            label="Email me a daily digest"
            hint="A summary of new responses, sent every morning at 8:00 AM."
            checked={settings.dailyDigest}
            onChange={(v) => onChange({ dailyDigest: v })}
          />
          <ToggleRow
            label="Alert on milestone"
            hint="Get notified every time responses cross another 500."
            checked={settings.milestoneAlerts}
            onChange={(v) => onChange({ milestoneAlerts: v })}
          />
          <div style={{ marginTop: 14 }}>
            <label
              style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: 'var(--muted)', marginBottom: 6 }}
            >
              Notification email
            </label>
            <input
              className="text-input"
              type="email"
              style={{ width: '100%', maxWidth: 340 }}
              value={settings.notifyEmail}
              onChange={(e) => onChange({ notifyEmail: e.target.value })}
              placeholder="admin@tutorconnect.ng"
            />
          </div>
        </SettingsCard>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.21 }}
          style={{ display: 'flex', alignItems: 'center', gap: 14 }}
        >
          <motion.button
            type="button"
            onClick={save}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.96 }}
            style={{
              cursor: 'pointer',
              background: 'var(--orange)',
              color: '#fff',
              border: 'none',
              borderRadius: 11,
              padding: '12px 26px',
              fontSize: 13.5,
              fontWeight: 700,
            }}
          >
            Save changes
          </motion.button>
          <AnimatePresence>
            {saved && (
              <motion.span
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: 'var(--green)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Icon name="check" size={15} /> Settings saved
              </motion.span>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </>
  )
}

function SettingsCard({
  icon,
  title,
  delay,
  children,
}: {
  icon: IconName
  title: string
  delay: number
  children: React.ReactNode
}) {
  return (
    <motion.div
      className="card"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <span
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--navy-tint)',
            color: 'var(--navy)',
            flexShrink: 0,
          }}
        >
          <Icon name={icon} size={17} />
        </span>
        <span style={{ fontSize: 15, fontWeight: 800 }}>{title}</span>
      </div>
      {children}
    </motion.div>
  )
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string
  hint: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        padding: '11px 0',
        borderTop: '1px solid var(--bg)',
      }}
    >
      <div>
        <div style={{ fontSize: 13.5, fontWeight: 700 }}>{label}</div>
        <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--muted)', marginTop: 2 }}>{hint}</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        style={{
          cursor: 'pointer',
          border: 'none',
          padding: 3,
          width: 46,
          height: 26,
          borderRadius: 999,
          background: checked ? 'var(--orange)' : '#cfd8e3',
          display: 'flex',
          justifyContent: checked ? 'flex-end' : 'flex-start',
          flexShrink: 0,
          transition: 'background .2s',
        }}
      >
        <motion.span
          layout
          transition={{ type: 'spring', stiffness: 600, damping: 32 }}
          style={{
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: '#fff',
            boxShadow: '0 1px 4px rgba(26,58,92,.25)',
          }}
        />
      </button>
    </div>
  )
}
