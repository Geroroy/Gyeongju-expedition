// 개별 랜드마크 모델: 첨성대, 동궁과 월지, 월정교, 계림, 월성, 황룡사지, 분황사, 박물관 등
import * as THREE from 'three';
import { makeRoofGeometry, makeMoundGeometry, rng, AUTUMN, PINE, pick } from './builders.js';
import { cheomseongdaeTexture, brickTexture, roofTexture, labelTexture } from './textures.js';
import { LANDMARKS, WOLJI, WOLSEONG, RIVERS, BRIDGES, DAEREUNGWON } from './layout.js';
import { wolseongHeight, distToPolyline } from './collision.js';

const P = Object.fromEntries(LANDMARKS.map((l) => [l.id, l.pos]));

const roofGeo = makeRoofGeometry();
const pyramidRoofGeo = makeRoofGeometry({ ridge: 0.02, lift: 0.22 });
const roofTex = roofTexture();

export const MAT = {
  granite: new THREE.MeshLambertMaterial({ color: 0xbdb3a0 }),
  graniteDark: new THREE.MeshLambertMaterial({ color: 0x9a907f }),
  redPillar: new THREE.MeshLambertMaterial({ color: 0x9e2f24 }),
  greenBeam: new THREE.MeshLambertMaterial({ color: 0x2f7a6a }),
  wood: new THREE.MeshLambertMaterial({ color: 0x7a5434 }),
  deck: new THREE.MeshLambertMaterial({ color: 0x8b6b4a }),
  roof: new THREE.MeshLambertMaterial({ map: roofTex, side: THREE.DoubleSide }),
  ridge: new THREE.MeshLambertMaterial({ color: 0x2c2f36 }),
  plaster: new THREE.MeshLambertMaterial({ color: 0xece4d2 }),
  water: new THREE.MeshPhongMaterial({ color: 0x3f7486, specular: 0x9fc6d4, shininess: 90, transparent: true, opacity: 0.92 }),
  lawn: new THREE.MeshLambertMaterial({ color: 0x6f9846, vertexColors: true }),
  bronze: new THREE.MeshStandardMaterial({ color: 0x5f6f5c, metalness: 0.7, roughness: 0.45 }),
  ghost: new THREE.MeshBasicMaterial({ color: 0xffe2a8, transparent: true, opacity: 0.16, depthWrite: false }),
  ghostLine: new THREE.LineBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.45 }),
  dark: new THREE.MeshLambertMaterial({ color: 0x1d1a17 }),
  muhly: new THREE.MeshLambertMaterial({ color: 0xffffff }),
  modernMuseum: new THREE.MeshLambertMaterial({ color: 0xd9d2c3 }),
};

// 밤에 켜질 재질/조명
export const NIGHT = { mats: [], lights: [], hooks: [] };
export function glowAtNight(mat, color, intensity = 1) {
  mat.userData.dayColor = mat.color.clone();
  NIGHT.mats.push({ mat, color: new THREE.Color(color), intensity });
}

function mesh(geo, mat, x = 0, y = 0, z = 0, ry = 0, parent) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.y = ry;
  m.castShadow = true;
  m.receiveShadow = true;
  if (parent) parent.add(m);
  return m;
}
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0);
const cyl = (r0, r1, h, seg = 10) => new THREE.CylinderGeometry(r0, r1, h, seg).translate(0, h / 2, 0);

function roofMesh(parent, x, y, z, w, h, d, rot = 0, geo = roofGeo, mat = MAT.roof) {
  const m = mesh(geo, mat, x, y, z, rot, parent);
  m.scale.set(w, h, d);
  // 용마루
  if (geo === roofGeo) {
    const r = mesh(box(w * 0.62, 0.45, 0.6), MAT.ridge, x, y + h - 0.15, z, rot, parent);
    r.castShadow = false;
  }
  return m;
}

// 단청 전각: 돌 기단 + 붉은 기둥 + 녹색 창방 + 기와지붕
export function pavilion(parent, colliders, x, z, w, d, rot = 0, { baseH = 1.2, pillarH = 3.6, walls = false, roofScale = 1, collideBase = true } = {}) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rot;
  parent.add(g);
  mesh(box(w + 1.6, baseH, d + 1.6), MAT.granite, 0, 0, 0, 0, g);
  // 계단
  mesh(box(3, baseH * 0.5, 1.2), MAT.graniteDark, 0, 0, (d + 1.6) / 2 + 0.6, 0, g);
  const nx = Math.max(2, Math.round(w / 3.2)), nz = Math.max(2, Math.round(d / 3.2));
  const pg = cyl(0.22, 0.26, pillarH, 8);
  for (let i = 0; i <= nx; i++) {
    for (let j = 0; j <= nz; j++) {
      if (i !== 0 && i !== nx && j !== 0 && j !== nz) continue;
      mesh(pg, MAT.redPillar, -w / 2 + (i * w) / nx, baseH, -d / 2 + (j * d) / nz, 0, g);
    }
  }
  if (walls) {
    const wm = mesh(box(w - 0.4, pillarH - 0.8, d - 0.4), MAT.plaster, 0, baseH, 0, 0, g);
    wm.castShadow = true;
  }
  mesh(box(w + 0.6, 0.55, d + 0.6), MAT.greenBeam, 0, baseH + pillarH - 0.2, 0, 0, g);
  const rw = (w + 3.2) * roofScale, rd = (d + 3.2) * roofScale;
  roofMesh(g, 0, baseH + pillarH + 0.2, 0, rw, 0.36 * rd + 1.2, rd);
  if (colliders && collideBase) colliders.addBox(x, z, (w + 1.6) / 2, (d + 1.6) / 2, rot);
  return g;
}

