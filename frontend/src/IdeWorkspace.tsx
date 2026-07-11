import { useEffect, useState, type PointerEvent as ReactPointerEvent } from "react";

import { DeveloperConsole } from "./DeveloperConsole";
import { FileTree } from "./FileTree";
import { MissionComposer } from "./MissionComposer";
import { SchemaBrowser } from "./SchemaBrowser";
import { SqlSheet } from "./SqlSheet";
import { ProjectMappings } from "./StartupFunnel";
import {
  type BackendConfig,
  type BackendStatus,
  type OpenedProject,
  type SavedConnection,
  type SchemaSummary,
} from "./backend";
import {
  clampConsoleHeight,
  clampExplorerWidth,
  clampInspectorWidth,
} from "./panelLayout";
import { type ProfileLayoutPrefs, loadProjectDefaults, loadProjectTabs, saveProjectDefaults, saveProjectTabs, type WorkspaceTabKind } from "./prefs";
import { type FileTreeNode, joinPath, readTextFile } from "./projectFs";
import {
  backendHealthLabel,
  connectionHealthLabel,
  environmentIdentity,
  mcpHealthLabel,
} from "./shellHealth";
import { stubActionProps } from "./stubConvention";

type WorkspaceTab = Readonly<{
  id: string;
  kind: WorkspaceTabKind;
  title: string;
  path?: string;
  content?: string;
}>;

const CENTER_TAB_KINDS = new Set<WorkspaceTabKind>(["mission", "sql"]);
const INSPECTOR_TAB_KINDS = new Set<WorkspaceTabKind>(["schema", "mappings", "file"]);

const isCenterTab = (tab: WorkspaceTab): boolean => CENTER_TAB_KINDS.has(tab.kind);
const isInspectorTab = (tab: WorkspaceTab): boolean => INSPECTOR_TAB_KINDS.has(tab.kind);

const defaultCenterTabs = (): WorkspaceTab[] => [
  { id: "mission", kind: "mission", title: "Mission" },
  { id: "sql", kind: "sql", title: "SQL Editor" },
];

const defaultInspectorTabs = (): WorkspaceTab[] => [
  { id: "schema", kind: "schema", title: "Schema" },
  { id: "mappings", kind: "mappings", title: "Mappings" },
];

const restoreWorkspaceTabs = (
  saved: ReturnType<typeof loadProjectTabs>,
): Readonly<{
  tabs: WorkspaceTab[];
  activeCenterTabId: string | null;
  activeInspectorTabId: string | null;
}> => {
  const restored: WorkspaceTab[] =
    saved.openTabs.length > 0
      ? saved.openTabs
          .filter((tab) => CENTER_TAB_KINDS.has(tab.kind) || INSPECTOR_TAB_KINDS.has(tab.kind))
          .map((tab) => ({
            id: tab.id,
            kind: tab.kind,
            title: tab.kind === "sql" ? "SQL Editor" : tab.title,
            path: tab.path,
          }))
      : [...defaultCenterTabs(), ...defaultInspectorTabs()];

  let tabs = restored;
  if (!tabs.some((tab) => tab.kind === "mission")) {
    tabs = [...defaultCenterTabs().filter((tab) => tab.kind === "mission"), ...tabs];
  }
  if (!tabs.some((tab) => tab.kind === "sql")) {
    tabs = [
      ...tabs.filter(isCenterTab),
      ...defaultCenterTabs().filter((tab) => tab.kind === "sql"),
      ...tabs.filter(isInspectorTab),
    ];
  }
  if (!tabs.some((tab) => tab.kind === "schema")) {
    tabs = [...tabs, ...defaultInspectorTabs().filter((tab) => tab.kind === "schema")];
  }
  if (!tabs.some((tab) => tab.kind === "mappings")) {
    tabs = [...tabs, ...defaultInspectorTabs().filter((tab) => tab.kind === "mappings")];
  }

  const centerTabs = tabs.filter(isCenterTab);
  const inspectorTabs = tabs.filter(isInspectorTab);
  const centerIds = new Set(centerTabs.map((tab) => tab.id));
  const inspectorIds = new Set(inspectorTabs.map((tab) => tab.id));

  const activeCenterTabId =
    (saved.activeCenterTabId && centerIds.has(saved.activeCenterTabId)
      ? saved.activeCenterTabId
      : null) ??
    (saved.activeTabId && centerIds.has(saved.activeTabId) ? saved.activeTabId : null) ??
    centerTabs[0]?.id ??
    null;

  const activeInspectorTabId =
    (saved.activeInspectorTabId && inspectorIds.has(saved.activeInspectorTabId)
      ? saved.activeInspectorTabId
      : null) ??
    (saved.activeTabId && inspectorIds.has(saved.activeTabId) ? saved.activeTabId : null) ??
    inspectorTabs[0]?.id ??
    null;

  return { tabs, activeCenterTabId, activeInspectorTabId };
};

