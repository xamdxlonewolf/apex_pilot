import { render, screen } from "@testing-library/react";

import { App } from "./App";

describe("App", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the placeholder desktop shell", async () => {
    render(<App />);

    expect(
      screen.getByRole("heading", {
        name: /local-first oracle automation workspace/i,
      }),
    ).toBeInTheDocument();
    expect(await screen.findByText("Backend not configured")).toBeInTheDocument();
    expect(screen.getByText("SQLcl MCP only")).toBeInTheDocument();
  });
});
