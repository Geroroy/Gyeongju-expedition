import * as THREE from 'three';
import { buildWorld } from './world/world.js';
import { Atmosphere } from './world/sky.js';
import { Crowd } from './world/npc.js';
import { Player } from './player/controller.js';
import { Input } from './player/input.js';
import { HUD } from './ui/hud.js';
import { SPAWN } from './world/layout.js';
import { groundHeight } from './world/collision.js';

const params = new URLSearchParams(location.search);
const canvas = document.getElementById('game');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.2, 16000);

const atmosphere = new Atmosphere(scene, renderer);
const world = buildWorld(scene, renderer);
const input = new Input(canvas, document.getElementById('touch'));

const spawn = { ...SPAWN };
if (params.has('x')) spawn.x = +params.get('x');
if (params.has('z')) spawn.z = +params.get('z');
if (params.has('h')) spawn.heading = +params.get('h');
const player = new Player(scene, camera, world.colliders, input, spawn);
if (params.has('dist')) player.dist = +params.get('dist');
if (params.has('pitch')) player.pitch = +params.get('pitch');
const crowd = new Crowd(scene, 80);
const hud = new HUD(world.groundCanvas, world.pxPerM);
if (params.get('night') === '1') atmosphere.setNight(true);

// 빠른 이동: 랜드마크 근처의 빈 자리를 찾아 순간이동
hud.onTeleport = (lm) => {
  const { x, z } = lm.pos;
  for (const f of [0.45, 0.6, 0.75, 0.3, 0.9]) {
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2 + Math.PI / 2;
      const tx = x + Math.cos(a) * lm.radius * f, tz = z + Math.sin(a) * lm.radius * f;
      if (!world.colliders.blocked(tx, tz, 1.2)) {
        player.teleport(tx, tz, Math.atan2(x - tx, z - tz));
        hud.current = null;
        return;
      }
    }
  }
};

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ── 타이틀 ──
let playing = false;
const startBtn = document.getElementById('start');
function start() {
  if (playing) return;
  playing = true;
  document.getElementById('title').hidden = true;
  document.getElementById('hud').hidden = false;
  player._snapCamera();
  canvas.focus();
}
startBtn.addEventListener('click', start);
addEventListener('keydown', (e) => {
  if (!playing && (e.code === 'Enter' || e.code === 'Space')) start();
});

function titleCamera(t) {
  const g = player.gorilla.root.position;
  const a = player.heading + 0.5 + Math.sin(t * 0.15) * 0.35;
  camera.position.set(g.x + Math.sin(a) * 4.2 - 1.2, g.y + 1.7, g.z + Math.cos(a) * 4.2);
  camera.lookAt(g.x - 1.0, g.y + 1.0, g.z);
}

// ── 메인 루프 ──
const clock = new THREE.Clock();
let elapsed = 0;
let showHelp = false;

function interactPrompt() {
  if (player.riding) return '<kbd>F</kbd>자전거에서 내리기';
  if (player.nearBike()) return '<kbd>F</kbd>자전거 타기';
  if (hud.current) return `<kbd>E</kbd>${hud.current.name} 살펴보기`;
  return null;
}

function handleKeys() {
  if (input.take('Escape')) hud.closeModal();
  if (input.take('KeyM')) hud.modal === '#map' ? hud.closeModal() : hud.openMap(player);
  if (input.take('KeyB')) hud.modal === '#stamps' ? hud.closeModal() : hud.openStamps();
  if (input.take('KeyN')) {
    const n = atmosphere.toggle();
    hud.notice(n ? '🌙 밤이 되었습니다' : '☀️ 아침이 밝았습니다');
  }
  if (input.take('KeyH')) {
    showHelp = !showHelp;
    document.getElementById('help').hidden = !showHelp;
  }
  if (input.take('KeyE')) {
    if (hud.modal === '#info') hud.closeModal();
    else if (hud.current) hud.openInfo(hud.current);
  }
  if (input.take('KeyF') && !hud.isModalOpen) {
    const r = player.toggleBike();
    if (r === 'on') hud.notice('🚲 자전거 탑승 — 경주는 자전거 여행이 제맛');
  }
}

function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  elapsed += dt;
  if (playing) {
    handleKeys();
    input.enabled = !hud.isModalOpen;
    player.update(dt);
    hud.update(dt, player, interactPrompt());
  } else {
    player.gorilla.root.position.set(player.pos.x, groundHeight(player.pos.x, player.pos.z), player.pos.z);
    player.gorilla.root.rotation.y = player.heading;
    player.gorilla.update(dt, {});
    titleCamera(elapsed);
  }
  crowd.update(dt, player.pos);
  atmosphere.update(dt, player.pos, camera.position);
  input.endFrame();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

renderer.compile(scene, camera);
requestAnimationFrame(() => {
  startBtn.disabled = false;
  startBtn.textContent = '탐방 시작';
  if (params.has('autostart')) start();
  frame();
});

// 디버그용 (브라우저 콘솔에서 __game.player.teleport(x, z) 등)
window.__game = { player, hud, atmosphere, world, camera };
