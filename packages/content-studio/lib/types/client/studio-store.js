/**
 * The open/close controller shared by the sidebar entry and the frame-wide
 * surface, plus the two handoffs into the create view — the picked-material
 * handoff from the gather view and the picked-topic handoff from the topic
 * bank. apply() creates one instance and injects it into both slot
 * registrations — component state cannot cross two slot entries, and no
 * store seat is needed for a single observable.
 */
/**
 * Create the shared controller.
 * @returns the controller with an initially closed state and no handoff.
 */
export function createContentStudioController() {
    let open = false;
    let picked = null;
    let pickedTopic = null;
    const listeners = new Set();
    const emit = () => {
        for (const listener of listeners)
            listener();
    };
    return {
        isOpen: () => open,
        subscribe: (listener) => {
            listeners.add(listener);
            return () => { listeners.delete(listener); };
        },
        open: () => {
            if (open)
                return;
            open = true;
            emit();
        },
        close: () => {
            if (!open)
                return;
            open = false;
            emit();
        },
        pickMaterial: (material) => {
            picked = material;
            emit();
        },
        pickedMaterial: () => picked,
        clearPickedMaterial: () => {
            if (picked === null)
                return;
            picked = null;
            emit();
        },
        pickTopic: (topic) => {
            pickedTopic = topic;
            emit();
        },
        pickedTopic: () => pickedTopic,
        clearPickedTopic: () => {
            if (pickedTopic === null)
                return;
            pickedTopic = null;
            emit();
        },
    };
}
//# sourceMappingURL=studio-store.js.map