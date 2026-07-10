/** Project file tree helpers with Tauri FS and browser fallbacks. */

export type FileTreeNode = Readonly<{
  name: string;
  path: string;
  kind: "dir" | "file";
  protected: boolean;
  junk: boolean;
}>;

const JUNK_DIR_NAMES = new Set([
  ".git",
  "node_modules",
  "__pycache__",
  ".venv",
  "venv",
  "dist",
  "build",
  "target",
  ".idea",
  ".vscode",
  ".cursor",
  "coverage",
]);

const JUNK_FILE_NAMES = new Set([".ds_store", "thumbs.db", "desktop.ini"]);

const isTauri = (): boolean =>
  typeof window !== "undefined" && Boolean((window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);

export const isApexExportFolderName = (name: string): boolean => name.toLowerCase() === "apex";

export const isRootApexExportSql = (name: string, depth: number): boolean =>
  depth === 0 && /^f\d+\.sql$/i.test(name);

export const isJunkEntry = (name: string, kind: "dir" | "file"): boolean => {
  const lower = name.toLowerCase();
  if (kind === "dir") {
    return JUNK_DIR_NAMES.has(lower);
  }
  return JUNK_FILE_NAMES.has(lower) || lower.endsWith(".pyc") || lower.endsWith(".pyo");
};

export const joinPath = (root: string, ...parts: string[]): string => {
  const normalizedRoot = root.replace(/[\\/]+$/, "");
  const sep = root.includes("\\") ? "\\" : "/";
  return [normalizedRoot, ...parts].join(sep);
};

export const pickDirectory = async (): Promise<string | null> => {
  if (!isTauri()) {
    return window.prompt("Enter project folder path")?.trim() || null;
  }
  const { open } = await import("@tauri-apps/plugin-dialog");
  const selected = await open({ directory: true, multiple: false });
  return typeof selected === "string" ? selected : null;
};

export const listDirectory = async (
  dirPath: string,
  options: Readonly<{ depth?: number; showJunk?: boolean }> = {},
): Promise<FileTreeNode[]> => {
  const depth = options.depth ?? 0;
  const showJunk = options.showJunk ?? false;
  const entries = await readDirEntries(dirPath);
  const nodes: FileTreeNode[] = [];
  for (const entry of entries) {
    const kind: "dir" | "file" = entry.isDirectory ? "dir" : "file";
    const protectedEntry =
      isApexExportFolderName(entry.name) || isRootApexExportSql(entry.name, depth);
    const junk = isJunkEntry(entry.name, kind);
    if (junk && !showJunk && !protectedEntry) {
      continue;
    }
    nodes.push({
      name: entry.name,
      path: joinPath(dirPath, entry.name),
      kind,
      protected: protectedEntry,
      junk,
    });
  }
  return nodes.sort((left, right) => {
    if (left.kind !== right.kind) {
      return left.kind === "dir" ? -1 : 1;
    }
    return left.name.localeCompare(right.name);
  });
};

export const readTextFile = async (filePath: string): Promise<string> => {
  if (!isTauri()) {
    throw new Error("Reading project files requires the Tauri desktop shell.");
  }
  const { readTextFile: read } = await import("@tauri-apps/plugin-fs");
  return read(filePath);
};

type DirEntry = Readonly<{ name: string; isDirectory: boolean }>;

const readDirEntries = async (dirPath: string): Promise<DirEntry[]> => {
  if (!isTauri()) {
    return [];
  }
  const { readDir } = await import("@tauri-apps/plugin-fs");
  const entries = await readDir(dirPath);
  return entries.map((entry) => ({
    name: entry.name,
    isDirectory: Boolean(entry.isDirectory),
  }));
};
