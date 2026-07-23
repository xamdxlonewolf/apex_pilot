/** Local layout prefs: profile-scoped chrome, project-scoped tabs. */

import {
  CONSOLE_DEFAULT_HEIGHT,
  DATABASE_DEFAULT_WIDTH,
  EXPLORER_DEFAULT_WIDTH,
  INSPECTOR_DEFAULT_WIDTH,
  MISSION_DEFAULT_WIDTH,
  clampConsoleHeight,
  clampDatabaseWidth,
  clampExplorerWidth,
  clampInspectorWidth,
  clampMissionWidth,
} from "./panelLayout";
import type { DrawerSide } from "./shellSession";

export type ProfileLayoutPrefs = Readonly<{
  leftWidth: number;
  rightWidth: number;
  databaseWidth: number;
  /** Mission peer width when Mission is visible beside Editors. */
  missionWidth: number;
  consoleHeight: number;
  density: DensityMode;
  /** Activity Rail label mode — independent of Density. */
  activityRailLabels: ActivityRailLabelsMode;
  /** Profile-persisted drawer side preferences. */
  explorerDrawerSide: DrawerSide;
  inspectorDrawerSide: DrawerSide;
  databaseDrawerSide: DrawerSide;
  /** Developer Console remains Layout Chrome — profile-persisted. */
  showConsole: boolean;
  showJunkFiles: boolean;
  skipDestructiveSqlPrompt: boolean;
  /** Persist optional auto-reconnect after application idle disconnect (ADR-0008). */
  autoReconnectInteractive: boolean;
  /** When true, compile warnings block Database Source Document close completion (#135). */
  blockCloseOnCompileWarnings: boolean;
  rightTools: ReadonlyArray<"files" | "mappings">;
}>;

export type DensityMode = "compact" | "default" | "comfortable";

/** Auto follows the 1100px shell breakpoint; icons / icons-labels force either mode. */
export type ActivityRailLabelsMode = "auto" | "icons" | "icons-labels";

export const ACTIVITY_RAIL_AUTO_BREAKPOINT_PX = 1100;
export const ACTIVITY_RAIL_ICONS_WIDTH_PX = 66;
export const ACTIVITY_RAIL_LABELS_WIDTH_PX = 126;

export const activityRailAutoQuery = `(min-width: ${ACTIVITY_RAIL_AUTO_BREAKPOINT_PX}px)`;

export const resolveActivityRailShowLabels = (
  mode: ActivityRailLabelsMode,
  viewportAtLeastBreakpoint: boolean,
): boolean => {
  if (mode === "icons-labels") {
    return true;
  }
  if (mode === "icons") {
    return false;
  }
  return viewportAtLeastBreakpoint;
};

export const activityRailWidthPx = (showLabels: boolean): number =>
  showLabels ? ACTIVITY_RAIL_LABELS_WIDTH_PX : ACTIVITY_RAIL_ICONS_WIDTH_PX;

const DRAWER_SIDES: readonly DrawerSide[] = ["left", "right"];

const sanitizeDrawerSide = (value: unknown, fallback: DrawerSide): DrawerSide =>
  typeof value === "string" && DRAWER_SIDES.includes(value as DrawerSide)
    ? (value as DrawerSide)
    : fallback;

export type WorkspaceTabKind =
  | "mission"
  | "sql"
  | "schema"
  | "file"
  | "mappings"
  | "object"
  | "package"
  | "apex"
  | "rest"
  | "diff";

const PERSISTED_TAB_KINDS = new Set<WorkspaceTabKind>([
  "mission",
  "sql",
  "file",
  "object",
  "package",
  "apex",
  "rest",
  "diff",
]);

/** Sticky Database Source Document attachment persisted across Workspace reload (#145). */
export type PersistedDatabaseSourceTab = Readonly<{
  target: Readonly<{
    connectionProfileId: string | null;
    workingSchema: string | null;
    owner: string;
    objectTypes: readonly string[];
    name: string;
  }>;
  attachmentState: "unconnected" | "attached" | "retarget_pending";
  baselineFingerprints?: ReadonlyArray<{
    owner: string;
    name: string;
    unit_type: string;
    digest: string;
    exists?: boolean;
    status?: string | null;
  }>;
}>;

export type ProjectTabState = Readonly<{
  openTabs: ReadonlyArray<{
    id: string;
    kind: WorkspaceTabKind;
    title: string;
    path?: string;
    schemaName?: string;
    /** Last known buffer for Database Source Documents (path tabs rehydrate from disk). */
    content?: string;
    databaseSource?: PersistedDatabaseSourceTab;
  }>;
  activeTabId: string | null;
  activeCenterTabId?: string | null;
  activeInspectorTabId?: string | null;
}>;

