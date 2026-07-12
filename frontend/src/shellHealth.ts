import type { BackendStatus } from "./backend";

export type ShellHealthTone = "ok" | "warn" | "bad" | "idle";

export type ShellHealthItem = Readonly<{
  label: string;
  tone: ShellHealthTone;
}>;

export const backendHealthLabel = (status: BackendStatus): ShellHealthItem => {
  switch (status.kind) {
    case "online":
      return { label: "Backend: Healthy", tone: "ok" };
    case "offline":
      return { label: "Backend: Offline", tone: "bad" };
    case "checking":
      return { label: "Backend: Checking…", tone: "warn" };
    case "missing-config":
      return { label: "Backend: Not configured", tone: "bad" };
  }
};

export const mcpHealthLabel = (
  activityCount: number,
  hasActiveSession: boolean,
): ShellHealthItem => {
  // Activity log presence is not an MCP health probe — stay idle/warn only.
  if (hasActiveSession) {
    return {
      label:
        activityCount > 0
          ? `SQLcl MCP: Connected · ${activityCount}`
          : "SQLcl MCP: Connected",
      tone: "ok",
    };
  }
  if (activityCount > 0) {
    return { label: `SQLcl MCP: Idle · ${activityCount}`, tone: "idle" };
  }
  return { label: "SQLcl MCP: Idle", tone: "idle" };
};

export const connectionHealthLabel = (
  connectedConnection: string | null,
  isConnecting: boolean,
): ShellHealthItem => {
  if (isConnecting) {
    return { label: "Connection: Connecting…", tone: "warn" };
  }
  if (connectedConnection) {
    return { label: `Connected: ${connectedConnection}`, tone: "ok" };
  }
  return { label: "Connection: Offline", tone: "idle" };
};

export const environmentIdentity = (manifest: unknown): string => {
  const typed = manifest as {
    defaultEnvironment?: string;
    environments?: ReadonlyArray<{ name?: string }>;
  };
  const named = typed.defaultEnvironment?.trim();
  if (named) {
    return named;
  }
  const first = typed.environments?.find((env) => env.name?.trim())?.name?.trim();
  return first || "No environment";
};
