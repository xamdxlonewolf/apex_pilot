import type { BackendStatus, InteractivePoolStatus } from "./backend";

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

/** Honest interactive driver binding cue (separate from SQLcl MCP / Backend). */
export const interactiveHealthLabel = (status: InteractivePoolStatus): ShellHealthItem => {
  const name = status.display_name?.trim() || status.profile_id?.trim() || null;
  switch (status.state) {
    case "connected":
      return {
        label: name ? `Interactive: ${name}` : "Interactive: Connected",
        tone: "ok",
      };
    case "connecting":
      return { label: "Interactive: Connecting…", tone: "warn" };
    case "reconnecting":
      return { label: "Interactive: Reconnecting…", tone: "warn" };
    case "dead":
      return { label: "Interactive: Dead", tone: "bad" };
    case "disconnected":
    default:
      return { label: "Interactive: Disconnected", tone: "idle" };
  }
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
