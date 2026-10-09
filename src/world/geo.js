// 실제 위경도를 게임 좌표(1 unit = 1 m)로 변환한다.
// 원점은 황리단길 중앙(포석로), +x = 동쪽, +z = 남쪽, +y = 위.

export const ORIGIN = { lat: 35.8375, lon: 129.2088 };
const M_PER_LAT = 110950;
const M_PER_LON = 111320 * Math.cos((ORIGIN.lat * Math.PI) / 180); // ≈ 90,240 m

export function toWorld(lat, lon) {
  return {
    x: (lon - ORIGIN.lon) * M_PER_LON,
    z: -(lat - ORIGIN.lat) * M_PER_LAT,
  };
}

export function toLatLon(x, z) {
  return {
    lat: ORIGIN.lat - z / M_PER_LAT,
    lon: ORIGIN.lon + x / M_PER_LON,
  };
}

// 게임 월드 경계 (지면 텍스처/미니맵이 덮는 범위)
export const WORLD = { x0: -900, x1: 2900, z0: -1000, z1: 1300 };
// 플레이어가 이동할 수 있는 범위
export const PLAY = { x0: -680, x1: 2750, z0: -920, z1: 1220 };
