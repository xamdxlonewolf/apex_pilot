import { useEffect, useRef } from "react";

import {
  DOCS_URL,
  FOCUS_MODE_MENU_ITEMS,
  LAYOUT_MENU_ITEMS,
  isTauriRuntime,
  type AppMenuHandlers,
  type AppMenuState,
} from "./appMenuModel";

type UseNativeAppMenuArgs = Readonly<{
  enabled: boolean;
  state: AppMenuState;
  handlers: AppMenuHandlers;
}>;

/**
 * Installs / refreshes the native Tauri App Menu (File / Edit / View / Help).
 * No-op outside Tauri so Vite tests keep using {@link BrowserAppMenu}.
 */
export const useNativeAppMenu = ({ enabled, state, handlers }: UseNativeAppMenuArgs): void => {
  const handlersRef = useRef(handlers);

  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    if (!enabled || !isTauriRuntime()) {
      return;
    }

    let cancelled = false;

    const install = async (): Promise<void> => {
      const { CheckMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu } = await import(
        "@tauri-apps/api/menu"
      );

      const h = () => handlersRef.current;

      const file = await Submenu.new({
        text: "File",
        items: [
          await MenuItem.new({
            id: "file-new",
            text: "New…",
            enabled: state.canUseProjectMenus,
            action: () => h().onNewProject(),
          }),
          await MenuItem.new({
            id: "file-open",
            text: "Open…",
            enabled: state.canUseProjectMenus,
            action: () => h().onOpenProject(),
          }),
          await MenuItem.new({
            id: "file-recent",
            text: "Recent",
            enabled: state.canUseProjectMenus,
            action: () => h().onRecentProjects(),
          }),
          await MenuItem.new({
            id: "file-close",
            text: "Close Project",
            enabled: state.canCloseProject,
            action: () => h().onCloseProject(),
          }),
          await PredefinedMenuItem.new({ item: "Separator" }),
          await MenuItem.new({
            id: "file-settings",
            text: "Settings",
            enabled: state.canOpenSettings,
            action: () => h().onSettings(),
          }),
        ],
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
            checked: state.focusMode === item.mode,
            enabled: state.projectOpen,
            action: () => h().onFocusMode(item.mode),
          }),
        ),
      );

      const layoutItems = await Promise.all(
        LAYOUT_MENU_ITEMS.map((item) => {
          const checked =
            item.panel === "explorer"
              ? state.layout.showExplorer
              : item.panel === "mission"
                ? state.layout.showMission
                : item.panel === "inspector"
                  ? state.layout.showInspector
                  : state.layout.showConsole;
                  return CheckMenuItem.new({
                    id: item.id,
                    text: item.label,
                    checked,
                    enabled: state.canTogglePanels,
                    action: () => h().onTogglePanel(item.panel),
                  });
        }),
      );

      const mcpLabel =
        state.mcpActivityCount > 0
          ? `MCP Activity (${state.mcpActivityCount})`
          : "MCP Activity";

      const view = await Submenu.new({
        text: "View",
        items: [
          ...focusItems,
          await PredefinedMenuItem.new({ item: "Separator" }),
          ...layoutItems,
          await PredefinedMenuItem.new({ item: "Separator" }),
          await MenuItem.new({
            id: "view-mcp",
            text: mcpLabel,
            enabled: state.canOpenMcp,
            action: () => h().onOpenMcp(),
          }),
        ],
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
          await MenuItem.new({
            id: "help-compare-project-db",
            text: "Compare project to database…",
            enabled: state.canCompareProjectToDatabase,
            action: () => h().onCompareProjectToDatabase(),
          }),
        ],
      });

      const menu = await Menu.new({ items: [file, edit, view, help] });
      if (cancelled) {
        return;
      }
      await menu.setAsAppMenu();
    };

    void install().catch((error: unknown) => {
      console.error("Failed to install native App Menu", error);
    });

    return () => {
      cancelled = true;
    };
  }, [
    enabled,
    state.canUseProjectMenus,
    state.canOpenSettings,
    state.canOpenMcp,
    state.canTogglePanels,
    state.canCloseProject,
    state.canCompareProjectToDatabase,
    state.projectOpen,
    state.focusMode,
    state.layout.showExplorer,
    state.layout.showMission,
    state.layout.showInspector,
    state.layout.showConsole,
    state.mcpActivityCount,
  ]);
};
