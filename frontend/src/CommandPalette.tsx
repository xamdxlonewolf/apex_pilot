import { useId, useMemo, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";

import {
  filterCommandActions,
  type CommandPaletteAction,
} from "./commandPalette";

type CommandPaletteProps = {
  open: boolean;
  actions: CommandPaletteAction[];
  onClose: () => void;
};

export const CommandPalette = ({ open, actions, onClose }: CommandPaletteProps) => {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const listId = useId();
  const titleId = useId();

  const filtered = useMemo(() => filterCommandActions(actions, query), [actions, query]);
  const safeIndex =
    filtered.length === 0 ? 0 : Math.min(Math.max(activeIndex, 0), filtered.length - 1);

  if (!open) {
    return null;
  }

  const runAction = (action: CommandPaletteAction) => {
    if (action.enabled === false) {
      return;
    }
    onClose();
    action.run();
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
      const action = filtered[safeIndex];
      if (action) {
        runAction(action);
      }
    }
  };

  return (
    <div
      className="command-palette-backdrop"
      data-testid="command-palette-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="command-palette"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid="command-palette"
        onKeyDown={onDialogKeyDown}
      >
        <h2 id={titleId} className="command-palette-title">
          Command Palette
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
          placeholder="Type a command…"
          value={query}
          autoFocus
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
          }}
          data-testid="command-palette-input"
        />
        <ul
          id={listId}
          className="command-palette-list"
          role="listbox"
          aria-label="Commands"
          data-testid="command-palette-list"
        >
          {filtered.length === 0 ? (
            <li className="command-palette-empty" role="presentation">
              No matching commands
            </li>
          ) : (
            filtered.map((action, index) => {
              const enabled = action.enabled !== false;
              return (
                <li
                  key={action.id}
                  id={`${listId}-option-${action.id}`}
                  role="option"
                  aria-selected={index === safeIndex}
                  aria-disabled={!enabled}
                  className={
                    index === safeIndex
                      ? "command-palette-option is-active"
                      : "command-palette-option"
                  }
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => runAction(action)}
                >
                  <span className="command-palette-option-label">{action.label}</span>
                  {action.shortcut ? (
                    <kbd className="command-palette-option-shortcut">{action.shortcut}</kbd>
                  ) : null}
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
};
