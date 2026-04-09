import { create } from 'zustand'
import type { AppState } from '../types'
import { saveToStorage, buildPersistedData } from '../utils/persistence'

export const FIELD_COLORS = [
  '#8fa84f', '#e6a817', '#a84f6a', '#4f6aa8', '#a8854f',
  '#8a4fa8', '#4fa85e', '#cf4a4a', '#4a8fcf', '#cfcf4a',
]

function persist(state: AppState) {
  saveToStorage(buildPersistedData(state))
}

export const useAppStore = create<AppState>((set, get) => ({
  exploitPolygon: null, exploitArea: 0, exploitLayer: null, exploitLabel: null,
  fields: [], fieldIdCounter: 0, selectedFieldId: null,
  drawTarget: null, editTarget: null, addPointFieldId: null, generationMethod: 'grid', density: 1,
  userLocation: null, geolocationActive: false, geolocationError: null,
  employees: [], employeeIdCounter: 0, strains: [],
  wateringLog: [], wateringIdCounter: 0,
  amendmentLog: [], amendmentIdCounter: 0,
  soilAnalyses: [], soilAnalysisIdCounter: 0,
  agendaTasks: [], agendaIdCounter: 0,
  activities: [], activityIdCounter: 0,
  currentStep: 1, toastMessage: null, toastError: false,
  statusText: 'EN ATTENTE', helpOpen: false, dashboardOpen: false, dashboardTab: 'overview',
  fieldDetailOpen: false, fieldDetailTab: 'info',
  sidebarOpen: false,
  calendarOpen: false, activityFormOpen: false, activityFormDate: null, activityFormEditId: null,
  activityFormPresetType: null, activityFormPresetFieldId: null,

  // ── Exploitation ──
  setExploitation: (polygon, area, layer, label) => {
    set({ exploitPolygon: polygon, exploitArea: area, exploitLayer: layer, exploitLabel: label, currentStep: 2 })
    persist(get())
  },
  clearExploitation: () => {
    set({ exploitPolygon: null, exploitArea: 0, exploitLayer: null, exploitLabel: null, fields: [], fieldIdCounter: 0, selectedFieldId: null, currentStep: 1 })
    persist(get())
  },

  // ── Fields ──
  addField: (field) => {
    set((s) => ({ fields: [...s.fields, field], fieldIdCounter: field.id, selectedFieldId: field.id, currentStep: 3 }))
    persist(get())
  },
  removeField: (id) => {
    set((s) => {
      const remaining = s.fields.filter((f) => f.id !== id)
      return { fields: remaining, selectedFieldId: s.selectedFieldId === id ? (remaining[0]?.id ?? null) : s.selectedFieldId, currentStep: remaining.length === 0 ? 2 : 3 }
    })
    persist(get())
  },
  selectField: (id) => set({ selectedFieldId: id }),
  updateField: (id, updates) => {
    set((s) => ({ fields: s.fields.map((f) => f.id === id ? { ...f, ...updates } : f) }))
    persist(get())
  },
  setFieldPoints: (fieldId, points, markers) => {
    set((s) => ({ fields: s.fields.map((f) => f.id === fieldId ? { ...f, points, pointMarkers: markers } : f) }))
    persist(get())
  },
  archiveField: (id, reassignments) => {
    set((s) => {
      // Reassign activities before archiving (activities are duplicated on target fields,
      // original stays on archived zone)
      let activities = s.activities
      if (reassignments && reassignments.length) {
        activities = s.activities.map((a) => {
          const reassign = reassignments.find((r) => r.activityId === a.id)
          if (!reassign) return a
          const merged = Array.from(new Set([...a.fieldIds, ...reassign.targetFieldIds]))
          return { ...a, fieldIds: merged }
        })
      }
      return {
        activities,
        fields: s.fields.map((f) => f.id === id ? { ...f, archived: true, archivedAt: new Date().toISOString() } : f),
        selectedFieldId: s.selectedFieldId === id ? null : s.selectedFieldId,
      }
    })
    persist(get())
  },
  unarchiveField: (id) => {
    set((s) => ({ fields: s.fields.map((f) => f.id === id ? { ...f, archived: false, archivedAt: undefined } : f) }))
    persist(get())
  },
  setArchivedFieldVisible: (id, visible) => {
    set((s) => ({ fields: s.fields.map((f) => f.id === id ? { ...f, archivedVisible: visible } : f) }))
    persist(get())
  },

  removePoint: (fieldId, pointIndex) => {
    set((s) => ({
      fields: s.fields.map((f) => {
        if (f.id !== fieldId) return f
        const newPoints = [...f.points]; newPoints.splice(pointIndex, 1)
        const newMarkers = [...f.pointMarkers]; newMarkers.splice(pointIndex, 1)
        return { ...f, points: newPoints, pointMarkers: newMarkers }
      }),
    }))
    persist(get())
  },

  // ── Drawing / Config ──
  setDrawTarget: (target) => set({ drawTarget: target }),
  setEditTarget: (target) => set({ editTarget: target }),
  setAddPointFieldId: (fieldId) => set({ addPointFieldId: fieldId }),
  addManualPoint: (fieldId, point, marker) => {
    set((s) => ({
      fields: s.fields.map((f) => f.id === fieldId ? { ...f, points: [...f.points, point], pointMarkers: [...f.pointMarkers, marker] } : f),
    }))
    persist(get())
  },
  renamePoint: (fieldId, pointIndex, newLabel) => {
    set((s) => ({
      fields: s.fields.map((f) => {
        if (f.id !== fieldId) return f
        const newPoints = [...f.points]
        newPoints[pointIndex] = { ...newPoints[pointIndex], label: newLabel }
        return { ...f, points: newPoints }
      }),
    }))
    persist(get())
  },
  updateExploitPolygon: (polygon, area) => {
    set({ exploitPolygon: polygon, exploitArea: area })
    persist(get())
  },
  updateFieldPolygon: (fieldId, latlngs, area, perimeter) => {
    set((s) => ({ fields: s.fields.map((f) => f.id === fieldId ? { ...f, latlngs, area, perimeter } : f) }))
    persist(get())
  },
  setUserLocation: (loc) => set({ userLocation: loc }),
  setGeolocationActive: (active) => set({ geolocationActive: active }),
  setGeolocationError: (err) => set({ geolocationError: err }),
  setGenerationMethod: (method) => { set({ generationMethod: method }); persist(get()) },
  setDensity: (density) => { set({ density }); persist(get()) },

  // ── Personnel ──
  addEmployee: (emp) => {
    set((s) => ({ employees: [...s.employees, { ...emp, id: s.employeeIdCounter + 1 }], employeeIdCounter: s.employeeIdCounter + 1 }))
    persist(get())
  },
  updateEmployee: (id, updates) => {
    set((s) => ({ employees: s.employees.map((e) => e.id === id ? { ...e, ...updates } : e) }))
    persist(get())
  },
  removeEmployee: (id) => {
    set((s) => ({
      employees: s.employees.filter((e) => e.id !== id),
      fields: s.fields.map((f) => ({
        ...f, assignedEmployees: f.assignedEmployees.filter((eid) => eid !== id),
        assignedManager: f.assignedManager === id ? null : f.assignedManager,
      })),
    }))
    persist(get())
  },

  // ── Strains ──
  addStrain: (strain) => { set((s) => ({ strains: s.strains.includes(strain) ? s.strains : [...s.strains, strain] })); persist(get()) },
  removeStrain: (strain) => { set((s) => ({ strains: s.strains.filter((st) => st !== strain) })); persist(get()) },

  // ── Watering ──
  addWatering: (entry) => {
    set((s) => ({ wateringLog: [...s.wateringLog, { ...entry, id: s.wateringIdCounter + 1 }], wateringIdCounter: s.wateringIdCounter + 1 }))
    persist(get())
  },
  removeWatering: (id) => { set((s) => ({ wateringLog: s.wateringLog.filter((w) => w.id !== id) })); persist(get()) },

  // ── Amendments ──
  addAmendment: (entry) => {
    set((s) => ({ amendmentLog: [...s.amendmentLog, { ...entry, id: s.amendmentIdCounter + 1 }], amendmentIdCounter: s.amendmentIdCounter + 1 }))
    persist(get())
  },
  removeAmendment: (id) => { set((s) => ({ amendmentLog: s.amendmentLog.filter((a) => a.id !== id) })); persist(get()) },

  // ── Soil ──
  addSoilAnalysis: (entry) => {
    set((s) => ({ soilAnalyses: [...s.soilAnalyses, { ...entry, id: s.soilAnalysisIdCounter + 1 }], soilAnalysisIdCounter: s.soilAnalysisIdCounter + 1 }))
    persist(get())
  },
  removeSoilAnalysis: (id) => { set((s) => ({ soilAnalyses: s.soilAnalyses.filter((a) => a.id !== id) })); persist(get()) },

  // ── Agenda ──
  addAgendaTask: (task) => {
    set((s) => ({
      agendaTasks: [...s.agendaTasks, { ...task, id: s.agendaIdCounter + 1, createdAt: new Date().toISOString() }],
      agendaIdCounter: s.agendaIdCounter + 1,
    }))
    persist(get())
  },
  updateAgendaTask: (id, updates) => {
    set((s) => ({ agendaTasks: s.agendaTasks.map((t) => t.id === id ? { ...t, ...updates } : t) }))
    persist(get())
  },
  removeAgendaTask: (id) => {
    set((s) => ({ agendaTasks: s.agendaTasks.filter((t) => t.id !== id) }))
    persist(get())
  },

  // ── Activities ──
  addActivity: (activity) => {
    const s = get()
    const newId = s.activityIdCounter + 1
    set({
      activities: [...s.activities, { ...activity, id: newId, createdAt: new Date().toISOString() }],
      activityIdCounter: newId,
    })
    persist(get())
    return newId
  },
  updateActivity: (id, updates) => {
    set((s) => ({ activities: s.activities.map((a) => a.id === id ? { ...a, ...updates } : a) }))
    persist(get())
  },
  removeActivity: (id) => {
    set((s) => ({ activities: s.activities.filter((a) => a.id !== id) }))
    persist(get())
  },

  // ── UI ──
  toast: (message, error = false) => set({ toastMessage: message, toastError: error }),
  clearToast: () => set({ toastMessage: null, toastError: false }),
  setStatus: (text) => set({ statusText: text }),
  setHelpOpen: (open) => set({ helpOpen: open }),
  setDashboardOpen: (open) => set({ dashboardOpen: open }),
  setDashboardTab: (tab) => set({ dashboardTab: tab }),
  openFieldDetail: (fieldId, tab = 'info') => set({ selectedFieldId: fieldId, fieldDetailOpen: true, fieldDetailTab: tab }),
  closeFieldDetail: () => set({ fieldDetailOpen: false }),
  setFieldDetailTab: (tab) => set({ fieldDetailTab: tab }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setCalendarOpen: (open) => set({ calendarOpen: open }),
  openActivityForm: (opts = {}) => set({
    activityFormOpen: true,
    activityFormDate: opts.date ?? null,
    activityFormEditId: opts.editId ?? null,
    activityFormPresetType: opts.presetType ?? null,
    activityFormPresetFieldId: opts.presetFieldId ?? null,
  }),
  closeActivityForm: () => set({
    activityFormOpen: false, activityFormDate: null, activityFormEditId: null,
    activityFormPresetType: null, activityFormPresetFieldId: null,
  }),
  clearAll: () => {
    set((s) => ({
      exploitPolygon: null, exploitArea: 0, exploitLayer: null, exploitLabel: null,
      fields: [], fieldIdCounter: 0, selectedFieldId: null,
      drawTarget: null, currentStep: 1, statusText: 'EN ATTENTE',
      wateringLog: [], amendmentLog: [], soilAnalyses: [], agendaTasks: [], activities: [],
      activityIdCounter: 0,
      employees: s.employees, employeeIdCounter: s.employeeIdCounter, strains: s.strains,
    }))
    persist(get())
  },
}))
