// 2D(xz 평면) 충돌 + 지형 높이.
import { RIVERS, BRIDGES, WOLSEONG, WOLJI } from './layout.js';
import { PLAY } from './geo.js';

const CELL = 24;

function distToSegment(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const len2 = dx * dx + dz * dz || 1;
  let t = ((px - ax) * dx + (pz - az) * dz) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + dx * t, cz = az + dz * t;
  return Math.hypot(px - cx, pz - cz);
}

export function distToPolyline(px, pz, pts) {
  let d = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    d = Math.min(d, distToSegment(px, pz, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]));
  }
  return d;
}

export function pointInPoly(x, z, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

function inBridge(b, x, z, margin = 0) {
  const c = Math.cos(b.angle), s = Math.sin(b.angle);
  const dx = x - b.x, dz = z - b.z;
  // 다리는 z(남북) 방향으로 놓였다고 보고 angle 만큼 회전
  const along = dx * s + dz * c;
  const across = dx * c - dz * s;
  return Math.abs(along) <= b.len / 2 + margin && Math.abs(across) <= b.w / 2 - 0.6 + margin;
}

export function bridgeAt(x, z) {
  for (const b of BRIDGES) if (inBridge(b, x, z)) return b;
  return null;
}

export function inWater(x, z) {
  for (const r of RIVERS) {
    if (distToPolyline(x, z, r.pts) < r.w / 2 - 2) return true;
  }
  if (pointInPoly(x, z, WOLJI.poly)) {
    for (const [ix, iz, ir] of WOLJI.islands) if (Math.hypot(x - ix, z - iz) < ir) return false;
    return true;
  }
  return false;
}

const smooth = (e0, e1, x) => {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

export function wolseongHeight(x, z) {
  const W = WOLSEONG;
  const d = Math.sqrt(((x - W.x) / W.a) ** 2 + ((z - W.z) / W.b) ** 2);
  if (d >= 1) return 0;
  // 북쪽이 살짝 오목한 반달 모양: 북쪽 가장자리 부근을 깎는다
  const notch = Math.max(0, 1 - Math.hypot((x - W.x) / (W.a * 0.55), (z - (W.z - W.b * 1.15)) / (W.b * 0.6)));
  return W.h * smooth(1.0, 0.8, d) * (1 - smooth(0.0, 0.4, notch));
}

export function groundHeight(x, z) {
  const b = bridgeAt(x, z);
  if (b) {
    if (b.kind === 'woljeonggyo') {
      // 양 끝 경사로
      const c = Math.cos(b.angle), s = Math.sin(b.angle);
      const along = Math.abs((x - b.x) * s + (z - b.z) * c);
      return b.y * (1 - smooth(b.len / 2 - 8, b.len / 2, along));
    }
    return b.y;
  }
  return wolseongHeight(x, z);
}

export class Colliders {
  constructor() {
    this.grid = new Map();
  }

  _key(cx, cz) {
    return cx * 100003 + cz;
  }

  _insert(shape, minx, minz, maxx, maxz) {
    const c0 = Math.floor(minx / CELL), c1 = Math.floor(maxx / CELL);
    const r0 = Math.floor(minz / CELL), r1 = Math.floor(maxz / CELL);
    for (let i = c0; i <= c1; i++) {
      for (let j = r0; j <= r1; j++) {
        const k = this._key(i, j);
        let arr = this.grid.get(k);
        if (!arr) this.grid.set(k, (arr = []));
        arr.push(shape);
      }
    }
  }

  addCircle(x, z, r) {
    const s = { t: 0, x, z, r };
    this._insert(s, x - r, z - r, x + r, z + r);
    return s;
  }

  // 회전된 직사각형: 중심, 반폭(hw: 로컬 x), 반깊이(hd: 로컬 z), 회전 rot(y축)
  addBox(x, z, hw, hd, rot = 0) {
    const s = { t: 1, x, z, hw, hd, c: Math.cos(rot), s: Math.sin(rot) };
    const R = Math.hypot(hw, hd);
    this._insert(s, x - R, z - R, x + R, z + R);
    return s;
  }

  _hits(s, x, z, r) {
    if (s.t === 0) return Math.hypot(x - s.x, z - s.z) < s.r + r;
    const dx = x - s.x, dz = z - s.z;
    // 월드 → 로컬 (y축 회전 rot의 역변환)
    const lx = dx * s.c - dz * s.s;
    const lz = dx * s.s + dz * s.c;
    const qx = Math.max(Math.abs(lx) - s.hw, 0);
    const qz = Math.max(Math.abs(lz) - s.hd, 0);
    return qx * qx + qz * qz < r * r;
  }

  blocked(x, z, r) {
    if (x < PLAY.x0 || x > PLAY.x1 || z < PLAY.z0 || z > PLAY.z1) return true;
    if (inWater(x, z) && !bridgeAt(x, z)) return true;
    const c0 = Math.floor((x - r) / CELL), c1 = Math.floor((x + r) / CELL);
    const r0 = Math.floor((z - r) / CELL), r1 = Math.floor((z + r) / CELL);
    for (let i = c0; i <= c1; i++) {
      for (let j = r0; j <= r1; j++) {
        const arr = this.grid.get(this._key(i, j));
        if (!arr) continue;
        for (const s of arr) if (this._hits(s, x, z, r)) return true;
      }
    }
    return false;
  }

  // 축 분리 슬라이딩 이동
  move(pos, dx, dz, r) {
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / (r * 0.8)));
    const sx = dx / steps, sz = dz / steps;
    let hit = false;
    for (let i = 0; i < steps; i++) {
      if (!this.blocked(pos.x + sx, pos.z, r)) pos.x += sx;
      else hit = true;
      if (!this.blocked(pos.x, pos.z + sz, r)) pos.z += sz;
      else hit = true;
    }
    return hit;
  }
}