function infoBoard(parent, colliders, x, z, rot, text) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rot;
  mesh(box(0.12, 1.4, 0.12), MAT.wood, -0.75, 0, 0, 0, g);
  mesh(box(0.12, 1.4, 0.12), MAT.wood, 0.75, 0, 0, 0, g);
  const tex = labelTexture(text);
  const board = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.5), new THREE.MeshLambertMaterial({ map: tex }));
  board.position.set(0, 1.55, 0.07);
  g.add(board);
  const back = mesh(box(2.0, 0.6, 0.1), MAT.wood, 0, 1.25, 0, 0, g);
  back.castShadow = false;
  parent.add(g);
  colliders.addBox(x, z, 1.0, 0.15, rot);
}

// ── 첨성대 ───────────────────────────────────────────────────────────
function buildCheomseongdae(root, colliders) {
  const { x, z } = P.cheomseongdae;
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  root.add(g);
  const stone = new THREE.MeshLambertMaterial({ map: cheomseongdaeTexture(), color: 0xffffff });
  const stoneTop = new THREE.MeshLambertMaterial({ color: 0xc2b59b });
  glowAtNight(stone, 0xb07a2a, 0.55);
  glowAtNight(stoneTop, 0xb07a2a, 0.5);
  stone.map.repeat.set(3, 1);

  mesh(box(6.2, 0.38, 6.2), stoneTop, 0, 0, 0, 0, g);
  mesh(box(5.36, 0.4, 5.36), stoneTop, 0, 0.38, 0, 0, g);
  const H = 7.85, y0 = 0.78;
  const pts = [];
  for (let i = 0; i <= 30; i++) {
    const t = i / 30;
    pts.push(new THREE.Vector2(1.43 + 1.04 * Math.pow(1 - t, 1.7), t * H));
  }
  const body = mesh(new THREE.LatheGeometry(pts, 48), stone, 0, y0, 0, 0, g);
  body.material.side = THREE.FrontSide;
  // 남쪽 창 (13~15단)
  const tw = 0.5;
  const rw = 1.43 + 1.04 * Math.pow(1 - tw, 1.7);
  mesh(box(1.0, 1.0, 0.5), MAT.dark, 0, y0 + H * 0.46, rw - 0.12, 0, g);
  // 정자석 (井)
  const top = y0 + H;
  const beam = box(3.06, 0.3, 0.32);
  for (const s of [-1, 1]) {
    mesh(beam, stoneTop, 0, top, s * 1.37, 0, g);
    mesh(beam, stoneTop, s * 1.37, top + 0.3, 0, Math.PI / 2, g);
  }
  for (const s of [-1, 1]) {
    mesh(beam, stoneTop, 0, top + 0.6, s * 1.37, 0, g);
    mesh(beam, stoneTop, s * 1.37, top + 0.9, 0, Math.PI / 2, g);
  }
  colliders.addBox(x, z, 3.1, 3.1, 0);
  // 낮은 울타리 (둥근 목책)
  const postGeo = cyl(0.06, 0.06, 0.6, 5);
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    mesh(postGeo, MAT.wood, Math.cos(a) * 11, 0, Math.sin(a) * 11, 0, g).castShadow = false;
  }
  const rope = new THREE.Mesh(new THREE.TorusGeometry(11, 0.035, 4, 64), MAT.wood);
  rope.rotation.x = Math.PI / 2;
  rope.position.y = 0.55;
  g.add(rope);

  const light = new THREE.PointLight(0xffb45a, 0, 30, 1.5);
  light.position.set(0, 3, 6);
  g.add(light);
  NIGHT.lights.push({ light, intensity: 160 });
}

