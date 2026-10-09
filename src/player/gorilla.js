// 주인공: 빨간 후드 점퍼를 입은 고릴라 인형 (레퍼런스 사진 기반)
// 회색 머리 · 크림색 큰 얼굴 · 까만 구슬 눈 · 회색 자수 코와 웃는 입 · 분홍 볼
// 빨간 점퍼(소매에 흰 줄무늬와 로고) · 크림색 둥근 손발 · 오른발 노란 패치
import * as THREE from 'three';

const plush = (color, sheenColor) =>
  new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.92,
    sheen: 1,
    sheenRoughness: 0.45,
    sheenColor: sheenColor ?? color,
  });

const ONE = new THREE.Vector3(1, 1, 1);

const M = {
  grey: plush(0x474a52, 0x8a8e98),
  cream: plush(0xf1ebde, 0xffffff),
  jacket: new THREE.MeshStandardMaterial({ color: 0xd0231f, roughness: 0.55 }),
  jacketDark: new THREE.MeshStandardMaterial({ color: 0xa81a17, roughness: 0.6 }),
  white: new THREE.MeshStandardMaterial({ color: 0xf6f4f0, roughness: 0.6 }),
  eye: new THREE.MeshStandardMaterial({ color: 0x0b0b0d, roughness: 0.08, metalness: 0.2 }),
  stitch: new THREE.MeshStandardMaterial({ color: 0xa4a4aa, roughness: 0.95 }),
  blush: new THREE.MeshStandardMaterial({ color: 0xf29aa6, roughness: 0.9 }),
  pants: plush(0x3c3f47, 0x6c707a),
  patch: new THREE.MeshStandardMaterial({ color: 0xf5b800, roughness: 0.6 }),
  patchRed: new THREE.MeshStandardMaterial({ color: 0xd42a1f, roughness: 0.6 }),
};

function sleeveLogoTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 96;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.font = 'bold 64px "Helvetica Neue", Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('Kodak', 128, 50);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function part(geo, mat, parent, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