export type ProjectWorkspaceDefaults = Readonly<{
  connectionName: string | null;
  schemaName: string | null;
}>;

const PROFILE_KEY = "apex-pilot.profile-layout";
const projectKey = (projectId: string) => `apex-pilot.project-tabs.${projectId}`;
const projectDefaultsKey = (projectId: string) => `apex-pilot.project-defaults.${projectId}`;
const densityModes: readonly DensityMode[] = ["compact", "default", "comfortable"];
const activityRailLabelsModes: readonly ActivityRailLabelsMode[] = [
  "auto",
  "icons",
  "icons-labels",
];

const sanitizeDensity = (value: unknown): DensityMode =>
  typeof value === "string" && densityModes.includes(value as DensityMode)
    ? (value as DensityMode)
    : "default";

const sanitizeActivityRailLabels = (value: unknown): ActivityRailLabelsMode =>
  typeof value === "string" &&
  activityRailLabelsModes.includes(value as ActivityRailLabelsMode)
    ? (value as ActivityRailLabelsMode)
    : "auto";

export const defaultProfileLayout = (): ProfileLayoutPrefs => ({
  leftWidth: EXPLORER_DEFAULT_WIDTH,
  rightWidth: INSPECTOR_DEFAULT_WIDTH,
  databaseWidth: DATABASE_DEFAULT_WIDTH,
  missionWidth: MISSION_DEFAULT_WIDTH,
  consoleHeight: CONSOLE_DEFAULT_HEIGHT,
  density: "default",
  activityRailLabels: "auto",
  explorerDrawerSide: "left",
  inspectorDrawerSide: "right",
  databaseDrawerSide: "right",
  // Console remains profile-persisted Layout Chrome (collapsed by default).
  showConsole: false,
  showJunkFiles: false,
  skipDestructiveSqlPrompt: false,
  autoReconnectInteractive: false,
  blockCloseOnCompileWarnings: false,
  // Legacy field; Inspector is no longer a tool-tab host (issue #36).
  rightTools: [],
});

export const loadProfileLayout = (profileId: string | null): ProfileLayoutPrefs => {
  if (!profileId) {
    return defaultProfileLayout();
  }
  try {
    const raw = localStorage.getItem(`${PROFILE_KEY}.${profileId}`);
    if (!raw) {
      return defaultProfileLayout();
    }
    const parsed = JSON.parse(raw) as Partial<ProfileLayoutPrefs> & {
      showExplorer?: boolean;
      showMission?: boolean;
      showInspector?: boolean;
    };
    const defaults = defaultProfileLayout();
    const merged = {
      ...defaults,
      ...parsed,
    };
    return {
      leftWidth: clampExplorerWidth(merged.leftWidth),
      rightWidth: clampInspectorWidth(merged.rightWidth),
      databaseWidth: clampDatabaseWidth(merged.databaseWidth ?? defaults.databaseWidth),
      missionWidth: clampMissionWidth(merged.missionWidth ?? defaults.missionWidth),
      consoleHeight: clampConsoleHeight(merged.consoleHeight),
      density: sanitizeDensity(merged.density),
      activityRailLabels: sanitizeActivityRailLabels(merged.activityRailLabels),
      explorerDrawerSide: sanitizeDrawerSide(merged.explorerDrawerSide, defaults.explorerDrawerSide),
      inspectorDrawerSide: sanitizeDrawerSide(
        merged.inspectorDrawerSide,
        defaults.inspectorDrawerSide,
      ),
      databaseDrawerSide: sanitizeDrawerSide(merged.databaseDrawerSide, defaults.databaseDrawerSide),
      showConsole: Boolean(merged.showConsole),
      showJunkFiles: Boolean(merged.showJunkFiles),
      skipDestructiveSqlPrompt: Boolean(merged.skipDestructiveSqlPrompt),
      autoReconnectInteractive: Boolean(merged.autoReconnectInteractive),
      blockCloseOnCompileWarnings: Boolean(merged.blockCloseOnCompileWarnings),
      rightTools: Array.isArray(merged.rightTools) ? merged.rightTools : [],
    };
  } catch {
    return defaultProfileLayout();
  }
};

export const saveProfileLayout = (profileId: string, prefs: ProfileLayoutPrefs): void => {
  localStorage.setItem(`${PROFILE_KEY}.${profileId}`, JSON.stringify(prefs));
};

