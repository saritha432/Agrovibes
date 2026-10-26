import { fetchRentalListings } from "../../services/api";
import { getProviderListings, uploadLocalListings } from "../../services/providerWorkflow";
import { portalCategoryForListing, type BookableRental } from "./rentalCategories";

function toBookable(row: { id: string | number; title: string; category: string; channel: string }): BookableRental {
  return {
    id: String(row.id),
    title: row.title,
    category: row.category,
    channel: row.channel,
    portalCategoryId: portalCategoryForListing(row.category, row.title)
  };
}

export async function loadBookableRentals(token?: string | null): Promise<BookableRental[]> {
  const local = await uploadLocalListings(token).catch(() => getProviderListings());
  const merged = new Map<string, BookableRental>();

  for (const row of local) {
    if (row.channel === "Educators" || row.channel === "Store") continue;
    if (row.status === "rejected") continue;
    merged.set(String(row.id), toBookable(row));
  }

  try {
    const remote = await fetchRentalListings(token);
    for (const row of remote.listings || []) {
      if (row.status === "rejected" || row.status === "unpublished") continue;
      merged.set(String(row.id), toBookable(row));
    }
  } catch {
    // Keep listings already on this phone when the rentals API is not reachable yet.
  }

  return [...merged.values()];
}
