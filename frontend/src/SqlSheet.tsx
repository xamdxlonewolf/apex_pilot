import { type FormEvent, useState } from "react";

import {
  type BackendConfig,
  type SqlClassification,
  type SqlRunResult,
  BackendApiError,
  runSql,
} from "./backend";

type SqlLogEntry = Readonly<{
  id: string;
  sql: string;
  status: "ok" | "error" | "blocked" | "prompt";
  detail: string;
  classification?: SqlClassification;
}>;

type SqlSheetProps = Readonly<{
  backendConfig: BackendConfig;
  connectedConnection: string | null;
  workingSchema: string;
  isBackendOnline: boolean;
  skipDestructivePrompt: boolean;
  dirty: boolean;
  onDirtyChange: (dirty: boolean) => void;
  onActivityRefresh: () => Promise<void>;
}>;

export const SqlSheet = ({
  backendConfig,
  connectedConnection,
  workingSchema,
  isBackendOnline,
  skipDestructivePrompt,
  dirty,
  onDirtyChange,
  onActivityRefresh,
}: SqlSheetProps) => {
  const [sql, setSql] = useState("select * from dual");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SqlRunResult | null>(null);
  const [log, setLog] = useState<SqlLogEntry[]>([]);
  const [pendingPrompt, setPendingPrompt] = useState<{
    sql: string;
    classification: SqlClassification;
  } | null>(null);

  const canRun = isBackendOnline && Boolean(connectedConnection) && !busy;

  const appendLog = (entry: Omit<SqlLogEntry, "id">) => {
    setLog((current) => [{ ...entry, id: `${Date.now()}-${current.length}` }, ...current].slice(0, 100));
  };

  const execute = async (text: string, confirmed: boolean) => {
    setBusy(true);
    setPendingPrompt(null);
    try {
      const payload = await runSql(
        {
          sql: text,
          schema_name: workingSchema.trim() || null,
          confirmed,
          skip_destructive_prompt: skipDestructivePrompt,
        },
        backendConfig,
      );
      setResult(payload);
      appendLog({
        sql: text,
        status: "ok",
        detail: `${payload.rows.length} rows`,
        classification: payload.classification,
      });
      await onActivityRefresh();
    } catch (error) {
      await onActivityRefresh();
      if (error instanceof BackendApiError && error.status === 409) {
        const classification = await extractConflictClassification(error);
        if (classification) {
          setPendingPrompt({ sql: text, classification });
          appendLog({
            sql: text,
            status: "prompt",
            detail: "Confirmation required",
            classification,
          });
          return;
        }
      }
      const message = error instanceof Error ? error.message : "SQL failed.";
      const blocked = error instanceof BackendApiError && error.status === 403;
      appendLog({
        sql: text,
        status: blocked ? "blocked" : "error",
        detail: message,
      });
      setResult(null);
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = sql.trim();
    if (!trimmed) {
      return;
    }
    void execute(trimmed, false);
  };

  return (
    <div className="tool-panel sql-sheet" aria-label="SQL sheet">
      <form className="sql-editor" onSubmit={onSubmit}>
        <label className="sr-only" htmlFor="sql-sheet-editor">
          SQL
        </label>
        <textarea
          id="sql-sheet-editor"
          value={sql}
          onChange={(event) => {
            setSql(event.target.value);
            if (!dirty) {
              onDirtyChange(true);
            }
          }}
          spellCheck={false}
          disabled={!isBackendOnline}
        />
        <div className="tool-toolbar">
          <button type="submit" disabled={!canRun || !sql.trim()} aria-busy={busy}>
            {busy ? "Running…" : "Run"}
          </button>
          <span className="pane-muted">
            {connectedConnection
              ? `Will run on ${connectedConnection}${workingSchema ? ` as CURRENT_SCHEMA ${workingSchema}` : " (no schema set — using login schema)"}`
              : "Connect a SQLcl saved connection to run SQL."}
          </span>
        </div>
      </form>

      {pendingPrompt ? (
        <div className="confirm-banner" role="alertdialog" aria-label="Confirm SQL">
          <p>
            {pendingPrompt.classification.category}:{" "}
            {pendingPrompt.classification.reasons.join("; ") || "Confirmation required."}
          </p>
          <div className="button-row">
            <button
              type="button"
              onClick={() => void execute(pendingPrompt.sql, true)}
              disabled={busy}
            >
              Confirm and run
            </button>
            <button
              type="button"
              className="chrome-button"
              onClick={() => setPendingPrompt(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {result ? (
        <div className="sql-result">
          <p className="pane-muted">
            {result.classification.decision} · {result.classification.operation} ·{" "}
            {result.rows.length} rows
          </p>
          {result.rows.length > 0 ? (
            <div className="sql-table-wrap">
              <table>
                <thead>
                  <tr>
                    {Object.keys(result.rows[0] ?? {}).map((column) => (
                      <th key={column}>{column}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.slice(0, 50).map((row, index) => (
                    <tr key={index}>
                      {Object.keys(result.rows[0] ?? {}).map((column) => (
                        <td key={column}>{String(row[column] ?? "")}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <pre className="sql-raw">{result.raw_text ?? "No row payload returned."}</pre>
          )}
        </div>
      ) : null}

      <div className="sql-log" aria-label="SQL statement log">
        <h3>Statement log</h3>
        <ul className="dense-list">
          {log.map((entry) => (
            <li key={entry.id}>
              <span className={`sql-log-status sql-log-status--${entry.status}`}>{entry.status}</span>
              <code>{entry.sql}</code>
              <em>{entry.detail}</em>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

const extractConflictClassification = async (
  error: BackendApiError,
): Promise<SqlClassification | null> => {
  if (error.detail && typeof error.detail === "object") {
    const detail = error.detail as { classification?: SqlClassification };
    if (detail.classification) {
      return detail.classification;
    }
  }
  return null;
};
