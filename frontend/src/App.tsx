import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { AboutDialog, UpdatesDialog } from "./UpdatesDialog";
import { BrowserAppMenu } from "./BrowserAppMenu";
import { CommandPalette } from "./CommandPalette";
import { CompareProjectToDatabaseDialog } from "./CompareProjectToDatabaseDialog";
import {
  matchCommandPaletteShortcut,
  type CommandPaletteAction,
} from "./commandPaletteModel";
import {
  CENTER_EDITOR_STUB_KINDS,
  CENTER_EDITOR_STUB_META,
  type CenterEditorStubKind,
} from "./centerEditors";
import { McpActivityWindow, openMcpActivityWindow } from "./McpActivityWindow";
import {
  DEFAULT_FOCUS_MODE,
  FOCUS_MODES,
  focusModeLabel,
  type FocusMode,
} from "./focusMode";
import { IdeWorkspace } from "./IdeWorkspace";
import { matchPanelToggleShortcut } from "./panelLayout";
import {
  type ProfileLayoutPrefs,
  loadProfileLayout,
  saveProfileLayout,
  togglePanelVisibility,
} from "./prefs";
import { StartupFunnel, type WizardMode } from "./StartupFunnel";
import { isTauriRuntime, type AppMenuHandlers, type AppMenuState } from "./appMenuModel";
import { useNativeAppMenu } from "./useNativeAppMenu";
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
      return "Backend: Healthy";
    case "offline":
      return "Backend: Offline";
  }
};

// Survives React StrictMode remounts (component refs reset). Concurrent SQLcl
// MCP connect calls return "Unsupported Connection" and kill the stdio session.
let connectInFlight = false;

/** Test-only: clear the sync connect lock between cases. */
export const resetConnectGuardsForTests = (): void => {
  connectInFlight = false;
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
  const [focusMode, setFocusMode] = useState<FocusMode>(DEFAULT_FOCUS_MODE);
  const [focusModeProjectId, setFocusModeProjectId] = useState<string | null>(null);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [updatesOpen, setUpdatesOpen] = useState(false);
  const [compareProjectDbOpen, setCompareProjectDbOpen] = useState(false);

  const openedProjectId = openedProject?.project.project_id ?? null;
  if (openedProjectId !== focusModeProjectId) {
    setFocusModeProjectId(openedProjectId);
    setFocusMode(DEFAULT_FOCUS_MODE);
  }

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
  const canCloseProject = Boolean(openedProject) && !setupLocked;
  const canCompareProjectToDatabase =
    projectOpen && Boolean(connectedConnection || selectedConnection.trim());
  const nativeAppMenu = isTauriRuntime();

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
    const focusActions: CommandPaletteAction[] = FOCUS_MODES.map((mode) => ({
      id: `focus-mode-${mode}`,
      label: `Focus Mode: ${focusModeLabel(mode)}`,
      enabled: projectOpen,
      run: () => setFocusMode(mode),
    }));
    const actions: CommandPaletteAction[] = [
      ...focusActions,
      {
        id: "toggle-explorer",
        label: "Layout: Toggle Explorer",
        shortcut: "Ctrl+B",
        enabled: canTogglePanels,
        run: () => togglePanel("explorer"),
      },
      {
        id: "toggle-mission",
        label: "Layout: Toggle Mission",
        shortcut: "Ctrl+Shift+M",
        enabled: canTogglePanels,
        run: () => togglePanel("mission"),
      },
      {
        id: "toggle-inspector",
        label: "Layout: Toggle Inspector",
        shortcut: "Ctrl+Shift+I",
        enabled: canTogglePanels,
        run: () => togglePanel("inspector"),
      },
      {
        id: "toggle-console",
        label: "Layout: Toggle Developer Console",
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
        id: "file-new",
        label: "File: New…",
        enabled: canUseProjectMenus,
        run: () => setWizardMode("new"),
      },
      {
        id: "file-open",
        label: "File: Open…",
        enabled: canUseProjectMenus,
        run: () => setWizardMode("open"),
      },
      {
        id: "file-recent",
        label: "File: Recent",
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
        id: "file-close",
        label: "File: Close Project",
        enabled: canCloseProject,
        run: () => setRequestClose(true),
      },
      {
        id: "file-settings",
        label: "File: Settings",
        enabled: canOpenSettings,
        run: () => setWizardMode("settings"),
      },
      {
        id: "help-about",
        label: "Help: About Apex Pilot",
        run: () => setAboutOpen(true),
      },
      {
        id: "help-updates",
        label: "Help: Check for updates…",
        run: () => setUpdatesOpen(true),
      },
      {
        id: "help-compare-project-db",
        label: "Help: Compare project to database…",
        enabled: canCompareProjectToDatabase,
        run: () => setCompareProjectDbOpen(true),
      },
      {
        id: "project-mappings",
        label: "Settings: Environment mappings",
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
    canCloseProject,
    canCompareProjectToDatabase,
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

  const appMenuState: AppMenuState = {
    canUseProjectMenus,
    canOpenSettings,
    canOpenMcp,
    canTogglePanels,
    canCloseProject,
    canCompareProjectToDatabase,
    projectOpen,
    focusMode,
    layout,
    mcpActivityCount: connectedConnection ? activityEntries.length : 0,
  };

  const appMenuHandlers: AppMenuHandlers = {
    onNewProject: () => setWizardMode("new"),
    onOpenProject: () => setWizardMode("open"),
    onRecentProjects: () => {
      if (openedProject) {
        setRequestClose(true);
        return;
      }
      setWizardMode(null);
    },
    onCloseProject: () => setRequestClose(true),
    onSettings: () => setWizardMode("settings"),
    onOpenMcp: () => {
      void openMcp();
    },
    onTogglePanel: togglePanel,
    onFocusMode: setFocusMode,
    onAbout: () => setAboutOpen(true),
    onDocs: () => undefined,
    onShortcuts: () => setCommandPaletteOpen(true),
    onUpdates: () => setUpdatesOpen(true),
    onCompareProjectToDatabase: () => setCompareProjectDbOpen(true),
  };

  useNativeAppMenu({
    enabled: nativeAppMenu,
    state: appMenuState,
    handlers: appMenuHandlers,
  });

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
      {nativeAppMenu ? null : <BrowserAppMenu state={appMenuState} handlers={appMenuHandlers} />}

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
            onOpenSettings={() => setWizardMode("settings")}
            sqlDirty={sqlDirty}
            onSqlDirtyChange={setSqlDirty}
            openCenterEditorKind={openCenterEditorKind}
            openCenterEditorRequest={openCenterEditorRequest}
            focusMode={focusMode}
            onFocusModeChange={setFocusMode}
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

      <AboutDialog open={aboutOpen} onClose={() => setAboutOpen(false)} />
      <UpdatesDialog open={updatesOpen} onClose={() => setUpdatesOpen(false)} />
      <CompareProjectToDatabaseDialog
        open={compareProjectDbOpen}
        onClose={() => setCompareProjectDbOpen(false)}
      />
    </div>
  );
};
