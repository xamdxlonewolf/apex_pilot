/** Pure helpers for Workspace editor tab strip behavior. */

export type EditorTabLike = Readonly<{
  id: string;
  kind: string;
}>;

/**
 * After closing the tab at `closingIndex` in `beforeClose`, pick the next
 * editor tab to activate from `afterClose` (neighbor after, then before).
 */
export const pickAdjacentEditorTab = <T extends EditorTabLike>(
  beforeClose: ReadonlyArray<T>,
  afterClose: ReadonlyArray<T>,
  closingIndex: number,
  isEditorTab: (tab: T) => boolean,
): T | null => {
  if (closingIndex < 0) {
    return afterClose.find(isEditorTab) ?? null;
  }
  const after = afterClose.slice(closingIndex).find(isEditorTab) ?? null;
  const before =
    [...afterClose.slice(0, closingIndex)].reverse().find(isEditorTab) ?? null;
  return after ?? before ?? afterClose.find(isEditorTab) ?? null;
};
