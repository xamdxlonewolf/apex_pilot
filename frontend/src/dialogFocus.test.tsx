import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { AboutDialog } from "./UpdatesDialog";
import { CommandPalette } from "./CommandPalette";
import { DialogChrome } from "./DialogChrome";
import { getFocusableElements } from "./dialogFocus";

describe("dialog focus trap + restore", () => {
  it("lists focusable controls in document order and skips disabled", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <button type="button" disabled>Off</button>
      <button type="button">One</button>
      <input type="text" />
      <button type="button" tabindex="-1">Skip</button>
      <a href="#x">Link</a>
    `;
    document.body.appendChild(root);
    const focusable = getFocusableElements(root);
    expect(focusable.map((el) => el.textContent || el.tagName)).toEqual([
      "One",
      "INPUT",
      "Link",
    ]);
    root.remove();
  });

  it("moves focus into DialogChrome, traps Tab, Escapes, and restores invoker", async () => {
    const onClose = vi.fn();
    const Host = () => {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Open dialog
          </button>
          {open ? (
            <DialogChrome
              title="Focus demo"
              onClose={() => {
                onClose();
                setOpen(false);
              }}
              secondaryAction={
                <button type="button" data-testid="secondary">
                  Cancel
                </button>
              }
              primaryAction={
                <button type="button" data-testid="primary">
                  Save
                </button>
              }
            >
              <input data-testid="field" aria-label="Name" />
            </DialogChrome>
          ) : null}
        </>
      );
    };

    render(<Host />);
    const invoker = screen.getByRole("button", { name: "Open dialog" });
    invoker.focus();
    expect(invoker).toHaveFocus();

    fireEvent.click(invoker);
    const field = await screen.findByTestId("field");
    await waitFor(() => expect(field).toHaveFocus());

    fireEvent.keyDown(document, { key: "Tab" });
    expect(screen.getByTestId("secondary")).toHaveFocus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(screen.getByTestId("primary")).toHaveFocus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(field).toHaveFocus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(screen.getByTestId("primary")).toHaveFocus();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(invoker).toHaveFocus());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("About dialog focuses Close and restores the invoker on Escape", async () => {
    const Host = () => {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            About
          </button>
          <AboutDialog open={open} onClose={() => setOpen(false)} />
        </>
      );
    };

    render(<Host />);
    const invoker = screen.getByRole("button", { name: "About" });
    invoker.focus();
    fireEvent.click(invoker);

    const close = await screen.findByRole("button", { name: "Close" });
    await waitFor(() => expect(close).toHaveFocus());

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(invoker).toHaveFocus());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("Command Palette focuses the search input and restores the invoker on close", async () => {
    const Host = () => {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Palette
          </button>
          <CommandPalette
            open={open}
            onClose={() => setOpen(false)}
            actions={[
              {
                id: "noop",
                label: "Noop",
                run: () => undefined,
              },
            ]}
          />
        </>
      );
    };

    render(<Host />);
    const invoker = screen.getByRole("button", { name: "Palette" });
    invoker.focus();
    fireEvent.click(invoker);

    const input = await screen.findByTestId("command-palette-input");
    await waitFor(() => expect(input).toHaveFocus());

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(invoker).toHaveFocus());
    expect(screen.queryByTestId("command-palette")).not.toBeInTheDocument();
  });
});
