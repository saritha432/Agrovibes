export function formatSessionTimestamp(iso?: string | null): string {
  if (!iso) return "Unknown time";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Unknown time";

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const time = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

  if (startOfDate.getTime() === startOfToday.getTime()) {
    return `Today at ${time}`;
  }
  if (startOfDate.getTime() === startOfYesterday.getTime()) {
    return `Yesterday at ${time}`;
  }

  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays > 0 && diffDays < 7) {
    return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  }

  const day = date.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
  return `${day} at ${time}`;
}

export function formatPasswordUpdated(iso?: string | null): string {
  if (!iso) return "Not updated yet";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Not updated yet";
  const day = date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  return `Updated ${day}`;
}

export function formatReviewedAt(iso?: string | null): string {
  if (!iso) return "Not reviewed yet";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Not reviewed yet";

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  if (diffMs < 60_000) return "Reviewed just now";
  if (diffMs < 60 * 60_000) {
    const mins = Math.floor(diffMs / 60_000);
    return `Reviewed ${mins} min${mins === 1 ? "" : "s"} ago`;
  }
  if (diffMs < 24 * 60 * 60_000) {
    const hours = Math.floor(diffMs / (60 * 60_000));
    return `Reviewed ${hours} hour${hours === 1 ? "" : "s"} ago`;
  }
  return `Reviewed ${formatSessionTimestamp(iso)}`;
}

export function roleAccountLabel(role?: string): string {
  if (role === "instructor") return "Educator Account";
  if (role === "admin") return "Business Account";
  return "Personal Account";
}

export function formatSessionDetail(locationLabel: string | null | undefined, iso?: string | null): string {
  const location = locationLabel?.trim();
  const when = formatSessionTimestamp(iso);
  if (location) return `${location} | ${when}`;
  return when;
}
