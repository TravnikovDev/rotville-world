/* Down the Drain: Holloring falls down a drain in the dark and keeps what he catches.

   Holloring (LORE 4.2) is a pink jelly drop with one eye. "He lives in the drains and the runoff tunnels and takes
   in whatever gets dropped, because he believes lost things are safer inside. Wait patiently and he lets one slide
   back out." You can see through him, so what he keeps is on screen: each thing he catches is drawn inside him.
   The drain is dark. A holler lights it for a moment, the echo running out along the walls, and then the echo comes
   back into him, since he keeps echoes too.

   The drain gets harder the deeper he goes: he falls faster, the pipes come closer and longer, grates narrow, his
   own glow shrinks and the echo takes longer to come back. A pipe knocks one of his things back out of him, and
   three knocks and he stops where he is. The score is how far down he got and how much he kept. The canal at the
   bottom, 500 m down, is there for whoever gets that far.

   He falls as one piece, leaning the way he steers (no squash, R770), and is drawn at 15 fps under the 60 fps page
   like the clips' residents (R819, R1070). Only pre-rendered sprites and the PS1 tiles ship. */
(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  const W = 270, H = 480;
  const cv = $("c"), g = cv.getContext("2d");
  g.imageSmoothingEnabled = false;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const store = {
    get(k, d) { try { const v = localStorage.getItem("drain." + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem("drain." + k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
  };
  const load = src => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });
  const off = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d"); x.imageSmoothingEnabled = false; return [c, x]; };

  const RESIDENT_STEP = 1 / 15;          // Holloring updates 15 times a second
  const WALL = 34;                       // the shaft's side walls, this wide on screen
  const PX_M = 73.5;                     // pixels to a metre: Holloring's 0.6 m is 44 px
  const CANAL = 500 * PX_M;              // the bottom, for whoever gets that far
  const KNOCKS = 3;                      // three knocks and he stops
  const R_HIT = 13;                      // his body, for pipes and for catching
  const ECHO_SPEED = 430, ECHO_LIFE = 1.8;
  // where what he keeps sits inside him: the wide lower half, clear of his eye
  const INSIDE = [[-7, 9], [6, 9], [0, 12], [-11, 14], [10, 14], [-4, 16], [5, 16], [-13, 18], [12, 18], [0, 19]];

  // HOW HARD IT IS, by depth in metres. Everything climbs to its worst by about 400 m and stays there.
  const hard = m => Math.min(1, m / 400);
  const fallSpeed = m => Math.min(340, 115 + 0.6 * m);                  // px/s: 115 at the top, 340 by 375 m
  const steer = m => Math.min(400, 230 + 0.45 * m);                       // he gets quicker across as he falls faster
  const hangY = m => 150 - 40 * Math.min(1, m / 300);                     // he rides higher as he speeds up, to see further
  const glowR = m => 44 - 16 * hard(m);                                   // his own light shrinks
  const cooldown = m => 0.9 + 0.35 * hard(m);                             // and the echo is longer coming back

  /* ---------- sound: the bed, three lines, the rest made on the spot ---------- */
  const audio = {
    ctx: null, on: store.get("sound", true), raw: {}, buf: {}, music: null,
    fetch() {
      for (const [k, f] of [["start", "assets/line-start.mp3"], ["slid", "assets/line-slid.mp3"], ["end", "assets/line-end.mp3"],
                            ["music", "assets/reverse-choir.mp3"]]) {
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
      this.mus = c.createGain(); this.mus.gain.value = 0.26; this.mus.connect(this.master);
      this.vox = c.createGain(); this.vox.gain.value = 1; this.vox.connect(this.master);
      // a real echo for the holler: a delay feeding back into itself through a dark filter
      this.dly = c.createDelay(1); this.dly.delayTime.value = 0.23;
      const fb = c.createGain(); fb.gain.value = 0.46; const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 1300;
      this.dly.connect(lp).connect(fb).connect(this.dly); lp.connect(this.fxg);
      const n = c.createBuffer(1, c.sampleRate, c.sampleRate), d = n.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = n;
      for (const k of Object.keys(this.raw)) {
        // a file that will not decode is left out quietly, whichever way this browser reports it
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
    tone(f0, f1, dur, type = "square", vol = 0.12, when = 0, echo = false) {
      if (!this.ctx) return;
      const c = this.ctx, t = c.currentTime + when, o = c.createOscillator(), e = c.createGain();
      o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
      e.gain.setValueAtTime(0.0008, t); e.gain.exponentialRampToValueAtTime(vol, t + 0.015); e.gain.exponentialRampToValueAtTime(0.0008, t + dur);
      o.connect(e).connect(this.fxg); if (echo) e.connect(this.dly); o.start(t); o.stop(t + dur + 0.03);
    },
    noise(dur, vol, lo, hi, when = 0) {
      if (!this.ctx) return;
      const c = this.ctx, t = c.currentTime + when, s = c.createBufferSource(), a = c.createBiquadFilter(), b = c.createBiquadFilter(), e = c.createGain();
      s.buffer = this.noiseBuf; s.loop = true; a.type = "highpass"; a.frequency.value = lo; b.type = "lowpass"; b.frequency.value = hi;
      e.gain.setValueAtTime(vol, t); e.gain.exponentialRampToValueAtTime(0.0008, t + dur);
      s.connect(a).connect(b).connect(e).connect(this.fxg); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.03);
    },
    holler() { this.tone(250, 380, 0.16, "sine", 0.22, 0, true); this.tone(380, 290, 0.3, "sine", 0.2, 0.14, true); this.tone(500, 760, 0.16, "triangle", 0.05, 0, true); },
    gloop() { this.tone(720, 210, 0.14, "sine", 0.16); this.noise(0.05, 0.05, 300, 1400, 0.03); },
    bump() { this.tone(130, 60, 0.2, "sine", 0.3); this.noise(0.09, 0.12, 80, 900); },
    slide() { this.noise(0.32, 0.06, 500, 2400, 0.06); this.tone(420, 180, 0.3, "sine", 0.06, 0.06); },
    mark() { this.tone(660, 660, 0.09, "sine", 0.06); this.tone(990, 990, 0.12, "sine", 0.04, 0.08); },
    drip() { this.tone(1800 + Math.random() * 900, 1500, 0.06, "sine", 0.025); },
    stop() { this.tone(200, 90, 0.5, "sine", 0.2); this.noise(0.25, 0.08, 100, 700); },
    splash() { this.noise(0.7, 0.2, 120, 2200); this.tone(160, 70, 0.4, "sine", 0.18); },
  };
  audio.fetch();

  /* ---------- the drain ---------- */
  let SC, atlas, tilesImg, ready = false, pat = {};
  const [sc, sx] = off(W, H);            // the drain as it would look lit
  const [mk, mx] = off(W, H);            // where it is lit
  const [hc, hx] = off(64, 64);          // Holloring with what he keeps inside him
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[Math.floor(Math.random() * a.length)];

  let state = "ready";                   // ready, play, stopped, splash, pause, over
  let y = 0, x = W / 2, tx = W / 2, vx = 0, vy = 0, hy = 150, bumpT = 9, inv = 0, clock = 0, cool = 0, endT = 0, genY = 0;
  let pipes = [], grates = [], items = [], echoes = [], kept = [], drips = [], splashes = [], plaques = [];
  let knocks = KNOCKS, lastMark = 0, saidStart = false, saidSlid = false, keyDir = 0;
  let bestKept = store.get("best", 0), bestDeep = store.get("deep", 0);
  const metres = () => Math.floor(Math.min(y, CANAL) / PX_M);

  function hud() {
    $("kept").textContent = kept.length + " KEPT";
    $("depth").textContent = metres() + " M";
    $("knocks").textContent = "●".repeat(knocks) + "○".repeat(KNOCKS - knocks);
    $("knocks").setAttribute("aria-label", "Knocks left: " + knocks + " of " + KNOCKS);
    $("best").textContent = "Deepest " + bestDeep + " m · most kept " + bestKept;
  }

  function reset() {
    y = 0; x = tx = W / 2; vx = 0; vy = 0; hy = hangY(0); bumpT = 9; inv = 0; cool = 0; endT = 0; genY = 260;
    pipes = []; grates = []; items = []; echoes = []; kept = []; drips = []; splashes = []; plaques = [];
    knocks = KNOCKS; lastMark = 0;
    while (genY < H + 400) nextRow();
    res.x = x; res.lean = 2;
    hud();
  }

  // the next stretch of drain: a pipe or two out of the walls, sometimes a grate, and something lost
  function nextRow() {
    const m = genY / PX_M, f = hard(m), gap = 250 - 115 * f, inner = W - 2 * WALL;
    genY += gap * rnd(0.8, 1.2);
    // every 50 m a plaque on the wall says how deep
    const mark = Math.floor(genY / PX_M / 50) * 50;
    if (mark > 0 && !plaques.some(p => p.m === mark)) plaques.push({ m: mark, y: mark * PX_M, side: (mark / 50) % 2 ? -1 : 1 });
    if (genY > CANAL - 320) return;
    if (m > 60 && Math.random() < 0.12 + 0.2 * f) {
      const gw = 72 - 22 * f;
      grates.push({ y: genY, gx: rnd(WALL + 8, W - WALL - 8 - gw), gw });
    } else {
      const side = Math.random() < 0.5 ? -1 : 1, len = rnd(0.26 + 0.1 * f, 0.46 + 0.26 * f) * inner;
      pipes.push({ y: genY, side, len, drip: Math.random() < 0.45, dt: rnd(0, 2) });
      // deeper down, a pipe from the other wall as well, and less room between the two
      if (m > 80 && Math.random() < 0.12 + 0.33 * f) {
        const len2 = inner - len - Math.max(54, rnd(62, 88) - 12 * f);
        if (len2 > 22) pipes.push({ y: genY + rnd(-12, 12), side: -side, len: len2, drip: false, dt: 0 });
      }
    }
    const n = Math.random() < 0.3 ? 2 : 1;
    for (let k = 0; k < n; k++) {
      const iy = genY + gap * rnd(0.35, 0.7);
      let ix = rnd(WALL + 16, W - WALL - 16);
      for (const p of pipes) {                     // not inside a pipe
        if (Math.abs(p.y - iy) < 16) {
          const a = p.side < 0 ? WALL : W - WALL - p.len, b = a + p.len;
          if (ix > a - 12 && ix < b + 12) ix = p.side < 0 ? Math.min(W - WALL - 16, b + 22) : Math.max(WALL + 16, a - 22);
        }
      }
      items.push({ k: pick(SC.items), x: ix, y: iy, f: Math.floor(rnd(0, 4)), spin: rnd(0.2, 0.5), st: 0, glint: rnd(0, 1.6) });
    }
  }

  const pipeSpan = p => (p.side < 0 ? [WALL, WALL + p.len] : [W - WALL - p.len, W - WALL]);
  function hitsRect(cx, cy, r, a, b, t, bt) {
    const nx = Math.max(a, Math.min(cx, b)), ny = Math.max(t, Math.min(cy, bt));
    return (cx - nx) ** 2 + (cy - ny) ** 2 < r * r;
  }

  function start() {
    audio.unlock();
    reset();
    state = "play";
    $("ready").hidden = true; $("over").hidden = true;
    $("static").classList.remove("on");
    if (!saidStart) { saidStart = true; say("start", "Holloring keeps whatever gets lost down here."); }
  }

  function say(k, text) {
    const sub = $("sub");
    sub.textContent = text;
    audio.line(k).then(d => setTimeout(() => { if (sub.textContent === text) sub.textContent = ""; }, Math.max(1800, d * 1000 + 300)));
  }

  function holler() {
    if (state !== "play" || cool > 0) return;
    cool = cooldown(metres());
    echoes.push({ x, y, t: 0 });
    audio.holler();
    const b = $("holler"); b.classList.add("on"); setTimeout(() => b.classList.remove("on"), 140);
  }

  function bump(pushX) {
    bumpT = 0; inv = 1.2; vy = -110;
    x = Math.max(WALL + R_HIT, Math.min(W - WALL - R_HIT, x + pushX)); tx = x;
    knocks -= 1;
    audio.bump();
    if (kept.length) {
      // one slides back out, and stays where it came out while he goes on down
      const k = kept.pop();
      items.push({ k, x, y: y - 14, f: 0, spin: 0.35, st: 0, glint: 0, out: true });
      audio.slide();
      if (!saidSlid && knocks > 0) { saidSlid = true; say("slid", "One slid back out."); }
    }
    hud();
    // the third knock: he has had enough, and stays where he is
    if (knocks <= 0) { state = "stopped"; endT = 0; audio.stop(); }
  }

  function end(bottom) {
    state = "over";
    const n = kept.length, m = bottom ? 500 : metres();
    const deeper = m > bestDeep, more = n > bestKept;
    if (deeper) { bestDeep = m; store.set("deep", m); }
    if (more) { bestKept = n; store.set("best", n); }
    $("over-title").textContent = bottom ? "The bottom of the drain." : "Holloring went " + m + " m down.";
    $("over-line").textContent = n === 0 ? "He kept nothing this time." : "He kept " + n + (n === 1 ? " lost thing." : " lost things.");
    $("over-stats").textContent = deeper && m > 0 ? "The deepest he has been" : more ? "The most he has kept" : "Deepest " + bestDeep + " m · most kept " + bestKept;
    hud();
    say("end", "He thinks they are safer inside.");
    setTimeout(() => {
      if (state !== "over") return;
      $("over").hidden = false;
      $("again").focus({ preventScroll: true });
    }, 1500);
  }

  function update(dt) {
    clock += dt;
    for (const e of echoes) e.t += dt;
    echoes = echoes.filter(e => e.t < ECHO_LIFE);
    splashes = splashes.filter(s => (s.t += dt) < s.life);
    if (state === "stopped" || state === "splash") {
      endT += dt;
      if (endT > 1.2) end(state === "splash");
      return;
    }
    if (state !== "play") return;
    const m = y / PX_M;
    cool = Math.max(0, cool - dt); inv = Math.max(0, inv - dt); bumpT += dt;
    hy += (hangY(m) - hy) * Math.min(1, dt * 2);
    // falling, faster the deeper he is, and knocked back up for a moment after a pipe
    if (bumpT < 0.24) { y += vy * dt; vy += 520 * dt; } else y += fallSpeed(m) * dt;
    // across: toward the finger, or along with the keys
    const st = steer(m);
    if (keyDir) tx = Math.max(WALL + R_HIT, Math.min(W - WALL - R_HIT, tx + keyDir * st * dt));
    vx = Math.max(-st, Math.min(st, (tx - x) * 9));
    x = Math.max(WALL + R_HIT, Math.min(W - WALL - R_HIT, x + vx * dt));
    // the drain ahead
    while (genY < y + H + 300) nextRow();
    const top = y - hy - 120;
    pipes = pipes.filter(p => p.y > top); grates = grates.filter(q => q.y > top); items = items.filter(i => i.y > top && !i.gone);
    plaques = plaques.filter(p => p.y > top - 40);
    // pipes and grates
    if (inv <= 0) {
      for (const p of pipes) {
        if (Math.abs(p.y - y) > 30) continue;
        const [a, b] = pipeSpan(p);
        if (hitsRect(x, y, R_HIT, a, b, p.y - 6, p.y + 6)) { bump(p.side < 0 ? (b + R_HIT + 2 - x) : (a - R_HIT - 2 - x)); break; }
      }
    }
    if (inv <= 0 && state === "play") {
      for (const q of grates) {
        if (Math.abs(q.y - y) > 30) continue;
        const inGap = x - R_HIT * 0.6 > q.gx && x + R_HIT * 0.6 < q.gx + q.gw;
        if (!inGap && hitsRect(x, y, R_HIT, WALL, W - WALL, q.y - 3, q.y + 3)) { bump((q.gx + q.gw / 2) - x > 0 ? 10 : -10); break; }
      }
    }
    if (state !== "play") return;
    // the lost things he falls through
    for (const it of items) {
      if (it.out || it.gone) continue;
      if ((it.x - x) ** 2 + (it.y - y) ** 2 < (R_HIT + 8) ** 2) {
        it.gone = true; kept.push(it.k); audio.gloop();
        const el = $("kept"); el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump");
        setTimeout(() => el.classList.remove("bump"), 160);
        hud();
      }
    }
    // water off the open ends of some pipes
    for (const p of pipes) {
      if (!p.drip) continue;
      p.dt -= dt;
      if (p.dt <= 0) {
        p.dt = rnd(0.6, 2.2);
        const [a, b] = pipeSpan(p);
        drips.push({ x: p.side < 0 ? b - 2 : a + 2, y: p.y + 6, v: 30 });
        if (Math.abs(p.y - y) < 260 && Math.random() < 0.5) audio.drip();
      }
    }
    for (const d of drips) { d.v += 500 * dt; d.y += d.v * dt; }
    drips = drips.filter(d => d.y < y + H);
    const mm = metres();
    if (mm !== hud.last) { hud.last = mm; hud(); }
    if (mm >= lastMark + 50) { lastMark = Math.floor(mm / 50) * 50; audio.mark(); }
    // the bottom: the drain lets out into the canal
    if (y >= CANAL) {
      y = CANAL; state = "splash"; endT = 0; audio.splash();
      for (let k = 0; k < 18; k++) splashes.push({ x: x + rnd(-10, 10), y: y + 14, vx: rnd(-70, 70), vy: rnd(-190, -60), t: 0, life: rnd(0.5, 0.9) });
    }
  }

  /* ---------- drawing ---------- */
  function tile(name) {
    const [c, x2] = off(32, 32);
    x2.drawImage(tilesImg, SC.tiles[name] * 32, 0, 32, 32, 0, 0, 32, 32);
    return sx.createPattern(c, "repeat");
  }
  const at = (p, dy) => { p.setTransform(new DOMMatrix().translate(0, dy)); return p; };
  // a three-by-five pixel figure for the depth plaques
  const DIGITS = { 0: "111101101101111", 1: "010110010010111", 2: "111001111100111", 3: "111001111001111", 4: "101101111001001",
                   5: "111100111001111", 6: "111100111101111", 7: "111001010010010", 8: "111101111101111", 9: "111101111001111",
                   M: "101111111101101" };
  function figure(ctx, text, x0, y0) {
    [...text].forEach((ch, i) => {
      const b = DIGITS[ch];
      if (!b) return;
      for (let k = 0; k < 15; k++) if (b[k] === "1") ctx.fillRect(x0 + i * 4 + (k % 3), y0 + Math.floor(k / 3), 1, 1);
    });
  }

  function drawDrain(top) {
    const s = sx;
    s.globalCompositeOperation = "source-over"; s.globalAlpha = 1;
    // the far wall, slower than the near ones, and darker
    s.fillStyle = at(pat.back, -top * 0.55); s.fillRect(WALL, 0, W - 2 * WALL, H);
    s.fillStyle = "rgba(8,6,16,.5)"; s.fillRect(WALL, 0, W - 2 * WALL, H);
    // the near walls, their inner edges in shadow
    s.fillStyle = at(pat.wall, -top); s.fillRect(0, 0, WALL, H); s.fillRect(W - WALL, 0, WALL, H);
    const gl = s.createLinearGradient(WALL - 7, 0, WALL, 0); gl.addColorStop(0, "rgba(0,0,0,0)"); gl.addColorStop(1, "rgba(0,0,0,.55)");
    s.fillStyle = gl; s.fillRect(WALL - 7, 0, 7, H);
    const gr = s.createLinearGradient(W - WALL, 0, W - WALL + 7, 0); gr.addColorStop(0, "rgba(0,0,0,.55)"); gr.addColorStop(1, "rgba(0,0,0,0)");
    s.fillStyle = gr; s.fillRect(W - WALL, 0, 7, H);
    // the depth plaques
    for (const p of plaques) {
      const py = Math.round(p.y - top);
      if (py < -12 || py > H + 12) continue;
      const text = p.m + "M", w2 = text.length * 4 + 3, px = p.side < 0 ? 4 : W - 4 - w2;
      s.fillStyle = at(pat.iron, -top); s.fillRect(px, py - 5, w2, 9);
      s.fillStyle = "rgba(0,0,0,.45)"; s.fillRect(px, py + 3, w2, 1);
      s.fillStyle = "#fbefb2"; figure(s, text, px + 2, py - 3);
    }
    // the canal at the bottom
    const wy = CANAL + 22 - top;
    if (wy < H) {
      s.fillStyle = at(pat.sludge, -top); s.fillRect(0, wy, W, H - wy);
      s.fillStyle = "rgba(20,60,70,.55)"; s.fillRect(0, wy, W, H - wy);
      s.fillStyle = "rgba(170,230,230,.55)"; s.fillRect(0, wy, W, 1);
      s.fillStyle = "rgba(170,230,230,.25)"; s.fillRect(0, wy + 3 + Math.round(Math.sin(clock * 3) * 1), W, 1);
    }
    // pipes: rust, a band of light on top, shadow under, a flange at the wall and a dark open end
    for (const p of pipes) {
      const py = Math.round(p.y - top);
      if (py < -20 || py > H + 20) continue;
      const [a, b] = pipeSpan(p), a2 = Math.round(a), b2 = Math.round(b);
      s.fillStyle = at(pat.rust, -top); s.fillRect(a2, py - 6, b2 - a2, 12);
      s.fillStyle = "rgba(255,210,160,.28)"; s.fillRect(a2, py - 6, b2 - a2, 2);
      s.fillStyle = "rgba(0,0,0,.4)"; s.fillRect(a2, py + 3, b2 - a2, 3);
      s.fillStyle = at(pat.iron, -top);
      const fl = p.side < 0 ? a2 : b2 - 4; s.fillRect(fl, py - 8, 4, 16);
      const endX = p.side < 0 ? b2 - 2 : a2;
      s.fillStyle = "#120c0a"; s.fillRect(endX, py - 5, 2, 10);
      s.fillStyle = at(pat.iron, -top); s.fillRect(p.side < 0 ? b2 - 5 : a2 + 2, py - 7, 3, 14);
    }
    // grates: iron bars across the shaft with one way through
    for (const q of grates) {
      const qy = Math.round(q.y - top);
      if (qy < -10 || qy > H + 10) continue;
      s.fillStyle = at(pat.grate, -top);
      s.fillRect(WALL, qy - 3, Math.round(q.gx - WALL), 6); s.fillRect(Math.round(q.gx + q.gw), qy - 3, Math.round(W - WALL - q.gx - q.gw), 6);
      s.fillStyle = "rgba(210,220,230,.35)";
      s.fillRect(WALL, qy - 3, Math.round(q.gx - WALL), 1); s.fillRect(Math.round(q.gx + q.gw), qy - 3, Math.round(W - WALL - q.gx - q.gw), 1);
    }
    // the lost things, turning over as they float
    for (const it of items) {
      if (it.gone) continue;
      const iy = it.y - top;
      if (iy < -20 || iy > H + 20) continue;
      spr(s, "item_" + it.k + "_" + it.f, it.x, iy + Math.sin(clock * 2 + it.x) * 1.5);
    }
    // water drops
    s.fillStyle = "rgba(170,210,230,.8)";
    for (const d of drips) { const dy = d.y - top; if (dy > -4 && dy < H) s.fillRect(Math.round(d.x), Math.round(dy), 1, 2); }
  }
  function spr(ctx, key, cx, cy) {
    const a = SC.sprites[key];
    if (!a) return;
    ctx.drawImage(atlas, a[0], a[1], a[2], a[3], Math.round(cx - a[2] / 2), Math.round(cy - a[3] / 2), a[2], a[3]);
  }

  function drawHolloring() {
    // him, what he keeps inside him, and him again over it at a third, so it sits in the jelly
    const key = SC.hol[res.lean], a = SC.sprites[key];
    hx.globalCompositeOperation = "source-over"; hx.globalAlpha = 1; hx.clearRect(0, 0, 64, 64);
    const ox = Math.round(32 - a[4]), oy = Math.round(32 - a[5]);
    hx.drawImage(atlas, a[0], a[1], a[2], a[3], ox, oy, a[2], a[3]);
    hx.globalCompositeOperation = "source-atop"; hx.globalAlpha = 0.9;
    const show = kept.slice(-INSIDE.length);
    show.forEach((k, i) => {
      const s2 = SC.sprites["item_" + k + "_" + ((i + res.turn) % 4)], p = INSIDE[i];
      if (!s2) return;
      const w2 = Math.max(4, Math.round(s2[2] * 0.5)), h2 = Math.max(4, Math.round(s2[3] * 0.5));
      hx.drawImage(atlas, s2[0], s2[1], s2[2], s2[3], Math.round(32 + p[0] - w2 / 2), Math.round(32 + p[1] + res.bob[i % 3] - h2 / 2), w2, h2);
    });
    hx.globalCompositeOperation = "source-over"; hx.globalAlpha = 0.38;
    hx.drawImage(atlas, a[0], a[1], a[2], a[3], ox, oy, a[2], a[3]);
    hx.globalAlpha = 1;
    const blink = state === "play" && inv > 0 && Math.floor(clock * 12) % 2;
    if (!blink) g.drawImage(hc, Math.round(res.x - 32), Math.round(res.y) - 32);
  }

  function draw() {
    const top = y - hy, m = y / PX_M, gr0 = glowR(m);
    drawDrain(top);
    // where it is lit: his own glow, and every echo still out
    mx.globalCompositeOperation = "source-over"; mx.clearRect(0, 0, W, H);
    const glow = mx.createRadialGradient(res.x, hy + 4, 6, res.x, hy + 4, gr0);
    glow.addColorStop(0, "rgba(0,0,0,.95)"); glow.addColorStop(1, "rgba(0,0,0,0)");
    mx.fillStyle = glow; mx.fillRect(res.x - gr0, hy + 4 - gr0, gr0 * 2, gr0 * 2);
    for (const e of echoes) {
      const r = Math.min(ECHO_SPEED * e.t, 560), k = e.t < 0.35 ? 1 : Math.max(0, 1 - (e.t - 0.35) / (ECHO_LIFE - 0.35));
      // soft at its edge: the sound spreading, not a torch
      const eg = mx.createRadialGradient(e.x, e.y - top, 0, e.x, e.y - top, Math.max(1, r));
      eg.addColorStop(0, "rgba(0,0,0," + (0.95 * k) + ")"); eg.addColorStop(0.72, "rgba(0,0,0," + (0.85 * k) + ")"); eg.addColorStop(1, "rgba(0,0,0,0)");
      mx.fillStyle = eg; mx.beginPath(); mx.arc(e.x, e.y - top, r, 0, Math.PI * 2); mx.fill();
    }
    // the lost things catch what light there is, now and then, even in the dark
    for (const it of items) {
      if (it.gone) continue;
      const ph = (clock + it.glint) % 1.6, iy = it.y - top;
      if (ph < 0.25 && iy > 0 && iy < H) { mx.fillStyle = "rgba(0,0,0," + (0.6 * (1 - ph / 0.25)) + ")"; mx.fillRect(it.x - 5, iy - 5, 10, 10); }
    }
    g.globalCompositeOperation = "source-over"; g.globalAlpha = 1;
    g.fillStyle = "#05040b"; g.fillRect(0, 0, W, H);
    g.globalAlpha = 0.07; g.drawImage(sc, 0, 0); g.globalAlpha = 1;
    sx.globalCompositeOperation = "destination-in"; sx.drawImage(mk, 0, 0); sx.globalCompositeOperation = "source-over";
    g.drawImage(sc, 0, 0);
    // the echo going out as a ring, and coming back into him
    g.globalCompositeOperation = "lighter";
    for (const e of echoes) {
      if (e.t < 1.1) {
        g.strokeStyle = "rgba(170,235,255," + (0.6 * (1 - e.t / 1.1)) + ")"; g.lineWidth = 2;
        g.beginPath(); g.arc(e.x, e.y - top, Math.min(ECHO_SPEED * e.t, 560), 0, Math.PI * 2); g.stroke();
      }
      if (e.t > 0.9 && e.t < 1.35) {
        const r = 110 * (1 - (e.t - 0.9) / 0.45);
        g.strokeStyle = "rgba(255,170,210," + (0.5 * (1 - (e.t - 0.9) / 0.45)) + ")"; g.lineWidth = 1;
        g.beginPath(); g.arc(res.x, res.y + 4, Math.max(1, r), 0, Math.PI * 2); g.stroke();
      }
    }
    const pg = g.createRadialGradient(res.x, res.y + 4, 2, res.x, res.y + 4, 30);
    pg.addColorStop(0, "rgba(255,120,170,.22)"); pg.addColorStop(1, "rgba(255,120,170,0)");
    g.fillStyle = pg; g.fillRect(res.x - 30, res.y - 26, 60, 60);
    g.globalCompositeOperation = "source-over";
    if (state !== "splash" || endT < 0.15) drawHolloring();
    g.fillStyle = "rgba(190,235,240,.9)";
    for (const s2 of splashes) g.fillRect(Math.round(s2.x + s2.vx * s2.t), Math.round(s2.y - top + s2.vy * s2.t + 260 * s2.t * s2.t), 2, 2);
    $("holler").style.setProperty("--ready", String(1 - cool / cooldown(m)));
  }

  // what Holloring is drawn at: sampled 15 times a second
  const res = { x: W / 2, y: 150, lean: 2, turn: 0, bob: [0, 0, 0], acc: 0 };
  function sample(dt) {
    res.acc += dt;
    if (res.acc < RESIDENT_STEP && !reduce) return;
    res.acc = reduce ? 0 : res.acc % RESIDENT_STEP;
    res.x = x; res.y = hy;
    // leaning into the way he goes; after a pipe, a wobble one way and the other
    let lean = Math.round((vx / steer(y / PX_M)) * 2);
    if (bumpT < 0.5) lean = Math.floor(bumpT * 12) % 2 ? 1 : -1;
    res.lean = Math.max(0, Math.min(4, 2 + lean));
    if (Math.random() < 0.08) res.turn = (res.turn + 1) % 4;
    res.bob = [Math.round(Math.sin(clock * 2)), Math.round(Math.sin(clock * 2 + 2)), Math.round(Math.sin(clock * 2 + 4))];
    for (const it of items) { it.st += RESIDENT_STEP; if (it.st > 1 / it.spin * 0.25) { it.st = 0; it.f = (it.f + 1) % 4; } }
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

  /* ---------- input: drag or point to steer, tap to holler ---------- */
  const screen = $("screen");
  let press = null;
  const canvasX = e => { const b = cv.getBoundingClientRect(); return (e.clientX - b.left) * W / b.width; };
  screen.addEventListener("pointerdown", e => {
    if (e.target.closest("button, a")) return;
    if (state === "pause") { pause(false); return; }
    if (state !== "play") return;
    press = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), moved: false };
    try { screen.setPointerCapture(e.pointerId); } catch (err) { /* not capturable */ }
    e.preventDefault();
  });
  screen.addEventListener("pointermove", e => {
    if (state !== "play") return;
    if (press && e.pointerId === press.id) {
      if (Math.abs(e.clientX - press.x) + Math.abs(e.clientY - press.y) > 10) press.moved = true;
      if (press.moved) tx = Math.max(WALL + R_HIT, Math.min(W - WALL - R_HIT, canvasX(e)));
    } else if (e.pointerType === "mouse") {
      tx = Math.max(WALL + R_HIT, Math.min(W - WALL - R_HIT, canvasX(e)));
    }
  });
  const release = e => {
    if (!press || e.pointerId !== press.id) return;
    if (!press.moved && performance.now() - press.t < 260) holler();
    press = null;
  };
  screen.addEventListener("pointerup", release);
  screen.addEventListener("pointercancel", () => { press = null; });
  $("holler").addEventListener("pointerdown", e => { e.preventDefault(); if (state === "pause") pause(false); else holler(); });
  const LEFT = new Set(["ArrowLeft", "KeyA"]), RIGHT = new Set(["ArrowRight", "KeyD"]), HOLLER = new Set(["Space", "ArrowUp", "KeyW", "ArrowDown", "KeyS"]);
  const held = new Set();
  addEventListener("keydown", e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const el = e.target instanceof Element ? e.target : null;
    if (el && el !== document.body && el.closest("button") && (e.code === "Space" || e.code === "Enter")) return;
    if (LEFT.has(e.code) || RIGHT.has(e.code)) {
      e.preventDefault(); if (state === "pause") { pause(false); return; }
      held.add(e.code); keyDir = [...held].some(c => RIGHT.has(c)) - [...held].some(c => LEFT.has(c));
    } else if (HOLLER.has(e.code)) {
      e.preventDefault();
      if (state === "ready" || (state === "over" && !$("over").hidden)) { if (e.code === "Space") start(); return; }
      if (state === "pause") { pause(false); return; }
      if (!e.repeat) holler();
    } else if (e.code === "Enter" && (state === "ready" || (state === "over" && !$("over").hidden))) {
      e.preventDefault(); start();
    } else if (e.code === "KeyP" || e.code === "Escape") {
      if (state === "play") pause(true); else if (state === "pause") pause(false);
    }
  });
  addEventListener("keyup", e => { held.delete(e.code); keyDir = [...held].some(c => RIGHT.has(c)) - [...held].some(c => LEFT.has(c)); });
  addEventListener("blur", () => { held.clear(); keyDir = 0; press = null; });

  function pause(on) {
    if (on && state === "play") {
      state = "pause"; held.clear(); keyDir = 0;
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
    const url = "https://rotville.world/games/drain/", label = $("share").querySelector(".tape-label"), n = kept.length, m = metres();
    const things = n === 0 ? "nothing" : n + (n === 1 ? " lost thing" : " lost things");
    const text = y >= CANAL ? "Holloring reached the bottom of the drain on rotville.world with " + things + "."
      : "Holloring went " + m + " m down the drain on rotville.world and kept " + things + ".";
    if (navigator.share) {
      try { await navigator.share({ title: "Down the Drain", text, url }); return; } catch (err) { if (err && err.name === "AbortError") return; }
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

  Promise.all([fetch("assets/scene.json").then(r => r.json()), load("assets/sprites.png"), load("assets/tiles.png")])
    .then(([s, a, t]) => {
      SC = s; atlas = a; tilesImg = t;
      pat = { back: tile("brick-mossy"), wall: tile("stone-block"), rust: tile("rust"), iron: tile("iron"), grate: tile("grate"), sludge: tile("sludge") };
      reset(); ready = true;
    })
    .catch(() => { $("sub").textContent = "The tape would not load. Try the page again."; });
  requestAnimationFrame(frame);
})();
