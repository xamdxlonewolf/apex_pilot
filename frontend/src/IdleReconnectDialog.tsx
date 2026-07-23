import { DialogChrome } from "./DialogChrome";

type IdleReconnectDialogProps = Readonly<{
  open: boolean;
  mode: "warning" | "disconnected" | "dead";
  profileName: string | null;
  secondsRemaining: number | null;
  autoReconnect: boolean;
  onAutoReconnectChange: (value: boolean) => void;
  busy: boolean;
  onKeepConnected: () => void;
  onReconnect: () => void;
  onDismiss: () => void;
}>;

/**
 * Honest idle / death reconnect prompt (ADR-0008).
 * Cancel/dismiss leaves Unconnected until manual reconnect from Context Bar.
 */
export const IdleReconnectDialog = ({
  open,
  mode,
  profileName,
  secondsRemaining,
  autoReconnect,
  onAutoReconnectChange,
  busy,
  onKeepConnected,
  onReconnect,
  onDismiss,
}: IdleReconnectDialogProps) => {
  if (!open) {
    return null;
  }

  const target = profileName?.trim() || "interactive Connection Profile";
  const title =
    mode === "warning"
      ? "Interactive connection idle"
      : mode === "dead"
        ? "Interactive connection lost"
        : "Interactive connection disconnected";
  const description =
    mode === "warning"
      ? `${target} will disconnect in ${Math.max(0, Math.ceil(secondsRemaining ?? 0))} seconds due to application idle policy.`
      : mode === "dead"
        ? `${target} is dead. Reconnect validates the profile and Working Schema; uncertain writes are never replayed.`
        : `${target} was disconnected after application idle. Reconnect when you are ready — cancel stays Unconnected.`;

  return (
    <div className="shell-dialog-backdrop" role="presentation">
      <div onClick={(event) => event.stopPropagation()}>
        <DialogChrome
          title={title}
          description={description}
          aria-label={title}
          onClose={onDismiss}
          secondaryAction={
            <button type="button" className="chrome-button" onClick={onDismiss} disabled={busy}>
              {mode === "warning" ? "Disconnect now" : "Dismiss"}
            </button>
          }
          primaryAction={
            mode === "warning" ? (
              <button type="button" className="chrome-button" onClick={onKeepConnected} disabled={busy}>
                Keep connected
              </button>
            ) : (
              <button type="button" className="chrome-button" onClick={onReconnect} disabled={busy}>
                {busy ? "Reconnecting…" : "Reconnect"}
              </button>
            )
          }
        >
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={autoReconnect}
              onChange={(event) => onAutoReconnectChange(event.target.checked)}
              disabled={busy}
            />
            Auto-reconnect after idle disconnect (before the next safe action)
          </label>
          <p className="pane-muted">
            Backend, SQLcl process, and interactive Connection Profile states stay independent. A
            running SQLcl process is not a connected interactive session.
          </p>
        </DialogChrome>
      </div>
    </div>
  );
};
