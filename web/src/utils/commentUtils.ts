import type { HomeComment } from "../api/home";

export const COMMENT_QUICK_EMOJIS = ["❤️", "🙌", "🔥", "👏", "😢", "😍", "😮", "😂"] as const;
export const REPLY_PREVIEW_VISIBLE = 0;
export const COMMENT_REPLY_INDENT = 14;

export function normalizeIdentity(name: string) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/^@/, "");
}

function sortCommentsByTime(a: HomeComment, b: HomeComment) {
  const ta = Date.parse(a.createdAt || "") || 0;
  const tb = Date.parse(b.createdAt || "") || 0;
  if (ta !== tb) return ta - tb;
  return String(a.id).localeCompare(String(b.id));
}

export function normalizeCommentRow(c: Partial<HomeComment> & Record<string, unknown>): HomeComment {
  const pidRaw = c.parentCommentId ?? c["parent_comment_id"] ?? c["parentcommentid"];
  const parentCommentId =
    pidRaw != null && String(pidRaw).trim() !== "" && String(pidRaw) !== "null"
      ? String(pidRaw).trim()
      : undefined;
  const avRaw = c.avatarUrl ?? c["avatar_url"];
  const avatarUrl = typeof avRaw === "string" && avRaw.trim() ? avRaw.trim() : undefined;
  const userIdRaw = c.userId ?? c["user_id"];
  const userIdNum = Number(userIdRaw);
  const userId = Number.isFinite(userIdNum) && userIdNum > 0 ? userIdNum : undefined;
  return {
    id: String(c.id ?? ""),
    user: String(c.user ?? ""),
    text: String(c.text ?? ""),
    likes: Number.isFinite(Number(c.likes)) ? Number(c.likes) : 0,
    createdAt: typeof c.createdAt === "string" ? c.createdAt : c.createdAt != null ? String(c.createdAt) : undefined,
    parentCommentId,
    ...(avatarUrl ? { avatarUrl } : {}),
    ...(userId ? { userId } : {})
  };
}

export function inferParentFromMention(rows: HomeComment[]): HomeComment[] {
  if (!rows.length) return rows;
  const byId = new Map<string, HomeComment>();
  for (const r of rows) {
    byId.set(String(r.id), { ...r });
  }
  const chronological = [...rows].sort((a, b) => {
    const ta = Date.parse(a.createdAt || "") || 0;
    const tb = Date.parse(b.createdAt || "") || 0;
    if (ta !== tb) return ta - tb;
    return String(a.id).localeCompare(String(b.id));
  });
  const seenChrono: HomeComment[] = [];
  for (const r of chronological) {
    const cur = byId.get(String(r.id))!;
    if (!cur.parentCommentId) {
      const match = String(cur.text || "").trim().match(/^@([^\s@]+)/u);
      if (match) {
        const mentionNorm = normalizeIdentity(match[1]);
        if (mentionNorm) {
          for (let i = seenChrono.length - 1; i >= 0; i--) {
            if (normalizeIdentity(seenChrono[i].user) === mentionNorm) {
              cur.parentCommentId = String(seenChrono[i].id);
              break;
            }
          }
        }
      }
    }
    seenChrono.push(cur);
  }
  return rows.map((r) => byId.get(String(r.id))!);
}

export function buildCommentReplyTree(rows: HomeComment[]) {
  const byId = new Map<string, HomeComment>();
  for (const r of rows) byId.set(String(r.id), r);
  const children = new Map<string, HomeComment[]>();
  const roots: HomeComment[] = [];
  for (const r of rows) {
    const pid = r.parentCommentId ? String(r.parentCommentId) : "";
    if (pid && byId.has(pid)) {
      const list = children.get(pid) ?? [];
      list.push(r);
      children.set(pid, list);
    } else {
      roots.push(r);
    }
  }
  for (const [, list] of children) {
    list.sort(sortCommentsByTime);
  }
  roots.sort(sortCommentsByTime);
  return { children, roots };
}

export function formatCommentRelativeTime(iso?: string): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const diff = Math.max(0, Date.now() - t);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w`;
  const months = Math.floor(days / 30);
  return `${Math.max(1, months)}mo`;
}

export function commentPlaceholderForPost(
  postUserName: string | undefined,
  replyingToUser: string | null | undefined
) {
  if (replyingToUser) return "Write a reply…";
  const handle = String(postUserName || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (handle) return `Add a comment for ${handle}`;
  return "Add a comment…";
}

export function shownCommentsCount(apiCount: number, loaded: HomeComment[]) {
  return Math.max(Number(apiCount ?? 0), loaded.length);
}