export class Gorilla {
  constructor() {
    this.root = new THREE.Group(); // 발 바닥 기준
    this.body = new THREE.Group(); // 엉덩이 피벗
    this.root.add(this.body);
    this.body.position.y = 0.42;
    this.t = 0;
    this.walkPhase = 0;

    const S = new THREE.SphereGeometry(1, 28, 20);
    const Ssm = new THREE.SphereGeometry(1, 16, 12);

    // ── 몸통 (빨간 점퍼) ──
    this.torso = part(S, M.jacket, this.body, 0, 0.3, 0, 0.42, 0.42, 0.36);
    part(new THREE.CylinderGeometry(0.36, 0.38, 0.12, 24), M.jacketDark, this.body, 0, 0.0, 0); // 밑단 시보리
    part(new THREE.BoxGeometry(0.03, 0.5, 0.02), M.jacketDark, this.body, 0, 0.3, 0.355); // 지퍼
    // 가슴의 흰 줄무늬
    const chest = part(new THREE.TorusGeometry(0.405, 0.035, 8, 40, Math.PI * 0.5), M.white, this.body, 0, 0.38, 0, 1, 1, 0.9);
    chest.rotation.set(Math.PI / 2, 0, Math.PI * 0.05);
    // 후드 (머리 뒤)
    part(S, M.jacket, this.body, 0, 0.62, -0.2, 0.38, 0.3, 0.26);

    // ── 머리 ──
    this.head = new THREE.Group();
    this.head.position.set(0, 0.86, 0.06);
    this.body.add(this.head);
    part(S, M.grey, this.head, 0, 0.04, -0.06, 0.44, 0.43, 0.42);
    // 크림색 얼굴: 큰 주둥이 + 이마
    part(S, M.cream, this.head, 0, -0.07, 0.17, 0.42, 0.34, 0.32);
    part(S, M.cream, this.head, 0, 0.15, 0.18, 0.31, 0.2, 0.22);
    // 귀
    for (const s of [-1, 1]) part(Ssm, M.cream, this.head, s * 0.42, 0.04, -0.02, 0.06, 0.1, 0.09);
    // 눈 (까만 구슬)
    for (const s of [-1, 1]) part(Ssm, M.eye, this.head, s * 0.1, 0.2, 0.38, 0.042, 0.032, 0.03);
    // 코 (회색 자수 콧구멍)
    for (const s of [-1, 1]) {
      const n = part(Ssm, M.stitch, this.head, s * 0.085, 0.03, 0.485, 0.05, 0.035, 0.012);
      n.rotation.z = s * 0.35;
      n.rotation.y = s * 0.18;
    }
    // 웃는 입
    const smile = part(new THREE.TorusGeometry(0.2, 0.011, 6, 40, Math.PI * 0.62), M.stitch, this.head, 0, -0.04, 0.45);
    smile.rotation.z = Math.PI + Math.PI * 0.19;
    smile.rotation.x = -0.32;
    // 분홍 볼
    for (const s of [-1, 1]) {
      const b = part(Ssm, M.blush, this.head, s * 0.29, -0.04, 0.39, 0.055, 0.045, 0.012);
      b.rotation.y = s * 0.75;
    }

    // ── 팔 ──
    this.arms = [];
    const logo = new THREE.MeshStandardMaterial({ map: sleeveLogoTexture(), transparent: true, roughness: 0.6 });
    for (const s of [-1, 1]) {
      const sh = new THREE.Group();
      sh.position.set(s * 0.36, 0.48, 0.02);
      this.body.add(sh);
      const sleeve = part(new THREE.CapsuleGeometry(0.13, 0.22, 6, 14), M.jacket, sh, s * 0.04, -0.2, 0.02);
      sleeve.rotation.z = s * 0.25;
      // 소매 흰 줄
      const band = part(new THREE.TorusGeometry(0.135, 0.028, 6, 20), M.white, sh, s * 0.07, -0.3, 0.02);
      band.rotation.x = Math.PI / 2;
      band.rotation.y = s * 0.25;
      part(new THREE.CylinderGeometry(0.12, 0.12, 0.06, 16), M.jacketDark, sh, s * 0.09, -0.36, 0.02).rotation.z = s * 0.25;
      part(Ssm, M.cream, sh, s * 0.11, -0.46, 0.04, 0.14, 0.15, 0.15); // 손
      if (s < 0) {
        const d = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.1), logo);
        d.position.set(-0.17, -0.14, 0.04);
        d.rotation.y = -Math.PI / 2;
        d.rotation.z = -0.25 - Math.PI / 2;
        sh.add(d);
      }
      this.arms.push(sh);
    }

    // ── 다리 ──
    this.legs = [];
    for (const s of [-1, 1]) {
      const hip = new THREE.Group();
      hip.position.set(s * 0.17, 0.02, 0.02);
      this.body.add(hip);
      part(new THREE.CapsuleGeometry(0.13, 0.12, 6, 12), M.pants, hip, 0, -0.16, 0);
      const foot = part(S, M.cream, hip, 0, -0.32, 0.08, 0.17, 0.12, 0.22);
      foot.rotation.x = -0.15;
      if (s > 0) {
        part(new THREE.BoxGeometry(0.08, 0.08, 0.01), M.patch, hip, 0.12, -0.3, 0.2).rotation.y = 0.9;
        part(new THREE.BoxGeometry(0.04, 0.04, 0.012), M.patchRed, hip, 0.124, -0.3, 0.204).rotation.y = 0.9;
      }
      this.legs.push(hip);
    }

    this.root.traverse((o) => {
      if (o.isMesh) o.userData.player = true;
    });
  }

  // speed: 0..1 이상 (걷기=0.5, 달리기=1), airborne, riding
  update(dt, { speed = 0, airborne = false, riding = false, pedal = 0 } = {}) {
    this.t += dt;
    const b = this.body;
    if (riding) {
      // 자전거: 앉은 자세, 페달 돌리기
      b.position.y = 0.42;
      b.rotation.set(0.12, 0, 0);
      this.head.rotation.set(-0.12, 0, Math.sin(this.t * 2) * 0.03);
      this.legs.forEach((l, i) => {
        const a = pedal + i * Math.PI;
        l.rotation.x = -1.0 + Math.sin(a) * 0.45;
      });
      this.arms.forEach((a) => {
        a.rotation.x = -1.05;
        a.rotation.z = 0;
      });
      return;
    }
    if (airborne) {
      b.position.y = 0.42;
      b.rotation.set(-0.1, 0, 0);
      this.legs.forEach((l, i) => (l.rotation.x = i ? 0.5 : -0.3));
      this.arms.forEach((a, i) => {
        a.rotation.x = -2.2;
        a.rotation.z = (i ? -1 : 1) * 0.5;
      });
      this.head.rotation.set(-0.15, 0, 0);
      b.scale.set(0.95, 1.08, 0.95);
      return;
    }
    // 착지 찌그러짐 복원
    b.scale.lerp(ONE, Math.min(1, dt * 12));

    if (speed > 0.05) {
      this.walkPhase += dt * (6 + speed * 7);
      const p = this.walkPhase;
      const amp = Math.min(1, speed);
      // 뒤뚱뒤뚱
      b.position.y = 0.42 + Math.abs(Math.sin(p)) * 0.09 * amp;
      b.rotation.set(0.12 * amp, Math.sin(p) * 0.1 * amp, Math.sin(p) * 0.13 * amp);
      this.legs[0].rotation.x = Math.sin(p) * 0.75 * amp;
      this.legs[1].rotation.x = -Math.sin(p) * 0.75 * amp;
      this.arms[0].rotation.x = -Math.sin(p) * 0.8 * amp;
      this.arms[1].rotation.x = Math.sin(p) * 0.8 * amp;
      this.arms.forEach((a, i) => (a.rotation.z = (i ? -1 : 1) * 0.12));
      this.head.rotation.set(-0.05, -Math.sin(p) * 0.06, -Math.sin(p) * 0.05);
    } else {
      // 숨쉬기 + 고개 갸웃
      const br = Math.sin(this.t * 2.2);
      b.position.y = 0.42 + br * 0.01;
      b.rotation.set(0.04, 0, 0);
      b.scale.x += (1 + br * 0.012 - b.scale.x) * 0.3;
      b.scale.z = b.scale.x;
      this.legs.forEach((l) => (l.rotation.x *= 0.85));
      this.arms.forEach((a, i) => {
        a.rotation.x *= 0.85;
        a.rotation.z = (i ? -1 : 1) * 0.08;
      });
      this.head.rotation.set(0.04 + Math.sin(this.t * 0.7) * 0.03, Math.sin(this.t * 0.4) * 0.15, Math.sin(this.t * 0.55) * 0.08);
    }
  }

  land(strength = 1) {
    this.body.scale.set(1 + 0.18 * strength, 1 - 0.2 * strength, 1 + 0.18 * strength);
  }
}
