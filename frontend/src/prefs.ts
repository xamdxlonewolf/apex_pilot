/** Local layout prefs: profile-scoped chrome, project-scoped tabs. */

import {
  CONSOLE_DEFAULT_HEIGHT,
  EXPLORER_DEFAULT_WIDTH,
  INSPECTOR_DEFAULT_WIDTH,
  clampConsoleHeight,
  clampExplorerWidth,
  clampInspectorWidth,
  type PanelId,
} from "./panelLayout";

export type ProfileLayoutPrefs = Readonly<{
  leftWidth: number;
  rightWidth: number;
  consoleHeight: number;
  density: DensityMode;
  showExplorer: boolean;
  showMission: boolean;
  showInspector: boolean;
  showConsole: boolean;
  showJunkFiles: boolean;
  skipDestructiveSqlPrompt: boolean;
  rightTools: ReadonlyArray<"schema" | "files" | "mappings">;
}>;

export type DensityMode = "compact" | "default" | "comfortable";

export const panelVisibilityKey = (
  panel: PanelId,
): "showExplorer" | "showMission" | "showInspector" | "showConsole" => {
  switch (panel) {
    case "explorer":
      return "showExplorer";
    case "mission":
      return "showMission";
    case "inspector":
      return "showInspector";
    case "console":
      return "showConsole";
  }
};

export const togglePanelVisibility = (
  prefs: ProfileLayoutPrefs,
  panel: PanelId,
): ProfileLayoutPrefs => {
  const key = panelVisibilityKey(panel);
  return { ...prefs, [key]: !prefs[key] };
};

export type WorkspaceTabKind = "mission" | "sql" | "schema" | "file" | "mappings";

export type ProjectTabState = Readonly<{
  openTabs: ReadonlyArray<{
    id: string;
    kind: WorkspaceTabKind;
    title: string;
    path?: string;
    schemaName?: string;
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

const sanitizeDensity = (value: unknown): DensityMode =>
  typeof value === "string" && densityModes.includes(value as DensityMode) ? (value as DensityMode) : "default";

export const defaultProfileLayout = (): ProfileLayoutPrefs => ({
  leftWidth: EXPLORER_DEFAULT_WIDTH,
  rightWidth: INSPECTOR_DEFAULT_WIDTH,
  consoleHeight: CONSOLE_DEFAULT_HEIGHT,
  density: "default",
  // Spec §20 startup: Explorer/Mission/Inspector expanded; bottom console collapsed.
  showExplorer: true,
  showMission: true,
  showInspector: true,
  showConsole: false,
  showJunkFiles: false,
  skipDestructiveSqlPrompt: false,
  rightTools: ["schema", "mappings"],
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
    const merged = {
      ...defaultProfileLayout(),
      ...(JSON.parse(raw) as Partial<ProfileLayoutPrefs>),
    };
    return {
      ...merged,
      leftWidth: clampExplorerWidth(merged.leftWidth),
      rightWidth: clampInspectorWidth(merged.rightWidth),
      consoleHeight: clampConsoleHeight(merged.consoleHeight),
      density: sanitizeDensity(merged.density),
    };
  } catch {
    return defaultProfileLayout();
  }
};

export const saveProfileLayout = (profileId: string, prefs: ProfileLayoutPrefs): void => {
  localStorage.setItem(`${PROFILE_KEY}.${profileId}`, JSON.stringify(prefs));
};

export const loadProjectTabs = (projectId: string): ProjectTabState => {
  try {
    const raw = localStorage.getItem(projectKey(projectId));
    if (!raw) {
      return { openTabs: [], activeTabId: null };
    }
    return JSON.parse(raw) as ProjectTabState;
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
