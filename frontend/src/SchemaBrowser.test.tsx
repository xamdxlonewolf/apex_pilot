import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DISCONNECTED_INTERACTIVE_STATUS } from "./backend";
import { SchemaBrowser } from "./SchemaBrowser";

const backendConfig = { baseUrl: "http://127.0.0.1:8000", bearerToken: "test" };

describe("SchemaBrowser connect copy (M3)", () => {
  it("does not tell an already-connected user to Connect", () => {
    render(
      <SchemaBrowser
        backendConfig={backendConfig}
        connectedConnection="dev"
        interactiveStatus={DISCONNECTED_INTERACTIVE_STATUS}
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
        interactiveStatus={DISCONNECTED_INTERACTIVE_STATUS}
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
        interactiveStatus={DISCONNECTED_INTERACTIVE_STATUS}
        isBackendOnline={false}
        projectSchemaOverride={null}
        workingSchema=""
        onWorkingSchemaChange={() => undefined}
        onActivityRefresh={async () => undefined}
      />,
    );

    expect(screen.getByText(/use connect in the product header/i)).toBeInTheDocument();
  });

  it("surfaces interactive borrow cue when the pool is connected", () => {
    render(
      <SchemaBrowser
        backendConfig={backendConfig}
        connectedConnection={null}
        interactiveStatus={{
          ...DISCONNECTED_INTERACTIVE_STATUS,
          state: "connected",
          profile_id: "profile-hr",
          display_name: "HR Dev",
        }}
        isBackendOnline
        projectSchemaOverride={null}
        workingSchema="HR"
        onWorkingSchemaChange={() => undefined}
        onActivityRefresh={async () => undefined}
      />,
    );

    expect(screen.getByText(/db connected: hr dev/i)).toBeInTheDocument();
    expect(screen.getByText(/^borrow$/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refresh" })).toBeInTheDocument();
  });
});
