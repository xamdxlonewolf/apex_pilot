import type { ReactNode } from "react";

import type { DrawerSide } from "./shellSession";

type ShellDrawerProps = Readonly<{
  id: string;
  side: DrawerSide;
  open: boolean;
  width: number;
  title: string;
  ariaLabel: string;
  onClose: () => void;
  onResizeDelta?: (delta: number) => void;
  children: ReactNode;
  /** Optional resize splitter rendered on the inner edge. */
  splitter?: ReactNode;
}>;

/**
 * Docked push panel for secondary tools. Takes layout width (parent grid column);
 * short slide on open. Dismiss via close control / parent Escape / toggle —
 * no click-outside backdrop.
 */
export const ShellDrawer = ({
  id,
  side,
  open,
  width,
  title,
  ariaLabel,
  onClose,
  children,
  splitter,
}: ShellDrawerProps) => {
  if (!open) {
    return null;
  }

  return (
    <section
      className={`shell-drawer shell-drawer--dock shell-drawer--${side} shell-drawer--open`}
      role="region"
      aria-label={ariaLabel}
      data-drawer-id={id}
      data-side={side}
      data-dock={id}
      style={{ ["--drawer-width" as string]: `${width}px` }}
    >
      {side === "right" ? splitter : null}
      <div className="shell-drawer-panel">
        <div className="shell-drawer-header">
          <strong>{title}</strong>
          <button
            type="button"
            className="chrome-button shell-drawer-close"
            aria-label={`Close ${title}`}
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <div className="shell-drawer-body">{children}</div>
      </div>
      {side === "left" ? splitter : null}
    </section>
  );
};
