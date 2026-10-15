/* Errand: Clangus walks to the shop, slowly enough.

   CLANGUS (LORE) is a tarnished brass handbell with a solemn face, thin arms, heavy boots, and a clapper that hangs
   below his rim. He no longer has a post, but a hurried step still sends the clapper against the brass. People come
   to their doors expecting bad news. They find him halfway down the street, trying to walk slowly enough to finish an
   ordinary errand. The user picked it from the open list on 2026-10-11: "Yo, I would like to try Errand game".

   An egg-and-spoon race with a bell. Hold WALK and he walks, let go and he slows to a stop, STOP stops him short.
   His clapper is a pendulum inside the bell: it swings back as he speeds up and forward as he slows, every heavy step
   knocks it a little, harder the faster he goes, and cobbles, kerbs, puddles and the wind knock it too. If it reaches
   the rim it rings: the doors along the street open with the light behind them, windows light up and people look out,
   and three rings bring everyone out. An errand is a street of town houses with the shop at the far end, and the
   candle in its window burns down while he walks; if it goes out first the shop has shut. A quiet errand, with no
   ring in it, gives a ring back. Five errands, each its own street, then the five again with a shorter swing to the
   rim and a shorter candle; the very first errand is half a street long.

   His walk is his kept take (library/characters/handbell/anim/walk.blend) at 15 fps, side on and turned a little to
   us so his face shows; his modelled clapper is taken out of it and drawn here, where it can swing. The houses are
   the library's town houses (py-building) rendered from the game's camera; every window's opening was marked by hand
   and its light is drawn into it. The lamps are the library's crook street lamp (ps-street-lamp). Only the
   pre-rendered sprites, the houses, the light pieces and four ground strips ship. */
