// 3인칭 이동 · 점프 · 자전거 · 카메라
import * as THREE from 'three';
import { Gorilla } from './gorilla.js';
import { groundHeight } from '../world/collision.js';

const JOG = 6.5, SPRINT = 11, BIKE = 17;
const GRAV = 24, JUMP_V = 8.2;

function makeBike() {
  const g = new THREE.Group();
  const frame = new THREE.MeshStandardMaterial({ color: 0x7fc4b4, roughness: 0.4, metalness: 0.3 });
  const black = new THREE.MeshStandardMaterial({ color: 0x1c1c1e, roughness: 0.7 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xcfd3d6, roughness: 0.25, metalness: 0.9 });
  const basket = new THREE.MeshStandardMaterial({ color: 0x9b7a4c, roughness: 0.9 });
  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    m.castShadow = true;
    g.add(m);
    return m;
  };
  const wheels = [];
  for (const z of [-0.55, 0.55]) {
    const w = new THREE.Group();
    w.position.set(0, 0.34, z);
    g.add(w);
    const tire = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.04, 8, 28), black);
    tire.rotation.y = Math.PI / 2;
    tire.castShadow = true;
    w.add(tire);
    for (let i = 0; i < 6; i++) {
      const s = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.6, 4), chrome);
      s.rotation.x = (i / 6) * Math.PI;
      w.add(s);
    }
    wheels.push(w);
  }
  const bar = (len) => new THREE.CylinderGeometry(0.025, 0.025, len, 8);
  add(bar(0.75), frame, 0, 0.62, 0.05, Math.PI / 2 - 0.35); // 다운튜브
  add(bar(0.6), frame, 0, 0.62, -0.32, 0.25); // 시트튜브
  add(bar(0.6), frame, 0, 0.6, 0.5, -0.3); // 포크
  add(bar(0.5), frame, 0, 0.38, -0.3, Math.PI / 2); // 체인스테이
  add(bar(0.55), chrome, 0, 0.98, 0.42, 0, 0, Math.PI / 2); // 핸들
  add(new THREE.BoxGeometry(0.2, 0.06, 0.3), black, 0, 0.92, -0.4); // 안장
  add(new THREE.BoxGeometry(0.36, 0.22, 0.28), basket, 0, 0.9, 0.72); // 바구니
  add(new THREE.CylinderGeometry(0.1, 0.1, 0.04, 12), chrome, 0, 0.36, -0.05, 0, 0, Math.PI / 2); // 크랭크
  g.userData.wheels = wheels;
  return g;
}

export class Player {
  constructor(scene, camera, colliders, input, spawn) {
    this.scene = scene;
    this.camera = camera;
    this.colliders = colliders;
    this.input = input;
    this.gorilla = new Gorilla();
    scene.add(this.gorilla.root);

    this.pos = new THREE.Vector3(spawn.x, 0, spawn.z);
    this.heading = spawn.heading;
    this.speed = 0;
    this.vy = 0;
    this.grounded = true;
    this.riding = false;
    this.pedal = 0;

    this.bike = makeBike();
    this.bikeHome = { x: spawn.x - 3, z: spawn.z - 8, heading: spawn.heading };
    this.parkBike(this.bikeHome.x, this.bikeHome.z, this.bikeHome.heading);
    scene.add(this.bike);

    // 카메라: 플레이어 뒤쪽에서 시작
    this.yaw = this.heading + Math.PI;
    this.pitch = 0.32;
    this.dist = 7.5;
    this.camTarget = new THREE.Vector3();
    this.camPos = new THREE.Vector3();
    this._snapCamera();
  }

  parkBike(x, z, heading) {
    this.bike.position.set(x, groundHeight(x, z), z);
    this.bike.rotation.set(0, heading, 0.18);
    this.bikePos = { x, z };
  }

  nearBike() {
    return !this.riding && Math.hypot(this.pos.x - this.bikePos.x, this.pos.z - this.bikePos.z) < 2.6;
  }

  toggleBike() {
    if (this.riding) {
      this.riding = false;
      this.scene.add(this.bike);
      const sx = this.pos.x + Math.cos(this.heading) * 1.0;
      const sz = this.pos.z - Math.sin(this.heading) * 1.0;
      this.parkBike(this.pos.x, this.pos.z, this.heading);
      if (!this.colliders.blocked(sx, sz, 0.55)) {
        this.pos.x = sx;
        this.pos.z = sz;
      }
      return 'off';
    }
    if (this.nearBike()) {
      this.riding = true;
      this.pos.x = this.bikePos.x;
      this.pos.z = this.bikePos.z;
      this.heading = this.bike.rotation.y;
      this.bike.rotation.set(0, 0, 0);
      this.bike.position.set(0, 0, 0);
      return 'on';
    }
    return null;
  }

  teleport(x, z, heading = this.heading) {
    if (this.riding) {
      this.riding = false;
      this.scene.add(this.bike);
    }
    this.parkBike(x - 2.5, z - 2.5, heading);
    this.pos.set(x, groundHeight(x, z), z);
    this.heading = heading;
    this.yaw = heading + Math.PI;
    this.speed = 0;
    this.vy = 0;
    this._snapCamera();
  }

