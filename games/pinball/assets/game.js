/* Pinball: Mawrice in the Old Sewerworks.

   Mawrice (LORE 4.7) is a ball of reservoir waste 1.3 m across. He rolls, and "he eats what is in front of him, and only
   what is in front of him". Here he is the ball and the Old Sewerworks is the table. The crates, cans and bits of pipe
   left on it are what he eats, and only when he hits one head on; anything he meets at an angle he glances off. The
   library has no boot, so the cans stand in for the boots of the lore. The bumpers are Conelie, the cone of Rot Station
   that "squeaks when bumped" and is "always here to point you in the wrong direction": the cone turns toward him as he
   comes and knocks him off at an angle, the wrong way, and faces the way it sent him. Rolling over R, O and T at the top
   raises what he eats is worth and relights the kickbacks, which send him back up an outlane once each. He leaves by the
   canal between the flippers, and three times is a game. Eat everything on the table and somebody leaves more where he
   is going; the second time, he comes back up the hill once more.

   The first table is plain: three things to eat, in the flippers' line, a long ball save, both kickbacks lit and a wide
   idea of "head on". Every table eaten puts more on the next, spreads it wider, narrows "head on", shortens the save
   and lights fewer kickbacks for a new ball.

   He rolls: the whole model turned about the axis a ball rolling that way turns about, so his face comes round once a
   turn and the rest of the time he is a rock, as the lore describes his back. When he eats, his face comes round to it.
   His turning and the cones' are sampled 15 times a second like the clips' residents (R819); where he is on the table
   is not, so the flippers can reach him. Only pre-rendered sprites and the PS1 tiles ship. */
