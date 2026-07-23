import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";

import {
  type BackendConfig,
  type InteractivePoolStatus,
  type SchemaSummary,
  getSchemaSummary,
  getSessionContextOnce,
} from "./backend";
import { schemaFromSessionUser } from "./prefs";

export type SchemaOpenTarget = Readonly<{
  schemaName: string;
  objectType: string;
  objectName: string;
}>;

type SchemaBrowserProps = Readonly<{
  backendConfig: BackendConfig;
  connectedConnection: string | null;
  interactiveStatus: InteractivePoolStatus;
  isBackendOnline: boolean;
  /** Project/local override. When set, auto-load uses this and skips login detection. */
  projectSchemaOverride: string | null;
  workingSchema: string;
  onWorkingSchemaChange: (schema: string, options?: { persist?: boolean }) => void;
  onActivityRefresh: () => Promise<void>;
  onSaveSummary?: (summary: SchemaSummary) => void;
  /** Notify parent when the loaded schema catalog changes (Quick Open objects). */
  onSummaryChange?: (summary: SchemaSummary | null) => void;
  /** Open a summarized schema object in the Workspace viewer. */
  onOpenObject?: (target: SchemaOpenTarget) => void;
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

const browseConnectedLabel = (
  interactiveStatus: InteractivePoolStatus,
  connectedConnection: string | null,
): string | null => {
  if (interactiveStatus.state === "connected") {
    return interactiveStatus.display_name?.trim() || interactiveStatus.profile_id || "interactive";
  }
  return connectedConnection;
};

export const SchemaBrowser = ({
  backendConfig,
  connectedConnection,
  interactiveStatus,
  isBackendOnline,
  projectSchemaOverride,
  workingSchema,
  onWorkingSchemaChange,
  onActivityRefresh,
  onSaveSummary,
  onSummaryChange,
  onOpenObject,
}: SchemaBrowserProps) => {
  const browseTarget = browseConnectedLabel(interactiveStatus, connectedConnection);
  const interactiveConnected = interactiveStatus.state === "connected";
  const canBrowse =
    isBackendOnline &&
    (interactiveConnected || Boolean(connectedConnection)) &&
    interactiveStatus.state !== "dead";

  const [summary, setSummary] = useState<SchemaSummary | null>(null);
  const [draftSchema, setDraftSchema] = useState(workingSchema);
  const [message, setMessage] = useState(() =>
    browseTarget
      ? `Connected to ${browseTarget}. Load a schema to browse objects.`
      : "Not connected. Use Connect in the Product Header.",
  );
  const [busy, setBusy] = useState(false);
  const [activeSchema, setActiveSchema] = useState<string | null>(null);
  const [draftWorkingSchema, setDraftWorkingSchema] = useState(workingSchema);
  const [stateBrowseTarget, setStateBrowseTarget] = useState(browseTarget);
  const [stateProfileId, setStateProfileId] = useState(interactiveStatus.profile_id);
  const autoLoadKey = useRef<string | null>(null);
  const onSummaryChangeRef = useRef(onSummaryChange);

  if (workingSchema !== draftWorkingSchema) {
    setDraftWorkingSchema(workingSchema);
    setDraftSchema(workingSchema);
  }

  if (browseTarget !== stateBrowseTarget) {
    setStateBrowseTarget(browseTarget);
    if (!browseTarget) {
      setSummary(null);
      setActiveSchema(null);
      setBusy(false);
      setMessage(
        interactiveStatus.state === "dead"
          ? "Interactive pool is dead. Reconnect before browsing."
          : "Not connected. Use Connect in the Product Header.",
      );
    }
  }

  if (interactiveStatus.profile_id !== stateProfileId) {
    setStateProfileId(interactiveStatus.profile_id);
    autoLoadKey.current = null;
  }

  const publishSummary = useCallback(
    (next: SchemaSummary | null) => {
      setSummary(next);
      onSummaryChange?.(next);
    },
    [onSummaryChange],
  );

  useEffect(() => {
    onSummaryChangeRef.current = onSummaryChange;
  }, [onSummaryChange]);

  useEffect(() => {
    if (!browseTarget) {
      autoLoadKey.current = null;
      onSummaryChangeRef.current?.(null);
    }
  }, [browseTarget]);

  const loadSummaryForSchema = async (
    schema: string,
    options: Readonly<{
      loginUser: string | null;
      source: "project" | "login" | "manual" | "refresh";
      allowStateUpdate?: () => boolean;
      refresh?: boolean;
    }>,
  ) => {
    const next = await withTimeout(
      getSchemaSummary(schema, {
        refresh: options.refresh ?? true,
        config: backendConfig,
      }),
      60_000,
      `Schema summary for ${schema}`,
    );
    if (options.allowStateUpdate && !options.allowStateUpdate()) {
      return;
    }
    publishSummary(next);
    setActiveSchema(schema);
    setDraftSchema(schema);
    onWorkingSchemaChange(schema, {
      persist:
        options.source === "project" ||
        options.source === "manual" ||
        options.source === "refresh",
    });
    const asUser = options.loginUser ? ` as ${options.loginUser}` : "";
    const pathHint = interactiveConnected ? " (interactive borrow)" : "";
    if (options.source === "project") {
      setMessage(
        `Connected to ${browseTarget}${asUser}. Using project schema ${schema}.${pathHint}`,
      );
    } else if (options.source === "login") {
      setMessage(
        `Connected to ${browseTarget}${asUser}. Browsing login schema ${schema}.${pathHint}`,
      );
    } else if (options.source === "refresh") {
      setMessage(`Refreshed schema ${schema} on ${browseTarget}.${pathHint}`);
    } else {
      setMessage(
        `Browsing schema ${schema} on ${browseTarget}. SQL sheet will use this as CURRENT_SCHEMA.${pathHint}`,
      );
    }
    await onActivityRefresh();
  };

  const applySchema = async (schema: string, source: "manual" | "refresh" = "manual") => {
    const trimmed = schema.trim().toUpperCase();
    if (!trimmed) {
      setMessage("Enter a schema name.");
      return;
    }
    if (!canBrowse || !browseTarget) {
      setMessage(
        interactiveStatus.state === "dead"
          ? "Interactive pool is dead. Reconnect before browsing."
          : interactiveStatus.state === "reconnecting"
            ? "Interactive pool is reconnecting…"
            : "Not connected. Use Connect in the Product Header.",
      );
      return;
    }
    autoLoadKey.current = `${browseTarget}:${trimmed}:${interactiveStatus.profile_id ?? ""}`;
    setBusy(true);
    setMessage(source === "refresh" ? `Refreshing schema ${trimmed}…` : `Loading schema ${trimmed}…`);
    try {
      await loadSummaryForSchema(trimmed, {
        loginUser: null,
        source,
        refresh: true,
      });
    } catch (error) {
      publishSummary(null);
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
    if (!browseTarget || !canBrowse) {
      return;
    }
    const override = projectSchemaOverride?.trim().toUpperCase() || null;
    const key = `${browseTarget}:${override ?? "login"}:${interactiveStatus.profile_id ?? ""}`;
    if (autoLoadKey.current === key) {
      return;
    }

    let cancelled = false;
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
            setMessage(`Connected to ${browseTarget}. Loading project schema ${override}…`);
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

          setMessage(`Connected to ${browseTarget}. Detecting login schema…`);
          let loginUser: string | null = null;
          let suggested: string | null = null;
          try {
            const context = await withTimeout(
              getSessionContextOnce(backendConfig),
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
              setMessage(`Connected to ${browseTarget}. Enter a schema and click Load.`);
            }
            return;
          }

          setDraftSchema(suggested);
          onWorkingSchemaChange(suggested, { persist: false });
          setMessage(
            `Connected to ${browseTarget}${loginUser ? ` as ${loginUser}` : ""}. Loading schema ${suggested}…`,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per connection+override+profile
  }, [
    backendConfig,
    browseTarget,
    canBrowse,
    interactiveStatus.profile_id,
    projectSchemaOverride,
  ]);

  const runSummary = async (event: FormEvent) => {
    event.preventDefault();
    await applySchema(draftSchema, "manual");
  };

  const statusTone =
    interactiveStatus.state === "dead"
      ? "bad"
      : browseTarget
        ? "ok"
        : "idle";

  return (
    <div className="tool-panel" aria-label="Schema browser">
      <div className="schema-status" role="status">
        <span className={browseTarget ? "status-pill status-pill--ok" : "status-pill"}>
          {interactiveStatus.state === "dead"
            ? "Interactive: Dead"
            : browseTarget
              ? `DB connected: ${browseTarget}`
              : "DB not connected"}
        </span>
        <span className={activeSchema ? "status-pill status-pill--ok" : "status-pill"}>
          {activeSchema ? `Browsing: ${activeSchema}` : "Schema not loaded"}
        </span>
        {interactiveConnected ? (
          <span className={`status-pill status-pill--${statusTone}`}>borrow</span>
        ) : null}
      </div>
      <form className="tool-toolbar" onSubmit={(event) => void runSummary(event)}>
        <label htmlFor="schema-name">
          Schema
          <input
            id="schema-name"
            value={draftSchema}
            onChange={(event) => setDraftSchema(event.target.value.toUpperCase())}
            placeholder="APP"
            disabled={!canBrowse || busy}
          />
        </label>
        <button type="submit" disabled={!canBrowse || !draftSchema.trim() || busy} aria-busy={busy}>
          {busy ? "Loading…" : "Load"}
        </button>
        <button
          type="button"
          className="chrome-button"
          disabled={!canBrowse || !draftSchema.trim() || busy}
          onClick={() => void applySchema(draftSchema, "refresh")}
        >
          Refresh
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
          {summary.tables.length === 0 ? (
            <p className="pane-muted">No tables in this schema summary.</p>
          ) : (
            <ul className="object-browse-list" aria-label="Schema tables">
              {summary.tables.map((table) => (
                <li key={table.table_name}>
                  <button
                    type="button"
                    className="object-browse-button"
                    onClick={() =>
                      onOpenObject?.({
                        schemaName: summary.schema_name,
                        objectType: "TABLE",
                        objectName: table.table_name,
                      })
                    }
                    disabled={!onOpenObject}
                  >
                    <span className="object-browse-name">{table.table_name}</span>
                    <span className="object-browse-meta">{table.num_rows ?? "?"} rows</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
};
