import { useMemo } from "react";

import type { ActivityEntry } from "./backend";

const formatActivityTime = (timestamp: string): string => {
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) {
    return timestamp;
  }
  return parsed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
};

const formatActivityDateTime = (timestamp: string): string => {
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) {
    return timestamp;
  }
  return parsed.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const activityBelongsToConnection = (entry: ActivityEntry, connectionName: string): boolean => {
  if (entry.connection_name === connectionName) {
    return true;
  }
  const args = entry.arguments;
  const candidates = [args.connection_name, args.connectionName, args.name];
  return candidates.some((value) => typeof value === "string" && value === connectionName);
};

const entriesForConnection = (
  entries: ActivityEntry[],
  connectionName: string | null,
  showAll: boolean,
): ActivityEntry[] => {
  const newestFirst = [...entries].reverse();
  if (showAll || !connectionName) {
    return newestFirst;
  }
  return newestFirst.filter((entry) => activityBelongsToConnection(entry, connectionName));
};

type ActivityGroup = {
  toolName: string;
  entries: ActivityEntry[];
  succeededEntries: ActivityEntry[];
  failedEntries: ActivityEntry[];
  latestTimestamp: string;
  succeededCount: number;
  failedCount: number;
};

type ActivitySessionBucket = {
  sessionId: string;
  label: string;
  isActive: boolean;
  entries: ActivityEntry[];
  startedAt: string;
  succeededCount: number;
  failedCount: number;
  toolGroups: ActivityGroup[];
};

const splitEntriesByStatus = (
  entries: ActivityEntry[],
): { succeeded: ActivityEntry[]; failed: ActivityEntry[] } => ({
  succeeded: entries.filter((entry) => entry.status === "succeeded"),
  failed: entries.filter((entry) => entry.status === "failed"),
});

const groupActivityByTool = (entries: ActivityEntry[]): ActivityGroup[] => {
  const groups = new Map<string, ActivityEntry[]>();
  for (const entry of entries) {
    const existing = groups.get(entry.tool_name);
    if (existing) {
      existing.push(entry);
    } else {
      groups.set(entry.tool_name, [entry]);
    }
  }

  return [...groups.entries()].map(([toolName, toolEntries]) => {
    const { succeeded, failed } = splitEntriesByStatus(toolEntries);
    return {
      toolName,
      entries: toolEntries,
      succeededEntries: succeeded,
      failedEntries: failed,
      latestTimestamp: toolEntries[0]?.timestamp ?? "",
      succeededCount: succeeded.length,
      failedCount: failed.length,
    };
  });
};

const groupActivityBySession = (
  entries: ActivityEntry[],
  activeSessionId: string | null,
): ActivitySessionBucket[] => {
  const sessions = new Map<string, ActivityEntry[]>();
  for (const entry of entries) {
    const sessionKey = entry.session_id ?? "unknown-session";
    const existing = sessions.get(sessionKey);
    if (existing) {
      existing.push(entry);
    } else {
      sessions.set(sessionKey, [entry]);
    }
  }

  const buckets = [...sessions.entries()].map(([sessionId, sessionEntries]) => {
    const isActive = Boolean(activeSessionId) && sessionId === activeSessionId;
    const oldest = sessionEntries[sessionEntries.length - 1];
    const { succeeded, failed } = splitEntriesByStatus(sessionEntries);
    return {
      sessionId,
      label: isActive ? "Active session" : "Previous session",
      isActive,
      entries: sessionEntries,
      startedAt: oldest?.timestamp ?? sessionEntries[0]?.timestamp ?? "",
      succeededCount: succeeded.length,
      failedCount: failed.length,
      toolGroups: groupActivityByTool(sessionEntries),
    };
  });

  return buckets.sort((left, right) => {
    if (left.isActive !== right.isActive) {
      return left.isActive ? -1 : 1;
    }
    return right.startedAt.localeCompare(left.startedAt);
  });
};

const OutcomeSummary = ({
  succeededCount,
  failedCount,
}: {
  succeededCount: number;
  failedCount: number;
}) => (
  <span className="activity-outcome-summary" aria-label={`${succeededCount} succeeded, ${failedCount} failed`}>
    <span className="activity-status activity-status--succeeded">{succeededCount} succeeded</span>
    <span className="activity-outcome-separator" aria-hidden="true">
      ·
    </span>
    <span className="activity-status activity-status--failed">{failedCount} failed</span>
  </span>
);

