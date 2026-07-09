import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import {
  type ActivityEntry,
  type BackendConfig,
  type BackendStatus,
  type OpenedProject,
  type SavedConnection,
  type SchemaSummary,
  checkBackendHealth,
  connectSavedConnection,
  getBackendConfig,
  getCurrentProject,
  getSchemaSummary,
  listActivity,
  listSavedConnections,
  resolveBackendConfig,
} from "./backend";
import { ProjectWorkspace } from "./ProjectWorkspace";

const statusCopy = {
  "missing-config": {
    label: "Backend not configured",
    description:
      "Development mode can run without a backend URL. The Tauri sidecar handshake will provide the loopback URL and bearer token in a later PR.",
  },
  checking: {
    label: "Checking backend",
    description: "Requesting the FastAPI health endpoint.",
  },
  online: {
    label: "Backend online",
    description: "FastAPI health endpoint returned successfully.",
  },
  offline: {
    label: "Backend offline",
    description: "The configured backend did not return a healthy response.",
  },
} satisfies Record<BackendStatus["kind"], { label: string; description: string }>;

const statusFromConfig = (config: BackendConfig): BackendStatus => {
  if (!config.baseUrl) {
    return { kind: "missing-config" };
  }

  return { kind: "checking", baseUrl: config.baseUrl };
};

const formatActivityTime = (timestamp: string): string => {
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) {
    return timestamp;
  }
  return parsed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
};

const formatActivityDateTime = (timestamp: string): string => {
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) {
    return timestamp;
  }
  return parsed.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const activityBelongsToConnection = (entry: ActivityEntry, connectionName: string): boolean => {
  if (entry.connection_name === connectionName) {
    return true;
  }
  const args = entry.arguments;
  const candidates = [args.connection_name, args.connectionName, args.name];
  return candidates.some((value) => typeof value === "string" && value === connectionName);
};

const entriesForConnection = (
  entries: ActivityEntry[],
  connectionName: string | null,
): ActivityEntry[] => {
  const newestFirst = [...entries].reverse();
  if (!connectionName) {
    return newestFirst;
  }
  return newestFirst.filter((entry) => activityBelongsToConnection(entry, connectionName));
};

type ActivityGroup = {
  toolName: string;
  entries: ActivityEntry[];
  succeededEntries: ActivityEntry[];
  failedEntries: ActivityEntry[];
  latestTimestamp: string;
  succeededCount: number;
  failedCount: number;
};

type ActivitySessionBucket = {
  sessionId: string;
  label: string;
  isActive: boolean;
  entries: ActivityEntry[];
  startedAt: string;
  succeededCount: number;
  failedCount: number;
  toolGroups: ActivityGroup[];
};

const splitEntriesByStatus = (
  entries: ActivityEntry[],
): { succeeded: ActivityEntry[]; failed: ActivityEntry[] } => ({
  succeeded: entries.filter((entry) => entry.status === "succeeded"),
  failed: entries.filter((entry) => entry.status === "failed"),
});

const groupActivityByTool = (entries: ActivityEntry[]): ActivityGroup[] => {
  const groups = new Map<string, ActivityEntry[]>();
  for (const entry of entries) {
    const existing = groups.get(entry.tool_name);
    if (existing) {
      existing.push(entry);
    } else {
      groups.set(entry.tool_name, [entry]);
    }
  }

  return [...groups.entries()].map(([toolName, toolEntries]) => {
    const { succeeded, failed } = splitEntriesByStatus(toolEntries);
    return {
      toolName,
      entries: toolEntries,
      succeededEntries: succeeded,
      failedEntries: failed,
      latestTimestamp: toolEntries[0]?.timestamp ?? "",
      succeededCount: succeeded.length,
      failedCount: failed.length,
    };
  });
};

const groupActivityBySession = (
  entries: ActivityEntry[],
  activeSessionId: string | null,
): ActivitySessionBucket[] => {
  const sessions = new Map<string, ActivityEntry[]>();
  for (const entry of entries) {
    const sessionKey = entry.session_id ?? "unknown-session";
    const existing = sessions.get(sessionKey);
    if (existing) {
      existing.push(entry);
    } else {
      sessions.set(sessionKey, [entry]);
    }
  }

  const buckets = [...sessions.entries()].map(([sessionId, sessionEntries]) => {
    const isActive = Boolean(activeSessionId) && sessionId === activeSessionId;
    const oldest = sessionEntries[sessionEntries.length - 1];
    const { succeeded, failed } = splitEntriesByStatus(sessionEntries);
    return {
      sessionId,
      label: isActive ? "Active session" : "Previous session",
      isActive,
      entries: sessionEntries,
      startedAt: oldest?.timestamp ?? sessionEntries[0]?.timestamp ?? "",
      succeededCount: succeeded.length,
      failedCount: failed.length,
      toolGroups: groupActivityByTool(sessionEntries),
    };
  });

  return buckets.sort((left, right) => {
    if (left.isActive !== right.isActive) {
      return left.isActive ? -1 : 1;
    }
    return right.startedAt.localeCompare(left.startedAt);
  });
};

