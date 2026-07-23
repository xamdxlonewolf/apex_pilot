import { describe, expect, it } from "vitest";

import { planReconcileOutcome, summarizeCompare } from "./databaseSourceCompare";
import type { SourceCompareResult, SourceFingerprint } from "./backend";

const fp = (
  unit_type: SourceFingerprint["unit_type"],
  digest: string,
  exists = true,
): SourceFingerprint => ({
  owner: "HR",
  name: "ORDER_API",
  unit_type,
  digest,
  exists,
  status: exists ? "VALID" : null,
});

describe("databaseSourceCompare", () => {
  it("summarizes identical, differing, and missing units", () => {
    const result: SourceCompareResult = {
      exists: false,
      identical: false,
      local_fingerprints: [fp("PACKAGE", "a"), fp("PACKAGE BODY", "b")],
      database_fingerprints: [fp("PACKAGE", "a"), fp("PACKAGE BODY", "c", false)],
      local_source: "local",
      database_source: null,
    };

    const summary = summarizeCompare(result);
    expect(summary.droppedTarget).toBe(true);
    expect(summary.canReloadFromDatabase).toBe(false);
    expect(summary.rows.map((row) => row.status)).toEqual(["identical", "missing_in_database"]);
  });

  it("allows reload only when every unit exists with database source", () => {
    const result: SourceCompareResult = {
      exists: true,
      identical: false,
      local_fingerprints: [fp("PACKAGE", "a")],
      database_fingerprints: [fp("PACKAGE", "b")],
      local_source: "local",
      database_source: "create package order_api as end;\n/\n",
    };
    expect(summarizeCompare(result).canReloadFromDatabase).toBe(true);
  });

  it("plans reconcile dropped, stale, and matched outcomes", () => {
    expect(
      planReconcileOutcome(
        [{ ...fp("PACKAGE", "x", false), source_text: null }],
        "create package order_api as end;\n/\n",
      ).kind,
    ).toBe("dropped");

    expect(
      planReconcileOutcome(
        [
          {
            ...fp("PACKAGE", "db"),
            source_text: "create package order_api as end;\n",
          },
        ],
        "create package order_api as procedure p; end;\n/\n",
      ).kind,
    ).toBe("stale");

    const matchedSource = "create package order_api as end;\n/\n";
    expect(
      planReconcileOutcome(
        [{ ...fp("PACKAGE", "db"), source_text: "create package order_api as end;\n" }],
        matchedSource,
      ).kind,
    ).toBe("matched");
  });

  it("flags partial combined-unit reconcile as conflicted", () => {
    const outcome = planReconcileOutcome(
      [
        { ...fp("PACKAGE", "a"), source_text: "spec\n" },
        { ...fp("PACKAGE BODY", "b", false), source_text: null },
      ],
      "local",
    );
    expect(outcome.kind).toBe("conflicted");
    expect(outcome.baselines).toHaveLength(1);
  });
});
