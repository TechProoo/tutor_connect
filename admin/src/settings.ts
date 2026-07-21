export interface AdminSettings {
  live: boolean
  requireCampusEmail: boolean
  dailyDigest: boolean
  milestoneAlerts: boolean
  notifyEmail: string
}

export const DEFAULT_SETTINGS: AdminSettings = {
  live: true,
  requireCampusEmail: false,
  dailyDigest: true,
  milestoneAlerts: true,
  notifyEmail: 'admin@tutorconnect.ng',
}

const STORAGE_KEY = 'tc-admin-settings'

export function loadSettings(): AdminSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {
    // corrupt/unavailable storage — fall back to defaults
  }
  return DEFAULT_SETTINGS
}

export function saveSettings(settings: AdminSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // storage unavailable (private mode) — settings stay in memory
  }
}