const OutcomeSummary = ({
  succeededCount,
  failedCount,
}: {
  succeededCount: number;
  failedCount: number;
}) => (
  <span className="activity-outcome-summary" aria-label={`${succeededCount} succeeded, ${failedCount} failed`}>
    <span className="activity-status activity-status--succeeded">{succeededCount} succeeded</span>
    <span className="activity-outcome-separator" aria-hidden="true">
      ·
    </span>
    <span className="activity-status activity-status--failed">{failedCount} failed</span>
  </span>
);

const CallOutcomeBucket = ({
  label,
  status,
  entries,
  openByDefault = false,
}: {
  label: string;
  status: "succeeded" | "failed";
  entries: ActivityEntry[];
  openByDefault?: boolean;
}) => {
  if (entries.length === 0) {
    return null;
  }

  return (
    <li className={`activity-outcome activity-outcome--${status}`}>
      <details open={openByDefault}>
        <summary>
          <span className="activity-tree-chevron" aria-hidden="true" />
          <span className="activity-tree-main">
            <strong>{label}</strong>
            <span className="activity-tree-count">
              {entries.length} {entries.length === 1 ? "call" : "calls"}
            </span>
          </span>
          <span className={`activity-status activity-status--${status}`}>{status}</span>
        </summary>
        <ul className="activity-call-list" aria-label={`${label} calls`}>
          {entries.map((entry) => (
            <li key={entry.sequence} className="activity-call">
              <details>
                <summary>
                  <span className="activity-tree-chevron" aria-hidden="true" />
                  <span className="activity-tree-main">
                    <strong>#{entry.sequence}</strong>
                    <span className="activity-tree-seq">{formatActivityTime(entry.timestamp)}</span>
                  </span>
                  <span className={`activity-status activity-status--${entry.status}`}>
                    {entry.status}
                  </span>
                </summary>
                <div className="activity-tree-details">
                  {entry.message ? <p>{entry.message}</p> : null}
                  <pre>
                    <code>{JSON.stringify(entry.arguments, null, 2)}</code>
                  </pre>
                </div>
              </details>
            </li>
          ))}
        </ul>
      </details>
    </li>
  );
};

const ToolActivityGroups = ({ groups }: { groups: ActivityGroup[] }) => (
  <ul className="activity-tool-list" aria-label="Tool groups">
    {groups.map((group) => (
      <li key={group.toolName} className="activity-tool">
        <details>
          <summary>
            <span className="activity-tree-chevron" aria-hidden="true" />
            <span className="activity-tree-main">
              <strong>{group.toolName}</strong>
              <span className="activity-tree-count">
                {group.entries.length} {group.entries.length === 1 ? "call" : "calls"}
              </span>
            </span>
            <OutcomeSummary
              succeededCount={group.succeededCount}
              failedCount={group.failedCount}
            />
            <time dateTime={group.latestTimestamp}>{formatActivityTime(group.latestTimestamp)}</time>
          </summary>
          <ul className="activity-outcome-list" aria-label={`${group.toolName} outcomes`}>
            <CallOutcomeBucket
              label="Failed"
              status="failed"
              entries={group.failedEntries}
              openByDefault={group.failedCount > 0}
            />
            <CallOutcomeBucket
              label="Succeeded"
              status="succeeded"
              entries={group.succeededEntries}
            />
          </ul>
        </details>
      </li>
    ))}
  </ul>
);

