import { type FormEvent, useEffect, useState } from "react";

import { CodeEditor } from "./CodeEditor";
import {
  type BackendConfig,
  type InteractivePoolStatus,
  type SqlClassification,
  type SqlRunResult,
  BackendApiError,
  acquireDedicatedSession,
  runSql,
} from "./backend";

/** Form id shared with the Mission Control Toolbar Run control. */
export const WORKSPACE_SQL_FORM_ID = "workspace-sql-editor";

export type SqlRunState = Readonly<{
  busy: boolean;
  hasSql: boolean;
  canRun: boolean;
}>;

export type SqlSessionAttachment = "unconnected" | "pinned" | "capacity" | "dead" | "error";

type SqlLogEntry = Readonly<{
  id: string;
  sql: string;
  status: "ok" | "error" | "blocked" | "prompt";
  detail: string;
  classification?: SqlClassification;
}>;

type SqlSheetProps = Readonly<{
  backendConfig: BackendConfig;
  documentId: string;
  connectedConnection: string | null;
  interactiveStatus: InteractivePoolStatus;
  workingSchema: string;
  isBackendOnline: boolean;
  skipDestructivePrompt: boolean;
  dirty: boolean;
  onDirtyChange: (dirty: boolean) => void;
  onActivityRefresh: () => Promise<void>;
  onInteractiveStatusRefresh?: () => Promise<void>;
  /** Reports live Run preconditions for progressive Toolbar enablement. */
  onRunStateChange?: (state: SqlRunState) => void;
  initialSql?: string;
  /** Explicit promotion into Database Source Document mode (.sql never auto-promotes). */
  onAttachAsDatabaseSource?: (sql: string) => void;
}>;

