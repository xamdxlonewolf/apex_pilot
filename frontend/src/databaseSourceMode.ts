import { isApexExportFolderName, isRootApexExportSql } from "./projectFs";

export type DatabaseSourceDocumentHint =
  | "combined_package"
  | "combined_type"
  | "package_spec"
  | "package_body"
  | "type_spec"
  | "type_body"
  | "procedure"
  | "function"
  | "trigger"
  | "unknown"
  | null;

export type DetectDatabaseSourceModeInput = Readonly<{
  path?: string | null;
  explicitAttach?: boolean;
  parsedUnitTypes?: readonly string[] | null;
  readOnly?: boolean;
}>;

export type DetectDatabaseSourceModeResult = Readonly<{
  mode: "sql" | "database-source";
  suggestedSaveExtension: string | null;
  documentHint: DatabaseSourceDocumentHint;
  readOnly: boolean;
  reason: string;
}>;

const AUTO_DATABASE_SOURCE_SUFFIXES: Readonly<
  Record<string, Exclude<DatabaseSourceDocumentHint, null | "unknown">>
> = {
  ".pkg": "combined_package",
  ".pks": "package_spec",
  ".pkb": "package_body",
  ".typ": "combined_type",
  ".tps": "type_spec",
  ".tpb": "type_body",
  ".prc": "procedure",
  ".fnc": "function",
  ".trg": "trigger",
};

const SAVE_EXTENSION_BY_HINT: Readonly<
  Record<Exclude<DatabaseSourceDocumentHint, null | "unknown">, string>
> = {
  combined_package: ".pkg",
  combined_type: ".typ",
  package_spec: ".pks",
  package_body: ".pkb",
  type_spec: ".tps",
  type_body: ".tpb",
  procedure: ".prc",
  function: ".fnc",
  trigger: ".trg",
};

/** Return the preferred suffix when saving a Database Source Document. */
export const suggestedDatabaseSourceExtension = (
  documentHint: DatabaseSourceDocumentHint,
): string | null =>
  documentHint && documentHint !== "unknown"
    ? SAVE_EXTENSION_BY_HINT[documentHint]
    : null;

const parsedDocumentHint = (
  parsedUnitTypes: readonly string[] | null | undefined,
): Exclude<DatabaseSourceDocumentHint, null | "unknown"> | undefined => {
  const unitTypes = new Set(
    parsedUnitTypes?.map((unitType) =>
      unitType
        .trim()
        .toUpperCase()
        .replace(/[\s-]+/g, "_"),
    ) ?? [],
  );

  if (unitTypes.has("PACKAGE") && unitTypes.has("PACKAGE_BODY")) {
    return "combined_package";
  }
  if (unitTypes.has("TYPE") && unitTypes.has("TYPE_BODY")) {
    return "combined_type";
  }
  if (unitTypes.has("PACKAGE_BODY")) return "package_body";
  if (unitTypes.has("PACKAGE") || unitTypes.has("PACKAGE_SPEC")) return "package_spec";
  if (unitTypes.has("TYPE_BODY")) return "type_body";
  if (unitTypes.has("TYPE") || unitTypes.has("TYPE_SPEC")) return "type_spec";
  if (unitTypes.has("PROCEDURE")) return "procedure";
  if (unitTypes.has("FUNCTION")) return "function";
  if (unitTypes.has("TRIGGER")) return "trigger";
  return undefined;
};

const isProtectedApexExportPath = (path: string | null | undefined): boolean => {
  if (!path) return false;

  const segments = path.replace(/\\/g, "/").split("/").filter(Boolean);
  const fileName = segments.at(-1);
  if (!fileName) return false;

  return (
    isRootApexExportSql(fileName, segments.length - 1) ||
    segments.slice(0, -1).some(isApexExportFolderName)
  );
};

export const detectDatabaseSourceMode = (
  input: DetectDatabaseSourceModeInput,
): DetectDatabaseSourceModeResult => {
  const protectedApexExport = input.readOnly || isProtectedApexExportPath(input.path);
  if (protectedApexExport) {
    return {
      mode: "sql",
      suggestedSaveExtension: null,
      documentHint: null,
      readOnly: true,
      reason: "protected-apex-export",
    };
  }

  const suffix = input.path?.match(/\.[^.\\/]+$/)?.[0].toLowerCase();
  const suffixHint =
    suffix === ".pck"
      ? "combined_package"
      : suffix
        ? AUTO_DATABASE_SOURCE_SUFFIXES[suffix]
        : undefined;
  const parsedHint = parsedDocumentHint(input.parsedUnitTypes);
  const isDatabaseSource = Boolean(suffixHint || input.explicitAttach);
  const documentHint = isDatabaseSource ? (parsedHint ?? suffixHint ?? "unknown") : null;

  return {
    mode: isDatabaseSource ? "database-source" : "sql",
    suggestedSaveExtension: suggestedDatabaseSourceExtension(documentHint),
    documentHint,
    readOnly: false,
    reason:
      isDatabaseSource && parsedHint
        ? "parsed-unit-type"
        : suffixHint
          ? "database-source-suffix"
          : input.explicitAttach
            ? "explicit-attach"
            : "ordinary-sql",
  };
};
