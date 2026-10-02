/* Paper Round: Sprouted Doris delivers the hellos nobody sent.

   Sprouted Doris (LORE, was Potted Doris) is a flower of green petals and one red one with a single gold eye, and she
   walks on her roots with a satchel of envelopes on her hip. "She used to watch from the puddles. Now she delivers
   the hellos nobody sent." Everyone in Rotville has a place, a post, a pipe, a bench, a file, and along her lane
   each place shows a flower: green when someone is in, grey when nobody is. Tap a green one and she throws a hello
   to it. A green place she walks past without a hello is a miss, and three misses end the round. Bins and crates
   left on the lane knock letters out of her satchel; a puddle wets one, and she stops to look into it, the way she
   used to. Bundles of letters lie about to be picked up. She walks faster the further she goes.

   She is a rigid figurine: her walk is the whole model rocked from side to side and a throw is a lean, drawn at
   15 fps under the 60 fps page like the clips' residents (R819, R1070). Only pre-rendered sprites and the PS1 tiles
   ship. */
(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  const W = 270, H = 480;
  const cv = $("c"), g = cv.getContext("2d");
  g.imageSmoothingEnabled = false;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const store = {
    get(k, d) { try { const v = localStorage.getItem("paperround." + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem("paperround." + k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
  };
  const load = src => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });
  const off = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d"); x.imageSmoothingEnabled = false; return [c, x]; };
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[Math.floor(Math.random() * a.length)];

  const RESIDENT_STEP = 1 / 15;
  const LANE_L = 74, LANE_R = 196;               // the lane she walks; the verges either side are where people live
  const DORIS_Y = 150;                           // where her feet are on screen while the lane goes by
  const PLACE_X = [36, 234];                     // where the places stand, left and right
  const MISSES = 3, LETTERS = 12, SATCHEL = 20, BUNDLE = 6;
  const PLACES = ["post", "pipe", "bench", "file", "mailbox", "door"];
  const RANGE_BACK = 50, RANGE_AHEAD = 270;      // how far behind and ahead of her a hello can still reach
  // HOW HARD IT IS, by how far she has walked in pixels: faster, closer places, more of them in, more on the lane
  const hard = wy => Math.min(1, wy / 9000);
  const walkSpeed = wy => 55 + 75 * hard(wy);

  /* ---------- sound: the bed, three lines, the rest made on the spot ---------- */
  const audio = {
    ctx: null, on: store.get("sound", true), raw: {}, buf: {}, music: null,
    fetch() {
      for (const [k, f] of [["start", "assets/line-start.mp3"], ["miss", "assets/line-miss.mp3"], ["end", "assets/line-end.mp3"],
                            ["music", "assets/music-box.mp3"]]) {
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
    fwip() { this.noise(0.07, 0.05, 1800, 7000); },
    ping() { this.tone(988, 980, 0.09, "sine", 0.14); this.tone(659, 652, 0.16, "sine", 0.14, 0.1); },   // a hello arriving: two notes, down
    thup() { this.tone(160, 110, 0.12, "sine", 0.1); this.noise(0.04, 0.04, 400, 1500); },
    bump() { this.tone(130, 60, 0.2, "sine", 0.26); this.noise(0.28, 0.07, 1500, 6000, 0.03); },
    splash() { this.noise(0.35, 0.12, 300, 2600); this.tone(420, 200, 0.2, "sine", 0.05); },
    pickup() { this.noise(0.12, 0.05, 1500, 6000); this.tone(784, 1046, 0.12, "square", 0.05, 0.05); },
    miss() { this.tone(330, 300, 0.25, "triangle", 0.1); this.tone(247, 220, 0.4, "triangle", 0.1, 0.2); },
    step() { this.noise(0.03, 0.02, 200, 900); },
  };
  audio.fetch();

  /* ---------- puddles ---------- */
  // A puddle is a mask of whole pixels, so its edge keeps to the grid like everything else. Six are made once, from
  // seeds, and the lane uses them over and over. The paving shows through the water, the far lip is dark and wet,
  // the near edge catches the sky, and whatever stands just beyond a puddle shows in it upside down, so Doris sees
  // herself in one before she gets there.
  const seeded = a => () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const WATER = { far: [46, 60, 84, 179], near: [112, 134, 160, 158], lip: [20, 26, 40, 150], shine: [206, 220, 236, 140],
                  glint: [240, 246, 252, 230], wet: [18, 24, 36, 87], damp: [18, 24, 36, 36] };
  function makePuddle(rx, ry, seed, pal = WATER) {
    const R = seeded(seed), padX = Math.ceil(rx * 0.3) + 8, padY = 8;
    const w = 2 * (rx + padX) + 1, h = 2 * (ry + padY) + 1, cx = rx + padX, cy = ry + padY;
    const m = new Uint8Array(w * h), inM = (i, j) => (i >= 0 && j >= 0 && i < w && j < h ? m[j * w + i] : 0);
    // three pools run together, and now and then a small one lies apart
    const side = k => ({ x: cx + k * rx * (0.4 + 0.1 * R()), y: cy + (R() - 0.5) * ry * 0.6, rx: rx * (0.62 + 0.12 * R()), ry: ry * (0.9 + 0.25 * R()) });
    const blobs = [{ x: cx, y: cy, rx: rx * 0.8, ry: ry * 1.2 }, side(-1), side(1)];
    if (R() < 0.4) blobs.push({ x: cx + (R() < 0.5 ? -1 : 1) * rx * (1 + 0.1 * R()), y: cy + (R() - 0.5) * ry, rx: rx * 0.2, ry: ry * 0.5 });
    for (const bl of blobs) { bl.a = 0.05 + 0.07 * R(); bl.p = R() * 6.283; }
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      let F = 0;
      for (const bl of blobs) {
        // a little squarer than an ellipse, so the ends are blunt rather than pointed
        const dx = (i + 0.5 - bl.x) / bl.rx, dy = (j + 0.5 - bl.y) / bl.ry;
        const d2 = Math.pow(Math.pow(Math.abs(dx), 2.5) + Math.pow(Math.abs(dy), 2.5), 0.8) * (1 + bl.a * Math.sin(3 * Math.atan2(dy, dx) + bl.p));
        if (d2 < 1) F += (1 - d2) * (1 - d2);
      }
      m[j * w + i] = F > 0.12 ? 1 : 0;
    }
    // no lone pixels on the edge and no pinholes in the water
    for (let pass = 0; pass < 2; pass++) for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const n = inM(i - 1, j) + inM(i + 1, j) + inM(i, j - 1) + inM(i, j + 1);
      if (m[j * w + i] && n < 2) m[j * w + i] = 0; else if (!m[j * w + i] && n >= 3) m[j * w + i] = 1;
    }
    const spread = (src, pts) => {
      const d = src.slice();
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (src[j * w + i]) for (const [a, b] of pts) { const u = i + a, v = j + b; if (u >= 0 && v >= 0 && u < w && v < h) d[v * w + u] = 1; }
      return d;
    };
    // the wet paving round it, wider to the sides as the lane is seen from above; and how near counts as stepping in
    const wet = spread(m, [[-2, 0], [-1, 0], [1, 0], [2, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]);
    const damp = spread(wet, [[-1, 0], [1, 0], [0, -1], [0, 1]]);
    const near = [];
    for (let b = -3; b <= 3; b++) for (let a = -4; a <= 4; a++) if ((a / 4.5) ** 2 + (b / 3.5) ** 2 <= 1) near.push([a, b]);
    const touch = spread(m, near);
    const [uc, ux] = off(w, h), [oc, ox] = off(w, h), U = ux.createImageData(w, h), O = ox.createImageData(w, h);
    let reach = 0, x0 = w, x1 = 0, y0 = h, y1 = 0;
    for (let i = 0; i < w; i++) {
      let top = -1, bot = -1;
      for (let j = 0; j < h; j++) if (m[j * w + i]) { if (top < 0) top = j; bot = j; }
      for (let j = 0; j < h; j++) {
        const k = j * w + i;
        if (damp[k]) reach = Math.max(reach, Math.abs(i - cx));
        if (m[k]) {
          x0 = Math.min(x0, i); x1 = Math.max(x1, i); y0 = Math.min(y0, j); y1 = Math.max(y1, j);
          // darker under the far lip, lighter toward the near edge where the sky lies on it
          const t = bot > top ? (j - top) / (bot - top) : 0.5;
          for (let c = 0; c < 4; c++) U.data[k * 4 + c] = Math.round(pal.far[c] + (pal.near[c] - pal.far[c]) * t);
          if (!inM(i, j - 1)) O.data.set(pal.lip, k * 4);
          else if (!inM(i, j + 1) && inM(i - 1, j) && inM(i + 1, j) && Math.abs(i - cx) < rx * 0.75) O.data.set(pal.shine, k * 4);
        } else if (wet[k]) U.data.set(pal.wet, k * 4);
        else if (damp[k]) U.data.set(pal.damp, k * 4);
      }
    }
    // a glint of sky on the far half
    const gi = Math.round(cx - rx * (0.15 + 0.25 * R()));
    let gj = 0;
    while (gj < h && !m[gj * w + gi]) gj++;
    gj += 2;
    for (const [di, dj] of [[0, 0], [1, 0], [2, 0], [4, 1]]) {
      const i = gi + di, j = gj + dj;
      if (inM(i, j) && inM(i, j - 1) && inM(i, j + 1)) O.data.set(pal.glint, (j * w + i) * 4);
    }
    ux.putImageData(U, 0, 0); ox.putImageData(O, 0, 0);
    // the water's own outline, row by row, to hold what shows in it
    const path = new Path2D();
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      if (!m[j * w + i]) continue;
      const i0 = i;
      while (i < w && m[j * w + i]) i++;
      path.rect(i0, j, i - i0, 1);
    }
    return { w, h, cx, cy, m, touch, rx: (x1 - x0 + 1) / 2, ry: (y1 - y0 + 1) / 2, reach: reach + 2, under: uc, over: oc, path };
  }
  const PUDDLES = [[14, 7], [16, 8], [18, 7], [19, 9], [21, 8], [23, 9]].map(([rx, ry], k) => makePuddle(rx, ry, 7 + 131 * k));

  /* ---------- the lane ---------- */
  let SC, atlas, flip, sink, AW = 0, AH = 0, tilesImg, ready = false, pat = {};
  let state = "ready";                     // ready, play, stopped, pause, over
  let wy = 0, x = 135, tx = 135, keyDir = 0, clock = 0, endT = 0;
  let places = [], lane = [], flying = [], litter = [], drops = [], nextPlace = [0, 0], nextLane = 0;
  let letters = LETTERS, hellos = 0, misses = 0, throwT = 9, throwSide = 1, stumbleT = 9, invT = 0, lookT = 9, stepAcc = 0;
  let saidStart = false, saidMiss = false, best = store.get("best", 0);

  function hud() {
    $("hellos").textContent = hellos + (hellos === 1 ? " HELLO" : " HELLOS");
    const L = $("letters"); L.textContent = "✉ " + letters; L.classList.toggle("low", letters <= 2);
    L.setAttribute("aria-label", "Letters in the satchel: " + letters);
    $("misses").textContent = "●".repeat(MISSES - misses) + "○".repeat(misses);
    $("misses").setAttribute("aria-label", "Misses left: " + (MISSES - misses) + " of " + MISSES);
    $("best").textContent = "Most hellos " + best;
  }

  const onScreen = oy => DORIS_Y + (oy - wy);

  function reset() {
    wy = 0; x = tx = 135; keyDir = 0; endT = 0;
    places = []; lane = []; flying = []; litter = []; drops = [];
    nextPlace = [rnd(90, 140), rnd(150, 210)]; nextLane = 160;
    letters = LETTERS; hellos = 0; misses = 0; throwT = 9; stumbleT = 9; invT = 0; lookT = 9;
    grow();
    hud();
  }

  // the lane ahead: places on both verges, and on the lane itself puddles, bins, crates and bundles of letters
  function grow() {
    const f = hard(wy);
    for (let side = 0; side < 2; side++) {
      while (nextPlace[side] < wy + H) {
        places.push({ kind: pick(PLACES), side, y: nextPlace[side], online: Math.random() < 0.45 + 0.25 * f, delivered: false, missed: false, pending: false });
        nextPlace[side] += rnd(140, 190) - 40 * f;
      }
    }
    while (nextLane < wy + H) {
      const r = Math.random(), lx = rnd(LANE_L + 16, LANE_R - 16);
      if (r < 0.22 - 0.1 * f) lane.push({ kind: "papers", x: lx, y: nextLane });
      else if (r < 0.62 + 0.2 * f) {
        const kind = pick(["puddle", "puddle", "bin", "crate"]);
        if (kind === "puddle") {
          // a puddle keeps to the paving and never runs over the kerb
          const v = Math.floor(Math.random() * PUDDLES.length), P = PUDDLES[v];
          lane.push({ kind, v, x: Math.round(rnd(LANE_L + P.reach, LANE_R - P.reach)), y: nextLane, rx: P.rx, ry: P.ry });
        } else lane.push({ kind, x: lx, y: nextLane, r: kind === "bin" ? 11 : 14 });
      }
      nextLane += rnd(90, 130) - 40 * f;
    }
  }

  function start() {
    audio.unlock();
    reset();
    state = "play";
    $("ready").hidden = true; $("over").hidden = true;
    $("static").classList.remove("on");
    if (!saidStart) { saidStart = true; say("start", "Sprouted Doris delivers the hellos nobody sent."); }
  }

  function say(k, text) {
    const sub = $("sub");
    sub.textContent = text;
    audio.line(k).then(d => setTimeout(() => { if (sub.textContent === text) sub.textContent = ""; }, Math.max(1800, d * 1000 + 300)));
  }

  function inRange(p) { const dy = p.y - wy; return dy > -RANGE_BACK && dy < RANGE_AHEAD; }

  function throwTo(p) {
    if (state !== "play" || !p || p.pending || p.delivered || stumbleT < 0.45 || lookT < 0.7) return false;
    if (letters <= 0) { audio.thup(); return false; }
    if (!inRange(p)) return false;
    letters -= 1; p.pending = true;
    throwT = 0; throwSide = p.side === 0 ? -1 : 1;
    const s = SC.sprites["thing_" + p.kind];
    flying.push({ p, x0: x + throwSide * 10, y0: wy - 30, x1: PLACE_X[p.side], y1: p.y - s[5] * 0.55, u: 0, dur: 0.24 + Math.abs(p.y - wy) / 900 });
    audio.fwip();
    const b = $("throw"); b.classList.add("on"); setTimeout(() => b.classList.remove("on"), 120);
    hud();
    return true;
  }

  // Space and the button throw to the place that most needs it: the nearest one ahead that wants a hello
  function throwNearest() {
    const want = places.filter(p => p.online && !p.delivered && !p.pending && !p.missed && inRange(p)).sort((a, b) => a.y - b.y);
    throwTo(want[0]);
  }

  function arrive(f) {
    const p = f.p;
    p.pending = false;
    if (p.online && !p.missed) { p.delivered = true; hellos += 1; audio.ping(); bumpHud(); if (hellos > best) { best = hellos; store.set("best", best); } }
    else { audio.thup(); litter.push({ x: f.x1, y: f.y1 + 6, t: 0 }); }
    hud();
  }
  function bumpHud() { const el = $("hellos"); el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump"); setTimeout(() => el.classList.remove("bump"), 160); }

  function end() {
    state = "over";
    $("over-title").textContent = "The round is over.";
    $("over-line").textContent = hellos === 0 ? "Sprouted Doris delivered no hellos." : "Sprouted Doris delivered " + hellos + (hellos === 1 ? " hello." : " hellos.");
    $("over-stats").textContent = hellos > 0 && hellos === best ? "The most she has delivered" : "Most hellos " + best;
    hud();
    say("end", "Nobody sent them.");
    setTimeout(() => { if (state === "over") { $("over").hidden = false; $("again").focus({ preventScroll: true }); } }, 1500);
  }

  function update(dt) {
    clock += dt;
    for (const l of litter) l.t += dt;
    litter = litter.filter(l => l.t < 1.2);
    for (const d of drops) { d.x += d.vx * dt; d.z += d.vz * dt; d.vz -= 420 * dt; }
    drops = drops.filter(d => d.z > 0);
    if (state === "stopped") { endT += dt; if (endT > 1.2) end(); return; }
    if (state !== "play") return;
    throwT += dt; stumbleT += dt; invT = Math.max(0, invT - dt); lookT += dt;
    // she walks on, unless she has stopped to look into a puddle
    const v = lookT < 0.7 ? 0 : walkSpeed(wy);
    wy += v * dt;
    if (v > 0) { stepAcc += dt; if (stepAcc > 0.34) { stepAcc = 0; audio.step(); } }
    if (keyDir) tx = Math.max(LANE_L + 12, Math.min(LANE_R - 12, tx + keyDir * 170 * dt));
    if (stumbleT > 0.45) { const d = tx - x; x += Math.sign(d) * Math.min(Math.abs(d), 190 * dt); }
    grow();
    // letters in the air
    for (const f of flying) { f.u += dt / f.dur; if (f.u >= 1 && !f.done) { f.done = true; arrive(f); } }
    flying = flying.filter(f => !f.done);
    // what is on the lane under her feet
    for (const o of lane) {
      if (o.done) continue;
      const dy = o.y - wy, dx = o.x - x;
      if (o.kind === "papers") {
        if (Math.abs(dy) < 12 && Math.abs(dx) < 16) { o.done = true; letters = Math.min(SATCHEL, letters + BUNDLE); audio.pickup(); hud(); }
      } else if (o.kind === "puddle") {
        const P = PUDDLES[o.v], i = P.cx + Math.round(-dx), j = P.cy + Math.round(-dy);
        if (i >= 0 && j >= 0 && i < P.w && j < P.h && P.touch[j * P.w + i]) {
          // a letter gets wet, and she stops to look into it, the way she used to
          o.done = true; lookT = 0; audio.splash();
          // the rings start where her roots meet the water
          let jj = j;
          while (jj < P.h && !P.m[jj * P.w + i]) jj++;
          o.hitT = clock; o.hx = i - P.cx; o.hy = (jj < P.h ? jj + 1 : P.cy) - P.cy;
          for (let k = 0; k < 5; k++) drops.push({ x: x + rnd(-5, 5), y: wy + rnd(0, 3), z: 1, vx: rnd(-45, 45), vz: rnd(45, 85) });
          if (letters > 0) letters -= 1;
          hud();
        }
      } else if (invT <= 0 && Math.abs(dy) < o.r * 0.8 && Math.abs(dx) < o.r + 8) {
        o.done = true; invT = 0.9; stumbleT = 0; audio.bump();
        const drop = Math.min(2, letters); letters -= drop;
        for (let k = 0; k < drop; k++) litter.push({ x: x + rnd(-10, 10), y: wy - 20, t: 0, blow: rnd(-40, 40) });
        x = Math.max(LANE_L + 12, Math.min(LANE_R - 12, x + (dx > 0 ? -18 : 18))); tx = x;
        hud();
      }
    }
    // a green place she has walked past without a hello
    for (const p of places) {
      if (p.online && !p.delivered && !p.pending && !p.missed && p.y - wy < -RANGE_BACK - 20) {
        p.missed = true; misses += 1; audio.miss(); hud();
        if (!saidMiss && misses < MISSES) { saidMiss = true; say("miss", "Somebody went without."); }
        if (misses >= MISSES) { state = "stopped"; endT = 0; return; }
      }
    }
    places = places.filter(p => p.y - wy > -DORIS_Y - 120);
    lane = lane.filter(o => o.y - wy > -DORIS_Y - 60);
  }

  /* ---------- drawing ---------- */
  const at = (p, dy) => { p.setTransform(new DOMMatrix().translate(0, dy)); return p; };
  function blit(key, gx, gy, mirror) {
    const s = SC.sprites[key];
    if (!s) return;
    if (!mirror) g.drawImage(atlas, s[0], s[1], s[2], s[3], Math.round(gx - s[4]), Math.round(gy - s[5]), s[2], s[3]);
    else g.drawImage(flip, AW - s[0] - s[2], s[1], s[2], s[3], Math.round(gx - (s[2] - s[4])), Math.round(gy - s[5]), s[2], s[3]);
  }
  // a sprite upside down, standing on the same ground line, for what shows in a puddle
  function mirror(key, gx, gy) {
    const s = SC.sprites[key];
    if (!s) return;
    g.drawImage(sink, s[0], AH - s[1] - s[3], s[2], s[3], Math.round(gx - s[4]), Math.round(gy - (s[3] - s[5])), s[2], s[3]);
  }
  // a ripple: a ring laid flat on the lane, one pixel at a time
  function ring(cx, cy, r, a) {
    g.fillStyle = "rgba(214,228,242," + a.toFixed(2) + ")";
    const seen = new Set(), n = Math.ceil(r * 7);
    for (let k = 0; k < n; k++) {
      const th = (k / n) * 6.283, px = Math.round(cx + r * Math.cos(th)), py = Math.round(cy + r * 0.55 * Math.sin(th)), key = px * 4096 + py + 1024;
      if (!seen.has(key)) { seen.add(key); g.fillRect(px, py, 1, 1); }
    }
  }
  function drawPuddle(o) {
    const P = PUDDLES[o.v], sy = Math.round(onScreen(o.y));
    if (sy < -30 || sy > H + 30) return;
    const x0 = Math.round(o.x) - P.cx, y0 = sy - P.cy;
    g.drawImage(P.under, x0, y0);
    g.save();
    g.translate(x0, y0); g.clip(P.path); g.translate(-x0, -y0);
    g.globalAlpha = 0.55;
    for (const q of lane) if ((q.kind === "bin" || q.kind === "crate") && !q.done) mirror("thing_" + q.kind, q.x, onScreen(q.y));
    mirror(res.pose, res.x, DORIS_Y);
    g.globalAlpha = 1;
    // where she stepped in, two rings go out
    if (o.hitT !== undefined) for (let k = 0; k < 2; k++) { const u = (clock - o.hitT - k * 0.22) / 0.8; if (u > 0 && u < 1) ring(o.x + o.hx, sy + o.hy, 2 + u * P.rx, 0.75 * (1 - u)); }
    g.restore();
    g.drawImage(P.over, x0, y0);
  }
  // little flowers for who is in, as the messenger she was modelled on showed it; an envelope once a hello is there
  const FLOWER = [".GG.GG.", "GGG.GGG", "GGYYYGG", "..YYY..", "GGYYYGG", "GGG.GGG", ".GG.GG."];
  const LETTER = ["WWWWWWW", "WDWWWDW", "WWDWDWW", "WWWDWWW", "WWWWWWW"];
  function icon(rows, cx, cy, pal) {
    // two screen pixels to each of the icon's, so a flower reads green or grey at a glance
    const k = 2, w = rows[0].length * k, h = rows.length * k, x0 = Math.round(cx - w / 2), y0 = Math.round(cy - h / 2);
    g.fillStyle = "rgba(0,0,0,.55)";
    for (let j = 0; j < rows.length; j++) for (let i = 0; i < rows[0].length; i++) if (rows[j][i] !== ".") g.fillRect(x0 + i * k + 1, y0 + j * k + 1, k, k);
    for (let j = 0; j < rows.length; j++) for (let i = 0; i < rows[0].length; i++) { const c = pal[rows[j][i]]; if (c) { g.fillStyle = c; g.fillRect(x0 + i * k, y0 + j * k, k, k); } }
  }
  const ON = { G: "#6fd84b", Y: "#ffd46b" }, AWAY = { G: "#8a8f99", Y: "#5b5f68" }, WILT = { G: "#7a5a3a", Y: "#4a3a2a" }, MAIL = { W: "#f5f1e6", D: "#8a7f6a" };

  function draw() {
    // the lane: paving between kerbs, grass either side
    const top = wy - DORIS_Y;
    g.fillStyle = at(pat.grass, -top); g.fillRect(0, 0, LANE_L, H); g.fillRect(LANE_R, 0, W - LANE_R, H);
    g.fillStyle = "rgba(18,24,12,.42)"; g.fillRect(0, 0, LANE_L, H); g.fillRect(LANE_R, 0, W - LANE_R, H);
    g.fillStyle = at(pat.paving, -top); g.fillRect(LANE_L, 0, LANE_R - LANE_L, H);
    g.fillStyle = "#cfc8b8"; g.fillRect(LANE_L - 2, 0, 2, H); g.fillRect(LANE_R, 0, 2, H);
    g.fillStyle = "rgba(0,0,0,.25)"; g.fillRect(LANE_L, 0, 1, H); g.fillRect(LANE_R - 1, 0, 1, H);
    // puddles lie flat, so they go down first
    for (const o of lane) if (o.kind === "puddle") drawPuddle(o);
    // everything that stands, back to front
    const list = [];
    for (const p of places) list.push({ y: p.y, d: () => {
      const sy = onScreen(p.y), px = PLACE_X[p.side];
      blit("thing_" + p.kind, px, sy, p.side === 1);
      const s = SC.sprites["thing_" + p.kind], iy = sy - s[5] - 10;
      if (p.delivered) icon(LETTER, px, iy, MAIL);
      else icon(FLOWER, px, iy + (p.online && !p.missed && Math.floor(clock * 3 + p.y) % 2 ? -1 : 0), p.missed ? WILT : p.online ? ON : AWAY);
    } });
    for (const o of lane) if (o.kind !== "puddle" && !o.done) list.push({ y: o.y, d: () => blit("thing_" + (o.kind === "papers" ? "papers" : o.kind), o.x, onScreen(o.y), false) });
    list.push({ y: wy, d: () => {
      g.fillStyle = "rgba(0,0,0,.28)"; g.beginPath(); g.ellipse(res.x, DORIS_Y + 1, 13, 4, 0, 0, Math.PI * 2); g.fill();
      if (!(invT > 0 && Math.floor(clock * 12) % 2)) blit(res.pose, res.x, DORIS_Y, false);
      if (lookT < 0.7) { g.fillStyle = "#f5f1e6"; for (let k = 0; k < 3; k++) g.fillRect(Math.round(res.x - 5 + k * 4), DORIS_Y - 66, 2, 2); }
    } });
    list.sort((a, b) => a.y - b.y).forEach(o => o.d());
    // letters in the air, and letters blowing away
    for (const f of flying) {
      const u = Math.min(1, f.u), fx = f.x0 + (f.x1 - f.x0) * u, fy = onScreen(f.y0 + (f.y1 - f.y0) * u) - 26 * Math.sin(Math.PI * u);
      g.fillStyle = "#f5f1e6"; g.fillRect(Math.round(fx - 3), Math.round(fy - 2), 6, 4);
      g.fillStyle = "#8a7f6a"; g.fillRect(Math.round(fx - 2), Math.round(fy - 1), 1, 1); g.fillRect(Math.round(fx + 1), Math.round(fy - 1), 1, 1); g.fillRect(Math.round(fx - 1), Math.round(fy), 2, 1);
    }
    for (const l of litter) {
      const lx = l.x + (l.blow || 0) * l.t, ly = onScreen(l.y) - 20 * l.t + 30 * l.t * l.t;
      g.globalAlpha = Math.max(0, 1 - l.t / 1.2); g.fillStyle = "#f5f1e6"; g.fillRect(Math.round(lx - 2), Math.round(ly - 1), 5, 3); g.globalAlpha = 1;
    }
    g.fillStyle = "#d6e4f2";
    for (const d of drops) g.fillRect(Math.round(d.x), Math.round(onScreen(d.y) - d.z), 1, 2);
  }

  // what Doris is drawn at: sampled 15 times a second
  const res = { x: 135, pose: "doris_walk_0", acc: 0, step: 0 };
  function sample(dt) {
    res.acc += dt;
    if (res.acc < RESIDENT_STEP && !reduce) return;
    res.acc = reduce ? 0 : res.acc % RESIDENT_STEP;
    res.x = x;
    if (state !== "play" && state !== "stopped") { res.pose = "doris_walk_0"; return; }
    if (stumbleT < 0.45) res.pose = Math.floor(stumbleT * 15) % 2 ? "doris_throw_l" : "doris_throw_r";
    else if (throwT < 0.25) res.pose = throwSide < 0 ? "doris_throw_l" : "doris_throw_r";
    else if (lookT < 0.7 || state === "stopped") res.pose = "doris_walk_0";
    else {
      // her walk: a rock from one root to the other, four steps round
      res.step = (res.step + 1) % 8;
      res.pose = ["doris_walk_l", "doris_walk_l", "doris_walk_0", "doris_walk_0", "doris_walk_r", "doris_walk_r", "doris_walk_0", "doris_walk_0"][res.step];
    }
  }

  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.max(0, Math.min(0.1, (now - last) / 1000));   // a frame can be stamped before the clock started
    last = now;
    if (!ready) return;
    if (state !== "pause") update(dt);
    sample(dt);
    draw();
  }

  /* ---------- input: tap a place to throw, drag to steer ---------- */
  const screen = $("screen");
  let press = null;
  const toCanvas = e => { const b = cv.getBoundingClientRect(); return [(e.clientX - b.left) * W / b.width, (e.clientY - b.top) * H / b.height]; };
  function placeAt(px, py) {
    let bestP = null, bd = 1e9;
    for (const p of places) {
      const s = SC.sprites["thing_" + p.kind], sx = PLACE_X[p.side], sy = onScreen(p.y);
      const inBox = px > sx - s[2] / 2 - 10 && px < sx + s[2] / 2 + 10 && py > sy - s[5] - 16 && py < sy + 10;
      const dd = Math.abs(py - (sy - s[5] / 2));
      if (inBox && dd < bd) { bd = dd; bestP = p; }
    }
    return bestP;
  }
  screen.addEventListener("pointerdown", e => {
    if (e.target.closest("button, a")) return;
    if (state === "pause") { pause(false); return; }
    if (state !== "play") return;
    e.preventDefault();
    const [px, py] = toCanvas(e);
    const p = placeAt(px, py);
    if (p) { throwTo(p); return; }
    // anywhere else steers: she heads for where you touch, and follows a drag
    press = { id: e.pointerId };
    try { screen.setPointerCapture(e.pointerId); } catch (err) { /* not capturable */ }
    tx = Math.max(LANE_L + 12, Math.min(LANE_R - 12, px));
  });
  screen.addEventListener("pointermove", e => {
    if (!press || e.pointerId !== press.id || state !== "play") return;
    tx = Math.max(LANE_L + 12, Math.min(LANE_R - 12, toCanvas(e)[0]));
  });
  const up = e => { if (press && e.pointerId === press.id) press = null; };
  screen.addEventListener("pointerup", up);
  screen.addEventListener("pointercancel", up);
  $("throw").addEventListener("pointerdown", e => { e.preventDefault(); if (state === "pause") pause(false); else throwNearest(); });
  const LEFT = new Set(["ArrowLeft", "KeyA"]), RIGHT = new Set(["ArrowRight", "KeyD"]);
  const held = new Set();
  addEventListener("keydown", e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const el = e.target instanceof Element ? e.target : null;
    if (el && el !== document.body && el.closest("button") && (e.code === "Space" || e.code === "Enter")) return;
    if (LEFT.has(e.code) || RIGHT.has(e.code)) {
      e.preventDefault(); if (state === "pause") { pause(false); return; }
      held.add(e.code); keyDir = [...held].some(c => RIGHT.has(c)) - [...held].some(c => LEFT.has(c));
    } else if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") {
      e.preventDefault();
      if (state === "ready" || (state === "over" && !$("over").hidden)) { if (e.code === "Space") start(); return; }
      if (state === "pause") { pause(false); return; }
      if (!e.repeat) throwNearest();
    } else if (e.code === "Enter" && (state === "ready" || (state === "over" && !$("over").hidden))) {
      e.preventDefault(); start();
    } else if (e.code === "KeyP" || e.code === "Escape") {
      if (state === "play") pause(true); else if (state === "pause") pause(false);
    }
  });
  addEventListener("keyup", e => { held.delete(e.code); keyDir = [...held].some(c => RIGHT.has(c)) - [...held].some(c => LEFT.has(c)); });
  addEventListener("blur", () => { held.clear(); keyDir = 0; press = null; });

  function pause(on) {
    if (on && state === "play") {
      state = "pause"; held.clear(); keyDir = 0;
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
    const url = "https://rotville.world/games/paper-round/", label = $("share").querySelector(".tape-label");
    const text = hellos === 0 ? "Sprouted Doris delivered no hellos on rotville.world. Nobody sent them."
      : "Sprouted Doris delivered " + hellos + (hellos === 1 ? " hello" : " hellos") + " on rotville.world. Nobody sent them.";
    if (navigator.share) {
      try { await navigator.share({ title: "Paper Round", text, url }); return; } catch (err) { if (err && err.name === "AbortError") return; }
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
      SC = s; atlas = a; tilesImg = t; AW = a.width;
      // the far verge's places are the near verge's, turned the other way
      const [fc, fx] = off(a.width, a.height); fx.translate(a.width, 0); fx.scale(-1, 1); fx.drawImage(a, 0, 0); flip = fc;
      // and upside down, darkened toward the water's colour, for what shows in the puddles
      const [kc, kx] = off(a.width, a.height); kx.translate(0, a.height); kx.scale(1, -1); kx.drawImage(a, 0, 0);
      kx.setTransform(1, 0, 0, 1, 0, 0); kx.globalCompositeOperation = "source-atop"; kx.fillStyle = "rgba(22,34,56,.5)"; kx.fillRect(0, 0, a.width, a.height);
      sink = kc; AH = a.height;
      const tile = name => { const [c, x2] = off(32, 32); x2.drawImage(t, s.tiles[name] * 32, 0, 32, 32, 0, 0, 32, 32); return g.createPattern(c, "repeat"); };
      pat = { paving: tile("paving"), grass: tile("grass") };
      reset(); ready = true;
    })
    .catch(() => { $("sub").textContent = "The tape would not load. Try the page again."; });
  requestAnimationFrame(frame);
})();