// ── 물 (강, 월지) ────────────────────────────────────────────────────
function ribbon(pts, w, y) {
  const pos = [], idx = [];
  for (let i = 0; i < pts.length; i++) {
    const [x, z] = pts[i];
    const [ax, az] = pts[Math.max(0, i - 1)];
    const [bx, bz] = pts[Math.min(pts.length - 1, i + 1)];
    let dx = bx - ax, dz = bz - az;
    const l = Math.hypot(dx, dz) || 1;
    dx /= l; dz /= l;
    pos.push(x - dz * w / 2, y, z + dx * w / 2, x + dz * w / 2, y, z - dx * w / 2);
    if (i > 0) {
      const a = (i - 1) * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function buildWater(root) {
  for (const r of RIVERS) {
    const m = new THREE.Mesh(ribbon(r.pts, r.w, 0.06), MAT.water);
    m.receiveShadow = true;
    root.add(m);
  }
  const shape = new THREE.Shape(WOLJI.poly.map(([x, z]) => new THREE.Vector2(x, -z)));
  const pg = new THREE.ShapeGeometry(shape, 8).rotateX(-Math.PI / 2);
  const pond = new THREE.Mesh(pg, MAT.water);
  pond.position.y = 0.07;
  pond.receiveShadow = true;
  root.add(pond);
}

// ── 다리 ─────────────────────────────────────────────────────────────
function buildBridges(root, colliders) {
  for (const b of BRIDGES) {
    const g = new THREE.Group();
    g.position.set(b.x, 0, b.z);
    g.rotation.y = b.angle;
    root.add(g);
    if (b.kind === 'road') {
      mesh(box(b.w, 0.6, b.len), MAT.graniteDark, 0, -0.2, 0, 0, g);
      for (const s of [-1, 1]) mesh(box(0.4, 1.0, b.len), MAT.granite, s * (b.w / 2 - 0.2), 0.4, 0, 0, g);
      for (let a = -b.len / 2 + 12; a < b.len / 2 - 6; a += 16) mesh(box(b.w - 1, 1.2, 2.2), MAT.graniteDark, 0, -1.2, a, 0, g);
    } else if (b.kind === 'stepping') {
      const sg = cyl(0.8, 0.9, 0.5, 7);
      for (let a = -b.len / 2; a <= b.len / 2; a += 1.6) mesh(sg, MAT.granite, (Math.sin(a) * 0.3), -0.15, a, a, g);
    } else if (b.kind === 'woljeonggyo') {
      buildWoljeonggyo(g, b, colliders);
    }
  }
}

function buildWoljeonggyo(g, b, colliders) {
  const span = 62, W = b.w, y = b.y;
  // 배 모양 돌 교각
  for (const a of [-21, -7, 7, 21]) {
    mesh(box(W + 1.5, y + 1.4, 3.2), MAT.granite, 0, -1.4, a, 0, g);
    const prow = mesh(new THREE.ConeGeometry(1.6, W + 1.5, 4, 1).rotateZ(Math.PI / 2).rotateX(Math.PI / 4), MAT.granite, 0, y * 0.4, a, 0, g);
    prow.scale.set(1, 0.9, 1);
  }
  // 상판 + 경사로
  mesh(box(W, 0.4, span), MAT.deck, 0, y - 0.4, 0, 0, g);
  for (const s of [-1, 1]) {
    const ramp = mesh(box(W, 0.3, 8.4), MAT.graniteDark, 0, 0, s * (span / 2 + 4), 0, g);
    ramp.position.y = y / 2 - 0.3;
    ramp.rotation.x = s * Math.atan2(y, 8);
  }
  // 회랑 기둥 · 난간
  const pg = cyl(0.2, 0.22, 3.6, 8);
  for (let a = -span / 2 + 1; a <= span / 2 - 1; a += 4) {
    for (const s of [-1, 1]) mesh(pg, MAT.redPillar, s * (W / 2 - 0.5), y, a, 0, g);
  }
  for (const s of [-1, 1]) {
    mesh(box(0.15, 0.9, span), MAT.redPillar, s * (W / 2 - 0.5), y, 0, 0, g);
    mesh(box(0.5, 0.5, span), MAT.greenBeam, s * (W / 2 - 0.5), y + 3.5, 0, 0, g);
  }
  // 긴 지붕 (용마루가 다리 방향으로)
  roofMesh(g, 0, y + 3.8, 0, span + 2, 3.6, W + 3, Math.PI / 2);
  // 양쪽 문루 (2층 누각)
  for (const s of [-1, 1]) {
    const a = s * (span / 2 + 6);
    const gw = W + 2, gd = 8;
    const gg = new THREE.Group();
    gg.position.set(0, 0, a);
    g.add(gg);
    // 1층: 석축 + 통로
    for (const sx of [-1, 1]) mesh(box(2.4, 3.4, gd), MAT.granite, sx * (gw / 2 - 1.2), 0, 0, 0, gg);
    mesh(box(gw, 1.1, gd), MAT.granite, 0, 3.4, 0, 0, gg);
    // 2층: 누각
    const pg2 = cyl(0.22, 0.25, 3.4, 8);
    for (const px of [-1, -0.33, 0.33, 1]) for (const pz of [-1, 1]) mesh(pg2, MAT.redPillar, px * (gw / 2 - 0.6), 4.5, pz * (gd / 2 - 0.6), 0, gg);
    mesh(box(gw, 0.5, gd), MAT.greenBeam, 0, 7.7, 0, 0, gg);
    mesh(box(gw - 1, 1.0, 0.15), MAT.redPillar, 0, 4.5, gd / 2 - 0.6, 0, gg);
    roofMesh(gg, 0, 8.0, 0, gw + 4, 4.4, gd + 4, 0);
    // 충돌: 양쪽 석축만 (가운데 통로는 열어둠)
    const wx = b.x + Math.sin(b.angle) * a, wz = b.z + Math.cos(b.angle) * a;
    for (const sx of [-1, 1]) {
      const ox = Math.cos(b.angle) * sx * (gw / 2 - 1.2), oz = -Math.sin(b.angle) * sx * (gw / 2 - 1.2);
      colliders.addBox(wx + ox, wz + oz, 1.2, gd / 2, b.angle);
    }
  }
  // 등불
  const lampMat = new THREE.MeshBasicMaterial({ color: 0x8a6a40 });
  glowAtNight(lampMat, 0xffc36b, 1);
  for (let a = -span / 2 + 3; a <= span / 2 - 3; a += 8) {
    for (const s of [-1, 1]) {
      const lamp = mesh(new THREE.SphereGeometry(0.28, 8, 6), lampMat, s * (W / 2 - 0.5), y + 3.0, a, 0, g);
      lamp.castShadow = false;
    }
  }
  const light = new THREE.PointLight(0xffb060, 0, 70, 1.4);
  light.position.set(0, y + 6, 0);
  g.add(light);
  NIGHT.lights.push({ light, intensity: 500 });
}

// ── 동궁과 월지 ──────────────────────────────────────────────────────
function buildDonggung(root, colliders, city) {
  const c = WOLJI.center;
  // 호안 석축
  const poly = WOLJI.poly;
  for (let i = 0; i < poly.length; i++) {
    const [ax, az] = poly[i], [bx, bz] = poly[(i + 1) % poly.length];
    const len = Math.hypot(bx - ax, bz - az);
    const m = mesh(box(1.2, 0.8, len + 1), MAT.graniteDark, (ax + bx) / 2, -0.3, (az + bz) / 2, Math.atan2(bx - ax, bz - az), root);
    m.castShadow = false;
  }
  // 섬
  const r = rng(77);
  const islandGeo = makeMoundGeometry();
  for (const [ix, iz, ir] of WOLJI.islands) {
    const m = mesh(islandGeo, MAT.lawn, ix, -0.4, iz, 0, root);
    m.scale.set(ir, 3.2, ir);
    for (let k = 0; k < Math.round(ir / 2.5); k++) {
      const a = r() * Math.PI * 2, d = r() * ir * 0.5;
      city.addTree(ix + Math.cos(a) * d, iz + Math.sin(a) * d, { type: r() < 0.5 ? 'pine' : 'round', s: 0.8 + r() * 0.4, color: r() < 0.5 ? pick(PINE, r) : pick(AUTUMN, r), y: 2.0, collide: false, rnd: r });
    }
  }
  // 서쪽 호안의 복원 전각 3채 (동쪽 연못을 바라봄)
  const lamps = [];
  const defs = [[-90, -48, 11, 7], [-92, 0, 16, 9], [-90, 46, 11, 7]];
  for (const [dx, dz, w, d] of defs) {
    pavilion(root, colliders, c.x + dx, c.z + dz, w, d, Math.PI / 2, { baseH: 1.6 });
    lamps.push([c.x + dx + 6, c.z + dz]);
  }
  // 회랑
  mesh(box(4, 1.0, 100), MAT.granite, c.x - 100, 0, c.z, 0, root);
  colliders.addBox(c.x - 100, c.z, 2, 50, 0);

  // 야경 조명: 전각을 비추는 따뜻한 불빛 + 연못 반사용
  const lampMat = new THREE.MeshBasicMaterial({ color: 0x8a6a40 });
  glowAtNight(lampMat, 0xffc36b, 1);
  for (let i = 0; i < 26; i++) {
    const t = i / 26;
    const idx = Math.floor(t * poly.length);
    const [ax, az] = poly[idx], [bx, bz] = poly[(idx + 1) % poly.length];
    const f = t * poly.length - idx;
    const lx = ax + (bx - ax) * f, lz = az + (bz - az) * f;
    const dx = lx - c.x, dz = lz - c.z, dl = Math.hypot(dx, dz);
    const px = lx + (dx / dl) * 3, pz = lz + (dz / dl) * 3;
    mesh(box(0.3, 0.8, 0.3), MAT.granite, px, 0, pz, 0, root).castShadow = false;
    mesh(new THREE.BoxGeometry(0.45, 0.45, 0.45), lampMat, px, 1.0, pz, 0, root).castShadow = false;
  }
  for (const [lx, lz] of [[c.x - 78, c.z - 40], [c.x - 78, c.z + 40], [c.x - 20, c.z]]) {
    const light = new THREE.PointLight(0xffb060, 0, 110, 1.2);
    light.position.set(lx, 8, lz);
    root.add(light);
    NIGHT.lights.push({ light, intensity: 900 });
  }
}

// ── 계림 ─────────────────────────────────────────────────────────────
function buildGyerim(root, colliders, city) {
  const { x, z } = P.gyerim;
  const r = rng(31);
  for (let i = 0; i < 130; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 62;
    const tx = x + Math.cos(a) * d, tz = z + Math.sin(a) * d * 0.8;
    if (d < 9) continue;
    if (distToPolyline(tx, tz, [[920, 345], [950, 400], [965, 520], [990, 620]]) < 4) continue;
    if (distToPolyline(tx, tz, [[965, 520], [860, 640]]) < 4) continue;
    city.addTree(tx, tz, { type: r() < 0.7 ? 'tall' : 'round', s: 0.8 + r() * 0.6, color: r() < 0.55 ? pick(AUTUMN, r) : 0x5d7f34, rnd: r });
  }
  // 김알지 탄생 비각
  const bx = x + 2, bz = z + 2;
  pavilion(root, colliders, bx, bz, 3.6, 3.6, 0, { baseH: 0.5, pillarH: 2.6, walls: true });
  for (const [ax, az, bx2, bz2] of [[-5, -5, 5, -5], [5, -5, 5, 5], [-5, 5, -1.5, 5], [1.5, 5, 5, 5], [-5, -5, -5, 5]]) {
    city.addWall(bx + ax, bz + az, bx + bx2, bz + bz2, 1.4, 0.5);
  }
}

// ── 월성 (언덕 + 숲 + 석빙고) ─────────────────────────────────────────
function buildWolseong(root, colliders, city) {
  const W = WOLSEONG;
  const sx = 140, sz = 44;
  const g = new THREE.PlaneGeometry(W.a * 2 + 20, W.b * 2 + 20, sx, sz).rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  const col = [];
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) + W.x, z = p.getZ(i) + W.z;
    const h = wolseongHeight(x, z);
    p.setY(i, h > 0.01 ? h : -0.3);
    const n = Math.sin(x * 0.21) * Math.cos(z * 0.17) * 0.5 + 0.5;
    const k = 0.82 + n * 0.16;
    col.push(k, k * (h > 7 ? 1.02 : 0.98), k * 0.95);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  const hill = mesh(g, MAT.lawn, W.x, 0, W.z, 0, root);
  hill.castShadow = false;

  // 가장자리 숲, 가운데는 발굴지 잔디밭
  const r = rng(91);
  for (let i = 0; i < 520; i++) {
    const a = r() * Math.PI * 2, d = 0.55 + r() * 0.42;
    const tx = W.x + Math.cos(a) * W.a * d, tz = W.z + Math.sin(a) * W.b * d;
    const h = wolseongHeight(tx, tz);
    if (h < 0.3) continue;
    if (distToPolyline(tx, tz, [[990, 620], [1100, 670], [1250, 690], [1400, 700], [1560, 690], [1640, 700]]) < 4) continue;
    const type = r() < 0.45 ? 'pine' : r() < 0.5 ? 'tall' : 'round';
    city.addTree(tx, tz, { type, s: 0.7 + r() * 0.5, color: type === 'pine' ? pick(PINE, r) : pick(AUTUMN, r), y: h - 0.2, rnd: r });
  }
  // 석빙고
  const sbx = 1185, sbz = 690;
  const sy = wolseongHeight(sbx, sbz);
  const sb = new THREE.Group();
  sb.position.set(sbx, sy - 0.2, sbz);
  root.add(sb);
  const mound = mesh(makeMoundGeometry(), MAT.lawn, 0, 0, 0, 0, sb);
  mound.scale.set(5.5, 4.2, 10);
  for (const dz of [-5, 0, 5]) {
    mesh(box(0.9, 1.2, 0.9), MAT.granite, 0, 3.6, dz, 0, sb);
    mesh(box(1.4, 0.2, 1.4), MAT.granite, 0, 4.8, dz, 0, sb);
  }
  const gate = new THREE.Group();
  gate.position.set(0, 0, 10);
  sb.add(gate);
  mesh(box(5, 2.8, 1), MAT.granite, 0, 0, 0, 0, gate);
  mesh(box(1.4, 1.9, 1.1), MAT.dark, 0, 0, 0.05, 0, gate);
  colliders.addBox(sbx, sbz + 1, 5, 10.5, 0);
}

// ── 대릉원 담장과 문 ────────────────────────────────────────────────
function buildDaereungwonWalls(root, colliders, city) {
  const D = DAEREUNGWON;
  const seg = (ax, az, bx, bz, gaps) => {
    // gaps: 축 방향 좌표 범위 [from, to]
    const horiz = az === bz;
    const a0 = horiz ? ax : az, a1 = horiz ? bx : bz;
    let cur = a0;
    const sorted = [...gaps].sort((p, q) => p[0] - q[0]);
    for (const [g0, g1] of sorted) {
      if (g0 > cur) horiz ? city.addWall(cur, az, g0, az) : city.addWall(ax, cur, ax, g0);
      cur = Math.max(cur, g1);
    }
    if (cur < a1) horiz ? city.addWall(cur, az, a1, az) : city.addWall(ax, cur, ax, a1);
  };
  seg(D.x0, D.z0, D.x1, D.z0, []); // 북
  seg(D.x0, D.z1, D.x1, D.z1, [[553, 567]]); // 남(정문)
  seg(D.x0, D.z0, D.x0, D.z1, [[-55, -45]]); // 서(후문)
  seg(D.x1, D.z0, D.x1, D.z1, [[-156, -144]]); // 동
  const gates = [[560, D.z1, 0], [D.x0, -50, Math.PI / 2], [D.x1, -150, Math.PI / 2]];
  for (const [gx, gz, rot] of gates) {
    const gg = new THREE.Group();
    gg.position.set(gx, 0, gz);
    gg.rotation.y = rot;
    root.add(gg);
    const pg = cyl(0.25, 0.28, 3.4, 8);
    for (const s of [-1, 1]) {
      mesh(pg, MAT.redPillar, s * 4.6, 0, 0, 0, gg);
      const wx = gx + Math.cos(rot) * s * 4.6, wz = gz - Math.sin(rot) * s * 4.6;
      colliders.addCircle(wx, wz, 0.4);
    }
    mesh(box(10.4, 0.5, 1.2), MAT.greenBeam, 0, 3.3, 0, 0, gg);
    roofMesh(gg, 0, 3.6, 0, 12.5, 2.2, 4.0, 0);
  }
  // 천마총 입구 (남쪽)
  const cm = LANDMARKS.find((l) => l.id === 'cheonmachong').pos;
  const eg = new THREE.Group();
  eg.position.set(cm.x, 0, cm.z + 22);
  root.add(eg);
  mesh(box(7, 3.2, 6), MAT.granite, 0, 0, -2, 0, eg);
  mesh(box(2.4, 2.4, 0.4), MAT.dark, 0, 0, 1.05, 0, eg);
  roofMesh(eg, 0, 3.0, -2, 9.5, 2.4, 8.5, 0);
  colliders.addBox(cm.x, cm.z + 20, 3.5, 3, 0);
  // 미추왕릉 앞 담장
  const mc = { x: 546, z: 118 };
  city.addWall(mc.x - 34, mc.z + 34, mc.x - 6, mc.z + 34, 1.3, 0.5);
  city.addWall(mc.x + 6, mc.z + 34, mc.x + 34, mc.z + 34, 1.3, 0.5);
}

// ── 황룡사지 ─────────────────────────────────────────────────────────
function buildHwangnyongsa(root) {
  const { x, z } = P.hwangnyongsa;
  const stones = [];
  const add = (sx, sz, s = 1) => stones.push([sx, sz, s]);
  // 목탑지 8×8 주춧돌 (중앙부 심초석)
  const tz = z + 35;
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) add(x - 10.9 + i * 3.1, tz - 10.9 + j * 3.1);
  // 금당지
  const gz = z - 25;
  for (let i = 0; i < 11; i++) for (let j = 0; j < 5; j++) if (i === 0 || i === 10 || j === 0 || j === 4 || j === 2) add(x - 22.5 + i * 4.5, gz - 9 + j * 4.5);
  // 강당지
  const kz = z - 80;
  for (let i = 0; i < 10; i++) for (let j = 0; j < 4; j++) add(x - 22 + i * 4.9, kz - 7 + j * 4.7);
  // 중문지
  for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) add(x - 10 + i * 4, z + 90 + j * 4);
  const geo = cyl(0.55, 0.65, 0.42, 7);
  const inst = new THREE.InstancedMesh(geo, MAT.granite, stones.length);
  const m = new THREE.Matrix4();
  const r = rng(13);
  stones.forEach(([sx, sz], i) => {
    m.makeRotationY(r() * 3);
    m.setPosition(sx, 0, sz);
    inst.setMatrixAt(i, m);
  });
  inst.castShadow = true;
  inst.receiveShadow = true;
  root.add(inst);
  // 심초석 · 장륙존상 받침
  mesh(box(4.4, 0.7, 3.6), MAT.granite, x, 0, tz, 0.1, root);
  for (const dx of [-8, 0, 8]) mesh(box(3.2, 0.8, 2.6), MAT.graniteDark, x + dx, 0, gz, 0, root);
  // 기단 흔적
  for (const [cx, cz, w, d] of [[x, tz, 26, 26], [x, gz, 52, 22], [x, kz, 50, 18]]) {
    const b = mesh(box(w, 0.15, d), new THREE.MeshLambertMaterial({ color: 0xb6a988 }), cx, 0, cz, 0, root);
    b.castShadow = false;
  }
  // 9층 목탑 상상 복원 (반투명)
  const ghost = new THREE.Group();
  ghost.position.set(x, 0, tz);
  root.add(ghost);
  let y = 1.0, w = 22;
  for (let i = 0; i < 9; i++) {
    const h = i === 0 ? 8.5 : 7.4 - i * 0.25;
    const body = new THREE.Mesh(box(w, h, w), MAT.ghost);
    body.position.y = y;
    ghost.add(body);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, w)), MAT.ghostLine);
    edges.position.y = y + h / 2;
    ghost.add(edges);
    const roof = new THREE.Mesh(pyramidRoofGeo, MAT.ghost);
    roof.scale.set(w + 6, 3.2, w + 6);
    roof.position.y = y + h - 1.4;
    ghost.add(roof);
    y += h + 0.6;
    w *= 0.92;
  }
  const spire = new THREE.Mesh(cyl(0.3, 0.5, 14, 6), MAT.ghost);
  spire.position.y = y;
  ghost.add(spire);
  MAT.ghost.userData.ghost = true;
  glowAtNight(MAT.ghost, 0xffe0a0, 0);
}

