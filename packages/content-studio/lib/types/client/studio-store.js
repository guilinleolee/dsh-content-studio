/**
 * The open/close controller shared by the sidebar entry and the frame-wide
 * surface. apply() creates one instance and injects it into both slot
 * registrations — component state cannot cross two slot entries, and no
 * store seat is needed for a single boolean observable.
 */
/**
 * Create the shared open/close controller.
 * @returns the controller with an initially closed state.
 */
export function createContentStudioController() {
    let open = false;
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
    };
}
//# sourceMappingURL=studio-store.js.map