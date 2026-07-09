import {
  checkBackendHealth,
  connectSavedConnection,
  createProject,
  getPreflight,
  getSchemaSummary,
  listActivity,
  listSavedConnections,
} from "./backend";

describe("checkBackendHealth", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reports missing configuration when no backend URL is available", async () => {
    await expect(checkBackendHealth({})).resolves.toEqual({
      kind: "missing-config",
    });
  });

  it("checks the normalized health endpoint with an optional bearer token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: "ok",
          service: "apex-pilot-backend",
          version: "0.1.0",
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      checkBackendHealth({
        baseUrl: "http://127.0.0.1:8000/",
        bearerToken: "test-token",
      }),
    ).resolves.toEqual({
      kind: "online",
      baseUrl: "http://127.0.0.1:8000",
      health: {
        status: "ok",
        service: "apex-pilot-backend",
        version: "0.1.0",
      },
    });

    expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:8000/health", {
      headers: expect.any(Headers),
    });
    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect((requestInit.headers as Headers).get("Authorization")).toBe("Bearer test-token");
  });
});

describe("backend API helpers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends bearer-authenticated requests to vertical-slice endpoints", async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      void init;
      if (url.endsWith("/connections")) {
        return Promise.resolve(
          new Response(JSON.stringify({ connections: [{ name: "dev", display_name: null }] })),
        );
      }
      if (url.endsWith("/connections/dev/connect")) {
        return Promise.resolve(new Response(JSON.stringify({ connection_name: "dev" })));
      }
      if (url.includes("/schema/summary")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              connection_name: "dev",
              schema_name: "APP",
              captured_at: "2026-06-16T20:00:00+00:00",
              cache_age_seconds: 0,
              database_context: {
                current_user: "APP",
                db_name: "FREE",
                container_name: "FREEPDB1",
                cdb_name: "FREE",
                host: "localhost",
              },
              object_counts: [],
              tables: [],
            }),
          ),
        );
      }
      return Promise.resolve(
        new Response(JSON.stringify({ entries: [], active_session_id: null })),
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const config = { baseUrl: "http://127.0.0.1:8000/", bearerToken: "test-token" };

    await expect(listSavedConnections(config)).resolves.toEqual({
      connections: [{ name: "dev", display_name: null }],
    });
    await expect(connectSavedConnection("dev", config)).resolves.toEqual({
      connection_name: "dev",
    });
    await expect(getSchemaSummary("APP", { refresh: true, config })).resolves.toMatchObject({
      schema_name: "APP",
    });
    await expect(listActivity({ config })).resolves.toEqual({
      entries: [],
      active_session_id: null,
    });

    for (const call of fetchMock.mock.calls) {
      const requestInit = call[1] as RequestInit;
      expect((requestInit.headers as Headers).get("Authorization")).toBe("Bearer test-token");
    }
  });

  it("surfaces backend JSON error detail", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ detail: "Unknown tool: invalid_tool_name" }), {
          status: 502,
        }),
      ),
    );

    await expect(
      listSavedConnections({
        baseUrl: "http://127.0.0.1:8000",
        bearerToken: "test-token",
      }),
    ).rejects.toThrow("Unknown tool: invalid_tool_name");
  });

  it("calls project preflight and create endpoints", async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url.includes("/preflight")) {
        return Promise.resolve(
          new Response(JSON.stringify({ ready: true, blocking_ids: [], checks: [] })),
        );
      }
      if (url.endsWith("/projects")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              project: {
                project_id: "p1",
                profile_id: "u1",
                name: "Demo",
                root_path: "C:/demo",
                retention_days: 365,
                created_at: "2026-07-09T00:00:00+00:00",
                updated_at: "2026-07-09T00:00:00+00:00",
              },
              manifest: { schemaVersion: 1, name: "Demo", environments: [{ name: "dev" }] },
              environment_mappings: [],
              apex_workspace_mappings: [],
              unmapped_environments: ["dev"],
              preflight: { ready: true, blocking_ids: [], checks: [] },
            }),
          ),
        );
      }
      return Promise.resolve(new Response("{}", { status: 404 }));
    });
    vi.stubGlobal("fetch", fetchMock);

    const config = { baseUrl: "http://127.0.0.1:8000", bearerToken: "test-token" };
    await expect(getPreflight({ config })).resolves.toEqual({
      ready: true,
      blocking_ids: [],
      checks: [],
    });
    await expect(
      createProject(
        {
          profile_id: "u1",
          name: "Demo",
          root_path: "C:/demo",
        },
        config,
      ),
    ).resolves.toMatchObject({ project: { name: "Demo" } });
  });
});