type IdeWorkspaceProps = Readonly<{
  backendConfig: BackendConfig;
  backendStatus: BackendStatus;
  isBackendOnline: boolean;
  connections: SavedConnection[];
  openedProject: OpenedProject;
  onOpenedProjectChange: (project: OpenedProject | null) => void;
  connectedConnection: string | null;
  selectedConnection: string;
  onSelectedConnectionChange: (name: string) => void;
  onConnect: (connectionName?: string) => Promise<void> | void;
  isConnecting: boolean;
  layout: ProfileLayoutPrefs;
  onLayoutChange: (
    next: ProfileLayoutPrefs | ((current: ProfileLayoutPrefs) => ProfileLayoutPrefs),
  ) => void;
  activityCount: number;
  activeActivitySessionId: string | null;
  onActivityRefresh: () => Promise<void>;
  onOpenMcp: () => void;
  sqlDirty: boolean;
  onSqlDirtyChange: (dirty: boolean) => void;
}>;

// Survives StrictMode remounts; component refs alone do not.
const autoConnectStarted = new Set<string>();
const reducedMotionQuery = "(prefers-reduced-motion: reduce)";
const prefersReducedMotion = (): boolean =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia(reducedMotionQuery).matches;

/** Test-only: clear auto-connect dedupe so cases can re-trigger. */
export const resetAutoConnectGuardsForTests = (): void => {
  autoConnectStarted.clear();
};

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

type SplitAxis = "explorer" | "inspector" | "console";

