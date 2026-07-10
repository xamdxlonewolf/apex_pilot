import { type FormEvent, useState } from "react";

import {
  type BackendConfig,
  type SchemaSummary,
  getSchemaSummary,
} from "./backend";

type SchemaBrowserProps = Readonly<{
  backendConfig: BackendConfig;
  connectedConnection: string | null;
  isBackendOnline: boolean;
  onActivityRefresh: () => Promise<void>;
  onSaveSummary?: (summary: SchemaSummary) => void;
}>;

export const SchemaBrowser = ({
  backendConfig,
  connectedConnection,
  isBackendOnline,
  onActivityRefresh,
  onSaveSummary,
}: SchemaBrowserProps) => {
  const [schemaName, setSchemaName] = useState("");
  const [summary, setSummary] = useState<SchemaSummary | null>(null);
  const [message, setMessage] = useState("Connect, then load a schema.");
  const [busy, setBusy] = useState(false);

  const canRun = isBackendOnline && Boolean(connectedConnection) && !busy;

  const runSummary = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = schemaName.trim();
    if (!trimmed) {
      setMessage("Enter a schema name.");
      return;
    }
    setBusy(true);
    setMessage(`Loading ${trimmed}…`);
    try {
      const next = await getSchemaSummary(trimmed, { refresh: true, config: backendConfig });
      setSummary(next);
      setMessage(`Loaded ${next.schema_name}.`);
      await onActivityRefresh();
    } catch (error) {
      setSummary(null);
      setMessage(error instanceof Error ? error.message : "Could not load schema.");
      await onActivityRefresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="tool-panel" aria-label="Schema browser">
      <form className="tool-toolbar" onSubmit={(event) => void runSummary(event)}>
        <label htmlFor="schema-name">
          Schema
          <input
            id="schema-name"
            value={schemaName}
            onChange={(event) => setSchemaName(event.target.value)}
            placeholder="APP"
            disabled={!canRun}
          />
        </label>
        <button type="submit" disabled={!canRun || !schemaName.trim()} aria-busy={busy}>
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
              <dt>Database</dt>
              <dd>{summary.database_context.db_name ?? "Unknown"}</dd>
            </div>
            <div>
              <dt>Cache</dt>
              <dd>{summary.cache_age_seconds.toFixed(1)}s</dd>
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
