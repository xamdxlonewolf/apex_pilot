import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

import { ActivityRail } from "./ActivityRail";
import { type ApexOpenTarget } from "./ApexBrowser";
import { CodeEditor } from "./CodeEditor";
import { DatabaseDrawer } from "./DatabaseDrawer";
import { DeveloperConsole } from "./DeveloperConsole";
import { Explorer, type ExplorerSectionId } from "./Explorer";
import { InspectorPanel } from "./InspectorPanel";
import { MissionComposer } from "./MissionComposer";
import { MissionPeerHeader } from "./MissionPeerHeader";
import { ProductHeader } from "./ProductHeader";
import { QuickOpenHost } from "./QuickOpenHost";
import { ShellDrawer } from "./ShellDrawer";
import { type SchemaOpenTarget } from "./SchemaBrowser";
import { SqlSheet, WORKSPACE_SQL_FORM_ID, type SqlRunState } from "./SqlSheet";
import { StubSurface } from "./StubSurface";
import {
  CENTER_EDITOR_STUB_META,
  isCenterEditorStubKind,
  stubCenterEditorTab,
  type CenterEditorStubKind,
} from "./centerEditors";
import { languageFromPath } from "./editorLanguages";
import {
  type ActivityEntry,
  type BackendConfig,
  type BackendStatus,
  type OpenedProject,
  type SavedConnection,
  type SchemaSummary,
  getSessionContextOnce,
} from "./backend";
import {
  DEFAULT_ACTIVITY_RAIL,
  applyFocusModeSelection,
  applyRailSelection,
  editorPeerKindFromTab,
  focusModeFromWork,
  railForFocusMode,
  workspaceVisualPrimacy,
  type ActivityRailId,
  type FocusMode,
} from "./focusMode";
import {
  clampConsoleHeight,
  clampDatabaseWidth,
  clampExplorerWidth,
  clampInspectorWidth,
} from "./panelLayout";
import {
  type ProfileLayoutPrefs,
  loadProjectDefaults,
  loadProjectTabs,
  saveProjectDefaults,
  saveProjectTabs,
  schemaFromSessionUser,
  type WorkspaceTabKind,
} from "./prefs";
import {
  explorerIsPeer,
  missionVisible,
  withDrawerOpen,
  type ShellSessionState,
} from "./shellSession";
import {
  isApexExportFolderName,
  isRootApexExportSql,
  joinPath,
  readTextFile,
  writeTextFile,
  type FileTreeNode,
} from "./projectFs";
import { schemaTablesToQuickOpenItems, type QuickOpenItem } from "./quickOpenModel";

const explorerPostureFromRail = (rail: ActivityRailId): ExplorerSectionId =>
  rail === "database" ? "files" : rail;
type WorkspaceTab = Readonly<{
  id: string;
  kind: WorkspaceTabKind;
  title: string;
  path?: string;
  content?: string;
  /** Protected APEX / root f*.sql opens stay read-only. */
  readOnly?: boolean;
}>;

/** Editor peer tabs — Mission is a dual-primary peer, not a center tab. */
const EDITOR_TAB_KINDS = new Set<WorkspaceTabKind>([
  "sql",
  "object",
  "package",
  "apex",
  "rest",
  "diff",
  "file",
]);

const isEditorTab = (tab: WorkspaceTab): boolean => EDITOR_TAB_KINDS.has(tab.kind);

const isCloseableEditorTab = (tab: WorkspaceTab): boolean => tab.kind !== "sql";

const defaultEditorTabs = (): WorkspaceTab[] => [
  { id: "sql", kind: "sql", title: "SQL Editor" },
];

