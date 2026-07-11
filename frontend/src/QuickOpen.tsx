import { useId, useMemo, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";

import { filterQuickOpenItems, type QuickOpenItem } from "./quickOpen";

type QuickOpenProps = Readonly<{
  open: boolean;
  items: ReadonlyArray<QuickOpenItem>;
  onSelect: (item: QuickOpenItem) => void;
  onClose: () => void;
}>;

export const QuickOpen = ({ open, items, onSelect, onClose }: QuickOpenProps) => {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const listId = useId();
  const titleId = useId();

  const filtered = useMemo(() => filterQuickOpenItems(items, query), [items, query]);
  const safeIndex =
    filtered.length === 0 ? 0 : Math.min(Math.max(activeIndex, 0), filtered.length - 1);

  if (!open) {
    return null;
  }

  const runItem = (item: QuickOpenItem) => {
    onClose();
    onSelect(item);
  };

  const onDialogKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (filtered.length === 0) {
        return;
      }
      setActiveIndex((safeIndex + 1) % filtered.length);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (filtered.length === 0) {
        return;
      }
      setActiveIndex((safeIndex - 1 + filtered.length) % filtered.length);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const item = filtered[safeIndex];
      if (item) {
        runItem(item);
      }
    }
  };

  return (
    <div
      className="command-palette-backdrop"
      data-testid="quick-open-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="command-palette quick-open"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid="quick-open"
        onKeyDown={onDialogKeyDown}
      >
        <h2 id={titleId} className="command-palette-title">
          Quick Open
        </h2>
        <input
          className="command-palette-input"
          type="search"
          role="combobox"
          aria-autocomplete="list"
          aria-controls={listId}
          aria-expanded="true"
          aria-activedescendant={
            filtered[safeIndex] ? `${listId}-option-${filtered[safeIndex].id}` : undefined
          }
          placeholder="Go to file or object…"
          value={query}
          autoFocus
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
          }}
          data-testid="quick-open-input"
        />
        <ul
          id={listId}
          className="command-palette-list"
          role="listbox"
          aria-label="Files and objects"
          data-testid="quick-open-list"
        >
          {filtered.length === 0 ? (
            <li className="command-palette-empty" role="presentation">
              No matching files or objects
            </li>
          ) : (
            filtered.map((item, index) => (
              <li
                key={item.id}
                id={`${listId}-option-${item.id}`}
                role="option"
                aria-selected={index === safeIndex}
                className={
                  index === safeIndex
                    ? "command-palette-option is-active"
                    : "command-palette-option"
                }
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => runItem(item)}
              >
                <span className="command-palette-option-label">
                  <span className="quick-open-kind" data-kind={item.kind}>
                    {item.kind === "file" ? "File" : item.objectType ?? "Object"}
                  </span>{" "}
                  {item.label}
                </span>
                {item.detail ? (
                  <span className="command-palette-option-shortcut quick-open-detail">
                    {item.detail}
                  </span>
                ) : null}
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
};
