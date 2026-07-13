import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";

import {
  DOCS_URL,
  FOCUS_MODE_MENU_ITEMS,
  LAYOUT_MENU_ITEMS,
  layoutPanelChecked,
  runBrowserEditCommand,
  type AppMenuHandlers,
  type AppMenuState,
} from "./appMenuModel";

type BrowserAppMenuProps = Readonly<{
  state: AppMenuState;
  handlers: AppMenuHandlers;
}>;

type TopMenuId = "file" | "edit" | "view" | "help";

const TOP_MENUS: ReadonlyArray<{ id: TopMenuId; label: string }> = [
  { id: "file", label: "File" },
  { id: "edit", label: "Edit" },
  { id: "view", label: "View" },
  { id: "help", label: "Help" },
];

const MenuSeparator = () => <div role="separator" className="menu-separator" />;

const focusAdjacentTopLevel = (
  menubar: HTMLElement,
  current: Element | null,
  direction: 1 | -1,
): HTMLElement | null => {
  const items = Array.from(
    menubar.querySelectorAll<HTMLElement>('[data-menubar-trigger="true"]:not(:disabled)'),
  );
  if (items.length === 0) {
    return null;
  }
  const index = current ? items.indexOf(current as HTMLElement) : -1;
  const nextIndex =
    index < 0
      ? direction === 1
        ? 0
        : items.length - 1
      : (index + direction + items.length) % items.length;
  const next = items[nextIndex] ?? null;
  next?.focus();
  return next;
};