(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  const W = 270, H = 480;
  const cv = $("c"), g = cv.getContext("2d");
  g.imageSmoothingEnabled = false;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const store = {
    get(k, d) { try { const v = localStorage.getItem("pinball." + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem("pinball." + k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
  };
  const load = src => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });
  const off = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d"); x.imageSmoothingEnabled = false; return [c, x]; };
  const rnd = (a, b) => a + Math.random() * (b - a);
  const rint = n => Math.floor(Math.random() * n);
  const pick = a => a[rint(a.length)];
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const deg = Math.PI / 180;
  const fmt = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  const RESIDENT_STEP = 1 / 15;

  /* ---------- the table, in screen pixels ---------- */
  const R = 8.5;                                    // Mawrice, 1.3 m across, is 17 pixels here
  const GRAV = 500;                                 // the table slopes toward the player: this much downhill, down the screen
  const MAXV = 1150, STEP = 1 / 480;
  const LANE = { x: 251.25, face: 466, draw: 14 };  // the shooter lane: where he waits, the plunger's face, how far it draws
  const LAUNCH = [673, 36];                        // off the plunger: a tap drops him into T, a full pull into R
  const KICK = 360, SLING = 330;                    // what a bumper and a slingshot give him
  // HOW HARD IT IS, by tables eaten: more on the table and wider apart, "head on" narrower, the ball save shorter
  const count = L => Math.min(7, 3 + L);
  const headOn = L => Math.max(22, 38 - 3 * L) * deg;
  const saveTime = L => Math.max(5, 12 - 1.5 * L);

  const walls = [];
  function wall(ax, ay, bx, by, w = 2, e = 0.4, kind = "", i = 0) {
    const dx = bx - ax, dy = by - ay;
    walls.push({ ax, ay, bx, by, dx, dy, l2: dx * dx + dy * dy || 1, w, e, kind, i });
  }
  const line = (pts, w, e) => { for (let i = 1; i < pts.length; i++) wall(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], w, e); };
  const arc = (cx, cy, r, a0, a1, n) => Array.from({ length: n + 1 }, (_, i) => { const a = (a0 + (a1 - a0) * i / n) * deg; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; });
  // the edge: up the right side, round the top right where the lane turns him out onto the table, across the top, and a
  // hook at the top left that turns him back in rather than down the side
  const OUTLINE = [[262, 492], [262, 100], ...arc(198, 100, 64, 0, -90, 12).slice(1), ...arc(70, 98, 62, 270, 135, 18), [8, 172], [8, 492]];
  line(OUTLINE, 2, 0.4);
  wall(241, 492, 241, 113, 1.5, 0.4);               // the shooter lane's inner wall
  // the gate at the top of the lane: he goes up through it and never comes back down
  const GATE = { ax: 242.5, ay: 113, bx: 262, by: 98 };
  { const dx = GATE.bx - GATE.ax, dy = GATE.by - GATE.ay, l = Math.hypot(dx, dy); Object.assign(GATE, { dx, dy, l2: l * l, nx: dy / l, ny: -dx / l }); }
  // the dividers between the outlanes and the inlanes, and the rails that bring him down onto the flippers
  // (each rail lies flush onto its flipper's pivot, so nothing can rest in the join)
  wall(32.5, 300, 32.5, 372, 2); wall(32.5, 372, 75.6, 402.8, 2);
  wall(217, 300, 217, 372, 2); wall(217, 372, 173.4, 402.2, 2);
  // the slingshots: two plain sides and a kicker facing the middle
  const SLINGS = [{ a: [56, 314], b: [56, 356], c: [78, 374] }, { a: [192, 314], b: [192, 356], c: [170, 374] }];
  SLINGS.forEach((s, i) => { wall(...s.a, ...s.b, 2.5, 0.45); wall(...s.b, ...s.c, 2.5, 0.45); wall(...s.a, ...s.c, 2.5, 0.6, "sling", i); });
  // R, O and T at the top, and the posts between them
  const LANES = [96, 124, 152], LANE_Y = 75, LANE_POSTS = [82, 110, 138, 166];
  for (const x of LANE_POSTS) wall(x, 65, x, 85, 1.8, 0.12);    // dead posts: he drops into a lane, not off it
  const POSTS = [{ x: 32.5, y: 300, r: 3.5, e: 0.7 }, { x: 217, y: 300, r: 3.5, e: 0.7 }];
  // the flippers: a pivot, a length, a thick end and a thin one
  const FLIP = { len: 38, rp: 6, rt: 3.5, rest: 28 * deg, up: -28 * deg, wUp: 20, wDown: 13, e: 0.2 };
  const flips = [{ x: 76, y: 408, s: 1, a: FLIP.rest, w: 0, on: false }, { x: 172, y: 408, s: -1, a: FLIP.rest, w: 0, on: false }];
  const tipOf = f => [f.x + f.s * FLIP.len * Math.cos(f.a), f.y + FLIP.len * Math.sin(f.a)];
  // Conelie, three times: the bumpers stand on a patch of Rot Station's forecourt
  const CONES = [[98, 126], [150, 126], [124, 166]].map(([x, y], i) => ({ x, y, r: 11, face: 2, dy: 0, hop: 0, cool: 0, flash: 0, hold: 0, point: 2, ph: i * 2.1 }));
  // where the junk gets left: the first three in the flippers' line
  const SLOTS = [[124, 226], [66, 254], [182, 254], [96, 290], [152, 290], [44, 206], [204, 206]];
  const JUNK = {
    crate: { r: 10, what: "A CRATE", bits: ["#8a6a44", "#5e4630", "#b08c5c"] },
    can: { r: 8, what: "A CAN", bits: ["#c8723a", "#e0a870", "#7a4a2a"] },
    pipe: { r: 5, seg: [-7, -1.5, 7, 1.5], what: "SOME PIPE", bits: ["#9a9a9a", "#6a6a6a", "#c8c8c8"] },
  };
  const INLANES = [44, 205], OUTLANES = [20, 229.5], SWITCH_Y = 336, KICK_Y = 392;
  // which kickbacks are lit when a ball comes in: both on the first tables, then the left, then neither
  const kicksLit = L => (L < 2 ? [true, true] : L < 4 ? [true, false] : [false, false]);
  const CANAL = { x0: 86, x1: 162, y: 434 };

  /* ---------- sound: the bed, six lines, the rest made on the spot ---------- */
  const audio = {
    ctx: null, on: store.get("sound", true), raw: {}, buf: {}, music: null, rolling: null, thudT: 0,
    fetch() {
      for (const [k, f] of [["start", "assets/line-start.mp3"], ["glance", "assets/line-glance.mp3"], ["more", "assets/line-more.mp3"],
                            ["canal", "assets/line-canal.mp3"], ["hill", "assets/line-hill.mp3"], ["end", "assets/line-end.mp3"],
                            ["music", "assets/level-up.mp3"]]) {
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
      // the bed's power-up plays once, as the machine comes on; after that it loops from its second chunk
      this.buf.music.then(b => {
        if (!b || this.music) return;
        const s = c.createBufferSource(); s.buffer = b; s.loop = true;
        if (b.duration > 24) { s.loopStart = 12; s.loopEnd = b.duration; }
        s.connect(this.mus); s.start(); this.music = s;
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
    tone(f0, f1, dur, type = "square", vol = 0.12, when = 0, lp = 0) {
      if (!this.ctx) return;
      const c = this.ctx, t = c.currentTime + when, o = c.createOscillator(), e = c.createGain();
      o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
      e.gain.setValueAtTime(0.0008, t); e.gain.exponentialRampToValueAtTime(vol, t + 0.012); e.gain.exponentialRampToValueAtTime(0.0008, t + dur);
      let out = o.connect(e);
      if (lp) { const f = c.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = lp; out = out.connect(f); }
      out.connect(this.fxg); o.start(t); o.stop(t + dur + 0.03);
    },
    noise(dur, vol, lo, hi, when = 0) {
      if (!this.ctx) return;
      const c = this.ctx, t = c.currentTime + when, s = c.createBufferSource(), a = c.createBiquadFilter(), b = c.createBiquadFilter(), e = c.createGain();
      s.buffer = this.noiseBuf; s.loop = true; a.type = "highpass"; a.frequency.value = lo; b.type = "lowpass"; b.frequency.value = hi;
      e.gain.setValueAtTime(vol, t); e.gain.exponentialRampToValueAtTime(0.0008, t + dur);
      s.connect(a).connect(b).connect(e).connect(this.fxg); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.03);
    },
    // "you hear him first - a wet rattle and something heavy arriving": a rumble as loud as he is fast
    roll(v) {
      if (!this.ctx) return;
      const c = this.ctx;
      if (!this.rolling) {
        const s = c.createBufferSource(), b = c.createBiquadFilter(), e = c.createGain();
        s.buffer = this.noiseBuf; s.loop = true; b.type = "bandpass"; b.frequency.value = 300; b.Q.value = 0.8;
        e.gain.value = 0.0001; s.connect(b).connect(e).connect(this.fxg); s.start();
        this.rolling = { b, e };
      }
      const k = Math.min(1, v / 900);
      this.rolling.e.gain.setTargetAtTime(v > 25 ? 0.01 + 0.07 * k : 0.0001, c.currentTime, 0.05);
      this.rolling.b.frequency.setTargetAtTime(220 + 520 * k, c.currentTime, 0.05);
    },
    rattle(v) { this.noise(0.012, 0.02 + 0.05 * Math.min(1, v / 900), 1800, 7000); },
    thud(v) {
      if (!this.ctx || this.ctx.currentTime < this.thudT) return;
      this.thudT = this.ctx.currentTime + 0.06;
      this.tone(95, 55, 0.08, "sine", Math.min(0.16, v / 3000)); this.noise(0.04, Math.min(0.06, v / 9000), 150, 900);
    },
    flip() { this.noise(0.03, 0.07, 200, 1800); this.tone(150, 70, 0.07, "square", 0.045); },
    flipDown() { this.tone(110, 70, 0.05, "square", 0.02); },
    // Conelie squeaks when bumped
    squeak() {
      this.tone(120, 60, 0.08, "sine", 0.14);
      this.tone(880 + rnd(-60, 60), 1560, 0.07, "sine", 0.09); this.tone(1560, 1080, 0.09, "sine", 0.07, 0.06);
    },
    sling() { this.noise(0.05, 0.1, 800, 4000); this.tone(260, 170, 0.08, "square", 0.05); },
    // R, O and T sound the Pipe Choir: C, E and G, and all three a chord
    lane(i) { const f = [523, 659, 784][i]; this.tone(f, f, 0.3, "triangle", 0.08); this.tone(f * 2, f * 2, 0.3, "sine", 0.03); this.tone(1200, 1190, 0.03, "square", 0.03); },
    rot() { [523, 659, 784, 1046].forEach((f, i) => { this.tone(f, f, 0.7, "triangle", 0.07, i * 0.05); this.tone(f / 2, f / 2, 0.7, "sine", 0.04, i * 0.05); }); },
    chomp() {
      this.noise(0.16, 0.14, 150, 1600); this.noise(0.08, 0.1, 300, 2400, 0.09);
      this.tone(240, 80, 0.2, "square", 0.05); this.tone(170, 90, 0.2, "sine", 0.13, 0.14);
    },
    clunk() { this.tone(180, 120, 0.09, "square", 0.06); this.noise(0.05, 0.06, 400, 2500); },
    spring() { this.tone(110, 330, 0.22, "sine", 0.1); this.noise(0.08, 0.05, 1000, 5000); },
    kickback() { this.noise(0.06, 0.14, 300, 3000); this.tone(90, 260, 0.2, "square", 0.06, 0, 1400); this.tone(520, 780, 0.16, "triangle", 0.06, 0.05); },
    click() { this.tone(1500, 1400, 0.02, "square", 0.02); },
    // down the canal, and far below, the Lower Sewers, where the honking comes from
    splash() {
      this.noise(0.55, 0.13, 200, 1500); this.tone(300, 120, 0.3, "sine", 0.05);
      this.tone(98, 92, 0.55, "sawtooth", 0.05, 0.55, 520); this.tone(147, 139, 0.55, "sawtooth", 0.03, 0.55, 520);
    },
    saved() { this.tone(600, 1200, 0.14, "triangle", 0.08); this.tone(800, 1600, 0.16, "triangle", 0.07, 0.12); },
    buzz() { this.tone(82, 80, 0.9, "sawtooth", 0.07, 0, 900); },
    tick() { this.tone(1300, 1290, 0.03, "square", 0.03); },
    fanfare() {
      [523, 659, 784, 1046].forEach((f, i) => this.tone(f, f * 1.01, 0.14, "square", 0.05, 0.05 + i * 0.08, 2400));
      this.tone(1046, 1052, 0.45, "triangle", 0.1, 0.38); this.tone(1318, 1322, 0.45, "sine", 0.05, 0.38);
    },
  };
  audio.fetch();

  /* ---------- a little pixel font, three by five ---------- */
  const FONT = {};
  ((rows) => { for (const [ch, r] of Object.entries(rows)) FONT[ch] = r.split(" "); })({
    A: ".X. X.X XXX X.X X.X", B: "XX. X.X XX. X.X XX.", C: ".XX X.. X.. X.. .XX", D: "XX. X.X X.X X.X XX.", E: "XXX X.. XX. X.. XXX",
    F: "XXX X.. XX. X.. X..", G: ".XX X.. X.X X.X .XX", H: "X.X X.X XXX X.X X.X", I: "XXX .X. .X. .X. XXX", J: "..X ..X ..X X.X .X.",
    K: "X.X X.X XX. X.X X.X", L: "X.. X.. X.. X.. XXX", M: "X.X XXX XXX X.X X.X", N: "XX. X.X X.X X.X X.X", O: ".X. X.X X.X X.X .X.",
    P: "XX. X.X XX. X.. X..", Q: ".X. X.X X.X XX. .XX", R: "XX. X.X XX. X.X X.X", S: ".XX X.. .X. ..X XX.", T: "XXX .X. .X. .X. .X.",
    U: "X.X X.X X.X X.X XXX", V: "X.X X.X X.X X.X .X.", W: "X.X X.X XXX XXX X.X", X: "X.X X.X .X. X.X X.X", Y: "X.X X.X .X. .X. .X.",
    Z: "XXX ..X .X. X.. XXX", 0: "XXX X.X X.X X.X XXX", 1: ".X. XX. .X. .X. XXX", 2: "XX. ..X .X. X.. XXX", 3: "XX. ..X .X. ..X XX.",
    4: "X.X X.X XXX ..X ..X", 5: "XXX X.. XX. ..X XX.", 6: ".XX X.. XXX X.X XXX", 7: "XXX ..X .X. .X. .X.", 8: "XXX X.X XXX X.X XXX",
    9: "XXX X.X XXX ..X XX.", ".": "... ... ... ... .X.", ",": "... ... ... .X. X..", ":": "... .X. ... .X. ...", "!": ".X. .X. .X. ... .X.",
    "?": "XX. ..X .X. ... .X.", "+": "... .X. XXX .X. ...", "-": "... ... XXX ... ...", x: "... X.X .X. X.X ...", "'": ".X. .X. ... ... ...",
    "=": "... XXX ... XXX ...", "^": ".X. X.X ... ... ...", " ": "... ... ... ... ...",
  });
  const textW = (s, k = 1) => (s.length * 4 - 1) * k;
  function text(x2, str, x, y, k, col) {
    x2.fillStyle = col;
    for (let i = 0; i < str.length; i++) {
      const rows = FONT[str[i]];
      if (!rows) continue;
      for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) if (rows[r][c] === "X") x2.fillRect(x + (i * 4 + c) * k, y + r * k, k, k);
    }
  }

  /* ---------- the game ---------- */
  let SC, atlas, ready = false, table = null, apron = null, dmdGrid = null, pat = {};
  let state = "ready";                     // ready, play, drain, pause, over
  let clock = 0, acc = 0, stepAcc = 0, drainT = 0, refillT = 0, overT = 0, serveT = 0;
  const ball = { x: LANE.x, y: LANE.face - R, vx: 0, vy: 0, live: false, inLane: true, phi: 0, chomp: 0, dist: 0 };
  const mw = { h: 2, k: 0 };               // which of his frames is drawn: heading and step, sampled 15 times a second
  const plunger = { pull: 0, face: LANE.face, snap: 0, drawn: LANE.face };
  const holds = new Set();                 // what is holding the plunger back: keys and fingers
  let score = 0, best = store.get("best", 0), balls = 3, ballNo = 1, mult = 1, level = 0, extraGiven = false;
  let lit = [false, false, false], skill = 0, skillLive = false, rotFlash = 0, kicks = [true, true], kickFlash = [0, 0];
  let junk = [], eatenBall = 0, eaten = { crate: 0, can: 0, pipe: 0 }, bumps = 0, bulletin = false;
  let saveT = 0, saveUsed = false, tiltMeter = 0, tilted = false, shake = 0, stillT = 0;
  let bits = [], pops = [], ripples = [], slingFlash = [0, 0], slingCool = [0, 0], laneCool = [0, 0, 0];
  const said = {};
  const dmdQ = [];

  function hud() {
    const b = $("balls");
    b.textContent = "●".repeat(Math.max(0, balls));
    b.setAttribute("aria-label", "Balls left: " + Math.max(0, balls));
    $("best").textContent = "Best " + fmt(best);
  }
  // the dot display in the backbox: a line, a smaller one under it, for a while
  // what happens now replaces what is showing; the big moments wait their turn rather than cut each other off
  function show(big, small = "", dur = 1.5, prio = 1) {
    const m = { big, small, dur, t: 0, prio }, cur = dmdQ[0];
    if (!cur || prio > cur.prio || (prio === cur.prio && prio < 2)) dmdQ.splice(0, dmdQ.length, m);
    else if (prio < 2) dmdQ.splice(1, dmdQ.length, m);
    else { dmdQ.push(m); if (dmdQ.length > 3) dmdQ.splice(1, 1); }
  }
  // the narrator, one line at a time
  const sayQ = [];
  let saying = false;
  function say(k, line) {
    if (said[k]) return;
    said[k] = true;
    sayQ.push([k, line]);
    if (!saying) nextLine();
  }
  function nextLine() {
    const it = sayQ.shift();
    if (!it) { saying = false; return; }
    saying = true;
    const [k, line] = it, sub = $("sub");
    sub.textContent = line;
    audio.line(k).then(d => setTimeout(() => {
      if (sub.textContent === line) sub.textContent = "";
      setTimeout(nextLine, 250);
    }, Math.max(1800, d * 1000 + 300)));
  }

  // what gets left on the table: the first table in the flippers' line, then more, anywhere
  function newJunk() {
    const n = count(level);
    let slots = level === 0 ? [0, 1, 2] : level === 1 ? [0, 1, 2, pick([3, 4])] : [];
    if (level >= 2) {
      const all = [0, 1, 2, 3, 4, 5, 6];
      for (let i = all.length - 1; i > 0; i--) { const j = rint(i + 1); [all[i], all[j]] = [all[j], all[i]]; }
      slots = all.slice(0, n);
    }
    const kinds = ["crate", "can", "pipe"];
    for (let i = kinds.length - 1; i > 0; i--) { const j = rint(i + 1); [kinds[i], kinds[j]] = [kinds[j], kinds[i]]; }
    junk = slots.map((s, i) => ({ kind: kinds[i % 3], x: SLOTS[s][0], y: SLOTS[s][1], gone: false, dy: -60 - 25 * i, vy: 0 }));
  }

  // a ball into the shooter lane, waiting on the plunger, facing the lens
  function serve(fresh) {
    Object.assign(ball, { x: LANE.x, y: LANE.face - R, vx: 0, vy: 0, live: true, inLane: true, phi: 0, chomp: 0 });
    mw.h = 2; mw.k = 0;
    plunger.pull = 0; holds.clear();
    skill = rint(3); skillLive = true;
    if (fresh) { eatenBall = 0; mult = 1; saveT = 0; saveUsed = false; tilted = false; tiltMeter = 0; bumps = 0; bulletin = false; kicks = kicksLit(level); show("BALL " + ballNo, "", 1.6, 0); }
  }

  function start() {
    audio.unlock();
    score = 0; balls = 3; ballNo = 1; level = 0; extraGiven = false; serveT = 0; refillT = 0;
    eaten = { crate: 0, can: 0, pipe: 0 };
    lit = [false, false, false]; bits = []; pops = []; ripples = []; dmdQ.length = 0;
    newJunk();
    state = "play";
    serve(true);
    $("ready").hidden = true; $("over").hidden = true;
    $("static").classList.remove("on");
    say("start", "Mawrice eats what is in front of him.");
    hud();
  }

  function over() {
    state = "over"; overT = 0;
    if (score > best) { best = score; store.set("best", best); }
    const parts = [], n = eaten, total = n.crate + n.can + n.pipe;
    if (n.crate) parts.push(n.crate === 1 ? "a crate" : n.crate + " crates");
    if (n.can) parts.push(n.can === 1 ? "a can" : n.can + " cans");
    if (n.pipe) parts.push(n.pipe === 1 ? "a bit of pipe" : n.pipe + " bits of pipe");
    const list = parts.length > 1 ? parts.slice(0, -1).join(", ") + " and " + parts[parts.length - 1] : parts[0];
    $("over-line").textContent = total ? "He ate " + list + "." : "He ate nothing. He glanced off all of it.";
    $("over-stats").textContent = "Score " + fmt(score) + " · Best " + fmt(best);
    show("GAME OVER", fmt(score), 99, 3);
    say("end", "Conelie pointed the wrong way again.");
    hud();
  }

  /* ---------- what happens on the table ---------- */
  function lane(i) {
    if (skillLive && i === skill) { score += 2500; show("SKILL SHOT", "+2,500", 1.6, 2); audio.fanfare(); pops.push({ x: LANES[i], y: LANE_Y + 14, s: "+2500", t: 0, col: "#ffd66b" }); }
    skillLive = false;
    score += lit[i] ? 10 : 50;
    lit[i] = true;
    audio.lane(i);
    if (lit.every(Boolean)) {
      lit = [false, false, false]; rotFlash = 1; kicks = [true, true];
      if (mult < 5) { mult++; show("R O T", "WHAT HE EATS x" + mult); }
      else { score += 5000; show("R O T", "+5,000"); }
      audio.rot();
    }
  }
  function eat(j) {
    j.gone = true;
    const J = JUNK[j.kind], pts = 500 * (1 + level) * mult;
    score += pts; eatenBall++; eaten[j.kind]++;
    skillLive = false;
    audio.chomp();
    for (let k = 0; k < 16; k++) {
      const a = rnd(0, Math.PI * 2), v = rnd(40, 150);
      bits.push({ x: j.x, y: j.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, t: 0, life: rnd(0.4, 0.8), col: pick(J.bits) });
    }
    pops.push({ x: j.x, y: j.y - 10, s: "+" + pts, t: 0, col: "#ffb35c" });
    show("ATE " + J.what, "+" + fmt(pts), 1.2);
    // his face comes round to it
    ball.phi = 270 * deg; ball.chomp = 0.28;
    if (junk.every(q => q.gone)) tableEaten();
  }
  function tableEaten() {
    const pts = 5000 * (1 + level);
    score += pts; level++;
    show("ALL EATEN", "+" + fmt(pts), 1.8, 2);
    audio.fanfare();
    say("more", "Somebody left another crate where he is going.");
    if (level === 2 && !extraGiven) {
      extraGiven = true; balls++;
      show("EXTRA BALL", "BACK UP THE HILL", 2.2, 2);
      say("hill", "He came back up the hill. Nobody saw how.");
      hud();
    }
    refillT = 1.6;
  }
  function glance() {
    audio.clunk();
    say("glance", "Only what is in front of him.");
  }
  function nudge() {
    if (state !== "play" || !ball.live || ball.inLane || tilted) return;
    ball.vx += rnd(-60, 60); ball.vy -= 80;
    shake = reduce ? 0 : 0.16; tiltMeter += 1;
    audio.thud(900);
    if (tiltMeter >= 3) { tilted = true; show("TILT", "", 3, 2); audio.buzz(); }
    else if (tiltMeter >= 2) show("WARNING", "", 0.9);
  }
  function drained() {
    ball.live = false;
    const x = clamp(ball.x, CANAL.x0 + 8, CANAL.x1 - 8);
    for (let k = 0; k < 3; k++) ripples.push({ x, y: 458, t: -k * 0.12 });
    for (let k = 0; k < 10; k++) bits.push({ x, y: 452, vx: rnd(-50, 50), vy: rnd(-160, -60), t: 0, life: rnd(0.4, 0.7), col: pick(["#9ab8aa", "#cfe3d8", "#5d7a6c"]) });
    audio.splash();
    if (saveT > 0 && !tilted) {
      saveT = 0; saveUsed = true;
      show("BALL SAVED", "", 1.6, 2); audio.saved();
      serveT = 0.9;
      return;
    }
    saveT = 0;
    state = "drain"; drainT = 0;
    const bonus = tilted ? 0 : eatenBall * 300 * mult;
    score += bonus;
    show("BONUS", eatenBall + " EATEN x" + mult + " = " + fmt(bonus), 2.2, 2);
    say("canal", "He rolled into the canal.");
  }

  /* ---------- the physics: many small steps a frame ---------- */
  function bounceOff(nx, ny, e) {
    const vn = ball.vx * nx + ball.vy * ny;
    if (vn >= 0) return 0;
    const k = -vn > 40 ? e : 0;
    ball.vx -= (1 + k) * vn * nx; ball.vy -= (1 + k) * vn * ny;
    if (-vn > 40) { ball.vx *= 0.985; ball.vy *= 0.985; }
    return -vn;
  }
  function hitWall(s) {
    let t = ((ball.x - s.ax) * s.dx + (ball.y - s.ay) * s.dy) / s.l2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const qx = s.ax + s.dx * t, qy = s.ay + s.dy * t;
    let nx = ball.x - qx, ny = ball.y - qy;
    const d2 = nx * nx + ny * ny, rr = R + s.w;
    if (d2 >= rr * rr) return;
    const d = Math.sqrt(d2) || 1e-6;
    nx /= d; ny /= d;
    if (t > 0 && t < 1) {
      const l = Math.sqrt(s.l2), ux = s.dx / l, uy = s.dy / l;
      const was = (ball.px - s.ax) * uy - (ball.py - s.ay) * ux;
      if (was * ((ball.x - s.ax) * uy - (ball.y - s.ay) * ux) < 0) { const k = Math.sign(was); nx = uy * k; ny = -ux * k; }
    }
    ball.x = qx + nx * rr; ball.y = qy + ny * rr;
    const vn = ball.vx * nx + ball.vy * ny;
    if (vn >= 0) return;
    if (s.kind === "sling" && -vn > 25 && slingCool[s.i] <= 0 && !tilted) {
      const tx = ball.vx - vn * nx, ty = ball.vy - vn * ny;
      const kx = nx, ky = ny - 0.3, kl = Math.hypot(kx, ky);
      ball.vx = tx * 0.5 + kx / kl * SLING; ball.vy = ty * 0.5 + ky / kl * SLING;
      slingCool[s.i] = 0.12; slingFlash[s.i] = 0.14; score += 20; skillLive = false;
      audio.sling();
      return;
    }
    const hit = bounceOff(nx, ny, s.e);
    if (hit > 220) audio.thud(hit);
  }
  function hitPost(p) {
    const dx = ball.x - p.x, dy = ball.y - p.y, d2 = dx * dx + dy * dy, rr = R + p.r;
    if (d2 >= rr * rr) return;
    const d = Math.sqrt(d2) || 1e-6, nx = dx / d, ny = dy / d;
    ball.x = p.x + nx * rr; ball.y = p.y + ny * rr;
    const hit = bounceOff(nx, ny, p.e);
    if (hit > 220) audio.thud(hit);
  }
  function hitGate() {
    const t = clamp(((ball.x - GATE.ax) * GATE.dx + (ball.y - GATE.ay) * GATE.dy) / GATE.l2, 0, 1);
    const qx = GATE.ax + GATE.dx * t, qy = GATE.ay + GATE.dy * t;
    const side = (ball.x - qx) * GATE.nx + (ball.y - qy) * GATE.ny;
    if (side <= 0 || Math.hypot(ball.x - qx, ball.y - qy) >= R || ball.vx * GATE.nx + ball.vy * GATE.ny >= 0) return;
    ball.x += GATE.nx * (R - side); ball.y += GATE.ny * (R - side);
    bounceOff(GATE.nx, GATE.ny, 0.3);
  }
  function hitPlunger() {
    if (ball.vy < 0 || ball.x < 242 || ball.y + R < plunger.face - 2 || ball.y > plunger.face + 6) return;
    if (ball.y + R > plunger.face) {
      ball.y = plunger.face - R; ball.x = LANE.x; ball.vx = 0;
      if (ball.vy > 0) ball.vy = ball.vy > 80 ? -ball.vy * 0.25 : 0;
    }
  }
  function hitFlip(f) {
    const [tx, ty] = tipOf(f), dx = tx - f.x, dy = ty - f.y, l2 = dx * dx + dy * dy;
    let t = ((ball.x - f.x) * dx + (ball.y - f.y) * dy) / l2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const qx = f.x + dx * t, qy = f.y + dy * t, w = FLIP.rp + (FLIP.rt - FLIP.rp) * t;
    let nx = ball.x - qx, ny = ball.y - qy;
    const d2 = nx * nx + ny * ny, rr = R + w;
    if (d2 >= rr * rr) return;
    const d = Math.sqrt(d2) || 1e-6;
    nx /= d; ny /= d;
    if (t > 0 && t < 1) {
      const l = Math.sqrt(l2), ux = dx / l, uy = dy / l;
      const was = (ball.px - f.x) * uy - (ball.py - f.y) * ux;
      if (was * ((ball.x - f.x) * uy - (ball.y - f.y) * ux) < 0) { const k = Math.sign(was); nx = uy * k; ny = -ux * k; }
    }
    ball.x = qx + nx * rr; ball.y = qy + ny * rr;
    // where he touches it, the flipper is moving: it throws him
    const sx = f.s * f.w * -(qy - f.y), sy = f.s * f.w * (qx - f.x);
    const rvx = ball.vx - sx, rvy = ball.vy - sy, vn = rvx * nx + rvy * ny;
    if (vn >= 0) return;
    const e = -vn > 40 ? FLIP.e : 0;
    ball.vx = sx + rvx - (1 + e) * vn * nx; ball.vy = sy + rvy - (1 + e) * vn * ny;
    if (Math.abs(f.w) > 1) skillLive = false;
  }
  function hitCone(c) {
    const dx = ball.x - c.x, dy = ball.y - c.y, d2 = dx * dx + dy * dy, rr = R + c.r;
    if (d2 >= rr * rr) return;
    const d = Math.sqrt(d2) || 1e-6, nx = dx / d, ny = dy / d;
    ball.x = c.x + nx * rr; ball.y = c.y + ny * rr;
    if (c.cool > 0 || tilted) { bounceOff(nx, ny, 0.5); return; }
    // knocked off the wrong way: a quarter turn or so off the straight line, to one side or the other
    const turn = (Math.random() < 0.5 ? -1 : 1) * rnd(18, 40) * deg, cs = Math.cos(turn), sn = Math.sin(turn);
    const kx = nx * cs - ny * sn, ky = nx * sn + ny * cs, kick = KICK + 16 * Math.min(5, level);
    ball.vx = kx * kick; ball.vy = ky * kick;
    c.cool = 0.1; c.flash = 0.16; c.hop = 0.14; c.hold = 0.7;
    c.point = (((Math.round(Math.atan2(ky, kx) / (45 * deg))) % 8) + 8) % 8;
    score += 100; skillLive = false; bumps++;
    audio.squeak();
    if (bumps === 12 && !bulletin) { bulletin = true; show("CONELIE POINTED THE WRONG WAY AGAIN", "", 3.2, 2); }
  }
  function hitJunk(j) {
    if (j.gone || j.dy < 0) return;
    const J = JUNK[j.kind];
    let qx = j.x, qy = j.y;
    if (J.seg) {
      const [ax, ay, bx, by] = J.seg, dx = bx - ax, dy = by - ay;
      const t = clamp(((ball.x - j.x - ax) * dx + (ball.y - j.y - ay) * dy) / (dx * dx + dy * dy), 0, 1);
      qx = j.x + ax + dx * t; qy = j.y + ay + dy * t;
    }
    const dx = ball.x - qx, dy = ball.y - qy, d2 = dx * dx + dy * dy, rr = R + J.r;
    if (d2 >= rr * rr) return;
    const d = Math.sqrt(d2) || 1e-6, nx = dx / d, ny = dy / d;
    const sp = Math.hypot(ball.vx, ball.vy), into = -(ball.vx * nx + ball.vy * ny) / (sp || 1);
    // in front of him: he was rolling straight at it
    if (sp > 140 && into > Math.cos(headOn(level)) && !tilted) { eat(j); ball.vx *= 0.85; ball.vy *= 0.85; return; }
    ball.x = qx + nx * rr; ball.y = qy + ny * rr;
    if (bounceOff(nx, ny, 0.45) > 70) glance();
  }

  function physics(h) {
    for (const f of flips) {
      const want = f.on && !tilted ? FLIP.up : FLIP.rest, old = f.a;
      if (f.a > want) f.a = Math.max(want, f.a - FLIP.wUp * h);
      else if (f.a < want) f.a = Math.min(want, f.a + FLIP.wDown * h);
      f.w = (f.a - old) / h;
    }
    if (!ball.live) return;
    const px = ball.x, py = ball.y;
    ball.px = px; ball.py = py;
    ball.vy += GRAV * h;
    ball.x += ball.vx * h; ball.y += ball.vy * h;
    for (const s of walls) hitWall(s);
    for (const p of POSTS) hitPost(p);
    hitGate();
    hitPlunger();
    for (const f of flips) hitFlip(f);
    for (const c of CONES) hitCone(c);
    for (const j of junk) hitJunk(j);
    const sp = Math.hypot(ball.vx, ball.vy);
    if (sp > MAXV) { ball.vx *= MAXV / sp; ball.vy *= MAXV / sp; }
    // how far round he has rolled, and the rattle of it
    const moved = Math.hypot(ball.x - px, ball.y - py);
    if (ball.chomp <= 0) ball.phi += moved / 9;
    ball.dist += moved;
    if (ball.dist > 22) { ball.dist = 0; if (Math.random() < 0.45 && sp > 60) audio.rattle(sp); }
    // the switches
    if ((py - LANE_Y) * (ball.y - LANE_Y) <= 0 && py !== ball.y) {
      for (let i = 0; i < 3; i++) if (Math.abs(ball.x - LANES[i]) < 12 && laneCool[i] <= 0) { laneCool[i] = 0.4; lane(i); }
    }
    if (py < SWITCH_Y && ball.y >= SWITCH_Y) {
      if (INLANES.some(x => Math.abs(ball.x - x) < 11)) { score += 100; audio.tick(); }
      else OUTLANES.forEach((x, i) => { if (Math.abs(ball.x - x) < 11) { score += 250; if (!kicks[i] || tilted) { audio.tone(220, 110, 0.4, "triangle", 0.08); show("CANAL AHEAD", "", 1.2); } } });
    }
    // a lit kickback at the foot of an outlane sends him back up it, once
    if (py < KICK_Y && ball.y >= KICK_Y) OUTLANES.forEach((x, i) => {
      if (Math.abs(ball.x - x) > 11 || !kicks[i] || tilted) return;
      kicks[i] = false; kickFlash[i] = 0.3;
      ball.vy = -rnd(620, 680); ball.vx = i === 0 ? 70 : -70;
      audio.kickback(); show("KICKBACK", "NOT THE CANAL YET", 1.3);
    });
    // out of the lane and onto the table: the ball save starts
    if (ball.inLane && ball.y < 100) {
      ball.inLane = false;
      if (!saveUsed && saveT <= 0) saveT = saveTime(level);
    }
    if (ball.y > 494) drained();
  }

  /* ---------- a frame ---------- */
  function update(dt) {
    clock += dt;
    if (state === "play" || state === "drain") {
      stepAcc += dt;
      while (stepAcc >= STEP) { stepAcc -= STEP; physics(STEP); if (state !== "play" && state !== "drain") break; }
    }
    // the plunger draws back while held, and he goes back with it
    const resting = ball.live && ball.inLane && ball.y > plunger.face - R - 3;
    if (state === "play" && holds.size && resting) plunger.pull = Math.min(1, plunger.pull + dt * 1.25);
    plunger.snap = Math.max(0, plunger.snap - dt * 6);
    plunger.face = LANE.face + LANE.draw * plunger.pull;
    plunger.drawn = plunger.face - 10 * plunger.snap;
    audio.roll(ball.live ? Math.hypot(ball.vx, ball.vy) : 0);
    if (state === "play" && ball.live && !ball.inLane && saveT > 0) saveT = Math.max(0, saveT - dt);
    const cradled = flips.some(f => f.on && Math.hypot(ball.x - f.x, ball.y - f.y) < 60);
    if (state === "play" && ball.live && !ball.inLane && !cradled && Math.hypot(ball.vx, ball.vy) < 12) stillT += dt; else stillT = 0;
    if (stillT > 3) { stillT = 0; ball.vx += (Math.random() < 0.5 ? -1 : 1) * rnd(60, 110); ball.vy -= rnd(140, 200); shake = reduce ? 0 : 0.12; audio.thud(700); }
    tiltMeter = Math.max(0, tiltMeter - dt * 0.4);
    shake = Math.max(0, shake - dt);
    rotFlash = Math.max(0, rotFlash - dt);
    ball.chomp = Math.max(0, ball.chomp - dt);
    for (let i = 0; i < 2; i++) { slingFlash[i] = Math.max(0, slingFlash[i] - dt); slingCool[i] = Math.max(0, slingCool[i] - dt); kickFlash[i] = Math.max(0, kickFlash[i] - dt); }
    for (let i = 0; i < 3; i++) laneCool[i] = Math.max(0, laneCool[i] - dt);
    for (const c of CONES) { c.cool = Math.max(0, c.cool - dt); c.flash = Math.max(0, c.flash - dt); c.hop = Math.max(0, c.hop - dt); c.hold = Math.max(0, c.hold - dt); }
    // what somebody left falls into place
    for (const j of junk) {
      if (j.dy >= 0) continue;
      j.vy += 900 * dt; j.dy += j.vy * dt;
      if (j.dy >= 0) { j.dy = 0; j.vy = 0; audio.thud(400); }
    }
    if (refillT > 0) { refillT -= dt; if (refillT <= 0) newJunk(); }
    if (serveT > 0) { serveT -= dt; if (serveT <= 0 && state === "play" && !ball.live) serve(false); }
    for (const b of bits) { b.t += dt; b.vy += 420 * dt; b.x += b.vx * dt; b.y += b.vy * dt; }
    bits = bits.filter(b => b.t < b.life);
    for (const p of pops) p.t += dt;
    pops = pops.filter(p => p.t < 0.9);
    for (const q of ripples) q.t += dt;
    ripples = ripples.filter(q => q.t < 1.2);
    if (dmdQ.length) { dmdQ[0].t += dt; if (dmdQ[0].t > dmdQ[0].dur) dmdQ.shift(); }
    // between balls: the bonus, then the next one or the end
    if (state === "drain") {
      drainT += dt;
      if (drainT > 2.4) {
        balls--;
        if (balls > 0) { ballNo++; state = "play"; serve(true); }
        else over();
        hud();
      }
    }
    if (state === "over") {
      overT += dt;
      if (overT > 1.4 && $("over").hidden) { $("over").hidden = false; $("static").classList.add("on"); setTimeout(() => $("static").classList.remove("on"), 300); }
    }
  }

  // what the residents are drawn at: sampled 15 times a second
  function sample(dt) {
    acc += dt;
    if (acc < RESIDENT_STEP && !reduce) return;
    acc = reduce ? 0 : acc % RESIDENT_STEP;
    // Mawrice: which way he is rolling, and how far round
    const sp = Math.hypot(ball.vx, ball.vy);
    if (ball.chomp > 0) mw.k = 9;
    else {
      if (sp > 30) mw.h = (((Math.round(Math.atan2(ball.vy, ball.vx) / (45 * deg))) % 8) + 8) % 8;
      mw.k = ((Math.floor(ball.phi / (30 * deg)) % 12) + 12) % 12;
    }
    // the cones bob, turn toward him as he comes, face the way they sent him, and otherwise the lens
    for (const c of CONES) {
      c.dy = c.hop > 0 ? -3 : Math.round(Math.sin(clock * 2.2 + c.ph) * 0.8);
      let want = 2;
      if (c.hold > 0) want = c.point;
      else if (ball.live && Math.hypot(ball.x - c.x, ball.y - c.y) < 70) want = (((Math.round(Math.atan2(ball.y - c.y, ball.x - c.x) / (45 * deg))) % 8) + 8) % 8;
      if (c.face !== want) {
        const d = ((want - c.face + 12) % 8) - 4;
        c.face = (c.face + (d < 0 ? -1 : 1) + 8) % 8;
      }
    }
  }

  /* ---------- drawing ---------- */
  function blit(x2, name, x, y, alpha = 1) {
    const s = SC.sprites[name];
    if (!s) return;
    x2.globalAlpha = alpha;
    x2.drawImage(atlas, s[0], s[1], s[2], s[3], Math.round(x - s[4]), Math.round(y - s[5]), s[2], s[3]);
    x2.globalAlpha = 1;
  }
  const outlinePath = x2 => { x2.beginPath(); OUTLINE.forEach(([x, y], i) => (i ? x2.lineTo(x, y) : x2.moveTo(x, y))); x2.closePath(); };
  // a rail: an old sewer pipe, rust over iron, lit from the top left
  function rail(x2, pts, w = 5) {
    const path = () => { x2.beginPath(); pts.forEach(([x, y], i) => (i ? x2.lineTo(x, y) : x2.moveTo(x, y))); };
    x2.lineJoin = "round"; x2.lineCap = "round";
    path(); x2.strokeStyle = "#2a150d"; x2.lineWidth = w + 2; x2.stroke();
    path(); x2.strokeStyle = "#7c3f24"; x2.lineWidth = w; x2.stroke();
    x2.save(); x2.translate(-0.8, -0.8); path(); x2.strokeStyle = "#b8703f"; x2.lineWidth = Math.max(1, w - 3.5); x2.stroke(); x2.restore();
  }
  function arrow(x2, x, y, a, len, col) {
    x2.save(); x2.translate(x, y); x2.rotate(a); x2.fillStyle = col;
    x2.fillRect(-len / 2, -1.5, len - 5, 3);
    x2.beginPath(); x2.moveTo(len / 2, 0); x2.lineTo(len / 2 - 7, -5); x2.lineTo(len / 2 - 7, 5); x2.closePath(); x2.fill();
    x2.restore();
  }

  // the table, drawn once: the Old Sewerworks' brick, the forecourt the cones stand on, what is painted on the floor,
  // the rails, the posts and the slingshots
  function makeTable() {
    const [c, x] = off(W, H);
    // the cabinet round the table
    x.fillStyle = "#0b0810"; x.fillRect(0, 0, W, H);
    // the floor: the oldest masonry in town, in the dark
    x.save(); outlinePath(x); x.clip();
    x.fillStyle = pat.brick; x.fillRect(0, 0, W, H);
    x.fillStyle = "rgba(16,9,24,.64)"; x.fillRect(0, 0, W, H);
    let gr = x.createRadialGradient(124, 250, 60, 124, 250, 300);
    gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(1, "rgba(0,0,0,.45)");
    x.fillStyle = gr; x.fillRect(0, 0, W, H);
    // the shooter lane: a grate to roll up
    x.fillStyle = pat.grate; x.fillRect(241, 104, 21, H);
    x.fillStyle = "rgba(10,6,14,.55)"; x.fillRect(241, 104, 21, H);
    // UP THE HILL, one letter under another, and chevrons: how he gets back up is not known, and this is not it either
    "UP THE HILL".split("").forEach((ch, i) => text(x, ch, 250, 170 + i * 7, 1, "rgba(235,215,170,.42)"));
    for (let k = 0; k < 4; k++) { const y = 268 + k * 34; x.fillStyle = "rgba(235,215,170,.2)"; x.beginPath(); x.moveTo(245, y + 6); x.lineTo(251.5, y); x.lineTo(258, y + 6); x.lineTo(258, y + 9); x.lineTo(251.5, y + 3); x.lineTo(245, y + 9); x.closePath(); x.fill(); }
    // Rot Station's forecourt under the cones: cracked asphalt, a painted edge, and arrows pointing everywhere but on
    x.save();
    x.beginPath(); x.moveTo(78, 104); x.lineTo(170, 104); x.quadraticCurveTo(184, 104, 184, 118); x.lineTo(184, 174);
    x.quadraticCurveTo(184, 194, 164, 194); x.lineTo(84, 194); x.quadraticCurveTo(64, 194, 64, 174); x.lineTo(64, 118); x.quadraticCurveTo(64, 104, 78, 104); x.closePath();
    x.fillStyle = pat.asphalt; x.fill();
    x.fillStyle = "rgba(12,10,16,.42)"; x.fill();
    x.strokeStyle = "rgba(230,214,150,.38)"; x.lineWidth = 2; x.setLineDash([6, 4]); x.stroke(); x.setLineDash([]);
    x.restore();
    const paint = "rgba(236,230,214,.34)";
    arrow(x, 124, 112, 0, 18, paint);
    arrow(x, 76, 158, -110 * deg, 16, paint);
    arrow(x, 172, 154, 200 * deg, 16, paint);
    arrow(x, 146, 186, 60 * deg, 14, paint);
    arrow(x, 100, 186, 170 * deg, 14, paint);
    text(x, "WRONG WAY", 124 - textW("WRONG WAY") / 2, 199, 1, "rgba(236,230,214,.4)");
    // where things get left: a painted cross on the floor
    for (const [sx, sy] of SLOTS) { x.fillStyle = "rgba(236,230,214,.13)"; for (let k = -4; k <= 4; k++) { x.fillRect(sx + k, sy + k, 1, 1); x.fillRect(sx + k, sy - k, 1, 1); } }
    // the hoarding, the way it reads on Big Barry: it changes rarely
    x.fillStyle = "#15222e"; x.fillRect(172, 64, 56, 24);
    x.strokeStyle = "#51606e"; x.lineWidth = 1; x.strokeRect(172.5, 64.5, 55, 23);
    text(x, "NO THOUGHTS", 178, 69, 1, "#e6ddc3"); text(x, "TODAY", 190, 78, 1, "#e6ddc3");
    // round the hook: a painted loop arrow, the way he goes if he goes fast
    x.strokeStyle = "rgba(236,230,214,.2)"; x.lineWidth = 3;
    x.beginPath(); x.arc(70, 98, 44, 250 * deg, 150 * deg, true); x.stroke();
    arrow(x, 70 + 44 * Math.cos(150 * deg), 98 + 44 * Math.sin(150 * deg) + 2, 60 * deg, 10, "rgba(236,230,214,.2)");
    // the inlanes point down to the flippers; the outlanes to the canal
    for (const lx of INLANES) arrow(x, lx, 314, 90 * deg, 12, "rgba(236,230,214,.22)");
    for (const lx of OUTLANES) { arrow(x, lx, 314, 90 * deg, 12, "rgba(255,120,100,.28)"); }
    // under the multiplier lamps, a cover: DO NOT LIFT, as the Cathedral Drains ask of theirs
    x.save(); x.beginPath(); x.arc(124, 350, 14, 0, Math.PI * 2); x.clip();
    x.fillStyle = pat.iron; x.fillRect(108, 334, 32, 32);
    x.fillStyle = "rgba(10,8,14,.35)"; x.fillRect(108, 334, 32, 32);
    x.strokeStyle = "rgba(0,0,0,.5)"; x.lineWidth = 1;
    for (let k = -12; k <= 12; k += 4) { x.beginPath(); x.moveTo(110, 350 + k); x.lineTo(138, 350 + k); x.stroke(); }
    x.restore();
    x.strokeStyle = "#3a3440"; x.lineWidth = 2; x.beginPath(); x.arc(124, 350, 14, 0, Math.PI * 2); x.stroke();
    text(x, "DO NOT LIFT", 124 - textW("DO NOT LIFT") / 2, 369, 1, "rgba(236,230,214,.45)");
    // the canal between the flippers: standing water
    x.fillStyle = pat.water; x.fillRect(CANAL.x0, CANAL.y, CANAL.x1 - CANAL.x0, H - CANAL.y);
    x.fillStyle = "rgba(8,18,14,.4)"; x.fillRect(CANAL.x0, CANAL.y, CANAL.x1 - CANAL.x0, H - CANAL.y);
    gr = x.createLinearGradient(0, CANAL.y, 0, CANAL.y + 10);
    gr.addColorStop(0, "rgba(0,0,0,.7)"); gr.addColorStop(1, "rgba(0,0,0,0)");
    x.fillStyle = gr; x.fillRect(CANAL.x0, CANAL.y, CANAL.x1 - CANAL.x0, 10);
    text(x, "CANAL", 124 - textW("CANAL") / 2, 470, 1, "rgba(180,210,195,.35)");
    x.restore();
    // the slingshots: roadworks plates under old tyre rubber
    for (const s of SLINGS) {
      x.save();
      x.beginPath(); x.moveTo(...s.a); x.lineTo(...s.b); x.lineTo(...s.c); x.closePath(); x.clip();
      for (let k = -80; k < 80; k += 8) { x.fillStyle = (k / 8) & 1 ? "#1a1612" : "#b8902c"; x.beginPath(); x.moveTo(s.b[0] + k, 300); x.lineTo(s.b[0] + k + 4, 300); x.lineTo(s.b[0] + k + 104, 400); x.lineTo(s.b[0] + k + 100, 400); x.closePath(); x.fill(); }
      x.fillStyle = "rgba(10,6,12,.35)"; x.fillRect(0, 300, W, 100);
      x.restore();
      rail(x, [s.a, s.b, s.c], 4);
    }
    // the rails
    rail(x, OUTLINE, 5);
    rail(x, [[241, 492], [241, 113]], 4);
    rail(x, [[32.5, 300], [32.5, 372], [75.6, 402.8]], 4);
    rail(x, [[217, 300], [217, 372], [173.4, 402.2]], 4);
    // the gate: a flap of tin
    x.strokeStyle = "#8c8a86"; x.lineWidth = 2; x.beginPath(); x.moveTo(GATE.ax, GATE.ay); x.lineTo(GATE.bx, GATE.by); x.stroke();
    // flanges on the long runs, as sewer pipe has
    for (const [fx, fy, vert] of [[262, 180, 1], [262, 260, 1], [262, 340, 1], [262, 420, 1], [8, 220, 1], [8, 290, 1], [8, 360, 1], [241, 180, 1], [241, 260, 1], [241, 340, 1], [241, 420, 1], [134, 36, 0]]) {
      x.fillStyle = "#2a150d"; vert ? x.fillRect(fx - 4, fy - 2, 8, 5) : x.fillRect(fx - 2, fy - 4, 5, 8);
      x.fillStyle = "#9a5832"; vert ? x.fillRect(fx - 3, fy - 1, 6, 2) : x.fillRect(fx - 1, fy - 3, 2, 6);
    }
    // the posts between R, O and T: bolts
    for (const px of LANE_POSTS) {
      x.fillStyle = "#1c1a1e"; x.fillRect(px - 2, 63, 4, 24);
      x.fillStyle = "#8a8490"; x.fillRect(px - 1, 64, 2, 22);
      x.fillStyle = "#c9c3cc"; x.fillRect(px - 1, 64, 1, 22);
    }
    // rubber on top of the dividers
    for (const p of POSTS) {
      x.fillStyle = "#121012"; x.beginPath(); x.arc(p.x, p.y, p.r + 1, 0, Math.PI * 2); x.fill();
      x.fillStyle = "#3a3438"; x.beginPath(); x.arc(p.x - 0.5, p.y - 0.5, p.r - 1, 0, Math.PI * 2); x.fill();
    }
    return c;
  }
  // the apron, drawn over him as he goes under it: iron, rivets, and the two cards every table has
  function makeApron() {
    const [c, x] = off(W, H);
    x.save();
    x.beginPath(); x.moveTo(8, 438); x.lineTo(78, 438); x.lineTo(CANAL.x0, 446); x.lineTo(CANAL.x0, H); x.lineTo(8, H); x.closePath();
    x.moveTo(241, 438); x.lineTo(170, 438); x.lineTo(CANAL.x1, 446); x.lineTo(CANAL.x1, H); x.lineTo(241, H); x.closePath();
    x.rect(241, 472, 21, 8);
    x.clip();
    x.fillStyle = pat.iron; x.fillRect(0, 430, W, 50);
    x.fillStyle = "rgba(20,14,26,.45)"; x.fillRect(0, 430, W, 50);
    x.restore();
    x.strokeStyle = "#1a1418"; x.lineWidth = 2;
    x.beginPath(); x.moveTo(8, 438); x.lineTo(78, 438); x.lineTo(CANAL.x0, 446); x.lineTo(CANAL.x0, H); x.stroke();
    x.beginPath(); x.moveTo(241, 438); x.lineTo(170, 438); x.lineTo(CANAL.x1, 446); x.lineTo(CANAL.x1, H); x.stroke();
    for (const rx of [14, 74, 174, 234]) { x.fillStyle = "#2a2430"; x.fillRect(rx, 442, 3, 3); x.fillStyle = "#9a94a0"; x.fillRect(rx, 442, 1, 1); }
    // the cards: how to play, and what it costs
    const card = (x0, lines) => {
      x.fillStyle = "#e8dfc6"; x.fillRect(x0, 448, 66, 28);
      x.fillStyle = "rgba(90,60,40,.18)"; x.fillRect(x0, 448, 66, 2);
      lines.forEach((s, i) => text(x, s, x0 + 33 - Math.floor(textW(s) / 2), 451 + i * 8, 1, i ? "#3a2c24" : "#8a2e1c"));
    };
    card(14, ["OLD SEWERWORKS", "EAT HEAD ON", "ROT RAISES x"]);
    card(168, ["1 PLAY 1 CENT", "POPULATION ???", "3 BALLS"]);
    return c;
  }
  function makeDmdGrid() {
    const [c, x] = off(124, 26);
    x.fillStyle = "rgba(255,130,40,.07)";
    for (let j = 0; j < 26; j += 2) for (let i = 0; i < 124; i += 2) x.fillRect(i, j, 1, 1);
    return c;
  }

  const DMD = { x: 72, y: 5, w: 124, h: 26 };
  function drawDmd() {
    g.fillStyle = "#050307"; g.fillRect(DMD.x - 4, DMD.y - 3, DMD.w + 8, DMD.h + 6);
    g.strokeStyle = "#3a3040"; g.lineWidth = 1; g.strokeRect(DMD.x - 3.5, DMD.y - 2.5, DMD.w + 7, DMD.h + 5);
    g.fillStyle = "#120803"; g.fillRect(DMD.x, DMD.y, DMD.w, DMD.h);
    g.drawImage(dmdGrid, DMD.x, DMD.y);
    g.save(); g.beginPath(); g.rect(DMD.x, DMD.y, DMD.w, DMD.h); g.clip();
    const lit = "#ff9a2e", m = dmdQ[0];
    let big = "", small = "", bx = null;
    if (m) {
      big = m.big; small = m.small;
      const bw = textW(big, 2);
      if (bw > DMD.w - 4) bx = Math.round(DMD.x + DMD.w - (DMD.w + bw) * clamp(m.t / m.dur, 0, 1));
    } else if (state === "ready") {
      const cyc = Math.floor(clock / 2.6) % 4;
      [big, small] = [["OLD SEWERWORKS", "PINBALL"], ["BEST", fmt(best)], ["1 PLAY 1 CENT", "PRESS PLAY"], ["NO THOUGHTS", "TODAY"]][cyc];
    } else {
      big = fmt(score);
      small = "";
    }
    const bw = textW(big, 2);
    text(g, big, bx !== null ? bx : Math.round(DMD.x + (DMD.w - bw) / 2), DMD.y + 3, 2, lit);
    if (small) text(g, small, Math.round(DMD.x + (DMD.w - textW(small)) / 2), DMD.y + 18, 1, lit);
    else if (!m && state !== "ready") {
      text(g, "BALL " + ballNo, DMD.x + 3, DMD.y + 18, 1, lit);
      if (mult > 1) text(g, "x" + mult, DMD.x + DMD.w - 3 - textW("x" + mult), DMD.y + 18, 1, lit);
      if (saveT > 0 && (saveT > 2 || Math.floor(clock * 6) % 2)) text(g, "SAVE", Math.round(DMD.x + (DMD.w - textW("SAVE")) / 2), DMD.y + 18, 1, lit);
    }
    // the dots: every other row and column a little darker
    g.fillStyle = "rgba(18,8,3,.5)";
    for (let j = 1; j < DMD.h; j += 2) g.fillRect(DMD.x, DMD.y + j, DMD.w, 1);
    for (let i = 1; i < DMD.w; i += 2) g.fillRect(DMD.x + i, DMD.y, 1, DMD.h);
    g.restore();
  }

  // a lamp in the floor: dim when off, lit with a glow
  function lamp(x, y, r, on, col, dim) {
    g.fillStyle = on ? col : dim;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    if (on) {
      g.globalCompositeOperation = "lighter";
      const gr = g.createRadialGradient(x, y, 0, x, y, r * 2.6);
      gr.addColorStop(0, col.replace("rgb", "rgba").replace(")", ",.45)")); gr.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = gr; g.fillRect(x - r * 3, y - r * 3, r * 6, r * 6);
      g.globalCompositeOperation = "source-over";
    }
  }
  function drawInserts() {
    // R, O and T; the skill shot's lane blinks while he waits
    for (let i = 0; i < 3; i++) {
      const blink = skillLive && i === skill && Math.floor(clock * 5) % 2;
      const on = lit[i] || blink || (rotFlash > 0 && Math.floor(rotFlash * 10) % 2);
      g.fillStyle = on ? "#ffcf5a" : "#3a2a18"; g.fillRect(LANES[i] - 5, 88, 11, 9);
      if (on) { g.globalCompositeOperation = "lighter"; g.fillStyle = "rgba(255,190,80,.25)"; g.fillRect(LANES[i] - 8, 85, 17, 15); g.globalCompositeOperation = "source-over"; }
      text(g, "ROT"[i], LANES[i] - 1, 90, 1, on ? "#3a1a08" : "#8a6a3a");
    }
    // what he eats is worth: x2 to x5
    for (let k = 2; k <= 5; k++) {
      const x = 97 + (k - 2) * 18, y = 322;
      lamp(x, y, 5, mult >= k, "rgb(120,230,255)", "#123240");
      text(g, k + "x", x - 3, y - 2, 1, mult >= k ? "#062030" : "#3f6f80");
    }
    // the kickbacks: an arrow up each outlane while lit
    OUTLANES.forEach((x, i) => {
      const on = kicks[i] && !tilted, y = 364;
      g.fillStyle = on ? (kickFlash[i] > 0 ? "#ffffff" : "#9dff8a") : "#1c3a1c";
      g.beginPath(); g.moveTo(x, y - 7); g.lineTo(x + 5, y); g.lineTo(x + 2, y); g.lineTo(x + 2, y + 6); g.lineTo(x - 2, y + 6); g.lineTo(x - 2, y); g.lineTo(x - 5, y); g.closePath(); g.fill();
      if (on) { g.globalCompositeOperation = "lighter"; g.fillStyle = "rgba(140,255,120,.18)"; g.fillRect(x - 8, y - 10, 16, 20); g.globalCompositeOperation = "source-over"; }
    });
    // the ball save
    const sv = saveT > 0 && (saveT > 2 || Math.floor(clock * 8) % 2);
    lamp(124, 398, 5, sv, "rgb(255,120,190)", "#3a1428");
    text(g, "SAVE", 124 - textW("SAVE") / 2, 406, 1, sv ? "#ffc0e0" : "#6a3a52");
  }
  function drawFlipper(f) {
    const [tx, ty] = tipOf(f), a = Math.atan2(ty - f.y, tx - f.x), n = [-Math.sin(a), Math.cos(a)];
    const shape = (grow) => {
      const rp = FLIP.rp + grow, rt = FLIP.rt + grow;
      g.beginPath();
      g.moveTo(f.x + n[0] * rp, f.y + n[1] * rp); g.lineTo(tx + n[0] * rt, ty + n[1] * rt);
      g.arc(tx, ty, rt, a + Math.PI / 2, a - Math.PI / 2, true);
      g.lineTo(f.x - n[0] * rp, f.y - n[1] * rp);
      g.arc(f.x, f.y, rp, a - Math.PI / 2, a + Math.PI / 2, true);
      g.closePath();
    };
    shape(1); g.fillStyle = "#1c1216"; g.fill();
    shape(0); g.fillStyle = "#e0d4b8"; g.fill();
    shape(-2.2); g.fillStyle = "#f4ead2"; g.fill();
    g.fillStyle = "#5a4a40"; g.beginPath(); g.arc(f.x, f.y, 2, 0, Math.PI * 2); g.fill();
  }
  function drawCone(c) {
    // the bumper's lamp: a ring of light round the base when it fires
    if (c.flash > 0) {
      g.globalCompositeOperation = "lighter";
      const gr = g.createRadialGradient(c.x, c.y, 4, c.x, c.y, 22);
      gr.addColorStop(0, "rgba(255,150,60,.55)"); gr.addColorStop(1, "rgba(255,120,40,0)");
      g.fillStyle = gr; g.fillRect(c.x - 24, c.y - 24, 48, 48);
      g.globalCompositeOperation = "source-over";
    }
    blit(g, "cone_" + c.face, c.x, c.y + c.dy);
  }
  function shadow(x, y, rx, ry) { g.fillStyle = "rgba(0,0,0,.4)"; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill(); }

  function draw() {
    const sx = shake > 0 ? Math.round(rnd(-2, 2)) : 0, sy = shake > 0 ? Math.round(rnd(-1, 1)) : 0;
    g.save(); g.translate(sx, sy);
    g.drawImage(table, 0, 0);
    // the canal moves a little, and rings where he went in
    const wob = Math.sin(clock * 1.3);
    g.fillStyle = "rgba(160,200,185,.12)";
    for (let k = 0; k < 4; k++) g.fillRect(Math.round(CANAL.x0 + 10 + ((clock * 6 + k * 23) % 60)), 450 + k * 7 + Math.round(wob), 9, 1);
    for (const q of ripples) {
      if (q.t < 0) continue;
      const u = q.t / 1.2;
      g.strokeStyle = "rgba(200,230,215," + (0.7 * (1 - u)).toFixed(2) + ")"; g.lineWidth = 1;
      g.beginPath(); g.ellipse(q.x, q.y, 3 + 22 * u, (3 + 22 * u) * 0.4, 0, 0, Math.PI * 2); g.stroke();
    }
    drawInserts();
    // the slingshots light when they kick
    SLINGS.forEach((s, i) => {
      if (slingFlash[i] <= 0) return;
      g.globalCompositeOperation = "lighter"; g.fillStyle = "rgba(255,200,90,.35)";
      g.beginPath(); g.moveTo(...s.a); g.lineTo(...s.b); g.lineTo(...s.c); g.closePath(); g.fill();
      g.globalCompositeOperation = "source-over";
    });
    // the kicker rubber on each slingshot's long side
    for (const s of SLINGS) { g.strokeStyle = "#141014"; g.lineWidth = 4; g.lineCap = "round"; g.beginPath(); g.moveTo(...s.a); g.lineTo(...s.c); g.stroke(); g.strokeStyle = "#4a4248"; g.lineWidth = 1; g.beginPath(); g.moveTo(s.a[0] + 1, s.a[1]); g.lineTo(s.c[0] + 1, s.c[1] - 1); g.stroke(); }
    for (const f of flips) drawFlipper(f);
    // shadows, then everything standing on the table, the far side first
    for (const c of CONES) shadow(c.x + 2, c.y + 2, 12, 6);
    for (const j of junk) if (!j.gone && j.dy > -8) shadow(j.x + 2, j.y + 4, JUNK[j.kind].r + 1, 4);
    if (ball.live) shadow(ball.x + 3, ball.y + 5, 8, 4);
    const things = [];
    for (const c of CONES) things.push([c.y, () => drawCone(c)]);
    for (const j of junk) if (!j.gone) things.push([j.y, () => blit(g, j.kind, j.x, j.y + j.dy)]);
    if (ball.live) things.push([ball.y, () => blit(g, "ball_" + mw.h + "_" + mw.k, ball.x, ball.y)]);
    things.sort((a, b) => a[0] - b[0]).forEach(t => t[1]());
    // the plunger: a rod and a spring, drawn back as far as it is held
    const pf = Math.round(plunger.drawn);
    g.fillStyle = "#2a2226"; g.fillRect(LANE.x - 7, pf, 14, 3);
    g.fillStyle = "#b8b0a8"; g.fillRect(LANE.x - 6, pf, 12, 2);
    g.fillStyle = "#6a6266"; g.fillRect(LANE.x - 1, pf + 3, 2, H - pf);
    g.strokeStyle = "#8a8084"; g.lineWidth = 1;
    for (let y = pf + 5; y < H; y += 3) { g.beginPath(); g.moveTo(LANE.x - 5, y); g.lineTo(LANE.x + 5, y + 1.5); g.stroke(); }
    g.drawImage(apron, 0, 0);
    // bits of what he ate, water, and what things were worth
    for (const b of bits) { g.fillStyle = b.col; g.globalAlpha = clamp((b.life - b.t) / 0.25, 0, 1); g.fillRect(Math.round(b.x), Math.round(b.y), 2, 2); }
    g.globalAlpha = 1;
    for (const p of pops) {
      g.globalAlpha = clamp(1.4 - p.t * 1.6, 0, 1);
      text(g, p.s, Math.round(p.x - textW(p.s) / 2), Math.round(p.y - 16 * p.t), 1, p.col);
    }
    g.globalAlpha = 1;
    g.restore();
    drawDmd();
    if (tilted && Math.floor(clock * 3) % 2) { g.fillStyle = "rgba(255,60,60,.12)"; g.fillRect(0, 0, W, H); }
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

  /* ---------- input: the two sides of the screen, two buttons, or the keys ---------- */
  function flipper(i, on) {
    const f = flips[i];
    if (f.on === on) return;
    f.on = on;
    if (state !== "play" && state !== "drain") return;
    if (on && !tilted) {
      audio.flip();
      // a flipper moves the lit letters along, one lane that way
      lit = i === 0 ? [lit[1], lit[2], lit[0]] : [lit[2], lit[0], lit[1]];
      if (skillLive && ball.inLane) skill = (skill + (i === 0 ? 2 : 1)) % 3;
    } else if (!on) audio.flipDown();
  }
  // while he waits on the plunger, a press draws it back and letting go sends him up the lane
  const waiting = () => state === "play" && ball.live && ball.inLane && ball.y > plunger.face - R - 3;
  function hold(id, on) {
    if (on) { holds.add(id); return; }
    if (!holds.delete(id) || holds.size) return;
    if (waiting()) {
      const v = LAUNCH[0] + LAUNCH[1] * plunger.pull;
      ball.vy = -Math.sqrt(v * v + 2 * GRAV * (plunger.face - LANE.face));
      audio.spring(); plunger.snap = 1;
    }
    plunger.pull = 0;
  }
  // a finger or a button: the plunger while he waits, a flipper the rest of the time
  const press = (id, side) => { audio.unlock(); if (waiting()) { hold(id, true); return -1; } flipper(side, true); return side; };
  const pressing = new Map();
  const release = (id) => {
    if (!pressing.has(id)) return;
    const side = pressing.get(id);
    pressing.delete(id);
    if (side < 0) hold(id, false);
    else if (![...pressing.values()].includes(side)) flipper(side, false);
  };
  const screen = $("screen");
  const toCanvas = e => { const b = cv.getBoundingClientRect(); return [(e.clientX - b.left) * W / b.width, (e.clientY - b.top) * H / b.height]; };
  screen.addEventListener("pointerdown", e => {
    if (e.target.closest("button, a")) return;
    if (state === "pause") { pause(false); return; }
    if (state !== "play" && state !== "drain") return;
    e.preventDefault();
    try { screen.setPointerCapture(e.pointerId); } catch (err) { /* already gone */ }
    const id = "p" + e.pointerId;
    pressing.set(id, press(id, toCanvas(e)[0] < W / 2 ? 0 : 1));
  });
  screen.addEventListener("pointerup", e => release("p" + e.pointerId));
  screen.addEventListener("pointercancel", e => release("p" + e.pointerId));
  for (const [bid, side] of [["flip-l", 0], ["flip-r", 1]]) {
    const b = $(bid);
    b.addEventListener("pointerdown", e => {
      e.preventDefault();
      if (state === "pause") { pause(false); return; }
      if (state !== "play" && state !== "drain") return;
      try { b.setPointerCapture(e.pointerId); } catch (err) { /* already gone */ }
      const id = "b" + e.pointerId;
      b.classList.add("on");
      pressing.set(id, press(id, side));
    });
    const up = e => { b.classList.remove("on"); release("b" + e.pointerId); };
    b.addEventListener("pointerup", up); b.addEventListener("pointercancel", up);
    b.addEventListener("contextmenu", e => e.preventDefault());
  }
  const LEFT = ["ArrowLeft", "KeyZ", "KeyA", "ShiftLeft"], RIGHT = ["ArrowRight", "KeyM", "KeyL", "Slash", "ShiftRight"];
  const PLUNGE = ["Space", "ArrowDown", "KeyS", "Enter"], NUDGE = ["ArrowUp", "KeyW", "KeyN"];
  addEventListener("keydown", e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const el = e.target instanceof Element ? e.target : null;
    if (el && el !== document.body && el.closest("button") && (e.code === "Space" || e.code === "Enter")) return;
    if (e.code === "KeyP" || e.code === "Escape") { if (state === "play" || state === "drain") pause(true); else if (state === "pause") pause(false); return; }
    if (state === "ready" || (state === "over" && !$("over").hidden)) { if (e.code === "Space" || e.code === "Enter") { e.preventDefault(); start(); } return; }
    if (state === "pause") { if (LEFT.includes(e.code) || RIGHT.includes(e.code) || PLUNGE.includes(e.code)) { e.preventDefault(); pause(false); } return; }
    if (LEFT.includes(e.code)) { e.preventDefault(); flipper(0, true); }
    else if (RIGHT.includes(e.code)) { e.preventDefault(); flipper(1, true); }
    else if (PLUNGE.includes(e.code)) { e.preventDefault(); if (!e.repeat) hold("k" + e.code, true); }
    else if (NUDGE.includes(e.code)) { e.preventDefault(); if (!e.repeat) nudge(); }
  });
  addEventListener("keyup", e => {
    if (LEFT.includes(e.code) && !LEFT.some(k => k !== e.code && down.has(k))) flipper(0, false);
    else if (RIGHT.includes(e.code) && !RIGHT.some(k => k !== e.code && down.has(k))) flipper(1, false);
    else if (PLUNGE.includes(e.code)) hold("k" + e.code, false);
  });
  const down = new Set();
  addEventListener("keydown", e => down.add(e.code), true);
  addEventListener("keyup", e => down.delete(e.code), true);
  // letting go of everything at once, without sending him: the window lost the keys, or the game paused
  function letGo() {
    down.clear(); pressing.clear(); holds.clear(); plunger.pull = 0;
    flipper(0, false); flipper(1, false);
    for (const id of ["flip-l", "flip-r"]) $(id).classList.remove("on");
  }
  addEventListener("blur", letGo);

  function pause(on) {
    if (on && (state === "play" || state === "drain")) {
      letGo();
      pause.was = state; state = "pause";
      $("sub").textContent = "PAUSE ▮▮";
      if (audio.ctx) audio.ctx.suspend();
    } else if (!on && state === "pause") {
      state = pause.was || "play"; $("sub").textContent = ""; audio.unlock();
    }
  }
  document.addEventListener("visibilitychange", () => { if (document.hidden) pause(true); });

  $("play").addEventListener("click", start);
  $("again").addEventListener("click", start);
  $("share").addEventListener("click", async () => {
    const url = "https://rotville.world/games/pinball/", label = $("share").querySelector(".tape-label");
    const total = eaten.crate + eaten.can + eaten.pipe;
    const text2 = "Mawrice ate " + (total === 1 ? "one thing" : total + " things") + " in the Old Sewerworks and scored " + fmt(score) + " on rotville.world. Only what was in front of him.";
    if (navigator.share) {
      try { await navigator.share({ title: "Pinball", text: text2, url }); return; } catch (err) { if (err && err.name === "AbortError") return; }
    }
    try { await navigator.clipboard.writeText(text2 + " " + url); label.textContent = "Copied"; } catch (err) { label.textContent = "Could not copy"; }
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
      const tile = name => { const [x0, size] = s.tiles[name], [c, x2] = off(size, size); x2.drawImage(t, x0, 0, size, size, 0, 0, size, size); return g.createPattern(c, "repeat"); };
      pat = { brick: tile("brick"), asphalt: tile("asphalt-cracked"), water: tile("water-still"), iron: tile("iron"), grate: tile("grate") };
      table = makeTable(); apron = makeApron(); dmdGrid = makeDmdGrid();
      newJunk();
      for (const j of junk) j.dy = 0;
      ball.live = true;
      hud();
      ready = true;
    })
    .catch(() => { $("sub").textContent = "The tape would not load. Try the page again."; });
  requestAnimationFrame(frame);
})();
