/** Mission peer pane header — title stays Mission; Review Focus Mode adds quiet meta. */
export const MissionPeerHeader = ({
  showReviewMeta,
  onClose,
}: Readonly<{
  showReviewMeta: boolean;
  onClose?: () => void;
}>) => (
  <div className="pane-header">
    <strong>Mission</strong>
    <div className="pane-header-trailing">
      {showReviewMeta ? (
        <span className="pane-header-meta" data-testid="mission-review-meta">
          Review
        </span>
      ) : null}
      {onClose ? (
        <button
          type="button"
          className="chrome-button shell-drawer-close"
          aria-label="Close Mission"
          onClick={(event) => {
            event.stopPropagation();
            onClose();
          }}
        >
          ×
        </button>
      ) : null}
    </div>
  </div>
);
