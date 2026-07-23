export type DatabaseObjectType =
  | "FUNCTION"
  | "PACKAGE"
  | "PACKAGE_BODY"
  | "PROCEDURE"
  | "TRIGGER"
  | "TYPE"
  | "TYPE_BODY"
  | "VIEW"
  | "UNKNOWN";

export type CompileStatus = "never" | "succeeded" | "failed" | "partial" | "invalid" | "unknown";

export type AttachmentState = "unconnected" | "attached" | "retarget_pending";

export type DatabaseSourceTarget = Readonly<{
  connectionProfileId: string | null;
  workingSchema: string | null;
  owner: string;
  objectTypes: readonly DatabaseObjectType[];
  name: string;
}>;

export type BaselineFingerprints = Readonly<{
  saved: string | null;
  database: string | null;
}>;

export type DatabaseSourceState = Readonly<{
  target: DatabaseSourceTarget;
  attachmentState: AttachmentState;
  savedText: string;
  bufferText: string;
  dirty: boolean;
  compileStatus: CompileStatus;
  conflictDetected: boolean;
  stale: boolean;
  objectStatus: "VALID" | "INVALID" | null;
  baselineFingerprints: BaselineFingerprints;
  databaseSourceMatches: boolean | null;
  lastSuccessfulCompileUsedCurrentBuffer: boolean;
  closePreferences: Readonly<{ blockCloseOnCompileWarnings: boolean }>;
  globalContext: Readonly<{
    connectionProfileId: string | null;
    workingSchema: string | null;
  }> | null;
  globalContextMismatch: boolean;
}>;

export type CreateDatabaseSourceStateInput = Readonly<{
  target: DatabaseSourceTarget;
  savedText: string;
  bufferText?: string;
  attachmentState?: AttachmentState;
  compileStatus?: CompileStatus;
  conflictDetected?: boolean;
  stale?: boolean;
  objectStatus?: "VALID" | "INVALID" | null;
  baselineFingerprints?: Partial<BaselineFingerprints>;
  databaseSourceMatches?: boolean | null;
  lastSuccessfulCompileUsedCurrentBuffer?: boolean;
  blockCloseOnCompileWarnings?: boolean;
}>;

export function createDatabaseSourceState(
  input: CreateDatabaseSourceStateInput,
): DatabaseSourceState {
  const bufferText = input.bufferText ?? input.savedText;

  return {
    target: { ...input.target, objectTypes: [...input.target.objectTypes] },
    attachmentState: input.attachmentState ?? "attached",
    savedText: input.savedText,
    bufferText,
    dirty: bufferText !== input.savedText,
    compileStatus: input.compileStatus ?? "never",
    conflictDetected: input.conflictDetected ?? false,
    stale: input.stale ?? false,
    objectStatus: input.objectStatus ?? null,
    baselineFingerprints: {
      saved: input.baselineFingerprints?.saved ?? null,
      database: input.baselineFingerprints?.database ?? null,
    },
    databaseSourceMatches: input.databaseSourceMatches ?? null,
    lastSuccessfulCompileUsedCurrentBuffer: input.lastSuccessfulCompileUsedCurrentBuffer ?? false,
    closePreferences: {
      blockCloseOnCompileWarnings: input.blockCloseOnCompileWarnings ?? false,
    },
    globalContext: null,
    globalContextMismatch: false,
  };
}

export function withBufferText(
  state: DatabaseSourceState,
  bufferText: string,
): DatabaseSourceState {
  return {
    ...state,
    bufferText,
    dirty: bufferText !== state.savedText,
    lastSuccessfulCompileUsedCurrentBuffer:
      state.lastSuccessfulCompileUsedCurrentBuffer && bufferText === state.bufferText,
  };
}

export function withGlobalContextChange(
  state: DatabaseSourceState,
  connectionProfileId: string | null,
  workingSchema: string | null,
): DatabaseSourceState {
  const globalContext = { connectionProfileId, workingSchema };

  return {
    ...state,
    target: { ...state.target, objectTypes: [...state.target.objectTypes] },
    globalContext,
    globalContextMismatch:
      state.target.connectionProfileId !== connectionProfileId ||
      state.target.workingSchema !== workingSchema,
  };
}
