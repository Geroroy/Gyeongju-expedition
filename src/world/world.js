// 월드 조립: 지면 → 고분 → 랜드마크 → 황리단길 상점 → 한옥/도심 채우기 → 나무 → 산
import * as THREE from 'three';
import { Colliders, distToPolyline } from './collision.js';
import { buildGround } from './ground.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CityBuilder, rng, pick, AUTUMN, GREENS, PINE } from './builders.js';
import { buildLandmarks, NIGHT, MAT, pavilion, glowAtNight } from './landmarks.js';
import { ROADS, MOUNDS, DAEREUNGWON, LANDMARKS } from './layout.js';
import { SIGNS } from './textures.js';
import { staticBatch } from './batch.js';

function clearOfRoads(x, z, half, extra = 1) {
  for (const r of ROADS) {
    if (distToPolyline(x, z, r.pts) < r.w / 2 + half + extra) return false;
  }
  return true;
}

// 건물을 짓지 않는 구역: 노서동 고분공원
const KEEP_OUT = [[30, -610, 340, -310]];

function nearLandmarkCore(x, z, pad = 0) {
  for (const l of LANDMARKS) {
    if (l.id === 'hwangnidan' || l.id === 'gyochon' || l.id === 'wolseong' || l.id === 'daereungwon') continue;
    if (Math.hypot(x - l.pos.x, z - l.pos.z) < l.radius * 0.6 + pad) return true;
  }
  return false;
}

