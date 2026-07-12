import type { KeyboardEvent as ReactKeyboardEvent } from "react";

import {
  DOCS_URL,
  FOCUS_MODE_MENU_ITEMS,
  LAYOUT_MENU_ITEMS,
  runBrowserEditCommand,
  type AppMenuHandlers,
  type AppMenuState,
} from "./appMenuModel";

type BrowserAppMenuProps = Readonly<{
  state: AppMenuState;
  handlers: AppMenuHandlers;
}>;

const focusAdjacentMenuitem = (
  menubar: HTMLElement,
  current: Element | null,
  direction: 1 | -1,
): void => {
  const items = Array.from(
    menubar.querySelectorAll<HTMLElement>(
      '[role="menuitem"]:not(:disabled), [role="menuitemcheckbox"]:not(:disabled), [role="menuitemradio"]:not(:disabled)',
    ),
  );
  if (items.length === 0) {
    return;
  }
  const index = current ? items.indexOf(current as HTMLElement) : -1;
  const nextIndex =
    index < 0
      ? direction === 1
        ? 0
        : items.length - 1
      : (index + direction + items.length) % items.length;
  items[nextIndex]?.focus();
};

/**
 * In-DOM File / Edit / View / Help menubar for Vite/browser and tests.
 * Tauri desktop uses the native App Menu instead (`useNativeAppMenu`).
 */
export const BrowserAppMenu = ({ state, handlers }: BrowserAppMenuProps) => {
  const onMenubarKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      focusAdjacentMenuitem(event.currentTarget, event.target as Element, 1);
      return;
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      focusAdjacentMenuitem(event.currentTarget, event.target as Element, -1);
    }
  };

  return (
    <header
      className="ide-menubar"
      role="menubar"
      aria-label="Application menu"
      onKeyDown={onMenubarKeyDown}
    >
      <div className="menu-group" role="group" aria-label="File">
        <span className="menu-title">File</span>
        <button
          type="button"
          role="menuitem"
          disabled={!state.canUseProjectMenus}
          title={
            state.canUseProjectMenus
              ? "Create a new project"
              : "Finish setup before creating a project."
          }
          onClick={handlers.onNewProject}
        >
          New…
        </button>
        <button
          type="button"
          role="menuitem"
          disabled={!state.canUseProjectMenus}
          title={
            state.canUseProjectMenus
              ? "Open a project folder"
              : "Finish setup before opening a project."
          }
          onClick={handlers.onOpenProject}
        >
          Open…
        </button>
        <button
          type="button"
          role="menuitem"
          disabled={!state.canUseProjectMenus}
          title={
            state.canUseProjectMenus
              ? "Recent projects"
              : "Finish setup before browsing recent projects."
          }
          onClick={handlers.onRecentProjects}
        >
          Recent
        </button>
        <button
          type="button"
          role="menuitem"
          disabled={!state.canCloseProject}
          onClick={handlers.onCloseProject}
        >
          Close Project
        </button>
        <button
          type="button"
          role="menuitem"
          disabled={!state.canOpenSettings}
          title={
            state.canOpenSettings
              ? "Profile and app settings"
              : "Complete the prerequisite check first."
          }
          onClick={handlers.onSettings}
        >
          Settings
        </button>
      </div>

      <div className="menu-group" role="group" aria-label="Edit">
        <span className="menu-title">Edit</span>
        <button type="button" role="menuitem" onClick={() => runBrowserEditCommand("undo")}>
          Undo
        </button>
        <button type="button" role="menuitem" onClick={() => runBrowserEditCommand("redo")}>
          Redo
        </button>
        <button type="button" role="menuitem" onClick={() => runBrowserEditCommand("cut")}>
          Cut
        </button>
        <button type="button" role="menuitem" onClick={() => runBrowserEditCommand("copy")}>
          Copy
        </button>
        <button type="button" role="menuitem" onClick={() => runBrowserEditCommand("paste")}>
          Paste
        </button>
        <button type="button" role="menuitem" onClick={() => runBrowserEditCommand("selectAll")}>
          Select All
        </button>
      </div>

      <div className="menu-group" role="group" aria-label="View">
        <span className="menu-title">View</span>
        <span className="menu-subtitle" aria-hidden="true">
          Focus Modes
        </span>
        {FOCUS_MODE_MENU_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="menuitemradio"
            aria-checked={state.focusMode === item.mode}
            disabled={!state.projectOpen}
            title={`Focus Mode: ${item.label}`}
            onClick={() => handlers.onFocusMode(item.mode)}
          >
            {item.label}
          </button>
        ))}
        <span className="menu-subtitle" aria-hidden="true">
          Layout Chrome
        </span>
        {LAYOUT_MENU_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="menuitemcheckbox"
            aria-checked={
              item.panel === "explorer"
                ? state.layout.showExplorer
                : item.panel === "mission"
                  ? state.layout.showMission
                  : item.panel === "inspector"
                    ? state.layout.showInspector
                    : state.layout.showConsole
            }
            disabled={!state.canTogglePanels}
            title={`Toggle ${item.label} (${item.shortcut})`}
            onClick={() => handlers.onTogglePanel(item.panel)}
          >
            {item.label}
          </button>
        ))}
        <button
          type="button"
          role="menuitem"
          disabled={!state.canOpenMcp}
          title={
            state.canOpenMcp
              ? state.projectOpen
                ? "Open MCP Activity in Developer Console"
                : "MCP Activity (interim until a project is open)"
              : "Finish setup before opening MCP Activity."
          }
          onClick={handlers.onOpenMcp}
        >
          MCP Activity
          {state.mcpActivityCount > 0 ? (
            <span className="menu-count">{state.mcpActivityCount}</span>
          ) : null}
        </button>
      </div>

      <div className="menu-group" role="group" aria-label="Help">
        <span className="menu-title">Help</span>
        <button type="button" role="menuitem" onClick={handlers.onAbout}>
          About Apex Pilot
        </button>
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            window.open(DOCS_URL, "_blank", "noopener,noreferrer");
            handlers.onDocs();
          }}
        >
          Documentation
        </button>
        <button type="button" role="menuitem" onClick={handlers.onShortcuts}>
          Keyboard Shortcuts
        </button>
        <button type="button" role="menuitem" onClick={handlers.onUpdates}>
          Check for updates…
        </button>
      </div>
    </header>
  );
};
