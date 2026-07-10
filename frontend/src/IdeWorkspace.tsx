import { useEffect, useRef, useState } from "react";

import { ChatPane } from "./ChatPane";
import { FileTree } from "./FileTree";
import { SchemaBrowser } from "./SchemaBrowser";
import { SqlSheet } from "./SqlSheet";
import { ProjectMappings } from "./StartupFunnel";
import {
  type BackendConfig,
  type OpenedProject,
  type SavedConnection,
  type SchemaSummary,
} from "./backend";
import {
  type ProfileLayoutPrefs,
  loadProfileLayout,
  loadProjectDefaults,
  loadProjectTabs,
  saveProfileLayout,
  saveProjectDefaults,
  saveProjectTabs,
} from "./prefs";
import { type FileTreeNode, joinPath, readTextFile } from "./projectFs";

type WorkspaceTab = Readonly<{
  id: string;
  kind: "schema" | "sql" | "file" | "mappings";
  title: string;
  path?: string;
  content?: string;
}>;

type IdeWorkspaceProps = Readonly<{
  backendConfig: BackendConfig;
  isBackendOnline: boolean;
  connections: SavedConnection[];
  openedProject: OpenedProject;
  onOpenedProjectChange: (project: OpenedProject | null) => void;
  connectedConnection: string | null;
  selectedConnection: string;
  onSelectedConnectionChange: (name: string) => void;
  onConnect: (connectionName?: string) => Promise<void> | void;
  isConnecting: boolean;
  profileId: string | null;
  onActivityRefresh: () => Promise<void>;
  sqlDirty: boolean;
  onSqlDirtyChange: (dirty: boolean) => void;
}>;

const defaultSchemaFromManifest = (openedProject: OpenedProject): string | null => {
  const manifest = openedProject.manifest as {
    defaultEnvironment?: string;
    environments?: ReadonlyArray<{ name?: string; defaultSchema?: string }>;
  };
  const environments = manifest.environments ?? [];
  const defaultEnvName = manifest.defaultEnvironment;
  const preferred =
    environments.find((env) => env.name === defaultEnvName) ?? environments[0] ?? null;
  const schema = preferred?.defaultSchema?.trim();
  return schema ? schema.toUpperCase() : null;
};

const defaultConnectionFromMappings = (openedProject: OpenedProject): string | null => {
  const manifest = openedProject.manifest as {
    defaultEnvironment?: string;
  };
  const defaultEnv = manifest.defaultEnvironment;
  if (defaultEnv) {
    const mapped = openedProject.environment_mappings.find(
      (item) => item.environment_name === defaultEnv,
    );
    if (mapped?.sqlcl_connection_name) {
      return mapped.sqlcl_connection_name;
    }
  }
  return openedProject.environment_mappings[0]?.sqlcl_connection_name ?? null;
};