const focusAdjacentMenuItem = (
  menu: HTMLElement,
  current: Element | null,
  direction: 1 | -1,
): void => {
  const items = Array.from(
    menu.querySelectorAll<HTMLElement>(
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
 * In-DOM File / Edit / View / Help dropdown menubar for Vite/browser and tests.
 * Tauri desktop uses the native App Menu instead (`useNativeAppMenu`).
 *
 * Top-level open/switch is click-only; Escape and outside-click close.
 * Nested cascade hover is reserved for real IA nests later — View stays flat
 * with separators matching native today.
 */
export const BrowserAppMenu = ({ state, handlers }: BrowserAppMenuProps) => {
  const [openMenu, setOpenMenu] = useState<TopMenuId | null>(null);
  const menubarRef = useRef<HTMLElement>(null);
  const menuIdPrefix = useId();

  useEffect(() => {
    if (openMenu === null) {
      return;
    }

    const onPointerDown = (event: PointerEvent) => {
      const root = menubarRef.current;
      if (!root || !(event.target instanceof Node) || root.contains(event.target)) {
        return;
      }
      setOpenMenu(null);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpenMenu(null);
        const trigger = menubarRef.current?.querySelector<HTMLElement>(
          `[data-menubar-trigger="true"][data-menu-id="${openMenu}"]`,
        );
        trigger?.focus();
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [openMenu]);

  const closeAndRun = (action: () => void) => {
    setOpenMenu(null);
    action();
  };

  const onTriggerClick = (id: TopMenuId) => {
    setOpenMenu((current) => (current === id ? null : id));
  };

  const onMenubarKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    const isTrigger = target.dataset.menubarTrigger === "true";
    const menuPanel = target.closest<HTMLElement>('[role="menu"]');

    if (isTrigger) {
      const menuId = target.dataset.menuId as TopMenuId | undefined;
      if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        event.preventDefault();
        const direction = event.key === "ArrowRight" ? 1 : -1;
        const next = focusAdjacentTopLevel(event.currentTarget, target, direction);
        if (openMenu !== null && next?.dataset.menuId) {
          setOpenMenu(next.dataset.menuId as TopMenuId);
        }
        return;
      }
      if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        if (menuId) {
          setOpenMenu(menuId);
          requestAnimationFrame(() => {
            const panel = menubarRef.current?.querySelector<HTMLElement>(
              `#${CSS.escape(`${menuIdPrefix}-${menuId}`)}`,
            );
            if (panel) {
              focusAdjacentMenuItem(panel, null, 1);
            }
          });
        }
        return;
      }
    }

    if (menuPanel) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        focusAdjacentMenuItem(menuPanel, target, 1);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        focusAdjacentMenuItem(menuPanel, target, -1);
        return;
      }
      if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        event.preventDefault();
        const direction = event.key === "ArrowRight" ? 1 : -1;
        const trigger = menubarRef.current?.querySelector<HTMLElement>(
          `[data-menubar-trigger="true"][data-menu-id="${openMenu}"]`,
        );
        const next = focusAdjacentTopLevel(event.currentTarget, trigger ?? null, direction);
        if (next?.dataset.menuId) {
          setOpenMenu(next.dataset.menuId as TopMenuId);
          requestAnimationFrame(() => {
            const panel = menubarRef.current?.querySelector<HTMLElement>(
              `#${CSS.escape(`${menuIdPrefix}-${next.dataset.menuId}`)}`,
            );
            if (panel) {
              focusAdjacentMenuItem(panel, null, 1);
            }
          });
        }
      }
    }
  };

  const renderDropdown = (id: TopMenuId, children: ReactNode) => {
    if (openMenu !== id) {
      return null;
    }
    return (
      <div
        id={`${menuIdPrefix}-${id}`}
        className="menu-dropdown"
        role="menu"
        aria-label={TOP_MENUS.find((menu) => menu.id === id)?.label}
      >
        {children}
      </div>
    );
  };

  const mcpLabel =
    state.mcpActivityCount > 0
      ? `MCP Activity (${state.mcpActivityCount})`
      : "MCP Activity";

  return (
    <header
      ref={menubarRef}
      className="ide-menubar"
      role="menubar"
      aria-label="Application menu"
      onKeyDown={onMenubarKeyDown}
    >
      <div className="menu-root">
        <button
          type="button"
          className="menu-trigger"
          role="menuitem"
          data-menubar-trigger="true"
          data-menu-id="file"
          aria-haspopup="menu"
          aria-expanded={openMenu === "file"}
          aria-controls={openMenu === "file" ? `${menuIdPrefix}-file` : undefined}
          onClick={() => onTriggerClick("file")}
        >
          File
        </button>
        {renderDropdown(
          "file",
          <>
            <button
              type="button"
              role="menuitem"
              disabled={!state.canUseProjectMenus}
              title={
                state.canUseProjectMenus
                  ? "Create a new project"
                  : "Finish setup before creating a project."
              }
              onClick={() => closeAndRun(handlers.onNewProject)}
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
              onClick={() => closeAndRun(handlers.onOpenProject)}
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
              onClick={() => closeAndRun(handlers.onRecentProjects)}
            >
              Recent
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={!state.canCloseProject}
              onClick={() => closeAndRun(handlers.onCloseProject)}
            >
              Close Project
            </button>
          </>,
        )}
      </div>

      <div className="menu-root">
        <button
          type="button"
          className="menu-trigger"
          role="menuitem"
          data-menubar-trigger="true"
          data-menu-id="edit"
          aria-haspopup="menu"
          aria-expanded={openMenu === "edit"}
          aria-controls={openMenu === "edit" ? `${menuIdPrefix}-edit` : undefined}
          onClick={() => onTriggerClick("edit")}
        >
          Edit
        </button>
        {renderDropdown(
          "edit",
          <>
            <button
              type="button"
              role="menuitem"
              onClick={() => closeAndRun(() => runBrowserEditCommand("undo"))}
            >
              Undo
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => closeAndRun(() => runBrowserEditCommand("redo"))}
            >
              Redo
            </button>
            <MenuSeparator />
            <button
              type="button"
              role="menuitem"
              onClick={() => closeAndRun(() => runBrowserEditCommand("cut"))}
            >
              Cut
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => closeAndRun(() => runBrowserEditCommand("copy"))}
            >
              Copy
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => closeAndRun(() => runBrowserEditCommand("paste"))}
            >
              Paste
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => closeAndRun(() => runBrowserEditCommand("selectAll"))}
            >
              Select All
            </button>
          </>,
        )}
      </div>

      <div className="menu-root">
        <button
          type="button"
          className="menu-trigger"
          role="menuitem"
          data-menubar-trigger="true"
          data-menu-id="view"
          aria-haspopup="menu"
          aria-expanded={openMenu === "view"}
          aria-controls={openMenu === "view" ? `${menuIdPrefix}-view` : undefined}
          onClick={() => onTriggerClick("view")}
        >
          View
        </button>
        {renderDropdown(
          "view",
          <>
            {FOCUS_MODE_MENU_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="menuitemradio"
                aria-checked={state.focusMode === item.mode}
                disabled={!state.projectOpen}
                title={`Focus Mode: ${item.label}`}
                onClick={() => closeAndRun(() => handlers.onFocusMode(item.mode))}
              >
                {item.label}
              </button>
            ))}
            <MenuSeparator />
            {LAYOUT_MENU_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="menuitemcheckbox"
                aria-checked={layoutPanelChecked(state, item.panel)}
                disabled={!state.canTogglePanels}
                title={`Toggle ${item.label} (${item.shortcut})`}
                onClick={() => closeAndRun(() => handlers.onTogglePanel(item.panel))}
              >
                {item.label}
              </button>
            ))}
            <MenuSeparator />
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
              onClick={() => closeAndRun(handlers.onOpenMcp)}
            >
              {mcpLabel}
            </button>
          </>,
        )}
      </div>

      <div className="menu-root">
        <button
          type="button"
          className="menu-trigger"
          role="menuitem"
          data-menubar-trigger="true"
          data-menu-id="help"
          aria-haspopup="menu"
          aria-expanded={openMenu === "help"}
          aria-controls={openMenu === "help" ? `${menuIdPrefix}-help` : undefined}
          onClick={() => onTriggerClick("help")}
        >
          Help
        </button>
        {renderDropdown(
          "help",
          <>
            <button type="button" role="menuitem" onClick={() => closeAndRun(handlers.onAbout)}>
              About Apex Pilot
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() =>
                closeAndRun(() => {
                  window.open(DOCS_URL, "_blank", "noopener,noreferrer");
                  handlers.onDocs();
                })
              }
            >
              Documentation
            </button>
            <button type="button" role="menuitem" onClick={() => closeAndRun(handlers.onShortcuts)}>
              Keyboard Shortcuts
            </button>
            <MenuSeparator />
            <button type="button" role="menuitem" onClick={() => closeAndRun(handlers.onUpdates)}>
              Check for updates…
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={!state.canCompareProjectToDatabase}
              title={
                state.canCompareProjectToDatabase
                  ? "Compare project files to the database"
                  : "Open a project and connect to a database first."
              }
              onClick={() => closeAndRun(handlers.onCompareProjectToDatabase)}
            >
              Compare project to database…
            </button>
          </>,
        )}
      </div>
    </header>
  );
};
