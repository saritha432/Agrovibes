import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "agrovibes.rental.cart.v1";

export type RentalCartLine = {
  listingId: string;
  title: string;
  category: string;
  option: string;
  quantity: number;
  unitPrice: number;
  unitLabel: string;
  mrp: number;
};

async function readCart(): Promise<RentalCartLine[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as RentalCartLine[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function getRentalCart(): Promise<RentalCartLine[]> {
  return readCart();
}

export async function addRentalCartLine(line: RentalCartLine): Promise<RentalCartLine[]> {
  const current = await readCart();
  const existing = current.find((item) => item.listingId === line.listingId);
  const next = existing
    ? current.map((item) =>
        item.listingId === line.listingId ? { ...item, quantity: item.quantity + line.quantity } : item
      )
    : [line, ...current];
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export async function removeRentalCartLine(listingId: string): Promise<RentalCartLine[]> {
  const next = (await readCart()).filter((item) => item.listingId !== listingId);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}
