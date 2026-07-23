import { useEffect, useState } from "react";

import { DialogChrome } from "./DialogChrome";

const BINDING_STORAGE_KEY = "apex-pilot.interactive-binding.v1";

type StoredBinding = Readonly<{
  username: string;
  dsn: string;
  wallet_location?: string;
  use_wallet?: boolean;
}>;

type BindingMap = Readonly<Record<string, StoredBinding>>;

export type InteractiveConnectValues = Readonly<{
  username: string;
  dsn: string;
  password: string;
  working_schema: string;
  /** Empty when connecting without a wallet (typical on-prem). */
  wallet_location: string;
  wallet_password: string;
  use_wallet: boolean;
}>;

type InteractiveConnectDialogProps = Readonly<{
  open: boolean;
  profileId: string;
  displayName: string;
  initialUsername?: string;
  initialDsn?: string;
  initialWorkingSchema?: string;
  initialWalletLocation?: string;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onSubmit: (values: InteractiveConnectValues) => void;
}>;

/** Heuristic: Autonomous / TCPS descriptors usually need a client wallet. */
export const looksLikeWalletDsn = (dsn: string): boolean => {
  const normalized = dsn.trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  return (
    normalized.includes("(protocol=tcps)") ||
    normalized.includes("adb.oraclecloud.com") ||
    normalized.includes("(description=") ||
    /^[a-z][a-z0-9_]*_(high|low|medium|tp|tpurgent)$/i.test(normalized.trim())
  );
};

