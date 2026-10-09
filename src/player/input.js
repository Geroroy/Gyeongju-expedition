// 키보드 · 마우스 · 터치 입력을 하나로 모은다.
export class Input {
  constructor(canvas, touchRoot) {
    this.keys = new Set();
    this.pressed = new Set(); // 이번 프레임에 눌린 키 (한 번만 처리)
    this.look = { dx: 0, dy: 0 };
    this.zoom = 0;
    this.lastLookTime = -10;
    this.touchMove = { x: 0, y: 0, active: false };
    this.enabled = true;

    addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement) return;
      const k = e.code;
      if (!this.keys.has(k)) this.pressed.add(k);
      this.keys.add(k);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(k)) e.preventDefault();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());

    // 마우스 드래그로 시점 회전
    let dragging = false, lx = 0, ly = 0;
    canvas.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch') return;
      dragging = true;
      lx = e.clientX;
      ly = e.clientY;
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!dragging || e.pointerType === 'touch') return;
      this.look.dx += e.clientX - lx;
      this.look.dy += e.clientY - ly;
      lx = e.clientX;
      ly = e.clientY;
      this.lastLookTime = performance.now() / 1000;
    });
    const end = () => (dragging = false);
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('wheel', (e) => {
      this.zoom += Math.sign(e.deltaY);
      e.preventDefault();
    }, { passive: false });

    this._setupTouch(canvas, touchRoot);
  }

  _setupTouch(canvas, root) {
    const stick = root.querySelector('.stick');
    const knob = root.querySelector('.knob');
    let stickId = null, sx = 0, sy = 0;
    let lookId = null, lx = 0, ly = 0;
    let pinch = null;
    const R = 55;
    const touches = new Map();

    canvas.addEventListener('touchstart', (e) => {
      document.body.classList.add('touch');
      for (const t of e.changedTouches) {
        touches.set(t.identifier, { x: t.clientX, y: t.clientY });
        if (t.clientX < innerWidth * 0.42 && stickId === null) {
          stickId = t.identifier;
          sx = t.clientX;
          sy = t.clientY;
          stick.style.left = `${sx - 60}px`;
          stick.style.top = `${sy - 60}px`;
          stick.classList.add('on');
          this.touchMove.active = true;
        } else if (lookId === null) {
          lookId = t.identifier;
          lx = t.clientX;
          ly = t.clientY;
        }
      }
      if (touches.size === 2 && stickId === null) {
        const [a, b] = [...touches.values()];
        pinch = Math.hypot(a.x - b.x, a.y - b.y);
      }
      e.preventDefault();
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        touches.set(t.identifier, { x: t.clientX, y: t.clientY });
        if (t.identifier === stickId) {
          let dx = t.clientX - sx, dy = t.clientY - sy;
          const l = Math.hypot(dx, dy);
          if (l > R) {
            dx = (dx / l) * R;
            dy = (dy / l) * R;
          }
          knob.style.transform = `translate(${dx}px, ${dy}px)`;
          this.touchMove.x = dx / R;
          this.touchMove.y = -dy / R;
        } else if (t.identifier === lookId) {
          this.look.dx += (t.clientX - lx) * 1.3;
          this.look.dy += (t.clientY - ly) * 1.3;
          lx = t.clientX;
          ly = t.clientY;
          this.lastLookTime = performance.now() / 1000;
        }
      }
      if (pinch && touches.size === 2) {
        const [a, b] = [...touches.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        this.zoom += (pinch - d) / 40;
        pinch = d;
      }
      e.preventDefault();
    }, { passive: false });

    const end = (e) => {
      for (const t of e.changedTouches) {
        touches.delete(t.identifier);
        if (t.identifier === stickId) {
          stickId = null;
          this.touchMove = { x: 0, y: 0, active: false };
          knob.style.transform = '';
          stick.classList.remove('on');
        }
        if (t.identifier === lookId) lookId = null;
      }
      if (touches.size < 2) pinch = null;
    };
    canvas.addEventListener('touchend', end);
    canvas.addEventListener('touchcancel', end);

    // 화면 버튼
    root.querySelectorAll('[data-key]').forEach((btn) => {
      const code = btn.dataset.key;
      btn.addEventListener('touchstart', (e) => {
        this.pressed.add(code);
        this.keys.add(code);
        e.preventDefault();
      }, { passive: false });
      btn.addEventListener('touchend', () => this.keys.delete(code));
      btn.addEventListener('click', () => this.pressed.add(code));
    });
  }

  axis() {
    if (!this.enabled) return { x: 0, y: 0 };
    const k = this.keys;
    let x = 0, y = 0;
    if (k.has('KeyW') || k.has('ArrowUp')) y += 1;
    if (k.has('KeyS') || k.has('ArrowDown')) y -= 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) x += 1;
    if (this.touchMove.active) {
      x += this.touchMove.x;
      y += this.touchMove.y;
    }
    const l = Math.hypot(x, y);
    if (l > 1) {
      x /= l;
      y /= l;
    }
    return { x, y };
  }

  held(code) {
    return this.enabled && this.keys.has(code);
  }

  take(code) {
    const had = this.pressed.has(code);
    this.pressed.delete(code);
    return had;
  }

  endFrame() {
    this.pressed.clear();
    this.look.dx = this.look.dy = 0;
    this.zoom = 0;
  }
}
