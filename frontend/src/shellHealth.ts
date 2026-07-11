import type { BackendStatus } from "./backend";

export type ShellHealthTone = "ok" | "warn" | "bad" | "idle";

export type ShellHealthItem = Readonly<{
  label: string;
  tone: ShellHealthTone;
}>;

export const backendHealthLabel = (status: BackendStatus): ShellHealthItem => {
  switch (status.kind) {
    case "online":
      return { label: "Backend online", tone: "ok" };
    case "offline":
      return { label: "Backend offline", tone: "bad" };
    case "checking":
      return { label: "Backend checking", tone: "warn" };
    case "missing-config":
      return { label: "Backend not configured", tone: "bad" };
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
          ? `MCP session open · ${activityCount} events logged`
          : "MCP session open · no events logged",
      tone: "idle",
    };
  }
  if (activityCount > 0) {
    return { label: `MCP idle · ${activityCount} events logged`, tone: "idle" };
  }
  return { label: "MCP idle", tone: "idle" };
};

export const connectionHealthLabel = (
  connectedConnection: string | null,
  isConnecting: boolean,
): ShellHealthItem => {
  if (isConnecting) {
    return { label: "Connection connecting", tone: "warn" };
  }
  if (connectedConnection) {
    return { label: `Connection ${connectedConnection}`, tone: "ok" };
  }
  return { label: "Connection offline", tone: "idle" };
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
