// 산책하는 관광객들 (한복 대여객 포함)
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ROADS } from './layout.js';
import { rng } from './builders.js';

function colored(geo, hex) {
  const c = new THREE.Color(hex);
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) arr.set([c.r, c.g, c.b], i * 3);
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

const SKIN = [0xf1c9a5, 0xe8b88f, 0xd9a47a];
const HAIR = [0x1d1a18, 0x3a2a1f, 0x5b3b25, 0x16130f];
const TOPS = [0xffffff, 0x2f3e5a, 0xd9cbb3, 0x7d9c6e, 0xe3b04b, 0x9b3d3d, 0x5d6a7a];
const PANTS = [0x2b3346, 0x3c3c3c, 0xc9b99a, 0x4a5a78];
const HANBOK_SKIRT = [0xd4456a, 0x3a6fb5, 0xe9a23b, 0x7a4fb0, 0x2e9a85, 0xf07aa0];
const HANBOK_TOP = [0xfff4d6, 0xf6d0de, 0xd9ecf2, 0xfff0a8];

function makeVariant(r) {
  const parts = [];
  const hanbok = r() < 0.35;
  const skin = SKIN[Math.floor(r() * SKIN.length)];
  const hair = HAIR[Math.floor(r() * HAIR.length)];
  if (hanbok) {
    parts.push(colored(new THREE.ConeGeometry(0.42, 1.0, 12, 1, true).translate(0, 0.5, 0), HANBOK_SKIRT[Math.floor(r() * HANBOK_SKIRT.length)]));
    parts.push(colored(new THREE.CylinderGeometry(0.2, 0.24, 0.42, 10).translate(0, 1.18, 0), HANBOK_TOP[Math.floor(r() * HANBOK_TOP.length)]));
    parts.push(colored(new THREE.BoxGeometry(0.1, 0.25, 0.04).translate(0.06, 1.1, 0.21), 0xc0392b)); // 고름
  } else {
    const pc = PANTS[Math.floor(r() * PANTS.length)];
    for (const s of [-1, 1]) parts.push(colored(new THREE.CylinderGeometry(0.09, 0.08, 0.82, 6).translate(s * 0.11, 0.41, 0), pc));
    parts.push(colored(new THREE.CylinderGeometry(0.22, 0.2, 0.6, 10).translate(0, 1.1, 0), TOPS[Math.floor(r() * TOPS.length)]));
    if (r() < 0.3) parts.push(colored(new THREE.BoxGeometry(0.3, 0.38, 0.16).translate(0, 1.12, -0.24), 0x3b4b3a)); // 배낭
  }
  for (const s of [-1, 1]) parts.push(colored(new THREE.CylinderGeometry(0.06, 0.05, 0.55, 6).translate(s * 0.27, 1.05, 0), skin));
  parts.push(colored(new THREE.SphereGeometry(0.16, 12, 10).translate(0, 1.56, 0), skin));
  parts.push(colored(new THREE.SphereGeometry(0.17, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.55).translate(0, 1.58, -0.01), hair));
  if (r() < 0.2) parts.push(colored(new THREE.CylinderGeometry(0.03, 0.03, 0.35, 5).rotateX(0.5).translate(0.25, 1.4, 0.15), 0x222222)); // 셀카봉
  return mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)));
}

export class Crowd {
  constructor(scene, count = 70) {
    const r = rng(808);
    this.mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    const variants = Array.from({ length: 10 }, () => makeVariant(r));
    const routes = ROADS.filter((rd) => ['street', 'path', 'alley', 'wall'].includes(rd.type));
    // 황리단길에 사람이 제일 많다
    const weighted = [];
    for (const rd of routes) {
      const w = rd.type === 'street' ? 14 : rd.type === 'wall' ? 4 : 2;
      for (let i = 0; i < w; i++) weighted.push(rd);
    }
    this.people = [];
    for (let i = 0; i < count; i++) {
      const route = weighted[Math.floor(r() * weighted.length)];
      const mesh = new THREE.Mesh(variants[Math.floor(r() * variants.length)], this.mat);
      mesh.castShadow = true;
      scene.add(mesh);
      const lens = [];
      let total = 0;
      for (let k = 0; k < route.pts.length - 1; k++) {
        const l = Math.hypot(route.pts[k + 1][0] - route.pts[k][0], route.pts[k + 1][1] - route.pts[k][1]);
        lens.push(l);
        total += l;
      }
      this.people.push({
        mesh, route, lens, total,
        s: r() * total,
        dir: r() < 0.5 ? 1 : -1,
        speed: 0.9 + r() * 0.6,
        off: (r() - 0.5) * Math.max(0.5, route.w - 1.6),
        phase: r() * 10,
        pause: 0,
      });
    }
    this._tmp = new THREE.Vector3();
  }

  _at(p, s) {
    let k = 0;
    while (k < p.lens.length - 1 && s > p.lens[k]) {
      s -= p.lens[k];
      k++;
    }
    const [ax, az] = p.route.pts[k], [bx, bz] = p.route.pts[k + 1];
    const t = Math.min(1, s / p.lens[k]);
    const dx = (bx - ax) / p.lens[k], dz = (bz - az) / p.lens[k];
    return { x: ax + (bx - ax) * t - dz * p.off, z: az + (bz - az) * t + dx * p.off, dx, dz };
  }

  update(dt, focus) {
    for (const p of this.people) {
      if (p.pause > 0) {
        p.pause -= dt;
        continue;
      }
      p.s += p.dir * p.speed * dt;
      if (p.s > p.total || p.s < 0) {
        p.dir *= -1;
        p.s = Math.max(0, Math.min(p.total, p.s));
        p.pause = 1 + Math.random() * 4;
      } else if (Math.random() < dt * 0.02) {
        p.pause = 2 + Math.random() * 5; // 사진 찍는 중
      }
      const q = this._at(p, p.s);
      // 멀리 있는 사람은 숨겨서 비용 절약
      p.mesh.visible = Math.abs(q.x - focus.x) < 260 && Math.abs(q.z - focus.z) < 260;
      if (!p.mesh.visible) continue;
      p.phase += dt * p.speed * 6;
      p.mesh.position.set(q.x, Math.abs(Math.sin(p.phase)) * 0.05, q.z);
      p.mesh.rotation.y = Math.atan2(q.dx * p.dir, q.dz * p.dir);
      p.mesh.rotation.z = Math.sin(p.phase) * 0.04;
    }
  }
}
