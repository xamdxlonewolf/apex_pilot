import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { STUB_BADGE, STUB_PRIMARY_COPY } from "./stubConvention";
import { ConnectionWizard } from "./ConnectionWizard";
import { DialogChrome } from "./DialogChrome";
import { WizardChrome } from "./WizardChrome";
import { StartupFunnel, type WizardMode } from "./StartupFunnel";
import type { BackendConfig, SavedConnection } from "./backend";

const backendConfig: BackendConfig = {
  baseUrl: "http://127.0.0.1:8000",
  bearerToken: "test-token",
};

const connections: SavedConnection[] = [{ name: "dev", display_name: "Development" }];

const FunnelHost = ({
  initialMode = null,
  isBackendOnline = true,
}: {
  initialMode?: WizardMode | null;
  isBackendOnline?: boolean;
}) => {
  const [wizardMode, setWizardMode] = useState<WizardMode | null>(initialMode);
  return (
    <StartupFunnel
      backendConfig={backendConfig}
      isBackendOnline={isBackendOnline}
      connections={connections}
      openedProject={null}
      onOpenedProjectChange={() => undefined}
      wizardMode={wizardMode}
      onWizardModeChange={setWizardMode}
    />
  );
};

describe("Dialog and wizard chrome (#40)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    localStorage.clear();
  });
  it("renders Spec dialog layout with title, description, content, and secondary/primary footer", () => {
    render(
      <DialogChrome
        title="Open project"
        description="Choose an existing folder that already has apex-pilot.json."
        secondaryAction={<button type="button">Cancel</button>}
        primaryAction={<button type="button">Open folder</button>}
      >
        <p>Folder path field</p>
      </DialogChrome>,
    );

    const dialog = screen.getByRole("dialog", { name: "Open project" });
    expect(dialog).toHaveAttribute("data-testid", "dialog-chrome");
    expect(within(dialog).getByText(/choose an existing folder/i)).toBeInTheDocument();
    expect(within(dialog).getByText("Folder path field")).toBeInTheDocument();
    const footer = within(dialog).getByTestId("dialog-chrome-footer");
    expect(within(footer).getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(within(footer).getByRole("button", { name: "Open folder" })).toBeInTheDocument();
  });

  it("renders Spec wizard chrome with visible steps and Back/Next/Finish/Cancel navigation", () => {
    const onCancel = vi.fn();
    const onFinish = vi.fn();
    render(
      <WizardChrome
        title="New project"
        description="Create a local Apex Pilot project."
        steps={["Project Details", "Location", "Git", "Connection", "Summary"]}
        activeStepIndex={4}
        onBack={() => undefined}
        onNext={() => undefined}
        onCancel={onCancel}
        onFinish={onFinish}
        canFinish={false}
      >
        <p>Summary step body</p>
      </WizardChrome>,
    );

    const wizard = screen.getByRole("dialog", { name: "New project" });
    expect(wizard).toHaveAttribute("data-testid", "wizard-chrome");
    const steps = within(wizard).getByLabelText("Wizard steps");
    for (const name of ["Project Details", "Location", "Git", "Connection", "Summary"]) {
      expect(within(steps).getByText(name)).toBeInTheDocument();
    }
    expect(within(steps).getByText("Summary").closest("[aria-current]")).toHaveAttribute(
      "aria-current",
      "step",
    );
    expect(within(wizard).getByText("Summary step body")).toBeInTheDocument();
    expect(within(wizard).getByRole("button", { name: "Back" })).toBeEnabled();
    expect(within(wizard).queryByRole("button", { name: "Next" })).not.toBeInTheDocument();
    expect(within(wizard).getByRole("button", { name: "Finish" })).toBeDisabled();
    fireEvent.click(within(wizard).getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("keeps Connection wizard unfinished with Stub honesty and no fake success", () => {
    render(<ConnectionWizard onCancel={() => undefined} />);

    const wizard = screen.getByRole("dialog", { name: /connection/i });
    const steps = within(wizard).getByLabelText("Wizard steps");
    for (const name of [
      "Connection Type",
      "Credentials",
      "Validation",
      "Working Schema",
      "Summary",
    ]) {
      expect(within(steps).getByText(name)).toBeInTheDocument();
    }

    expect(within(wizard).getByTestId("stub-badge")).toHaveTextContent(STUB_BADGE);
    expect(within(wizard).getByText(STUB_PRIMARY_COPY)).toBeInTheDocument();
    expect(wizard).not.toHaveTextContent(/\bGap\b/);
    expect(wizard).not.toHaveTextContent(/\bDS-/);
    expect(wizard).not.toHaveTextContent(/\bUI-\d+/);
    expect(wizard).not.toHaveTextContent(/connection saved|connected successfully|test passed/i);

    for (let i = 0; i < 4; i += 1) {
      fireEvent.click(within(wizard).getByRole("button", { name: "Next" }));
    }
    const finish = within(wizard).getByRole("button", { name: "Finish" });
    expect(finish).toBeDisabled();
    expect(finish).toHaveAttribute("title", STUB_PRIMARY_COPY);
  });

  it("uses Spec wizard chrome for New project funnel and dialog chrome for Open/Clone", async () => {
    localStorage.setItem("apex-pilot.first-launch-complete", "1");
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
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
          return Promise.resolve(new Response(JSON.stringify({ projects: [] })));
        }
        return Promise.resolve(new Response(JSON.stringify({})));
      }),
    );

    const first = render(<FunnelHost initialMode="new" />);
    expect(await screen.findByTestId("wizard-chrome")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "New project" })).toBeInTheDocument();
    expect(screen.getByLabelText("Wizard steps")).toHaveTextContent(/Project Details/);
    expect(screen.getByLabelText("Wizard steps")).toHaveTextContent(/Connection/);
    first.unmount();

    const second = render(<FunnelHost initialMode="open" />);
    expect(await screen.findByTestId("dialog-chrome")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Open project" })).toBeInTheDocument();
    expect(screen.getByTestId("dialog-chrome-footer")).toBeInTheDocument();
    second.unmount();

    render(<FunnelHost initialMode="clone" />);
    expect(await screen.findByTestId("dialog-chrome")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Clone remote" })).toBeInTheDocument();
  });

  it("exposes Connection wizard chrome from the funnel and keeps offline funnel honest", async () => {
    localStorage.setItem("apex-pilot.first-launch-complete", "1");
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
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
          return Promise.resolve(new Response(JSON.stringify({ projects: [] })));
        }
        return Promise.resolve(new Response(JSON.stringify({})));
      }),
    );

    const { unmount } = render(<FunnelHost />);
    expect(await screen.findByLabelText("Recent projects")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /new connection/i }));
    const connectionWizard = await screen.findByRole("dialog", { name: /connection/i });
    expect(connectionWizard).toHaveAttribute("data-testid", "wizard-chrome");
    expect(within(connectionWizard).getByText(STUB_PRIMARY_COPY)).toBeInTheDocument();
    unmount();

    render(<FunnelHost isBackendOnline={false} />);
    const offline = screen.getByLabelText("Starting");
    expect(offline).toHaveTextContent(/waiting for the local backend/i);
    expect(offline).not.toHaveTextContent(/connected successfully|all checks passed/i);
    expect(offline.querySelector("[data-testid='stub-badge']")).toBeNull();
  });
});
