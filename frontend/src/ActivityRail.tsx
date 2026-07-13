import {
  ACTIVITY_RAIL_ITEMS,
  type ActivityRailId,
} from "./focusMode";

type ActivityRailProps = Readonly<{
  active: ActivityRailId;
  showLabels: boolean;
  onSelect: (id: ActivityRailId) => void;
}>;

export const ActivityRail = ({ active, showLabels, onSelect }: ActivityRailProps) => (
  <nav
    className="activity-rail"
    aria-label="Activity Rail"
    data-labels={showLabels ? "on" : "off"}
  >
    {ACTIVITY_RAIL_ITEMS.map((item) => (
      <button
        key={item.id}
        type="button"
        className={
          item.id === active
            ? "activity-rail-button activity-rail-button--active"
            : "activity-rail-button"
        }
        aria-label={item.label}
        aria-pressed={item.id === active}
        title={showLabels ? undefined : item.label}
        onClick={() => onSelect(item.id)}
      >
        <span className="activity-rail-glyph" aria-hidden="true">
          {item.glyph}
        </span>
        {showLabels ? <span className="activity-rail-label">{item.label}</span> : null}
      </button>
    ))}
  </nav>
);
