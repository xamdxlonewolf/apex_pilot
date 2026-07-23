import type { SourceDiagnostic } from "./backend";

export type DatabaseSourceMarker = Readonly<{
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
  message: string;
  severity: "error" | "warning" | "info";
}>;

export type DatabaseSourceProblem = Readonly<{
  severity: SourceDiagnostic["severity"];
  message: string;
  line: number | null;
  column: number | null;
  source: string;
}>;

export const mapDatabaseSourceDiagnostics = (
  diagnostics: readonly SourceDiagnostic[],
): Readonly<{
  markers: DatabaseSourceMarker[];
  problems: DatabaseSourceProblem[];
  oracleMessages: string[];
}> => ({
  markers: diagnostics.map((diagnostic) => {
    const line = diagnostic.line && diagnostic.line > 0 ? diagnostic.line : 1;
    const column = diagnostic.column && diagnostic.column > 0 ? diagnostic.column : 1;
    return {
      startLineNumber: line,
      startColumn: column,
      endLineNumber: line,
      endColumn: column + 1,
      message: diagnostic.message,
      severity: diagnostic.severity,
    };
  }),
  problems: diagnostics.map((diagnostic) => ({
    severity: diagnostic.severity,
    message: diagnostic.message,
    line: diagnostic.line ?? null,
    column: diagnostic.column ?? null,
    source: [diagnostic.unit_type, diagnostic.unit_name].filter(Boolean).join(" ") || "Oracle",
  })),
  oracleMessages: diagnostics.map((diagnostic) => {
    const position = diagnostic.line ? ` line ${diagnostic.line}` : "";
    return `${diagnostic.severity.toUpperCase()}${position}: ${diagnostic.message}`;
  }),
});

export const hasErrorDiagnostics = (diagnostics: readonly SourceDiagnostic[]): boolean =>
  diagnostics.some((diagnostic) => diagnostic.severity === "error");
