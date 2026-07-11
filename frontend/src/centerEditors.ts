/** Center workspace editor stub catalog (issue #35 / DS-WORKSPACE-*). */

import type { WorkspaceTabKind } from "./prefs";

export const CENTER_EDITOR_STUB_KINDS = [
  "object",
  "package",
  "apex",
  "rest",
  "diff",
  "file",
] as const;

export type CenterEditorStubKind = (typeof CENTER_EDITOR_STUB_KINDS)[number];

export const CENTER_EDITOR_STUB_META: Readonly<
  Record<CenterEditorStubKind, { title: string; secondary: string }>
> = {
  object: {
    title: "Object Editor",
    secondary: "Object viewing arrives with schema object metadata integration.",
  },
  package: {
    title: "Package Editor",
    secondary: "Package viewing arrives with PL/SQL source integration.",
  },
  apex: {
    title: "APEX Editor",
    secondary: "APEX page viewing arrives with APEX metadata integration.",
  },
  rest: {
    title: "REST Editor",
    secondary: "REST module viewing arrives with ORDS metadata integration.",
  },
  diff: {
    title: "Diff Editor",
    secondary: "Diff viewing arrives with source comparison integration.",
  },
  file: {
    title: "File Editor",
    secondary: "Full file editing arrives with workspace editor integration.",
  },
};

export const isCenterEditorStubKind = (
  kind: WorkspaceTabKind,
): kind is CenterEditorStubKind =>
  (CENTER_EDITOR_STUB_KINDS as readonly string[]).includes(kind);

export const stubCenterEditorTab = (
  kind: CenterEditorStubKind,
): Readonly<{ id: string; kind: CenterEditorStubKind; title: string }> => ({
  id: `stub:${kind}`,
  kind,
  title: CENTER_EDITOR_STUB_META[kind].title,
});