const ActivityTree = ({
  entries,
  connectionName,
  activeSessionId,
}: {
  entries: ActivityEntry[];
  connectionName: string | null;
  activeSessionId: string | null;
}) => {
  const visibleEntries = useMemo(
    () => entriesForConnection(entries, connectionName),
    [connectionName, entries],
  );
  const sessions = useMemo(
    () => groupActivityBySession(visibleEntries, activeSessionId),
    [activeSessionId, visibleEntries],
  );

  if (!connectionName) {
    return (
      <p className="activity-empty-copy">
        Not connected to a database. Connect to a saved SQLcl connection to view MCP call history.
      </p>
    );
  }

  if (visibleEntries.length === 0) {
    return <p className="activity-empty-copy">No MCP tool activity for this connection yet.</p>;
  }

  return (
    <div className="activity-panel">
      <p className="activity-panel-meta">
        {`${connectionName} · ${sessions.length} sessions · ${visibleEntries.length} calls`}
      </p>
      <ul className="activity-tree" aria-label="MCP tool activity">
        {sessions.map((session) => (
          <li
            key={session.sessionId}
            className={`activity-tree-item activity-session${session.isActive ? " activity-session--active" : ""}`}
          >
            <details open={session.isActive}>
              <summary>
                <span className="activity-tree-chevron" aria-hidden="true" />
                <span className="activity-tree-main">
                  <strong>{session.label}</strong>
                  <span className="activity-tree-count">
                    {session.entries.length} {session.entries.length === 1 ? "call" : "calls"} ·{" "}
                    {session.toolGroups.length}{" "}
                    {session.toolGroups.length === 1 ? "tool" : "tools"}
                  </span>
                </span>
                <OutcomeSummary
                  succeededCount={session.succeededCount}
                  failedCount={session.failedCount}
                />
                <time dateTime={session.startedAt}>{formatActivityDateTime(session.startedAt)}</time>
              </summary>
              <div className="activity-session-body">
                <ToolActivityGroups groups={session.toolGroups} />
              </div>
            </details>
          </li>
        ))}
      </ul>
    </div>
  );
};

