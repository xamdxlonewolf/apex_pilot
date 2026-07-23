import { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from "react";

import {
  BackendApiError,
  compileDatabaseSource,
  parseDatabaseSource,
  type BackendConfig,
  type BaselineFingerprint,
  type OracleUnitType,
  type SourceCompileConfirmation,
  type SourceDiagnostic,
  type SourceFingerprint,
} from "./backend";
import { CodeEditor } from "./CodeEditor";
import { DialogChrome } from "./DialogChrome";
import { planDatabaseSourceAction, type DatabaseSourceActionIntent } from "./databaseSourceActions";
import { resolveCloseDialog, type CloseDialogOption } from "./databaseSourceClose";
import { mapDatabaseSourceDiagnostics, type DatabaseSourceProblem } from "./databaseSourceDiagnostics";
import {
  createDatabaseSourceState,
  withBufferText,
  withGlobalContextChange,
  type AttachmentState,
  type DatabaseObjectType,
  type DatabaseSourceState,
  type DatabaseSourceTarget,
} from "./databaseSourceState";

export type DatabaseSourceSheetHandle = Readonly<{
  requestClose: () => Promise<"closed" | "cancelled">;
}>;

type DatabaseSourceSheetProps = Readonly<{
  documentId: string;
  backendConfig: BackendConfig;
  target: DatabaseSourceTarget;
  savedText: string;
  path?: string;
  readOnly?: boolean;
  attachmentState?: AttachmentState;
  baselineFingerprints?: readonly SourceFingerprint[];
  blockCloseOnCompileWarnings?: boolean;
  globalConnectionProfileId: string | null;
  globalWorkingSchema: string | null;
  onSave: (text: string) => Promise<boolean>;
  onRunAsSqlScript?: (text: string) => void;
  onOpenSeparateUnit?: (unitType: "PACKAGE" | "PACKAGE BODY" | "TYPE" | "TYPE BODY") => void;
  onDiagnostics?: (problems: DatabaseSourceProblem[], oracleMessages: string[], hasErrors: boolean) => void;
}>;

const COMPILE_UNIT_TYPES = new Set<string>([
  "FUNCTION",
  "PACKAGE",
  "PACKAGE BODY",
  "PROCEDURE",
  "TRIGGER",
  "TYPE",
  "TYPE BODY",
]);

const toOracleUnitType = (type: DatabaseObjectType): OracleUnitType => {
  const normalized = type.replaceAll("_", " ");
  if (!COMPILE_UNIT_TYPES.has(normalized)) {
    throw new Error(`Unsupported compile unit type: ${type}`);
  }
  return normalized as OracleUnitType;
};

const toObjectType = (unitType: string): DatabaseObjectType =>
  unitType.replaceAll(" ", "_") as DatabaseObjectType;

const identitiesMatch = (
  target: DatabaseSourceTarget,
  units: ReadonlyArray<{ owner: string | null; name: string; unit_type: string }>,
): boolean => {
  if (units.length === 0) return true;
  const owner = (units[0]?.owner ?? target.owner).toUpperCase();
  const name = units[0]?.name.toUpperCase() ?? "";
  const types = units.map((unit) => toObjectType(unit.unit_type));
  return (
    owner === target.owner.toUpperCase() &&
    name === target.name.toUpperCase() &&
    types.length === target.objectTypes.length &&
    types.every((type, index) => type === target.objectTypes[index])
  );
};

const confirmationFrom = (error: unknown): SourceCompileConfirmation | null => {
  if (!(error instanceof BackendApiError) || error.status !== 409 || !error.detail || typeof error.detail !== "object") {
    return null;
  }
  const detail = error.detail as { confirmation?: SourceCompileConfirmation } & Partial<SourceCompileConfirmation>;
  return detail.confirmation ?? (detail.reason && detail.message ? (detail as SourceCompileConfirmation) : null);
};

const closeOptionLabel = (option: CloseDialogOption): string =>
  option.replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

const baselinesFromFingerprints = (
  fingerprints: readonly SourceFingerprint[],
): BaselineFingerprint[] =>
  fingerprints.map(({ owner, name, unit_type, digest }) => ({ owner, name, unit_type, digest }));

export const DatabaseSourceSheet = forwardRef<DatabaseSourceSheetHandle, DatabaseSourceSheetProps>(
  (
    {
      documentId,
      backendConfig,
      target,
      savedText,
      path,
      readOnly = false,
      attachmentState = "unconnected",
      baselineFingerprints = [],
      blockCloseOnCompileWarnings = false,
      globalConnectionProfileId,
      globalWorkingSchema,
      onSave,
      onRunAsSqlScript,
      onOpenSeparateUnit,
      onDiagnostics,
    },
    ref,
  ) => {
    const [state, setState] = useState<DatabaseSourceState>(() =>
      createDatabaseSourceState({
        target,
        savedText,
        attachmentState,
        blockCloseOnCompileWarnings,
        baselineFingerprints: {
          saved: baselineFingerprints[0]?.digest ?? null,
          database: baselineFingerprints[0]?.digest ?? null,
        },
      }),
    );
    const [baselines, setBaselines] = useState<BaselineFingerprint[]>(() =>
      baselinesFromFingerprints(baselineFingerprints),
    );
    const [diagnostics, setDiagnostics] = useState<SourceDiagnostic[]>([]);
    const [busy, setBusy] = useState(false);
    const [confirmation, setConfirmation] = useState<SourceCompileConfirmation | null>(null);
    const [closeResolver, setCloseResolver] = useState<((result: "closed" | "cancelled") => void) | null>(null);
    const mappedDiagnostics = mapDatabaseSourceDiagnostics(diagnostics);

    useEffect(() => {
      const timer = window.setTimeout(() => {
        setState((current) =>
          withGlobalContextChange(current, globalConnectionProfileId, globalWorkingSchema),
        );
      }, 0);
      return () => window.clearTimeout(timer);
    }, [globalConnectionProfileId, globalWorkingSchema]);

    useEffect(() => {
      onDiagnostics?.(
        mappedDiagnostics.problems,
        mappedDiagnostics.oracleMessages,
        diagnostics.some((diagnostic) => diagnostic.severity === "error"),
      );
    }, [diagnostics, mappedDiagnostics.oracleMessages, mappedDiagnostics.problems, onDiagnostics]);

    const save = async (): Promise<boolean> => {
      if (readOnly) return false;
      const saved = await onSave(state.bufferText);
      if (saved) {
        setState((current) => ({ ...current, savedText: current.bufferText, dirty: false }));
      }
      return saved;
    };

    const compile = async (
      intent: DatabaseSourceActionIntent,
      confirmed?: SourceCompileConfirmation,
    ): Promise<boolean> => {
      if (readOnly || busy) return false;
      setBusy(true);
      setConfirmation(null);
      try {
        const parsed = await parseDatabaseSource(
          {
            source_text: state.bufferText,
            expected_owner: state.target.owner,
            expected_name: state.target.name,
          },
          backendConfig,
        );
        setDiagnostics(parsed.diagnostics);
        if (parsed.units.length === 0) {
          onRunAsSqlScript?.(state.bufferText);
          return false;
        }

        const adoptParsedIdentity =
          state.attachmentState === "unconnected" && state.target.objectTypes.length === 0;
        const parsedMatches = identitiesMatch(state.target, parsed.units) || adoptParsedIdentity;
        const allowRetarget = intent === "retarget" || confirmed?.reason === "retarget";
        if (!parsedMatches && !allowRetarget) {
          setState((current) => ({ ...current, attachmentState: "retarget_pending" }));
          setConfirmation({
            reason: "retarget",
            message:
              "Declared owner, name, or unit type differs from the sticky target. Restore the identity or Attach as New Target.",
            stale_conflicts: [],
          });
          return false;
        }

        const compileTarget =
          (!parsedMatches && allowRetarget) || adoptParsedIdentity
            ? {
                ...state.target,
                owner: (parsed.units[0]?.owner ?? state.target.owner).toUpperCase(),
                name: (parsed.units[0]?.name ?? state.target.name).toUpperCase(),
                objectTypes: parsed.units.map((unit) => toObjectType(unit.unit_type)),
              }
            : state.target;

        if (((!parsedMatches && allowRetarget) || adoptParsedIdentity) && compileTarget !== state.target) {
          setState((current) => ({
            ...current,
            target: compileTarget,
            attachmentState: adoptParsedIdentity ? current.attachmentState : "attached",
          }));
        }

        const action = planDatabaseSourceAction(
          { ...state, target: compileTarget, attachmentState: state.attachmentState },
          intent,
        );
        const plan = action.kind === "sequence" ? action.steps[1] : action;
        if (plan.kind === "run-as-sql-script") {
          onRunAsSqlScript?.(plan.text);
          return false;
        }
        if (plan.kind !== "compile") return false;

        const result = await compileDatabaseSource(
          {
            source_text: plan.text,
            owner: plan.target.owner,
            name: plan.target.name,
            unit_types: plan.target.objectTypes.map(toOracleUnitType),
            attachment_state: plan.attachmentState,
            working_schema: plan.target.workingSchema ?? undefined,
            baseline_fingerprints: baselines,
            confirm_attach: intent === "attach-and-compile" || confirmed?.reason === "attach",
            confirm_retarget: intent === "retarget" || confirmed?.reason === "retarget",
            confirm_force: intent === "force" || confirmed?.reason === "force",
            confirm_recreate: intent === "recreate" || confirmed?.reason === "recreate",
          },
          backendConfig,
        );
        setDiagnostics(result.diagnostics);
        const nextBaselines = result.units
          .map((unit) => unit.fingerprint)
          .filter((fingerprint): fingerprint is SourceFingerprint => Boolean(fingerprint));
        if (nextBaselines.length > 0) {
          setBaselines(baselinesFromFingerprints(nextBaselines));
        }
        const invalid = result.units.some((unit) => unit.status === "INVALID") || result.outcome === "failed";
        const succeeded = result.outcome === "succeeded";
        setState((current) => ({
          ...current,
          target: compileTarget,
          attachmentState: "attached",
          compileStatus:
            result.outcome === "succeeded" ||
            result.outcome === "failed" ||
            result.outcome === "partial" ||
            result.outcome === "unknown"
              ? result.outcome
              : current.compileStatus,
          objectStatus: invalid ? "INVALID" : succeeded ? "VALID" : current.objectStatus,
          lastSuccessfulCompileUsedCurrentBuffer: succeeded,
          databaseSourceMatches: succeeded ? true : result.outcome === "partial" ? false : current.databaseSourceMatches,
          baselineFingerprints: {
            saved: nextBaselines[0]?.digest ?? current.baselineFingerprints.saved,
            database: nextBaselines[0]?.digest ?? current.baselineFingerprints.database,
          },
        }));
        // Partial keeps the editor open and must not satisfy close-after-compile.
        return succeeded;
      } catch (error) {
        const nextConfirmation = confirmationFrom(error);
        if (nextConfirmation) {
          setConfirmation(nextConfirmation);
          return false;
        }
        setDiagnostics([
          { severity: "error", message: error instanceof Error ? error.message : "Compile failed." },
        ]);
        setState((current) => ({ ...current, compileStatus: "failed", objectStatus: "INVALID" }));
        return false;
      } finally {
        setBusy(false);
      }
    };

    const act = async (intent: DatabaseSourceActionIntent): Promise<boolean> => {
      if (intent === "save") return save();
      if (intent === "save-and-compile") {
        return (await save()) && compile(intent);
      }
      return compile(intent);
    };

    const requestClose = useCallback((): Promise<"closed" | "cancelled"> => {
      const dialog = resolveCloseDialog(state);
      if (dialog.kind === "none") return Promise.resolve("closed");
      return new Promise((resolve) => setCloseResolver(() => resolve));
    }, [state]);

    useImperativeHandle(ref, () => ({ requestClose }), [requestClose]);

    const closeDialog = closeResolver ? resolveCloseDialog(state) : null;
    const resolveClose = async (option: CloseDialogOption) => {
      if (!closeResolver) return;
      if (option === "cancel") {
        closeResolver("cancelled");
        setCloseResolver(null);
        return;
      }
      if (
        option === "discard" ||
        option === "discard-local-changes-and-close" ||
        option === "close-without-compiling" ||
        option === "close-with-invalid-object" ||
        option === "close"
      ) {
        closeResolver("closed");
        setCloseResolver(null);
        return;
      }
      if (option === "save-only" || option === "save-and-close") {
        if (!(await save())) return;
        closeResolver("closed");
        setCloseResolver(null);
        return;
      }
      if (option === "attach-save-and-compile") {
        if (!(await save())) return;
        if (!(await compile("attach-and-compile"))) return;
        closeResolver("closed");
        setCloseResolver(null);
        return;
      }
      if (option === "save-and-compile") {
        if (!(await act("save-and-compile"))) return;
        closeResolver("closed");
        setCloseResolver(null);
        return;
      }
      if (option === "compile-and-close" || option === "retry-compile-and-close") {
        const intent =
          state.attachmentState === "unconnected" ? "attach-and-compile" : "compile";
        if (!(await compile(intent))) return;
        closeResolver("closed");
        setCloseResolver(null);
        return;
      }
    };

    const confirmLabel =
      confirmation?.reason === "retarget"
        ? "Attach as New Target"
        : confirmation?.reason === "force"
          ? "Force Compile"
          : confirmation?.reason === "recreate"
            ? "Recreate Object"
            : "Confirm and compile";

    return (
      <div className="tool-panel database-source-sheet" aria-label="Database Source Document">
        <div className="schema-status" role="status">
          <span className="status-pill">
            Connection: {state.target.connectionProfileId ?? "Unconnected"}
          </span>
          <span className="status-pill">Schema: {state.target.workingSchema ?? "—"}</span>
          <span className="status-pill">
            Target: {state.target.owner}.{state.target.name}
          </span>
          <span className="status-pill">
            {state.target.objectTypes.join(" + ").replaceAll("_", " ") || "Unknown unit"}
          </span>
          {state.globalContextMismatch ? (
            <span className="status-pill">Global context differs</span>
          ) : null}
          {readOnly ? <span className="status-pill">Read-only</span> : null}
        </div>
        {confirmation ? (
          <div className="confirm-banner" role="alertdialog" aria-label="Confirm database source action">
            <p>{confirmation.message}</p>
            {confirmation.stale_conflicts.length ? (
              <ul className="dense-list">
                {confirmation.stale_conflicts.map((conflict) => (
                  <li key={`${conflict.owner}.${conflict.name}.${conflict.unit_type}`}>
                    Stale: {conflict.owner}.{conflict.name} ({conflict.unit_type})
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="button-row">
              <button
                type="button"
                onClick={() =>
                  void compile(
                    confirmation.reason === "retarget"
                      ? "retarget"
                      : confirmation.reason === "force"
                        ? "force"
                        : confirmation.reason === "recreate"
                          ? "recreate"
                          : confirmation.reason === "attach"
                            ? "attach-and-compile"
                            : "compile",
                    confirmation,
                  )
                }
                disabled={busy}
              >
                {confirmLabel}
              </button>
              <button type="button" className="chrome-button" onClick={() => setConfirmation(null)}>
                Cancel
              </button>
            </div>
          </div>
        ) : null}
        <CodeEditor
          id={`database-source:${documentId}`}
          language="sql"
          value={state.bufferText}
          readOnly={readOnly}
          markers={mappedDiagnostics.markers}
          aria-label="Database source"
          onMount={(editor) => editor.focus()}
          onChange={(text) => setState((current) => withBufferText(current, text))}
        />
        {!readOnly ? (
          <div className="tool-toolbar">
            <button type="button" onClick={() => void act("save")} disabled={busy}>
              Save
            </button>
            <button
              type="button"
              onClick={() =>
                void act(state.attachmentState === "unconnected" ? "attach-and-compile" : "compile")
              }
              disabled={busy}
            >
              {state.attachmentState === "unconnected" ? "Attach & Compile" : "Compile"}
            </button>
            <button type="button" onClick={() => void act("save-and-compile")} disabled={busy}>
              Save & Compile
            </button>
            <button type="button" onClick={() => void act("force")} disabled={busy}>
              Force
            </button>
            <button type="button" onClick={() => void act("recreate")} disabled={busy}>
              Recreate
            </button>
            {onOpenSeparateUnit &&
            state.target.objectTypes.includes("PACKAGE") &&
            state.target.objectTypes.includes("PACKAGE_BODY") ? (
              <>
                <button type="button" className="chrome-button" onClick={() => onOpenSeparateUnit("PACKAGE")}>
                  Open Spec Only
                </button>
                <button
                  type="button"
                  className="chrome-button"
                  onClick={() => onOpenSeparateUnit("PACKAGE BODY")}
                >
                  Open Body Only
                </button>
              </>
            ) : null}
            {onOpenSeparateUnit &&
            state.target.objectTypes.includes("TYPE") &&
            state.target.objectTypes.includes("TYPE_BODY") ? (
              <>
                <button type="button" className="chrome-button" onClick={() => onOpenSeparateUnit("TYPE")}>
                  Open Type Spec Only
                </button>
                <button
                  type="button"
                  className="chrome-button"
                  onClick={() => onOpenSeparateUnit("TYPE BODY")}
                >
                  Open Type Body Only
                </button>
              </>
            ) : null}
          </div>
        ) : null}
        {closeDialog ? (
          <DialogChrome
            title="Close Database Source Document"
            description={closeDialog.warning ?? "Choose how to handle this document."}
            onClose={() => void resolveClose("cancel")}
          >
            <div className="button-row">
              {closeDialog.options.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => void resolveClose(option)}
                  disabled={busy}
                >
                  {closeOptionLabel(option)}
                </button>
              ))}
            </div>
          </DialogChrome>
        ) : null}
        {path ? <p className="pane-muted">{path}</p> : null}
      </div>
    );
  },
);

DatabaseSourceSheet.displayName = "DatabaseSourceSheet";
