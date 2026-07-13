/** Mission peer pane header — title stays Mission; Review Focus Mode adds quiet meta. */
export const MissionPeerHeader = ({
  showReviewMeta,
}: Readonly<{ showReviewMeta: boolean }>) => (
  <div className="pane-header">
    <strong>Mission</strong>
    {showReviewMeta ? (
      <span className="pane-header-meta" data-testid="mission-review-meta">
        Review
      </span>
    ) : null}
  </div>
);