export const App = () => {
  const [backendConfig, setBackendConfig] = useState<BackendConfig>(() => getBackendConfig());
  const [backendStatus, setBackendStatus] = useState<BackendStatus>(() =>
    statusFromConfig(backendConfig),
  );
  const [connections, setConnections] = useState<SavedConnection[]>([]);
  const [selectedConnection, setSelectedConnection] = useState("");
  const [connectedConnection, setConnectedConnection] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isRunningSummary, setIsRunningSummary] = useState(false);
  const [connectionMessage, setConnectionMessage] = useState("Waiting for backend.");
  const [schemaName, setSchemaName] = useState("");
  const [schemaSummary, setSchemaSummary] = useState<SchemaSummary | null>(null);
  const [schemaMessage, setSchemaMessage] = useState(
    "Connect to a saved connection, then run a schema summary.",
  );
  const [activityEntries, setActivityEntries] = useState<ActivityEntry[]>([]);
  const [activeActivitySessionId, setActiveActivitySessionId] = useState<string | null>(null);
  const [isActivityDrawerOpen, setIsActivityDrawerOpen] = useState(false);
  const [openedProject, setOpenedProject] = useState<OpenedProject | null>(null);

  const isBackendOnline = backendStatus.kind === "online";
  const canConnect =
    isBackendOnline && !isConnecting && Boolean(selectedConnection) && connections.length > 0;
  const canRunSummary =
    isBackendOnline && !isConnecting && !isRunningSummary && Boolean(connectedConnection);

  const refreshActivity = useCallback(async () => {
    if (!isBackendOnline || !connectedConnection) {
      setActivityEntries([]);
      setActiveActivitySessionId(null);
      return;
    }

    const response = await listActivity({
      connectionName: connectedConnection,
      config: backendConfig,
    });
    setActivityEntries(response.entries);
    setActiveActivitySessionId(response.active_session_id);
  }, [backendConfig, connectedConnection, isBackendOnline]);

  const refreshConnections = useCallback(async () => {
    if (!isBackendOnline) {
      return;
    }

    setConnectionMessage("Loading SQLcl saved connections.");
    try {
      const response = await listSavedConnections(backendConfig);
      setConnections(response.connections);
      setSelectedConnection((current) => current || response.connections[0]?.name || "");
      setConnectionMessage(
        response.connections.length > 0
          ? "Choose a saved SQLcl connection."
          : "No SQLcl saved connections were returned.",
      );
    } catch (error) {
      setConnectionMessage(
        error instanceof Error ? error.message : "Could not list saved connections.",
      );
    }
  }, [backendConfig, isBackendOnline]);

  useEffect(() => {
    let isCurrent = true;

    void resolveBackendConfig().then(async (resolvedConfig) => {
      if (!isCurrent) {
        return;
      }

      setBackendConfig(resolvedConfig);
      setBackendStatus(statusFromConfig(resolvedConfig));

      const nextStatus = await checkBackendHealth(resolvedConfig);
      if (isCurrent) {
        setBackendStatus(nextStatus);
      }
    });

    return () => {
      isCurrent = false;
    };
  }, []);

  useEffect(() => {
    if (isBackendOnline) {
      queueMicrotask(() => {
        void refreshConnections();
        void getCurrentProject(backendConfig)
          .then((project) => setOpenedProject(project))
          .catch(() => setOpenedProject(null));
      });
    }
  }, [backendConfig, isBackendOnline, refreshConnections]);

  useEffect(() => {
    queueMicrotask(() => {
      void refreshActivity();
    });
  }, [connectedConnection, isBackendOnline, refreshActivity]);

  const connectSelectedConnection = async () => {
    if (isConnecting) {
      return;
    }

    if (!selectedConnection) {
      setConnectionMessage("Select a SQLcl saved connection first.");
      return;
    }

    setIsConnecting(true);
    setConnectionMessage(`Connecting to ${selectedConnection}.`);
    try {
      const response = await connectSavedConnection(selectedConnection, backendConfig);
      setConnectedConnection(response.connection_name);
      setConnectionMessage(`Connected to ${response.connection_name}.`);
      await refreshActivity();
    } catch (error) {
      setConnectedConnection(null);
      setConnectionMessage(error instanceof Error ? error.message : "Could not connect.");
      await refreshActivity();
    } finally {
      setIsConnecting(false);
    }
  };

  const runSchemaSummary = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isRunningSummary) {
      return;
    }

    const trimmedSchema = schemaName.trim();
    if (!trimmedSchema) {
      setSchemaMessage("Enter an Oracle schema name.");
      return;
    }
    if (!connectedConnection) {
      setSchemaMessage("Connect to a saved connection before running a schema summary.");
      return;
    }

    setIsRunningSummary(true);
    setSchemaMessage(`Loading schema summary for ${trimmedSchema}.`);
    try {
      const summary = await getSchemaSummary(trimmedSchema, {
        refresh: true,
        config: backendConfig,
      });
      setSchemaSummary(summary);
      setSchemaMessage(`Summary captured for ${summary.schema_name}.`);
      await refreshActivity();
    } catch (error) {
      setSchemaSummary(null);
      setSchemaMessage(error instanceof Error ? error.message : "Could not load schema summary.");
      await refreshActivity();
    } finally {
      setIsRunningSummary(false);
    }
  };

  const copy = statusCopy[backendStatus.kind];

  return (
    <main className="app-shell">
      <section className="hero-panel" aria-labelledby="app-title">
        <p className="eyebrow">Apex Pilot Desktop</p>
        <h1 id="app-title">Local-first Oracle automation workspace</h1>
        <p className="hero-copy">
          A chat-first desktop app for Oracle and APEX development, with SQLcl MCP as the database
          execution boundary.
        </p>
      </section>

      <ProjectWorkspace
        backendConfig={backendConfig}
        isBackendOnline={isBackendOnline}
        connections={connections}
        openedProject={openedProject}
        onOpenedProjectChange={setOpenedProject}
      />

      <section className="status-grid" aria-label="Application status">
        <article className={`status-card status-card--${backendStatus.kind}`}>
          <div>
            <p className="card-label">Backend Health</p>
            <h2>{copy.label}</h2>
          </div>
          <p>{copy.description}</p>
          {"baseUrl" in backendStatus ? (
            <dl>
              <div>
                <dt>URL</dt>
                <dd>{backendStatus.baseUrl}</dd>
              </div>
              {backendStatus.kind === "online" ? (
                <>
                  <div>
                    <dt>Service</dt>
                    <dd>{backendStatus.health.service}</dd>
                  </div>
                  <div>
                    <dt>Version</dt>
                    <dd>{backendStatus.health.version}</dd>
                  </div>
                </>
              ) : null}
              {backendStatus.kind === "offline" ? (
                <div>
                  <dt>Message</dt>
                  <dd>{backendStatus.message}</dd>
                </div>
              ) : null}
            </dl>
          ) : null}
        </article>

        <article className="status-card">
          <p className="card-label">Saved Connections</p>
          <h2>SQLcl MCP connection</h2>
          <p>{connectionMessage}</p>
          <div className="form-row">
            <label htmlFor="connection-name">Connection</label>
            <select
              id="connection-name"
              value={selectedConnection}
              onChange={(event) => setSelectedConnection(event.target.value)}
              disabled={!isBackendOnline || isConnecting || connections.length === 0}
            >
              {connections.length === 0 ? <option value="">No connections</option> : null}
              {connections.map((connection) => (
                <option key={connection.name} value={connection.name}>
                  {connection.display_name
                    ? `${connection.display_name} (${connection.name})`
                    : connection.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={() => void connectSelectedConnection()}
            disabled={!canConnect}
            aria-busy={isConnecting}
          >
            {isConnecting ? (
              <>
                <span className="button-spinner" aria-hidden="true" />
                Connecting…
              </>
            ) : (
              "Connect"
            )}
          </button>
          {isConnecting ? (
            <p className="pending-copy" role="status" aria-live="polite">
              Connecting to {selectedConnection}. This can take a few seconds.
            </p>
          ) : null}
          {connectedConnection && !isConnecting ? (
            <p className="success-copy">Connected: {connectedConnection}</p>
          ) : null}
        </article>

        <article className="status-card">
          <p className="card-label">Schema Summary</p>
          <h2>Read-only dictionary query</h2>
          <p>{schemaMessage}</p>
          <form onSubmit={(event) => void runSchemaSummary(event)} className="schema-form">
            <div className="form-row">
              <label htmlFor="schema-name">Schema</label>
              <input
                id="schema-name"
                value={schemaName}
                onChange={(event) => setSchemaName(event.target.value)}
                placeholder="APP"
                disabled={!canRunSummary}
              />
            </div>
            <button type="submit" disabled={!canRunSummary} aria-busy={isRunningSummary}>
              {isRunningSummary ? (
                <>
                  <span className="button-spinner" aria-hidden="true" />
                  Running…
                </>
              ) : (
                "Run Summary"
              )}
            </button>
          </form>
          {isRunningSummary ? (
            <p className="pending-copy" role="status" aria-live="polite">
              Running schema summary for {schemaName.trim()}. This can take a few seconds.
            </p>
          ) : null}
        </article>
      </section>

      <section className="workspace-grid" aria-label="Schema intelligence workspace">
        <article className="detail-card detail-card--summary">
          <div className="summary-header">
            <div>
              <p className="card-label">Summary Result</p>
              {schemaSummary ? <h2>{schemaSummary.schema_name}</h2> : <h2>Schema summary</h2>}
            </div>
            <button
              type="button"
              className="drawer-toggle"
              onClick={() => setIsActivityDrawerOpen(true)}
            >
              MCP Activity
              {connectedConnection && activityEntries.length > 0 ? (
                <span className="drawer-toggle-count">{activityEntries.length}</span>
              ) : null}
            </button>
          </div>
          {schemaSummary ? (
            <>
              <dl>
                <div>
                  <dt>Current User</dt>
                  <dd>{schemaSummary.database_context.current_user ?? "Unknown"}</dd>
                </div>
                <div>
                  <dt>Database</dt>
                  <dd>{schemaSummary.database_context.db_name ?? "Unknown"}</dd>
                </div>
                <div>
                  <dt>Cache Age</dt>
                  <dd>{schemaSummary.cache_age_seconds.toFixed(1)}s</dd>
                </div>
              </dl>
              <h3>Object Counts</h3>
              <ul className="summary-list">
                {schemaSummary.object_counts.map((count) => (
                  <li key={count.object_type}>
                    <span>{count.object_type}</span>
                    <strong>
                      {count.object_count} total, {count.invalid_count} invalid
                    </strong>
                  </li>
                ))}
              </ul>
              <h3>Tables</h3>
              <ul className="summary-list">
                {schemaSummary.tables.slice(0, 8).map((table) => (
                  <li key={table.table_name}>
                    <span>{table.table_name}</span>
                    <strong>{table.num_rows ?? "Unknown"} rows</strong>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p>Run a schema summary to show database context, object counts, and visible tables.</p>
          )}
        </article>
      </section>

      {isActivityDrawerOpen ? (
        <button
          type="button"
          className="activity-drawer-backdrop"
          aria-label="Close MCP activity drawer"
          onClick={() => setIsActivityDrawerOpen(false)}
        />
      ) : null}

      <aside
        className={`activity-drawer${isActivityDrawerOpen ? " activity-drawer--open" : ""}`}
        aria-hidden={!isActivityDrawerOpen}
        aria-label="MCP tool activity drawer"
      >
        <div className="activity-drawer-header">
          <div>
            <p className="card-label">Tool Activity</p>
            <h2>MCP calls</h2>
          </div>
          <button type="button" className="drawer-close" onClick={() => setIsActivityDrawerOpen(false)}>
            Close
          </button>
        </div>
        <ActivityTree
          entries={activityEntries}
          connectionName={connectedConnection}
          activeSessionId={activeActivitySessionId}
        />
      </aside>
    </main>
  );
};
