/* Lickety-Split: Booblick swings across the Bakery District on his tongue.

   BOOBLICK (LORE 4.9) is a bread ring with irritated eyes, tiny feet and a tongue that never stops, a Breadling of
   the Bakery District, born from dough left to proof too long. He licks what he craves. Bakers tolerate him;
   customers do not. The user picked the game from the list on 2026-10-12 and named it from sixteen names:
   "Lickety-Split, build it" (R1336, R1337).

   Stickman Hook with a tongue. Hold and his tongue shoots out of his mouth to the treat with the ring round it, the
   nearest one in reach, and sticks; he swings on it, his mouth turned to it, and a treat licked too long is eaten
   and drops him. Let go and he flies on, tumbling, his tongue hanging out. The treats hang on strings from the
   bunting over the street; a stale one he will not lick, so it leaves a gap to fly. The first stretch is close and
   even; further on the treats spread out and rise and fall, stale ones appear, and some swing on their strings. Up
   high is the cheese moon, which he can lick too, and nothing above it. Fall into the street and a baker flips him
   back up with a peel; the third time the run is over. The score is how far he has gone.

   Only pre-rendered sprites ship (assets/sprites.png): Booblick from his model in twenty-four turns, his tongue
   taken off it, and the library's treats; the street, the bakeries, the moon, the tongue and the bunting are
   drawn here. */
