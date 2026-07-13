import { useEffect, useState } from "react";

import { McpActivityPanel } from "./McpActivityPanel";
import { StubSurface } from "./StubSurface";
import type { ActivityEntry } from "./backend";

type ConsoleTabId =
  | "problems"
  | "output"
  | "mcp-activity"
  | "sql-history"
  | "oracle-messages"
  | "tasks";

type ConsoleTab = Readonly<{
  id: ConsoleTabId;
  title: string;
  secondary: string;
}>;

const CONSOLE_TABS: ReadonlyArray<ConsoleTab> = [
  {
    id: "problems",
    title: "Problems",
    secondary: "Problems list arrives with diagnostics integration.",
  },
  {
    id: "output",
    title: "Output",
    secondary: "Output stream arrives with command execution wiring.",
  },
  {
    id: "mcp-activity",
    title: "MCP Activity",
    secondary: "",
  },
  {
    id: "sql-history",
    title: "SQL History",
    secondary: "SQL history arrives with execution persistence.",
  },
  {
    id: "oracle-messages",
    title: "Oracle Messages",
    secondary: "Oracle server messages arrive with SQL execution output.",
  },
  {
    id: "tasks",
    title: "Tasks",
    secondary: "Task tracking arrives with mission execution integration.",
  },
];

type DeveloperConsoleProps = Readonly<{
  entries: ActivityEntry[];
  connectionName: string | null;
  activeSessionId: string | null;
  mcpFocusRequest?: number;
  onMcpFocusHandled?: () => void;
  onClose?: () => void;
}>;

export const DeveloperConsole = ({
  entries,
  connectionName,
  activeSessionId,
  mcpFocusRequest = 0,
  onMcpFocusHandled,
  onClose,
}: DeveloperConsoleProps) => {
  const [activeTabId, setActiveTabId] = useState<ConsoleTabId>(CONSOLE_TABS[0].id);
  const activeTab = CONSOLE_TABS.find((tab) => tab.id === activeTabId) ?? CONSOLE_TABS[0];
  const activeTabButtonId = `developer-console-tab-${activeTab.id}`;
  const activePanelId = `developer-console-panel-${activeTab.id}`;

  useEffect(() => {
    if (mcpFocusRequest <= 0) {
      return;
    }
    setActiveTabId("mcp-activity");
    onMcpFocusHandled?.();
  }, [mcpFocusRequest, onMcpFocusHandled]);

  return (
    <div className="ide-pane ide-pane--console">
      <div className="pane-header pane-header--tabs">
        <div className="tab-strip" role="tablist" aria-label="Developer Console tabs">
          {CONSOLE_TABS.map((tab) => {
            const tabId = `developer-console-tab-${tab.id}`;
            const panelId = `developer-console-panel-${tab.id}`;
            return (
              <button
                key={tab.id}
                id={tabId}
                type="button"
                role="tab"
                aria-selected={tab.id === activeTab.id}
                aria-controls={panelId}
                className={tab.id === activeTab.id ? "tab tab--active" : "tab"}
                onClick={() => setActiveTabId(tab.id)}
              >
                {tab.title}
              </button>
            );
          })}
        </div>
        {onClose ? (
          <button
            type="button"
            className="chrome-button shell-drawer-close"
            aria-label="Close Developer Console"
            onClick={onClose}
          >
            ×
          </button>
        ) : null}
      </div>
      <div
        id={activePanelId}
        role="tabpanel"
        aria-labelledby={activeTabButtonId}
        className="console-tab-panel"
      >
        {activeTab.id === "mcp-activity" ? (
          <McpActivityPanel
            entries={entries}
            connectionName={connectionName}
            activeSessionId={activeSessionId}
          />
        ) : (
          <StubSurface title={activeTab.title} secondary={activeTab.secondary} bodyClassName="console-body" />
        )}
      </div>
    </div>
  );
};
