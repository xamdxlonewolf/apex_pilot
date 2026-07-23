import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { IdleReconnectDialog } from "./IdleReconnectDialog";

describe("IdleReconnectDialog", () => {
  it("shows keep-connected for idle warning and persists auto-reconnect toggle", () => {
    const onKeepConnected = vi.fn();
    const onAutoReconnectChange = vi.fn();

    render(
      <IdleReconnectDialog
        open
        mode="warning"
        profileName="HR Dev"
        secondsRemaining={45}
        autoReconnect={false}
        onAutoReconnectChange={onAutoReconnectChange}
        busy={false}
        onKeepConnected={onKeepConnected}
        onReconnect={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    expect(screen.getByRole("dialog", { name: /interactive connection idle/i })).toBeInTheDocument();
    expect(screen.getByText(/disconnect in 45 seconds/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: /auto-reconnect/i }));
    expect(onAutoReconnectChange).toHaveBeenCalledWith(true);
    fireEvent.click(screen.getByRole("button", { name: /keep connected/i }));
    expect(onKeepConnected).toHaveBeenCalled();
  });

  it("offers reconnect after idle disconnect and dismiss stays honest", () => {
    const onReconnect = vi.fn();
    const onDismiss = vi.fn();

    render(
      <IdleReconnectDialog
        open
        mode="disconnected"
        profileName="HR Dev"
        secondsRemaining={null}
        autoReconnect
        onAutoReconnectChange={vi.fn()}
        busy={false}
        onKeepConnected={vi.fn()}
        onReconnect={onReconnect}
        onDismiss={onDismiss}
      />,
    );

    expect(screen.getByText(/disconnected after application idle/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^reconnect$/i }));
    expect(onReconnect).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(onDismiss).toHaveBeenCalled();
  });
});