// ── 분황사 ───────────────────────────────────────────────────────────
function buildBunhwangsa(root, colliders, city) {
  const { x, z } = P.bunhwangsa;
  const brick = new THREE.MeshLambertMaterial({ map: brickTexture() });
  brick.map.repeat.set(2, 1);
  const g = new THREE.Group();
  g.position.set(x, 0, z + 10);
  root.add(g);
  mesh(box(13, 1.0, 13), MAT.granite, 0, 0, 0, 0, g);
  let y = 1.0;
  const tiers = [[7, 3.6], [6.0, 2.2], [5.4, 2.0]];
  tiers.forEach(([w, h], i) => {
    mesh(box(w, h, w), brick, 0, y, 0, 0, g);
    if (i === 0) {
      for (let k = 0; k < 4; k++) {
        const a = (k * Math.PI) / 2;
        const d = mesh(box(1.1, 1.7, 0.3), MAT.dark, Math.sin(a) * (w / 2), y + 0.3, Math.cos(a) * (w / 2), a, g);
        d.castShadow = false;
        // 인왕상 (문 양옆 석상)
        for (const s of [-1, 1]) {
          const sx = Math.sin(a) * (w / 2 + 0.2) + Math.cos(a) * s * 1.3, sz = Math.cos(a) * (w / 2 + 0.2) - Math.sin(a) * s * 1.3;
          mesh(box(0.6, 1.8, 0.35), MAT.graniteDark, sx, y + 0.1, sz, a, g);
        }
      }
    }
    y += h;
    // 층단식 옥개 (내쌓기 → 들여쌓기)
    for (let s = 0; s < 6; s++) {
      const sw = s < 3 ? w + (s + 1) * 0.35 : w + (6 - s) * 0.35 - 0.2;
      mesh(box(sw, 0.25, sw), brick, 0, y, 0, 0, g);
      y += 0.25;
    }
  });
  mesh(box(3.6, 0.6, 3.6), MAT.graniteDark, 0, y, 0, 0, g);
  // 돌사자
  const lionBody = box(1.2, 0.9, 1.8), lionHead = new THREE.SphereGeometry(0.45, 8, 6);
  for (const [lx, lz] of [[-5.6, -5.6], [5.6, -5.6], [-5.6, 5.6], [5.6, 5.6]]) {
    const lg = new THREE.Group();
    lg.position.set(lx, 1.0, lz);
    lg.rotation.y = Math.atan2(lx, lz);
    g.add(lg);
    mesh(lionBody, MAT.granite, 0, 0, 0, 0, lg);
    mesh(lionHead, MAT.granite, 0, 1.1, 0.7, 0, lg);
  }
  colliders.addBox(x, z + 10, 6.5, 6.5, 0);
  // 보광전 (북쪽)
  city.addHanok(x, z - 22, 12, 8, 0, { lamp: false });
  // 담장
  const wx0 = x - 56, wx1 = x + 56, wz0 = z - 50, wz1 = z + 50;
  city.addWall(wx0, wz0, wx1, wz0);
  city.addWall(wx0, wz0, wx0, wz1);
  city.addWall(wx1, wz0, wx1, wz1);
  city.addWall(wx0, wz1, x - 4, wz1);
  city.addWall(x + 4, wz1, wx1, wz1);
  const r = rng(55);
  for (let i = 0; i < 14; i++) city.addTree(x - 50 + r() * 100, z - 45 + r() * 20, { type: 'round', s: 0.9 + r() * 0.4, color: pick(AUTUMN, r), rnd: r });
}

