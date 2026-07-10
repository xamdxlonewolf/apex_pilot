import { type FormEvent, useEffect, useRef, useState } from "react";

import {
  type BackendConfig,
  type SchemaSummary,
  type SessionContext,
  getSchemaSummary,
  getSessionContext,
} from "./backend";
import { schemaFromSessionUser } from "./prefs";

type SchemaBrowserProps = Readonly<{
  backendConfig: BackendConfig;
  connectedConnection: string | null;
  isBackendOnline: boolean;
  /** Project/local override. When set, auto-load uses this and skips login detection. */
  projectSchemaOverride: string | null;
  workingSchema: string;
  onWorkingSchemaChange: (schema: string, options?: { persist?: boolean }) => void;
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

/** Deduplicate concurrent session-context calls (React Strict Mode remounts). */
let sessionContextInflight: Promise<SessionContext> | null = null;

const fetchSessionContextOnce = (config: BackendConfig): Promise<SessionContext> => {
  if (!sessionContextInflight) {
    sessionContextInflight = getSessionContext(config).finally(() => {
      sessionContextInflight = null;
    });
  }
  return sessionContextInflight;
};

export const SchemaBrowser = ({
  backendConfig,
  connectedConnection,
  isBackendOnline,
  projectSchemaOverride,
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
  const autoLoadKey = useRef<string | null>(null);

  useEffect(() => {
    setDraftSchema(workingSchema);
  }, [workingSchema]);

  useEffect(() => {
    if (!connectedConnection) {
      autoLoadKey.current = null;
      setSummary(null);
      setActiveSchema(null);
      setBusy(false);
      setMessage("Not connected. Use Connect in the strip above.");
    }
  }, [connectedConnection]);

  const loadSummaryForSchema = async (
    schema: string,
    options: Readonly<{
      loginUser: string | null;
      source: "project" | "login" | "manual";
      allowStateUpdate?: () => boolean;
    }>,
  ) => {
    const next = await withTimeout(
      getSchemaSummary(schema, {
        refresh: true,
        config: backendConfig,
      }),
      60_000,
      `Schema summary for ${schema}`,
    );
    if (options.allowStateUpdate && !options.allowStateUpdate()) {
      return;
    }
    setSummary(next);
    setActiveSchema(schema);
    setDraftSchema(schema);
    onWorkingSchemaChange(schema, {
      persist: options.source === "project" || options.source === "manual",
    });
    const asUser = options.loginUser ? ` as ${options.loginUser}` : "";
    if (options.source === "project") {
      setMessage(
        `Connected to ${connectedConnection}${asUser}. Using project schema ${schema}.`,
      );
    } else if (options.source === "login") {
      setMessage(
        `Connected to ${connectedConnection}${asUser}. Browsing login schema ${schema}.`,
      );
    } else {
      setMessage(
        `Browsing schema ${schema} on ${connectedConnection}. SQL sheet will use this as CURRENT_SCHEMA.`,
      );
    }
    await onActivityRefresh();
  };

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
    // Mark complete before parent override updates, so the auto-load effect
    // does not re-fire and fight this manual Load.
    autoLoadKey.current = `${connectedConnection}:${trimmed}`;
    setBusy(true);
    setMessage(`Loading schema ${trimmed}…`);
    try {
      // Schema browser queries ALL_* by owner — no ALTER SESSION needed.
      // SQL sheet still prefixes CURRENT_SCHEMA per statement when running.
      await loadSummaryForSchema(trimmed, {
        loginUser: null,
        source: "manual",
      });
    } catch (error) {
      setSummary(null);
      setActiveSchema(null);
      setMessage(
        error instanceof Error
          ? error.message
          : `Could not load schema ${trimmed}.`,
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
    const override = projectSchemaOverride?.trim().toUpperCase() || null;
    const key = `${connectedConnection}:${override ?? "login"}`;
    if (autoLoadKey.current === key) {
      return;
    }

    let cancelled = false;
    // Debounce so React Strict Mode remount cancels before any MCP call starts.
    const timer = window.setTimeout(() => {
      if (cancelled) {
        return;
      }
      void (async () => {
        setBusy(true);
        try {
          if (override) {
            setDraftSchema(override);
            onWorkingSchemaChange(override, { persist: true });
            setMessage(
              `Connected to ${connectedConnection}. Loading project schema ${override}…`,
            );
            await loadSummaryForSchema(override, {
              loginUser: null,
              source: "project",
              allowStateUpdate: () => !cancelled,
            });
            if (!cancelled) {
              autoLoadKey.current = key;
            }
            return;
          }

          setMessage(`Connected to ${connectedConnection}. Detecting login schema…`);
          let loginUser: string | null = null;
          let suggested: string | null = null;
          try {
            const context = await withTimeout(
              fetchSessionContextOnce(backendConfig),
              15_000,
              "Session context",
            );
            if (cancelled) {
              return;
            }
            loginUser = context.database_context.current_user;
            suggested =
              context.suggested_schema ||
              schemaFromSessionUser(
                context.database_context.current_user,
                context.database_context.current_schema,
              );
          } catch {
            if (cancelled) {
              return;
            }
          }

          if (!suggested) {
            if (!cancelled) {
              autoLoadKey.current = key;
              setMessage(
                `Connected to ${connectedConnection}. Enter a schema and click Load.`,
              );
            }
            return;
          }

          setDraftSchema(suggested);
          onWorkingSchemaChange(suggested, { persist: false });
          setMessage(
            `Connected to ${connectedConnection}${loginUser ? ` as ${loginUser}` : ""}. Loading schema ${suggested}…`,
          );
          await loadSummaryForSchema(suggested, {
            loginUser,
            source: "login",
            allowStateUpdate: () => !cancelled,
          });
          if (!cancelled) {
            autoLoadKey.current = key;
          }
        } catch (error) {
          if (cancelled) {
            return;
          }
          autoLoadKey.current = key;
          setMessage(
            error instanceof Error
              ? `Connected, but schema auto-load failed: ${error.message} Enter a schema and click Load.`
              : "Connected, but could not auto-load schema. Enter a schema and click Load.",
          );
        } finally {
          if (!cancelled) {
            setBusy(false);
          }
        }
      })();
    }, 75);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per connection+override
  }, [backendConfig, connectedConnection, isBackendOnline, projectSchemaOverride]);

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
