import {
  checkBackendHealth,
  compareDatabaseSource,
  compileDatabaseSource,
  connectInteractivePool,
  connectSavedConnection,
  createProject,
  describeSavedConnection,
  fetchDatabaseSource,
  getPreflight,
  getSchemaSummary,
  listActivity,
  listSavedConnections,
  parseDatabaseSource,
  reconcileDatabaseSource,
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
      if (url.endsWith("/connections/dev/describe")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              name: "dev",
              username: "HR",
              connect_string: "localhost:1521/FREEPDB1",
            }),
          ),
        );
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
    await expect(describeSavedConnection("dev", config)).resolves.toEqual({
      name: "dev",
      username: "HR",
      connect_string: "localhost:1521/FREEPDB1",
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
    const fetchMock = vi.fn((url: string, init?: RequestInit) => { void init;
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

  it("posts interactive pool connect body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          state: "connected",
          profile_id: "dev",
          display_name: "Development",
          dedicated_pinned: 0,
          dedicated_limit: 5,
          pool_min: 1,
          pool_max: 6,
          has_session_password: true,
          working_schema: "HR",
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const config = { baseUrl: "http://127.0.0.1:8000/", bearerToken: "test-token" };
    await expect(
      connectInteractivePool(
        {
          profile_id: "dev",
          display_name: "Development",
          username: "hr",
          dsn: "localhost:1521/FREEPDB1",
          password: "secret",
          working_schema: "HR",
        },
        config,
      ),
    ).resolves.toMatchObject({
      state: "connected",
      profile_id: "dev",
      has_session_password: true,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/interactive/connect",
      expect.objectContaining({ method: "POST" }),
    );
    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(requestInit.body))).toEqual({
      profile_id: "dev",
      display_name: "Development",
      username: "hr",
      dsn: "localhost:1521/FREEPDB1",
      password: "secret",
      working_schema: "HR",
    });
  });
});

