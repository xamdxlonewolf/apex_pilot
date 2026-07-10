/** Local layout prefs: profile-scoped chrome, project-scoped tabs. */

export type ProfileLayoutPrefs = Readonly<{
  leftWidth: number;
  rightWidth: number;
  showJunkFiles: boolean;
  skipDestructiveSqlPrompt: boolean;
  rightTools: ReadonlyArray<"schema" | "sql" | "files" | "mappings">;
}>;

export type ProjectTabState = Readonly<{
  openTabs: ReadonlyArray<{
    id: string;
    kind: "schema" | "sql" | "file" | "mappings";
    title: string;
    path?: string;
    schemaName?: string;
  }>;
  activeTabId: string | null;
}>;

export type ProjectWorkspaceDefaults = Readonly<{
  connectionName: string | null;
  schemaName: string | null;
}>;

const PROFILE_KEY = "apex-pilot.profile-layout";
const projectKey = (projectId: string) => `apex-pilot.project-tabs.${projectId}`;
const projectDefaultsKey = (projectId: string) => `apex-pilot.project-defaults.${projectId}`;

export const defaultProfileLayout = (): ProfileLayoutPrefs => ({
  leftWidth: 260,
  rightWidth: 360,
  showJunkFiles: false,
  skipDestructiveSqlPrompt: false,
  rightTools: ["schema", "sql", "mappings"],
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
    return { ...defaultProfileLayout(), ...(JSON.parse(raw) as Partial<ProfileLayoutPrefs>) };
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
