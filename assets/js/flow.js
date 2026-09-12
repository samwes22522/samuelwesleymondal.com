/* ==========================================================================
   Hero: live 2D potential flow around a Joukowski aerofoil.

   Flow past a circle with circulation, mapped to an aerofoil by z = ζ + 1/ζ.
   Circulation is fixed by the Kutta condition (smooth flow off the trailing
   edge). Inviscid, so: zero drag, no stall. The HUD says exactly that.
   ========================================================================== */
(function () {
  'use strict';

  const canvas = document.getElementById('flow');
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext('2d');
  const field = canvas.parentElement;
  const hud = document.getElementById('hud');
  const slider = document.getElementById('aoa');
  const outA = document.getElementById('aoa-out');
  const outCL = document.getElementById('cl-out');
  const outCp = document.getElementById('cp-out');
  const note = document.getElementById('hud-note');
  const cpUp = document.getElementById('cp-up');
  const cpLo = document.getElementById('cp-lo');
  const cpZero = document.getElementById('cp-zero');
  const cpTop = document.getElementById('cp-top');
  const cpZeroT = document.getElementById('cp-zero-t');
  const toggleBtn = document.querySelector('[data-flow-toggle]');
  const modeBtns = Array.from(document.querySelectorAll('[data-flow-mode]'));
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const NOTE_DEFAULT = note ? note.textContent : '';
  const NOTE_STALL = 'Past ~12° a real section separates and stalls. This model can’t — which is exactly why I test.';
  const DEG = Math.PI / 180;

  /* ---------- section geometry (Joukowski, c = 1) ---------- */
  const MX = -0.09, MY = 0.075;             // circle centre → thickness, camber
  const R = Math.hypot(1 - MX, MY);         // passes through ζ = 1: sharp trailing edge
  const R2 = R * R;
  const BETA = Math.atan2(MY, 1 - MX);      // zero-lift angle is −β

  const N_OUT = 160;
  const outX = new Float64Array(N_OUT), outY = new Float64Array(N_OUT);
  let xLE = Infinity, yLE = 0;
  for (let k = 0; k < N_OUT; k++) {
    const th = -BETA + (2 * Math.PI * k) / N_OUT;
    const zr = MX + R * Math.cos(th), zi = MY + R * Math.sin(th);
    const m = zr * zr + zi * zi;
    outX[k] = zr + zr / m;
    outY[k] = zi - zi / m;
    if (outX[k] < xLE) { xLE = outX[k]; yLE = outY[k]; }
  }
  const CHORD = 2 - xLE;                    // trailing edge sits at z = 2
  const XMID = (2 + xLE) / 2;

  /* ---------- flow state ---------- */
  let alpha = (reduce ? 6 : 0) * DEG;
  let alphaTarget = 6 * DEG;
  let ca = 1, sa = 0, G = 0;                // G = Γ / 2π with U∞ = 1
  function setAlpha(a) {
    alpha = a; ca = Math.cos(a); sa = Math.sin(a);
    G = 2 * R * Math.sin(a + BETA);         // Kutta condition
  }
  setAlpha(alpha);

  const V = new Float64Array(2);

  /* velocity (u, v) at z = x + iy in the aerofoil frame; false if inside the section */
  function velAF(x, y) {
    // ζ = (z ± √(z² − 4)) / 2 — take the root outside the circle
    const ar = x * x - y * y - 4, ai = 2 * x * y;
    const mod = Math.hypot(ar, ai);
    const sr = Math.sqrt(Math.max(0, (mod + ar) / 2));
    let si = Math.sqrt(Math.max(0, (mod - ar) / 2));
    if (ai < 0) si = -si;
    let zr = (x + sr) / 2, zi = (y + si) / 2;
    let dr = zr - MX, di = zi - MY, d2 = dr * dr + di * di;
    const zr2 = (x - sr) / 2, zi2 = (y - si) / 2;
    const dr2 = zr2 - MX, di2 = zi2 - MY, d22 = dr2 * dr2 + di2 * di2;
    if (d22 > d2) { zr = zr2; zi = zi2; dr = dr2; di = di2; d2 = d22; }
    if (d2 < R2 * 1.0004) return false;

    // dW/dζ = e^{−iα} − R² e^{iα} / (ζ−ζ0)² + iG / (ζ−ζ0)
    const ir = dr / d2, ii = -di / d2;
    const i2r = ir * ir - ii * ii, i2i = 2 * ir * ii;
    const wr = ca - R2 * (ca * i2r - sa * i2i) - G * ii;
    const wi = -sa - R2 * (ca * i2i + sa * i2r) + G * ir;

    // dz/dζ = 1 − 1/ζ²
    const m = zr * zr + zi * zi;
    const jr0 = zr / m, ji0 = -zi / m;
    const jr = 1 - (jr0 * jr0 - ji0 * ji0), ji = -2 * jr0 * ji0;
    const jj = jr * jr + ji * ji;
    if (jj < 1e-10) return false;

    // u − iv = (dW/dζ) / (dz/dζ)
    V[0] = (wr * jr + wi * ji) / jj;
    V[1] = -(wi * jr - wr * ji) / jj;
    return true;
  }

  /* velocity in the display frame (freestream along +x, mid-chord at origin) */
  function vel(px, py) {
    if (!velAF(px * ca - py * sa + XMID, px * sa + py * ca)) return false;
    const u = V[0], v = V[1];
    V[0] = u * ca + v * sa;
    V[1] = -u * sa + v * ca;
    return true;
  }

  /* surface pressure coefficient, split into suction (upper) and pressure (lower) sides */
  const N_S = 120;
  function surfaceCp() {
    const pts = [];
    let kMin = 0, xMin = Infinity, cpMin = Infinity;
    const gR = G / R;
    for (let k = 1; k < N_S; k++) {
      const th = -BETA + (2 * Math.PI * k) / N_S;
      const c = Math.cos(th), s = Math.sin(th);
      const zr = MX + R * c, zi = MY + R * s;
      // on the circle: dW/dζ = e^{−iα} − e^{i(α−2θ)} + (G/R)·i·e^{−iθ}
      const wr = ca - Math.cos(alpha - 2 * th) + gR * s;
      const wi = -sa - Math.sin(alpha - 2 * th) + gR * c;
      const m = zr * zr + zi * zi;
      const jr0 = zr / m, ji0 = -zi / m;
      const jr = 1 - (jr0 * jr0 - ji0 * ji0), ji = -2 * jr0 * ji0;
      const cp = 1 - (wr * wr + wi * wi) / (jr * jr + ji * ji);
      const x = zr + zr / m;
      pts.push([(x - xLE) / CHORD, cp]);
      if (x < xMin) { xMin = x; kMin = pts.length - 1; }
      if (cp < cpMin) cpMin = cp;
    }
    return { up: pts.slice(0, kMin + 1), lo: pts.slice(kMin), cpMin };
  }

  /* ---------- colours (read from CSS tokens so both themes work) ---------- */
  const BUCKETS = 8;
  const EDGES = [0.55, 0.75, 0.9, 1.05, 1.2, 1.4, 1.7];
  let COLORS = [], C_ACCENT = '#e2703a', C_FILL = '#151518', C_MUTED = '#8a857f', ALPHA = 0.9;
  function hex(c) {
    c = c.trim().replace('#', '');
    if (c.length === 3) c = c.split('').map((x) => x + x).join('');
    const n = parseInt(c, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function mix(a, b, t) { return a.map((v, i) => Math.round(v + (b[i] - v) * t)); }
  function readColors() {
    const cs = getComputedStyle(document.documentElement);
    const slow = hex(cs.getPropertyValue('--flow-slow'));
    const mid = hex(cs.getPropertyValue('--flow-mid'));
    const fast = hex(cs.getPropertyValue('--flow-fast'));
    const hot = hex(cs.getPropertyValue('--flow-hot'));
    COLORS = [];
    for (let b = 0; b < BUCKETS; b++) {
      const t = b / (BUCKETS - 1);
      const c = t < 0.42 ? mix(slow, mid, t / 0.42) : t < 0.72 ? mix(mid, fast, (t - 0.42) / 0.3) : mix(fast, hot, (t - 0.72) / 0.28);
      COLORS.push(`rgb(${c[0]},${c[1]},${c[2]})`);
    }
    C_ACCENT = cs.getPropertyValue('--accent').trim();
    C_FILL = cs.getPropertyValue('--surface').trim();
    C_MUTED = cs.getPropertyValue('--muted').trim();
    ALPHA = document.documentElement.dataset.theme === 'light' ? 0.8 : 0.9;
  }
  function bucketOf(q) {
    let b = 0;
    while (b < EDGES.length && q > EDGES[b]) b++;
    return b;
  }

  /* ---------- layout & particles ---------- */
  const U = 1.05;                           // display speed, world units per second
  const HIST = 7;                           // trail samples kept per particle
  const SAMPLE = 0.045;                     // seconds between trail samples (~0.27 s trail)
  const LEVELS = [1, 0.55, 0.25];           // trail opacity, head → tail
  const LEVEL_OF = [0, 0, 1, 1, 2, 2];
  let W = 1, H = 1, S = 100, CX = 0, CY = 0, CHORD_PX = 400;
  let xMin = -5, xMax = 5, yMin = -3, yMax = 3;
  let N = 0, PX, PY, VX, VY, AGE, LIFE, B, HX, HY;
  let hi = 0, sampleAcc = 0, capN = Infinity;

  function seed(i, anywhere) {
    let x, y, tries = 0;
    do {
      x = anywhere ? xMin + Math.random() * (xMax - xMin) : xMin + Math.random() * 0.4;
      y = yMin + Math.random() * (yMax - yMin);
    } while (!vel(x, y) && ++tries < 10);
    PX[i] = x; PY[i] = y; VX[i] = V[0]; VY[i] = V[1];
    AGE[i] = 0; LIFE[i] = 25 + Math.random() * 35;
    B[i] = anywhere ? bucketOf(Math.hypot(V[0], V[1])) : 255;
    const base = i * HIST;
    for (let k = 0; k < HIST; k++) { HX[base + k] = x; HY[base + k] = y; }
  }
  function allocate(n) {
    N = n;
    PX = new Float32Array(n); PY = new Float32Array(n);
    VX = new Float32Array(n); VY = new Float32Array(n);
    AGE = new Float32Array(n); LIFE = new Float32Array(n); B = new Uint8Array(n);
    HX = new Float32Array(n * HIST); HY = new Float32Array(n * HIST);
    for (let i = 0; i < n; i++) seed(i, true);
  }

  function layout() {
    const rect = field.getBoundingClientRect();
    W = Math.max(1, Math.round(rect.width));
    H = Math.max(1, Math.round(rect.height));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (getComputedStyle(field).position === 'absolute' && hud) {
      // desktop: section sits above the instrument panel, right of the copy
      const h = hud.getBoundingClientRect();
      const top = 96, bottom = h.top - rect.top - 28;
      CX = Math.min(h.left + h.width / 2 - rect.left, W * 0.68);
      CY = (top + bottom) / 2;
      CHORD_PX = Math.min(W * 0.28, Math.max(170, (bottom - top) * 1.2), 520);
    } else {
      CX = W / 2; CY = H * 0.5;
      CHORD_PX = Math.min(W * 0.6, H * 1.15);
    }
    S = CHORD_PX / CHORD;
    xMin = -CX / S - 0.3; xMax = (W - CX) / S + 0.3;
    yMax = CY / S + 0.3; yMin = -(H - CY) / S - 0.3;

    const want = Math.round(Math.min(capN, 1300, Math.max(300, (W * H) / 950)));
    if (Math.abs(want - N) > N * 0.15 || !N) allocate(want);
    linesDirty = guideDirty = true;
  }

  function refreshVel() {                   // re-evaluate velocities in place (paused / α change)
    for (let i = 0; i < N; i++) {
      if (!vel(PX[i], PY[i])) { seed(i, false); continue; }
      VX[i] = V[0]; VY[i] = V[1];
      B[i] = bucketOf(Math.hypot(V[0], V[1]));
    }
  }

  function step(dt) {
    const h = U * dt;
    for (let i = 0; i < N; i++) {
      let x = PX[i], y = PY[i];
      if (!vel(x, y)) { seed(i, false); continue; }
      const mx = x + V[0] * h * 0.5, my = y + V[1] * h * 0.5;   // midpoint RK2
      if (!vel(mx, my)) { seed(i, false); continue; }
      const vx = V[0], vy = V[1];
      x += vx * h; y += vy * h;
      AGE[i] += dt;
      if (x > xMax || y > yMax + 0.5 || y < yMin - 0.5 || AGE[i] > LIFE[i]) { seed(i, false); continue; }
      PX[i] = x; PY[i] = y; VX[i] = vx; VY[i] = vy;
      B[i] = bucketOf(Math.hypot(vx, vy));
    }
    sampleAcc += dt;
    if (sampleAcc >= SAMPLE) {              // push the current positions onto every trail
      sampleAcc %= SAMPLE;
      hi = (hi + 1) % HIST;
      for (let i = 0; i < N; i++) { HX[i * HIST + hi] = PX[i]; HY[i * HIST + hi] = PY[i]; }
    }
  }

  /* ---------- drawing ---------- */
  function toScreen(x, y) {               // aerofoil frame → screen px
    x -= XMID;
    return [CX + (x * ca + y * sa) * S, CY - (-x * sa + y * ca) * S];
  }

  function drawSection() {
    ctx.beginPath();
    for (let k = 0; k < N_OUT; k++) {
      const p = toScreen(outX[k], outY[k]);
      if (k) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]);
    }
    ctx.closePath();
    ctx.globalAlpha = 1;
    ctx.fillStyle = C_FILL;
    ctx.fill();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = C_ACCENT;
    ctx.stroke();

    // chord line, freestream reference and the α arc at the leading edge
    const le = toScreen(xLE, yLE), te = toScreen(2, 0);
    const ext = CHORD_PX * 0.32;
    const dx = (le[0] - te[0]) / CHORD_PX, dy = (le[1] - te[1]) / CHORD_PX;
    ctx.setLineDash([4, 5]);
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.55;
    ctx.beginPath(); ctx.moveTo(te[0], te[1]); ctx.lineTo(le[0] + dx * ext, le[1] + dy * ext); ctx.stroke();
    ctx.strokeStyle = C_MUTED;
    ctx.beginPath(); ctx.moveTo(le[0], le[1]); ctx.lineTo(le[0] - ext, le[1]); ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = C_ACCENT;
    const r = ext * 0.72;
    ctx.beginPath(); ctx.arc(le[0], le[1], r, Math.PI, Math.PI + alpha, alpha < 0); ctx.stroke();

    ctx.font = '500 11px "JetBrains Mono", ui-monospace, monospace';
    ctx.fillStyle = C_ACCENT;
    const am = Math.PI + alpha / 2;
    ctx.fillText('α', le[0] + Math.cos(am) * (r + 12) - 4, le[1] + Math.sin(am) * (r + 12) + 4);
    ctx.fillStyle = C_MUTED;
    ctx.globalAlpha = 0.9;
    ctx.textAlign = 'center';
    ctx.fillText('JOUKOWSKI SECTION · t/c ≈ 12%', CX, CY + CHORD_PX * 0.2 + 24);
    ctx.textAlign = 'start';
    ctx.globalAlpha = 1;
  }

  /* each particle is drawn as a fading polyline through its recent positions;
     segments are batched by (speed colour × opacity level) → 32 strokes a frame */
  function drawParticles() {
    ctx.clearRect(0, 0, W, H);
    drawGuide();
    const NL = LEVELS.length;
    const paths = [];
    for (let p = 0; p < BUCKETS * NL; p++) paths.push(new Path2D());
    for (let i = 0; i < N; i++) {
      const b = B[i];
      if (b === 255) continue;
      const base = i * HIST;
      let x0 = CX + PX[i] * S, y0 = CY - PY[i] * S;
      for (let j = 0; j < HIST - 1; j++) {
        const k = base + ((hi - j + HIST) % HIST);
        const x1 = CX + HX[k] * S, y1 = CY - HY[k] * S;
        const path = paths[b * NL + LEVEL_OF[j]];
        path.moveTo(x0, y0);
        path.lineTo(x1, y1);
        x0 = x1; y0 = y1;
      }
    }
    ctx.lineCap = 'butt';
    ctx.lineWidth = W < 700 ? 1 : 1.2;
    for (let b = 0; b < BUCKETS; b++) {
      ctx.strokeStyle = COLORS[b];
      for (let l = 0; l < NL; l++) { ctx.globalAlpha = ALPHA * LEVELS[l]; ctx.stroke(paths[b * NL + l]); }
    }
    drawSection();
  }

  /* faint single-colour streamlines behind the particles; rebuilt at most ~12×/s while α moves */
  let guide = null, guideDirty = true, guideAt = 0;
  function buildGuide() {
    const p = new Path2D();
    const spacing = (W < 700 ? 20 : 26) / S, h = 9 / S;
    for (let y0 = yMin; y0 <= yMax; y0 += spacing) {
      let x = xMin, y = y0 + 1e-3;
      p.moveTo(CX + x * S, CY - y * S);
      for (let n = 0; n < 1500; n++) {
        if (!vel(x, y)) break;
        const q = Math.hypot(V[0], V[1]) || 1;
        x += (V[0] / q) * h; y += (V[1] / q) * h;
        p.lineTo(CX + x * S, CY - y * S);
        if (x > xMax) break;
      }
    }
    guide = p; guideDirty = false; guideAt = performance.now();
  }
  function drawGuide() {
    if (!guide || (guideDirty && (!animatingAlpha() || performance.now() - guideAt > 80))) buildGuide();
    ctx.globalAlpha = document.documentElement.dataset.theme === 'light' ? 0.28 : 0.2;
    ctx.strokeStyle = C_MUTED;
    ctx.lineWidth = 0.8;
    ctx.stroke(guide);
  }

  let linesCache = null, linesDirty = guideDirty = true;
  function buildLines() {
    const paths = Array.from({ length: BUCKETS }, () => new Path2D());
    const spacing = (W < 700 ? 16 : 22) / S;
    const h = 5 / S;
    for (let y0 = yMin; y0 <= yMax; y0 += spacing) {
      let x = xMin, y = y0 + 1e-3;
      let sx0 = CX + x * S, sy0 = CY - y * S;
      for (let n = 0; n < 3000; n++) {
        if (!vel(x, y)) break;
        const q1 = Math.hypot(V[0], V[1]) || 1;
        const mx = x + (V[0] / q1) * h * 0.5, my = y + (V[1] / q1) * h * 0.5;
        if (!vel(mx, my)) break;
        const q = Math.hypot(V[0], V[1]) || 1;
        x += (V[0] / q) * h; y += (V[1] / q) * h;
        const sx = CX + x * S, sy = CY - y * S;
        const p = paths[bucketOf(q)];
        p.moveTo(sx0, sy0); p.lineTo(sx, sy);
        sx0 = sx; sy0 = sy;
        if (x > xMax) break;
      }
    }
    linesCache = paths;
    linesDirty = false;
  }
  function drawLines() {
    if (linesDirty || !linesCache) buildLines();
    ctx.clearRect(0, 0, W, H);
    ctx.lineCap = 'round';
    ctx.lineWidth = 1.2;
    ctx.globalAlpha = ALPHA * 0.9;
    for (let b = 0; b < BUCKETS; b++) { ctx.strokeStyle = COLORS[b]; ctx.stroke(linesCache[b]); }
    drawSection();
  }

  /* ---------- HUD ---------- */
  const fmt = (v, d) => (v < -0.00001 ? '−' : '') + Math.abs(v).toFixed(d);
  function plotCp() {
    if (!cpUp) return;
    const { up, lo, cpMin } = surfaceCp();
    let top = Math.max(2, Math.ceil(-cpMin));
    if (top > 6) top = Math.min(14, Math.ceil(top / 2) * 2);
    const X0 = 28, X1 = 298, Y0 = 4, Y1 = 80;
    const y = (v) => Y0 + ((top - v) / (top + 1)) * (Y1 - Y0);
    const path = (pts) => pts.map((p, i) => (i ? 'L' : 'M') + (X0 + p[0] * (X1 - X0)).toFixed(1) + ' ' + y(Math.max(-1, -p[1])).toFixed(1)).join('');
    cpUp.setAttribute('d', path(up));
    cpLo.setAttribute('d', path(lo));
    const yz = y(0).toFixed(1);
    cpZero.setAttribute('d', `M${X0} ${yz}H${X1}`);
    cpTop.textContent = top;
    cpZeroT.setAttribute('y', (+yz + 3).toString());
    outCp.textContent = fmt(cpMin, 1);
  }
  function updateHUD() {
    const deg = alpha / DEG;
    outA.textContent = fmt(deg, 1) + '°';
    outCL.textContent = fmt((4 * Math.PI * G) / CHORD, 2);
    plotCp();
    if (note) {
      const stall = alphaTarget / DEG >= 12;
      note.textContent = stall ? NOTE_STALL : NOTE_DEFAULT;
      note.classList.toggle('warn', stall);
    }
  }
  function sliderFill() {
    const p = ((slider.value - slider.min) / (slider.max - slider.min)) * 100;
    slider.style.setProperty('--fill', p + '%');
  }

  /* ---------- loop ---------- */
  let mode = reduce ? 'lines' : 'particles';
  let paused = false, visible = true, raf = 0, last = 0;

  function animatingAlpha() { return Math.abs(alphaTarget - alpha) > 1e-4; }
  function shouldRun() {
    if (!visible || document.hidden) return false;
    return mode === 'particles' ? !paused : animatingAlpha();
  }
  function render() { if (mode === 'particles') drawParticles(); else drawLines(); }

  /* adaptive quality: if frames run slow for ~1.5 s, thin the particle field */
  let slowEMA = 1 / 60, slowCheck = 0;
  function adapt(realDt) {
    slowEMA += (realDt - slowEMA) * 0.05;
    slowCheck += realDt;
    if (slowCheck > 1.5) {
      slowCheck = 0;
      if (slowEMA > 1 / 42 && N > 320) capN = N = Math.max(300, Math.round(N * 0.7));
    }
  }

  function frame(t) {
    raf = 0;
    const realDt = Math.max(0.001, (t - last) / 1000);
    const dt = Math.min(0.033, realDt);
    last = t;
    if (mode === 'particles' && !paused && realDt < 0.25) adapt(realDt);
    if (animatingAlpha()) {
      setAlpha(alpha + (alphaTarget - alpha) * Math.min(1, dt * 7));
      if (!animatingAlpha()) setAlpha(alphaTarget);
      updateHUD();
      linesDirty = guideDirty = true;
    }
    if (mode === 'particles' && !paused) step(dt);
    render();
    if (shouldRun()) raf = requestAnimationFrame(frame);
  }
  function kick() {
    if (!raf && shouldRun()) { last = performance.now(); raf = requestAnimationFrame(frame); }
  }

  function setPaused(p) {
    paused = p;
    if (hud) hud.classList.toggle('paused', p);
    if (toggleBtn) {
      toggleBtn.setAttribute('aria-label', p ? 'Play animation' : 'Pause animation');
      toggleBtn.setAttribute('aria-pressed', String(p));
      const use = toggleBtn.querySelector('use');
      if (use) use.setAttribute('href', p ? '#i-play' : '#i-pause');
    }
    kick();
  }
  function setMode(m) {
    mode = m;
    modeBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.flowMode === m)));
    if (toggleBtn) toggleBtn.disabled = m === 'lines';
    if (m === 'particles') refreshVel();
    linesDirty = guideDirty = true;
    render();
    kick();
  }

  /* ---------- wiring ---------- */
  slider.addEventListener('input', () => {
    alphaTarget = +slider.value * DEG;
    sliderFill();
    if (reduce || (paused && mode === 'particles')) {
      setAlpha(alphaTarget);
      updateHUD();
      linesDirty = guideDirty = true;
      if (mode === 'particles') refreshVel();
      render();
    }
    kick();
  });
  if (toggleBtn) toggleBtn.addEventListener('click', () => setPaused(!paused));
  modeBtns.forEach((b) => b.addEventListener('click', () => setMode(b.dataset.flowMode)));
  document.addEventListener('flow:toggle', () => { if (mode !== 'particles') setMode('particles'); setPaused(!paused); });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver((es) => { visible = es[0].isIntersecting; kick(); }, { threshold: 0 }).observe(field);
  }
  document.addEventListener('visibilitychange', kick);

  let rsPending = false;
  const onResize = () => {
    if (rsPending) return;
    rsPending = true;
    requestAnimationFrame(() => { rsPending = false; layout(); render(); kick(); });
  };
  if ('ResizeObserver' in window) {
    const ro = new ResizeObserver(onResize);
    ro.observe(field);
    if (hud) ro.observe(hud);
  } else {
    window.addEventListener('resize', onResize);
  }

  new MutationObserver(() => { readColors(); render(); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  /* ---------- start ---------- */
  readColors();
  layout();
  sliderFill();
  setMode(mode);
  updateHUD();
  render();
  requestAnimationFrame(() => field.classList.add('ready'));
  kick();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(render);
})();
