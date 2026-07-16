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
