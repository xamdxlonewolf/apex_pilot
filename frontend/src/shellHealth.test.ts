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

  it("surfaces idle warning and idle disconnect honestly", () => {
    expect(
      interactiveHealthLabel({
        ...DISCONNECTED_INTERACTIVE_STATUS,
        state: "connected",
        display_name: "HR Dev",
        idle_warning: true,
        seconds_until_idle_disconnect: 42.2,
      }),
    ).toEqual({
      label: "Interactive: HR Dev · idle warning (43s)",
      tone: "warn",
    });
    expect(
      interactiveHealthLabel({
        ...DISCONNECTED_INTERACTIVE_STATUS,
        state: "disconnected",
        display_name: "HR Dev",
        disconnect_reason: "app_idle",
      }),
    ).toEqual({
      label: "Interactive: HR Dev · disconnected (idle)",
      tone: "warn",
    });
  });
});
