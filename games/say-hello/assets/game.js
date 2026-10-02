/* Say Hello: Gil Lister pops out to say hello, and here somebody says it back.

   Gil Lister (LORE) is a cheerful segmented worm with tiny arms and a very large smile, who lives inside the pipes and
   can take any bend. "He pops out to say hello. This is the only greeting in the sewer system and it is not
   reciprocated." Here it is: tap him while he is out, and you have said it back. If he goes back in without one, that
   hello went unanswered, and three of those end it. Shytan ("shy, not dangerous. Do not make eye contact.") comes up
   too, hidden under his umbrella; he tips it back to look round, and goes again. Tapping him counts as a miss. The pipes
   lose their caps one by one, and Gil comes and goes faster the longer it lasts.

   Both are rigid figurines: coming up is the whole model rising out of the pipe, his wiggle is the whole model rocked,
   Shytan looking round is the whole model turned, all drawn at 15 fps under the 60 fps page like the clips' residents
   (R819, R1070). Only pre-rendered sprites and the PS1 tiles ship. */
(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  const W = 270, H = 480;
  const cv = $("c"), g = cv.getContext("2d");
  g.imageSmoothingEnabled = false;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const store = {
    get(k, d) { try { const v = localStorage.getItem("sayhello." + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem("sayhello." + k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
  };
  const load = src => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });
  const off = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d"); x.imageSmoothingEnabled = false; return [c, x]; };
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[Math.floor(Math.random() * a.length)];

  const RESIDENT_STEP = 1 / 15;
  const WALL = 112;                                        // the back wall comes down to here, and the floor starts
  const COLS = [48, 135, 222], ROWS = [170, 256, 342, 428]; // the middle of each pipe's mouth
  const KEYS = ["Digit1", "Digit2", "Digit3", "KeyQ", "KeyW", "KeyE", "KeyA", "KeyS", "KeyD", "KeyZ", "KeyX", "KeyC"];
  const START_OPEN = [1, 3, 8, 10];                        // the pipes open at the start; the rest wear caps
  const OPEN_EVERY = 6;                                    // a cap comes off this often until all twelve are open
  const MISSES = 3;
  const RISE = 0.2, SINK = 0.2;
  // HOW HARD IT IS, by seconds played: Gil stays out for less and comes back sooner, and Shytan comes more often.
  // Past a minute and a half it keeps going, slowly, until he is out for less time than anyone can answer in
  const hard = t => Math.min(1, t / 90);
  const upFor = t => Math.max(0.12, 1.5 - 1.05 * hard(t) - 0.004 * Math.max(0, t - 90));
  const gapFor = t => 0.7 - 0.55 * hard(t);
  const riseFor = t => Math.max(0.1, RISE - 0.06 * hard(t) - 0.0006 * Math.max(0, t - 90));   // and he comes up and goes down quicker
  const SHY_FROM = 9;
  const shyGap = t => rnd(3.5, 6) - 2.4 * hard(t);
  const shyUp = t => 2.0 - 0.5 * hard(t);

  /* ---------- sound: the bed, four lines, the rest made on the spot ---------- */
  const audio = {
    ctx: null, on: store.get("sound", true), raw: {}, buf: {}, music: null,
    fetch() {
      for (const [k, f] of [["start", "assets/line-start.mp3"], ["miss", "assets/line-miss.mp3"], ["shy", "assets/line-shy.mp3"],
                            ["end", "assets/line-end.mp3"], ["music", "assets/wind-up.mp3"]]) {
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
    plop() { this.noise(0.05, 0.05, 300, 1600); this.tone(170, 420, 0.08, "sine", 0.12); },
    hello() { this.tone(660, 700, 0.07, "triangle", 0.16); this.tone(880, 950, 0.12, "triangle", 0.16, 0.08); },   // his: two notes up
    back() { this.tone(523, 530, 0.08, "sine", 0.18); this.tone(784, 790, 0.16, "sine", 0.18, 0.09); },          // yours: the same, rounder
    sink() { this.tone(420, 160, 0.12, "sine", 0.05); },
    eep() { this.tone(1300, 700, 0.12, "square", 0.05); this.noise(0.08, 0.04, 2000, 6000); },
    unanswered() { this.tone(330, 300, 0.25, "triangle", 0.1); this.tone(247, 220, 0.4, "triangle", 0.1, 0.2); },
    clank() { this.noise(0.18, 0.08, 1500, 7000); this.tone(190, 120, 0.2, "square", 0.04); this.tone(1400, 1320, 0.3, "sine", 0.03, 0.01); },
  };
  audio.fetch();

  /* ---------- the chamber ---------- */
  let SC, atlas, wallImg, ready = false, pat = {};
  let drips = [], dripT = 0.8;
  let state = "ready";                     // ready, play, stopped, pause, over
  let clock = 0, playT = 0, endT = 0, nextOpen = OPEN_EVERY, acc = 0;
  let pipes = [], caps = [], bubbles = [], gil, shy;
  let said = 0, misses = 0, best = store.get("best", 0), saidStart = false, saidMiss = false, saidShy = false;

  const actor = who => ({ who, pipe: -1, last: -1, phase: "wait", t: 0, wait: 0, up: 0, riseFor: RISE, sinkFor: SINK, h: 0, replied: false, tapped: false, wig: 0, shown: { h: 0, pose: who === "gil" ? "gil_0" : "shy_hide" } });

  function hud() {
    $("hellos").textContent = said + " SAID BACK";
    $("misses").textContent = "●".repeat(MISSES - misses) + "○".repeat(misses);
    $("misses").setAttribute("aria-label", "Unanswered hellos left: " + (MISSES - misses) + " of " + MISSES);
    $("best").textContent = "Most said back " + best;
  }

  function reset() {
    playT = 0; endT = 0; nextOpen = OPEN_EVERY; said = 0; misses = 0;
    caps = []; bubbles = [];
    pipes = [];
    for (let r = 0; r < ROWS.length; r++) for (let c = 0; c < COLS.length; c++) {
      const k = r * COLS.length + c;
      pipes.push({ k, x: COLS[c], y: ROWS[r], open: START_OPEN.includes(k) });
    }
    gil = actor("gil"); gil.wait = 1.0;                  // he comes up as the narrator says he does
    shy = actor("shy"); shy.wait = 0.5;
    hud();
  }

  function start() {
    audio.unlock();
    reset();
    state = "play";
    $("ready").hidden = true; $("over").hidden = true;
    $("static").classList.remove("on");
    if (!saidStart) { saidStart = true; say("start", "Gil Lister pops out to say hello."); }
  }

  function say(k, text) {
    const sub = $("sub");
    sub.textContent = text;
    audio.line(k).then(d => setTimeout(() => { if (sub.textContent === text) sub.textContent = ""; }, Math.max(1800, d * 1000 + 300)));
  }

  function openPipes() { return pipes.filter(p => p.open); }
  // the next pipe: an open one that is not the one just used, and not the one the other is in
  function choosePipe(a) {
    const other = a === gil ? shy : gil;
    const free = openPipes().filter(p => p.k !== a.last && p.k !== other.pipe);
    return free.length ? pick(free).k : -1;
  }

  function popUp(a) {
    const k = choosePipe(a);
    if (k < 0) { a.wait = 0.3; a.t = 0; return; }
    a.pipe = k; a.phase = "rise"; a.t = 0; a.h = 0; a.replied = false; a.tapped = false; a.wig = 0; a.riseFor = riseFor(playT);
    a.up = a === gil ? upFor(playT) : shyUp(playT);
    if (state === "play") audio.plop();
  }
  function sinkDown(a, dur) { a.phase = "sink"; a.t = 0; a.sinkFor = dur; if (state === "play") audio.sink(); }

  function update(dt) {
    clock += dt;
    // a drop gathers at the outflow's mouth, falls into the gutter and rings out
    dripT -= dt;
    if (dripT <= 0) { dripT = rnd(0.8, 1.6); drips.push({ t: 0, y: 0, v: 0, land: -1 }); }
    for (const d of drips) {
      d.t += dt;
      if (d.t < 0.35) continue;
      if (d.land < 0) { d.v += 320 * dt; d.y += d.v * dt; if (SC.wall.outflow[1] + 3 + d.y >= WALL + 4) d.land = 0; }
      else d.land += dt;
    }
    drips = drips.filter(d => d.land < 0.4);
    for (const b of bubbles) b.t += dt;
    bubbles = bubbles.filter(b => b.t < b.dur);
    for (const c of caps) c.t += dt;
    caps = caps.filter(c => c.t < 0.5);
    if (state === "ready") { step(gil, dt, true); return; }
    if (state === "stopped") { endT += dt; settle(gil, dt); settle(shy, dt); if (endT > 1.2) end(); return; }
    if (state !== "play") return;
    playT += dt;
    // a cap comes off, and one more pipe is open
    if (playT >= nextOpen) {
      nextOpen += OPEN_EVERY;
      const shut = pipes.filter(p => !p.open);
      if (shut.length) { const p = pick(shut); p.open = true; caps.push({ x: p.x, y: p.y, t: 0 }); audio.clank(); }
    }
    step(gil, dt, false);
    if (playT >= SHY_FROM) step(shy, dt, false);
  }

  // one of them, one moment on: waiting in the pipes, coming up, out, or going back down
  function step(a, dt, demo) {
    a.t += dt;
    if (a.phase === "wait") {
      if (a.t >= a.wait) popUp(a);
    } else if (a.phase === "rise") {
      a.h = Math.min(1, a.t / a.riseFor);
      if (a.t >= a.riseFor) {
        a.phase = "up"; a.t = 0; a.h = 1;
        if (a === gil) { bubbles.push({ kind: "hello", k: a.pipe, t: 0, dur: a.up + 0.15 }); if (!demo) audio.hello(); }
      }
    } else if (a.phase === "up") {
      if (a.tapped) return;
      if (a.replied) { if (a.t >= 0.45) sinkDown(a, 0.14); }
      else if (a.t >= (demo ? 1.2 : a.up)) sinkDown(a, a.riseFor);
    } else if (a.phase === "sink") {
      a.h = Math.max(0, 1 - a.t / a.sinkFor);
      if (a.t >= a.sinkFor) {
        const k = a.pipe;
        a.phase = "wait"; a.t = 0; a.h = 0; a.last = k; a.pipe = -1;
        if (a === gil) {
          bubbles = bubbles.filter(b => !(b.kind === "hello" && b.k === k));
          a.wait = demo ? 1.4 : gapFor(playT);
          if (!a.replied && !demo) unanswered(k);
        } else a.wait = Math.max(1.2, shyGap(playT));
      }
    }
  }

  // at the end, whoever is out goes back in, and nobody comes up again
  function settle(a, dt) {
    if (a.phase === "rise" || a.phase === "up") { a.phase = "sink"; a.t = 0; a.sinkFor = SINK; }
    if (a.phase !== "sink") return;
    a.t += dt;
    a.h = Math.max(0, 1 - a.t / a.sinkFor);
    if (a.t >= a.sinkFor) { a.phase = "wait"; a.t = 0; a.h = 0; a.wait = 1e9; a.pipe = -1; bubbles = bubbles.filter(b => b.kind !== "hello"); }
  }

  // Gil went back in and nobody said it back
  function unanswered(k) {
    misses += 1;
    bubbles.push({ kind: "dots", k, t: 0, dur: 0.9 });
    audio.unanswered();
    hud();
    if (!saidMiss && misses < MISSES) { saidMiss = true; say("miss", "It was not reciprocated."); }
    if (misses >= MISSES) { state = "stopped"; endT = 0; }
  }

  // a tap on a pipe, or its key: whoever is out of it
  function tapPipe(k) {
    if (state !== "play" || k < 0) return;
    if (gil.pipe === k && gil.phase !== "wait" && gil.h > 0.35 && !gil.replied) {
      gil.replied = true; said += 1;
      if (gil.phase === "up") gil.t = 0;
      if (said > best) { best = said; store.set("best", best); }
      bubbles.push({ kind: "back", k, t: 0, dur: 0.75 });
      audio.back(); bumpHud(); hud();
      return;
    }
    if (shy.pipe === k && shy.phase !== "wait" && shy.h > 0.35 && !shy.tapped) {
      shy.tapped = true; sinkDown(shy, 0.12);
      bubbles.push({ kind: "eep", k, t: 0, dur: 0.6 });
      audio.eep();
      misses += 1; hud();
      if (!saidShy && misses < MISSES) { saidShy = true; say("shy", "Do not make eye contact."); }
      if (misses >= MISSES) { state = "stopped"; endT = 0; }
    }
  }
  function bumpHud() { const el = $("hellos"); el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump"); setTimeout(() => el.classList.remove("bump"), 160); }

  function end() {
    state = "over";
    $("over-title").textContent = "Gil Lister went back in.";
    $("over-line").textContent = said === 0 ? "Nobody said it back." : said === 1 ? "You said it back once." : "You said it back " + said + " times.";
    $("over-stats").textContent = said > 0 && said === best ? "The most you have said it back" : "Most said back " + best;
    hud();
    say("end", "He will keep saying it.");
    setTimeout(() => { if (state === "over") { $("over").hidden = false; $("again").focus({ preventScroll: true }); } }, 1500);
  }

  /* ---------- drawing ---------- */
  function blit(key, gx, gy) {
    const s = SC.sprites[key];
    if (!s) return;
    g.drawImage(atlas, s[0], s[1], s[2], s[3], Math.round(gx - s[4]), Math.round(gy - s[5]), s[2], s[3]);
  }
  // a little pixel font for the speech bubbles, three by five
  const FONT = {
    H: ["X.X", "X.X", "XXX", "X.X", "X.X"], E: ["XXX", "X..", "XX.", "X..", "XXX"], L: ["X..", "X..", "X..", "X..", "XXX"],
    O: ["XXX", "X.X", "X.X", "X.X", "XXX"], "!": [".X.", ".X.", ".X.", "...", ".X."], ".": ["...", "...", "...", "...", ".X."],
  };
  const INK = {
    hello: { fill: "#fff6ea", edge: "#2a1a14", ink: "#6b3a26" },     // his, in his colours
    back: { fill: "#1b1634", edge: "#e9b08c", ink: "#ffffff" },      // yours, in the set's
    dots: { fill: "#c9ccd4", edge: "#2a2a33", ink: "#4a4e5a" },
    eep: { fill: "#ffffff", edge: "#6e1c14", ink: "#e2503f" },
  };
  // a speech bubble whose tail ends at (tx, ty); the body sits above it, shifted by dx
  function bubble(str, tx, ty, dx, style, alpha) {
    const k = 2, tw = (str.length * 4 - 1) * k, pw = tw + 8, ph = 5 * k + 8;
    const x0 = Math.round(tx + dx - pw / 2), y0 = Math.round(ty - 5 - ph);
    g.globalAlpha = alpha;
    g.fillStyle = style.edge;
    g.fillRect(x0 + 1, y0, pw - 2, ph); g.fillRect(x0, y0 + 1, pw, ph - 2);
    g.fillRect(Math.round(tx) - 2, y0 + ph - 1, 5, 3); g.fillRect(Math.round(tx) - 1, y0 + ph + 2, 3, 2); g.fillRect(Math.round(tx), y0 + ph + 4, 1, 1);
    g.fillStyle = style.fill;
    g.fillRect(x0 + 1, y0 + 1, pw - 2, ph - 2);
    g.fillRect(Math.round(tx) - 1, y0 + ph - 1, 3, 2); g.fillRect(Math.round(tx), y0 + ph + 1, 1, 2);
    g.fillStyle = style.ink;
    for (let i = 0; i < str.length; i++) {
      const rows = FONT[str[i]];
      if (!rows) continue;
      for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) if (rows[r][c] === "X") g.fillRect(x0 + 4 + (i * 4 + c) * k, y0 + 4 + r * k, k, k);
    }
    g.globalAlpha = 1;
  }

  function drawPipe(p) {
    const m = SC.mouth, hole = m.hole, x = p.x, y = p.y;
    g.fillStyle = "rgba(0,0,0,.34)";
    g.beginPath(); g.ellipse(x + 2, y + m.wall + 1, m.rim_rx + 5, m.rim_ry * 0.75, 0, 0, Math.PI * 2); g.fill();
    if (!p.open) { blit("pipe_capped", x, y); return; }
    blit("pipe_open", x, y);
    const a = gil.pipe === p.k ? gil : shy.pipe === p.k ? shy : null;
    if (a && a.shown.h > 0) {
      const s = SC.sprites[a.shown.pose], dy = Math.round((1 - a.shown.h) * (s[5] + 2));
      g.save();
      // above the mouth, all of them shows; below it, only what the hole lets through
      g.beginPath();
      g.rect(0, 0, W, y);
      g.ellipse(x + hole.cx, y + hole.cy, hole.rx, hole.ry, 0, 0, Math.PI * 2);
      g.clip();
      blit(a.shown.pose, x, y + dy);
      // and what is down in the pipe is in the dark
      const gr = g.createLinearGradient(0, y, 0, y + hole.cy + hole.ry);
      gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(1, "rgba(0,0,0,.92)");
      g.fillStyle = gr; g.fillRect(x - hole.rx - 1, y, hole.rx * 2 + 2, hole.cy + hole.ry + 1);
      g.restore();
    }
    blit("pipe_front", x, y);
  }

  function draw() {
    // the back wall: brick, darker toward the top, with a shadow along its foot
    // (hello_wall.py: the culvert with its gate, the vent, the lamp, the pipe run and the valve, from the game's camera)
    g.drawImage(wallImg, 0, 0);
    let gr = g.createLinearGradient(0, 0, 0, WALL);
    gr.addColorStop(0, "rgba(8,6,20,.62)"); gr.addColorStop(1, "rgba(8,6,20,.26)");
    g.fillStyle = gr; g.fillRect(0, 0, W, WALL);
    // the lamp's light on the bricks, not quite steady
    const L = SC.wall.lamp, dip = Math.floor(clock * 7) % 19 === 0 ? 0.1 : 0;
    const glow = Math.max(0, 0.26 + 0.05 * Math.sin(clock * 11) + 0.03 * Math.sin(clock * 23.7) - dip);
    g.globalCompositeOperation = "lighter";
    gr = g.createRadialGradient(L[0], L[1], 2, L[0], L[1], 46);
    gr.addColorStop(0, "rgba(255,196,120," + glow.toFixed(3) + ")"); gr.addColorStop(1, "rgba(255,196,120,0)");
    g.fillStyle = gr; g.fillRect(L[0] - 46, L[1] - 46, 92, 92);
    g.globalCompositeOperation = "source-over";
    // the floor, and the dark of the corners
    g.fillStyle = pat.floor; g.fillRect(0, WALL, W, H - WALL);
    g.fillStyle = "rgba(14,14,26,.44)"; g.fillRect(0, WALL, W, H - WALL);
    // the gutter along the foot of the wall, the water in it going along, and the outflow dripping into it
    g.fillStyle = "rgba(0,0,6,.5)"; g.fillRect(0, WALL, W, 9);
    pat.water.setTransform(new DOMMatrix().translate((clock * 9) % 32, WALL));
    g.globalAlpha = 0.85; g.fillStyle = pat.water; g.fillRect(0, WALL + 2, W, 6); g.globalAlpha = 1;
    g.fillStyle = "rgba(150,180,230,.3)"; g.fillRect(0, WALL + 2, W, 1);
    g.fillStyle = "rgba(170,190,230,.25)"; g.fillRect(0, WALL + 8, W, 1);
    const O = SC.wall.outflow, ox = Math.round(O[0]), oy = Math.round(O[1] + 3);
    for (const d of drips) {
      g.fillStyle = "rgba(223,234,255,.95)";
      if (d.t < 0.35) g.fillRect(ox, oy, 1, d.t > 0.2 ? 2 : 1);
      else if (d.land < 0) g.fillRect(ox, Math.round(oy + d.y), 1, 2);
      else {
        const u = d.land / 0.4;
        g.strokeStyle = "rgba(223,234,255," + (0.85 * (1 - u)).toFixed(2) + ")"; g.lineWidth = 1;
        g.beginPath(); g.ellipse(ox + 0.5, WALL + 4.5, 1 + 7 * u, 0.6 + 1.8 * u, 0, 0, Math.PI * 2); g.stroke();
      }
    }
    gr = g.createLinearGradient(0, WALL, 0, WALL + 26);
    gr.addColorStop(0, "rgba(0,0,0,.55)"); gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr; g.fillRect(0, WALL, W, 26);
    g.fillStyle = "rgba(0,0,0,.35)"; g.fillRect(0, WALL - 2, W, 2);
    gr = g.createRadialGradient(W / 2, H * 0.58, H * 0.25, W / 2, H * 0.58, H * 0.75);
    gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(1, "rgba(0,0,0,.45)");
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    // the pipes, the back row first
    for (const p of pipes) drawPipe(p);
    // caps coming off
    for (const c of caps) {
      const u = c.t / 0.5;
      g.globalAlpha = Math.max(0, 1 - u * u);
      blit("cap", c.x + 10 * u, c.y - 34 * u + 30 * u * u);
      g.globalAlpha = 1;
    }
    // what is said
    for (const b of bubbles) {
      const p = pipes[b.k];
      if (!p) continue;
      const fade = Math.min(1, (b.dur - b.t) / 0.15);
      if (b.kind === "hello") {
        if (gil.pipe !== b.k || gil.shown.h < 0.9) continue;
        bubble("HELLO", p.x + 6, p.y - 40, 14, INK.hello, fade);
      } else if (b.kind === "back") {
        bubble("HELLO", p.x + 18, p.y + 44 - 8 * (b.t / b.dur), -6, INK.back, fade);
      } else if (b.kind === "dots") {
        bubble("...", p.x, p.y - 6, 0, INK.dots, fade);
      } else if (b.kind === "eep") {
        bubble("!", p.x, p.y - 44 + 6 * (b.t / b.dur), 0, INK.eep, fade);
      }
    }
  }

  // what Gil and Shytan are drawn at: sampled 15 times a second
  function poseOf(a) {
    if (a.who === "gil") {
      if (a.phase === "up" && a.replied) { a.wig = (a.wig + 1) % 4; return a.wig < 2 ? "gil_l" : "gil_r"; }
      if (a.phase === "up" && a.t < 0.3) return "gil_hi";     // the hello: a lean toward you
      return "gil_0";
    }
    if (a.tapped || a.phase !== "up") return "shy_hide";
    if (a.t < 0.25 || a.t > a.up - 0.25) return "shy_hide";
    return ["shy_0", "shy_l", "shy_0", "shy_r"][Math.floor((a.t - 0.25) / 0.32) % 4];
  }
  function sample(dt) {
    acc += dt;
    if (acc < RESIDENT_STEP && !reduce) return;
    acc = reduce ? 0 : acc % RESIDENT_STEP;
    for (const a of [gil, shy]) { a.shown.h = a.phase === "wait" ? 0 : a.h; a.shown.pose = poseOf(a); }
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

  /* ---------- input: tap a pipe, or its key ---------- */
  const screen = $("screen");
  const toCanvas = e => { const b = cv.getBoundingClientRect(); return [(e.clientX - b.left) * W / b.width, (e.clientY - b.top) * H / b.height]; };
  // the pipe under a point: the pipe itself and the space above it where whoever comes up stands. The rows overlap a
  // little, and there the pipe with somebody out of it wins, then the nearer mouth
  function pipeAt(px, py) {
    let bestK = -1, bd = 1e9;
    for (const p of pipes) {
      if (Math.abs(px - p.x) > 43 || py < p.y - 68 || py > p.y + 44) continue;
      const out = (gil.pipe === p.k && gil.h > 0.35) || (shy.pipe === p.k && shy.h > 0.35);
      const d = Math.abs(py - (p.y - 12)) + (out ? 0 : 1000);
      if (d < bd) { bd = d; bestK = p.k; }
    }
    return bestK;
  }
  screen.addEventListener("pointerdown", e => {
    if (e.target.closest("button, a")) return;
    if (state === "pause") { pause(false); return; }
    if (state !== "play") return;
    e.preventDefault();
    const [px, py] = toCanvas(e);
    tapPipe(pipeAt(px, py));
  });
  addEventListener("keydown", e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const el = e.target instanceof Element ? e.target : null;
    if (el && el !== document.body && el.closest("button") && (e.code === "Space" || e.code === "Enter")) return;
    const k = KEYS.indexOf(e.code);
    if (k >= 0) {
      e.preventDefault();
      if (state === "pause") { pause(false); return; }
      if (!e.repeat) tapPipe(k);
    } else if ((e.code === "Space" || e.code === "Enter") && (state === "ready" || (state === "over" && !$("over").hidden))) {
      e.preventDefault(); start();
    } else if (e.code === "KeyP" || e.code === "Escape") {
      if (state === "play") pause(true); else if (state === "pause") pause(false);
    }
  });

  function pause(on) {
    if (on && state === "play") {
      state = "pause";
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
    const url = "https://rotville.world/games/say-hello/", label = $("share").querySelector(".tape-label");
    const text = said === 0 ? "Gil Lister said hello on rotville.world, and nobody said it back."
      : "I said hello back to Gil Lister " + (said === 1 ? "once" : said + " times") + " on rotville.world. He will keep saying it.";
    if (navigator.share) {
      try { await navigator.share({ title: "Say Hello", text, url }); return; } catch (err) { if (err && err.name === "AbortError") return; }
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

  Promise.all([fetch("assets/scene.json").then(r => r.json()), load("assets/sprites.png"), load("assets/tiles.png"), load("assets/wall.png")])
    .then(([s, a, t, wl]) => {
      SC = s; atlas = a; wallImg = wl;
      const tile = name => { const [c, x2] = off(32, 32); x2.drawImage(t, s.tiles[name] * 32, 0, 32, 32, 0, 0, 32, 32); return g.createPattern(c, "repeat"); };
      pat = { floor: tile("stone-block"), water: tile("water") };
      reset(); ready = true;
    })
    .catch(() => { $("sub").textContent = "The tape would not load. Try the page again."; });
  requestAnimationFrame(frame);
})();
