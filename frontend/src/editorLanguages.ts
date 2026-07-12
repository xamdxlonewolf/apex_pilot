/** Map project file paths to Monaco language ids. */

const EXTENSION_LANGUAGE: Readonly<Record<string, string>> = {
  ".sql": "sql",
  ".pls": "sql",
  ".plb": "sql",
  ".pck": "sql",
  ".pks": "sql",
  ".pkb": "sql",
  ".tpb": "sql",
  ".tps": "sql",
  ".fnc": "sql",
  ".prc": "sql",
  ".trg": "sql",
  ".vw": "sql",
  ".js": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".jsx": "javascript",
  ".ts": "typescript",
  ".mts": "typescript",
  ".cts": "typescript",
  ".tsx": "typescript",
  ".py": "python",
  ".pyw": "python",
  ".css": "css",
  ".scss": "scss",
  ".less": "less",
  ".html": "html",
  ".htm": "html",
  ".json": "json",
  ".md": "markdown",
  ".markdown": "markdown",
  ".xml": "xml",
  ".xsd": "xml",
  ".xsl": "xml",
  ".xslt": "xml",
  ".yaml": "yaml",
  ".yml": "yaml",
  ".sh": "shell",
  ".bash": "shell",
  ".ps1": "powershell",
  ".rs": "rust",
  ".go": "go",
  ".java": "java",
  ".kt": "kotlin",
  ".cs": "csharp",
  ".cpp": "cpp",
  ".cc": "cpp",
  ".cxx": "cpp",
  ".h": "cpp",
  ".hpp": "cpp",
  ".c": "c",
  ".rb": "ruby",
  ".php": "php",
  ".r": "r",
  ".toml": "ini",
  ".ini": "ini",
  ".cfg": "ini",
  ".conf": "ini",
  ".dockerfile": "dockerfile",
  ".graphql": "graphql",
  ".gql": "graphql",
};

/** Return a Monaco language id for a file path (fallback: plaintext). */
export const languageFromPath = (filePath: string | undefined | null): string => {
  if (!filePath) {
    return "plaintext";
  }
  const base = filePath.replace(/\\/g, "/").split("/").pop() ?? filePath;
  const lower = base.toLowerCase();
  if (lower === "dockerfile") {
    return "dockerfile";
  }
  const dot = lower.lastIndexOf(".");
  if (dot < 0) {
    return "plaintext";
  }
  return EXTENSION_LANGUAGE[lower.slice(dot)] ?? "plaintext";
};
