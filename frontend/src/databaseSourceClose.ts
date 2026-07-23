import type { DatabaseSourceState } from "./databaseSourceState";

export type CloseDialogOption =
  | "attach-save-and-compile"
  | "cancel"
  | "close"
  | "close-with-invalid-object"
  | "close-without-compiling"
  | "compile-and-close"
  | "discard"
  | "discard-local-changes-and-close"
  | "retry-compile-and-close"
  | "save-and-close"
  | "save-and-compile"
  | "save-only";

export type CloseDialogKind =
  | "none"
  | "dirty-uncompiled"
  | "database-drift"
  | "compiled-unsaved-buffer"
  | "invalid-object"
  | "unconnected-pending-work"
  | "compile-warnings";

export type CloseDialog = Readonly<{
  kind: CloseDialogKind;
  options: readonly CloseDialogOption[];
  warning?: string;
  warningBlocksClose?: boolean;
}>;

const COMPILE_WARNING = "The last compile completed with warnings.";

function warningFor(
  state: DatabaseSourceState,
): Pick<CloseDialog, "warning" | "warningBlocksClose"> {
  if (state.compileStatus !== "partial") {
    return {};
  }

  return {
    warning: COMPILE_WARNING,
    warningBlocksClose: state.closePreferences.blockCloseOnCompileWarnings,
  };
}

export function resolveCloseDialog(state: DatabaseSourceState): CloseDialog {
  const warning = warningFor(state);
  const hasPendingWork =
    state.dirty ||
    state.databaseSourceMatches === false ||
    state.compileStatus !== "never" ||
    state.objectStatus === "INVALID";

  if (state.attachmentState === "unconnected" && hasPendingWork) {
    return {
      kind: "unconnected-pending-work",
      options: ["attach-save-and-compile", "save-only", "discard", "cancel"],
      ...warning,
    };
  }

  if (state.objectStatus === "INVALID") {
    return {
      kind: "invalid-object",
      options: ["retry-compile-and-close", "close-with-invalid-object", "cancel"],
      ...warning,
    };
  }

  if (state.dirty && state.lastSuccessfulCompileUsedCurrentBuffer) {
    return {
      kind: "compiled-unsaved-buffer",
      options: ["save-and-close", "discard-local-changes-and-close", "cancel"],
      warning: "Discarding local changes does not undo the database compile.",
    };
  }

  if (state.dirty) {
    return {
      kind: "dirty-uncompiled",
      options: ["save-and-compile", "save-only", "discard", "cancel"],
      ...warning,
    };
  }

  if (state.databaseSourceMatches === false) {
    return {
      kind: "database-drift",
      options: ["compile-and-close", "close-without-compiling", "cancel"],
      ...warning,
    };
  }

  if (warning.warningBlocksClose) {
    return {
      kind: "compile-warnings",
      options: ["close", "cancel"],
      ...warning,
    };
  }

  return { kind: "none", options: [], ...warning };
}
