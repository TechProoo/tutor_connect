import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sidebar, type Section } from './components/Sidebar'
import { Overview } from './pages/Overview'
import { People } from './pages/People'
import { Campuses } from './pages/Campuses'
import { Settings } from './pages/Settings'
import { loadSettings, saveSettings, type AdminSettings } from './settings'

function App() {
  const [section, setSection] = useState<Section>('Overview')
  const [collapsed, setCollapsed] = useState(false)
  const [settings, setSettings] = useState<AdminSettings>(loadSettings)

  useEffect(() => saveSettings(settings), [settings])

  const patchSettings = (patch: Partial<AdminSettings>) => setSettings((s) => ({ ...s, ...patch }))

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar
        section={section}
        onNavigate={setSection}
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
        live={settings.live}
      />

      <main style={{ flex: 1, minWidth: 0, padding: '26px 30px 44px' }}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={section}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
            {section === 'Overview' && <Overview />}
            {section === 'Students' && <People role="Student" />}
            {section === 'Tutors' && <People role="Tutor" />}
            {section === 'Campuses' && <Campuses />}
            {section === 'Settings' && <Settings settings={settings} onChange={patchSettings} />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  )
}

export default App
