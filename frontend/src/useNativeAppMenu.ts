import { useEffect, useRef } from "react";

import {
  DOCS_URL,
  FOCUS_MODE_MENU_ITEMS,
  LAYOUT_MENU_ITEMS,
  isTauriRuntime,
  layoutPanelChecked,
  type AppMenuHandlers,
  type AppMenuState,
} from "./appMenuModel";
import { panelIsVisible } from "./shellSession";

type UseNativeAppMenuArgs = Readonly<{
  enabled: boolean;
  state: AppMenuState;
  handlers: AppMenuHandlers;
}>;

type CheckMenuItemLike = Readonly<{
  setChecked: (checked: boolean) => Promise<void>;
  setEnabled: (enabled: boolean) => Promise<void>;
}>;

type MenuItemLike = Readonly<{
  setText: (text: string) => Promise<void>;
  setEnabled: (enabled: boolean) => Promise<void>;
}>;

type NativeMenuHandles = Readonly<{
  focusItems: ReadonlyArray<CheckMenuItemLike>;
  layoutItems: ReadonlyArray<CheckMenuItemLike>;
  mcpItem: MenuItemLike;
  fileItems: Readonly<{
    newProject: MenuItemLike;
    openProject: MenuItemLike;
    recent: MenuItemLike;
    closeProject: MenuItemLike;
  }>;
  helpCompare: MenuItemLike;
}>;

/**
 * Installs the native Tauri App Menu once for structural capability changes,
 * then updates checkmarks / labels in place. Full `setAsAppMenu` on every
 * panel toggle flashes the window on Windows.
 */
