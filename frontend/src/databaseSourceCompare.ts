import type { SourceCompareResult, SourceFingerprint } from "./backend";

export type UnitCompareStatus = "identical" | "differs" | "missing_in_database";

export type UnitCompareRow = Readonly<{
  unitType: string;
  owner: string;
  name: string;
  status: UnitCompareStatus;
  localDigest: string | null;
  databaseDigest: string | null;
}>;

export type CompareSummary = Readonly<{
  rows: readonly UnitCompareRow[];
  allIdentical: boolean;
  anyMissing: boolean;
  anyDiffers: boolean;
  canReloadFromDatabase: boolean;
  droppedTarget: boolean;
}>;

const unitKey = (fingerprint: Pick<SourceFingerprint, "owner" | "name" | "unit_type">): string =>
  `${fingerprint.owner}.${fingerprint.name}.${fingerprint.unit_type}`;

const joinUnitSources = (
  fingerprints: ReadonlyArray<SourceFingerprint & { source_text?: string | null }>,
): string | null => {
  if (!fingerprints.every((fingerprint) => typeof fingerprint.source_text === "string")) {
    return null;
  }
  return (
    fingerprints
      .map((fingerprint) => `${(fingerprint.source_text ?? "").replace(/\s+$/, "")}\n/`)
      .join("\n\n") + "\n"
  );
};

export function summarizeCompare(result: SourceCompareResult): CompareSummary {
  const dbByKey = new Map(
    result.database_fingerprints.map((fingerprint) => [unitKey(fingerprint), fingerprint]),
  );
  const rows: UnitCompareRow[] = result.local_fingerprints.map((local) => {
    const database = dbByKey.get(unitKey(local));
    if (!database || !database.exists) {
      return {
        unitType: local.unit_type,
        owner: local.owner,
        name: local.name,
        status: "missing_in_database",
        localDigest: local.digest,
        databaseDigest: database?.digest ?? null,
      };
    }
    if (database.digest === local.digest) {
      return {
        unitType: local.unit_type,
        owner: local.owner,
        name: local.name,
        status: "identical",
        localDigest: local.digest,
        databaseDigest: database.digest,
      };
    }
    return {
      unitType: local.unit_type,
      owner: local.owner,
      name: local.name,
      status: "differs",
      localDigest: local.digest,
      databaseDigest: database.digest,
    };
  });

  for (const database of result.database_fingerprints) {
    if (!result.local_fingerprints.some((local) => unitKey(local) === unitKey(database))) {
      rows.push({
        unitType: database.unit_type,
        owner: database.owner,
        name: database.name,
        status: database.exists ? "differs" : "missing_in_database",
        localDigest: null,
        databaseDigest: database.digest,
      });
    }
  }

  const anyMissing = rows.some((row) => row.status === "missing_in_database");
  const anyDiffers = rows.some((row) => row.status === "differs");
  const allIdentical = rows.length > 0 && rows.every((row) => row.status === "identical");

  return {
    rows,
    allIdentical: allIdentical || result.identical,
    anyMissing,
    anyDiffers,
    canReloadFromDatabase: Boolean(result.exists && result.database_source),
    droppedTarget: !result.exists || anyMissing,
  };
}

export function baselinesFromCompare(
  result: SourceCompareResult,
): ReadonlyArray<Pick<SourceFingerprint, "owner" | "name" | "unit_type" | "digest">> {
  return result.database_fingerprints
    .filter((fingerprint) => fingerprint.exists)
    .map(({ owner, name, unit_type, digest }) => ({ owner, name, unit_type, digest }));
}

export type ReconcileOutcome = Readonly<{
  kind: "matched" | "stale" | "dropped" | "conflicted";
  message: string;
  baselines: ReadonlyArray<Pick<SourceFingerprint, "owner" | "name" | "unit_type" | "digest">>;
  databaseSource: string | null;
  objectStatus: "VALID" | "INVALID" | null;
}>;

export function planReconcileOutcome(
  fingerprints: ReadonlyArray<SourceFingerprint & { source_text?: string | null }>,
  bufferText: string,
): ReconcileOutcome {
  const exists = fingerprints.filter((fingerprint) => fingerprint.exists);
  const joinedSource = joinUnitSources(exists);
  const baselines = exists.map(({ owner, name, unit_type, digest }) => ({
    owner,
    name,
    unit_type,
    digest,
  }));
  const invalid = exists.some((fingerprint) => fingerprint.status === "INVALID");
  const objectStatus: "VALID" | "INVALID" | null = invalid
    ? "INVALID"
    : exists.every((fingerprint) => fingerprint.status === "VALID")
      ? "VALID"
      : null;

  if (exists.length === 0) {
    return {
      kind: "dropped",
      message:
        "Reconcile found no target units in the database. Sticky attachment remains; recreate requires explicit confirmation.",
      baselines: [],
      databaseSource: null,
      objectStatus: null,
    };
  }

  if (exists.length < fingerprints.length) {
    return {
      kind: "conflicted",
      message:
        "Reconcile found a partial combined-unit target. Compare before Compile; dropped units require Recreate.",
      baselines,
      databaseSource: joinedSource,
      objectStatus,
    };
  }

  const stale =
    joinedSource !== null &&
    joinedSource.replace(/\r\n/g, "\n") !== bufferText.replace(/\r\n/g, "\n");

  if (stale) {
    return {
      kind: "stale",
      message:
        "Reconcile refreshed fingerprints; database source differs from the buffer. Compare before Compile.",
      baselines,
      databaseSource: joinedSource,
      objectStatus,
    };
  }

  return {
    kind: "matched",
    message: "Reconcile refreshed sticky baselines. Compile is available again.",
    baselines,
    databaseSource: joinedSource,
    objectStatus,
  };
}
