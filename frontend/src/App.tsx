import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

import { CommandPalette } from "./CommandPalette";
import { matchCommandPaletteShortcut, type CommandPaletteAction } from "./commandPalette";
import {
  CENTER_EDITOR_STUB_KINDS,
  CENTER_EDITOR_STUB_META,
  type CenterEditorStubKind,
} from "./centerEditors";
import { McpActivityWindow, openMcpActivityWindow } from "./McpActivityWindow";
import { IdeWorkspace } from "./IdeWorkspace";
import { matchPanelToggleShortcut } from "./panelLayout";
import {
  type ProfileLayoutPrefs,
  loadProfileLayout,
  saveProfileLayout,
  togglePanelVisibility,
} from "./prefs";
import { StartupFunnel, type WizardMode } from "./StartupFunnel";
import {
  type ActivityEntry,
  type BackendConfig,
  type BackendStatus,
  type OpenedProject,
  type SavedConnection,
  checkBackendHealth,
  closeCurrentProject,
  connectSavedConnection,
  getBackendConfig,
  getCurrentProject,
  listActivity,
  listSavedConnections,
  resolveBackendConfig,
} from "./backend";

const statusFromConfig = (config: BackendConfig): BackendStatus => {
  if (!config.baseUrl) {
    return { kind: "missing-config" };
  }
  return { kind: "checking", baseUrl: config.baseUrl };
};

const statusLabel = (status: BackendStatus): string => {
  switch (status.kind) {
    case "missing-config":
      return "Backend not configured";
    case "checking":
      return "Checking backend";
    case "online":
      return "Backend online";
    case "offline":
      return "Backend offline";
  }
};

// Survives React StrictMode remounts (component refs reset). Concurrent SQLcl
// MCP connect calls return "Unsupported Connection" and kill the stdio session.
let connectInFlight = false;

/** Test-only: clear the sync connect lock between cases. */
export const resetConnectGuardsForTests = (): void => {
  connectInFlight = false;
};

