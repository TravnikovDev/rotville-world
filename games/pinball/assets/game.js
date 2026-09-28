/* Pinball: Mawrice in the Old Sewerworks.

   Mawrice (LORE 4.7) is a ball of reservoir waste 1.3 m across. He rolls, and "he eats what is in front of him, and only
   what is in front of him". Here he is the ball and the Old Sewerworks is the table, and the town is on it, each
   resident doing there what the lore says they do:
   - the bumpers are Conelie, who knocks him off the wrong way, and a family of Feltoids;
   - Conelie also stands at the top of the culvert and points him out of the wrong end of it;
   - Holloring "takes in whatever gets dropped" and "lets one slide back out": a hole that keeps him a while, with him
     showing through;
   - Gil Lister's pipes are joined underneath, in at one and out of another; Gil pops out of them to say hello, and
     hitting him while he is out says it back;
   - the Dreamlayer Depths pull him round and down; Snoreacle mutters at the edge, and what the Depths give back is
     never translated;
   - Escargo hauls a crate across on a trailer; Hassock Cyril is not furniture, and Mawrice does not eat him; Handshoe
     will not let go for a moment; the Flitter drops the list when startled;
   - the junk bank guards the DO NOT LIFT cover, and Brother Wishmop stands by it: eat the bank and the cover is off;
   - the spinner is the town sign's counter, and the town still reads POPULATION ???;
   - Farol IV gives orders to no one beside the display, Misery Peter floats over the table and delivers no verdict,
     Old Parp honks up from the canal when he goes in, Sikat mops the apron, Nickelpig rocks after a cent, and Tata is
     there once in a while, watching.
   The library has no boot, so the cans stand in for the boots of the lore.

   Two ramps take him off the floor: the hill, which drops him into the left orbit, and the culvert, at whose top
   Conelie sends him down the wire to the right inlane or, the wrong way, back into the bumpers. The orbits go round
   the top. A shot made soon after the last is a combo; the lit shot is worth double.

   It starts plain: a long ball save, both kickbacks lit, a wide idea of "head on". Every time the cover is taken off,
   "head on" narrows, the save shortens and fewer kickbacks are lit for a new ball.

   He rolls: the whole model turned about the axis a ball rolling that way turns about, so his face comes round once a
   turn and the rest of the time he is a rock. The residents turn, tip and rise as rigid figurines. His turning and
   theirs are sampled 15 times a second like the clips' residents (R819); where he is on the table is not, so the
   flippers can reach him. Only pre-rendered sprites and the PS1 tiles ship. */
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
  const dir8 = (dx, dy) => (((Math.round(Math.atan2(dy, dx) / (45 * deg))) % 8) + 8) % 8;

  const RESIDENT_STEP = 1 / 15;

  /* ---------- the table, in screen pixels ---------- */
  const R = 6;                                      // Mawrice, 1.3 m across, is 12 pixels here: the table is 19 of him wide
  const GRAV = 500;                                 // the table slopes toward the player: this much downhill, down the screen
  const MAXV = 1100, STEP = 1 / 480;
  const LANE = { x: 251.25, face: 466, draw: 14 };  // the shooter lane: where he waits, the plunger's face, how far it draws
  const LAUNCH = [662, 112];                        // off the plunger: a tap drops him into T, a medium hold O, a full pull R
  const KICK = 330, FELT_KICK = 290, SLING = 320;   // what a cone, a Feltoid and a slingshot give him
  // HOW HARD IT IS, by covers taken off: "head on" narrower, the ball save shorter, fewer kickbacks lit
  const headOn = L => Math.max(22, 38 - 3 * L) * deg;
  const saveTime = L => Math.max(5, 12 - 1.5 * L);
  const kicksLit = L => (L < 2 ? [true, true] : L < 4 ? [true, false] : [false, false]);

  const walls = [];
  function wall(ax, ay, bx, by, w = 2, e = 0.4, kind = "", i = 0) {
    const dx = bx - ax, dy = by - ay;
    walls.push({ ax, ay, bx, by, dx, dy, l2: dx * dx + dy * dy || 1, w, e, kind, i });
  }
  const line = (pts, w, e) => { for (let i = 1; i < pts.length; i++) wall(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], w, e); };
  const arc = (cx, cy, r, a0, a1, n) => Array.from({ length: n + 1 }, (_, i) => { const a = (a0 + (a1 - a0) * i / n) * deg; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; });
  // the edge, and the lanes up each side that go round the top: the orbits
  const OUTLINE = [[262, 492], [262, 100], ...arc(198, 100, 64, 0, -90, 12).slice(1), ...arc(72, 100, 64, 270, 180, 12), [8, 492]];
  const ORBIT_L = [[30, 236], [30, 104], ...arc(72, 104, 42, 180, 270, 10).slice(1)];
  const ORBIT_R = [[220, 236], [220, 104], ...arc(180, 104, 40, 0, -90, 10).slice(1)];
  // where an orbit comes down, a bend turns him in toward the inlane rather than down the outlane
  const BEND_L = [[8, 244], [17, 258], [27, 270]], BEND_R = [[241, 244], [232, 258], [222, 270]];
  line(OUTLINE, 2, 0.4); line(ORBIT_L, 1.5, 0.4); line(ORBIT_R, 1.5, 0.4); line(BEND_L, 2, 0.35); line(BEND_R, 2, 0.35);
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
  // three wide lanes fill the top between the orbits' inner ends, so whatever falls there falls into one of them
  const LANES = [90, 126, 162], LANE_Y = 70, LANE_POSTS = [108, 144];
  for (const x of LANE_POSTS) wall(x, 62, x, 80, 1.5, 0.12);    // dead posts: he drops into a lane, not off it
  const POSTS = [{ x: 32.5, y: 300, r: 3.5, e: 0.7 }, { x: 217, y: 300, r: 3.5, e: 0.7 }];
  // the flippers: a pivot, a length, a thick end and a thin one
  const FLIP = { len: 38, rp: 6, rt: 3.5, rest: 28 * deg, up: -28 * deg, wUp: 20, wDown: 13, e: 0.2 };
  const flips = [{ x: 76, y: 408, s: 1, a: FLIP.rest, w: 0, on: false }, { x: 172, y: 408, s: -1, a: FLIP.rest, w: 0, on: false }];
  const tipOf = f => [f.x + f.s * FLIP.len * Math.cos(f.a), f.y + FLIP.len * Math.sin(f.a)];
  // the bumpers: Conelie three times on Rot Station's forecourt, and a family of Feltoids
  const CONES = [[110, 106], [154, 106], [132, 134]].map(([x, y], i) => ({ x, y, r: 9, face: 2, dy: 0, hop: 0, cool: 0, flash: 0, hold: 0, point: 2, ph: i * 2.1 }));
  const FELTS = [[62, 130, "feltr"], [86, 144, "feltt"], [64, 160, "feltr"]].map(([x, y, s], i) => ({ x, y, r: 7, s, face: "0", dy: 0, hop: 0, cool: 0, flash: 0, ph: i * 1.7 }));

  // THE RAMPS: at a ramp's mouth he leaves the floor and follows its track until he runs out of speed and rolls back
  // down, or reaches the end and is set down there
  function smooth(c, n = 5) {
    const out = [];
    for (let i = 0; i < c.length - 1; i++) {
      const p0 = c[Math.max(0, i - 1)], p1 = c[i], p2 = c[i + 1], p3 = c[Math.min(c.length - 1, i + 2)];
      for (let k = 0; k < n; k++) {
        const t = k / n, t2 = t * t, t3 = t2 * t;
        out.push([0, 1].map(j => 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)));
      }
    }
    out.push(c[c.length - 1]);
    return out;
  }
  function track(c) {
    const pts = smooth(c), cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    return { pts, cum, len: cum[cum.length - 1] };
  }
  function along(t, s) {
    s = clamp(s, 0, t.len);
    let i = 1;
    while (i < t.cum.length - 1 && t.cum[i] < s) i++;
    const [ax, ay] = t.pts[i - 1], [bx, by] = t.pts[i], L = t.cum[i] - t.cum[i - 1] || 1, u = (s - t.cum[i - 1]) / L;
    return [ax + (bx - ax) * u, ay + (by - ay) * u, (bx - ax) / L, (by - ay) / L];
  }
  const RAMPS = {
    hill: { mouth: [37, 83, 246], up: track([[60, 250], [57, 230], [49, 206], [42, 180], [39, 150], [38, 122], [36, 98], [29, 84], [20, 88], [17, 102], [18, 118]]) },
    culvert: {
      mouth: [167, 213, 246], up: track([[190, 250], [193, 226], [196, 198], [198, 166], [199, 134], [201, 108], [206, 94]]),
      right: track([[206, 94], [213, 100], [215, 124], [214, 170], [212, 220], [209, 262], [206, 296], [205, 306]]),
      wrong: track([[206, 94], [198, 90], [187, 93], [177, 99], [170, 104]]),
    },
  };
  // HOLES: Holloring's, the cover, and Gil Lister's three pipes; and the middle of the Depths
  const HOLES = [
    { id: "holl", x: 84, y: 206, r: 5, fast: 430, hold: 2.2, out: [0.3, 1], v: 230, cool: 0 },
    { id: "scoop", x: 132, y: 256, r: 6, fast: 420, hold: 1.6, out: [0, 1], v: 250, cool: 0 },
    { id: "p1", x: 176, y: 156, r: 5, fast: 520, pipe: true, hold: 0.55, cool: 0 },
    { id: "p2", x: 106, y: 168, r: 5, fast: 520, pipe: true, hold: 0.55, cool: 0 },
    { id: "p3", x: 180, y: 200, r: 5, fast: 520, pipe: true, hold: 0.55, cool: 0 },
  ];
  const PIPES = HOLES.filter(h => h.pipe);
  const WELL = { x: 132, y: 186, r: 24, hole: 5, hold: 1.4, cool: 0, id: "depths" };
  // the residents he meets on the floor, who are not bumpers and are never eaten
  const FOLK = {
    holl: { x: 84, y: 194, r: 7 }, snore: { x: 156, y: 168, r: 7 }, wish: { x: 160, y: 262, r: 6 },
    cyril: { x: 52, y: 98, r: 6 }, shoe: { x: 174, y: 292, r: 6 },
  };
  // the junk bank in front of the cover, and the trailer Escargo hauls
  const BANK = [[116, 284], [132, 284], [148, 284]];
  const CART = { x: 132, dir: 1, y: 230, x0: 100, x1: 164, speed: 14 };
  const JUNK = {
    crate: { r: 7, what: "A CRATE", bits: ["#8a6a44", "#5e4630", "#b08c5c"] },
    can: { r: 6, what: "A CAN", bits: ["#c8723a", "#e0a870", "#7a4a2a"] },
    pipe: { r: 4, seg: [-6, -1.5, 6, 1.5], what: "SOME PIPE", bits: ["#9a9a9a", "#6a6a6a", "#c8c8c8"] },
  };
  // the shots: made, they score; the lit one is worth double, and one soon after another is a combo
  const SHOTS = {
    hill: { name: "UP THE HILL", pts: 1500, lamp: [60, 262] },
    culvert: { name: "THE CULVERT", pts: 1500, lamp: [190, 262] },
    lorbit: { name: "LEFT ORBIT", pts: 750, lamp: [19, 222] },
    rorbit: { name: "RIGHT ORBIT", pts: 750, lamp: [230, 222] },
    depths: { name: "THE DEPTHS", pts: 1500, lamp: [132, 186] },
    holl: { name: "HOLLORING", pts: 2000, lamp: [84, 220] },
  };
  const SPIN_Y = 200, FLIT_Y = 176, LORBIT_Y = 130, RORBIT_Y = 150;
  const INLANES = [44, 205], OUTLANES = [20, 229.5], SWITCH_Y = 336, KICK_Y = 392;
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
    // Conelie squeaks when bumped; a Feltoid is cloth, and thumps
    squeak() {
      this.tone(120, 60, 0.08, "sine", 0.14);
      this.tone(880 + rnd(-60, 60), 1560, 0.07, "sine", 0.09); this.tone(1560, 1080, 0.09, "sine", 0.07, 0.06);
    },
    felt() { this.tone(170, 110, 0.07, "sine", 0.13); this.noise(0.05, 0.05, 300, 1500); },
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
    rampIn() { this.tone(90, 170, 0.35, "sawtooth", 0.04, 0, 700); this.noise(0.3, 0.04, 200, 1200); },
    rampDone() { this.noise(0.3, 0.06, 800, 5000); [784, 988, 1175].forEach((f, i) => this.tone(f, f, 0.18, "triangle", 0.07, i * 0.06)); },
    // Holloring takes him in; the cover scrapes; the pipes rattle; Gil says hello; the Depths hum
    gloop() { this.tone(200, 80, 0.35, "sine", 0.14); this.noise(0.25, 0.06, 100, 900); },
    cover() { this.noise(0.4, 0.1, 100, 900); this.tone(70, 60, 0.4, "sawtooth", 0.05, 0, 400); },
    pipe() { for (let k = 0; k < 5; k++) this.noise(0.03, 0.06, 1500, 6000, k * 0.08); this.tone(300, 180, 0.4, "square", 0.02, 0, 900); },
    hello() { this.tone(880, 1320, 0.08, "triangle", 0.09); this.tone(1320, 990, 0.12, "triangle", 0.08, 0.09); },
    depths() { this.tone(62, 44, 1.2, "sine", 0.16); this.tone(930, 1245, 0.9, "sine", 0.025, 0.2); this.noise(1, 0.03, 300, 900); },
    tick() { this.tone(1300, 1290, 0.03, "square", 0.03); },
    spin() { this.tone(2100, 2000, 0.012, "square", 0.018); },
    paper() { this.noise(0.25, 0.05, 3000, 9000); this.noise(0.15, 0.04, 2000, 7000, 0.1); },
    grip() { this.noise(0.15, 0.08, 200, 1200); this.tone(140, 100, 0.2, "sine", 0.08); },
    cart() { this.tone(520, 520, 0.09, "square", 0.035); this.tone(415, 415, 0.12, "square", 0.035, 0.11); },
    // down the canal, and far below, Old Parp, who exists to honk
    splash() {
      this.noise(0.55, 0.13, 200, 1500); this.tone(300, 120, 0.3, "sine", 0.05);
      this.tone(98, 92, 0.55, "sawtooth", 0.05, 0.55, 520); this.tone(147, 139, 0.55, "sawtooth", 0.03, 0.55, 520);
    },
    saved() { this.tone(600, 1200, 0.14, "triangle", 0.08); this.tone(800, 1600, 0.16, "triangle", 0.07, 0.12); },
    buzz() { this.tone(82, 80, 0.9, "sawtooth", 0.07, 0, 900); },
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
  let SC, atlas, ready = false, table = null, ramps = null, apron = null, dmdGrid = null, pat = {};
  let state = "ready";                     // ready, play, drain, pause, over
  let clock = 0, acc = 0, stepAcc = 0, drainT = 0, overT = 0, serveT = 0, refillT = 0;
  const ball = { x: LANE.x, y: LANE.face - R, vx: 0, vy: 0, live: false, inLane: true, phi: 0, chomp: 0, dist: 0, px: 0, py: 0,
                 ramp: null, track: null, s: 0, v: 0, hold: null };
  const mw = { h: 2, k: 0 };               // which of his frames is drawn: heading and step, sampled 15 times a second
  const plunger = { pull: 0, face: LANE.face, snap: 0, drawn: LANE.face };
  const holds = new Set();                 // what is holding the plunger back: keys and fingers
  let score = 0, best = store.get("best", 0), balls = 3, ballNo = 1, mult = 1, level = 0, extraGiven = false;
  let lit = [false, false, false], skill = 0, skillLive = false, rotFlash = 0, kicks = [true, true], kickFlash = [0, 0];
  let bank = [], coverOff = false, eatenBall = 0, shotsBall = 0, eaten = { crate: 0, can: 0, pipe: 0 }, bumps = 0, bulletin = false;
  let saveT = 0, saveUsed = false, tiltMeter = 0, tilted = false, shake = 0, stillT = 0;
  let hot = "hill", hotT = 20, lastShot = -9, combo = 0, shotFlash = {};
  let bits = [], pops = [], ripples = [], zs = [], papers = [], slingFlash = [0, 0], slingCool = [0, 0], laneCool = [0, 0, 0], switchCool = {};
  const spinner = { rev: 0, speed: 0, half: 0, count: 0 };
  const gil = { pipe: null, t: 0, next: 4, up: 0, face: "0" };
  const cart = { x: CART.x, dir: 1, crate: null, honk: 0 };
  const flitter = { off: 0, t: 0, face: "0" };
  const folk = { cyril: { face: 2, turn: 0 }, shoe: { grip: 0 }, holl: { tip: "0", kept: 0 }, snore: { nod: 0 }, parp: { honk: 0 } };
  const apronFolk = { sikat: { x: 30, dir: 1 }, nick: { t: 0, k: "1" }, tata: false };
  const peter = { x: 200, y: 50 };
  const diverter = { point: "right", face: 0 };
  const said = {};
  const dmdQ = [];

  function hud() {
    const b = $("balls");
    b.textContent = "●".repeat(Math.max(0, balls));
    b.setAttribute("aria-label", "Balls left: " + Math.max(0, balls));
    $("best").textContent = "Best " + fmt(best);
  }
  // the dot display in the backbox: a line, a smaller one under it, for a while. What happens now replaces what is
  // showing; the big moments wait their turn rather than cut each other off
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

  // what somebody leaves in front of the cover: a crate, a can and a bit of pipe, dropped in from above
  function newBank() {
    const kinds = ["crate", "can", "pipe"];
    for (let i = kinds.length - 1; i > 0; i--) { const j = rint(i + 1); [kinds[i], kinds[j]] = [kinds[j], kinds[i]]; }
    bank = BANK.map(([x, y], i) => ({ kind: kinds[i], x, y, gone: false, dy: -50 - 20 * i, vy: 0 }));
    coverOff = false;
  }
  function loadCart() { cart.crate = { kind: "crate", x: cart.x, y: CART.y, gone: false, dy: 0, vy: 0, cart: true }; }

  // a ball into the shooter lane, waiting on the plunger, facing the lens
  function serve(fresh) {
    Object.assign(ball, { x: LANE.x, y: LANE.face - R, vx: 0, vy: 0, live: true, inLane: true, phi: 0, chomp: 0, ramp: null, hold: null });
    mw.h = 2; mw.k = 0;
    plunger.pull = 0; holds.clear();
    skill = rint(3); skillLive = true;
    if (fresh) {
      eatenBall = 0; shotsBall = 0; mult = 1; saveT = 0; saveUsed = false; tilted = false; tiltMeter = 0; bumps = 0; bulletin = false;
      kicks = kicksLit(level);
      apronFolk.tata = Math.random() < 1 / 30;
      show("BALL " + ballNo, "", 1.6, 0);
      if (apronFolk.tata) show("TATA", "", 1.4, 1);
    }
  }

  function start() {
    audio.unlock();
    score = 0; balls = 3; ballNo = 1; level = 0; extraGiven = false; serveT = 0; refillT = 0;
    eaten = { crate: 0, can: 0, pipe: 0 };
    lit = [false, false, false]; bits = []; pops = []; ripples = []; papers = []; dmdQ.length = 0;
    hot = pick(Object.keys(SHOTS)); hotT = 20; combo = 0; lastShot = -9;
    newBank(); loadCart();
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
  function pop(x, y, s, col = "#ffb35c") { pops.push({ x, y, s, t: 0, col }); }
  function burst(x, y, cols, n = 14, up = 60) {
    for (let k = 0; k < n; k++) {
      const a = rnd(0, Math.PI * 2), v = rnd(40, 140);
      bits.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - up, t: 0, life: rnd(0.4, 0.8), col: pick(cols) });
    }
  }
  function lane(i) {
    if (skillLive && i === skill) { score += 2500; show("SKILL SHOT", "+2,500", 1.6, 2); audio.fanfare(); pop(LANES[i], LANE_Y + 14, "+2500", "#ffd66b"); }
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
  // a shot made: its score, doubled if it is the lit one, and more for each one soon after another
  function shot(k) {
    const S = SHOTS[k];
    let pts = S.pts;
    skillLive = false; shotsBall++;
    shotFlash[k] = 0.6;
    if (clock - lastShot < 3.5) combo++; else combo = 0;
    lastShot = clock;
    let small = "+" + fmt(pts);
    if (hot === k) {
      pts *= 2; small = "LIT x2 +" + fmt(pts);
      hot = pick(Object.keys(SHOTS).filter(q => q !== k)); hotT = 20;
      audio.fanfare();
    }
    if (combo > 0) { const c = 500 * combo; pts += c; small = "COMBO x" + (combo + 1) + " +" + fmt(pts); }
    score += pts;
    show(S.name, small, 1.4);
    const [lx, ly] = S.lamp;
    pop(lx, ly - 6, "+" + pts, "#9dffc0");
  }
  function eat(j) {
    j.gone = true;
    const J = JUNK[j.kind], pts = (j.cart ? 1000 : 500 * (1 + level)) * mult;
    score += pts; eatenBall++; eaten[j.kind]++;
    skillLive = false;
    audio.chomp();
    burst(j.x, j.y, J.bits);
    pop(j.x, j.y - 8, "+" + pts);
    show(j.cart ? "ESCARGO'S CRATE" : "ATE " + J.what, "+" + fmt(pts), 1.2);
    // his face comes round to it
    ball.phi = 270 * deg; ball.chomp = 0.28;
    if (!j.cart && bank.every(q => q.gone)) {
      coverOff = true; audio.cover();
      show("THE COVER IS OFF", "DO NOT LIFT", 1.8, 2);
    }
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
    audio.splash(); folk.parp.honk = 1;
    if (saveT > 0 && !tilted) {
      saveT = 0; saveUsed = true;
      show("BALL SAVED", "", 1.6, 2); audio.saved();
      serveT = 0.9;
      return;
    }
    saveT = 0;
    state = "drain"; drainT = 0;
    const bonus = tilted ? 0 : eatenBall * 300 * mult + shotsBall * 200;
    score += bonus;
    show("BONUS", eatenBall + " EATEN " + shotsBall + " SHOTS", 1.2, 2);
    show("MISERY PETER", "NO VERDICT. +" + fmt(bonus), 1.4, 2);
    say("canal", "He rolled into the canal.");
  }

  // a hole keeps him: what it gives for it, and when it lets him go
  function capture(hl) {
    ball.hold = { hl, t: 0 }; ball.vx = 0; ball.vy = 0; ball.x = hl.x; ball.y = hl.y;
    skillLive = false;
    if (hl.id === "holl") { audio.gloop(); shot("holl"); folk.holl.kept = hl.hold; }
    else if (hl.id === "scoop") {
      audio.cover();
      const pts = 3000 * (1 + level);
      score += pts; level++;
      show("UNDER THE COVER", "+" + fmt(pts), 1.8, 2);
      if (level === 2 && !extraGiven) {
        extraGiven = true; balls++;
        show("EXTRA BALL", "BACK UP THE HILL", 2.2, 2);
        say("hill", "He came back up the hill. Nobody saw how.");
        hud();
      }
    } else if (hl.pipe) { audio.pipe(); score += 750; show("GIL'S PIPES", "+750", 1.1); }
    else if (hl.id === "depths") { audio.depths(); shot("depths"); }
  }
  function release() {
    const { hl } = ball.hold;
    ball.hold = null;
    if (hl.pipe) {
      // out of another pipe, any of them but the one he went in by
      const out = pick(PIPES.filter(p => p !== hl && !(gil.pipe === p && gil.up > 0)));
      const a = rnd(40, 140) * deg;
      ball.x = out.x; ball.y = out.y; ball.vx = Math.cos(a) * 170; ball.vy = Math.sin(a) * 170;
      ball.px = ball.x; ball.py = ball.y;
      out.cool = 0.7; hl.cool = 0.5;
      burst(out.x, out.y, ["#4a3a30", "#7a5a44"], 6, 20);
      return;
    }
    if (hl.id === "depths") {
      // what the Depths gave back: nobody has stayed awake long enough to translate it
      const gifts = [["2,500", () => { score += 2500; }], ["5,000", () => { score += 5000; }], ["A KICKBACK", () => { kicks = [true, true]; }],
                     ["A BALL SAVE", () => { saveT = Math.max(saveT, 6); saveUsed = false; }], ["R", () => lane(0)], ["NOTHING", () => {}]];
      const [name, give] = pick(gifts);
      give();
      show("THE DEPTHS SAY ???", name, 1.8, 2);
      const a = rnd(55, 125) * deg;
      ball.x = WELL.x + Math.cos(a) * 8; ball.y = WELL.y + Math.sin(a) * 8; ball.vx = Math.cos(a) * 300; ball.vy = Math.sin(a) * 300;
      ball.px = ball.x; ball.py = ball.y;
      WELL.cool = 1.2;
      return;
    }
    if (hl.id === "shoe") {
      ball.x = hl.x; ball.y = hl.y; ball.vx = hl.out[0] * hl.v; ball.vy = hl.out[1] * hl.v;
      ball.px = ball.x; ball.py = ball.y;
      FOLK.shoe.cool = 10;
      return;
    }
    const a = Math.atan2(hl.out[1], hl.out[0]) + rnd(-12, 12) * deg;
    ball.x = hl.x; ball.y = hl.y + 2; ball.vx = Math.cos(a) * hl.v; ball.vy = Math.sin(a) * hl.v;
    ball.px = ball.x; ball.py = ball.y;
    hl.cool = 0.8;
    if (hl.id === "holl") folk.holl.kept = 0;
    if (hl.id === "scoop") refillT = 1.6;
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
  // never through a wall: if he was on one side of it a step ago, he is pushed back out on that side
  function sideOf(ax, ay, ux, uy) { return (ball.px - ax) * uy - (ball.py - ay) * ux; }
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
      const l = Math.sqrt(s.l2), ux = s.dx / l, uy = s.dy / l, was = sideOf(s.ax, s.ay, ux, uy);
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
  // a round thing he bumps into, which may itself be moving: the normal and how hard, or null
  function hitCircle(x, y, r, e, vx = 0, vy = 0) {
    const dx = ball.x - x, dy = ball.y - y, d2 = dx * dx + dy * dy, rr = R + r;
    if (d2 >= rr * rr) return null;
    const d = Math.sqrt(d2) || 1e-6, nx = dx / d, ny = dy / d;
    ball.x = x + nx * rr; ball.y = y + ny * rr;
    const rvx = ball.vx - vx, rvy = ball.vy - vy, vn = rvx * nx + rvy * ny;
    if (vn >= 0) return { nx, ny, hit: 0 };
    const k = -vn > 40 ? e : 0;
    ball.vx = vx + rvx - (1 + k) * vn * nx; ball.vy = vy + rvy - (1 + k) * vn * ny;
    return { nx, ny, hit: -vn };
  }
  function hitPost(p) { const h = hitCircle(p.x, p.y, p.r, p.e); if (h && h.hit > 220) audio.thud(h.hit); }
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
      const l = Math.sqrt(l2), ux = dx / l, uy = dy / l, was = sideOf(f.x, f.y, ux, uy);
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
  // a bumper fires: Conelie knocks him off the wrong way, a quarter turn or so off the straight line; a Feltoid straight
  function hitBumper(c, kick, cone) {
    const dx = ball.x - c.x, dy = ball.y - c.y, d2 = dx * dx + dy * dy, rr = R + c.r;
    if (d2 >= rr * rr) return;
    const d = Math.sqrt(d2) || 1e-6, nx = dx / d, ny = dy / d;
    ball.x = c.x + nx * rr; ball.y = c.y + ny * rr;
    if (c.cool > 0 || tilted) { bounceOff(nx, ny, 0.5); return; }
    let kx = nx, ky = ny;
    if (cone) {
      const turn = (Math.random() < 0.5 ? -1 : 1) * rnd(18, 40) * deg, cs = Math.cos(turn), sn = Math.sin(turn);
      kx = nx * cs - ny * sn; ky = nx * sn + ny * cs;
      c.point = dir8(kx, ky); c.hold = 0.7;
      audio.squeak(); score += 100; bumps++;
      if (bumps === 12 && !bulletin) { bulletin = true; show("CONELIE POINTED THE WRONG WAY AGAIN", "", 3.2, 2); }
    } else {
      audio.felt(); score += 150;
      for (const f of FELTS) f.flash = 0.2;                // the family answers together
    }
    const k = kick + 16 * Math.min(5, level);
    ball.vx = kx * k; ball.vy = ky * k;
    c.cool = 0.1; c.flash = 0.16; c.hop = 0.14;
    skillLive = false;
  }
  // the residents he meets on the floor: none of them is eaten, and some of them answer
  function hitFolk(key) {
    const p = FOLK[key], h = hitCircle(p.x, p.y, p.r, 0.45);
    if (!h || h.hit < 40) return;
    skillLive = false;
    if (key === "cyril" && (p.cool || 0) <= 0) {
      // do not mistake him for furniture: he turns, slowly
      p.cool = 1.2; folk.cyril.turn = 8; score += 250;
      if (clock - (p.said || -99) > 10) { p.said = clock; show("HASSOCK CYRIL", "NOT FURNITURE", 1.2); }
      audio.clunk();
    } else if (key === "shoe" && (p.cool || 0) <= 0 && h.hit < 160 && !tilted) {
      // Handshoe takes his hand, and does not let go for a moment
      ball.hold = { hl: { id: "shoe", x: ball.x, y: ball.y, hold: 1.1, out: [h.nx, h.ny], v: 200 }, t: 0 };
      ball.vx = 0; ball.vy = 0; folk.shoe.grip = 1.1; score += 500;
      show("HANDSHOE", "DO NOT PULL AWAY", 1.3);
      audio.grip();
    } else if (key === "snore" && (p.cool || 0) <= 0) {
      p.cool = 2; score += 100; zs.push({ t: 0, dx: rnd(-3, 3) }, { t: -0.4, dx: rnd(-3, 3) });
      audio.thud(h.hit);
    } else if (h.hit > 220) audio.thud(h.hit);
  }
  // Escargo's cart moves, and he can be run into by it
  function hitCart() {
    const vx = cart.dir * CART.speed;
    const ax = cart.x - 10, bx = cart.x + 10, t = clamp((ball.x - ax) / (bx - ax), 0, 1), qx = ax + (bx - ax) * t;
    const h = hitCircle(qx, CART.y, 7, 0.4, vx, 0);
    if (h && h.hit > 60 && cart.honk <= 0) { cart.honk = 1; score += 100; audio.cart(); skillLive = false; }
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
  function hitGil() {
    const p = gil.pipe, h = hitCircle(p.x, p.y - 3, 5, 0.5);
    if (!h || h.hit < 30) return;
    // he said hello, and this time somebody said it back
    score += 2500; gil.t = Math.max(gil.t, 2.8);
    show("GIL LISTER", "SAID HELLO BACK +2,500", 1.6, 2);
    audio.hello(); pop(p.x, p.y - 14, "HELLO", "#ffe39a");
    skillLive = false;
  }

  function physics(h) {
    for (const f of flips) {
      const want = f.on && !tilted ? FLIP.up : FLIP.rest, old = f.a;
      if (f.a > want) f.a = Math.max(want, f.a - FLIP.wUp * h);
      else if (f.a < want) f.a = Math.min(want, f.a + FLIP.wDown * h);
      f.w = (f.a - old) / h;
    }
    if (!ball.live || ball.hold) return;
    if (ball.ramp) { rampStep(h); return; }
    const px = ball.x, py = ball.y;
    ball.px = px; ball.py = py;
    ball.vy += GRAV * h;
    // the Depths pull him in and round
    const wx = WELL.x - ball.x, wy = WELL.y - ball.y, wd = Math.hypot(wx, wy);
    if (wd < WELL.r && WELL.cool <= 0) {
      const k = 1 - wd / WELL.r, nx = wx / (wd || 1), ny = wy / (wd || 1);
      ball.vx += (nx * 1500 - ny * 520) * k * h;
      ball.vy += (ny * 1500 + nx * 520) * k * h;
    }
    ball.x += ball.vx * h; ball.y += ball.vy * h;
    for (const s of walls) hitWall(s);
    for (const p of POSTS) hitPost(p);
    hitGate();
    hitPlunger();
    for (const f of flips) hitFlip(f);
    for (const c of CONES) hitBumper(c, KICK, true);
    for (const c of FELTS) hitBumper(c, FELT_KICK, false);
    for (const k in FOLK) { hitFolk(k); if (ball.hold) return; }
    hitCart();
    for (const j of bank) hitJunk(j);
    if (cart.crate) hitJunk(cart.crate);
    if (gil.pipe && gil.up > 0.6) hitGil();
    const sp = Math.hypot(ball.vx, ball.vy);
    if (sp > MAXV) { ball.vx *= MAXV / sp; ball.vy *= MAXV / sp; }
    // how far round he has rolled, and the rattle of it
    const moved = Math.hypot(ball.x - px, ball.y - py);
    if (ball.chomp <= 0) ball.phi += moved / 6;
    ball.dist += moved;
    if (ball.dist > 16) { ball.dist = 0; if (Math.random() < 0.45 && sp > 60) audio.rattle(sp); }
    // the holes, and down the middle of the Depths
    for (const hl of HOLES) {
      if (hl.cool > 0 || (hl.id === "scoop" && !coverOff) || (gil.pipe === hl && gil.up > 0)) continue;
      if (Math.hypot(ball.x - hl.x, ball.y - hl.y) < hl.r && sp < hl.fast) { capture(hl); return; }
    }
    if (WELL.cool <= 0 && Math.hypot(WELL.x - ball.x, WELL.y - ball.y) < WELL.hole && sp < 380) { capture(WELL); return; }
    // up a ramp's mouth
    for (const k in RAMPS) {
      const [x0, x1, my] = RAMPS[k].mouth;
      if (py > my && ball.y <= my && ball.x > x0 && ball.x < x1 && ball.vy < -70) {
        ball.ramp = k; ball.track = RAMPS[k].up; ball.s = 0; ball.v = -ball.vy * 0.9;
        audio.rampIn(); skillLive = false;
        return;
      }
    }
    switches(px, py);
    // out of the lane and onto the table: the ball save starts
    if (ball.inLane && ball.y < 100) {
      ball.inLane = false;
      if (!saveUsed && saveT <= 0) saveT = saveTime(level);
    }
    if (ball.y > 494) drained();
  }
  // up a ramp: he slows as it climbs and speeds as it falls, and rolls back out if he does not reach the top
  function rampStep(h) {
    const t = ball.track, [, , , dy] = along(t, ball.s);
    ball.v += (GRAV * dy * (dy < 0 ? 1.35 : 1) - 30 * Math.sign(ball.v)) * h;
    ball.s += ball.v * h;
    ball.phi += Math.abs(ball.v) * h / 6;
    if (ball.s <= 0) {
      const [x, y, ddx, ddy] = along(t, 0);
      ball.ramp = null; ball.x = x; ball.y = y + 1; ball.px = x; ball.py = y + 1; ball.vx = ddx * ball.v; ball.vy = ddy * ball.v;
      return;
    }
    if (ball.s >= t.len) {
      const rp = RAMPS[ball.ramp];
      if (t === rp.up && ball.ramp === "culvert") {
        // the top of the culvert: Conelie points, and he goes where Conelie points
        shot("culvert");
        const way = diverter.point;
        ball.track = rp[way]; ball.s = 0;
        if (way === "wrong") { show("WRONG WAY", "CONELIE POINTED", 1.2); audio.squeak(); }
        diverter.point = Math.random() < 0.5 ? "right" : "wrong";
        return;
      }
      const [x, y, ddx, ddy] = along(t, t.len), v = Math.max(ball.v, 60);
      if (ball.ramp === "hill") shot("hill");
      audio.rampDone();
      ball.ramp = null; ball.x = x; ball.y = y; ball.px = x; ball.py = y; ball.vx = ddx * v; ball.vy = ddy * v;
      return;
    }
    const [x, y] = along(t, ball.s);
    ball.x = x; ball.y = y;
  }
  function switches(px, py) {
    const crossed = y0 => (py - y0) * (ball.y - y0) <= 0 && py !== ball.y;
    // R, O and T
    if (crossed(LANE_Y)) for (let i = 0; i < 3; i++) if (Math.abs(ball.x - LANES[i]) < 16 && laneCool[i] <= 0) { laneCool[i] = 0.4; lane(i); }
    const inL = ball.x > 9 && ball.x < 29.5, inR = ball.x > 220.5 && ball.x < 241;
    // the orbits count going up
    if (inL && py > LORBIT_Y && ball.y <= LORBIT_Y && !switchCool.lo) { switchCool.lo = 0.6; shot("lorbit"); }
    if (inR && py > RORBIT_Y && ball.y <= RORBIT_Y && !switchCool.ro) { switchCool.ro = 0.6; shot("rorbit"); }
    // the town sign's counter spins, and the town still reads ???
    if (inL && crossed(SPIN_Y)) spinner.speed = Math.min(14, spinner.speed + Math.abs(ball.vy) / 45);
    // the Flitter, startled, drops the list
    if (inR && crossed(FLIT_Y) && flitter.off <= 0) {
      flitter.off = 4; flitter.t = 0; flitter.face = ball.vy < 0 ? "l" : "r";
      score += 500; show("THE FLITTER", "DROPPED THE LIST", 1.3);
      audio.paper();
      for (let k = 0; k < 8; k++) papers.push({ x: 230, y: FLIT_Y, vx: rnd(-40, 40), vy: rnd(-50, 10), t: 0, life: rnd(1, 1.8), a: rnd(0, 6) });
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
  }

  /* ---------- a frame ---------- */
  function update(dt) {
    clock += dt;
    if (state === "play" || state === "drain") {
      stepAcc += dt;
      while (stepAcc >= STEP) { stepAcc -= STEP; physics(STEP); if (state !== "play" && state !== "drain") break; }
    }
    // a hole, or a hand, lets him go
    if (ball.hold) { ball.hold.t += dt; if (ball.hold.t >= ball.hold.hl.hold) release(); }
    // the plunger draws back while held, and he goes back with it
    const resting = ball.live && ball.inLane && !ball.hold && ball.y > plunger.face - R - 3;
    if (state === "play" && holds.size && resting) plunger.pull = Math.min(1, plunger.pull + dt * 1.25);
    plunger.snap = Math.max(0, plunger.snap - dt * 6);
    plunger.face = LANE.face + LANE.draw * plunger.pull;
    plunger.drawn = plunger.face - 10 * plunger.snap;
    audio.roll(ball.live && !ball.hold ? Math.hypot(ball.vx, ball.vy) || Math.abs(ball.v) : 0);
    if (state === "play" && ball.live && !ball.inLane && saveT > 0 && !ball.hold) saveT = Math.max(0, saveT - dt);
    // he never sits still for long: if nothing is holding him and he stops, the old table shifts under him
    const cradled = flips.some(f => f.on && Math.hypot(ball.x - f.x, ball.y - f.y) < 60);
    if (state === "play" && ball.live && !ball.inLane && !ball.ramp && !ball.hold && !cradled && Math.hypot(ball.vx, ball.vy) < 12) stillT += dt; else stillT = 0;
    if (stillT > 3) { stillT = 0; ball.vx += (Math.random() < 0.5 ? -1 : 1) * rnd(60, 110); ball.vy -= rnd(140, 200); shake = reduce ? 0 : 0.12; audio.thud(700); }
    tiltMeter = Math.max(0, tiltMeter - dt * 0.4);
    shake = Math.max(0, shake - dt);
    rotFlash = Math.max(0, rotFlash - dt);
    ball.chomp = Math.max(0, ball.chomp - dt);
    for (let i = 0; i < 2; i++) { slingFlash[i] = Math.max(0, slingFlash[i] - dt); slingCool[i] = Math.max(0, slingCool[i] - dt); kickFlash[i] = Math.max(0, kickFlash[i] - dt); }
    for (let i = 0; i < 3; i++) laneCool[i] = Math.max(0, laneCool[i] - dt);
    for (const k in switchCool) { switchCool[k] -= dt; if (switchCool[k] <= 0) delete switchCool[k]; }
    for (const k in shotFlash) shotFlash[k] = Math.max(0, shotFlash[k] - dt);
    for (const c of CONES) { c.cool = Math.max(0, c.cool - dt); c.flash = Math.max(0, c.flash - dt); c.hop = Math.max(0, c.hop - dt); c.hold = Math.max(0, c.hold - dt); }
    for (const c of FELTS) { c.cool = Math.max(0, c.cool - dt); c.flash = Math.max(0, c.flash - dt); c.hop = Math.max(0, c.hop - dt); }
    for (const k in FOLK) if (FOLK[k].cool) FOLK[k].cool = Math.max(0, FOLK[k].cool - dt);
    for (const hl of HOLES) hl.cool = Math.max(0, hl.cool - dt);
    WELL.cool = Math.max(0, WELL.cool - dt);
    folk.shoe.grip = Math.max(0, folk.shoe.grip - dt);
    folk.parp.honk = Math.max(0, folk.parp.honk - dt);
    cart.honk = Math.max(0, cart.honk - dt);
    // the lit shot moves on if nobody takes it
    if (state === "play") { hotT -= dt; if (hotT <= 0) { hot = pick(Object.keys(SHOTS).filter(q => q !== hot)); hotT = 20; } }
    // the town sign's counter
    if (spinner.speed > 0) {
      spinner.rev += spinner.speed * dt;
      spinner.speed = Math.max(0, spinner.speed - dt * 5);
      const half = Math.floor(spinner.rev * 2);
      if (half > spinner.half) {
        const n = half - spinner.half; spinner.half = half; spinner.count += n; score += 10 * n; audio.spin();
        if (spinner.count % 10 === 0) show("POPULATION ???", "COUNTED " + spinner.count, 0.9);
      }
    }
    // what somebody leaves falls into place, and the cover goes back on
    if (refillT > 0) {
      refillT -= dt;
      if (refillT <= 0) { newBank(); say("more", "Somebody left another crate where he is going."); }
    }
    for (const j of bank) {
      if (j.dy >= 0) continue;
      j.vy += 900 * dt; j.dy += j.vy * dt;
      if (j.dy >= 0) { j.dy = 0; j.vy = 0; audio.thud(400); }
    }
    // Escargo hauls the trailer across and back, and a new crate goes on at the far end
    cart.x += cart.dir * CART.speed * dt;
    if (cart.x > CART.x1 || cart.x < CART.x0) {
      cart.dir *= -1; cart.x = clamp(cart.x, CART.x0, CART.x1);
      if (!cart.crate || cart.crate.gone) loadCart();
    }
    if (cart.crate) { cart.crate.x = cart.x - 21 * cart.dir; cart.crate.y = CART.y; }
    // Gil Lister pops out of one pipe and then another to say hello
    if (gil.pipe) {
      gil.t += dt;
      gil.up = gil.t < 0.3 ? gil.t / 0.3 : gil.t < 2.8 ? 1 : Math.max(0, 1 - (gil.t - 2.8) / 0.3);
      if (gil.t > 3.1) { gil.pipe = null; gil.up = 0; gil.next = rnd(3, 6); }
    } else if (state === "play") {
      gil.next -= dt;
      if (gil.next <= 0) {
        const free = PIPES.filter(p => !(ball.hold && ball.hold.hl === p) && Math.hypot(ball.x - p.x, ball.y - p.y) > 24);
        if (free.length) { gil.pipe = pick(free); gil.t = 0; gil.face = pick(["0", "l", "r"]); }
        else gil.next = 1;
      }
    }
    if (flitter.off > 0) { flitter.off -= dt; flitter.t += dt; }
    // the apron: Sikat mops it end to end, and does not resist
    const sk = apronFolk.sikat;
    sk.x += sk.dir * 6 * dt;
    if (sk.x > 74 || sk.x < 18) { sk.dir *= -1; sk.x = clamp(sk.x, 18, 74); }
    // Misery Peter drifts over the rooftops
    peter.x = 196 + 26 * Math.sin(clock * 0.13); peter.y = 50 + 2 * Math.sin(clock * 0.7);
    for (const b of bits) { b.t += dt; b.vy += 420 * dt; b.x += b.vx * dt; b.y += b.vy * dt; }
    bits = bits.filter(b => b.t < b.life);
    for (const p of papers) { p.t += dt; p.vy += 60 * dt; p.vx *= 0.98; p.x += p.vx * dt + Math.sin(p.t * 6 + p.a) * 0.3; p.y += p.vy * dt; }
    papers = papers.filter(p => p.t < p.life);
    for (const p of pops) p.t += dt;
    pops = pops.filter(p => p.t < 0.9);
    for (const q of ripples) q.t += dt;
    ripples = ripples.filter(q => q.t < 1.2);
    for (const z of zs) z.t += dt;
    zs = zs.filter(z => z.t < 1.8);
    if (Math.random() < dt * 0.35) zs.push({ t: 0, dx: rnd(-3, 3) });
    if (dmdQ.length) { dmdQ[0].t += dt; if (dmdQ[0].t > dmdQ[0].dur) dmdQ.shift(); }
    if (serveT > 0) { serveT -= dt; if (serveT <= 0 && state === "play" && !ball.live) serve(false); }
    // between balls: the bonus, then the next one or the end
    if (state === "drain") {
      drainT += dt;
      if (drainT > 2.6) {
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
    let vx = ball.vx, vy = ball.vy;
    if (ball.ramp) { const a = along(ball.track, ball.s); vx = a[2] * ball.v; vy = a[3] * ball.v; }
    if (ball.chomp > 0) mw.k = 9;
    else {
      if (Math.hypot(vx, vy) > 30) mw.h = dir8(vx, vy);
      mw.k = ((Math.floor(ball.phi / (30 * deg)) % 12) + 12) % 12;
    }
    const near = (x, y, r) => ball.live && !ball.hold && Math.hypot(ball.x - x, ball.y - y) < r;
    // the cones bob, turn toward him as he comes, face the way they sent him, and otherwise the lens
    for (const c of CONES) {
      c.dy = c.hop > 0 ? -2 : Math.round(Math.sin(clock * 2.2 + c.ph) * 0.8);
      const want = c.hold > 0 ? c.point : near(c.x, c.y, 50) ? dir8(ball.x - c.x, ball.y - c.y) : 2;
      if (c.face !== want) { const d = ((want - c.face + 12) % 8) - 4; c.face = (c.face + (d < 0 ? -1 : 1) + 8) % 8; }
    }
    // the Feltoids bob together and look his way
    for (const f of FELTS) {
      f.dy = f.hop > 0 ? -2 : Math.round(Math.sin(clock * 1.8 + f.ph) * 0.6);
      f.face = near(f.x, f.y, 44) ? (ball.x < f.x - 6 ? "l" : ball.x > f.x + 6 ? "r" : "0") : "0";
    }
    // Hassock Cyril, startled, turns slowly all the way round
    if (folk.cyril.turn > 0) { folk.cyril.turn--; folk.cyril.face = (folk.cyril.face + 1) % 8; }
    // Holloring wobbles while he keeps him
    folk.holl.tip = ball.hold && ball.hold.hl.id === "holl" ? (Math.floor(clock * 5) % 2 ? "l" : "r") : "0";
    folk.snore.nod = Math.floor(clock / 1.7) % 2;
    // Nickelpig rocks after a cent, fast, and barely gets anywhere
    const nk = apronFolk.nick;
    nk.t++;
    nk.k = nk.t % 2 ? "1" : "2";
    diverter.face = diverter.point === "right" ? 0 : 4;
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
  const polyPath = (x2, pts) => { x2.beginPath(); pts.forEach(([x, y], i) => (i ? x2.lineTo(x, y) : x2.moveTo(x, y))); };
  // a rail: an old sewer pipe, rust over iron, lit from the top left
  function rail(x2, pts, w = 5) {
    x2.lineJoin = "round"; x2.lineCap = "round";
    polyPath(x2, pts); x2.strokeStyle = "#2a150d"; x2.lineWidth = w + 2; x2.stroke();
    polyPath(x2, pts); x2.strokeStyle = "#7c3f24"; x2.lineWidth = w; x2.stroke();
    x2.save(); x2.translate(-0.8, -0.8); polyPath(x2, pts); x2.strokeStyle = "#b8703f"; x2.lineWidth = Math.max(1, w - 3.5); x2.stroke(); x2.restore();
  }
  function arrow(x2, x, y, a, len, col) {
    x2.save(); x2.translate(x, y); x2.rotate(a); x2.fillStyle = col;
    x2.fillRect(-len / 2, -1.5, len - 5, 3);
    x2.beginPath(); x2.moveTo(len / 2, 0); x2.lineTo(len / 2 - 7, -5); x2.lineTo(len / 2 - 7, 5); x2.closePath(); x2.fill();
    x2.restore();
  }

  // the table, drawn once: the Old Sewerworks' brick, the orbits' gutters, the forecourt the cones stand on, the
  // Depths, what is painted on the floor, the rails, the posts, the slingshots, Holloring's drain and Gil's pipes
  function makeTable() {
    const [c, x] = off(W, H);
    x.fillStyle = "#0b0810"; x.fillRect(0, 0, W, H);
    x.save(); outlinePath(x); x.clip();
    x.fillStyle = pat.brick; x.fillRect(0, 0, W, H);
    x.fillStyle = "rgba(16,9,24,.62)"; x.fillRect(0, 0, W, H);
    let gr = x.createRadialGradient(124, 250, 60, 124, 250, 300);
    gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(1, "rgba(0,0,0,.45)");
    x.fillStyle = gr; x.fillRect(0, 0, W, H);
    // the orbits' gutters, round the top: a grate, darker
    x.save(); polyPath(x, [[19, 240], [19, 104], ...arc(72, 100, 53, 180, 270, 10), [198, 47], ...arc(198, 100, 53, -90, 0, 10), [230.5, 240]]);
    x.lineWidth = 19; x.lineJoin = "round"; x.strokeStyle = pat.grate; x.stroke(); x.strokeStyle = "rgba(8,5,12,.55)"; x.stroke(); x.restore();
    // the shooter lane: a grate to roll up
    x.fillStyle = pat.grate; x.fillRect(241, 104, 21, H);
    x.fillStyle = "rgba(10,6,14,.55)"; x.fillRect(241, 104, 21, H);
    "UP THE HILL".split("").forEach((ch, i) => text(x, ch, 250, 170 + i * 7, 1, "rgba(235,215,170,.42)"));
    for (let k = 0; k < 4; k++) { const y = 268 + k * 34; x.fillStyle = "rgba(235,215,170,.2)"; x.beginPath(); x.moveTo(245, y + 6); x.lineTo(251.5, y); x.lineTo(258, y + 6); x.lineTo(258, y + 9); x.lineTo(251.5, y + 3); x.lineTo(245, y + 9); x.closePath(); x.fill(); }
    // Rot Station's forecourt under the cones: cracked asphalt, a painted edge, and arrows pointing everywhere but on
    x.save();
    x.beginPath(); x.moveTo(104, 92); x.lineTo(160, 92); x.quadraticCurveTo(172, 92, 172, 104); x.lineTo(172, 136);
    x.quadraticCurveTo(172, 150, 158, 150); x.lineTo(106, 150); x.quadraticCurveTo(92, 150, 92, 136); x.lineTo(92, 104); x.quadraticCurveTo(92, 92, 104, 92); x.closePath();
    x.fillStyle = pat.asphalt; x.fill();
    x.fillStyle = "rgba(12,10,16,.42)"; x.fill();
    x.strokeStyle = "rgba(230,214,150,.38)"; x.lineWidth = 2; x.setLineDash([5, 4]); x.stroke(); x.setLineDash([]);
    x.restore();
    const paint = "rgba(236,230,214,.3)";
    arrow(x, 132, 97, 0, 14, paint); arrow(x, 100, 126, -110 * deg, 12, paint); arrow(x, 164, 122, 200 * deg, 12, paint);
    // the Dreamlayer Depths: a hole down to below everything
    gr = x.createRadialGradient(WELL.x, WELL.y, 2, WELL.x, WELL.y, WELL.r + 3);
    gr.addColorStop(0, "#000"); gr.addColorStop(0.55, "rgba(10,6,30,.95)"); gr.addColorStop(1, "rgba(40,30,80,.25)");
    x.fillStyle = gr; x.beginPath(); x.arc(WELL.x, WELL.y, WELL.r + 3, 0, Math.PI * 2); x.fill();
    x.strokeStyle = "rgba(170,150,255,.35)"; x.lineWidth = 1; x.beginPath(); x.arc(WELL.x, WELL.y, WELL.r + 3.5, 0, Math.PI * 2); x.stroke();
    // where things get left, and the town sign, painted between the slingshots
    for (const [sx, sy] of BANK) { x.fillStyle = "rgba(236,230,214,.13)"; for (let k = -3; k <= 3; k++) { x.fillRect(sx + k, sy + k, 1, 1); x.fillRect(sx + k, sy - k, 1, 1); } }
    x.fillStyle = "#15222e"; x.fillRect(94, 338, 60, 22);
    x.strokeStyle = "#51606e"; x.lineWidth = 1; x.strokeRect(94.5, 338.5, 59, 21);
    text(x, "ROTVILLE", 124 - textW("ROTVILLE") / 2, 342, 1, "#e6ddc3"); text(x, "POP. ???", 124 - textW("POP. ???") / 2, 351, 1, "#e6ddc3");
    // the inlanes point down to the flippers; the outlanes to the canal
    for (const lx of INLANES) arrow(x, lx, 314, 90 * deg, 12, "rgba(236,230,214,.22)");
    for (const lx of OUTLANES) arrow(x, lx, 314, 90 * deg, 12, "rgba(255,120,100,.28)");
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
    rail(x, ORBIT_L, 3); rail(x, ORBIT_R, 3); rail(x, BEND_L, 3); rail(x, BEND_R, 3);
    rail(x, [[241, 492], [241, 113]], 4);
    rail(x, [[32.5, 300], [32.5, 372], [75.6, 402.8]], 4);
    rail(x, [[217, 300], [217, 372], [173.4, 402.2]], 4);
    x.strokeStyle = "#8c8a86"; x.lineWidth = 2; x.beginPath(); x.moveTo(GATE.ax, GATE.ay); x.lineTo(GATE.bx, GATE.by); x.stroke();
    for (const [fx, fy] of [[262, 180], [262, 260], [262, 340], [262, 420], [8, 180], [8, 330], [8, 400], [241, 180], [241, 260], [241, 340], [241, 420]]) {
      x.fillStyle = "#2a150d"; x.fillRect(fx - 4, fy - 2, 8, 5);
      x.fillStyle = "#9a5832"; x.fillRect(fx - 3, fy - 1, 6, 2);
    }
    // the posts between R, O and T: bolts
    for (const px of LANE_POSTS) {
      x.fillStyle = "#1c1a1e"; x.fillRect(px - 2, 60, 4, 22);
      x.fillStyle = "#8a8490"; x.fillRect(px - 1, 61, 2, 20);
      x.fillStyle = "#c9c3cc"; x.fillRect(px - 1, 61, 1, 20);
    }
    for (const p of POSTS) {
      x.fillStyle = "#121012"; x.beginPath(); x.arc(p.x, p.y, p.r + 1, 0, Math.PI * 2); x.fill();
      x.fillStyle = "#3a3438"; x.beginPath(); x.arc(p.x - 0.5, p.y - 0.5, p.r - 1, 0, Math.PI * 2); x.fill();
    }
    // Holloring's drain, and the three pipe ends Gil Lister comes out of
    for (const hl of HOLES) {
      if (hl.id === "scoop") continue;
      if (hl.pipe) {
        x.fillStyle = "#2a150d"; x.beginPath(); x.arc(hl.x, hl.y, 7, 0, Math.PI * 2); x.fill();
        x.fillStyle = "#8a4a2c"; x.beginPath(); x.arc(hl.x, hl.y, 6, 0, Math.PI * 2); x.fill();
        x.fillStyle = "#050305"; x.beginPath(); x.arc(hl.x, hl.y, 4, 0, Math.PI * 2); x.fill();
        x.fillStyle = "#c47a4e"; x.fillRect(hl.x - 5, hl.y - 5, 2, 2);
      } else {
        x.fillStyle = "rgba(210,120,150,.45)"; x.beginPath(); x.ellipse(hl.x, hl.y, 8, 6, 0, 0, Math.PI * 2); x.fill();
        x.fillStyle = "#070307"; x.beginPath(); x.ellipse(hl.x, hl.y, 5.5, 4, 0, 0, Math.PI * 2); x.fill();
      }
    }
    return c;
  }
  // the ramps, drawn once, over the floor: the hill is an old pipe run on stilts, the culvert a brick channel
  function makeRamps() {
    const [c, x] = off(W, H);
    const band = (t, w, fill, edge, hi) => {
      x.lineCap = "round"; x.lineJoin = "round";
      x.save(); x.translate(3, 5); polyPath(x, t.pts); x.strokeStyle = "rgba(0,0,0,.35)"; x.lineWidth = w + 2; x.stroke(); x.restore();
      polyPath(x, t.pts); x.strokeStyle = edge; x.lineWidth = w + 2; x.stroke();
      polyPath(x, t.pts); x.strokeStyle = fill; x.lineWidth = w; x.stroke();
      x.save(); x.translate(-1, -1); polyPath(x, t.pts); x.strokeStyle = hi; x.lineWidth = 1; x.stroke(); x.restore();
    };
    band(RAMPS.hill.up, 13, "rgba(96,52,34,.86)", "#2a150d", "rgba(210,140,90,.8)");
    band(RAMPS.culvert.up, 13, pat.brick, "#1c1216", "rgba(230,190,160,.55)");
    x.lineCap = "round"; polyPath(x, RAMPS.culvert.up.pts); x.strokeStyle = "rgba(40,20,20,.45)"; x.lineWidth = 13; x.stroke();
    // the wires back down: two thin rods
    for (const t of [RAMPS.culvert.right, RAMPS.culvert.wrong]) {
      for (const o of [-2.5, 2.5]) { x.save(); x.translate(o * 0.8, o * 0.25); polyPath(x, t.pts); x.strokeStyle = "#8c8a86"; x.lineWidth = 1; x.stroke(); x.restore(); }
    }
    // the mouths: a funnel of plate, as wide as the shot at the floor and as wide as the ramp where it climbs
    for (const k in RAMPS) {
      const [x0, x1, y] = RAMPS[k].mouth, [cx] = along(RAMPS[k].up, 0), top = y - 12;
      x.beginPath(); x.moveTo(x0, y + 2); x.lineTo(x1, y + 2); x.lineTo(cx + 7, top); x.lineTo(cx - 7, top); x.closePath();
      x.fillStyle = "rgba(60,54,62,.9)"; x.fill();
      x.strokeStyle = "#1c1216"; x.lineWidth = 1; x.stroke();
      x.fillStyle = "#b8b0a8"; x.fillRect(x0 + 1, y + 1, x1 - x0 - 2, 1);
      for (let i = 1; i < 4; i++) { const u = i / 4, yy = y + 2 - 14 * u; x.fillStyle = "rgba(200,190,180,.25)"; x.fillRect(x0 + (cx - 7 - x0) * u + 1, Math.round(yy), (x1 - x0) - ((x1 - x0) - 14) * u - 2, 1); }
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
    // the cards: how to play, and what it costs
    const card = (x0, lines) => {
      x.fillStyle = "#e8dfc6"; x.fillRect(x0, 454, 66, 23);
      x.fillStyle = "rgba(90,60,40,.18)"; x.fillRect(x0, 454, 66, 2);
      lines.forEach((s, i) => text(x, s, x0 + 33 - Math.floor(textW(s) / 2), 457 + i * 7, 1, i ? "#3a2c24" : "#8a2e1c"));
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
  const ORDERS = [["FAROL IV ORDERS", "EAT THE BANK"], ["FAROL IV ORDERS", "KNEEL OR IGNORE"], ["FAROL IV ORDERS", "GO UP THE HILL"], ["FAROL IV ORDERS", "SAY HELLO BACK"]];
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
      const cyc = Math.floor(clock / 2.6) % 6;
      [big, small] = [["OLD SEWERWORKS", "PINBALL"], ["BEST", fmt(best)], ORDERS[Math.floor(clock / 15.6) % ORDERS.length], ["1 PLAY 1 CENT", "PRESS PLAY"], ["NO THOUGHTS", "TODAY"], ["POPULATION", "???"]][cyc];
    } else {
      big = fmt(score);
    }
    const bw = textW(big, 2);
    if (bw > DMD.w - 4 && !m) text(g, big, Math.round(DMD.x + (DMD.w - textW(big)) / 2), DMD.y + 7, 1, lit);
    else text(g, big, bx !== null ? bx : Math.round(DMD.x + (DMD.w - bw) / 2), DMD.y + 3, 2, lit);
    if (small) text(g, small, Math.round(DMD.x + (DMD.w - textW(small)) / 2), DMD.y + 18, 1, lit);
    else if (!m && state !== "ready") {
      text(g, "BALL " + ballNo, DMD.x + 3, DMD.y + 18, 1, lit);
      if (mult > 1) text(g, "x" + mult, DMD.x + DMD.w - 3 - textW("x" + mult), DMD.y + 18, 1, lit);
      if (saveT > 0 && (saveT > 2 || Math.floor(clock * 6) % 2)) text(g, "SAVE", Math.round(DMD.x + (DMD.w - textW("SAVE")) / 2), DMD.y + 18, 1, lit);
    }
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
  function upArrow(x, y, on, col, dim) {
    g.fillStyle = on ? col : dim;
    g.beginPath(); g.moveTo(x, y - 6); g.lineTo(x + 5, y + 1); g.lineTo(x + 2, y + 1); g.lineTo(x + 2, y + 5); g.lineTo(x - 2, y + 5); g.lineTo(x - 2, y + 1); g.lineTo(x - 5, y + 1); g.closePath(); g.fill();
    if (on) { g.globalCompositeOperation = "lighter"; g.fillStyle = col.replace("rgb", "rgba").replace(")", ",.2)"); g.fillRect(x - 8, y - 9, 16, 17); g.globalCompositeOperation = "source-over"; }
  }
  function drawInserts() {
    // R, O and T; the skill shot's lane blinks while he waits
    for (let i = 0; i < 3; i++) {
      const blink = skillLive && i === skill && Math.floor(clock * 5) % 2;
      const on = lit[i] || blink || (rotFlash > 0 && Math.floor(rotFlash * 10) % 2);
      g.fillStyle = on ? "#ffcf5a" : "#3a2a18"; g.fillRect(LANES[i] - 5, 82, 11, 9);
      if (on) { g.globalCompositeOperation = "lighter"; g.fillStyle = "rgba(255,190,80,.25)"; g.fillRect(LANES[i] - 8, 79, 17, 15); g.globalCompositeOperation = "source-over"; }
      text(g, "ROT"[i], LANES[i] - 1, 84, 1, on ? "#3a1a08" : "#8a6a3a");
    }
    // the shots: an arrow at each; the lit one blinks, and one just made flashes
    const blinkOn = Math.floor(clock * 4) % 2;
    for (const k in SHOTS) {
      if (k === "depths") continue;
      const [x, y] = SHOTS[k].lamp, on = (hot === k && blinkOn) || shotFlash[k] > 0;
      upArrow(x, y, on, "rgb(120,255,170)", "#16301f");
    }
    // the Depths: a ring of lamps that runs round when it is the lit shot, and all of them when he comes up out of it
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2 + clock * 0.4, x = WELL.x + Math.cos(a) * (WELL.r + 6), y = WELL.y + Math.sin(a) * (WELL.r + 6);
      const on = shotFlash.depths > 0 || (hot === "depths" && (Math.floor(clock * 12) % 12) === i) || (ball.hold && ball.hold.hl === WELL);
      lamp(x, y, 1.6, on, "rgb(190,170,255)", "#241a44");
    }
    // what he eats is worth: x2 to x5
    for (let k = 2; k <= 5; k++) {
      const x = 97 + (k - 2) * 18, y = 322;
      lamp(x, y, 5, mult >= k, "rgb(120,230,255)", "#123240");
      text(g, k + "x", x - 3, y - 2, 1, mult >= k ? "#062030" : "#3f6f80");
    }
    // the kickbacks: an arrow up each outlane while lit
    OUTLANES.forEach((x, i) => { upArrow(x, 364, kicks[i] && !tilted, kickFlash[i] > 0 ? "rgb(255,255,255)" : "rgb(157,255,138)", "#1c3a1c"); });
    // the ball save
    const sv = saveT > 0 && (saveT > 2 || Math.floor(clock * 8) % 2);
    lamp(124, 398, 5, sv, "rgb(255,120,190)", "#3a1428");
    text(g, "SAVE", 124 - textW("SAVE") / 2, 406, 1, sv ? "#ffc0e0" : "#6a3a52");
  }
  // the Depths turn slowly
  function drawDepths() {
    g.save(); g.beginPath(); g.arc(WELL.x, WELL.y, WELL.r, 0, Math.PI * 2); g.clip();
    g.strokeStyle = "rgba(150,130,255,.22)"; g.lineWidth = 1.5;
    for (let k = 0; k < 3; k++) {
      g.beginPath();
      for (let i = 0; i <= 24; i++) {
        const u = i / 24, a = k * 2.094 + u * 4.2 + clock * 1.3, r = WELL.r * (1 - u * 0.85);
        const px = WELL.x + Math.cos(a) * r, py = WELL.y + Math.sin(a) * r;
        if (i) g.lineTo(px, py); else g.moveTo(px, py);
      }
      g.stroke();
    }
    g.restore();
    g.fillStyle = "#000"; g.beginPath(); g.arc(WELL.x, WELL.y, 4, 0, Math.PI * 2); g.fill();
  }
  // the cover: on, it is iron with DO NOT LIFT on it; off, it is a hole and a cover leaning beside it
  function drawCover() {
    const hl = HOLES[1];
    if (!coverOff) {
      g.fillStyle = "#1c1820"; g.beginPath(); g.arc(hl.x, hl.y, 9, 0, Math.PI * 2); g.fill();
      g.fillStyle = pat.iron; g.beginPath(); g.arc(hl.x, hl.y, 8, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "rgba(0,0,0,.45)"; g.lineWidth = 1;
      for (let k = -6; k <= 6; k += 3) { g.beginPath(); g.moveTo(hl.x - 7, hl.y + k); g.lineTo(hl.x + 7, hl.y + k); g.stroke(); }
    } else {
      g.fillStyle = "#050305"; g.beginPath(); g.arc(hl.x, hl.y, 7, 0, Math.PI * 2); g.fill();
      glow(hl.x, hl.y, 12, "rgba(255,210,120," + (0.25 + 0.15 * Math.sin(clock * 6)).toFixed(2) + ")");
      g.fillStyle = pat.iron; g.beginPath(); g.ellipse(hl.x - 15, hl.y - 2, 3, 8, 0.2, 0, Math.PI * 2); g.fill();
    }
    text(g, "DO NOT LIFT", hl.x - textW("DO NOT LIFT") / 2, hl.y + 11, 1, coverOff ? "rgba(255,210,120,.8)" : "rgba(236,230,214,.45)");
  }
  function drawSpinner() {
    // the town sign's counter: a plate on a bar across the left orbit, spinning
    const y = SPIN_Y, h = Math.abs(Math.cos(spinner.rev * Math.PI)) * 4 + 0.6;
    g.fillStyle = "#2a2230"; g.fillRect(9, y - 0.5, 21, 1);
    g.fillStyle = "#15222e"; g.fillRect(11, Math.round(y - h / 2), 17, Math.max(1, Math.round(h)));
    if (h > 3) text(g, "???", 14, y - 2, 1, "#e6ddc3");
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
  function glow(x, y, r, col) {
    g.globalCompositeOperation = "lighter";
    const gr = g.createRadialGradient(x, y, 2, x, y, r);
    gr.addColorStop(0, col); gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
    g.globalCompositeOperation = "source-over";
  }
  function shadow(x, y, rx, ry) { g.fillStyle = "rgba(0,0,0,.4)"; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill(); }
  const ballName = () => "ball_" + mw.h + "_" + mw.k;

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
    drawDepths();
    drawInserts();
    drawCover();
    drawSpinner();
    SLINGS.forEach((s, i) => {
      if (slingFlash[i] <= 0) return;
      g.globalCompositeOperation = "lighter"; g.fillStyle = "rgba(255,200,90,.35)";
      g.beginPath(); g.moveTo(...s.a); g.lineTo(...s.b); g.lineTo(...s.c); g.closePath(); g.fill();
      g.globalCompositeOperation = "source-over";
    });
    for (const s of SLINGS) { g.strokeStyle = "#141014"; g.lineWidth = 4; g.lineCap = "round"; g.beginPath(); g.moveTo(...s.a); g.lineTo(...s.c); g.stroke(); g.strokeStyle = "#4a4248"; g.lineWidth = 1; g.beginPath(); g.moveTo(s.a[0] + 1, s.a[1]); g.lineTo(s.c[0] + 1, s.c[1] - 1); g.stroke(); }
    for (const f of flips) drawFlipper(f);
    // shadows, then everything standing on the floor, the far side first
    for (const c of CONES) shadow(c.x + 2, c.y + 2, 10, 5);
    for (const f of FELTS) shadow(f.x + 2, f.y + 2, 7, 3);
    for (const k of ["snore", "wish", "cyril", "shoe", "holl"]) shadow(FOLK[k].x + 2, FOLK[k].y + 2, FOLK[k].r, 3);
    shadow(cart.x + 2, CART.y + 4, 14, 4);
    for (const j of bank) if (!j.gone && j.dy > -8) shadow(j.x + 2, j.y + 3, JUNK[j.kind].r, 3);
    const kept = ball.hold ? ball.hold.hl : null;
    const onFloor = ball.live && !ball.ramp && !(kept && (kept.id === "holl" || kept.pipe || kept.id === "depths" || kept.id === "scoop"));
    if (onFloor && !kept) shadow(ball.x + 2, ball.y + 4, 6, 3);
    const things = [];
    for (const c of CONES) things.push([c.y, () => { if (c.flash > 0) glow(c.x, c.y, 18, "rgba(255,150,60,.55)"); blit(g, "cone_" + c.face, c.x, c.y + c.dy); }]);
    for (const f of FELTS) things.push([f.y, () => { if (f.flash > 0) glow(f.x, f.y, 14, "rgba(255,240,200,.4)"); blit(g, f.s + "_" + f.face, f.x, f.y + f.dy); }]);
    things.push([FOLK.snore.y, () => blit(g, "snore_" + (folk.snore.nod ? "n" : "0"), FOLK.snore.x, FOLK.snore.y)]);
    things.push([FOLK.wish.y, () => blit(g, "wish_0", FOLK.wish.x, FOLK.wish.y)]);
    things.push([FOLK.cyril.y, () => blit(g, "cyril_" + folk.cyril.face, FOLK.cyril.x, FOLK.cyril.y)]);
    things.push([FOLK.shoe.y, () => blit(g, "shoe_" + (folk.shoe.grip > 0 ? "g" : "0"), FOLK.shoe.x, FOLK.shoe.y)]);
    // Holloring: whatever he has taken in shows through him
    things.push([FOLK.holl.y, () => {
      if (!(kept && kept.id === "holl")) { blit(g, "holl_" + folk.holl.tip, FOLK.holl.x, FOLK.holl.y); return; }
      blit(g, ballName(), FOLK.holl.x, FOLK.holl.y - 7);
      blit(g, "holl_" + folk.holl.tip, FOLK.holl.x, FOLK.holl.y, 0.72);
    }]);
    things.push([CART.y, () => blit(g, "esc_" + (cart.dir > 0 ? "r" : "l"), cart.x, CART.y + 5)]);
    if (cart.crate && !cart.crate.gone) things.push([CART.y - 1, () => blit(g, "crate", cart.crate.x, cart.crate.y)]);
    for (const j of bank) if (!j.gone) things.push([j.y, () => blit(g, j.kind, j.x, j.y + j.dy)]);
    // Gil Lister, rising out of his pipe: what is still inside it is not drawn
    if (gil.pipe && gil.up > 0) {
      const p = gil.pipe;
      things.push([p.y, () => {
        g.save(); g.beginPath(); g.rect(p.x - 14, p.y - 30, 28, 31); g.clip();
        blit(g, "gil_" + gil.face, p.x, p.y + Math.round((1 - gil.up) * 16) + 1);
        g.restore();
      }]);
    }
    // the Flitter, in the right orbit, until startled
    const fo = flitter.off > 0 ? clamp(Math.min(flitter.t, flitter.off) / 0.25, 0, 1) : 0;
    things.push([FLIT_Y, () => blit(g, "flit_" + (fo > 0 ? flitter.face : "0"), 230 + fo * (flitter.face === "l" ? -12 : 10), FLIT_Y + 4)]);
    if (onFloor) things.push([ball.y, () => blit(g, ballName(), ball.x, ball.y)]);
    things.sort((a, b) => a[0] - b[0]).forEach(t => t[1]());
    // the ramps over the floor, and him on one
    g.drawImage(ramps, 0, 0);
    // Conelie at the top of the culvert, pointing
    blit(g, "cone_" + diverter.face, 210, 92);
    if (ball.live && ball.ramp) { shadow(ball.x + 4, ball.y + 7, 6, 3); blit(g, ballName(), ball.x, ball.y); }
    // the plunger: a rod and a spring, drawn back as far as it is held
    const pf = Math.round(plunger.drawn);
    g.fillStyle = "#2a2226"; g.fillRect(LANE.x - 7, pf, 14, 3);
    g.fillStyle = "#b8b0a8"; g.fillRect(LANE.x - 6, pf, 12, 2);
    g.fillStyle = "#6a6266"; g.fillRect(LANE.x - 1, pf + 3, 2, H - pf);
    g.strokeStyle = "#8a8084"; g.lineWidth = 1;
    for (let y = pf + 5; y < H; y += 3) { g.beginPath(); g.moveTo(LANE.x - 5, y); g.lineTo(LANE.x + 5, y + 1.5); g.stroke(); }
    // Old Parp, in the canal, honking up when he goes in
    g.save(); g.beginPath(); g.rect(CANAL.x0, CANAL.y, CANAL.x1 - CANAL.x0, H - CANAL.y); g.clip();
    blit(g, folk.parp.honk > 0 ? "parp_h" : "parp_0", 146, 486 - Math.round(folk.parp.honk * 8));
    g.restore();
    g.drawImage(apron, 0, 0);
    // on the apron: Sikat mopping, Nickelpig after a cent, and now and then Tata, watching
    blit(g, "sikat_" + (apronFolk.sikat.dir > 0 ? "r" : "l"), apronFolk.sikat.x, 452);
    g.fillStyle = "#d8b040"; g.fillRect(228, 449, 3, 2);
    blit(g, "nick_r" + apronFolk.nick.k, 214 + Math.sin(clock * 0.3), 452);
    if (apronFolk.tata) blit(g, "tata_0", 184, 452);
    // bits of what he ate, paper from the list, water, and what things were worth
    for (const b of bits) { g.fillStyle = b.col; g.globalAlpha = clamp((b.life - b.t) / 0.25, 0, 1); g.fillRect(Math.round(b.x), Math.round(b.y), 2, 2); }
    for (const p of papers) { g.fillStyle = "#e8e2d0"; g.globalAlpha = clamp((p.life - p.t) / 0.4, 0, 1); g.fillRect(Math.round(p.x), Math.round(p.y), 2, 1 + (Math.floor(p.t * 8 + p.a) % 2)); }
    g.globalAlpha = 1;
    // what Snoreacle mutters, which nobody has stayed awake long enough to translate
    for (const z of zs) {
      if (z.t < 0) continue;
      const u = z.t / 1.8;
      g.globalAlpha = Math.max(0, 1 - u * u);
      text(g, "Z", Math.round(FOLK.snore.x + 6 + z.dx + 8 * u), Math.round(FOLK.snore.y - 16 - 16 * u), u < 0.5 ? 1 : 2, "#c8d2ff");
      g.globalAlpha = 1;
    }
    for (const p of pops) {
      g.globalAlpha = clamp(1.4 - p.t * 1.6, 0, 1);
      text(g, p.s, Math.round(p.x - textW(p.s) / 2), Math.round(p.y - 16 * p.t), 1, p.col);
    }
    g.globalAlpha = 1;
    // Misery Peter, floating over the rooftops
    shadow(peter.x + 3, peter.y + 40, 10, 3);
    blit(g, "peter_0", peter.x, peter.y);
    g.restore();
    drawDmd();
    // Farol IV beside the display, giving orders to no one
    glow(62, 18, 12, "rgba(255,220,120," + (0.22 + 0.1 * Math.sin(clock * 3)).toFixed(2) + ")");
    blit(g, "farol_0", 62, 32);
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
  const waiting = () => state === "play" && ball.live && ball.inLane && !ball.hold && ball.y > plunger.face - R - 3;
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
  const unpress = id => {
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
  screen.addEventListener("pointerup", e => unpress("p" + e.pointerId));
  screen.addEventListener("pointercancel", e => unpress("p" + e.pointerId));
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
    const up = e => { b.classList.remove("on"); unpress("b" + e.pointerId); };
    b.addEventListener("pointerup", up); b.addEventListener("pointercancel", up);
    b.addEventListener("contextmenu", e => e.preventDefault());
  }
  const LEFT = ["ArrowLeft", "KeyZ", "KeyA", "ShiftLeft"], RIGHT = ["ArrowRight", "KeyM", "KeyL", "Slash", "ShiftRight"];
  const PLUNGE = ["Space", "ArrowDown", "KeyS", "Enter"], NUDGE = ["ArrowUp", "KeyW", "KeyN"];
  const down = new Set();
  addEventListener("keydown", e => down.add(e.code), true);
  addEventListener("keyup", e => down.delete(e.code), true);
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
    const line2 = "Mawrice ate " + (total === 1 ? "one thing" : total + " things") + " in the Old Sewerworks and scored " + fmt(score) + " on rotville.world. Only what was in front of him.";
    if (navigator.share) {
      try { await navigator.share({ title: "Pinball", text: line2, url }); return; } catch (err) { if (err && err.name === "AbortError") return; }
    }
    try { await navigator.clipboard.writeText(line2 + " " + url); label.textContent = "Copied"; } catch (err) { label.textContent = "Could not copy"; }
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
      table = makeTable(); ramps = makeRamps(); apron = makeApron(); dmdGrid = makeDmdGrid();
      newBank(); loadCart();
      for (const j of bank) j.dy = 0;
      ball.live = true;
      hud();
      ready = true;
    })
    .catch(() => { $("sub").textContent = "The tape would not load. Try the page again."; });
  requestAnimationFrame(frame);
})();
