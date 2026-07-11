import { useEffect, useState } from "react";

import { matchCommandPaletteShortcut } from "./commandPalette";
import { QuickOpen } from "./QuickOpen";
import {
  collectProjectFileItems,
  matchQuickOpenShortcut,
  mergeQuickOpenItems,
  type QuickOpenItem,
} from "./quickOpen";

type QuickOpenHostProps = Readonly<{
  rootPath: string;
  showJunk: boolean;
  objects?: ReadonlyArray<QuickOpenItem>;
  onSelect: (item: QuickOpenItem) => void;
  /** When true, ignore Ctrl+P (e.g. command palette already owns the overlay). */
  suppressShortcut?: boolean;
}>;

/**
 * Workspace-owned Quick Open controller: Ctrl+P toggle + lazy file/object catalog.
 * Extracted so browser-fallback Vitest can exercise the same shortcut path as IdeWorkspace.
 */
export const QuickOpenHost = ({
  rootPath,
  showJunk,
  objects = [],
  onSelect,
  suppressShortcut = false,
}: QuickOpenHostProps) => {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<QuickOpenItem[]>([]);

  useEffect(() => {
    if (!open) {
      return;
    }
    let cancelled = false;
    void (async () => {
      const files = await collectProjectFileItems(rootPath, { showJunk });
      if (!cancelled) {
        setItems(mergeQuickOpenItems(files, objects));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [objects, open, rootPath, showJunk]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (matchCommandPaletteShortcut(event)) {
        setOpen(false);
        return;
      }
      if (suppressShortcut) {
        return;
      }
      if (matchQuickOpenShortcut(event)) {
        event.preventDefault();
        setOpen((current) => !current);
        return;
      }
      if (open && event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, suppressShortcut]);

  return (
    <QuickOpen
      key={open ? "open" : "closed"}
      open={open}
      items={items}
      onSelect={onSelect}
      onClose={() => setOpen(false)}
    />
  );
};
