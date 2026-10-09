// 캔버스로 그리는 절차적 텍스처 모음 (외부 이미지 없이 동작)
import * as THREE from 'three';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function toTex(c, repeat = false) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

// 한옥 벽면: 기둥 · 인방 · 흰 회벽 · 창호지 문살
export function hanokWallTexture() {
  const [c, g] = canvas(512, 256);
  g.fillStyle = '#efe8d6';
  g.fillRect(0, 0, 512, 256);
  const wood = '#6e4b2e';
  const bays = 3;
  const bw = 512 / bays;
  for (let i = 0; i < bays; i++) {
    const x0 = i * bw;
    // 하방(아래 나무판)
    g.fillStyle = '#8a6342';
    g.fillRect(x0, 210, bw, 46);
    if (i === 1) {
      // 문살 창호
      g.fillStyle = '#f3ead2';
      g.fillRect(x0 + 18, 40, bw - 36, 168);
      g.strokeStyle = '#7a5434';
      g.lineWidth = 3;
      g.strokeRect(x0 + 18, 40, bw - 36, 168);
      g.lineWidth = 1.6;
      for (let x = x0 + 18; x < x0 + bw - 18; x += 12) {
        g.beginPath(); g.moveTo(x, 40); g.lineTo(x, 208); g.stroke();
      }
      for (let y = 40; y < 208; y += 14) {
        g.beginPath(); g.moveTo(x0 + 18, y); g.lineTo(x0 + bw - 18, y); g.stroke();
      }
      g.beginPath(); g.moveTo(x0 + bw / 2, 40); g.lineTo(x0 + bw / 2, 208); g.lineWidth = 3; g.stroke();
    } else {
      // 작은 들창
      g.fillStyle = '#f3ead2';
      g.fillRect(x0 + bw / 2 - 26, 70, 52, 52);
      g.strokeStyle = '#7a5434';
      g.lineWidth = 2;
      g.strokeRect(x0 + bw / 2 - 26, 70, 52, 52);
      for (let k = 1; k < 4; k++) {
        g.beginPath(); g.moveTo(x0 + bw / 2 - 26 + k * 13, 70); g.lineTo(x0 + bw / 2 - 26 + k * 13, 122); g.stroke();
        g.beginPath(); g.moveTo(x0 + bw / 2 - 26, 70 + k * 13); g.lineTo(x0 + bw / 2 + 26, 70 + k * 13); g.stroke();
      }
      // 중방
      g.fillStyle = wood;
      g.fillRect(x0, 150, bw, 8);
    }
    // 기둥
    g.fillStyle = wood;
    g.fillRect(x0, 0, 14, 256);
  }
  g.fillRect(498, 0, 14, 256);
  // 창방(위 보)
  g.fillRect(0, 0, 512, 22);
  g.fillStyle = '#5a3c24';
  g.fillRect(0, 22, 512, 4);
  return toTex(c);
}

// 현대식 상가/주택 벽면 (3층분)
export function modernWallTexture() {
  const [c, g] = canvas(256, 256);
  const r = rng(3);
  g.fillStyle = '#d8d1c4';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1500; i++) {
    g.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.06)';
    g.fillRect(r() * 256, r() * 256, 2, 2);
  }
  for (let f = 0; f < 3; f++) {
    const y = f * 85;
    g.fillStyle = 'rgba(80,70,60,0.25)';
    g.fillRect(0, y + 80, 256, 5);
    for (let w = 0; w < 4; w++) {
      const x = 14 + w * 60;
      g.fillStyle = '#5d6c78';
      g.fillRect(x, y + 22, 44, 44);
      g.fillStyle = 'rgba(200,225,240,0.35)';
      g.fillRect(x + 3, y + 25, 18, 38);
      g.strokeStyle = '#ece6da';
      g.lineWidth = 3;
      g.strokeRect(x, y + 22, 44, 44);
    }
  }
  return toTex(c);
}

// 첨성대 화강암 27단
export function cheomseongdaeTexture() {
  const [c, g] = canvas(1024, 512);
  const r = rng(11);
  g.fillStyle = '#b5a78e';
  g.fillRect(0, 0, 1024, 512);
  const rows = 27;
  const rh = 512 / rows;
  for (let i = 0; i < rows; i++) {
    const y = 512 - (i + 1) * rh;
    let x = -r() * 60;
    while (x < 1024) {
      const w = 48 + r() * 30;
      const l = 150 + r() * 45;
      g.fillStyle = `rgb(${l + 18},${l + 8},${l - 12})`;
      g.fillRect(x + 1.5, y + 1.5, w - 3, rh - 3);
      // 풍화 얼룩
      for (let k = 0; k < 6; k++) {
        g.fillStyle = r() < 0.5 ? 'rgba(60,55,40,0.18)' : 'rgba(255,250,230,0.12)';
        g.fillRect(x + r() * w, y + r() * rh, 3 + r() * 6, 2 + r() * 3);
      }
      x += w;
    }
  }
  return toTex(c, true);
}

