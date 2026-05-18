import "./UserAvatar.css";

export function UserAvatar({
  uri,
  name,
  size = 48
}: {
  uri?: string | null;
  name: string;
  size?: number;
}) {
  const initials = String(name || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join("");

  return (
    <span className="user-avatar" style={{ width: size, height: size }}>
      {uri ? <img src={uri} alt="" /> : <span>{initials || "?"}</span>}
    </span>
  );
}
