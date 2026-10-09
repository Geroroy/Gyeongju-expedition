// 반복되는 오브젝트(한옥, 현대 건물, 나무, 고분, 담장)를 InstancedMesh 로 묶어 그린다.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  hanokWallTexture, modernWallTexture, roofTexture, stoneWallTexture, signAtlas,
} from './textures.js';

const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

export function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

// 한국 전통 지붕(우진각 + 처마 곡선) 단위 지오메트리: x,z ∈ [-0.5,0.5], 용마루 높이 1
export function makeRoofGeometry({ ridge = 0.3, sag = 1.45, lift = 0.16, segX = 16, segZ = 8 } = {}) {
  const pos = [], uv = [], idx = [];
  for (let j = 0; j <= segZ; j++) {
    for (let i = 0; i <= segX; i++) {
      const u = i / segX - 0.5, v = j / segZ - 0.5;
      const dx = Math.max(0, Math.abs(u) - ridge) / (0.5 - ridge);
      const dz = Math.abs(v) / 0.5;
      const t = Math.max(dx, dz);
      let h = Math.pow(1 - t, sag);
      h += lift * Math.pow(t, 3) * (Math.pow(2 * Math.abs(u), 4) + 0.7 * Math.pow(2 * Math.abs(v), 4));
      pos.push(u, h, v);
      uv.push((u + 0.5) * 6, t * 2);
    }
  }
  for (let j = 0; j < segZ; j++) {
    for (let i = 0; i < segX; i++) {
      const a = j * (segX + 1) + i, b = a + 1, c = a + segX + 1, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// 고분 봉분 (반지름 1, 높이 1)
export function makeMoundGeometry() {
  const pts = [];
  const N = 22;
  for (let i = 0; i <= N; i++) {
    const r = 1 - i / N;
    const y = Math.pow(1 - r * r, 0.62);
    pts.push(new THREE.Vector2(Math.max(r, 0.0001), y));
  }
  pts.push(new THREE.Vector2(0, 1));
  const g = new THREE.LatheGeometry(pts, 40);
  // 버텍스 컬러로 잔디 얼룩
  const col = [];
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    const n = Math.sin(p.getX(i) * 13.1 + p.getZ(i) * 7.7) * 0.5 + 0.5;
    const k = 0.88 + n * 0.12 + y * 0.06;
    col.push(k, k, k);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}

class Batch {
  constructor(geometry, material, { castShadow = true, receiveShadow = true, colors = false } = {}) {
    this.geometry = geometry;
    this.material = material;
    this.mats = [];
    this.cols = colors ? [] : null;
    this.castShadow = castShadow;
    this.receiveShadow = receiveShadow;
  }

  add(x, y, z, rot, sx, sy, sz, color) {
    _p.set(x, y, z);
    _q.setFromAxisAngle(_up, rot);
    _s.set(sx, sy, sz);
    this.mats.push(new THREE.Matrix4().compose(_p, _q, _s));
    if (this.cols) this.cols.push(new THREE.Color(color ?? 0xffffff));
  }

  addMatrix(m, color) {
    this.mats.push(m.clone());
    if (this.cols) this.cols.push(new THREE.Color(color ?? 0xffffff));
  }

  build(parent) {
    if (!this.mats.length) return null;
    const mesh = new THREE.InstancedMesh(this.geometry, this.material, this.mats.length);
    this.mats.forEach((m, i) => mesh.setMatrixAt(i, m));
    if (this.cols) this.cols.forEach((c, i) => mesh.setColorAt(i, c));
    mesh.castShadow = this.castShadow;
    mesh.receiveShadow = this.receiveShadow;
    mesh.computeBoundingSphere();
    parent.add(mesh);
    return mesh;
  }
}

export class CityBuilder {
  constructor(colliders) {
    this.colliders = colliders;
    const box = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
    const roofTex = roofTexture();

    this.mat = {
      stone: new THREE.MeshLambertMaterial({ color: 0xb8ad98 }),
      hanokWall: new THREE.MeshLambertMaterial({ map: hanokWallTexture() }),
      roof: new THREE.MeshLambertMaterial({ map: roofTex, side: THREE.DoubleSide }),
      ridge: new THREE.MeshLambertMaterial({ color: 0x2c2f36 }),
      modern: new THREE.MeshLambertMaterial({ map: modernWallTexture() }),
      flatRoof: new THREE.MeshLambertMaterial({ color: 0x8d8a84 }),
      wallStone: new THREE.MeshLambertMaterial({ map: stoneWallTexture() }),
      wallCap: new THREE.MeshLambertMaterial({ color: 0x3e424a }),
      trunk: new THREE.MeshLambertMaterial({ color: 0x5b4330 }),
      pineTrunk: new THREE.MeshLambertMaterial({ color: 0x7a4b32 }),
      leaf: new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }),
      mound: new THREE.MeshLambertMaterial({ color: 0x739c47, vertexColors: true }),
      window: new THREE.MeshLambertMaterial({ color: 0xffd58a, emissive: 0x000000 }),
    };

    this.roofGeo = makeRoofGeometry();
    this.batches = {
      base: new Batch(box, this.mat.stone),
      hanokWall: new Batch(box, this.mat.hanokWall),
      roof: new Batch(this.roofGeo, this.mat.roof),
      ridge: new Batch(box, this.mat.ridge),
      modern: new Batch(box, this.mat.modern, { colors: true }),
      flatRoof: new Batch(box, this.mat.flatRoof, { colors: true }),
      wallStone: new Batch(box, this.mat.wallStone),
      wallCap: new Batch(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), this.mat.wallCap),
      trunk: new Batch(new THREE.CylinderGeometry(0.7, 1, 1, 6).translate(0, 0.5, 0), this.mat.trunk),
      pineTrunk: new Batch(new THREE.CylinderGeometry(0.6, 1, 1, 6).translate(0, 0.5, 0), this.mat.pineTrunk),
      crown: new Batch(new THREE.IcosahedronGeometry(1, 1), this.mat.leaf, { colors: true }),
      mound: new Batch(makeMoundGeometry(), this.mat.mound, { colors: true, castShadow: true }),
    };

    // 간판은 아틀라스 UV 를 가진 평면들을 하나로 병합
    this.signs = signAtlas();
    this.signGeos = [];
    // 밤에 켜지는 창문 불빛 (병합 평면)
    this.windowGeos = [];
  }

  // ── 한옥 ──────────────────────────────────────────────────────────
  addHanok(x, z, w, d, rot = 0, { sign = -1, wallH = 2.7, baseH = 0.6, collide = true, lamp = true } = {}) {
    const B = this.batches;
    B.base.add(x, 0, z, rot, w + 0.6, baseH, d + 0.6);
    B.hanokWall.add(x, baseH, z, rot, w - 0.6, wallH, d - 0.6);
    const ov = 1.3;
    const rh = 0.32 * d + 0.9;
    const roofY = baseH + wallH - 0.35;
    B.roof.add(x, roofY, z, rot, w + ov * 2, rh, d + ov * 2);
    const ridgeLen = (w + ov * 2) * 0.62;
    B.ridge.add(x, roofY + rh - 0.12, z, rot, ridgeLen, 0.4, 0.5);
    if (collide) this.colliders.addBox(x, z, w / 2 + 0.3, d / 2 + 0.3, rot);
    // 정면(로컬 +z) 간판
    if (sign >= 0) this._addSign(x, z, d, rot, baseH + wallH - 0.55, sign);
    if (lamp) this._addWindowGlow(x, z, w, d, rot, baseH + 0.9, 1.3);
  }

  _addSign(x, z, d, rot, y, idx) {
    const { cols, rows } = this.signs;
    const sw = 2.6, sh = 0.95;
    const g = new THREE.PlaneGeometry(sw, sh);
    const cx = idx % cols, cy = Math.floor(idx / cols);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(i, (cx + uv.getX(i)) / cols, 1 - (cy + 1 - uv.getY(i)) / rows);
    }
    const off = d / 2 - 0.15 + 0.02;
    g.translate(0, y, off);
    g.rotateY(rot);
    g.translate(x, 0, z);
    this.signGeos.push(g);
  }

  _addWindowGlow(x, z, w, d, rot, y, h) {
    const g = new THREE.PlaneGeometry(Math.max(1, w * 0.28), h);
    g.translate(0, y + h / 2, (d - 0.6) / 2 + 0.03);
    g.rotateY(rot);
    g.translate(x, 0, z);
    this.windowGeos.push(g);
  }

  // ── 현대식 건물 ───────────────────────────────────────────────────
  addModern(x, z, w, d, h, rot = 0, tint = 0xffffff) {
    const B = this.batches;
    B.modern.add(x, 0, z, rot, w, h, d, tint);
    B.flatRoof.add(x, h, z, rot, w + 0.3, 0.4, d + 0.3, 0x9a958c);
    this.colliders.addBox(x, z, w / 2, d / 2, rot);
  }

  // ── 담장 ──────────────────────────────────────────────────────────
  addWall(x0, z0, x1, z1, h = 1.8, thick = 0.6) {
    const len = Math.hypot(x1 - x0, z1 - z0);
    if (len < 0.5) return;
    const rot = Math.atan2(x1 - x0, z1 - z0);
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    this.batches.wallStone.add(cx, 0, cz, rot, thick, h, len);
    this.batches.wallCap.add(cx, h, cz, rot, thick + 0.5, 0.28, len + 0.2);
    this.colliders.addBox(cx, cz, thick / 2 + 0.1, len / 2, rot);
  }

  // ── 나무 ──────────────────────────────────────────────────────────
  // type: 'pine' | 'round' | 'tall' (느티나무 고목)
  addTree(x, z, { type = 'round', s = 1, color = 0x5f8a3a, collide = true, y = 0, rnd = Math.random } = {}) {
    const B = this.batches;
    if (type === 'pine') {
      const h = 7 * s;
      B.pineTrunk.add(x, y, z, 0, 0.3 * s, h, 0.3 * s);
      const tilt = rnd() * Math.PI * 2;
      const n = 3;
      for (let i = 0; i < n; i++) {
        const a = tilt + (i / n) * Math.PI * 2;
        const rr = (i === 0 ? 0 : 1.3) * s;
        const yy = y + h - 0.6 * s + (i === 0 ? 0.7 * s : 0);
        B.crown.add(x + Math.cos(a) * rr, yy, z + Math.sin(a) * rr, a, 2.4 * s, 1.0 * s, 2.0 * s, color);
      }
    } else if (type === 'tall') {
      const h = 6 * s;
      B.trunk.add(x, y, z, 0, 0.55 * s, h, 0.55 * s);
      B.crown.add(x, y + h + 1.5 * s, z, rnd() * 6, 4.6 * s, 3.6 * s, 4.4 * s, color);
      B.crown.add(x + 1.8 * s, y + h + 0.4 * s, z + 0.8 * s, rnd() * 6, 2.8 * s, 2.4 * s, 2.8 * s, color);
      B.crown.add(x - 1.6 * s, y + h + 0.6 * s, z - 1.1 * s, rnd() * 6, 3.0 * s, 2.4 * s, 2.6 * s, color);
    } else {
      const h = 2.6 * s;
      B.trunk.add(x, y, z, 0, 0.22 * s, h, 0.22 * s);
      B.crown.add(x, y + h + 1.4 * s, z, rnd() * 6, 2.0 * s, 2.3 * s, 2.0 * s, color);
    }
    if (collide) this.colliders.addCircle(x, z, (type === 'tall' ? 0.7 : 0.4) * s);
  }

  addMound(x, z, r, h, color = 0xffffff) {
    this.batches.mound.add(x, -0.05, z, 0, r, h, r, color);
    this.colliders.addCircle(x, z, r * 0.92);
  }

  build(parent) {
    const meshes = {};
    for (const [k, b] of Object.entries(this.batches)) meshes[k] = b.build(parent);
    if (this.signGeos.length) {
      const g = mergeGeometries(this.signGeos);
      const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: this.signs.texture, side: THREE.DoubleSide }));
      parent.add(m);
      meshes.signs = m;
      this.signMaterial = m.material;
    }
    if (this.windowGeos.length) {
      const g = mergeGeometries(this.windowGeos);
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xffc46b, transparent: true, opacity: 0 }));
      m.visible = false;
      parent.add(m);
      meshes.windowGlow = m;
    }
    this.meshes = meshes;
    return meshes;
  }
}

export const AUTUMN = [0xd9a420, 0xe0b830, 0xc7541f, 0xb8371f, 0x8aa33a, 0x6f8f35, 0xe28a2b, 0x5b7d32];
export const GREENS = [0x4f7a32, 0x5a8638, 0x45702c, 0x6b8f3c];
export const PINE = [0x2f5a2c, 0x35632f, 0x2a4f27];

export function pick(arr, r) {
  return arr[Math.floor(r() * arr.length) % arr.length];
}

