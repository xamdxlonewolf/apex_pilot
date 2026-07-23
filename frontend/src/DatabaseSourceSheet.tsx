import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

import {
  BackendApiError,
  compareDatabaseSource,
  compileDatabaseSource,
  parseDatabaseSource,
  reconcileDatabaseSource,
  type BackendConfig,
  type BaselineFingerprint,
  type OracleUnitType,
  type SourceCompareResult,
  type SourceCompileConfirmation,
  type SourceCompileResult,
  type SourceDiagnostic,
  type SourceFingerprint,
} from "./backend";
import { CodeEditor } from "./CodeEditor";
import { DialogChrome } from "./DialogChrome";
import { planDatabaseSourceAction, type DatabaseSourceActionIntent } from "./databaseSourceActions";
import { resolveCloseDialog, type CloseDialogOption } from "./databaseSourceClose";
import {
  baselinesFromCompare,
  planReconcileOutcome,
  summarizeCompare,
} from "./databaseSourceCompare";
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

export type DatabaseSourceStickySnapshot = Readonly<{
  target: DatabaseSourceTarget;
  attachmentState: AttachmentState;
  baselineFingerprints: readonly SourceFingerprint[];
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
  /** Stable Connection Profile id for global-context mismatch checks. */
  globalConnectionProfileId: string | null;
  globalWorkingSchema: string | null;
  /** Display label for sticky chrome — Connection Profile display_name, never SQLcl alone. */
  connectionProfileLabel?: string | null;
  interactiveConnected?: boolean;
  onSave: (text: string) => Promise<boolean>;
  /** Back out of an Unconnected Database Source document without attaching. */
  onCloseDocument?: () => void;
  onRunAsSqlScript?: (text: string) => void;
  onOpenSeparateUnit?: (unitType: "PACKAGE" | "PACKAGE BODY" | "TYPE" | "TYPE BODY") => void;
  onDiagnostics?: (problems: DatabaseSourceProblem[], oracleMessages: string[], hasErrors: boolean) => void;
  onStickyStateChange?: (snapshot: DatabaseSourceStickySnapshot) => void;
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

const unknownCompileFrom = (error: unknown): SourceCompileResult | null => {
  if (!(error instanceof BackendApiError) || error.status !== 503 || !error.detail || typeof error.detail !== "object") {
    return null;
  }
  const detail = error.detail as Partial<SourceCompileResult>;
  if (detail.requires_reconcile !== true) return null;
  return detail as SourceCompileResult;
};

const closeOptionLabel = (option: CloseDialogOption): string =>
  option.replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

const baselinesFromFingerprints = (
  fingerprints: readonly SourceFingerprint[],
): BaselineFingerprint[] =>
  fingerprints.map(({ owner, name, unit_type, digest }) => ({ owner, name, unit_type, digest }));

const unitStatusLabel = (status: string): string => {
  if (status === "identical") return "identical";
  if (status === "differs") return "differs";
  return "missing in database";
};

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
      connectionProfileLabel = null,
      interactiveConnected = false,
      onSave,
      onCloseDocument,
      onRunAsSqlScript,
      onOpenSeparateUnit,
      onDiagnostics,
      onStickyStateChange,
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
    const [fingerprintSnapshot, setFingerprintSnapshot] = useState<SourceFingerprint[]>(() => [
      ...baselineFingerprints,
    ]);
    const [diagnostics, setDiagnostics] = useState<SourceDiagnostic[]>([]);
    const [busy, setBusy] = useState(false);
    const [confirmation, setConfirmation] = useState<SourceCompileConfirmation | null>(null);
    const [compareResult, setCompareResult] = useState<SourceCompareResult | null>(null);
    const [compareBusy, setCompareBusy] = useState(false);
    const [requiresReconcile, setRequiresReconcile] = useState(false);
    const [reconcileMessage, setReconcileMessage] = useState<string | null>(null);
    const [closeResolver, setCloseResolver] = useState<((result: "closed" | "cancelled") => void) | null>(null);
    const mappedDiagnostics = mapDatabaseSourceDiagnostics(diagnostics);
    const compareSummary = compareResult ? summarizeCompare(compareResult) : null;
    const stickyChangeRef = useRef(onStickyStateChange);
    stickyChangeRef.current = onStickyStateChange;
    const lastStickyKey = useRef<string | null>(null);

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

    useEffect(() => {
      const snapshot: DatabaseSourceStickySnapshot = {
        target: state.target,
        attachmentState: state.attachmentState,
        baselineFingerprints: fingerprintSnapshot,
      };
      const key = JSON.stringify(snapshot);
      if (lastStickyKey.current === key) return;
      lastStickyKey.current = key;
      stickyChangeRef.current?.(snapshot);
    }, [fingerprintSnapshot, state.attachmentState, state.target]);

    const save = async (): Promise<boolean> => {
      if (readOnly) return false;
      const saved = await onSave(state.bufferText);
      if (saved) {
        setState((current) => ({ ...current, savedText: current.bufferText, dirty: false }));
      }
      return saved;
    };

    const runCompare = async (): Promise<SourceCompareResult | null> => {
      if (readOnly || compareBusy) return null;
      setCompareBusy(true);
      try {
        const result = await compareDatabaseSource(
          {
            source_text: state.bufferText,
            owner: state.target.owner,
            name: state.target.name,
            unit_types:
              state.target.objectTypes.length > 0
                ? state.target.objectTypes.map(toOracleUnitType)
                : undefined,
          },
          backendConfig,
        );
        setCompareResult(result);
        setState((current) => ({
          ...current,
          stale: !result.identical,
          conflictDetected: !result.exists || !result.identical,
          databaseSourceMatches: result.identical,
        }));
        return result;
      } catch (error) {
        setDiagnostics([
          {
            severity: "error",
            message: error instanceof Error ? error.message : "Compare failed.",
          },
        ]);
        return null;
      } finally {
        setCompareBusy(false);
      }
    };

    const reloadFromDatabase = (result: SourceCompareResult = compareResult!) => {
      if (!result?.database_source) return;
      const nextBaselines = baselinesFromCompare(result);
      setBaselines([...nextBaselines]);
      setFingerprintSnapshot(
        result.database_fingerprints.filter((fingerprint) => fingerprint.exists),
      );
      setState((current) =>
        withBufferText(
          {
            ...current,
            stale: false,
            conflictDetected: false,
            databaseSourceMatches: true,
            baselineFingerprints: {
              saved: nextBaselines[0]?.digest ?? null,
              database: nextBaselines[0]?.digest ?? null,
            },
          },
          result.database_source ?? current.bufferText,
        ),
      );
      setConfirmation(null);
      setCompareResult(null);
      setReconcileMessage("Reloaded buffer from database source.");
    };

    const mergeKeepLocalAdoptBaselines = () => {
      if (!compareResult) return;
      const nextBaselines = baselinesFromCompare(compareResult);
      setBaselines([...nextBaselines]);
      setFingerprintSnapshot(
        compareResult.database_fingerprints.filter((fingerprint) => fingerprint.exists),
      );
      setState((current) => ({
        ...current,
        stale: !compareResult.identical,
        conflictDetected: compareSummary?.droppedTarget ?? false,
        baselineFingerprints: {
          saved: nextBaselines[0]?.digest ?? current.baselineFingerprints.saved,
          database: nextBaselines[0]?.digest ?? current.baselineFingerprints.database,
        },
      }));
      setReconcileMessage(
        "Kept local buffer and adopted database baselines. Force Compile still required to overwrite.",
      );
    };

    const runReconcile = async (): Promise<void> => {
      if (readOnly || busy || state.target.objectTypes.length === 0) return;
      setBusy(true);
      try {
        const result = await reconcileDatabaseSource(
          {
            owner: state.target.owner,
            name: state.target.name,
            unit_types: state.target.objectTypes.map(toOracleUnitType),
          },
          backendConfig,
        );
        const outcome = planReconcileOutcome(result.fingerprints, state.bufferText);
        setBaselines([...outcome.baselines]);
        setFingerprintSnapshot(
          result.fingerprints.filter((fingerprint) => fingerprint.exists).map((fingerprint) => ({
            owner: fingerprint.owner,
            name: fingerprint.name,
            unit_type: fingerprint.unit_type,
            digest: fingerprint.digest,
            exists: fingerprint.exists,
            status: fingerprint.status,
          })),
        );
        setRequiresReconcile(false);
        setReconcileMessage(outcome.message);
        setState((current) => ({
          ...current,
          // Never silently rebind from global Context Bar — sticky target stays.
          compileStatus: outcome.kind === "matched" ? current.compileStatus : "unknown",
          stale: outcome.kind === "stale" || outcome.kind === "conflicted",
          conflictDetected: outcome.kind === "dropped" || outcome.kind === "conflicted",
          objectStatus: outcome.objectStatus,
          databaseSourceMatches: outcome.kind === "matched",
          baselineFingerprints: {
            saved: outcome.baselines[0]?.digest ?? current.baselineFingerprints.saved,
            database: outcome.baselines[0]?.digest ?? current.baselineFingerprints.database,
          },
        }));
        if (outcome.kind === "stale" || outcome.kind === "conflicted" || outcome.kind === "dropped") {
          await runCompare();
        }
      } catch (error) {
        setDiagnostics([
          {
            severity: "error",
            message: error instanceof Error ? error.message : "Reconcile failed.",
          },
        ]);
      } finally {
        setBusy(false);
      }
    };

    useEffect(() => {
      if (!requiresReconcile || !interactiveConnected || readOnly) return;
      // After reconnect, surface reconcile without silently compiling.
      setReconcileMessage(
        "Interactive connection restored. Reconcile sticky target before another Compile.",
      );
    }, [interactiveConnected, readOnly, requiresReconcile]);

    const compile = async (
      intent: DatabaseSourceActionIntent,
      confirmed?: SourceCompileConfirmation,
    ): Promise<boolean> => {
      if (readOnly || busy) return false;
      if (requiresReconcile && intent !== "force") {
        setReconcileMessage("Reconcile required after unknown DDL before Compile.");
        return false;
      }
      if (confirmed?.reason === "force" && !compareResult) {
        const compared = await runCompare();
        if (!compared) return false;
        setConfirmation(confirmed);
        return false;
      }
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
          setFingerprintSnapshot(nextBaselines);
        }
        const invalid = result.units.some((unit) => unit.status === "INVALID") || result.outcome === "failed";
        const succeeded = result.outcome === "succeeded";
        setCompareResult(null);
        setRequiresReconcile(false);
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
          stale: result.outcome === "partial" ? true : false,
          conflictDetected: result.outcome === "partial",
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
          if (nextConfirmation.reason === "force" || nextConfirmation.reason === "attach") {
            void runCompare();
          }
          return false;
        }
        const unknown = unknownCompileFrom(error);
        if (unknown) {
          setRequiresReconcile(true);
          setDiagnostics(unknown.diagnostics ?? [
            {
              severity: "error",
              message:
                unknown.message ??
                "Compile outcome unknown. Reconnect and reconcile before another Compile.",
            },
          ]);
          setState((current) => ({
            ...current,
            compileStatus: "unknown",
            conflictDetected: true,
          }));
          setReconcileMessage(
            "Compile outcome unknown after DDL. Reconcile sticky target before another Compile — never auto-retry.",
          );
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

    const profileChromeLabel =
      state.attachmentState === "unconnected" || !state.target.connectionProfileId
        ? "Unconnected"
        : connectionProfileLabel?.trim() ||
          state.target.connectionProfileId;

    const confirmLabel =
      confirmation?.reason === "retarget"
        ? "Attach as New Target"
        : confirmation?.reason === "force"
          ? "Force Compile"
          : confirmation?.reason === "recreate"
            ? "Recreate Object"
            : "Confirm and compile";

    const forceBlockedPendingCompare =
      confirmation?.reason === "force" && !compareResult && !compareBusy;

    return (
      <div className="tool-panel database-source-sheet" aria-label="Database Source Document">
        <div className="schema-status" role="status">
          <span className="status-pill">
            Connection Profile: {profileChromeLabel}
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
          {state.stale ? <span className="status-pill">Stale source</span> : null}
          {requiresReconcile ? <span className="status-pill">Reconcile required</span> : null}
          {readOnly ? <span className="status-pill">Read-only</span> : null}
        </div>
        {requiresReconcile || reconcileMessage ? (
          <div className="confirm-banner" role="status" aria-label="Database source reconcile">
            <p>{reconcileMessage ?? "Reconcile sticky target after unknown DDL."}</p>
            <div className="button-row">
              <button
                type="button"
                onClick={() => void runReconcile()}
                disabled={busy || !interactiveConnected || state.target.objectTypes.length === 0}
              >
                Reconcile
              </button>
              <button type="button" className="chrome-button" onClick={() => void runCompare()} disabled={compareBusy}>
                Compare
              </button>
              {reconcileMessage && !requiresReconcile ? (
                <button type="button" className="chrome-button" onClick={() => setReconcileMessage(null)}>
                  Dismiss
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
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
            {compareBusy ? <p className="pane-muted">Comparing local and database source…</p> : null}
            {compareSummary ? (
              <div aria-label="Source compare result">
                <p>
                  {compareSummary.allIdentical
                    ? "Local and database source are identical."
                    : compareSummary.droppedTarget
                      ? "One or more target units are missing in the database."
                      : "Local and database source differ."}
                </p>
                <ul className="dense-list">
                  {compareSummary.rows.map((row) => (
                    <li key={`${row.owner}.${row.name}.${row.unitType}`}>
                      {row.owner}.{row.name} ({row.unitType}): {unitStatusLabel(row.status)}
                    </li>
                  ))}
                </ul>
                {compareResult?.local_source || compareResult?.database_source ? (
                  <div className="source-compare-panes">
                    <details open>
                      <summary>Local source</summary>
                      <pre className="source-compare-pre">{compareResult?.local_source ?? "—"}</pre>
                    </details>
                    <details open>
                      <summary>Database source</summary>
                      <pre className="source-compare-pre">
                        {compareResult?.database_source ??
                          (compareSummary.droppedTarget
                            ? "Target missing or incomplete in the database."
                            : "—")}
                      </pre>
                    </details>
                  </div>
                ) : null}
              </div>
            ) : null}
            <div className="button-row">
              {(confirmation.reason === "force" || confirmation.reason === "attach") && !compareResult ? (
                <button type="button" onClick={() => void runCompare()} disabled={compareBusy}>
                  Compare sources
                </button>
              ) : null}
              {compareSummary?.canReloadFromDatabase ? (
                <button type="button" onClick={() => reloadFromDatabase()} disabled={busy}>
                  Reload from database
                </button>
              ) : null}
              {compareSummary && !compareSummary.allIdentical && compareSummary.canReloadFromDatabase ? (
                <button type="button" className="chrome-button" onClick={mergeKeepLocalAdoptBaselines}>
                  Keep local (merge baselines)
                </button>
              ) : null}
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
                disabled={busy || forceBlockedPendingCompare}
              >
                {confirmLabel}
              </button>
              <button
                type="button"
                className="chrome-button"
                onClick={() => {
                  setConfirmation(null);
                  setCompareResult(null);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}
        {!confirmation && compareResult && compareSummary ? (
          <div className="confirm-banner" role="region" aria-label="Source compare result">
            <p>
              {compareSummary.allIdentical
                ? "Compare: local and database source are identical."
                : compareSummary.droppedTarget
                  ? "Compare: dropped or partial target — Reload unavailable for missing units."
                  : "Compare: sources differ."}
            </p>
            <ul className="dense-list">
              {compareSummary.rows.map((row) => (
                <li key={`${row.owner}.${row.name}.${row.unitType}`}>
                  {row.owner}.{row.name} ({row.unitType}): {unitStatusLabel(row.status)}
                </li>
              ))}
            </ul>
            <div className="button-row">
              {compareSummary.canReloadFromDatabase ? (
                <button type="button" onClick={() => reloadFromDatabase()} disabled={busy}>
                  Reload from database
                </button>
              ) : null}
              <button type="button" className="chrome-button" onClick={() => setCompareResult(null)}>
                Dismiss compare
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
            {state.attachmentState === "unconnected" && onCloseDocument ? (
              <button type="button" className="chrome-button" onClick={onCloseDocument} disabled={busy}>
                Close
              </button>
            ) : null}
            <button type="button" onClick={() => void act("save")} disabled={busy}>
              Save
            </button>
            <button
              type="button"
              onClick={() =>
                void act(state.attachmentState === "unconnected" ? "attach-and-compile" : "compile")
              }
              disabled={busy || requiresReconcile}
            >
              {state.attachmentState === "unconnected" ? "Attach & Compile" : "Compile"}
            </button>
            <button
              type="button"
              onClick={() => void act("save-and-compile")}
              disabled={busy || requiresReconcile}
            >
              Save & Compile
            </button>
            <button type="button" onClick={() => void runCompare()} disabled={busy || compareBusy}>
              Compare
            </button>
            <button type="button" onClick={() => void act("force")} disabled={busy || requiresReconcile}>
              Force
            </button>
            <button type="button" onClick={() => void act("recreate")} disabled={busy || requiresReconcile}>
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
