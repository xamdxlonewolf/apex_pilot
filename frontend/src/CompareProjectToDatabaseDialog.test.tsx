import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CompareProjectToDatabaseDialog } from "./CompareProjectToDatabaseDialog";
import { STUB_PRIMARY_COPY } from "./stubConvention";

describe("CompareProjectToDatabaseDialog", () => {
  it("shows honest Stub chrome without fake diffs", () => {
    const onClose = vi.fn();
    render(<CompareProjectToDatabaseDialog open onClose={onClose} />);

    expect(
      screen.getByRole("dialog", { name: /Compare project to database/i }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("stub-badge")).toBeInTheDocument();
    expect(screen.getByText(STUB_PRIMARY_COPY)).toBeInTheDocument();
    expect(screen.getByText(/No scan results/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Generate report/i })).toBeDisabled();
    expect(screen.queryByRole("listitem", { name: /EMPLOYEES|HR\./i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Close$/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it("renders nothing when closed", () => {
    const { container } = render(
      <CompareProjectToDatabaseDialog open={false} onClose={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
