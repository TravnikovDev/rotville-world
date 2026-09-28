/* Channel 3: a few seconds a channel, one order from the narrator each, and faster every four.

   Channel 3 is the only channel in Rotville. It keeps its number and changes its programme every few seconds, and
   every programme is somebody from town doing one thing:
     CATCH THAT CENT       Nickelpig runs along the pavement under a falling cent
     DO NOT MOVE           Big Barry's eye, close up, blinking to tempt you: any touch is a miss
     LIGHT THE DARK ROOMS  Fusegrin's house with a room or three gone dark: tap them and he lights them
     FIND THE KEY          Holloring in the dark drain: holler to see, then tap the key and nothing else
     EAT THE SQUARE        Megabite on a small board: steer him onto the square
     MOVE WHILE IT BLINKS  One Cent in five seconds: creep while Big Barry's eye is shut
   Three misses and the channel goes off the air. The score is how many programmes you got through.

   Every resident here is already on the site, drawn from the other games' own sprite sheets and read from their
   folders (../one-cent, ../lamp, ../drain, ../megabite), so nothing new is published and nothing is copied. They
   move at 15 fps under the 60 fps page, the way the clips hold residents (R819, R1070). */
(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  const W = 270, H = 480;
  const cv = $("c"), g = cv.getContext("2d");
  g.imageSmoothingEnabled = false;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const store = {
    get(k, d) { try { const v = localStorage.getItem("channel3." + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem("channel3." + k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
  };
  const load = src => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });
  const json = src => fetch(src).then(r => r.json());
  const off = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d"); x.imageSmoothingEnabled = false; return [c, x]; };
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[Math.floor(Math.random() * a.length)];

  const LIVES = 3;
  const RESIDENT_STEP = 1 / 15;
  const EVERY = 4;                               // programmes between each "Faster."
  const speed = lv => 1 / (1 + 0.16 * lv);       // how much of a programme's time is left at this pace

  /* ---------- sound: the bed, the orders, the rest made on the spot ---------- */
  const LINES = ["cent", "still", "room", "rooms", "key", "square", "blink", "faster", "end"];
  const audio = {
    ctx: null, on: store.get("sound", true), raw: {}, buf: {}, music: null,
    fetch() {
      for (const k of LINES) this.raw[k] = fetch("assets/line-" + k + ".mp3").then(r => (r.ok ? r.arrayBuffer() : null)).catch(() => null);
      this.raw.music = fetch("assets/wind-up.mp3").then(r => (r.ok ? r.arrayBuffer() : null)).catch(() => null);
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
      this.dly = c.createDelay(1); this.dly.delayTime.value = 0.21;
      const fb = c.createGain(); fb.gain.value = 0.42; const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 1300;
      this.dly.connect(lp).connect(fb).connect(this.dly); lp.connect(this.fxg);
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
        this.pace(level);
      });
    },
    // the tape runs a little faster at every pace, pitch and all
    pace(lv) { if (this.music) this.music.playbackRate.setTargetAtTime(1 + 0.05 * lv, this.ctx.currentTime, 0.2); },
    set(on) { this.on = on; store.set("sound", on); if (this.master) this.master.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.04); },
    line(k) {
      if (!this.ctx || !this.buf[k]) return Promise.resolve(0);
      return this.buf[k].then(b => {
        if (!b) return 0;
        const s = this.ctx.createBufferSource(); s.buffer = b; s.connect(this.vox); s.start();
        return b.duration;
      });
    },
    tone(f0, f1, dur, type = "square", vol = 0.12, when = 0, echo = false) {
      if (!this.ctx) return;
      const c = this.ctx, t = c.currentTime + when, o = c.createOscillator(), e = c.createGain();
      o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
      e.gain.setValueAtTime(0.0008, t); e.gain.exponentialRampToValueAtTime(vol, t + 0.012); e.gain.exponentialRampToValueAtTime(0.0008, t + dur);
      o.connect(e).connect(this.fxg); if (echo) e.connect(this.dly); o.start(t); o.stop(t + dur + 0.03);
    },
    noise(dur, vol, lo, hi, when = 0) {
      if (!this.ctx) return;
      const c = this.ctx, t = c.currentTime + when, s = c.createBufferSource(), a = c.createBiquadFilter(), b = c.createBiquadFilter(), e = c.createGain();
      s.buffer = this.noiseBuf; s.loop = true; a.type = "highpass"; a.frequency.value = lo; b.type = "lowpass"; b.frequency.value = hi;
      e.gain.setValueAtTime(vol, t); e.gain.exponentialRampToValueAtTime(0.0008, t + dur);
      s.connect(a).connect(b).connect(e).connect(this.fxg); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.03);
    },
    flip() { this.noise(0.32, 0.12, 400, 6000); },
    good() { this.tone(660, 660, 0.09, "square", 0.08); this.tone(990, 990, 0.14, "square", 0.08, 0.08); },
    bad() { this.tone(180, 120, 0.35, "sawtooth", 0.09); this.tone(185, 124, 0.35, "square", 0.06); },
    faster() { [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, f, 0.07, "square", 0.07, i * 0.05)); },
    clink() { this.tone(2637, 2630, 0.3, "sine", 0.12); this.tone(3951, 3940, 0.2, "sine", 0.05); },
    tink() { this.tone(1400, 900, 0.06, "square", 0.04); },
    lamp() { this.tone(262, 523, 0.2, "sine", 0.1); this.tone(392, 784, 0.25, "sine", 0.05, 0.05); },
    holler() { this.tone(250, 380, 0.15, "sine", 0.2, 0, true); this.tone(380, 290, 0.26, "sine", 0.18, 0.13, true); },
    gloop() { this.tone(720, 210, 0.14, "sine", 0.16); },
    step() { this.tone(900, 900, 0.025, "square", 0.04); },
    chomp() { this.tone(523, 1046, 0.08, "square", 0.1); this.tone(784, 1568, 0.1, "square", 0.08, 0.06); },
    bonk() { this.tone(130, 60, 0.2, "sine", 0.28); this.noise(0.08, 0.1, 80, 900); },
    creep() { this.noise(0.008, 0.05, 3000, 9000); },
    eye() { this.tone(95, 55, 0.3, "sine", 0.28); },
  };
  audio.fetch();

  /* ---------- the cast, borrowed from the other games ---------- */
  const A = {};                                  // images and scenes, filled in at load
  const blit = (img, s, x, y) => g.drawImage(img, s[0], s[1], s[2], s[3], Math.round(x), Math.round(y), s[2], s[3]);
  const clipPoly = (ctx, poly) => { ctx.beginPath(); poly.forEach((p, k) => (k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); ctx.clip(); };
  const inPoly = (x, y, p) => {
    let c = false;
    for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
      if ((p[i][1] > y) !== (p[j][1] > y) && x < (p[j][0] - p[i][0]) * (y - p[i][1]) / (p[j][1] - p[i][1]) + p[i][0]) c = !c;
    }
    return c;
  };
  // Nickelpig at a point of One Cent's road, in one of its three rocking poses
  function pig(i, pose, gx, gy) {
    const s = A.oc.sprites["pig_" + String(i).padStart(2, "0") + "_" + pose], an = A.oc.pig[i];
    g.fillStyle = "rgba(0,0,0,.35)";
    g.beginPath(); g.ellipse(gx, gy + 1, s[2] * 0.32, Math.max(1.5, s[2] * 0.07), 0, 0, Math.PI * 2); g.fill();
    blit(A.ocImg, s, gx + s[4] - an[0], gy + s[5] - an[1]);
    return s;
  }

  /* ---------- the programmes ---------- */
  let res = { pose: 1, acc: 0, tick: 0 };      // resident poses, sampled 15 times a second

  const CENT = {
    id: "cent", line: () => "cent", order: () => "Catch that cent.", button: null, dur: 4.2,
    setup(lv) {
      this.x = 135; this.tx = 135; this.dir = 0; this.moving = false;
      this.c = { x: rnd(50, 220), y: -10 };
      this.fall = this.dur * speed(lv) * 0.78;
      this.vy = (360 + 10) / this.fall;
    },
    update(dt) {
      if (this.dir) this.tx = Math.max(46, Math.min(224, this.tx + this.dir * 260 * dt));
      const d = this.tx - this.x, step = Math.sign(d) * Math.min(Math.abs(d), 240 * dt);
      this.x += step; this.moving = Math.abs(step) > 0.2;
      this.c.y += this.vy * dt;
      if (this.c.y >= 340 && this.c.y < 372 && Math.abs(this.c.x - this.x) < 28) { audio.clink(); return win(); }
      if (this.c.y >= 398) { audio.tink(); return lose(); }
    },
    draw() {
      g.drawImage(A.ocStreet, 0, 0);
      const cs = A.oc.sprites.cent;
      blit(A.ocImg, cs, this.c.x - cs[2] / 2, this.c.y - cs[3] / 2);
      pig(0, this.moving ? res.rock : 1, this.x, 399.5);
    },
    tap(x) { this.tx = Math.max(46, Math.min(224, x)); },
    drag(x) { this.tx = Math.max(46, Math.min(224, x)); },
    key(k, down) { if (k === "left" || k === "right") this.dir = down ? (k === "left" ? -1 : 1) : 0; },
    timeout() { lose(); },
  };

  const STILL = {
    id: "still", line: () => "still", order: () => "Do not move.", button: "DON'T", dur: 3.4,
    setup(lv) {
      // a blink or two to tempt you, more at a quicker pace
      const T = this.dur * speed(lv), n = 1 + Math.min(2, Math.floor(lv / 2));
      this.blinks = Array.from({ length: n }, (_, k) => T * (0.2 + 0.6 * (k + rnd(0.1, 0.9)) / n)).sort((a, b) => a - b);
      this.t = 0;
    },
    amount() {
      for (const b of this.blinks) { const u = this.t - b; if (u >= 0 && u < 0.5) return u < 0.12 ? u / 0.12 : u < 0.32 ? 1 : 1 - (u - 0.32) / 0.18; }
      return 0;
    },
    update(dt) { this.t += dt; },
    draw() {
      // the eye, three times over, cut from One Cent's street
      const e = A.oc.eye.centre, cx = Math.round(e[0]) - 45, cy = Math.max(0, Math.round(e[1]) - 48);
      g.fillStyle = "#06050c"; g.fillRect(0, 0, W, H);
      g.drawImage(A.ocStreet, cx, cy, 90, 100, 0, 90, 270, 300);
      const L = A.oc.sprites.lid, amt = this.amountNow;
      if (amt > 0) {
        const hh = Math.max(1, Math.round(L[3] * amt));
        g.drawImage(A.ocImg, L[0], L[1], L[2], hh, (L[4] - cx) * 3, 90 + (L[5] - cy) * 3, L[2] * 3, hh * 3);
      }
    },
    touch() { audio.eye(); lose("SEEN."); },
    timeout() { win(); },
  };

  const ROOMS = {
    id: "rooms", button: null, dur: 4.6,
    line() { return this.n === 1 ? "room" : "rooms"; },
    order() { return this.n === 1 ? "Light the dark room." : "Light the dark rooms."; },
    setup(lv) {
      this.n = 1 + (lv >= 2 ? 1 : 0) + (lv >= 4 ? 1 : 0);
      const ids = A.lp.rooms.map((r, i) => i).sort(() => Math.random() - 0.5);
      this.dark = new Set(ids.slice(0, this.n));
      this.lit = new Map();                       // room -> when he lit it
      this.t = 0;
    },
    update(dt) { this.t += dt; },
    draw() {
      g.drawImage(A.lpDark, 0, 0);
      A.lp.rooms.forEach((r, i) => {
        const a = this.dark.has(i) ? (this.lit.has(i) ? Math.min(1, (this.t - this.lit.get(i)) / 0.25) : 0) : 1;
        if (a <= 0) return;
        g.save(); clipPoly(g, r.poly); g.globalAlpha = a; g.drawImage(A.lpLit, 0, 0); g.restore();
      });
      // Fusegrin, stood in a corner of each room he has lit
      const C = A.lp.fg.centre, s = A.lp.sprites.fg_00;
      for (const i of this.lit.keys()) {
        const p = A.lp.rooms[i].poly, fy = Math.max(...p.map(q => q[1])), fx = Math.min(...p.map(q => q[0])) + 22;
        const cx = fx, cy = fy - A.lp.fg.radius_px - 1;
        blit(A.lpImg, s, cx + s[4] - C[0], cy + s[5] - C[1]);
        const st = A.lp.fg.frames[0].star;
        g.globalCompositeOperation = "lighter";
        const gr = g.createRadialGradient(cx + st[0] - C[0], cy + st[1] - C[1], 0, cx + st[0] - C[0], cy + st[1] - C[1], 8);
        gr.addColorStop(0, "rgba(255,190,90,.6)"); gr.addColorStop(1, "rgba(255,190,90,0)");
        g.fillStyle = gr; g.fillRect(cx - 20, cy - 30, 40, 40);
        g.globalCompositeOperation = "source-over";
      }
      g.drawImage(A.lpFront, 0, 0);
    },
    tap(x, y) {
      const i = A.lp.rooms.findIndex(r => inPoly(x, y, r.poly));
      if (i < 0) return;
      if (this.dark.has(i) && !this.lit.has(i)) {
        this.lit.set(i, this.t); audio.lamp();
        if (this.lit.size === this.dark.size) win();
      }
    },
    timeout() { lose(); },
  };

  const KEY = {
    id: "key", line: () => "key", order: () => "Find the key.", button: "HOLLER", dur: 5.2,
    setup(lv) {
      this.hx = 135; this.hy = 250; this.echoes = []; this.cool = 0; this.t = 0; this.took = null;
      const n = Math.min(7, 3 + lv), decoys = A.dr.items.filter(k => k !== "key");
      this.items = [];
      const free = (x, y) => (x - this.hx) ** 2 + (y - this.hy) ** 2 > 60 ** 2 && this.items.every(i => (i.x - x) ** 2 + (i.y - y) ** 2 > 38 ** 2);
      const place = k => { for (let t = 0; t < 200; t++) { const x = rnd(34, 236), y = rnd(86, 440); if (free(x, y)) { this.items.push({ k, x, y, f: Math.floor(rnd(0, 4)) }); return; } } };
      place("key");
      for (let j = 0; j < n; j++) place(pick(decoys));
      this.fade = Math.max(0.7, 1.4 - 0.12 * lv);
    },
    holler() {
      if (this.cool > 0 || this.took) return;
      this.cool = 0.5; this.echoes.push({ t: 0 }); audio.holler();
    },
    update(dt) {
      this.t += dt; this.cool = Math.max(0, this.cool - dt);
      for (const e of this.echoes) e.t += dt;
      this.echoes = this.echoes.filter(e => e.t < this.fade + 0.3);
      if (this.took) { this.took.u += dt / 0.25; if (this.took.u >= 1 && !this.done) { this.done = true; audio.gloop(); win(); } }
    },
    draw() {
      const [sc, sx] = A.keyScene, [mk, mx] = A.keyMask;
      sx.globalCompositeOperation = "source-over";
      sx.fillStyle = A.brick; sx.fillRect(0, 0, W, H);
      sx.fillStyle = "rgba(8,6,16,.45)"; sx.fillRect(0, 0, W, H);
      for (const it of this.items) {
        if (it === (this.took && this.took.it)) continue;
        const s = A.dr.sprites["item_" + it.k + "_" + ((it.f + res.tick) % 4)];
        if (s) sx.drawImage(A.drImg, s[0], s[1], s[2], s[3], Math.round(it.x - s[2] / 2), Math.round(it.y - s[3] / 2), s[2], s[3]);
      }
      mx.globalCompositeOperation = "source-over"; mx.clearRect(0, 0, W, H);
      const glow = mx.createRadialGradient(this.hx, this.hy, 6, this.hx, this.hy, 40);
      glow.addColorStop(0, "rgba(0,0,0,.95)"); glow.addColorStop(1, "rgba(0,0,0,0)");
      mx.fillStyle = glow; mx.fillRect(this.hx - 40, this.hy - 40, 80, 80);
      for (const e of this.echoes) {
        const r = Math.min(460 * e.t, 400), k = e.t < 0.25 ? 1 : Math.max(0, 1 - (e.t - 0.25) / this.fade);
        const eg = mx.createRadialGradient(this.hx, this.hy, 0, this.hx, this.hy, Math.max(1, r));
        eg.addColorStop(0, "rgba(0,0,0," + 0.95 * k + ")"); eg.addColorStop(0.75, "rgba(0,0,0," + 0.85 * k + ")"); eg.addColorStop(1, "rgba(0,0,0,0)");
        mx.fillStyle = eg; mx.beginPath(); mx.arc(this.hx, this.hy, r, 0, Math.PI * 2); mx.fill();
      }
      g.fillStyle = "#05040b"; g.fillRect(0, 0, W, H);
      g.globalAlpha = 0.06; g.drawImage(sc, 0, 0); g.globalAlpha = 1;
      sx.globalCompositeOperation = "destination-in"; sx.drawImage(mk, 0, 0); sx.globalCompositeOperation = "source-over";
      g.drawImage(sc, 0, 0);
      g.globalCompositeOperation = "lighter";
      for (const e of this.echoes) if (e.t < 0.9) {
        g.strokeStyle = "rgba(170,235,255," + 0.6 * (1 - e.t / 0.9) + ")"; g.lineWidth = 2;
        g.beginPath(); g.arc(this.hx, this.hy, Math.min(460 * e.t, 400), 0, Math.PI * 2); g.stroke();
      }
      const pg = g.createRadialGradient(this.hx, this.hy, 2, this.hx, this.hy, 30);
      pg.addColorStop(0, "rgba(255,120,170,.22)"); pg.addColorStop(1, "rgba(255,120,170,0)");
      g.fillStyle = pg; g.fillRect(this.hx - 30, this.hy - 30, 60, 60);
      g.globalCompositeOperation = "source-over";
      const h = A.dr.sprites["hol_+00"];
      blit(A.drImg, h, this.hx - h[4], this.hy - h[5]);
      if (this.took) {
        const it = this.took.it, u = Math.min(1, this.took.u), s = A.dr.sprites["item_key_0"];
        const x = it.x + (this.hx - it.x) * u, y = it.y + (this.hy + 8 - it.y) * u;
        blit(A.drImg, s, x - s[2] / 2, y - s[3] / 2);
      }
    },
    tap(x, y) {
      if (this.took) return;
      const it = this.items.find(i => (i.x - x) ** 2 + (i.y - y) ** 2 < 16 ** 2);
      if (!it) return this.holler();
      if (it.k === "key") { this.took = { it, u: 0 }; return; }
      audio.bonk(); lose();
    },
    act() { this.holler(); },
    press() { this.holler(); },
    timeout() { if (this.took) { audio.gloop(); win(); } else lose(); },
  };

  const SQUARE = {
    id: "square", line: () => "square", order: () => "Eat the square.", button: null, dur: 5.2,
    COLS: 9, ROWS: 9, CELL: 24, X0: 27, Y0: 132,
    setup(lv) {
      const { COLS, ROWS } = this;
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      this.dir = pick(dirs); this.next = this.dir;
      const hx = 3 + Math.floor(rnd(0, 3)), hy = 3 + Math.floor(rnd(0, 3));
      this.segs = [0, 1, 2, 3].map(k => ({ x: hx - this.dir[0] * k, y: hy - this.dir[1] * k }));
      this.looks = this.segs.map(() => "block" + Math.floor(rnd(0, 16)));
      do { this.food = { x: Math.floor(rnd(0, COLS)), y: Math.floor(rnd(0, ROWS)), k: pick(["tile", "key", "cube", "plug"]) }; }
      while (Math.abs(this.food.x - hx) + Math.abs(this.food.y - hy) < 4 || this.segs.some(s => s.x === this.food.x && s.y === this.food.y));
      this.every = Math.max(0.12, 0.2 * (0.6 + 0.4 * speed(lv)));
      this.acc = 0; this.dead = false;
    },
    turn(d) {
      if (d[0] === -this.dir[0] && d[1] === -this.dir[1]) return;
      this.next = d;
    },
    update(dt) {
      this.acc += dt;
      while (this.acc >= this.every && !this.dead) {
        this.acc -= this.every;
        this.dir = this.next;
        const h = this.segs[0], nx = h.x + this.dir[0], ny = h.y + this.dir[1];
        if (nx < 0 || ny < 0 || nx >= this.COLS || ny >= this.ROWS || this.segs.slice(0, -1).some(s => s.x === nx && s.y === ny)) {
          this.dead = true; audio.bonk(); return lose();
        }
        this.segs.unshift({ x: nx, y: ny }); this.segs.pop(); audio.step();
        if (nx === this.food.x && ny === this.food.y) { this.food = null; audio.chomp(); this.dead = true; return win(); }
      }
    },
    draw() {
      const { COLS, ROWS, CELL, X0, Y0 } = this;
      g.fillStyle = "#0b0918"; g.fillRect(0, 0, W, H);
      g.fillStyle = A.concrete; g.fillRect(X0, Y0, COLS * CELL, ROWS * CELL);
      g.fillStyle = "rgba(10,8,22,.55)"; g.fillRect(X0, Y0, COLS * CELL, ROWS * CELL);
      g.strokeStyle = "rgba(255,255,255,.05)"; g.lineWidth = 1;
      for (let i = 0; i <= COLS; i++) { g.beginPath(); g.moveTo(X0 + i * CELL + 0.5, Y0); g.lineTo(X0 + i * CELL + 0.5, Y0 + ROWS * CELL); g.stroke(); }
      for (let j = 0; j <= ROWS; j++) { g.beginPath(); g.moveTo(X0, Y0 + j * CELL + 0.5); g.lineTo(X0 + COLS * CELL, Y0 + j * CELL + 0.5); g.stroke(); }
      g.strokeStyle = "#3b3263"; g.lineWidth = 2; g.strokeRect(X0 - 1, Y0 - 1, COLS * CELL + 2, ROWS * CELL + 2);
      const at = c => [X0 + c.x * CELL + CELL / 2, Y0 + c.y * CELL + CELL / 2 + 4];
      const mb = (k, c) => { const s = A.mb.sprites[k], [x, y] = at(c); g.drawImage(A.mbImg, s[0], s[1], s[2], s[3], Math.round(x - s[4]), Math.round(y - s[5]), s[2], s[3]); };
      if (this.food) mb(this.food.k, this.food);
      for (let i = this.segs.length - 1; i >= 1; i--) mb(this.looks[i], this.segs[i]);
      const d = this.dir, name = d[0] > 0 ? "head_right" : d[0] < 0 ? "head_left" : d[1] > 0 ? "head_down" : "head_up";
      mb(name, this.segs[0]);
    },
    key(k, down) { if (!down) return; const m = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] }[k]; if (m) this.turn(m); },
    tap(x, y) {
      const h = this.segs[0], hx = this.X0 + h.x * this.CELL + this.CELL / 2, hy = this.Y0 + h.y * this.CELL + this.CELL / 2;
      const dx = x - hx, dy = y - hy;
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      this.turn(Math.abs(dx) > Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy)]);
    },
    swipe(dx, dy) { this.turn(Math.abs(dx) > Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy)]); },
    timeout() { lose(); },
  };

  const BLINK = {
    id: "blink", line: () => "blink", order: () => "Move while it blinks.", button: "HOLD", dur: 5.4,
    setup(lv) {
      const s = speed(lv), T = this.dur * s;
      // open, shut, open, shut, open: the two shut spells are where he can go
      const o1 = T * 0.14, sh = T * 0.3, o2 = T * 0.12;
      this.plan = [["open", o1], ["shut", sh], ["open", o2], ["shut", sh], ["open", 99]];
      this.goal = 0.42; this.v = this.goal / (2 * Math.max(0.3, sh - 0.28) * 0.85);
      this.t = 0; this.pt = 0; this.holding = false; this.lastStep = 0;
    },
    phase() {
      let t = this.t;
      for (const [k, d] of this.plan) { if (t < d) return [k, t, d]; t -= d; }
      return ["open", 0, 99];
    },
    lidAmt() {
      const [k, u, d] = this.phase();
      if (k === "shut") return u < 0.1 ? u / 0.1 : u > d - 0.18 ? Math.max(0, (d - u) / 0.18) : 1;
      return 0;
    },
    update(dt) {
      this.t += dt;
      const [k, u] = this.phase(), shut = this.lidAmt() > 0.95;
      if (this.holding) {
        if (k === "open" && u > 0.12) { audio.eye(); return lose("SEEN."); }
        if (shut) { this.pt = Math.min(this.goal, this.pt + this.v * dt); if (this.t - this.lastStep > 0.13) { this.lastStep = this.t; audio.creep(); } }
        if (this.pt >= this.goal) { audio.clink(); return win(); }
      }
    },
    draw() {
      g.drawImage(A.ocStreet, 0, 0);
      const L = A.oc.sprites.lid, amt = this.lidAmtNow;
      if (amt > 0) { const hh = Math.max(1, Math.round(L[3] * amt)); g.drawImage(A.ocImg, L[0], L[1], L[2], hh, L[4], L[5], L[2], hh); }
      // the cent a short way up the road, and Nickelpig creeping toward it
      const P = A.oc.pig, n = P.length - 1, at = t => { const f = t * n, i = Math.min(n - 1, Math.floor(f)), k = f - i; return [P[i][0] + (P[i + 1][0] - P[i][0]) * k, P[i][1] + (P[i + 1][1] - P[i][1]) * k, Math.round(f)]; };
      const cp = at(this.goal + 0.03), cs = A.oc.sprites.cent;
      blit(A.ocImg, cs, cp[0] - cs[2] / 2, cp[1] - cs[3] - 1);
      const pp = at(this.ptNow);
      pig(pp[2], this.movingNow ? res.rock : 1, pp[0], pp[1]);
    },
    hold(on) { this.holding = on; },
    timeout() { lose(); },
  };

  const SHOWS = [CENT, STILL, ROOMS, KEY, SQUARE, BLINK];

  /* ---------- the channel ---------- */
  let ready = false, state = "ready", now = null, level = 0, count = 0, lives = LIVES, t = 0, T = 0, phaseT = 0, lastShow = null;
  let best = store.get("best", 0), fasterAt = 0;

  function hud() {
    $("lives").textContent = "●".repeat(lives) + "○".repeat(LIVES - lives);
    $("lives").setAttribute("aria-label", "Tries left: " + lives + " of " + LIVES);
    $("count").textContent = count + " WATCHED";
    $("best").textContent = "Most watched " + best;
  }
  function button() {
    const b = $("hold"), label = state !== "over" && now && now.button;
    b.textContent = label || "—";
    b.setAttribute("aria-disabled", String(!label));
    b.setAttribute("aria-label", label ? label.toLowerCase() : "Nothing to press");
  }
  function say(k, text) {
    const sub = $("sub");
    sub.textContent = text || "";
    audio.line(k).then(d => setTimeout(() => { if (sub.textContent === (text || "")) sub.textContent = ""; }, Math.max(1500, d * 1000 + 200)));
  }

  function start() {
    audio.unlock();
    level = 0; count = 0; lives = LIVES; lastShow = null; fasterAt = 0;
    $("ready").hidden = true; $("over").hidden = true;
    hud(); audio.pace(0);
    next();
  }

  // static, then the order over the programme's first frame, then the programme itself
  function next() {
    let s;
    do { s = pick(SHOWS); } while (s === lastShow && SHOWS.length > 1);
    lastShow = s; now = s;
    now.setup(level);
    now.amountNow = 0; now.lidAmtNow = 0; now.ptNow = 0; now.movingNow = false;
    T = now.dur * speed(level); t = 0;
    state = "static"; phaseT = 0;
    $("static").classList.add("on"); $("verdict").textContent = ""; $("order").textContent = "";
    audio.flip(); button();
  }
  function win() {
    if (state !== "play") return;
    state = "result"; phaseT = 0; count += 1;
    if (count > best) { best = count; store.set("best", best); }
    const v = $("verdict"); v.textContent = "FINE."; v.className = "c3-verdict good";
    audio.good(); hud();
    const c = $("count"); c.classList.add("bump"); setTimeout(() => c.classList.remove("bump"), 200);
  }
  // "SEEN." when an eye caught you moving, "NO." for anything else
  function lose(text) {
    if (state !== "play") return;
    state = "result"; phaseT = 0; lives -= 1;
    const v = $("verdict"); v.textContent = text || "NO."; v.className = "c3-verdict bad";
    audio.bad(); hud();
  }
  function end() {
    state = "over"; button();
    $("over-title").textContent = "Off the air.";
    $("over-line").textContent = count === 0 ? "You watched none of them." : "You watched " + count + (count === 1 ? " programme." : " programmes.");
    $("over-stats").textContent = count > 0 && count === best ? "The most anyone has watched" : "Most watched " + best;
    $("static").classList.add("on");
    say("end", "That is the end of the broadcast.");
    setTimeout(() => { $("static").classList.remove("on"); if (state === "over") { $("over").hidden = false; $("again").focus({ preventScroll: true }); } }, 1500);
  }

  function update(dt) {
    phaseT += dt;
    if (state === "static" && phaseT > 0.38) {
      state = "order"; phaseT = 0; $("static").classList.remove("on");
      $("order").textContent = now.order();
      audio.line(now.line());
    } else if (state === "order" && phaseT > 1.05) {
      state = "play"; phaseT = 0; $("order").textContent = "";
    } else if (state === "play") {
      t += dt;
      now.update(dt);
      if (state === "play" && t >= T) now.timeout();
    } else if (state === "result" && phaseT > 0.75) {
      $("verdict").textContent = "";
      if (lives <= 0) return end();
      if (count > 0 && count % EVERY === 0 && count !== fasterAt) {
        fasterAt = count;
        level += 1; state = "faster"; phaseT = 0;
        $("order").textContent = "Faster."; audio.faster(); audio.line("faster"); audio.pace(level);
      } else next();
    } else if (state === "faster" && phaseT > 1.1) {
      $("order").textContent = ""; next();
    }
  }

  const BARS = ["#c9c3b4", "#c9bf3c", "#3cb7c4", "#3cad49", "#b43cae", "#b33c3c", "#3c4ab0"];
  function testCard() {
    BARS.forEach((c, i) => { g.fillStyle = c; g.fillRect(Math.round(i * W / 7), 0, Math.ceil(W / 7), Math.round(H * 0.68)); });
    ["#3c4ab0", "#12101c", "#b43cae", "#12101c", "#3cb7c4", "#12101c", "#c9c3b4"].forEach((c, i) => { g.fillStyle = c; g.fillRect(Math.round(i * W / 7), Math.round(H * 0.68), Math.ceil(W / 7), Math.round(H * 0.08)); });
    g.fillStyle = "#12101c"; g.fillRect(0, Math.round(H * 0.76), W, H);
    g.fillStyle = "rgba(6,5,12,.45)"; g.fillRect(0, 0, W, H);
  }
  function draw() {
    if (!now || state === "ready" || state === "over") { testCard(); return; }
    now.draw();
    // the time left, as a bar along the bottom of the set
    if (state === "play" || state === "order") {
      const left = state === "order" ? 1 : Math.max(0, 1 - t / T);
      g.fillStyle = "rgba(0,0,0,.55)"; g.fillRect(8, H - 12, W - 16, 5);
      g.fillStyle = left < 0.3 ? "#ff6b7d" : "#ffd46b"; g.fillRect(8, H - 12, Math.round((W - 16) * left), 5);
    }
  }

  // what the residents are drawn at: sampled 15 times a second
  function sample(dt) {
    res.acc += dt;
    if (res.acc < RESIDENT_STEP && !reduce) return;
    res.acc = reduce ? 0 : res.acc % RESIDENT_STEP;
    res.rock = res.rock === 0 ? 2 : 0;          // Nickelpig's rock, the quick one
    res.tick = (res.tick + (Math.random() < 0.15 ? 1 : 0)) % 4;
    if (!now) return;
    if (now === STILL) STILL.amountNow = STILL.amount();
    if (now === BLINK) { BLINK.lidAmtNow = BLINK.lidAmt(); BLINK.movingNow = Math.abs(BLINK.pt - BLINK.ptNow) > 1e-5; BLINK.ptNow = BLINK.pt; }
  }

  let last = performance.now();
  function frame(tm) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, (tm - last) / 1000);
    last = tm;
    if (!ready) return;
    if (state !== "pause" && state !== "ready" && state !== "over") update(dt);
    sample(dt);
    draw();
  }

  /* ---------- input ---------- */
  const screen = $("screen");
  let press = null;
  const toCanvas = e => { const b = cv.getBoundingClientRect(); return [(e.clientX - b.left) * W / b.width, (e.clientY - b.top) * H / b.height]; };
  screen.addEventListener("pointerdown", e => {
    if (e.target.closest("button, a")) return;
    if (state === "pause") { pause(false); return; }
    e.preventDefault();
    if (state !== "play" && state !== "order") return;
    const [x, y] = toCanvas(e);
    press = { id: e.pointerId, x, y, t: performance.now() };
    try { screen.setPointerCapture(e.pointerId); } catch (err) { /* not capturable */ }
    if (state !== "play") return;
    if (now.touch) return now.touch();
    if (now.hold) now.hold(true);
    if (now.tap) now.tap(x, y);
  });
  screen.addEventListener("pointermove", e => {
    if (!press || e.pointerId !== press.id || state !== "play") return;
    const [x, y] = toCanvas(e);
    if (now.drag) now.drag(x, y);
  });
  const up = e => {
    if (!press || e.pointerId !== press.id) return;
    const [x, y] = toCanvas(e), dx = x - press.x, dy = y - press.y;
    press = null;
    if (state !== "play") return;
    if (now.hold) now.hold(false);
    if (now.swipe && Math.hypot(dx, dy) > 18) now.swipe(dx, dy);
  };
  screen.addEventListener("pointerup", up);
  screen.addEventListener("pointercancel", up);
  const holdBtn = $("hold");
  holdBtn.addEventListener("pointerdown", e => {
    e.preventDefault();
    if (state === "pause") { pause(false); return; }
    if (state !== "play" || !now) return;
    holdBtn.classList.add("on");
    if (now.touch) return now.touch();
    if (now.hold) now.hold(true);
    if (now.press) now.press();
  });
  const btnUp = () => { holdBtn.classList.remove("on"); if (state === "play" && now && now.hold) now.hold(false); };
  holdBtn.addEventListener("pointerup", btnUp);
  holdBtn.addEventListener("pointercancel", btnUp);
  holdBtn.addEventListener("pointerleave", btnUp);
  const DIRS = { ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right", ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down" };
  addEventListener("keydown", e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const el = e.target instanceof Element ? e.target : null;
    if (el && el !== document.body && el.closest("button") && (e.code === "Space" || e.code === "Enter")) return;
    if (e.code === "KeyP" || e.code === "Escape") { if (state === "pause") pause(false); else pause(true); return; }
    if (state === "ready" || (state === "over" && !$("over").hidden)) {
      if (e.code === "Space" || e.code === "Enter") { e.preventDefault(); start(); }
      return;
    }
    if (state === "pause") { pause(false); return; }
    if (DIRS[e.code] || e.code === "Space") e.preventDefault();
    if (e.repeat) return;
    if (state !== "play") return;
    if (now.touch) return now.touch();
    if (DIRS[e.code] && now.key) now.key(DIRS[e.code], true);
    if (e.code === "Space") { if (now.hold) now.hold(true); if (now.act) now.act(); }
  });
  addEventListener("keyup", e => {
    if (state !== "play" || !now) return;
    if (DIRS[e.code] && now.key) now.key(DIRS[e.code], false);
    if (e.code === "Space" && now.hold) now.hold(false);
  });
  addEventListener("blur", () => { press = null; if (now && now.hold) now.hold(false); });

  let before = "play";
  function pause(on) {
    if (on && ["static", "order", "play", "result", "faster"].includes(state)) {
      before = state; state = "pause";
      $("sub").textContent = "PAUSE ▮▮";
      if (audio.ctx) audio.ctx.suspend();
    } else if (!on && state === "pause") {
      state = before; $("sub").textContent = ""; audio.unlock();
    }
  }
  document.addEventListener("visibilitychange", () => { if (document.hidden) pause(true); });

  $("play").addEventListener("click", start);
  $("again").addEventListener("click", start);
  $("share").addEventListener("click", async () => {
    const url = "https://rotville.world/games/channel-3/", label = $("share").querySelector(".tape-label");
    const text = "I watched " + count + (count === 1 ? " programme" : " programmes") + " of Channel 3 on rotville.world before it went off the air.";
    if (navigator.share) {
      try { await navigator.share({ title: "Channel 3", text, url }); return; } catch (err) { if (err && err.name === "AbortError") return; }
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
  hud(); button();

  Promise.all([
    json("../one-cent/assets/scene.json"), load("../one-cent/assets/sprites.png"), load("../one-cent/assets/street.png"),
    json("../lamp/assets/scene.json"), load("../lamp/assets/sprites.png"), load("../lamp/assets/lit.png"), load("../lamp/assets/dark.png"), load("../lamp/assets/front.png"),
    json("../drain/assets/scene.json"), load("../drain/assets/sprites.png"), load("../drain/assets/tiles.png"),
    json("../megabite/assets/sprites.json"), load("../megabite/assets/sprites.png"),
  ]).then(([oc, ocImg, ocStreet, lp, lpImg, lpLit, lpDark, lpFront, dr, drImg, drTiles, mb, mbImg]) => {
    Object.assign(A, { oc, ocImg, ocStreet, lp, lpImg, lpLit, lpDark, lpFront, dr, drImg, drTiles, mb, mbImg });
    A.keyScene = off(W, H); A.keyMask = off(W, H);
    const tile = (name, ctx) => { const [c, x] = off(32, 32); x.drawImage(drTiles, dr.tiles[name] * 32, 0, 32, 32, 0, 0, 32, 32); return ctx.createPattern(c, "repeat"); };
    A.brick = tile("brick-mossy", A.keyScene[1]); A.concrete = tile("concrete", g);
    ready = true;
  }).catch(() => { $("sub").textContent = "The tape would not load. Try the page again."; });
  requestAnimationFrame(frame);
})();