export const IdeWorkspace = ({
  backendConfig,
  isBackendOnline,
  connections,
  openedProject,
  onOpenedProjectChange,
  connectedConnection,
  selectedConnection,
  onSelectedConnectionChange,
  onConnect,
  isConnecting,
  profileId,
  onActivityRefresh,
  sqlDirty,
  onSqlDirtyChange,
}: IdeWorkspaceProps) => {
  const [layout, setLayout] = useState<ProfileLayoutPrefs>(() => loadProfileLayout(profileId));
  const [tabs, setTabs] = useState<WorkspaceTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [workingSchema, setWorkingSchema] = useState("");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const autoConnectKey = useRef<string | null>(null);

  useEffect(() => {
    setLayout(loadProfileLayout(profileId));
  }, [profileId]);

  useEffect(() => {
    const saved = loadProjectTabs(openedProject.project.project_id);
    const defaults = loadProjectDefaults(openedProject.project.project_id);
    const restored: WorkspaceTab[] =
      saved.openTabs.length > 0
        ? saved.openTabs.map((tab) => ({
            id: tab.id,
            kind: tab.kind,
            title: tab.title,
            path: tab.path,
          }))
        : [
            { id: "schema", kind: "schema", title: "Schema" },
            { id: "sql", kind: "sql", title: "SQL Sheet" },
            { id: "mappings", kind: "mappings", title: "Mappings" },
          ];
    setTabs(restored);
    setActiveTabId(saved.activeTabId ?? restored[0]?.id ?? null);

    const schema =
      defaults.schemaName ??
      defaultSchemaFromManifest(openedProject) ??
      "";
    setWorkingSchema(schema);

    const connection =
      defaults.connectionName ??
      defaultConnectionFromMappings(openedProject) ??
      "";
    if (connection) {
      onSelectedConnectionChange(connection);
    }
    autoConnectKey.current = null;
  }, [openedProject, onSelectedConnectionChange]);

  useEffect(() => {
    if (!profileId) {
      return;
    }
    saveProfileLayout(profileId, layout);
  }, [layout, profileId]);

  useEffect(() => {
    saveProjectTabs(openedProject.project.project_id, {
      openTabs: tabs.map((tab) => ({
        id: tab.id,
        kind: tab.kind,
        title: tab.title,
        path: tab.path,
      })),
      activeTabId,
    });
  }, [activeTabId, openedProject.project.project_id, tabs]);

  useEffect(() => {
    if (!isBackendOnline || isConnecting || connections.length === 0) {
      return;
    }
    const defaults = loadProjectDefaults(openedProject.project.project_id);
    const targetConnection =
      defaults.connectionName ?? defaultConnectionFromMappings(openedProject);
    if (!targetConnection) {
      return;
    }
    const key = `${openedProject.project.project_id}:${targetConnection}`;
    if (autoConnectKey.current === key) {
      return;
    }
    if (connectedConnection === targetConnection) {
      autoConnectKey.current = key;
      return;
    }
    autoConnectKey.current = key;
    if (selectedConnection !== targetConnection) {
      onSelectedConnectionChange(targetConnection);
    }
    void onConnect(targetConnection);
  }, [
    connections.length,
    connectedConnection,
    isBackendOnline,
    isConnecting,
    onConnect,
    onSelectedConnectionChange,
    openedProject,
    selectedConnection,
  ]);

  const persistWorkspaceDefaults = (connectionName: string | null, schemaName: string | null) => {
    saveProjectDefaults(openedProject.project.project_id, {
      connectionName,
      schemaName: schemaName?.trim() ? schemaName.trim().toUpperCase() : null,
    });
  };

  const handleWorkingSchemaChange = (schema: string) => {
    const next = schema.toUpperCase();
    setWorkingSchema(next);
    persistWorkspaceDefaults((connectedConnection ?? selectedConnection) || null, next || null);
  };

  const openOrFocus = (tab: WorkspaceTab) => {
    setTabs((current) => (current.some((item) => item.id === tab.id) ? current : [...current, tab]));
    setActiveTabId(tab.id);
  };

  const closeTab = (tabId: string) => {
    setTabs((current) => {
      const next = current.filter((tab) => tab.id !== tabId);
      if (activeTabId === tabId) {
        setActiveTabId(next[0]?.id ?? null);
      }
      return next;
    });
  };

  const onOpenFile = (node: FileTreeNode) => {
    if (node.protected) {
      const proceed = window.confirm(
        `${node.name} looks like an Oracle APEX export artifact. Open read-only in a tab anyway?`,
      );
      if (!proceed) {
        return;
      }
    }
    void (async () => {
      let content = "";
      try {
        content = await readTextFile(node.path);
      } catch (error) {
        content = error instanceof Error ? error.message : "Could not read file.";
      }
      openOrFocus({
        id: `file:${node.path}`,
        kind: "file",
        title: node.name,
        path: node.path,
        content,
      });
    })();
  };

  const saveSchemaSummary = async (summary: SchemaSummary) => {
    const defaultName = `${summary.schema_name.toLowerCase()}-schema-summary.json`;
    const defaultPath = joinPath(openedProject.project.root_path, defaultName);
    persistWorkspaceDefaults(
      (connectedConnection ?? selectedConnection) || null,
      summary.schema_name,
    );
    setWorkingSchema(summary.schema_name);

    const runtime = window as Window & { __TAURI_INTERNALS__?: unknown };
    if (!runtime.__TAURI_INTERNALS__) {
      setSaveMessage(
        "Save to project needs the Tauri desktop shell (not browser Vite). Defaults were still saved for reconnect.",
      );
      return;
    }

    try {
      const { save } = await import("@tauri-apps/plugin-dialog");
      const { writeTextFile } = await import("@tauri-apps/plugin-fs");
      const target = await save({
        defaultPath,
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (typeof target !== "string") {
        setSaveMessage("Save cancelled. Project connection/schema defaults were still updated.");
        return;
      }
      await writeTextFile(target, JSON.stringify(summary, null, 2));
      setSaveMessage(`Saved schema summary to ${target}`);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      setSaveMessage(`Could not write schema summary file: ${detail}`);
    }
  };

  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? null;

  return (
    <div
      className="ide-workspace"
      style={{
        ["--left-width" as string]: `${layout.leftWidth}px`,
        ["--right-width" as string]: `${layout.rightWidth}px`,
      }}
    >
      <FileTree
        rootPath={openedProject.project.root_path}
        showJunk={layout.showJunkFiles}
        onToggleJunk={() =>
          setLayout((current) => ({ ...current, showJunkFiles: !current.showJunkFiles }))
        }
        onOpenFile={onOpenFile}
      />

      <ChatPane projectName={openedProject.project.name} />

      <aside className="ide-pane ide-pane--right" aria-label="Tools">
        <div className="pane-header pane-header--tabs">
          <div className="tab-strip" role="tablist" aria-label="Tool tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={tab.id === activeTabId}
                className={tab.id === activeTabId ? "tab tab--active" : "tab"}
                onClick={() => setActiveTabId(tab.id)}
              >
                {tab.title}
                {tab.kind === "file" ? (
                  <span
                    className="tab-close"
                    onClick={(event) => {
                      event.stopPropagation();
                      closeTab(tab.id);
                    }}
                  >
                    ×
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </div>

        <div className="connection-strip">
          <label htmlFor="workspace-connection">
            Connection
            <select
              id="workspace-connection"
              value={selectedConnection}
              onChange={(event) => onSelectedConnectionChange(event.target.value)}
              disabled={!isBackendOnline || isConnecting || connections.length === 0}
            >
              {connections.length === 0 ? <option value="">No connections</option> : null}
              {connections.map((connection) => (
                <option key={connection.name} value={connection.name}>
                  {connection.display_name
                    ? `${connection.display_name} (${connection.name})`
                    : connection.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => void onConnect()}
            disabled={!isBackendOnline || isConnecting || !selectedConnection}
            aria-busy={isConnecting}
          >
            {isConnecting
              ? "Connecting…"
              : connectedConnection === selectedConnection
                ? "Connected · Reconnect"
                : connectedConnection
                  ? "Switch connection"
                  : "Connect"}
          </button>
          <span
            className={
              connectedConnection
                ? "connection-state connection-state--ok"
                : "connection-state"
            }
            role="status"
          >
            {isConnecting
              ? `Connecting to ${selectedConnection}…`
              : connectedConnection
                ? `Connected: ${connectedConnection}${workingSchema ? ` · schema ${workingSchema}` : ""}`
                : "Not connected"}
          </span>
        </div>
        {saveMessage ? <p className="pane-muted connection-strip-message">{saveMessage}</p> : null}

        <div className="pane-body">
          {activeTab?.kind === "schema" ? (
            <SchemaBrowser
              backendConfig={backendConfig}
              connectedConnection={connectedConnection}
              isBackendOnline={isBackendOnline}
              workingSchema={workingSchema}
              onWorkingSchemaChange={handleWorkingSchemaChange}
              onActivityRefresh={onActivityRefresh}
              onSaveSummary={(summary) => void saveSchemaSummary(summary)}
            />
          ) : null}
          {activeTab?.kind === "sql" ? (
            <SqlSheet
              backendConfig={backendConfig}
              connectedConnection={connectedConnection}
              workingSchema={workingSchema}
              isBackendOnline={isBackendOnline}
              skipDestructivePrompt={layout.skipDestructiveSqlPrompt}
              dirty={sqlDirty}
              onDirtyChange={onSqlDirtyChange}
              onActivityRefresh={onActivityRefresh}
            />
          ) : null}
          {activeTab?.kind === "mappings" ? (
            <ProjectMappings
              backendConfig={backendConfig}
              connections={connections}
              openedProject={openedProject}
              onOpenedProjectChange={onOpenedProjectChange}
            />
          ) : null}
          {activeTab?.kind === "file" ? (
            <div className="file-preview">
              <p className="pane-muted">{activeTab.path}</p>
              <pre>{activeTab.content}</pre>
            </div>
          ) : null}
          {!activeTab ? <p className="pane-muted">Open a tool tab.</p> : null}
        </div>
      </aside>
    </div>
  );
};
