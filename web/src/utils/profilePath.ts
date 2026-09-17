/** In-app profile URL. Own account stays on /profile; everyone else opens /u/:id. */
export function webProfilePath(userId?: number | null, viewerId?: number | null): string | null {
  const id = Number(userId);
  if (!Number.isFinite(id) || id <= 0) return null;
  if (viewerId != null && Number(viewerId) === id) return "/profile";
  return `/u/${id}`;
}
