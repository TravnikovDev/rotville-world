/* Megabite - Snake the way his lore already writes it: "He turns in right angles and in nothing else. He eats
   the square things the town leaves lying about - tiles, keys, cubes, plugs, cartridges - and every meal adds
   another block to him. He gets longer. That is the whole of it, and nobody has seen him stop."
   He does not cross the town, he goes under it: the grid is the gutters, vents and cable routes, and every
   cell he passes is drawn onto "the one map nobody has drawn". Only pre-rendered sprites ship here. */
(() => {
  "use strict";

  // the ducts are 15 by 15 cells on a wide screen; on a phone held upright they are 11 wide and as tall as the
  // screen allows (layout()), so a cell stays big enough to see and to steer
  const CW = 20, CH = 16, TOP = 18;
  let COLS = 15, ROWS = 15, W = 0, H = 0, CELLS = 0;
  // assets/sprites.json: [x, y, w, h, anchor x, anchor y]; the anchor is the floor point under the piece.
  // block0-15 are six different blocks cut from his own column, each seen from the sides that read as one block
  const SPR = {"head_down":[1,1,14,28,7,18],"head_right":[16,1,26,17,13,13],"head_up":[43,1,14,28,7,18],"head_left":[58,1,26,16,13,13],"tile":[85,1,18,15,9,8],"key":[104,1,13,9,8,5],"cube":[118,1,12,15,6,10],"plug":[131,1,10,13,5,9],"cartridge":[142,1,16,13,8,7],"block0":[159,1,14,17,7,12],"block1":[174,1,14,18,7,13],"block2":[1,30,14,19,7,13],"block3":[16,30,14,16,7,11],"block4":[31,30,14,23,7,15],"block5":[46,30,14,24,7,16],"block6":[61,30,14,20,7,16],"block7":[76,30,14,25,7,16],"block8":[91,30,16,20,8,15],"block9":[108,30,14,22,7,16],"block10":[123,30,16,19,8,14],"block11":[140,30,14,22,7,16],"block12":[155,30,14,23,7,15],"block13":[170,30,14,23,7,15],"block14":[1,56,14,23,7,16],"block15":[16,56,14,19,7,16]};
  const LAMP = {"head_down":[3,-17],"head_right":[-10,-11],"head_up":[-4,-1],"head_left":[10,-6]};
  const BLOCKS = Object.keys(SPR).filter(k => k.startsWith("block"));
  const DIRS = {
    up: { x: 0, y: -1, s: "head_up" }, down: { x: 0, y: 1, s: "head_down" },
    left: { x: -1, y: 0, s: "head_left" }, right: { x: 1, y: 0, s: "head_right" },
  };
  const MEALS = ["tile", "key", "cube", "plug"];
  const PITCH = { tile: 520, key: 660, cube: 440, plug: 590, cartridge: 784 };
  const LIGHTS_AT = [[0.2, 0.2], [0.78, 0.34], [0.42, 0.74]];   // street grates overhead, as parts of the grid
  let LIGHTS = [];
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const $ = id => document.getElementById(id);
  const screen = $("screen"), cv = $("c"), g = cv.getContext("2d");
  const atlas = new Image();
  atlas.src = "assets/sprites.png";

  const store = {
    get(k, d) { try { const v = localStorage.getItem("megabite." + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem("megabite." + k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
  };
  const rng = seed => () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const fx = x => x * CW + CW / 2;          // the floor point of a cell
  const fy = y => TOP + y * CH + CH / 2;
  const rgb = (r, g2, b, a = 1) => `rgba(${r | 0},${g2 | 0},${b | 0},${a})`;

  /* ---------- the ducts: painted once a grid ---------- */
  const floor = document.createElement("canvas");
  function paintFloor() {
    const c = floor.getContext("2d"), r = rng(7);
    c.fillStyle = "#120e20";
    c.fillRect(0, 0, W, H);
    // the back wall of the duct, brick by brick
    for (let y = 0, row = 0; y < TOP - 2; y += 4, row++) {
      for (let x = (row % 2) * -6; x < W; x += 12) {
        const v = r() * 14;
        c.fillStyle = rgb(30 + v, 24 + v, 46 + v * 1.4);
        c.fillRect(x + 1, y + 1, 10, 3);
      }
    }
    c.fillStyle = "#07050e";
    c.fillRect(0, TOP - 2, W, 2);
    // cable routes along the wall
    [["#4a0d14", "#a4262f", TOP - 7], ["#16305e", "#3c68b8", TOP - 11], ["#5c4a10", "#b99a2c", TOP - 4]].forEach(([lo, hi, y0], k) => {
      for (let x = 0; x < W; x++) {
        const y = y0 + Math.round(Math.sin(x / (17 + k * 6) + k) * 1.3);
        c.fillStyle = lo; c.fillRect(x, y, 1, 2);
        c.fillStyle = hi; c.fillRect(x, y, 1, 1);
      }
    });
    // the floor: one slab to a cell
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const X = x * CW, Y = TOP + y * CH, v = r();
        c.fillStyle = rgb(34 + v * 10, 28 + v * 8, 50 + v * 12);
        c.fillRect(X, Y, CW, CH);
        c.fillStyle = "rgba(255,255,255,.045)";
        c.fillRect(X + 1, Y + 1, CW - 2, 1);
        c.fillStyle = "rgba(0,0,0,.4)";
        c.fillRect(X, Y, CW, 1);
        c.fillRect(X, Y, 1, CH);
        for (let k = 0; k < 5; k++) {
          c.fillStyle = r() < 0.55 ? "rgba(0,0,0,.2)" : "rgba(255,255,255,.05)";
          c.fillRect(X + ((r() * (CW - 2)) | 0) + 1, Y + ((r() * (CH - 2)) | 0) + 1, 1, 1);
        }
      }
    }
    // vents
    for (let k = 0, n = Math.round(CELLS / 22); k < n; k++) {
      const X = ((r() * COLS) | 0) * CW, Y = TOP + ((r() * ROWS) | 0) * CH;
      c.fillStyle = "#0d0a17";
      c.fillRect(X + 3, Y + 3, CW - 6, CH - 6);
      c.fillStyle = "#3b3552";
      for (let s = Y + 4; s < Y + CH - 4; s += 2) c.fillRect(X + 4, s, CW - 8, 1);
    }
    // puddles
    for (let k = 0; k < 4; k++) {
      const x = 20 + r() * (W - 40), y = TOP + 16 + r() * (ROWS * CH - 32), w = 10 + r() * 14;
      c.fillStyle = "rgba(80,110,190,.13)";
      c.beginPath(); c.ellipse(x, y, w, w * 0.35, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = "rgba(170,200,255,.18)";
      c.fillRect((x - w * 0.4) | 0, (y - 1) | 0, (w * 0.5) | 0, 1);
    }
    // where the town's light comes down through the street grates
    for (const L of LIGHTS) {
      const x = fx(L.x), y = fy(L.y), gr = c.createRadialGradient(x, y, 1, x, y, 30);
      gr.addColorStop(0, "rgba(255,200,95,.26)");
      gr.addColorStop(1, "rgba(255,200,95,0)");
      c.fillStyle = gr;
      c.fillRect(x - 30, y - 30, 60, 60);
    }
    // the dark gathers at the edges
    const R = Math.max(W, H), v = c.createRadialGradient(W / 2, H / 2, R * 0.2, W / 2, H / 2, R * 0.72);
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(1, "rgba(0,0,0,.5)");
    c.fillStyle = v;
    c.fillRect(0, 0, W, H);
  }

  /* ---------- the map nobody has drawn: each cell he passes ---------- */
  const map = document.createElement("canvas");
  const mc = map.getContext("2d");

  function setGrid(cols, rows) {
    if (cols === COLS && rows === ROWS && W) return;
    COLS = cols; ROWS = rows;
    W = COLS * CW; H = TOP + ROWS * CH + 6; CELLS = COLS * ROWS;
    cv.width = floor.width = map.width = W;
    cv.height = floor.height = map.height = H;
    g.imageSmoothingEnabled = false;
    LIGHTS = LIGHTS_AT.map(([a, b]) => ({ x: Math.round(a * (COLS - 1)), y: Math.round(b * (ROWS - 1)) }));
    screen.style.aspectRatio = W + " / " + H;
    paintFloor();
  }

  // a phone held upright gets a tall grid that fills what the screen leaves free; everything else gets 15 x 15
  const upright = matchMedia("(max-width: 599px) and (orientation: portrait)");
  function layout() {
    if (!upright.matches) { setGrid(15, 15); return; }
    const scale = screen.clientWidth / (11 * CW);
    const shown = [...document.querySelector(".mb-main").children].filter(el => el.offsetParent !== null);
    const bottom = Math.max(...shown.map(el => el.getBoundingClientRect().bottom)) + scrollY;
    const others = bottom - screen.clientHeight + 10;
    const room = (window.visualViewport ? visualViewport.height : innerHeight) - others;
    setGrid(11, Math.max(12, Math.min(20, Math.floor((room / scale - TOP - 6) / CH))));
  }
  let drawn, drawnCount;
  const draw1 = (x, y) => {
    if (drawn[y * COLS + x]) return;
    drawn[y * COLS + x] = 1;
    drawnCount++;
    const X = x * CW, Y = TOP + y * CH;
    mc.fillStyle = "rgba(120,215,255,.06)";
    mc.fillRect(X + 1, Y + 1, CW - 1, CH - 1);
    mc.fillStyle = "rgba(150,230,255,.42)";
    mc.fillRect(X + 1, Y + 1, 3, 1); mc.fillRect(X + 1, Y + 1, 1, 3);
    mc.fillRect(X + CW - 3, Y + 1, 3, 1); mc.fillRect(X + CW - 1, Y + 1, 1, 3);
    mc.fillRect(X + 1, Y + CH - 1, 3, 1); mc.fillRect(X + 1, Y + CH - 3, 1, 3);
    mc.fillRect(X + CW - 3, Y + CH - 1, 3, 1); mc.fillRect(X + CW - 1, Y + CH - 3, 1, 3);
  };

  /* ---------- sound: the bed, his two lines, and the rest made on the spot ---------- */
  const audio = {
    ctx: null, on: store.get("sound", true), raw: {}, buf: {}, music: null, wantMusic: false,
    fetch() {
      for (const [k, f] of [["start", "assets/line-start.mp3"], ["stop", "assets/line-stop.mp3"], ["music", "assets/dream-circuit.mp3"]]) {
        this.raw[k] = fetch(f).then(r => r.arrayBuffer()).catch(() => null);
      }
    },
    unlock() {
      if (this.ctx) { this.ctx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch (e) { /* older Safari */ }
      const c = (this.ctx = new AC());
      c.resume();
      this.out = c.createGain(); this.out.gain.value = this.on ? 1 : 0; this.out.connect(c.destination);
      this.fxg = c.createGain(); this.fxg.gain.value = 0.5; this.fxg.connect(this.out);
      this.mus = c.createGain(); this.mus.gain.value = 0.3; this.mus.connect(this.out);
      this.vox = c.createGain(); this.vox.gain.value = 1; this.vox.connect(this.out);
      const n = c.createBuffer(1, c.sampleRate, c.sampleRate), d = n.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = n;
      for (const k of Object.keys(this.raw)) {
        this.buf[k] = this.raw[k]
          .then(b => (b ? new Promise((ok, no) => c.decodeAudioData(b, ok, no)) : null))
          .catch(() => null);
      }
      this.buf.music.then(b => { if (b && this.wantMusic) this.startMusic(); });
    },
    startMusic() {
      this.wantMusic = true;
      if (!this.ctx || this.music) return;
      this.buf.music.then(b => {
        if (!b || this.music) return;
        const s = this.ctx.createBufferSource();
        s.buffer = b; s.loop = true; s.connect(this.mus); s.start();
        this.music = s;
      });
    },
    set(on) {
      this.on = on;
      store.set("sound", on);
      if (this.out) this.out.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.04);
    },
    // one of his narrator lines, with the bed ducked under it; resolves to its length in seconds
    line(k) {
      if (!this.ctx) return Promise.resolve(0);
      return this.buf[k].then(b => {
        if (!b) return 0;
        const s = this.ctx.createBufferSource(), t = this.ctx.currentTime;
        s.buffer = b; s.connect(this.vox); s.start();
        this.mus.gain.setTargetAtTime(0.1, t, 0.06);
        this.mus.gain.setTargetAtTime(0.3, t + b.duration, 0.4);
        return b.duration;
      });
    },
    tone(f0, f1, dur, type = "square", vol = 0.12, when = 0) {
      if (!this.ctx) return;
      const c = this.ctx, t = c.currentTime + when, o = c.createOscillator(), e = c.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
      e.gain.setValueAtTime(vol, t);
      e.gain.exponentialRampToValueAtTime(0.0008, t + dur);
      o.connect(e).connect(this.fxg);
      o.start(t); o.stop(t + dur + 0.03);
    },
    noise(dur, vol, lo, hi, when = 0) {
      if (!this.ctx) return;
      const c = this.ctx, t = c.currentTime + when, s = c.createBufferSource(), a = c.createBiquadFilter(), b = c.createBiquadFilter(), e = c.createGain();
      s.buffer = this.noiseBuf; s.loop = true;
      a.type = "highpass"; a.frequency.value = lo;
      b.type = "lowpass"; b.frequency.value = hi;
      e.gain.setValueAtTime(vol, t);
      e.gain.exponentialRampToValueAtTime(0.0008, t + dur);
      s.connect(a).connect(b).connect(e).connect(this.fxg);
      s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.03);
    },
    eat(k) {                       // a plug going home
      const f = PITCH[k] || 520;
      this.noise(0.018, 0.4, 2500, 9000);
      this.tone(f * 2, f, 0.09, "square", 0.11);
      this.tone(f * 3, f * 1.5, 0.05, "sawtooth", 0.05, 0.02);
    },
    bonus() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, f * 1.01, 0.07, "square", 0.09, i * 0.06)); },
    appear() { this.tone(1568, 1568, 0.04, "square", 0.05); this.tone(2093, 2093, 0.04, "square", 0.05, 0.08); },
    turn() { this.noise(0.006, 0.07, 3000, 8000); },
    crash() { this.noise(1.1, 0.35, 180, 7000); this.tone(220, 50, 0.5, "sawtooth", 0.1); },
  };
  audio.fetch();

  /* ---------- the game ---------- */
  let state = "ready";            // ready, play, pause, over
  let segs, from, dir, hdir, queue, grow, food, bonus, meals, tick, acc, clock;
  let shake = 0, ateAt = -1e9, popAt = -1e9, overAt = 0, sparks = [], saidStart = false, looks = [];
  // every block he grows is one of his own, and never the same one twice in a row
  const pick = () => {
    const last = looks[looks.length - 1];
    let k;
    do { k = BLOCKS[(Math.random() * BLOCKS.length) | 0]; } while (k === last && BLOCKS.length > 1);
    return k;
  };
  let best = store.get("best", 0), bestMap = store.get("bestMap", 0);

  const free = () => {
    const taken = new Set(segs.map(s => s.y * COLS + s.x));
    if (food) taken.add(food.y * COLS + food.x);
    if (bonus) taken.add(bonus.y * COLS + bonus.x);
    const out = [];
    for (let i = 0; i < CELLS; i++) if (!taken.has(i)) out.push({ x: i % COLS, y: (i / COLS) | 0 });
    return out;
  };
  const place = (k, now) => {
    const f = free(), h = segs[0];
    if (!f.length) return null;
    const far = f.filter(c => Math.abs(c.x - h.x) + Math.abs(c.y - h.y) > 3);
    const c = (far.length ? far : f)[(Math.random() * (far.length || f.length)) | 0];
    return { x: c.x, y: c.y, k, born: now };
  };

  function reset(now) {
    const sx = Math.max(2, Math.floor(COLS * 0.3)), sy = Math.floor(ROWS / 2);
    segs = [{ x: sx, y: sy }, { x: sx - 1, y: sy }, { x: sx - 2, y: sy }];
    looks = [null, pick(), pick()];
    from = segs.map(s => ({ ...s }));
    dir = hdir = DIRS.right;
    queue = [];
    grow = 0; meals = 0; tick = 150; acc = 0; clock = 0;
    bonus = null; food = null; sparks = [];
    drawn = new Uint8Array(CELLS); drawnCount = 0;
    mc.clearRect(0, 0, W, H);
    segs.forEach(s => draw1(s.x, s.y));
    food = place(MEALS[(Math.random() * MEALS.length) | 0], now);
    hud();
  }

  function hud() {
    const n = segs.length;
    $("len").textContent = n + (n === 1 ? " BLOCK" : " BLOCKS");
    $("best").textContent = "Longest " + best;
    $("map").textContent = "Map drawn " + Math.round((drawnCount / CELLS) * 100) + "%";
  }

  function step(now) {
    if (queue.length) {
      const d = queue.shift();
      if (d !== dir && !(d.x === -dir.x && d.y === -dir.y)) { dir = d; audio.turn(); }
    }
    const h = segs[0], nx = h.x + dir.x, ny = h.y + dir.y;
    const tailGoes = grow === 0;
    const bites = segs.some((s, i) => s.x === nx && s.y === ny && !(tailGoes && i === segs.length - 1));
    if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS || bites) return end(now, false);
    const old = segs.map(s => ({ ...s }));
    segs.unshift({ x: nx, y: ny });
    hdir = dir;
    if (grow > 0) { grow--; old.push({ ...old[old.length - 1] }); looks.push(pick()); popAt = now; } else segs.pop();
    from = old;
    draw1(nx, ny);
    let ate = null;
    if (food && food.x === nx && food.y === ny) {
      ate = food; grow += 1; meals++;
      food = place(MEALS[(Math.random() * MEALS.length) | 0], now);
      if (meals % 5 === 0 && !bonus) {
        bonus = place("cartridge", now);
        if (bonus) { bonus.until = clock + 6500; audio.appear(); }
      }
    } else if (bonus && bonus.x === nx && bonus.y === ny) {
      ate = bonus; grow += 3; bonus = null; audio.bonus();
    }
    if (ate) {
      if (ate.k !== "cartridge") audio.eat(ate.k);
      ateAt = now; shake = Math.max(shake, 1.6);
      tick = Math.max(66, 150 - meals * 3.4);
      for (let i = 0; i < 12; i++) {
        const a = Math.random() * Math.PI * 2, v = 0.03 + Math.random() * 0.06;
        sparks.push({ x: fx(nx) + dir.x * 7, y: fy(ny) - 8, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 0.05, t: now, life: 260 + Math.random() * 260,
          c: ["#c9f6ff", "#ffffff", "#ffd966", "#7fd8ff"][i % 4] });
      }
      const L = $("len");
      L.classList.remove("bump"); void L.offsetWidth; L.classList.add("bump");
      setTimeout(() => L.classList.remove("bump"), 140);
    }
    if (!food && !bonus && !free().length) return end(now, true);
    hud();
  }

  function end(now, filled) {
    state = "over";
    swipeHint(false);
    overAt = now;
    shake = filled ? 0 : 4;
    const n = segs.length, pct = Math.round((drawnCount / CELLS) * 100);
    const record = n > best;
    best = Math.max(best, n); bestMap = Math.max(bestMap, pct);
    store.set("best", best); store.set("bestMap", bestMap);
    hud();
    if (!filled) audio.crash();
    $("over-title").textContent = filled ? "The ducts ran out of corners." : "Nobody has seen him stop.";
    $("over-line").textContent = filled
      ? "What he does when a street runs out of corners is not on any map."
      : "He was " + n + " blocks long when the picture went.";
    $("over-stats").textContent = "Map drawn " + pct + "% · " + (record ? "the longest yet" : "longest " + best);
    setTimeout(() => {
      if (state !== "over") return;
      if (!reduce) $("static").classList.add("on");
      const p = $("pausemark");
      p.textContent = "NO SIGNAL"; p.hidden = false;
      if (!filled) say("stop", "Nobody has seen him stop.");
    }, 380);
    setTimeout(() => {
      if (state !== "over") return;
      $("static").classList.remove("on");
      $("pausemark").hidden = true;
      $("over").hidden = false;
      $("again").focus({ preventScroll: true });
    }, 1700);
  }

  function say(k, text) {
    const sub = $("sub");
    sub.textContent = text;
    audio.line(k).then(d => setTimeout(() => { if (sub.textContent === text) sub.textContent = ""; }, Math.max(1800, d * 1000 + 350)));
  }

  function start() {
    audio.unlock();
    audio.startMusic();
    layout();
    reset(performance.now());
    state = "play";
    $("ready").hidden = true; $("over").hidden = true; $("pausemark").hidden = true;
    $("static").classList.remove("on");
    if (!saidStart) { saidStart = true; say("start", "He gets longer. That is the whole of it."); }
    swipeHint(true);
  }

  // on a touch screen, how to turn him - until the first swipe, which the phone remembers
  const coarse = matchMedia("(pointer: coarse)");
  let hintTimer = 0;
  function swipeHint(on) {
    const h = $("swipehint");
    clearTimeout(hintTimer);
    if (on && coarse.matches && !store.get("swiped", false)) {
      h.hidden = false;
      hintTimer = setTimeout(() => { h.hidden = true; }, 3600);
    } else h.hidden = true;
  }

  function pause(on) {
    if (on && state === "play") {
      state = "pause";
      const p = $("pausemark"); p.textContent = "PAUSE ▮▮"; p.hidden = false;
      if (audio.ctx) audio.ctx.suspend();
    } else if (!on && state === "pause") {
      state = "play";
      $("pausemark").hidden = true;
      audio.unlock();
    }
  }

  function want(name) {
    if (state === "ready") start();            // the first turn starts him, and counts
    if (state === "pause") { pause(false); return; }
    if (state !== "play") return;
    const d = DIRS[name], last = queue.length ? queue[queue.length - 1] : dir;
    if (d === last || (d.x === -last.x && d.y === -last.y) || queue.length >= 2) return;
    queue.push(d);
  }

  /* ---------- drawing ---------- */
  const spr = (k, x, y) => {
    const s = SPR[k];
    g.drawImage(atlas, s[0], s[1], s[2], s[3], Math.round(x - s[4]), Math.round(y - s[5]), s[2], s[3]);
  };
  const shadow = (x, y, w, h, a = 0.34) => {
    g.fillStyle = `rgba(0,0,0,${a})`;
    g.beginPath(); g.ellipse(x, y, w, h, 0, 0, Math.PI * 2); g.fill();
  };
  // the red cable between two blocks, laid pixel by pixel so it stays crisp when the screen is scaled up
  const cable = (a, b, sag, lo, hi) => {
    const ya = a.y - 7, yb = b.y - 7, mx = (a.x + b.x) / 2, my = (ya + yb) / 2 + sag;
    for (let s = 0; s <= 14; s++) {
      const u = s / 14, v = 1 - u;
      const x = v * v * a.x + 2 * v * u * mx + u * u * b.x, y = v * v * ya + 2 * v * u * my + u * u * yb;
      g.fillStyle = lo; g.fillRect(x | 0, y | 0, 1, 2);
      g.fillStyle = hi; g.fillRect(x | 0, y | 0, 1, 1);
    }
  };

  function item(it, now, isBonus) {
    const x = fx(it.x), y = fy(it.y);
    const drop = now - it.born < 240 ? -Math.round(10 * (1 - (now - it.born) / 240) ** 2) : 0;
    const bob = reduce ? 0 : Math.round(Math.sin(now / 260 + it.x * 1.7) * 1);
    // a little light on the floor where it lies, so it reads on a phone
    const pulse = reduce ? 0.5 : 0.5 + 0.5 * Math.sin(now / 300 + it.x);
    const halo = g.createRadialGradient(x, y, 0, x, y, 12);
    halo.addColorStop(0, isBonus ? `rgba(255,95,210,${0.34 + 0.22 * pulse})` : `rgba(140,225,255,${0.16 + 0.14 * pulse})`);
    halo.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = halo;
    g.fillRect(x - 12, y - 12, 24, 24);
    shadow(x, y + 2, 6, 2, 0.3);
    if (isBonus && it.until - clock < 1600 && Math.floor(now / 110) % 2) return;
    spr(it.k, x, y - 2 + bob + drop);
    if (((now / 90 + it.x * 7 + it.y * 3) % 44) < 1.3) {
      g.fillStyle = "#fff"; g.fillRect(x - 3, y - 9 + bob, 1, 1);
    }
  }

  function beams(now) {
    for (const [k, L] of LIGHTS.entries()) {
      const x = fx(L.x), y = fy(L.y), flick = reduce ? 1 : 0.85 + 0.15 * Math.sin(now / 90 + k * 2) * Math.sin(now / 37 + k);
      const gr = g.createLinearGradient(0, TOP, 0, y);
      gr.addColorStop(0, `rgba(255,205,110,${0.09 * flick})`);
      gr.addColorStop(1, `rgba(255,205,110,${0.02 * flick})`);
      g.fillStyle = gr;
      g.fillRect(x - 7, TOP, 14, y - TOP);
      if (reduce) continue;
      for (let m = 0; m < 4; m++) {
        const mx = x - 6 + ((m * 37 + now / 110) % 12), my = TOP + ((now / (38 + m * 9) + m * 47) % Math.max(1, y - TOP));
        g.fillStyle = "rgba(255,225,160,.55)";
        g.fillRect(mx | 0, my | 0, 1, 1);
      }
    }
  }

  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(100, now - last);
    last = now;
    if (state === "play") {
      acc += dt; clock += dt;
      while (acc >= tick && state === "play") { acc -= tick; step(now); }
      if (bonus && clock > bonus.until) bonus = null;
    }
    render(now, dt);
  }

  function render(now, dt) {
    const t = state === "play" ? Math.min(1, acc / tick) : 1;
    g.save();
    if (shake > 0.2 && !reduce) {
      g.translate(Math.round((Math.random() - 0.5) * shake * 2), Math.round((Math.random() - 0.5) * shake * 2));
      shake *= 0.84;
    }
    g.drawImage(floor, 0, 0);
    g.drawImage(map, 0, 0);
    beams(now);
    if (!segs) { g.restore(); return; }

    const P = segs.map((s, i) => {
      const f = from[i] || s;
      return { x: fx(f.x + (s.x - f.x) * t), y: fy(f.y + (s.y - f.y) * t) };
    });
    const moving = state === "play";
    for (const p of P) shadow(p.x, p.y + 1, 7, 2.6);
    for (let i = 1; i < P.length; i++) {
      const sway = moving && !reduce ? Math.sin(now / 210 + i) * 0.8 : 0;
      cable(P[i - 1], P[i], 5 + sway, "#3e080d", "#8e1f28");
      cable(P[i - 1], P[i], 2.5 - sway * 0.5, "#5e1016", "#c8343e");
    }
    const list = [];
    if (food) list.push({ y: fy(food.y), d: () => item(food, now, false) });
    if (bonus) list.push({ y: fy(bonus.y), d: () => item(bonus, now, true) });
    P.forEach((p, i) => list.push({ y: p.y + (i === 0 ? 0.5 : 0), d: () => (i === 0 ? head(p, now) : block(p, i, P.length, now)) }));
    list.sort((a, b) => a.y - b.y);
    for (const o of list) o.d();

    // sparks
    sparks = sparks.filter(s => now - s.t < s.life);
    for (const s of sparks) {
      s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 0.00022 * dt;
      g.fillStyle = s.c;
      g.fillRect(s.x | 0, s.y | 0, 1, 1);
    }
    g.restore();
  }

  function block(p, i, n, now) {
    let dy = state === "play" && !reduce ? Math.round(Math.sin(now / 140 - i * 0.8) * 0.6) : 0;
    if (i === n - 1 && now - popAt < 200) dy -= Math.round(8 * (1 - (now - popAt) / 200) ** 2);
    spr(looks[i] || BLOCKS[0], p.x, p.y + dy);
  }

  function head(p, now) {
    if (state === "over" && now - overAt < 420 && Math.floor(now / 70) % 2) return;
    const lunge = now - ateAt < 110 ? 1 : 0;
    const x = p.x + hdir.x * lunge, y = p.y + hdir.y * lunge - (state === "play" && !reduce && Math.floor(now / 300) % 2 ? 1 : 0);
    spr(hdir.s, x, y);
    // the red light on his crown
    const l = LAMP[hdir.s];
    if (!l) return;
    const on = reduce || Math.floor(now / 520) % 3 !== 2;
    const lx = x + l[0], ly = y + l[1];
    if (on) {
      g.save();
      g.globalCompositeOperation = "lighter";
      const gr = g.createRadialGradient(lx, ly, 0, lx, ly, 7);
      gr.addColorStop(0, "rgba(255,70,60,.55)");
      gr.addColorStop(1, "rgba(255,70,60,0)");
      g.fillStyle = gr;
      g.fillRect(lx - 7, ly - 7, 14, 14);
      g.restore();
      g.fillStyle = "#ff8a80";
      g.fillRect(lx | 0, ly | 0, 1, 1);
    }
  }

  /* ---------- input ---------- */
  const KEYS = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right", KeyW: "up", KeyS: "down", KeyA: "left", KeyD: "right" };
  addEventListener("keydown", e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const d = KEYS[e.code];
    if (d) {
      if (state !== "over" || e.target === document.body) e.preventDefault();
      want(d);
    } else if (e.code === "Space" || e.code === "KeyP") {
      if (state === "play" || state === "pause") { e.preventDefault(); pause(state === "play"); }
      else if (state === "ready" && e.target === document.body) { e.preventDefault(); start(); }
    } else if (e.code === "Enter" && (state === "ready" || (state === "over" && !$("over").hidden)) && e.target === document.body) {
      e.preventDefault(); start();
    }
  });
  let touch = null;
  const area = document.querySelector(".mb-main");
  area.addEventListener("touchstart", e => {
    if (e.target.closest("button, a")) { touch = null; return; }
    const t = e.changedTouches[0];
    touch = { x: t.clientX, y: t.clientY };
  }, { passive: true });
  area.addEventListener("touchmove", e => {
    if (!touch) return;
    const t = e.changedTouches[0], dx = t.clientX - touch.x, dy = t.clientY - touch.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return;
    if (state === "play") {
      want(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up");
      if (!store.get("swiped", false)) { store.set("swiped", true); swipeHint(false); }
    }
    touch = { x: t.clientX, y: t.clientY };
  }, { passive: true });
  area.addEventListener("touchend", () => { touch = null; }, { passive: true });
  screen.addEventListener("click", e => { if (state === "pause" && !e.target.closest("button")) pause(false); });
  $("pad").addEventListener("pointerdown", e => {
    const b = e.target.closest("button[data-d]");
    if (!b) return;
    e.preventDefault();
    want(b.dataset.d);
  });
  $("play").addEventListener("click", start);
  $("again").addEventListener("click", start);
  $("share").addEventListener("click", async () => {
    const n = segs ? segs.length : 0, url = "https://rotville.world/games/megabite/";
    const text = "Megabite got " + n + " blocks long under Rotville.";
    const label = $("share").querySelector(".tape-label");
    if (navigator.share) {
      try { await navigator.share({ title: "Megabite", text, url }); return; } catch (err) { if (err && err.name === "AbortError") return; }
    }
    try { await navigator.clipboard.writeText(text + " " + url); label.textContent = "Copied"; } catch (err) { label.textContent = "Could not copy"; }
    setTimeout(() => { label.textContent = "Share"; }, 1600);
  });
  const soundBtn = $("sound");
  const sayVolume = () => {
    soundBtn.setAttribute("aria-pressed", String(audio.on));
    soundBtn.setAttribute("aria-label", audio.on ? "Sound on" : "Sound off");
    soundBtn.querySelector(".tape-label").textContent = upright.matches ? (audio.on ? "♪ On" : "♪ Off") : audio.on ? "Sound: on" : "Sound: off";
  };
  soundBtn.addEventListener("click", () => { audio.unlock(); audio.set(!audio.on); sayVolume(); });
  sayVolume();
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { pause(true); if (audio.ctx) audio.ctx.suspend(); }
  });

  // the grid follows the screen between games; a game in progress keeps its own
  let relayout = 0;
  const onResize = () => {
    cancelAnimationFrame(relayout);
    relayout = requestAnimationFrame(() => {
      sayVolume();
      if (state === "ready" || state === "over") { const c = COLS, r = ROWS; layout(); if (c !== COLS || r !== ROWS) reset(performance.now()); }
    });
  };
  addEventListener("resize", onResize);
  if (window.visualViewport) visualViewport.addEventListener("resize", onResize);

  layout();
  reset(performance.now());
  atlas.decode ? atlas.decode().catch(() => {}).then(() => requestAnimationFrame(frame)) : (atlas.onload = () => requestAnimationFrame(frame));
})();
