import { DialogChrome } from "./DialogChrome";
import { StubBadge, StubMessage } from "./StubSurface";

type CompareProjectToDatabaseDialogProps = Readonly<{
  open: boolean;
  onClose: () => void;
}>;

/**
 * Help → Compare project to database… — honest Stub results chrome.
 * Live scan, Diff viewer, and AI report are later; no fake diffs here.
 */
export const CompareProjectToDatabaseDialog = ({
  open,
  onClose,
}: CompareProjectToDatabaseDialogProps) => {
  if (!open) {
    return null;
  }

  return (
    <div className="shell-dialog-backdrop" role="presentation" onClick={onClose}>
      <div onClick={(event) => event.stopPropagation()}>
        <DialogChrome
          title="Compare project to database"
          description="Find where the database differs from project files."
          aria-label="Compare project to database"
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
          <StubMessage secondary="Live compare is not wired yet. Differing objects and side-by-side Diff arrive later." />
          <ul className="compare-results-stub" aria-label="Compare results">
            <li>
              <strong>Differing objects</strong>
              <p className="pane-muted">No scan results — compare is not implemented yet.</p>
            </li>
            <li>
              <strong>Diff</strong>
              <p className="pane-muted">Side-by-side Diff (project file | database) is not available yet.</p>
            </li>
            <li>
              <strong>Generate report…</strong>
              <button type="button" className="chrome-button" disabled title="Requires Agent Core later.">
                Generate report…
              </button>
            </li>
          </ul>
        </DialogChrome>
      </div>
    </div>
  );
};
