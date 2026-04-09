/**
 * 3D terrain visualization for a single field.
 *
 * Renders an interactive surface mesh built from a dense elevation grid
 * fetched via Open-Meteo DEM. The user can rotate (drag), zoom (wheel)
 * and pan (right-drag) the scene via OrbitControls.
 *
 * Architecture notes:
 *   • Three.js is used directly (not @react-three/fiber) to keep bundle
 *     size in check and avoid a reconciler layer we don't need for a
 *     single static mesh.
 *   • The Three.js scene is created once on mount and disposed on
 *     unmount. Data changes (new grid) rebuild only the mesh geometry,
 *     not the renderer/camera/controls.
 *   • Vertex Z values are rescaled: flat plots get a visible bump via
 *     a min relief exaggeration, while tall plots are clamped so the
 *     camera doesn't need a huge frustum.
 */

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { useAppStore } from '../store/useAppStore'
import { smoothGrid } from '../utils/terrain'
import { fetchFieldElevationGrid, adaptiveGridSize } from '../utils/terrain-auto'
import type { FieldElevationGrid } from '../utils/terrain-auto'
import type { Field, LatLng } from '../types'

// ═══════════════════════════════════════════════════════════════════════
//  RENDER RESOLUTION
// ═══════════════════════════════════════════════════════════════════════

/**
 * How many render vertices per DEM grid cell. A value of 4 means each
 * cell becomes a 4×4 block of fine vertices. Combined with Gaussian
 * pre-smoothing of the DEM, this gives a continuous professional-looking
 * surface even on low-relief plots where DEM quantization (~1 m steps)
 * would otherwise create visible stair-step artifacts.
 */
const RENDER_SUBDIVISION = 4

/**
 * Gaussian blur σ (in DEM cells) applied to the elevation values before
 * the mesh is built. σ = 1 is a gentle smoothing that kills DEM
 * quantization noise without erasing real topographic features.
 */
const SMOOTHING_SIGMA = 1

// ═══════════════════════════════════════════════════════════════════════
//  COLOR RAMP
// ═══════════════════════════════════════════════════════════════════════

/**
 * Map a 0-1 altitude ratio to a colour along a terrain gradient:
 * low = deep cyan → mid = olive-green → high = amber → peak = red.
 * Stays within the app's existing dark-olive palette.
 */
function terrainColor(t: number): THREE.Color {
  const ct = Math.max(0, Math.min(1, t))
  // 4-stop gradient (RGB values in 0-1)
  const stops: Array<[number, [number, number, number]]> = [
    [0.0, [0.10, 0.35, 0.45]], // deep teal
    [0.35, [0.56, 0.66, 0.31]], // olive-lit
    [0.70, [0.90, 0.66, 0.09]], // amber
    [1.0, [0.81, 0.29, 0.29]], // red
  ]
  for (let i = 0; i < stops.length - 1; i++) {
    const [t0, c0] = stops[i]
    const [t1, c1] = stops[i + 1]
    if (ct >= t0 && ct <= t1) {
      const k = (ct - t0) / (t1 - t0)
      return new THREE.Color(
        c0[0] + (c1[0] - c0[0]) * k,
        c0[1] + (c1[1] - c0[1]) * k,
        c0[2] + (c1[2] - c0[2]) * k,
      )
    }
  }
  return new THREE.Color(stops[stops.length - 1][1][0], stops[stops.length - 1][1][1], stops[stops.length - 1][1][2])
}

// ═══════════════════════════════════════════════════════════════════════
//  SCENE BUILDERS
// ═══════════════════════════════════════════════════════════════════════

interface SceneRefs {
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  controls: OrbitControls
  surfaceMesh?: THREE.Mesh
  outlineLine?: THREE.Line
  disposables: Array<() => void>
  cleanup: () => void
}

