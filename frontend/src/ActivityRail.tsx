import {
  ACTIVITY_RAIL_ITEMS,
  type ActivityRailId,
} from "./focusMode";

type ActivityRailProps = Readonly<{
  active: ActivityRailId;
  onSelect: (id: ActivityRailId) => void;
}>;

export const ActivityRail = ({ active, onSelect }: ActivityRailProps) => (
  <nav className="activity-rail" aria-label="Activity Rail">
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
        title={item.label}
        onClick={() => onSelect(item.id)}
      >
        <span className="activity-rail-glyph" aria-hidden="true">
          {item.glyph}
        </span>
      </button>
    ))}
  </nav>
);
