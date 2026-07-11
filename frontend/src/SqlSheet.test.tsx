import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { SqlSheet } from "./SqlSheet";

const backendConfig = {
  baseUrl: "http://127.0.0.1:8000",
  bearerToken: "test-token",
};

const renderSheet = (
  overrides: Partial<{
    connectedConnection: string | null;
    workingSchema: string;
    isBackendOnline: boolean;
    skipDestructivePrompt: boolean;
  }> = {},
) => {
  const onDirtyChange = vi.fn();
  const onActivityRefresh = vi.fn().mockResolvedValue(undefined);
  render(
    <SqlSheet
      backendConfig={backendConfig}
      connectedConnection={overrides.connectedConnection ?? "dev"}
      workingSchema={overrides.workingSchema ?? "HR"}
      isBackendOnline={overrides.isBackendOnline ?? true}
      skipDestructivePrompt={overrides.skipDestructivePrompt ?? false}
      dirty={false}
      onDirtyChange={onDirtyChange}
      onActivityRefresh={onActivityRefresh}
    />,
  );
  return { onDirtyChange, onActivityRefresh };
};

describe("SqlSheet safety explainability", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("shows allow classification decision after a successful guarded run", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.endsWith("/sql/run")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                classification: {
                  decision: "allow",
                  access: "read_only",
                  category: "query",
                  operation: "select",
                  reasons: ["read-only select"],
                },
                connection_name: "dev",
                schema_name: "HR",
                rows: [{ DUMMY: "X" }],
                raw_text: null,
                executed: true,
              }),
            ),
          );
        }
        return Promise.resolve(new Response(JSON.stringify({})));
      }),
    );

    renderSheet();
    fireEvent.change(screen.getByLabelText("SQL"), {
      target: { value: "select * from dual" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Run" }));

    expect(await screen.findByText(/allow · select · 1 rows/i)).toBeInTheDocument();
    expect(screen.getByLabelText("SQL statement log")).toHaveTextContent(/ok/i);
  });

  it("surfaces prompt classification and requires confirm before re-run", async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url.endsWith("/sql/run")) {
        const body = JSON.parse(String(init?.body ?? "{}")) as { confirmed?: boolean };
        if (!body.confirmed) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                detail: {
                  classification: {
                    decision: "prompt",
                    access: "data_change",
                    category: "delete",
                    operation: "delete",
                    reasons: ["DELETE requires confirmation"],
                  },
                },
              }),
              { status: 409 },
            ),
          );
        }
        return Promise.resolve(
          new Response(
            JSON.stringify({
              classification: {
                decision: "prompt",
                access: "data_change",
                category: "delete",
                operation: "delete",
                reasons: ["DELETE requires confirmation"],
              },
              connection_name: "dev",
              schema_name: "HR",
              rows: [],
              raw_text: "1 row deleted",
              executed: true,
            }),
          ),
        );
      }
      return Promise.resolve(new Response(JSON.stringify({})));
    });
    vi.stubGlobal("fetch", fetchMock);

    renderSheet();
    fireEvent.change(screen.getByLabelText("SQL"), {
      target: { value: "delete from emp where 1=0" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Run" }));

    const prompt = await screen.findByRole("alertdialog", { name: "Confirm SQL" });
    expect(prompt).toHaveTextContent(/delete/i);
    expect(prompt).toHaveTextContent(/confirmation/i);
    expect(screen.getByLabelText("SQL statement log")).toHaveTextContent(/prompt/i);

    fireEvent.click(screen.getByRole("button", { name: "Confirm and run" }));
    await waitFor(() => {
      expect(screen.queryByRole("alertdialog", { name: "Confirm SQL" })).not.toBeInTheDocument();
    });
    expect(screen.getByText(/prompt · delete · 0 rows/i)).toBeInTheDocument();

    const runBodies = fetchMock.mock.calls
      .filter(([url]) => typeof url === "string" && url.endsWith("/sql/run"))
      .map(([, init]) => JSON.parse(String(init?.body ?? "{}")) as { confirmed?: boolean });
    expect(runBodies).toHaveLength(2);
    expect(runBodies[0]?.confirmed).toBe(false);
    expect(runBodies[1]?.confirmed).toBe(true);
  });

  it("records blocked classification outcomes from the guarded façade", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.endsWith("/sql/run")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                detail: "DROP is blocked by safety policy",
              }),
              { status: 403 },
            ),
          );
        }
        return Promise.resolve(new Response(JSON.stringify({})));
      }),
    );

    renderSheet();
    fireEvent.change(screen.getByLabelText("SQL"), {
      target: { value: "drop table emp" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Run" }));

    await waitFor(() => {
      expect(screen.getByLabelText("SQL statement log")).toHaveTextContent(/blocked/i);
    });
    expect(screen.getByLabelText("SQL statement log")).toHaveTextContent(/blocked by safety/i);
  });

  it("runs only through the existing /sql/run guarded façade", async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url.endsWith("/sql/run")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              classification: {
                decision: "allow",
                access: "read_only",
                category: "query",
                operation: "select",
                reasons: [],
              },
              connection_name: "dev",
              schema_name: "HR",
              rows: [],
              raw_text: null,
              executed: true,
            }),
          ),
        );
      }
      return Promise.resolve(new Response(JSON.stringify({})));
    });
    vi.stubGlobal("fetch", fetchMock);

    renderSheet();
    fireEvent.click(screen.getByRole("button", { name: "Run" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });

    const urls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(urls.every((url) => url.endsWith("/sql/run"))).toBe(true);
    expect(urls.some((url) => /sqlcl|jdbc|oracledb|direct/i.test(url))).toBe(false);
  });
});
