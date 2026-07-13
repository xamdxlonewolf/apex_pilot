import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SchemaBrowser } from "./SchemaBrowser";

const backendConfig = { baseUrl: "http://127.0.0.1:8000", bearerToken: "test" };

describe("SchemaBrowser connect copy (M3)", () => {
  it("does not tell an already-connected user to Connect", () => {
    render(
      <SchemaBrowser
        backendConfig={backendConfig}
        connectedConnection="dev"
        isBackendOnline={false}
        projectSchemaOverride={null}
        workingSchema="APP"
        onWorkingSchemaChange={() => undefined}
        onActivityRefresh={async () => undefined}
      />,
    );

    expect(screen.getByText(/connected to dev/i)).toBeInTheDocument();
    expect(screen.queryByText(/connect, then load/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/use connect in the strip/i)).not.toBeInTheDocument();
  });

  it("points disconnected users at Product Header Connect", () => {
    const { rerender } = render(
      <SchemaBrowser
        backendConfig={backendConfig}
        connectedConnection="dev"
        isBackendOnline={false}
        projectSchemaOverride={null}
        workingSchema=""
        onWorkingSchemaChange={() => undefined}
        onActivityRefresh={async () => undefined}
      />,
    );

    rerender(
      <SchemaBrowser
        backendConfig={backendConfig}
        connectedConnection={null}
        isBackendOnline={false}
        projectSchemaOverride={null}
        workingSchema=""
        onWorkingSchemaChange={() => undefined}
        onActivityRefresh={async () => undefined}
      />,
    );

    expect(screen.getByText(/use connect in the product header/i)).toBeInTheDocument();
  });
});