(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  const W = 270, H = 480;
  const cv = $("c"), g = cv.getContext("2d");
  g.imageSmoothingEnabled = false;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const store = {
    get(k, d) { try { const v = localStorage.getItem("lickety." + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem("lickety." + k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
  };
  const load = src => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });
  const off = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d"); x.imageSmoothingEnabled = false; return [c, x]; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const wrap = a => { a = (a + Math.PI) % (2 * Math.PI); if (a < 0) a += 2 * Math.PI; return a - Math.PI; };
  // a little seeded random for the town, so the same street comes back at the same place
  const hash = n => { let t = (n * 0x6d2b79f5) | 0; t = Math.imul(t ^ (t >>> 15), 1 | t); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

  /* ---------- the street, seen from the side: x along it, y up from the cobbles, in metres ---------- */
  const PPM = 40;
  const STREET = 452;                             // where the cobbles meet the shopfronts on the screen, the camera at rest
  const G = 15;                                   // metres a second, a second
  const DRAG = 0.04;
  const BODY = 0.6;                               // his ring's reach from its middle, for the street
  const REACH = 4.4;                              // the furthest his tongue goes
  const MIN_LEN = 1.6;                            // the shortest his tongue holds him at
  const PUMP = 4.2;                               // swinging forward under a treat, he throws his weight into it
  const FLING = 1.1;                              // letting go on the way up and forward sends him a little further
  const BUFFER = 0.3;                             // a press just before a treat comes in reach still licks it
  const SHOOT = 0.07;                             // seconds the tongue takes to reach a treat
  const BUNTING = 10.9;                           // the height of the bunting the treats hang from
  // the cheese moon, low over the district: whoever goes up that high finds it there, can lick it, and goes no higher
  const MOON_Y = 17.4, MOON_R = 1.9, CEIL = 20.5;
  const LIVES = 3;
  const LICKABLE = ["donut-sprinkles", "donut-chocolate", "donut", "croissant", "cupcake", "muffin", "honey", "ginger-bread", "ice-cream"];
  const CAKE_EVERY = 160;                         // metres between birthday cakes
  // seconds a treat lasts on his tongue before it is eaten and he must be off: long at first, shorter further on
  const lastsAt = d => lerp(8.0, 4.0, clamp((d - 30) / 370, 0, 1));

  /* ---------- sound ---------- */
  const LINES = [["start", "line-start"], ["tumble", "line-tumble"], ["end", "line-end"], ["cake", "line-cake"], ["moon", "line-moon"]];
  const audio = {
    ctx: null, on: store.get("sound", true), raw: {}, buf: {}, music: null,
    fetch() {
      for (const [k, f] of LINES) this.raw[k] = fetch("assets/" + f + ".mp3").then(r => (r.ok ? r.arrayBuffer() : null)).catch(() => null);
      this.raw.music = fetch("assets/wow-piano.mp3").then(r => (r.ok ? r.arrayBuffer() : null)).catch(() => null);
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
      this.mus = c.createGain(); this.mus.gain.value = 0.24; this.mus.connect(this.master);
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
      // the air going past him, louder the faster he flies
      const s = c.createBufferSource(), bp = c.createBiquadFilter(); s.buffer = n; s.loop = true;
      bp.type = "bandpass"; bp.frequency.value = 700; bp.Q.value = 0.6;
      this.windG = c.createGain(); this.windG.gain.value = 0;
      s.connect(bp).connect(this.windG).connect(this.fxg); s.start(); this.windBp = bp;
    },
    wind(speed) {
      if (!this.ctx) return;
      const t = this.ctx.currentTime, k = clamp((speed - 4) / 10, 0, 1);
      this.windG.gain.setTargetAtTime(0.09 * k * k, t, 0.08);
      this.windBp.frequency.setTargetAtTime(500 + 900 * k, t, 0.1);
    },
    set(on) { this.on = on; store.set("sound", on); if (this.master) this.master.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.04); },
    windDown() {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      if (this.music) { this.music.playbackRate.cancelScheduledValues(t); this.music.playbackRate.setTargetAtTime(0.4, t, 0.8); }
      this.mus.gain.setTargetAtTime(0.0001, t + 0.6, 0.9);
      this.windG.gain.setTargetAtTime(0, t, 0.1);
    },
    again() {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      if (this.music) { this.music.playbackRate.cancelScheduledValues(t); this.music.playbackRate.setTargetAtTime(1, t, 0.05); }
      this.mus.gain.cancelScheduledValues(t); this.mus.gain.setTargetAtTime(0.24, t, 0.2);
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
    // a wet lick as the tongue sticks
    lick() { this.noise(0.11, 0.09, 700, 2600); this.tone(330, 170, 0.12, "triangle", 0.05); this.tone(900, 1400, 0.05, "sine", 0.03, 0.04); },
    // the tongue comes back with nothing: pthp
    miss() { this.noise(0.06, 0.05, 1500, 5000); this.tone(420, 240, 0.08, "square", 0.025); },
    letgo() { this.noise(0.18, 0.04, 400, 1600); },
    thump() { this.tone(140, 55, 0.3, "sine", 0.16); this.noise(0.22, 0.08, 80, 900); },
    peel() { this.tone(420, 380, 0.07, "square", 0.04); this.noise(0.08, 0.06, 300, 2500); this.tone(520, 900, 0.18, "triangle", 0.04, 0.06); },
    cake() { [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, f, 0.22, "triangle", 0.05, i * 0.08)); },
    bell() { this.tone(1568, 1566, 0.6, "sine", 0.07); this.tone(2349, 2347, 0.4, "sine", 0.04, 0.02); },
    // his irritated noise when a stale one will not hold him
    pfft() { this.tone(260, 190, 0.16, "sawtooth", 0.025); },
    bonk() { this.tone(180, 120, 0.2, "triangle", 0.1); this.noise(0.12, 0.05, 200, 1400); },
    moon() { [392, 523, 659, 784, 1047].forEach((f, i) => this.tone(f, f * 1.003, 0.4, "sine", 0.05, i * 0.1)); },
    gulp() { this.tone(240, 110, 0.14, "sine", 0.1); this.noise(0.06, 0.04, 400, 1800, 0.02); },
  };
  window.rvBuzz?.on(audio, { lick: "tap", thump: "lose", cake: "great", bell: "tap", gulp: "bump", bonk: "bump", moon: "great" });
  audio.fetch();

  /* ---------- state ---------- */
  let SC, atlas, staleImg = null, ready = false;
  let state = "ready";                            // ready, play, tumble, stopping, pause, over
  let T = 0, clock = 0, holding = false, padHold = false, keyHold = false, wasHeld = false;
  let px = 0, py = 0, vx = 0, vy = 0, psi = 0, spin = 0;
  let tongue = null;                              // { t: the treat, len, out: 0..1 while it shoots }
  let lastT = null, lastAt = -9, pressAt = -9;    // the treat he last let go of, and when; a press waiting for a treat
  let back = 0;                                   // the tongue coming back in after he lets go, 1..0
  let treats = [], genX = 0, lives = LIVES, best = store.get("best", 0), metres = 0, x0 = 0, licks = 0, nextSign = 100, nextCake = 0;
  let camX = 0, camY = 0, tumbleT = 0, endT = 0, peelT = -1, missT = 0, shake = 0;
  let pops = [], bits = [], puffs = [], tipX = 0, tipY = 0;     // tipX/tipY: where the tongue last touched, in metres
  let saidStart = false, saidTumble = false, saidCake = false, saidMoon = false;
  let moonX = null, moonC = null, moonLicked = 0, bonkAt = -9;     // where the moon is along the street, once he has gone up to it
  const LOG = location.hash === "#debug" ? [] : null;
  const ev = (type, more) => { if (LOG) LOG.push(Object.assign({ type, t: +T.toFixed(2), m: metres }, more || {})); };

  function hud() {
    $("score").textContent = metres + " M";
    $("best").textContent = "Furthest " + best + " m";
  }

  /* ---------- the treats ahead ---------- */
  // how far along the street the run has come, as a share of the way to the hardest
  const hard = d => clamp((d - 40) / 420, 0, 1);
  function generate(upTo) {
    while (genX < upTo) {
      const d = genX - x0, k = hard(d);
      const gap = d < 40 ? rnd(2.4, 2.8) : lerp(2.6, 3.7, k) + rnd(-0.35, 0.35);
      const amp = d < 40 ? 0.35 : lerp(0.6, 1.9, k);
      const prev = treats.length ? treats[treats.length - 1] : null;
      const x = genX + gap, y = clamp(6.7 + rnd(-amp, amp), 4.7, 9.3);
      let kind = LICKABLE[Math.floor(Math.random() * LICKABLE.length)];
      if (prev && prev.kind === kind) kind = LICKABLE[(LICKABLE.indexOf(kind) + 1 + Math.floor(Math.random() * 3)) % LICKABLE.length];
      // a stale one leaves a gap to fly, never two in a row
      const stale = d > 120 && !(prev && prev.stale) && Math.random() < lerp(0.12, 0.3, clamp((d - 120) / 400, 0, 1));
      const cake = !stale && d >= nextCake && d > 60;
      if (cake) nextCake = d + CAKE_EVERY;
      const swing = d > 220 && !stale && Math.random() < lerp(0.15, 0.4, clamp((d - 220) / 400, 0, 1))
        ? { amp: rnd(0.45, 0.85), w: 2 * Math.PI / rnd(2.2, 3.2), ph: rnd(0, 6.3) } : null;
      treats.push({ x, y, kind: cake ? "cake-birthday" : kind, stale, swing, cake, licked: 0, ax: x, ay: y });
      genX = x;
    }
    // the ones far behind are gone
    while (treats.length && treats[0].x < camX - 8) treats.shift();
  }
  // where a treat is now: one on a swinging string goes to and fro under where it hangs from
  function place(t) {
    if (!t.swing) { t.ax = t.x; t.ay = t.y; return; }
    const L = BUNTING - t.y, a = Math.asin(clamp(t.swing.amp / L, -0.9, 0.9)) * Math.sin(t.swing.w * T + t.swing.ph);
    t.ax = t.x + L * Math.sin(a); t.ay = BUNTING - L * Math.cos(a);
  }
  // the treat his tongue goes to: the nearest one he would lick, in reach, not far behind him
  function target() {
    let best = null, bd = 1e9;
    for (const t of treats) {
      if (t.stale || (t === lastT && clock - lastAt < 0.6)) continue;
      const dx = t.ax - px, dy = t.ay - py, d = Math.hypot(dx, dy);
      if (d > REACH || dx < -1.2) continue;
      const cost = d + (dy < -0.6 ? 1.2 : 0) + (dx < 0 ? 2.5 : 0);
      if (cost < bd) { bd = cost; best = t; }
    }
    if (moonX !== null) {
      const dx = px - moonX, dy = py - MOON_Y, d = Math.hypot(dx, dy) - MOON_R;
      if (d <= REACH && d + 0.4 < bd) {
        const k = MOON_R / Math.max(0.01, d + MOON_R);
        best = { moon: true, kind: "moon", ax: moonX + dx * k, ay: MOON_Y + dy * k, licked: 0 };
      }
    }
    return best;
  }

  function reset() {
    T = 0; lives = LIVES; metres = 0; licks = 0; nextSign = 100; tumbleT = 0; endT = 0; peelT = -1; missT = 0; shake = 0;
    pops = []; bits = []; puffs = []; treats = []; tongue = null; back = 0; lastT = null; pressAt = -9; moonX = null;
    x0 = 0; px = 1.2; py = BODY; vx = 0; vy = 0; psi = 0; spin = 0;
    genX = 2.4; nextCake = 70 + rnd(0, 40);
    camX = px - 0.36 * W / PPM; camY = 0;
    generate(camX + 30);
    for (const t of treats) place(t);
    hud();
  }

  function start() {
    audio.unlock(); audio.again();
    reset();
    state = "play"; wasHeld = false;
    // he hops up off the cobbles
    vx = 4.0; vy = 10.8; spin = 5;
    $("ready").hidden = true; $("over").hidden = true;
    $("static").classList.remove("on");
    if (!saidStart) { saidStart = true; say("start", "Booblick licks what he craves."); }
  }

  function say(key, text) {
    const sub = $("sub");
    sub.textContent = text;
    audio.line(key).then(d => setTimeout(() => { if (sub.textContent === text) sub.textContent = ""; }, Math.max(1800, d * 1000 + 300)));
  }
  function news(name, where, label) {
    const el = $("news");
    $("news-name").textContent = name;
    el.querySelector(".ls-street-where").textContent = where;
    el.querySelector(".ls-street-no").textContent = label;
    el.hidden = false; el.classList.remove("in"); void el.offsetWidth; el.classList.add("in");
    setTimeout(() => { el.hidden = true; }, 2900);
  }
  function pop(x, y, text, col) { pops.push({ x, y, text, col, t: 0 }); }
  function bump() { const el = $("score"); el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump"); setTimeout(() => el.classList.remove("bump"), 160); }

  /* ---------- the tongue ---------- */
  function lick() {
    const t = target();
    if (!t) {
      // nothing in reach he would lick: the tongue comes back with nothing
      if (missT <= 0) { audio.miss(); missT = 0.25; ev("miss"); }
      // a stale one close by gets his irritated noise
      if (treats.some(s => s.stale && Math.hypot(s.ax - px, s.ay - py) < REACH)) audio.pfft();
      return false;
    }
    tongue = { t, len: clamp(Math.hypot(t.ax - px, t.ay - py), MIN_LEN, REACH), out: 0, held: 0, lasts: lastsAt(metres) };
    // his speed goes into the swing round the treat, the way he was already going round it, and forward if he hardly
    // moved: a lick never stops him dead
    const dx = px - t.ax, dy = py - t.ay, L = Math.max(0.01, Math.hypot(dx, dy)), tx = -dy / L, ty = dx / L;
    const sp = Math.max(Math.hypot(vx, vy), 3.2);
    let dir = Math.sign(vx * tx + vy * ty);
    if (Math.abs(vx * tx + vy * ty) < 0.8) dir = Math.sign(tx) || 1;
    vx = tx * sp * dir; vy = ty * sp * dir;
    back = 0; t.licked = 1; licks += 1;
    audio.lick(); ev("lick", { kind: t.kind });
    if (t.moon) {
      moonLicked = 1; tongue.lasts = 6;
      audio.moon(); pop(t.ax, t.ay - 0.5, "★ MOON", "#ffe08a");
      for (let i = 0; i < 16; i++) bits.push({ x: t.ax, y: t.ay, vx: rnd(-2.5, 2.5), vy: rnd(-3, 1), t: 0, life: 1.3, c: i % 2 ? "#fbe08c" : "#e2a944" });
      if (!saidMoon) { saidMoon = true; setTimeout(() => say("moon", "He licked the moon. It was cheese."), 300); }
    }
    if (t.cake && !t.got) {
      t.got = true; audio.cake(); pop(t.ax, t.ay + 0.6, "★ CAKE", "#ffd36a");
      for (let i = 0; i < 18; i++) bits.push({ x: t.ax, y: t.ay, vx: rnd(-3, 3), vy: rnd(1, 5), t: 0, life: 1.2, c: i % 2 ? "#ffd36a" : "#ff9ec4" });
      if (!saidCake) { saidCake = true; setTimeout(() => say("cake", "That was somebody's birthday cake."), 300); }
    }
    return true;
  }
  function letGo() {
    if (!tongue) return;
    lastT = tongue.t; lastAt = clock;
    if (vx > 0 && vy > 0) { vx *= FLING; vy *= FLING; }
    tongue = null; back = 1; audio.letgo(); ev("letgo", { vx: +vx.toFixed(2), vy: +vy.toFixed(2) });
    spin = clamp(vx * 1.7, -10, 10) + (vy > 0 ? 1 : -1);
  }

  /* ---------- falling into the street ---------- */
  function tumble() {
    state = "tumble"; tumbleT = 0; lives -= 1; shake = 0.35; tongue = null; back = 0;
    vy = Math.abs(vy) * 0.25; vx *= 0.5; py = BODY;
    audio.thump(); ev("tumble", { lives });
    for (let i = 0; i < 14; i++) puffs.push({ x: px + rnd(-0.5, 0.5), y: 0.1, vx: rnd(-1.5, 1.5), vy: rnd(0.2, 1.2), t: 0, life: rnd(0.6, 1.1), r: rnd(2, 4) });
    if (lives <= 0) { state = "stopping"; endT = 0; audio.windDown(); return; }
    if (!saidTumble) { saidTumble = true; setTimeout(() => say("tumble", "Bakers tolerate him."), 350); }
  }

  function end() {
    state = "over";
    window.rvBuzz?.("over");
    $("over-title").textContent = "Out in the street.";
    $("over-line").textContent = metres === 0 ? "Booblick swung nowhere." : "Booblick swung " + metres + " metres and licked " + licks + (licks === 1 ? " treat." : " treats.");
    $("over-stats").textContent = metres > 0 && metres === best ? "The furthest he has gone" : "Furthest " + best + " m";
    hud();
    say("end", "Customers do not.");
    setTimeout(() => { if (state === "over") { $("over").hidden = false; $("again").focus({ preventScroll: true }); } }, 1500);
  }

  /* ---------- a step of the world ---------- */
  function update(dt) {
    clock += dt;
    for (const p of pops) { p.t += dt; p.y += 0.6 * dt; }
    pops = pops.filter(p => p.t < 1.1);
    for (const b of bits) { b.t += dt; b.vy -= G * 0.6 * dt; b.x += b.vx * dt; b.y += b.vy * dt; }
    bits = bits.filter(b => b.t < b.life && b.y > -0.2);
    for (const f of puffs) { f.t += dt; f.x += f.vx * dt; f.y += f.vy * dt; f.vx *= 1 - 2 * dt; }
    puffs = puffs.filter(f => f.t < f.life);
    shake = Math.max(0, shake - dt); missT = Math.max(0, missT - dt);
    if (back > 0) back = Math.max(0, back - dt / 0.12);
    for (const t of treats) { place(t); if (t.licked > 0) t.licked = Math.max(0, t.licked - dt / 1.2); }
    if (moonLicked > 0) moonLicked = Math.max(0, moonLicked - dt / 2);
    const held = holding || padHold || keyHold;

    if (state === "stopping") {
      endT += dt; vx *= 1 - 3 * dt; px += vx * dt; psi += vx / BODY * dt;
      if (endT > 1.6) end();
      camera(dt);
      return;
    }
    if (state === "tumble") {
      // he rolls on the cobbles, then a baker's peel comes out of the nearest door and flips him back up
      tumbleT += dt;
      vx *= 1 - 2.5 * dt; px += vx * dt; psi += vx / BODY * dt;
      if (tumbleT > 0.7 && peelT < 0) { peelT = 0; }
      if (peelT >= 0) {
        peelT += dt;
        if (peelT > 0.28 && state === "tumble") {
          state = "play"; vx = 4.0; vy = 10.5; spin = 6; peelT = 0.28; audio.peel(); ev("peel");
          for (let i = 0; i < 10; i++) puffs.push({ x: px + rnd(-0.4, 0.4), y: 0.3, vx: rnd(-1, 1), vy: rnd(0.4, 1.6), t: 0, life: rnd(0.5, 0.9), r: rnd(2, 3.5) });
        }
      }
      camera(dt);
      return;
    }
    if (peelT >= 0) { peelT += dt; if (peelT > 0.75) peelT = -1; }
    if (state !== "play") { camera(dt); return; }
    T += dt;

    // the tongue: on a press it goes for the treat with the ring; let go and he flies on
    if (held && !wasHeld) { if (!lick()) pressAt = clock; }
    else if (held && !tongue && clock - pressAt < BUFFER && target()) { pressAt = -9; lick(); }
    if (!held && wasHeld) { letGo(); pressAt = -9; }
    wasHeld = held;

    // the step, in small pieces so the tongue holds him steady
    const N = 4, h = dt / N;
    for (let i = 0; i < N; i++) {
      vy -= G * h;
      vx *= 1 - DRAG * h; vy *= 1 - DRAG * h;
      px += vx * h; py += vy * h;
      if (tongue) {
        const t = tongue.t;
        const dx = px - t.ax, dy = py - t.ay, L = Math.hypot(dx, dy);
        if (L >= tongue.len - 0.02) {
          // taut: held on the tongue's length, nothing outward
          const nx = dx / L, ny = dy / L;
          px = t.ax + nx * tongue.len; py = t.ay + ny * tongue.len;
          let vr = vx * nx + vy * ny, vt = vx * -ny + vy * nx;
          if (vr > 0) vr = 0;
          // under the treat and going forward, he throws his weight into the swing
          if (dy < 0 && -ny * Math.sign(vt) > 0) vt += Math.sign(vt) * PUMP * h;
          vx = vr * nx - vt * ny; vy = vr * ny + vt * nx;
        }
      }
    }
    if (tongue) {
      tongue.out = Math.min(1, tongue.out + dt / SHOOT);
      // licked long enough, the treat is eaten: crumbs, and he flies on whether he meant to or not
      tongue.held += dt;
      if (tongue.held >= tongue.lasts && tongue.t.moon) letGo();
      else if (tongue.held >= tongue.lasts) {
        const t = tongue.t;
        for (let i = 0; i < 12; i++) bits.push({ x: t.ax + rnd(-0.2, 0.2), y: t.ay + rnd(-0.2, 0.2), vx: rnd(-1.5, 1.5), vy: rnd(-1, 2), t: 0, life: rnd(0.5, 1), c: i % 3 ? "#c98a4e" : "#f6ecd2" });
        t.eaten = true; treats = treats.filter(k => k !== t); audio.gulp(); ev("eaten");
        letGo();
      }
    }
    // his turn: hanging, his mouth is turned to the treat he licks; flying, he tumbles over and over
    if (tongue) {
      const want = Math.atan2(tongue.t.ax - px, tongue.t.ay - py) + Math.PI;
      psi += wrap(want - psi) * Math.min(1, dt * 14);
      spin = 0;
    } else {
      psi += spin * dt; spin *= 1 - 0.25 * dt;
    }
    // a drop of drool off his tongue now and then
    if (tongue && tongue.out >= 1 && Math.random() < dt * 1.3) {
      const r = rnd(0.25, 0.85), [ex, ey] = tipOf(tongue.t);
      bits.push({ x: lerp(px, ex, r), y: lerp(py, ey, r) - 0.08, vx: vx * 0.2, vy: -0.5, t: 0, life: 0.9, c: "#dff2ff" });
    }
    // crumbs and seeds come off him when he goes fast
    const sp = Math.hypot(vx, vy);
    if (sp > 7 && Math.random() < dt * (sp - 6) * 1.6) bits.push({ x: px + rnd(-0.3, 0.3), y: py + rnd(-0.3, 0.3), vx: -vx * 0.1 + rnd(-0.5, 0.5), vy: rnd(-0.5, 0.8), t: 0, life: rnd(0.5, 0.9), c: Math.random() < 0.6 ? "#f6ecd2" : "#3a2a20" });
    audio.wind(sp);

    // how far he has come; a sign at every hundred metres
    const m = Math.max(metres, Math.floor(px - x0 - 1.2));
    if (m !== metres) {
      metres = m; hud();
      if (metres > best) { best = metres; store.set("best", best); hud(); }
      if (metres >= nextSign) { news(nextSign + " metres", "and still licking", "BAKERY DISTRICT"); audio.bell(); bump(); nextSign += 100; ev("sign", { at: metres }); }
    }
    // going up high, he finds the moon a little ahead of him, where it stays until he has left it behind
    if ((moonX === null || moonX + MOON_R < camX - 2) && py > 10 && camY + H / PPM < MOON_Y - MOON_R - 0.5) moonX = px + rnd(1.5, 3.5);
    if (moonX !== null) {
      const dx = px - moonX, dy = py - MOON_Y, d = Math.hypot(dx, dy), touch = MOON_R + BODY * 0.8;
      if (d < touch) {
        const nx = dx / d, ny = dy / d, vn = vx * nx + vy * ny;
        px = moonX + nx * touch; py = MOON_Y + ny * touch;
        // a real knock bounces him off with a bonk; brushing it, he only slides off
        if (vn < -2 && clock - bonkAt > 0.5) {
          bonkAt = clock; vx -= 1.4 * vn * nx; vy -= 1.4 * vn * ny; audio.bonk(); shake = 0.2; ev("bonk");
          for (let i = 0; i < 8; i++) bits.push({ x: px - nx * BODY, y: py - ny * BODY, vx: rnd(-1.5, 1.5), vy: rnd(-2, 0.5), t: 0, life: 1, c: "#f2c45a" });
        } else if (vn < 0) { vx -= vn * nx; vy -= vn * ny; }
      }
    }
    if (py > CEIL) { py = CEIL; vy = Math.min(vy, 0); }
    if (py - BODY <= 0 && vy < 0) tumble();
    generate(camX + 30);
    camera(dt);
  }
  // the camera keeps him a third of the way in and rises when he goes high
  function camera(dt) {
    let ty = clamp(py - 8.4, 0, CEIL + 1 - H / PPM);
    // up by the moon, the camera rises far enough to show all of it
    if (moonX !== null && (py > 11 || (tongue && tongue.t.moon)) && Math.abs(px - moonX) < 7) ty = Math.max(ty, MOON_Y + MOON_R + 0.6 - STREET / PPM);
    const tx = px - 0.36 * W / PPM;
    camX += (tx - camX) * Math.min(1, dt * 4.5);
    camY += (ty - camY) * Math.min(1, dt * 3);
  }
  const sx = x => Math.round((x - camX) * PPM);
  const sy = y => Math.round(STREET - (y - camY) * PPM);

  /* ---------- the town, drawn once and kept ---------- */
  let skyC = null, farC = null, cobC = null;
  const houses = new Map();                       // each house of the far row, drawn once: index -> {c, w, h}
  const LAYER = 0.55;                             // how far the row of bakeries moves for a metre of street
  function buildSky() {
    const [c, x] = off(W, H);
    const gr = x.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, "#1b1638"); gr.addColorStop(0.35, "#3d2c5c"); gr.addColorStop(0.62, "#8a5277"); gr.addColorStop(0.8, "#e08a6e"); gr.addColorStop(1, "#f6c38a");
    x.fillStyle = gr; x.fillRect(0, 0, W, H);
    // the last stars of the night, high up
    for (let i = 0; i < 40; i++) {
      const sx2 = Math.floor(hash(i * 3 + 1) * W), sy2 = Math.floor(hash(i * 7 + 2) * 150);
      x.fillStyle = "rgba(255,248,230," + (0.25 + 0.6 * hash(i * 11 + 5) * (1 - sy2 / 150)).toFixed(2) + ")"; x.fillRect(sx2, sy2, 1, 1);
    }
    skyC = c;
    // the far roofs of the district, one strip that repeats
    const FW = 540, [f, fx] = off(FW, 120);
    fx.fillStyle = "#4a3260";
    let xx = 0, i = 0;
    while (xx < FW) {
      const w = 26 + Math.floor(hash(i * 5 + 9) * 34), h = 40 + Math.floor(hash(i * 13 + 3) * 60);
      fx.fillRect(xx, 120 - h, w, h);
      if (hash(i * 17 + 1) < 0.6) { fx.fillRect(xx + 4 + Math.floor(hash(i * 19) * (w - 10)), 120 - h - 9, 4, 9); }
      if (hash(i * 23 + 2) < 0.5) { fx.beginPath(); fx.moveTo(xx - 2, 120 - h); fx.lineTo(xx + w / 2, 120 - h - 14); fx.lineTo(xx + w + 2, 120 - h); fx.fill(); }
      for (let k = 0; k < 4; k++) if (hash(i * 31 + k) < 0.35) { fx.fillStyle = "rgba(255,196,120,.55)"; fx.fillRect(xx + 4 + Math.floor(hash(i * 37 + k) * (w - 8)), 120 - h + 8 + Math.floor(hash(i * 41 + k) * (h - 16)), 2, 2); fx.fillStyle = "#4a3260"; }
      xx += w; i++;
    }
    farC = f;
    // the cobbles: a strip that repeats under the street
    const [k, kx] = off(64, 30);
    kx.fillStyle = "#4d4a66"; kx.fillRect(0, 0, 64, 30);
    kx.fillStyle = "#8f86a3"; kx.fillRect(0, 0, 64, 3);                  // the kerb's top
    kx.fillStyle = "#6b6584"; kx.fillRect(0, 3, 64, 2);
    for (let r = 0; r < 4; r++) for (let q = 0; q < 6; q++) {
      const cx = q * 12 + (r % 2 ? 6 : 0) - 3, cy = 7 + r * 6;
      kx.fillStyle = hash(r * 7 + q * 3) < 0.5 ? "#5e5a7a" : "#57536f"; kx.fillRect(cx, cy, 10, 4);
      kx.fillStyle = "#77708f"; kx.fillRect(cx, cy, 10, 1);
    }
    cobC = k;
  }
  // the cheese moon: a round of cheese lit from the upper left, its holes shadowed above and lit below, a bite out of
  // its side, a dark rim and a faint glow round it
  function buildMoon() {
    const R = Math.round(MOON_R * PPM), S = R * 2 + 28, c0 = S / 2, [c, x] = off(S, S), img = x.createImageData(S, S), d = img.data;
    const holes = [[-0.42, -0.3, 0.14], [0.12, -0.5, 0.09], [0.3, 0.14, 0.16], [-0.2, 0.36, 0.1], [-0.6, 0.18, 0.07], [0.42, -0.2, 0.06], [0.02, 0.6, 0.07], [-0.1, -0.08, 0.06], [0.58, 0.42, 0.05]];
    const bites = [[0.98, -0.18, 0.2], [0.9, 0.06, 0.17], [1.0, 0.3, 0.15]];
    const put = (i, j, r, g2, b, a) => { const k = (j * S + i) * 4; d[k] = r; d[k + 1] = g2; d[k + 2] = b; d[k + 3] = a; };
    const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
    const inBite = (u, v) => bites.some(([bx, by, br]) => Math.hypot(u - bx, v - by) < br);
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
      const u = (i + 0.5 - c0) / R, v = (j + 0.5 - c0) / R, r = Math.hypot(u, v);
      if (r > 1 || inBite(u, v)) {
        // the glow, faint and fading out
        const gl = r > 1 ? Math.max(0, 1 - (r - 1) * R / 13) : 0;
        if (gl > 0 && !inBite(u, v)) put(i, j, 255, 214, 120, Math.round(46 * gl * gl));
        continue;
      }
      const lit = (-u * 0.6 - v * 0.8);
      let col = hex(lit > 0.4 ? "#fbe08c" : lit > -0.15 ? "#f2c45a" : lit > -0.6 ? "#e2a944" : "#c98c34");
      for (const [hx, hy, hr] of holes) {
        const hd = Math.hypot(u - hx, v - hy);
        if (hd < hr) {
          // inside a hole: the far side lit, the near side in shadow
          const side = ((u - hx) * 0.6 + (v - hy) * 0.8) / hr;
          col = hex(side > 0.35 ? "#fde6a6" : side < -0.3 ? "#9a6620" : "#b9802c");
        }
      }
      // the bitten edge shows paler cheese
      if (bites.some(([bx, by, br]) => Math.hypot(u - bx, v - by) < br + 0.06)) col = hex("#fbe9b0");
      put(i, j, col[0], col[1], col[2], 255);
    }
    // the rim: a dark line round the cheese
    const solid = (i, j) => i >= 0 && j >= 0 && i < S && j < S && d[(j * S + i) * 4 + 3] === 255;
    const rim = [];
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) if (solid(i, j) && (!solid(i - 1, j) || !solid(i + 1, j) || !solid(i, j - 1) || !solid(i, j + 1))) rim.push([i, j]);
    for (const [i, j] of rim) put(i, j, 138, 90, 28, 255);
    x.putImageData(img, 0, 0);
    moonC = c;
  }

  // a bakery of the row at dawn, its walls still in the night's shade so the treats and the lit windows stand out:
  // two to four floors of windows, some shuttered, some with flowers; a tiled roof and a smoking chimney; the shop
  // below, its window full of loaves under a striped awning, and the baker's sign hanging from an iron bracket
  const WALLS = [["#7d6474", "#674f60"], ["#86706a", "#6c5853"], ["#6f6a86", "#58546d"], ["#8a7562", "#6f5d4d"], ["#7a6060", "#624a4c"], ["#677686", "#525f6d"]];
  const SHUTTERS = ["#3f5a4c", "#5a3f4c", "#45507a", "#6a4a32"];
  const AWNS = [["#b04050", "#e9dcc0"], ["#3a7a62", "#e9dcc0"], ["#41609a", "#e9dcc0"], ["#b06a34", "#efd7a8"], ["#7a4078", "#e9dcc0"]];
  const SIGNS = {
    pretzel: [".XXX...XXX.", "X...X.X...X", "X....X....X", "X...X.X...X", ".X.X...X.X.", "..XX...XX..", "...XXXXX..."],
    loaf: ["...XXXXX...", ".XXXXXXXXX.", "XX.XX.XX.XX", "XXXXXXXXXXX", "XXXXXXXXXXX", ".XXXXXXXXX."],
    cake: ["....X....", "....X....", ".XXXXXXX.", "XX.X.X.XX", "XXXXXXXXX", "XXXXXXXXX", "XXXXXXXXX"],
  };
  function icon(x, rows, ox, oy, fill, edge) {
    const on = (r, c) => r >= 0 && r < rows.length && c >= 0 && c < rows[r].length && rows[r][c] === "X";
    x.fillStyle = edge;
    for (let r = -1; r <= rows.length; r++) for (let c = -1; c <= rows[0].length; c++)
      if (!on(r, c) && (on(r - 1, c) || on(r + 1, c) || on(r, c - 1) || on(r, c + 1))) x.fillRect(ox + c, oy + r, 1, 1);
    x.fillStyle = fill;
    for (let r = 0; r < rows.length; r++) for (let c = 0; c < rows[r].length; c++) if (on(r, c)) x.fillRect(ox + c, oy + r, 1, 1);
  }
  // the row's houses stand wall to wall, now and then a narrow alley between them: each one's width and where it starts
  const houseW = k => 2 * (34 + Math.floor(hash(k * 97 + 2) * 22));
  const alley = k => (hash(k * 97 + 3) < 0.22 ? 8 : 0);
  const lefts = new Map([[0, -160]]);
  function leftOf(k) {
    if (lefts.has(k)) return lefts.get(k);
    let v;
    if (k > 0) v = leftOf(k - 1) + houseW(k - 1) + alley(k - 1);
    else v = leftOf(k + 1) - houseW(k) - alley(k);
    lefts.set(k, v);
    return v;
  }
  let firstHouse = 0;
  function house(i) {
    if (houses.has(i)) return houses.get(i);
    const R = k => hash(i * 97 + k);
    const floors = 2 + Math.floor(R(1) * 3), w = houseW(i), FH = 32, SH = 50, ROOF = 26, AIR = 24;
    const h = floors * FH + SH, top = ROOF + AIR, [c, x] = off(w + 8, top + h);
    const [wall, edge] = WALLS[Math.floor(R(3) * WALLS.length)], [aw1, aw2] = AWNS[Math.floor(R(4) * AWNS.length)];
    const L = 4;                                                  // the wall's left edge in the drawing
    x.fillStyle = wall; x.fillRect(L, top, w, h);
    x.fillStyle = edge; x.fillRect(L, top, 2, h); x.fillRect(L + w - 2, top, 2, h);
    // a lighter band between the floors
    x.fillStyle = "rgba(255,240,220,.07)";
    for (let f = 1; f < floors; f++) x.fillRect(L, top + f * FH - 2, w, 2);
    // the roof: a tiled gable, a mansard with a dormer, or a flat top behind a cornice
    const kind = R(5), tile = "#3d2a3c", tile2 = "#4c3448";
    if (kind < 0.45) {
      for (let r = 0; r < ROOF; r++) {
        const half = (w / 2 + 3) * (r + 1) / ROOF;
        x.fillStyle = r % 3 === 0 ? tile2 : tile; x.fillRect(Math.round(L + w / 2 - half), top - ROOF + r, Math.round(half * 2), 1);
      }
    } else if (kind < 0.8) {
      for (let r = 0; r < ROOF - 6; r++) {
        const inset = Math.round((ROOF - 6 - r) * 0.45);
        x.fillStyle = r % 3 === 0 ? tile2 : tile; x.fillRect(L - 2 + inset, top - ROOF + 6 + r, w + 4 - inset * 2, 1);
      }
      const dx = L + Math.round(w / 2) - 6;
      x.fillStyle = "#2e2232"; x.fillRect(dx - 1, top - ROOF + 9, 14, 12); x.fillStyle = R(6) < 0.6 ? "#ffc66e" : "#2a2240"; x.fillRect(dx + 1, top - ROOF + 11, 10, 9);
    } else {
      x.fillStyle = "#4c3448"; x.fillRect(L - 2, top - 6, w + 4, 6); x.fillStyle = "#6a4c5c"; x.fillRect(L - 2, top - 6, w + 4, 1);
    }
    const chx = L + 6 + Math.floor(R(7) * (w - 22));
    x.fillStyle = "#5a3a44"; x.fillRect(chx, top - ROOF - 6, 8, ROOF + 4); x.fillStyle = "#6e4854"; x.fillRect(chx - 1, top - ROOF - 8, 10, 3);
    // the windows of the floors above the shop
    const cols = w >= 96 ? 3 : 2, arched = R(8) < 0.4, shut = R(9) < 0.5 ? SHUTTERS[Math.floor(R(10) * SHUTTERS.length)] : null;
    for (let f = 0; f < floors; f++) for (let q = 0; q < cols; q++) {
      const ww = 12, wh = 17, gx = L + Math.round((q + 0.5) * w / cols - ww / 2), gy = top + 7 + f * FH;
      const lit = R(20 + f * 5 + q) < 0.62;
      x.fillStyle = "#2e2232"; x.fillRect(gx - 1, gy - 1, ww + 2, wh + 2);
      x.fillStyle = lit ? "#ffc66e" : "#2a2240"; x.fillRect(gx, gy, ww, wh);
      if (lit) { x.fillStyle = "#ffe2a4"; x.fillRect(gx + 1, gy + 3, 4, 5); x.fillStyle = "#f0a850"; x.fillRect(gx, gy + wh - 3, ww, 3); }
      else { x.fillStyle = "#3a3458"; x.fillRect(gx + 1, gy + 2, 3, 6); }
      if (arched) { x.fillStyle = wall; x.fillRect(gx - 1, gy - 1, 3, 2); x.fillRect(gx + ww - 2, gy - 1, 3, 2); x.fillRect(gx - 1, gy + 1, 1, 1); x.fillRect(gx + ww, gy + 1, 1, 1); x.fillStyle = "#2e2232"; x.fillRect(gx + 2, gy - 1, ww - 4, 1); x.fillRect(gx, gy, 1, 1); x.fillRect(gx + ww - 1, gy, 1, 1); }
      x.fillStyle = "#2e2232"; x.fillRect(gx + ww / 2, gy, 1, wh); x.fillRect(gx, gy + 7, ww, 1);
      x.fillStyle = "#b9a99a"; x.fillRect(gx - 2, gy + wh + 1, ww + 4, 2);
      if (shut) { x.fillStyle = shut; x.fillRect(gx - 5, gy - 1, 4, wh + 2); x.fillRect(gx + ww + 1, gy - 1, 4, wh + 2); x.fillStyle = "rgba(0,0,0,.25)"; for (let k = 1; k < wh; k += 3) { x.fillRect(gx - 5, gy + k, 4, 1); x.fillRect(gx + ww + 1, gy + k, 4, 1); } }
      if (R(40 + f * 7 + q) < 0.3) { x.fillStyle = "#4a6a3e"; x.fillRect(gx - 1, gy + wh + 3, ww + 2, 3); x.fillStyle = R(50 + q) < 0.5 ? "#e88aa8" : "#f3d36a"; x.fillRect(gx + 1, gy + wh + 2, 2, 2); x.fillRect(gx + 6, gy + wh + 2, 2, 2); x.fillRect(gx + 10, gy + wh + 2, 1, 2); }
    }
    // the shop: a dark wooden front, a big lit window of loaves, the door with its lit pane, the step
    const sy0 = top + floors * FH, dw = 15, dx0 = L + w - dw - 6, winW = dx0 - L - 10;
    x.fillStyle = "#3a2430"; x.fillRect(L, sy0, w, SH);
    x.fillStyle = "#4e3240"; x.fillRect(L, sy0, w, 2);
    const wy = sy0 + 16;
    x.fillStyle = "#ffcf7f"; x.fillRect(L + 6, wy, winW, SH - 22);
    x.fillStyle = "#ffe0a0"; x.fillRect(L + 6, wy, winW, 4);
    x.fillStyle = "#c9884a"; x.fillRect(L + 6, wy + 13, winW, 1); x.fillRect(L + 6, wy + 24, winW, 1);
    for (let r2 = 0; r2 < 2; r2++) for (let k = 0; L + 8 + k * 8 + 6 < L + 6 + winW; k++) {
      const lx = L + 8 + k * 8, ly = wy + 9 + r2 * 11;
      x.fillStyle = "#a8642c"; x.fillRect(lx, ly, 6, 4); x.fillRect(lx + 1, ly - 1, 4, 1);
      x.fillStyle = "#d4904e"; x.fillRect(lx + 1, ly, 3, 1);
    }
    x.fillStyle = "#2e1c26"; x.fillRect(L + 6 + Math.floor(winW / 2), wy, 1, SH - 22);
    x.fillStyle = "#2a1820"; x.fillRect(dx0, sy0 + 12, dw, SH - 12);
    x.fillStyle = "#ffcf7a"; x.fillRect(dx0 + 3, sy0 + 15, dw - 6, 9);
    x.fillStyle = "#d9a050"; x.fillRect(dx0 + dw - 4, sy0 + 32, 2, 2);
    x.fillStyle = "#5a5470"; x.fillRect(dx0 - 2, sy0 + SH - 2, dw + 4, 2);
    // the awning over the window: stripes and a scalloped edge
    const ax0 = L + 2, ax1 = dx0 - 2;
    for (let k = ax0; k < ax1; k++) {
      const st = Math.floor((k - ax0) / 5) % 2 ? aw2 : aw1;
      x.fillStyle = st; x.fillRect(k, sy0 + 3, 1, 9);
      if ((k - ax0) % 5 !== 0 && (k - ax0) % 5 !== 4) x.fillRect(k, sy0 + 12, 1, 2);
    }
    x.fillStyle = "rgba(0,0,0,.28)"; x.fillRect(ax0, sy0 + 14, ax1 - ax0, 2);
    // the baker's sign on its bracket, out from the wall above the door
    const sg = ["pretzel", "loaf", "cake"][Math.floor(R(11) * 3)], rows = SIGNS[sg];
    const bx0 = dx0 + Math.round(dw / 2), byy = sy0 - 10;
    x.fillStyle = "#2a1c24"; x.fillRect(bx0 - 9, byy, 18, 2); x.fillRect(bx0 - 9, byy - 4, 2, 6); x.fillRect(bx0 + 2, byy + 2, 1, 2); x.fillRect(bx0 - 3, byy + 2, 1, 2);
    icon(x, rows, bx0 - Math.floor(rows[0].length / 2), byy + 4, "#e8b04a", "#2a1c24");
    const o = { c, w, h: top + h, left: L, chx: chx + 4, chy: top - ROOF - 8 };
    houses.set(i, o);
    if (houses.size > 60) houses.delete(houses.keys().next().value);
    return o;
  }

  /* ---------- drawing ---------- */
  function spr(name, x, y, img) {
    const s = SC.sprites[name];
    if (!s) return;
    g.drawImage(img || atlas, s[0], s[1], s[2], s[3], Math.round(x - s[4]), Math.round(y - s[5]), s[2], s[3]);
  }
  function line(x0, y0, x1, y1, w) {
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
    for (let i = 0; i <= n; i++) { const t = i / n; g.fillRect(Math.round(lerp(x0, x1, t) - w / 2), Math.round(lerp(y0, y1, t) - w / 2), w, w); }
  }
  function disc(x, y, r) {
    for (let j = Math.ceil(y - r); j <= Math.floor(y + r); j++) {
      const w = Math.sqrt(Math.max(0, r * r - (j + 0.5 - y) * (j + 0.5 - y)));
      if (w >= 0.5) g.fillRect(Math.round(x - w), j, Math.round(x + w) - Math.round(x - w), 1);
    }
  }
  // his tongue, a real one: wide where it leaves his mouth, a little narrower along, broadening again to a round
  // tip with a notch in it; darker underneath and at its edges, lit and wet on top, a groove down the middle and
  // bumps on it; it ripples as it shoots out and comes back
  function drawTongue(x0, y0, x1, y1, sag, w0, wave) {
    const L = Math.hypot(x1 - x0, y1 - y0);
    if (L < 1) return;
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2 + sag, N = Math.max(10, Math.ceil(L * 1.2)), P = [];
    const nx = -(y1 - y0) / L, ny = (x1 - x0) / L, LX = -0.55, LY = -0.83;
    for (let k = 0; k <= N; k++) {
      const t = k / N, a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, c = t * t;
      const o = wave ? wave * Math.sin(t * Math.PI * 2.2 - clock * 22) * Math.sin(t * Math.PI) : 0;
      const w = t < 0.62 ? w0 * (1 - 0.3 * t / 0.62) : t < 0.94 ? w0 * (0.7 + 0.24 * (t - 0.62) / 0.32) : w0 * 0.94;
      P.push([a * x0 + b * mx + c * x1 + nx * o, a * y0 + b * my + c * y1 + ny * o, w, t]);
    }
    g.fillStyle = "#561322"; for (const p of P) disc(p[0], p[1], p[2] + 1);
    g.fillStyle = "#a8394b"; for (const p of P) disc(p[0], p[1], p[2]);
    g.fillStyle = "#cf5466"; for (const p of P) disc(p[0] + LX * p[2] * 0.14, p[1] + LY * p[2] * 0.14, p[2] * 0.84);
    g.fillStyle = "#e67888"; for (const p of P) disc(p[0] + LX * p[2] * 0.36, p[1] + LY * p[2] * 0.36, p[2] * 0.46);
    // the groove down the middle, a shadowed line with a lit edge beside it
    for (const p of P) if (p[3] > 0.05 && p[3] < 0.9) {
      g.fillStyle = "#86283a"; g.fillRect(Math.round(p[0]), Math.round(p[1]), 1, 1);
      g.fillStyle = "#e9808f"; g.fillRect(Math.round(p[0] + LX * 1.4), Math.round(p[1] + LY * 1.4), 1, 1);
    }
    // bumps on it, and a wet shine along its top
    g.fillStyle = "#f3a1ad";
    const n = Math.floor(L / 3.5);
    for (let k = 0; k < n; k++) {
      const p = P[Math.min(N, Math.floor((k + 0.5) / n * N))], side = (hash(k * 13 + 5) - 0.5) * 1.4 * p[2];
      g.fillRect(Math.round(p[0] + nx * side), Math.round(p[1] + ny * side), 1, 1);
    }
    g.fillStyle = "#ffd4da";
    for (const p of P) if ((p[3] > 0.12 && p[3] < 0.38) || (p[3] > 0.6 && p[3] < 0.72) || p[3] > 0.9) g.fillRect(Math.round(p[0] + LX * p[2] * 0.58), Math.round(p[1] + LY * p[2] * 0.58), 1, 1);
    // the notch in the tip
    const e = P[N], q = P[Math.max(0, N - 2)], ex = e[0] - q[0], ey = e[1] - q[1], el = Math.hypot(ex, ey) || 1;
    g.fillStyle = "#86283a"; g.fillRect(Math.round(e[0] + ex / el * (e[2] - 1)), Math.round(e[1] + ey / el * (e[2] - 1)), 1, 1);
    g.fillStyle = "#561322"; g.fillRect(Math.round(e[0] + ex / el * (e[2] + 0.4)), Math.round(e[1] + ey / el * (e[2] + 0.4)), 1, 1);
  }
  // where his tongue touches a treat: a little short of its middle, on his side; on the moon, the rim
  function tipOf(t) {
    if (t.moon) return [t.ax, t.ay];
    const fr = SC.treats[t.kind].frame, s2 = SC.sprites[fr], c = SC.treats[t.kind].centre;
    const cx = t.ax + (c[0] - s2[4]) / PPM, cy = t.ay - (c[1] - s2[5]) / PPM, dx = px - cx, dy = py - cy, d = Math.hypot(dx, dy) || 1, k = Math.min(s2[2], s2[3]) * 0.22 / PPM;
    return [cx + dx / d * k, cy + dy / d * k];
  }
  function ring(x, y, r, dash) {
    const n = Math.max(24, Math.round(r * 5));
    for (let k = 0; k < n; k++) {
      if (dash && (k >> 1) % 2) continue;
      const a = k / n * 2 * Math.PI; g.fillRect(Math.round(x + r * Math.cos(a)), Math.round(y + r * Math.sin(a)), 1, 1);
    }
  }

  function draw() {
    const sh = shake > 0 && !reduce ? Math.round(Math.sin(clock * 70) * 2 * shake / 0.35) : 0;
    g.setTransform(1, 0, 0, 1, 0, sh);
    g.drawImage(skyC, 0, 0);
    const aim = state === "play" && !tongue ? target() : null;
    // the cheese moon, once he has gone up high enough to find it
    if (moonX !== null && moonC) {
      const mx = sx(moonX), my = sy(MOON_Y), hw = moonC.width / 2;
      if (my + hw > 0 && my - hw < H && mx + hw > 0 && mx - hw < W) {
        g.drawImage(moonC, mx - hw, my - hw);
        if (moonLicked > 0 && tipX) { g.globalAlpha = moonLicked; g.fillStyle = "#fffaf0"; g.fillRect(sx(tipX) - 3, sy(tipY) - 2, 3, 1); g.globalAlpha = 1; }
      }
      if (aim && aim.moon) {
        const pulse = 0.5 + 0.5 * Math.sin(clock * 10), x = sx(aim.ax), y = sy(aim.ay);
        g.fillStyle = "rgba(255,240,190,.9)"; ring(x, y, 8 + pulse); g.fillStyle = "rgba(42,16,40,.8)"; ring(x, y, 9 + pulse);
      }
    }
    // the far roofs
    const fy = Math.round(STREET - 150 + camY * PPM * 0.2), fo = ((Math.floor(camX * PPM * 0.18) % 540) + 540) % 540;
    g.drawImage(farC, -fo, fy); g.drawImage(farC, 540 - fo, fy);
    // smoke from the far chimneys drifting off
    // the row of bakeries along the street, moving slower than the street
    const by = STREET + Math.round(camY * PPM * LAYER), base = camX * PPM * LAYER;
    while (leftOf(firstHouse) > base) firstHouse--;
    while (leftOf(firstHouse + 1) <= base) firstHouse++;
    for (let i = firstHouse; leftOf(i) - base < W + 10; i++) {
      const o = house(i), x = Math.round(leftOf(i) - base);
      if (x + o.w < -10) continue;
      g.drawImage(o.c, x - o.left, by - o.h);
      // the ovens are lit: smoke from the chimney, drifting off
      if (!reduce) for (let k = 0; k < 4; k++) {
        const u = ((clock * 0.35 + k / 4 + hash(i)) % 1), r = 2 + Math.round(u * 4);
        g.fillStyle = "rgba(236,226,240," + (0.42 * (1 - u)).toFixed(2) + ")";
        g.fillRect(x - o.left + o.chx - r + Math.round(u * 14 + Math.sin(clock + k) * 2), by - o.h + o.chy - Math.round(u * 30) - r, r * 2, r * 2);
      }
    }
    // the street and the kerb
    const cy0 = STREET + Math.round(camY * PPM), co = ((Math.floor(camX * PPM) % 64) + 64) % 64;
    for (let x = -co; x < W; x += 64) g.drawImage(cobC, x, cy0);
    g.fillStyle = "#4d4a66"; if (cy0 + 30 < H) g.fillRect(0, cy0 + 30, W, H - cy0 - 30);
    // the street lamps along the kerb, still lit at dawn
    for (let k = Math.floor((camX - 1) / 9); k * 9 + 3 < camX + W / PPM + 1; k++) {
      const lx = sx(k * 9 + 3), ly = sy(0), lt = sy(4.4);
      g.fillStyle = "rgba(255,200,120,.08)"; disc(lx, lt - 8, 16); g.fillStyle = "rgba(255,200,120,.12)"; disc(lx, lt - 8, 9);
      g.fillStyle = "#2a2036"; g.fillRect(lx - 1, lt, 3, ly - lt); g.fillRect(lx - 3, ly - 7, 7, 7); g.fillRect(lx - 2, ly - 9, 5, 2);
      g.fillRect(lx - 4, lt - 1, 9, 2); g.fillRect(lx - 4, lt - 14, 9, 13); g.fillRect(lx - 3, lt - 16, 7, 2); g.fillRect(lx - 1, lt - 18, 3, 2);
      g.fillStyle = "#ffd890"; g.fillRect(lx - 3, lt - 13, 7, 11); g.fillStyle = "#fff0c8"; g.fillRect(lx - 2, lt - 12, 2, 4);
      g.fillStyle = "#2a2036"; g.fillRect(lx, lt - 13, 1, 11);
    }

    // the bunting the treats hang from: a rope from string to string, little flags on it
    const ty = sy(BUNTING);
    const vis = treats.filter(t => sx(t.x) > -60 && sx(t.x) < W + 60);
    if (ty > -20) {
      for (let k = 0; k + 1 < vis.length; k++) {
        const a = vis[k], b = vis[k + 1], ax = sx(a.x), bx = sx(b.x);
        for (let x = ax; x <= bx; x++) {
          const u = (x - ax) / Math.max(1, bx - ax), sag = 10 * 4 * u * (1 - u), y = Math.round(ty + sag);
          g.fillStyle = "#3a2a40"; g.fillRect(x, y, 1, 1);
          if ((x - ax) % 9 === 4 && u > 0.08 && u < 0.92) {
            const f = Math.floor(hash(Math.floor(a.x * 10) + x) * 4);
            g.fillStyle = ["#e86a7a", "#f3d36a", "#6ac0a8", "#8aa0e8"][f];
            g.fillRect(x - 2, y + 1, 5, 2); g.fillRect(x - 1, y + 3, 3, 2); g.fillRect(x, y + 5, 1, 1);
          }
        }
      }
    }
    // the treats on their strings; the one his tongue would go to has a ring round it
    for (const t of vis) {
      const x = sx(t.ax), y = sy(t.ay), s = SC.sprites[SC.treats[t.kind].frame], c = SC.treats[t.kind].centre;
      const topY = y - s[5] + 1, topX = x;
      g.fillStyle = "#2a2036"; line(sx(t.x), ty, topX, topY, 1);
      const cx = x - s[4] + c[0], cy = y - s[5] + c[1];
      if (t === aim) {
        const pulse = 0.5 + 0.5 * Math.sin(clock * 10), r = Math.max(s[2], s[3]) * 0.62 + 2 + pulse;
        g.fillStyle = "rgba(255,240,190,.9)"; ring(cx, cy, r); g.fillStyle = "rgba(42,16,40,.8)"; ring(cx, cy, r + 1);
      }
      // the one on his tongue flickers before it is eaten, faster at the end
      const left = tongue && tongue.t === t ? tongue.lasts - tongue.held : 9, hide = left < 1.5 && !reduce && Math.floor(clock * (left < 0.6 ? 18 : 9)) % 2;
      if (!hide) spr(SC.treats[t.kind].frame, x, y, t.stale ? staleImg : atlas);
      if (t.stale) {
        // flies round a stale one
        for (let k = 0; k < 3; k++) { const a = clock * (5 + k) + k * 2.1; g.fillStyle = "#1a1420"; g.fillRect(Math.round(cx + Math.cos(a) * (6 + k * 2)), Math.round(cy - 6 + Math.sin(a * 1.3) * 5), 1, 1); }
      }
      if (t.licked > 0) {
        // a lick shines on it a while
        g.globalAlpha = t.licked; g.fillStyle = "#fffaf0"; g.fillRect(cx - 3, cy - 2, 2, 1); g.fillRect(cx - 2, cy - 1, 1, 1); g.globalAlpha = 1;
      }
    }

    // a baker's peel coming out of a door to flip him back up
    if (peelT >= 0) drawPeel();

    // him: the inside of his mouth shows through the hole of the ring
    const fi = ((Math.round(psi / (2 * Math.PI / 24)) % 24) + 24) % 24, f = SC.booblick.frames[fi], s = SC.sprites[f];
    const bx = sx(px), byy = sy(py), hole = SC.booblick.hole[fi], hx2 = bx - s[4] + hole[0], hy2 = byy - s[5] + hole[1], rh = SC.booblick.r_hole;
    g.fillStyle = "#4a1420"; disc(hx2, hy2, rh + 0.5);
    g.fillStyle = "#7a2634"; disc(hx2 + 0.5, hy2 - 1, rh * 0.7);
    spr(f, bx, byy);
    // his tongue, out of his mouth in front of him: hanging out and flapping behind him as he flies, or out to what
    // he licks, shooting there and drawn back in
    const mo = SC.booblick.mouth[fi], mx0 = bx - s[4] + mo[0], my0 = byy - s[5] + mo[1];
    let mdx = mx0 - hx2, mdy = my0 - hy2; const ml = Math.hypot(mdx, mdy) || 1; mdx /= ml; mdy /= ml;
    const spd = Math.hypot(vx, vy) || 1, trail = clamp(spd / 6, 0, 1);
    const lx = mdx * 0.7 - vx / spd * 0.5 * trail, ly = mdy * 0.7 + 0.45 + vy / spd * 0.5 * trail, ll = Math.hypot(lx, ly) || 1;
    let tx1 = mx0 + lx / ll * 14, ty1 = my0 + ly / ll * 14, sag = 3, wave = reduce ? 0 : 0.8;
    if (tongue || back > 0) {
      const t = tongue ? tongue.t : null, u = tongue ? tongue.out : back;
      if (t) [tipX, tipY] = tipOf(t);
      tx1 = lerp(tx1, sx(tipX), u); ty1 = lerp(ty1, sy(tipY), u); sag = lerp(3, 1.5, u);
      wave = reduce ? 0 : tongue ? 3 * (1 - u) : 2.5 * back;
    }
    drawTongue(mx0, my0, tx1, ty1, sag, 6, wave);

    // crumbs, seeds and flour
    for (const b of bits) { g.fillStyle = b.c; g.fillRect(sx(b.x), sy(b.y), 1, 1); }
    for (const f2 of puffs) { g.fillStyle = "rgba(246,236,214," + (0.7 * (1 - f2.t / f2.life)).toFixed(2) + ")"; const r = Math.round(f2.r * (0.6 + f2.t / f2.life)); g.fillRect(sx(f2.x) - r, sy(f2.y) - r, r * 2, r * 2); }
    // the ground at the bottom when the camera has risen: nothing more to draw
    g.setTransform(1, 0, 0, 1, 0, 0);
    hudCanvas();
  }
  function drawPeel() {
    // a long wooden handle and a flat blade, swinging up from below the kerb
    const u = clamp(peelT / 0.28, 0, 1), after = peelT > 0.28 ? (peelT - 0.28) / 0.47 : 0;
    const a = lerp(-1.2, -0.25, u) + after * 0.3, x0 = sx(px) - 22, y0 = sy(0) + 30;
    const L = 46, ex = x0 + Math.cos(a) * L, ey = y0 + Math.sin(a) * L;
    g.globalAlpha = 1 - after;
    g.fillStyle = "#6a4426"; line(x0, y0, ex, ey, 3);
    g.fillStyle = "#c08a50";
    for (let k = -6; k <= 14; k++) { const qx = ex + Math.cos(a) * k, qy = ey + Math.sin(a) * k; g.fillRect(Math.round(qx - Math.sin(a) * 7), Math.round(qy + Math.cos(a) * 7), 1, 1); line(qx - Math.sin(a) * 6, qy + Math.cos(a) * 6, qx + Math.sin(a) * 6, qy - Math.cos(a) * 6, 1); }
    g.globalAlpha = 1;
  }

  function hudCanvas() {
    // the falls he has left: three little bread rings under the channel
    for (let i = 0; i < LIVES; i++) {
      const x = 15 + i * 14, y = 37, ok = i < lives;
      g.fillStyle = ok ? "#d99a4a" : "rgba(217,154,74,.22)"; disc(x, y, 5);
      g.fillStyle = ok ? "#120d27" : "rgba(18,13,39,.5)"; disc(x, y, 2);
      if (ok) { g.fillStyle = "#fff3d8"; g.fillRect(x - 3, y - 3, 1, 1); g.fillRect(x + 2, y - 2, 1, 1); }
    }
    g.font = "16px VT323, monospace"; g.textAlign = "center";
    for (const p of pops) { const x = sx(p.x), y = sy(p.y); g.globalAlpha = Math.max(0, 1 - p.t / 1.1); g.fillStyle = "#000"; g.fillText(p.text, x + 1, y + 1); g.fillStyle = p.col; g.fillText(p.text, x, y); g.globalAlpha = 1; }
    // above the top of the screen: a mark where he is
    if (sy(py) < 0) { const x = sx(px); g.fillStyle = "#ffe7a8"; g.fillRect(x - 3, 4, 7, 2); g.fillRect(x - 2, 2, 5, 2); g.fillRect(x - 1, 0, 3, 2); }
  }

  let last = performance.now(), frozen = false;
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
    last = now;
    if (!ready) return;
    if (state !== "pause" && !frozen) update(dt);
    draw();
  }

  /* ---------- input: hold to lick ---------- */
  const screen = $("screen");
  screen.addEventListener("pointerdown", e => {
    if (e.target.closest("button, a")) return;
    if (state === "pause") { pause(false); return; }
    if (state !== "play" && state !== "tumble") return;
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
  const LICKK = new Set(["Space", "ArrowUp", "KeyW", "Enter"]);
  addEventListener("keydown", e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const el = e.target instanceof Element ? e.target : null;
    if (el && el !== document.body && el.closest("button") && (e.code === "Space" || e.code === "Enter")) return;
    if ((e.code === "Space" || e.code === "Enter") && (state === "ready" || (state === "over" && !$("over").hidden))) { e.preventDefault(); start(); return; }
    if (LICKK.has(e.code)) { e.preventDefault(); if (state === "pause") pause(false); keyHold = true; }
    else if (e.code === "KeyP" || e.code === "Escape") { if (state === "play") pause(true); else if (state === "pause") pause(false); }
  });
  addEventListener("keyup", e => { if (LICKK.has(e.code)) keyHold = false; });
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
    const url = "https://rotville.world/games/lickety-split/", label = $("share").querySelector(".tape-label");
    const text = metres === 0 ? "Booblick swung nowhere in the Bakery District on rotville.world. Customers do not tolerate him."
      : "Booblick swung " + metres + " metres across the Bakery District on his tongue at rotville.world.";
    if (navigator.share) {
      try { await navigator.share({ title: "Lickety-Split", text, url }); return; } catch (err) { if (err && err.name === "AbortError") return; }
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

  // a bot can read the street through this, on a page opened with #debug, and step it
  if (location.hash === "#debug") {
    window.__ls = {
      get: () => ({ state, T, px, py, vx, vy, lives, metres, licks, held: wasHeld, sx: sx(px), sy: sy(py), tongue: tongue ? { x: tongue.t.ax, y: tongue.t.ay, len: tongue.len, left: tongue.lasts - tongue.held } : null,
                    aim: (() => { const t = target(); return t ? { x: t.ax, y: t.ay } : null; })(),
                    treats: treats.map(t => ({ x: t.ax, y: t.ay, stale: t.stale })) }),
      hold: on => { keyHold = on; }, start, freeze: on => { frozen = on; }, step: dt => update(dt), draw: () => draw(), shot: () => cv.toDataURL(),
      put: (x, y, vx2, vy2) => { px = x; py = y; vx = vx2; vy = vy2; },
      moon: () => (moonX === null ? null : { x: moonX, y: MOON_Y, r: MOON_R }),
      log: LOG, REACH, G, BODY,
    };
  }

  Promise.all([fetch("assets/scene.json").then(r => r.json()), load("assets/sprites.png")])
    .then(([s, a]) => {
      SC = s; atlas = a;
      // the stale ones: the same drawings, grey and green
      const [c, x] = off(a.width, a.height);
      x.drawImage(a, 0, 0);
      x.globalCompositeOperation = "saturation"; x.fillStyle = "hsl(0,0%,50%)"; x.fillRect(0, 0, a.width, a.height);
      x.globalCompositeOperation = "multiply"; x.fillStyle = "rgb(150,170,130)"; x.fillRect(0, 0, a.width, a.height);
      x.globalCompositeOperation = "destination-in"; x.drawImage(a, 0, 0);
      staleImg = c;
      buildSky(); buildMoon();
      reset(); ready = true;
    })
    .catch(() => { $("sub").textContent = "The tape would not load. Try the page again."; });
  requestAnimationFrame(frame);
})();
