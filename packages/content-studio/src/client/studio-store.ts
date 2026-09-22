/**
 * The open/close controller shared by the sidebar entry and the frame-wide
 * surface. apply() creates one instance and injects it into both slot
 * registrations — component state cannot cross two slot entries, and no
 * store seat is needed for a single boolean observable.
 */

/** Observable open state plus the two verbs; the surface reads it via useSyncExternalStore. */
export interface ContentStudioController {
  /** Current open state (the useSyncExternalStore snapshot). */
  isOpen(): boolean
  /** Subscribe to open-state changes; returns the unsubscriber. */
  subscribe(listener: () => void): () => void
  /** Open the workbench surface. */
  open(): void
  /** Close the workbench surface. */
  close(): void
}

/**
 * Create the shared open/close controller.
 * @returns the controller with an initially closed state.
 */
export function createContentStudioController(): ContentStudioController {
  let open = false
  const listeners = new Set<() => void>()
  const emit = (): void => {
    for (const listener of listeners) listener()
  }
  return {
    isOpen: () => open,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    open: () => {
      if (open) return
      open = true
      emit()
    },
    close: () => {
      if (!open) return
      open = false
      emit()
    },
  }
}