(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  const W = 270, H = 480;
  const cv = $("c"), G0 = cv.getContext("2d");
  let g = G0;                                  // the context drawn on: the screen, or the street's actors
  g.imageSmoothingEnabled = false;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k === "sound" ? "rotville.sound" : "errand." + k) ?? (k === "sound" ? localStorage.getItem("errand.sound") : null); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k === "sound" ? "rotville.sound" : "errand." + k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
  };
  const load = src => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });
  const off = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d"); x.imageSmoothingEnabled = false; return [c, x]; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const seeded = a => () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  /* ---------- the street, side on: x along it in metres, the camera 12 degrees down ---------- */
  const PPM = 72;                              // pixels to a metre along the street
  const DEPTH = 72 * Math.sin(Math.PI / 15);   // ...and to a metre of depth, toward the houses
  const CLX = 78;                              // where he walks on the screen
  const FACADE_Y = 404, WALK_Y = 421, KERB_Y = 437;
  const RESIDENT_STEP = 1 / 15;
  let xC = 0;                                  // where he is
  const toX = x => CLX + (x - xC) * PPM;

  /* ---------- the clapper: a pendulum in the bell ---------- */
  const GRAV = 9.81, LEN = 0.48, DAMP = 0.5, KNOCK = 0.4, STEP = 0.36;
  const A_WALK = 0.75, A_COAST = 1.0, A_STOP = 2.4, V_MAX = 1.6;
  const RINGS = 3;

  /* ---------- the errands: a street each, the shop at its end ---------- */
  const ERRANDS = [
    { item: "A loaf", far: "#7a6e98", mid: "#5c5278", shop: "BAKER", where: "the Bakery District", len: 24, rim: 0.42, pace: 0.55,
      sides: 1, cobbles: 0, puddles: 0, carts: 0, wind: 0, rain: 0, sign: "loaf", first: { len: 12, sides: 0 },
      tint: [222, 196, 214], sky: ["#2c2050", "#a8607a"], lamp: [255, 196, 120] },
    { item: "A stamp", far: "#6e6890", mid: "#504a70", shop: "POST", where: "Mailbox Promenade", len: 30, rim: 0.40, pace: 0.6,
      sides: 2, cobbles: 1, puddles: 1, carts: 0, wind: 0, rain: 0, sign: "stamp",
      tint: [196, 180, 216], sky: ["#211a46", "#7a5a8e"], lamp: [255, 200, 130] },
    { item: "Milk", far: "#625e84", mid: "#46425f", shop: "DAIRY", where: "Rothill", len: 34, rim: 0.38, pace: 0.64,
      sides: 2, cobbles: 1, puddles: 2, carts: 1, wind: 0, rain: 1, sign: "milk",
      tint: [176, 166, 196], sky: ["#1a1838", "#4c4a78"], lamp: [255, 184, 110] },
    { item: "A nail", far: "#5a6a86", mid: "#3e4a62", shop: "IRONMONGER", where: "the Canal District", len: 38, rim: 0.37, pace: 0.67,
      sides: 2, cobbles: 1, puddles: 2, carts: 1, wind: 1, rain: 0, sign: "nail",
      tint: [150, 168, 190], sky: ["#121a30", "#2e4c66"], lamp: [210, 236, 200] },
    { item: "Matches", far: "#545680", mid: "#3a3c5e", shop: "CHANDLER", where: "Rotville Town Centre", len: 42, rim: 0.36, pace: 0.7,
      sides: 3, cobbles: 2, puddles: 2, carts: 2, wind: 1, rain: 0, sign: "match",
      tint: [140, 140, 190], sky: ["#0e0e26", "#28285a"], lamp: [255, 214, 150] },
  ];
  // a street's numbers: each round after the first a longer street, a narrower swing and a quicker candle. The first
  // errand of a game is half of itself: half the street, too short for its side street (first); round again, it is whole
  const tuneOf = (E, lap) => {
    const T = { len: E.len + 4 * lap, rim: E.rim * Math.pow(0.93, lap), pace: E.pace + 0.05 * lap, slack: lap ? 6 : 8, sides: E.sides };
    return lap === 0 && E.first ? Object.assign(T, E.first) : T;
  };
  const errandOf = k => ERRANDS[k % ERRANDS.length];
  const lapOf = k => Math.floor(k / ERRANDS.length);

  /* ---------- sound: the bed, the narrator, the bell and the rest made on the spot ---------- */
  const LINES = [["start", "line-start"], ["only", "line-only"], ["there", "line-there"], ["quiet", "line-quiet"],
                 ["shut", "line-shut"], ["end", "line-end"]];
  const audio = {
    ctx: null, on: store.get("sound", true), raw: {}, buf: {}, music: null, loops: {},
    fetch() {
      for (const [k, f] of LINES) this.raw[k] = fetch("assets/" + f + ".mp3").then(r => (r.ok ? r.arrayBuffer() : null)).catch(() => null);
      this.raw.music = fetch("assets/whistle-walk.mp3").then(r => (r.ok ? r.arrayBuffer() : null)).catch(() => null);
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
      this.mus = c.createGain(); this.mus.gain.value = 0.26; this.mus.connect(this.master);
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
      });
      // the bell humming as the clapper nears the brass, and the wind
      const hum = c.createOscillator(), hg = c.createGain(); hum.type = "sine"; hum.frequency.value = 523; hg.gain.value = 0;
      hum.connect(hg).connect(this.fxg); hum.start(); this.hum = hg; this.humOsc = hum;
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
    level(name, v) { const o = this.loops[name]; if (o) o.gain.setTargetAtTime(v, this.ctx.currentTime, 0.1); },
    humAt(v) { if (this.hum) { this.hum.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05); this.humOsc.frequency.setTargetAtTime(523 + 160 * v / 0.06, this.ctx.currentTime, 0.05); } },
    set(on) { this.on = on; store.set("sound", on); if (this.master) this.master.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.04); },
    line(k) {
      if (!this.ctx || !this.buf[k]) return Promise.resolve(0);
      return this.buf[k].then(b => {
        if (!b) return 0;
        const s = this.ctx.createBufferSource(); s.buffer = b; s.connect(this.vox); s.start();
        return b.duration;
      });
    },
    tone(f0, f1, dur, type = "sine", vol = 0.12, when = 0) {
      if (!this.ctx) return;
      const c = this.ctx, t = c.currentTime + when, o = c.createOscillator(), e = c.createGain();
      o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
      e.gain.setValueAtTime(0.0008, t); e.gain.exponentialRampToValueAtTime(vol, t + 0.006); e.gain.exponentialRampToValueAtTime(0.0008, t + dur);
      o.connect(e).connect(this.fxg); o.start(t); o.stop(t + dur + 0.03);
    },
    noise(dur, vol, lo, hi, when = 0) {
      if (!this.ctx) return;
      const c = this.ctx, t = c.currentTime + when, s = c.createBufferSource(), a = c.createBiquadFilter(), b = c.createBiquadFilter(), e = c.createGain();
      s.buffer = this.noiseBuf; s.loop = true; a.type = "highpass"; a.frequency.value = lo; b.type = "lowpass"; b.frequency.value = hi;
      e.gain.setValueAtTime(vol, t); e.gain.exponentialRampToValueAtTime(0.0008, t + dur);
      s.connect(a).connect(b).connect(e).connect(this.fxg); s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.03);
    },
    // a bell struck: a handful of partials a little out of tune with each other, the low ones lasting longest
    ring(f = 392, vol = 0.3) {
      for (const [r, a, d] of [[0.5, 0.35, 3.2], [1, 1, 2.6], [1.19, 0.45, 2.0], [1.5, 0.32, 1.7], [2.0, 0.5, 1.4], [2.52, 0.24, 1.0], [3.01, 0.16, 0.7], [4.16, 0.1, 0.45]]) {
        this.tone(f * r, f * r * 0.998, d, "sine", vol * a);
      }
      this.noise(0.05, vol * 0.5, 2500, 9000);
    },
    clang() { this.ring(392, 0.34); },
    tink() { this.tone(1568, 1560, 0.35, "sine", 0.06); this.tone(2350, 2340, 0.2, "sine", 0.03); },
    step(v) { this.tone(95, 60, 0.07, "sine", 0.05 + 0.05 * Math.min(1, v)); this.noise(0.03, 0.02, 200, 900); },
    creak() { this.tone(180, 240, 0.35, "sawtooth", 0.015); this.noise(0.4, 0.02, 300, 1400); },
    shopbell() { this.tone(1975, 1970, 0.6, "sine", 0.08); this.tone(2637, 2630, 0.4, "sine", 0.05, 0.02); this.tone(1975, 1970, 0.5, "sine", 0.06, 0.18); },
    splash() { this.noise(0.35, 0.12, 300, 2600); this.tone(420, 200, 0.2, "sine", 0.05); },
    thud() { this.tone(110, 50, 0.25, "sine", 0.25); this.noise(0.2, 0.06, 600, 3000); },
    puff() { this.noise(0.25, 0.06, 800, 3000); },
    errand() { [523, 659, 784].forEach((f, i) => this.tone(f, f, 0.22, "triangle", 0.06, i * 0.1)); },
  };
  window.rvBuzz?.on(audio, { clang: "lose", tink: "bump", thud: "hit", shopbell: "great", splash: "bump" });
  audio.fetch();

  /* ---------- puddles: a mask of whole pixels, flat on the pavement, the sky and the lamps in it ---------- */
  function makePuddle(rx, ry, seed) {
    const R = seeded(seed), w = 2 * rx + 9, h = 2 * ry + 5, cx = rx + 4, cy = ry + 2;
    const [c, x] = off(w, h), im = x.createImageData(w, h);
    const ph = R() * 6.28, a1 = 0.08 + 0.08 * R();
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const dx = (i + 0.5 - cx) / rx, dy = (j + 0.5 - cy) / ry;
      const d = Math.pow(Math.pow(Math.abs(dx), 2.4) + Math.pow(Math.abs(dy), 2.4), 1 / 2.4) * (1 + a1 * Math.sin(3 * Math.atan2(dy, dx) + ph));
      const k = (j * w + i) * 4;
      if (d < 1) {
        const t = j / h;
        im.data[k] = 40 + 50 * t; im.data[k + 1] = 52 + 60 * t; im.data[k + 2] = 82 + 70 * t; im.data[k + 3] = 200;
        if (d > 0.82 && dy < 0) { im.data[k] = 16; im.data[k + 1] = 20; im.data[k + 2] = 34; im.data[k + 3] = 170; }
      } else if (d < 1.25) { im.data[k] = 14; im.data[k + 1] = 18; im.data[k + 2] = 30; im.data[k + 3] = 70; }
    }
    x.putImageData(im, 0, 0);
    return { c, w, h, cx, cy };
  }
  const PUDDLES = [[22, 3], [28, 4], [34, 4]].map(([rx, ry], k) => makePuddle(rx, ry, 31 + 77 * k));

  /* ---------- light: glows made once, smooth, so a lamp's light lies on the street as light and not as a pattern ---------- */
  function makeGlow(rx, ry, rgb, power = 1.6) {
    const w = 2 * rx + 1, h = 2 * ry + 1, [c, x] = off(w, h), im = x.createImageData(w, h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const d = Math.hypot((i - rx) / rx, (j - ry) / ry), v = Math.max(0, 1 - d) ** power, k = (j * w + i) * 4;
      im.data[k] = rgb[0]; im.data[k + 1] = rgb[1]; im.data[k + 2] = rgb[2]; im.data[k + 3] = Math.round(255 * clamp(v, 0, 1));
    }
    x.putImageData(im, 0, 0);
    return c;
  }
  const GLOW = {};
  // the light under a lamp: a cone from its lens to the pavement, brightest under the lens and fading as it spreads
  function makeCone(rgb, h) {
    const half = Math.ceil(h * 0.34) + 8, w = 2 * half + 1, [c, x] = off(w, h), im = x.createImageData(w, h);
    for (let j = 0; j < h; j++) {
      const t = j / h, hw = 8 + j * 0.34, a0 = 0.13 * (1 - t) + 0.03;
      for (let i = 0; i < w; i++) {
        const d = Math.abs(i - half) / hw; if (d >= 1) continue;
        const k = (j * w + i) * 4;
        im.data[k] = rgb[0]; im.data[k + 1] = rgb[1]; im.data[k + 2] = rgb[2]; im.data[k + 3] = Math.round(255 * a0 * (1 - d * d));
      }
    }
    x.putImageData(im, 0, 0);
    return c;
  }

  /* ---------- state ---------- */
  let SC, sprites, housesImg, groundImg, lightsImg, ready = false;
  let state = "ready";                                   // ready, play, between, stopped, pause, over
  let k = 0, streetData = null, clock = 0, endT = 0, betweenT = 0;
  let v = 0, th = 0, om = 0, stepPhase = 0, walkKey = false, stopKey = false, padWalk = false, padStop = false;
  let rings = RINGS, errandsDone = 0, quiet = true, candle = 1, candleTotal = 30, ringCool = 0, tinkCool = 0;
  let best = store.get("best", 0), saidOnly = false, saidStart = false, titleT = 9, shakeT = 9, wind = 0, windT = 3, windGoal = 0;
  let pops = [], drops = [], leaves = [], rain = [], splashes = [], ripples = [];
  let actC = null, actX = null, tmpC = null, tmpX = null;   // the street's actors, drawn apart and given the night on their own
  const LOG = location.hash === "#debug" ? [] : null;
  const ev = (type, more) => { if (LOG) LOG.push(Object.assign({ type, t: +clock.toFixed(2), x: +xC.toFixed(2), k }, more || {})); };

  // how likely a window is to be lit when he comes, by its kind, and which of its drawings it shows: mostly plain warm
  // light, sometimes curtains, now and then the blue of a television
  const LIT_CHANCE = { g: 0.3, a: 0.34, o: 0.4, b: 0.18, s: 0.16 };
  function pickVariant(w, R) {
    const n = w.lit.length, r = R();
    if (n >= 3) return r < 0.6 ? 0 : r < 0.9 ? 1 : 2;
    return n === 2 ? (r < 0.6 ? 0 : 1) : 0;
  }

  // a street for errand k: houses shoulder to shoulder with an alley now and then, his own door at 0, the shop's
  // door at the end; side streets with a kerb down and up, cobbles, puddles, carts that come out of the side streets
  function buildStreet(kk) {
    const E = errandOf(kk), lap = lapOf(kk), T = tuneOf(E, lap), R = seeded(1009 * (kk + 1) + Math.floor(Math.random() * 1e6));
    const pick = a => a[Math.floor(R() * a.length)];
    const target = T.len;
    const names = Object.keys(SC.houses), withDoor = names.filter(n => SC.houses[n].door);
    const houses = [], doors = [], lamps = [], props = [], sides = [], passages = [], cobbles = [], puddles = [], carts = [];
    const doorMid = n => (SC.houses[n].door[0] + SC.houses[n].door[2] / 2) / PPM;
    // houses stand wall to wall: placed by their walls, so a roof's eaves may overhang the next house but no sky shows
    // between them
    const inset = n => (SC.houses[n].body || [0, 0]);
    const wallW = n => (SC.houses[n].r[2] - inset(n)[0] - inset(n)[1]) / PPM;
    const put = (name, wall) => {
      const h = SC.houses[name], wM = h.r[2] / PPM, left = wall - inset(name)[0] / PPM;
      houses.push({ name, left, wM, flick: R() * 6.28, win: SC.lights.houses[name].win.map(w => {
        const on = R() < (LIT_CHANCE[w.k] || 0.3);
        return { on, v: pickVariant(w, R), wake: -1, off: -1, watch: 0, wx: R() };
      }) });
      if (h.door) doors.push({ house: houses.length - 1, x: left + doorMid(name), openT: 9, who: pick(["nightcap", "shawl", "child", "cane", "shawl", "nightcap"]) });
      return wall + wallW(name);
    };
    // two houses behind him, then his own, whose door is where he starts
    const home = pick(withDoor), homeWall = -doorMid(home) + inset(home)[0] / PPM;
    let back = homeWall;
    for (let i = 0; i < 2; i++) { const n = pick(names); back -= wallW(n); put(n, back); }
    let x = put(home, homeWall);
    // houses shoulder to shoulder with an alley now and then; a few of the gaps open into side streets
    let sidesLeft = T.sides, lastSide = 0, guard = 0;
    while (x < target - 3 && guard++ < 80) {
      const wantSide = sidesLeft > 0 && x > 5 && x - lastSide > 6 && x < target - 6 && R() < 0.55;
      if (wantSide) { sides.push({ x0: x, x1: x + 2.4, r0: x + 0.44, r1: x + 1.96, far: pick(names), fo: R(), lit: [R(), R()] }); x += 2.4; lastSide = x; sidesLeft -= 1; }
      else if (R() < 0.2) { const w = 0.4 + 0.4 * R(); passages.push({ x0: x, x1: x + w, prev: houses.length - 1 }); x += w; }
      let n = pick(names), tries = 0;
      while (n === houses[houses.length - 1].name && tries++ < 6) n = pick(names);    // never the same house twice running
      x = put(n, x);
      const lastP = passages[passages.length - 1]; if (lastP && lastP.next === undefined) lastP.next = houses.length - 1;
    }
    // the shop at the end, its door where the errand ends
    const shopName = pick(withDoor);
    let fx = put(shopName, x);
    const shopDoor = doors[doors.length - 1];
    shopDoor.shop = true;
    // the shop's window: a ground-floor window beside its door, its glass dark and a candle on the sill
    const shopH = houses[shopDoor.house], SL = SC.lights.houses[shopName], sd0 = SL.door.r, hH = SC.houses[shopName].r[3];
    let shopWin = -1, bestD = 1e9;
    SL.win.forEach((w, i) => {
      if (w.k === "s" || w.r[1] + w.r[3] < hH * 0.55) return;
      // on the door's own floor first, then the nearest along
      const dd = Math.abs(w.r[0] + w.r[2] / 2 - (sd0[0] + sd0[2] / 2)) + 3 * Math.abs(w.r[1] + w.r[3] / 2 - (sd0[1] + sd0[3] / 2));
      if (dd < bestD) { bestD = dd; shopWin = i; }
    });
    if (shopWin >= 0) shopH.win[shopWin].on = false;
    const len = shopDoor.x;
    // past the shop, two more, so the end of the street is a street
    for (let i = 0; i < 2; i++) fx = put(pick(names), fx);
    const inSide = (a, b) => sides.some(sd => b > sd.x0 - 0.1 && a < sd.x1 + 0.1);
    // lamps on the kerb, never in a side street
    for (let lx = 2 + 3 * R(); lx < len + 6; lx += 6 + 3 * R()) if (!inSide(lx - 0.3, lx + 0.3)) lamps.push({ x: lx, ph: R() * 6.28 });
    // what stands against the houses: a bench, a bin, a pot, a bush
    for (let px = -2 + 2 * R(); px < len + 6; px += 2.5 + 3 * R()) {
      if (inSide(px - 0.8, px + 0.8) || passages.some(ps => px + 0.8 > ps.x0 && px - 0.8 < ps.x1) || doors.some(d => Math.abs(d.x - px) < 0.9)) continue;
      props.push({ kind: pick(["bench", "can", "wheelie", "pot", "bush", "crate"]), x: px });
    }
    // cobbles, puddles and carts, clear of his door and the shop's
    for (let i = 0; i < E.cobbles; i++) {
      for (let t = 0; t < 30; t++) { const a = lerp(3, len - 9, R()), b = a + 4 + 3 * R(); if (!inSide(a - 0.3, b + 0.3)) { cobbles.push({ x0: a, x1: b }); break; } }
    }
    for (let i = 0; i < E.puddles + (lap ? 1 : 0); i++) {
      for (let t = 0; t < 20; t++) {
        const px = lerp(4, len - 3, R()), P = PUDDLES[Math.floor(R() * PUDDLES.length)];
        if (!inSide(px - 1, px + 1) && puddles.every(q => Math.abs(q.x - px) > 3)) { puddles.push({ x: px, P, rx: (P.w / 2) / PPM, hit: false }); break; }
      }
    }
    for (let i = 0; i < Math.min(sides.length, E.carts + (lap ? 1 : 0)); i++) {
      const sd = sides[sides.length - 1 - i];
      carts.push({ x: (sd.x0 + sd.x1) / 2, side: sd, state: "wait", y: 0 });
    }
    const S = { E, lap, len, houses, doors, lamps, props, sides, passages, cobbles, puddles, carts, shopDoor, shopWin, rim: T.rim, pace: T.pace, slack: T.slack,
                sign: E.sign, shopName };
    // the roofs of the streets behind, the far one hazier
    S.sky = [makeSkyline(S, 77 * kk + 3, 0.22, E.far, 150, 230), makeSkyline(S, 77 * kk + 11, 0.45, E.mid, 90, 170)];
    return S;
  }

  /* ---------- the HUD on the screen: the swing, the street, the candle, the rings ---------- */
  function hud() {
    const E = errandOf(k);
    $("errand").textContent = "ERRAND " + (k + 1);
    $("bells").setAttribute("aria-label", "Rings left: " + rings + " of " + RINGS);
    $("best").textContent = "Most errands " + best;
  }

  function reset(first = 0) {
    k = first; xC = 0; v = 0; th = 0; om = 0; stepPhase = 0; rings = RINGS; errandsDone = 0; quiet = true; ringCool = 0;
    pops = []; drops = []; leaves = []; rain = []; splashes = []; ripples = []; wind = 0; windGoal = 0; windT = 3; endT = 0;
    streetData = buildStreet(k);
    candleTotal = streetData.len / streetData.pace + streetData.slack; candle = 1;
    hud();
  }

  function start(first = 0) {
    audio.unlock();
    reset(typeof first === "number" ? first : 0);
    state = "play";
    $("ready").hidden = true; $("over").hidden = true;
    $("static").classList.remove("on");
    title(true);
    if (!saidStart) { saidStart = true; say("start", "Clangus has an errand."); }
  }

  function title(voice) {
    const E = errandOf(k), el = $("street");
    el.querySelector(".er-street-no").textContent = "ERRAND " + (k + 1) + (lapOf(k) ? " · AGAIN" : "");
    el.querySelector(".er-street-name").textContent = E.item;
    el.querySelector(".er-street-where").textContent = "from the " + E.shop.toLowerCase() + ", " + E.where;
    el.hidden = false; el.classList.remove("in"); void el.offsetWidth; el.classList.add("in");
    titleT = 0;
    if (voice !== false) audio.errand();
    hud();
  }

  function say(key, text) {
    const sub = $("sub");
    sub.textContent = text;
    audio.line(key).then(d => setTimeout(() => { if (sub.textContent === text) sub.textContent = ""; }, Math.max(1800, d * 1000 + 300)));
  }

  function pop(x, y, text, col) { pops.push({ x, y, text, col, t: 0 }); }

  // the clapper reached the brass
  function strike(hard) {
    if (hard && ringCool <= 0) {
      ringCool = 0.9; rings -= 1; quiet = false; shakeT = 0;
      audio.clang(); ev("ring", { v: +v.toFixed(2) });
      for (const d of streetData.doors) { const sx = toX(d.x); if (sx > -80 && sx < W + 80) { if (d.openT > 2.2) audio.creak(); d.openT = 0; } }
      // and the windows near him: lights go on, one after another, and people look out
      for (const hs of streetData.houses) {
        const hx = toX(hs.left); if (hx > W + 60 || hx + hs.wM * PPM < -60) continue;
        SC.lights.houses[hs.name].win.forEach((w, i) => {
          const st = hs.win[i];
          if (hs === streetData.houses[streetData.shopDoor.house] && i === streetData.shopWin) return;
          const looks = w.k !== "s" && w.k !== "b" && w.r[2] >= 8;
          if (!st.on && st.wake < 0 && Math.random() < 0.5) { st.wake = 0.15 + 0.8 * Math.random(); st.off = 4 + 3 * Math.random(); if (looks && Math.random() < 0.55) { st.watch = 3.2 + 1.5 * Math.random(); st.watchAge = -st.wake; } }
          else if (st.on && looks && Math.random() < 0.3) { st.watch = 2.6 + 1.5 * Math.random(); st.watchAge = 0; }
        });
      }
      pop(toX(xC), WALK_Y - 92, "CLANG", "#ffd27a");
      if (!saidOnly && rings > 0) { saidOnly = true; setTimeout(() => say("only", "It is only Clangus."), 900); }
      if (rings <= 0) { state = "stopped"; endT = 0; audio.humAt(0); audio.level("wind", 0); }
    } else if (tinkCool <= 0) { tinkCool = 0.3; audio.tink(); }
  }

  function arrive() {
    // through the shop's door; its own little bell rings
    const wasQuiet = quiet;
    errandsDone += 1; ev("there", { quiet: wasQuiet, candle: +candle.toFixed(2) });
    audio.shopbell();
    if (errandsDone > best) { best = errandsDone; store.set("best", best); }
    if (wasQuiet && rings < RINGS) { rings += 1; pop(toX(xC), WALK_Y - 92, "+1 RING", "#b8f58a"); }
    setTimeout(() => say(wasQuiet ? "quiet" : "there", wasQuiet ? "Nobody came to the door." : "He got there."), 500);
    state = "between"; betweenT = 0;
    hud();
  }

  function shut() {
    ev("shut"); audio.puff(); rings -= 1; quiet = false;
    say("shut", "The shop has shut.");
    if (rings <= 0) { state = "stopped"; endT = 0; return; }
    state = "between"; betweenT = 0;
  }

  function nextErrand() {
    k += 1; xC = 0; v = 0; th = 0; om = 0; quiet = true; stepPhase = 0;
    streetData = buildStreet(k);
    candleTotal = streetData.len / streetData.pace + streetData.slack; candle = 1;
    state = "play"; title(true);
  }

  function end() {
    state = "over";
    window.rvBuzz?.("over");
    audio.humAt(0); audio.level("wind", 0);
    $("over-title").textContent = "Everyone came to the door.";
    $("over-line").textContent = errandsDone === 0 ? "Clangus ran no errands." : "Clangus ran " + errandsDone + (errandsDone === 1 ? " errand." : " errands.");
    $("over-stats").textContent = errandsDone > 0 && errandsDone === best ? "The most he has run" : "Most errands " + best;
    hud();
    say("end", "Everyone came to the door.");
    setTimeout(() => { if (state === "over") { $("over").hidden = false; $("again").focus({ preventScroll: true }); } }, 1500);
  }

  /* ---------- a frame of the world ---------- */
  function update(dt) {
    clock += dt; titleT += dt;
    for (const p of pops) { p.t += dt; p.y -= 20 * dt; }
    pops = pops.filter(p => p.t < 1.2);
    for (const d of drops) { d.x += d.vx * dt; d.y += d.vy * dt; d.vy += 300 * dt; d.t += dt; }
    drops = drops.filter(d => d.t < 0.8);
    weather(dt);
    if (streetData) {
      for (const d of streetData.doors) d.openT += dt;
      for (const hs of streetData.houses) for (const st of hs.win) {
        if (st.wake >= 0) { st.wake -= dt; if (st.wake < 0) { st.on = true; st.wake = -1; } }
        else if (st.off >= 0) { st.off -= dt; if (st.off < 0) { st.on = false; st.off = -1; } }
        if (st.watch > 0) { st.watch -= dt; st.watchAge = (st.watchAge || 0) + dt; if (st.watch <= 0) { st.watch = 0; st.watchAge = 0; } }
      }
    }
    if (titleT > 3) $("street").hidden = true;
    if (state === "stopped") { endT += dt; settle(dt); if (endT > 2) end(); return; }
    if (state === "between") { betweenT += dt; settle(dt); if (betweenT > 2.6) nextErrand(); return; }
    if (state !== "play") return;
    ringCool -= dt; tinkCool -= dt;
    const S = streetData;
    // the candle in the shop window
    candle -= dt / candleTotal;
    if (candle <= 0) { candle = 0; shut(); return; }
    // fixed small steps for the pendulum
    let rest = dt;
    while (rest > 1e-6) {
      const h = Math.min(rest, 1 / 240); rest -= h;
      physics(h, S);
      if (state !== "play") return;
    }
    // at the shop's door
    if (xC >= S.len - 0.02) { xC = S.len; v = 0; arrive(); return; }
    // the bell hums as the clapper nears the brass
    const near = Math.abs(th) / S.rim;
    audio.humAt(near > 0.72 ? 0.06 * (near - 0.72) / 0.28 : 0);
    audio.level("wind", 0.16 * Math.abs(wind));
  }

  // what happens to him and the clapper in one small step of time
  function physics(h, S) {
    const walking = walkKey || padWalk, stopping = stopKey || padStop;
    const inPuddle = S.puddles.find(q => Math.abs(q.x - xC) < q.rx * 0.8);
    const cart = S.carts.find(c => c.state === "rolling" && Math.abs(c.x - xC) < 0.55 && c.y > -0.3 && c.y < 0.5);
    let a = stopping ? -A_STOP : walking ? A_WALK * (inPuddle ? 0.5 : 1) : -A_COAST;
    const v0 = v;
    v = clamp(v + a * h, 0, V_MAX);
    if (cart && v > 0) {
      // he walks into the cart: stopped dead, all at once
      ev("cart"); audio.thud(); v = 0;
    }
    xC += v * h;
    const acc = (v - v0) / h;
    // into a puddle: a sudden drag, a splash
    for (const q of S.puddles) {
      if (!q.hit && Math.abs(q.x - xC) < q.rx * 0.8 && v > 0.05) {
        q.hit = true; ev("puddle"); audio.splash();
        const dv = v * 0.35; v -= dv; om += dv / LEN;
        for (let i = 0; i < 6; i++) drops.push({ x: toX(xC) + (Math.random() - 0.5) * 12, y: WALK_Y - 2, vx: (Math.random() - 0.5) * 60, vy: -40 - Math.random() * 50, t: 0 });
      }
    }
    // down off a kerb into a side street, and up again on the far side
    for (const sd of S.sides) {
      for (const edge of [sd.r0, sd.r1]) {
        const key = edge === sd.r0 ? "in" : "out";
        if (!sd[key] && xC >= edge && v > 0) { sd[key] = true; om += (Math.random() < 0.5 ? 1 : -1) * (0.45 + 0.5 * v); audio.step(1); }
      }
    }
    // each heavy step knocks the clapper a little, either way, harder the faster he goes; cobbles knock it more
    stepPhase += v * h / STEP;
    if (stepPhase >= 1) {
      stepPhase -= 1;
      const cob = S.cobbles.some(c => xC > c.x0 && xC < c.x1);
      om += (KNOCK * v * v + (cob ? 0.2 * v : 0)) * (Math.random() < 0.5 ? 1 : -1);
      audio.step(v);
    }
    // the pendulum: gravity, his speeding up or slowing down, the air, and the wind on it
    const al = -(GRAV / LEN) * Math.sin(th) - (acc / LEN) * Math.cos(th) - DAMP * om + 2.0 * wind;
    om += al * h; th += om * h;
    if (Math.abs(th) >= S.rim) {
      const hard = Math.abs(om) > 0.55;
      th = Math.sign(th) * S.rim; om = -om * 0.45;
      strike(hard);
    }
    // carts: one waits in a side street ahead and rolls out across the pavement as he comes
    for (const c of S.carts) {
      if (c.state === "wait" && c.x - xC < 2.6) { c.state = "rolling"; c.y = -1.6; ev("cart-out"); }
      if (c.state === "rolling") { c.y += 0.6 * h; if (c.y > 2.6) c.state = "gone"; }
    }
  }

  // between errands and at the end the clapper still swings down to rest
  function settle(dt) {
    let rest = dt;
    while (rest > 1e-6) {
      const h = Math.min(rest, 1 / 240); rest -= h;
      const al = -(GRAV / LEN) * Math.sin(th) - DAMP * 2 * om;
      om += al * h; th += om * h;
    }
  }

  function weather(dt) {
    const E = streetData ? streetData.E : ERRANDS[0];
    if (E.wind && state === "play") {
      windT -= dt;
      if (windT <= 0) { windGoal = windGoal ? 0 : (Math.random() < 0.5 ? -1 : 1) * (0.6 + 0.5 * Math.random()); windT = windGoal ? 1.4 + Math.random() : 3 + 3 * Math.random(); if (windGoal) ev("gust", { w: +windGoal.toFixed(2) }); }
    } else windGoal = 0;
    wind += (windGoal - wind) * Math.min(1, dt * 2.5);
    // rain: near drops long and quick, far ones short and slow; a near drop lands somewhere on the street and splashes
    if (E.rain && !reduce) {
      while (rain.length < 90) rain.push(newDrop(true));
      for (const d of rain) {
        d.y += d.vy * dt; d.x += d.vy * (0.1 + 0.35 * wind) * dt;
        if (d.y > d.land) {
          if (d.near && d.land > FACADE_Y) {
            splashes.push({ x: d.x, y: d.land, t: 0 });
            for (const q of streetData.puddles) { const qx = toX(q.x); if (Math.abs(d.x - qx) < q.P.w / 2 - 6 && Math.abs(d.land - (WALK_Y + 2)) < 4 && Math.random() < 0.6) ripples.push({ x: d.x, y: WALK_Y + 2, t: 0 }); }
          }
          Object.assign(d, newDrop(false));
        }
      }
    } else rain.length = 0;
    for (const p of splashes) p.t += dt;
    splashes = splashes.filter(p => p.t < 0.16);
    for (const p of ripples) p.t += dt;
    ripples = ripples.filter(p => p.t < 0.6);
    // leaves: only in the wind, a few at a time, tumbling; they settle on the pavement and slide when it gusts
    if (E.wind && !reduce && Math.abs(wind) > 0.2 && leaves.length < 14 && Math.random() < Math.abs(wind) * 4 * dt) {
      leaves.push({ x: wind > 0 ? -6 : W + 6, y: 150 + Math.random() * 200, vx: wind * (70 + 40 * Math.random()), vy: 10 + Math.random() * 12, ph: Math.random() * 6, t: 0, c: Math.floor(Math.random() * 3), rest: 0 });
    }
    for (const l of leaves) {
      l.t += dt;
      const floor = l.floor || (l.floor = FACADE_Y + 4 + Math.random() * (KERB_Y - FACADE_Y - 6));
      if (l.y < floor) { l.ph += dt * 7; l.x += (l.vx + wind * 30) * dt; l.y += (l.vy + Math.sin(l.ph) * 16) * dt; }
      else { l.y = floor; l.x += wind * 45 * dt * (Math.abs(wind) > 0.4 ? 1 : 0); l.rest += dt; }
    }
    leaves = leaves.filter(l => l.x > -12 && l.x < W + 12 && l.rest < 6);
  }
  function newDrop(anywhere) {
    const near = Math.random() < 0.4;
    return { near, x: Math.random() * (W + 60) - 30, y: anywhere ? Math.random() * H : -10 - Math.random() * 40, vy: near ? 520 + 60 * Math.random() : 300 + 40 * Math.random(),
             land: near ? FACADE_Y + 2 + Math.random() * (H - FACADE_Y - 4) : FACADE_Y - Math.random() * 30 };
  }

  /* ---------- drawing ---------- */
  function spr(name, px, py, mirror) {
    const s = SC.sprites[name];
    if (!s) return;
    if (!mirror) g.drawImage(sprites, s[0], s[1], s[2], s[3], Math.round(px - s[4]), Math.round(py - s[5]), s[2], s[3]);
  }
  function house(H, sx, sy) {
    const r = SC.houses[H.name].r;
    g.drawImage(housesImg, r[0], r[1], r[2], r[3], Math.round(sx), Math.round(sy - r[5]), r[2], r[3]);
  }
  // a strip of ground, repeated along the street and moving with it, pixel for pixel
  function band(name, y, scroll) {
    const r = SC.ground[name], w = r[2];
    for (let x = -(((scroll % w) + w) % w); x < W + 4; x += w) g.drawImage(groundImg, r[0], r[1], w, r[3], x, y, w, r[3]);
  }

  const LEAF = [["#c06a2c", "#8a4120"], ["#d8a040", "#9a6a24"], ["#9a3c24", "#5e2416"]];
  const lighten = (c, k) => c.map(v => Math.round(v + (255 - v) * k));

  // the roofs of a street behind this one: gables, flat tops, mansards, chimneys, an aerial, now and then a tower,
  // and a few windows that will be lit; drawn once a street, scrolled at a fraction of his pace
  function makeSkyline(S, seed, par, col, hmin, hmax) {
    const R = seeded(seed), w = Math.ceil((S.len + 14) * PPM * par + W + 160), h = 260;
    const [c, x] = off(w, h), dots = [];
    x.fillStyle = col;
    for (let px = 0; px < w;) {
      const bw = 22 + Math.floor(R() * 44), bh = hmin + Math.floor(R() * (hmax - hmin)), top = h - bh, kind = R();
      x.fillRect(px, top, bw, bh);
      if (kind < 0.38) {
        const rise = Math.max(4, Math.floor(bw * 0.32));
        for (let i = 0; i < rise; i++) { const ins = Math.round(i * (bw / 2) / rise); x.fillRect(px + ins, top - i - 1, Math.max(1, bw - 2 * ins), 1); }
      } else if (kind < 0.62) {
        for (let i = 0; i < 5; i++) x.fillRect(px + i + 2, top - i - 1, bw - 2 * i - 4, 1);
      } else if (kind < 0.67) {
        const tw = 8 + Math.floor(R() * 5), tx = px + Math.floor((bw - tw) / 2), th2 = 40 + Math.floor(R() * 40);
        x.fillRect(tx, top - th2, tw, th2);
        for (let i = 0; i < 14; i++) { const ins = Math.round(i * (tw / 2) / 14); x.fillRect(tx + ins, top - th2 - i - 1, Math.max(1, tw - 2 * ins), 1); }
      }
      for (let k2 = Math.floor(R() * 3); k2 > 0; k2--) { const cx = px + 3 + Math.floor(R() * (bw - 8)); x.fillRect(cx, top - 6 - Math.floor(R() * 5), 3, 9); }
      if (R() < 0.18) { const ax = px + 4 + Math.floor(R() * (bw - 8)); x.fillRect(ax, top - 16, 1, 16); x.fillRect(ax - 3, top - 14, 7, 1); }
      for (let wy = top + 6; wy < h - 6; wy += 9 + Math.floor(R() * 4)) for (let wx = px + 4; wx < px + bw - 4; wx += 6 + Math.floor(R() * 5)) if (R() < 0.09) dots.push([wx, wy, R() < 0.3 ? 2 : 1]);
      px += bw + (R() < 0.25 ? Math.floor(R() * 8) : 0);
    }
    return { c, w, h, par, dots };
  }
  const skyX = L => Math.round(-((xC + 8) * PPM * L.par)) - 40;

  function draw() {
    const S = streetData, E = S.E;
    const sh = shakeT < 0.35 && !reduce ? Math.round(Math.sin(shakeT * 70) * 3 * (1 - shakeT / 0.35)) : 0;
    shakeT += 1 / 60;
    g = G0;
    g.setTransform(1, 0, 0, 1, sh, 0);
    // 1. the back: the sky, the streets behind, the houses - graded for the night, then their own light
    drawBack(S);
    g.globalCompositeOperation = "multiply";
    g.fillStyle = "rgb(" + E.tint.join(",") + ")"; g.fillRect(-4, 0, W + 8, FACADE_Y + 2);
    g.globalCompositeOperation = "source-over";
    houseLights(S);
    // 2. the ground: pavement, cobbles, the side streets' road, the kerb and the road - graded apart, then the lamps'
    //    pools and the light out of the open doors laid on it
    drawGround(S);
    g.globalCompositeOperation = "multiply";
    g.fillStyle = "rgb(" + E.tint.join(",") + ")"; g.fillRect(-4, FACADE_Y, W + 8, H - FACADE_Y);
    g.globalCompositeOperation = "source-over";
    groundLights(S);
    // 3. what stands in the street - the props, the carts, Clangus, the lamp posts - drawn apart and given the night
    //    on their own, a little lighter than the houses, so no window and no door can light him
    g = actX; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H);
    drawActors(S);
    tmpX.globalCompositeOperation = "source-over"; tmpX.clearRect(0, 0, W, H); tmpX.drawImage(actC, 0, 0);
    tmpX.globalCompositeOperation = "multiply"; tmpX.fillStyle = "rgb(" + lighten(E.tint, 0.2).join(",") + ")"; tmpX.fillRect(0, 0, W, H);
    tmpX.globalCompositeOperation = "destination-in"; tmpX.drawImage(actC, 0, 0);
    tmpX.globalCompositeOperation = "source-over";
    g = G0; g.drawImage(tmpC, 0, 0);
    // 4. the bulbs of the lamps, and the moths at them; then the weather, the corners of the set, the screen's own
    bulbs(S);
    weatherDraw(E);
    hudCanvas(S);
    g.setTransform(1, 0, 0, 1, 0, 0);
  }

  function drawBack(S) {
    const E = S.E;
    const sky = g.createLinearGradient(0, 0, 0, FACADE_Y);
    sky.addColorStop(0, E.sky[0]); sky.addColorStop(1, E.sky[1]);
    g.fillStyle = sky; g.fillRect(-4, 0, W + 8, FACADE_Y);
    g.fillStyle = "#f4ead0"; g.beginPath(); g.arc(210, 150, 11, 0, Math.PI * 2); g.fill();
    g.fillStyle = E.sky[0]; g.beginPath(); g.arc(214, 146, 10, 0, Math.PI * 2); g.fill();
    for (let i = 0; i < 40; i++) {
      const sx = ((((i * 73 + 11) - xC * 3) % 290) + 290) % 290 - 10, sy = 110 + (i * 47) % 180;
      g.fillStyle = (i + Math.floor(clock * 2)) % 7 ? "rgba(255,255,240,.5)" : "rgba(255,255,240,.9)"; g.fillRect(Math.round(sx), sy, 1, 1);
    }
    for (const L of S.sky) {
      const ox = skyX(L), oy = FACADE_Y - L.h;
      g.drawImage(L.c, ox, oy);
      g.fillStyle = "rgba(255,206,140,.8)";
      for (const d of L.dots) { const x = ox + d[0]; if (x > -2 && x < W + 2) g.fillRect(x, oy + d[1], d[2], d[2]); }
    }
    // a narrow passage between two houses: dark, no higher than the lower of the two
    for (const ps of S.passages) {
      const a = Math.round(toX(ps.x0)), b = Math.round(toX(ps.x1)); if (b < 0 || a > W) continue;
      const hp = Math.round(0.8 * Math.min(...[ps.prev, ps.next].filter(i => i !== undefined).map(i => SC.houses[S.houses[i].name].r[5])));
      const pg = g.createLinearGradient(0, FACADE_Y - hp, 0, FACADE_Y);
      pg.addColorStop(0, "rgba(10,8,26,.6)"); pg.addColorStop(0.4, "rgba(10,8,26,.9)"); pg.addColorStop(1, "rgba(6,4,16,1)");
      g.fillStyle = pg; g.fillRect(a, FACADE_Y - hp, b - a, hp);
    }
    // the side streets: their road going back four metres to the next street, and a house of that street across the
    // end, in the haze, a window or two lit
    for (const sd of S.sides) {
      const a = Math.round(toX(sd.x0)), b = Math.round(toX(sd.x1)); if (b < 0 || a > W) continue;
      const far = FACADE_Y - Math.round(4 * DEPTH), HF = SC.houses[sd.far], r = HF.r;
      g.save(); g.beginPath(); g.rect(a, 0, b - a, FACADE_Y); g.clip();
      const hx = Math.round(a - (r[2] - (b - a)) * sd.fo);
      g.drawImage(housesImg, r[0], r[1], r[2], r[3], hx, far - r[5], r[2], r[3]);
      g.fillStyle = "rgba(14,10,34,.42)"; g.fillRect(a, 0, b - a, far);
      // its ground going away from us: the road in the middle, a footway each side a shade lighter, their kerbs
      const fw = Math.round((sd.r0 - sd.x0) * PPM);
      for (let y = far; y < FACADE_Y; y++) {
        const t = (y - far) / (FACADE_Y - far), k = (r0, g0, b0, f) => "rgb(" + Math.round(r0 * f) + "," + Math.round(g0 * f) + "," + Math.round(b0 * f) + ")";
        const f = 0.55 + 0.45 * t;
        g.fillStyle = k(78, 74, 88, f); g.fillRect(a, y, b - a, 1);
        g.fillStyle = k(104, 100, 108, f); g.fillRect(a, y, fw, 1); g.fillRect(b - fw, y, fw, 1);
        g.fillStyle = k(128, 124, 128, f); g.fillRect(a + fw, y, 1, 1); g.fillRect(b - fw - 1, y, 1, 1);
      }
      g.fillStyle = "rgba(10,8,24,.5)"; g.fillRect(a, far - 2, b - a, 2);
      // a lamp on the far wall, and its light on the end of the side street
      const lx = Math.round(a + (b - a) * (0.25 + 0.5 * sd.fo)), wy = far - 34;
      g.fillStyle = "#1c1626"; g.fillRect(lx - 1, wy - 1, 3, 4); g.fillRect(lx - 3, wy - 2, 4, 1);
      g.globalCompositeOperation = "lighter";
      g.globalAlpha = 0.35; g.drawImage(GLOW.pool[S.E.sign], lx - 60, far - 14); g.globalAlpha = 0.8; g.drawImage(GLOW.bulb[S.E.sign], lx - 16, wy - 8);
      g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
      g.fillStyle = "#ffe2a8"; g.fillRect(lx, wy + 1, 1, 2);
      sd.hx = hx; sd.farY = far;
      g.restore();
    }
    for (const hs of S.houses) {
      const sx = toX(hs.left); if (sx > W || sx + hs.wM * PPM < 0) continue;
      house(hs, sx, FACADE_Y);
    }
    // the shop's sign hangs over its door
    const d = S.shopDoor, hs = S.houses[d.house], HD = SC.houses[hs.name], dr = HD.door, sx = toX(hs.left), top = FACADE_Y - HD.r[5];
    const kx = Math.round(sx + dr[0] + dr[2] + 4), ky = Math.round(top + dr[1] - 14);
    if (kx > -60 && kx < W + 60) {
      g.fillStyle = "#2a1a0e"; g.fillRect(kx - 2, ky - 3, 26, 2); g.fillRect(kx + 22, ky - 3, 2, 6);
      g.fillStyle = "#5a3b1c"; g.fillRect(kx, ky, 22, 16); g.fillStyle = "#e6b85a"; g.fillRect(kx + 1, ky + 1, 20, 14);
      g.fillStyle = "#3a2410"; drawSign(S.sign, kx + 11, ky + 8);
    }
  }

  function piece(key, dx, dy, dw, dh) {
    const p = SC.lights.pos[key]; if (!p) return;
    g.drawImage(lightsImg, p[0], p[1], p[2], p[3], Math.round(dx), Math.round(dy), dw === undefined ? p[2] : Math.round(dw), dh === undefined ? p[3] : Math.round(dh));
  }

  // the houses' light: the streets behind first, then every window in its own opening - lit, or the night's glass -
  // and whoever looks out after a ring; then the doors that are open, and who is in them; and the shop's candle
  function houseLights(S) {
    for (const hs of S.houses) {
      const sx = toX(hs.left); if (sx > W || sx + hs.wM * PPM < 0) continue;
      const LH = SC.lights.houses[hs.name], top = FACADE_Y - SC.houses[hs.name].r[5];
      LH.win.forEach((w, i) => {
        const st = hs.win[i], x = sx + w.r[0], y = top + w.r[1];
        if (!st.on) { if (w.dark) piece(w.dark, x, y); return; }
        const tv = st.v === 2;
        g.globalAlpha = tv ? 0.78 + 0.22 * Math.abs(Math.sin(clock * 7.3 + hs.flick + i) * Math.sin(clock * 2.1 + i)) : 1;
        piece(w.lit[st.v % w.lit.length], x, y);
        g.globalAlpha = 1;
        if (st.watch > 0) watcher(w, st, x, y);
      });
    }
    for (const sd of S.sides) {
      const a = Math.round(toX(sd.x0)), b = Math.round(toX(sd.x1)); if (b < 0 || a > W || sd.hx === undefined) continue;
      const LF = SC.lights.houses[sd.far], top = sd.farY - SC.houses[sd.far].r[5];
      g.save(); g.beginPath(); g.rect(a, 0, b - a, sd.farY); g.clip(); g.globalAlpha = 0.6;
      LF.win.forEach((w, i) => { if ((w.k === "g" || w.k === "a") && ((i * 0.37 + sd.lit[0]) % 1) < 0.35) piece(w.lit[0], sd.hx + w.r[0], top + w.r[1]); });
      g.globalAlpha = 1; g.restore();
    }
    for (const d of S.doors) {
      const hs = S.houses[d.house], LH = SC.lights.houses[hs.name], D = LH.door, sx = toX(hs.left), top = FACADE_Y - SC.houses[hs.name].r[5];
      if (!D || sx > W + 40 || sx + hs.wM * PPM < -40) continue;
      const open = d.openT < 2.8;
      if (!open && !d.shop) continue;
      const dx = sx + D.r[0], dy = top + D.r[1];
      g.globalAlpha = d.shop && !open ? 1 : Math.min(1, d.openT / 0.12) * Math.min(1, (2.8 - d.openT) / 0.3);
      piece(D.hall, dx, dy);
      g.globalAlpha = 1;
      if (open && !d.shop && d.openT > 0.2) {
        // somebody comes to the door, looking out for the bad news; drawn at the door's own size
        const key = LH.people && (LH.people[d.who] || LH.people.child), p = key && SC.lights.pos[key];
        if (p) {
          const px = Math.round(dx + D.r[2] * 0.6 - p[2] / 2), py = dy + D.r[3] - p[3];
          g.globalAlpha = Math.min(1, (d.openT - 0.2) / 0.15) * Math.min(1, (2.8 - d.openT) / 0.3);
          piece(key, px, py);
          g.globalAlpha = 1;
          if (d.openT > 0.45 && d.openT < 2.4) {
            const qy = Math.round(py - 5 + Math.sin(clock * 5));
            g.font = "16px VT323, monospace"; g.textAlign = "center";
            g.fillStyle = "#000"; g.fillText("?", px + Math.round(p[2] / 2) + 1, qy + 1); g.fillStyle = "#ffe7a8"; g.fillText("?", px + Math.round(p[2] / 2), qy);
          }
        }
      }
    }
    // the candle in the shop's window: the ground-floor window nearest its door, lit, the candle on the sill
    const d = S.shopDoor, hs = S.houses[d.house], sx = toX(hs.left), top = FACADE_Y - SC.houses[hs.name].r[5];
    let cx, cy;
    if (S.shopWin >= 0) { const w = SC.lights.houses[hs.name].win[S.shopWin]; cx = Math.round(sx + w.r[0] + w.r[2] / 2 - 1); cy = Math.round(top + w.r[1] + (w.rail != null ? w.rail : w.r[3] - 1)); }
    else { const D = SC.lights.houses[hs.name].door; cx = Math.round(sx + D.r[0] - 6); cy = Math.round(top + D.r[1] + D.r[3] * 0.55); }
    if (cx > -40 && cx < W + 40) {
      const ch = Math.max(1, Math.round(9 * candle));
      if (candle > 0) {
        // its light on the glass round it, a little unsteady
        const fl = 0.85 + 0.15 * Math.sin(clock * 9.1) * Math.sin(clock * 3.7);
        g.globalCompositeOperation = "lighter"; g.globalAlpha = 0.55 * fl;
        g.drawImage(GLOW.candle, cx + 1 - 9, cy - ch - 2 - 9);
        g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
      }
      g.fillStyle = "#2a1a12"; g.fillRect(cx - 2, cy, 7, 1);
      g.fillStyle = "#efe4c8"; g.fillRect(cx, cy - ch, 3, ch);
      if (candle > 0) {
        g.fillStyle = Math.floor(clock * 8) % 2 ? "#ffd27a" : "#ffb04a"; g.fillRect(cx + 1, cy - ch - 3, 1, 3);
        g.fillStyle = "#fff4c8"; g.fillRect(cx + 1, cy - ch - 2, 1, 1);
      }
    }
  }

  // someone at a window looking out after a ring: head and shoulders against the light, drawn once per size
  const WATCHERS = new Map();
  function watcher(w, st, x, y) {
    if (w.k === "s" || w.k === "b") return;
    const ww = w.r[2], wh = w.rail != null ? w.rail : w.r[3];
    const hh = Math.max(6, Math.min(Math.round(wh * 0.62), Math.round(ww * 0.9))), bw = Math.max(5, Math.round(hh * 0.86));
    const key = bw + "x" + hh;
    let c = WATCHERS.get(key);
    if (!c) {
      const [cc, x2] = off(bw, hh); x2.fillStyle = "#1c1020";
      const r = Math.max(2, Math.round(hh * 0.2)), hx = bw / 2, hy = r + 1;
      for (let j = 0; j < hh; j++) for (let i = 0; i < bw; i++) {
        const head = Math.hypot(i + 0.5 - hx, j + 0.5 - hy) <= r + 0.2;
        const sh = j >= hy + r - 1 && Math.abs(i + 0.5 - hx) <= bw / 2 * Math.min(1, 0.45 + (j - hy - r + 1) / (hh * 0.35));
        if (head || sh) x2.fillRect(i, j, 1, 1);
      }
      WATCHERS.set(key, c = cc);
    }
    const a = Math.min(1, st.watch / 0.4, (6 - Math.min(6, st.watchAge || 0)) / 0.4);
    g.globalAlpha = Math.max(0, Math.min(1, a));
    g.drawImage(c, Math.round(x + ww / 2 - bw / 2 + (st.wx - 0.5) * ww * 0.3), Math.round(y + wh - hh));
    g.globalAlpha = 1;
  }

  function drawGround(S) {
    const scroll = Math.round(xC * PPM);
    band("paving", FACADE_Y, scroll);
    // cobbled stretches: setts let into the paving, their ends ragged a stone at a time
    for (const c of S.cobbles) {
      const a = Math.round(toX(c.x0)), b = Math.round(toX(c.x1)); if (b < 0 || a > W) continue;
      g.save(); g.beginPath();
      for (let y = FACADE_Y, r = 0; y < KERB_Y; y += 3, r++) { const ja = (r * 7 + 3) % 5 - 2, jb = (r * 3 + 1) % 5 - 2; g.rect(a + ja, y, b - a - ja + jb, 3); }
      g.clip(); band("cobble", FACADE_Y, scroll); g.restore();
    }
    // the side streets: their road comes out between two kerbs to the road; their footways are paving like ours
    for (const sd of S.sides) {
      const a = Math.round(toX(sd.r0)), b = Math.round(toX(sd.r1)); if (b < 0 || a > W) continue;
      g.save(); g.beginPath(); g.rect(a, FACADE_Y - 1, b - a, KERB_Y - FACADE_Y + 1); g.clip(); band("side", FACADE_Y - 1, scroll); g.restore();
      g.fillStyle = "#8e8a84"; g.fillRect(a - 2, FACADE_Y, 2, KERB_Y - FACADE_Y); g.fillRect(b, FACADE_Y, 2, KERB_Y - FACADE_Y);
      g.fillStyle = "#a29e96"; g.fillRect(a - 2, FACADE_Y, 1, KERB_Y - FACADE_Y); g.fillRect(b, FACADE_Y, 1, KERB_Y - FACADE_Y);
      g.fillStyle = "rgba(0,0,0,.35)"; g.fillRect(a, FACADE_Y, 1, KERB_Y - FACADE_Y); g.fillRect(b - 1, FACADE_Y, 1, KERB_Y - FACADE_Y);
    }
    // the houses' feet: a little shadow where the paving meets them
    g.fillStyle = "rgba(6,4,16,.42)"; g.fillRect(-4, FACADE_Y, W + 8, 2);
    g.fillStyle = "rgba(6,4,16,.18)"; g.fillRect(-4, FACADE_Y + 2, W + 8, 2);
    for (const q of S.puddles) { const sx = toX(q.x); if (sx < -60 || sx > W + 60) continue; g.drawImage(q.P.c, Math.round(sx - q.P.cx), Math.round(WALK_Y + 2 - q.P.cy)); }
    // the kerb: dressed stones a metre long, lit along the top, a shadow under the edge
    g.fillStyle = "#8a8680"; g.fillRect(-4, KERB_Y, W + 8, 3);
    g.fillStyle = "#a6a29a"; g.fillRect(-4, KERB_Y, W + 8, 1);
    g.fillStyle = "#64605c"; for (let x = -(((scroll % 72) + 72) % 72); x < W + 4; x += 72) g.fillRect(x, KERB_Y, 1, 3);
    g.fillStyle = "rgba(0,0,0,.45)"; g.fillRect(-4, KERB_Y + 3, W + 8, 1);
    band("road", KERB_Y + 4, scroll);
    // where a side street meets the road, the kerb is dropped
    for (const sd of S.sides) {
      const a = Math.round(toX(sd.r0)), b = Math.round(toX(sd.r1)); if (b < 0 || a > W) continue;
      g.fillStyle = "#4c484a"; g.fillRect(a, KERB_Y, b - a, 4); g.fillStyle = "#5e5a58"; g.fillRect(a, KERB_Y, b - a, 1);
    }
  }

  // light laid on the ground: each lamp's pool, and a fan of warm light from every open door across the pavement
  function groundLights(S) {
    g.globalCompositeOperation = "lighter";
    for (const L of S.lamps) {
      const lx = lensX(L); if (lx < -80 || lx > W + 80) continue;
      g.globalAlpha = 0.5; g.drawImage(GLOW.pool[S.E.sign], lx - 60, Math.round((FACADE_Y + KERB_Y) / 2 - 18)); g.globalAlpha = 1;
    }
    for (const d of S.doors) {
      const hs = S.houses[d.house], HD = SC.houses[hs.name], dr = HD.door; if (!dr) continue;
      const open = d.openT < 2.8; if (!open && !d.shop) continue;
      const k2 = d.shop && !open ? 0.7 : Math.min(1, d.openT / 0.18) * Math.min(1, (2.8 - d.openT) / 0.35);
      const x0 = toX(hs.left) + dr[0], w = dr[2];
      if (x0 > W + 40 || x0 + w < -40) continue;
      for (let y = FACADE_Y; y < KERB_Y; y++) {
        const t = (y - FACADE_Y) / (KERB_Y - FACADE_Y), spread = w * (1 + 0.9 * t), a = 0.32 * (1 - t) * k2;
        g.fillStyle = "rgba(255,190,120," + a.toFixed(3) + ")";
        g.fillRect(Math.round(x0 + w / 2 - spread / 2), y, Math.round(spread), 1);
      }
    }
    g.globalCompositeOperation = "source-over";
  }

  function drawActors(S) {
    for (const p of S.props) { const sx = toX(p.x); if (sx < -80 || sx > W + 80) continue; spr(p.kind, sx, FACADE_Y + 6); }
    const cartsBehind = S.carts.filter(c => c.state === "rolling" && c.y < 0.2), cartsFront = S.carts.filter(c => c.state === "rolling" && c.y >= 0.2);
    for (const c of cartsBehind) spr("cart", toX(c.x), WALK_Y + c.y * DEPTH);
    drawClangus();
    for (const c of cartsFront) spr("cart", toX(c.x), WALK_Y + c.y * DEPTH);
    for (const L of S.lamps) { const sx = toX(L.x); if (sx < -90 || sx > W + 40) continue; spr("lamp", sx, KERB_Y + 2); }
    for (const d of drops) { g.fillStyle = "#cfe0f2"; g.fillRect(Math.round(d.x), Math.round(d.y), 1, 2); }
  }

  const lensX = L => Math.round(toX(L.x) - SC.sprites.lamp[4] + SC.points.lamp.lens[0]);
  const lensY = () => Math.round(KERB_Y + 2 - SC.sprites.lamp[5] + SC.points.lamp.lens[1]);
  function bulbs(S) {
    const ly = lensY(), col = S.E.lamp, P = SC.points.lamp;
    for (const L of S.lamps) {
      const lx = lensX(L); if (lx < -110 || lx > W + 110) continue;
      g.globalCompositeOperation = "lighter";
      g.drawImage(GLOW.cone[S.E.sign], lx - (GLOW.cone[S.E.sign].width >> 1), ly + 1);
      g.drawImage(GLOW.bulb[S.E.sign], lx - 16, ly - 9);
      g.globalCompositeOperation = "source-over";
      // the lens itself, burning
      g.fillStyle = "rgb(" + lighten(col, 0.45).join(",") + ")"; g.fillRect(lx - (P.lensW >> 1), ly - 1, P.lensW, 2);
      g.fillStyle = "#fff8e6"; g.fillRect(lx - (P.lensW >> 1) + 3, ly - 1, P.lensW - 6, 1);
    }
  }

  function weatherDraw(E) {
    for (const l of leaves) {
      const [c1, c2] = LEAF[l.c], x = Math.round(l.x), y = Math.round(l.y), f = Math.sin(l.ph);
      // a leaf turning over as it goes: flat, tilted, edge on; flat when it lies on the paving
      g.fillStyle = c1;
      if (l.rest > 0 || f > 0.35) { g.fillRect(x, y, 4, 2); g.fillStyle = c2; g.fillRect(x + 1, y + 1, 3, 1); g.fillRect(x + 4, y + 1, 1, 1); }
      else if (f < -0.35) { g.fillRect(x, y, 1, 3); g.fillStyle = c2; g.fillRect(x, y + 3, 1, 1); }
      else { g.fillRect(x, y, 3, 2); g.fillStyle = c2; g.fillRect(x + 1, y + 2, 2, 1); }
    }
    if (E.rain && !reduce) {
      const ly = lensY(), cones = streetData.lamps.map(lensX).filter(x => x > -120 && x < W + 120);
      for (const d of rain) {
        const n = d.near ? 7 : 4, sl = 0.1 + 0.35 * wind;
        const lit = cones.some(lx => d.y > ly && Math.abs(d.x - lx) < (d.y - ly) * 0.34 + 6);
        g.fillStyle = lit ? (d.near ? "rgba(255,232,190,.75)" : "rgba(255,226,180,.5)") : (d.near ? "rgba(196,212,240,.42)" : "rgba(160,176,214,.26)");
        for (let i = 0; i < n; i++) g.fillRect(Math.round(d.x - sl * i), Math.round(d.y - i), 1, 1);
      }
      g.fillStyle = "rgba(205,220,245,.6)";
      for (const p of splashes) {
        const x = Math.round(p.x), y = Math.round(p.y);
        if (p.t < 0.08) { g.fillRect(x - 1, y - 1, 1, 1); g.fillRect(x + 1, y - 1, 1, 1); } else { g.fillRect(x - 2, y, 1, 1); g.fillRect(x + 2, y, 1, 1); }
      }
      g.fillStyle = "rgba(190,210,240,.45)";
      for (const p of ripples) {
        const r = 1.5 + p.t * 14, ry = r * 0.3;
        for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; g.fillRect(Math.round(p.x + Math.cos(a) * r), Math.round(p.y + Math.sin(a) * ry), 1, 1); }
      }
    }
    const vg = g.createRadialGradient(W / 2, H * 0.55, H * 0.3, W / 2, H * 0.55, H * 0.75);
    vg.addColorStop(0, "rgba(6,4,18,0)"); vg.addColorStop(1, "rgba(6,4,18,.5)");
    g.fillStyle = vg; g.fillRect(-4, 0, W + 8, H);
    const top = g.createLinearGradient(0, 0, 0, 120);
    top.addColorStop(0, "rgba(6,4,18,.55)"); top.addColorStop(1, "rgba(6,4,18,0)");
    g.fillStyle = top; g.fillRect(-4, 0, W + 8, 120);
  }

  // what he is drawn at, 15 times a second, and where his bell's axis is in that drawing
  const res = { pose: "idle_0", acc: 0, walk: 0, idle: 0 };
  function sample(dt) {
    res.acc += dt;
    if (res.acc < RESIDENT_STEP && !reduce) return;
    res.acc = reduce ? 0 : res.acc % RESIDENT_STEP;
    if (v > 0.04 && state === "play") {
      // his take's 19 drawings make a 0.72 m stride; stepped on as fast as he walks
      res.walk = (res.walk + Math.max(1, Math.round(v * 19 / 0.72 / 15))) % 19;
      res.pose = "walk_" + res.walk;
    } else { res.idle = (res.idle + 1) % 6; res.pose = "idle_" + res.idle; }
  }

  function drawClangus() {
    const S = streetData, x = toX(xC);
    const dip = S.sides.some(sd => xC > sd.r0 && xC < sd.r1) ? 4 : 0;
    const y = WALK_Y + dip, pose = res.pose, s = SC.sprites[pose], P = SC.points[pose];
    // shadow
    g.fillStyle = "rgba(6,4,16,.4)"; g.beginPath(); g.ellipse(x, y + 1, 17, 3.5, 0, 0, Math.PI * 2); g.fill();
    if (s && P) {
      const ox = x - s[4], oy = y - s[5];
      const pv = [ox + P.pivot[0], oy + P.pivot[1]], rim = [ox + P.rim[0], oy + P.rim[1]];
      const axis = Math.atan2(pv[0] - rim[0], rim[1] - pv[1]);          // the bell's tilt in this drawing
      const lenPx = Math.hypot(rim[0] - pv[0], rim[1] - pv[1]) + 6;
      const ang = th + axis * 0.0;
      const bx = pv[0] + Math.sin(ang) * lenPx, by = pv[1] + Math.cos(ang) * lenPx;
      // the rod and the ball, iron dark against the brass
      g.strokeStyle = "#3b2a14"; g.lineWidth = 2; g.beginPath(); g.moveTo(Math.round(pv[0]), Math.round(pv[1])); g.lineTo(Math.round(bx), Math.round(by)); g.stroke();
      g.fillStyle = "#2a1c0c"; g.beginPath(); g.arc(Math.round(bx), Math.round(by), 4, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#8a6a3a"; g.fillRect(Math.round(bx) - 2, Math.round(by) - 2, 1, 1);
    }
    spr(pose, x, y);
  }

  // the shops' signs: a loaf, a stamp, a milk bottle, a nail, a match, in a few pixels
  const SIGNS = {
    loaf: ["..XXXX..", ".XXXXXX.", "XX.X.X.X", "XXXXXXXX", "XXXXXXXX"],
    stamp: ["X.X.X.X.", "XXXXXXXX", ".X....X.", "XX.XX.XX", ".X....X.", "XXXXXXXX", "X.X.X.X."],
    milk: ["..XX..", "..XX..", ".XXXX.", "XXXXXX", "X....X", "XXXXXX", "XXXXXX"],
    nail: ["XXXXXX", "..XX..", "..XX..", "..XX..", "..XX..", "...X.."],
    match: ["..XX", ".XXX", "..X.", ".X..", ".X..", "X...", "X..."],
  };
  function drawSign(name, cx, cy) {
    const rows = SIGNS[name] || SIGNS.loaf, w = rows[0].length, h = rows.length;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (rows[j][i] === "X") g.fillRect(cx - (w >> 1) + i, cy - (h >> 1) + j, 1, 1);
  }

  // on the screen: the bell gauge at the top with its clapper, the street to the shop, the candle, the rings
  function hudCanvas(S) {
    const gx = 135, gy = 50;
    // the gauge: a bell's mouth, the clapper hanging in it, red where it rings
    const rim = S.rim, scale = 1.6;
    g.fillStyle = "rgba(10,7,24,.55)"; g.beginPath(); g.arc(gx, gy, 30, Math.PI * 0.05, Math.PI * 0.95); g.fill();
    for (let i = -10; i <= 10; i++) {
      const a = (i / 10) * rim * 1.15 * scale, r0 = 22, r1 = 28, danger = Math.abs(i) >= 8;
      g.strokeStyle = danger ? "#e2503f" : "rgba(255,231,168,.6)"; g.lineWidth = 1;
      g.beginPath(); g.moveTo(gx + Math.sin(a) * r0, gy + Math.cos(a) * r0); g.lineTo(gx + Math.sin(a) * r1, gy + Math.cos(a) * r1); g.stroke();
    }
    const near = clamp(Math.abs(th) / rim, 0, 1), a = clamp(th * scale, -rim * scale * 1.2, rim * scale * 1.2);
    g.strokeStyle = near > 0.8 ? "#ff6b5a" : "#ffe7a8"; g.lineWidth = 2;
    g.beginPath(); g.moveTo(gx, gy - 4); g.lineTo(gx + Math.sin(a) * 24, gy + Math.cos(a) * 24); g.stroke();
    g.fillStyle = near > 0.8 ? "#ff6b5a" : "#d8a94a"; g.beginPath(); g.arc(gx + Math.sin(a) * 24, gy + Math.cos(a) * 24, 3, 0, Math.PI * 2); g.fill();
    // a little bell over it
    g.fillStyle = "#d8a94a"; g.fillRect(gx - 4, gy - 12, 8, 2); g.fillRect(gx - 6, gy - 10, 12, 6); g.fillRect(gx - 8, gy - 4, 16, 2); g.fillRect(gx - 1, gy - 15, 2, 3);
    // the street from his door to the shop
    const y = 96, x0 = 24, x1 = 246;
    g.fillStyle = "rgba(255,231,168,.35)"; g.fillRect(x0, y, x1 - x0, 1);
    for (const sd of S.sides) { const a2 = x0 + (sd.x0 / S.len) * (x1 - x0), b2 = x0 + (sd.x1 / S.len) * (x1 - x0); g.fillStyle = "rgba(10,7,24,.9)"; g.fillRect(Math.round(a2), y - 1, Math.max(2, Math.round(b2 - a2)), 3); }
    for (const c of S.cobbles) { const a2 = x0 + (c.x0 / S.len) * (x1 - x0), b2 = x0 + (c.x1 / S.len) * (x1 - x0); g.fillStyle = "#9c8f7a"; for (let px = a2; px < b2; px += 3) g.fillRect(Math.round(px), y, 1, 1); }
    for (const q of S.puddles) { g.fillStyle = "#7aa6d6"; g.fillRect(Math.round(x0 + (q.x / S.len) * (x1 - x0)) - 1, y - 1, 3, 2); }
    for (const c of S.carts) if (c.state !== "gone") { g.fillStyle = "#e2503f"; g.fillRect(Math.round(x0 + (c.x / S.len) * (x1 - x0)) - 1, y - 3, 3, 3); }
    g.fillStyle = "#d8a94a"; g.fillRect(x1 - 1, y - 4, 3, 5);
    const me = x0 + clamp(xC / S.len, 0, 1) * (x1 - x0);
    g.fillStyle = "#ffe7a8"; g.fillRect(Math.round(me) - 1, y - 3, 3, 5);
    // the candle, top right, under the errand's number
    const cx = 250, cy = 34, ch = Math.round(16 * candle);
    g.fillStyle = "rgba(10,7,24,.6)"; g.fillRect(cx - 4, cy - 3, 11, 24);
    g.fillStyle = "#efe6cf"; g.fillRect(cx, cy + 18 - ch, 3, ch);
    if (candle > 0) { g.fillStyle = Math.floor(clock * 8) % 2 ? "#ffd27a" : "#ffb04a"; g.fillRect(cx, cy + 15 - ch, 3, 3); }
    // the rings he has left: three small bells, top left under the channel
    for (let i = 0; i < RINGS; i++) {
      const bx = 14 + i * 13, by = 36;
      g.fillStyle = i < rings ? "#d8a94a" : "rgba(216,169,74,.25)";
      g.fillRect(bx - 2, by - 4, 4, 1); g.fillRect(bx - 3, by - 3, 6, 4); g.fillRect(bx - 4, by + 1, 8, 1); g.fillRect(bx, by + 2, 1, 1);
    }
    // pops
    g.font = "16px VT323, monospace"; g.textAlign = "center";
    for (const p of pops) { g.globalAlpha = Math.max(0, 1 - p.t / 1.2); g.fillStyle = "#000"; g.fillText(p.text, Math.round(p.x) + 1, Math.round(p.y) + 1); g.fillStyle = p.col; g.fillText(p.text, Math.round(p.x), Math.round(p.y)); g.globalAlpha = 1; }
  }

  let last = performance.now(), frozen = false;      // frozen: a bot is stepping the street itself (#debug)
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.max(0, Math.min(0.1, (now - last) / 1000));
    last = now;
    if (!ready) return;
    if (state !== "pause" && !frozen) update(dt);
    sample(dt);
    draw();
  }

  /* ---------- input: hold WALK, let go to slow down, STOP to stop short ---------- */
  const screen = $("screen");
  screen.addEventListener("pointerdown", e => {
    if (e.target.closest("button, a")) return;
    if (state === "pause") { pause(false); return; }
    if (state !== "play") return;
    e.preventDefault(); padWalk = true;
    try { screen.setPointerCapture(e.pointerId); } catch (err) { /* not capturable */ }
  });
  const upScreen = () => { padWalk = false; };
  screen.addEventListener("pointerup", upScreen);
  screen.addEventListener("pointercancel", upScreen);
  for (const b of document.querySelectorAll("#pad [data-d]")) {
    const on = e => { e.preventDefault(); if (state === "pause") { pause(false); return; } if (b.dataset.d === "walk") padWalk = true; else padStop = true; b.classList.add("on"); try { b.setPointerCapture(e.pointerId); } catch (err) { /* ok */ } };
    const offB = () => { if (b.dataset.d === "walk") padWalk = false; else padStop = false; b.classList.remove("on"); };
    b.addEventListener("pointerdown", on);
    b.addEventListener("pointerup", offB); b.addEventListener("pointercancel", offB); b.addEventListener("lostpointercapture", offB);
  }
  const WALK = new Set(["ArrowRight", "KeyD", "Space"]), STOPK = new Set(["ArrowLeft", "KeyA", "ArrowDown", "KeyS"]);
  addEventListener("keydown", e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const el = e.target instanceof Element ? e.target : null;
    if (el && el !== document.body && el.closest("button") && (e.code === "Space" || e.code === "Enter")) return;
    if ((e.code === "Space" || e.code === "Enter") && (state === "ready" || (state === "over" && !$("over").hidden))) { e.preventDefault(); start(); return; }
    if (WALK.has(e.code)) { e.preventDefault(); if (state === "pause") pause(false); walkKey = true; }
    else if (STOPK.has(e.code)) { e.preventDefault(); if (state === "pause") pause(false); stopKey = true; }
    else if (e.code === "KeyP" || e.code === "Escape") { if (state === "play") pause(true); else if (state === "pause") pause(false); }
  });
  addEventListener("keyup", e => { if (WALK.has(e.code)) walkKey = false; if (STOPK.has(e.code)) stopKey = false; });
  addEventListener("blur", () => { walkKey = stopKey = padWalk = padStop = false; });

  let pausedFrom = "play";
  function pause(on) {
    if (on && (state === "play" || state === "between")) {
      pausedFrom = state; state = "pause"; walkKey = stopKey = padWalk = padStop = false;
      $("sub").textContent = "PAUSE ▮▮";
      if (audio.ctx) audio.ctx.suspend();
    } else if (!on && state === "pause") {
      state = pausedFrom; $("sub").textContent = ""; audio.unlock();
    }
  }
  document.addEventListener("visibilitychange", () => { if (document.hidden) pause(true); });

  $("play").addEventListener("click", start);
  $("again").addEventListener("click", start);
  $("share").addEventListener("click", async () => {
    const url = "https://rotville.world/games/errand/", label = $("share").querySelector(".tape-label");
    const text = errandsDone === 0 ? "Clangus ran no errands on rotville.world. Everyone came to the door."
      : "Clangus ran " + errandsDone + (errandsDone === 1 ? " errand" : " errands") + " on rotville.world before everyone came to the door.";
    if (navigator.share) {
      try { await navigator.share({ title: "Errand", text, url }); return; } catch (err) { if (err && err.name === "AbortError") return; }
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

  // a bot can read the street through this, on a page opened with #debug
  if (location.hash === "#debug") {
    window.__er = {
      get: () => ({ state, k, xC, v, th, om, rim: streetData && streetData.rim, rings, errandsDone, candle, len: streetData && streetData.len, wind,
                    puddles: streetData ? streetData.puddles.map(q => ({ x: q.x, hit: q.hit })) : [],
                    sides: streetData ? streetData.sides.map(s => ({ x0: s.x0, x1: s.x1 })) : [],
                    cobbles: streetData ? streetData.cobbles : [],
                    carts: streetData ? streetData.carts.map(c => ({ x: c.x, state: c.state, y: c.y })) : [],
                    doors: streetData ? streetData.doors.map(d => ({ x: d.x, h: SC.houses[streetData.houses[d.house].name].door[3], shop: !!d.shop, open: d.openT < 2.8 })) : [] }),
      log: LOG, walk: on => { walkKey = on; }, stop: on => { stopKey = on; }, start,
      warp: x => { xC = x; v = 0; }, shot: () => cv.toDataURL(), doors: t => { for (const d of streetData.doors) d.openT = t; },
      step: dt => { if (state !== "pause") update(dt); sample(dt); }, keys: (w, s) => { walkKey = w; stopKey = s; },
      freeze: on => { frozen = on; }, draw: () => draw(), ring: () => { ringCool = 0; strike(true); },
    };
  }

  Promise.all([fetch("assets/scene.json").then(r => r.json()), load("assets/sprites.png"), load("assets/houses.webp"), load("assets/ground.png"), load("assets/lights.png")])
    .then(([s, a, hImg, gImg, lImg]) => {
      SC = s; sprites = a; housesImg = hImg; groundImg = gImg; lightsImg = lImg;
      [actC, actX] = off(W, H); [tmpC, tmpX] = off(W, H);
      GLOW.pool = {}; GLOW.bulb = {}; GLOW.cone = {};
      for (const E of ERRANDS) {
        GLOW.pool[E.sign] = makeGlow(60, 22, E.lamp, 1.3);
        GLOW.bulb[E.sign] = makeGlow(16, 9, E.lamp.map(c2 => Math.min(255, c2 + 30)), 1.4);
        GLOW.cone[E.sign] = makeCone(E.lamp, KERB_Y - 4 - (KERB_Y + 2 - s.sprites.lamp[5] + s.points.lamp.lens[1]));
      }
      GLOW.candle = makeGlow(9, 9, [255, 196, 110], 1.8);
      reset(); ready = true;
    })
    .catch(() => { $("sub").textContent = "The tape would not load. Try the page again."; });
  requestAnimationFrame(frame);
})();
