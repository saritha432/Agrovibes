export function listingStatusText(status: string) {
  if (status === "approved") return "Available";
  if (status === "rejected" || status === "unpublished") return "Inactive";
  return "Waiting for approval";
}