const PanelSplitter = ({
  axis,
  label,
  onDelta,
}: Readonly<{
  axis: SplitAxis;
  label: string;
  onDelta: (delta: number) => void;
}>) => {
  const vertical = axis !== "console";

  const startDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    const target = event.currentTarget;
    const pointerId = event.pointerId;
    const origin = vertical ? event.clientX : event.clientY;
    target.setPointerCapture(pointerId);

    let last = origin;
    const onMove = (moveEvent: PointerEvent) => {
      const current = vertical ? moveEvent.clientX : moveEvent.clientY;
      onDelta(current - last);
      last = current;
    };
    const onUp = () => {
      target.releasePointerCapture(pointerId);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return (
    <button
      type="button"
      className={
        vertical
          ? "panel-splitter panel-splitter--vertical"
          : "panel-splitter panel-splitter--horizontal"
      }
      aria-label={label}
      aria-orientation={vertical ? "vertical" : "horizontal"}
      onPointerDown={startDrag}
      onKeyDown={(event) => {
        const step = event.shiftKey ? 24 : 8;
        if (vertical && event.key === "ArrowLeft") {
          event.preventDefault();
          onDelta(-step);
        } else if (vertical && event.key === "ArrowRight") {
          event.preventDefault();
          onDelta(step);
        } else if (!vertical && event.key === "ArrowUp") {
          event.preventDefault();
          onDelta(-step);
        } else if (!vertical && event.key === "ArrowDown") {
          event.preventDefault();
          onDelta(step);
        }
      }}
    />
  );
};

export const IdeWorkspace = ({
  backendConfig,
  backendStatus,
  isBackendOnline,
  connections,
  openedProject,
  onOpenedProjectChange,
  connectedConnection,
  selectedConnection,
  onSelectedConnectionChange,
  onConnect,
  isConnecting,
  layout,
  onLayoutChange,
  activityCount,
  activeActivitySessionId,
  onActivityRefresh,
  onOpenMcp,
  sqlDirty,
  onSqlDirtyChange,
}: IdeWorkspaceProps) => {
  const projectId = openedProject.project.project_id;
  const [tabsProjectId, setTabsProjectId] = useState<string | null>(null);
  const [tabs, setTabs] = useState<WorkspaceTab[]>([]);
  const [activeCenterTabId, setActiveCenterTabId] = useState<string | null>(null);
  const [activeInspectorTabId, setActiveInspectorTabId] = useState<string | null>(null);
  const [workingSchema, setWorkingSchema] = useState("");
  const [projectSchemaOverride, setProjectSchemaOverride] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [reduceMotion, setReduceMotion] = useState(prefersReducedMotion);

  if (projectId !== tabsProjectId) {
    const saved = loadProjectTabs(projectId);
    const defaults = loadProjectDefaults(projectId);
    const restored = restoreWorkspaceTabs(saved);
    const schema = defaults.schemaName ?? defaultSchemaFromManifest(openedProject) ?? null;
    setTabsProjectId(projectId);
    setTabs(restored.tabs);
    setActiveCenterTabId(restored.activeCenterTabId);
    setActiveInspectorTabId(restored.activeInspectorTabId);
    setProjectSchemaOverride(schema);
    setWorkingSchema(schema ?? "");
    setSaveMessage(null);
  }

  useEffect(() => {
    const defaults = loadProjectDefaults(openedProject.project.project_id);
    const connection =
      defaults.connectionName ?? defaultConnectionFromMappings(openedProject) ?? "";
    if (connection) {
      onSelectedConnectionChange(connection);
    }
  }, [openedProject, onSelectedConnectionChange]);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      return;
    }
    const media = window.matchMedia(reducedMotionQuery);
    const onChange = (event: MediaQueryListEvent) => {
      setReduceMotion(event.matches);
    };
    setReduceMotion(media.matches);
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    }
    media.addListener(onChange);
    return () => media.removeListener(onChange);
  }, []);

  useEffect(() => {
    saveProjectTabs(openedProject.project.project_id, {
      openTabs: tabs.map((tab) => ({
        id: tab.id,
        kind: tab.kind,
        title: tab.title,
        path: tab.path,
      })),
      activeTabId: activeCenterTabId ?? activeInspectorTabId,
      activeCenterTabId,
      activeInspectorTabId,
    });
  }, [activeCenterTabId, activeInspectorTabId, openedProject.project.project_id, tabs]);

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
    if (autoConnectStarted.has(key)) {
      return;
    }
    if (connectedConnection === targetConnection) {
      autoConnectStarted.add(key);
      return;
    }
    autoConnectStarted.add(key);
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

  const handleWorkingSchemaChange = (
    schema: string,
    options: Readonly<{ persist?: boolean }> = {},
  ) => {
    const next = schema.toUpperCase();
    setWorkingSchema(next);
    // Login auto-detect must not overwrite a project schema override (or invent one).
    if (options.persist === false) {
      return;
    }
    setProjectSchemaOverride(next || null);
    persistWorkspaceDefaults((connectedConnection ?? selectedConnection) || null, next || null);
  };

  const openOrFocus = (tab: WorkspaceTab) => {
    setTabs((current) => (current.some((item) => item.id === tab.id) ? current : [...current, tab]));
    if (isCenterTab(tab)) {
      setActiveCenterTabId(tab.id);
    } else {
      setActiveInspectorTabId(tab.id);
    }
  };

  const closeTab = (tabId: string) => {
    setTabs((current) => {
      const closing = current.find((tab) => tab.id === tabId);
      const next = current.filter((tab) => tab.id !== tabId);
      if (closing && isCenterTab(closing) && activeCenterTabId === tabId) {
        setActiveCenterTabId(next.find(isCenterTab)?.id ?? null);
      }
      if (closing && isInspectorTab(closing) && activeInspectorTabId === tabId) {
        setActiveInspectorTabId(next.find(isInspectorTab)?.id ?? null);
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
      let content: string;
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
    setProjectSchemaOverride(summary.schema_name);
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

  const centerTabs = tabs.filter(isCenterTab);
  const inspectorTabs = tabs.filter(isInspectorTab);
  const activeCenterTab = centerTabs.find((tab) => tab.id === activeCenterTabId) ?? null;
  const activeInspectorTab =
    inspectorTabs.find((tab) => tab.id === activeInspectorTabId) ?? null;
  const backendHealth = backendHealthLabel(backendStatus);
  const mcpHealth = mcpHealthLabel(activityCount, Boolean(activeActivitySessionId));
  const connectionHealth = connectionHealthLabel(connectedConnection, isConnecting);
  const environment = environmentIdentity(openedProject.manifest);

  const bodyColumns = [
    layout.showExplorer ? `${layout.leftWidth}px` : null,
    // Spec §17 Conversation minimum width when Mission is visible.
    layout.showMission ? "minmax(600px, 1fr)" : null,
    layout.showInspector ? `${layout.rightWidth}px` : null,
  ]
    .filter(Boolean)
    .join(" ");

  const consoleHeight = layout.showConsole ? layout.consoleHeight : 0;

  return (
    <div
      className={
        layout.showConsole ? "ide-workspace ide-workspace--console-open" : "ide-workspace"
      }
      data-density={layout.density}
      data-motion={reduceMotion ? "reduced" : "standard"}
      style={{
        ["--left-width" as string]: `${layout.leftWidth}px`,
        ["--right-width" as string]: `${layout.rightWidth}px`,
        ["--console-height" as string]: `${consoleHeight}px`,
      }}
    >
      <div
        className="ide-toolbar"
        role="toolbar"
        aria-label="Toolbar"
        onKeyDown={(event) => {
          if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
            return;
          }
          const items = Array.from(
            event.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled)"),
          );
          const index = items.indexOf(event.target as HTMLElement);
          if (index < 0) {
            return;
          }
          event.preventDefault();
          const next =
            event.key === "ArrowRight"
              ? items[(index + 1) % items.length]
              : items[(index - 1 + items.length) % items.length];
          next?.focus();
        }}
      >
        <button type="button" className="chrome-button" {...stubActionProps()}>
          New SQL
        </button>
        <button type="button" className="chrome-button" {...stubActionProps()}>
          Run
        </button>
        <button
          type="button"
          className="chrome-button"
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
        <button type="button" className="chrome-button" onClick={onOpenMcp}>
          MCP Activity
        </button>
      </div>

      <div
        className="ide-context-bar"
        role="region"
        aria-label="Context Bar"
        onKeyDown={(event) => {
          if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
            return;
          }
          const items = Array.from(
            event.currentTarget.querySelectorAll<HTMLElement>(
              "button:not(:disabled), select:not(:disabled), input:not(:disabled)",
            ),
          );
          const index = items.indexOf(event.target as HTMLElement);
          if (index < 0) {
            return;
          }
          event.preventDefault();
          const next =
            event.key === "ArrowRight"
              ? items[(index + 1) % items.length]
              : items[(index - 1 + items.length) % items.length];
          next?.focus();
        }}
      >
        <span className="context-field" aria-label="Project">
          <span className="context-label">Project</span>
          <strong>{openedProject.project.name}</strong>
        </span>
        <label className="context-field" htmlFor="workspace-connection">
          <span className="context-label">Connection</span>
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
        <label className="context-field" htmlFor="workspace-working-schema">
          <span className="context-label">Working Schema</span>
          <input
            id="workspace-working-schema"
            value={workingSchema}
            onChange={(event) => handleWorkingSchemaChange(event.target.value)}
            placeholder="Schema"
            spellCheck={false}
          />
        </label>
        <span className="context-field" aria-label="Environment">
          <span className="context-label">Environment</span>
          <strong>{environment}</strong>
        </span>
        <div className="context-health" role="group" aria-label="Health indicators">
          <span
            className={`health-pill health-pill--${backendHealth.tone}`}
            aria-label="Backend health"
          >
            {backendHealth.label}
          </span>
          <span className={`health-pill health-pill--${mcpHealth.tone}`} aria-label="MCP health">
            {mcpHealth.label}
          </span>
          <span
            className={`health-pill health-pill--${connectionHealth.tone}`}
            aria-label="Connection health"
          >
            {connectionHealth.label}
          </span>
        </div>
      </div>

      <div
        className="ide-workspace-body"
        style={{ gridTemplateColumns: bodyColumns || "minmax(0, 1fr)" }}
      >
        {layout.showExplorer ? (
          <section
            className="ide-region ide-region--explorer"
            role="region"
            aria-label="Explorer"
          >
            <FileTree
              rootPath={openedProject.project.root_path}
              showJunk={layout.showJunkFiles}
              onToggleJunk={() =>
                onLayoutChange((current) => ({
                  ...current,
                  showJunkFiles: !current.showJunkFiles,
                }))
              }
              onOpenFile={onOpenFile}
            />
            {layout.showMission || layout.showInspector ? (
              <PanelSplitter
                axis="explorer"
                label="Resize Explorer"
                onDelta={(delta) =>
                  onLayoutChange((current) => ({
                    ...current,
                    leftWidth: clampExplorerWidth(current.leftWidth + delta),
                  }))
                }
              />
            ) : null}
          </section>
        ) : null}

        {layout.showMission ? (
          <section className="ide-region ide-region--mission" role="region" aria-label="Mission">
            <div className="ide-pane ide-pane--center">
              <div className="pane-header pane-header--tabs">
                <div className="tab-strip" role="tablist" aria-label="Center workspace tabs">
                  {centerTabs.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={tab.id === activeCenterTabId}
                      className={tab.id === activeCenterTabId ? "tab tab--active" : "tab"}
                      onClick={() => setActiveCenterTabId(tab.id)}
                    >
                      {tab.title}
                    </button>
                  ))}
                </div>
              </div>
              <div className="pane-body">
                {activeCenterTab?.kind === "mission" ? (
                  <MissionComposer projectName={openedProject.project.name} />
                ) : null}
                {activeCenterTab?.kind === "sql" ? (
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
                {!activeCenterTab ? (
                  <p className="pane-muted">Open a center workspace tab.</p>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}

        {layout.showInspector ? (
          <section
            className="ide-region ide-region--inspector"
            role="region"
            aria-label="Inspector"
          >
            {(layout.showExplorer || layout.showMission) ? (
              <PanelSplitter
                axis="inspector"
                label="Resize Inspector"
                onDelta={(delta) =>
                  onLayoutChange((current) => ({
                    ...current,
                    rightWidth: clampInspectorWidth(current.rightWidth - delta),
                  }))
                }
              />
            ) : null}
            <div className="ide-pane ide-pane--right">
              <div className="pane-header pane-header--tabs">
                <div className="tab-strip" role="tablist" aria-label="Inspector tabs">
                  {inspectorTabs.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={tab.id === activeInspectorTabId}
                      className={tab.id === activeInspectorTabId ? "tab tab--active" : "tab"}
                      onClick={() => setActiveInspectorTabId(tab.id)}
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
              {saveMessage ? (
                <p className="pane-muted connection-strip-message">{saveMessage}</p>
              ) : null}
              <div className="pane-body">
                {activeInspectorTab?.kind === "schema" ? (
                  <SchemaBrowser
                    backendConfig={backendConfig}
                    connectedConnection={connectedConnection}
                    isBackendOnline={isBackendOnline}
                    projectSchemaOverride={projectSchemaOverride}
                    workingSchema={workingSchema}
                    onWorkingSchemaChange={handleWorkingSchemaChange}
                    onActivityRefresh={onActivityRefresh}
                    onSaveSummary={(summary) => void saveSchemaSummary(summary)}
                  />
                ) : null}
                {activeInspectorTab?.kind === "mappings" ? (
                  <ProjectMappings
                    backendConfig={backendConfig}
                    connections={connections}
                    openedProject={openedProject}
                    onOpenedProjectChange={onOpenedProjectChange}
                  />
                ) : null}
                {activeInspectorTab?.kind === "file" ? (
                  <div className="file-preview">
                    <p className="pane-muted">{activeInspectorTab.path}</p>
                    <pre>{activeInspectorTab.content}</pre>
                  </div>
                ) : null}
                {!activeInspectorTab ? <p className="pane-muted">Open an Inspector tab.</p> : null}
              </div>
            </div>
          </section>
        ) : null}

        {!layout.showExplorer && !layout.showMission && !layout.showInspector ? (
          <p className="pane-muted workspace-empty">
            All panels are hidden. Use View menu or panel shortcuts to restore them.
          </p>
        ) : null}
      </div>

      {layout.showConsole ? (
        <div className="ide-console-dock">
          <PanelSplitter
            axis="console"
            label="Resize Developer Console"
            onDelta={(delta) =>
              onLayoutChange((current) => ({
                ...current,
                consoleHeight: clampConsoleHeight(current.consoleHeight - delta),
              }))
            }
          />
          <section
            className="ide-region ide-region--console"
            role="region"
            aria-label="Developer Console"
          >
            <DeveloperConsole />
          </section>
        </div>
      ) : null}
    </div>
  );
};