export function buildWorld(scene, renderer) {
  const root = new THREE.Group();
  scene.add(root);
  const colliders = new Colliders();
  const city = new CityBuilder(colliders);
  const ground = buildGround(scene, renderer);

  // ── 고분 ──
  const r = rng(2024);
  for (const m of MOUNDS) {
    const tint = new THREE.Color().setHSL(0.24 + r() * 0.03, 0.42, 0.42 + r() * 0.06);
    city.addMound(m.x, m.z, m.r, m.h, tint.getHex() | 0);
  }

  // ── 랜드마크 ──
  const lm = buildLandmarks(root, colliders, city);

  // ── 황리단길 상점 (도로 양쪽, 길을 바라보게) ──
  const alleyW = [-205, -112, -22, 66, 150];
  const alleyE = [-170, -50, 92];
  let signIdx = 0;
  for (const side of [-1, 1]) {
    let z = -292;
    const alleys = side < 0 ? alleyW : alleyE;
    while (z < 214) {
      const w = 8 + r() * 3.5;
      const d = 7 + r() * 2.5;
      const cz = z + w / 2;
      if (alleys.some((a) => Math.abs(a - cz) < w / 2 + 3)) {
        z += 4;
        continue;
      }
      const cx = side * (4.5 + 1.8 + d / 2);
      const rot = side < 0 ? Math.PI / 2 : -Math.PI / 2;
      if (r() < 0.82) {
        city.addHanok(cx, cz, w, d, rot, { sign: signIdx++ % SIGNS.length });
      } else {
        city.addModern(cx, cz, w, d, 6 + r() * 2, rot, pick([0xf2e6d0, 0xe9d7c0, 0xd8cdbd], r));
      }
      z += w + 0.6 + r() * 1.2;
    }
  }
  // 거리 가로수(은행나무)와 가로등
  const lampMat = new THREE.MeshBasicMaterial({ color: 0x8a6a40 });
  glowAtNight(lampMat, 0xffc36b);
  const lampGeo = new THREE.BoxGeometry(0.4, 0.55, 0.4);
  const postGeo = new THREE.CylinderGeometry(0.06, 0.08, 3.4, 6).translate(0, 1.7, 0);
  const lampPosts = [];
  for (let z = -280; z < 210; z += 24) {
    for (const side of [-1, 1]) {
      const lz = z + (side > 0 ? 12 : 0);
      if ([...alleyW, ...alleyE].some((a) => Math.abs(a - lz) < 5)) continue;
      lampPosts.push([side * 5.0, lz]);
    }
  }
  const postInst = new THREE.InstancedMesh(postGeo, MAT.wood, lampPosts.length);
  const lampInst = new THREE.InstancedMesh(lampGeo, lampMat, lampPosts.length);
  const mtx = new THREE.Matrix4();
  lampPosts.forEach(([x, z], i) => {
    postInst.setMatrixAt(i, mtx.makeTranslation(x, 0, z));
    lampInst.setMatrixAt(i, mtx.makeTranslation(x, 3.6, z));
    colliders.addCircle(x, z, 0.2);
  });
  root.add(postInst, lampInst);

  // ── 교촌마을: 담장 두른 한옥 + 최부자댁 ──
  const gyochon = LANDMARKS.find((l) => l.id === 'gyochon').pos;
  pavilion(root, colliders, gyochon.x + 10, gyochon.z - 10, 14, 8, 0, { walls: true, baseH: 1.0, pillarH: 3.0 });
  city.addHanok(gyochon.x + 10, gyochon.z + 14, 10, 7, Math.PI, { lamp: true });
  city.addHanok(gyochon.x - 6, gyochon.z + 2, 7, 6, Math.PI / 2, { lamp: true });
  for (const [ax, az, bx, bz] of [[-14, -22, 34, -22], [34, -22, 34, 24], [-14, 24, 6, 24], [14, 24, 34, 24], [-14, -22, -14, 24]]) {
    city.addWall(gyochon.x + ax, gyochon.z + az, gyochon.x + bx, gyochon.z + bz, 1.7);
  }
  // 경주향교
  pavilion(root, colliders, gyochon.x - 60, gyochon.z - 40, 15, 8, 0, { walls: true, baseH: 0.9, pillarH: 3.2 });
  city.addWall(gyochon.x - 80, gyochon.z - 58, gyochon.x - 40, gyochon.z - 58, 1.6);

  // ── 한옥 채우기 (황남동, 교촌) ──
  const fillHanok = (x0, z0, x1, z1, step, seed) => {
    const fr = rng(seed);
    for (let z = z0; z < z1; z += step) {
      for (let x = x0; x < x1; x += step) {
        const w = 7 + fr() * 4, d = 6 + fr() * 2.5;
        const cx = x + (fr() - 0.5) * 2.5, cz = z + (fr() - 0.5) * 2.5;
        const rot = fr() < 0.75 ? 0 : Math.PI / 2;
        const half = Math.max(w, d) / 2 + 0.9;
        if (!clearOfRoads(cx, cz, Math.max(w, d) / 2, 1.2)) continue;
        if (colliders.blocked(cx, cz, half)) continue;
        if (fr() < 0.12) {
          city.addTree(cx, cz, { type: 'round', s: 1 + fr() * 0.4, color: pick(AUTUMN, fr), rnd: fr });
          continue;
        }
        city.addHanok(cx, cz, w, d, rot, { sign: -1, lamp: fr() < 0.35 });
      }
    }
  };
  fillHanok(-240, -295, 114, 222, 13.5, 11);
  fillHanok(432, 765, 690, 925, 15, 12);

  // ── 도심 현대 건물 ──
  const fillModern = (x0, z0, x1, z1, step, seed, hMin, hMax) => {
    const fr = rng(seed);
    for (let z = z0; z < z1; z += step) {
      for (let x = x0; x < x1; x += step) {
        const w = 10 + fr() * (step - 12), d = 10 + fr() * (step - 12);
        const cx = x + step / 2 + (fr() - 0.5) * 3, cz = z + step / 2 + (fr() - 0.5) * 3;
        const half = Math.max(w, d) / 2;
        if (!clearOfRoads(cx, cz, half, 2)) continue;
        if (colliders.blocked(cx, cz, half * 1.15)) continue;
        if (nearLandmarkCore(cx, cz, half)) continue;
        if (KEEP_OUT.some(([a, b, c, d]) => cx > a - half && cx < c + half && cz > b - half && cz < d + half)) continue;
        if (fr() < 0.1) continue;
        const tint = pick([0xffffff, 0xf3e8dc, 0xe6ebee, 0xefe2cf, 0xdcd6cc, 0xf5f0e6], fr);
        city.addModern(cx, cz, w, d, hMin + fr() * (hMax - hMin), 0, tint);
      }
    }
  };
  fillModern(-680, -930, 1480, -312, 26, 21, 6, 16);
  fillModern(-680, -296, -252, 224, 24, 22, 5, 11);
  fillModern(-680, 234, -64, 640, 26, 23, 4, 9);

  // ── 나무 ──
  // 대릉원 소나무 숲
  const tr = rng(303);
  const D = DAEREUNGWON;
  for (let i = 0; i < 900; i++) {
    const x = D.x0 + 6 + tr() * (D.x1 - D.x0 - 12), z = D.z0 + 6 + tr() * (D.z1 - D.z0 - 12);
    if (colliders.blocked(x, z, 4)) continue;
    if (!clearOfRoads(x, z, 1.5, 0)) continue;
    // 고분 사이 잔디는 넓게 비워 두고 가장자리 위주로
    const edge = Math.min(x - D.x0, D.x1 - x, z - D.z0, D.z1 - z);
    if (edge > 40 && tr() < 0.75) continue;
    const pine = tr() < 0.75;
    city.addTree(x, z, { type: pine ? 'pine' : 'round', s: 0.9 + tr() * 0.5, color: pine ? pick(PINE, tr) : pick(AUTUMN, tr), rnd: tr });
  }
  // 목련 포토존: 두 고분 사이 한 그루
  city.addTree(292, -34, { type: 'round', s: 1.5, color: 0x6f8f35, rnd: tr });
  // 노서동 고분공원
  for (let i = 0; i < 70; i++) {
    const x = 40 + tr() * 290, z = -600 + tr() * 280;
    if (colliders.blocked(x, z, 3) || !clearOfRoads(x, z, 1.5, 0)) continue;
    city.addTree(x, z, { type: tr() < 0.5 ? 'pine' : 'round', s: 1 + tr() * 0.4, color: tr() < 0.5 ? pick(PINE, tr) : pick(AUTUMN, tr), rnd: tr });
  }
  // 동부사적지 · 쪽샘 드문드문
  for (let i = 0; i < 260; i++) {
    const x = 680 + tr() * 790, z = -280 + tr() * 900;
    if (colliders.blocked(x, z, 3) || !clearOfRoads(x, z, 2, 0)) continue;
    if (Math.hypot(x - 920, z - 311) < 40) continue; // 첨성대 주변 시야 확보
    if (x > 1020 && x < 1300 && z > 340 && z < 530) continue; // 핑크뮬리
    if (tr() < 0.45) continue;
    city.addTree(x, z, { type: tr() < 0.3 ? 'pine' : tr() < 0.3 ? 'tall' : 'round', s: 0.9 + tr() * 0.6, color: tr() < 0.3 ? pick(PINE, tr) : pick(AUTUMN, tr), rnd: tr });
  }
  // 주요 도로 가로수 (은행나무 노랑)
  for (const rd of ROADS) {
    if (rd.type !== 'road' || rd.w < 11) continue;
    for (let i = 0; i < rd.pts.length - 1; i++) {
      const [ax, az] = rd.pts[i], [bx, bz] = rd.pts[i + 1];
      const len = Math.hypot(bx - ax, bz - az);
      const nx = -(bz - az) / len, nz = (bx - ax) / len;
      for (let t = 8; t < len - 8; t += 14) {
        for (const s of [-1, 1]) {
          const x = ax + ((bx - ax) * t) / len + nx * s * (rd.w / 2 + 1.6);
          const z = az + ((bz - az) * t) / len + nz * s * (rd.w / 2 + 1.6);
          if (colliders.blocked(x, z, 1.2) || !clearOfRoads(x, z, 0.5, 0.2)) continue;
          city.addTree(x, z, { type: 'round', s: 0.85 + tr() * 0.2, color: tr() < 0.75 ? 0xe2b52a : 0xd99a22, rnd: tr });
        }
      }
    }
  }
  // 남천 둔치 버드나무
  for (let i = 0; i < 160; i++) {
    const x = -600 + tr() * 3300, z = 860 + tr() * 260;
    if (colliders.blocked(x, z, 2) || !clearOfRoads(x, z, 1, 0)) continue;
    city.addTree(x, z, { type: tr() < 0.5 ? 'tall' : 'round', s: 0.7 + tr() * 0.5, color: tr() < 0.5 ? pick(GREENS, tr) : pick(AUTUMN, tr), rnd: tr });
  }
  // 황룡사지 주변 들판 나무 몇 그루
  for (let i = 0; i < 40; i++) {
    const x = 1760 + tr() * 1000, z = -230 + tr() * 990;
    if (colliders.blocked(x, z, 3) || !clearOfRoads(x, z, 1, 0) || nearLandmarkCore(x, z, 20)) continue;
    city.addTree(x, z, { type: 'round', s: 1.1 + tr() * 0.6, color: pick(AUTUMN, tr), rnd: tr });
  }

  const meshes = city.build(root);
  if (meshes.windowGlow) {
    meshes.windowGlow.userData.dynamic = true;
    NIGHT.hooks.push((k) => {
      meshes.windowGlow.visible = k > 0.02;
      meshes.windowGlow.material.opacity = k * 0.85;
    });
  }
  staticBatch(root);
  buildMountains(scene);

  return { root, colliders, city, meshes, groundCanvas: ground.canvas, pxPerM: ground.pxPerM, muhly: lm.muhly };
}

