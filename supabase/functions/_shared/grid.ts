// Fungsi ini WAJIB identik dengan versi di React Native (src/lib/grid.ts).
// Frontend pakai ini hanya untuk optimistic UI, backend selalu hitung ulang
// sendiri dari latitude/longitude mentah, tidak pernah percaya grid_id dari client.

export function getGridId(
  lat: number,
  lng: number,
  gridSizeMeters = 50
): { gridId: string; latCenter: number; lngCenter: number } {
  const unit = gridSizeMeters / 111000; // ~111km per derajat lintang
  const latGrid = Math.floor(lat / unit) * unit;
  const lngGrid = Math.floor(lng / unit) * unit;

  return {
    gridId: `GRID_${latGrid.toFixed(5)}_${lngGrid.toFixed(5)}`,
    latCenter: latGrid,
    lngCenter: lngGrid,
  };
}

export async function hashIp(ip: string): Promise<string> {
  const data = new TextEncoder().encode(ip);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // metres
  const φ1 = lat1 * Math.PI/180; // φ, λ in radians
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // in metres
}
