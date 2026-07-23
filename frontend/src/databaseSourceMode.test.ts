import { describe, expect, it } from "vitest";

import { detectDatabaseSourceMode, suggestedDatabaseSourceExtension } from "./databaseSourceMode";

describe("detectDatabaseSourceMode", () => {
  it("opens a .pkg file as a combined-package Database Source Document", () => {
    expect(detectDatabaseSourceMode({ path: "db/customer.pkg" })).toMatchObject({
      mode: "database-source",
      documentHint: "combined_package",
      readOnly: false,
      suggestedSaveExtension: ".pkg",
    });
  });

  it.each([
    [".pks", "package_spec", ".pks"],
    [".pkb", "package_body", ".pkb"],
    [".typ", "combined_type", ".typ"],
    [".tps", "type_spec", ".tps"],
    [".tpb", "type_body", ".tpb"],
    [".prc", "procedure", ".prc"],
    [".fnc", "function", ".fnc"],
    [".trg", "trigger", ".trg"],
  ])(
    "opens %s as a Database Source Document",
    (extension, documentHint, suggestedSaveExtension) => {
      expect(detectDatabaseSourceMode({ path: `db/source${extension}` })).toMatchObject({
        mode: "database-source",
        documentHint,
        suggestedSaveExtension,
      });
    },
  );

  it("keeps .sql ordinary until the user chooses Attach as Database Source", () => {
    expect(detectDatabaseSourceMode({ path: "scripts/migrate.sql" })).toMatchObject({
      mode: "sql",
      documentHint: null,
      suggestedSaveExtension: null,
    });
    expect(
      detectDatabaseSourceMode({
        path: "scripts/migrate.sql",
        explicitAttach: true,
      }),
    ).toMatchObject({
      mode: "database-source",
      documentHint: "unknown",
      suggestedSaveExtension: null,
    });
  });

  it("opens .pck compatibility files as Database Source Documents but saves combined packages as .pkg", () => {
    expect(detectDatabaseSourceMode({ path: "db/customer.pck" })).toMatchObject({
      mode: "database-source",
      documentHint: "combined_package",
      suggestedSaveExtension: ".pkg",
    });
    expect(suggestedDatabaseSourceExtension("combined_package")).toBe(".pkg");
  });

  it("uses parsed database unit identity over a conflicting suffix", () => {
    expect(
      detectDatabaseSourceMode({
        path: "db/customer.pks",
        parsedUnitTypes: ["PACKAGE BODY"],
      }),
    ).toMatchObject({
      mode: "database-source",
      documentHint: "package_body",
      suggestedSaveExtension: ".pkb",
      reason: "parsed-unit-type",
    });
  });

  it("does not turn ordinary SQL into a Database Source Document by content sniffing", () => {
    expect(
      detectDatabaseSourceMode({
        path: "scripts/maintenance.sql",
        parsedUnitTypes: ["PROCEDURE"],
      }),
    ).toMatchObject({
      mode: "sql",
      documentHint: null,
      suggestedSaveExtension: null,
      reason: "ordinary-sql",
    });
  });

  it.each(["f123.sql", "apex/application/customer.pkg"])(
    "treats protected APEX export path %s as read-only SQL preview",
    (path) => {
      expect(detectDatabaseSourceMode({ path })).toMatchObject({
        mode: "sql",
        documentHint: null,
        readOnly: true,
        reason: "protected-apex-export",
      });
    },
  );
});
