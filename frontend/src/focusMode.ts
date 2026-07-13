/** Focus Mode + Activity Rail pairing and auto-switch policy (ADR-0007). */

export type FocusMode = "agent" | "sql" | "files" | "review";

export type ActivityRailId = "files" | "agent" | "code" | "database" | "apex" | "review";

export type EditorPeerKind = "sql" | "file" | "other";

export const FOCUS_MODES: ReadonlyArray<FocusMode> = ["agent", "sql", "files", "review"];

export const ACTIVITY_RAIL_ITEMS: ReadonlyArray<
  Readonly<{ id: ActivityRailId; label: string; glyph: string }>
> = [
  { id: "files", label: "Files", glyph: "▤" },
  { id: "agent", label: "Agent", glyph: "◎" },
  { id: "code", label: "Code", glyph: "</>" },
  { id: "database", label: "Database", glyph: "⬡" },
  { id: "apex", label: "APEX", glyph: "◇" },
  { id: "review", label: "Review", glyph: "✓" },
];

export const DEFAULT_FOCUS_MODE: FocusMode = "agent";
export const DEFAULT_ACTIVITY_RAIL: ActivityRailId = "agent";

/** Agent / Files / Review set and reflect matching Focus Modes; SQL has no rail. */
export const railForFocusMode = (mode: FocusMode): ActivityRailId | null => {
  switch (mode) {
    case "agent":
      return "agent";
    case "files":
      return "files";
    case "review":
      return "review";
    case "sql":
      return null;
  }
};

/** Paired rails return a Focus Mode; Code / APEX are Explorer-only; Database opens its drawer. */
export const focusModeForRail = (rail: ActivityRailId): FocusMode | null => {
  switch (rail) {
    case "agent":
      return "agent";
    case "files":
      return "files";
    case "review":
      return "review";
    case "code":
    case "database":
    case "apex":
      return null;
  }
};

export const applyRailSelection = (
  rail: ActivityRailId,
  currentFocus: FocusMode,
): Readonly<{ focusMode: FocusMode; rail: ActivityRailId }> => {
  const paired = focusModeForRail(rail);
  if (paired) {
    return { focusMode: paired, rail };
  }
  // Explorer-only: from Review, exit to Agent.
  if (currentFocus === "review") {
    return { focusMode: "agent", rail };
  }
  return { focusMode: currentFocus, rail };
};

/**
 * Explicit Focus Mode selection. Updates rail for Agent / Files / Review;
 * SQL leaves the current rail posture unchanged.
 */
export const applyFocusModeSelection = (
  mode: FocusMode,
  currentRail: ActivityRailId,
): Readonly<{ focusMode: FocusMode; rail: ActivityRailId }> => {
  const nextRail = railForFocusMode(mode);
  return { focusMode: mode, rail: nextRail ?? currentRail };
};

/**
 * Auto-switch from open / tab focus work.
 * Agent is sticky on editor focus; Mission focus restores Agent;
 * SQL ↔ Files follow the active editor peer once not in sticky Agent;
 * Review exits via the same work-following rules (never auto-entered).
 */
export const focusModeFromWork = (
  current: FocusMode,
  event:
    | Readonly<{ type: "mission-focus" }>
    | Readonly<{ type: "editor-focus"; peer: EditorPeerKind }>,
): FocusMode => {
  if (event.type === "mission-focus") {
    return "agent";
  }
  if (current === "agent") {
    return "agent";
  }
  if (event.peer === "sql") {
    return "sql";
  }
  if (event.peer === "file") {
    return "files";
  }
  // Other editor peers: leave Review for Agent; otherwise keep current.
  if (current === "review") {
    return "agent";
  }
  return current;
};

export const editorPeerKindFromTab = (
  kind: string | null | undefined,
): EditorPeerKind | "mission" | null => {
  if (!kind) {
    return null;
  }
  if (kind === "mission") {
    return "mission";
  }
  if (kind === "sql") {
    return "sql";
  }
  if (kind === "file") {
    return "file";
  }
  return "other";
};

export const focusModeLabel = (mode: FocusMode): string => {
  switch (mode) {
    case "agent":
      return "Agent";
    case "sql":
      return "SQL";
    case "files":
      return "Files";
    case "review":
      return "Review";
  }
};

/** Visual primacy cues for Mission↔Editors peers (beyond grid ratio alone). */
export type PeerPrimacy = "primary" | "secondary";
export type SecondaryDimStrength = "light" | "strong";

export type WorkspaceVisualPrimacy = Readonly<{
  mission: PeerPrimacy;
  editors: PeerPrimacy;
  /** Dim strength on the secondary peer — Review is stronger so it ≠ Agent+SQL. */
  secondaryDim: SecondaryDimStrength;
  /** Quiet Review meta under Mission title; title stays "Mission". */
  missionReviewMeta: boolean;
}>;

export const workspaceVisualPrimacy = (mode: FocusMode): WorkspaceVisualPrimacy => {
  const missionPrimary = mode === "agent" || mode === "review";
  return {
    mission: missionPrimary ? "primary" : "secondary",
    editors: missionPrimary ? "secondary" : "primary",
    secondaryDim: mode === "review" ? "strong" : "light",
    missionReviewMeta: mode === "review",
  };
};
