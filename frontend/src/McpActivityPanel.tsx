import { useState } from "react";

import { ActivityTree } from "./ActivityTree";
import type { ActivityEntry } from "./backend";

type McpActivityPanelProps = Readonly<{
  entries: ActivityEntry[];
  connectionName: string | null;
  activeSessionId: string | null;
}>;

export const McpActivityPanel = ({
  entries,
  connectionName,
  activeSessionId,
}: McpActivityPanelProps) => {
  const [showAll, setShowAll] = useState(false);

  return (
    <div className="mcp-activity-panel" aria-label="MCP Activity panel">
      <div className="mcp-activity-panel-toolbar">
        <label className="chrome-check">
          <input
            type="checkbox"
            checked={showAll}
            onChange={(event) => setShowAll(event.target.checked)}
          />
          Show all connections
        </label>
      </div>
      <div className="mcp-activity-panel-body">
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
