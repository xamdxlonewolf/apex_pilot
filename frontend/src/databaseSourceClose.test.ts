import { describe, expect, it } from "vitest";

import { resolveCloseDialog } from "./databaseSourceClose";
import {
  createDatabaseSourceState,
  type CreateDatabaseSourceStateInput,
} from "./databaseSourceState";

const target = {
  connectionProfileId: "dev",
  workingSchema: "HR",
  owner: "HR",
  objectTypes: ["PACKAGE"] as const,
  name: "EMPLOYEES_API",
};

type StateOverrides = Omit<Partial<CreateDatabaseSourceStateInput>, "target" | "savedText">;

function state(overrides: StateOverrides = {}) {
  return createDatabaseSourceState({
    target,
    savedText: "create package employees_api as end;",
    databaseSourceMatches: true,
    objectStatus: "VALID",
    ...overrides,
  });
}

describe("resolveCloseDialog", () => {
  it("closes immediately when saved source is clean, valid, and matches the database", () => {
    expect(resolveCloseDialog(state())).toEqual({ kind: "none", options: [] });
  });

  it("offers save, compile, discard, or cancel for dirty source not already compiled", () => {
    expect(
      resolveCloseDialog(
        state({ bufferText: "create package employees_api as procedure p; end;" }),
      ),
    ).toEqual({
      kind: "dirty-uncompiled",
      options: ["save-and-compile", "save-only", "discard", "cancel"],
    });
  });

  it("offers compile or close choices when saved source differs from the database", () => {
    expect(resolveCloseDialog(state({ databaseSourceMatches: false }))).toEqual({
      kind: "database-drift",
      options: ["compile-and-close", "close-without-compiling", "cancel"],
    });
  });

  it("warns that discard does not undo a successful compile of the unsaved buffer", () => {
    expect(
      resolveCloseDialog(
        state({
          bufferText: "create package employees_api as procedure p; end;",
          compileStatus: "succeeded",
          lastSuccessfulCompileUsedCurrentBuffer: true,
        }),
      ),
    ).toEqual({
      kind: "compiled-unsaved-buffer",
      options: ["save-and-close", "discard-local-changes-and-close", "cancel"],
      warning: "Discarding local changes does not undo the database compile.",
    });
  });

  it("offers retry or an explicit invalid close when the target remains invalid", () => {
    expect(
      resolveCloseDialog(state({ objectStatus: "INVALID", databaseSourceMatches: false })),
    ).toEqual({
      kind: "invalid-object",
      options: ["retry-compile-and-close", "close-with-invalid-object", "cancel"],
    });
  });

  it("requires explicit attachment before compile when unconnected work is pending", () => {
    expect(
      resolveCloseDialog(
        state({
          attachmentState: "unconnected",
          bufferText: "create package employees_api as procedure p; end;",
        }),
      ),
    ).toEqual({
      kind: "unconnected-pending-work",
      options: ["attach-save-and-compile", "save-only", "discard", "cancel"],
    });
  });

  it("leaves compile warnings non-blocking by default", () => {
    expect(resolveCloseDialog(state({ compileStatus: "partial" }))).toEqual({
      kind: "none",
      options: [],
      warning: "The last compile completed with warnings.",
      warningBlocksClose: false,
    });
  });

  it("can make compile warnings blocking when the user preference requires it", () => {
    expect(
      resolveCloseDialog(state({ compileStatus: "partial", blockCloseOnCompileWarnings: true })),
    ).toEqual({
      kind: "compile-warnings",
      options: ["close", "cancel"],
      warning: "The last compile completed with warnings.",
      warningBlocksClose: true,
    });
  });
});