// 모전석탑 벽돌
export function brickTexture() {
  const [c, g] = canvas(256, 256);
  const r = rng(5);
  g.fillStyle = '#4b4741';
  g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 10) {
    const off = (y / 10) % 2 ? 0 : 14;
    for (let x = -off; x < 256; x += 28) {
      const l = 95 + r() * 40;
      g.fillStyle = `rgb(${l},${l - 6},${l - 14})`;
      g.fillRect(x + 1, y + 1, 26, 8);
    }
  }
  return toTex(c, true);
}

// 기와 지붕 (세로 골)
export function roofTexture() {
  const [c, g] = canvas(256, 128);
  g.fillStyle = '#4a4e57';
  g.fillRect(0, 0, 256, 128);
  for (let x = 0; x < 256; x += 8) {
    const grd = g.createLinearGradient(x, 0, x + 8, 0);
    grd.addColorStop(0, '#2f323a');
    grd.addColorStop(0.5, '#5d626c');
    grd.addColorStop(1, '#2f323a');
    g.fillStyle = grd;
    g.fillRect(x, 0, 8, 128);
  }
  // 막새 줄
  g.fillStyle = 'rgba(20,20,25,0.35)';
  for (let y = 0; y < 128; y += 16) g.fillRect(0, y, 256, 2);
  return toTex(c, true);
}

// 돌담 (기와 얹은 담장 몸체)
export function stoneWallTexture() {
  const [c, g] = canvas(256, 64);
  const r = rng(9);
  g.fillStyle = '#b3a58c';
  g.fillRect(0, 0, 256, 64);
  for (let i = 0; i < 70; i++) {
    const l = 120 + r() * 70;
    g.fillStyle = `rgb(${l + 10},${l},${l - 20})`;
    g.beginPath();
    g.ellipse(r() * 256, r() * 64, 8 + r() * 10, 5 + r() * 6, 0, 0, Math.PI * 2);
    g.fill();
  }
  return toTex(c, true);
}

// 황리단길 간판 아틀라스
export const SIGNS = [
  ['황리단 커피', '#2f4a3a', '#f4ead2'],
  ['십원빵', '#c9a227', '#3a2a10'],
  ['찰보리빵', '#7b5b3a', '#fff4dc'],
  ['한복 대여', '#b63a4c', '#fff'],
  ['필름 사진관', '#d42a1f', '#ffd400'],
  ['소품샵', '#e9d8c4', '#5a3a2a'],
  ['달빛 책방', '#1f2c4a', '#f2e3a1'],
  ['경주 국밥', '#3d2b1f', '#f7e2b6'],
  ['젤라또', '#f1b6c2', '#5a2335'],
  ['막걸리 주막', '#2a2a2a', '#e8d29c'],
  ['한옥 스테이', '#5c4632', '#f4e9d3'],
  ['디저트 카페', '#fdf3e4', '#8a4b2c'],
  ['향수 공방', '#6a5a8c', '#fff'],
  ['수제 버거', '#e07b2a', '#fff'],
  ['꽃집', '#9cbf8a', '#2b3b22'],
  ['도자기', '#3a5a6a', '#f0e8d8'],
];

export function signAtlas() {
  const cols = 4, rows = 4, cw = 256, ch = 96;
  const [c, g] = canvas(cols * cw, rows * ch);
  SIGNS.forEach(([text, bg, fg], i) => {
    const x = (i % cols) * cw, y = Math.floor(i / cols) * ch;
    g.fillStyle = bg;
    g.fillRect(x, y, cw, ch);
    g.strokeStyle = fg;
    g.globalAlpha = 0.6;
    g.lineWidth = 3;
    g.strokeRect(x + 6, y + 6, cw - 12, ch - 12);
    g.globalAlpha = 1;
    g.fillStyle = fg;
    g.font = 'bold 40px "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, x + cw / 2, y + ch / 2 + 2, cw - 24);
  });
  const t = toTex(c);
  return { texture: t, cols, rows, count: SIGNS.length };
}

// 텍스트 라벨 (안내판 등)
export function labelTexture(text, { bg = '#3b2a1c', fg = '#f6ead0', w = 512, h = 128, font = 56 } = {}) {
  const [c, g] = canvas(w, h);
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  g.strokeStyle = fg;
  g.lineWidth = 4;
  g.strokeRect(8, 8, w - 16, h - 16);
  g.fillStyle = fg;
  g.font = `bold ${font}px "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, w / 2, h / 2 + 3, w - 30);
  return toTex(c);
}
