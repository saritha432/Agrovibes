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
