import { useState } from "react";

import { ActivityTree } from "./ActivityTree";
import type { ActivityEntry } from "./backend";

type McpActivityWindowProps = Readonly<{
  open: boolean;
  onClose: () => void;
  entries: ActivityEntry[];
  connectionName: string | null;
  activeSessionId: string | null;
  variant?: "overlay" | "window";
}>;

export const McpActivityWindow = ({
  open,
  onClose,
  entries,
  connectionName,
  activeSessionId,
  variant = "overlay",
}: McpActivityWindowProps) => {
  const [showAll, setShowAll] = useState(false);

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
        </div>
        <div className="mcp-float-actions">
          <label className="chrome-check">
            <input
              type="checkbox"
              checked={showAll}
              onChange={(event) => setShowAll(event.target.checked)}
            />
            Show all connections
          </label>
          <button type="button" className="chrome-button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
      <div className="mcp-window-body">
        <ActivityTree
          entries={entries}
          connectionName={connectionName}
          activeSessionId={activeSessionId}
          showAll={showAll}
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
