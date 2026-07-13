import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MissionPeerHeader } from "./MissionPeerHeader";
import { workspaceVisualPrimacy } from "./focusMode";

describe("MissionPeerHeader", () => {
  it("keeps Mission title without Review meta in Agent mode", () => {
    const cues = workspaceVisualPrimacy("agent");
    render(<MissionPeerHeader showReviewMeta={cues.missionReviewMeta} />);
    expect(screen.getByText("Mission")).toBeInTheDocument();
    expect(screen.queryByTestId("mission-review-meta")).not.toBeInTheDocument();
  });

  it("shows quiet Review meta under Mission in Review mode", () => {
    const cues = workspaceVisualPrimacy("review");
    render(<MissionPeerHeader showReviewMeta={cues.missionReviewMeta} />);
    expect(screen.getByText("Mission")).toBeInTheDocument();
    expect(screen.getByTestId("mission-review-meta")).toHaveTextContent("Review");
  });
});
