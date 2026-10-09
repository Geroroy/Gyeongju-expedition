// 하늘 · 해 · 그림자 · 낮/밤 전환
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { NIGHT } from './landmarks.js';

export class Atmosphere {
  constructor(scene, renderer) {
    this.scene = scene;
    this.renderer = renderer;
    this.night = 0; // 0 = 낮, 1 = 밤
    this.target = 0;

    this.sky = new Sky();
    this.sky.scale.setScalar(20000);
    scene.add(this.sky);
    const u = this.sky.material.uniforms;
    u.turbidity.value = 3.2;
    u.rayleigh.value = 1.4;
    u.mieCoefficient.value = 0.004;
    u.mieDirectionalG.value = 0.8;

    this.hemi = new THREE.HemisphereLight(0xcfe3ff, 0x8a7a55, 1.1);
    scene.add(this.hemi);

    this.sun = new THREE.DirectionalLight(0xfff1dc, 2.6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const c = this.sun.shadow.camera;
    c.left = -70; c.right = 70; c.top = 70; c.bottom = -70;
    c.near = 1; c.far = 400;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.04;
    scene.add(this.sun, this.sun.target);

    scene.fog = new THREE.Fog(0xc9d8e2, 260, 4200);

    // 별
    const n = 1500;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const th = Math.random() * Math.PI * 2, ph = Math.acos(Math.random() * 0.95);
      pos.set([Math.sin(ph) * Math.cos(th) * 9000, Math.cos(ph) * 9000, Math.sin(ph) * Math.sin(th) * 9000], i * 3);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false }));
    scene.add(this.stars);

    // 달
    this.moon = new THREE.Mesh(new THREE.SphereGeometry(120, 24, 16), new THREE.MeshBasicMaterial({ color: 0xfff6d8, fog: false, transparent: true, opacity: 0 }));
    scene.add(this.moon);

    this.dayColors = { sun: new THREE.Color(0xfff1dc), sky: new THREE.Color(0xcfe3ff), ground: new THREE.Color(0x8a7a55) };
    this.nightColors = { sun: new THREE.Color(0x7d93d6), sky: new THREE.Color(0x3d4f86), ground: new THREE.Color(0x1c1d26) };
    this.dayFog = new THREE.Color(0xc9d8e2);
    this.nightFog = new THREE.Color(0x0e1626);
    this.sunDir = new THREE.Vector3();
    this.moonDir = new THREE.Vector3(-0.4, 0.55, -0.7).normalize();

    // 밤에 주인공 주변을 은은하게 밝히는 빛
    this.playerLight = new THREE.PointLight(0xffd9a0, 0, 26, 1.2);
    scene.add(this.playerLight);
    this.apply();
  }

  toggle() {
    this.target = this.target ? 0 : 1;
    return this.target;
  }

  setNight(on) {
    this.target = this.night = on ? 1 : 0;
    this.apply();
  }

  apply() {
    const k = this.night;
    // 해 고도: 낮 38° → 밤 -12°
    const elev = THREE.MathUtils.degToRad(38 - 50 * k);
    const azim = THREE.MathUtils.degToRad(-35); // 남서쪽 오후 해
    const skySun = new THREE.Vector3(Math.cos(elev) * Math.sin(azim), Math.sin(elev), Math.cos(elev) * Math.cos(azim));
    this.sky.material.uniforms.sunPosition.value.copy(skySun);
    // 그림자를 만드는 빛: 낮엔 해, 밤엔 달
    this.sunDir.copy(skySun.y > 0.2 ? skySun : this.moonDir);
    this.sky.material.uniforms.rayleigh.value = 1.4 + k * 1.2;

    // 밤에는 달빛(푸른 방향광)으로 바꿔 윤곽이 보이게 한다
    this.sun.intensity = 2.6 * (1 - k) + 1.1 * k;
    this.sun.color.copy(this.dayColors.sun).lerp(this.nightColors.sun, k);
    this.hemi.intensity = 1.1 * (1 - k) + 0.9 * k;
    this.hemi.color.copy(this.dayColors.sky).lerp(this.nightColors.sky, k);
    this.hemi.groundColor.copy(this.dayColors.ground).lerp(this.nightColors.ground, k);
    this.renderer.toneMappingExposure = 0.62 + 0.1 * k;
    this.scene.fog.color.copy(this.dayFog).lerp(this.nightFog, k);
    this.stars.material.opacity = Math.max(0, k * 1.2 - 0.2);
    this.moon.material.opacity = k;

    for (const { mat, color, intensity } of NIGHT.mats) {
      if (mat.userData.ghost) mat.opacity = 0.16 + k * 0.22;
      else if (mat.isMeshBasicMaterial) mat.color.copy(mat.userData.dayColor).lerp(color, k);
      else if (mat.emissive) mat.emissive.copy(color).multiplyScalar(k * intensity);
    }
    for (const { light, intensity } of NIGHT.lights) light.intensity = intensity * k;
    for (const fn of NIGHT.hooks) fn(k);
    this.playerLight.intensity = 40 * k;
  }

  update(dt, focus, eye = focus) {
    if (Math.abs(this.night - this.target) > 0.001) {
      this.night += Math.sign(this.target - this.night) * Math.min(Math.abs(this.target - this.night), dt * 0.6);
      this.apply();
    }
    // 그림자 카메라를 플레이어 주변으로
    this.sun.position.copy(focus).addScaledVector(this.sunDir, 200);
    this.sun.target.position.copy(focus);
    this.sky.position.copy(focus);
    // 카메라 쪽에서 비추어 주인공 얼굴/등이 보이게
    this.playerLight.position.copy(focus).lerp(eye, 0.45);
    this.playerLight.position.y = focus.y + 3;
    this.stars.position.copy(focus);
    this.moon.position.copy(focus).addScaledVector(this.moonDir, 8000);
  }
}