/** Create the Three.js scene, camera, lights and controls. */
function createScene(container: HTMLDivElement): SceneRefs {
  const width = container.clientWidth
  const height = container.clientHeight

  const renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(width, height)
  renderer.setClearColor(0x0d1117, 1)
  container.appendChild(renderer.domElement)

  const scene = new THREE.Scene()

  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 10000)
  camera.position.set(0, 1.4, 1.8)

  scene.add(new THREE.AmbientLight(0xffffff, 0.6))
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8)
  dirLight.position.set(2, 3, 2)
  scene.add(dirLight)

  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.1
  controls.minDistance = 0.2
  controls.maxDistance = 10

  // Render loop
  let animId = 0
  const tick = () => {
    controls.update()
    renderer.render(scene, camera)
    animId = requestAnimationFrame(tick)
  }
  animId = requestAnimationFrame(tick)

  // Resize handler
  const onResize = () => {
    if (!container.clientWidth || !container.clientHeight) return
    camera.aspect = container.clientWidth / container.clientHeight
    camera.updateProjectionMatrix()
    renderer.setSize(container.clientWidth, container.clientHeight)
  }
  const resizeObserver = new ResizeObserver(onResize)
  resizeObserver.observe(container)

  const disposables: Array<() => void> = []

  const cleanup = () => {
    cancelAnimationFrame(animId)
    resizeObserver.disconnect()
    controls.dispose()
    disposables.forEach((d) => d())
    renderer.dispose()
    if (renderer.domElement.parentNode) {
      renderer.domElement.parentNode.removeChild(renderer.domElement)
    }
  }

  return { renderer, scene, camera, controls, disposables, cleanup }
}

/**
 * Build (or rebuild) the surface mesh + polygon outline from an elevation
 * grid. The normalized coordinate system fits the whole terrain inside
 * a [-1, 1] box on X/Z, with Y as exaggerated altitude.
 */
