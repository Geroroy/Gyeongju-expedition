// 지면 텍스처를 캔버스에 그리고, 같은 캔버스를 미니맵에도 재사용한다.
import * as THREE from 'three';
import { WORLD } from './geo.js';
import { ROADS, RIVERS, ZONES, WOLSEONG, WOLJI, DAEREUNGWON } from './layout.js';

// 2의 거듭제곱 크기 캔버스 (밉맵이 모든 GPU에서 안정적으로 생성되도록). x/z 축척이 조금 다르다.
const TEX_W = 4096, TEX_H = 2048;
const SX = TEX_W / (WORLD.x1 - WORLD.x0); // ≈ 1.08 px/m
const SZ = TEX_H / (WORLD.z1 - WORLD.z0); // ≈ 0.89 px/m

export const COLORS = {
  base: '#8f9b5a',
  urban: '#b9b2a6',
  hanok: '#c8bba3',
  lawn: '#7ea04e',
  village: '#c6b89a',
  paddy: '#d0b358',
  plaza: '#cfc6b4',
  road: '#4a4b4f',
  street: '#a89a86',
  alley: '#b8a98f',
  path: '#d8c49a',
  wall: '#bfae90',
  water: '#4f7f8c',
  riverbank: '#a99f84',
};

function rand(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function buildGroundCanvas() {
  const W = TEX_W, H = TEX_H;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const g = cv.getContext('2d');
  const X = (x) => (x - WORLD.x0) * SX;
  const Z = (z) => (z - WORLD.z0) * SZ;
  const S = (m) => m * (SX + SZ) / 2; // 선 굵기용 평균 축척
  const rnd = rand(7);

  g.fillStyle = COLORS.base;
  g.fillRect(0, 0, W, H);
  // 잔디 얼룩
  for (let i = 0; i < 9000; i++) {
    const x = rnd() * W, y = rnd() * H, r = 2 + rnd() * 10;
    g.fillStyle = rnd() < 0.5 ? 'rgba(70,90,40,0.08)' : 'rgba(200,190,120,0.07)';
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }

  // 구역
  for (const zn of ZONES) {
    const [x0, z0, x1, z1] = zn.rect;
    g.fillStyle = COLORS[zn.type];
    g.fillRect(X(x0), Z(z0), X(x1) - X(x0), Z(z1) - Z(z0));
    if (zn.type === 'paddy') {
      // 논두렁
      g.strokeStyle = 'rgba(110,100,50,0.55)';
      g.lineWidth = S(1.2);
      for (let x = x0; x <= x1; x += 48) {
        g.beginPath(); g.moveTo(X(x), Z(z0)); g.lineTo(X(x), Z(z1)); g.stroke();
      }
      for (let z = z0; z <= z1; z += 32) {
        g.beginPath(); g.moveTo(X(x0), Z(z)); g.lineTo(X(x1), Z(z)); g.stroke();
      }
      // 벼 이삭 질감
      for (let i = 0; i < ((x1 - x0) * (z1 - z0)) / 60; i++) {
        g.fillStyle = rnd() < 0.5 ? 'rgba(160,130,40,0.25)' : 'rgba(230,205,110,0.25)';
        g.fillRect(X(x0 + rnd() * (x1 - x0)), Z(z0 + rnd() * (z1 - z0)), 2, 2);
      }
    }
    if (zn.type === 'lawn') {
      for (let i = 0; i < ((x1 - x0) * (z1 - z0)) / 80; i++) {
        g.fillStyle = rnd() < 0.5 ? 'rgba(60,100,40,0.18)' : 'rgba(170,190,90,0.15)';
        g.fillRect(X(x0 + rnd() * (x1 - x0)), Z(z0 + rnd() * (z1 - z0)), 2, 2);
      }
    }
    if (zn.type === 'urban' || zn.type === 'hanok' || zn.type === 'village') {
      for (let i = 0; i < ((x1 - x0) * (z1 - z0)) / 90; i++) {
        g.fillStyle = rnd() < 0.5 ? 'rgba(90,85,80,0.10)' : 'rgba(255,250,240,0.10)';
        g.fillRect(X(x0 + rnd() * (x1 - x0)), Z(z0 + rnd() * (z1 - z0)), 3, 3);
      }
    }
  }

  // 월성 숲 언덕
  g.fillStyle = '#6e8f45';
  g.beginPath();
  g.ellipse(X(WOLSEONG.x), Z(WOLSEONG.z), WOLSEONG.a * SX, WOLSEONG.b * SZ, 0, 0, Math.PI * 2);
  g.fill();

  // 강 (둔치 → 물)
  const strokePath = (pts, w, color, cap = 'round') => {
    g.strokeStyle = color;
    g.lineWidth = S(w);
    g.lineCap = cap;
    g.lineJoin = 'round';
    g.beginPath();
    pts.forEach(([x, z], i) => (i ? g.lineTo(X(x), Z(z)) : g.moveTo(X(x), Z(z))));
    g.stroke();
  };
  for (const r of RIVERS) strokePath(r.pts, r.w + 26, COLORS.riverbank);
  for (const r of RIVERS) strokePath(r.pts, r.w, COLORS.water);

  // 월지
  g.fillStyle = COLORS.riverbank;
  g.beginPath();
  WOLJI.poly.forEach(([x, z], i) => (i ? g.lineTo(X(x), Z(z)) : g.moveTo(X(x), Z(z))));
  g.closePath();
  g.lineWidth = S(6);
  g.strokeStyle = '#9d8f74';
  g.fill();
  g.stroke();
  g.fillStyle = COLORS.water;
  g.fill();
  g.fillStyle = COLORS.lawn;
  for (const [x, z, r] of WOLJI.islands) {
    g.beginPath(); g.ellipse(X(x), Z(z), r * SX, r * SZ, 0, 0, Math.PI * 2); g.fill();
  }

  // 길: 넓은 것부터
  const order = { path: 0, wall: 1, alley: 2, street: 3, road: 4 };
  const sorted = [...ROADS].sort((a, b) => order[a.type] - order[b.type]);
  for (const rd of sorted) {
    if (rd.type === 'road') strokePath(rd.pts, rd.w + 3, '#8e877b');
    strokePath(rd.pts, rd.w, COLORS[rd.type]);
  }
  // 차선
  for (const rd of ROADS) {
    if (rd.type !== 'road' || rd.w < 12) continue;
    g.setLineDash([S(4), S(4)]);
    strokePath(rd.pts, 0.35, '#e8c34a', 'butt');
    g.setLineDash([]);
  }
  // 대릉원 담장 안 잔디 경계
  g.strokeStyle = 'rgba(80,70,50,0.6)';
  g.lineWidth = S(1.4);
  g.strokeRect(X(DAEREUNGWON.x0), Z(DAEREUNGWON.z0), X(DAEREUNGWON.x1) - X(DAEREUNGWON.x0), Z(DAEREUNGWON.z1) - Z(DAEREUNGWON.z0));

  return { canvas: cv, pxPerM: { x: SX, z: SZ } };
}

export function buildGround(scene, renderer) {
  const { canvas, pxPerM } = buildGroundCanvas();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;

  const w = WORLD.x1 - WORLD.x0, h = WORLD.z1 - WORLD.z0;
  const geo = new THREE.PlaneGeometry(w, h);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshLambertMaterial({ map: tex });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set((WORLD.x0 + WORLD.x1) / 2, 0, (WORLD.z0 + WORLD.z1) / 2);
  mesh.receiveShadow = true;
  scene.add(mesh);

  // 바깥 들판: 지도 영역과 겹치지 않도록 네 조각으로 둘러싼다 (겹치면 깊이 충돌로 깜빡임)
  const outerMat = new THREE.MeshLambertMaterial({ color: COLORS.base });
  const F = 15000;
  const frame = [
    [WORLD.x0 - F, WORLD.z0 - F, WORLD.x1 + F, WORLD.z0], // 북
    [WORLD.x0 - F, WORLD.z1, WORLD.x1 + F, WORLD.z1 + F], // 남
    [WORLD.x0 - F, WORLD.z0, WORLD.x0, WORLD.z1], // 서
    [WORLD.x1, WORLD.z0, WORLD.x1 + F, WORLD.z1], // 동
  ];
  for (const [x0, z0, x1, z1] of frame) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2), outerMat);
    m.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2);
    scene.add(m);
  }

  return { canvas, pxPerM, texture: tex };
}
