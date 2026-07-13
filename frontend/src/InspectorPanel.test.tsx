import { fireEvent, render, screen, within } from "@testing-library/react";

import { InspectorPanel } from "./InspectorPanel";
import { STUB_ACTION_CLASS, STUB_BADGE, STUB_PRIMARY_COPY } from "./stubConvention";

describe("InspectorPanel", () => {
  it("renders figure stage chrome Plan → SQL Generated → Review → Execute → Complete", () => {
    render(
      <InspectorPanel
        projectName="Demo"
        connectionName="dev"
        workingSchema="HR"
      />,
    );

    const panel = screen.getByLabelText("Inspector panel");
    expect(panel).toBeInTheDocument();

    const stages = within(panel).getByLabelText("Inspector stages");
    for (const name of ["Plan", "SQL Generated", "Review", "Execute", "Complete"]) {
      expect(within(stages).getByRole("button", { name })).toBeInTheDocument();
    }

    expect(within(panel).getByRole("region", { name: "Plan stage" })).toBeInTheDocument();
    expect(within(panel).queryByRole("region", { name: "Workflow progress" })).not.toBeInTheDocument();
    expect(within(panel).queryByRole("region", { name: "Classification" })).not.toBeInTheDocument();
    expect(within(panel).queryByRole("region", { name: "Object summaries" })).not.toBeInTheDocument();
    expect(within(panel).queryByRole("region", { name: "Checklist" })).not.toBeInTheDocument();

    expect(within(panel).queryByRole("region", { name: "Mappings preferences" })).not.toBeInTheDocument();
    expect(within(panel).queryByText("Mappings")).not.toBeInTheDocument();
    expect(within(panel).queryByLabelText("Project mappings")).not.toBeInTheDocument();
  });

  it("shows honest empty stub evidence per stage and never fake plans, SQL, or success", () => {
    render(
      <InspectorPanel
        projectName="Demo"
        connectionName="dev"
        workingSchema="HR"
      />,
    );

    const panel = screen.getByLabelText("Inspector panel");
    const stages = within(panel).getByLabelText("Inspector stages");

    expect(within(panel).getAllByText(STUB_BADGE).length).toBeGreaterThan(0);
    expect(within(panel).getByText(STUB_PRIMARY_COPY)).toBeInTheDocument();
    const generateSql = within(panel).getByRole("button", { name: "Generate SQL" });
    expect(generateSql).toBeDisabled();
    expect(generateSql).toHaveClass(STUB_ACTION_CLASS);

    fireEvent.click(within(stages).getByRole("button", { name: "SQL Generated" }));
    expect(within(panel).getByRole("region", { name: "SQL Generated stage" })).toBeInTheDocument();
    expect(within(panel).queryByText(/CREATE TABLE|EMP_APPROVAL|SELECT \*/i)).not.toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Review & Approve" })).toBeDisabled();

    fireEvent.click(within(stages).getByRole("button", { name: "Review" }));
    const review = within(panel).getByRole("region", { name: "Review stage" });
    expect(review).toBeInTheDocument();
    const execute = within(review).getByRole("button", { name: "Execute" });
    expect(execute).toBeDisabled();
    expect(execute).toHaveAttribute("title", STUB_PRIMARY_COPY);

    fireEvent.click(within(stages).getByRole("button", { name: "Execute" }));
    expect(within(panel).getByRole("region", { name: "Execute stage" })).toBeInTheDocument();
    expect(within(panel).queryByText(/56%|Statement \d+ of \d+|Executing\.\.\./i)).not.toBeInTheDocument();

    fireEvent.click(within(stages).getByRole("button", { name: "Complete" }));
    const complete = within(panel).getByRole("region", { name: "Complete stage" });
    expect(complete).toBeInTheDocument();
    expect(within(complete).queryByText(/Execution Successful|1\.24s|12\/12/i)).not.toBeInTheDocument();
    expect(within(complete).getByRole("button", { name: "View Changes" })).toBeDisabled();

    expect(panel).not.toHaveTextContent(/\bGap\b/);
    expect(panel).not.toHaveTextContent(/\bDS-/);
    expect(panel).not.toHaveTextContent(/\bUI-\d+/);
    expect(panel).not.toHaveTextContent(/sample row|execution succeeded|mock timeline/i);
  });

  it("explains context without SQL edit ownership or Run controls", () => {
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
    expect(within(panel).queryByRole("button", { name: /^Send$/i })).not.toBeInTheDocument();
  });
});
