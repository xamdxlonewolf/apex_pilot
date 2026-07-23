import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  InteractiveConnectDialog,
  looksLikeWalletDsn,
  readStoredInteractiveBinding,
} from "./InteractiveConnectDialog";

describe("InteractiveConnectDialog", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("connects on-prem without a wallet by default", () => {
    const onSubmit = vi.fn();

    render(
      <InteractiveConnectDialog
        open
        profileId="dev"
        displayName="Development"
        initialUsername="hr"
        initialDsn="dbhost:1521/ORCLPDB1"
        initialWorkingSchema="HR"
        busy={false}
        error={null}
        onCancel={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getByRole("dialog", { name: /connect interactive/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/use oracle wallet/i)).not.toBeChecked();
    expect(screen.queryByLabelText(/^wallet folder$/i)).not.toBeInTheDocument();
    expect(screen.getByText(/on-prem uses username, password, and easy connect/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/^database password$/i), {
      target: { value: "secret" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^connect$/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      username: "hr",
      dsn: "dbhost:1521/ORCLPDB1",
      password: "secret",
      working_schema: "HR",
      wallet_location: "",
      wallet_password: "",
      use_wallet: false,
    });

    const stored = JSON.parse(localStorage.getItem("apex-pilot.interactive-binding.v1") ?? "{}");
    expect(stored.dev).toEqual({
      username: "hr",
      dsn: "dbhost:1521/ORCLPDB1",
      use_wallet: false,
    });
    expect(JSON.stringify(stored)).not.toContain("secret");
  });

  it("requires wallet folder when wallet mode is enabled", () => {
    const onSubmit = vi.fn();

    render(
      <InteractiveConnectDialog
        open
        profileId="dev"
        displayName="Development"
        initialUsername="ADMIN"
        initialDsn="mcobbtestdb_high"
        initialWalletLocation="C:/Users/mikec/Documents/Wallet_mcobbtestdb"
        busy={false}
        error={null}
        onCancel={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getByLabelText(/use oracle wallet/i)).toBeChecked();
    expect(screen.getByLabelText(/^wallet folder$/i)).toHaveValue(
      "C:/Users/mikec/Documents/Wallet_mcobbtestdb",
    );

    fireEvent.change(screen.getByLabelText(/^database password$/i), {
      target: { value: "secret" },
    });
    fireEvent.change(screen.getByLabelText(/wallet password \(from oci download\)/i), {
      target: { value: "wallet-secret" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^connect$/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      username: "ADMIN",
      dsn: "mcobbtestdb_high",
      password: "secret",
      working_schema: "",
      wallet_location: "C:/Users/mikec/Documents/Wallet_mcobbtestdb",
      wallet_password: "wallet-secret",
      use_wallet: true,
    });
  });

  it("turns wallet mode on when an Autonomous descriptor is pasted", () => {
    render(
      <InteractiveConnectDialog
        open
        profileId="dev"
        displayName="Development"
        initialUsername="ADMIN"
        initialDsn="dbhost:1521/ORCLPDB1"
        busy={false}
        error={null}
        onCancel={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByLabelText(/use oracle wallet/i)).not.toBeChecked();
    fireEvent.change(screen.getByLabelText(/dsn \(easy connect\)/i), {
      target: {
        value:
          "(description=(address=(protocol=tcps)(port=1522)(host=adb.us-phoenix-1.oraclecloud.com)))",
      },
    });
    expect(screen.getByLabelText(/use oracle wallet/i)).toBeChecked();
    expect(screen.getByLabelText(/^wallet folder$/i)).toBeInTheDocument();
  });

  it("looksLikeWalletDsn detects Autonomous aliases and ignores on-prem Easy Connect", () => {
    expect(looksLikeWalletDsn("dbhost:1521/ORCLPDB1")).toBe(false);
    expect(looksLikeWalletDsn("mcobbtestdb_high")).toBe(true);
    expect(looksLikeWalletDsn("(description=(protocol=tcps))")).toBe(true);
  });

  it("prefers resolved initials over stored binding", () => {
    localStorage.setItem(
      "apex-pilot.interactive-binding.v1",
      JSON.stringify({
        dev: {
          username: "stored_user",
          dsn: "stored:1521/ORCL",
          use_wallet: true,
          wallet_location: "C:/stored/wallet",
        },
      }),
    );

    expect(readStoredInteractiveBinding("dev")).toEqual({
      username: "stored_user",
      dsn: "stored:1521/ORCL",
      use_wallet: true,
      wallet_location: "C:/stored/wallet",
    });

    render(
      <InteractiveConnectDialog
        open
        profileId="dev"
        displayName="Development"
        initialUsername="describe_user"
        initialDsn="describe:1521/X"
        initialWorkingSchema="APP"
        busy={false}
        error={null}
        onCancel={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByLabelText(/^username$/i)).toHaveValue("describe_user");
    expect(screen.getByLabelText(/dsn/i)).toHaveValue("describe:1521/X");
    // Stored use_wallet=true still applies when initials omit wallet path.
    expect(screen.getByLabelText(/use oracle wallet/i)).toBeChecked();
  });

  it("cancels without submitting", () => {
    const onCancel = vi.fn();
    const onSubmit = vi.fn();

    render(
      <InteractiveConnectDialog
        open
        profileId="dev"
        displayName="Development"
        busy={false}
        error={null}
        onCancel={onCancel}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