export const SqlSheet = ({
  backendConfig,
  documentId,
  connectedConnection,
  interactiveStatus,
  workingSchema,
  isBackendOnline,
  skipDestructivePrompt,
  dirty,
  onDirtyChange,
  onActivityRefresh,
  onInteractiveStatusRefresh,
  onRunStateChange,
  initialSql,
  onAttachAsDatabaseSource,
}: SqlSheetProps) => {
  const [sql, setSql] = useState(() => initialSql ?? "select * from dual");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SqlRunResult | null>(null);
  const [log, setLog] = useState<SqlLogEntry[]>([]);
  const [attachment, setAttachment] = useState<SqlSessionAttachment>("unconnected");
  const [attachmentDetail, setAttachmentDetail] = useState<string | null>(null);
  const [pendingPrompt, setPendingPrompt] = useState<{
    sql: string;
    classification: SqlClassification;
  } | null>(null);
  const [pinned, setPinned] = useState(false);

  const interactiveConnected = interactiveStatus.state === "connected";
  const interactiveDead = interactiveStatus.state === "dead";
  const atCapacity =
    interactiveConnected &&
    interactiveStatus.dedicated_pinned >= interactiveStatus.dedicated_limit &&
    !pinned;

  const capacityDetail =
    `Dedicated session limit reached (${interactiveStatus.dedicated_limit}). Close a connected tab or raise the limit.`;
  const deadDetail = "Interactive pool is dead. Reconnect before attaching this editor.";
  const effectiveAttachment: SqlSessionAttachment = interactiveDead
    ? "dead"
    : atCapacity
      ? "capacity"
      : pinned
        ? "pinned"
        : attachment === "error"
          ? "error"
          : "unconnected";
  const effectiveDetail =
    effectiveAttachment === "dead"
      ? deadDetail
      : effectiveAttachment === "capacity"
        ? capacityDetail
        : effectiveAttachment === "error"
          ? attachmentDetail
          : null;

  const canRunMcp = isBackendOnline && Boolean(connectedConnection) && !busy;
  const canRun =
    canRunMcp &&
    effectiveAttachment !== "capacity" &&
    effectiveAttachment !== "dead" &&
    interactiveStatus.state !== "dead";
  const hasSql = Boolean(sql.trim());

  useEffect(() => {
    onRunStateChange?.({ busy, hasSql, canRun });
  }, [busy, canRun, hasSql, onRunStateChange]);

  useEffect(() => {
    return () => {
      onRunStateChange?.({ busy: false, hasSql: false, canRun: false });
    };
  }, [onRunStateChange]);

  const ensureDedicatedPin = async (): Promise<boolean> => {
    if (!interactiveConnected) {
      // MCP Run may still proceed; pin only when interactive pool is connected.
      return true;
    }
    if (interactiveDead) {
      setAttachment("dead");
      setAttachmentDetail("Interactive pool is dead. Reconnect before attaching this editor.");
      return false;
    }
    if (pinned) {
      setAttachment("pinned");
      return true;
    }
    try {
      await acquireDedicatedSession(documentId, backendConfig);
      setPinned(true);
      setAttachment("pinned");
      setAttachmentDetail(null);
      await onInteractiveStatusRefresh?.();
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not pin editor session.";
      const capacity =
        error instanceof BackendApiError &&
        error.status === 409 &&
        /limit/i.test(message);
      setAttachment(capacity ? "capacity" : "error");
      setAttachmentDetail(message);
      await onInteractiveStatusRefresh?.();
      return false;
    }
  };

  const appendLog = (entry: Omit<SqlLogEntry, "id">) => {
    setLog((current) => [{ ...entry, id: `${Date.now()}-${current.length}` }, ...current].slice(0, 100));
  };

  const execute = async (text: string, confirmed: boolean) => {
    setBusy(true);
    setPendingPrompt(null);
    try {
      const attached = await ensureDedicatedPin();
      if (!attached) {
        appendLog({
          sql: text,
          status: "error",
          detail: effectiveDetail || "Editor session is Unconnected.",
        });
        return;
      }
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

  const attachmentLabel =
    effectiveAttachment === "pinned"
      ? "Interactive: Pinned"
      : effectiveAttachment === "capacity"
        ? "Interactive: Unconnected (capacity)"
        : effectiveAttachment === "dead"
          ? "Interactive: Dead"
          : effectiveAttachment === "error"
            ? "Interactive: Attach failed"
            : interactiveConnected
              ? "Interactive: Unconnected (lazy)"
              : "Interactive: Disconnected";

  return (
    <div className="tool-panel sql-sheet" aria-label="SQL sheet">
      <div className="schema-status" role="status">
        <span
          className={
            effectiveAttachment === "pinned"
              ? "status-pill status-pill--ok"
              : effectiveAttachment === "capacity" || effectiveAttachment === "dead" || effectiveAttachment === "error"
                ? "status-pill"
                : "status-pill"
          }
        >
          {attachmentLabel}
        </span>
      </div>
      {effectiveDetail ? <p className="pane-muted">{effectiveDetail}</p> : null}
      <form
        id={documentId === "sql" ? WORKSPACE_SQL_FORM_ID : `${WORKSPACE_SQL_FORM_ID}-${documentId}`}
        className="sql-editor"
        onSubmit={onSubmit}
      >
        <label className="sr-only" htmlFor={`sql-sheet-editor-${documentId}`}>
          SQL
        </label>
        <CodeEditor
          id={`sql-sheet-editor-${documentId}`}
          language="sql"
          value={sql}
          aria-label="SQL"
          disabled={!isBackendOnline}
          onChange={(next) => {
            setSql(next);
            if (!dirty) {
              onDirtyChange(true);
            }
          }}
        />
        <div className="tool-toolbar">
          <button type="submit" disabled={!canRun || !hasSql} aria-busy={busy}>
            {busy ? "Running…" : "Run"}
          </button>
          {onAttachAsDatabaseSource ? (
            <button
              type="button"
              className="chrome-button"
              disabled={!hasSql}
              onClick={() => onAttachAsDatabaseSource(sql)}
            >
              Attach as Database Source
            </button>
          ) : null}
          <span className="pane-muted">
            {connectedConnection
              ? workingSchema
                ? `Will run on ${connectedConnection} via SQLcl MCP; unqualified objects target ${workingSchema}`
                : `Will run on ${connectedConnection} via SQLcl MCP (no schema set — objects land in login schema)`
              : "Connect a SQLcl saved connection to run SQL."}
            {interactiveConnected
              ? " Dedicated interactive session pins on first database action."
              : ""}
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
