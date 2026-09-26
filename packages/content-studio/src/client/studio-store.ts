/**
 * The open/close controller shared by the sidebar entry and the frame-wide
 * surface, plus the two handoffs into the create view — the picked-material
 * handoff from the gather view and the picked-topic handoff from the topic
 * bank. apply() creates one instance and injects it into both slot
 * registrations — component state cannot cross two slot entries, and no
 * store seat is needed for a single observable.
 */

/** The material currently handed to the create view, if any. */
export interface PickedMaterial {
  readonly id: string
  readonly title: string
  readonly url: string
}

/** The topic currently handed to the create view, if any. */
export interface PickedTopic {
  readonly id: string
  /** Working title; becomes the create entry's title. */
  readonly title: string
  /** One-line pitch, or null; folded into the pre-filled brief. */
  readonly oneLiner: string | null
  /** Core viewpoint / audience / differentiation notes, or null; same fold. */
  readonly description: string | null
}

/** Observable open state, the two verbs, and the two create-view handoffs. */
export interface ContentStudioController {
  /** Current open state (the useSyncExternalStore snapshot). */
  isOpen(): boolean
  /** Subscribe to open-state changes; returns the unsubscriber. */
  subscribe(listener: () => void): () => void
  /** Open the workbench surface. */
  open(): void
  /** Close the workbench surface. */
  close(): void
  /** Hand one gathered material to the create view (id reference only, never the body). */
  pickMaterial(material: PickedMaterial): void
  /** The current handoff, or null. */
  pickedMaterial(): PickedMaterial | null
  /** Clear the handoff once the create view has consumed it. */
  clearPickedMaterial(): void
  /** Hand one topic-bank topic to the create view (title plus brief fields). */
  pickTopic(topic: PickedTopic): void
  /** The current topic handoff, or null. */
  pickedTopic(): PickedTopic | null
  /** Clear the topic handoff once the create view has consumed it. */
  clearPickedTopic(): void
}

/**
 * Create the shared controller.
 * @returns the controller with an initially closed state and no handoff.
 */
export function createContentStudioController(): ContentStudioController {
  let open = false
  let picked: PickedMaterial | null = null
  let pickedTopic: PickedTopic | null = null
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
    pickMaterial: (material) => {
      picked = material
      emit()
    },
    pickedMaterial: () => picked,
    clearPickedMaterial: () => {
      if (picked === null) return
      picked = null
      emit()
    },
    pickTopic: (topic) => {
      pickedTopic = topic
      emit()
    },
    pickedTopic: () => pickedTopic,
    clearPickedTopic: () => {
      if (pickedTopic === null) return
      pickedTopic = null
      emit()
    },
  }
}
