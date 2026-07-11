/** Spec panel mins/defaults and core toggle shortcut matching (ADR-0007 §12). */

export type PanelId = "explorer" | "mission" | "inspector" | "console";

export const EXPLORER_MIN_WIDTH = 240;
export const INSPECTOR_MIN_WIDTH = 320;
export const CONSOLE_MIN_HEIGHT = 120;
export const CONSOLE_DEFAULT_HEIGHT = 220;
export const EXPLORER_DEFAULT_WIDTH = 300;
export const INSPECTOR_DEFAULT_WIDTH = 360;

export const clampExplorerWidth = (width: number): number =>
  Math.max(EXPLORER_MIN_WIDTH, Math.min(640, Math.round(width)));

export const clampInspectorWidth = (width: number): number =>
  Math.max(INSPECTOR_MIN_WIDTH, Math.min(720, Math.round(width)));

export const clampConsoleHeight = (
  height: number,
  windowHeight: number = typeof window === "undefined" ? 900 : window.innerHeight,
): number => {
  const maxHeight = Math.max(CONSOLE_MIN_HEIGHT, Math.floor(windowHeight * 0.5));
  return Math.max(CONSOLE_MIN_HEIGHT, Math.min(maxHeight, Math.round(height)));
};

/** Map a keydown to a Spec General panel-toggle shortcut, or null. */
export const matchPanelToggleShortcut = (
  event: Pick<KeyboardEvent, "key" | "code" | "ctrlKey" | "metaKey" | "shiftKey" | "altKey">,
): PanelId | null => {
  const mod = event.ctrlKey || event.metaKey;
  if (!mod || event.altKey) {
    return null;
  }
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  if (!event.shiftKey && (key === "b" || event.code === "KeyB")) {
    return "explorer";
  }
  if (!event.shiftKey && (key === "`" || event.code === "Backquote")) {
    return "console";
  }
  if (event.shiftKey && (key === "i" || event.code === "KeyI")) {
    return "inspector";
  }
  if (event.shiftKey && (key === "m" || event.code === "KeyM")) {
    return "mission";
  }
  return null;
};
