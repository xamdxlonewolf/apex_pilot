import { useCallback, useEffect, useState } from "react";

import { McpActivityWindow, openMcpActivityWindow } from "./McpActivityWindow";
import { IdeWorkspace } from "./IdeWorkspace";
import { StartupFunnel, type WizardMode } from "./StartupFunnel";
import {
  type ActivityEntry,
  type BackendConfig,
  type BackendStatus,
  type OpenedProject,
  type SavedConnection,
  checkBackendHealth,
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
  const [openedProject, setOpenedProject] = useState<OpenedProject | null>(null);
  const [wizardMode, setWizardMode] = useState<WizardMode | null>(null);
  const [requestClose, setRequestClose] = useState(false);
  const [sqlDirty, setSqlDirty] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [shellPhase, setShellPhase] = useState("booting");

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

  const openMcp = async () => {
    const openedNative = await openMcpActivityWindow();
    if (!openedNative) {
      setMcpOpen(true);
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
      <header className="ide-menubar" role="menubar" aria-label="Application menu">
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
            role="menuitem"
            disabled={!canOpenMcp}
            title={setupLocked ? "Finish setup before opening MCP Activity." : "MCP Activity"}
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
            profileId={profileId}
            activityCount={activityEntries.length}
            activeActivitySessionId={activeActivitySessionId}
            onActivityRefresh={refreshActivity}
            onOpenMcp={() => void openMcp()}
            sqlDirty={sqlDirty}
            onSqlDirtyChange={setSqlDirty}
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
            requestClose={requestClose}
            onCloseHandled={() => setRequestClose(false)}
            hasUnsavedWork={sqlDirty}
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
    </div>
  );
};