describe("database source API helpers", () => {
  const config = { baseUrl: "http://127.0.0.1:8000/", bearerToken: "test-token" };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("parses source with the expected source constraints", async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => { void init;
      if (url.endsWith("/interactive/source/parse")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              kind: "parsed",
              units: [],
              diagnostics: [],
            }),
          ),
        );
      }
      return Promise.resolve(new Response("{}", { status: 404 }));
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      parseDatabaseSource(
        {
          source_text: "create procedure demo as begin null; end;",
          expected_owner: "APP",
          expected_name: "DEMO",
          expected_unit_types: ["PROCEDURE"],
        },
        config,
      ),
    ).resolves.toMatchObject({ kind: "parsed", units: [] });

    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://127.0.0.1:8000/interactive/source/parse");
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(request.method).toBe("POST");
    expect((request.headers as Headers).get("Authorization")).toBe("Bearer test-token");
    expect(JSON.parse(request.body as string)).toEqual({
      source_text: "create procedure demo as begin null; end;",
      expected_owner: "APP",
      expected_name: "DEMO",
      expected_unit_types: ["PROCEDURE"],
    });
  });

  it("fetches a combined source document with its working schema", async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => { void init;
      if (url.endsWith("/interactive/source/fetch")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              kind: "fetched",
              owner: "APP",
              name: "DEMO",
              unit_types: ["PACKAGE", "PACKAGE BODY"],
              source_text: "create package demo as end;",
              fingerprints: [],
              working_schema: "APP",
            }),
          ),
        );
      }
      return Promise.resolve(new Response("{}", { status: 404 }));
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchDatabaseSource(
        {
          owner: "APP",
          name: "DEMO",
          unit_type: "PACKAGE",
          combined: true,
          working_schema: "APP",
        },
        config,
      ),
    ).resolves.toMatchObject({ name: "DEMO", unit_types: ["PACKAGE", "PACKAGE BODY"] });

    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://127.0.0.1:8000/interactive/source/fetch");
    expect(request.method).toBe("POST");
    expect((request.headers as Headers).get("Authorization")).toBe("Bearer test-token");
    expect(JSON.parse(request.body as string)).toEqual({
      owner: "APP",
      name: "DEMO",
      unit_type: "PACKAGE",
      combined: true,
      working_schema: "APP",
    });
  });

  it("compares source against the database", async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => { void init;
      if (url.endsWith("/interactive/source/compare")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              exists: true,
              identical: false,
              local_fingerprints: [],
              database_fingerprints: [],
              local_source: "local",
              database_source: "database",
            }),
          ),
        );
      }
      return Promise.resolve(new Response("{}", { status: 404 }));
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      compareDatabaseSource(
        {
          source_text: "create procedure demo as begin null; end;",
          owner: "APP",
          name: "DEMO",
          unit_types: ["PROCEDURE"],
        },
        config,
      ),
    ).resolves.toMatchObject({ exists: true, identical: false });

    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://127.0.0.1:8000/interactive/source/compare");
    expect(request.method).toBe("POST");
    expect((request.headers as Headers).get("Authorization")).toBe("Bearer test-token");
    expect(JSON.parse(request.body as string)).toEqual({
      source_text: "create procedure demo as begin null; end;",
      owner: "APP",
      name: "DEMO",
      unit_types: ["PROCEDURE"],
    });
  });

  it("compiles source with attachment and confirmation state", async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => { void init;
      if (url.endsWith("/interactive/source/compile")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              outcome: "succeeded",
              units: [],
              diagnostics: [],
              confirmation: null,
              invalid_dependents: [],
              schema_ddl_outside_editor_transaction: false,
              message: "Compiled.",
              requires_reconcile: false,
            }),
          ),
        );
      }
      return Promise.resolve(new Response("{}", { status: 404 }));
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      compileDatabaseSource(
        {
          source_text: "create procedure demo as begin null; end;",
          owner: "APP",
          name: "DEMO",
          unit_types: ["PROCEDURE"],
          attachment_state: "retarget_pending",
          working_schema: "APP",
          baseline_fingerprints: [
            { owner: "APP", name: "DEMO", unit_type: "PROCEDURE", digest: "before" },
          ],
          confirm_attach: true,
          confirm_retarget: true,
          confirm_force: true,
          confirm_recreate: true,
        },
        config,
      ),
    ).resolves.toMatchObject({ outcome: "succeeded", requires_reconcile: false });

    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://127.0.0.1:8000/interactive/source/compile");
    expect(request.method).toBe("POST");
    expect((request.headers as Headers).get("Authorization")).toBe("Bearer test-token");
    expect(JSON.parse(request.body as string)).toEqual({
      source_text: "create procedure demo as begin null; end;",
      owner: "APP",
      name: "DEMO",
      unit_types: ["PROCEDURE"],
      attachment_state: "retarget_pending",
      working_schema: "APP",
      baseline_fingerprints: [
        { owner: "APP", name: "DEMO", unit_type: "PROCEDURE", digest: "before" },
      ],
      confirm_attach: true,
      confirm_retarget: true,
      confirm_force: true,
      confirm_recreate: true,
    });
  });

  it("preserves source compile conflict details", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, init?: RequestInit) => { void init;
        if (url.endsWith("/interactive/source/compile")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                detail: {
                  message: "Confirmation required.",
                  confirmation: {
                    reason: "attach",
                    message: "Attach required.",
                    stale_conflicts: [],
                  },
                },
              }),
              { status: 409 },
            ),
          );
        }
        return Promise.resolve(new Response("{}", { status: 404 }));
      }),
    );

    await expect(
      compileDatabaseSource(
        {
          source_text: "create procedure demo as begin null; end;",
          owner: "APP",
          name: "DEMO",
          unit_types: ["PROCEDURE"],
          attachment_state: "unconnected",
          baseline_fingerprints: [],
        },
        config,
      ),
    ).rejects.toMatchObject({
      status: 409,
      detail: {
        message: "Confirmation required.",
        confirmation: {
          reason: "attach",
          message: "Attach required.",
          stale_conflicts: [],
        },
      },
    });
  });

  it("reconciles source fingerprints", async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => { void init;
      if (url.endsWith("/interactive/source/reconcile")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              fingerprints: [
                {
                  owner: "APP",
                  name: "DEMO",
                  unit_type: "PROCEDURE",
                  digest: "after",
                  exists: true,
                  status: "VALID",
                },
              ],
            }),
          ),
        );
      }
      return Promise.resolve(new Response("{}", { status: 404 }));
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      reconcileDatabaseSource(
        { owner: "APP", name: "DEMO", unit_types: ["PROCEDURE"] },
        config,
      ),
    ).resolves.toMatchObject({ fingerprints: [{ digest: "after" }] });

    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://127.0.0.1:8000/interactive/source/reconcile");
    expect(request.method).toBe("POST");
    expect((request.headers as Headers).get("Authorization")).toBe("Bearer test-token");
    expect(JSON.parse(request.body as string)).toEqual({
      owner: "APP",
      name: "DEMO",
      unit_types: ["PROCEDURE"],
    });
  });
});
