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

type RuntimeWindow = Window &
  typeof globalThis & {
    __APEX_PILOT__?: BackendConfig;
  };

const normalizeBaseUrl = (baseUrl: string): string => baseUrl.replace(/\/+$/, "");

export const getBackendConfig = (): BackendConfig => {
  const runtimeConfig = (window as RuntimeWindow).__APEX_PILOT__;

  return {
    baseUrl: runtimeConfig?.baseUrl ?? import.meta.env.VITE_APEX_PILOT_BACKEND_URL,
    bearerToken: runtimeConfig?.bearerToken ?? import.meta.env.VITE_APEX_PILOT_BACKEND_TOKEN,
  };
};

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
