/* Fizz: Puzzle Bobble in a FIZZCO syrup vat.

   Whisko (LORE 4.10) is FIZZCO's mixer, "a magenta cone with a paddle, loves the bubbles, hates the paperwork". He
   works the nozzle under the vat and fires flavour bubbles up into it: three or more of one flavour touching pop, and
   whatever they were holding up falls. Stroops, the brew unit who stirs the vats and "worries about stopping", turns
   the press's wheel on top of the vat, and every so many shots the press comes down a row. Cracked Keyf, the inspector
   with the clipboard who "writes things down", stands on his ledge at the line. When the bubbles reach it, he writes it
   down and the shift is over. Empty the vat and the next shift starts: more flavours, more rows, a busier press.

   The first shift is plain: three flavours, four rows, a long guide and a slow press. Every shift after it adds one
   notch. The residents stand beside the board, upright, as part of the screen: rigid figurines turned, tipped and bowed
   whole, drawn at 15 fps under the 60 fps page like the clips' residents (R819, R1070). Only pre-rendered sprites and
   a pre-rendered backdrop ship. */
(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  const W = 270, H = 480;
  const cv = $("c"), g = cv.getContext("2d");
  g.imageSmoothingEnabled = false;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const store = {
    get(k, d) { try { const v = localStorage.getItem("fizz." + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem("fizz." + k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
  };
  const load = src => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });
  const rnd = (a, b) => a + Math.random() * (b - a);
  const rint = n => Math.floor(Math.random() * n);
  const pick = a => a[rint(a.length)];
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const fmt = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const off = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d"); x.imageSmoothingEnabled = false; return [c, x]; };

  const RESIDENT_STEP = 1 / 15;
  // the vat, as the backdrop draws it: eight bubbles of 26 across, the press's underside at TOP0, the line, the base
  const VX0 = 12, VX1 = 220, D = 26, R = 13, ROWH = D * Math.sqrt(3) / 2;
  const TOP0 = 84, LINE = 356, VBOT = 396;
  const PIV = { x: 116, y: 402 }, TIP = 24;                       // the nozzle turns on its foot; the bubble sits at its tip
  const JAR = { x: 156, y: 443 };                                 // the next flavour waits in the jar
  const WH = { x: 70, y: 475 }, KF = { x: 250, y: 356 }, ST = { x: 80, y: 58 }, WHEEL = { x: 101, y: 50 };
  const GAUGE = { x: 249, y: 104 }, LAMP = { x: 160, y: 37 };
  const SPEED = 560, AIM_MAX = 78 * Math.PI / 180;
  const FLAVOURS = ["cherry", "lemon", "blue", "lime", "orange", "grape"];
  const TINT = { cherry: "#e0303f", lemon: "#f2cc2c", blue: "#3a6df0", lime: "#5fc232", orange: "#f07a1e", grape: "#9c42d6" };
  // HOW HARD A SHIFT IS. The first is plain; each after it adds one notch: a flavour, a row, a busier press, less guide.
  const flavoursOf = n => Math.min(6, 3 + Math.floor(n / 2));
  const rowsOf = n => Math.min(8, 4 + Math.floor((n + 1) / 2));
  const pressOf = n => Math.max(5, Math.round(14 - 1.5 * n));
  const guideOf = n => (n === 0 ? 220 : n < 3 ? 150 : 90);

  /* ---------- sound: the bed, four lines, the rest made on the spot ---------- */
  const audio = {
    ctx: null, on: store.get("sound", true), raw: {}, buf: {}, music: null,
    fetch() {
      for (const [k, f] of [["start", "assets/line-start.mp3"], ["press", "assets/line-press.mp3"], ["clear", "assets/line-clear.mp3"],
                            ["end", "assets/line-end.mp3"], ["music", "assets/carousel-slow.mp3"]]) {
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
      this.mus = c.createGain(); this.mus.gain.value = 0.2; this.mus.connect(this.master);
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
      e.gain.setValueAtTime(0.0008, t); e.gain.exponentialRampToValueAtTime(vol, t + 0.01); e.gain.exponentialRampToValueAtTime(0.0008, t + dur);
      o.connect(e).connect(this.fxg); o.start(t); o.stop(t + dur + 0.03);
    },
    noise(dur, vol, lo, hi, when = 0) {
      if (!this.ctx) return;
      const c = this.ctx, t = c.currentTime + when, s = c.createBufferSource(), a = c.createBiquadFilter(), b = c.createBiquadFilter(), e = c.createGain();
      s.buffer = this.noiseBuf; s.loop = true; a.type = "highpass"; a.frequency.value = lo; b.type = "lowpass"; b.frequency.value = hi;
      e.gain.setValueAtTime(vol, t); e.gain.exponentialRampToValueAtTime(0.0008, t + dur);
      s.connect(a).connect(b).connect(e).connect(this.fxg); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.03);
    },
    // the nozzle: a soft push of air and a rising glass note
    fire() { this.noise(0.12, 0.09, 300, 2400); this.tone(320, 760, 0.12, "sine", 0.08); },
    tink() { this.tone(2100, 1900, 0.05, "sine", 0.05); this.tone(3150, 3000, 0.04, "sine", 0.02); },
    // glass against glass
    clink() { this.tone(1250, 1210, 0.09, "sine", 0.07); this.tone(1720, 1690, 0.07, "sine", 0.04, 0.01); },
    // one bubble: a fizzing pop, pitched up the longer a run of them goes
    pop(i) {
      const w = i * 0.045, up = 1 + Math.min(i, 10) * 0.07;
      this.noise(0.16, 0.08, 2200, 9000, w);
      this.tone(700 * up, 1500 * up, 0.06, "triangle", 0.07, w);
      for (let k = 0; k < 3; k++) { const f = rnd(2600, 4800); this.tone(f, f * 1.1, 0.03, "sine", 0.025, w + 0.03 + k * 0.025); }
    },
    // what falls: a glug each, going down
    glug(i) { const w = 0.08 + i * 0.06; this.tone(300, 120, 0.22, "sine", 0.1, w); this.noise(0.12, 0.03, 200, 900, w + 0.05); },
    // the press: a clank and the screw grinding
    press() { this.noise(0.35, 0.09, 120, 900); this.tone(130, 85, 0.3, "square", 0.06); this.noise(0.06, 0.1, 1500, 7000, 0.3); this.tone(240, 220, 0.12, "square", 0.05, 0.3); },
    creak() { this.tone(180, 210, 0.08, "sawtooth", 0.025); },
    swap() { this.tone(660, 990, 0.06, "triangle", 0.06); this.tone(990, 660, 0.06, "triangle", 0.04, 0.06); },
    tick() { this.tone(1500, 1490, 0.025, "square", 0.025); },
    // a pen on a clipboard
    scratch(k) { for (let i = 0; i < k; i++) this.noise(0.07, 0.05, 2500, 7000, i * 0.11 + rnd(0, 0.03)); },
    fanfare() {
      [523, 659, 784, 1046].forEach((f, i) => this.tone(f, f * 1.01, 0.14, "triangle", 0.12, 0.1 + i * 0.08));
      this.tone(1046, 1052, 0.45, "triangle", 0.1, 0.44); this.tone(1318, 1322, 0.45, "sine", 0.05, 0.44);
      for (let k = 0; k < 10; k++) { const f = 1800 + Math.random() * 2400; this.tone(f, f * 1.05, 0.05, "sine", 0.03, 0.5 + k * 0.06); }
    },
    sad() { [392, 349, 311, 262].forEach((f, i) => this.tone(f, f * 0.98, 0.3, "triangle", 0.09, 0.2 + i * 0.22)); },
  };
  audio.fetch();

  /* ---------- the board ---------- */
  const cols = r => (r & 1 ? 7 : 8);
  let SC = null, atlas = null, bg = null, ready = false;
  let state = "ready", shift = 0, score = 0, best = store.get("best", 0), shots = 0, pressShots = 0, drops = 0;
  let grid = [], top = TOP0, topDraw = TOP0, palette = [], cur = null, nxt = null, fly = null;
  let aim = 0, aiming = false, keyAim = 0, clock = 0, acc = 0, overT = 0, clearT = 0, shake = 0;
  let pops = [], falls = [], bits = [], notes = [], fizz = [], confetti = [], wake = [], clouds = [];
  // where the carbonation comes up from the bottom of the vat, in steady strings, clear of the nozzle
  const STREAMS = [30, 64, 168, 202].map(x => ({ x, t: Math.random() * 0.3 }));
  let said = {}, sawPress = false;
  const wh = { pose: "whisko_a0", act: "", t: 0, dy: 0, wig: 0 };
  const kf = { pose: "keyf_idle", act: "", t: 0 };
  const st = { pose: "stroops_c1", act: "", t: 0, k: 0, wk: 0 };

  const cx = (r, c) => VX0 + R + c * D + (r & 1 ? R : 0);
  const cy = r => top + R + r * ROWH;
  const at = (r, c) => (r >= 0 && r < grid.length && c >= 0 && c < cols(r) ? grid[r][c] : null);
  function neighbours(r, c) {
    const o = r & 1 ? 0 : -1;
    return [[r, c - 1], [r, c + 1], [r - 1, c + o], [r - 1, c + o + 1], [r + 1, c + o], [r + 1, c + o + 1]]
      .filter(([a, b]) => a >= 0 && b >= 0 && b < cols(a));
  }
  function ensure(r) { while (grid.length <= r) grid.push(Array(cols(grid.length)).fill(null)); }
  const present = () => { const s = new Set(); for (const row of grid) for (const v of row) if (v) s.add(v); return [...s]; };
  const count = () => grid.reduce((n, row) => n + row.filter(Boolean).length, 0);
  const lowest = () => { let y = -1; grid.forEach((row, r) => { if (row.some(Boolean)) y = cy(r) + R; }); return y; };

  // a shift's vat: rows from the press down, flavours run together so most shots have somewhere to go
  function newVat(n) {
    palette = FLAVOURS.slice(0, flavoursOf(n));
    grid = [];
    const rows = rowsOf(n);
    for (let r = 0; r < rows; r++) {
      ensure(r);
      for (let c = 0; c < cols(r); c++) {
        const left = c > 0 ? grid[r][c - 1] : null, up = r > 0 ? grid[r - 1][Math.min(c, cols(r - 1) - 1)] : null;
        const t = Math.random();
        grid[r][c] = left && t < 0.42 ? left : up && t < 0.62 ? up : pick(palette);
      }
    }
    // no flavour alone: every one there is at least three times, so it can always be popped
    for (const f of palette) {
      let k = 0;
      grid.forEach(row => row.forEach(v => { if (v === f) k++; }));
      for (let i = k; i > 0 && i < 3; i++) {
        const r = rint(rows), c = rint(cols(r));
        grid[r][c] = f;
      }
    }
  }
  function nextFlavour() {
    const here = present();
    return pick(here.length ? here : palette);
  }

  function startShift() {
    top = TOP0; topDraw = TOP0; pressShots = 0; shots = 0; drops = 0; shake = 0;
    newVat(shift);
    cur = nextFlavour(); nxt = nextFlavour();
    fly = null; falls = []; pops = [];
    hud();
  }

  function start() {
    audio.unlock();
    shift = 0; score = 0; said = {}; sawPress = false;
    confetti = []; notes = []; bits = [];
    state = "play";
    startShift();
    $("ready").hidden = true; $("over").hidden = true;
    $("static").classList.remove("on");
    say("start", "Whisko loves the bubbles.");
    hud();
  }

  function say(k, text) {
    if (said[k]) return;
    said[k] = true;
    const sub = $("sub");
    sub.textContent = text;
    audio.line(k).then(d => setTimeout(() => { if (sub.textContent === text) sub.textContent = ""; }, Math.max(1800, d * 1000 + 300)));
  }

  function hud() {
    $("score").textContent = fmt(score);
    $("shift").textContent = "SHIFT " + (shift + 1);
    $("best").textContent = "Best " + fmt(best);
  }

  /* ---------- a shot ---------- */
  function fire() {
    if (state !== "play" || fly || !cur) return;
    const a = aim;
    fly = { x: PIV.x + Math.sin(a) * TIP, y: PIV.y - Math.cos(a) * TIP, vx: Math.sin(a) * SPEED, vy: -Math.cos(a) * SPEED, f: cur };
    cur = nxt; nxt = nextFlavour();
    shots++; pressShots++;
    audio.fire();
    act(wh, "fire");
  }
  function swap() {
    if (state !== "play" || !cur || !nxt) return;
    [cur, nxt] = [nxt, cur];
    audio.swap();
  }

  // where a bubble that has hit something stays: the nearest free place touching what holds it
  function snap(x, y) {
    let bestCell = null, bd = 1e9;
    const r0 = Math.max(0, Math.round((y - top - R) / ROWH));
    for (let r = Math.max(0, r0 - 1); r <= r0 + 1; r++) {
      for (let c = 0; c < cols(r); c++) {
        if (at(r, c)) continue;
        const held = r === 0 || neighbours(r, c).some(([a, b]) => at(a, b));
        if (!held) continue;
        const d = Math.hypot(cx(r, c) - x, cy(r) - y);
        if (d < bd) { bd = d; bestCell = [r, c]; }
      }
    }
    return bestCell;
  }

  function land(x, y, f) {
    const cell = snap(x, y);
    if (!cell) return;
    const [r, c] = cell;
    ensure(r);
    grid[r][c] = f;
    audio.clink();
    // three or more of one flavour touching pop
    const same = [[r, c]], seen = new Set([r + "," + c]);
    for (let i = 0; i < same.length; i++) {
      for (const [a, b] of neighbours(...same[i])) {
        const k = a + "," + b;
        if (!seen.has(k) && at(a, b) === f) { seen.add(k); same.push([a, b]); }
      }
    }
    let popped = 0, fell = 0;
    if (same.length >= 3) {
      same.sort((p, q) => Math.hypot(cx(...p) - x, cy(p[0]) - y) - Math.hypot(cx(...q) - x, cy(q[0]) - y));
      same.forEach(([a, b], i) => {
        pops.push({ x: cx(a, b), y: cy(a), f, t: -i * 0.035 });
        grid[a][b] = null; audio.pop(i);
        // a spray of syrup in the flavour's colour, and a few white drops of fizz
        for (let k = 0; k < (reduce ? 3 : 8); k++) {
          const ang = rnd(0, Math.PI * 2), sp = rnd(50, 140);
          bits.push({ x: cx(a, b), y: cy(a), vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 40, t: -i * 0.035, life: rnd(0.35, 0.6), c: k % 3 ? TINT[f] : "#fff6e0" });
        }
      });
      popped = same.length;
      // and whatever they held up falls
      const hold = new Set(), q = [];
      for (let b = 0; b < cols(0); b++) if (at(0, b)) { hold.add("0," + b); q.push([0, b]); }
      for (let i = 0; i < q.length; i++) {
        for (const [a, b] of neighbours(...q[i])) {
          const k = a + "," + b;
          if (!hold.has(k) && at(a, b)) { hold.add(k); q.push([a, b]); }
        }
      }
      grid.forEach((row, a) => row.forEach((v, b) => {
        if (v && !hold.has(a + "," + b)) {
          falls.push({ x: cx(a, b), y: cy(a), vx: rnd(-24, 24), vy: rnd(-30, 10), f: v, t: 0, ph: rnd(0, 6) });
          grid[a][b] = null; audio.glug(fell); fell++;
        }
      }));
      const got = popped * 10 + (fell ? 20 * fell * (1 + Math.floor(fell / 4)) : 0);
      score += got;
      notes.push({ x, y: y - 8, s: "+" + got, t: 0 });
      if (popped + fell >= 6) act(wh, "hop");
      if (fell >= 4) act(kf, "note");
      while (grid.length && !grid[grid.length - 1].some(Boolean)) grid.pop();
    }
    hud();
    if (!count()) { cleared(); return; }
    if (pressShots >= pressOf(shift)) press();
    if (lowest() > LINE) { over(); return; }
    // what comes next is a flavour still in the vat
    const here = present();
    if (here.length) {
      if (!here.includes(cur)) cur = pick(here);
      if (!here.includes(nxt)) nxt = pick(here);
    }
  }

  // Stroops has turned the wheel far enough: the press comes down a row
  function press() {
    pressShots = 0;
    top += ROWH;
    drops++;
    audio.press();
    act(st, "worry"); act(kf, "note");
    shake = 0;
    if (!sawPress) { sawPress = true; say("press", "Stroops cannot stop stirring."); }
  }

  function cleared() {
    state = "clear"; clearT = 0;
    const bonus = 500 * (shift + 1) + Math.max(0, 40 - shots) * 25;
    score += bonus;
    notes.push({ x: 116, y: 230, s: "+" + fmt(bonus), t: 0, big: true });
    audio.fanfare();
    act(wh, "cheer");
    for (let k = 0; k < (reduce ? 20 : 70); k++) {
      confetti.push({ x: rnd(VX0 + 6, VX1 - 6), y: rnd(TOP0, LINE), vx: rnd(-40, 40), vy: rnd(-160, -40), f: pick(FLAVOURS), t: -rnd(0, 0.5), life: rnd(1.2, 2.2), k: rint(2) + 1 });
    }
    say("clear", "The vat is empty. Nothing to write down.");
    hud();
  }

  function over() {
    state = "writing"; overT = 0;
    act(kf, "write");
    act(wh, "gloom");
    audio.scratch(6);
    audio.sad();
    if (score > best) { best = score; store.set("best", best); }
    hud();
  }

  function end() {
    state = "over";
    $("over-title").textContent = "Cracked Keyf wrote it down.";
    $("over-line").textContent = "Whisko hates the paperwork. " + (shift === 0 ? "He was on his first shift." : "He lasted " + (shift + 1) + " shifts.");
    $("over-stats").textContent = (score > 0 && score === best ? "His best: " : "Score ") + fmt(score) + (score === best ? "" : " · Best " + fmt(best));
    say("end", "Cracked Keyf writes it down.");
    setTimeout(() => { if (state === "over") { $("over").hidden = false; $("again").focus({ preventScroll: true }); } }, 600);
  }

  function act(who, a) { who.act = a; who.t = 0; }

  /* ---------- the clock ---------- */
  const STEP = 1 / 240;
  function update(dt) {
    clock += dt;
    for (const who of [wh, kf, st]) who.t += dt;
    if (keyAim) aim = clamp(aim + keyAim * 1.6 * dt, -AIM_MAX, AIM_MAX);
    // the press slides to where it is, the last shots before it comes down it shudders
    topDraw += (top - topDraw) * Math.min(1, dt * 10);
    shake = state === "play" && pressOf(shift) - pressShots <= 2 ? 1 : 0;
    if (fly) {
      for (let s = dt; s > 0 && fly; s -= STEP) {
        const h = Math.min(STEP, s);
        fly.x += fly.vx * h; fly.y += fly.vy * h;
        fly.trail = (fly.trail || 0) + SPEED * h;
        if (fly.trail > 6 && !reduce) { fly.trail = 0; wake.push({ x: fly.x + rnd(-3, 3), y: fly.y + rnd(-2, 4), t: 0, life: rnd(0.35, 0.7) }); }
        if (fly.x < VX0 + R) { fly.x = VX0 + R; fly.vx = Math.abs(fly.vx); audio.tink(); }
        if (fly.x > VX1 - R) { fly.x = VX1 - R; fly.vx = -Math.abs(fly.vx); audio.tink(); }
        let hit = fly.y - R <= top;
        if (!hit) {
          const r0 = Math.floor((fly.y - top) / ROWH);
          for (let r = Math.max(0, r0 - 1); r <= r0 + 1 && !hit; r++) {
            if (r >= grid.length) continue;
            for (let c = 0; c < cols(r); c++) {
              if (grid[r][c] && Math.hypot(cx(r, c) - fly.x, cy(r) - fly.y) < D - 4) { hit = true; break; }
            }
          }
        }
        if (hit) { const f = fly; fly = null; land(f.x, Math.max(f.y, top + R), f.f); }
      }
    }
    for (const p of pops) p.t += dt;
    pops = pops.filter(p => p.t < 0.3);
    for (const b of falls) {
      b.t += dt;
      b.vy = Math.min(150, b.vy + 320 * dt);
      b.vx *= 1 - 1.8 * dt;
      b.x = clamp(b.x + b.vx * dt + Math.sin(b.t * 5 + b.ph) * 0.25, VX0 + R, VX1 - R);
      b.y += b.vy * dt;
    }
    falls = falls.filter(b => {
      if (b.y < VBOT - R) return true;
      clouds.push({ x: b.x, y: VBOT - R + 2, c: TINT[b.f], t: 0 });
      for (let k = 0; k < 3; k++) bits.push({ x: b.x, y: VBOT - 6, vx: rnd(-30, 30), vy: rnd(-40, -10), t: 0, life: rnd(0.4, 0.7), c: TINT[b.f] });
      return false;
    });
    for (const c of clouds) c.t += dt;
    clouds = clouds.filter(c => c.t < 0.9);
    // in syrup a spray does not get far: it slows at once and settles
    for (const b of bits) {
      b.t += dt;
      if (b.t > 0) { b.vx *= 1 - 3.2 * dt; b.vy = b.vy * (1 - 3.2 * dt) + 60 * dt; b.x += b.vx * dt; b.y += b.vy * dt; }
    }
    bits = bits.filter(b => b.t < b.life);
    for (const w of wake) { w.t += dt; w.y -= 14 * dt; }
    wake = wake.filter(w => w.t < w.life);
    for (const n of notes) n.t += dt;
    notes = notes.filter(n => n.t < (n.big ? 1.6 : 0.9));
    for (const c of confetti) { c.t += dt; if (c.t > 0) { c.vy += 140 * dt; c.x += c.vx * dt; c.y += c.vy * dt; } }
    confetti = confetti.filter(c => c.t < c.life);
    // the fizz in the vat, rising to the press
    if (!reduce) {
      for (const st of STREAMS) {
        st.t -= dt;
        if (st.t <= 0) { st.t = rnd(0.14, 0.34); fizz.push({ x: st.x + rnd(-1, 1), y: VBOT - 2, s: rnd(16, 24), ph: rnd(0, 6), r: 1, y0: VBOT - 2 }); }
      }
      if (Math.random() < dt * 5) fizz.push({ x: rnd(VX0 + 4, VX1 - 4), y: VBOT - 2, s: rnd(12, 20), ph: rnd(0, 6), r: 1, y0: VBOT - 2 });
    }
    for (const f of fizz) { f.s = Math.min(70, f.s + 22 * dt); f.y -= f.s * dt; if (f.y0 - f.y > 140) f.r = 2; }
    fizz = fizz.filter(f => f.y > topDraw + 3);
    if (state === "clear") {
      clearT += dt;
      if (clearT > 2.2) { shift++; state = "play"; startShift(); }
    } else if (state === "writing") {
      overT += dt;
      if (overT > 1.9) end();
    }
    // the inspector watches the line
    if (state === "play" && !kf.act) {
      const gap = LINE - lowest();
      kf.watch = gap < ROWH ? 2 : gap < ROWH * 2.2 ? 1 : 0;
    }
  }

  /* ---------- the syrup ---------- */
  // dark cola, warm where it meets the press and darker toward the bottom and the walls; quantised to the PS1's
  // steps with an ordered dither, so it reads as liquid without going smooth and modern
  const SYRUP_H = VBOT - TOP0 + 2;
  const syrup = (() => {
    const w = VX1 - VX0, [c, x] = off(w, SYRUP_H), img = x.createImageData(w, SYRUP_H), d = img.data;
    const top = [86, 42, 16], mid = [44, 20, 9], bot = [17, 8, 5];
    const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
    for (let j = 0; j < SYRUP_H; j++) {
      const u = j / (SYRUP_H - 1), A = u < 0.35 ? top : mid, B = u < 0.35 ? mid : bot, t = u < 0.35 ? u / 0.35 : (u - 0.35) / 0.65;
      for (let i = 0; i < w; i++) {
        const side = Math.pow(Math.abs(i - w / 2) / (w / 2), 3) * 0.35, th = (BAYER[(j & 3) * 4 + (i & 3)] + 0.5) / 16, k = (j * w + i) * 4;
        for (let ch = 0; ch < 3; ch++) d[k + ch] = Math.min(255, Math.floor(((A[ch] + (B[ch] - A[ch]) * t) * (1 - side)) / 5 + th) * 5);
        d[k + 3] = 255;
      }
    }
    x.putImageData(img, 0, 0);
    return c;
  })();
  // the lamp's light through the liquid: a tile of bright webbing that repeats, drawn twice drifting apart
  const caustic = (() => {
    const n = 64, [c, x] = off(n, n), img = x.createImageData(n, n), d = img.data;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2, b = j / n * Math.PI * 2;
      const v = Math.sin(a * 2 + Math.sin(b * 3) * 1.4) + Math.sin(b * 2 + Math.sin(a * 3 + 1) * 1.6) + 0.6 * Math.sin(a + b + 0.5);
      const line = Math.max(0, 1 - Math.abs(v) * 2.4), k = (j * n + i) * 4;
      d[k] = 255; d[k + 1] = 206; d[k + 2] = 140; d[k + 3] = line > 0.45 ? 255 : line > 0.2 ? 110 : 0;
    }
    x.putImageData(img, 0, 0);
    return c;
  })();
  const [lightC, lightX] = off(VX1 - VX0, 160);
  let lightPat = null;
  function drawSyrup(pt) {
    const w = VX1 - VX0, h = Math.max(0, VBOT - pt);
    g.drawImage(syrup, 0, 0, w, h, VX0, pt, w, h);
    if (!h) return;
    // light moving through the top of it, fading with depth
    const lh = Math.min(160, h);
    if (!lightPat) lightPat = lightX.createPattern(caustic, "repeat");
    lightX.globalCompositeOperation = "copy";
    lightPat.setTransform(new DOMMatrix().translate(clock * 7 % 96, clock * 3 % 96).scale(1.5));
    lightX.fillStyle = lightPat; lightX.fillRect(0, 0, w, lh);
    lightX.globalCompositeOperation = "lighter";
    lightPat.setTransform(new DOMMatrix().translate(-(clock * 5) % 96, clock * 4.5 % 96).scale(1.8));
    lightX.fillStyle = lightPat; lightX.fillRect(0, 0, w, lh);
    lightX.globalCompositeOperation = "destination-in";
    const gr = lightX.createLinearGradient(0, 0, 0, lh);
    gr.addColorStop(0, "rgba(0,0,0,1)"); gr.addColorStop(0.35, "rgba(0,0,0,.45)"); gr.addColorStop(1, "rgba(0,0,0,0)");
    lightX.fillStyle = gr; lightX.fillRect(0, 0, w, lh);
    lightX.globalCompositeOperation = "source-over";
    g.globalCompositeOperation = "lighter";
    g.globalAlpha = 0.12;
    g.drawImage(lightC, 0, 0, w, lh, VX0, pt, w, lh);
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
  }

  /* ---------- drawing ---------- */
  function blit(key, x, y, alpha) {
    const s = SC.sprites[key];
    if (!s) return;
    if (alpha !== undefined) g.globalAlpha = alpha;
    g.drawImage(atlas, s[0], s[1], s[2], s[3], Math.round(x - s[4]), Math.round(y - s[5]), s[2], s[3]);
    g.globalAlpha = 1;
  }
  const bubble = (f, x, y, a) => blit("bubble_" + f, x, y, a);
  // a little pixel font, three by five, for the numbers that float up
  const FONT = {
    "0": ["XXX", "X.X", "X.X", "X.X", "XXX"], "1": [".X.", "XX.", ".X.", ".X.", "XXX"], "2": ["XXX", "..X", "XXX", "X..", "XXX"],
    "3": ["XXX", "..X", ".XX", "..X", "XXX"], "4": ["X.X", "X.X", "XXX", "..X", "..X"], "5": ["XXX", "X..", "XXX", "..X", "XXX"],
    "6": ["XXX", "X..", "XXX", "X.X", "XXX"], "7": ["XXX", "..X", ".X.", ".X.", ".X."], "8": ["XXX", "X.X", "XXX", "X.X", "XXX"],
    "9": ["XXX", "X.X", "XXX", "..X", "XXX"], "+": ["...", ".X.", "XXX", ".X.", "..."], ",": ["...", "...", "...", ".X.", "X.."],
  };
  function text(str, x, y, k, col, shadow) {
    const w = str.length * 4 * k - k;
    x = Math.round(x - w / 2);
    for (const [dx, dy, c] of shadow ? [[k, k, shadow], [0, 0, col]] : [[0, 0, col]]) {
      g.fillStyle = c;
      for (let i = 0; i < str.length; i++) {
        const rows = FONT[str[i]];
        if (!rows) continue;
        for (let r = 0; r < 5; r++) for (let q = 0; q < 3; q++) if (rows[r][q] === "X") g.fillRect(x + dx + (i * 4 + q) * k, y + dy + r * k, k, k);
      }
    }
  }
  // where a shot would go, with a bounce or two off the sides
  function guide(len) {
    let x = PIV.x + Math.sin(aim) * TIP, y = PIV.y - Math.cos(aim) * TIP, vx = Math.sin(aim), vy = -Math.cos(aim), gone = 0;
    const col = TINT[cur] || "#fff";
    g.fillStyle = col;
    for (let s = 0; s < len; s += 1) {
      x += vx; y += vy;
      if (x < VX0 + R) { x = VX0 + R; vx = -vx; }
      if (x > VX1 - R) { x = VX1 - R; vx = -vx; }
      if (y - R <= top) break;
      let hit = false;
      for (let r = 0; r < grid.length && !hit; r++) for (let c = 0; c < cols(r); c++) if (grid[r][c] && Math.hypot(cx(r, c) - x, cy(r) - y) < D - 4) { hit = true; break; }
      if (hit) break;
      if (s % 7 === 0) {
        gone = s / len;
        g.globalAlpha = 0.85 * (1 - gone);
        g.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 2);
      }
    }
    g.globalAlpha = 1;
  }

  function draw() {
    g.drawImage(bg, 0, 0);
    // the lamp's light over the vat, not quite steady
    const flick = 0.22 + 0.03 * Math.sin(clock * 9) + 0.02 * Math.sin(clock * 23.1) - (Math.floor(clock * 6) % 37 === 0 ? 0.08 : 0);
    g.globalCompositeOperation = "lighter";
    let gr = g.createRadialGradient(LAMP.x, LAMP.y, 2, LAMP.x, LAMP.y + 30, 110);
    gr.addColorStop(0, "rgba(255,214,150," + flick.toFixed(3) + ")"); gr.addColorStop(1, "rgba(255,214,150,0)");
    g.fillStyle = gr; g.fillRect(LAMP.x - 120, LAMP.y - 20, 240, 190);
    g.globalCompositeOperation = "source-over";

    // inside the vat: air above the press, and below it the syrup, the light moving through it and the fizz rising
    const jit = shake && !reduce ? (Math.floor(clock * 30) % 2 ? 1 : -1) : 0;
    const pt = Math.round(topDraw) + jit;
    g.save();
    g.beginPath(); g.rect(VX0, 70, VX1 - VX0, VBOT - 70); g.clip();
    g.fillStyle = "rgba(6,5,8,.5)"; g.fillRect(VX0, 70, VX1 - VX0, Math.max(0, pt - 12 - 70));
    drawSyrup(pt);
    for (const f of fizz) {
      g.fillStyle = f.r > 1 ? "rgba(255,226,180,.5)" : "rgba(255,226,180,.38)";
      g.fillRect(Math.round(f.x + Math.sin(clock * 3 + f.ph) * 1.2), Math.round(f.y), f.r, f.r);
    }
    for (const w of wake) {
      g.globalAlpha = 0.6 * (1 - w.t / w.life);
      g.fillStyle = "#fff4dc"; g.fillRect(Math.round(w.x), Math.round(w.y), 1, 1);
    }
    g.globalAlpha = 1;
    // what sank, dissolving into the syrup at the bottom
    for (const c of clouds) {
      const u = c.t / 0.9;
      g.globalAlpha = 0.32 * (1 - u);
      g.fillStyle = c.c;
      g.beginPath(); g.ellipse(c.x, c.y, 7 + 12 * u, 3 + 4 * u, 0, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 1;
    // the press's screw, and the press, shuddering when it is about to come down
    g.fillStyle = "#4b4c55"; g.fillRect(113, 70, 6, pt - 12 - 70 + 2);
    g.fillStyle = "#8b8d99";
    for (let y = 71 - (pt % 3); y < pt - 11; y += 3) g.fillRect(113, y, 6, 1);
    blit("plate", 116 + jit * 0.5, pt - 6);
    // the syrup's edge against the press: a thin line of light, moving a little
    g.fillStyle = "rgba(255,214,160,.32)";
    for (let x = VX0; x < VX1; x += 2) g.fillRect(x, pt + (Math.sin(x * 0.21 + clock * 2.2) > 0.6 ? 1 : 0), 2, 1);
    // the bubbles in the vat
    for (let r = 0; r < grid.length; r++) for (let c = 0; c < cols(r); c++) {
      const f = grid[r][c];
      if (!f) continue;
      const y = topDraw + R + r * ROWH + jit;
      if (state === "writing" || state === "over") {
        const grey = overT > (grid.length - r) * 0.08;
        bubble(f, cx(r, c), y, grey ? 0.35 : 1);
      } else bubble(f, cx(r, c), y);
    }
    // what popped: a ring of syrup going out and a puff of fizz
    for (const p of pops) {
      if (p.t < 0) { bubble(p.f, p.x, p.y + (topDraw - top)); continue; }
      const u = p.t / 0.3, y = p.y + (topDraw - top);
      g.globalAlpha = 1 - u;
      g.strokeStyle = TINT[p.f]; g.lineWidth = 2;
      g.beginPath(); g.arc(p.x, y, R * (0.6 + u * 0.9), 0, Math.PI * 2); g.stroke();
      g.fillStyle = "#fff6e0";
      for (let k = 0; k < 6; k++) {
        const a = k * 1.047 + p.x, d = 5 + u * 14;
        g.fillRect(Math.round(p.x + Math.cos(a) * d), Math.round(y + Math.sin(a) * d), 2, 2);
      }
      g.globalAlpha = 1;
    }
    for (const b of falls) bubble(b.f, b.x, b.y);
    for (const b of bits) { if (b.t < 0) continue; g.globalAlpha = Math.max(0, 1 - b.t / b.life); g.fillStyle = b.c; g.fillRect(Math.round(b.x), Math.round(b.y), 2, 2); }
    g.globalAlpha = 1;
    if (fly) bubble(fly.f, fly.x, fly.y);
    g.restore();

    // the line, painted on the glass: yellow and black, flashing red when the bubbles are on it
    const danger = state === "play" ? LINE - lowest() < ROWH : state === "writing";
    const red = danger && Math.floor(clock * 6) % 2;
    for (let x = VX0; x < VX1; x += 6) {
      g.fillStyle = red ? ((x / 6) % 2 ? "rgba(120,10,14,.9)" : "rgba(255,70,70,.95)") : (x / 6) % 2 ? "rgba(24,18,10,.85)" : "rgba(250,204,48,.9)";
      g.beginPath(); g.moveTo(x, LINE + 2); g.lineTo(x + 3, LINE - 2); g.lineTo(x + 6, LINE - 2); g.lineTo(x + 3, LINE + 2); g.closePath(); g.fill();
    }
    g.fillStyle = red ? "rgba(255,70,70,.95)" : "rgba(250,204,48,.9)";
    g.fillRect(VX0, LINE - 3, VX1 - VX0, 1); g.fillRect(VX0, LINE + 2, VX1 - VX0, 1);
    // the aim and the nozzle with the next shot in it
    if (state === "play" && !fly && cur) guide(guideOf(shift));
    const deg = clamp(Math.round(aim * 180 / Math.PI / 5) * 5, -75, 75);
    blit("noz_" + deg, PIV.x, PIV.y);
    if (cur && state !== "over") bubble(cur, PIV.x + Math.sin(aim) * TIP, PIV.y - Math.cos(aim) * TIP);
    // the glass: two streaks of the lamp on it
    g.globalAlpha = 0.07;
    g.fillStyle = "#ffffff";
    g.beginPath(); g.moveTo(30, 70); g.lineTo(54, 70); g.lineTo(18, 180); g.lineTo(12, 180); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(70, 70); g.lineTo(80, 70); g.lineTo(40, 200); g.lineTo(34, 200); g.closePath(); g.fill();
    g.globalAlpha = 1;

    // Stroops at the press's wheel, Whisko at the nozzle, the next flavour in its jar, Keyf on his ledge
    blit(st.pose, ST.x, ST.y);
    blit("wheel_" + st.wk, WHEEL.x, WHEEL.y);
    g.fillStyle = "rgba(0,0,0,.3)"; g.beginPath(); g.ellipse(WH.x, WH.y, 18, 4, 0, 0, Math.PI * 2); g.fill();
    blit(wh.pose, WH.x, WH.y + wh.dy);
    if (nxt && state !== "over") bubble(nxt, JAR.x, JAR.y);
    blit(kf.pose, KF.x, KF.y);
    // the stir gauge: how near the press is to coming down
    const u = state === "play" ? pressShots / pressOf(shift) : 0, na = (-130 + 260 * u) * Math.PI / 180;
    g.strokeStyle = shake ? "#d02828" : "#2a2420"; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(GAUGE.x, GAUGE.y); g.lineTo(GAUGE.x + Math.sin(na) * 9, GAUGE.y - Math.cos(na) * 9); g.stroke();
    g.fillStyle = "#2a2420"; g.fillRect(GAUGE.x - 1, GAUGE.y - 1, 2, 2);

    // numbers floating up, and the shift's confetti of flavours
    for (const n of notes) {
      const u = n.t / (n.big ? 1.6 : 0.9), k = n.big ? 2 : 1;
      g.globalAlpha = Math.min(1, 2 * (1 - u));
      text(n.s, n.x, Math.round(n.y - 18 * u), k, n.big ? "#fff0a8" : "#ffffff", "#1a1020");
      g.globalAlpha = 1;
    }
    for (const c of confetti) {
      if (c.t < 0) continue;
      g.globalAlpha = Math.max(0, Math.min(1, (c.life - c.t) / 0.4));
      g.fillStyle = TINT[c.f];
      g.fillRect(Math.round(c.x), Math.round(c.y), c.k + 1, c.k + 1);
    }
    g.globalAlpha = 1;
  }

  // what the three are drawn at: sampled 15 times a second
  function sample(dt) {
    acc += dt;
    if (acc < RESIDENT_STEP && !reduce) return;
    acc = reduce ? 0 : acc % RESIDENT_STEP;
    // Whisko turns with the nozzle; fires with a bow; hops at a big pop; cheers a shift out; sulks at the paperwork
    const d = aim * 180 / Math.PI;
    const turn = d < -45 ? "a-60" : d < -15 ? "a-30" : d <= 15 ? "a0" : d <= 45 ? "a30" : "a60";
    wh.dy = 0;
    if (wh.act === "fire" && wh.t < 0.16) wh.pose = "whisko_fire";
    else if (wh.act === "hop" && wh.t < 0.4) { wh.pose = "whisko_" + turn; wh.dy = -Math.round(9 * Math.sin(Math.PI * wh.t / 0.4)); }
    else if (wh.act === "cheer" && wh.t < 2) { wh.wig = (wh.wig + 1) % 6; wh.pose = wh.wig < 3 ? "whisko_cheer_l" : "whisko_cheer_r"; wh.dy = wh.wig % 3 === 1 ? -5 : 0; }
    else if (wh.act === "gloom") wh.pose = "whisko_gloom";
    else { wh.act = ""; wh.pose = "whisko_" + turn; }
    // Keyf: watches the line, writes down what he must
    if (kf.act === "write") kf.pose = Math.floor(kf.t * 7) % 2 ? "keyf_write_a" : "keyf_write_b";
    else if (kf.act === "note" && kf.t < 0.7) { kf.pose = Math.floor(kf.t * 7) % 2 ? "keyf_write_a" : "keyf_write_b"; if (Math.floor(kf.t * 7) !== kf.last) { kf.last = Math.floor(kf.t * 7); if (kf.last % 2) audio.scratch(1); } }
    else { kf.act = kf.act === "write" ? "write" : ""; kf.pose = kf.watch === 2 ? (Math.floor(clock * 4) % 2 ? "keyf_alarm" : "keyf_look") : kf.watch === 1 ? "keyf_look" : "keyf_idle"; }
    // Stroops turns the wheel and cannot stop; faster as the press comes due
    const rate = shake ? 10 : 4;
    st.k += rate * RESIDENT_STEP;
    if (st.act === "worry" && st.t < 0.7) st.pose = "stroops_worry";
    else { st.act = ""; st.pose = "stroops_c" + (Math.floor(st.k) % 4); }
    st.wk = Math.floor(st.k * 2) % 8;
    if (shake && Math.floor(st.k * 2) !== st.lastCreak) { st.lastCreak = Math.floor(st.k * 2); if (st.lastCreak % 2 === 0) audio.creak(); }
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

  /* ---------- input: aim at the pointer and let go to fire; the jar swaps; the keys ---------- */
  const screen = $("screen");
  const toCanvas = e => { const b = cv.getBoundingClientRect(); return [(e.clientX - b.left) * W / b.width, (e.clientY - b.top) * H / b.height]; };
  const aimAt = (px, py) => { aim = clamp(Math.atan2(px - PIV.x, PIV.y - Math.min(py, PIV.y - 12)), -AIM_MAX, AIM_MAX); };
  const onJar = (px, py) => Math.abs(px - JAR.x) < 18 && Math.abs(py - JAR.y) < 22;
  let held = null;
  screen.addEventListener("pointerdown", e => {
    if (e.target.closest("button, a")) return;
    if (state === "pause") { pause(false); return; }
    if (state !== "play") return;
    e.preventDefault();
    const [px, py] = toCanvas(e);
    if (onJar(px, py)) { swap(); return; }
    held = e.pointerId;
    try { screen.setPointerCapture(e.pointerId); } catch (err) { /* not capturable */ }
    aimAt(px, py);
  });
  screen.addEventListener("pointermove", e => {
    if (state !== "play") return;
    if (held === e.pointerId || e.pointerType === "mouse") { const [px, py] = toCanvas(e); if (!onJar(px, py) || held === e.pointerId) aimAt(px, py); }
  });
  const letGo = e => {
    if (held !== e.pointerId) return;
    held = null;
    if (state === "play") fire();
  };
  screen.addEventListener("pointerup", letGo);
  screen.addEventListener("pointercancel", e => { if (held === e.pointerId) held = null; });
  $("swap").addEventListener("pointerdown", e => { e.preventDefault(); if (state === "pause") pause(false); else swap(); });
  const keys = new Set();
  addEventListener("keydown", e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const el = e.target instanceof Element ? e.target : null;
    if (el && el !== document.body && el.closest("button") && (e.code === "Space" || e.code === "Enter")) return;
    if (e.code === "ArrowLeft" || e.code === "KeyA" || e.code === "ArrowRight" || e.code === "KeyD") {
      e.preventDefault();
      if (state === "pause") { pause(false); return; }
      keys.add(e.code);
      keyAim = (keys.has("ArrowRight") || keys.has("KeyD") ? 1 : 0) - (keys.has("ArrowLeft") || keys.has("KeyA") ? 1 : 0);
    } else if (e.code === "Space" || e.code === "Enter" || e.code === "ArrowUp" || e.code === "KeyW") {
      e.preventDefault();
      if (state === "ready" || (state === "over" && !$("over").hidden)) { start(); return; }
      if (state === "pause") { pause(false); return; }
      if (!e.repeat) fire();
    } else if (e.code === "ArrowDown" || e.code === "KeyS") {
      e.preventDefault();
      if (state === "pause") { pause(false); return; }
      if (!e.repeat) swap();
    } else if (e.code === "KeyP" || e.code === "Escape") {
      if (state === "play") pause(true); else if (state === "pause") pause(false);
    }
  });
  addEventListener("keyup", e => {
    keys.delete(e.code);
    keyAim = (keys.has("ArrowRight") || keys.has("KeyD") ? 1 : 0) - (keys.has("ArrowLeft") || keys.has("KeyA") ? 1 : 0);
  });
  addEventListener("blur", () => { keys.clear(); keyAim = 0; held = null; });

  let pausedFrom = "play";
  function pause(on) {
    if (on && (state === "play" || state === "clear")) {
      pausedFrom = state; state = "pause";
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
    const url = "https://rotville.world/games/fizz/", label = $("share").querySelector(".tape-label");
    const text = "Whisko scored " + fmt(score) + " in the FIZZCO vat on rotville.world" + (shift ? ", over " + (shift + 1) + " shifts" : "") + ". Cracked Keyf wrote it down.";
    if (navigator.share) {
      try { await navigator.share({ title: "Fizz", text, url }); return; } catch (err) { if (err && err.name === "AbortError") return; }
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

  Promise.all([fetch("assets/scene.json").then(r => r.json()), load("assets/sprites.png"), load("assets/bg.png")])
    .then(([s, a, b]) => {
      SC = s; atlas = a; bg = b;
      newVat(0);
      cur = nextFlavour(); nxt = nextFlavour();
      hud();
      ready = true;
    })
    .catch(() => { $("sub").textContent = "The tape would not load. Try the page again."; });
  requestAnimationFrame(frame);
})();
