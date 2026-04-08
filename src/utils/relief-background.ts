/**
 * Thin store-aware wrapper that fires a background relief auto-compute
 * for a given field and writes the result back into the app store.
 *
 * This is the ONLY layer that knows about both the Zustand store AND the
 * pure terrain pipeline. It enforces the "auto unless locked" policy:
 *
 *   • If the field has no relief yet, or its relief is flagged as
 *     `autoComputed: true`, we recompute and overwrite.
 *   • If the user has manually edited anything (flag cleared), we skip
 *     silently — manual values always win.
 *   • Network errors are silent (logged only) — the user can retry
 *     explicitly from the ReliefTab's manual button.
 */

import { useAppStore } from '../store/useAppStore'
import { computeFieldRelief } from './terrain-auto'

/**
 * Fire a background relief auto-compute for the given field id.
 * Returns the promise for callers that want to await it (tests mainly);
 * production callers should use `void triggerAutoReliefIfNeeded(id)`.
 */
export async function triggerAutoReliefIfNeeded(fieldId: number): Promise<void> {
  const store = useAppStore.getState()
  const field = store.fields.find((f) => f.id === fieldId)
  if (!field) return
  if (field.archived) return

  // Lock check: skip if the user has already manually edited relief.
  // (undefined relief is treated as "not yet computed" → go ahead).
  if (field.relief !== undefined && field.relief.autoComputed !== true) return

  try {
    const { relief, warnings } = await computeFieldRelief(field)

    // Re-read state — the field may have been removed, archived, or had
    // its relief manually edited while the network round-trip was in flight.
    const latest = useAppStore.getState().fields.find((f) => f.id === fieldId)
    if (!latest || latest.archived) return
    if (latest.relief !== undefined && latest.relief.autoComputed !== true) return

    useAppStore.getState().updateField(fieldId, { relief })
    if (warnings.length === 0) {
      useAppStore.getState().toast(`✓ Relief auto-calculé pour "${latest.name}"`)
    }
  } catch (e) {
    // Silent failure: the user can retry from the ReliefTab button.
    // We log a warning for devs but never toast, to avoid spamming errors
    // on field creation when the user might be offline.
    // eslint-disable-next-line no-console
    console.warn('[relief-background] auto-compute failed:', e)
  }
}
