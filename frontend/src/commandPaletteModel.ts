/** Minimal command-palette action registry and Ctrl+Shift+P matching. */

export type CommandPaletteAction = {
  id: string;
  label: string;
  /** Optional shortcut hint shown in the list (not configurable yet). */
  shortcut?: string;
  /** When false, the action is listed but not runnable. */
  enabled?: boolean;
  run: () => void;
};

/** True when the event is the Spec command-palette shortcut (Ctrl/Cmd+Shift+P). */
export const matchCommandPaletteShortcut = (
  event: Pick<KeyboardEvent, "key" | "code" | "ctrlKey" | "metaKey" | "shiftKey" | "altKey">,
): boolean => {
  const mod = event.ctrlKey || event.metaKey;
  if (!mod || !event.shiftKey || event.altKey) {
    return false;
  }
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  return key === "p" || event.code === "KeyP";
};

export const filterCommandActions = (
  actions: CommandPaletteAction[],
  query: string,
): CommandPaletteAction[] => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return actions;
  }
  return actions.filter(
    (action) =>
      action.label.toLowerCase().includes(normalized) ||
      action.id.toLowerCase().includes(normalized),
  );
};