const CallOutcomeBucket = ({
  label,
  status,
  entries,
  openByDefault = false,
}: {
  label: string;
  status: "succeeded" | "failed";
  entries: ActivityEntry[];
  openByDefault?: boolean;
}) => {
  if (entries.length === 0) {
    return null;
  }

  return (
    <li className={`activity-outcome activity-outcome--${status}`}>
      <details open={openByDefault}>
        <summary>
          <span className="activity-tree-chevron" aria-hidden="true" />
          <span className="activity-tree-main">
            <strong>{label}</strong>
            <span className="activity-tree-count">
              {entries.length} {entries.length === 1 ? "call" : "calls"}
            </span>
          </span>
          <span className={`activity-status activity-status--${status}`}>{status}</span>
        </summary>
        <ul className="activity-call-list" aria-label={`${label} calls`}>
          {entries.map((entry) => (
            <li key={entry.sequence} className="activity-call">
              <details>
                <summary>
                  <span className="activity-tree-chevron" aria-hidden="true" />
                  <span className="activity-tree-main">
                    <strong>#{entry.sequence}</strong>
                    <span className="activity-tree-seq">{formatActivityTime(entry.timestamp)}</span>
                  </span>
                  <span className={`activity-status activity-status--${entry.status}`}>
                    {entry.status}
                  </span>
                </summary>
                <div className="activity-tree-details">
                  {entry.message ? <p>{entry.message}</p> : null}
                  <pre>
                    <code>{JSON.stringify(entry.arguments, null, 2)}</code>
                  </pre>
                </div>
              </details>
            </li>
          ))}
        </ul>
      </details>
    </li>
  );
};

const ToolActivityGroups = ({ groups }: { groups: ActivityGroup[] }) => (
  <ul className="activity-tool-list" aria-label="Tool groups">
    {groups.map((group) => (
      <li key={group.toolName} className="activity-tool">
        <details>
          <summary>
            <span className="activity-tree-chevron" aria-hidden="true" />
            <span className="activity-tree-main">
              <strong>{group.toolName}</strong>
              <span className="activity-tree-count">
                {group.entries.length} {group.entries.length === 1 ? "call" : "calls"}
              </span>
            </span>
            <OutcomeSummary
              succeededCount={group.succeededCount}
              failedCount={group.failedCount}
            />
            <time dateTime={group.latestTimestamp}>{formatActivityTime(group.latestTimestamp)}</time>
          </summary>
          <ul className="activity-outcome-list" aria-label={`${group.toolName} outcomes`}>
            <CallOutcomeBucket
              label="Failed"
              status="failed"
              entries={group.failedEntries}
              openByDefault={group.failedCount > 0}
            />
            <CallOutcomeBucket
              label="Succeeded"
              status="succeeded"
              entries={group.succeededEntries}
            />
          </ul>
        </details>
      </li>
    ))}
  </ul>
);

export const ActivityTree = ({
  entries,
  connectionName,
  activeSessionId,
  showAll = false,
}: {
  entries: ActivityEntry[];
  connectionName: string | null;
  activeSessionId: string | null;
  showAll?: boolean;
}) => {
  const visibleEntries = useMemo(
    () => entriesForConnection(entries, connectionName, showAll),
    [connectionName, entries, showAll],
  );
  const sessions = useMemo(
    () => groupActivityBySession(visibleEntries, activeSessionId),
    [activeSessionId, visibleEntries],
  );

  if (!connectionName && !showAll) {
    return (
      <p className="activity-empty-copy">
        Not connected to a database. Connect to a saved SQLcl connection to view MCP call history.
      </p>
    );
  }

  if (visibleEntries.length === 0) {
    return <p className="activity-empty-copy">No MCP tool activity yet.</p>;
  }

  return (
    <div className="activity-panel">
      <p className="activity-panel-meta">
        {showAll
          ? `All connections · ${sessions.length} sessions · ${visibleEntries.length} calls`
          : `${connectionName} · ${sessions.length} sessions · ${visibleEntries.length} calls`}
      </p>
      <ul className="activity-tree" aria-label="MCP tool activity">
        {sessions.map((session) => (
          <li
            key={session.sessionId}
            className={`activity-tree-item activity-session${session.isActive ? " activity-session--active" : ""}`}
          >
            <details open={session.isActive}>
              <summary>
                <span className="activity-tree-chevron" aria-hidden="true" />
                <span className="activity-tree-main">
                  <strong>{session.label}</strong>
                  <span className="activity-tree-count">
                    {session.entries.length} {session.entries.length === 1 ? "call" : "calls"} ·{" "}
                    {session.toolGroups.length}{" "}
                    {session.toolGroups.length === 1 ? "tool" : "tools"}
                  </span>
                </span>
                <OutcomeSummary
                  succeededCount={session.succeededCount}
                  failedCount={session.failedCount}
                />
                <time dateTime={session.startedAt}>{formatActivityDateTime(session.startedAt)}</time>
              </summary>
              <div className="activity-session-body">
                <ToolActivityGroups groups={session.toolGroups} />
              </div>
            </details>
          </li>
        ))}
      </ul>
    </div>
  );
};