export const useNativeAppMenu = ({ enabled, state, handlers }: UseNativeAppMenuArgs): void => {
  const handlersRef = useRef(handlers);
  const stateRef = useRef(state);
  const handlesRef = useRef<NativeMenuHandles | null>(null);
  const {
    canCloseProject,
    canCompareProjectToDatabase,
    canOpenMcp,
    canTogglePanels,
    canUseProjectMenus,
    focusMode,
    mcpActivityCount,
    projectOpen,
    shellSession,
  } = state;
  const showConsole = state.layout.showConsole;

  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    stateRef.current = state;
  });

  // Structural install — avoid depending on transient checked / count state.
  useEffect(() => {
    if (!enabled || !isTauriRuntime()) {
      handlesRef.current = null;
      return;
    }

    let cancelled = false;

    const install = async (): Promise<void> => {
      const { CheckMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu } = await import(
        "@tauri-apps/api/menu"
      );

      const h = () => handlersRef.current;
      const s = () => stateRef.current;

      const fileNew = await MenuItem.new({
        id: "file-new",
        text: "New…",
        enabled: s().canUseProjectMenus,
        action: () => h().onNewProject(),
      });
      const fileOpen = await MenuItem.new({
        id: "file-open",
        text: "Open…",
        enabled: s().canUseProjectMenus,
        action: () => h().onOpenProject(),
      });
      const fileRecent = await MenuItem.new({
        id: "file-recent",
        text: "Recent",
        enabled: s().canUseProjectMenus,
        action: () => h().onRecentProjects(),
      });
      const fileClose = await MenuItem.new({
        id: "file-close",
        text: "Close Project",
        enabled: s().canCloseProject,
        action: () => h().onCloseProject(),
      });

      const file = await Submenu.new({
        text: "File",
        items: [fileNew, fileOpen, fileRecent, fileClose],
      });

      const edit = await Submenu.new({
        text: "Edit",
        items: [
          await PredefinedMenuItem.new({ item: "Undo", text: "Undo" }),
          await PredefinedMenuItem.new({ item: "Redo", text: "Redo" }),
          await PredefinedMenuItem.new({ item: "Separator" }),
          await PredefinedMenuItem.new({ item: "Cut", text: "Cut" }),
          await PredefinedMenuItem.new({ item: "Copy", text: "Copy" }),
          await PredefinedMenuItem.new({ item: "Paste", text: "Paste" }),
          await PredefinedMenuItem.new({ item: "SelectAll", text: "Select All" }),
        ],
      });

      const focusItems = await Promise.all(
        FOCUS_MODE_MENU_ITEMS.map((item) =>
          CheckMenuItem.new({
            id: item.id,
            text: item.label,
            checked: s().focusMode === item.mode,
            enabled: s().projectOpen,
            action: () => h().onFocusMode(item.mode),
          }),
        ),
      );

      const layoutItems = await Promise.all(
        LAYOUT_MENU_ITEMS.map((item) =>
          CheckMenuItem.new({
            id: item.id,
            text: item.label,
            checked: layoutPanelChecked(s(), item.panel),
            enabled: s().canTogglePanels,
            action: () => h().onTogglePanel(item.panel),
          }),
        ),
      );

      const mcpLabel =
        s().mcpActivityCount > 0
          ? `MCP Activity (${s().mcpActivityCount})`
          : "MCP Activity";

      const mcpItem = await MenuItem.new({
        id: "view-mcp",
        text: mcpLabel,
        enabled: s().canOpenMcp,
        action: () => h().onOpenMcp(),
      });

      const view = await Submenu.new({
        text: "View",
        items: [
          ...focusItems,
          await PredefinedMenuItem.new({ item: "Separator" }),
          ...layoutItems,
          await PredefinedMenuItem.new({ item: "Separator" }),
          mcpItem,
        ],
      });

      const helpCompare = await MenuItem.new({
        id: "help-compare-project-db",
        text: "Compare project to database…",
        enabled: s().canCompareProjectToDatabase,
        action: () => h().onCompareProjectToDatabase(),
      });

      const help = await Submenu.new({
        text: "Help",
        items: [
          await MenuItem.new({
            id: "help-about",
            text: "About Apex Pilot",
            action: () => h().onAbout(),
          }),
          await MenuItem.new({
            id: "help-docs",
            text: "Documentation",
            action: () => {
              window.open(DOCS_URL, "_blank", "noopener,noreferrer");
              h().onDocs();
            },
          }),
          await MenuItem.new({
            id: "help-shortcuts",
            text: "Keyboard Shortcuts",
            action: () => h().onShortcuts(),
          }),
          await PredefinedMenuItem.new({ item: "Separator" }),
          await MenuItem.new({
            id: "help-updates",
            text: "Check for updates…",
            action: () => h().onUpdates(),
          }),
          helpCompare,
        ],
      });

      const menu = await Menu.new({ items: [file, edit, view, help] });
      if (cancelled) {
        return;
      }
      await menu.setAsAppMenu();
      handlesRef.current = {
        focusItems,
        layoutItems,
        mcpItem,
        fileItems: {
          newProject: fileNew,
          openProject: fileOpen,
          recent: fileRecent,
          closeProject: fileClose,
        },
        helpCompare,
      };
    };

    void install().catch((error: unknown) => {
      console.error("Failed to install native App Menu", error);
    });

    return () => {
      cancelled = true;
      handlesRef.current = null;
    };
  }, [
    enabled,
    state.canUseProjectMenus,
    state.canOpenMcp,
    state.canTogglePanels,
    state.canCloseProject,
    state.canCompareProjectToDatabase,
    state.projectOpen,
  ]);

  // In-place checkmark / label updates — do not call setAsAppMenu here.
  useEffect(() => {
    const handles = handlesRef.current;
    if (!handles) {
      return;
    }

    const sync = async (): Promise<void> => {
      await Promise.all([
        ...FOCUS_MODE_MENU_ITEMS.map((item, index) =>
          handles.focusItems[index]?.setChecked(focusMode === item.mode),
        ),
        ...LAYOUT_MENU_ITEMS.map((item, index) =>
          handles.layoutItems[index]?.setChecked(
            panelIsVisible(shellSession, focusMode, item.panel, showConsole),
          ),
        ),
        handles.mcpItem.setText(
          mcpActivityCount > 0
            ? `MCP Activity (${mcpActivityCount})`
            : "MCP Activity",
        ),
        handles.mcpItem.setEnabled(canOpenMcp),
        handles.fileItems.newProject.setEnabled(canUseProjectMenus),
        handles.fileItems.openProject.setEnabled(canUseProjectMenus),
        handles.fileItems.recent.setEnabled(canUseProjectMenus),
        handles.fileItems.closeProject.setEnabled(canCloseProject),
        handles.helpCompare.setEnabled(canCompareProjectToDatabase),
        ...handles.focusItems.map((item) => item.setEnabled(projectOpen)),
        ...handles.layoutItems.map((item) => item.setEnabled(canTogglePanels)),
      ]);
    };

    void sync().catch((error: unknown) => {
      console.error("Failed to sync native App Menu state", error);
    });
  }, [
    canCloseProject,
    canCompareProjectToDatabase,
    canOpenMcp,
    canTogglePanels,
    canUseProjectMenus,
    focusMode,
    mcpActivityCount,
    projectOpen,
    shellSession,
    showConsole,
  ]);
};
