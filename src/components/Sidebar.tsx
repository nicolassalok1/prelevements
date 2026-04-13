import { useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { useAuth } from '../contexts/AuthContext'
import { clearStorage } from '../utils/persistence'
import { StepIndicator } from './StepIndicator'
import { exportProject, parseProjectFile } from '../utils/exporters'
import { saveToCloudImmediate, buildPersistedData } from '../utils/persistence'
import { calcArea } from '../utils/geometry'
import { cacheTilesForBounds, estimateTileCount } from '../utils/offline'
import type { LatLng } from '../types'

export function Sidebar() {
  const store = useAppStore()

  const totalPoints = store.fields.reduce((s, f) => s + f.points.length, 0)

  // Download all user data as a single JSON file.
  const handleSave = () => {
    const ok = exportProject(buildPersistedData(store))
    if (ok) store.toast('✓ Sauvegarde téléchargée')
    else store.toast('⚠ Rien à sauvegarder', true)
  }

  // Replace the entire local database with the content of an uploaded JSON file.
  const handleLoad = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) return
      const hasExistingData =
        store.exploitPolygon != null ||
        store.fields.length > 0 ||
        store.activities.length > 0 ||
        store.employees.length > 0
      if (hasExistingData && !window.confirm(
        'Charger ce fichier va remplacer TOUTES vos données actuelles\n' +
        '(zones, points, activités, employés, historiques…).\n\nContinuer ?'
      )) return

      const reader = new FileReader()
      reader.onload = async () => {
        const data = parseProjectFile(reader.result as string)
        if (!data) { store.toast('⚠ Fichier invalide', true); return }
        // Write to localStorage + cloud (immediate, no debounce), then reload.
        const result = await saveToCloudImmediate(data)
        if (!result.ok) {
          store.toast(`⚠ Erreur sauvegarde cloud: ${result.error}`, true)
          return
        }
        window.location.reload()
      }
      reader.onerror = () => store.toast('⚠ Impossible de lire le fichier', true)
      reader.readAsText(file)
    }
    input.click()
  }

  const handleClearAll = () => {
    if (store.exploitLayer) { store.exploitLayer.remove(); store.exploitLabel?.remove() }
    store.fields.forEach((f) => { f.layer?.remove(); f.labelMarker?.remove(); f.pointMarkers.forEach((m) => m.remove()) })
    store.clearAll()
    store.toast('Carte réinitialisée')
  }

  return (
    <aside className="bg-panel border-r border-border flex flex-col h-full w-full overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-border scrollbar-track-bg">

      {/* Offline / Terrain mode */}
      {store.exploitPolygon && <OfflineSection />}

      {/* Step indicator */}
      <Section>
        <StepIndicator />
      </Section>

      {/* Step 1: Exploitation */}
      <Section>
        <SectionTitle>Zone exploitation</SectionTitle>
        {!store.exploitPolygon ? (
          <button
            className={`btn-full ${store.drawTarget === 'exploit' ? 'btn-danger' : 'btn-cyan'}`}
            onClick={() => {
              if (store.drawTarget === 'exploit') { store.setDrawTarget(null); store.setStatus('EN ATTENTE') }
              else { store.setDrawTarget('exploit'); store.setStatus('DESSIN EXPLOITATION — cliquez les sommets'); store.setSidebarOpen(false) }
            }}
          >
            {store.drawTarget === 'exploit' ? '■ Annuler' : '◈ Dessiner l\'exploitation'}
          </button>
        ) : (
          <div className="bg-bg border border-border p-2 font-mono text-[11px] text-text">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-cyan shrink-0" />
              <span className="flex-1">
                Exploitation — <span className="text-cyan">{store.exploitArea.toFixed(2)} ha</span>
              </span>
            </div>
            <div className="flex gap-1 mt-1.5">
              {store.editTarget?.type === 'exploit' ? (
                <button className="btn-sm btn-active flex-1" onClick={() => {
                  // Save edited polygon
                  if (store.exploitLayer) {
                    const raw = store.exploitLayer.getLatLngs()[0] as L.LatLng[]
                    const polygon: LatLng[] = raw.map((ll) => ({ lat: ll.lat, lng: ll.lng }))
                    const area = calcArea(polygon) / 10000
                    store.updateExploitPolygon(polygon, area)
                    // Update label position
                    if (store.exploitLabel) {
                      store.exploitLabel.setLatLng(store.exploitLayer.getBounds().getCenter())
                    }
                  }
                  store.setEditTarget(null)
                  store.toast('✓ Exploitation mise à jour')
                }}>✓ Valider</button>
              ) : (
                <button className="btn-sm btn-cyan flex-1" onClick={() => { store.setEditTarget({ type: 'exploit' }); store.setSidebarOpen(false) }}>✎ Modifier contour</button>
              )}
              {store.editTarget?.type === 'exploit' && (
                <button className="btn-sm btn-danger" onClick={() => {
                  // Cancel: restore original polygon
                  if (store.exploitLayer && store.exploitPolygon) {
                    store.exploitLayer.setLatLngs(store.exploitPolygon.map((ll) => [ll.lat, ll.lng]))
                  }
                  store.setEditTarget(null)
                }}>Annuler</button>
              )}
            </div>
            {!store.editTarget && (
              <button
                className="btn-sm btn-active w-full mt-1.5"
                onClick={() => store.setExploitContourHidden(!store.exploitContourHidden)}
                title="Masquer ou afficher le contour de l'exploitation sur la carte"
              >
                {store.exploitContourHidden ? '◉ Afficher le contour' : '◎ Masquer le contour'}
              </button>
            )}
          </div>
        )}
      </Section>

      {/* Step 2: Fields */}
      {store.exploitPolygon && (
        <Section>
          <SectionTitle>Ajouter une parcelle</SectionTitle>
          <div className="flex gap-1.5 mb-1.5">
            <input id="field-name-input" type="text" placeholder="Nom de la parcelle"
              className="flex-1 font-mono text-xs bg-bg border border-border text-text py-1.5 px-2.5 outline-none focus:border-olive-lit placeholder:text-muted" />
          </div>
          <button
            className={`btn-full ${store.drawTarget === 'field' ? 'btn-danger' : 'btn-active'}`}
            onClick={() => {
              if (store.drawTarget === 'field') { store.setDrawTarget(null); store.setStatus('EN ATTENTE') }
              else {
                const input = document.getElementById('field-name-input') as HTMLInputElement
                if (!input.value.trim()) { store.toast('⚠ Saisissez un nom', true); input.focus(); return }
                store.setDrawTarget('field'); store.setStatus('DESSIN PARCELLE — cliquez les sommets'); store.setSidebarOpen(false)
              }
            }}
          >
            {store.drawTarget === 'field' ? '■ Annuler' : '▭ Dessiner la parcelle'}
          </button>
        </Section>
      )}

      {/* Stats compact */}
      <Section>
        <div className="grid grid-cols-3 gap-1.5">
          <StatBox label="Exploit." value={store.exploitArea > 0 ? store.exploitArea.toFixed(1) : '—'} unit="ha" />
          <StatBox label="Champs" value={String(store.fields.length)} unit="zones" />
          <StatBox label="Points" value={String(totalPoints)} unit="pts" />
        </div>
      </Section>

      {/* Save / Load / Clear */}
      <Section>
        <SectionTitle>Sauvegarde</SectionTitle>
        <div className="flex gap-1 mb-1">
          <button className="btn-cyan flex-1 text-[10px] py-1" onClick={handleSave}>↓ Sauvegarder</button>
          <button className="btn-active flex-1 text-[10px] py-1" onClick={handleLoad}>↑ Charger</button>
        </div>
        <button className="btn-danger w-full text-[10px] py-1 mt-0.5" onClick={() => {
          if (window.confirm('Êtes-vous sûr de vouloir tout effacer ?\nCette action est irréversible.')) handleClearAll()
        }}>✕ Tout effacer</button>
      </Section>

      <DeleteAccountSection />

    </aside>
  )
}

