import { describe, expect, it } from "vitest";

import { DISCONNECTED_INTERACTIVE_STATUS } from "./backend";
import { interactiveHealthLabel } from "./shellHealth";

describe("interactiveHealthLabel", () => {
  it("reports disconnected honestly when the pool is closed", () => {
    expect(interactiveHealthLabel(DISCONNECTED_INTERACTIVE_STATUS)).toEqual({
      label: "Interactive: Disconnected",
      tone: "idle",
    });
  });

  it("shows the profile display name when connected", () => {
    expect(
      interactiveHealthLabel({
        ...DISCONNECTED_INTERACTIVE_STATUS,
        state: "connected",
        profile_id: "profile-hr",
        display_name: "HR Dev",
      }),
    ).toEqual({
      label: "Interactive: HR Dev",
      tone: "ok",
    });
  });

  it("marks dead and reconnecting distinctly", () => {
    expect(
      interactiveHealthLabel({ ...DISCONNECTED_INTERACTIVE_STATUS, state: "dead" }).tone,
    ).toBe("bad");
    expect(
      interactiveHealthLabel({ ...DISCONNECTED_INTERACTIVE_STATUS, state: "reconnecting" }),
    ).toEqual({
      label: "Interactive: Reconnecting…",
      tone: "warn",
    });
  });
});
