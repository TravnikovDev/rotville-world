/* Pipe Dream: when dreams clog in Rotville, Knightley is called.

   Knightley (LORE) is the dream plumber: "the pipes behind the town's eyelids are older than the town", the dreams in
   them keep clogging, and he goes in anyway. "A tradesman, never a wizard." He cannot leave a clog, and he leaves the
   floor wet. Snoreacle, the hooded idol that mutters in its sleep, sits at the top; the dream comes up out of the floor
   in front of it after a while, and runs. Lay pipe from the next pieces to carry it to the drain before it reaches an
   open end. If it does, it gets out onto the floor, a puddle with a star floating in it, and three wet floors end the
   night. The first three clogs are near and plain and come with the pieces they need; after that, every clog cleared,
   the dream comes sooner and runs faster, and more old pipe nobody can move is in the way. Once the way to the drain is
   whole, the dream comes at once and rushes through, and a cleared clog is dream confetti and a jig from both.

   The pieces are the library's sewer kit laid on the floor. What runs through them is drawn over them as a cloud of
   pastel puffs with stars caught in it, as the user asked on 2026-09-28 ("more like a cloudy dream and less like a pipe
   water"); what a dream is about is never shown. Knightley and Snoreacle stand upright beside the board as part of the
   screen, rigid figurines turned and rocked whole, drawn at 15 fps under the 60 fps page like the clips' residents (R819,
   R1070). Only pre-rendered sprites and the PS1 tiles ship. */
