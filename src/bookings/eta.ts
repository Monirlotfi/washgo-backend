const TRIPORTEUR_AVG_KMH = 25;
const SAFETY_MARGIN_MINUTES = 2;

/**
 * Distance haversine entre 2 points GPS, en mètres.
 */
export function haversineDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371000; // rayon Terre en m
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calcule l'ETA en minutes à partir d'une distance en mètres.
 * Inclut une marge de sécurité de 2 min.
 */
export function calculateEtaMinutes(distanceMeters: number): number {
  const distanceKm = distanceMeters / 1000;
  const durationHours = distanceKm / TRIPORTEUR_AVG_KMH;
  const durationMinutes = durationHours * 60;
  return Math.max(1, Math.round(durationMinutes + SAFETY_MARGIN_MINUTES));
}