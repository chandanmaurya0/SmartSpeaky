import crypto from 'crypto'
import { STORE_KEYS } from '../constants/store-keys'
import type { LlmSettings } from '@/app/store/useAdvancedSettingsStore'
import { ItoMode } from '@/app/generated/ito_pb.js'
import { ITO_MODE_SHORTCUT_DEFAULTS } from '../constants/keyboard-defaults.js'
import { KeyName, normalizeLegacyKey } from '../types/keyboard.js'
// import { resolveDefaultKeys } from '../utils/settings.js'
import Store from 'electron-store'

export interface KeyboardShortcutConfig {
  id: string
  keys: KeyName[]
  mode: ItoMode
}

interface MainStore {
  navExpanded: boolean
}
interface OnboardingStore {
  onboardingStep: number
  onboardingCompleted: boolean
}

export interface SettingsStore {
  shareAnalytics: boolean
  launchAtLogin: boolean
  showItoBarAlways: boolean
  showAppInDock: boolean
  interactionSounds: boolean
  muteAudioWhenDictating: boolean
  microphoneDeviceId: string
  microphoneName: string
  isShortcutGloballyEnabled: boolean
  keyboardShortcuts: KeyboardShortcutConfig[]
  firstName: string
  lastName: string
  email: string
}

export interface AuthState {
  id: string
  codeVerifier: string
  codeChallenge: string
  state: string
}

export interface AuthUser {
  id: string
  email?: string
  name?: string
  picture?: string
  provider?: string
  lastSignInAt?: string
}
export interface AuthTokens {
  access_token?: string
  refresh_token?: string
  id_token?: string
  token_type?: string
  expires_in?: number
  expires_at?: number
}

export interface AuthStore {
  user: AuthUser | null
  tokens: AuthTokens | null
  state: AuthState
}

export interface AdvancedSettings {
  llm: LlmSettings
  grammarServiceEnabled: boolean
  defaults?: LlmSettings
  macosAccessibilityContextEnabled: boolean
}

interface AppStore {
  main: MainStore
  onboarding: OnboardingStore
  settings: SettingsStore
  auth: AuthStore
  advancedSettings: AdvancedSettings
  openMic: boolean
  selectedAudioInput: string | null
  interactionSounds: boolean
  userProfile: any | null
  idToken: string | null
  accessToken: string | null
  appliedMigrations: string[]
}

export const createNewAuthState = (): AuthState => {
  const codeVerifier = crypto.randomBytes(32).toString('base64url')
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url')
  const state = crypto.randomBytes(16).toString('hex')
  const id = crypto.randomUUID()
  return { id, codeVerifier, codeChallenge, state }
}

export const defaultValues: AppStore = {
  onboarding: { onboardingStep: 0, onboardingCompleted: false },
  settings: {
    shareAnalytics: true,
    launchAtLogin: true,
    showItoBarAlways: true,
    showAppInDock: true,
    interactionSounds: false,
    muteAudioWhenDictating: false,
    microphoneDeviceId: 'default',
    microphoneName: 'Auto-detect',
    isShortcutGloballyEnabled: false,
    keyboardShortcuts: [
      {
        id: crypto.randomUUID(),
        keys: ITO_MODE_SHORTCUT_DEFAULTS[ItoMode.TRANSCRIBE].map(
          normalizeLegacyKey,
        ) as KeyName[],
        mode: ItoMode.TRANSCRIBE,
      },
      {
        id: crypto.randomUUID(),
        keys: ITO_MODE_SHORTCUT_DEFAULTS[ItoMode.EDIT].map(
          normalizeLegacyKey,
        ) as KeyName[],
        mode: ItoMode.EDIT,
      },
    ],
    firstName: '',
    lastName: '',
    email: '',
  },
  main: { navExpanded: true },
  auth: { user: null, tokens: null, state: createNewAuthState() },
  advancedSettings: {
    grammarServiceEnabled: false,
    macosAccessibilityContextEnabled: false,
    llm: {
      asrProvider: null,
      asrModel: null,
      asrPrompt: null,
      llmProvider: null,
      llmTemperature: null,
      llmModel: null,
      transcriptionPrompt: null,
      editingPrompt: null,
      noSpeechThreshold: null,
      asrApiKey: null,
      llmApiKey: null,
    },
  },
  openMic: false,
  selectedAudioInput: null,
  interactionSounds: false,
  userProfile: null,
  idToken: null,
  accessToken: null,
  appliedMigrations: [],
}

// Initialize electron-store
const electronStore = new Store<AppStore>({
  defaults: defaultValues,
})

export const store = {
  get: (key: string) => electronStore.get(key),
  set: (key: string, value: any) => electronStore.set(key, value),
  delete: (key: string) => electronStore.delete(key as any),
  // Direct access if needed, properly typed
  internal: electronStore,
}

export const getCurrentUserId = (): string | undefined => {
  const user = store.get(STORE_KEYS.USER_PROFILE) as any
  return user?.id
}

export const getAdvancedSettings = (): AdvancedSettings => {
  const storeSettings = store.get(
    STORE_KEYS.ADVANCED_SETTINGS,
  ) as AdvancedSettings
  return { ...storeSettings }
}

// Lightweight store-like interface used for migrations and defaults logic
type StoreLike = {
  get: (path: string) => any
  set: (path: string, value: any) => void
}

type Migration = { id: string; run: (s: StoreLike<AppStore>) => void }

const migrations: Migration[] = [
  {
    id: '2025-08-15-keyboard-shortcut-rename',
    run: s => {
      const settings: any = s.get('settings') || {}
      const legacy = settings.keyboardShortcut
      const hasLegacy = Array.isArray(legacy) && legacy.length > 0
      const hasNew =
        Array.isArray(settings.keyboardShortcuts) &&
        settings.keyboardShortcuts.length > 0

      if (!hasNew && hasLegacy) {
        s.set('settings.keyboardShortcuts', [
          {
            id: crypto.randomUUID(),
            keys: legacy,
            mode: ItoMode.TRANSCRIBE,
          },
        ])
      }
      if ('keyboardShortcut' in settings) {
        delete settings.keyboardShortcut
        s.set('settings', settings)
      }
    },
  },
]

// ---------- Migration runner ----------
function runMigrations(s: StoreLike<AppStore>, allMigrations: Migration[]) {
  const applied = new Set((s.get('appliedMigrations') as string[]) || [])
  for (const m of allMigrations) {
    if (!applied.has(m.id)) {
      console.log(`[migrations] Running: ${m.id}`)
      try {
        m.run(s)
        applied.add(m.id)
      } catch (err) {
        console.error(`[migrations] Failed: ${m.id}`, err)
      }
    }
  }
  s.set('appliedMigrations', Array.from(applied))
}

export async function initializeStore() {
  // Run migrations (idempotent) unless tests explicitly skip
  if (process.env.NODE_ENV !== 'test') {
    runMigrations(store, migrations)
  }
}

export default store
