import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ApexBrowser } from "./ApexBrowser";
import { STUB_BADGE, STUB_PRIMARY_COPY } from "./stubConvention";

describe("ApexBrowser", () => {
  it("shows honest Stub empty state when no mappings exist", () => {
    render(<ApexBrowser mappings={[]} onOpenApex={() => undefined} />);

    const browser = screen.getByLabelText("APEX browser");
    expect(browser).toBeInTheDocument();
    expect(screen.getByTestId("stub-badge")).toHaveTextContent(STUB_BADGE);
    expect(screen.getByText(STUB_PRIMARY_COPY)).toBeInTheDocument();
    expect(screen.queryByLabelText("APEX workspaces")).not.toBeInTheDocument();
  });

  it("lists mapped workspaces and opens them on click", () => {
    const onOpenApex = vi.fn();
    render(
      <ApexBrowser
        mappings={[
          { workspace_name: "HR_WS", sqlcl_connection_name: "dev" },
          { workspace_name: "SALES_WS", sqlcl_connection_name: "prod" },
        ]}
        onOpenApex={onOpenApex}
      />,
    );

    expect(screen.getByLabelText("APEX workspaces")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /HR_WS/i }));
    expect(onOpenApex).toHaveBeenCalledWith({
      workspaceName: "HR_WS",
      connectionName: "dev",
    });
  });
});