// ── 국립경주박물관 + 성덕대왕신종 ────────────────────────────────────
function buildMuseum(root, colliders, city) {
  const { x, z } = P.museum;
  // 본관: 전통 지붕을 얹은 현대 건물
  const hall = new THREE.Group();
  hall.position.set(x + 30, 0, z);
  root.add(hall);
  mesh(box(56, 1.4, 28), MAT.granite, 0, 0, 0, 0, hall);
  mesh(box(50, 8, 22), MAT.modernMuseum, 0, 1.4, 0, 0, hall);
  mesh(box(52, 0.8, 24), MAT.greenBeam, 0, 9.2, 0, 0, hall);
  roofMesh(hall, 0, 9.6, 0, 60, 10, 32, 0);
  for (let i = -5; i <= 5; i++) mesh(cyl(0.45, 0.5, 8, 10), MAT.redPillar, i * 4.6, 1.4, 11.6, 0, hall);
  colliders.addBox(x + 30, z, 28, 14, 0);
  // 신라역사관 (현대식)
  city.addModern(x + 40, z - 45, 46, 22, 9, 0, 0xe8e1d4);
  // 종각
  const bx = x - 30, bz = z + 25;
  const bell = new THREE.Group();
  bell.position.set(bx, 0, bz);
  root.add(bell);
  mesh(box(12, 0.6, 12), MAT.granite, 0, 0, 0, 0, bell);
  for (const [px, pz] of [[-4.6, -4.6], [4.6, -4.6], [-4.6, 4.6], [4.6, 4.6]]) {
    mesh(cyl(0.35, 0.4, 7, 10), MAT.redPillar, px, 0.6, pz, 0, bell);
    colliders.addCircle(bx + px, bz + pz, 0.6);
  }
  mesh(box(10.4, 0.7, 10.4), MAT.greenBeam, 0, 7.4, 0, 0, bell);
  roofMesh(bell, 0, 8.0, 0, 14, 5, 14, 0, pyramidRoofGeo);
  const bp = [];
  const H = 3.66, R0 = 1.12;
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    const rr = R0 * (0.72 + 0.28 * Math.pow(t, 2.2)) * (t > 0.95 ? 1 - (t - 0.95) * 3 : 1);
    bp.push(new THREE.Vector2(rr, H * (1 - t)));
  }
  bp.unshift(new THREE.Vector2(0.001, H));
  const bellMesh = mesh(new THREE.LatheGeometry(bp, 32), MAT.bronze, 0, 2.1, 0, 0, bell);
  bellMesh.material.side = THREE.DoubleSide;
  mesh(cyl(0.18, 0.18, 1.6, 6), MAT.bronze, 0, 2.1 + H, 0, 0, bell);
  colliders.addCircle(bx, bz, R0 + 0.3);
  const r = rng(66);
  for (let i = 0; i < 24; i++) city.addTree(x - 60 + r() * 140, z + 50 + r() * 20, { type: 'round', s: 1 + r() * 0.4, color: pick(AUTUMN, r), rnd: r });
}

