import { type FormEvent, useEffect, useRef, useState } from "react";

import {
  type BackendConfig,
  type SchemaSummary,
  getSchemaSummary,
  getSessionContext,
  setSessionSchema,
} from "./backend";
import { schemaFromSessionUser } from "./prefs";

type SchemaBrowserProps = Readonly<{
  backendConfig: BackendConfig;
  connectedConnection: string | null;
  isBackendOnline: boolean;
  workingSchema: string;
  onWorkingSchemaChange: (schema: string) => void;
  onActivityRefresh: () => Promise<void>;
  onSaveSummary?: (summary: SchemaSummary) => void;
}>;

const withTimeout = <T,>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise,
    new Promise<T>((_resolve, reject) => {
      timer = setTimeout(() => {
        reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s.`));
      }, ms);
    }),
  ]).finally(() => {
    if (timer) {
      clearTimeout(timer);
    }
  });
};

export const SchemaBrowser = ({
  backendConfig,
  connectedConnection,
  isBackendOnline,
  workingSchema,
  onWorkingSchemaChange,
  onActivityRefresh,
  onSaveSummary,
}: SchemaBrowserProps) => {
  const [summary, setSummary] = useState<SchemaSummary | null>(null);
  const [draftSchema, setDraftSchema] = useState(workingSchema);
  const [message, setMessage] = useState("Connect, then load a schema.");
  const [busy, setBusy] = useState(false);
  const [activeSchema, setActiveSchema] = useState<string | null>(null);
  const autoLoadedConnection = useRef<string | null>(null);

  useEffect(() => {
    setDraftSchema(workingSchema);
  }, [workingSchema]);

  useEffect(() => {
    if (!connectedConnection) {
      autoLoadedConnection.current = null;
      setSummary(null);
      setActiveSchema(null);
      setMessage("Not connected. Use Connect in the strip above.");
    }
  }, [connectedConnection]);

  const applySchema = async (schema: string) => {
    const trimmed = schema.trim().toUpperCase();
    if (!trimmed) {
      setMessage("Enter a schema name.");
      return;
    }
    if (!connectedConnection) {
      setMessage("Connect to a database first.");
      return;
    }
    setBusy(true);
    setMessage(`Switching session to ${trimmed} and loading summary…`);
    try {
      const setResult = await withTimeout(
        setSessionSchema(trimmed, backendConfig),
        45_000,
        `Setting CURRENT_SCHEMA=${trimmed}`,
      );
      const next = await withTimeout(
        getSchemaSummary(setResult.schema_name, {
          refresh: true,
          config: backendConfig,
        }),
        60_000,
        `Schema summary for ${setResult.schema_name}`,
      );
      setSummary(next);
      setActiveSchema(setResult.schema_name);
      setDraftSchema(setResult.schema_name);
      onWorkingSchemaChange(setResult.schema_name);
      setMessage(
        `Active schema ${setResult.schema_name} on ${connectedConnection}. CURRENT_SCHEMA set for this session.`,
      );
      await onActivityRefresh();
    } catch (error) {
      setSummary(null);
      setActiveSchema(null);
      setMessage(
        error instanceof Error
          ? error.message
          : `Could not switch to schema ${trimmed}.`,
      );
      await onActivityRefresh();
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!connectedConnection || !isBackendOnline) {
      return;
    }
    if (autoLoadedConnection.current === connectedConnection) {
      return;
    }
    autoLoadedConnection.current = connectedConnection;
    let cancelled = false;
    void (async () => {
      setBusy(true);
      setMessage(`Connected to ${connectedConnection}. Detecting login schema…`);
      try {
        // Keep auto-detect light: read session context + dictionary summary only.
        // Do not ALTER SESSION here — that can hang on some SQLcl MCP sessions.
        // Load / SQL sheet apply CURRENT_SCHEMA when the user explicitly needs it.
        const context = await withTimeout(
          getSessionContext(backendConfig),
          30_000,
          "Session context",
        );
        if (cancelled) {
          return;
        }
        const suggested =
          workingSchema.trim() ||
          context.suggested_schema ||
          schemaFromSessionUser(
            context.database_context.current_user,
            context.database_context.current_schema,
          );
        if (!suggested) {
          setMessage(`Connected to ${connectedConnection}. Enter a schema and click Load.`);
          return;
        }
        setDraftSchema(suggested);
        onWorkingSchemaChange(suggested);
        const next = await withTimeout(
          getSchemaSummary(suggested, {
            refresh: true,
            config: backendConfig,
          }),
          60_000,
          `Schema summary for ${suggested}`,
        );
        if (cancelled) {
          return;
        }
        setSummary(next);
        setActiveSchema(suggested);
        setMessage(
          `Connected to ${connectedConnection} as ${context.database_context.current_user ?? "unknown"}. ` +
            `Browsing schema ${suggested}. Click Load to set CURRENT_SCHEMA for SQL sheet work.`,
        );
        await onActivityRefresh();
      } catch (error) {
        if (!cancelled) {
          setMessage(
            error instanceof Error
              ? `Connected, but schema auto-detect failed: ${error.message} Enter a schema and click Load.`
              : "Connected, but could not auto-detect schema. Enter a schema and click Load.",
          );
        }
      } finally {
        if (!cancelled) {
          setBusy(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- auto-load once per connection
  }, [backendConfig, connectedConnection, isBackendOnline]);

  const runSummary = async (event: FormEvent) => {
    event.preventDefault();
    await applySchema(draftSchema);
  };

  return (
    <div className="tool-panel" aria-label="Schema browser">
      <div className="schema-status" role="status">
        <span className={connectedConnection ? "status-pill status-pill--ok" : "status-pill"}>
          {connectedConnection ? `DB connected: ${connectedConnection}` : "DB not connected"}
        </span>
        <span className={activeSchema ? "status-pill status-pill--ok" : "status-pill"}>
          {activeSchema ? `Browsing: ${activeSchema}` : "Schema not loaded"}
        </span>
      </div>
      <form className="tool-toolbar" onSubmit={(event) => void runSummary(event)}>
        <label htmlFor="schema-name">
          Schema
          <input
            id="schema-name"
            value={draftSchema}
            onChange={(event) => setDraftSchema(event.target.value.toUpperCase())}
            placeholder="APP"
            disabled={!isBackendOnline || !connectedConnection || busy}
          />
        </label>
        <button
          type="submit"
          disabled={!isBackendOnline || !connectedConnection || !draftSchema.trim() || busy}
          aria-busy={busy}
        >
          {busy ? "Loading…" : "Load"}
        </button>
        {summary && onSaveSummary ? (
          <button type="button" className="chrome-button" onClick={() => onSaveSummary(summary)}>
            Save to project…
          </button>
        ) : null}
      </form>
      <p className="pane-muted">{message}</p>
      {summary ? (
        <div className="schema-view">
          <dl className="compact-dl">
            <div>
              <dt>User</dt>
              <dd>{summary.database_context.current_user ?? "Unknown"}</dd>
            </div>
            <div>
              <dt>Schema</dt>
              <dd>{summary.schema_name}</dd>
            </div>
            <div>
              <dt>Database</dt>
              <dd>{summary.database_context.db_name ?? "Unknown"}</dd>
            </div>
          </dl>
          <h3>Object counts</h3>
          <ul className="dense-list">
            {summary.object_counts.map((count) => (
              <li key={count.object_type}>
                <span>{count.object_type}</span>
                <strong>
                  {count.object_count} / {count.invalid_count} invalid
                </strong>
              </li>
            ))}
          </ul>
          <h3>Tables</h3>
          <ul className="dense-list">
            {summary.tables.map((table) => (
              <li key={table.table_name}>
                <span>{table.table_name}</span>
                <strong>{table.num_rows ?? "?"} rows</strong>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
};
