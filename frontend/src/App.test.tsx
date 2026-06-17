import { render, screen } from "@testing-library/react";

import { App } from "./App";

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
  });

  it("loads saved connections when the backend is online", async () => {
    vi.stubGlobal("__APEX_PILOT__", {
      baseUrl: "http://127.0.0.1:8000",
      bearerToken: "test-token",
    });
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
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
    expect(screen.getByText("No MCP tool activity yet.")).toBeInTheDocument();
  });
});
