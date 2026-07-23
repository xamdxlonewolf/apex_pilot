import { createRef } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DatabaseSourceSheet, type DatabaseSourceSheetHandle } from "./DatabaseSourceSheet";
import type { DatabaseSourceTarget } from "./databaseSourceState";

const target: DatabaseSourceTarget = {
  connectionProfileId: "profile-1",
  workingSchema: "HR",
  owner: "HR",
  objectTypes: ["PACKAGE"],
  name: "ORDER_API",
};
const backendConfig = { baseUrl: "http://localhost:8000", bearerToken: "test" };

const compareDiffering = {
  exists: true,
  identical: false,
  local_fingerprints: [
    {
      owner: "HR",
      name: "ORDER_API",
      unit_type: "PACKAGE",
      digest: "local",
      exists: true,
      status: null,
    },
  ],
  database_fingerprints: [
    {
      owner: "HR",
      name: "ORDER_API",
      unit_type: "PACKAGE",
      digest: "database",
      exists: true,
      status: "VALID",
    },
  ],
  local_source: "create package order_api as end;",
  database_source: "create package order_api as procedure p; end;\n/\n",
};

const matchingParse = {
  kind: "single",
  units: [
    {
      owner: "HR",
      name: "ORDER_API",
      unit_type: "PACKAGE",
      start_line: 1,
      end_line: 1,
      ddl_text: "create package order_api as end;",
    },
  ],
  diagnostics: [],
};

const succeededCompile = {
  outcome: "succeeded",
  units: [
    {
      owner: "HR",
      name: "ORDER_API",
      unit_type: "PACKAGE",
      executed: true,
      status: "VALID",
      fingerprint: {
        owner: "HR",
        name: "ORDER_API",
        unit_type: "PACKAGE",
        digest: "after",
        exists: true,
        status: "VALID",
      },
      diagnostics: [],
      error: null,
    },
  ],
  diagnostics: [],
  confirmation: null,
  invalid_dependents: [],
  schema_ddl_outside_editor_transaction: true,
  message: null,
  requires_reconcile: false,
};

const renderSheet = (overrides: Partial<ComponentProps<typeof DatabaseSourceSheet>> = {}) => {
  const onSave = vi.fn().mockResolvedValue(true);
  return {
    onSave,
    ...render(
      <DatabaseSourceSheet
        documentId="test"
        backendConfig={backendConfig}
        target={target}
        savedText="create package order_api as end;"
        attachmentState="attached"
        globalConnectionProfileId="profile-1"
        globalWorkingSchema="HR"
        connectionProfileLabel="HR Dev"
        interactiveConnected
        onSave={onSave}
        {...overrides}
      />,
    ),
  };
};

afterEach(() => vi.unstubAllGlobals());

