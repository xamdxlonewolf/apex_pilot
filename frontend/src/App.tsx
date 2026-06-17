import { type FormEvent, useCallback, useEffect, useState } from "react";

import {
  type ActivityEntry,
  type BackendConfig,
  type BackendStatus,
  type SavedConnection,
  type SchemaSummary,
  checkBackendHealth,
  connectSavedConnection,
  getBackendConfig,
  getSchemaSummary,
  listActivity,
  listSavedConnections,
  resolveBackendConfig,
} from "./backend";

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

export const App = () => {
  const [backendConfig, setBackendConfig] = useState<BackendConfig>(() => getBackendConfig());
  const [backendStatus, setBackendStatus] = useState<BackendStatus>(() =>
    statusFromConfig(backendConfig),
  );
  const [connections, setConnections] = useState<SavedConnection[]>([]);
  const [selectedConnection, setSelectedConnection] = useState("");
  const [connectedConnection, setConnectedConnection] = useState<string | null>(null);
  const [connectionMessage, setConnectionMessage] = useState("Waiting for backend.");
  const [schemaName, setSchemaName] = useState("");
  const [schemaSummary, setSchemaSummary] = useState<SchemaSummary | null>(null);
  const [schemaMessage, setSchemaMessage] = useState(
    "Connect to a saved connection, then run a schema summary.",
  );
  const [activityEntries, setActivityEntries] = useState<ActivityEntry[]>([]);

  const isBackendOnline = backendStatus.kind === "online";

  const refreshActivity = useCallback(async () => {
    if (!isBackendOnline) {
      return;
    }

    const response = await listActivity(backendConfig);
    setActivityEntries(response.entries);
  }, [backendConfig, isBackendOnline]);

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
      await refreshActivity();
    } catch (error) {
      setConnectionMessage(
        error instanceof Error ? error.message : "Could not list saved connections.",
      );
    }
  }, [backendConfig, isBackendOnline, refreshActivity]);

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
        void refreshActivity();
      });
    }
  }, [isBackendOnline, refreshActivity, refreshConnections]);

  const connectSelectedConnection = async () => {
    if (!selectedConnection) {
      setConnectionMessage("Select a SQLcl saved connection first.");
      return;
    }

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
    }
  };

  const runSchemaSummary = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedSchema = schemaName.trim();

    if (!trimmedSchema) {
      setSchemaMessage("Enter an Oracle schema name.");
      return;
    }

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
    }
  };

  const copy = statusCopy[backendStatus.kind];
  const newestActivity = [...activityEntries].reverse();

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
              disabled={!isBackendOnline || connections.length === 0}
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
            disabled={!isBackendOnline}
          >
            Connect
          </button>
          {connectedConnection ? (
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
                disabled={!isBackendOnline}
              />
            </div>
            <button type="submit" disabled={!isBackendOnline}>
              Run Summary
            </button>
          </form>
        </article>
      </section>

      <section className="workspace-grid" aria-label="Schema intelligence workspace">
        <article className="detail-card">
          <p className="card-label">Summary Result</p>
          {schemaSummary ? (
            <>
              <h2>{schemaSummary.schema_name}</h2>
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

        <article className="detail-card">
          <p className="card-label">Tool Activity</p>
          <h2>MCP calls</h2>
          {newestActivity.length > 0 ? (
            <ol className="activity-list">
              {newestActivity.map((entry) => (
                <li key={entry.sequence}>
                  <div>
                    <strong>{entry.tool_name}</strong>
                    <span className={`activity-status activity-status--${entry.status}`}>
                      {entry.status}
                    </span>
                  </div>
                  <code>{JSON.stringify(entry.arguments)}</code>
                  {entry.message ? <p>{entry.message}</p> : null}
                </li>
              ))}
            </ol>
          ) : (
            <p>No MCP tool activity yet.</p>
          )}
        </article>
      </section>
    </main>
  );
};