function OfflineSection() {
  const store = useAppStore()
  const [caching, setCaching] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })

  const handleCacheTiles = async () => {
    if (!store.exploitPolygon) return
    const lats = store.exploitPolygon.map((p) => p.lat)
    const lngs = store.exploitPolygon.map((p) => p.lng)
    const bounds = {
      south: Math.min(...lats) - 0.002,
      north: Math.max(...lats) + 0.002,
      west: Math.min(...lngs) - 0.002,
      east: Math.max(...lngs) + 0.002,
    }

    const count = estimateTileCount(bounds, 14, 19)
    if (!window.confirm(`Télécharger ~${count} tuiles satellite pour le mode terrain ?\nCela peut prendre quelques minutes.`)) return

    setCaching(true)
    setProgress({ done: 0, total: count })

    await cacheTilesForBounds(bounds, 14, 19, (done, total) => {
      setProgress({ done, total })
    })

    setCaching(false)
    store.toast(`✓ ${count} tuiles en cache — mode terrain prêt`)
  }

  const tileCount = store.exploitPolygon
    ? estimateTileCount({
        south: Math.min(...store.exploitPolygon.map((p) => p.lat)) - 0.002,
        north: Math.max(...store.exploitPolygon.map((p) => p.lat)) + 0.002,
        west: Math.min(...store.exploitPolygon.map((p) => p.lng)) - 0.002,
        east: Math.max(...store.exploitPolygon.map((p) => p.lng)) + 0.002,
      }, 14, 19)
    : 0

  return (
    <div className="p-3 px-4 border-b border-border">
      <div className="font-mono text-[10px] text-amber tracking-[2px] mb-2 flex items-center gap-1.5 before:content-[''] before:w-3 before:h-px before:bg-amber uppercase">
        Mode terrain
      </div>
      <p className="text-[10px] text-muted mb-2 leading-relaxed">
        Téléchargez la carte satellite de votre exploitation pour travailler sans connexion dans les champs.
      </p>
      {caching ? (
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="flex-1 h-1.5 bg-bg border border-border">
              <div className="h-full bg-amber transition-all" style={{ width: `${progress.total ? (progress.done / progress.total * 100) : 0}%` }} />
            </div>
            <span className="font-mono text-[10px] text-amber">{progress.done}/{progress.total}</span>
          </div>
          <p className="font-mono text-[9px] text-muted">Téléchargement en cours...</p>
        </div>
      ) : (
        <button className="w-full py-1.5 bg-amber/10 border border-amber text-amber font-semibold text-[11px] tracking-[1px] uppercase cursor-pointer hover:bg-amber hover:text-black transition-all"
          onClick={handleCacheTiles}>
          ↓ Préparer mode terrain (~{tileCount} tuiles)
        </button>
      )}
    </div>
  )
}

