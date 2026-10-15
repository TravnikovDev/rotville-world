/* Tea Cup Ride: Uncle Brewster pours for every cup on his ride.

   UNCLE BREWSTER (LORE 4.5) is a cream teapot with rosy cheeks and little feet who hosts the Tea Cup Ride, welcomes
   every visitor, keeps the ride running smoothly and collects funny mugs. He talks a great deal, mainly in happy
   noises. The user picked the game from the list on 2026-10-11: "Ok, let's  build Tea Cup Ride" (R1325).

   The ride turns and Brewster stands on its hub, pouring from his spout into the cup going by on his spout's side.
   Hold and he tips and pours; let go and he stands up, though the tea already in the air still lands, so the good
   pour lets go a little before the line. Each cup should leave the spout filled to its line: over the rim and
   the cup is lost, and under four tenths full its visitor has gone without. Three of either and the ride stops. As a cup goes
   round the back its visitor drinks, so it comes back lower, a different amount each time. For the first twenty
   seconds the ride turns slowly; then faster, and his funny mugs join it - a barrel mug, an egg cup, a noodle cup,
   a cauldron - each filling at its own speed and worth twice.

   Only pre-rendered sprites ship (assets/sprites.png): Brewster from his model, tipped whole as a teapot pours, and
   the library's cups; the ride, the fair and the tea are drawn here. */