describe("DatabaseSourceSheet", () => {
  it("keeps its attachment target when global context changes", async () => {
    renderSheet({ globalWorkingSchema: "OTHER", globalConnectionProfileId: "other" });
    await waitFor(() => expect(screen.getByText("Global context differs")).toBeInTheDocument());
    expect(screen.getByText("Target: HR.ORDER_API")).toBeInTheDocument();
  });

  it("shows Connection Profile identity in sticky target chrome", () => {
    renderSheet();
    expect(screen.getByText("Connection Profile: HR Dev")).toBeInTheDocument();
    expect(screen.queryByText(/Connection Profile: dev\b/)).not.toBeInTheDocument();
  });

  it("uses Attach & Compile for an unconnected source document", () => {
    renderSheet({ attachmentState: "unconnected", connectionProfileLabel: null, target: { ...target, connectionProfileId: null } });
    expect(screen.getByRole("button", { name: "Attach & Compile" })).toBeInTheDocument();
    expect(screen.getByText("Connection Profile: Unconnected")).toBeInTheDocument();
  });

  it("offers Close to back out of an unconnected document", () => {
    const onCloseDocument = vi.fn();
    renderSheet({
      attachmentState: "unconnected",
      connectionProfileLabel: null,
      target: { ...target, connectionProfileId: null },
      onCloseDocument,
    });
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onCloseDocument).toHaveBeenCalled();
  });

  it("shows confirmation, compare panes, and reload after stale conflicts", async () => {
    vi.stubGlobal("fetch", vi.fn((url: string) => {
      if (url.endsWith("/interactive/source/parse")) {
        return Promise.resolve(new Response(JSON.stringify(matchingParse)));
      }
      if (url.endsWith("/interactive/source/compare")) {
        return Promise.resolve(new Response(JSON.stringify(compareDiffering)));
      }
      return Promise.resolve(new Response(JSON.stringify({
        detail: {
          confirmation: {
            reason: "force",
            message: "Force requires confirmation.",
            stale_conflicts: [{ owner: "HR", name: "ORDER_API", unit_type: "PACKAGE" }],
          },
        },
      }), { status: 409 }));
    }));
    renderSheet();
    fireEvent.click(screen.getByRole("button", { name: "Force" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Confirm database source action" });
    expect(dialog).toHaveTextContent("Stale: HR.ORDER_API");
    expect(await screen.findByLabelText("Source compare result")).toHaveTextContent("differs");
    expect(screen.getByRole("button", { name: "Reload from database" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Keep local (merge baselines)" })).toBeInTheDocument();
  });

  it("reconciles after unknown DDL 503 without silent rebinding", async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url.endsWith("/interactive/source/parse")) {
        return Promise.resolve(new Response(JSON.stringify(matchingParse)));
      }
      if (url.endsWith("/interactive/source/compile")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              detail: {
                outcome: "unknown",
                units: [],
                diagnostics: [],
                confirmation: null,
                invalid_dependents: [],
                schema_ddl_outside_editor_transaction: true,
                message: "Network lost during DDL.",
                requires_reconcile: true,
              },
            }),
            { status: 503 },
          ),
        );
      }
      if (url.endsWith("/interactive/source/reconcile")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              fingerprints: [
                {
                  owner: "HR",
                  name: "ORDER_API",
                  unit_type: "PACKAGE",
                  digest: "db",
                  exists: true,
                  status: "VALID",
                  source_text: "create package order_api as end;\n",
                },
              ],
            }),
          ),
        );
      }
      if (url.endsWith("/interactive/source/compare")) {
        return Promise.resolve(new Response(JSON.stringify({
          ...compareDiffering,
          identical: true,
          database_source: "create package order_api as end;\n/\n",
          database_fingerprints: [{ ...compareDiffering.database_fingerprints[0], digest: "local" }],
        })));
      }
      return Promise.resolve(new Response("{}", { status: 404 }));
    });
    vi.stubGlobal("fetch", fetchMock);
    renderSheet();
    fireEvent.click(screen.getByRole("button", { name: "Compile" }));
    expect(await screen.findByText(/Reconcile required/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reconcile" }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/interactive/source/reconcile"),
        expect.any(Object),
      ),
    );
    expect(screen.getByText("Connection Profile: HR Dev")).toBeInTheDocument();
    expect(screen.getByText("Target: HR.ORDER_API")).toBeInTheDocument();
  });

  it("sends errors to Problems without treating warnings as errors", async () => {
    const onDiagnostics = vi.fn();
    vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve(new Response(JSON.stringify(
      url.endsWith("/parse")
        ? matchingParse
        : { outcome: "failed", diagnostics: [{ severity: "error", message: "PLS-00103", line: 2 }], units: [], confirmation: null, invalid_dependents: [], schema_ddl_outside_editor_transaction: false, message: null, requires_reconcile: false },
    )))));
    renderSheet({ onDiagnostics });
    fireEvent.click(screen.getByRole("button", { name: "Compile" }));
    await waitFor(() => expect(onDiagnostics).toHaveBeenLastCalledWith(
      expect.arrayContaining([expect.objectContaining({ message: "PLS-00103" })]),
      expect.any(Array),
      true,
    ));
  });

  it("removes writable compile actions for protected documents", () => {
    renderSheet({ readOnly: true });
    expect(screen.queryByRole("button", { name: "Compile" })).not.toBeInTheDocument();
    expect(screen.getByText("Read-only")).toBeInTheDocument();
  });

  it("blocks compile and offers Attach as New Target when parsed identity differs", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.endsWith("/interactive/source/parse")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                kind: "single",
                units: [
                  {
                    owner: "OTHER",
                    name: "OTHER_API",
                    unit_type: "PACKAGE",
                    start_line: 1,
                    end_line: 1,
                    ddl_text: "create package other_api as end;",
                  },
                ],
                diagnostics: [],
              }),
            ),
          );
        }
        return Promise.resolve(new Response("{}", { status: 500 }));
      }),
    );
    renderSheet();
    fireEvent.click(screen.getByRole("button", { name: "Compile" }));
    expect(await screen.findByRole("button", { name: "Attach as New Target" })).toBeInTheDocument();
    expect(screen.getByText(/differs from the sticky target/i)).toBeInTheDocument();
  });

  it("compiles the current buffer without saving", async () => {
    const onSave = vi.fn().mockResolvedValue(true);
    const fetchMock = vi.fn((url: string) => {
      if (url.endsWith("/interactive/source/parse")) {
        return Promise.resolve(new Response(JSON.stringify(matchingParse)));
      }
      if (url.endsWith("/interactive/source/compile")) {
        return Promise.resolve(new Response(JSON.stringify(succeededCompile)));
      }
      return Promise.resolve(new Response("{}", { status: 404 }));
    });
    vi.stubGlobal("fetch", fetchMock);

    renderSheet({ onSave });
    fireEvent.click(screen.getByRole("button", { name: "Compile" }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/interactive/source/compile"),
        expect.any(Object),
      ),
    );
    expect(onSave).not.toHaveBeenCalled();
  });

  it("keeps the editor open after a partial compile", async () => {
    const combinedParse = {
      kind: "combined_package",
      units: [
        matchingParse.units[0],
        {
          owner: "HR",
          name: "ORDER_API",
          unit_type: "PACKAGE BODY",
          start_line: 2,
          end_line: 4,
          ddl_text: "create package body order_api as begin null; end;",
        },
      ],
      diagnostics: [],
    };
    const fetchMock = vi.fn((url: string) => {
      if (url.endsWith("/interactive/source/parse")) {
        return Promise.resolve(new Response(JSON.stringify(combinedParse)));
      }
      if (url.endsWith("/interactive/source/compile")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              ...succeededCompile,
              outcome: "partial",
              units: [
                {
                  ...succeededCompile.units[0],
                  status: "VALID",
                },
                {
                  owner: "HR",
                  name: "ORDER_API",
                  unit_type: "PACKAGE BODY",
                  executed: true,
                  status: "INVALID",
                  fingerprint: null,
                  diagnostics: [{ severity: "error", message: "body failed", line: 10 }],
                  error: "body failed",
                },
              ],
              diagnostics: [{ severity: "error", message: "body failed", line: 10 }],
            }),
          ),
        );
      }
      return Promise.resolve(new Response("{}", { status: 404 }));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <DatabaseSourceSheet
        ref={createRef<DatabaseSourceSheetHandle>()}
        documentId="test"
        backendConfig={backendConfig}
        target={{ ...target, objectTypes: ["PACKAGE", "PACKAGE_BODY"] }}
        savedText="create package order_api as end;"
        attachmentState="attached"
        globalConnectionProfileId="profile-1"
        globalWorkingSchema="HR"
        connectionProfileLabel="HR Dev"
        interactiveConnected
        onSave={vi.fn().mockResolvedValue(true)}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Compile" }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/interactive/source/compile"),
        expect.any(Object),
      ),
    );

    expect(screen.getByRole("button", { name: "Compile" })).toBeInTheDocument();
    expect(screen.getByLabelText("Database Source Document")).toBeInTheDocument();
  });
});
