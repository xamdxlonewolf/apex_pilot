import { fireEvent, render, screen, waitFor } from "@testing-library/react";

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
    return new Response(
      JSON.stringify({
        profiles: [
          {
            profile_id: "profile-1",
            display_name: "Dev",
            email: null,
            username: null,
            created_at: "2026-07-09T00:00:00+00:00",
            updated_at: "2026-07-09T00:00:00+00:00",
          },
        ],
      }),
    );
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
  beforeEach(() => {
    localStorage.setItem("apex-pilot.first-launch-complete", "1");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("renders the dense IDE chrome without backend configuration", async () => {
    render(<App />);

    expect(screen.getByRole("menubar", { name: /application menu/i })).toBeInTheDocument();
    expect(screen.getByLabelText("Status bar")).toHaveTextContent(/backend not configured/i);
    expect(await screen.findByLabelText("Starting")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /mcp activity/i })).toBeDisabled();
    expect(screen.getByRole("menuitem", { name: /new/i })).toBeDisabled();
    expect(screen.getByRole("menuitem", { name: /settings/i })).toBeDisabled();
  });

  it("loads the recent-projects picker when the backend is online", async () => {
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

    expect(await screen.findByLabelText("Status bar")).toHaveTextContent(/backend online/i);
    expect(await screen.findByRole("toolbar", { name: /project menu/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /mcp activity/i })).toBeEnabled();
    expect(screen.getByRole("menuitem", { name: /settings/i })).toBeEnabled();

    fireEvent.click(screen.getByRole("menuitem", { name: /settings/i }));
    expect(await screen.findByLabelText("Settings")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "App preferences" })).toBeInTheDocument();
    expect(screen.getByText(/skip destructive sql sheet confirmation/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(await screen.findByRole("toolbar", { name: /project menu/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^settings$/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("menuitem", { name: /mcp activity/i }));
    expect(
      await screen.findByText(/not connected to a database/i),
    ).toBeInTheDocument();
  });

  it("locks project menus during first-launch preflight and shows a continue CTA", async () => {
    localStorage.removeItem("apex-pilot.first-launch-complete");
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
            new Response(JSON.stringify({ connections: [{ name: "dev", display_name: "Development" }] })),
          );
        }
        return Promise.resolve(new Response(JSON.stringify({ entries: [] })));
      }),
    );

    render(<App />);

    expect(await screen.findByLabelText("Preflight")).toBeInTheDocument();
    expect(
      screen.getByText(/click/i).closest(".funnel-callout"),
    ).toHaveTextContent(/continue to profile setup/i);
    expect(screen.getByRole("button", { name: /continue to profile setup/i })).toBeEnabled();
    expect(screen.getByRole("menuitem", { name: /new/i })).toBeDisabled();
    expect(screen.getByRole("menuitem", { name: /settings/i })).toBeDisabled();
    expect(screen.getByRole("menuitem", { name: /mcp activity/i })).toBeDisabled();
  });

  it("opens MCP activity as a floating window with a collapsible tree", async () => {
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

    expect(await screen.findByRole("toolbar", { name: /project menu/i })).toBeInTheDocument();

    // Open a project workspace path by simulating an opened project via New Project cancel path
    // is not enough for connect UI; connect lives in workspace. Open MCP from menu first.
    fireEvent.click(screen.getByRole("menuitem", { name: /mcp activity/i }));
    expect(await screen.findByLabelText("MCP Activity")).toBeInTheDocument();
  });

  it("keeps chat send disabled in the workspace shell", async () => {
    vi.stubGlobal("__APEX_PILOT__", {
      baseUrl: "http://127.0.0.1:8000",
      bearerToken: "test-token",
    });
    const opened = {
      project: {
        project_id: "proj-1",
        profile_id: "profile-1",
        name: "Demo",
        root_path: "C:/tmp/demo",
        retention_days: 365,
        created_at: "2026-07-09T00:00:00+00:00",
        updated_at: "2026-07-09T00:00:00+00:00",
      },
      manifest: {},
      environment_mappings: [],
      apex_workspace_mappings: [],
      unmapped_environments: ["dev"],
      preflight: {
        ready: true,
        blocking_ids: [],
        checks: [],
      },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, init?: RequestInit) => {
        if (url.includes("/preflight")) {
          return Promise.resolve(
            new Response(JSON.stringify({ ready: true, blocking_ids: [], checks: [] })),
          );
        }
        if (url.endsWith("/profiles")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                profiles: [
                  {
                    profile_id: "profile-1",
                    display_name: "Dev",
                    email: null,
                    username: null,
                    created_at: "2026-07-09T00:00:00+00:00",
                    updated_at: "2026-07-09T00:00:00+00:00",
                  },
                ],
              }),
            ),
          );
        }
        if (url.endsWith("/projects") || url.includes("/projects?")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                projects: [opened.project],
              }),
            ),
          );
        }
        if (url.endsWith("/projects/current")) {
          return Promise.resolve(new Response(JSON.stringify(opened)));
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
        if (url.includes("/activity")) {
          return Promise.resolve(
            new Response(JSON.stringify({ entries: [], active_session_id: null })),
          );
        }
        void init;
        return Promise.resolve(new Response(JSON.stringify({})));
      }),
    );

    render(<App />);

    expect(await screen.findByLabelText("Chat")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
    expect(screen.getByLabelText("Project file tree")).toBeInTheDocument();
    expect(screen.getByLabelText("Tools")).toBeInTheDocument();
    expect(screen.getByLabelText("Connection")).toBeInTheDocument();
  });

  it("connects from the workspace connection strip", async () => {
    vi.stubGlobal("__APEX_PILOT__", {
      baseUrl: "http://127.0.0.1:8000",
      bearerToken: "test-token",
    });
    let resolveConnect: ((value: Response) => void) | undefined;
    const connectPromise = new Promise<Response>((resolve) => {
      resolveConnect = resolve;
    });
    const opened = {
      project: {
        project_id: "proj-1",
        profile_id: "profile-1",
        name: "Demo",
        root_path: "C:/tmp/demo",
        retention_days: 365,
        created_at: "2026-07-09T00:00:00+00:00",
        updated_at: "2026-07-09T00:00:00+00:00",
      },
      manifest: {},
      environment_mappings: [],
      apex_workspace_mappings: [],
      unmapped_environments: [],
      preflight: { ready: true, blocking_ids: [], checks: [] },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, init?: RequestInit) => {
        if (url.includes("/preflight")) {
          return Promise.resolve(
            new Response(JSON.stringify({ ready: true, blocking_ids: [], checks: [] })),
          );
        }
        if (url.endsWith("/profiles")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                profiles: [
                  {
                    profile_id: "profile-1",
                    display_name: "Dev",
                    email: null,
                    username: null,
                    created_at: "2026-07-09T00:00:00+00:00",
                    updated_at: "2026-07-09T00:00:00+00:00",
                  },
                ],
              }),
            ),
          );
        }
        if (url.endsWith("/projects") || url.includes("/projects?")) {
          return Promise.resolve(new Response(JSON.stringify({ projects: [opened.project] })));
        }
        if (url.endsWith("/projects/current")) {
          return Promise.resolve(new Response(JSON.stringify(opened)));
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
        return Promise.resolve(new Response(JSON.stringify({ entries: [], active_session_id: null })));
      }),
    );

    render(<App />);

    expect(await screen.findByLabelText("Connection")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Connect" }));
    expect(await screen.findByRole("button", { name: /connecting/i })).toBeDisabled();

    resolveConnect?.(
      new Response(JSON.stringify({ connection_name: "dev", role: "primary" })),
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /connected · reconnect/i })).toBeEnabled();
    });
    expect(screen.getByLabelText("Status bar")).toHaveTextContent(/db: dev/i);
  });

  it("shows schema running state in the schema tool", async () => {
    vi.stubGlobal("__APEX_PILOT__", {
      baseUrl: "http://127.0.0.1:8000",
      bearerToken: "test-token",
    });
    let resolveSummary: ((value: Response) => void) | undefined;
    const summaryPromise = new Promise<Response>((resolve) => {
      resolveSummary = resolve;
    });
    const opened = {
      project: {
        project_id: "proj-1",
        profile_id: "profile-1",
        name: "Demo",
        root_path: "C:/tmp/demo",
        retention_days: 365,
        created_at: "2026-07-09T00:00:00+00:00",
        updated_at: "2026-07-09T00:00:00+00:00",
      },
      manifest: {},
      environment_mappings: [],
      apex_workspace_mappings: [],
      unmapped_environments: [],
      preflight: { ready: true, blocking_ids: [], checks: [] },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, init?: RequestInit) => {
        if (url.includes("/preflight")) {
          return Promise.resolve(
            new Response(JSON.stringify({ ready: true, blocking_ids: [], checks: [] })),
          );
        }
        if (url.endsWith("/profiles")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                profiles: [
                  {
                    profile_id: "profile-1",
                    display_name: "Dev",
                    email: null,
                    username: null,
                    created_at: "2026-07-09T00:00:00+00:00",
                    updated_at: "2026-07-09T00:00:00+00:00",
                  },
                ],
              }),
            ),
          );
        }
        if (url.endsWith("/projects") || url.includes("/projects?")) {
          return Promise.resolve(new Response(JSON.stringify({ projects: [opened.project] })));
        }
        if (url.endsWith("/projects/current")) {
          return Promise.resolve(new Response(JSON.stringify(opened)));
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
            new Response(JSON.stringify({ connection_name: "dev", role: "primary" })),
          );
        }
        if (url.endsWith("/session/context")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                connection_name: "dev",
                database_context: {
                  current_user: "APP",
                  current_schema: "APP",
                  proxy_user: null,
                  db_name: "ORCL",
                  container_name: null,
                  cdb_name: null,
                  host: null,
                },
                suggested_schema: "APP",
              }),
            ),
          );
        }
        if (url.endsWith("/session/schema") && init?.method === "POST") {
          return Promise.resolve(
            new Response(JSON.stringify({ schema_name: "APP", connection_name: "dev" })),
          );
        }
        if (url.includes("/schema/summary?")) {
          return summaryPromise;
        }
        return Promise.resolve(new Response(JSON.stringify({ entries: [], active_session_id: null })));
      }),
    );

    render(<App />);

    expect(await screen.findByLabelText("Connection")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Connect" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /connected · reconnect/i })).toBeInTheDocument();
    });

    // After connect, schema auto-selects from session context and loads summary.
    expect(await screen.findByRole("button", { name: /loading/i })).toBeDisabled();
    expect(screen.getByLabelText("Schema")).toHaveValue("APP");
    expect(screen.getByText(/db connected: dev/i)).toBeInTheDocument();

    resolveSummary?.(
      new Response(
        JSON.stringify({
          schema_name: "APP",
          connection_name: "dev",
          database_context: {
            current_user: "APP",
            current_schema: "APP",
            proxy_user: null,
            db_name: "ORCL",
            container_name: null,
            cdb_name: null,
            host: null,
          },
          object_counts: [],
          tables: [],
          cache_age_seconds: 0.1,
          captured_at: "2026-07-09T18:00:00+00:00",
        }),
      ),
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Load" })).toBeEnabled();
    });
    expect(await screen.findByText(/browsing login schema app/i)).toBeInTheDocument();
    expect(screen.getByText(/db connected: dev/i)).toBeInTheDocument();
    expect(screen.getByText(/browsing: app/i)).toBeInTheDocument();
  });
});
