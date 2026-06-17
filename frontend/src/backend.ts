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
}>;

export type ActivityResponse = Readonly<{
  entries: ActivityEntry[];
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
  config: BackendConfig = getBackendConfig(),
): Promise<ActivityResponse> => apiFetch("/activity", {}, config);

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

  return (await response.json()) as Payload;
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
