import { render, screen, within } from "@testing-library/react";

import { InspectorPanel } from "./InspectorPanel";

describe("InspectorPanel", () => {
  it("renders progress, classification, summaries, and checklist chrome with Stub unfinished sections", () => {
    render(
      <InspectorPanel
        projectName="Demo"
        connectionName="dev"
        workingSchema="HR"
      />,
    );

    const panel = screen.getByLabelText("Inspector panel");
    expect(panel).toBeInTheDocument();

    const progress = within(panel).getByRole("region", { name: "Workflow progress" });
    expect(within(progress).getByText("Progress")).toBeInTheDocument();
    expect(within(progress).getByText("Stub")).toBeInTheDocument();
    expect(within(progress).getByText("Not implemented yet")).toBeInTheDocument();

    const classification = within(panel).getByRole("region", { name: "Classification" });
    expect(within(classification).getByText("Classification")).toBeInTheDocument();
    expect(within(classification).getByText("Stub")).toBeInTheDocument();

    const summaries = within(panel).getByRole("region", { name: "Object summaries" });
    expect(within(summaries).getByText("Object summaries")).toBeInTheDocument();
    expect(within(summaries).getByText("Stub")).toBeInTheDocument();

    const checklist = within(panel).getByRole("region", { name: "Checklist" });
    expect(within(checklist).getByText("Checklist")).toBeInTheDocument();
    expect(within(checklist).getByText("Stub")).toBeInTheDocument();

    expect(within(panel).queryByRole("region", { name: "Mappings preferences" })).not.toBeInTheDocument();
    expect(within(panel).queryByText("Mappings")).not.toBeInTheDocument();
    expect(within(panel).queryByLabelText("Project mappings")).not.toBeInTheDocument();

    expect(panel).not.toHaveTextContent(/\bGap\b/);
    expect(panel).not.toHaveTextContent(/\bDS-/);
    expect(panel).not.toHaveTextContent(/\bUI-\d+/);
    expect(panel).not.toHaveTextContent(/sample row|execution succeeded|mock timeline/i);
  });

  it("explains context without SQL edit ownership or Run/Execute controls", () => {
    render(
      <InspectorPanel
        projectName="Demo"
        connectionName="dev"
        workingSchema="HR"
      />,
    );

    const panel = screen.getByLabelText("Inspector panel");
    expect(within(panel).queryByLabelText("SQL sheet")).not.toBeInTheDocument();
    expect(within(panel).queryByRole("textbox", { name: /^SQL$/ })).not.toBeInTheDocument();
    expect(within(panel).queryByRole("button", { name: /^Run$/i })).not.toBeInTheDocument();
    expect(within(panel).queryByRole("button", { name: /^Execute$/i })).not.toBeInTheDocument();
    expect(within(panel).queryByRole("button", { name: /^Send$/i })).not.toBeInTheDocument();
  });
});