// 경주 분지를 둘러싼 산 (남산, 선도산, 명활산, 소금강산 방향)
function buildMountains(scene) {
  const r = rng(404);
  const mat = new THREE.MeshLambertMaterial({ color: 0x6f8a6a });
  const geos = [];
  const center = new THREE.Vector2(1000, 150);
  for (let i = 0; i < 46; i++) {
    const a = (i / 46) * Math.PI * 2 + r() * 0.06;
    // 남쪽(+z, a≈π/2)의 남산은 가깝고 크게
    const south = Math.max(0, Math.sin(a));
    const dist = 3900 + r() * 900 - south * 1100;
    const h = 200 + r() * 220 + south * 230;
    const rad = 900 + r() * 600;
    const g = new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    const p = g.attributes.position;
    for (let k = 0; k < p.count; k++) {
      const x = p.getX(k), y = p.getY(k), z = p.getZ(k);
      const n = 1 + 0.12 * Math.sin(x * 5 + i) * Math.cos(z * 4 + i * 2);
      // 완만한 능선: 봉우리는 뾰족하게, 아래는 넓게
      p.setXYZ(k, x * rad * n, Math.pow(y, 1.6) * h * n, z * rad * (0.7 + 0.3 * n));
    }
    g.computeVertexNormals();
    g.translate(center.x + Math.cos(a) * dist, -10, center.y + Math.sin(a) * dist);
    geos.push(g);
  }
  const merged = mergeGeometries(geos);
  scene.add(new THREE.Mesh(merged, mat));
}
