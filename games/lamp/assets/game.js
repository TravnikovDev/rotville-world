/* Lamp: keep the house lit with Fusegrin.

   Fusegrin is a navy iron ball whose braided fuse has been lit for as long as anyone can remember. His rule (LORE
   4.7): "the fuse is not a countdown, it is his lamp. He gets walked into rooms that have lost their light and stood
   in a corner, and he is pleased to be asked." He has never gone off, and nothing here builds toward it: the only
   things that run out are the bulbs.

   Six rooms, one bulb each, and every bulb dims. A room comes back up while Fusegrin stands in it, and a little
   while he rolls through. Tap a room and he goes there, along the floors and up and down the ladders between them.
   Three rooms dark at once and the house has gone dark.

   Only pre-rendered pictures ship (assets/lit.png, dark.png, front.png, sprites.png). Fusegrin is drawn at 15 fps
   under the 60 fps page, the way the clips hold residents (R819, R1070). */
(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  const W = 270, H = 480;
  const cv = $("c"), g = cv.getContext("2d");
  g.imageSmoothingEnabled = false;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const store = {
    get(k, d) { try { const v = localStorage.getItem("lamp." + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem("lamp." + k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
  };
  const load = src => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });

  const DARK_LIMIT = 3;                  // three rooms dark at once and the house has gone dark
  const RESIDENT_STEP = 1 / 15;          // Fusegrin updates 15 times a second
  const ROLL = 2.8, CLIMB = 1.6;         // metres a second, along a floor and up or down a ladder
  const FILL = 0.7;                      // seconds for a room to come up while he stands in it
  const PASS = 0.3;                      // the share of that he gives a room he only rolls through
  const LOW = 0.3;                       // under this a bulb flickers
  const R_M = 0.2;                       // his radius in metres, for how far he turns as he rolls
  const TREAD = 0.25;                    // a ladder's rise per tread

  /* ---------- sound: the bed, three lines, the rest made on the spot ---------- */
  const audio = {
    ctx: null, on: store.get("sound", true), raw: {}, buf: {}, music: null,
    fetch() {
      for (const [k, f] of [["start", "assets/line-start.mp3"], ["dark", "assets/line-dark.mp3"], ["end", "assets/line-end.mp3"],
                            ["music", "assets/tin-lullaby.mp3"]]) {
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
      this.out = c.createGain(); this.out.gain.value = this.on ? 1 : 0; this.out.connect(c.destination);
      this.fxg = c.createGain(); this.fxg.gain.value = 0.5; this.fxg.connect(this.out);
      this.mus = c.createGain(); this.mus.gain.value = 0.3; this.mus.connect(this.out);
      this.vox = c.createGain(); this.vox.gain.value = 1; this.vox.connect(this.out);
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
    // the lullaby goes quieter with every room that is dark
    bed(nDark) { if (this.ctx) this.mus.gain.setTargetAtTime(0.3 * (1 - 0.28 * nDark), this.ctx.currentTime, 0.3); },
    set(on) { this.on = on; store.set("sound", on); if (this.out) this.out.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.04); },
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
      e.gain.setValueAtTime(vol, t); e.gain.exponentialRampToValueAtTime(0.0008, t + dur);
      o.connect(e).connect(this.fxg); o.start(t); o.stop(t + dur + 0.03);
    },
    noise(dur, vol, lo, hi, when = 0) {
      if (!this.ctx) return;
      const c = this.ctx, t = c.currentTime + when, s = c.createBufferSource(), a = c.createBiquadFilter(), b = c.createBiquadFilter(), e = c.createGain();
      s.buffer = this.noiseBuf; s.loop = true; a.type = "highpass"; a.frequency.value = lo; b.type = "lowpass"; b.frequency.value = hi;
      e.gain.setValueAtTime(vol, t); e.gain.exponentialRampToValueAtTime(0.0008, t + dur);
      s.connect(a).connect(b).connect(e).connect(this.fxg); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.03);
    },
    tap() { this.tone(880, 860, 0.05, "sine", 0.05); },
    roll() { this.noise(0.09, 0.05, 50, 260); },
    tread() { this.tone(170, 120, 0.07, "square", 0.05); this.noise(0.04, 0.05, 300, 1600); },
    relit() { this.tone(262, 523, 0.22, "sine", 0.1); this.tone(392, 784, 0.3, "sine", 0.05, 0.06); this.noise(0.1, 0.04, 200, 900); },
    blown() { this.tone(1500, 900, 0.07, "square", 0.04); this.noise(0.05, 0.07, 2000, 7000); },
    buzz() { this.noise(0.04, 0.025, 90, 380); },
  };
  audio.fetch();

  /* ---------- the house ---------- */
  let SC, lit, dark, front, atlas, ready = false, N = 0, S = 0;
  let stand = [];                        // where he stands in each room, as a distance along the path
  const inPoly = (x, y, p) => {
    let c = false;
    for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
      if ((p[i][1] > y) !== (p[j][1] > y) && x < (p[j][0] - p[i][0]) * (y - p[i][1]) / (p[j][1] - p[i][1]) + p[i][0]) c = !c;
    }
    return c;
  };
  const roomOf = (x, y) => { for (let i = 0; i < N; i++) if (inPoly(x, y, SC.rooms[i].poly)) return i; return -1; };
  function posAt(s) {
    const P = SC.path;
    let i = 0;
    while (i < P.length - 2 && P[i + 1].s < s) i++;
    const a = P[i], b = P[i + 1], u = Math.max(0, Math.min(1, (s - a.s) / (b.s - a.s || 1)));
    return { i, u, x: a.at[0] + (b.at[0] - a.at[0]) * u, y: a.at[1] + (b.at[1] - a.at[1]) * u, kind: a.kind };
  }
  function treadLen(i) {
    const P = SC.path, rise = Math.abs(P[i + 1].at[1] - P[i].at[1]) / SC.px_per_m;
    return (P[i + 1].s - P[i].s) / Math.max(1, Math.round(rise / TREAD));
  }
  function prepare() {
    N = SC.rooms.length; S = SC.path[SC.path.length - 1].s;
    const got = SC.rooms.map(() => []);
    for (let s = 0; s <= S; s += 0.02) {
      const p = posAt(s);
      if (p.kind !== "floor") continue;
      const r = roomOf(p.x, p.y);
      if (r >= 0) got[r].push(s);
    }
    stand = got.map(a => a[Math.floor(a.length / 2)] || 0);
    SC.rooms.forEach((r, i) => {
      const xs = r.poly.map(p => p[0]), ys = r.poly.map(p => p[1]);
      r.box = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
      r.idx = i;
    });
  }

  /* ---------- the game ---------- */
  let state = "ready";                   // ready, play, pause, over
  let s = 0, sT = 0, moving = false, ang = 0, here = 0, clock = 0, T = 0, litCount = 0, saidStart = false, saidDark = false;
  let L = [], pace = [], low = [], darkNow = [], flash = [], flick = [], sel = null, rollAcc = 0, treadAcc = 0;
  let best = store.get("best", 0);
  const rnd = (a, b) => a + Math.random() * (b - a);
  // how long a full bulb lasts now: shorter the longer the evening goes on, for every bulb in the house, and
  // each bulb at a pace of its own that changes whenever it is filled back up
  const lasts = () => Math.max(4.5, 22 - 0.075 * T);
  const newPace = () => rnd(0.8, 1.3);
  const idOf = id => SC.rooms.findIndex(r => r.id === id);

  function hud() {
    const n = darkNow.filter(Boolean).length;
    $("lit").textContent = litCount + " LIT";
    // three bulbs, one going out for each room that is dark now
    $("dark").textContent = "●".repeat(Math.max(0, DARK_LIMIT - n)) + "○".repeat(Math.min(n, DARK_LIMIT));
    $("dark").setAttribute("aria-label", "Rooms dark: " + n + " of " + DARK_LIMIT);
    $("dark").classList.toggle("warn", n >= DARK_LIMIT - 1);
    $("best").textContent = "Most rooms " + best;
  }

  function reset() {
    T = 0; clock = 0; litCount = 0; saidDark = false; sel = null; rollAcc = 0; treadAcc = 0;
    // the rooms start at different levels, so they go dark one after another
    const start = [1, 0.9, 0.8, 0.7, 0.62, 0.55].sort(() => Math.random() - 0.5);
    L = SC.rooms.map((r, i) => start[i % start.length]);
    here = Math.max(0, idOf("parlour")); L[here] = 1;
    pace = SC.rooms.map(() => newPace());
    low = L.map(v => v < LOW); darkNow = L.map(() => false); flash = L.map(() => 0); flick = L.map(() => true);
    s = sT = stand[here]; moving = false; ang = 0;
    res.s = s; res.ang = 0; res.bump = 0;
    hud();
    audio.bed(0);
  }

  function start() {
    audio.unlock();
    reset();
    state = "play";
    $("ready").hidden = true; $("over").hidden = true;
    $("static").classList.remove("on");
    if (!saidStart) { saidStart = true; say("start", "The fuse is not a countdown. It is his lamp."); }
  }

  function say(k, text) {
    const sub = $("sub");
    sub.textContent = text;
    audio.line(k).then(d => setTimeout(() => { if (sub.textContent === text) sub.textContent = ""; }, Math.max(1800, d * 1000 + 300)));
  }

  function goTo(r) {
    if (state !== "play" || r < 0) return;
    sT = stand[r];
    sel = { r, t: clock };
    audio.tap();
  }

  function relit(i) {
    litCount += 1;
    flash[i] = 0.4;
    audio.relit();
    const el = $("lit"); el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump");
    setTimeout(() => el.classList.remove("bump"), 160);
    if (litCount > best) { best = litCount; store.set("best", best); }
    hud();
  }

  function wentDark(i) {
    audio.blown();
    const n = darkNow.filter(Boolean).length;
    audio.bed(n);
    if (!saidDark && n < DARK_LIMIT) { saidDark = true; say("dark", "A room has gone dark."); }
    hud();
  }

  function end() {
    state = "over";
    $("over-title").textContent = "The house went dark.";
    $("over-line").textContent = litCount === 0 ? "Fusegrin lit no rooms." : "Fusegrin lit " + litCount + (litCount === 1 ? " room." : " rooms.");
    $("over-stats").textContent = litCount > 0 && litCount === best ? "The most he has lit" : "Most rooms " + best;
    if (!reduce) $("static").classList.add("on");
    say("end", "He was pleased to be asked.");
    setTimeout(() => {
      if (state !== "over") return;
      $("static").classList.remove("on");
      $("over").hidden = false;
      $("again").focus({ preventScroll: true });
    }, 1400);
  }

  function update(dt) {
    clock += dt;
    if (state !== "play") return;
    T += dt;
    // along the path toward the chosen room
    const d = sT - s;
    if (Math.abs(d) > 1e-4) {
      const p = posAt(s);
      const step = Math.sign(d) * Math.min(Math.abs(d), (p.kind === "ladder" ? CLIMB : ROLL) * dt);
      s += step; moving = true;
      if (p.kind === "floor") {
        const P = SC.path, right = Math.sign(P[p.i + 1].at[0] - P[p.i].at[0]) * Math.sign(step);
        ang -= right * (Math.abs(step) / R_M) * 180 / Math.PI;       // rolling right turns him clockwise
        rollAcc += Math.abs(step); if (rollAcc > 0.4) { rollAcc = 0; audio.roll(); }
        treadAcc = 0;
      } else {
        ang = Math.round(ang / 360) * 360;                            // a ladder is climbed upright
        const tl = treadLen(p.i); treadAcc += Math.abs(step); if (treadAcc > tl) { treadAcc -= tl; audio.tread(); }
      }
    } else {
      moving = false;
      const up = Math.round(ang / 360) * 360, diff = up - ang;       // stood in a corner, the fuse on top
      ang += Math.sign(diff) * Math.min(Math.abs(diff), 540 * dt);
    }
    const p = posAt(s), r = roomOf(p.x, p.y);
    if (r >= 0) here = r;
    // the bulbs
    for (let i = 0; i < N; i++) {
      flash[i] = Math.max(0, flash[i] - dt);
      if (i === here) {
        const was = L[i];
        L[i] = Math.min(1, L[i] + ((moving ? PASS : 1) / FILL) * dt);
        if (L[i] > 0 && darkNow[i]) { darkNow[i] = false; audio.bed(darkNow.filter(Boolean).length); hud(); }
        if (L[i] >= 1 && was < 1) { pace[i] = newPace(); if (low[i]) { low[i] = false; relit(i); } }
      } else {
        L[i] = Math.max(0, L[i] - dt / (pace[i] * lasts()));
        if (L[i] < LOW) low[i] = true;
        if (L[i] <= 0 && !darkNow[i]) { darkNow[i] = true; wentDark(i); }
      }
    }
    if (darkNow.filter(Boolean).length >= DARK_LIMIT) end();
  }

  /* ---------- drawing ---------- */
  const pc = document.createElement("canvas"); pc.width = W; pc.height = H;
  const pg = pc.getContext("2d");
  const clip = poly => { g.beginPath(); poly.forEach((p, k) => (k ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); g.clip(); };
  const roomAlpha = i => {
    if (L[i] <= 0) return 0;
    let a = Math.pow(L[i], 0.8);
    if (L[i] < LOW && !flick[i]) a *= 0.3;
    return Math.min(1, a + flash[i] * 0.6);
  };
  function glow(x, y, r, a, rgb) {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, "rgba(" + rgb + "," + a + ")"); gr.addColorStop(1, "rgba(" + rgb + ",0)");
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }

  function draw() {
    g.globalCompositeOperation = "source-over"; g.globalAlpha = 1;
    g.drawImage(dark, 0, 0);
    for (let i = 0; i < N; i++) {
      const a = roomAlpha(i);
      if (a <= 0.004) continue;
      g.save(); clip(SC.rooms[i].poly); g.globalAlpha = a; g.drawImage(lit, 0, 0); g.restore();
    }
    const C = SC.fg.centre, P = res.pos || posAt(s), cx = P.x, cy = P.y + res.bump;
    // his lamp: a pool of the lit house round him, inside the room he is in
    const pr = 30 + (reduce ? 0 : res.flame * 3);
    pg.globalCompositeOperation = "source-over"; pg.clearRect(0, 0, W, H);
    const gr = pg.createRadialGradient(cx, cy, pr * 0.2, cx, cy, pr);
    gr.addColorStop(0, "rgba(0,0,0,.95)"); gr.addColorStop(1, "rgba(0,0,0,0)");
    pg.fillStyle = gr; pg.fillRect(cx - pr, cy - pr, pr * 2, pr * 2);
    pg.globalCompositeOperation = "source-in"; pg.drawImage(lit, 0, 0);
    g.save(); clip(SC.rooms[res.room].poly); g.drawImage(pc, 0, 0); g.restore();

    // the bulbs that are on, and the star on his fuse
    const idx = ((Math.round(res.ang / 30) % 12) + 12) % 12, key = "fg_" + String(idx).padStart(2, "0");
    const st = SC.fg.frames[idx].star, sx = cx + st[0] - C[0], sy = cy + st[1] - C[1];
    g.globalCompositeOperation = "lighter";
    for (let i = 0; i < N; i++) {
      const a = roomAlpha(i);
      if (a > 0.05) glow(SC.rooms[i].bulb[0], SC.rooms[i].bulb[1], 7 + flash[i] * 12, 0.5 * a, "255,200,120");
    }
    glow(sx, sy, 8, 0.55 + (reduce ? 0 : res.flame * 0.2), "255,190,90");
    g.globalCompositeOperation = "source-over";

    // Fusegrin, and a spark or two off the star
    const sp = SC.sprites[key];
    g.drawImage(atlas, sp[0], sp[1], sp[2], sp[3], Math.round(cx + sp[4] - C[0]), Math.round(cy + sp[5] - C[1]), sp[2], sp[3]);
    if (!reduce) {
      for (const q of res.sparks) { g.fillStyle = q[2]; g.fillRect(Math.round(sx + q[0]), Math.round(sy + q[1]), 1, 1); }
    }

    // the cut edges of the house stand in front of him
    g.drawImage(front, 0, 0);

    // the room he was sent to, outlined for a moment
    if (sel && clock - sel.t < 0.45) {
      g.save(); g.globalAlpha = 1 - (clock - sel.t) / 0.45; g.strokeStyle = "#fff3c4"; g.lineWidth = 1;
      const b = SC.rooms[sel.r].poly;
      g.beginPath(); b.forEach((p, k) => (k ? g.lineTo(p[0] + 0.5, p[1] + 0.5) : g.moveTo(p[0] + 0.5, p[1] + 0.5))); g.closePath(); g.stroke();
      g.restore();
    }
  }

  // what Fusegrin is drawn at: sampled 15 times a second
  const res = { s: 0, ang: 0, bump: 0, pos: null, room: 0, flame: 0, sparks: [], acc: 0 };
  function sample(dt) {
    res.acc += dt;
    if (res.acc < RESIDENT_STEP && !reduce) return;
    res.acc = reduce ? 0 : res.acc % RESIDENT_STEP;
    res.s = s; res.pos = posAt(s); res.room = here;
    res.ang = ang;
    res.bump = 0;
    if (res.pos.kind === "ladder") {
      // a knock up each tread, and a lean one way then the other
      const P = SC.path, i = res.pos.i, k = (s - P[i].s) / treadLen(i);
      const up = Math.abs(Math.sin(Math.PI * k));
      res.bump = -3 * up;
      res.ang = Math.round(ang / 360) * 360 + (Math.floor(k) % 2 ? 30 : -30) * (up > 0.5 ? 1 : 0);
    }
    res.flame = Math.random();
    res.sparks = [];
    const n = 1 + Math.floor(Math.random() * 3);
    for (let k = 0; k < n; k++) res.sparks.push([Math.round(rnd(-3, 3)), Math.round(rnd(-4, 1)), ["#fff6c8", "#ffd27a", "#ff9a3c"][k % 3]]);
    // a low bulb stutters: off now and then, more often the lower it gets
    for (let i = 0; i < N; i++) {
      const was = flick[i];
      flick[i] = L[i] >= LOW || Math.random() > (LOW - L[i]) / LOW * 0.55;
      if (was && !flick[i] && state === "play" && Math.random() < 0.3) audio.buzz();
    }
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

  /* ---------- input: point at a room ---------- */
  cv.addEventListener("pointerdown", e => {
    if (state === "pause") { pause(false); return; }
    if (state !== "play") return;
    const b = cv.getBoundingClientRect();
    const x = (e.clientX - b.left) * W / b.width, y = (e.clientY - b.top) * H / b.height;
    goTo(roomOf(x, y));
    e.preventDefault();
  });
  // the arrow keys move him to the next room that way: up and down through the floors, left and right across one
  function neighbour(dir) {
    const cur = SC.rooms[here], px = (res.pos || posAt(s)).x, cb = cur.box;
    let bestR = -1, bestD = 1e9;
    for (const r of SC.rooms) {
      if (r === cur) continue;
      const b = r.box, overlapY = b[2] < cb[3] - 4 && b[3] > cb[2] + 4;
      let dd = -1;
      if (dir === "up" && b[3] <= cb[2] + 4) dd = (cb[2] - b[3]) + (px >= b[0] && px <= b[1] ? 0 : 1000);
      if (dir === "down" && b[2] >= cb[3] - 4) dd = (b[2] - cb[3]) + (px >= b[0] && px <= b[1] ? 0 : 1000);
      if (dir === "left" && overlapY && b[1] <= cb[0] + 4) dd = cb[0] - b[1];
      if (dir === "right" && overlapY && b[0] >= cb[1] - 4) dd = b[0] - cb[1];
      if (dd >= 0 && dd < bestD) { bestD = dd; bestR = r.idx; }
    }
    goTo(bestR);
  }
  const KEYS = { ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down", ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right" };
  addEventListener("keydown", e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const el = e.target instanceof Element ? e.target : null;
    if (KEYS[e.code]) {
      if (el && el !== document.body && el.closest("button")) return;
      e.preventDefault();
      if (state === "pause") { pause(false); return; }
      if (state === "play" && !e.repeat) neighbour(KEYS[e.code]);
    } else if (e.code === "Space" || e.code === "Enter") {
      if (el && el !== document.body && el.closest("button")) return;
      if (state === "ready" || (state === "over" && !$("over").hidden)) { e.preventDefault(); start(); }
      else if (state === "pause") { e.preventDefault(); pause(false); }
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
    const url = "https://rotville.world/games/lamp/", label = $("share").querySelector(".tape-label");
    const text = litCount === 0 ? "The house went dark on rotville.world before Fusegrin lit a single room."
      : "Fusegrin lit " + litCount + (litCount === 1 ? " room" : " rooms") + " on rotville.world before the house went dark.";
    if (navigator.share) {
      try { await navigator.share({ title: "Lamp", text, url }); return; } catch (err) { if (err && err.name === "AbortError") return; }
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

  Promise.all([fetch("assets/scene.json").then(r => r.json()), load("assets/lit.png"), load("assets/dark.png"), load("assets/front.png"), load("assets/sprites.png")])
    .then(([sc, a, b, c, d]) => { SC = sc; lit = a; dark = b; front = c; atlas = d; prepare(); reset(); ready = true; })
    .catch(() => { $("sub").textContent = "The tape would not load. Try the page again."; });
  requestAnimationFrame(frame);
})();
