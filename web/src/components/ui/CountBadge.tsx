import "./CountBadge.css";

export function CountBadge({ count }: { count: number }) {
  if (!count || count <= 0) return null;
  const label = String(Math.min(99, count));
  return (
    <span className={`count-badge${label.length > 1 ? " count-badge--wide" : ""}`} aria-hidden>
      {label}
    </span>
  );
}
