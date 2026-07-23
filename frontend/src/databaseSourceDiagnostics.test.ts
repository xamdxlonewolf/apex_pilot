import { describe, expect, it } from "vitest";

import { hasErrorDiagnostics, mapDatabaseSourceDiagnostics } from "./databaseSourceDiagnostics";

describe("database source diagnostics", () => {
  it("maps Oracle diagnostics for Monaco, Problems, and messages", () => {
    const diagnostics = [
      { severity: "error" as const, message: "PLS-00103", line: 4, column: 8, unit_name: "ORDER_API" },
      { severity: "warning" as const, message: "unused variable" },
    ];
    const mapped = mapDatabaseSourceDiagnostics(diagnostics);

    expect(mapped.markers[0]).toMatchObject({ startLineNumber: 4, startColumn: 8, severity: "error" });
    expect(mapped.problems[0]).toMatchObject({ source: "ORDER_API", line: 4 });
    expect(mapped.oracleMessages).toEqual(["ERROR line 4: PLS-00103", "WARNING: unused variable"]);
  });

  it("identifies only error diagnostics as Problems auto-focus triggers", () => {
    expect(hasErrorDiagnostics([{ severity: "warning", message: "warning" }])).toBe(false);
    expect(hasErrorDiagnostics([{ severity: "error", message: "error" }])).toBe(true);
  });
});
