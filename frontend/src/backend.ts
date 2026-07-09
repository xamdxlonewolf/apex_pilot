export type BackendConfig = Readonly<{
  baseUrl?: string;
  bearerToken?: string;
}>;

export type BackendHealth = Readonly<{
  status: "ok";
  service: string;
  version: string;
}>;

export type BackendStatus =
  | Readonly<{ kind: "missing-config" }>
  | Readonly<{ kind: "checking"; baseUrl: string }>
  | Readonly<{ kind: "online"; baseUrl: string; health: BackendHealth }>
  | Readonly<{ kind: "offline"; baseUrl: string; message: string }>;

export type SavedConnection = Readonly<{
  name: string;
  display_name: string | null;
}>;

export type SavedConnectionsResponse = Readonly<{
  connections: SavedConnection[];
}>;

export type ConnectResponse = Readonly<{
  connection_name: string;
}>;

export type DatabaseContext = Readonly<{
  current_user: string | null;
  db_name: string | null;
  container_name: string | null;
  cdb_name: string | null;
  host: string | null;
}>;

export type SchemaObjectCount = Readonly<{
  object_type: string;
  object_count: number;
  valid_count: number;
  invalid_count: number;
}>;

export type SchemaTable = Readonly<{
  table_name: string;
  num_rows: number | null;
  last_analyzed: string | null;
  partitioned: string | null;
  iot_type: string | null;
}>;

export type SchemaSummary = Readonly<{
  connection_name: string | null;
  schema_name: string;
  captured_at: string;
  cache_age_seconds: number;
  database_context: DatabaseContext;
  object_counts: SchemaObjectCount[];
  tables: SchemaTable[];
}>;

export type ActivityEntry = Readonly<{
  sequence: number;
  timestamp: string;
  tool_name: string;
  arguments: Record<string, unknown>;
  status: "succeeded" | "failed";
  message: string | null;
  connection_name: string | null;
  session_id: string | null;
}>;

export type ActivityResponse = Readonly<{
  entries: ActivityEntry[];
  active_session_id: string | null;
}>;

type RuntimeWindow = Window &
  typeof globalThis & {
    __APEX_PILOT__?: BackendConfig;
    __TAURI_INTERNALS__?: unknown;
  };

const normalizeBaseUrl = (baseUrl: string): string => baseUrl.replace(/\/+$/, "");

export const getBackendConfig = (): BackendConfig => {
  const runtimeConfig = (window as RuntimeWindow).__APEX_PILOT__;

  return {
    baseUrl: runtimeConfig?.baseUrl ?? import.meta.env.VITE_APEX_PILOT_BACKEND_URL,
    bearerToken: runtimeConfig?.bearerToken ?? import.meta.env.VITE_APEX_PILOT_BACKEND_TOKEN,
  };
};

export const resolveBackendConfig = async (): Promise<BackendConfig> => {
  const config = getBackendConfig();
  if (config.baseUrl || !(window as RuntimeWindow).__TAURI_INTERNALS__) {
    return config;
  }

  try {
    const { invoke } = await import("@tauri-apps/api/core");
    return (await invoke("backend_config")) as BackendConfig;
  } catch {
    return config;
  }
};

export class BackendApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

export const checkBackendHealth = async (
  config: BackendConfig = getBackendConfig(),
): Promise<BackendStatus> => {
  if (!config.baseUrl) {
    return { kind: "missing-config" };
  }

  const baseUrl = normalizeBaseUrl(config.baseUrl);
  const headers = new Headers();

  if (config.bearerToken) {
    headers.set("Authorization", `Bearer ${config.bearerToken}`);
  }

  try {
    const response = await fetch(`${baseUrl}/health`, { headers });

    if (!response.ok) {
      return {
        kind: "offline",
        baseUrl,
        message: `Health check returned HTTP ${response.status}`,
      };
    }

    const health = (await response.json()) as BackendHealth;
    return { kind: "online", baseUrl, health };
  } catch (error) {
    return {
      kind: "offline",
      baseUrl,
      message: error instanceof Error ? error.message : "Health check failed",
    };
  }
};

export const listSavedConnections = async (
  config: BackendConfig = getBackendConfig(),
): Promise<SavedConnectionsResponse> => apiFetch("/connections", {}, config);

export const connectSavedConnection = async (
  connectionName: string,
  config: BackendConfig = getBackendConfig(),
): Promise<ConnectResponse> =>
  apiFetch(
    `/connections/${encodeURIComponent(connectionName)}/connect`,
    { method: "POST" },
    config,
  );

export const getSchemaSummary = async (
  schemaName: string,
  options: Readonly<{ refresh?: boolean; config?: BackendConfig }> = {},
): Promise<SchemaSummary> => {
  const params = new URLSearchParams({
    schema: schemaName,
  });

  if (options.refresh) {
    params.set("refresh", "true");
  }

  return apiFetch(`/schema/summary?${params.toString()}`, {}, options.config);
};

export const listActivity = async (
  options: Readonly<{ connectionName?: string | null; config?: BackendConfig }> = {},
): Promise<ActivityResponse> => {
  const params = new URLSearchParams();
  if (options.connectionName) {
    params.set("connection", options.connectionName);
  }
  const query = params.toString();
  return apiFetch(`/activity${query ? `?${query}` : ""}`, {}, options.config);
};

export type PrerequisiteGuide = Readonly<{
  title: string;
  summary: string;
  steps: string[];
  docs_url: string | null;
}>;

export type PreflightCheck = Readonly<{
  id: string;
  label: string;
  status: "ok" | "warning" | "missing" | "failed";
  detail: string;
  guide: PrerequisiteGuide | null;
}>;

