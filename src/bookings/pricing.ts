import { VehicleCategory, VehicleSize, WashType } from '@prisma/client';

/**
 * Matrice de prix en centimes (MAD × 100).
 * Catégorie véhicule × type de lavage = prix.
 */
const PRICING_GRID: Record<VehicleCategory, Record<WashType, number>> = {
  CITY_CAR: {
    BASIC: 5000,    // 50 DH
    PREMIUM: 8000,  // 80 DH
    VIP: 20000,     // 200 DH
  },
  LARGE_VEHICLE: {
    BASIC: 7000,    // 70 DH
    PREMIUM: 10000, // 100 DH
    VIP: 25000,     // 250 DH
  },
  MOTORCYCLE: {
    BASIC: 4000,    // 40 DH
    PREMIUM: 7000,  // 70 DH
    VIP: 15000,     // 150 DH
  },
};

/**
 * Mapping des anciens VehicleSize vers les nouvelles VehicleCategory
 * pour les véhicules créés avant la migration.
 */
const LEGACY_SIZE_TO_CATEGORY: Record<VehicleSize, VehicleCategory> = {
  SMALL: 'CITY_CAR',
  MEDIUM: 'CITY_CAR',
  SUV: 'LARGE_VEHICLE',
  VAN: 'LARGE_VEHICLE',
};

export function resolveVehicleCategory(vehicle: {
  category: VehicleCategory | null;
  size: VehicleSize;
}): VehicleCategory {
  return vehicle.category ?? LEGACY_SIZE_TO_CATEGORY[vehicle.size];
}

export function getPriceForBooking(
  vehicle: { category: VehicleCategory | null; size: VehicleSize },
  washType: WashType,
): number {
  const category = resolveVehicleCategory(vehicle);
  return PRICING_GRID[category][washType];
}

export function getAllPricesForVehicle(
  vehicle: { category: VehicleCategory | null; size: VehicleSize },
): Record<WashType, number> {
  const category = resolveVehicleCategory(vehicle);
  return PRICING_GRID[category];
}