const sanitizeDatabaseSource = (value: unknown): PersistedDatabaseSourceTab | undefined => {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Partial<PersistedDatabaseSourceTab> & {
    target?: Partial<PersistedDatabaseSourceTab["target"]>;
  };
  const target = raw.target;
  if (!target || typeof target.owner !== "string" || typeof target.name !== "string") {
    return undefined;
  }
  const attachmentState =
    raw.attachmentState === "attached" ||
    raw.attachmentState === "retarget_pending" ||
    raw.attachmentState === "unconnected"
      ? raw.attachmentState
      : "unconnected";
  const objectTypes = Array.isArray(target.objectTypes)
    ? target.objectTypes.filter((item): item is string => typeof item === "string")
    : [];
  const baselineFingerprints = Array.isArray(raw.baselineFingerprints)
    ? raw.baselineFingerprints
        .filter(
          (item): item is NonNullable<PersistedDatabaseSourceTab["baselineFingerprints"]>[number] =>
            Boolean(item) &&
            typeof item === "object" &&
            typeof item.owner === "string" &&
            typeof item.name === "string" &&
            typeof item.unit_type === "string" &&
            typeof item.digest === "string",
        )
        .map((item) => ({
          owner: item.owner,
          name: item.name,
          unit_type: item.unit_type,
          digest: item.digest,
          exists: item.exists,
          status: item.status ?? null,
        }))
    : undefined;
  return {
    target: {
      connectionProfileId:
        typeof target.connectionProfileId === "string" ? target.connectionProfileId : null,
      workingSchema: typeof target.workingSchema === "string" ? target.workingSchema : null,
      owner: target.owner,
      objectTypes,
      name: target.name,
    },
    attachmentState,
    baselineFingerprints,
  };
};

export const loadProjectTabs = (projectId: string): ProjectTabState => {
  try {
    const raw = localStorage.getItem(projectKey(projectId));
    if (!raw) {
      return { openTabs: [], activeTabId: null };
    }
    const parsed = JSON.parse(raw) as ProjectTabState;
    const openTabs = (parsed.openTabs ?? [])
      .filter((tab) => PERSISTED_TAB_KINDS.has(tab.kind))
      .map((tab) => {
        const databaseSource = sanitizeDatabaseSource(tab.databaseSource);
        return {
          id: tab.id,
          kind: tab.kind,
          title: tab.title,
          path: tab.path,
          schemaName: tab.schemaName,
          content: typeof tab.content === "string" ? tab.content : undefined,
          databaseSource,
        };
      });
    const activeTabId =
      parsed.activeTabId && openTabs.some((tab) => tab.id === parsed.activeTabId)
        ? parsed.activeTabId
        : openTabs[0]?.id ?? null;
    const activeCenterTabId =
      parsed.activeCenterTabId && openTabs.some((tab) => tab.id === parsed.activeCenterTabId)
        ? parsed.activeCenterTabId
        : undefined;
    const activeInspectorTabId =
      parsed.activeInspectorTabId &&
      openTabs.some((tab) => tab.id === parsed.activeInspectorTabId)
        ? parsed.activeInspectorTabId
        : undefined;
    return { openTabs, activeTabId, activeCenterTabId, activeInspectorTabId };
  } catch {
    return { openTabs: [], activeTabId: null };
  }
};

export const saveProjectTabs = (projectId: string, state: ProjectTabState): void => {
  localStorage.setItem(projectKey(projectId), JSON.stringify(state));
};

export const loadProjectDefaults = (projectId: string): ProjectWorkspaceDefaults => {
  try {
    const raw = localStorage.getItem(projectDefaultsKey(projectId));
    if (!raw) {
      return { connectionName: null, schemaName: null };
    }
    const parsed = JSON.parse(raw) as Partial<ProjectWorkspaceDefaults>;
    return {
      connectionName: parsed.connectionName ?? null,
      schemaName: parsed.schemaName ?? null,
    };
  } catch {
    return { connectionName: null, schemaName: null };
  }
};

export const saveProjectDefaults = (
  projectId: string,
  defaults: ProjectWorkspaceDefaults,
): void => {
  localStorage.setItem(projectDefaultsKey(projectId), JSON.stringify(defaults));
};

/** Prefer login identity: proxy user[SCHEMA], then SESSION_USER, then CURRENT_SCHEMA. */
export const schemaFromSessionUser = (
  currentUser: string | null | undefined,
  currentSchema?: string | null,
): string | null => {
  if (currentUser?.trim()) {
    const trimmed = currentUser.trim();
    const proxyMatch = /^([^[\]]+)\[([A-Za-z][A-Za-z0-9_$#]*)\]$/.exec(trimmed);
    if (proxyMatch?.[2]) {
      return proxyMatch[2].toUpperCase();
    }
    return trimmed.toUpperCase();
  }
  if (currentSchema?.trim()) {
    return currentSchema.trim().toUpperCase();
  }
  return null;
};
