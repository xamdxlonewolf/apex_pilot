/** Quick Open (Ctrl+P) item registry for project files and schema objects. */

import { listDirectory, type FileTreeNode } from "./projectFs";

export type QuickOpenItemKind = "file" | "object";

export type QuickOpenItem = Readonly<{
  id: string;
  kind: QuickOpenItemKind;
  label: string;
  /** Secondary path / qualified name shown in the list. */
  detail?: string;
  /** Absolute project file path when kind is file. */
  path?: string;
  /** Schema-qualified object name when kind is object. */
  objectName?: string;
  objectType?: string;
  schemaName?: string;
}>;

/** True when the event is Quick Open (Ctrl/Cmd+P without Shift). */
export const matchQuickOpenShortcut = (
  event: Pick<KeyboardEvent, "key" | "code" | "ctrlKey" | "metaKey" | "shiftKey" | "altKey">,
): boolean => {
  const mod = event.ctrlKey || event.metaKey;
  if (!mod || event.shiftKey || event.altKey) {
    return false;
  }
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  return key === "p" || event.code === "KeyP";
};

export const filterQuickOpenItems = (
  items: ReadonlyArray<QuickOpenItem>,
  query: string,
): QuickOpenItem[] => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return [...items];
  }
  return items.filter((item) => {
    const haystack = [item.label, item.detail, item.path, item.objectName, item.objectType, item.schemaName]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(normalized);
  });
};

export const fileNodeToQuickOpenItem = (node: FileTreeNode): QuickOpenItem => ({
  id: `file:${node.path}`,
  kind: "file",
  label: node.name,
  detail: node.path,
  path: node.path,
});

export const schemaObjectToQuickOpenItem = (
  schemaName: string,
  objectType: string,
  objectName: string,
): QuickOpenItem => ({
  id: `object:${schemaName}.${objectType}.${objectName}`,
  kind: "object",
  label: objectName,
  detail: `${schemaName}.${objectName}`,
  objectName,
  objectType,
  schemaName,
});

export const schemaTablesToQuickOpenItems = (
  schemaName: string,
  tables: ReadonlyArray<{ table_name: string }>,
): QuickOpenItem[] =>
  tables.map((table) => schemaObjectToQuickOpenItem(schemaName, "TABLE", table.table_name));

/** Recursively collect project files for Quick Open (dirs are expanded, not listed). */
export const collectProjectFileItems = async (
  rootPath: string,
  options: Readonly<{ showJunk?: boolean; maxDepth?: number }> = {},
): Promise<QuickOpenItem[]> => {
  const showJunk = options.showJunk ?? false;
  const maxDepth = options.maxDepth ?? 8;
  const items: QuickOpenItem[] = [];

  const walk = async (dirPath: string, depth: number): Promise<void> => {
    if (depth > maxDepth) {
      return;
    }
    const nodes = await listDirectory(dirPath, { depth, showJunk });
    for (const node of nodes) {
      if (node.kind === "file") {
        items.push(fileNodeToQuickOpenItem(node));
        continue;
      }
      await walk(node.path, depth + 1);
    }
  };

  await walk(rootPath, 0);
  return items.sort((left, right) => left.label.localeCompare(right.label));
};

export const mergeQuickOpenItems = (
  files: ReadonlyArray<QuickOpenItem>,
  objects: ReadonlyArray<QuickOpenItem>,
): QuickOpenItem[] => [...files, ...objects];