const readBindings = (): BindingMap => {
  try {
    const raw = localStorage.getItem(BINDING_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as BindingMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

/** Read remembered username/DSN/wallet path for a connection profile (passwords never stored). */
export const readStoredInteractiveBinding = (profileId: string): StoredBinding | null => {
  const key = profileId.trim();
  if (!key) {
    return null;
  }
  return readBindings()[key] ?? null;
};

const persistBinding = (
  profileId: string,
  username: string,
  dsn: string,
  useWallet: boolean,
  walletLocation: string,
): void => {
  if (!profileId.trim()) {
    return;
  }
  const next: BindingMap = {
    ...readBindings(),
    [profileId]: {
      username,
      dsn,
      use_wallet: useWallet,
      ...(useWallet && walletLocation ? { wallet_location: walletLocation } : {}),
    },
  };
  localStorage.setItem(BINDING_STORAGE_KEY, JSON.stringify(next));
};

/**
 * Session-only interactive python-oracledb pool connect (ADR-0008).
 * On-prem: user / password / Easy Connect — no wallet.
 * Autonomous TCPS: optional wallet folder + TNS alias.
 */
export const InteractiveConnectDialog = ({
  open,
  profileId,
  displayName,
  initialUsername = "",
  initialDsn = "",
  initialWorkingSchema = "",
  initialWalletLocation = "",
  busy,
  error,
  onCancel,
  onSubmit,
}: InteractiveConnectDialogProps) => {
  const [username, setUsername] = useState(initialUsername);
  const [dsn, setDsn] = useState(initialDsn);
  const [password, setPassword] = useState("");
  const [workingSchema, setWorkingSchema] = useState(initialWorkingSchema);
  const [useWallet, setUseWallet] = useState(false);
  const [walletLocation, setWalletLocation] = useState(initialWalletLocation);
  const [walletPassword, setWalletPassword] = useState("");

  useEffect(() => {
    if (!open) {
      return;
    }
    const stored = readStoredInteractiveBinding(profileId);
    const nextUsername = initialUsername.trim() || stored?.username || "";
    const nextDsn = initialDsn.trim() || stored?.dsn || "";
    const nextWallet = initialWalletLocation.trim() || stored?.wallet_location?.trim() || "";
    const storedUseWallet = stored?.use_wallet;
    const nextUseWallet =
      typeof storedUseWallet === "boolean"
        ? storedUseWallet
        : Boolean(nextWallet) || looksLikeWalletDsn(nextDsn);

    setUsername(nextUsername);
    setDsn(nextDsn);
    setPassword("");
    setWorkingSchema(initialWorkingSchema);
    setUseWallet(nextUseWallet);
    setWalletLocation(nextWallet);
    setWalletPassword("");
  }, [
    open,
    profileId,
    initialUsername,
    initialDsn,
    initialWorkingSchema,
    initialWalletLocation,
  ]);

  if (!open) {
    return null;
  }

  const target = displayName.trim() || profileId.trim() || "interactive Connection Profile";
  const walletReady = !useWallet || walletLocation.trim().length > 0;
  const canSubmit =
    username.trim().length > 0 &&
    dsn.trim().length > 0 &&
    password.length > 0 &&
    walletReady &&
    !busy;

  return (
    <div className="shell-dialog-backdrop" role="presentation">
      <div onClick={(event) => event.stopPropagation()}>
        <DialogChrome
          title="Connect interactive"
          description={`Bind the interactive python-oracledb pool to ${target}. On-prem uses username, password, and Easy Connect (host:port/service) with no wallet. Autonomous / TCPS turns on the wallet option and points at an extracted wallet folder. Secrets stay in session memory only.`}
          aria-label="Connect interactive"
          onClose={onCancel}
          secondaryAction={
            <button type="button" className="chrome-button" onClick={onCancel} disabled={busy}>
              Cancel
            </button>
          }
          primaryAction={
            <button
              type="submit"
              form="interactive-connect-form"
              className="chrome-button"
              disabled={!canSubmit}
              aria-busy={busy}
            >
              {busy ? "Connecting…" : "Connect"}
            </button>
          }
        >
          <form
            id="interactive-connect-form"
            className="stack-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (!canSubmit) {
                return;
              }
              const nextUsername = username.trim();
              const nextDsn = dsn.trim();
              const nextWallet = useWallet ? walletLocation.trim() : "";
              persistBinding(profileId, nextUsername, nextDsn, useWallet, nextWallet);
              onSubmit({
                username: nextUsername,
                dsn: nextDsn,
                password,
                working_schema: workingSchema.trim(),
                wallet_location: nextWallet,
                wallet_password: useWallet ? walletPassword : "",
                use_wallet: useWallet,
              });
            }}
          >
            <label htmlFor="interactive-connect-username">
              Username
              <input
                id="interactive-connect-username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                spellCheck={false}
                disabled={busy}
                required
                placeholder="HR or ADMIN[schema]"
              />
            </label>
            <label htmlFor="interactive-connect-dsn">
              {useWallet ? "DSN / TNS alias" : "DSN (Easy Connect)"}
              <input
                id="interactive-connect-dsn"
                value={dsn}
                onChange={(event) => {
                  const next = event.target.value;
                  setDsn(next);
                  // Suggest wallet mode when the user pastes an Autonomous descriptor,
                  // but never force it on for ordinary host:port/service.
                  if (!useWallet && looksLikeWalletDsn(next)) {
                    setUseWallet(true);
                  }
                }}
                placeholder={useWallet ? "mcobbtestdb_high" : "dbhost:1521/ORCLPDB1"}
                autoComplete="off"
                spellCheck={false}
                disabled={busy}
                required
              />
            </label>
            <label className="checkbox-row" htmlFor="interactive-connect-use-wallet">
              <input
                id="interactive-connect-use-wallet"
                type="checkbox"
                checked={useWallet}
                onChange={(event) => setUseWallet(event.target.checked)}
                disabled={busy}
              />
              Use Oracle wallet (Autonomous / TCPS)
            </label>
            <p className="pane-muted">
              Leave this off for on-prem TCP connections. Turn it on for Autonomous Database mTLS
              with an extracted wallet folder (not the .zip).
            </p>
            {useWallet ? (
              <>
                <label htmlFor="interactive-connect-wallet">
                  Wallet folder
                  <input
                    id="interactive-connect-wallet"
                    value={walletLocation}
                    onChange={(event) => setWalletLocation(event.target.value)}
                    placeholder="C:\Users\…\Wallet_mcobbtestdb"
                    autoComplete="off"
                    spellCheck={false}
                    disabled={busy}
                    required
                  />
                </label>
                <p className="pane-muted">
                  Folder must contain ewallet.pem and tnsnames.ora. Prefer a TNS alias from that
                  file (for example mcobbtestdb_high) as the DSN.
                </p>
                <label htmlFor="interactive-connect-wallet-password">
                  Wallet password (from OCI download)
                  <input
                    id="interactive-connect-wallet-password"
                    type="password"
                    value={walletPassword}
                    onChange={(event) => setWalletPassword(event.target.value)}
                    autoComplete="off"
                    disabled={busy}
                    placeholder="Password set when downloading the wallet ZIP"
                  />
                </label>
                <p className="pane-muted">
                  This is not the database password. Autonomous wallets encrypt ewallet.pem with
                  the password you chose in OCI. Leave blank only if you truly created the wallet
                  with no passphrase — never enter it in the backend terminal prompt.
                </p>
              </>
            ) : null}
            <label htmlFor="interactive-connect-password">
              Database password
              <input
                id="interactive-connect-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                disabled={busy}
                required
              />
            </label>
            <label htmlFor="interactive-connect-working-schema">
              Working Schema
              <input
                id="interactive-connect-working-schema"
                value={workingSchema}
                onChange={(event) => setWorkingSchema(event.target.value)}
                placeholder="Optional"
                spellCheck={false}
                disabled={busy}
              />
            </label>
            {error ? (
              <p className="pane-muted" role="alert">
                {error}
              </p>
            ) : null}
          </form>
        </DialogChrome>
      </div>
    </div>
  );
};