export type PreflightReport = Readonly<{
  ready: boolean;
  blocking_ids: string[];
  checks: PreflightCheck[];
}>;

export type LocalProfile = Readonly<{
  profile_id: string;
  display_name: string;
  email: string | null;
  username: string | null;
  created_at: string;
  updated_at: string;
}>;

export type ProjectSummary = Readonly<{
  project_id: string;
  profile_id: string;
  name: string;
  root_path: string;
  retention_days: number | null;
  created_at: string;
  updated_at: string;
}>;

export type OpenedProject = Readonly<{
  project: ProjectSummary;
  manifest: Record<string, unknown>;
  environment_mappings: ReadonlyArray<{
    environment_name: string;
    sqlcl_connection_name: string;
  }>;
  apex_workspace_mappings: ReadonlyArray<{
    sqlcl_connection_name: string;
    workspace_name: string;
  }>;
  unmapped_environments: string[];
  preflight: PreflightReport;
}>;

export const getPreflight = async (
  options: Readonly<{ projectRoot?: string | null; config?: BackendConfig }> = {},
): Promise<PreflightReport> => {
  const params = new URLSearchParams();
  if (options.projectRoot) {
    params.set("project_root", options.projectRoot);
  }
  const query = params.toString();
  return apiFetch(`/preflight${query ? `?${query}` : ""}`, {}, options.config);
};

export const listProfiles = async (
  config: BackendConfig = getBackendConfig(),
): Promise<{ profiles: LocalProfile[] }> => apiFetch("/profiles", {}, config);

export const createProfile = async (
  body: Readonly<{
    display_name: string;
    email?: string | null;
    username?: string | null;
    force_new?: boolean;
  }>,
  config: BackendConfig = getBackendConfig(),
): Promise<LocalProfile> =>
  apiFetch(
    "/profiles",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    config,
  );

export const listProjects = async (
  options: Readonly<{ profileId?: string | null; limit?: number; config?: BackendConfig }> = {},
): Promise<{ projects: ProjectSummary[] }> => {
  const params = new URLSearchParams();
  if (options.profileId) {
    params.set("profile_id", options.profileId);
  }
  if (options.limit) {
    params.set("limit", String(options.limit));
  }
  const query = params.toString();
  return apiFetch(`/projects${query ? `?${query}` : ""}`, {}, options.config);
};

export const getCurrentProject = async (
  config: BackendConfig = getBackendConfig(),
): Promise<OpenedProject | null> => apiFetch("/projects/current", {}, config);

export const closeCurrentProject = async (
  config: BackendConfig = getBackendConfig(),
): Promise<void> => {
  await apiFetch("/projects/close", { method: "POST" }, config);
};

export const createProject = async (
  body: Readonly<{
    profile_id: string;
    name: string;
    root_path: string;
    description?: string | null;
    retention_days?: number | null;
    retention_indefinite?: boolean;
    init_git?: boolean;
    write_readme?: boolean;
    apex_workspace_hint?: string | null;
    apex_app_id?: number | null;
  }>,
  config: BackendConfig = getBackendConfig(),
): Promise<OpenedProject> =>
  apiFetch(
    "/projects",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    config,
  );

export const importProject = async (
  body: Readonly<{
    profile_id: string;
    root_path?: string | null;
    remote_url?: string | null;
    clone_parent?: string | null;
    clone_directory_name?: string | null;
    retention_days?: number | null;
    retention_indefinite?: boolean;
  }>,
  config: BackendConfig = getBackendConfig(),
): Promise<OpenedProject> =>
  apiFetch(
    "/projects/import",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    config,
  );

export const openProject = async (
  projectId: string,
  config: BackendConfig = getBackendConfig(),
): Promise<OpenedProject> =>
  apiFetch(`/projects/${encodeURIComponent(projectId)}/open`, { method: "POST" }, config);

export const setEnvironmentMapping = async (
  projectId: string,
  body: Readonly<{ environment_name: string; sqlcl_connection_name: string }>,
  config: BackendConfig = getBackendConfig(),
): Promise<{ environment_name: string; sqlcl_connection_name: string }> =>
  apiFetch(
    `/projects/${encodeURIComponent(projectId)}/environment-mappings`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    config,
  );

export const setApexWorkspaceMapping = async (
  projectId: string,
  body: Readonly<{ sqlcl_connection_name: string; workspace_name: string }>,
  config: BackendConfig = getBackendConfig(),
): Promise<{ sqlcl_connection_name: string; workspace_name: string }> =>
  apiFetch(
    `/projects/${encodeURIComponent(projectId)}/apex-workspace-mappings`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    config,
  );

const apiFetch = async <Payload>(
  path: string,
  init: RequestInit = {},
  config: BackendConfig = getBackendConfig(),
): Promise<Payload> => {
  if (!config.baseUrl) {
    throw new BackendApiError("Backend URL is not configured.");
  }

  const baseUrl = normalizeBaseUrl(config.baseUrl);
  const headers = new Headers(init.headers);

  if (config.bearerToken) {
    headers.set("Authorization", `Bearer ${config.bearerToken}`);
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    throw new BackendApiError(await errorMessageFromResponse(response), response.status);
  }

  if (response.status === 204) {
    return undefined as Payload;
  }

  const text = await response.text();
  if (!text) {
    return null as Payload;
  }

  return JSON.parse(text) as Payload;
};

const errorMessageFromResponse = async (response: Response): Promise<string> => {
  try {
    const payload = (await response.json()) as { detail?: unknown };
    if (typeof payload.detail === "string") {
      return payload.detail;
    }
  } catch {
    // Fall back to the status message below when the backend returns non-JSON.
  }

  return `Backend request returned HTTP ${response.status}`;
};
