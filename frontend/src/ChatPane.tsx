import { useState } from "react";

import { stubActionProps } from "./stubConvention";

type ChatPaneProps = Readonly<{
  projectName: string | null;
}>;

export const ChatPane = ({ projectName }: ChatPaneProps) => {
  const [draft, setDraft] = useState("");

  return (
    <section className="ide-pane ide-pane--center" aria-label="Chat">
      <div className="pane-header">
        <strong>Chat</strong>
        <span className="pane-muted">{projectName ?? "No project"}</span>
      </div>
      <div className="chat-transcript pane-body">
        <p className="pane-muted">
          Chat is ready. Send stays disabled until Agent Core lands. Use Schema and SQL Sheet for
          live MCP work.
        </p>
      </div>
      <form
        className="chat-composer"
        onSubmit={(event) => {
          event.preventDefault();
        }}
      >
        <label className="sr-only" htmlFor="chat-composer">
          Message
        </label>
        <textarea
          id="chat-composer"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Ask Apex Pilot… (Agent Core coming next)"
          rows={3}
        />
        <button type="submit" {...stubActionProps("Send is disabled until Agent Core")}>
          Send
        </button>
      </form>
    </section>
  );
};
