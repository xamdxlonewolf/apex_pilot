import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import { App } from "./App";

const projectApiResponse = (url: string): Response | null => {
  if (url.includes("/preflight")) {
    return new Response(
      JSON.stringify({
        ready: true,
        blocking_ids: [],
        checks: [
          {
            id: "git",
            label: "Git",
            status: "ok",
            detail: "git version 2.45.0",
            guide: null,
          },
        ],
      }),
    );
  }
  if (url.endsWith("/profiles")) {
    return new Response(JSON.stringify({ profiles: [] }));
  }
  if (url.endsWith("/projects") || url.includes("/projects?")) {
    return new Response(JSON.stringify({ projects: [] }));
  }
  if (url.endsWith("/projects/current")) {
    return new Response("null", { status: 200 });
  }
  return null;
};

describe("App", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("renders the desktop shell without backend configuration", async () => {
    render(<App />);

    expect(
      screen.getByRole("heading", {
        name: /local-first oracle automation workspace/i,
      }),
    ).toBeInTheDocument();
    expect(await screen.findByText("Backend not configured")).toBeInTheDocument();
    expect(screen.getByText("Saved Connections")).toBeInTheDocument();
    expect(screen.getByRole("toolbar", { name: /project menu/i })).toBeInTheDocument();
  });

  it("loads saved connections when the backend is online", async () => {
    vi.stubGlobal("__APEX_PILOT__", {
      baseUrl: "http://127.0.0.1:8000",
      bearerToken: "test-token",
    });
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        const projectResponse = projectApiResponse(url);
        if (projectResponse) {
          return Promise.resolve(projectResponse);
        }
        if (url.endsWith("/health")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                status: "ok",
                service: "apex-pilot-backend",
                version: "0.1.0",
              }),
            ),
          );
        }
        if (url.endsWith("/connections")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                connections: [{ name: "dev", display_name: "Development" }],
              }),
            ),
          );
        }
        return Promise.resolve(new Response(JSON.stringify({ entries: [] })));
      }),
    );

    render(<App />);

    expect(await screen.findByText("Backend online")).toBeInTheDocument();
    expect(await screen.findByText("Development (dev)")).toBeInTheDocument();
    expect(screen.getByRole("toolbar", { name: /project menu/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /mcp activity/i }));
    expect(
      await screen.findByText(/not connected to a database/i),
    ).toBeInTheDocument();
  });

  it("renders MCP activity as a collapsible tree inside a scroll region", async () => {
    vi.stubGlobal("__APEX_PILOT__", {
      baseUrl: "http://127.0.0.1:8000",
      bearerToken: "test-token",
    });
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, init?: RequestInit) => {
        const projectResponse = projectApiResponse(url);
        if (projectResponse) {
          return Promise.resolve(projectResponse);
        }
        if (url.endsWith("/health")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                status: "ok",
                service: "apex-pilot-backend",
                version: "0.1.0",
              }),
            ),
          );
        }
        if (
          url.endsWith("/connections") &&
          (!init || init.method === undefined || init.method === "GET")
        ) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                connections: [{ name: "dev", display_name: "Development" }],
              }),
            ),
          );
        }
        if (url.endsWith("/connections/dev/connect") && init?.method === "POST") {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                connection_name: "dev",
                role: "primary",
              }),
            ),
          );
        }
        if (url.includes("/activity")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                entries: [
                  {
                    sequence: 1,
                    timestamp: "2026-07-09T18:00:00+00:00",
                    tool_name: "connections_list",
                    arguments: {},
                    status: "succeeded",
                    message: null,
                    connection_name: "dev",
                    session_id: "session-1",
                  },
                  {
                    sequence: 2,
                    timestamp: "2026-07-09T18:00:00.500+00:00",
                    tool_name: "connections_list",
                    arguments: { refresh: true },
                    status: "failed",
                    message: "timeout",
                    connection_name: "dev",
                    session_id: "session-1",
                  },
                  {
                    sequence: 3,
                    timestamp: "2026-07-09T18:00:01+00:00",
                    tool_name: "connect",
                    arguments: { connection_name: "dev" },
                    status: "succeeded",
                    message: null,
                    connection_name: "dev",
                    session_id: "session-2",
                  },
                ],
                active_session_id: "session-2",
              }),
            ),
          );
        }
        return Promise.resolve(
          new Response(JSON.stringify({ entries: [], active_session_id: null })),
        );
      }),
    );

    render(<App />);

    expect(await screen.findByText("Development (dev)")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Connect" }));
    expect(await screen.findByText("Connected: dev")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /mcp activity/i }));

    const tree = await screen.findByLabelText("MCP tool activity");
    expect(tree).toBeInTheDocument();
    expect(screen.getByText("Active session")).toBeInTheDocument();
    expect(screen.getByText("Previous session")).toBeInTheDocument();
    expect(screen.getByText("connect")).toBeInTheDocument();
    expect(screen.getAllByText("1 succeeded").length).toBeGreaterThan(0);
    expect(screen.getAllByText("0 failed").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByText("Previous session"));
    expect(await screen.findByText("connections_list")).toBeInTheDocument();
    expect(screen.getAllByText("1 succeeded").length).toBeGreaterThan(0);
    expect(screen.getAllByText("1 failed").length).toBeGreaterThan(0);

    const connectionsListDetails = screen.getByText("connections_list").closest("details");
    expect(connectionsListDetails).not.toBeNull();
    fireEvent.click(screen.getByText("connections_list"));
    expect(await within(connectionsListDetails as HTMLElement).findByText("Failed")).toBeInTheDocument();
    expect(within(connectionsListDetails as HTMLElement).getByText("Succeeded")).toBeInTheDocument();
    expect(within(connectionsListDetails as HTMLElement).getByText("#2")).toBeInTheDocument();

    fireEvent.click(within(connectionsListDetails as HTMLElement).getByText("Succeeded"));
    expect(await within(connectionsListDetails as HTMLElement).findByText("#1")).toBeInTheDocument();

    const connectDetails = screen.getByText("connect").closest("details");
    expect(connectDetails).not.toBeNull();
    fireEvent.click(screen.getByText("connect"));
    fireEvent.click(within(connectDetails as HTMLElement).getByText("Succeeded"));
    fireEvent.click(within(connectDetails as HTMLElement).getByText("#3"));
    expect(await screen.findByText(/"connection_name": "dev"/)).toBeVisible();
  });

  it("shows a connecting state and disables Connect while SQLcl connects", async () => {
    let resolveConnect: ((value: Response) => void) | undefined;
    const connectPromise = new Promise<Response>((resolve) => {
      resolveConnect = resolve;
    });

    vi.stubGlobal("__APEX_PILOT__", {
      baseUrl: "http://127.0.0.1:8000",
      bearerToken: "test-token",
    });
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, init?: RequestInit) => {
        const projectResponse = projectApiResponse(url);
        if (projectResponse) {
          return Promise.resolve(projectResponse);
        }
        if (url.endsWith("/health")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                status: "ok",
                service: "apex-pilot-backend",
                version: "0.1.0",
              }),
            ),
          );
        }
        if (
          url.endsWith("/connections") &&
          (!init || init.method === undefined || init.method === "GET")
        ) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                connections: [{ name: "dev", display_name: "Development" }],
              }),
            ),
          );
        }
        if (url.endsWith("/connections/dev/connect") && init?.method === "POST") {
          return connectPromise;
        }
        return Promise.resolve(new Response(JSON.stringify({ entries: [] })));
      }),
    );

    render(<App />);

    expect(await screen.findByText("Development (dev)")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Connect" }));

    expect(await screen.findByRole("button", { name: /connecting/i })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent(/connecting to dev/i);
    expect(screen.getByLabelText("Connection")).toBeDisabled();

    resolveConnect?.(
      new Response(
        JSON.stringify({
          connection_name: "dev",
          role: "primary",
        }),
      ),
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Connect" })).toBeEnabled();
    });
    expect(await screen.findByText("Connected: dev")).toBeInTheDocument();
  });

  it("shows a running state and disables Run Summary while schema summary loads", async () => {
    let resolveSummary: ((value: Response) => void) | undefined;
    const summaryPromise = new Promise<Response>((resolve) => {
      resolveSummary = resolve;
    });

    vi.stubGlobal("__APEX_PILOT__", {
      baseUrl: "http://127.0.0.1:8000",
      bearerToken: "test-token",
    });
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, init?: RequestInit) => {
        const projectResponse = projectApiResponse(url);
        if (projectResponse) {
          return Promise.resolve(projectResponse);
        }
        if (url.endsWith("/health")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                status: "ok",
                service: "apex-pilot-backend",
                version: "0.1.0",
              }),
            ),
          );
        }
        if (
          url.endsWith("/connections") &&
          (!init || init.method === undefined || init.method === "GET")
        ) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                connections: [{ name: "dev", display_name: "Development" }],
              }),
            ),
          );
        }
        if (url.endsWith("/connections/dev/connect") && init?.method === "POST") {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                connection_name: "dev",
                role: "primary",
              }),
            ),
          );
        }
        if (url.includes("/schema/summary?")) {
          return summaryPromise;
        }
        return Promise.resolve(new Response(JSON.stringify({ entries: [] })));
      }),
    );

    render(<App />);

    expect(await screen.findByText("Development (dev)")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Connect" }));
    expect(await screen.findByText("Connected: dev")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Schema"), { target: { value: "APP" } });
    fireEvent.click(screen.getByRole("button", { name: "Run Summary" }));

    expect(await screen.findByRole("button", { name: /running/i })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent(/running schema summary for app/i);
    expect(screen.getByLabelText("Schema")).toBeDisabled();

    resolveSummary?.(
      new Response(
        JSON.stringify({
          schema_name: "APP",
          connection_name: "dev",
          database_context: {
            current_user: "APP",
            db_name: "ORCL",
            container_name: null,
            cdb_name: null,
            host: null,
          },
          object_counts: [],
          tables: [],
          cache_age_seconds: 0.1,
          generated_at: "2026-07-09T18:00:00+00:00",
        }),
      ),
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Run Summary" })).toBeEnabled();
    });
    expect(await screen.findByText("Summary captured for APP.")).toBeInTheDocument();
  });
});
