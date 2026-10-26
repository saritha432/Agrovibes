import AsyncStorage from "@react-native-async-storage/async-storage";
import { submitRentalBooking } from "../../services/api";

const STORAGE_KEY = "agrovibes.customer.rentalBookings.v1";

export type CustomerRentalBooking = {
  id: string;
  listingId: string;
  title: string;
  category: string;
  location: string;
  date: string;
  note: string;
  createdAt: string;
  serverId?: number;
};

export async function getCustomerRentalBookings(): Promise<CustomerRentalBooking[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as CustomerRentalBooking[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveCustomerRentalBooking(
  input: Omit<CustomerRentalBooking, "id" | "createdAt">
): Promise<CustomerRentalBooking> {
  const current = await getCustomerRentalBookings();
  const booking: CustomerRentalBooking = {
    ...input,
    id: `rental_booking_${Date.now()}`,
    createdAt: new Date().toISOString()
  };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([booking, ...current]));
  return booking;
}

export async function uploadCustomerBookings(token?: string | null): Promise<void> {
  if (!token) return;
  const current = await getCustomerRentalBookings();
  let changed = false;
  const next = [...current];
  for (let index = 0; index < next.length; index += 1) {
    const booking = next[index];
    if (booking.serverId) continue;
    try {
      const created = await submitRentalBooking(token, {
        listingId: booking.listingId,
        title: booking.title,
        category: booking.category,
        location: booking.location,
        date: booking.date,
        note: booking.note
      });
      const serverId = Number(created?.booking?.id);
      if (Number.isFinite(serverId) && serverId > 0) {
        next[index] = { ...booking, serverId };
        changed = true;
      }
    } catch {
      // Keep the phone copy and try again the next time this screen opens.
    }
  }
  if (changed) await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}