(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  const W = 270, H = 480;
  const cv = $("c"), g = cv.getContext("2d");
  g.imageSmoothingEnabled = false;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k === "sound" ? "rotville.sound" : "teacup." + k) ?? (k === "sound" ? localStorage.getItem("teacup.sound") : null); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k === "sound" ? "rotville.sound" : "teacup." + k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
  };
  const load = src => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });
  const off = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d"); x.imageSmoothingEnabled = false; return [c, x]; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const wrap = a => { a = (a + Math.PI) % (2 * Math.PI); if (a < 0) a += 2 * Math.PI; return a - Math.PI; };

  /* ---------- the ride, seen from the front 40 degrees down: x across, y back from the hub, z up, in metres ---------- */
  const PPM = 64, SQ = Math.sin(40 * Math.PI / 180), CZ = Math.cos(40 * Math.PI / 180);
  const CX = 135, CY = 334;                       // the middle of the ride's floor
  const R_FLOOR = 1.95, R_HUB = 0.5, HUB_H = 0.3, SKIRT = 0.3;
  const toS = (x, y, z) => [CX + x * PPM, CY - (y * SQ + z * CZ) * PPM];
  let R_RING = 1.38;                              // set from where his spout pours, once the sprites are in
  const POUR = Math.PI;                           // the cups are poured into at the ring's left, on his spout's side
  const SLOTS = 10;

  /* ---------- the cups, and the tea ---------- */
  const KINDS = {
    cup: { cap: 1.0, worth: 1, name: "A teacup" },
    mug: { cap: 0.85, worth: 2, name: "The barrel mug" },
    eggcup: { cap: 0.5, worth: 2, name: "The egg cup" },
    noodles: { cap: 0.8, worth: 2, name: "The noodle cup" },
    cauldron: { cap: 1.15, worth: 2, name: "The cauldron" },
  };
  const FUNNY = ["mug", "eggcup", "noodles", "cauldron"];
  const TINTS = [[246, 170, 194], [168, 226, 198], [246, 226, 146], [172, 202, 244]];   // pink, mint, butter, sky
  const LINE = 0.85, PERFECT = 0.075, HALF = 0.4;   // the line, a perfect pour either side of it, the least a visitor will take
  const BRIM = 1.1;                               // tea stands a little proud of the rim before it spills over
  const FALL = 0.22;                              // seconds the tea takes from the spout to the cup
  const LOSE = 3;                                 // three cups gone, spilt or left dry, and the ride stops
  const EASY = 20;                                // seconds of slow turning at the start
  // the ride shifts up a gear every half minute after the quiet start, with a sign, a bell and the music quickening;
  // he pours faster with it, so a cup can be filled in the time it is under the spout - but there is more tea in the
  // air when he stops, and the visitors grow thirstier; ten gears or so in, he can pour no faster and the ride
  // outruns him
  const GEAR_EVERY = 30;
  const gearAt = T => (T < EASY ? 0 : 1 + Math.floor((T - EASY) / GEAR_EVERY));
  const omegaAt = T => 0.2 + 0.042 * gearAt(T);                                             // radians a second
  const perfectAt = T => (T < 45 ? 0.095 : PERFECT);
  const flowAt = om => clamp(2.0 * om, 0.45, 1.2);                                           // cups a second from the spout
  const COMBO = 3;                                // perfect pours in a row for each step of the combo
  const thirstAt = T => (T < EASY ? rnd(0.15, 0.3) : rnd(0.3, 0.45) + Math.min(0.3, 0.0015 * (T - EASY)));    // drunk a lap, as a share of the line
  const JOINS = [28, 52, 76, 100];                // when his funny mugs join the ride

  /* ---------- sound: the bed, the narrator, and the rest made on the spot ---------- */
  const LINES = [["start", "line-start"], ["lost", "line-lost"], ["end", "line-end"], ["mug", "line-mug"]];
  const audio = {
    ctx: null, on: store.get("sound", true), raw: {}, buf: {}, music: null,
    fetch() {
      for (const [k, f] of LINES) this.raw[k] = fetch("assets/" + f + ".mp3").then(r => (r.ok ? r.arrayBuffer() : null)).catch(() => null);
      this.raw.music = fetch("assets/garmon-yard.mp3").then(r => (r.ok ? r.arrayBuffer() : null)).catch(() => null);
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
        const s = c.createBufferSource(); s.buffer = b; s.loop = true; s.playbackRate.value = this.rate || 1; s.connect(this.mus); s.start(); this.music = s;
      });
      // the pour: a trickle, and under it the note of a cup filling, rising as it fills
      const s = c.createBufferSource(), bp = c.createBiquadFilter(); s.buffer = n; s.loop = true;
      bp.type = "bandpass"; bp.frequency.value = 1800; bp.Q.value = 0.9;
      this.trickle = c.createGain(); this.trickle.gain.value = 0;
      s.connect(bp).connect(this.trickle).connect(this.fxg); s.start();
      const o = c.createOscillator(); o.type = "sine"; o.frequency.value = 220;
      this.fillG = c.createGain(); this.fillG.gain.value = 0;
      o.connect(this.fillG).connect(this.fxg); o.start(); this.fillOsc = o;
    },
    pour(flow, inCup, level) {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      this.trickle.gain.setTargetAtTime(flow ? (inCup ? 0.07 : 0.12) : 0, t, 0.03);
      this.fillG.gain.setTargetAtTime(flow && inCup ? 0.05 : 0, t, 0.03);
      this.fillOsc.frequency.setTargetAtTime(240 + 620 * clamp(level, 0, 1.05), t, 0.04);
    },
    set(on) { this.on = on; store.set("sound", on); if (this.master) this.master.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.04); },
    // the waltz quickens with the ride, a gear at a time, and winds down when it stops
    speed(rate) {
      this.rate = rate;
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      if (this.music) { this.music.playbackRate.cancelScheduledValues(t); this.music.playbackRate.setTargetAtTime(rate, t, 0.5); }
      this.mus.gain.cancelScheduledValues(t); this.mus.gain.setTargetAtTime(0.26, t, 0.2);
    },
    windDown() {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      if (this.music) { this.music.playbackRate.cancelScheduledValues(t); this.music.playbackRate.setTargetAtTime(0.35, t, 0.8); }
      this.mus.gain.setTargetAtTime(0.0001, t + 0.6, 0.9);
    },
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
    clink() { this.tone(2093, 2090, 0.5, "sine", 0.07); this.tone(3136, 3130, 0.3, "sine", 0.04, 0.05); },
    served() { this.tone(1568, 1565, 0.3, "sine", 0.05); },
    crash() { this.noise(0.5, 0.18, 1200, 9000); this.tone(900, 300, 0.25, "triangle", 0.05); this.noise(0.25, 0.08, 200, 1200, 0.05); },
    dry() { this.tone(330, 196, 0.35, "square", 0.04); },
    splash() { this.noise(0.12, 0.05, 300, 2400); },
    // his happy noises: a little rising "hm-hm!"
    happy() { this.tone(520, 700, 0.09, "triangle", 0.05); this.tone(660, 880, 0.1, "triangle", 0.05, 0.11); },
    sad() { this.tone(500, 380, 0.16, "triangle", 0.05); this.tone(420, 300, 0.22, "triangle", 0.05, 0.17); },
    fanfare() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, f, 0.2, "triangle", 0.05, i * 0.09)); },
    faster() { this.tone(1319, 1317, 0.35, "sine", 0.07); this.tone(1568, 1566, 0.5, "sine", 0.07, 0.14); this.noise(0.5, 0.04, 600, 3000, 0.05); },
    drip() { this.tone(1900, 1250, 0.07, "sine", 0.025); },
  };
  window.rvBuzz?.on(audio, { clink: "great", served: "tap", crash: "lose", dry: "bump" });
  audio.fetch();

  /* ---------- state ---------- */
  let SC, atlas, tinted = [], outlines = {}, ready = false;
  let state = "ready";                            // ready, play, stopping, pause, over
  let T = 0, clock = 0, theta = 0, omega = 0.22, holding = false, padHold = false, keyHold = false;
  let tilt = 0, flowing = 0, packets = [], cups = [], lost = 0, score = 0, streak = 0, endT = 0, joinK = 0, refillT = 0;
  let pops = [], drops = [], steam = [], gone = [], hop = 0;
  let stains = [], falling = [], ripples = [], dripT = 1.2, wasFlowing = false, gear = 0, wheelA = 0, chase = 0, comboK = 1, shake = 0;
  let best = store.get("best", 0), saidStart = false, saidLost = false, saidMug = false;
  const LOG = location.hash === "#debug" ? [] : null;
  const ev = (type, more) => { if (LOG) LOG.push(Object.assign({ type, t: +T.toFixed(2) }, more || {})); };

  function newCup(kind, slot, level) {
    return { kind, slot, tint: kind === "cup" ? slot % TINTS.length : -1, L: level, thirst: thirstAt(T), drunk: 0, inWin: false, got: false,
             spin: Math.random() * 12, spinV: rnd(0.6, 1.2) * (Math.random() < 0.5 ? -1 : 1), born: clock };
  }
  const phiOf = c => c.slot * 2 * Math.PI / SLOTS + theta;
  // a cup's own axis, which is not the middle of its drawing when it has a handle, goes round as the cup spins: its
  // offset on the ride's floor, in metres, for a turn of the cup counted in drawings
  const offAt = (V, sp) => { const v = sp * 2 * Math.PI / V.frames.length, [a, b] = V.off; return [a * Math.cos(v) - b * Math.sin(v), a * Math.sin(v) + b * Math.cos(v)]; };
  // how far round the ride a cup's mouth is from the spout, and how far either side of it the cup takes the tea: its
  // mouth, or the reach the ride had before the mouths were measured, whichever is wider
  const atSpout = c => { const ph = phiOf(c), [dx, dy] = offAt(SC.vessels[c.kind], c.spin); return wrap(Math.atan2(R_RING * Math.sin(ph) + dy, R_RING * Math.cos(ph) + dx) - POUR); };
  const halfOpen = c => { const V = SC.vessels[c.kind]; return Math.max(V.win / PPM * 0.85, V.r[V.r.length - 1] / PPM * 0.92) / R_RING; };

  function hud() {
    $("score").textContent = score + (score === 1 ? " CUP" : " CUPS");
    $("best").textContent = "Most cups " + best;
  }

  function reset() {
    T = 0; theta = 0; omega = omegaAt(0); tilt = 0; flowing = 0; packets = []; lost = 0; score = 0; streak = 0; endT = 0; joinK = 0; refillT = 0;
    pops = []; drops = []; steam = []; gone = []; hop = 0;
    stains = []; falling = []; ripples = []; dripT = 1.2; wasFlowing = false; gear = 0; comboK = 1; shake = 0;
    audio.speed(1);
    // six of the ride's own teacups to begin with, room left for his funny mugs, the first a few seconds off the spout
    theta = POUR + 0.55;
    cups = [0, 2, 3, 5, 7, 8].map(s => newCup("cup", s, rnd(0.5, 0.7)));
    for (const c of cups) c.inWin = Math.abs(atSpout(c)) < halfOpen(c);
    hud();
  }

  function start() {
    audio.unlock();
    reset();
    state = "play";
    $("ready").hidden = true; $("over").hidden = true;
    $("static").classList.remove("on");
    if (!saidStart) { saidStart = true; say("start", "Uncle Brewster runs the Tea Cup Ride."); }
  }

  function say(key, text) {
    const sub = $("sub");
    sub.textContent = text;
    audio.line(key).then(d => setTimeout(() => { if (sub.textContent === text) sub.textContent = ""; }, Math.max(1800, d * 1000 + 300)));
  }
  function news(name, where, label) {
    const el = $("news");
    $("news-name").textContent = name;
    el.querySelector(".tc-street-where").textContent = where || "from his collection, worth twice";
    el.querySelector(".tc-street-no").textContent = label || "ON THE RIDE";
    el.hidden = false; el.classList.remove("in"); void el.offsetWidth; el.classList.add("in");
    setTimeout(() => { el.hidden = true; }, 2900);
  }

  function pop(x, y, text, col) { pops.push({ x, y, text, col, t: 0 }); }
  function bump() { const el = $("score"); el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump"); setTimeout(() => el.classList.remove("bump"), 160); }

  function strike(c, why) {
    lost += 1; streak = 0; comboK = 1; shake = 0.3; ev(why, { kind: c.kind, L: +c.L.toFixed(2) });
    if (lost >= LOSE) { state = "stopping"; endT = 0; audio.pour(0, false, 0); audio.windDown(); }
  }

  // a cup leaves the spout: how well was it poured?
  function judge(c) {
    const [x, y] = cupScreen(c);
    if (!c.got && c.L >= HALF) { c.drunk = 0; c.thirst = thirstAt(T); return; }       // not poured, and still enough in it
    if (c.L >= HALF) {
      const perfect = Math.abs(c.L - LINE) <= perfectAt(T);
      if (perfect) { streak += 1; comboK = 1 + Math.min(3, Math.floor((streak - 1) / COMBO)); } else { streak = 0; comboK = 1; }
      const pts = (perfect ? 2 : 1) * KINDS[c.kind].worth * comboK;
      score += pts; bump(); hud();
      if (score > best) { best = score; store.set("best", best); hud(); }
      if (perfect) {
        audio.clink(); audio.happy(); hop = 0.35; c.jump = 0.3;
        pop(x, y - 30, "+" + pts + " ★" + (comboK > 1 ? " ×" + comboK : ""), comboK > 1 ? "#ffb4d0" : "#ffe7a8");
        for (let i = 0; i < 8 + 4 * comboK; i++) drops.push({ x: x + rnd(-8, 8), y: y - 22, vx: rnd(-40, 40), vy: rnd(-90, -30), t: 0, c: i % 3 ? "#fff3c4" : "#ffb4d0" });
      } else { audio.served(); pop(x, y - 30, "+" + pts, "#f3e6c8"); }
      ev(perfect ? "perfect" : "served", { kind: c.kind, L: +c.L.toFixed(2) });
    } else {
      // left the spout under the least a visitor will take: its visitor has gone without
      audio.dry(); audio.sad(); pop(x, y - 30, "DRY", "#ff9a8a");
      strike(c, "dry");
      c.L = Math.max(c.L, 0);
    }
    c.got = false; c.drunk = 0; c.thirst = thirstAt(T);
  }

  // over the rim: the cup is lost, tea everywhere
  function spill(c) {
    const [x, y] = cupScreen(c);
    audio.crash(); audio.sad(); pop(x, y - 34, "SPILT", "#ff9a8a");
    for (let i = 0; i < 14; i++) drops.push({ x: x + rnd(-10, 10), y: y - 18, vx: rnd(-60, 60), vy: rnd(-90, -20), t: 0, c: i % 2 ? "#8a4a22" : "#b8743a" });
    gone.push({ c, x, y, t: 0 });
    const ph = phiOf(c);
    stain(R_RING * Math.cos(ph), R_RING * Math.sin(ph), 9 + 3 * Math.random());
    cups = cups.filter(k => k !== c);
    strike(c, "spill");
    if (!saidLost && state === "play") { saidLost = true; setTimeout(() => say("lost", "That was one of his good cups."), 600); }
  }

  function end() {
    state = "over";
    window.rvBuzz?.("over");
    audio.pour(0, false, 0);
    $("over-title").textContent = "The ride has stopped.";
    $("over-line").textContent = score === 0 ? "Uncle Brewster poured for no one." : "Uncle Brewster poured " + score + (score === 1 ? " cup." : " cups.");
    $("over-stats").textContent = score > 0 && score === best ? "The most he has poured" : "Most cups " + best;
    hud();
    say("end", "The ride has stopped. He is still smiling.");
    setTimeout(() => { if (state === "over") { $("over").hidden = false; $("again").focus({ preventScroll: true }); } }, 1500);
  }

  /* ---------- a frame of the world ---------- */
  // tea on the ride's floor: a stain where it fell, kept in the floor's own turning, fading slowly; one near another
  // grows it instead
  function stain(gx, gy, size) {
    const r = Math.hypot(gx, gy), a = Math.atan2(gy, gx) - theta;
    if (r > R_FLOOR - 0.15 || r < R_HUB + 0.05) return;
    const near = stains.find(k => Math.abs(k.r - r) < 0.08 && Math.abs(wrap(k.a - a)) < 0.06 / Math.max(0.3, r));
    if (near) { near.size = Math.min(14, near.size + size * 0.35); near.t = Math.min(near.t, 2); return; }
    stains.push({ r, a, size, t: 0 });
    if (stains.length > 90) stains.shift();
  }
  // a drop let go from the spout: it falls straight down, into a cup if one is there, or onto the floor
  function drip(x, y, floorY) { falling.push({ x, y, vy: 20, floorY }); }

  function update(dt) {
    clock += dt;
    for (const p of pops) { p.t += dt; p.y -= 16 * dt; }
    pops = pops.filter(p => p.t < 1.1);
    for (const d of drops) {
      d.t += dt; d.x += d.vx * dt; d.y += d.vy * dt; d.vy += 260 * dt;
      // a drop of tea coming down on the ride's floor leaves its mark there
      if (d.floorY !== undefined && d.vy > 0 && d.y >= d.floorY) { stain((d.x - CX) / PPM, (CY - d.floorY) / (PPM * SQ), rnd(1.8, 2.6)); d.t = 9; }
    }
    drops = drops.filter(d => d.t < (d.floorY !== undefined ? 1.6 : 0.9));
    for (const s2 of steam) { s2.t += dt; s2.y -= 9 * dt; s2.x += Math.sin(s2.t * 3 + s2.ph) * 4 * dt; }
    steam = steam.filter(s2 => s2.t < 1.4);
    for (const k of gone) k.t += dt;
    gone = gone.filter(k => k.t < 0.9);
    for (const k of stains) k.t += dt;
    stains = stains.filter(k => k.t < 45);
    for (const r of ripples) r.t += dt;
    ripples = ripples.filter(r => r.t < 0.45);
    for (const c of cups) if (c.jump > 0) c.jump = Math.max(0, c.jump - dt);
    hop = Math.max(0, hop - dt); shake = Math.max(0, shake - dt);
    // the drops falling from the spout
    for (const f of falling) {
      f.vy += 420 * dt; f.y += f.vy * dt;
      // into the tea of a cup under the spout, or down to the floor
      const under = cups.find(c => Math.abs(atSpout(c)) < halfOpen(c));
      if (f.y >= (under ? landing(under)[1] : f.floorY)) {
        f.done = true;
        if (under) { under.L += 0.004; ripples.push({ c: under, t: 0 }); }
        else { stain((f.x - CX) / PPM, (CY - f.floorY) / (PPM * SQ), 2.2); drops.push({ x: f.x, y: f.floorY, vx: rnd(-20, 20), vy: rnd(-30, -10), t: 0.5, c: "#a0602c" }); }
        audio.drip();
      }
    }
    falling = falling.filter(f => !f.done);
    // the big wheel and the bulbs run with the ride
    wheelA += dt * (0.06 + 0.5 * (omega - 0.18)); chase += dt * (2 + 10 * omega);
    if (state === "stopping") {
      endT += dt; omega = Math.max(0, omega - dt * 0.3); theta += omega * dt; tilt = Math.max(0, tilt - 200 * dt);
      for (const c of cups) c.spin += c.spinV * omega * 12 / (2 * Math.PI) * dt * 3;
      if (endT > 2.4) end();
      return;
    }
    if (state !== "play") return;
    T += dt;
    // a gear up every half minute: the sign, the bell, the waltz quickening; the ride eases up to its new speed
    const g2 = gearAt(T);
    if (g2 !== gear) {
      gear = g2;
      if (gear > 0) { audio.faster(); audio.speed(1 + 0.035 * gear); news("Faster", "the ride speeds up", "GEAR " + (gear + 1)); shake = 0.25; ev("gear", { gear }); }
    }
    omega += (omegaAt(T) - omega) * Math.min(1, dt * 1.5);
    theta += omega * dt;
    // Brewster tips over to pour while held, and stands up when let go; the tea flows once he has tipped far enough
    const want = holding || padHold || keyHold;
    tilt = want ? Math.min(36, tilt + 220 * dt) : Math.max(0, tilt - 200 * dt);
    flowing = clamp((tilt - 22) / 12, 0, 1);
    const flow = flowAt(omega) * flowing;
    if (flow > 0) packets.push({ t0: clock, q: flow * dt });
    // let go, and a drop or two still comes off the spout; standing, a drip now and then
    const B = brewsterKey(), tipNow = spoutAt(B);
    if (wasFlowing && flowing <= 0 && tipNow) { setTimeout(() => { const t2 = spoutAt(brewsterKey()); if (t2) drip(t2[0], t2[1], CY - 2); }, 160); setTimeout(() => { const t2 = spoutAt(brewsterKey()); if (t2) drip(t2[0], t2[1], CY - 2); }, 380); }
    wasFlowing = flowing > 0;
    if (tilt < 2 && !packets.length && tipNow) { dripT -= dt; if (dripT <= 0) { dripT = rnd(1.1, 2.0); drip(tipNow[0], tipNow[1] + 1, CY - 2); } }
    // the tea in the air lands where the spout pours: in the cup there, or on the ride's floor
    const under = cups.find(c => Math.abs(atSpout(c)) < halfOpen(c));
    let floorTea = 0;
    while (packets.length && clock - packets[0].t0 >= FALL) {
      const p = packets.shift();
      if (under) {
        under.L += p.q / KINDS[under.kind].cap; under.got = true;
        if (Math.random() < 0.18) ripples.push({ c: under, t: 0 });
        // now and then a drop jumps out over the rim and lands on the floor beside the cup
        if (Math.random() < 0.05) {
          const [V, fi, s1] = frameOf(under), [ux, uy] = cupScreen(under), m = levelAt(V, fi, 1, s1), side = Math.random() < 0.5 ? -1 : 1;
          drops.push({ x: ux - s1[4] + m[0] + side * m[2] * 0.8, y: uy - s1[5] + m[1], vx: side * rnd(25, 50), vy: rnd(-60, -30), t: 0, c: "#8a4a22", floorY: uy + rnd(-5, 6) });
        }
        if (under.L > BRIM) { spill(under); break; }
      } else floorTea += p.q;
    }
    if (floorTea > 0) {
      // missed: it splashes on the ride's floor and stays there as a stain
      const gx = R_RING * Math.cos(POUR) + rnd(-0.06, 0.06), gy = rnd(-0.08, 0.08);
      stain(gx, gy, 1.2 + floorTea * 20);
      if (Math.random() < 0.5) { const [lx, ly] = landing(null); drops.push({ x: lx + rnd(-3, 3), y: ly, vx: rnd(-35, 35), vy: rnd(-55, -20), t: 0, c: "#a0602c" }); }
      if (Math.random() < 0.12) audio.splash();
    }
    audio.pour(flowing > 0 || packets.length > 0, !!under, under ? under.L : 0);
    // the cups: turning on their own, their visitors drinking round the back, judged as they leave the spout
    for (const c of cups.slice()) {
      const ph = phiOf(c), d = atSpout(c), inside = Math.abs(d) < halfOpen(c);
      c.spin += c.spinV * dt * (2 + 5 * omega);
      if (c.inWin && !inside && d > 0) judge(c);
      c.inWin = inside;
      // round the back (from the spout's far side to the front) its visitor drinks a little at a time
      const back = Math.sin(ph) > 0;
      if (back && c.drunk < c.thirst) {
        const sip = Math.min(c.thirst - c.drunk, omega * dt / Math.PI * c.thirst * 1.4);
        c.drunk += sip; c.L = Math.max(0, c.L - sip * LINE);
      }
      // a cup brimming over runs down its side and drips on the floor
      if (c.L > 1.0 && Math.random() < dt * 6) { const [x, y] = cupScreen(c); drops.push({ x: x + rnd(-8, 8), y: y - 16, vx: rnd(-6, 6), vy: 10, t: 0.2, c: "#8a4a22" }); stain(R_RING * Math.cos(ph) + rnd(-0.1, 0.1), R_RING * Math.sin(ph) + rnd(-0.05, 0.05), 1.4); }
      if (c.L > 0.5 && Math.random() < dt * 0.8 && !reduce) { const [x, y] = cupScreen(c); steam.push({ x: x + rnd(-4, 4), y: y - 26, t: 0, ph: Math.random() * 6 }); }
    }
    if (state !== "play") return;
    // his funny mugs join the ride, each into a free place as it goes round the back
    if (joinK < JOINS.length && T >= JOINS[joinK]) {
      const s3 = freeSlot();
      if (s3 >= 0) {
        const kind = FUNNY[joinK]; joinK += 1;
        cups.push(newCup(kind, s3, rnd(0.2, 0.45)));
        audio.fanfare(); news(KINDS[kind].name);
        if (!saidMug) { saidMug = true; setTimeout(() => say("mug", "He has brought out a funny mug."), 900); }
        ev("join", { kind });
      }
    }
    // a lost cup's place is filled again before long with one of the ride's own
    refillT += dt;
    if (refillT > 22 && cups.length < 6 + joinK) {
      const s3 = freeSlot();
      if (s3 >= 0) { refillT = 0; cups.push(newCup("cup", s3, rnd(0.25, 0.5))); ev("refill"); }
    }
  }
  // a free place on the ride round the back, where a cup can be set down unseen by the spout
  function freeSlot() {
    const used = new Set(cups.map(c => c.slot));
    let bestS = -1, bestV = -2;
    for (let s = 0; s < SLOTS; s++) {
      if (used.has(s)) continue;
      const v = Math.sin(s * 2 * Math.PI / SLOTS + theta);
      if (v > bestV) { bestV = v; bestS = s; }
    }
    return bestV > 0.3 ? bestS : -1;
  }

  /* ---------- where things are on the screen ---------- */
  function cupScreen(c) { const ph = phiOf(c); return toS(R_RING * Math.cos(ph), R_RING * Math.sin(ph), 0).map(Math.round); }
  // the point the tea lands on: the top of the cup under the spout, or the floor
  function landing(c) {
    const [x, y] = toS(R_RING * Math.cos(POUR), R_RING * Math.sin(POUR), 0);
    if (!c) return [Math.round(x), Math.round(y)];
    const V = SC.vessels[c.kind], L = clamp(c.L, 0, 1);
    return [Math.round(x), Math.round(y - lerp(V.floorH, V.rimH, L))];
  }
  function brewsterKey() {
    if (tilt > 0.5) {
      const T2 = SC.brewster.tilt; let k = 0;
      for (let i = 0; i < T2.length; i++) if (Math.abs(T2[i][0] - tilt) < Math.abs(T2[k][0] - tilt)) k = i;
      return T2[k];
    }
    const sq = SC.brewster.squash;
    if (hop > 0) return [0, hop > 0.18 ? sq[1] : sq[0], null];
    return [0, Math.floor(clock * 2.2) % 2 ? sq[0] : SC.brewster.tilt[0][1], null];
  }
  const HUB_TOP = () => toS(0, 0, HUB_H);
  function spoutAt(B) {
    const tip = B[2] || SC.brewster.tilt[0][2], name = B[2] ? B[1] : SC.brewster.tilt[0][1];
    const s2 = SC.sprites[name], [hx, hy] = HUB_TOP();
    return [hx - s2[4] + tip[0], hy - s2[5] + tip[1]];
  }

  /* ---------- drawing ---------- */
  // round every drawing of a cup, an outline to pick it out by: two pixels of gold (a paler gold for the next cup)
  // and a dark pixel outside them, so it shows on the pale floor too
  function makeOutlines() {
    const names = new Set(Object.values(SC.vessels).flatMap(v => v.frames));
    for (const name of names) {
      const s = SC.sprites[name], W = s[2] + 6, H = s[3] + 6, [, x0] = off(W, H);
      x0.drawImage(atlas, s[0], s[1], s[2], s[3], 3, 3, s[2], s[3]);
      const A = x0.getImageData(0, 0, W, H).data, on = (i, j) => i >= 0 && j >= 0 && i < W && j < H && A[(j * W + i) * 4 + 3] > 0;
      const dist = new Uint8Array(W * H);
      for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
        if (on(i, j)) continue;
        for (let dj = -3; dj <= 3; dj++) for (let di = -3; di <= 3; di++) {
          const m = Math.abs(di) + Math.abs(dj);
          if (m <= 3 && (!dist[j * W + i] || m < dist[j * W + i]) && on(i + di, j + dj)) dist[j * W + i] = m;
        }
      }
      const paint = rgb => {
        const [c, x] = off(W, H), img = x.createImageData(W, H);
        for (let k = 0; k < W * H; k++) { if (!dist[k]) continue; img.data.set(dist[k] <= 2 ? [rgb[0], rgb[1], rgb[2], 255] : [42, 16, 40, 230], k * 4); }
        x.putImageData(img, 0, 0);
        return c;
      };
      outlines[name] = [paint([255, 214, 90]), paint([255, 240, 200])];
    }
  }
  function spr(name, x, y, img) {
    const s = SC.sprites[name];
    if (!s) return;
    g.drawImage(img || atlas, s[0], s[1], s[2], s[3], Math.round(x - s[4]), Math.round(y - s[5]), s[2], s[3]);
  }
  // an ellipse filled in whole pixels, each row cut to another ellipse (the cup's mouth) when one is given
  function fillEll(cx, cy, rx, ry, clip) {
    for (let y = Math.ceil(cy - ry); y <= Math.floor(cy + ry); y++) {
      const t = (y + 0.5 - cy) / ry; if (Math.abs(t) > 1) continue;
      let a = cx - rx * Math.sqrt(1 - t * t), b = cx + rx * Math.sqrt(1 - t * t);
      if (clip) { const u = (y + 0.5 - clip[1]) / clip[3]; if (Math.abs(u) >= 1) continue; const w = clip[2] * Math.sqrt(1 - u * u); a = Math.max(a, clip[0] - w); b = Math.min(b, clip[0] + w); }
      if (b - a >= 0.5) g.fillRect(Math.round(a), y, Math.round(b) - Math.round(a), 1);
    }
  }
  function ringEll(cx, cy, rx, ry, dash) {
    for (let k = 0; k < 72; k++) {
      if (dash && (k >> 1) % 2) continue;
      const a = k / 72 * 2 * Math.PI; g.fillRect(Math.round(cx + rx * Math.cos(a)), Math.round(cy + ry * Math.sin(a)), 1, 1);
    }
  }
  // the far half of an ellipse's edge, a pixel at a time: the line on a cup's inside wall; trim leaves out that many
  // of its 64 steps at either end, where the wall turns away to the sides
  function farArc(cx, cy, rx, ry, clip, dash, trim = 0) {
    for (let k = trim; k <= 64 - trim; k++) {
      if (dash && (k >> 1) % 2) continue;
      const a = Math.PI + Math.PI * k / 64, x = Math.round(cx + rx * Math.cos(a)), y = Math.round(cy + ry * Math.sin(a));
      if (clip) { const u = (y + 0.5 - clip[1]) / clip[3], w = clip[2] * Math.sqrt(Math.max(0, 1 - u * u)); if (Math.abs(u) >= 1 || x < clip[0] - w || x > clip[0] + w) continue; }
      g.fillRect(x, y, 1, 1);
    }
  }

  // the drawing a cup is shown in now: its vessel, the drawing's number and the drawing
  const frameOf = c => { const V = SC.vessels[c.kind], n = V.frames.length, fi = ((Math.floor(c.spin) % n) + n) % n; return [V, fi, SC.sprites[V.frames[fi]]]; };
  // the top of the tea at level L (0 the inside floor, 1 the rim) in drawing fi: an ellipse round the cup's own axis,
  // in the drawing's pixels, its size the inside of the cup measured at that height
  function levelAt(V, fi, L, s) {
    const [dx, dy] = offAt(V, fi), t = clamp(L, 0, 1), k = t * (V.r.length - 1), i = Math.min(V.r.length - 2, Math.floor(k));
    const r = lerp(V.r[i], V.r[i + 1], k - i);
    return [s[4] + dx * PPM, s[5] - dy * SQ * PPM - lerp(V.floorH, V.rimH, t), r, r * SQ];
  }
  // a row of pixels from xa to xb, cut to an ellipse
  function runIn(xa, xb, y, clip) {
    const u = (y + 0.5 - clip[1]) / clip[3]; if (Math.abs(u) >= 1) return;
    const w = clip[2] * Math.sqrt(1 - u * u), a = Math.round(Math.max(xa, clip[0] - w)), b = Math.round(Math.min(xb, clip[0] + w));
    if (b > a) g.fillRect(a, y, b - a, 1);
  }

  function drawCup(c) {
    const [V, fi, s] = frameOf(c), f = V.frames[fi];
    const [x, y0] = cupScreen(c), y = y0 - Math.round(c.jump > 0 ? 5 * Math.sin(Math.PI * (0.3 - c.jump) / 0.3) : 0);
    // its shadow on the ride's floor
    g.fillStyle = "rgba(40,10,30,.35)"; fillEll(x, y + 1, s[2] * 0.42, s[2] * 0.42 * SQ * 0.55);
    if (state === "play" && (c.inWin || c.next) && outlines[f]) {
      g.globalAlpha = c.inWin ? 0.8 + 0.2 * Math.sin(clock * 12) : 0.55;
      g.drawImage(outlines[f][c.inWin ? 0 : 1], Math.round(x - s[4]) - 3, Math.round(y - s[5]) - 3); g.globalAlpha = 1;
    }
    const pop0 = Math.min(1, (clock - c.born) / 0.25);
    if (pop0 < 1) { g.globalAlpha = pop0; }
    spr(f, x, y, c.tint >= 0 ? tinted[c.tint] : atlas);
    g.globalAlpha = 1;
    // the tea in it: its top an ellipse round the cup's own axis at its level, seen only through the cup's mouth
    const ox = x - s[4], oy = y - s[5], at = L2 => { const e = levelAt(V, fi, L2, s); return [ox + e[0], oy + e[1], e[2], e[3]]; };
    const mouth = at(1), L = clamp(c.L, 0, 1);
    if (c.L > 1.0) {
      // brimming: the tea fills the mouth, its light shaking
      const wob = reduce ? 0 : Math.round(Math.sin(clock * 22));
      g.fillStyle = "#7a3e1c"; fillEll(mouth[0], mouth[1], mouth[2], mouth[3]);
      g.fillStyle = "#9a5428"; fillEll(mouth[0], mouth[1] - 0.5, mouth[2] * 0.86, mouth[3] * 0.7, mouth);
      g.fillStyle = "#e0a466"; runIn(mouth[0] - mouth[2] * 0.4 + wob, mouth[0] - mouth[2] * 0.05 + wob, Math.round(mouth[1] - mouth[3] * 0.45), mouth);
    } else if (L > 0.02) {
      const [tx, ty, rx, ry] = at(L);
      g.fillStyle = "#7a3e1c"; fillEll(tx, ty, rx, ry, mouth);
      g.fillStyle = "#9a5428"; fillEll(tx, ty - 0.5, rx * 0.86, ry * 0.7, mouth);
      g.fillStyle = "#c98a4e"; runIn(tx - rx * 0.4, tx - rx * 0.05, Math.round(ty - ry * 0.45), mouth);
      // ripples where the tea comes down into it
      if (c.inWin) for (const r of ripples) {
        if (r.c !== c) continue;
        const u = r.t / 0.45; g.globalAlpha = 1 - u; g.fillStyle = "#d7a066";
        farArc(tx, ty, rx * (0.2 + 0.7 * u), ry * (0.2 + 0.7 * u), mouth); g.globalAlpha = 1;
      }
    }
    // the line to pour to, on the far wall: a light line between two dark ones, so it shows on every cup and above
    // the tea; green while the tea he has poured will bring the level to it, the moment to let go
    if (L < LINE - 0.02) {
      const [gx, gy, grx, gry] = at(LINE);
      const P = c.inWin ? c.L + packets.reduce((a2, p) => a2 + p.q, 0) / KINDS[c.kind].cap : c.L;
      g.fillStyle = "#2a1028"; farArc(gx, gy - 1, grx, gry, mouth, false, 6); farArc(gx, gy + 1, grx, gry, mouth, false, 6);
      g.fillStyle = c.inWin && packets.length && Math.abs(P - LINE) <= perfectAt(T) ? "#7dff8e" : "#ffffff"; farArc(gx, gy, grx, gry, mouth, false, 6);
    }
    // while he pours into it: where the level will be once the tea in the air has landed, dashed white, red over the rim
    if (c.inWin && packets.length) {
      const P = c.L + packets.reduce((a2, p) => a2 + p.q, 0) / KINDS[c.kind].cap, Lp = Math.min(P, 1);
      if (Lp > L + 0.02 && Math.abs(Lp - LINE) > 0.02) {
        const [px, py, prx, pry] = at(Lp);
        g.fillStyle = "#2a1028"; farArc(px, py + 1, prx, pry, mouth, true, 6);
        g.fillStyle = P > 1.0 ? "#ff5a4a" : "#ffffff"; farArc(px, py, prx, pry, mouth, true, 6);
      }
    }
    // the next cup coming to the spout: a little arrow over it
    if (c.next) {
      const by = Math.round(oy - 8 + Math.sin(clock * 8) * 2);
      g.fillStyle = "#1a1030"; g.fillRect(x - 5, by - 1, 11, 6);
      g.fillStyle = "#ffe7a8"; g.fillRect(x - 4, by, 9, 1); g.fillRect(x - 3, by + 1, 7, 1); g.fillRect(x - 2, by + 2, 5, 1); g.fillRect(x - 1, by + 3, 3, 1); g.fillRect(x, by + 4, 1, 1);
    }
  }

  function drawStream() {
    if (!packets.length && flowing <= 0) return;
    const B = brewsterKey(); if (!B[2] && !packets.length) return;
    const [x0, y0] = spoutAt(B);
    const under = cups.find(c => Math.abs(atSpout(c)) < halfOpen(c));
    let [x1, y1] = landing(under), yEnd = y1;
    if (under) {
      // he aims into the cup's mouth; below the mouth's near edge the tea is behind the cup's wall
      const [V, fi, s] = frameOf(under), [cx, cy] = cupScreen(under), m = levelAt(V, fi, 1, s), mx = cx - s[4] + m[0], my = cy - s[5] + m[1];
      x1 = clamp(x1, mx - m[2] * 0.7, mx + m[2] * 0.7);
      const u = (x1 - mx) / m[2]; yEnd = Math.min(y1, my + m[3] * Math.sqrt(Math.max(0, 1 - u * u)));
    }
    const at = u => [lerp(x0, x1, 1 - (1 - u) * (1 - u)), lerp(y0, y1, u * u)];
    g.fillStyle = "#8a4a22";
    for (const p of packets) {
      const [x, y] = at(clamp((clock - p.t0) / FALL, 0, 1));
      if (y <= yEnd) g.fillRect(Math.round(x) - 1, Math.round(y), 3, Math.max(1, Math.min(2, Math.round(yEnd - y))));
    }
    g.fillStyle = "#c98a4e";
    for (let i = 0; i < packets.length; i += 3) {
      const [x, y] = at(clamp((clock - packets[i].t0) / FALL, 0, 1));
      if (y < yEnd) g.fillRect(Math.round(x) - 1, Math.round(y), 1, 1);
    }
  }

  // the ride's floor, painted in wedges that turn with it, worked out once a pixel and coloured each frame
  let floorPix = null, floorImg = null, floorC = null, floorX = null;
  const WEDGE = [[244, 186, 204], [250, 236, 214]], EDGE = [196, 98, 128], TRACK = [230, 160, 182];
  function buildFloor() {
    const rx = R_FLOOR * PPM, ry = R_FLOOR * PPM * SQ, w = Math.ceil(2 * rx) + 2, h = Math.ceil(2 * ry) + 2;
    [floorC, floorX] = off(w, h); floorImg = floorX.createImageData(w, h);
    floorPix = [];
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const gx = (i + 0.5 - w / 2) / PPM, gy = -(j + 0.5 - h / 2) / (PPM * SQ), r = Math.hypot(gx, gy);
      if (r > R_FLOOR) continue;
      floorPix.push([(j * w + i) * 4, Math.atan2(gy, gx), r, gy]);
    }
    floorC.ox = Math.round(CX - w / 2); floorC.oy = Math.round(CY - h / 2);
  }
  function drawFloor() {
    const d = floorImg.data, n = 16;
    for (const [k, a, r, gy] of floorPix) {
      let col;
      if (r > R_FLOOR - 0.12) col = EDGE;
      else if (Math.abs(r - R_RING) < 0.04) col = TRACK;
      else { const w = Math.floor((((a - theta) / (2 * Math.PI)) * n % n + n) % n); col = WEDGE[w & 1]; }
      const shade = 0.82 + 0.18 * (1 - (gy + R_FLOOR) / (2 * R_FLOOR));       // the back of the ride a little darker
      d[k] = col[0] * shade; d[k + 1] = col[1] * shade; d[k + 2] = col[2] * shade; d[k + 3] = 255;
    }
    floorX.putImageData(floorImg, 0, 0);
    // the skirt round its front, lights in it turning with the ride
    const rx = R_FLOOR * PPM, ry = R_FLOOR * PPM * SQ, sk = Math.round(SKIRT * CZ * PPM);
    for (let x = Math.ceil(CX - rx); x <= Math.floor(CX + rx); x++) {
      const t = (x + 0.5 - CX) / rx, y0 = Math.round(CY + ry * Math.sqrt(Math.max(0, 1 - t * t)));
      g.fillStyle = "#7c2e48"; g.fillRect(x, y0, 1, sk);
      g.fillStyle = "#a8466a"; g.fillRect(x, y0, 1, 2);
      g.fillStyle = "#4a1a2e"; g.fillRect(x, y0 + sk - 2, 1, 2);
    }
    for (let k = 0; k < 24; k++) {
      const a = k * 2 * Math.PI / 24 + theta; if (Math.sin(a) > -0.05) continue;     // only the front half's lights show
      const x = Math.round(CX + rx * Math.cos(a)), y0 = Math.round(CY - ry * Math.sin(a));
      const on = (k + Math.floor(clock * 4)) % 3 !== 0;
      g.fillStyle = on ? "#ffe9a8" : "#8a5a3a"; g.fillRect(x - 1, y0 + Math.round(sk / 2) - 1, 2, 2);
    }
    g.drawImage(floorC, floorC.ox, floorC.oy);
  }
  function drawHub() {
    const rx = R_HUB * PPM, ry = R_HUB * PPM * SQ, hh = Math.round(HUB_H * CZ * PPM), [, ty] = toS(0, 0, HUB_H);
    // its side, striped and turning, then its top
    for (let x = Math.ceil(CX - rx); x <= Math.floor(CX + rx); x++) {
      const t = (x + 0.5 - CX) / rx, yb = Math.round(CY + ry * Math.sqrt(Math.max(0, 1 - t * t)));
      const a = Math.acos(clamp(t, -1, 1)) + theta * 1, stripe = Math.floor(((a / (2 * Math.PI)) * 12 % 12 + 12) % 12) & 1;
      g.fillStyle = stripe ? "#e8c25a" : "#f6ecd2"; g.fillRect(x, yb - hh, 1, hh);
      g.fillStyle = "rgba(60,20,40,.25)"; g.fillRect(x, yb - 2, 1, 2);
    }
    g.fillStyle = "#c79a3e"; fillEll(CX, ty, rx, ry);
    g.fillStyle = "#e9c86c"; fillEll(CX, ty - 1, rx - 2, ry - 1.5);
  }

  // the fair at night: the sky, a big wheel turning slowly, the stalls' roofs, strings of bulbs, the ride's sign
  let bgC = null;
  function buildBack() {
    const [c, x] = off(W, H); bgC = c;
    const sky = x.createLinearGradient(0, 0, 0, 290);
    sky.addColorStop(0, "#0d0a24"); sky.addColorStop(0.6, "#22184a"); sky.addColorStop(1, "#3a2556");
    x.fillStyle = sky; x.fillRect(0, 0, W, H);
    let a = 9;
    const R = () => { a = (a * 16807) % 2147483647; return a / 2147483647; };
    for (let i = 0; i < 60; i++) { x.fillStyle = R() < 0.3 ? "rgba(255,250,230,.9)" : "rgba(255,250,230,.45)"; x.fillRect(Math.floor(R() * W), Math.floor(R() * 220), 1, 1); }
    // the ground of the fair, and the stalls' roofs along the back
    x.fillStyle = "#1a1230"; x.fillRect(0, 262, W, H - 262);
    x.fillStyle = "#120c24";
    for (let px = -10; px < W + 10;) {
      const w = 26 + Math.floor(R() * 26), h = 14 + Math.floor(R() * 16), top = 262 - h;
      x.fillRect(px, top, w, h + 2);
      for (let i = 0; i < 6; i++) x.fillRect(px + i, top - 6 + i, w - 2 * i, 1);       // a pointed roof
      if (R() < 0.6) { x.fillStyle = "rgba(255,200,120,.5)"; x.fillRect(px + 4 + Math.floor(R() * (w - 10)), top + 6, 4, 3); x.fillStyle = "#120c24"; }
      px += w + Math.floor(R() * 6);
    }
    const gr = x.createRadialGradient(CX, CY + 20, 40, CX, CY + 20, 190);
    gr.addColorStop(0, "rgba(255,190,200,.18)"); gr.addColorStop(1, "rgba(255,190,200,0)");
    x.fillStyle = gr; x.fillRect(0, 200, W, 280);
  }
  function drawWheel() {
    const cx = 214, cy = 176, r = 62, n = 10, a0 = wheelA;
    g.fillStyle = "#1c1438";
    for (let k = -1; k <= 1; k += 2) for (let t = 0; t <= 1; t += 0.01) g.fillRect(Math.round(cx + k * t * 30), Math.round(cy + t * (262 - cy)), 2, 1);
    for (let k = 0; k < 64; k++) { const a = k / 64 * 2 * Math.PI; g.fillRect(Math.round(cx + r * Math.cos(a)), Math.round(cy + r * Math.sin(a)), 2, 2); }
    for (let k = 0; k < n; k++) {
      const a = a0 + k * 2 * Math.PI / n;
      for (let t = 0.1; t < 1; t += 0.05) g.fillRect(Math.round(cx + t * r * Math.cos(a)), Math.round(cy + t * r * Math.sin(a)), 1, 1);
      const bx = Math.round(cx + r * Math.cos(a)), by = Math.round(cy + r * Math.sin(a));
      g.fillStyle = "#24183e"; g.fillRect(bx - 3, by + 2, 7, 5); g.fillStyle = (k + Math.floor(chase * 0.7)) % 3 ? "#ffcf86" : "#ff8fb0"; g.fillRect(bx, by, 1, 1); g.fillStyle = "#1c1438";
    }
  }
  const BULB = ["#ff6b7d", "#ffd27a", "#8fe0a8", "#8fb8ff", "#f6a6e0"];
  function drawLights() {
    for (const [y0, sag, ph] of [[54, 34, 0], [96, 26, 2]]) {
      for (let k = 0; k <= 26; k++) {
        const x = -4 + k * 11, u = (x + 4) / (W + 8), y = Math.round(y0 + sag * 4 * u * (1 - u));
        g.fillStyle = "#2a2040"; g.fillRect(x, y - 1, 11, 1);
        const on = (k + ph + Math.floor(chase)) % 4 !== 0;
        g.fillStyle = on ? BULB[(k + ph) % BULB.length] : "#4a3a5a"; g.fillRect(x + 5, y, 2, 3);
        if (on) { g.fillStyle = "rgba(255,230,190,.16)"; g.fillRect(x + 3, y - 2, 6, 7); }
      }
    }
  }
  // the sign: a board with bulbs round it chasing, and the ride's name in tiles
  const FONT = {
    T: ["#####", "..#..", "..#..", "..#..", "..#.."], E: ["#####", "#....", "####.", "#....", "#####"], A: [".###.", "#...#", "#####", "#...#", "#...#"],
    C: [".####", "#....", "#....", "#....", ".####"], U: ["#...#", "#...#", "#...#", "#...#", ".###."], P: ["####.", "#...#", "####.", "#....", "#...."],
    R: ["####.", "#...#", "####.", "#..#.", "#...#"], I: ["#####", "..#..", "..#..", "..#..", "#####"], D: ["####.", "#...#", "#...#", "#...#", "####."], " ": [".....", ".....", ".....", ".....", "....."],
  };
  function drawSign() {
    const text = "TEA CUP RIDE", sc = 2, cw = 6 * sc, w = text.length * cw + 10, h = 5 * sc + 14, x0 = Math.round((W - w) / 2), y0 = 150;
    g.fillStyle = "#2a1424"; g.fillRect(x0, y0, w, h);
    g.fillStyle = "#7c2e48"; g.fillRect(x0 + 2, y0 + 2, w - 4, h - 4);
    g.fillStyle = "#3a1a2e"; g.fillRect(x0 + 4, y0 + 4, w - 8, h - 8);
    // two posts down to the ride
    g.fillStyle = "#2a1424"; g.fillRect(x0 + 6, y0 + h, 3, 262 - y0 - h); g.fillRect(x0 + w - 9, y0 + h, 3, 262 - y0 - h);
    // bulbs round the board
    const per = 2 * (w + h), step = 8, n = Math.floor(per / step);
    for (let k = 0; k < n; k++) {
      let p = k * step, x, y;
      if (p < w) { x = x0 + p; y = y0; } else if ((p -= w) < h) { x = x0 + w - 1; y = y0 + p; } else if ((p -= h) < w) { x = x0 + w - 1 - p; y = y0 + h - 1; } else { p -= w; x = x0; y = y0 + h - 1 - p; }
      const on = (k + Math.floor(chase * 2)) % 3 !== 0;
      g.fillStyle = on ? "#ffe9a8" : "#7a5a3a"; g.fillRect(x - 1, y - 1, 2, 2);
    }
    for (let i = 0; i < text.length; i++) {
      const rows = FONT[text[i]];
      for (let j = 0; j < 5; j++) for (let k = 0; k < 5; k++) if (rows[j][k] === "#") {
        const px = x0 + 7 + i * cw + k * sc, py = y0 + 7 + j * sc;
        g.fillStyle = "#9a4660"; g.fillRect(px + 1, py + 1, sc, sc);
        g.fillStyle = "#f6ecd2"; g.fillRect(px, py, sc, sc);
      }
    }
  }

  function draw() {
    // a knock on the screen when a cup is lost or the ride shifts up
    const sh = shake > 0 && !reduce ? Math.round(Math.sin(clock * 70) * 2 * shake / 0.3) : 0;
    g.setTransform(1, 0, 0, 1, sh, 0);
    g.drawImage(bgC, 0, 0);
    drawWheel(); drawLights(); drawSign();
    // the ride's shadow on the ground, its skirt and floor, the tea spilt on it, the gold ring where he pours
    g.fillStyle = "rgba(6,4,18,.45)"; fillEll(CX, CY + 16, R_FLOOR * PPM + 6, R_FLOOR * PPM * SQ + 6);
    drawFloor();
    drawStains();
    drawSpot();
    // the cup coming to the spout next gets an arrow
    let nx = null, nd = -9;
    for (const c of cups) { c.next = false; const d = atSpout(c); if (d < -halfOpen(c) && d > -halfOpen(c) - 1.2 && d > nd) { nd = d; nx = c; } }
    if (nx && state === "play") nx.next = true;
    // the cups behind the hub, the hub and Brewster, then the cups at his side and in front, back to front
    const order = cups.slice().sort((p, q) => Math.sin(phiOf(q)) - Math.sin(phiOf(p)));
    const behind = order.filter(c => Math.sin(phiOf(c)) > 0.12), front = order.filter(c => Math.sin(phiOf(c)) <= 0.12);
    for (const c of behind) drawCup(c);
    drawHub();
    const B = brewsterKey(), [hx, hy] = HUB_TOP();
    g.fillStyle = "rgba(60,20,30,.35)"; fillEll(hx, hy + 1, 20, 6);
    spr(B[1], hx, hy);
    for (const c of front) drawCup(c);
    drawStream();
    // drops falling off the spout
    for (const f of falling) { g.fillStyle = "#8a4a22"; g.fillRect(Math.round(f.x), Math.round(f.y), 2, 3); g.fillStyle = "#c98a4e"; g.fillRect(Math.round(f.x), Math.round(f.y), 1, 1); }
    for (const k of gone) {
      // a lost cup goes over the edge
      const V = SC.vessels[k.c.kind], f = V.frames[0];
      g.globalAlpha = 1 - k.t / 0.9; spr(f, k.x - k.t * 70, k.y + k.t * k.t * 120, k.c.tint >= 0 ? tinted[k.c.tint] : atlas); g.globalAlpha = 1;
    }
    for (const s2 of steam) { g.fillStyle = "rgba(255,255,255," + (0.35 * (1 - s2.t / 1.4)).toFixed(3) + ")"; g.fillRect(Math.round(s2.x), Math.round(s2.y), 1, 2); }
    for (const d of drops) { g.fillStyle = d.c; g.fillRect(Math.round(d.x), Math.round(d.y), d.floorY !== undefined ? 2 : 1, d.floorY !== undefined ? 2 : 1); }
    g.setTransform(1, 0, 0, 1, 0, 0);
    hudCanvas();
  }
  // tea spilt on the ride's floor, turning with it
  function drawStains() {
    for (const k of stains) {
      const a = k.a + theta, [x, y] = toS(k.r * Math.cos(a), k.r * Math.sin(a), 0);
      const al = 0.75 * Math.min(1, k.t / 0.25) * (k.t > 37 ? Math.max(0, 1 - (k.t - 37) / 8) : 1);
      g.fillStyle = "rgba(118,58,26," + al.toFixed(3) + ")"; fillEll(x, y, k.size, k.size * SQ * 0.8);
      g.fillStyle = "rgba(168,104,52," + (al * 0.7).toFixed(3) + ")"; fillEll(x - k.size * 0.25, y - 0.6, k.size * 0.4, k.size * 0.4 * SQ * 0.8);
    }
  }
  // where the tea comes down: a gold ring on the ride's floor under the spout, brighter while a cup is in it
  function drawSpot() {
    const [x, y] = toS(R_RING * Math.cos(POUR), R_RING * Math.sin(POUR), 0), inCup = cups.some(c => c.inWin);
    const pulse = 0.5 + 0.5 * Math.sin(clock * 5), rx = 27, ry = 27 * SQ;
    g.fillStyle = inCup ? "rgba(255,214,110,.32)" : "rgba(255,214,110," + (0.1 + 0.1 * pulse).toFixed(3) + ")"; fillEll(x, y, rx, ry);
    g.fillStyle = "rgba(255,230,150," + (0.65 + 0.35 * pulse).toFixed(3) + ")"; ringEll(x, y, rx, ry); ringEll(x, y + 1, rx, ry);
    g.fillStyle = "rgba(255,230,150," + (0.3 + 0.2 * pulse).toFixed(3) + ")"; ringEll(x, y, rx + 3, ry + 2, true);
  }

  function hudCanvas() {
    // the cups he can still lose: three little cups under the channel
    for (let i = 0; i < LOSE; i++) {
      const x = 14 + i * 14, y = 36, ok = i < LOSE - lost;
      g.fillStyle = ok ? "#f6ecd2" : "rgba(246,236,210,.22)";
      g.fillRect(x - 4, y - 3, 8, 5); g.fillRect(x - 3, y + 2, 6, 1); g.fillRect(x + 4, y - 2, 2, 1); g.fillRect(x + 5, y - 1, 1, 2);
      if (ok) { g.fillStyle = "#e8a0b4"; g.fillRect(x - 3, y - 2, 6, 1); }
    }
    g.font = "16px VT323, monospace";
    if (comboK > 1 && state === "play") {
      g.textAlign = "left"; const txt = "COMBO ×" + comboK;
      g.fillStyle = "#000"; g.fillText(txt, 9, 57); g.fillStyle = "#ffb4d0"; g.fillText(txt, 8, 56);
    }
    g.textAlign = "center";
    for (const p of pops) { g.globalAlpha = Math.max(0, 1 - p.t / 1.1); g.fillStyle = "#000"; g.fillText(p.text, Math.round(p.x) + 1, Math.round(p.y) + 1); g.fillStyle = p.col; g.fillText(p.text, Math.round(p.x), Math.round(p.y)); g.globalAlpha = 1; }
  }

  let last = performance.now(), frozen = false;
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.max(0, Math.min(0.1, (now - last) / 1000));
    last = now;
    if (!ready) return;
    if (state !== "pause" && !frozen) update(dt);
    draw();
  }

  /* ---------- input: hold to pour ---------- */
  const screen = $("screen");
  screen.addEventListener("pointerdown", e => {
    if (e.target.closest("button, a")) return;
    if (state === "pause") { pause(false); return; }
    if (state !== "play") return;
    e.preventDefault(); holding = true;
    try { screen.setPointerCapture(e.pointerId); } catch (err) { /* not capturable */ }
  });
  const upScreen = () => { holding = false; };
  screen.addEventListener("pointerup", upScreen);
  screen.addEventListener("pointercancel", upScreen);
  for (const b of document.querySelectorAll("#pad [data-d]")) {
    const on = e => { e.preventDefault(); if (state === "pause") { pause(false); return; } padHold = true; b.classList.add("on"); try { b.setPointerCapture(e.pointerId); } catch (err) { /* ok */ } };
    const offB = () => { padHold = false; b.classList.remove("on"); };
    b.addEventListener("pointerdown", on);
    b.addEventListener("pointerup", offB); b.addEventListener("pointercancel", offB); b.addEventListener("lostpointercapture", offB);
  }
  const POURK = new Set(["Space", "ArrowDown", "KeyS", "Enter"]);
  addEventListener("keydown", e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const el = e.target instanceof Element ? e.target : null;
    if (el && el !== document.body && el.closest("button") && (e.code === "Space" || e.code === "Enter")) return;
    if ((e.code === "Space" || e.code === "Enter") && (state === "ready" || (state === "over" && !$("over").hidden))) { e.preventDefault(); start(); return; }
    if (POURK.has(e.code)) { e.preventDefault(); if (state === "pause") pause(false); keyHold = true; }
    else if (e.code === "KeyP" || e.code === "Escape") { if (state === "play") pause(true); else if (state === "pause") pause(false); }
  });
  addEventListener("keyup", e => { if (POURK.has(e.code)) keyHold = false; });
  addEventListener("blur", () => { holding = padHold = keyHold = false; });

  function pause(on) {
    if (on && state === "play") {
      state = "pause"; holding = padHold = keyHold = false;
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
    const url = "https://rotville.world/games/tea-cup-ride/", label = $("share").querySelector(".tape-label");
    const text = score === 0 ? "Uncle Brewster poured for no one on rotville.world, and he is still smiling."
      : "Uncle Brewster poured " + score + (score === 1 ? " cup" : " cups") + " on the Tea Cup Ride at rotville.world before it stopped.";
    if (navigator.share) {
      try { await navigator.share({ title: "Tea Cup Ride", text, url }); return; } catch (err) { if (err && err.name === "AbortError") return; }
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

  // a bot can read the ride through this, on a page opened with #debug, and step it
  if (location.hash === "#debug") {
    window.__tc = {
      get: () => ({ state, T, omega, theta, tilt, flowing, lost, score, gear, streak, packets: packets.length, air: packets.reduce((a, p) => a + p.q, 0),
                    cups: cups.map(c => ({ kind: c.kind, slot: c.slot, d: atSpout(c), half: halfOpen(c), L: c.L, inWin: c.inWin, got: c.got })) }),
      hold: on => { keyHold = on; }, start, freeze: on => { frozen = on; }, step: dt => update(dt), draw: () => draw(), shot: () => cv.toDataURL(),
      cups: () => cups,
      log: LOG, flowAt, FALL, KINDS, LINE,
    };
  }

  Promise.all([fetch("assets/scene.json").then(r => r.json()), load("assets/sprites.png")])
    .then(([s, a]) => {
      SC = s; atlas = a;
      makeOutlines();
      // the ride's own cups in four colours: the white cup's drawings tinted
      tinted = TINTS.map(rgb => {
        const [c, x] = off(a.width, a.height);
        x.drawImage(a, 0, 0);
        x.globalCompositeOperation = "multiply"; x.fillStyle = "rgb(" + rgb.join(",") + ")"; x.fillRect(0, 0, a.width, a.height);
        x.globalCompositeOperation = "destination-in"; x.drawImage(a, 0, 0);
        return c;
      });
      // the ring the cups ride on goes under his spout as he pours
      const full = SC.brewster.tilt[SC.brewster.tilt.length - 2], bs = SC.sprites[full[1]];
      R_RING = (CX - (CX - bs[4] + full[2][0] - 3)) / PPM;
      buildFloor(); buildBack();
      reset(); ready = true;
    })
    .catch(() => { $("sub").textContent = "The tape would not load. Try the page again."; });
  requestAnimationFrame(frame);
})();
