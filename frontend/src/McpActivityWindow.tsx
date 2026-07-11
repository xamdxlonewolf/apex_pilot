import { McpActivityPanel } from "./McpActivityPanel";
import type { ActivityEntry } from "./backend";

type McpActivityWindowProps = Readonly<{
  open: boolean;
  onClose: () => void;
  entries: ActivityEntry[];
  connectionName: string | null;
  activeSessionId: string | null;
  variant?: "overlay" | "window";
}>;

/**
 * Interim floating / child-window host for MCP Activity.
 * Product path is the Developer Console MCP Activity tab; this remains for
 * no-project browser fallback and the optional Tauri `?view=mcp-activity` window.
 */
export const McpActivityWindow = ({
  open,
  onClose,
  entries,
  connectionName,
  activeSessionId,
  variant = "overlay",
}: McpActivityWindowProps) => {
  if (!open) {
    return null;
  }

  return (
    <div
      className={variant === "window" ? "mcp-window" : "mcp-float"}
      role="dialog"
      aria-label="MCP Activity"
    >
      <div className="mcp-float-header">
        <div>
          <p className="chrome-label">MCP Activity</p>
          <h2>Tool calls</h2>
          <p className="pane-muted">
            Interim path — prefer Developer Console → MCP Activity when a project is open.
          </p>
        </div>
        <div className="mcp-float-actions">
          <button type="button" className="chrome-button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
      <div className="mcp-window-body">
        <McpActivityPanel
          entries={entries}
          connectionName={connectionName}
          activeSessionId={activeSessionId}
        />
      </div>
    </div>
  );
};

export const openMcpActivityWindow = async (): Promise<boolean> => {
  const runtime = window as Window & { __TAURI_INTERNALS__?: unknown };
  if (!runtime.__TAURI_INTERNALS__) {
    return false;
  }
  try {
    const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
    const existing = await WebviewWindow.getByLabel("mcp-activity");
    if (existing) {
      await existing.setFocus();
      return true;
    }
    const child = new WebviewWindow("mcp-activity", {
      url: "/?view=mcp-activity",
      title: "MCP Activity",
      width: 520,
      height: 640,
      resizable: true,
    });
    await new Promise<void>((resolve, reject) => {
      child.once("tauri://created", () => resolve());
      child.once("tauri://error", (event) => reject(event));
    });
    return true;
  } catch {
    return false;
  }
};
