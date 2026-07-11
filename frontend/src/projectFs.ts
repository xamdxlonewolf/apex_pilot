/** Project file tree helpers with Tauri FS and browser fallbacks. */

export type FileTreeNode = Readonly<{
  name: string;
  path: string;
  kind: "dir" | "file";
  protected: boolean;
  junk: boolean;
}>;

/** In-memory directory listing used when Tauri FS is unavailable (Vite/jsdom tests). */
export type BrowserFsEntry = Readonly<{
  name: string;
  kind: "dir" | "file";
}>;

export type BrowserProjectFs = Readonly<{
  list: (dirPath: string) => Promise<ReadonlyArray<BrowserFsEntry>> | ReadonlyArray<BrowserFsEntry>;
  readText?: (filePath: string) => Promise<string> | string;
}>;

const JUNK_DIR_NAMES = new Set([
  ".git",
  "node_modules",
  "__pycache__",
  ".pytest_cache",
  ".venv",
  "venv",
  ".cache",
  ".next",
  ".nuxt",
  ".svelte-kit",
  ".parcel-cache",
  ".turbo",
  ".output",
  "dist",
  "build",
  "out",
  "target",
  "tmp",
  "temp",
  ".idea",
  ".vscode",
  ".cursor",
  "coverage",
]);

const JUNK_FILE_NAMES = new Set([".ds_store", "thumbs.db", "desktop.ini"]);

let browserProjectFs: BrowserProjectFs | null = null;

const isTauri = (): boolean =>
  typeof window !== "undefined" &&
  Boolean((window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);

/** Install a browser/jsdom filesystem adapter for Vite-only Explorer tests. */
export const installBrowserProjectFs = (adapter: BrowserProjectFs | null): void => {
  browserProjectFs = adapter;
};

/** Test helper: clear the browser FS adapter between cases. */
export const resetBrowserProjectFsForTests = (): void => {
  browserProjectFs = null;
};

export const isApexExportFolderName = (name: string): boolean => name.toLowerCase() === "apex";

export const isRootApexExportSql = (name: string, depth: number): boolean =>
  depth === 0 && /^f\d+\.sql$/i.test(name);

export const isJunkEntry = (name: string, kind: "dir" | "file"): boolean => {
  const dotClutter = name.startsWith(".") && name !== "." && name !== "..";
  const lower = name.toLowerCase();
  if (kind === "dir") {
    return dotClutter || JUNK_DIR_NAMES.has(lower);
  }
  return (
    dotClutter ||
    JUNK_FILE_NAMES.has(lower) ||
    lower.endsWith(".pyc") ||
    lower.endsWith(".pyo")
  );
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
    if (browserProjectFs?.readText) {
      return await browserProjectFs.readText(filePath);
    }
    throw new Error("Reading project files requires the Tauri desktop shell.");
  }
  try {
    const { readTextFile: read } = await import("@tauri-apps/plugin-fs");
    return await read(filePath);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not read file (${filePath}): ${detail}`, {
      cause: error,
    });
  }
};

type DirEntry = Readonly<{ name: string; isDirectory: boolean }>;

const readDirEntries = async (dirPath: string): Promise<DirEntry[]> => {
  if (!isTauri()) {
    if (!browserProjectFs) {
      return [];
    }
    const entries = await browserProjectFs.list(dirPath);
    return entries.map((entry) => ({
      name: entry.name,
      isDirectory: entry.kind === "dir",
    }));
  }
  const { readDir } = await import("@tauri-apps/plugin-fs");
  const entries = await readDir(dirPath);
  return entries.map((entry) => ({
    name: entry.name,
    isDirectory: Boolean(entry.isDirectory),
  }));
};

/** Build a simple path→children map adapter for browser/jsdom Explorer tests. */
export const browserFsFromTree = (
  tree: Readonly<Record<string, ReadonlyArray<BrowserFsEntry>>>,
  files: Readonly<Record<string, string>> = {},
): BrowserProjectFs => ({
  list: (dirPath) => tree[dirPath] ?? [],
  readText: (filePath) => {
    if (filePath in files) {
      return files[filePath];
    }
    throw new Error(`Missing browser fixture file: ${filePath}`);
  },
});