const focusAdjacentMenuitem = (
  menubar: HTMLElement,
  current: Element | null,
  direction: 1 | -1,
): void => {
  const items = Array.from(
    menubar.querySelectorAll<HTMLElement>(
      '[role="menuitem"]:not(:disabled), [role="menuitemcheckbox"]:not(:disabled)',
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

export const App = () => {
  const [backendConfig, setBackendConfig] = useState<BackendConfig>(() => getBackendConfig());
  const [backendStatus, setBackendStatus] = useState<BackendStatus>(() =>
    statusFromConfig(backendConfig),
  );
  const [connections, setConnections] = useState<SavedConnection[]>([]);
  const [selectedConnection, setSelectedConnection] = useState("");
  const [connectedConnection, setConnectedConnection] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionMessage, setConnectionMessage] = useState("Waiting for backend.");
  const [activityEntries, setActivityEntries] = useState<ActivityEntry[]>([]);
  const [activeActivitySessionId, setActiveActivitySessionId] = useState<string | null>(null);
  const [mcpOpen, setMcpOpen] = useState(false);
  const [mcpFocusRequest, setMcpFocusRequest] = useState(0);
  const [openedProject, setOpenedProject] = useState<OpenedProject | null>(null);
  const [wizardMode, setWizardMode] = useState<WizardMode | null>(null);
  const [requestClose, setRequestClose] = useState(false);
  const [sqlDirty, setSqlDirty] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [shellPhase, setShellPhase] = useState("booting");
  const [layoutProfileId, setLayoutProfileId] = useState<string | null>(null);
  const [layout, setLayout] = useState<ProfileLayoutPrefs>(() => loadProfileLayout(null));
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [openCenterEditorKind, setOpenCenterEditorKind] = useState<CenterEditorStubKind | null>(
    null,
  );
  const [openCenterEditorRequest, setOpenCenterEditorRequest] = useState(0);

  if (profileId !== layoutProfileId) {
    setLayoutProfileId(profileId);
    setLayout(loadProfileLayout(profileId));
  }

  const isBackendOnline = backendStatus.kind === "online";
  const projectOpen = Boolean(openedProject) && !wizardMode;
  const setupLocked =
    !isBackendOnline ||
    shellPhase === "booting" ||
    shellPhase === "preflight" ||
    shellPhase === "profile";
  const canUseProjectMenus = isBackendOnline && !setupLocked;
  const canOpenSettings =
    isBackendOnline &&
    shellPhase !== "booting" &&
    shellPhase !== "preflight" &&
    shellPhase !== "profile";
  const canOpenMcp = isBackendOnline && !setupLocked;
  const canTogglePanels = projectOpen;

  const refreshActivity = useCallback(async () => {
    if (!isBackendOnline) {
      setActivityEntries([]);
      setActiveActivitySessionId(null);
      return;
    }
    try {
      const response = await listActivity({
        connectionName: connectedConnection,
        config: backendConfig,
      });
      setActivityEntries(response.entries);
      setActiveActivitySessionId(response.active_session_id);
    } catch {
      setActivityEntries([]);
      setActiveActivitySessionId(null);
    }
  }, [backendConfig, connectedConnection, isBackendOnline]);

  const refreshConnections = useCallback(async () => {
    if (!isBackendOnline) {
      return;
    }
    setConnectionMessage("Loading SQLcl saved connections.");
    try {
      const response = await listSavedConnections(backendConfig);
      setConnections(response.connections);
      setSelectedConnection((current) => current || response.connections[0]?.name || "");
      setConnectionMessage(
        response.connections.length > 0
          ? "Choose a saved SQLcl connection."
          : "No SQLcl saved connections were returned.",
      );
    } catch (error) {
      setConnectionMessage(
        error instanceof Error ? error.message : "Could not list saved connections.",
      );
    }
  }, [backendConfig, isBackendOnline]);

  useEffect(() => {
    let isCurrent = true;
    void resolveBackendConfig().then(async (resolvedConfig) => {
      if (!isCurrent) {
        return;
      }
      setBackendConfig(resolvedConfig);
      setBackendStatus(statusFromConfig(resolvedConfig));
      const nextStatus = await checkBackendHealth(resolvedConfig);
      if (isCurrent) {
        setBackendStatus(nextStatus);
      }
    });
    return () => {
      isCurrent = false;
    };
  }, []);

  useEffect(() => {
    if (isBackendOnline) {
      queueMicrotask(() => {
        void refreshConnections();
        void getCurrentProject(backendConfig)
          .then((project) => setOpenedProject(project))
          .catch(() => setOpenedProject(null));
      });
    }
  }, [backendConfig, isBackendOnline, refreshConnections]);

  useEffect(() => {
    queueMicrotask(() => {
      void refreshActivity();
    });
  }, [connectedConnection, isBackendOnline, refreshActivity]);

  useEffect(() => {
    if (!profileId) {
      return;
    }
    saveProfileLayout(profileId, layout);
  }, [layout, profileId]);

  useEffect(() => {
    if (wizardMode !== null || !profileId) {
      return;
    }
    setLayout(loadProfileLayout(profileId));
  }, [profileId, wizardMode]);

  useEffect(() => {
    if (!requestClose) {
      return;
    }
    if (!openedProject) {
      setRequestClose(false);
      return;
    }
    void (async () => {
      if (sqlDirty) {
        const proceed = window.confirm("You have unsaved work. Close the project anyway?");
        if (!proceed) {
          setRequestClose(false);
          return;
        }
      }
      try {
        await closeCurrentProject(backendConfig);
        setOpenedProject(null);
        setSqlDirty(false);
        setWizardMode(null);
        setOpenCenterEditorKind(null);
        setOpenCenterEditorRequest(0);
        setConnectionMessage("Project closed.");
      } catch (error) {
        setConnectionMessage(
          error instanceof Error ? error.message : "Could not close project.",
        );
      } finally {
        setRequestClose(false);
      }
    })();
  }, [backendConfig, openedProject, requestClose, sqlDirty]);

  const connectSelectedConnection = useCallback(
    async (connectionName?: string) => {
      const target = (connectionName ?? selectedConnection).trim();
      if (!target) {
        setConnectionMessage("Select a SQLcl saved connection first.");
        return;
      }
      if (connectInFlight) {
        return;
      }
      connectInFlight = true;
      if (connectionName && connectionName !== selectedConnection) {
        setSelectedConnection(connectionName);
      }
      setIsConnecting(true);
      setConnectionMessage(`Connecting to ${target}.`);
      try {
        const response = await connectSavedConnection(target, backendConfig);
        setConnectedConnection(response.connection_name);
        setConnectionMessage(`Connected to ${response.connection_name}.`);
        await refreshActivity();
      } catch (error) {
        setConnectedConnection(null);
        setConnectionMessage(error instanceof Error ? error.message : "Could not connect.");
        await refreshActivity();
      } finally {
        connectInFlight = false;
        setIsConnecting(false);
      }
    },
    [backendConfig, refreshActivity, selectedConnection],
  );

  const openMcp = useCallback(async () => {
    if (projectOpen) {
      setMcpOpen(false);
      setLayout((current) => ({ ...current, showConsole: true }));
      setMcpFocusRequest((token) => token + 1);
      return;
    }
    // Interim only: console is unavailable until a project is open.
    const openedNative = await openMcpActivityWindow();
    if (!openedNative) {
      setMcpOpen(true);
    }
  }, [projectOpen]);

  const handleMcpFocusHandled = useCallback(() => {
    setMcpFocusRequest(0);
  }, []);

  const togglePanel = useCallback(
    (panel: Parameters<typeof togglePanelVisibility>[1]) => {
      if (!canTogglePanels) {
        return;
      }
      setLayout((current) => togglePanelVisibility(current, panel));
    },
    [canTogglePanels],
  );

  const commandActions = useMemo((): CommandPaletteAction[] => {
    const actions: CommandPaletteAction[] = [
      {
        id: "toggle-explorer",
        label: "View: Toggle Explorer",
        shortcut: "Ctrl+B",
        enabled: canTogglePanels,
        run: () => togglePanel("explorer"),
      },
      {
        id: "toggle-mission",
        label: "View: Toggle Mission",
        shortcut: "Ctrl+Shift+M",
        enabled: canTogglePanels,
        run: () => togglePanel("mission"),
      },
      {
        id: "toggle-inspector",
        label: "View: Toggle Inspector",
        shortcut: "Ctrl+Shift+I",
        enabled: canTogglePanels,
        run: () => togglePanel("inspector"),
      },
      {
        id: "toggle-console",
        label: "View: Toggle Developer Console",
        shortcut: "Ctrl+`",
        enabled: canTogglePanels,
        run: () => togglePanel("console"),
      },
      {
        id: "open-mcp-activity",
        label: "View: MCP Activity",
        enabled: canOpenMcp,
        run: () => {
          void openMcp();
        },
      },
      {
        id: "project-new",
        label: "Project: New…",
        enabled: canUseProjectMenus,
        run: () => setWizardMode("new"),
      },
      {
        id: "project-open",
        label: "Project: Open…",
        enabled: canUseProjectMenus,
        run: () => setWizardMode("open"),
      },
      {
        id: "project-recent",
        label: "Project: Recent",
        enabled: canUseProjectMenus,
        run: () => {
          if (openedProject) {
            setRequestClose(true);
            return;
          }
          setWizardMode(null);
        },
      },
      {
        id: "project-close",
        label: "Project: Close",
        enabled: Boolean(openedProject) && !setupLocked,
        run: () => setRequestClose(true),
      },
      {
        id: "project-settings",
        label: "Project: Settings",
        enabled: canOpenSettings,
        run: () => setWizardMode("settings"),
      },
      {
        id: "project-mappings",
        label: "Project: Environment mappings",
        enabled: canOpenSettings && Boolean(openedProject),
        run: () => setWizardMode("settings"),
      },
      ...CENTER_EDITOR_STUB_KINDS.map(
        (kind): CommandPaletteAction => ({
          id: `editor-open-${kind}`,
          label: `Editor: ${CENTER_EDITOR_STUB_META[kind].title}`,
          enabled: projectOpen,
          run: () => {
            setOpenCenterEditorKind(kind);
            setOpenCenterEditorRequest((token) => token + 1);
          },
        }),
      ),
    ];
    return actions;
  }, [
    canTogglePanels,
    canOpenMcp,
    canUseProjectMenus,
    canOpenSettings,
    openedProject,
    projectOpen,
    setupLocked,
    togglePanel,
    openMcp,
  ]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (matchCommandPaletteShortcut(event)) {
        event.preventDefault();
        setCommandPaletteOpen((open) => !open);
        return;
      }
      if (commandPaletteOpen && event.key === "Escape") {
        event.preventDefault();
        setCommandPaletteOpen(false);
        return;
      }
      if (commandPaletteOpen) {
        return;
      }
      const panel = matchPanelToggleShortcut(event);
      if (!panel || !canTogglePanels) {
        return;
      }
      event.preventDefault();
      togglePanel(panel);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canTogglePanels, togglePanel, commandPaletteOpen]);

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

  const view = new URLSearchParams(window.location.search).get("view");
  if (view === "mcp-activity") {
    return (
      <main className="ide-shell mcp-standalone">
        <McpActivityWindow
          open
          variant="window"
          onClose={() => {
            void (async () => {
              try {
                const { getCurrentWindow } = await import("@tauri-apps/api/window");
                await getCurrentWindow().close();
              } catch {
                window.close();
              }
            })();
          }}
          entries={activityEntries}
          connectionName={connectedConnection}
          activeSessionId={activeActivitySessionId}
        />
      </main>
    );
  }

  return (
    <div className="ide-shell">
      <header
        className="ide-menubar"
        role="menubar"
        aria-label="Application menu"
        onKeyDown={onMenubarKeyDown}
      >
        <div className="menu-group" role="group" aria-label="Project">
          <span className="menu-title">Project</span>
          <button
            type="button"
            role="menuitem"
            disabled={!canUseProjectMenus}
            title={
              setupLocked ? "Finish setup before creating a project." : "Create a new project"
            }
            onClick={() => setWizardMode("new")}
          >
            New…
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={!canUseProjectMenus}
            title={setupLocked ? "Finish setup before opening a project." : "Open a project folder"}
            onClick={() => setWizardMode("open")}
          >
            Open…
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={!canUseProjectMenus}
            title={setupLocked ? "Finish setup before browsing recent projects." : "Recent projects"}
            onClick={() => {
              if (openedProject) {
                setRequestClose(true);
                return;
              }
              setWizardMode(null);
            }}
          >
            Recent
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={!openedProject || setupLocked}
            onClick={() => setRequestClose(true)}
          >
            Close
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={!canOpenSettings}
            title={
              shellPhase === "preflight" || shellPhase === "booting"
                ? "Complete the prerequisite check first."
                : "Profile and app settings"
            }
            onClick={() => setWizardMode("settings")}
          >
            Settings
          </button>
        </div>
        <div className="menu-group" role="group" aria-label="View">
          <span className="menu-title">View</span>
          <button
            type="button"
            role="menuitemcheckbox"
            aria-checked={layout.showExplorer}
            disabled={!canTogglePanels}
            title="Toggle Explorer (Ctrl+B)"
            onClick={() => togglePanel("explorer")}
          >
            Explorer
          </button>
          <button
            type="button"
            role="menuitemcheckbox"
            aria-checked={layout.showMission}
            disabled={!canTogglePanels}
            title="Toggle Mission (Ctrl+Shift+M)"
            onClick={() => togglePanel("mission")}
          >
            Mission
          </button>
          <button
            type="button"
            role="menuitemcheckbox"
            aria-checked={layout.showInspector}
            disabled={!canTogglePanels}
            title="Toggle Inspector (Ctrl+Shift+I)"
            onClick={() => togglePanel("inspector")}
          >
            Inspector
          </button>
          <button
            type="button"
            role="menuitemcheckbox"
            aria-checked={layout.showConsole}
            disabled={!canTogglePanels}
            title="Toggle Developer Console (Ctrl+`)"
            onClick={() => togglePanel("console")}
          >
            Developer Console
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={!canOpenMcp}
            title={
              setupLocked
                ? "Finish setup before opening MCP Activity."
                : projectOpen
                  ? "Open MCP Activity in Developer Console"
                  : "MCP Activity (interim until a project is open)"
            }
            onClick={() => void openMcp()}
          >
            MCP Activity
            {connectedConnection && activityEntries.length > 0 ? (
              <span className="menu-count">{activityEntries.length}</span>
            ) : null}
          </button>
        </div>
        <div className="menu-spacer" />
        <span className="menu-brand">Apex Pilot</span>
      </header>

      <main className="ide-main">
        {projectOpen && openedProject ? (
          <IdeWorkspace
            backendConfig={backendConfig}
            backendStatus={backendStatus}
            isBackendOnline={isBackendOnline}
            connections={connections}
            openedProject={openedProject}
            onOpenedProjectChange={setOpenedProject}
            connectedConnection={connectedConnection}
            selectedConnection={selectedConnection}
            onSelectedConnectionChange={setSelectedConnection}
            onConnect={connectSelectedConnection}
            isConnecting={isConnecting}
            layout={layout}
            onLayoutChange={setLayout}
            activityCount={activityEntries.length}
            activityEntries={activityEntries}
            activeActivitySessionId={activeActivitySessionId}
            mcpFocusRequest={mcpFocusRequest}
            onMcpFocusHandled={handleMcpFocusHandled}
            onActivityRefresh={refreshActivity}
            onOpenMcp={() => void openMcp()}
            onOpenMappings={() => setWizardMode("settings")}
            sqlDirty={sqlDirty}
            onSqlDirtyChange={setSqlDirty}
            openCenterEditorKind={openCenterEditorKind}
            openCenterEditorRequest={openCenterEditorRequest}
          />
        ) : (
          <StartupFunnel
            backendConfig={backendConfig}
            isBackendOnline={isBackendOnline}
            connections={connections}
            openedProject={openedProject}
            onOpenedProjectChange={(project) => {
              setOpenedProject(project);
              if (project) {
                setSqlDirty(false);
              }
            }}
            onPhaseChange={setShellPhase}
            onProfilesChange={(_profiles, selected) => setProfileId(selected || null)}
            wizardMode={wizardMode}
            onWizardModeChange={setWizardMode}
          />
        )}
      </main>

      <footer className="ide-statusbar" aria-label="Status bar">
        <span>{statusLabel(backendStatus)}</span>
        <span>{connectionMessage}</span>
        <span>
          {openedProject
            ? `${openedProject.project.name} · ${openedProject.project.root_path}`
            : `Phase: ${shellPhase}`}
        </span>
        <span>
          {connectedConnection ? `DB: ${connectedConnection}` : "DB: not connected"}
          {isConnecting ? " · connecting…" : ""}
        </span>
      </footer>

      <McpActivityWindow
        open={mcpOpen}
        onClose={() => setMcpOpen(false)}
        entries={activityEntries}
        connectionName={connectedConnection}
        activeSessionId={activeActivitySessionId}
      />

      <CommandPalette
        key={commandPaletteOpen ? "open" : "closed"}
        open={commandPaletteOpen}
        actions={commandActions}
        onClose={() => setCommandPaletteOpen(false)}
      />
    </div>
  );
};
