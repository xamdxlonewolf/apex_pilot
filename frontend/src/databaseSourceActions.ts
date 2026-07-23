import type {
  AttachmentState,
  BaselineFingerprints,
  DatabaseSourceState,
  DatabaseSourceTarget,
} from "./databaseSourceState";

export type DatabaseSourceActionIntent =
  | "save"
  | "compile"
  | "save-and-compile"
  | "attach-and-compile"
  | "force"
  | "recreate"
  | "retarget";

export type ContentKind = "database-source" | "mixed";

export type CompilePlan = Readonly<{
  kind: "compile";
  text: string;
  textSource: "buffer" | "saved-text";
  attachmentState: AttachmentState;
  target: DatabaseSourceTarget;
  baselineFingerprints: BaselineFingerprints;
  confirmAttach: boolean;
  confirmForce: boolean;
  confirmRecreate: boolean;
  confirmRetarget: boolean;
}>;

export type SaveLocalPlan = Readonly<{ kind: "save-local"; text: string }>;

export type DatabaseSourceActionPlan =
  | SaveLocalPlan
  | CompilePlan
  | Readonly<{ kind: "sequence"; steps: readonly [SaveLocalPlan, CompilePlan] }>
  | Readonly<{ kind: "run-as-sql-script"; text: string }>;

export type PlanDatabaseSourceActionOptions = Readonly<{
  contentKind?: ContentKind;
}>;

function compilePlan(
  state: DatabaseSourceState,
  text: string,
  textSource: CompilePlan["textSource"],
  intent: DatabaseSourceActionIntent,
): CompilePlan {
  return {
    kind: "compile",
    text,
    textSource,
    attachmentState: state.attachmentState,
    target: state.target,
    baselineFingerprints: state.baselineFingerprints,
    confirmAttach: intent === "attach-and-compile",
    confirmForce: intent === "force",
    confirmRecreate: intent === "recreate",
    confirmRetarget: intent === "retarget",
  };
}

export function planDatabaseSourceAction(
  state: DatabaseSourceState,
  intent: DatabaseSourceActionIntent,
  options: PlanDatabaseSourceActionOptions = {},
): DatabaseSourceActionPlan {
  if (options.contentKind === "mixed" && intent !== "save") {
    return { kind: "run-as-sql-script", text: state.bufferText };
  }

  if (intent === "save") {
    return { kind: "save-local", text: state.bufferText };
  }

  if (intent === "save-and-compile") {
    const save = { kind: "save-local" as const, text: state.bufferText };
    return {
      kind: "sequence",
      steps: [save, compilePlan(state, save.text, "saved-text", intent)],
    };
  }

  return compilePlan(state, state.bufferText, "buffer", intent);
}
