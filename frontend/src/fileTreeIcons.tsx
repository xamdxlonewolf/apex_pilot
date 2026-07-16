import type { ReactNode } from "react";

/** Subtle Spec-token file-type glyphs for the Explorer file tree. */

export type FileTreeIconKind = "folder" | "folder-open" | "sql" | "package" | "code" | "generic";

const PACKAGE_EXTENSIONS = new Set([
  "pks",
  "pkb",
  "pls",
  "plb",
  "pck",
  "spc",
  "bdy",
  "tps",
  "tpb",
]);

const CODE_EXTENSIONS = new Set([
  "js",
  "jsx",
  "mjs",
  "cjs",
  "ts",
  "tsx",
  "py",
  "css",
  "scss",
  "less",
  "html",
  "htm",
  "json",
  "md",
  "rs",
  "go",
  "java",
  "kt",
  "swift",
  "c",
  "cpp",
  "h",
  "hpp",
  "cs",
  "rb",
  "php",
  "sh",
  "ps1",
  "yaml",
  "yml",
  "toml",
  "xml",
]);

const extensionOf = (name: string): string => {
  const base = name.includes("/") ? (name.split("/").pop() ?? name) : name;
  const dot = base.lastIndexOf(".");
  if (dot <= 0 || dot === base.length - 1) {
    return "";
  }
  return base.slice(dot + 1).toLowerCase();
};

/** Map a tree node to a calm icon family (folder / SQL / package / code / generic). */
export const resolveFileTreeIconKind = (
  name: string,
  kind: "dir" | "file",
  expanded = false,
): FileTreeIconKind => {
  if (kind === "dir") {
    return expanded ? "folder-open" : "folder";
  }
  const ext = extensionOf(name);
  if (ext === "sql") {
    return "sql";
  }
  if (PACKAGE_EXTENSIONS.has(ext)) {
    return "package";
  }
  if (CODE_EXTENSIONS.has(ext)) {
    return "code";
  }
  return "generic";
};

type FileTreeIconProps = Readonly<{
  kind: FileTreeIconKind;
}>;

const SvgShell = ({ children }: Readonly<{ children: ReactNode }>) => (
  <svg
    className="file-tree-icon-svg"
    viewBox="0 0 16 16"
    width="14"
    height="14"
    aria-hidden="true"
    focusable="false"
  >
    {children}
  </svg>
);

/** Compact outline glyphs — color comes from CSS kind modifiers. */
export const FileTreeIcon = ({ kind }: FileTreeIconProps) => {
  let glyph: ReactNode;
  switch (kind) {
    case "folder":
      glyph = (
        <SvgShell>
          <path
            fill="currentColor"
            d="M2.5 3.5h4l1.2 1.2H13.5A.5.5 0 0 1 14 5.2v6.3a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5v-7.5a.5.5 0 0 1 .5-.5Z"
            opacity="0.92"
          />
        </SvgShell>
      );
      break;
    case "folder-open":
      glyph = (
        <SvgShell>
          <path
            fill="currentColor"
            d="M1.8 4.2h4.1l1 1H11a.6.6 0 0 1 .6.6v.4H4.1a1 1 0 0 0-.95.7L1.7 12.4V4.8a.6.6 0 0 1 .6-.6Zm1.55 3h10.1a.6.6 0 0 1 .57.8l-1.3 4a.6.6 0 0 1-.57.4H3.05a.6.6 0 0 1-.57-.8l1.3-4a.6.6 0 0 1 .57-.4Z"
            opacity="0.92"
          />
        </SvgShell>
      );
      break;
    case "sql":
      glyph = (
        <SvgShell>
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="1.25"
            d="M3 2.75h7.5L13 5.25v8a.75.75 0 0 1-.75.75H3.75A.75.75 0 0 1 3 13.25v-9.5A.75.75 0 0 1 3.75 2.75Z"
          />
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="1.1"
            strokeLinecap="round"
            d="M5.2 8.2h5.6M5.2 10.4h3.8"
          />
        </SvgShell>
      );
      break;
    case "package":
      glyph = (
        <SvgShell>
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="1.25"
            d="M3.2 5.2 8 2.7l4.8 2.5v5.6L8 13.3 3.2 10.8Z"
          />
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="1.1"
            d="M8 2.7v10.6M3.2 5.2 8 7.7l4.8-2.5"
          />
        </SvgShell>
      );
      break;
    case "code":
      glyph = (
        <SvgShell>
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="1.35"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5.4 4.6 2.8 8l2.6 3.4M10.6 4.6 13.2 8l-2.6 3.4M9.1 4.2 6.9 11.8"
          />
        </SvgShell>
      );
      break;
    default:
      glyph = (
        <SvgShell>
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="1.25"
            d="M4 2.75h5.2L12 5.55v7.7a.75.75 0 0 1-.75.75H4.75A.75.75 0 0 1 4 13.25v-9.75A.75.75 0 0 1 4.75 2.75Z"
          />
        </SvgShell>
      );
  }

  return (
    <span className={`file-tree-icon file-tree-icon--${kind}`} aria-hidden="true">
      {glyph}
    </span>
  );
};
