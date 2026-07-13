import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(", ");

/** Tabbable controls inside a dialog container (document order). */
export const getFocusableElements = (container: HTMLElement): HTMLElement[] => {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => {
      if (element.tabIndex < 0) {
        return false;
      }
      if (element.closest("[aria-hidden='true']")) {
        return false;
      }
      // Offset parents collapse for display:none ancestors; visibility still blocks tab.
      const style = window.getComputedStyle(element);
      return style.visibility !== "hidden" && style.display !== "none";
    },
  );
};

type UseDialogFocusTrapOptions = Readonly<{
  /** When false, the trap is idle (e.g. dialog closed / not mounted). */
  active: boolean;
  /** Escape closes the dialog. */
  onClose: () => void;
  /** Prefer this control on open; otherwise first focusable, else the container. */
  initialFocusRef?: RefObject<HTMLElement | null>;
}>;

/**
 * Modal focus: move in on open, Tab-trap while open, Escape closes, restore invoker on close.
 */
export const useDialogFocusTrap = (
  containerRef: RefObject<HTMLElement | null>,
  { active, onClose, initialFocusRef }: UseDialogFocusTrapOptions,
): void => {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) {
      return;
    }

    const container = containerRef.current;
    if (!container) {
      return;
    }

    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    previouslyFocusedRef.current = previouslyFocused;

    const focusInitial = () => {
      const preferred = initialFocusRef?.current;
      if (preferred && container.contains(preferred)) {
        preferred.focus();
        return;
      }
      const focusable = getFocusableElements(container);
      if (focusable[0]) {
        focusable[0].focus();
        return;
      }
      if (!container.hasAttribute("tabindex")) {
        container.tabIndex = -1;
      }
      container.focus();
    };

    // After paint so DialogChrome children (footer buttons) exist.
    const frame = window.requestAnimationFrame(focusInitial);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusable = getFocusableElements(container);
      event.preventDefault();
      if (focusable.length === 0) {
        container.focus();
        return;
      }

      const activeElement = document.activeElement;
      const currentIndex =
        activeElement instanceof HTMLElement ? focusable.indexOf(activeElement) : -1;

      if (event.shiftKey) {
        const nextIndex = currentIndex <= 0 ? focusable.length - 1 : currentIndex - 1;
        focusable[nextIndex]?.focus();
        return;
      }

      const nextIndex =
        currentIndex < 0 || currentIndex >= focusable.length - 1 ? 0 : currentIndex + 1;
      focusable[nextIndex]?.focus();
    };

    // Capture so Escape works even when focus sat on the invoker before move-in.
    document.addEventListener("keydown", onKeyDown, true);

    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown, true);
      const restoreTarget = previouslyFocusedRef.current;
      previouslyFocusedRef.current = null;
      if (restoreTarget && typeof restoreTarget.focus === "function") {
        restoreTarget.focus();
      }
    };
  }, [active, containerRef, initialFocusRef]);
};
