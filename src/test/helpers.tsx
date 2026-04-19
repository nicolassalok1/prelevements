import type { ReactElement, ReactNode } from 'react'
import { render } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18n from '../i18n'
import { useAppStore } from '../store/useAppStore'

// ── Store reset ────────────────────────────────────────────────

const INITIAL_STORE_DATA = {
  exploitPolygon: null, exploitArea: 0, exploitLayer: null, exploitLabel: null, exploitContourHidden: true,
  fields: [], fieldIdCounter: 0, selectedFieldId: null,
  champs: [], champIdCounter: 0, selectedChampId: null,
  drawTarget: null, editTarget: null, addPointFieldId: null, drawForChampId: null,
  generationMethod: 'grid' as const, density: 1,
  userLocation: null, geolocationActive: false, geolocationError: null,
  employees: [], employeeIdCounter: 0, strains: [],
  wateringLog: [], wateringIdCounter: 0,
  amendmentLog: [], amendmentIdCounter: 0,
  soilAnalyses: [], soilAnalysisIdCounter: 0,
  agendaTasks: [], agendaIdCounter: 0,
  activities: [], activityIdCounter: 0,
  currentStep: 1, toastMessage: null, toastError: false,
  statusText: 'EN ATTENTE', helpOpen: false, dashboardOpen: false, dashboardTab: 'overview' as const,
  fieldDetailOpen: false, fieldDetailTab: 'info' as const,
  sidebarOpen: false, mobileRightOpen: false,
  calendarOpen: false, activityFormOpen: false, activityFormDate: null, activityFormEditId: null,
  activityFormPresetType: null, activityFormPresetFieldId: null,
}

export function resetStore() {
  useAppStore.setState(INITIAL_STORE_DATA)
}

// ── Render helper with i18n provider ───────────────────────────

export function renderWithI18n(ui: ReactElement) {
  return render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>)
}

// ── Auth context mock ─────────────────────────────────────────
// A test-friendly AuthProvider that exposes user-controllable
// signIn / signUp / resetPassword / signOut stubs.

import { AuthContext } from '../contexts/AuthContext'
import type { User, Session } from '@supabase/supabase-js'

export interface FakeAuth {
  user: User | null
  session: Session | null
  loading: boolean
  signIn: ReturnType<typeof vi.fn>
  signUp: ReturnType<typeof vi.fn>
  signOut: ReturnType<typeof vi.fn>
  resetPassword: ReturnType<typeof vi.fn>
}

import { vi } from 'vitest'

export function buildFakeAuth(overrides: Partial<FakeAuth> = {}): FakeAuth {
  return {
    user: null,
    session: null,
    loading: false,
    signIn: vi.fn().mockResolvedValue({ error: null }),
    signUp: vi.fn().mockResolvedValue({ error: null }),
    signOut: vi.fn().mockResolvedValue(undefined),
    resetPassword: vi.fn().mockResolvedValue({ error: null }),
    ...overrides,
  }
}

export function renderWithProviders(ui: ReactElement, opts: { auth?: FakeAuth } = {}) {
  const auth = opts.auth ?? buildFakeAuth()
  const wrapped: ReactNode = (
    <I18nextProvider i18n={i18n}>
      <AuthContext.Provider value={auth}>{ui}</AuthContext.Provider>
    </I18nextProvider>
  )
  return { ...render(wrapped), auth }
}
