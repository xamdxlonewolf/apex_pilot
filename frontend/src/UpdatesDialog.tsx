import { DialogChrome } from "./DialogChrome";
import { StubBadge, StubMessage } from "./StubSurface";

type UpdatesDialogProps = Readonly<{
  open: boolean;
  onClose: () => void;
}>;

/**
 * Help → Check for updates… — one multi-item Updates dialog.
 * Exact updatable inventory remains fog; rows are honest Stub placeholders.
 */
export const UpdatesDialog = ({ open, onClose }: UpdatesDialogProps) => {
  if (!open) {
    return null;
  }

  return (
    <div className="shell-dialog-backdrop" role="presentation" onClick={onClose}>
      <div onClick={(event) => event.stopPropagation()}>
        <DialogChrome
          title="Updates"
          description="Check for updates across Apex Pilot components."
          aria-label="Updates"
          onClose={onClose}
          banner={
            <div className="shell-dialog-banner" data-testid="stub-chrome">
              <StubBadge />
            </div>
          }
          primaryAction={
            <button type="button" className="chrome-button" onClick={onClose}>
              Close
            </button>
          }
        >
          <ul className="updates-inventory" aria-label="Updatable components">
            <li>
              <strong>Application</strong>
              <StubMessage secondary="Update checking is not wired yet." />
            </li>
            <li>
              <strong>Oracle system skills</strong>
              <StubMessage secondary="Skill update inventory is not implemented yet." />
            </li>
          </ul>
        </DialogChrome>
      </div>
    </div>
  );
};

type AboutDialogProps = Readonly<{
  open: boolean;
  onClose: () => void;
}>;

export const AboutDialog = ({ open, onClose }: AboutDialogProps) => {
  if (!open) {
    return null;
  }

  return (
    <div className="shell-dialog-backdrop" role="presentation" onClick={onClose}>
      <div onClick={(event) => event.stopPropagation()}>
        <DialogChrome
          title="About Apex Pilot"
          description="Local-first Oracle development automation."
          aria-label="About Apex Pilot"
          onClose={onClose}
          primaryAction={
            <button type="button" className="chrome-button" onClick={onClose}>
              Close
            </button>
          }
        >
          <p className="pane-muted">Version 0.1.0</p>
        </DialogChrome>
      </div>
    </div>
  );
};
