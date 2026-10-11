/* Paper Round: Sprouted Doris delivers the hellos nobody sent, as the arcade's Paperboy delivered papers.

   Sprouted Doris (LORE, was Potted Doris) is a flower of green petals and one red one with a single gold eye, and she
   walks on her roots with a satchel of envelopes on her hip. "She used to watch from the puddles. Now she delivers
   the hellos nobody sent." Everyone in Rotville has a place, a post, a pipe, a bench, a file, and over each place
   floats its flower: green when someone is in, grey when nobody is, red when they are busy.

   The first version aimed for you - THROW picked the place and the hello always landed - and a bot that only pressed
   Space delivered 22 hellos in 55 s and never missed one. The user, 2026-10-10: "paper-round should be heavily
   reworked since it doesn't have a challenge", and "also visuals and whole game vibe must be enhanced". So it plays
   like Paperboy now:
   - you aim. ◀ and ▶ (Z and X) throw a hello out to that side. It flies straight out and keeps her pace, so you
     throw a little before the place, and earlier the faster she walks. In the slot it is two hellos, on the place
     one, on the grass none.
   - you set her pace: up hurries her, down holds her back, never to a stop.
   - things move. Shopping carts roll across the road and barrels roll down it; bins, crates and puddles stand in
     it. Walking into one knocks her over and scatters two letters. A puddle stops her: she looks into it, the way
     she used to, and a letter gets wet.
   - her satchel holds ten letters, and bundles of five lie in the road.
   - three slips end the round: a fall, a place left without its hello, or, from the Balcony District on, a hello
     to somebody busy. A street with no slip in it gives one back.
   - five streets, each its own night - Mailbox Promenade, Rothill, the Balcony District, the Canal District and
     Rotville Park - and then round again, faster.

   Her walk is her kept take (library/characters/pingbloom/anim/walk.blend), drawn at 15 fps like the clips'
   residents (R819, R1070). Her throws, her look into a puddle and her fall are keyed over the same rig: UniMate's
   takes left her standing still or spinning (R1218). Everything else is a library model rendered from the game's
   camera - 40 degrees down, looking up the street - and the night, the lamps and the fog are laid over it here.
   Only the pre-rendered sprites and the ground strips ship. */
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
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  /* ---------- the street, in metres: x across (0 the middle of the road), s along it, the way she walks ---------- */
  const PX = 50, GY = 32.1394, HY = 38.3022;   // screen pixels to a metre across, along the ground, and upright
  const CX = 135, DORIS_Y = 146;               // where her feet are on the screen
  const ROAD = 1.30, ROAM = 1.06;              // the road's half width, and how far from the middle she may walk
  const PLACE_X = 2.24, LAND_X = 2.0;          // where the places stand, and where a hello reaches them
  const LAMP_X = 1.66, FENCE_X = 1.92, TREE_X = 2.95;
  const STRIP = 257 / GY;                      // a ground strip, in metres of street
  const RESIDENT_STEP = 1 / 15;
  const THROW_V = 7.5;                         // a hello's speed across the street, m/s
  const SATCHEL = 10, BUNDLE = 5, PETALS = 3;
  const FALL = 0.8, LOOK = 0.8, GRACE = 1.3;
  let sD = 0, dx = 0;                          // where she is
  const toX = x => CX + x * PX;
  const toY = s => DORIS_Y + (s - sD) * GY;

  // how wide a place is to a hello, half each way along the street, and its slot
  const BODY = { mailbox: 0.40, door: 0.48, post: 0.30, pipe: 0.34, bench: 0.62, file: 0.44 };
  const SLOT = 0.17;
  // the slot sits a little nearer the lens than the middle of the place's footing
  const SLOT_DS = { mailbox: 0.10, door: 0.16, post: 0.06, pipe: 0.0, bench: 0.0, file: 0.14 };

  /* ---------- the five streets, from LORE's districts, each with its own night ---------- */
  const STREETS = [
    { id: "promenade", name: "Mailbox Promenade", line: "street-1", ground: "promenade",
      note: "one long street of mailboxes",
      fence: "fence_picket", fences: 0.8, trees: ["tree_leafy"], bushes: ["bush", "bush_low"],
      kinds: ["mailbox", "mailbox", "mailbox", "mailbox", "door", "post", "file"],
      plots: 16, gap: 5.0, on: 0.6, busy: 0, flicker: 0, pace: 1.45, win: 1.25,
      statics: 3, carts: 0, barrels: 0, puddles: 3, bundles: 4, rain: 0, fog: 0.10, wind: 0, leaves: 0.5,
      tint: [206, 186, 228], pool: [255, 196, 120], sky: [255, 150, 110] },
    { id: "rothill", name: "Rothill", line: "street-2", ground: "rothill",
      note: "streets, back alleys, dump areas; downhill, unloved",
      fence: "fence_wood", fences: 0.7, trees: ["tree_dead", "tree_bare"], bushes: ["bush_dead", "bush_low"],
      kinds: ["post", "pipe", "file", "door", "mailbox", "bench"],
      plots: 17, gap: 4.7, on: 0.6, busy: 0, flicker: 0, pace: 1.6, win: 1.05,
      statics: 4, carts: 3, barrels: 3, puddles: 3, bundles: 4, rain: 0, fog: 0.12, wind: 0, leaves: 0.8,
      tint: [170, 150, 176], pool: [255, 180, 104], sky: [230, 120, 96] },
    { id: "balcony", name: "The Balcony District", line: "street-3", ground: "balcony",
      note: "residential, territorial",
      fence: "fence_wall", fences: 0.5, trees: ["tree_bare"], bushes: ["bush", "bush_low"],
      kinds: ["door", "door", "file", "bench", "mailbox", "pipe"],
      plots: 18, gap: 4.5, on: 0.55, busy: 0.22, flicker: 0, pace: 1.72, win: 1.0,
      statics: 4, carts: 3, barrels: 2, puddles: 5, bundles: 4, rain: 1, fog: 0.10, wind: 0, leaves: 0.2,
      tint: [140, 140, 196], pool: [255, 206, 140], sky: [120, 110, 200] },
    { id: "canal", name: "The Canal District", line: "street-4", ground: "canal", water: true,
      note: "standing water and cooking",
      fence: "fence_rail", fences: 0.65, trees: ["tree_dead"], bushes: ["bush_low"],
      kinds: ["pipe", "post", "bench", "file", "mailbox", "door"],
      plots: 16, gap: 2.9, on: 0.55, busy: 0.18, flicker: 0.25, pace: 1.8, win: 1.0,
      statics: 3, carts: 2, barrels: 3, puddles: 8, bundles: 4, rain: 0, fog: 0.42, wind: 0, leaves: 0.2,
      tint: [126, 150, 178], pool: [210, 236, 200], sky: [90, 150, 160] },
    { id: "park", name: "Rotville Park", line: "street-5", ground: "park",
      note: "ornamental hedges and planters; the Whisper Hedges",
      fence: null, fences: 0, trees: ["tree_leafy", "tree_bare"], bushes: ["bush", "bush", "bush_low"],
      kinds: ["bench", "bench", "post", "pipe", "mailbox", "file"],
      plots: 18, gap: 4.4, on: 0.55, busy: 0.18, flicker: 0.2, pace: 1.9, win: 0.95,
      statics: 4, carts: 3, barrels: 3, puddles: 4, bundles: 4, rain: 0, fog: 0.16, wind: 1, leaves: 1.4,
      tint: [118, 128, 186], pool: [190, 220, 255], sky: [80, 90, 170] },
  ];
  const streetOf = k => STREETS[k % STREETS.length];
  const lapOf = k => Math.floor(k / STREETS.length);

  /* ---------- sound: the bed, the narrator's lines, the rest made on the spot ---------- */
  const LINES = [["start", "line-start"], ["miss", "line-miss"], ["end", "line-end"], ["clean", "line-clean"],
                 ["street-1", "line-street-1"], ["street-2", "line-street-2"], ["street-3", "line-street-3"],
                 ["street-4", "line-street-4"], ["street-5", "line-street-5"]];
  const audio = {
    ctx: null, on: store.get("sound", true), raw: {}, buf: {}, music: null, loops: {},
    fetch() {
      for (const [k, f] of LINES) this.raw[k] = fetch("assets/" + f + ".mp3").then(r => (r.ok ? r.arrayBuffer() : null)).catch(() => null);
      this.raw.music = fetch("assets/music-box.mp3").then(r => (r.ok ? r.arrayBuffer() : null)).catch(() => null);
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
      this.mus = c.createGain(); this.mus.gain.value = 0.2; this.mus.connect(this.master);
      this.vox = c.createGain(); this.vox.gain.value = 1; this.vox.connect(this.master);
      const n = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = n.getChannelData(0);
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
        this.rate(this.wantRate || 1);
      });
      // what rolls: a cart's rattle and a barrel's rumble, always running, up when one is near
      this.loops.cart = this.loop(1400, 3.2, 11);
      this.loops.barrel = this.loop(160, 1.2, 5.5);
      this.loops.wind = this.loop(500, 0.7, 0.3);
    },
    loop(freq, q, wob) {
      const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), am = c.createGain(), out = c.createGain();
      s.buffer = this.noiseBuf; s.loop = true; f.type = "bandpass"; f.frequency.value = freq; f.Q.value = q;
      const lfo = c.createOscillator(), depth = c.createGain(); lfo.frequency.value = wob; depth.gain.value = 0.5;
      am.gain.value = 0.5; lfo.connect(depth).connect(am.gain);
      out.gain.value = 0;
      s.connect(f).connect(am).connect(out).connect(this.fxg); s.start(); lfo.start();
      return out;
    },
    level(name, v) { const o = this.loops[name]; if (o) o.gain.setTargetAtTime(v, this.ctx.currentTime, 0.08); },
    rate(r) { this.wantRate = r; if (this.music) this.music.playbackRate.setTargetAtTime(r, this.ctx.currentTime, 0.4); },
    set(on) { this.on = on; store.set("sound", on); if (this.master) this.master.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.04); },
    line(k) {
      if (!this.ctx || !this.buf[k]) return Promise.resolve(0);
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
      s.connect(a).connect(b).connect(e).connect(this.fxg); s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.03);
    },
    fwip() { this.noise(0.08, 0.06, 1800, 7000); },
    // a hello arriving: two notes, down, the way the messenger she was modelled on pinged
    ping() { this.tone(988, 980, 0.09, "sine", 0.14); this.tone(659, 652, 0.16, "sine", 0.14, 0.1); },
    clack() { this.noise(0.03, 0.12, 2500, 9000); this.tone(1320, 1300, 0.05, "square", 0.04); this.tone(988, 980, 0.09, "sine", 0.14, 0.05); this.tone(659, 652, 0.18, "sine", 0.14, 0.15); this.tone(1319, 1310, 0.14, "sine", 0.06, 0.26); },
    thup() { this.tone(160, 110, 0.12, "sine", 0.1); this.noise(0.04, 0.04, 400, 1500); },
    grumble() { this.tone(110, 90, 0.35, "sawtooth", 0.05); this.tone(116, 94, 0.35, "sawtooth", 0.04, 0.02); },
    bump() { this.tone(130, 55, 0.25, "sine", 0.28); this.noise(0.3, 0.08, 1500, 6000, 0.03); this.noise(0.5, 0.05, 3000, 9000, 0.12); },
    splash() { this.noise(0.35, 0.12, 300, 2600); this.tone(420, 200, 0.2, "sine", 0.05); },
    pickup() { this.noise(0.12, 0.05, 1500, 6000); this.tone(784, 1046, 0.12, "square", 0.05, 0.05); },
    empty() { this.tone(220, 200, 0.08, "square", 0.05); },
    miss() { this.tone(330, 300, 0.25, "triangle", 0.1); this.tone(247, 220, 0.4, "triangle", 0.1, 0.2); },
    bloom() { this.tone(784, 1175, 0.18, "sine", 0.07); },
    wilt() { this.tone(523, 330, 0.25, "sine", 0.05); },
    street() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, f, 0.22, "triangle", 0.06, i * 0.09)); },
    step() { this.noise(0.025, 0.018, 250, 1100); },
  };
  // on a phone, these sounds buzz in the hand too (../../assets/buzz.js)
  window.rvBuzz?.on(audio, { ping: "tap", clack: "good", pickup: "tap", splash: "bump", bump: "hit", miss: "lose", grumble: "bump", street: "great" });
  audio.fetch();

  /* ---------- puddles ---------- */
  // A puddle is a mask of whole pixels, so its edge keeps to the grid like everything else. Six are made once, from
  // seeds, and the road uses them over and over. The paving shows through the water, the far lip is dark and wet,
  // the near edge catches the sky, and whatever stands just beyond a puddle shows in it upside down, so Doris sees
  // herself in one before she gets there.
  const seeded = a => () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const WATER = { far: [40, 52, 78, 190], near: [104, 124, 156, 170], lip: [16, 20, 34, 160], shine: [206, 220, 236, 150],
                  glint: [240, 246, 252, 235], wet: [14, 18, 30, 96], damp: [14, 18, 30, 40] };
  function makePuddle(rx, ry, seed, pal = WATER) {
    const R = seeded(seed), padX = Math.ceil(rx * 0.3) + 8, padY = 8;
    const w = 2 * (rx + padX) + 1, h = 2 * (ry + padY) + 1, cx = rx + padX, cy = ry + padY;
    const m = new Uint8Array(w * h), inM = (i, j) => (i >= 0 && j >= 0 && i < w && j < h ? m[j * w + i] : 0);
    const side = k => ({ x: cx + k * rx * (0.4 + 0.1 * R()), y: cy + (R() - 0.5) * ry * 0.6, rx: rx * (0.62 + 0.12 * R()), ry: ry * (0.9 + 0.25 * R()) });
    const blobs = [{ x: cx, y: cy, rx: rx * 0.8, ry: ry * 1.2 }, side(-1), side(1)];
    if (R() < 0.4) blobs.push({ x: cx + (R() < 0.5 ? -1 : 1) * rx * (1 + 0.1 * R()), y: cy + (R() - 0.5) * ry, rx: rx * 0.2, ry: ry * 0.5 });
    for (const bl of blobs) { bl.a = 0.05 + 0.07 * R(); bl.p = R() * 6.283; }
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      let F = 0;
      for (const bl of blobs) {
        const ddx = (i + 0.5 - bl.x) / bl.rx, ddy = (j + 0.5 - bl.y) / bl.ry;
        const d2 = Math.pow(Math.pow(Math.abs(ddx), 2.5) + Math.pow(Math.abs(ddy), 2.5), 0.8) * (1 + bl.a * Math.sin(3 * Math.atan2(ddy, ddx) + bl.p));
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
          const t = bot > top ? (j - top) / (bot - top) : 0.5;
          for (let c = 0; c < 4; c++) U.data[k * 4 + c] = Math.round(pal.far[c] + (pal.near[c] - pal.far[c]) * t);
          if (!inM(i, j - 1)) O.data.set(pal.lip, k * 4);
          else if (!inM(i, j + 1) && inM(i - 1, j) && inM(i + 1, j) && Math.abs(i - cx) < rx * 0.75) O.data.set(pal.shine, k * 4);
        } else if (wet[k]) U.data.set(pal.wet, k * 4);
        else if (damp[k]) U.data.set(pal.damp, k * 4);
      }
    }
    const gi = Math.round(cx - rx * (0.15 + 0.25 * R()));
    let gj = 0;
    while (gj < h && !m[gj * w + gi]) gj++;
    gj += 2;
    for (const [di, dj] of [[0, 0], [1, 0], [2, 0], [4, 1]]) {
      const i = gi + di, j = gj + dj;
      if (inM(i, j) && inM(i, j - 1) && inM(i, j + 1)) O.data.set(pal.glint, (j * w + i) * 4);
    }
    ux.putImageData(U, 0, 0); ox.putImageData(O, 0, 0);
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

  /* ---------- light: glows made once, stepped and dithered so they keep to the pixel grid ---------- */
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  function makeGlow(rx, ry, rgb, power = 1.6, levels = 6) {
    const w = 2 * rx + 1, h = 2 * ry + 1, [c, x] = off(w, h), im = x.createImageData(w, h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const d = Math.hypot((i - rx) / rx, (j - ry) / ry);
      let v = Math.max(0, 1 - d) ** power;
      const t = (BAYER[(j & 3) * 4 + (i & 3)] + 0.5) / 16;
      v = Math.floor(v * levels + t) / levels;
      const k = (j * w + i) * 4;
      im.data[k] = rgb[0]; im.data[k + 1] = rgb[1]; im.data[k + 2] = rgb[2]; im.data[k + 3] = Math.round(255 * clamp(v, 0, 1));
    }
    x.putImageData(im, 0, 0);
    return c;
  }
  const GLOW = {};

  /* ---------- the street's things ---------- */
  let SC, atlas, flip, sink, AW = 0, AH = 0, groundImg, ready = false;
  let state = "ready";                     // ready, play, stopped, pause, over
  let streets = [], plots = [], props = [], hazards = [], pickups = [], puddles = [], lamps = [];
  let hellosAir = [], litter = [], drops = [], leaves = [], sparks = [], pops = [], scraps = [];
  let streetK = 0, cleanStreet = true, pace = 1.4, tx = 0, keyDir = 0, paceKey = 0, touchPace = 0;
  let letters = SATCHEL, hellos = 0, petals = PETALS, clock = 0, endT = 0;
  let throwT = 9, throwSide = 1, fallT = 9, lookT = 9, invT = 0, stepAcc = 0, wind = 0, windT = 4, windGoal = 0;
  let saidStart = false, saidMiss = false, best = store.get("best", 0), bestStreet = store.get("street", 0), titleT = 9;
  let nextId = 1;
  const LOG = location.hash === "#debug" ? [] : null;
  const ev = (type, more) => { if (LOG) LOG.push(Object.assign({ type, t: +clock.toFixed(2), s: +sD.toFixed(2), k: streetK }, more || {})); };

  function rng(seed) { return seeded(seed); }

  // a street laid out from s0: its places on both verges, the fences between the gardens, the lamps, the trees,
  // and on the road what is left there and what will come down it
  function buildStreet(k, s0) {
    const st = streetOf(k), lap = lapOf(k), R = rng(9973 * (k + 1) + Math.floor(Math.random() * 1e6));
    const pick = a => a[Math.floor(R() * a.length)];
    const quiet = k === 0 ? 14 : 9;                    // the first metres of a street carry its name, nothing else
    const gap = st.gap * (lap ? 0.94 : 1);
    const n = st.plots + 2 * lap;
    const mine = [];
    // places: left and right in turn, half a gap apart; the canal keeps its water on the left
    for (let i = 0; i < n; i++) {
      const side = st.water ? 1 : (i % 2 ? 1 : -1);
      const s = s0 + quiet + (st.water ? i * gap : (i * gap) / 2);
      const has = i < 2 || R() < 0.86;
      const p = { id: nextId++, side, s, has, kind: pick(st.kinds), status: "off", delivered: false, missed: false, pending: 0,
                  flip: null, flipped: false, bloomT: 9, flashT: 9, slotS: 0 };
      if (has) {
        const r = R();
        p.status = r < st.on ? "on" : r < st.on + st.busy ? "busy" : "off";
        if (i < 2) p.status = "on";
        if (st.flicker && R() < st.flicker && i > 1) p.flip = s - (4.5 + 2 * R());
        p.slotS = s + SLOT_DS[p.kind];
        props.push({ kind: "path", x: side * 2.0, s: s + 0.2, flat: true, mirror: side < 0 });
      }
      plots.push(p); mine.push(p);
      // between this garden and the next: the street's fence, most of the time, else a bush, now and then nothing
      const fs = s + (st.water ? gap / 2 : gap), r = R();
      if (st.fence && r < st.fences) props.push({ kind: st.fence, x: side * FENCE_X, s: fs, mirror: side < 0, by: "inner" });
      else if (r < 0.9) props.push({ kind: pick(st.bushes), x: side * (FENCE_X + 0.3), s: fs, mirror: R() < 0.5 });
      // a tree where nobody lives, and now and then one behind a place
      if (!has) props.push({ kind: pick(st.trees), x: side * TREE_X, s: s + 0.3, mirror: R() < 0.5 });
      else if (R() < 0.3) props.push({ kind: pick(st.trees), x: side * (TREE_X + 0.55), s: s - 1.2, mirror: R() < 0.5 });
      if (R() < 0.55) props.push({ kind: pick(st.bushes), x: side * (2.45 + 0.3 * R()), s: s + (R() < 0.5 ? -1 : 1) * (0.9 + 0.4 * R()), mirror: R() < 0.5 });
    }
    // the canal's railing, all the way along the water
    if (st.water) for (let s = s0 + 1; s < s0 + quiet + n * gap; s += 2.4) props.push({ kind: "fence_rail", x: -FENCE_X - 0.1, s, mirror: true, by: "inner" });
    const end = Math.ceil((s0 + quiet + (st.water ? n * gap : (n * gap) / 2) + 7) / STRIP) * STRIP;
    // lamps along the pavement, sides in turn, the arm out over the road
    let ls = s0 + 3 + 3 * R(), lside = R() < 0.5 ? -1 : 1;
    while (ls < end - 1) {
      if (!(st.water && lside < 0)) lamps.push({ x: lside * LAMP_X, s: ls, side: lside, phase: R() * 6.28 });
      ls += 8 + 3 * R(); lside = -lside;
    }
    // on the road: what stands, what crosses, what rolls down, puddles and bundles of letters
    const span = [s0 + quiet + 2, end - 4];
    const taken = [];
    const freeAt = (s, w) => taken.every(t => Math.abs(t - s) > w);
    const place = (w) => { for (let t = 0; t < 30; t++) { const s = lerp(span[0], span[1], R()); if (freeAt(s, w)) { taken.push(s); return s; } } return null; };
    const statics = st.statics + lap;
    for (let i = 0; i < statics; i++) {
      const s = place(2.6); if (s === null) continue;
      const kind = pick(["crate", "can", "wheelie"]);
      hazards.push({ kind, x: (R() * 2 - 1) * 0.85, s, r: kind === "crate" ? 0.32 : 0.28, moving: false });
    }
    for (let i = 0; i < st.carts + lap; i++) {
      const s = place(3.5); if (s === null) continue;
      const dir = R() < 0.5 ? -1 : 1;
      hazards.push({ kind: "cart", x: -dir * 1.95, s, dir, v: 1.0 + 0.6 * R() + 0.15 * lap, r: 0.42, moving: true, armed: false, wob: R() * 6 });
    }
    for (let i = 0; i < st.barrels + lap; i++) {
      const s = place(3.5); if (s === null) continue;
      hazards.push({ kind: "barrel", x: (R() * 2 - 1) * 0.8, s, v: 1.3 + 0.6 * R() + 0.15 * lap, r: 0.36, moving: true, armed: false, roll: 0 });
    }
    for (let i = 0; i < st.puddles; i++) {
      const s = place(1.6); if (s === null) continue;
      const v = Math.floor(R() * PUDDLES.length), P = PUDDLES[v];
      puddles.push({ v, x: (R() * 2 - 1) * (ROAD - (P.reach + 2) / PX), s, done: false });
    }
    for (let i = 0; i < st.bundles; i++) {
      const s = place(1.4); if (s === null) continue;
      pickups.push({ x: (R() * 2 - 1) * 0.85, s, done: false });
    }
    const S = { k, s0, end, st, plots: mine };
    streets.push(S);
    return S;
  }

  function streetAt(s) { for (let i = streets.length - 1; i >= 0; i--) if (s >= streets[i].s0) return streets[i]; return streets[0]; }

  function hud() {
    $("hellos").textContent = hellos + (hellos === 1 ? " HELLO" : " HELLOS");
    const L = $("letters"); L.textContent = "✉ " + letters; L.classList.toggle("low", letters <= 2);
    L.setAttribute("aria-label", "Letters in the satchel: " + letters);
    $("misses").textContent = "✿".repeat(petals) + "·".repeat(Math.max(0, PETALS - petals));
    $("misses").setAttribute("aria-label", "Slips left: " + petals + " of " + PETALS);
    $("best").textContent = "Most hellos " + best;
  }

  function reset(first = 0) {
    sD = 0; dx = tx = 0; keyDir = 0; paceKey = 0; touchPace = 0; endT = 0; streetK = 0; cleanStreet = true;
    streets = []; plots = []; props = []; hazards = []; pickups = []; puddles = []; lamps = [];
    hellosAir = []; litter = []; drops = []; leaves = []; sparks = []; pops = []; scraps = [];
    letters = SATCHEL; hellos = 0; petals = PETALS; throwT = 9; fallT = 9; lookT = 9; invT = 0; wind = 0; windT = 4; windGoal = 0;
    buildStreet(first, -2); streetK = first;
    pace = streetOf(first).pace;
    hud();
  }

  function start(first = 0) {
    audio.unlock();
    reset(typeof first === "number" ? first : 0);
    state = "play";
    $("ready").hidden = true; $("over").hidden = true;
    $("static").classList.remove("on");
    audio.rate(1);
    if (!saidStart) {
      saidStart = true;
      say("start", "Sprouted Doris delivers the hellos nobody sent.");
      setTimeout(() => { if (state === "play") title(streetK, true); }, 2700);
    } else title(streetK, true);
  }

  function say(k, text) {
    const sub = $("sub");
    sub.textContent = text;
    audio.line(k).then(d => setTimeout(() => { if (sub.textContent === text) sub.textContent = ""; }, Math.max(1800, d * 1000 + 300)));
  }

  // a street's name, on the screen and in the narrator's voice
  function title(k, voice) {
    const st = streetOf(k), lap = lapOf(k);
    const el = $("street");
    el.querySelector(".pr-street-name").textContent = st.name;
    el.querySelector(".pr-street-no").textContent = "STREET " + (k + 1) + (lap ? " · LATER" : "");
    el.hidden = false; el.classList.remove("in"); void el.offsetWidth; el.classList.add("in");
    titleT = 0;
    audio.street();
    if (voice) setTimeout(() => { if (state === "play") say(st.line, st.name + "."); }, 450);
  }

  function pop(x, y, text, col) { pops.push({ x, y, text, col, t: 0 }); }

  function slip(why) {
    if (state !== "play") return;
    petals -= 1; cleanStreet = false; ev("slip", { why });
    const el = $("misses"); el.classList.remove("hit"); void el.offsetWidth; el.classList.add("hit");
    if (why === "miss") { audio.miss(); if (!saidMiss && petals > 0) { saidMiss = true; say("miss", "Somebody went without."); } }
    hud();
    if (petals <= 0) { state = "stopped"; endT = 0; fallT = 0; audio.level("cart", 0); audio.level("barrel", 0); audio.level("wind", 0); }
  }

  function throwHello(side) {
    if (state !== "play" || fallT < FALL || lookT < LOOK || throwT < 0.16) return false;
    if (letters <= 0) { audio.empty(); const L = $("letters"); L.classList.remove("hit"); void L.offsetWidth; L.classList.add("hit"); return false; }
    letters -= 1; throwT = 0; throwSide = side;
    hellosAir.push({ side, x0: dx + side * 0.18, x: dx + side * 0.18, ds: 0, s: sD, t: 0 });
    audio.fwip();
    const b = document.querySelector('[data-side="' + side + '"]'); if (b) { b.classList.add("on"); setTimeout(() => b.classList.remove("on"), 120); }
    hud();
    return true;
  }

  // where a hello lands: the nearest place on its side, by how far along the street it is from the slot
  function resolve(h) {
    const st = streetAt(h.s).st, lap = lapOf(streetAt(h.s).k);
    let bestP = null, bd = 1e9;
    for (const p of plots) {
      if (p.side !== h.side || !p.has) continue;
      const d = Math.abs(h.s - p.slotS);
      if (d < bd) { bd = d; bestP = p; }
    }
    const k = st.win * Math.pow(0.9, lap);
    const sx = toX(h.side * LAND_X), sy = toY(h.s) - 24;
    if (bestP && bd <= BODY[bestP.kind] * k) {
      const p = bestP;
      if (p.status === "on" && !p.delivered) {
        const inSlot = bd <= SLOT * k;
        p.delivered = true; p.bloomT = 0;
        const add = inSlot ? 2 : 1;
        hellos += add;
        ev(inSlot ? "slot" : "body", { kind: p.kind, off: +(h.s - p.slotS).toFixed(2) });
        if (inSlot) { audio.clack(); pop(sx, sy, "+2 SLOT", "#ffe27a"); } else { audio.ping(); pop(sx, sy, "+1", "#e9ffd6"); }
        for (let i = 0; i < (inSlot ? 10 : 5); i++) sparks.push({ x: sx, y: sy, vx: (Math.random() - 0.5) * 70, vy: -20 - Math.random() * 50, t: 0, gold: inSlot });
        bumpHud();
        if (hellos > best) { best = hellos; store.set("best", best); }
        hud();
        return;
      }
      if (p.status === "busy") {
        ev("busy", { kind: p.kind }); p.flashT = 0; audio.grumble(); pop(sx, sy, "BUSY", "#ff8a7a");
        if (st.busy) slip("busy");
        return;
      }
      // nobody in, or they have theirs already: it drops at the foot of the place
      ev("wasted", { kind: p.kind, status: p.status, off: +(h.s - p.slotS).toFixed(2) });
      audio.thup(); litter.push({ x: h.side * (PLACE_X - 0.25), s: p.s + 0.1, t: 0 });
      return;
    }
    // nothing there: it flies on into the garden, or into the canal
    ev("nothing", { off: bestP ? +(h.s - bestP.slotS).toFixed(2) : null });
    if (st.water && h.side < 0) { audio.splash(); for (let i = 0; i < 6; i++) drops.push({ x: toX(-2.45) + (Math.random() - 0.5) * 8, s: h.s, z: 1, vx: (Math.random() - 0.5) * 50, vz: 40 + Math.random() * 50 }); return; }
    audio.thup(); litter.push({ x: h.side * 2.55, s: h.s, t: 0 });
  }

  function bumpHud() { const el = $("hellos"); el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump"); setTimeout(() => el.classList.remove("bump"), 160); }

  function fall() {
    fallT = 0; invT = FALL + GRACE; audio.bump();
    const lost = Math.min(2, letters); letters -= lost;
    for (let i = 0; i < lost + 2; i++) scraps.push({ x: toX(dx), y: DORIS_Y - 30, vx: (Math.random() - 0.5) * 90, vy: -60 - Math.random() * 40, t: 0, r: Math.random() * 6 });
    slip("fall");
    hud();
  }

  function end() {
    state = "over";
    window.rvBuzz?.("over");
    audio.level("cart", 0); audio.level("barrel", 0); audio.level("wind", 0);
    const reached = streetOf(streetK).name;
    if (streetK + 1 > bestStreet) { bestStreet = streetK + 1; store.set("street", bestStreet); }
    $("over-title").textContent = "The round is over.";
    $("over-line").textContent = hellos === 0 ? "Sprouted Doris delivered no hellos." : "Sprouted Doris delivered " + hellos + (hellos === 1 ? " hello." : " hellos.");
    $("over-stats").textContent = (hellos > 0 && hellos === best ? "The most she has delivered" : "Most hellos " + best) + " · as far as " + reached;
    hud();
    say("end", "Nobody sent them.");
    setTimeout(() => { if (state === "over") { $("over").hidden = false; $("again").focus({ preventScroll: true }); } }, 1500);
  }

  /* ---------- a frame of the world ---------- */
  function update(dt) {
    clock += dt; titleT += dt;
    for (const l of litter) l.t += dt;
    litter = litter.filter(l => l.t < 2.4);
    for (const d of drops) { d.x += d.vx * dt; d.z += d.vz * dt; d.vz -= 420 * dt; }
    drops = drops.filter(d => d.z > 0);
    for (const p of sparks) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 90 * dt; }
    sparks = sparks.filter(p => p.t < 0.7);
    for (const p of pops) { p.t += dt; p.y -= 22 * dt; }
    pops = pops.filter(p => p.t < 1.0);
    for (const p of scraps) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 160 * dt; p.vx *= 0.98; }
    scraps = scraps.filter(p => p.t < 1.2);
    weather(dt);
    if (titleT > 2.8) $("street").hidden = true;
    if (state === "stopped") { fallT += dt; endT += dt; if (endT > 1.6) end(); return; }
    if (state !== "play") return;
    throwT += dt; fallT += dt; lookT += dt; invT = Math.max(0, invT - dt);
    const S = streetAt(sD), st = S.st, lap = lapOf(S.k);
    // her pace: the street's, hurried or held back, never to a stop; nothing while she is down or looking
    const base = Math.min(2.9, st.pace + 0.22 * lap);
    const want = paceKey > 0 || touchPace > 0 ? base * 1.55 : paceKey < 0 || touchPace < 0 ? base * 0.55 : base;
    pace += (want - pace) * Math.min(1, dt * 3.5);
    const moving = fallT >= FALL && lookT >= LOOK;
    const v = moving ? pace : 0;
    sD += v * dt;
    if (v > 0) { stepAcc += dt * v; if (stepAcc > 0.42) { stepAcc = 0; audio.step(); } }
    if (moving) {
      if (keyDir) tx = clamp(tx + keyDir * 2.8 * dt, -ROAM, ROAM);
      const d = tx - dx; dx += Math.sign(d) * Math.min(Math.abs(d), 3.2 * dt);
    }
    // the next street is laid out before she gets there
    const last = streets[streets.length - 1];
    if (sD > last.end - 16) buildStreet(last.k + 1, last.end);
    // into a new street
    const now = streetAt(sD);
    if (now.k !== streetK) {
      if (cleanStreet && petals < PETALS) { petals += 1; say("clean", "Nobody went without."); pop(toX(0), DORIS_Y - 70, "✿ BACK", "#b8f58a"); }
      else if (cleanStreet) { say("clean", "Nobody went without."); }
      ev("street", { clean: cleanStreet, to: now.k }); streetK = now.k; cleanStreet = true;
      setTimeout(() => title(streetK, !cleanStreet || true), 700);
      audio.rate(Math.min(1.3, 1 + 0.04 * streetK));
      hud();
    }
    // hellos in the air keep her pace (and in the park the wind's)
    for (const h of hellosAir) {
      h.t += dt;
      h.x += h.side * THROW_V * dt;
      h.ds += wind * dt;
      h.s = sD + h.ds;
      if (Math.abs(h.x) >= LAND_X && !h.done) { h.done = true; resolve(h); }
    }
    hellosAir = hellosAir.filter(h => !h.done);
    // what moves on the road
    let cartNear = 0, barrelNear = 0;
    for (const o of hazards) {
      if (!o.moving || o.gone) continue;
      if (!o.armed && o.s - sD < (o.kind === "cart" ? 8.5 : 10.8)) o.armed = true;
      if (!o.armed) continue;
      if (o.kind === "cart") {
        o.x += o.dir * o.v * dt; o.wob += dt * 14;
        if (Math.abs(o.x) > 2.6) o.gone = true;
        cartNear = Math.max(cartNear, 1 - clamp(Math.abs(o.s - sD) / 9, 0, 1));
      } else {
        o.s -= o.v * dt; o.roll += o.v * dt;
        if (o.s < sD - 6) o.gone = true;
        barrelNear = Math.max(barrelNear, 1 - clamp(Math.abs(o.s - sD) / 10, 0, 1));
      }
    }
    audio.level("cart", 0.5 * cartNear); audio.level("barrel", 0.8 * barrelNear);
    // what she walks into
    if (fallT >= FALL && invT <= 0) {
      for (const o of hazards) {
        if (o.gone || (o.moving && !o.armed)) continue;
        if (Math.abs(o.x - dx) < o.r + 0.2 && Math.abs(o.s - sD) < o.r * 0.7 + 0.12) { ev("hit", { kind: o.kind }); fall(); break; }
      }
    }
    if (state !== "play") return;
    for (const b of pickups) {
      if (b.done) continue;
      if (Math.abs(b.x - dx) < 0.36 && Math.abs(b.s - sD) < 0.32) {
        b.done = true; ev("bundle"); const add = Math.min(BUNDLE, SATCHEL - letters); letters += add; audio.pickup();
        pop(toX(dx), DORIS_Y - 70, add ? "+" + add + " ✉" : "FULL", "#fbefb2"); hud();
      }
    }
    for (const o of puddles) {
      if (o.done || fallT < FALL) continue;
      const P = PUDDLES[o.v], i = P.cx + Math.round((dx - o.x) * PX), j = P.cy + Math.round((sD - o.s) * GY);
      if (i >= 0 && j >= 0 && i < P.w && j < P.h && P.touch[j * P.w + i]) {
        // a letter gets wet, and she stops to look into it, the way she used to
        o.done = true; lookT = 0; audio.splash(); o.hitT = clock; ev("puddle");
        let jj = j;
        while (jj < P.h && !P.m[jj * P.w + i]) jj++;
        o.hx = i - P.cx; o.hy = (jj < P.h ? jj + 1 : P.cy) - P.cy;
        for (let k = 0; k < 5; k++) drops.push({ x: toX(dx) + (Math.random() - 0.5) * 10, s: sD, z: 1, vx: (Math.random() - 0.5) * 90, vz: 45 + Math.random() * 40 });
        if (letters > 0) { letters -= 1; pop(toX(dx), DORIS_Y - 70, "WET ✉", "#a9d0ff"); }
        hud();
      }
    }
    // the places: a flower that opens or closes as she comes, and a place she has gone past without a hello
    const k = st.win * Math.pow(0.9, lap);
    for (const p of plots) {
      p.bloomT += dt; p.flashT += dt;
      if (p.flip !== null && !p.flipped && sD >= p.flip && !p.delivered) {
        p.flipped = true; p.bloomT = 0;
        if (p.status === "on") { p.status = "off"; audio.wilt(); } else { p.status = "on"; audio.bloom(); }
      }
      if (p.has && p.status === "on" && !p.delivered && !p.missed && p.slotS < sD - BODY[p.kind] * k - 0.08 &&
          !hellosAir.some(h => h.side === p.side)) {
        p.missed = true; slip("miss");
        if (state !== "play") return;
      }
    }
    // forget what is behind her
    const behind = sD - 8;
    plots = plots.filter(p => p.s > behind - 4);
    props = props.filter(p => p.s > behind - 4);
    hazards = hazards.filter(o => o.s > behind && !(o.gone && o.kind === "cart"));
    pickups = pickups.filter(o => o.s > behind);
    puddles = puddles.filter(o => o.s > behind);
    lamps = lamps.filter(o => o.s > behind - 6);
    streets = streets.filter((S, i) => i >= streets.length - 2 || S.end > behind);
  }

  // leaves on the air, rain, and the park's gusts
  function weather(dt) {
    const st = streets.length ? streetAt(sD).st : STREETS[0];
    if (st.wind && state === "play") {
      windT -= dt;
      if (windT <= 0) { windGoal = windGoal ? 0 : (Math.random() < 0.5 ? -1 : 1) * (0.9 + 0.7 * Math.random()); windT = windGoal ? 1.6 + Math.random() : 3 + 3 * Math.random(); }
    } else windGoal = 0;
    wind += (windGoal - wind) * Math.min(1, dt * 2);
    audio.level("wind", state === "play" ? 0.18 * Math.abs(wind) : 0);
    const rate = (st.leaves + 3 * Math.abs(wind)) * (reduce ? 0.3 : 1);
    if (Math.random() < rate * dt * 3) leaves.push({ x: Math.random() * W, y: -6 + Math.random() * 40, vx: (Math.random() - 0.5) * 12, vy: 10 + Math.random() * 14, t: 0, ph: Math.random() * 6, c: Math.floor(Math.random() * 4) });
    for (const l of leaves) {
      l.t += dt; l.ph += dt * 5;
      l.x += (l.vx + wind * GY * 0.0 + Math.sin(l.ph) * 8) * dt + wind * 26 * dt * 0;
      l.y += (l.vy - wind * GY * 0.9) * dt;
    }
    leaves = leaves.filter(l => l.y < H + 10 && l.y > -60 && l.x > -20 && l.x < W + 20 && l.t < 12);
  }

  /* ---------- drawing ---------- */
  function spr(name) { return SC.sprites[name]; }
  // a sprite stood with its foot (or a named point of it) on a screen point; the left verge's are the right's, turned
  function blit(name, px, py, mirror, by) {
    const s = SC.sprites[name];
    if (!s) return;
    let ax = s[4], ay = s[5];
    if (by && SC.points[name] && SC.points[name][by]) { ax = SC.points[name][by][0]; ay = SC.points[name][by][1]; }
    if (!mirror) g.drawImage(atlas, s[0], s[1], s[2], s[3], Math.round(px - ax), Math.round(py - ay), s[2], s[3]);
    else g.drawImage(flip, AW - s[0] - s[2], s[1], s[2], s[3], Math.round(px - (s[2] - ax)), Math.round(py - ay), s[2], s[3]);
  }
  // a point of a sprite, where it falls on the screen when the sprite's foot is at px, py
  function pointOf(name, key, px, py, mirror) {
    const s = SC.sprites[name], p = SC.points[name] && SC.points[name][key];
    if (!s || !p) return [px, py];
    const ox = p[0] - s[4], oy = p[1] - s[5];
    return [px + (mirror ? -ox : ox), py + oy];
  }
  function mirrorBlit(name, px, py) {
    const s = SC.sprites[name];
    if (!s) return;
    g.drawImage(sink, s[0], AH - s[1] - s[3], s[2], s[3], Math.round(px - s[4]), Math.round(py - (s[3] - s[5])), s[2], s[3]);
  }
  function shadow(px, py, rx, ry, a = 0.32) {
    g.fillStyle = "rgba(6,4,16," + a + ")"; g.beginPath(); g.ellipse(px, py, rx, ry, 0, 0, Math.PI * 2); g.fill();
  }

  function drawGround() {
    const gi = groundImg, T = SC.ground.h;
    const top = sD - DORIS_Y / GY, bot = sD + (H - DORIS_Y) / GY;
    for (let i = Math.floor(top / STRIP); i <= Math.floor(bot / STRIP); i++) {
      const s = i * STRIP, S = streetAt(s + 0.01);
      const tiles = SC.ground.streets[S.st.ground];
      const b = ((i * 2654435761) >>> 0) % 7 < 2 ? 1 : 0;
      const [u, v] = tiles[b];
      g.drawImage(gi, u, v, SC.ground.w, T, 0, Math.round(toY(s)), SC.ground.w, T);
    }
  }

  function drawPuddle(o) {
    const P = PUDDLES[o.v], sy = Math.round(toY(o.s)), x0 = Math.round(toX(o.x)) - P.cx, y0 = sy - P.cy;
    if (sy < -30 || sy > H + 30) return;
    g.drawImage(P.under, x0, y0);
    g.save();
    g.translate(x0, y0); g.clip(P.path); g.translate(-x0, -y0);
    g.globalAlpha = 0.55;
    for (const q of hazards) if (!q.moving && Math.abs(q.s - o.s) < 1.5) mirrorBlit(q.kind, toX(q.x), toY(q.s));
    if (Math.abs(sD - o.s) < 2.2) mirrorBlit(res.pose, toX(dx), DORIS_Y);
    for (const L of lamps) if (Math.abs(L.s - o.s) < 2.5) {
      const [bx] = pointOf("lamp", "bulb", toX(L.x), toY(L.s), L.side < 0);
      g.globalAlpha = 0.8; g.fillStyle = "#ffe2a8"; g.fillRect(Math.round(bx) - 1, sy - 2, 3, 2); g.globalAlpha = 0.55;
    }
    g.globalAlpha = 1;
    if (o.hitT !== undefined) for (let k = 0; k < 2; k++) { const u = (clock - o.hitT - k * 0.22) / 0.8; if (u > 0 && u < 1) ring(toX(o.x) + o.hx, sy + o.hy, 2 + u * P.rx, 0.75 * (1 - u)); }
    if (streetAt(o.s).st.rain) for (let k = 0; k < 2; k++) { const u = ((clock * 0.9 + o.s * 0.37 + k * 0.5) % 1); ring(toX(o.x) + ((o.s * 37 + k * 13) % (P.rx * 1.2)) - P.rx * 0.6, sy, 1 + u * 5, 0.5 * (1 - u)); }
    g.restore();
    g.drawImage(P.over, x0, y0);
  }
  function ring(cx, cy, r, a) {
    g.fillStyle = "rgba(214,228,242," + a.toFixed(2) + ")";
    const seen = new Set(), n = Math.ceil(r * 7);
    for (let k = 0; k < n; k++) {
      const th = (k / n) * 6.283, px = Math.round(cx + r * Math.cos(th)), py = Math.round(cy + r * 0.55 * Math.sin(th)), key = px * 4096 + py + 1024;
      if (!seen.has(key)) { seen.add(key); g.fillRect(px, py, 1, 1); }
    }
  }

  // the flowers over the places: the messenger's, green for in, grey for out, red for busy; an envelope once a hello is there
  const FLOWER = [".GG.GG.", "GGG.GGG", "GGYYYGG", "..YYY..", "GGYYYGG", "GGG.GGG", ".GG.GG."];
  const LETTER = ["WWWWWWW", "WDWWWDW", "WWDWDWW", "WWWDWWW", "WWWWWWW"];
  const ON = { G: "#6fd84b", Y: "#ffd46b" }, AWAY = { G: "#7c818c", Y: "#4d515a" }, BUSY = { G: "#e2503f", Y: "#ffd46b" }, WILT = { G: "#7a5a3a", Y: "#4a3a2a" }, MAIL = { W: "#f5f1e6", D: "#8a7f6a" };
  function icon(rows, cx, cy, pal, k = 2) {
    const w = rows[0].length * k, h = rows.length * k, x0 = Math.round(cx - w / 2), y0 = Math.round(cy - h / 2);
    g.fillStyle = "rgba(0,0,0,.6)";
    for (let j = 0; j < rows.length; j++) for (let i = 0; i < rows[0].length; i++) if (rows[j][i] !== ".") g.fillRect(x0 + i * k + 1, y0 + j * k + 1, k, k);
    for (let j = 0; j < rows.length; j++) for (let i = 0; i < rows[0].length; i++) { const c = pal[rows[j][i]]; if (c) { g.fillStyle = c; g.fillRect(x0 + i * k, y0 + j * k, k, k); } }
  }

  const LEAF = ["#b8622a", "#d9963a", "#8e3b22", "#a8973e"];
  const flight = h => clamp((h.side * h.x - h.side * h.x0) / (LAND_X - h.side * h.x0), 0, 1);
  function draw() {
    const S = streetAt(sD), st = S.st;
    drawGround();
    // what lies flat: the paths, then the puddles
    for (const p of props) if (p.flat) { const y = toY(p.s); if (y > -40 && y < H + 40) blit("path", toX(p.x), y, p.mirror); }
    for (const o of puddles) drawPuddle(o);
    // shadows under what stands
    for (const p of plots) if (p.has) { const y = toY(p.s); if (y > -20 && y < H + 20) shadow(toX(p.side * PLACE_X), y, 12, 4, 0.3); }
    for (const o of hazards) { if (o.gone) continue; const y = toY(o.s); if (y > -20 && y < H + 20) shadow(toX(o.x), y + 1, o.kind === "cart" ? 16 : 11, 4); }
    for (const b of pickups) if (!b.done) shadow(toX(b.x), toY(b.s) + 1, 7, 2.5, 0.3);
    if (state !== "over" || true) shadow(toX(dx), DORIS_Y + 1, 12, 4, 0.36);
    // the tall things first - trees and lamps reach high over the road, and she is never lost behind one
    const back = [];
    for (const p of props) if (!p.flat && p.kind.startsWith("tree")) back.push({ s: p.s, d: () => blit(p.kind, toX(p.x), toY(p.s), p.mirror, p.by) });
    for (const L of lamps) back.push({ s: L.s, d: () => blit("lamp", toX(L.x), toY(L.s), L.side < 0, "foot") });
    back.sort((a, b) => a.s - b.s);
    for (const o of back) { const y = toY(o.s); if (y > -40 && y < H + 330) o.d(); }
    // then everything else that stands, back to front
    const list = [];
    for (const p of plots) if (p.has) list.push({ s: p.s, d: () => blit("place_" + p.kind, toX(p.side * PLACE_X), toY(p.s), p.side < 0) });
    for (const p of props) if (!p.flat && !p.kind.startsWith("tree")) list.push({ s: p.s, d: () => blit(p.kind, toX(p.x), toY(p.s), p.mirror, p.by) });
    for (const o of hazards) {
      if (o.gone || (o.moving && !o.armed && o.kind === "cart")) continue;
      list.push({ s: o.s, d: () => {
        if (o.kind === "cart") blit("cart", toX(o.x), toY(o.s) - (Math.sin(o.wob) > 0.6 ? 1 : 0), o.dir < 0);
        else if (o.kind === "barrel") blit("barrel_" + (Math.floor(o.roll * 4) % 3), toX(o.x), toY(o.s), false);
        else blit(o.kind, toX(o.x), toY(o.s), false);
      } });
    }
    for (const b of pickups) if (!b.done) list.push({ s: b.s, d: () => blit("bundle", toX(b.x), toY(b.s) - (Math.floor(clock * 3) % 2), false) });
    list.push({ s: sD + 0.001, d: () => { if (!(invT > 0 && fallT >= FALL && Math.floor(clock * 12) % 2)) blit(res.pose, toX(dx), DORIS_Y, false); } });
    list.sort((a, b) => a.s - b.s);
    for (const o of list) { const y = toY(o.s); if (y > -60 && y < H + 330) o.d(); }
    // hellos dropped on the grass, and in the air
    for (const l of litter) {
      g.globalAlpha = Math.max(0, 1 - l.t / 2.4); g.fillStyle = "#f5f1e6";
      g.fillRect(Math.round(toX(l.x) - 3), Math.round(toY(l.s) - 2), 6, 3); g.globalAlpha = 1;
    }
    for (const h of hellosAir) {
      const u = flight(h), z = lerp(0.95, 0.8, u) + 0.55 * Math.sin(Math.PI * u);
      const px = toX(h.x), gy = toY(h.s), py = gy - z * HY;
      shadow(px, gy, 4, 1.5, 0.35);
      g.fillStyle = "#f5f1e6"; g.fillRect(Math.round(px - 3), Math.round(py - 2), 6, 4);
      g.fillStyle = "#8a7f6a"; g.fillRect(Math.round(px - 2), Math.round(py - 1), 1, 1); g.fillRect(Math.round(px + 1), Math.round(py - 1), 1, 1); g.fillRect(Math.round(px - 1), Math.round(py), 2, 1);
    }
    for (const d of drops) { g.fillStyle = "#d6e4f2"; g.fillRect(Math.round(d.x), Math.round(toY(d.s) - d.z), 1, 2); }
    for (const p of scraps) { g.globalAlpha = Math.max(0, 1 - p.t / 1.2); g.fillStyle = "#f5f1e6"; g.fillRect(Math.round(p.x - 2), Math.round(p.y - 1), 5, 3); g.globalAlpha = 1; }
    // the night over all of it
    night(st);
    // the flowers stay the colour they are
    for (const p of plots) {
      if (!p.has) continue;
      const y = toY(p.s); if (y < -30 || y > H + 60) continue;
      const name = "place_" + p.kind, [tx2, ty2] = pointOf(name, "top", toX(p.side * PLACE_X), y, p.side < 0);
      const bob = p.status === "on" && !p.delivered && !p.missed && Math.floor(clock * 3 + p.s) % 2 ? -1 : 0;
      const grow = p.bloomT < 0.25 ? 1 + 0.6 * Math.sin(p.bloomT / 0.25 * Math.PI) : 1;
      const iy = Math.min(ty2, y - 26) - 12 + bob;
      if (p.delivered) icon(LETTER, tx2, iy, MAIL);
      else icon(FLOWER, tx2, iy, p.missed ? WILT : p.status === "on" ? ON : p.status === "busy" ? (p.flashT < 0.6 && Math.floor(clock * 10) % 2 ? MAIL : BUSY) : AWAY, grow > 1.2 ? 3 : 2);
    }
    for (const p of sparks) { g.fillStyle = p.gold ? "#ffe27a" : "#e9ffd6"; g.fillRect(Math.round(p.x), Math.round(p.y), 1 + (p.t < 0.2 ? 1 : 0), 1 + (p.t < 0.2 ? 1 : 0)); }
    g.font = "16px VT323, monospace"; g.textAlign = "center";
    for (const p of pops) {
      g.globalAlpha = Math.max(0, 1 - p.t); g.fillStyle = "#000"; g.fillText(p.text, Math.round(p.x) + 1, Math.round(p.y) + 1);
      g.fillStyle = p.col; g.fillText(p.text, Math.round(p.x), Math.round(p.y)); g.globalAlpha = 1;
    }
  }

  // the street's night: its colour multiplied over everything, the lamps added back, then fog and rain
  function night(st) {
    const tint = st.tint;
    g.globalCompositeOperation = "multiply";
    g.fillStyle = "rgb(" + tint.join(",") + ")"; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = "lighter";
    // the far end of the street, behind her, still has a little of the sky in it
    const sky = g.createLinearGradient(0, 0, 0, 120);
    sky.addColorStop(0, "rgba(" + st.sky.join(",") + ",0.22)"); sky.addColorStop(1, "rgba(" + st.sky.join(",") + ",0)");
    g.fillStyle = sky; g.fillRect(0, 0, W, 120);
    for (const L of lamps) {
      const y = toY(L.s); if (y < -120 || y > H + 80) continue;
      const [bx, by] = pointOf("lamp", "bulb", toX(L.x), y, L.side < 0);
      const flick = st.id === "rothill" && Math.sin(clock * 23 + L.phase) > 0.93 ? 0.4 : 1;
      g.globalAlpha = 0.55 * flick; g.drawImage(GLOW.pool[st.id], Math.round(bx - 66), Math.round(y - 30));
      g.globalAlpha = 0.9 * flick; g.drawImage(GLOW.bulb[st.id], Math.round(bx - 9), Math.round(by - 6));
      g.globalAlpha = 1;
      // a moth or two at the light
      if (!reduce) for (let k = 0; k < 2; k++) {
        const a = clock * (3.1 + k) + L.phase * (k + 1), mx = bx + Math.cos(a) * (5 + 3 * k), my = by + 3 + Math.sin(a * 1.7) * (3 + k);
        g.fillStyle = "rgba(255,240,200,.8)"; g.fillRect(Math.round(mx), Math.round(my), 1, 1);
      }
    }
    // a place with someone in shows a warm light at its slot; somebody busy, a red one
    for (const p of plots) {
      if (!p.has || p.delivered || p.missed || p.status === "off") continue;
      const y = toY(p.s); if (y < -30 || y > H + 40) continue;
      const [sx, sy] = pointOf("place_" + p.kind, "slot", toX(p.side * PLACE_X), y, p.side < 0);
      const pulse = 0.55 + 0.25 * Math.sin(clock * 4 + p.s);
      g.globalAlpha = pulse; g.drawImage(p.status === "busy" ? GLOW.red : GLOW.slot, Math.round(sx - 8), Math.round(sy - 8)); g.globalAlpha = 1;
    }
    for (const h of hellosAir) {
      const u = flight(h), z = lerp(0.95, 0.8, u) + 0.55 * Math.sin(Math.PI * u);
      g.globalAlpha = 0.6; g.drawImage(GLOW.slot, Math.round(toX(h.x) - 8), Math.round(toY(h.s) - z * HY - 8)); g.globalAlpha = 1;
    }
    for (const p of sparks) { g.globalAlpha = 0.5 * (1 - p.t / 0.7); g.drawImage(GLOW.spark, Math.round(p.x - 4), Math.round(p.y - 4)); g.globalAlpha = 1; }
    g.globalCompositeOperation = "source-over";
    // leaves, on top of the night so they catch the light
    for (const l of leaves) {
      g.fillStyle = LEAF[l.c]; const w2 = Math.abs(Math.sin(l.ph)) > 0.5 ? 2 : 1;
      g.fillRect(Math.round(l.x), Math.round(l.y), w2, 1 + (w2 === 1 ? 1 : 0));
    }
    // fog ahead of her, thicker on the canal
    if (st.fog) {
      const f = g.createLinearGradient(0, H * 0.45, 0, H);
      const fc = st.id === "canal" ? "150,176,186" : "120,120,160";
      f.addColorStop(0, "rgba(" + fc + ",0)"); f.addColorStop(1, "rgba(" + fc + "," + st.fog + ")");
      g.fillStyle = f; g.fillRect(0, H * 0.45, W, H * 0.55);
      if (st.id === "canal" && !reduce) {
        g.fillStyle = "rgba(170,196,204,0.06)";
        for (let k = 0; k < 4; k++) { const y = ((clock * 9 + k * 120) % (H + 80)) - 40; g.fillRect(0, Math.round(y), W, 22); }
      }
    }
    if (st.rain && !reduce) {
      g.fillStyle = "rgba(190,210,240,.45)";
      for (let k = 0; k < 70; k++) {
        const x = (k * 97 + Math.floor(clock * 40) * 13) % (W + 30) - 15, y = ((k * 53 + clock * 420) % (H + 20)) - 10;
        g.fillRect(Math.round(x - ((y / 4) | 0) % 2), Math.round(y), 1, 5);
      }
    }
    const band = g.createLinearGradient(0, 0, 0, 64);
    band.addColorStop(0, "rgba(6,4,18,.45)"); band.addColorStop(1, "rgba(6,4,18,0)");
    g.fillStyle = band; g.fillRect(0, 0, W, 64);
    // the corners of the set go dark
    const vg = g.createRadialGradient(W / 2, H * 0.45, H * 0.32, W / 2, H * 0.45, H * 0.72);
    vg.addColorStop(0, "rgba(6,4,18,0)"); vg.addColorStop(1, "rgba(6,4,18,.55)");
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
  }

  // what Doris is drawn at: sampled 15 times a second
  const res = { pose: "doris_stand", acc: 0, walk: 0 };
  const FALL_SEQ = [0, 1, 2, 3, 3, 3, 3, 4, 5, 6, 7, 7];
  function sample(dt) {
    res.acc += dt;
    if (res.acc < RESIDENT_STEP && !reduce) return;
    res.acc = reduce ? 0 : res.acc % RESIDENT_STEP;
    if (state === "stopped") { res.pose = "doris_fall_" + Math.min(3, Math.floor(fallT * 15)); return; }
    if (state !== "play") { if (state !== "pause") res.pose = "doris_stand"; return; }
    if (fallT < FALL) { res.pose = "doris_fall_" + FALL_SEQ[Math.min(FALL_SEQ.length - 1, Math.floor(fallT * 15))]; return; }
    if (lookT < LOOK) { res.pose = "doris_look"; return; }
    if (throwT < 0.27) { const f = Math.floor(throwT * 15); res.pose = "doris_throw_" + (throwSide < 0 ? "l" : "r") + "_" + (f < 2 ? 1 : 2); return; }
    // her walk: the kept take's twelve drawings, stepped on as fast as her pace wants, at most four at a time
    const k = clamp(Math.round(pace * GY / 16.75), 1, 4);
    res.walk = (res.walk + k) % 12;
    res.pose = "doris_walk_" + res.walk;
  }

  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.max(0, Math.min(0.1, (now - last) / 1000));
    last = now;
    if (!ready) return;
    if (state !== "pause") update(dt);
    sample(dt);
    draw();
  }

  /* ---------- input: drag to steer, ◀ and ▶ throw; on a keyboard the arrows steer and set her pace ---------- */
  const screen = $("screen");
  let press = null;
  const toCanvas = e => { const b = cv.getBoundingClientRect(); return [(e.clientX - b.left) * W / b.width, (e.clientY - b.top) * H / b.height]; };
  function steerTo(px, py) {
    tx = clamp((px - CX) / PX, -ROAM, ROAM);
    // a finger well below her hurries her, one above her holds her back
    touchPace = py > DORIS_Y + 170 ? 1 : py < DORIS_Y - 10 ? -1 : 0;
  }
  screen.addEventListener("pointerdown", e => {
    if (e.target.closest("button, a")) return;
    if (state === "pause") { pause(false); return; }
    if (state !== "play") return;
    e.preventDefault();
    press = { id: e.pointerId };
    try { screen.setPointerCapture(e.pointerId); } catch (err) { /* not capturable */ }
    steerTo(...toCanvas(e));
  });
  screen.addEventListener("pointermove", e => { if (press && e.pointerId === press.id && state === "play") steerTo(...toCanvas(e)); });
  const up = e => { if (press && e.pointerId === press.id) { press = null; touchPace = 0; } };
  screen.addEventListener("pointerup", up);
  screen.addEventListener("pointercancel", up);
  for (const b of document.querySelectorAll("#pad [data-side]")) {
    b.addEventListener("pointerdown", e => { e.preventDefault(); if (state === "pause") pause(false); else throwHello(+b.dataset.side); });
  }
  const LEFT = new Set(["ArrowLeft", "KeyA"]), RIGHT = new Set(["ArrowRight", "KeyD"]);
  const HURRY = new Set(["ArrowDown", "KeyS"]), HOLD = new Set(["ArrowUp", "KeyW"]);
  const held = new Set();
  const keysNow = () => {
    keyDir = [...held].some(c => RIGHT.has(c)) - [...held].some(c => LEFT.has(c));
    paceKey = [...held].some(c => HURRY.has(c)) - [...held].some(c => HOLD.has(c));
    if (keyDir) tx = clamp(dx, -ROAM, ROAM);
  };
  addEventListener("keydown", e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const el = e.target instanceof Element ? e.target : null;
    if (el && el !== document.body && el.closest("button") && (e.code === "Space" || e.code === "Enter")) return;
    const k = e.code;
    if (LEFT.has(k) || RIGHT.has(k) || HURRY.has(k) || HOLD.has(k)) {
      e.preventDefault(); if (state === "pause") { pause(false); return; }
      held.add(k); keysNow();
    } else if (k === "KeyZ" || k === "KeyJ" || k === "Comma") {
      e.preventDefault(); if (state === "play" && !e.repeat) throwHello(-1); else if (state === "pause") pause(false);
    } else if (k === "KeyX" || k === "KeyK" || k === "Period") {
      e.preventDefault(); if (state === "play" && !e.repeat) throwHello(1); else if (state === "pause") pause(false);
    } else if (k === "Space" || k === "Enter") {
      if (state === "ready" || (state === "over" && !$("over").hidden)) { e.preventDefault(); start(); }
      else if (state === "pause") { e.preventDefault(); pause(false); }
    } else if (k === "KeyP" || k === "Escape") {
      if (state === "play") pause(true); else if (state === "pause") pause(false);
    }
  });
  addEventListener("keyup", e => { held.delete(e.code); keysNow(); });
  addEventListener("blur", () => { held.clear(); keysNow(); press = null; touchPace = 0; });

  function pause(on) {
    if (on && state === "play") {
      state = "pause"; held.clear(); keysNow();
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
    const where = streetOf(streetK).name;
    const text = hellos === 0 ? "Sprouted Doris delivered no hellos on rotville.world. Nobody sent them."
      : "Sprouted Doris delivered " + hellos + (hellos === 1 ? " hello" : " hellos") + " as far as " + where + " on rotville.world. Nobody sent them.";
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

  // a bot can read the street through this, on a page opened with #debug; it changes nothing it is not asked to
  if (location.hash === "#debug") {
    window.__pr = {
      get: () => ({ state, sD, dx, pace, letters, hellos, petals, streetK, wind, fallT, lookT,
                    plots: plots.map(p => ({ side: p.side, s: p.s, slotS: p.slotS, kind: p.kind, status: p.status, has: p.has, delivered: p.delivered, missed: p.missed, win: BODY[p.kind] * streetAt(p.s).st.win * Math.pow(0.9, lapOf(streetAt(p.s).k)) })),
                    hazards: hazards.filter(o => !o.gone).map(o => ({ kind: o.kind, x: o.x, s: o.s, r: o.r, moving: o.moving, armed: o.armed, v: o.v || 0, dir: o.dir || 0 })),
                    pickups: pickups.filter(b => !b.done).map(b => ({ x: b.x, s: b.s })),
                    puddles: puddles.filter(o => !o.done).map(o => ({ x: o.x, s: o.s, r: PUDDLES[o.v].rx / PX })) }),
      log: LOG, throw: throwHello, steer: x => { tx = clamp(x, -ROAM, ROAM); }, pace: p => { paceKey = p; }, start,
    };
  }

  Promise.all([fetch("assets/scene.json").then(r => r.json()), load("assets/sprites.png"), load("assets/ground.webp")])
    .then(([s, a, gimg]) => {
      SC = s; atlas = a; groundImg = gimg; AW = a.width;
      // the left verge's places are the right verge's, turned the other way
      const [fc, fx] = off(a.width, a.height); fx.translate(a.width, 0); fx.scale(-1, 1); fx.drawImage(a, 0, 0); flip = fc;
      // and upside down, darkened toward the water's colour, for what shows in the puddles
      const [kc, kx] = off(a.width, a.height); kx.translate(0, a.height); kx.scale(1, -1); kx.drawImage(a, 0, 0);
      kx.setTransform(1, 0, 0, 1, 0, 0); kx.globalCompositeOperation = "source-atop"; kx.fillStyle = "rgba(22,34,56,.5)"; kx.fillRect(0, 0, a.width, a.height);
      sink = kc; AH = a.height;
      GLOW.pool = {}; GLOW.bulb = {};
      for (const st of STREETS) { GLOW.pool[st.id] = makeGlow(66, 30, st.pool, 1.3, 6); GLOW.bulb[st.id] = makeGlow(9, 6, st.pool.map(c => Math.min(255, c + 30)), 1.0, 4); }
      GLOW.slot = makeGlow(8, 8, [255, 214, 140], 1.4, 4);
      GLOW.red = makeGlow(8, 8, [255, 90, 70], 1.4, 4);
      GLOW.spark = makeGlow(4, 4, [255, 240, 190], 1.2, 3);
      reset(); ready = true;
    })
    .catch(() => { $("sub").textContent = "The tape would not load. Try the page again."; });
  requestAnimationFrame(frame);
})();
