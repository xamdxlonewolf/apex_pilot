import { useState } from "react";

import { StubSurface } from "./StubSurface";
import { stubActionProps } from "./stubConvention";

type MissionComposerProps = Readonly<{
  projectName: string | null;
}>;

export const MissionComposer = ({ projectName }: MissionComposerProps) => {
  const [draft, setDraft] = useState("");
  const secondary = projectName
    ? `Agent Core is required to run Mission prompts for ${projectName}.`
    : "Agent Core is required to run Mission prompts.";

  return (
    <StubSurface
      title="Mission"
      className="mission-surface"
      bodyClassName="mission-pane-body"
      secondary={secondary}
      actions={
        <form
          className="mission-composer"
          aria-label="Mission composer"
          onSubmit={(event) => {
            event.preventDefault();
          }}
        >
          <label className="sr-only" htmlFor="mission-composer">
            Mission prompt
          </label>
          <textarea
            id="mission-composer"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Describe your mission… (Agent Core coming next)"
            rows={3}
          />
          <button type="submit" {...stubActionProps()}>
            Send
          </button>
        </form>
      }
    />
  );
};
