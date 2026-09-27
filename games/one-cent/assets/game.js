/* One Cent: Red Light, Green Light under Big Barry's eye.

   Big Barry is the office building with one enormous eye on its roof: "the eye sometimes blinks. Do not stare
   for too long." Nickelpig will fight over a single cent, and "if it clinks, it is his". He may only move while
   the eye is shut. Holding on once it opens means Big Barry saw him: he goes back to where he started, and
   three of those end the run. From the third cent Misery Peter, the small displeased cloud that "is always
   watching", sweeps a patch of the road where moving counts as seen too. Nickelpig's crimes lose him money,
   so the last card always says it cost him more than he took.

   Only pre-rendered sprites ship (assets/sprites.png, assets/street.png). The residents are drawn at 15 fps
   under the 60 fps page, the way the clips hold them (R819, R1070). */
(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  const W = 270, H = 480;
  const cv = $("c"), g = cv.getContext("2d");
  g.imageSmoothingEnabled = false;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const coarse = matchMedia("(pointer: coarse)");
  const store = {
    get(k, d) { try { const v = localStorage.getItem("onecent." + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem("onecent." + k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
  };
  const load = src => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });

  const TRIES = 3;
  const RESIDENT_STEP = 1 / 15;          // residents update 15 times a second
  const OPENING = 0.25, CLOSING = 0.14;  // how long the lid takes, in seconds

  /* ---------- sound: the bed, three lines, the rest made on the spot ---------- */
  const audio = {
    ctx: null, on: store.get("sound", true), raw: {}, buf: {}, music: null,
    fetch() {
      for (const [k, f] of [["start", "assets/line-start.mp3"], ["seen", "assets/line-seen.mp3"], ["cost", "assets/line-cost.mp3"],
                            ["music", "assets/stairs-plucks.mp3"]]) {
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
      this.mus = c.createGain(); this.mus.gain.value = 0.06; this.mus.connect(this.out);
      this.vox = c.createGain(); this.vox.gain.value = 1; this.vox.connect(this.out);
      const n = c.createBuffer(1, c.sampleRate, c.sampleRate), d = n.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = n;
      for (const k of Object.keys(this.raw)) {
        this.buf[k] = this.raw[k].then(b => (b ? new Promise((ok, no) => c.decodeAudioData(b, ok, no)) : null)).catch(() => null);
      }
      this.buf.music.then(b => {
        if (!b || this.music) return;
        const s = c.createBufferSource(); s.buffer = b; s.loop = true; s.connect(this.mus); s.start(); this.music = s;
      });
    },
    // the music is the green light: up while the eye is shut, nearly gone while it looks
    bed(open) { if (this.ctx) this.mus.gain.setTargetAtTime(open ? 0.05 : 0.32, this.ctx.currentTime, 0.06); },
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
    opens() { this.tone(95, 55, 0.3, "sine", 0.3); this.tone(140, 210, 0.16, "sawtooth", 0.04); },
    shuts() { this.noise(0.03, 0.12, 200, 1200); },
    step() { this.noise(0.008, 0.06, 3000, 9000); },
    seen() { this.tone(311, 300, 0.45, "square", 0.08); this.tone(330, 318, 0.45, "square", 0.08); this.noise(0.2, 0.15, 400, 3000); },
    clink() { this.tone(2637, 2630, 0.35, "sine", 0.12); this.tone(3951, 3940, 0.25, "sine", 0.06); this.tone(2349, 2340, 0.3, "sine", 0.07, 0.08); },
  };
  audio.fetch();

  /* ---------- the game ---------- */
  let SC, atlas, street, ready = false;
  let state = "ready";                 // ready, play, seen, back, won, pause, over
  let cents, tries, round, t, drawnT, pose, eye, eyeT, eyeDur, lidShown, timer, seenBy, clock, sparks, holding = false;
  let stepAcc = 0, stepSound = 0, saidStart = false, lastStepT = 0;
  let best = store.get("best", 0);
  const pointers = new Set();
  let keyHeld = false;

  const rnd = (a, b) => a + Math.random() * (b - a);
  function hud() {
    $("cents").textContent = cents + "¢";
    $("tries").textContent = "●".repeat(tries) + "○".repeat(TRIES - tries);
    $("best").textContent = "Most cents " + best;
  }

  function nextEye(to) {
    eye = to; eyeT = 0;
    if (to === "open") {
      eyeDur = round === 0 && t === 0 && cents === 0 ? 1.4 : rnd(0.8, 1.9);
      audio.bed(true);
    } else if (to === "shut") {
      const short = round >= 1 && Math.random() < 0.22;
      eyeDur = short ? rnd(0.3, 0.45) : rnd(Math.max(0.5, 1.4 - 0.1 * round), Math.max(1.0, 2.4 - 0.15 * round));
      audio.bed(false);
    } else if (to === "opening") {
      audio.opens();
    } else if (to === "closing") {
      audio.shuts();
    }
  }

  function reset() {
    cents = 0; tries = TRIES; round = 0; t = 0; drawnT = 0; pose = 0; clock = 0; sparks = [];
    seenBy = null; lidShown = 0; resPose = 1;
    nextEye("open");
    hud();
  }

  function start() {
    audio.unlock();
    reset();
    state = "play";
    $("ready").hidden = true; $("over").hidden = true; $("mark").hidden = true;
    $("static").classList.remove("on");
    if (!saidStart) { saidStart = true; say("start", "If it clinks, it is his."); }
  }

  function say(k, text) {
    const sub = $("sub");
    sub.textContent = text;
    audio.line(k).then(d => setTimeout(() => { if (sub.textContent === text) sub.textContent = ""; }, Math.max(1600, d * 1000 + 300)));
  }

  function seen(by) {
    state = "seen"; seenBy = by; timer = 0;
    tries -= 1;
    audio.seen();
    audio.bed(true);
    const m = $("mark"); m.textContent = by === "peter" ? "MISERY PETER SAW THAT" : "SEEN"; m.hidden = false;
    if (by === "barry") say("seen", "Big Barry saw that.");
    hud();
  }

  function won() {
    state = "won"; timer = 0;
    cents += 1;
    audio.clink();
    const [cx, cy] = SC.cent_top || SC.cent;
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2, v = 0.02 + Math.random() * 0.05;
      sparks.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 0.03, t: clock, life: 0.4 + Math.random() * 0.4,
        c: ["#ffd27a", "#fff3c4", "#e8924a"][i % 3] });
    }
    const el = $("cents"); el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump");
    setTimeout(() => el.classList.remove("bump"), 160);
    if (cents > best) { best = cents; store.set("best", best); }
    hud();
  }

  function end() {
    state = "over"; timer = 0;
    const cost = cents * 2 + 3;          // his crimes lose him money, whatever the player does
    $("over-title").textContent = cents === 0 ? "Nickelpig took nothing." : "Nickelpig took " + cents + (cents === 1 ? " cent." : " cents.");
    $("over-line").textContent = cents === 0 ? "It cost him 3 anyway." : "It cost him " + cost + ".";
    $("over-stats").textContent = cents > 0 && cents === best ? "The most he has taken" : "Most cents " + best;
    if (!reduce) $("static").classList.add("on");
    say("cost", "It cost him more than that.");
    setTimeout(() => {
      if (state !== "over") return;
      $("static").classList.remove("on");
      $("mark").hidden = true;
      $("over").hidden = false;
      $("again").focus({ preventScroll: true });
    }, 1300);
  }

  // Misery Peter from the third cent: he drifts over the rooftops and watches a patch of the road
  const peterOn = () => round >= 2;
  function peterAt(time) {
    const sx = W / 2 + Math.sin(time * 0.35) * 90;
    const pt = 0.5 + Math.sin(time * 0.52) * 0.42;              // the part of the road he watches, 0 near, 1 far
    return { sx, pt };
  }
  function roadAt(pt) {
    const r = SC.road, f = pt * (r.length - 1), i = Math.min(r.length - 2, Math.floor(f)), k = f - i;
    const lerp = (a, b) => a + (b - a) * k;
    return { y: lerp(r[i].left[1], r[i + 1].left[1]), l: lerp(r[i].left[0], r[i + 1].left[0]), r: lerp(r[i].right[0], r[i + 1].right[0]) };
  }

  function update(dt) {
    clock += dt;
    if (state === "play") {
      eyeT += dt;
      if (eye === "open" && eyeT >= eyeDur) nextEye("closing");
      else if (eye === "closing" && eyeT >= CLOSING) nextEye("shut");
      else if (eye === "shut" && eyeT >= eyeDur) nextEye("opening");
      else if (eye === "opening" && eyeT >= OPENING) nextEye("open");

      const grace = Math.max(0.15, 0.22 - 0.012 * round);
      const danger = eye === "open" || (eye === "opening" && eyeT > grace);
      if (holding && danger) return seen("barry");
      if (holding && eye === "shut") {
        if (peterOn()) {
          const p = peterAt(clock);
          if (Math.abs(p.pt - t) < 0.075) return seen("peter");
        }
        t = Math.min(1, t + (0.115 + 0.005 * round) * dt);
        if (clock - lastStepT > 0.13) { lastStepT = clock; audio.step(); }
        if (t >= 1) return won();
      }
    } else if (state === "seen") {
      timer += dt;
      if (timer > 1.5) {
        $("mark").hidden = true;
        if (tries <= 0) return end();
        state = "back"; timer = 0;
      }
    } else if (state === "back") {
      timer += dt;
      t = Math.max(0, t - dt * 1.6);
      if (t <= 0) { state = "play"; resPose = 1; nextEye("open"); eyeDur = 1.2; }
    } else if (state === "won") {
      timer += dt;
      if (timer > 1.3) { round += 1; t = 0; drawnT = 0; resPose = 1; state = "play"; nextEye("open"); eyeDur = 1.0; }
    }
  }

  /* ---------- drawing ---------- */
  const spr = (k, x, y) => {
    const s = SC.sprites[k];
    g.drawImage(atlas, s[0], s[1], s[2], s[3], Math.round(x), Math.round(y), s[2], s[3]);
  };
  function lidAmount() {
    if (eye === "closing") return Math.min(1, eyeT / CLOSING);
    if (eye === "shut") return 1;
    if (eye === "opening") return Math.max(0, 1 - eyeT / OPENING);
    return 0;
  }

  function draw() {
    // the residents are sampled at 15 fps: the pig, the lid and the cloud hold between steps
    stepAcc += 1;
    g.drawImage(street, 0, 0);

    if (peterOn() && (state === "play" || state === "seen")) {
      const p = peterAt(resClock), r = roadAt(p.pt), w = (r.r - r.l) * 0.42, cx = (r.l + r.r) / 2;
      g.fillStyle = seenBy === "peter" && state === "seen" ? "rgba(255,80,110,.30)" : "rgba(170,140,230,.20)";
      g.beginPath(); g.ellipse(cx, r.y, w / 2, Math.max(2, w * 0.11), 0, 0, Math.PI * 2); g.fill();
    }

    if (state !== "won" && state !== "over") {
      const c = SC.sprites.cent;
      spr("cent", c[4], c[5]);
      if (!reduce && Math.floor(clock * 1.3) % 2 === 0 && (clock * 1.3) % 1 < 0.12) {
        g.fillStyle = "#fff6d0"; g.fillRect(c[4] + 2, c[5] + 1, 1, 1);
      }
    }

    // Nickelpig at his sampled place on the road
    const P = SC.pig, f = resT * (P.length - 1), i = Math.min(P.length - 2, Math.floor(f)), k = f - i;
    const gx = P[i][0] + (P[i + 1][0] - P[i][0]) * k, gy = P[i][1] + (P[i + 1][1] - P[i][1]) * k;
    const near = Math.round(f), key = "pig_" + String(near).padStart(2, "0") + "_" + resPose;
    const s = SC.sprites[key], anchor = P[near];
    const sw = s[2];
    g.fillStyle = "rgba(0,0,0,.35)";
    g.beginPath(); g.ellipse(gx, gy + 1, sw * 0.32, Math.max(1.5, sw * 0.07), 0, 0, Math.PI * 2); g.fill();
    const px = gx + (s[4] - anchor[0]), py = gy + (s[5] - anchor[1]);
    if (!(state === "back" && Math.floor(clock * 10) % 2)) g.drawImage(atlas, s[0], s[1], s[2], s[3], Math.round(px), Math.round(py), s[2], s[3]);
    if (state === "seen") {
      g.fillStyle = "#ff4b5c";
      const ex = Math.round(gx) - 1, ey = Math.round(py) - 10;
      g.fillRect(ex, ey, 3, 6); g.fillRect(ex, ey + 8, 3, 2);
    }

    // Big Barry's lid, lowered from the top of the eye
    const L = SC.sprites.lid, amt = resLid;
    if (amt > 0) {
      const hh = Math.max(1, Math.round(L[3] * amt));
      g.drawImage(atlas, L[0], L[1], L[2], hh, L[4], L[5], L[2], hh);
    }
    if (state === "seen" && seenBy === "barry") {
      const [ex, ey] = SC.eye.centre, rr = (SC.eye.bottom[1] - SC.eye.top[1]) / 2;
      const gr = g.createRadialGradient(ex, ey, 1, ex, ey, rr);
      gr.addColorStop(0, "rgba(255,60,70,.55)"); gr.addColorStop(1, "rgba(255,60,70,0)");
      g.fillStyle = gr; g.fillRect(ex - rr, ey - rr, rr * 2, rr * 2);
    }

    // Misery Peter over the rooftops
    if (peterOn() && state !== "over") {
      const p = peterAt(resClock), ps = SC.sprites.peter;
      // below the eye, never across it: the eye is the one thing the player must always see
      const eyeBottom = Math.ceil(SC.eye.bottom[1]) + 6;
      spr("peter", p.sx - ps[2] / 2, eyeBottom + 26 + Math.round(Math.sin(resClock * 1.3) * 2));
    }

    sparks = sparks.filter(q => clock - q.t < q.life);
    for (const q of sparks) {
      const a = (clock - q.t) * 1000;
      g.fillStyle = q.c; g.fillRect(Math.round(q.x + q.vx * a), Math.round(q.y + q.vy * a + 0.00004 * a * a), 1, 1);
    }
  }

  // the sampled state the residents are drawn at
  let resT = 0, resPose = 1, resLid = 0, resClock = 0, resAcc = 0;
  function sample(dt) {
    resAcc += dt;
    if (resAcc < RESIDENT_STEP && !reduce) return;
    resAcc = reduce ? 0 : resAcc % RESIDENT_STEP;
    const moving = Math.abs(t - resT) > 1e-5;
    // his gait from the race in 106, "working harder than anyone here, and moving less", half as fast again, which
    // the user asked for to make it comical. 106 rolls him every six frames, three poses at 15 fps; here he flips
    // from one tipped pose to the other on every step, 7.5 rocks a second, the quickest a resident held at 15 fps
    // can go, while he gains a few centimetres. Pose 1 is the upright one he starts in.
    if (moving && state === "play" && !reduce) resPose = resPose === 0 ? 2 : 0;
    resT = t; resLid = lidAmount(); resClock = clock;
  }

  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (!ready) return;
    holding = (pointers.size > 0 || keyHeld) && state === "play";
    $("hold").classList.toggle("on", holding);
    if (state !== "pause" && state !== "ready" && state !== "over") update(dt);
    sample(dt);
    draw();
  }

  /* ---------- input: one control, held ---------- */
  const area = $("area");
  const isControl = el => el.closest("button:not(#hold), a");
  area.addEventListener("pointerdown", e => {
    if (isControl(e.target)) return;
    if (state === "pause") { pause(false); return; }
    if (state === "ready" || state === "over") return;
    pointers.add(e.pointerId);
    try { e.target.setPointerCapture(e.pointerId); } catch (err) { /* not capturable */ }
    e.preventDefault();
  });
  const up = e => { pointers.delete(e.pointerId); };
  area.addEventListener("pointerup", up);
  area.addEventListener("pointercancel", up);
  area.addEventListener("lostpointercapture", up);
  addEventListener("blur", () => { pointers.clear(); keyHeld = false; });
  const HOLD_KEYS = new Set(["Space", "ArrowUp", "KeyW"]);
  addEventListener("keydown", e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (HOLD_KEYS.has(e.code)) {
      const el = e.target instanceof Element ? e.target : null;
      if (el && el !== document.body && el.closest("button")) return;
      e.preventDefault();
      if (state === "ready") { start(); return; }
      if (state === "pause") { pause(false); return; }
      keyHeld = true;
    } else if (e.code === "KeyP" || e.code === "Escape") {
      if (state === "play") pause(true); else if (state === "pause") pause(false);
    } else if (e.code === "Enter" && (state === "ready" || (state === "over" && !$("over").hidden)) && e.target === document.body) {
      e.preventDefault(); start();
    }
  });
  addEventListener("keyup", e => { if (HOLD_KEYS.has(e.code)) keyHeld = false; });

  let before = "play";
  function pause(on) {
    if (on && ["play", "seen", "back", "won"].includes(state)) {
      before = state; state = "pause"; pointers.clear(); keyHeld = false;
      const m = $("mark"); m.textContent = "PAUSE ▮▮"; m.hidden = false;
      if (audio.ctx) audio.ctx.suspend();
    } else if (!on && state === "pause") {
      state = before; $("mark").hidden = true; audio.unlock();
    }
  }
  document.addEventListener("visibilitychange", () => { if (document.hidden) pause(true); });

  $("play").addEventListener("click", start);
  $("again").addEventListener("click", start);
  $("share").addEventListener("click", async () => {
    const url = "https://rotville.world/games/one-cent/", label = $("share").querySelector(".tape-label");
    const text = cents === 0 ? "Nickelpig took nothing on rotville.world. It cost him 3 anyway."
      : "Nickelpig took " + cents + (cents === 1 ? " cent" : " cents") + " on rotville.world. It cost him " + (cents * 2 + 3) + ".";
    if (navigator.share) {
      try { await navigator.share({ title: "One Cent", text, url }); return; } catch (err) { if (err && err.name === "AbortError") return; }
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

  Promise.all([fetch("assets/scene.json").then(r => r.json()), load("assets/sprites.png"), load("assets/street.png")])
    .then(([sc, a, s]) => { SC = sc; atlas = a; street = s; reset(); ready = true; })
    .catch(() => { $("sub").textContent = "The tape would not load. Try the page again."; });
  requestAnimationFrame(frame);
})();
