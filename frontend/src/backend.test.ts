import { checkBackendHealth } from "./backend";

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
