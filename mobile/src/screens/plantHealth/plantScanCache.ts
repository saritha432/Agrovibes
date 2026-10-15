import type { PlantHealthScan } from "../../services/api";

const cache = new Map<number, PlantHealthScan>();

export function cachePlantScan(scan: PlantHealthScan) {
  cache.set(scan.id, scan);
}

export function getCachedPlantScan(scanId: number) {
  return cache.get(scanId) || null;
}

export function forgetPlantScan(scanId: number) {
  cache.delete(scanId);
}
