// HUD: 지명 표시, 미니맵, 스탬프, 정보 패널, 지도(빠른 이동)
import { LANDMARKS, ROADS } from '../world/layout.js';
import { WORLD, toLatLon } from '../world/geo.js';
import { distToPolyline } from '../world/collision.js';

const STORE_KEY = 'gyeongju-expedition:stamps';

function loadStamps() {
  try {
    return new Set(JSON.parse(localStorage.getItem(STORE_KEY) || '[]'));
  } catch {
    return new Set();
  }
}
function saveStamps(set) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify([...set]));
  } catch {
    /* 저장 불가 환경은 무시 */
  }
}

const $ = (s) => document.querySelector(s);

export class HUD {
  constructor(groundCanvas, pxPerM) {
    this.ground = groundCanvas;
    this.pxPerM = pxPerM;
    this.stamps = loadStamps();
    this.current = null;
    this.toastTimer = 0;
    this.mm = $('#minimap canvas');
    this.mmCtx = this.mm.getContext('2d');
    this.mm.width = this.mm.height = 200 * Math.min(2, devicePixelRatio || 1);
    this.onTeleport = null;
    this.modal = null;

    // 지도용 축소본
    const mw = 1600, mh = Math.round((mw * (WORLD.z1 - WORLD.z0)) / (WORLD.x1 - WORLD.x0));
    this.mapCanvas = $('#map canvas');
    this.mapCanvas.width = mw;
    this.mapCanvas.height = mh;
    const mc = this.mapCanvas.getContext('2d');
    mc.drawImage(groundCanvas, 0, 0, mw, mh);
    // 도로 이름
    mc.font = 'bold 15px "Noto Sans KR", sans-serif';
    mc.fillStyle = 'rgba(31,27,23,0.75)';
    mc.textAlign = 'center';
    const seen = new Set();
    for (const r of ROADS) {
      if (r.type !== 'road' || !r.name || seen.has(r.name)) continue;
      seen.add(r.name);
      const i = Math.floor((r.pts.length - 1) / 2);
      const [ax, az] = r.pts[i], [bx, bz] = r.pts[i + 1];
      const [px, py] = this._mapXY((ax + bx) / 2, (az + bz) / 2);
      mc.save();
      mc.translate((px / 100) * mw, (py / 100) * mh);
      let ang = Math.atan2(bz - az, bx - ax);
      if (ang > Math.PI / 2) ang -= Math.PI;
      if (ang < -Math.PI / 2) ang += Math.PI;
      mc.rotate(ang);
      mc.fillText(r.name, 0, -10);
      mc.restore();
    }

    document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => this.closeModal()));
    for (const id of ['#info', '#map', '#stamps']) {
      $(id).addEventListener('click', (e) => {
        if (e.target === e.currentTarget) this.closeModal();
      });
    }
    $('#stampbtn').addEventListener('click', () => this.openStamps());
    this._updateCount();
  }

  _mapXY(x, z) {
    return [((x - WORLD.x0) / (WORLD.x1 - WORLD.x0)) * 100, ((z - WORLD.z0) / (WORLD.z1 - WORLD.z0)) * 100];
  }

  _updateCount() {
    $('#stampcount').textContent = `${this.stamps.size}/${LANDMARKS.length}`;
  }

  landmarkAt(x, z) {
    let best = null, bd = Infinity;
    for (const l of LANDMARKS) {
      const d = Math.hypot(x - l.pos.x, z - l.pos.z);
      // 반지름 대비 상대거리로 고른다 (큰 구역 안의 작은 명소 우선)
      if (d < l.radius && d / l.radius < bd) {
        bd = d / l.radius;
        best = l;
      }
    }
    return best;
  }

  roadAt(x, z) {
    let best = null, bd = Infinity;
    for (const r of ROADS) {
      if (!r.name) continue;
      const d = distToPolyline(x, z, r.pts);
      if (d < r.w / 2 + 6 && d < bd) {
        bd = d;
        best = r;
      }
    }
    return best;
  }

  update(dt, player, interactTarget) {
    const { x, z } = player.pos;
    const lm = this.landmarkAt(x, z);
    if (lm !== this.current) {
      this.current = lm;
      if (lm) {
        const isNew = !this.stamps.has(lm.id);
        if (isNew) {
          this.stamps.add(lm.id);
          saveStamps(this.stamps);
          this._updateCount();
        }
        this.toast(lm.name, isNew);
      }
    }
    const road = lm ? null : this.roadAt(x, z);
    $('.place-name').textContent = lm ? lm.name : road ? road.name : '경주 시내';
    $('.place-sub').textContent = lm ? lm.en : road ? '경주시' : '경상북도 경주시';

    const ll = toLatLon(x, z);
    $('#coords').textContent = `${ll.lat.toFixed(5)}°N  ${ll.lon.toFixed(5)}°E`;

    // 상호작용 안내
    const pr = $('#prompt');
    if (interactTarget) {
      pr.hidden = false;
      pr.innerHTML = interactTarget;
    } else pr.hidden = true;

    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) $('#toast').classList.remove('show');
    }

    this._drawMinimap(player);
  }

  toast(name, isNew) {
    const t = $('#toast');
    t.innerHTML = `<div class="t-kicker">${isNew ? '새로운 장소 발견' : '도착'}</div><div class="t-name">${name}</div>${
      isNew ? '<div class="t-stamp">스탬프 획득!</div>' : ''
    }`;
    t.classList.add('show');
    this.toastTimer = isNew ? 3.2 : 2.0;
  }

  notice(text) {
    const t = $('#toast');
    t.innerHTML = `<div class="t-kicker">${text}</div>`;
    t.classList.add('show');
    this.toastTimer = 1.6;
  }

  _drawMinimap(player) {
    const c = this.mmCtx, W = this.mm.width;
    const view = 320; // 미니맵이 보여주는 지름(m)
    const scale = W / view;
    const { x, z } = player.pos;
    c.save();
    c.fillStyle = '#8f9b5a';
    c.fillRect(0, 0, W, W);
    const k = this.pxPerM;
    const sx = (x - view / 2 - WORLD.x0) * k.x;
    const sz = (z - view / 2 - WORLD.z0) * k.z;
    c.drawImage(this.ground, sx, sz, view * k.x, view * k.z, 0, 0, W, W);
    // 랜드마크 아이콘
    c.font = `${Math.round(W * 0.08)}px sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    for (const l of LANDMARKS) {
      const px = (l.pos.x - x) * scale + W / 2, pz = (l.pos.z - z) * scale + W / 2;
      if (px < -20 || px > W + 20 || pz < -20 || pz > W + 20) continue;
      c.fillStyle = this.stamps.has(l.id) ? 'rgba(245,238,220,0.95)' : 'rgba(180,170,150,0.9)';
      c.beginPath();
      c.arc(px, pz, W * 0.055, 0, Math.PI * 2);
      c.fill();
      c.fillText(l.icon, px, pz + 1);
    }
    // 자전거
    if (!player.riding) {
      const bx = (player.bikePos.x - x) * scale + W / 2, bz = (player.bikePos.z - z) * scale + W / 2;
      c.fillText('🚲', bx, bz);
    }
    // 플레이어 화살표
    c.translate(W / 2, W / 2);
    c.rotate(-player.heading + Math.PI);
    c.fillStyle = 'rgba(255,255,255,0.25)';
    c.beginPath();
    c.moveTo(0, 0);
    c.arc(0, 0, W * 0.22, -Math.PI / 2 - 0.5, -Math.PI / 2 + 0.5);
    c.fill();
    c.fillStyle = '#d0231f';
    c.strokeStyle = '#fff';
    c.lineWidth = W * 0.012;
    c.beginPath();
    c.moveTo(0, -W * 0.05);
    c.lineTo(W * 0.035, W * 0.035);
    c.lineTo(0, W * 0.018);
    c.lineTo(-W * 0.035, W * 0.035);
    c.closePath();
    c.fill();
    c.stroke();
    c.restore();
  }

  // ── 모달 ──
  get isModalOpen() {
    return !!this.modal;
  }

  closeModal() {
    if (this.modal) $(this.modal).hidden = true;
    this.modal = null;
  }

  _open(id) {
    this.closeModal();
    this.modal = id;
    $(id).hidden = false;
  }

  openInfo(lm) {
    $('#info .info-icon').textContent = lm.icon;
    $('#info h2').textContent = lm.name;
    $('#info .info-en').textContent = lm.en;
    $('#info .info-desc').textContent = lm.desc;
    $('#info .info-facts').innerHTML = lm.facts.map((f) => `<li>${f}</li>`).join('');
    $('#info .info-stamp').hidden = !this.stamps.has(lm.id);
    this._open('#info');
  }

  openMap(player) {
    const pins = $('#map .map-pins');
    pins.innerHTML = '';
    for (const l of LANDMARKS) {
      const [px, py] = this._mapXY(l.pos.x, l.pos.z);
      const got = this.stamps.has(l.id);
      const b = document.createElement('button');
      b.className = `pin ${got ? 'visited' : 'locked'}`;
      b.style.left = `${px}%`;
      b.style.top = `${py}%`;
      b.innerHTML = `<span class="dot">${l.icon}</span><span class="lbl">${l.name}</span>`;
      b.title = got ? `${l.name}(으)로 이동` : '아직 방문하지 않은 곳';
      if (got) {
        b.addEventListener('click', () => {
          this.closeModal();
          this.onTeleport?.(l);
        });
      }
      pins.appendChild(b);
    }
    const [mx, my] = this._mapXY(player.pos.x, player.pos.z);
    const me = document.createElement('div');
    me.className = 'pin me';
    me.style.left = `${mx}%`;
    me.style.top = `${my}%`;
    me.innerHTML = '<span class="dot">🦍</span><span class="lbl">현재 위치</span>';
    pins.appendChild(me);
    this._open('#map');
  }

  openStamps() {
    const grid = $('#stamps .stamp-grid');
    grid.innerHTML = LANDMARKS.map(
      (l) => `<div class="stamp ${this.stamps.has(l.id) ? 'got' : ''}"><div class="s-icon">${l.icon}</div><div class="s-name">${l.name}</div></div>`
    ).join('');
    const n = this.stamps.size, N = LANDMARKS.length;
    $('#stamps .stamp-progress').textContent = n === N ? `${N}곳 모두 완주! 경주 탐방 완료 🎉` : `${n} / ${N} 곳 방문`;
    this._open('#stamps');
  }
}