const restoreWorkspaceTabs = (
  saved: ReturnType<typeof loadProjectTabs>,
): Readonly<{
  tabs: WorkspaceTab[];
  activeCenterTabId: string | null;
}> => {
  const restored: WorkspaceTab[] =
    saved.openTabs.length > 0
      ? saved.openTabs
          .filter((tab) => EDITOR_TAB_KINDS.has(tab.kind))
          .map((tab) => ({
            id: tab.id,
            kind: tab.kind,
            title:
              tab.kind === "sql"
                ? "SQL Editor"
                : tab.title ||
                  (isCenterEditorStubKind(tab.kind)
                    ? CENTER_EDITOR_STUB_META[tab.kind].title
                    : tab.title),
            path: tab.path,
          }))
      : defaultEditorTabs();

  let tabs = restored;
  if (!tabs.some((tab) => tab.kind === "sql")) {
    tabs = [...tabs, ...defaultEditorTabs()];
  }

  const editorTabs = tabs.filter(isEditorTab);
  const editorIds = new Set(editorTabs.map((tab) => tab.id));

  const preferred =
    (saved.activeCenterTabId && editorIds.has(saved.activeCenterTabId)
      ? saved.activeCenterTabId
      : null) ??
    (saved.activeTabId && editorIds.has(saved.activeTabId) ? saved.activeTabId : null);

  const activeCenterTabId =
    preferred ?? editorTabs.find((tab) => tab.kind === "sql")?.id ?? editorTabs[0]?.id ?? null;

  return { tabs, activeCenterTabId };
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
  activityEntries: ActivityEntry[];
  activeActivitySessionId: string | null;
  mcpFocusRequest: number;
  onMcpFocusHandled: () => void;
  onActivityRefresh: () => Promise<void>;
  onOpenMcp: () => void;
  onOpenSettings: () => void;
  sqlDirty: boolean;
  onSqlDirtyChange: (dirty: boolean) => void;
  openCenterEditorKind?: CenterEditorStubKind | null;
  openCenterEditorRequest?: number;
  focusMode: FocusMode;
  onFocusModeChange: (mode: FocusMode) => void;
  shellSession: ShellSessionState;
  onShellSessionChange: (
    next: ShellSessionState | ((current: ShellSessionState) => ShellSessionState),
  ) => void;
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
  activityEntries,
  activeActivitySessionId,
  mcpFocusRequest,
  onMcpFocusHandled,
  onActivityRefresh,
  onOpenMcp,
  onOpenSettings,
  sqlDirty,
  onSqlDirtyChange,
  openCenterEditorKind = null,
  openCenterEditorRequest = 0,
  focusMode,
  onFocusModeChange,
  shellSession,
  onShellSessionChange,
}: IdeWorkspaceProps) => {
  const projectId = openedProject.project.project_id;
  const [tabsProjectId, setTabsProjectId] = useState<string | null>(null);
  const [tabs, setTabs] = useState<WorkspaceTab[]>([]);
  const [activeCenterTabId, setActiveCenterTabId] = useState<string | null>(null);
  const [workingSchema, setWorkingSchema] = useState("");
  const [projectSchemaOverride, setProjectSchemaOverride] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [reduceMotion, setReduceMotion] = useState(prefersReducedMotion);
  const [handledEditorRequest, setHandledEditorRequest] = useState(0);
  const [schemaObjects, setSchemaObjects] = useState<QuickOpenItem[]>([]);
  const [explorerFocusSection, setExplorerFocusSection] = useState<ExplorerSectionId | null>(
    null,
  );
  const [focusedObjectName, setFocusedObjectName] = useState<string | null>(null);
  const [activityRail, setActivityRail] = useState<ActivityRailId>(DEFAULT_ACTIVITY_RAIL);
  const [sqlRunState, setSqlRunState] = useState<SqlRunState>({
    busy: false,
    hasSql: false,
    canRun: false,
  });
  const schemaAutofillKey = useRef<string | null>(null);
  /** When true, the next focusMode effect must not clobber rail (rail-driven select). */
  const skipFocusRailSync = useRef(false);

  if (projectId !== tabsProjectId) {
    const saved = loadProjectTabs(projectId);
    const defaults = loadProjectDefaults(projectId);
    const restored = restoreWorkspaceTabs(saved);
    const schema = defaults.schemaName ?? defaultSchemaFromManifest(openedProject) ?? null;
    setTabsProjectId(projectId);
    setTabs(restored.tabs);
    setActiveCenterTabId(restored.activeCenterTabId);
    setProjectSchemaOverride(schema);
    setWorkingSchema(schema ?? "");
    setSaveMessage(null);
    setHandledEditorRequest(0);
    setSchemaObjects([]);
    setFocusedObjectName(null);
    setExplorerFocusSection(null);
    setActivityRail(DEFAULT_ACTIVITY_RAIL);
    schemaAutofillKey.current = null;
  }

  const onActivityRailSelect = (rail: ActivityRailId) => {
    const next = applyRailSelection(rail, focusMode);
    // When Focus changes (e.g. Review→Agent for Code/APEX), skip the Focus→rail
    // sync so the selected explorer-only rail is not rewritten to Agent.
    if (next.focusMode !== focusMode) {
      skipFocusRailSync.current = true;
    }
    onFocusModeChange(next.focusMode);
    setActivityRail(next.rail);
    if (rail === "database") {
      onShellSessionChange((current) => withDrawerOpen(current, layout, "database", true));
      return;
    }
    // Files / Agent / Review / Code / APEX all open Explorer (peer in Files, dock elsewhere).
    onShellSessionChange((current) => withDrawerOpen(current, layout, "explorer", true));
  };

  const activateEditorTab = (tabId: string, kindHint?: WorkspaceTabKind) => {
    setActiveCenterTabId(tabId);
    const kind = kindHint ?? tabs.find((item) => item.id === tabId)?.kind;
    const peer = editorPeerKindFromTab(kind);
    if (peer === "mission" || peer === null) {
      return;
    }
    const nextMode = focusModeFromWork(focusMode, { type: "editor-focus", peer });
    if (nextMode !== focusMode) {
      const next = applyFocusModeSelection(nextMode, activityRail);
      onFocusModeChange(next.focusMode);
      setActivityRail(next.rail);
    }
  };

  const focusMissionPeer = () => {
    const nextMode = focusModeFromWork(focusMode, { type: "mission-focus" });
    if (nextMode !== focusMode) {
      const next = applyFocusModeSelection(nextMode, activityRail);
      onFocusModeChange(next.focusMode);
      setActivityRail(next.rail);
    }
  };

  useEffect(() => {
    if (!explorerFocusSection) {
      return;
    }
    const next = applyRailSelection(explorerFocusSection, focusMode);
    onFocusModeChange(next.focusMode);
    setActivityRail(next.rail);
    setExplorerFocusSection(null);
  }, [explorerFocusSection, focusMode, onFocusModeChange]);

  // Keep rail in sync when Focus Mode is set from App menu / palette (SQL leaves rail).
  // Skip when the rail itself drove the Focus change (preserves Code / APEX / Database).
  useEffect(() => {
    if (skipFocusRailSync.current) {
      skipFocusRailSync.current = false;
      return;
    }
    const paired = railForFocusMode(focusMode);
    if (paired) {
      setActivityRail(paired);
    }
  }, [focusMode]);

  useEffect(() => {
    const defaults = loadProjectDefaults(openedProject.project.project_id);
    const connection =
      defaults.connectionName ?? defaultConnectionFromMappings(openedProject) ?? "";
    if (connection) {
      onSelectedConnectionChange(connection);
    }
  }, [openedProject, onSelectedConnectionChange]);

  useEffect(() => {
    if (
      !openCenterEditorKind ||
      openCenterEditorRequest <= 0 ||
      openCenterEditorRequest === handledEditorRequest
    ) {
      return;
    }
    const tab = stubCenterEditorTab(openCenterEditorKind);
    setTabs((current) =>
      current.some((item) => item.id === tab.id) ? current : [...current, tab],
    );
    activateEditorTab(tab.id, tab.kind);
    setHandledEditorRequest(openCenterEditorRequest);
  }, [handledEditorRequest, openCenterEditorKind, openCenterEditorRequest]);

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
      activeTabId: activeCenterTabId,
      activeCenterTabId,
      activeInspectorTabId: null,
    });
  }, [activeCenterTabId, openedProject.project.project_id, tabs]);

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

  // M3: autofill Working Schema on connect without requiring Database Explorer posture.
  useEffect(() => {
    if (!connectedConnection || !isBackendOnline) {
      schemaAutofillKey.current = null;
      return;
    }
    const override = projectSchemaOverride?.trim().toUpperCase() || null;
    const key = `${connectedConnection}:${override ?? "login"}`;
    if (schemaAutofillKey.current === key) {
      return;
    }

    if (override) {
      setWorkingSchema(override);
      schemaAutofillKey.current = key;
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (cancelled) {
        return;
      }
      void (async () => {
        try {
          const context = await getSessionContextOnce(backendConfig);
          if (cancelled) {
            return;
          }
          const suggested =
            context.suggested_schema ||
            schemaFromSessionUser(
              context.database_context.current_user,
              context.database_context.current_schema,
            );
          if (suggested) {
            handleWorkingSchemaChange(suggested, { persist: false });
          }
        } catch {
          // Leave empty; user can type a schema manually.
        } finally {
          if (!cancelled) {
            schemaAutofillKey.current = key;
          }
        }
      })();
    }, 75);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per connection+override
  }, [backendConfig, connectedConnection, isBackendOnline, projectSchemaOverride]);

  const openOrFocus = (tab: WorkspaceTab) => {
    setTabs((current) => (current.some((item) => item.id === tab.id) ? current : [...current, tab]));
    activateEditorTab(tab.id, tab.kind);
  };

  const updateFileTabContent = (tabId: string, content: string) => {
    setTabs((current) =>
      current.map((tab) => (tab.id === tabId ? { ...tab, content } : tab)),
    );
    onSqlDirtyChange(true);
  };

  const saveActiveFileTab = async () => {
    const tab = tabs.find((item) => item.id === activeCenterTabId);
    if (!tab || tab.kind !== "file" || !tab.path || tab.content === undefined || tab.readOnly) {
      return;
    }
    try {
      await writeTextFile(tab.path, tab.content);
      setSaveMessage(`Saved ${tab.title}`);
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : "Could not save file.");
    }
  };

  const closeTab = (tabId: string) => {
    setTabs((current) => {
      const closing = current.find((tab) => tab.id === tabId);
      const next = current.filter((tab) => tab.id !== tabId);
      if (closing && isEditorTab(closing) && activeCenterTabId === tabId) {
        const fallback = next.find(isEditorTab) ?? null;
        if (fallback) {
          // Defer so we don't nest focus-mode updates inside the tabs updater.
          queueMicrotask(() => activateEditorTab(fallback.id, fallback.kind));
        } else {
          setActiveCenterTabId(null);
        }
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
        readOnly: node.protected,
      });
    })();
  };

  const onOpenObject = (target: SchemaOpenTarget) => {
    const qualified = `${target.schemaName}.${target.objectName}`;
    setFocusedObjectName(qualified);
    openOrFocus({
      id: `object:${target.schemaName}.${target.objectType}.${target.objectName}`,
      kind: "object",
      title: target.objectName,
      path: `${target.objectType} ${qualified}`,
    });
  };

  const onOpenApex = (target: ApexOpenTarget) => {
    openOrFocus({
      id: `apex:${target.connectionName}:${target.workspaceName}`,
      kind: "apex",
      title: target.workspaceName,
      path: `${target.connectionName} · ${target.workspaceName}`,
    });
  };

  const onQuickOpenSelect = (item: QuickOpenItem) => {
    if (item.kind === "file" && item.path) {
      const root = openedProject.project.root_path;
      const depth = item.path === joinPath(root, item.label) ? 0 : 1;
      onOpenFile({
        name: item.label,
        path: item.path,
        kind: "file",
        protected: isApexExportFolderName(item.label) || isRootApexExportSql(item.label, depth),
        junk: false,
      });
      return;
    }
    if (item.kind === "object") {
      const objectName = item.objectName ?? item.label;
      const schemaName = item.schemaName ?? item.detail?.split(".")[0] ?? workingSchema;
      const objectType = item.objectType ?? "TABLE";
      const qualified = item.detail ?? `${schemaName}.${objectName}`;
      setFocusedObjectName(qualified);
      onShellSessionChange((current) => withDrawerOpen(current, layout, "database", true));
      onOpenObject({
        schemaName,
        objectType,
        objectName,
      });
    }
  };

  const onSchemaSummaryChange = (summary: SchemaSummary | null) => {
    if (!summary) {
      setSchemaObjects([]);
      return;
    }
    setSchemaObjects(schemaTablesToQuickOpenItems(summary.schema_name, summary.tables));
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

  const editorTabs = tabs.filter(isEditorTab);
  const activeCenterTab = editorTabs.find((tab) => tab.id === activeCenterTabId) ?? null;
  const sqlEditorActive = activeCenterTab?.kind === "sql";
  const visualPrimacy = workspaceVisualPrimacy(focusMode);
  const missionPrimacy = visualPrimacy.mission;
  const editorsPrimacy = visualPrimacy.editors;
  const showMission = missionVisible(shellSession, focusMode);
  const explorerPeer = explorerIsPeer(focusMode) && shellSession.explorerOpen;
  const explorerDrawer = !explorerIsPeer(focusMode) && shellSession.explorerOpen;
  const explorerPosture = explorerPostureFromRail(activityRail);

  const handleNewSql = () => {
    const existing = tabs.find((tab) => tab.kind === "sql");
    const tab = existing ?? { id: "sql", kind: "sql" as const, title: "SQL Editor" };
    setTabs((current) =>
      current.some((item) => item.id === tab.id) ? current : [...current, tab],
    );
    setActiveCenterTabId(tab.id);
    // Explicit SQL Focus Mode overrides sticky Agent (ADR-0007 / Focus Mode grilling).
    const next = applyFocusModeSelection("sql", activityRail);
    onFocusModeChange(next.focusMode);
    setActivityRail(next.rail);
  };

  const toolbarRunEnabled =
    sqlEditorActive && sqlRunState.canRun && sqlRunState.hasSql && !sqlRunState.busy;
  const toolbarRunTitle = !sqlEditorActive
    ? "Focus the SQL Editor to run."
    : !isBackendOnline
      ? "Backend is offline."
      : !connectedConnection
        ? "Connect a SQLcl saved connection to run SQL."
        : sqlRunState.busy
          ? "Running…"
          : !sqlRunState.hasSql
            ? "Enter SQL to run."
            : "Run the SQL Editor buffer.";

  const bodyColumnParts: string[] = ["44px"];
  const explorerSide = explorerPeer ? "left" : layout.explorerDrawerSide;
  const explorerDockOpen = explorerPeer || explorerDrawer;
  if (explorerDockOpen && explorerSide === "left") {
    bodyColumnParts.push(`${layout.leftWidth}px`);
  }
  if (shellSession.inspectorOpen && layout.inspectorDrawerSide === "left") {
    bodyColumnParts.push(`${layout.rightWidth}px`);
  }
  if (shellSession.databaseOpen && layout.databaseDrawerSide === "left") {
    bodyColumnParts.push(`${layout.databaseWidth}px`);
  }
  bodyColumnParts.push("minmax(600px, 1fr)");
  if (explorerDockOpen && explorerSide === "right") {
    bodyColumnParts.push(`${layout.leftWidth}px`);
  }
  if (shellSession.inspectorOpen && layout.inspectorDrawerSide === "right") {
    bodyColumnParts.push(`${layout.rightWidth}px`);
  }
  if (shellSession.databaseOpen && layout.databaseDrawerSide === "right") {
    bodyColumnParts.push(`${layout.databaseWidth}px`);
  }
  const bodyColumns = bodyColumnParts.join(" ");

  const consoleHeight = layout.showConsole ? layout.consoleHeight : 0;

  const closeExplorer = () =>
    onShellSessionChange((current) => withDrawerOpen(current, layout, "explorer", false));
  const closeInspector = () =>
    onShellSessionChange((current) => withDrawerOpen(current, layout, "inspector", false));
  const closeDatabase = () =>
    onShellSessionChange((current) => withDrawerOpen(current, layout, "database", false));
  const closeMission = () =>
    onShellSessionChange((current) => ({
      ...current,
      missionOverrideByFocus: {
        ...current.missionOverrideByFocus,
        [focusMode]: false,
      },
    }));
  const closeConsole = () =>
    onLayoutChange((current) => ({ ...current, showConsole: false }));

  const explorerProps = {
    rootPath: openedProject.project.root_path,
    showJunk: layout.showJunkFiles,
    onToggleJunk: () =>
      onLayoutChange((current) => ({
        ...current,
        showJunkFiles: !current.showJunkFiles,
      })),
    onOpenFile,
    activePosture: explorerPosture,
    focusSection: explorerFocusSection,
    onFocusSectionHandled: () => setExplorerFocusSection(null),
    apexMappings: openedProject.apex_workspace_mappings,
    onOpenApex,
    onClose: explorerDrawer ? closeExplorer : undefined,
  } as const;

  const databaseProps = {
    backendConfig,
    connectedConnection,
    isBackendOnline,
    projectSchemaOverride,
    workingSchema,
    onWorkingSchemaChange: handleWorkingSchemaChange,
    onActivityRefresh,
    onSaveSummary: (summary: SchemaSummary) => void saveSchemaSummary(summary),
    onSummaryChange: onSchemaSummaryChange,
    onOpenObject,
    focusedObjectName,
  } as const;

  const renderExplorerDock = (side: "left" | "right") => {
    if (!explorerDockOpen || explorerSide !== side) {
      return null;
    }
    return (
      <section
        className={`ide-region ide-region--explorer ide-region--dock ide-region--dock-${side}${
          explorerDrawer ? " ide-region--dock-slide" : ""
        }`}
        role="region"
        aria-label="Explorer"
        data-dock="explorer"
        data-side={side}
      >
        {side === "right" ? (
          <PanelSplitter
            axis="explorer"
            label="Resize Explorer"
            onDelta={(delta) =>
              onLayoutChange((current) => ({
                ...current,
                leftWidth: clampExplorerWidth(current.leftWidth - delta),
              }))
            }
          />
        ) : null}
        <Explorer {...explorerProps} />
        {side === "left" ? (
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
    );
  };

  const renderInspectorDock = (side: "left" | "right") => {
    if (!shellSession.inspectorOpen || layout.inspectorDrawerSide !== side) {
      return null;
    }
    return (
      <ShellDrawer
        id="inspector"
        side={side}
        open
        width={layout.rightWidth}
        title="Inspector"
        ariaLabel="Inspector"
        onClose={closeInspector}
        splitter={
          <PanelSplitter
            axis="inspector"
            label="Resize Inspector"
            onDelta={(delta) =>
              onLayoutChange((current) => ({
                ...current,
                rightWidth: clampInspectorWidth(
                  current.rightWidth + (side === "right" ? -delta : delta),
                ),
              }))
            }
          />
        }
      >
        <div className="ide-pane ide-pane--right">
          {saveMessage ? (
            <p className="pane-muted connection-strip-message">{saveMessage}</p>
          ) : null}
          <InspectorPanel
            projectName={openedProject.project.name}
            connectionName={connectedConnection}
            workingSchema={workingSchema}
          />
        </div>
      </ShellDrawer>
    );
  };

  const renderDatabaseDock = (side: "left" | "right") => {
    if (!shellSession.databaseOpen || layout.databaseDrawerSide !== side) {
      return null;
    }
    return (
      <ShellDrawer
        id="database"
        side={side}
        open
        width={layout.databaseWidth}
        title="Database"
        ariaLabel="Database"
        onClose={closeDatabase}
        splitter={
          <PanelSplitter
            axis="inspector"
            label="Resize Database"
            onDelta={(delta) =>
              onLayoutChange((current) => ({
                ...current,
                databaseWidth: clampDatabaseWidth(
                  current.databaseWidth + (side === "right" ? -delta : delta),
                ),
              }))
            }
          />
        }
      >
        <DatabaseDrawer {...databaseProps} />
      </ShellDrawer>
    );
  };

  return (
    <div
      className={
        layout.showConsole ? "ide-workspace ide-workspace--console-open" : "ide-workspace"
      }
      data-density={layout.density}
      data-motion={reduceMotion ? "reduced" : "standard"}
      data-focus-mode={focusMode}
      style={{
        ["--left-width" as string]: `${layout.leftWidth}px`,
        ["--right-width" as string]: `${layout.rightWidth}px`,
        ["--console-height" as string]: `${consoleHeight}px`,
      }}
    >
      <ProductHeader
        openedProject={openedProject}
        backendStatus={backendStatus}
        isBackendOnline={isBackendOnline}
        connections={connections}
        selectedConnection={selectedConnection}
        onSelectedConnectionChange={onSelectedConnectionChange}
        connectedConnection={connectedConnection}
        onConnect={onConnect}
        isConnecting={isConnecting}
        workingSchema={workingSchema}
        onWorkingSchemaChange={handleWorkingSchemaChange}
        onOpenSettings={onOpenSettings}
      />

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
        <button
          type="button"
          className="chrome-button"
          onClick={handleNewSql}
          title="Open the SQL Editor"
        >
          New SQL
        </button>
        <button
          type="submit"
          form={WORKSPACE_SQL_FORM_ID}
          className="chrome-button"
          disabled={!toolbarRunEnabled}
          aria-disabled={!toolbarRunEnabled}
          aria-busy={sqlEditorActive && sqlRunState.busy}
          title={toolbarRunTitle}
        >
          {sqlEditorActive && sqlRunState.busy ? "Running…" : "Run"}
        </button>
        <button type="button" className="chrome-button" onClick={onOpenMcp}>
          MCP Activity
          {activityCount > 0 ? <span className="menu-count">{activityCount}</span> : null}
        </button>
        <span className="ide-toolbar-spacer" aria-hidden="true" />
        <button
          type="button"
          className="chrome-button"
          aria-pressed={showMission}
          title={showMission ? "Hide Mission" : "Show Mission"}
          onClick={() =>
            onShellSessionChange((current) => ({
              ...current,
              missionOverrideByFocus: {
                ...current.missionOverrideByFocus,
                [focusMode]: !showMission,
              },
            }))
          }
        >
          Mission
        </button>
        <button
          type="button"
          className="chrome-button"
          aria-pressed={shellSession.databaseOpen}
          title={shellSession.databaseOpen ? "Hide Database" : "Show Database"}
          onClick={() =>
            onShellSessionChange((current) =>
              withDrawerOpen(current, layout, "database", !current.databaseOpen),
            )
          }
        >
          Database
        </button>
      </div>

      <div
        className="ide-workspace-body"
        style={{ gridTemplateColumns: bodyColumns || "minmax(0, 1fr)" }}
      >
        <section className="ide-region ide-region--rail">
          <ActivityRail active={activityRail} onSelect={onActivityRailSelect} />
        </section>

        {renderExplorerDock("left")}
        {renderInspectorDock("left")}
        {renderDatabaseDock("left")}

        <section
          className="ide-region ide-region--workspace"
          role="region"
          aria-label="Workspace"
          data-focus-mode={focusMode}
        >
          <div
            className="workspace-peers"
            data-mission-visible={showMission ? "true" : "false"}
            data-secondary-dim={visualPrimacy.secondaryDim}
          >
            {showMission ? (
              <section
                className={
                  missionPrimacy === "primary"
                    ? "workspace-peer workspace-peer--mission workspace-peer--primary"
                    : "workspace-peer workspace-peer--mission workspace-peer--secondary"
                }
                role="region"
                aria-label="Mission"
                data-primacy={missionPrimacy}
                onFocusCapture={focusMissionPeer}
                onClick={focusMissionPeer}
              >
                <div className="ide-pane ide-pane--mission">
                  <MissionPeerHeader
                    showReviewMeta={visualPrimacy.missionReviewMeta}
                    onClose={
                      focusMode === "sql" || focusMode === "files" ? closeMission : undefined
                    }
                  />
                  <div className="pane-body">
                    <MissionComposer projectName={openedProject.project.name} />
                  </div>
                </div>
              </section>
            ) : null}

            <section
              className={
                editorsPrimacy === "primary"
                  ? "workspace-peer workspace-peer--editors workspace-peer--primary"
                  : "workspace-peer workspace-peer--editors workspace-peer--secondary"
              }
              role="region"
              aria-label="Editors"
              data-primacy={editorsPrimacy}
            >
              <div className="ide-pane ide-pane--center">
                <div className="pane-header pane-header--tabs">
                  <div className="tab-strip" role="tablist" aria-label="Editor workspace tabs">
                    {editorTabs.map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        role="tab"
                        aria-selected={tab.id === activeCenterTabId}
                        className={tab.id === activeCenterTabId ? "tab tab--active" : "tab"}
                        onClick={() => activateEditorTab(tab.id, tab.kind)}
                      >
                        {tab.title}
                        {isCloseableEditorTab(tab) ? (
                          <span
                            className="tab-close"
                            aria-hidden="true"
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
                <div className="pane-body">
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
                      onRunStateChange={setSqlRunState}
                    />
                  ) : null}
                  {activeCenterTab &&
                  isCenterEditorStubKind(activeCenterTab.kind) &&
                  !(activeCenterTab.kind === "file" && activeCenterTab.content !== undefined) ? (
                    <div className="center-object-viewer" aria-label={`${activeCenterTab.kind} viewer`}>
                      {activeCenterTab.path ? (
                        <p className="pane-muted">{activeCenterTab.path}</p>
                      ) : null}
                      <StubSurface
                        title={activeCenterTab.title}
                        secondary={CENTER_EDITOR_STUB_META[activeCenterTab.kind].secondary}
                      />
                    </div>
                  ) : null}
                  {activeCenterTab?.kind === "file" && activeCenterTab.content !== undefined ? (
                    <div
                      className="file-editor"
                      aria-label={activeCenterTab.readOnly ? "File preview" : "File editor"}
                      onKeyDown={(event) => {
                        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
                          event.preventDefault();
                          void saveActiveFileTab();
                        }
                      }}
                    >
                      <div className="file-editor-meta">
                        <p className="pane-muted">
                          {activeCenterTab.path}
                          {activeCenterTab.readOnly ? " · read-only" : ""}
                        </p>
                        {!activeCenterTab.readOnly ? (
                          <button
                            type="button"
                            className="chrome-button"
                            onClick={() => void saveActiveFileTab()}
                          >
                            Save
                          </button>
                        ) : null}
                      </div>
                      <CodeEditor
                        id={`file-editor:${activeCenterTab.id}`}
                        language={languageFromPath(activeCenterTab.path)}
                        value={activeCenterTab.content}
                        readOnly={Boolean(activeCenterTab.readOnly)}
                        aria-label={
                          activeCenterTab.readOnly
                            ? `Read-only ${activeCenterTab.title}`
                            : `Edit ${activeCenterTab.title}`
                        }
                        onChange={(next) => updateFileTabContent(activeCenterTab.id, next)}
                      />
                    </div>
                  ) : null}
                  {!activeCenterTab ? (
                    <p className="pane-muted">Open an editor tab.</p>
                  ) : null}
                </div>
              </div>
            </section>
          </div>
        </section>

        {renderExplorerDock("right")}
        {renderInspectorDock("right")}
        {renderDatabaseDock("right")}
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
            <DeveloperConsole
              entries={activityEntries}
              connectionName={connectedConnection}
              activeSessionId={activeActivitySessionId}
              mcpFocusRequest={mcpFocusRequest}
              onMcpFocusHandled={onMcpFocusHandled}
              onClose={closeConsole}
            />
          </section>
        </div>
      ) : null}

      <QuickOpenHost
        rootPath={openedProject.project.root_path}
        showJunk={layout.showJunkFiles}
        objects={schemaObjects}
        onSelect={onQuickOpenSelect}
      />
    </div>
  );
};