(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  const W = 270, H = 480;
  const cv = $("c"), g = cv.getContext("2d");
  g.imageSmoothingEnabled = false;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const store = {
    get(k, d) { try { const v = localStorage.getItem("pipedream." + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem("pipedream." + k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
  };
  const load = src => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });
  const off = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d"); x.imageSmoothingEnabled = false; return [c, x]; };
  const rnd = (a, b) => a + Math.random() * (b - a);
  const rint = n => Math.floor(Math.random() * n);
  const pick = a => a[rint(a.length)];

  const RESIDENT_STEP = 1 / 15;
  const CW = 36, CH = 31, COLS = 7, ROWS = 8, GX = 9, GY = 130;   // the grid: squares 36 by 31, seen from above
  const WALL = 96;                                                // the back wall comes down to here
  const TRAY = { x: 6, y: 390, w: 188, h: 72, step: 37 };         // the next pieces
  const KN = { x: 233, y: 466 };                                  // where Knightley stands
  const WETS = 3;
  // the sides of a square, and the pieces by the sides they open on
  const UP = 1, RIGHT = 2, DOWN = 4, LEFT = 8;
  const STEP = { 1: [0, -1], 2: [1, 0], 4: [0, 1], 8: [-1, 0] };
  const OPP = { 1: 4, 2: 8, 4: 1, 8: 2 };
  const PIECE = { v: 5, h: 10, x: 15, ne: 3, nw: 9, se: 6, sw: 12 };
  const WEIGHT = [["v", 1.1], ["h", 1.1], ["x", 0.55], ["ne", 1], ["nw", 1], ["se", 1], ["sw", 1]];
  const MOUTH = { 1: "mouth_n", 2: "mouth_e", 4: "mouth_s", 8: "mouth_w" };
  const exitOf = (kind, entry) => (kind === "x" ? OPP[entry] : PIECE[kind] & ~entry);
  // HOW HARD IT IS, by clogs cleared. The first clogs are near and plain: the drain three squares off and open toward
  // the water, no old pipe, slow water after a long wait, and the tray holds the pieces the way needs. Then every clog
  // cleared, the drain is a square further, there is more old pipe, the water comes sooner and runs quicker.
  const reach = L => Math.min(11, 3 + L);
  const olds = L => Math.max(0, Math.min(11, L - 1));
  const waitT = L => Math.max(6, 20 - 1.5 * L);
  const cellT = L => Math.max(0.6, 3.0 - 0.2 * L);
  const HELP = 3;                                                 // the first three clogs come with the pieces they need

  /* ---------- sound: the bed, three lines, the rest made on the spot ---------- */
  const audio = {
    ctx: null, on: store.get("sound", true), raw: {}, buf: {}, music: null, trickle: null,
    fetch() {
      for (const [k, f] of [["start", "assets/line-start.mp3"], ["wet", "assets/line-wet.mp3"], ["end", "assets/line-end.mp3"],
                            ["music", "assets/snowglobe.mp3"]]) {
        this.raw[k] = fetch(f).then(r => (r.ok ? r.arrayBuffer() : null)).catch(() => null);
      }
    },
    unlock() {
      if (this.ctx) { this.ctx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch (e) { /* older Safari */ }
      const c = (this.ctx = new AC());
      c.resume();
      this.master = c.createGain(); this.master.gain.value = this.on ? 1 : 0; this.master.connect(c.destination);
      this.fxg = c.createGain(); this.fxg.gain.value = 0.5; this.fxg.connect(this.master);
      this.mus = c.createGain(); this.mus.gain.value = 0.22; this.mus.connect(this.master);
      this.vox = c.createGain(); this.vox.gain.value = 1; this.vox.connect(this.master);
      const n = c.createBuffer(1, c.sampleRate, c.sampleRate), d = n.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = n;
      for (const k of Object.keys(this.raw)) {
        this.buf[k] = this.raw[k].then(b => (b ? new Promise(ok => {
          const p = c.decodeAudioData(b, ok, () => ok(null));
          if (p && p.catch) p.catch(() => ok(null));
        }) : null)).catch(() => null);
      }
      this.buf.music.then(b => {
        if (!b || this.music) return;
        const s = c.createBufferSource(); s.buffer = b; s.loop = true; s.connect(this.mus); s.start(); this.music = s;
      });
    },
    set(on) { this.on = on; store.set("sound", on); if (this.master) this.master.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.04); },
    line(k) {
      if (!this.ctx) return Promise.resolve(0);
      return this.buf[k].then(b => {
        if (!b) return 0;
        const s = this.ctx.createBufferSource(); s.buffer = b; s.connect(this.vox); s.start();
        return b.duration;
      });
    },
    tone(f0, f1, dur, type = "square", vol = 0.12, when = 0) {
      if (!this.ctx) return;
      const c = this.ctx, t = c.currentTime + when, o = c.createOscillator(), e = c.createGain();
      o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
      e.gain.setValueAtTime(0.0008, t); e.gain.exponentialRampToValueAtTime(vol, t + 0.012); e.gain.exponentialRampToValueAtTime(0.0008, t + dur);
      o.connect(e).connect(this.fxg); o.start(t); o.stop(t + dur + 0.03);
    },
    noise(dur, vol, lo, hi, when = 0) {
      if (!this.ctx) return;
      const c = this.ctx, t = c.currentTime + when, s = c.createBufferSource(), a = c.createBiquadFilter(), b = c.createBiquadFilter(), e = c.createGain();
      s.buffer = this.noiseBuf; s.loop = true; a.type = "highpass"; a.frequency.value = lo; b.type = "lowpass"; b.frequency.value = hi;
      e.gain.setValueAtTime(vol, t); e.gain.exponentialRampToValueAtTime(0.0008, t + dur);
      s.connect(a).connect(b).connect(e).connect(this.fxg); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.03);
    },
    // the water running, for as long as it runs
    run(on) {
      if (!this.ctx) return;
      const c = this.ctx;
      if (on && !this.trickle) {
        const s = c.createBufferSource(), b = c.createBiquadFilter(), e = c.createGain();
        s.buffer = this.noiseBuf; s.loop = true; b.type = "bandpass"; b.frequency.value = 900; b.Q.value = 1.4;
        e.gain.setValueAtTime(0.0008, c.currentTime); e.gain.exponentialRampToValueAtTime(0.05, c.currentTime + 0.4);
        s.connect(b).connect(e).connect(this.fxg); s.start();
        this.trickle = { s, e };
      } else if (!on && this.trickle) {
        const { s, e } = this.trickle; this.trickle = null;
        e.gain.setTargetAtTime(0.0008, c.currentTime, 0.08); s.stop(c.currentTime + 0.4);
      }
    },
    clank() { this.noise(0.07, 0.07, 1200, 6000); this.tone(210, 150, 0.12, "square", 0.05); this.tone(1500, 1420, 0.16, "sine", 0.025); },
    ratchet() { for (let k = 0; k < 3; k++) this.noise(0.02, 0.07, 2500, 8000, k * 0.07); },
    thunk() { this.tone(110, 80, 0.1, "sine", 0.14); },
    tick() { this.tone(1200, 1190, 0.03, "square", 0.03); },
    gurgle() { this.noise(0.6, 0.06, 200, 900); this.tone(90, 150, 0.5, "sine", 0.1); },
    whoosh() { this.noise(0.45, 0.08, 500, 4000); },
    drained() { this.tone(320, 90, 0.5, "sine", 0.12); this.noise(0.5, 0.05, 300, 1200); },
    // a clog cleared: four notes up, a held one, and the confetti ringing as it goes
    fanfare() {
      [523, 659, 784, 1046].forEach((f, i) => this.tone(f, f * 1.01, 0.14, "triangle", 0.12, 0.12 + i * 0.08));
      this.tone(1046, 1052, 0.45, "triangle", 0.1, 0.46); this.tone(1318, 1322, 0.45, "sine", 0.05, 0.46);
      for (let k = 0; k < 8; k++) { const f = 1600 + Math.random() * 1400; this.tone(f, f * 0.96, 0.08, "sine", 0.035, 0.5 + k * 0.09); }
    },
    splash() { this.noise(0.4, 0.12, 300, 3000); this.tone(420, 180, 0.25, "sine", 0.06); this.tone(330, 300, 0.25, "triangle", 0.08, 0.3); this.tone(247, 220, 0.4, "triangle", 0.08, 0.5); },
  };
  audio.fetch();

  /* ---------- puddles ---------- */
  // Paper Round's puddles in the dream's colour: a mask of whole pixels, three pools run together, the floor wet
  // round it, a dark far lip, a light near edge and a glint; made once from seeds
  const seeded = a => () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const DREAM = { far: [36, 44, 130, 205], near: [92, 110, 225, 180], lip: [14, 16, 54, 160], shine: [196, 206, 255, 150],
                  glint: [244, 246, 255, 230], wet: [8, 8, 26, 90], damp: [8, 8, 26, 40] };
  function makePuddle(rx, ry, seed, pal = DREAM) {
    const R = seeded(seed), padX = Math.ceil(rx * 0.3) + 6, padY = 6;
    const w = 2 * (rx + padX) + 1, h = 2 * (ry + padY) + 1, cx = rx + padX, cy = ry + padY;
    const m = new Uint8Array(w * h), inM = (i, j) => (i >= 0 && j >= 0 && i < w && j < h ? m[j * w + i] : 0);
    const side = k => ({ x: cx + k * rx * (0.4 + 0.1 * R()), y: cy + (R() - 0.5) * ry * 0.6, rx: rx * (0.62 + 0.12 * R()), ry: ry * (0.9 + 0.25 * R()) });
    const blobs = [{ x: cx, y: cy, rx: rx * 0.8, ry: ry * 1.2 }, side(-1), side(1)];
    for (const bl of blobs) { bl.a = 0.05 + 0.07 * R(); bl.p = R() * 6.283; }
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      let F = 0;
      for (const bl of blobs) {
        const dx = (i + 0.5 - bl.x) / bl.rx, dy = (j + 0.5 - bl.y) / bl.ry;
        const d2 = Math.pow(Math.pow(Math.abs(dx), 2.5) + Math.pow(Math.abs(dy), 2.5), 0.8) * (1 + bl.a * Math.sin(3 * Math.atan2(dy, dx) + bl.p));
        if (d2 < 1) F += (1 - d2) * (1 - d2);
      }
      m[j * w + i] = F > 0.12 ? 1 : 0;
    }
    for (let pass = 0; pass < 2; pass++) for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const n = inM(i - 1, j) + inM(i + 1, j) + inM(i, j - 1) + inM(i, j + 1);
      if (m[j * w + i] && n < 2) m[j * w + i] = 0; else if (!m[j * w + i] && n >= 3) m[j * w + i] = 1;
    }
    const spread = (src, pts) => {
      const d = src.slice();
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (src[j * w + i]) for (const [a, b] of pts) { const u = i + a, v = j + b; if (u >= 0 && v >= 0 && u < w && v < h) d[v * w + u] = 1; }
      return d;
    };
    const wet = spread(m, [[-2, 0], [-1, 0], [1, 0], [2, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]);
    const damp = spread(wet, [[-1, 0], [1, 0], [0, -1], [0, 1]]);
    const [uc, ux] = off(w, h), U = ux.createImageData(w, h);
    for (let i = 0; i < w; i++) {
      let top = -1, bot = -1;
      for (let j = 0; j < h; j++) if (m[j * w + i]) { if (top < 0) top = j; bot = j; }
      for (let j = 0; j < h; j++) {
        const k = j * w + i;
        if (m[k]) {
          const t = bot > top ? (j - top) / (bot - top) : 0.5;
          for (let c = 0; c < 4; c++) U.data[k * 4 + c] = Math.round(pal.far[c] + (pal.near[c] - pal.far[c]) * t);
          if (!inM(i, j - 1)) U.data.set(pal.lip, k * 4);
          else if (!inM(i, j + 1) && inM(i - 1, j) && inM(i + 1, j) && Math.abs(i - cx) < rx * 0.75) U.data.set(pal.shine, k * 4);
        } else if (wet[k]) U.data.set(pal.wet, k * 4);
        else if (damp[k]) U.data.set(pal.damp, k * 4);
      }
    }
    const gi = Math.round(cx - rx * (0.15 + 0.25 * R()));
    let gj = 0;
    while (gj < h && !m[gj * w + gi]) gj++;
    gj += 2;
    for (const [di, dj] of [[0, 0], [1, 0], [2, 0]]) {
      const i = gi + di, j = gj + dj;
      if (inM(i, j) && inM(i, j - 1) && inM(i, j + 1)) U.data.set(pal.glint, (j * w + i) * 4);
    }
    ux.putImageData(U, 0, 0);
    return { cx, cy, img: uc };
  }
  const POOLS = [[11, 5], [13, 6], [15, 6]].map(([rx, ry], k) => makePuddle(rx, ry, 11 + 97 * k));

  /* ---------- the night ---------- */
  let SC, atlas, ready = false, pat = {};
  let state = "ready";                     // ready, play, pause, over
  let clock = 0, acc = 0, lockT = 0, keyUsed = false;
  let grid = [], src = 3, drain = { c: 3, r: 6, open: UP }, queue = [];
  let round = { phase: "wait", left: 0, t: 0, lastTick: 99 };
  let segs = [], fast = false, puddles = [], discards = [], nopes = [], zs = [], confetti = [];
  let level = 0, cleared = 0, wet = 0, best = store.get("best", 0), saidStart = false, saidWet = false;
  const cur = { c: 3, r: 3 };
  const kn = { act: "idle", t: 0, pose: "kn_0", dy: 0, wig: 0 };
  const sn = { pose: "sn_0", t: 0, act: "", ct: 0, dy: 0, wig: 0 };
  const FAST = 0.05;                                              // seconds a square once the way is whole, or flushed

  const cellAt = (c, r) => (c >= 0 && r >= 0 && c < COLS && r < ROWS ? grid[r * COLS + c] : null);
  const cx = c => GX + c * CW + CW / 2;
  const cy = r => GY + r * CH + CH / 2;
  function nextPiece() {
    let t = Math.random() * WEIGHT.reduce((s, w) => s + w[1], 0);
    for (const [k, w] of WEIGHT) { t -= w; if (t <= 0) return k; }
    return "v";
  }

  function hud() {
    $("cleared").textContent = cleared + " CLEARED";
    $("wet").textContent = "●".repeat(WETS - wet) + "○".repeat(wet);
    $("wet").setAttribute("aria-label", "Dry floors left: " + (WETS - wet) + " of " + WETS);
    $("best").textContent = "Most cleared " + best;
    const tm = $("timer");
    if (state !== "play") { tm.textContent = ""; return; }
    if (round.phase === "wait") { const s = Math.ceil(round.left); tm.textContent = "FLOW IN " + s; tm.classList.toggle("soon", s <= 3); }
    else { tm.textContent = round.phase === "run" ? "FLOWING" : ""; tm.classList.remove("soon"); }
  }

  // a clog: where the water comes up, the drain, the old pipe in the way; there is always a way through
  function newBoard(L) {
    for (let tries = 0; tries < 300; tries++) {
      grid = Array.from({ length: COLS * ROWS }, () => ({ kind: "", piece: "", used: 0 }));
      const s = 1 + rint(COLS - 2);                 // never under the corners, where the screen writes its numbers
      let dc = 0, dr = 0;
      for (let k = 0; k < 300; k++) {
        dc = rint(COLS); dr = 1 + rint(ROWS - 1);
        const d = Math.abs(dc - s) + dr;
        if (d >= reach(L) && d <= reach(L) + 2) break;
      }
      const sides = [UP, RIGHT, DOWN, LEFT].filter(d => cellAt(dc + STEP[d][0], dr + STEP[d][1]));
      // while it is easy the drain opens toward the water
      const toward = d => Math.abs(dc + STEP[d][0] - s) + (dr + STEP[d][1]);
      const open = L < HELP ? sides.reduce((a, b) => (toward(b) < toward(a) ? b : a)) : pick(sides);
      grid[dr * COLS + dc] = { kind: "drain", piece: "", used: 0, open };
      const ec = dc + STEP[open][0], er = dr + STEP[open][1];
      const free = [];
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        if ((c === s && r === 0) || (c === ec && r === er) || (c === dc && r === dr)) continue;
        free.push(r * COLS + c);
      }
      for (let i = free.length - 1; i > 0; i--) { const j = rint(i + 1); [free[i], free[j]] = [free[j], free[i]]; }
      for (const k of free.slice(0, olds(L))) grid[k] = { kind: "old", piece: nextPiece(), used: 0 };
      if (way(s, 0, ec, er)) { src = s; drain = { c: dc, r: dr, open }; return; }
    }
  }
  // the pieces the shortest way needs, in the order the water meets them, from under the source to the drain
  function route() {
    const e = drain.c + STEP[drain.open][0], f = drain.r + STEP[drain.open][1];
    const prev = new Map([[src, null]]), q = [[src, 0]];
    let found = false;
    while (q.length) {
      const [c, r] = q.shift();
      if (c === e && r === f) { found = true; break; }
      for (const d of [UP, RIGHT, DOWN, LEFT]) {
        const nc = c + STEP[d][0], nr = r + STEP[d][1], cell = cellAt(nc, nr), k = nr * COLS + nc;
        if (!cell || cell.kind || prev.has(k)) continue;
        prev.set(k, r * COLS + c); q.push([nc, nr]);
      }
    }
    if (!found) return null;
    const path = [];
    for (let k = f * COLS + e; k !== null; k = prev.get(k)) path.unshift([k % COLS, Math.floor(k / COLS)]);
    const CORNER = { 3: "ne", 9: "nw", 6: "se", 12: "sw" };
    let entry = UP;
    return path.map(([c, r], i) => {
      const nx = path[i + 1];
      const ex = nx ? (nx[0] > c ? RIGHT : nx[0] < c ? LEFT : nx[1] > r ? DOWN : UP) : OPP[drain.open];
      const piece = entry === OPP[ex] ? (ex === UP || ex === DOWN ? "v" : "h") : CORNER[entry | ex];
      entry = OPP[ex];
      return piece;
    });
  }

  // through the empty squares only, so the old pipe never has to be used
  function way(c0, r0, c1, r1) {
    const seen = new Set([r0 * COLS + c0]), todo = [[c0, r0]];
    while (todo.length) {
      const [c, r] = todo.shift();
      if (c === c1 && r === r1) return true;
      for (const d of [UP, RIGHT, DOWN, LEFT]) {
        const nc = c + STEP[d][0], nr = r + STEP[d][1], cell = cellAt(nc, nr);
        if (!cell || cell.kind || seen.has(nr * COLS + nc)) continue;
        seen.add(nr * COLS + nc); todo.push([nc, nr]);
      }
    }
    return false;
  }

  function startRound() {
    newBoard(level);
    // the first clogs: the tray holds the pieces the way needs, in order, with a spare or two mixed in after the first
    if (level < HELP) {
      const need = route();
      if (need) {
        for (let k = 0; k < level * 2; k++) need.splice(1 + rint(need.length), 0, nextPiece());
        queue = need.concat(Array.from({ length: 5 }, nextPiece));
      }
    }
    round = { phase: "wait", left: waitT(level), t: 0, lastTick: 99 };
    segs = []; fast = false; puddles = []; discards = []; nopes = [];
    lockT = 0;
    audio.run(false);
    hud();
  }

  function start() {
    audio.unlock();
    level = 0; cleared = 0; wet = 0;
    queue = Array.from({ length: 5 }, nextPiece);
    confetti = []; rings = [];
    state = "play";
    startRound();
    $("ready").hidden = true; $("over").hidden = true;
    $("static").classList.remove("on");
    if (!saidStart) { saidStart = true; say("start", "When dreams clog in Rotville, Knightley is called."); }
    hud();
  }

  function say(k, text) {
    const sub = $("sub");
    sub.textContent = text;
    audio.line(k).then(d => setTimeout(() => { if (sub.textContent === text) sub.textContent = ""; }, Math.max(1800, d * 1000 + 300)));
  }

  // lay the next piece on a square, or swap the one there; the old pipe, the drain and anything with water in it stay
  function lay(c, r) {
    if (state !== "play" || (round.phase !== "wait" && round.phase !== "run")) return;
    const cell = cellAt(c, r);
    if (!cell) return;
    if (cell.kind === "old" || cell.kind === "drain" || cell.used) { audio.thunk(); nopes.push({ c, r, t: 0 }); return; }
    if (lockT > 0) return;
    if (cell.kind === "pipe") {
      lockT = 0.35;
      discards.push({ piece: cell.piece, x: cx(c), y: cy(r), t: 0 });
      audio.ratchet();
      act("wrench");
    } else act("lay");
    cell.kind = "pipe"; cell.piece = queue.shift(); queue.push(nextPiece());
    audio.clank();
    if (whole()) rush();
  }

  // the way from where the water is to the drain, through what is laid: is it whole? a cross may be crossed twice
  function whole() {
    let c, r, entry;
    if (segs.length) {
      const h = segs[segs.length - 1];
      if (h.drain) return true;
      c = h.c + STEP[h.b][0]; r = h.r + STEP[h.b][1]; entry = OPP[h.b];
    } else { c = src; r = 0; entry = UP; }
    const seen = new Map();
    for (let guard = 0; guard < COLS * ROWS * 2; guard++) {
      if (c === drain.c && r === drain.r) return entry === drain.open;
      const cell = cellAt(c, r);
      if (!cell || !cell.kind || cell.kind === "drain" || !(PIECE[cell.piece] & entry)) return false;
      const k = r * COLS + c, axis = entry === UP || entry === DOWN ? 1 : 2, used = (seen.get(k) || 0) | cell.used;
      if (cell.piece === "x" ? used & axis : used) return false;
      seen.set(k, (seen.get(k) || 0) | (cell.piece === "x" ? axis : 3));
      const ex = exitOf(cell.piece, entry);
      c += STEP[ex][0]; r += STEP[ex][1]; entry = OPP[ex];
    }
    return false;
  }
  // it is whole: the water comes now, and runs
  function rush() {
    if (round.phase === "wait") round.left = 0;
    if (!fast) { fast = true; audio.whoosh(); }
  }

  /* ---------- dream confetti ---------- */
  const SHAPES = {
    star: ["..X..", "..X..", "XXXXX", ".XXX.", ".X.X."], moon: [".XX", "X..", "X..", "X..", ".XX"],
    plus: [".X.", "XXX", ".X."], dot: ["XX", "XX"],
  };
  const DREAMY = ["#fff4bf", "#fff4bf", "#9fb1ff", "#c8a2ff", "#ffb3d9", "#e3e8ff", "#8ff0ff"];
  const bit = (x, y, vx, vy, t) => ({ x, y, vx, vy, t, life: rnd(1.5, 2.6), shape: pick(["star", "star", "moon", "plus", "plus", "dot"]), col: pick(DREAMY), ph: rnd(0, 6.28), flip: Math.random() < 0.5, k: Math.random() < 0.3 ? 2 : 1 });
  let rings = [];
  function burst(x, y, n, spread, up) {
    for (let k = 0; k < n; k++) {
      const a = -Math.PI / 2 + rnd(-spread, spread), v = rnd(up * 0.45, up);
      confetti.push(bit(x, y, Math.cos(a) * v, Math.sin(a) * v, 0));
    }
  }
  function act(a) { kn.act = a; kn.t = 0; }

  function flush() {
    if (state !== "play") return;
    const b = $("flush"); b.classList.add("on"); setTimeout(() => b.classList.remove("on"), 140);
    if (round.phase === "wait") { round.left = 0; audio.whoosh(); }
    else if (round.phase === "run" && !fast) { fast = true; audio.whoosh(); }
  }

  function update(dt) {
    clock += dt;
    lockT = Math.max(0, lockT - dt);
    kn.t += dt; sn.t += dt;
    for (const d of discards) d.t += dt;
    discards = discards.filter(d => d.t < 0.45);
    for (const n of nopes) n.t += dt;
    nopes = nopes.filter(n => n.t < 0.35);
    for (const p of puddles) p.t += dt;
    for (const z of zs) z.t += dt;
    sn.ct += dt;
    for (const b of confetti) {
      b.t += dt;
      if (b.t < 0) continue;
      b.vy = Math.min(70, b.vy + 160 * dt); b.vx *= 1 - 1.4 * dt;
      b.x += (b.vx + Math.sin(b.t * 7 + b.ph) * 16) * dt; b.y += b.vy * dt;
    }
    confetti = confetti.filter(b => b.t < b.life && b.y < H + 10);
    for (const q of rings) q.t += dt;
    rings = rings.filter(q => q.t < 0.6);
    zs = zs.filter(z => z.t < 1.8);
    if (Math.floor((clock - dt) / 1.4) !== Math.floor(clock / 1.4)) zs.push({ t: 0, dx: rnd(-3, 3) });
    if (state !== "play") return;
    round.t += dt;
    if (round.phase === "wait") {
      round.left -= dt;
      const s = Math.ceil(round.left);
      if (s <= 3 && s >= 1 && s !== round.lastTick) { round.lastTick = s; audio.tick(); }
      if (round.left <= 0) {
        round.phase = "run"; round.left = 0;
        segs = [{ c: src, r: -1, a: 0, b: DOWN, p: 0 }];
        audio.gurgle(); audio.run(true);
        if (whole()) rush();
      }
      hud();
    } else if (round.phase === "run") {
      const h = segs[segs.length - 1];
      const half = h.a === 0 || h.b === 0;
      h.p += dt / ((fast ? FAST : cellT(level)) * (half ? 0.5 : 1));
      if (h.p >= 1) { h.p = 1; advance(h); }
    } else if (round.phase === "drained" || round.phase === "wet") {
      if (round.t > (round.phase === "drained" ? 2.1 : 1.8)) {
        if (wet >= WETS) { end(); return; }
        startRound();
      }
    }
  }

  // the water reaches the end of a square: into the next piece, down the drain, or out onto the floor
  function advance(h) {
    if (h.drain) {
      round.phase = "drained"; round.t = 0;
      cleared += 1; level += 1;
      if (cleared > best) { best = cleared; store.set("best", best); }
      audio.run(false); audio.drained(); audio.fanfare(); act("cheer"); sn.act = "cheer"; sn.ct = 0; bumpHud(); hud();
      // dream confetti: out of the drain, off Snoreacle and off Knightley's cap, and more coming down from the top
      burst(cx(drain.c), cy(drain.r) - 4, 52, 1.0, 250);
      burst(cx(src), WALL - 30, 22, 1.3, 175);
      burst(KN.x, KN.y - 86, 22, 1.0, 185);
      for (let k = 0; k < 46; k++) confetti.push(bit(rnd(10, W - 10), rnd(-50, -4), rnd(-15, 15), rnd(20, 60), -rnd(0, 0.9)));
      rings.push({ x: cx(drain.c), y: cy(drain.r), t: 0 }, { x: cx(drain.c), y: cy(drain.r), t: -0.12 });
      return;
    }
    const nc = h.c + STEP[h.b][0], nr = h.r + STEP[h.b][1], entry = OPP[h.b];
    if (nc === drain.c && nr === drain.r) {
      if (entry === drain.open) { segs.push({ c: nc, r: nr, a: entry, b: 0, p: 0, drain: true }); return; }
      return spill(h);
    }
    const cell = cellAt(nc, nr);
    if (!cell || !cell.kind || !(PIECE[cell.piece] & entry)) return spill(h);
    const axis = entry === UP || entry === DOWN ? 1 : 2;
    if (cell.piece === "x" ? cell.used & axis : cell.used) return spill(h);
    cell.used |= cell.piece === "x" ? axis : 3;
    segs.push({ c: nc, r: nr, a: entry, b: exitOf(cell.piece, entry), p: 0 });
  }

  function spill(h) {
    round.phase = "wet"; round.t = 0;
    wet += 1;
    const [x, y] = edge(h.c, h.r, h.b, 0);
    puddles.push({ x: x + STEP[h.b][0] * 9, y: y + STEP[h.b][1] * 5, t: 0, v: rint(POOLS.length) });
    audio.run(false); audio.splash(); act("wet"); hud();
    if (!saidWet && wet < WETS) { saidWet = true; say("wet", "He leaves the floor wet."); }
  }
  function bumpHud() { const el = $("cleared"); el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump"); setTimeout(() => el.classList.remove("bump"), 160); }

  function end() {
    state = "over";
    audio.run(false);
    $("over-title").textContent = "The night is over.";
    $("over-line").textContent = cleared === 0 ? "Knightley cleared no clogs." : "Knightley cleared " + (cleared === 1 ? "one clog." : cleared + " clogs.");
    $("over-stats").textContent = cleared > 0 && cleared === best ? "The most he has cleared" : "Most cleared " + best;
    hud();
    say("end", "He is never out of work.");
    setTimeout(() => { if (state === "over") { $("over").hidden = false; $("again").focus({ preventScroll: true }); } }, 1500);
  }

  /* ---------- drawing ---------- */
  function blit(key, gx, gy, alpha) {
    const s = SC.sprites[key];
    if (!s) return;
    if (alpha !== undefined) g.globalAlpha = alpha;
    g.drawImage(atlas, s[0], s[1], s[2], s[3], Math.round(gx - s[4]), Math.round(gy - s[5]), s[2], s[3]);
    g.globalAlpha = 1;
  }
  // a point on a square's edge (or its middle), at the height of a pipe's axis when lift is set
  function edge(c, r, side, lift) {
    const x = cx(c), y = cy(r) - lift;
    return side === 0 ? [x, y] : [x + STEP[side][0] * CW / 2, y + STEP[side][1] * CH / 2];
  }
  // where the water is, a way through a square from one side to the other: straight, or round the corner between them
  function along(sg, t) {
    const lift = SC.axis_up, A = edge(sg.c, sg.r, sg.a, lift), B = edge(sg.c, sg.r, sg.b, lift);
    if (sg.a === 0 || sg.b === 0 || sg.a === OPP[sg.b]) return [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t];
    const C = [cx(sg.c) + (STEP[sg.a][0] + STEP[sg.b][0]) * CW / 2, cy(sg.r) - lift + (STEP[sg.a][1] + STEP[sg.b][1]) * CH / 2];
    const ang = p => Math.atan2((p[1] - C[1]) / (CH / 2), (p[0] - C[0]) / (CW / 2));
    const a0 = ang(A);
    let d = ang(B) - a0;
    if (d > Math.PI) d -= 2 * Math.PI;
    if (d < -Math.PI) d += 2 * Math.PI;
    const th = a0 + d * t;
    return [C[0] + Math.cos(th) * CW / 2, C[1] + Math.sin(th) * CH / 2];
  }
  // the dream in the pipes: pastel puffs of cloud, round pixel discs with a shadowed edge and a white top, close enough
  // to run together into one cloud. They drift on toward the front and billow as they go, the odd one pink or pale blue,
  // stars caught in them; the front is a bigger puff. Drawn over the pipes, the way a dream would come out of them.
  const discs = new Map();
  function disc(r, col) {
    const key = r + col;
    if (!discs.has(key)) {
      const [c, x] = off(2 * r + 1, 2 * r + 1);
      x.fillStyle = col;
      for (let j = -r; j <= r; j++) { const w = Math.floor(Math.sqrt(r * r + r * 0.8 - j * j)); x.fillRect(r - w, r + j, 2 * w + 1, 1); }
      discs.set(key, c);
    }
    return discs.get(key);
  }
  const PUFF = { edge: "#5b50a6", lav: "#dcd6ff", pink: "#ffd8ef", blue: "#d2e9ff", top: "#ffffff" };
  const SP = 3;                                                   // pixels between puffs along the way
  function drawDream() {
    const pts = [];
    for (const sg of segs) {
      if (sg.p <= 0) continue;
      for (let i = 0; i <= 8; i++) { if (pts.length && i === 0) continue; pts.push(along(sg, sg.p * i / 8)); }
    }
    if (pts.length < 2) return;
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const L = cum[cum.length - 1];
    const at = s => {
      let i = 1;
      while (i < cum.length - 1 && cum[i] < s) i++;
      const u = (s - cum[i - 1]) / Math.max(1e-6, cum[i] - cum[i - 1]);
      return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * u, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * u];
    };
    // each puff keeps its own size, colour and sway as it drifts: who it is travels with the flow. They sway off the
    // pipe's line to either side, now and then one billows big, and a few small wisps float up off the top
    const drift = clock * 10, phase = ((drift % SP) + SP) % SP, puffs = [], wisps = [];
    for (let s = phase; s < L - 2; s += SP) {
      const id = Math.round((s - drift) / SP), [x, y] = at(s), [ax, ay] = at(Math.max(0, s - 1)), [bx, by] = at(Math.min(L, s + 1));
      const tl = Math.hypot(bx - ax, by - ay) || 1, nx = -(by - ay) / tl, ny = (bx - ax) / tl;
      const sway = 1.6 * Math.sin(id * 1.3 + clock * 2);
      let r = 3.6 + 1.7 * Math.sin(id * 2.1) + 0.7 * Math.sin(clock * 3 + id);
      if (id % 4 === 0) r += 1.2;
      puffs.push({ x: Math.round(x + nx * sway), y: Math.round(y + ny * sway), r: Math.max(2, Math.round(r)), id });
      if (id % 6 === 0) {
        const up = 5 + 2 * Math.sin(clock * 2.3 + id);
        wisps.push({ x: Math.round(x + nx * sway), y: Math.round(y - up), r: 1 + (id % 12 === 0 ? 1 : 0) });
      }
    }
    const [hx, hy] = at(L);
    puffs.push({ x: Math.round(hx), y: Math.round(hy), r: 5 + Math.round(Math.sin(clock * 5)), id: -1 });
    g.globalAlpha = 0.7;
    for (const w of wisps) g.drawImage(disc(w.r, PUFF.lav), w.x - w.r, w.y - w.r);
    g.globalAlpha = 1;
    for (const f of puffs) g.drawImage(disc(f.r + 1, PUFF.edge), f.x - f.r - 1, f.y - f.r);
    for (const f of puffs) {
      const col = f.id % 5 === 0 ? PUFF.pink : f.id % 7 === 0 ? PUFF.blue : PUFF.lav;
      g.drawImage(disc(f.r, col), f.x - f.r, f.y - f.r);
    }
    g.globalAlpha = 0.8;
    for (const f of puffs) if (f.r >= 4 && f.id % 2 === 0) g.drawImage(disc(f.r - 2, PUFF.top), f.x - f.r + 1, f.y - f.r + 1);
    g.globalAlpha = 1;
    // stars caught in the cloud, twinkling
    for (const f of puffs) {
      if (f.id % 3 !== 0 || (Math.floor(clock * 6) + f.id) % 4 === 0) continue;
      g.fillStyle = f.id % 2 ? "#fff4bf" : "#a8f0ff";
      g.fillRect(f.x + 1, f.y - 1, 1, 3); g.fillRect(f.x, f.y, 3, 1);
    }
    // rushing, the front is a bright star
    if (fast) {
      const x = Math.round(hx), y = Math.round(hy);
      g.fillStyle = "#ffffff"; g.fillRect(x, y - 4, 1, 9); g.fillRect(x - 4, y, 9, 1);
    }
  }
  // a little pixel font, three by five
  const FONT = {
    N: ["X.X", "XXX", "XXX", "XXX", "X.X"], E: ["XXX", "X..", "XX.", "X..", "XXX"], X: ["X.X", "X.X", ".X.", "X.X", "X.X"],
    T: ["XXX", ".X.", ".X.", ".X.", ".X."], Z: ["XXX", "..X", ".X.", "X..", "XXX"],
  };
  function text(str, x, y, k, col) {
    g.fillStyle = col;
    for (let i = 0; i < str.length; i++) {
      const rows = FONT[str[i]];
      if (!rows) continue;
      for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) if (rows[r][c] === "X") g.fillRect(x + (i * 4 + c) * k, y + r * k, k, k);
    }
  }
  function puddle(p) {
    const P = POOLS[p.v], u = Math.min(1, p.t / 0.35);
    g.globalAlpha = u;
    g.drawImage(P.img, Math.round(p.x) - P.cx, Math.round(p.y) - P.cy);
    g.globalAlpha = 1;
    if (u >= 1) {
      // the star floating in it
      const sx = Math.round(p.x + 2), sy = Math.round(p.y + Math.sin(clock * 2) * 0.6);
      g.fillStyle = "#fff4bf"; g.fillRect(sx, sy - 1, 1, 3); g.fillRect(sx - 1, sy, 3, 1);
    }
  }

  function draw() {
    // the back wall, and the floor of the Dreamlayer Depths
    g.fillStyle = pat.wall; g.fillRect(0, 0, W, WALL);
    let gr = g.createLinearGradient(0, 0, 0, WALL);
    gr.addColorStop(0, "rgba(6,6,24,.86)"); gr.addColorStop(1, "rgba(10,10,34,.45)");
    g.fillStyle = gr; g.fillRect(0, 0, W, WALL);
    g.fillStyle = pat.floor; g.fillRect(0, WALL, W, H - WALL);
    g.fillStyle = "rgba(12,12,38,.58)"; g.fillRect(0, WALL, W, H - WALL);
    gr = g.createLinearGradient(0, WALL, 0, WALL + 24);
    gr.addColorStop(0, "rgba(0,0,0,.55)"); gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr; g.fillRect(0, WALL, W, 24);
    // the squares
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      g.fillStyle = (r + c) & 1 ? "rgba(0,0,10,.09)" : "rgba(150,160,255,.03)";
      g.fillRect(GX + c * CW, GY + r * CH, CW, CH);
    }
    g.strokeStyle = "rgba(150,160,255,.1)"; g.lineWidth = 1;
    g.strokeRect(GX - 0.5, GY - 0.5, COLS * CW + 1, ROWS * CH + 1);
    for (const p of puddles) puddle(p);
    // the drain: a hole in the floor, and the water it waits for glowing round it
    const dx = cx(drain.c), dy = cy(drain.r), pulse = 0.25 + 0.15 * Math.sin(clock * 3);
    g.fillStyle = "rgba(120,140,255," + pulse.toFixed(2) + ")"; g.beginPath(); g.ellipse(dx, dy, 15, 11, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = "rgba(0,0,0,.8)"; g.beginPath(); g.ellipse(dx, dy, 9, 6, 0, 0, Math.PI * 2); g.fill();
    // Snoreacle, asleep at the foot of the wall, and the pipe in front of it where the water comes up
    const sx = cx(src);
    blit(sn.pose, sx, WALL + 2 + sn.dy);
    blit("mouth_s", sx, cy(-1));
    // the pieces, the back row first
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = grid[r * COLS + c];
        if (cell.kind === "pipe") blit("pipe_" + cell.piece, cx(c), cy(r));
        else if (cell.kind === "old") blit("old_" + cell.piece, cx(c), cy(r));
        else if (cell.kind === "drain") blit(MOUTH[cell.open], cx(c), cy(r));
      }
    }
    drawDream();
    // what cannot be touched, and what was swapped out
    for (const n of nopes) {
      const x = cx(n.c), y = cy(n.r), a = 1 - n.t / 0.35;
      g.strokeStyle = "rgba(255,110,130," + a.toFixed(2) + ")"; g.lineWidth = 2;
      g.beginPath(); g.moveTo(x - 6, y - 5); g.lineTo(x + 6, y + 5); g.moveTo(x + 6, y - 5); g.lineTo(x - 6, y + 5); g.stroke();
    }
    for (const d of discards) { const u = d.t / 0.45; blit("pipe_" + d.piece, d.x - 10 * u, d.y - 16 * u, 1 - u); }
    if (keyUsed && state === "play") {
      g.strokeStyle = "rgba(230,236,255,.85)"; g.lineWidth = 1;
      g.strokeRect(GX + cur.c * CW + 1.5, GY + cur.r * CH + 1.5, CW - 3, CH - 3);
    }
    // the next pieces
    g.fillStyle = "rgba(6,6,20,.62)"; g.fillRect(TRAY.x, TRAY.y, TRAY.w, TRAY.h);
    g.strokeStyle = "rgba(150,160,255,.18)"; g.strokeRect(TRAY.x + 0.5, TRAY.y + 0.5, TRAY.w - 1, TRAY.h - 1);
    text("NEXT", TRAY.x + 5, TRAY.y + 5, 1, "#c8d2ff");
    g.strokeStyle = "rgba(230,236,255,.6)"; g.strokeRect(TRAY.x + 3.5, TRAY.y + 14.5, TRAY.step - 2, TRAY.h - 18);
    queue.slice(0, 5).forEach((k, i) => blit("pipe_" + k, TRAY.x + 2 + TRAY.step * i + TRAY.step / 2, TRAY.y + 44));
    // Knightley
    g.fillStyle = "rgba(0,0,0,.35)"; g.beginPath(); g.ellipse(KN.x, KN.y, 22, 6, 0, 0, Math.PI * 2); g.fill();
    blit(kn.pose, KN.x, KN.y + kn.dy);
    // light going out from the drain as the water goes down it
    for (const q of rings) {
      if (q.t < 0) continue;
      const u = q.t / 0.6;
      g.strokeStyle = "rgba(200,214,255," + (0.8 * (1 - u)).toFixed(2) + ")"; g.lineWidth = 2;
      g.beginPath(); g.ellipse(q.x, q.y, 8 + 70 * u, (8 + 70 * u) * 0.86, 0, 0, Math.PI * 2); g.stroke();
    }
    // dream confetti over everything; a piece now and then turns edge-on, the way paper does
    for (const b of confetti) {
      if (b.t < 0) continue;
      const rows = SHAPES[b.shape], w = rows[0].length, h = rows.length, k = b.k, x0 = Math.round(b.x - w * k / 2), y0 = Math.round(b.y - h * k / 2);
      const edgeOn = Math.floor(b.t * 8 + b.ph) % 4 === 0;
      g.globalAlpha = Math.max(0, Math.min(1, (b.life - b.t) / 0.4));
      g.fillStyle = b.col;
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
        if (rows[j][b.flip ? w - 1 - i : i] === "X" && (!edgeOn || i === w >> 1)) g.fillRect(x0 + i * k, y0 + j * k, k, k);
      }
    }
    g.globalAlpha = 1;
    // what Snoreacle mutters, which nobody has stayed awake long enough to translate
    for (const z of zs) {
      const u = z.t / 1.8;
      g.globalAlpha = Math.max(0, 1 - u * u);
      text("Z", Math.round(sx + 16 + z.dx + 10 * u), Math.round(WALL - 42 - 18 * u), u < 0.5 ? 1 : 2, "#c8d2ff");
      g.globalAlpha = 1;
    }
  }

  // what Knightley and Snoreacle are drawn at: sampled 15 times a second
  function sample(dt) {
    acc += dt;
    if (acc < RESIDENT_STEP && !reduce) return;
    acc = reduce ? 0 : acc % RESIDENT_STEP;
    const t = kn.t;
    kn.dy = 0;
    if (kn.act === "lay" && t < 0.3) kn.pose = "kn_turn";
    else if (kn.act === "wrench" && t < 0.4) { kn.wig = (kn.wig + 1) % 4; kn.pose = kn.wig < 2 ? "kn_l" : "kn_r"; }
    else if (kn.act === "cheer" && t < 1.7) {
      // a clog cleared: a turn in the air, then a jig
      if (t < 0.54) { const k = Math.floor(t * 15) % 8; kn.pose = k ? "kn_y" + k : "kn_0"; kn.dy = -Math.round(12 * Math.sin(Math.PI * t / 0.54)); }
      else if (t < 1.4) { kn.wig = (kn.wig + 1) % 4; kn.pose = kn.wig < 2 ? "kn_l" : "kn_r"; kn.dy = kn.wig % 2 ? -2 : 0; }
      else kn.pose = "kn_0";
    }
    else if (kn.act === "wet" && t < 0.9) { kn.wig = (kn.wig + 1) % 8; kn.pose = kn.wig < 4 ? "kn_l" : "kn_r"; }
    else kn.pose = state === "play" && round.phase === "run" ? "kn_turn" : "kn_0";
    sn.dy = 0;
    if (sn.act === "cheer" && sn.ct < 1.8) {
      // Snoreacle, still asleep: a hop, a turn, a wobble
      const u = sn.ct;
      if (u < 0.36) { sn.pose = "sn_0"; sn.dy = -Math.round(9 * Math.sin(Math.PI * u / 0.36)); }
      else if (u < 0.9) { const k = Math.floor((u - 0.36) * 15) % 8; sn.pose = k ? "sn_y" + k : "sn_0"; }
      else if (u < 1.6) { sn.wig = (sn.wig + 1) % 4; sn.pose = sn.wig < 2 ? "sn_l" : "sn_r"; sn.dy = sn.wig % 2 ? -1 : 0; }
      else sn.pose = "sn_0";
    } else sn.pose = Math.floor(sn.t / 1.6) % 2 ? "sn_1" : "sn_0";
  }

  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (!ready) return;
    if (state !== "pause") update(dt);
    sample(dt);
    draw();
  }

  /* ---------- input: tap a square, or the keys ---------- */
  const screen = $("screen");
  const toCanvas = e => { const b = cv.getBoundingClientRect(); return [(e.clientX - b.left) * W / b.width, (e.clientY - b.top) * H / b.height]; };
  screen.addEventListener("pointerdown", e => {
    if (e.target.closest("button, a")) return;
    if (state === "pause") { pause(false); return; }
    if (state !== "play") return;
    e.preventDefault();
    const [px, py] = toCanvas(e);
    const c = Math.floor((px - GX) / CW), r = Math.floor((py + 3 - GY) / CH);
    if (cellAt(c, r)) { keyUsed = false; lay(c, r); }
  });
  $("flush").addEventListener("pointerdown", e => { e.preventDefault(); if (state === "pause") pause(false); else flush(); });
  const MOVE = { ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0], ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1] };
  addEventListener("keydown", e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const el = e.target instanceof Element ? e.target : null;
    if (el && el !== document.body && el.closest("button") && (e.code === "Space" || e.code === "Enter")) return;
    if (MOVE[e.code]) {
      e.preventDefault();
      if (state === "pause") { pause(false); return; }
      if (state !== "play") return;
      keyUsed = true;
      cur.c = Math.max(0, Math.min(COLS - 1, cur.c + MOVE[e.code][0]));
      cur.r = Math.max(0, Math.min(ROWS - 1, cur.r + MOVE[e.code][1]));
    } else if (e.code === "Space" || e.code === "Enter") {
      e.preventDefault();
      if (state === "ready" || (state === "over" && !$("over").hidden)) { start(); return; }
      if (state === "pause") { pause(false); return; }
      keyUsed = true;
      if (!e.repeat) lay(cur.c, cur.r);
    } else if (e.code === "KeyF") {
      e.preventDefault();
      if (state === "pause") { pause(false); return; }
      flush();
    } else if (e.code === "KeyP" || e.code === "Escape") {
      if (state === "play") pause(true); else if (state === "pause") pause(false);
    }
  });

  function pause(on) {
    if (on && state === "play") {
      state = "pause";
      $("sub").textContent = "PAUSE ▮▮";
      if (audio.ctx) audio.ctx.suspend();
    } else if (!on && state === "pause") {
      state = "play"; $("sub").textContent = ""; audio.unlock();
    }
  }
  document.addEventListener("visibilitychange", () => { if (document.hidden) pause(true); });

  $("play").addEventListener("click", start);
  $("again").addEventListener("click", start);
  $("share").addEventListener("click", async () => {
    const url = "https://rotville.world/games/pipe-dream/", label = $("share").querySelector(".tape-label");
    const text = cleared === 0 ? "Knightley cleared no clogs on rotville.world. He is never out of work."
      : "Knightley cleared " + (cleared === 1 ? "one clog" : cleared + " clogs") + " on rotville.world. He is never out of work.";
    if (navigator.share) {
      try { await navigator.share({ title: "Pipe Dream", text, url }); return; } catch (err) { if (err && err.name === "AbortError") return; }
    }
    try { await navigator.clipboard.writeText(text + " " + url); label.textContent = "Copied"; } catch (err) { label.textContent = "Could not copy"; }
    setTimeout(() => { label.textContent = "Share"; }, 1600);
  });
  const soundBtn = $("sound"), upright = matchMedia("(max-width: 599px) and (orientation: portrait)");
  const sayVolume = () => {
    soundBtn.setAttribute("aria-pressed", String(audio.on));
    soundBtn.setAttribute("aria-label", audio.on ? "Sound on" : "Sound off");
    soundBtn.querySelector(".tape-label").textContent = upright.matches ? (audio.on ? "♪ On" : "♪ Off") : audio.on ? "Sound: on" : "Sound: off";
  };
  soundBtn.addEventListener("click", () => { audio.unlock(); audio.set(!audio.on); sayVolume(); });
  addEventListener("resize", sayVolume);
  sayVolume();

  Promise.all([fetch("assets/scene.json").then(r => r.json()), load("assets/sprites.png"), load("assets/tiles.png")])
    .then(([s, a, t]) => {
      SC = s; atlas = a;
      const tile = name => { const [c, x2] = off(32, 32); x2.drawImage(t, s.tiles[name] * 32, 0, 32, 32, 0, 0, 32, 32); return g.createPattern(c, "repeat"); };
      pat = { floor: tile("flagstone"), wall: tile("rockface") };
      queue = Array.from({ length: 5 }, nextPiece);
      newBoard(0);
      hud();
      ready = true;
    })
    .catch(() => { $("sub").textContent = "The tape would not load. Try the page again."; });
  requestAnimationFrame(frame);
})();