function DeleteAccountSection() {
  const { user, signOut } = useAuth()
  const [showConfirm, setShowConfirm] = useState(false)
  const [confirmText, setConfirmText] = useState('')

  if (!user) return null

  const handleDelete = async () => {
    if (confirmText !== 'SUPPRIMER') return
    try {
      const { supabase } = await import('../lib/supabase')
      if (supabase) {
        // Supprimer les données utilisateur (RLS autorise)
        await supabase.from('user_data').delete().eq('user_id', user.id)
        // Supprimer le compte auth via Edge Function
        const { error } = await supabase.functions.invoke('delete-user')
        if (error) console.warn('Edge function delete-user failed:', error.message)
      }
      clearStorage()
      useAppStore.getState().clearAll()
      useAppStore.getState().toast('✓ Compte et données supprimés')
      signOut()
    } catch (err) {
      console.error('Suppression échouée:', err)
      useAppStore.getState().toast(`⚠ Suppression échouée: ${(err as Error).message}`, true)
    }
  }

  return (
    <div className="mt-auto p-3 px-4 border-t border-red/30">
      {!showConfirm ? (
        <button onClick={() => setShowConfirm(true)}
          className="w-full py-1.5 font-mono text-[9px] text-muted border border-border hover:border-red hover:text-red cursor-pointer transition-all bg-transparent uppercase tracking-[1px]">
          Supprimer mon compte
        </button>
      ) : (
        <div className="space-y-2">
          <div className="font-mono text-[10px] text-red font-bold uppercase">Suppression définitive</div>
          <p className="font-mono text-[9px] text-muted leading-relaxed">
            Toutes vos données seront supprimées de façon irréversible : parcelles, champs, serres, activités, mesures.
          </p>
          <p className="font-mono text-[9px] text-red">Tapez <span className="font-bold">SUPPRIMER</span> pour confirmer :</p>
          <input type="text" value={confirmText} onChange={(e) => setConfirmText(e.target.value)}
            placeholder="SUPPRIMER"
            className="w-full font-mono text-xs bg-bg border border-red/40 text-red py-1.5 px-2 outline-none focus:border-red placeholder:text-red/30" />
          <div className="flex gap-1">
            <button className="flex-1 btn-danger text-[10px]" disabled={confirmText !== 'SUPPRIMER'} onClick={handleDelete}
              style={{ opacity: confirmText === 'SUPPRIMER' ? 1 : 0.3 }}>
              Supprimer définitivement
            </button>
            <button className="btn-sm text-[10px] border border-border text-muted bg-transparent cursor-pointer hover:text-text"
              onClick={() => { setShowConfirm(false); setConfirmText('') }}>Annuler</button>
          </div>
        </div>
      )}
    </div>
  )
}

function Section({ children }: { children: React.ReactNode }) {
  return <div className="p-3 px-4 border-b border-border">{children}</div>
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-mono text-[10px] text-olive-lit tracking-[2px] mb-2 flex items-center gap-1.5 before:content-[''] before:w-3 before:h-px before:bg-olive-lit uppercase">
      {children}
    </div>
  )
}

function StatBox({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="bg-bg border border-border p-1.5 px-2">
      <div className="text-[9px] text-muted tracking-[1px] uppercase">{label}</div>
      <div className="font-mono text-base text-olive-lit mt-0.5">{value}</div>
      <div className="text-[9px] text-muted">{unit}</div>
    </div>
  )
}
