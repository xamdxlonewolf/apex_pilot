import { useEffect, useState } from "react";

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
  loadProjectTabs,
  saveProfileLayout,
  saveProjectTabs,
} from "./prefs";
import { type FileTreeNode, readTextFile } from "./projectFs";

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
  onConnect: () => void;
  isConnecting: boolean;
  profileId: string | null;
  onActivityRefresh: () => Promise<void>;
  sqlDirty: boolean;
  onSqlDirtyChange: (dirty: boolean) => void;
}>;

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

  useEffect(() => {
    setLayout(loadProfileLayout(profileId));
  }, [profileId]);

  useEffect(() => {
    const saved = loadProjectTabs(openedProject.project.project_id);
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
  }, [openedProject.project.project_id]);

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
    const runtime = window as Window & { __TAURI_INTERNALS__?: unknown };
    if (runtime.__TAURI_INTERNALS__) {
      try {
        const { save } = await import("@tauri-apps/plugin-dialog");
        const { writeTextFile } = await import("@tauri-apps/plugin-fs");
        const target = await save({
          defaultPath: `${openedProject.project.root_path}/${defaultName}`,
          filters: [{ name: "JSON", extensions: ["json"] }],
        });
        if (typeof target === "string") {
          await writeTextFile(target, JSON.stringify(summary, null, 2));
        }
        return;
      } catch {
        // Fall through to prompt fallback.
      }
    }
    const target = window.prompt("Save schema summary path", defaultName);
    if (target) {
      console.info("Schema summary (copy manually in browser mode):", summary);
      window.alert(`Browser mode cannot write files. Intended path: ${target}`);
    }
  };

  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? null;

  return (
    <div className="ide-workspace" style={{ ["--left-width" as string]: `${layout.leftWidth}px`, ["--right-width" as string]: `${layout.rightWidth}px` }}>
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
            onClick={onConnect}
            disabled={!isBackendOnline || isConnecting || !selectedConnection}
            aria-busy={isConnecting}
          >
            {isConnecting ? "Connecting…" : connectedConnection ? "Reconnect" : "Connect"}
          </button>
          <label className="chrome-check">
            <input
              type="checkbox"
              checked={layout.skipDestructiveSqlPrompt}
              onChange={(event) =>
                setLayout((current) => ({
                  ...current,
                  skipDestructiveSqlPrompt: event.target.checked,
                }))
              }
            />
            Skip destructive SQL prompts
          </label>
        </div>

        <div className="pane-body">
          {activeTab?.kind === "schema" ? (
            <SchemaBrowser
              backendConfig={backendConfig}
              connectedConnection={connectedConnection}
              isBackendOnline={isBackendOnline}
              onActivityRefresh={onActivityRefresh}
              onSaveSummary={(summary) => void saveSchemaSummary(summary)}
            />
          ) : null}
          {activeTab?.kind === "sql" ? (
            <SqlSheet
              backendConfig={backendConfig}
              connectedConnection={connectedConnection}
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