function buildTerrainGeometry(
  refs: SceneRefs,
  grid: FieldElevationGrid,
  polygon: LatLng[],
) {
  // Remove previous mesh/outline if any.
  if (refs.surfaceMesh) {
    refs.scene.remove(refs.surfaceMesh)
    refs.surfaceMesh.geometry.dispose()
    ;(refs.surfaceMesh.material as THREE.Material).dispose()
    refs.surfaceMesh = undefined
  }
  if (refs.outlineLine) {
    refs.scene.remove(refs.outlineLine)
    refs.outlineLine.geometry.dispose()
    ;(refs.outlineLine.material as THREE.Material).dispose()
    refs.outlineLine = undefined
  }

  const { width, height, inside, bboxWidthM, bboxHeightM } = grid

  // Smooth the raw DEM values to remove quantization "stair-steps" that
  // are especially visible on low-relief fields. σ=1 cells is a gentle
  // 5-tap Gaussian that removes noise without erasing real features.
  const elevations = smoothGrid(grid.elevations, width, height, SMOOTHING_SIGMA)

  // Recompute min/max from the smoothed values so the color ramp and
  // y-scale are consistent with what's actually rendered.
  let altMin = Infinity
  let altMax = -Infinity
  for (const z of elevations) {
    if (z < altMin) altMin = z
    if (z > altMax) altMax = z
  }

  // Normalize the plan view to a [-1, 1] square preserving aspect ratio.
  const maxSide = Math.max(bboxWidthM, bboxHeightM)
  const halfX = bboxWidthM / maxSide
  const halfZ = bboxHeightM / maxSide

  // Altitude exaggeration: pick a factor so that relief is always at
  // least 10% of the horizontal span visible. Flat plots get a bigger
  // exaggeration, steep plots get a smaller (but never compressed) one.
  const reliefRange = Math.max(1, altMax - altMin)
  const targetY = 0.3 // ~30% of the box half-side
  const yScale = (targetY * maxSide) / reliefRange / maxSide // → normalized units

  // ── Bilinear sampling helpers over the coarse DEM grid ──
  const sampleZ = (fi: number, fj: number): number => {
    const i0 = Math.max(0, Math.min(width - 1, Math.floor(fi)))
    const j0 = Math.max(0, Math.min(height - 1, Math.floor(fj)))
    const i1 = Math.min(width - 1, i0 + 1)
    const j1 = Math.min(height - 1, j0 + 1)
    const di = fi - i0, dj = fj - j0
    const z00 = elevations[j0 * width + i0]
    const z10 = elevations[j0 * width + i1]
    const z01 = elevations[j1 * width + i0]
    const z11 = elevations[j1 * width + i1]
    const zTop = z00 * (1 - di) + z10 * di
    const zBot = z01 * (1 - di) + z11 * di
    return zTop * (1 - dj) + zBot * dj
  }
  const sampleInside = (fi: number, fj: number): boolean => {
    // Nearest-neighbor for the boolean mask — bilinear doesn't apply.
    const i = Math.max(0, Math.min(width - 1, Math.round(fi)))
    const j = Math.max(0, Math.min(height - 1, Math.round(fj)))
    return inside[j * width + i]
  }

  // Build a denser render mesh via client-side bilinear subdivision.
  // The DEM resolution is ~30 m so fetching more points doesn't give new
  // information — we just need more vertices to avoid visible facets.
  const renderW = Math.max(width, (width - 1) * RENDER_SUBDIVISION + 1)
  const renderH = Math.max(height, (height - 1) * RENDER_SUBDIVISION + 1)

  const geo = new THREE.PlaneGeometry(halfX * 2, halfZ * 2, renderW - 1, renderH - 1)
  // PlaneGeometry is XY aligned by default; we want XZ (horizontal plane).
  geo.rotateX(-Math.PI / 2)

  // Override Y on each vertex using the bilinear sample from the coarse grid.
  // PlaneGeometry vertex order matches row-major (j * renderW + i).
  const positions = geo.attributes.position as THREE.BufferAttribute
  const colors = new Float32Array(positions.count * 3)
  for (let j = 0; j < renderH; j++) {
    const fj = renderH === 1 ? 0 : (j / (renderH - 1)) * (height - 1)
    for (let i = 0; i < renderW; i++) {
      const fi = renderW === 1 ? 0 : (i / (renderW - 1)) * (width - 1)
      const k = j * renderW + i
      const z = sampleZ(fi, fj)
      positions.setY(k, (z - altMin) * yScale)

      const t = reliefRange > 0 ? (z - altMin) / reliefRange : 0.5
      const c = terrainColor(t)
      if (!sampleInside(fi, fj)) c.multiplyScalar(0.35)
      colors[k * 3 + 0] = c.r
      colors[k * 3 + 1] = c.g
      colors[k * 3 + 2] = c.b
    }
  }
  positions.needsUpdate = true
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geo.computeVertexNormals()

  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    side: THREE.DoubleSide,
    roughness: 0.85,
    metalness: 0.0,
    flatShading: false,
  })
  const mesh = new THREE.Mesh(geo, material)
  refs.scene.add(mesh)
  refs.surfaceMesh = mesh

  // ── Polygon outline overlay ──
  // Project each polygon vertex into the same normalized coordinate system
  // and sample the grid for its altitude (bilinear interpolation).
  const lats = polygon.map((p) => p.lat)
  const lngs = polygon.map((p) => p.lng)
  const south = Math.min(...lats)
  const north = Math.max(...lats)
  const west = Math.min(...lngs)
  const east = Math.max(...lngs)
  const outlinePts: THREE.Vector3[] = []
  for (const p of polygon) {
    const u = (p.lng - west) / Math.max(1e-9, east - west)   // 0..1 east-west
    const v = (p.lat - south) / Math.max(1e-9, north - south) // 0..1 south-north
    const x = (u * 2 - 1) * halfX
    const zCoord = -(v * 2 - 1) * halfZ // invert because plane was rotated
    // Bilinear altitude sample
    const fi = u * (width - 1)
    const fj = v * (height - 1)
    const i0 = Math.floor(fi), j0 = Math.floor(fj)
    const i1 = Math.min(width - 1, i0 + 1), j1 = Math.min(height - 1, j0 + 1)
    const di = fi - i0, dj = fj - j0
    const z00 = elevations[j0 * width + i0]
    const z10 = elevations[j0 * width + i1]
    const z01 = elevations[j1 * width + i0]
    const z11 = elevations[j1 * width + i1]
    const zTop = z00 * (1 - di) + z10 * di
    const zBot = z01 * (1 - di) + z11 * di
    const zHere = zTop * (1 - dj) + zBot * dj
    const y = (zHere - altMin) * yScale + 0.003 // tiny offset so the line is above the mesh
    outlinePts.push(new THREE.Vector3(x, y, zCoord))
  }
  // Close the loop
  if (outlinePts.length > 0) outlinePts.push(outlinePts[0].clone())

  const outlineGeo = new THREE.BufferGeometry().setFromPoints(outlinePts)
  const outlineMat = new THREE.LineBasicMaterial({ color: 0x4fa8a0, linewidth: 2 })
  const line = new THREE.Line(outlineGeo, outlineMat)
  refs.scene.add(line)
  refs.outlineLine = line

  // Fit camera to the new scene
  refs.camera.position.set(halfX * 1.8, 1.3, halfZ * 1.8 + 0.5)
  refs.controls.target.set(0, 0.15, 0)
  refs.controls.update()
}