  _snapCamera() {
    this.camTarget.set(this.pos.x, this.pos.y + 1.3, this.pos.z);
    this._camOffset(this.camPos).add(this.camTarget);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camTarget);
  }

  _camOffset(v) {
    const cp = Math.cos(this.pitch);
    return v.set(Math.sin(this.yaw) * cp, Math.sin(this.pitch), Math.cos(this.yaw) * cp).multiplyScalar(this.dist);
  }

  update(dt) {
    const inp = this.input;
    // ── 카메라 입력 ──
    this.yaw -= inp.look.dx * 0.005;
    this.pitch = THREE.MathUtils.clamp(this.pitch + inp.look.dy * 0.004, -0.05, 1.35);
    this.dist = THREE.MathUtils.clamp(this.dist * (1 + inp.zoom * 0.1), 3, 40);

    // ── 이동 ──
    const ax = inp.axis();
    const mag = Math.min(1, Math.hypot(ax.x, ax.y));
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
    const rx = -fz, rz = fx;
    let dx = fx * ax.y + rx * ax.x, dz = fz * ax.y + rz * ax.x;
    const run = inp.held('ShiftLeft') || inp.held('ShiftRight');
    const top = this.riding ? BIKE * (run ? 1.25 : 1) : run ? SPRINT : JOG;
    let target = mag * top;

    if (mag > 0.05) {
      const want = Math.atan2(dx, dz);
      let diff = want - this.heading;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      const turn = (this.riding ? 3.2 : 11) * dt;
      this.heading += THREE.MathUtils.clamp(diff, -turn, turn);
      // 자전거는 몸 방향으로만 전진
      if (this.riding && Math.abs(diff) > 1.8) target *= 0.3;
    }
    const accel = this.riding ? 10 : 22;
    this.speed += THREE.MathUtils.clamp(target - this.speed, -accel * dt * 1.5, accel * dt);
    if (this.speed < 0.01) this.speed = 0;

    const mx = Math.sin(this.heading) * this.speed * dt;
    const mz = Math.cos(this.heading) * this.speed * dt;
    const r = this.riding ? 0.7 : 0.5;
    const hit = this.colliders.move(this.pos, mx, mz, r);
    if (hit && this.riding) this.speed *= 0.85;

    // ── 점프 · 중력 ──
    const gh = groundHeight(this.pos.x, this.pos.z);
    if (inp.take('Space') && this.grounded && !this.riding) {
      this.vy = JUMP_V;
      this.grounded = false;
    }
    if (!this.grounded) {
      this.vy -= GRAV * dt;
      this.pos.y += this.vy * dt;
      if (this.pos.y <= gh) {
        this.pos.y = gh;
        this.grounded = true;
        this.gorilla.land(Math.min(1, -this.vy / 12));
        this.vy = 0;
      }
    } else {
      // 지면 높이를 부드럽게 따라감 (다리 경사, 월성 언덕)
      if (gh < this.pos.y - 0.6) {
        this.grounded = false;
        this.vy = 0;
      } else {
        this.pos.y += (gh - this.pos.y) * Math.min(1, dt * 18);
      }
    }

    // ── 모델 ──
    const g = this.gorilla.root;
    g.position.copy(this.pos);
    g.rotation.y = this.heading;
    if (this.riding) {
      if (this.bike.parent !== g) g.add(this.bike);
      this.pedal += this.speed * dt * 1.6;
      for (const w of this.bike.userData.wheels) w.rotation.x += (this.speed * dt) / 0.34;
    }
    this.gorilla.body.position.z = 0;
    const speedNorm = this.speed / JOG;
    this.gorilla.update(dt, { speed: speedNorm, airborne: !this.grounded, riding: this.riding, pedal: this.pedal });
    if (this.riding) this.gorilla.body.position.set(0, 0.62, -0.42);

    // ── 카메라 따라가기 ──
    const now = performance.now() / 1000;
    const forwardish = Math.max(0, ax.y) - Math.abs(ax.x) * 0.5;
    if (this.speed > 1 && forwardish > 0 && now - inp.lastLookTime > 1.2) {
      // 앞으로 걷는 중이고 시점 조작이 없으면 서서히 등 뒤로 (옆걸음 때는 돌지 않음)
      const behind = this.heading + Math.PI;
      let d = behind - this.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.yaw += d * Math.min(1, dt * (this.riding ? 1.6 : 0.8)) * Math.min(1, this.speed / 6) * forwardish;
    }
    this.camTarget.lerp(new THREE.Vector3(this.pos.x, this.pos.y + 1.3, this.pos.z), Math.min(1, dt * 12));
    const want = this._camOffset(new THREE.Vector3()).add(this.camTarget);
    want.y = Math.max(want.y, groundHeight(want.x, want.z) + 0.4);
    this.camPos.lerp(want, Math.min(1, dt * 14));
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camTarget);
  }
}
