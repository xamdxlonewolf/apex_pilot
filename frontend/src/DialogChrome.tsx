import type { ReactNode, RefObject } from "react";
import { useId, useRef } from "react";

import { useDialogFocusTrap } from "./dialogFocus";

type DialogChromeProps = Readonly<{
  title: string;
  description?: string;
  children: ReactNode;
  secondaryAction?: ReactNode;
  primaryAction?: ReactNode;
  /** Optional status / callout above the content body. */
  banner?: ReactNode;
  className?: string;
  "aria-label"?: string;
  /**
   * When set, enables modal focus management: move focus in, Tab trap,
   * Escape closes via onClose, restore focus to the invoker on unmount.
   */
  onClose?: () => void;
  /** Prefer this control for initial focus when onClose is set. */
  initialFocusRef?: RefObject<HTMLElement | null>;
}>;

/** Spec dialog layout: title → description → content → secondary/primary footer. */
export const DialogChrome = ({
  title,
  description,
  children,
  secondaryAction,
  primaryAction,
  banner,
  className,
  "aria-label": ariaLabel,
  onClose,
  initialFocusRef,
}: DialogChromeProps) => {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  useDialogFocusTrap(dialogRef, {
    active: Boolean(onClose),
    onClose: onClose ?? (() => undefined),
    initialFocusRef,
  });

  return (
    <div
      ref={dialogRef}
      className={["dialog-chrome", "funnel-screen", className].filter(Boolean).join(" ")}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      aria-label={ariaLabel}
      data-testid="dialog-chrome"
    >
      <header className="dialog-chrome-header">
        <h1 id={titleId} className="dialog-chrome-title">
          {title}
        </h1>
        {description ? (
          <p id={descriptionId} className="dialog-chrome-description">
            {description}
          </p>
        ) : null}
      </header>
      {banner}
      <div className="dialog-chrome-body">{children}</div>
      {secondaryAction || primaryAction ? (
        <footer className="dialog-chrome-footer" data-testid="dialog-chrome-footer">
          <div className="dialog-chrome-footer-secondary">{secondaryAction}</div>
          <div className="dialog-chrome-footer-primary">{primaryAction}</div>
        </footer>
      ) : null}
    </div>
  );
};