// ═══════════════════════════════════════════════════════════════════════
//  REACT COMPONENT
// ═══════════════════════════════════════════════════════════════════════

interface Terrain3DViewProps {
  field: Field
  onClose: () => void
}

export function Terrain3DView({ field, onClose }: Terrain3DViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const refsRef = useRef<SceneRefs | null>(null)
  const [grid, setGrid] = useState<FieldElevationGrid | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const toast = useAppStore((s) => s.toast)

  const gridSize = adaptiveGridSize(field.area)
  const totalPoints = gridSize * gridSize

  // Fetch elevation grid once per field.
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setGrid(null)
    fetchFieldElevationGrid(field)
      .then((g) => {
        if (cancelled) return
        setGrid(g)
        setLoading(false)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        const msg = e instanceof Error ? e.message : 'Erreur inconnue'
        setError(msg)
        setLoading(false)
        toast(`⚠ ${msg}`, true)
      })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [field.id])

  // Mount Three.js scene once.
  useEffect(() => {
    if (!containerRef.current) return
    const refs = createScene(containerRef.current)
    refsRef.current = refs
    return () => {
      refs.cleanup()
      refsRef.current = null
    }
  }, [])

  // Rebuild geometry whenever the grid changes.
  useEffect(() => {
    if (!grid || !refsRef.current) return
    buildTerrainGeometry(refsRef.current, grid, field.latlngs)
  }, [grid, field.latlngs])

  return (
    <div className="border border-border bg-bg">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <span className="font-mono text-[10px] text-cyan tracking-[1px] uppercase flex-1">
          ▲ Vue 3D du terrain
        </span>
        <span className="font-mono text-[9px] text-muted" title={`Grille DEM fetchée: ${gridSize}×${gridSize} = ${totalPoints} pts · Mesh rendu: ${(gridSize - 1) * RENDER_SUBDIVISION + 1}²`}>
          {gridSize}×{gridSize} DEM
        </span>
        <button
          onClick={onClose}
          className="text-muted hover:text-red bg-transparent border-none cursor-pointer text-xs"
          title="Fermer la vue 3D"
        >
          ✕
        </button>
      </div>

      {/* Canvas */}
      <div className="relative" style={{ height: 320 }}>
        <div ref={containerRef} className="absolute inset-0" />
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-bg/70">
            <div className="flex flex-col items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-cyan animate-pulse" />
              <span className="font-mono text-[10px] text-cyan">
                Récupération de la grille d'altitude…
              </span>
              <span className="font-mono text-[9px] text-muted">
                {totalPoints} points · ~{Math.ceil(totalPoints / 100)} requêtes
              </span>
            </div>
          </div>
        )}
        {error && !loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="font-mono text-[10px] text-red text-center px-4">
              ⚠ {error}
            </div>
          </div>
        )}
      </div>

      {/* Legend + tips */}
      {grid && !loading && (
        <div className="px-3 py-2 border-t border-border flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[9px] text-muted uppercase">Alt</span>
            <div
              className="h-2 w-20 border border-border"
              style={{
                background:
                  'linear-gradient(to right, rgb(26,89,115) 0%, rgb(143,168,79) 35%, rgb(230,168,23) 70%, rgb(207,74,74) 100%)',
              }}
            />
            <span className="font-mono text-[9px] text-muted">
              {Math.round(grid.altMin)}m → {Math.round(grid.altMax)}m
            </span>
          </div>
          <span className="font-mono text-[9px] text-muted ml-auto">
            glisser = rotation · molette = zoom · clic droit = déplacer
          </span>
        </div>
      )}
    </div>
  )
}
