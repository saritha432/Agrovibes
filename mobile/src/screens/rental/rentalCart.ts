import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "agrovibes.rental.cart.v1";

/** Safety cap when a listing does not define inventory. */
export const RENTAL_CART_MAX_QTY = 99;

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

export function rentalLineKey(listingId: string, option: string) {
  return `${listingId}|${option}`;
}

export function clampRentalQuantity(quantity: number, max = RENTAL_CART_MAX_QTY) {
  if (!Number.isFinite(quantity)) return 0;
  return Math.max(0, Math.min(max, Math.floor(quantity)));
}

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

export async function writeRentalCart(lines: RentalCartLine[]): Promise<RentalCartLine[]> {
  const next = Array.isArray(lines) ? lines : [];
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

function sameLine(left: RentalCartLine, right: Pick<RentalCartLine, "listingId" | "option">) {
  return left.listingId === right.listingId && left.option === right.option;
}

export async function addRentalCartLine(line: RentalCartLine): Promise<RentalCartLine[]> {
  const current = await readCart();
  const existing = current.find((item) => sameLine(item, line));
  const next = existing
    ? current.map((item) => (sameLine(item, line) ? { ...item, quantity: item.quantity + line.quantity } : item))
    : [line, ...current];
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export async function setRentalCartLine(line: RentalCartLine): Promise<RentalCartLine[]> {
  const current = await readCart();
  const without = current.filter((item) => !sameLine(item, line));
  const next = line.quantity > 0 ? [{ ...line, quantity: line.quantity }, ...without] : without;
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export async function updateRentalCartQuantity(
  listingId: string,
  option: string,
  quantity: number
): Promise<RentalCartLine[]> {
  const current = await readCart();
  const next =
    quantity > 0
      ? current.map((item) => (sameLine(item, { listingId, option }) ? { ...item, quantity } : item))
      : current.filter((item) => !sameLine(item, { listingId, option }));
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export async function removeRentalCartLine(listingId: string, option?: string): Promise<RentalCartLine[]> {
  const next = (await readCart()).filter((item) =>
    option ? !sameLine(item, { listingId, option }) : item.listingId !== listingId
  );
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export async function clearRentalCart(): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([]));
}
