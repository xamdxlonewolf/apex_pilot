import type { ReactNode } from "react";

import {
  STUB_BADGE,
  STUB_PRIMARY_COPY,
  containsForbiddenStubUiCopy,
} from "./stubConvention";

export const StubBadge = () => (
  <span className="stub-badge" data-testid="stub-badge">
    {STUB_BADGE}
  </span>
);

type StubMessageProps = Readonly<{
  /** One short line naming the missing dependency; no dates or fake progress. */
  secondary?: string;
}>;

export const StubMessage = ({ secondary }: StubMessageProps) => {
  if (secondary && containsForbiddenStubUiCopy(secondary)) {
    throw new Error(
      "Stub secondary copy must not include Gap markings or DS-* / UI-* planning IDs.",
    );
  }

  return (
    <div className="stub-message" data-testid="stub-message">
      <p>{STUB_PRIMARY_COPY}</p>
      {secondary ? <p className="pane-muted">{secondary}</p> : null}
    </div>
  );
};

type StubChromeTitleProps = Readonly<{
  title: string;
  /** Extra chrome beside the Stub badge (status, controls). */
  trailing?: ReactNode;
}>;

/** Section / tab / dialog chrome with the Stub badge. */
export const StubChromeTitle = ({ title, trailing }: StubChromeTitleProps) => (
  <div className="pane-header" data-testid="stub-chrome">
    <strong>{title}</strong>
    <span className="stub-chrome-trailing">
      <StubBadge />
      {trailing}
    </span>
  </div>
);

type StubSurfaceProps = Readonly<{
  title: string;
  secondary?: string;
  /** Disabled Spec-layout controls only — never fake-successful actions. */
  actions?: ReactNode;
  className?: string;
  bodyClassName?: string;
}>;

/**
 * Reusable unfinished Spec surface: Stub badge + primary copy + optional
 * dependency secondary. Does not accept sample rows, fake SQL results, or mock
 * success timelines. Real in-flight loading belongs outside this component.
 */
export const StubSurface = ({
  title,
  secondary,
  actions,
  className,
  bodyClassName = "stub-body",
}: StubSurfaceProps) => (
  <div className={className} data-testid="stub-surface">
    <StubChromeTitle title={title} />
    <div className={bodyClassName}>
      <StubMessage secondary={secondary} />
      {actions}
    </div>
  </div>
);