// ── 핑크뮬리 ────────────────────────────────────────────────────────
function buildPinkMuhly(root) {
  const r = rng(101);
  const fields = [[1030, 352, 1175, 432], [1185, 400, 1290, 500], [1060, 440, 1180, 520]];
  const paths = [[[920, 345], [1040, 330], [1170, 340], [1300, 420], [1420, 520]], [[965, 520], [990, 620]]];
  const pos = [];
  for (const [x0, z0, x1, z1] of fields) {
    const n = Math.round(((x1 - x0) * (z1 - z0)) / 4.2);
    for (let i = 0; i < n; i++) {
      const x = x0 + r() * (x1 - x0), z = z0 + r() * (z1 - z0);
      if (paths.some((p) => distToPolyline(x, z, p) < 3)) continue;
      // 사진 찍는 오솔길
      if (Math.abs(Math.sin(x * 0.06) * 18 + 400 - z) < 1.6) continue;
      pos.push([x, z]);
    }
  }
  const geo = new THREE.ConeGeometry(0.75, 1.1, 6, 1).translate(0, 0.55, 0);
  const inst = new THREE.InstancedMesh(geo, MAT.muhly, pos.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  const pinks = [0xe58fb4, 0xd97aa6, 0xf0a6c4, 0xc96d9a, 0xeab0c8];
  pos.forEach(([x, z], i) => {
    const k = 0.7 + r() * 0.6;
    q.setFromEuler(new THREE.Euler((r() - 0.5) * 0.2, r() * 6, (r() - 0.5) * 0.2));
    m.compose(p.set(x, 0, z), q, s.set(k, k * (0.8 + r() * 0.5), k));
    inst.setMatrixAt(i, m);
    inst.setColorAt(i, new THREE.Color(pinks[Math.floor(r() * pinks.length)]));
  });
  inst.receiveShadow = true;
  root.add(inst);
  return inst;
}

// ── 오릉 · 봉황대 나무 ─────────────────────────────────────────────
function buildTombTrees(city) {
  const r = rng(202);
  // 봉황대 위 느티나무
  const bh = LANDMARKS.find((l) => l.id === 'bonghwangdae').pos;
  for (const [dx, dz, s] of [[0, 0, 1.6], [12, -8, 1.3], [-10, 10, 1.2], [-6, -14, 1.1]]) {
    const d = Math.hypot(dx, dz) / 41;
    const y = 22 * Math.pow(1 - d * d, 0.62) - 0.6;
    city.addTree(bh.x + dx, bh.z + dz, { type: 'tall', s, color: pick(AUTUMN, r), y, collide: false, rnd: r });
  }
  // 오릉 소나무숲
  const o = LANDMARKS.find((l) => l.id === 'oreung').pos;
  for (let i = 0; i < 160; i++) {
    const a = r() * Math.PI * 2, d = 45 + r() * 70;
    const tx = o.x + Math.cos(a) * d, tz = o.z + Math.sin(a) * d * 0.6;
    if (tz > 1285 || tz < 1060) continue;
    city.addTree(tx, tz, { type: 'pine', s: 0.9 + r() * 0.5, color: pick(PINE, r), rnd: r });
  }
}

export function buildLandmarks(root, colliders, city) {
  buildWater(root);
  buildBridges(root, colliders);
  buildCheomseongdae(root, colliders);
  buildDonggung(root, colliders, city);
  buildGyerim(root, colliders, city);
  buildWolseong(root, colliders, city);
  buildDaereungwonWalls(root, colliders, city);
  buildHwangnyongsa(root);
  buildBunhwangsa(root, colliders, city);
  buildMuseum(root, colliders, city);
  buildTombTrees(city);
  const muhly = buildPinkMuhly(root);

  // 안내판
  const boards = [
    ['cheomseongdae', 0, 14, 0],
    ['daereungwon', 0, 0, 0],
    ['gyerim', -10, -60, Math.PI],
    ['donggung', -110, -60, -Math.PI / 2],
    ['woljeonggyo', 0, -50, 0],
    ['gyochon', 140, -50, -Math.PI / 2],
    ['bonghwangdae', 0, 50, 0],
    ['hwangnyongsa', -150, 190, 0],
    ['bunhwangsa', 8, 60, 0],
    ['museum', -112, 8, -Math.PI / 2],
    ['pinkmuhly', -40, -42, Math.PI],
    ['cheonmachong', 8, 32, 0],
    ['oreung', 30, -50, 0],
    ['hwangnidan', 9, 172, -Math.PI / 2],
  ];
  for (const [id, dx, dz, rot] of boards) {
    const l = LANDMARKS.find((k) => k.id === id);
    const bx = id === 'daereungwon' ? 520 : l.pos.x + dx;
    const bz = id === 'daereungwon' ? 207 : l.pos.z + dz;
    if (colliders.blocked(bx, bz, 1.2)) continue;
    infoBoard(root, colliders, bx, bz, rot, l.name);
  }
  return { muhly };
}
