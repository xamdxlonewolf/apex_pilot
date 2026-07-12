import { FOCUS_MODES, focusModeLabel, type FocusMode } from "./focusMode";
import type { ProfileLayoutPrefs } from "./prefs";

export type AppMenuActionId =
  | "file-new"
  | "file-open"
  | "file-recent"
  | "file-close"
  | "file-settings"
  | "view-mcp"
  | "view-explorer"
  | "view-mission"
  | "view-inspector"
  | "view-console"
  | `view-focus-${FocusMode}`
  | "help-about"
  | "help-docs"
  | "help-shortcuts"
  | "help-updates";

export type AppMenuHandlers = Readonly<{
  onNewProject: () => void;
  onOpenProject: () => void;
  onRecentProjects: () => void;
  onCloseProject: () => void;
  onSettings: () => void;
  onOpenMcp: () => void;
  onTogglePanel: (panel: "explorer" | "mission" | "inspector" | "console") => void;
  onFocusMode: (mode: FocusMode) => void;
  onAbout: () => void;
  onDocs: () => void;
  onShortcuts: () => void;
  onUpdates: () => void;
}>;

export type AppMenuState = Readonly<{
  canUseProjectMenus: boolean;
  canOpenSettings: boolean;
  canOpenMcp: boolean;
  canTogglePanels: boolean;
  canCloseProject: boolean;
  projectOpen: boolean;
  focusMode: FocusMode;
  layout: ProfileLayoutPrefs;
  mcpActivityCount: number;
}>;

export const DOCS_URL = "https://github.com/xamdxlonewolf/apex_pilot";

export const FOCUS_MODE_MENU_ITEMS = FOCUS_MODES.map((mode) => ({
  id: `view-focus-${mode}` as const,
  mode,
  label: focusModeLabel(mode),
}));

export const LAYOUT_MENU_ITEMS = [
  {
    id: "view-explorer" as const,
    panel: "explorer" as const,
    label: "Explorer",
    shortcut: "Ctrl+B",
  },
  {
    id: "view-mission" as const,
    panel: "mission" as const,
    label: "Mission",
    shortcut: "Ctrl+Shift+M",
  },
  {
    id: "view-inspector" as const,
    panel: "inspector" as const,
    label: "Inspector",
    shortcut: "Ctrl+Shift+I",
  },
  {
    id: "view-console" as const,
    panel: "console" as const,
    label: "Developer Console",
    shortcut: "Ctrl+`",
  },
] as const;

export const isTauriRuntime = (): boolean =>
  Boolean((window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);

export const runBrowserEditCommand = (command: string): void => {
  try {
    document.execCommand(command);
  } catch {
    // Browser may reject execCommand; native Edit uses PredefinedMenuItem instead.
  }
};
