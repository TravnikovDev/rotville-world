/* Slots: the one machine of the Lower Sewers Casino.

   Three reels that spin as reels do. Most of the symbols are residents' faces - Old Parp, the Eyemare, Shushworth,
   Nickelpig, Still Clive, Big Barry, CCPP and Shytan - and the rest are a slot's own: 7, BAR, a bell and a cherry.
   Three of one face on the line, and that resident comes out of the machine, over the game, at full size: the
   screamer. Two of one face, and one of them looks up from the bottom of the screen. All eight are in it by the
   user's word of 2026-10-18, an exception to the one-to-three of R1090, as Pinball's was (R1100).

   Each spin's result is drawn first, by weight, and the reels are then stopped on it. The faces and the screamers
   are pre-rendered stills of the residents' models; only those ship. */
(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k === "sound" ? "rotville.sound" : "slots." + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k === "sound" ? "rotville.sound" : "slots." + k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
  };
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const cap = s => s[0].toUpperCase() + s.slice(1);
  const wait = ms => new Promise(ok => setTimeout(ok, ms));

  /* ---------- the symbols ---------- */
  const FACES = {
    "old-parp":    { name: "Old Parp",    shout: "YOU INTERRUPTED HIM" },
    "the-eyemare": { name: "the Eyemare", shout: "IT TURNED TO YOU" },
    "shushworth":  { name: "Shushworth",  shout: "PAY FOR THE QUIET" },
    "nickelpig":   { name: "Nickelpig",   shout: "IT CLINKED. IT IS HIS." },
    "still-clive": { name: "Still Clive", shout: "HE WAS ALWAYS HERE" },
    "big-barry":   { name: "Big Barry",   shout: "YOU STARED TOO LONG" },
    "ccpp":        { name: "CCPP",        shout: "IT IS SHOWING YOU NOW" },
    "shytan":      { name: "Shytan",      shout: "YOU LOOKED AT HIM" },
  };
  const FACE_IDS = Object.keys(FACES);
  const CLASSIC = ["seven", "bar", "bell", "cherry"];
  const isFace = s => s in FACES;
  // how often each symbol turns up where nothing is decided: faces most, the 7 least
  const FILL = [...FACE_IDS.flatMap(f => [f, f]), "bell", "bell", "cherry", "cherry", "cherry", "bar", "bar", "seven"];

  function symHTML(s) {
    if (isFace(s)) return `<img src="assets/faces/${s}.webp" alt="" draggable="false">`;
    if (s === "seven") return `<span class="seven">7</span>`;
    if (s === "bar") return `<span class="bar">BAR</span>`;
    if (s === "bell") return `<span class="c">🔔</span>`;
    return `<span class="c">🍒</span>`;
  }

  // the result of a spin, drawn before the reels move; the pays are times the bet, and two faces pay nothing
  const OUTCOMES = [
    { kind: "scream", w: 0.14, pays: 3 },
    { kind: "peek",   w: 0.22, pays: 0 },
    { kind: "seven",  w: 0.008, pays: 20 },
    { kind: "bar",    w: 0.015, pays: 8 },
    { kind: "bell",   w: 0.025, pays: 4 },
    { kind: "cherry", w: 0.045, pays: 2 },
  ];
  let forced = null;                         // #debug: the next spin's result, for a bot or a promo
  function roll() {
    if (forced) { const f = forced; forced = null; return f; }
    let r = Math.random();
    for (const o of OUTCOMES) { if (r < o.w) return draw(o); r -= o.w; }
    return draw({ kind: "nothing", pays: 0 });
  }
  function draw(o, face) {
    if (o.kind === "scream") { const f = face || pick(FACE_IDS); return { ...o, face: f, line: [f, f, f] }; }
    if (o.kind === "peek") {
      const f = face || pick(FACE_IDS), other = pick(FILL.filter(s => s !== f)), r = Math.random();
      const line = r < 0.5 ? [f, f, other] : r < 0.75 ? [f, other, f] : [other, f, f];
      return { ...o, face: f, line };
    }
    if (o.kind !== "nothing") return { ...o, line: [o.kind, o.kind, o.kind] };
    for (;;) {
      const line = [pick(FILL), pick(FILL), pick(FILL)];
      const same = (a, b) => line[a] === line[b];
      if (same(0, 1) && same(1, 2)) continue;
      if ((same(0, 1) && isFace(line[0])) || (same(1, 2) && isFace(line[1])) || (same(0, 2) && isFace(line[0]))) continue;
      return { ...o, line };
    }
  }

  /* ---------- sound: the casino's bed and the vine boom, the rest made on the spot ---------- */
  const audio = {
    ctx: null, on: store.get("sound", true), raw: {}, buf: {}, music: null,
    fetch() {
      for (const [k, f] of [["music", "assets/ka-ching.mp3"], ["boom", "assets/boom.mp3"]]) {
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
      this.mus = c.createGain(); this.mus.gain.value = 0.16; this.mus.connect(this.master);
      this.yell = c.createGain(); this.yell.gain.value = 0.55; this.yell.connect(this.master);
      const n = c.createBuffer(1, c.sampleRate, c.sampleRate), d = n.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = n;
      const curve = new Float32Array(1024);
      for (let i = 0; i < curve.length; i++) { const x = i / 512 - 1; curve[i] = Math.tanh(x * 6); }
      this.curve = curve;
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
    duck(to, back) {
      if (!this.ctx) return;
      const g = this.mus.gain, t = this.ctx.currentTime;
      g.cancelScheduledValues(t); g.setTargetAtTime(to, t, 0.03); g.setTargetAtTime(0.16, t + back, 0.3);
    },
    tone(f0, f1, dur, type = "square", vol = 0.12, when = 0, out = this.fxg) {
      if (!this.ctx) return;
      const c = this.ctx, t = c.currentTime + when, o = c.createOscillator(), e = c.createGain();
      o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
      e.gain.setValueAtTime(0.0008, t); e.gain.exponentialRampToValueAtTime(vol, t + 0.012); e.gain.exponentialRampToValueAtTime(0.0008, t + dur);
      o.connect(e).connect(out); o.start(t); o.stop(t + dur + 0.03);
    },
    noise(dur, vol, lo, hi, when = 0, out = this.fxg) {
      if (!this.ctx) return;
      const c = this.ctx, t = c.currentTime + when, s = c.createBufferSource(), a = c.createBiquadFilter(), b = c.createBiquadFilter(), e = c.createGain();
      s.buffer = this.noiseBuf; s.loop = true; a.type = "highpass"; a.frequency.value = lo; b.type = "lowpass"; b.frequency.value = hi;
      e.gain.setValueAtTime(vol, t); e.gain.exponentialRampToValueAtTime(0.0008, t + dur);
      s.connect(a).connect(b).connect(e).connect(out); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.03);
    },
    play(k, vol = 1) {
      if (!this.ctx) return;
      this.buf[k].then(b => {
        if (!b) return;
        const s = this.ctx.createBufferSource(), e = this.ctx.createGain(); e.gain.value = vol;
        s.buffer = b; s.connect(e).connect(this.yell); s.start();
      });
    },
    lever() { this.noise(0.14, 0.09, 600, 5000); this.tone(220, 90, 0.18, "square", 0.05); this.tone(1700, 1500, 0.1, "sine", 0.03, 0.12); },
    tick() { this.noise(0.018, 0.035, 2500, 8000); },
    thunk() { this.tone(150, 55, 0.14, "square", 0.1); this.noise(0.06, 0.07, 200, 1800); },
    tension(dur) {
      if (!this.ctx) return;
      const c = this.ctx, t = c.currentTime;
      for (const det of [0, 7]) {
        const o = c.createOscillator(), e = c.createGain();
        o.type = "sawtooth"; o.frequency.setValueAtTime(70 + det, t); o.frequency.exponentialRampToValueAtTime(190 + det, t + dur);
        e.gain.setValueAtTime(0.0008, t); e.gain.exponentialRampToValueAtTime(0.05, t + dur * 0.8); e.gain.exponentialRampToValueAtTime(0.0008, t + dur + 0.05);
        o.connect(e).connect(this.fxg); o.start(t); o.stop(t + dur + 0.1);
      }
      for (let b = 0; b < dur - 0.2; b += 0.42) { this.tone(70, 40, 0.12, "sine", 0.3, b); this.tone(64, 38, 0.12, "sine", 0.22, b + 0.16); }
    },
    // the screamer: a shriek of detuned saws through a hard clip, a burst of noise and the boom
    scream() {
      if (!this.ctx) return;
      const c = this.ctx, t = c.currentTime, ws = c.createWaveShaper(), e = c.createGain(), lp = c.createBiquadFilter();
      ws.curve = this.curve; lp.type = "lowpass"; lp.frequency.value = 5200;
      e.gain.setValueAtTime(0.0008, t); e.gain.exponentialRampToValueAtTime(0.5, t + 0.02); e.gain.setValueAtTime(0.5, t + 0.6); e.gain.exponentialRampToValueAtTime(0.0008, t + 1.05);
      ws.connect(lp).connect(e).connect(this.yell);
      for (const [f, d] of [[620, 0], [655, 0.004], [930, 0.01], [1240, 0.006]]) {
        const o = c.createOscillator(), l = c.createOscillator(), lg = c.createGain();
        o.type = "sawtooth"; o.frequency.setValueAtTime(f * 0.7, t + d); o.frequency.exponentialRampToValueAtTime(f * 1.35, t + 0.12); o.frequency.exponentialRampToValueAtTime(f * 0.8, t + 1);
        l.frequency.value = 23; lg.gain.value = f * 0.06; l.connect(lg).connect(o.frequency);
        o.connect(ws); o.start(t + d); l.start(t); o.stop(t + 1.1); l.stop(t + 1.1);
      }
      this.noise(0.5, 0.35, 900, 9000, 0, this.yell);
      this.play("boom", 0.9);
      this.duck(0.02, 1.4);
    },
    peek() { this.tone(1500, 320, 0.22, "square", 0.07); this.noise(0.12, 0.06, 1500, 6000); this.tone(90, 50, 0.25, "sine", 0.25); },
    coin(i = 0) { this.tone(1975, 1975, 0.07, "triangle", 0.07, i * 0.07); this.tone(2637, 2637, 0.12, "triangle", 0.06, i * 0.07 + 0.05); },
    win(big) {
      const notes = big ? [523, 659, 784, 1047, 784, 1047, 1319] : [659, 784, 1047];
      notes.forEach((f, i) => this.tone(f, f, 0.14, "square", 0.06, i * 0.09));
    },
    nothing() { this.tone(330, 300, 0.12, "triangle", 0.05); },
    bet() { this.tone(880, 900, 0.05, "square", 0.04); },
  };
  window.rvBuzz?.on(audio, { scream: "hit", peek: "bump", thunk: 8, win: "good" });
  audio.fetch();

  /* ---------- the reels ---------- */
  const ROW = 80, CENTER = 126, V = 1900;    // a row's height, the payline's height in the window, and the spin's speed
  const reels = [];
  function makeReels() {
    const host = $("reels");
    host.textContent = "";
    for (let r = 0; r < 3; r++) {
      const el = document.createElement("div"); el.className = "reel";
      const strip = document.createElement("div"); strip.className = "strip"; el.append(strip);
      const cells = [];
      for (let k = 0; k < 5; k++) { const c = document.createElement("div"); c.className = "sym"; c.style.position = "absolute"; c.style.left = "0"; c.style.right = "0"; strip.append(c); cells.push({ el: c, sym: null, i: null }); }
      host.append(el);
      // cell i sits at CENTER + pos - i * ROW; a bigger i is higher up, so the symbols come down from the top
      reels.push({ el, strip, cells, pos: 0, map: new Map(), mode: "still", v: 0, t: 0, from: 0, to: 0, dur: 0, stopAt: 0, lastCell: 0 });
    }
  }
  const symAt = (R, i) => { if (!R.map.has(i)) R.map.set(i, pick(FILL)); return R.map.get(i); };
  function paint(R) {
    const base = Math.round(R.pos / ROW);
    R.cells.forEach((c, k) => {
      const i = base - 2 + k, s = symAt(R, i);
      if (c.i !== i || c.sym !== s) { c.el.innerHTML = symHTML(s); c.sym = s; c.i = i; c.el.classList.remove("won", "hot"); }
      c.el.style.transform = `translateY(${CENTER + R.pos - i * ROW - ROW / 2}px)`;
    });
    R.strip.classList.toggle("fast", R.v > 1200);
    R.strip.classList.toggle("slow", R.v > 300 && R.v <= 1200);
  }
  const middle = R => R.cells.find(c => c.i === Math.round(R.pos / ROW));

  // stop a running reel on `sym`, `cells` rows from now: an even slow-down, then a small bounce
  function stopReel(R, sym, cells) {
    const land = Math.ceil(R.pos / ROW) + cells;
    for (const [i] of R.map) if (i > land + 3 || i < land - 3) R.map.delete(i);   // keep the memory small
    R.map.set(land, sym);
    R.mode = "stopping"; R.t = 0; R.from = R.pos; R.to = land * ROW; R.dur = 2 * (R.to - R.from) / V;
  }

  let last = performance.now(), tickT = 0;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    for (const R of reels) {
      if (R.mode === "wind") {           // the reel kicks back a little before it goes
        R.t += dt; const u = Math.min(1, R.t / 0.12); R.pos = R.from - 16 * Math.sin(u * Math.PI / 2); R.v = 0;
        if (u >= 1) { R.mode = "run"; R.t = 0; R.from = R.pos; }
      } else if (R.mode === "run") {
        R.t += dt; R.v = Math.min(V, V * (R.t / 0.18 + 0.2)); R.pos += R.v * dt;
      } else if (R.mode === "stopping") {
        R.t += dt; const u = Math.min(1, R.t / R.dur);
        R.pos = R.from + (R.to - R.from) * (1 - (1 - u) * (1 - u)); R.v = V * (1 - u);
        if (u >= 1) { R.mode = "bounce"; R.t = 0; R.v = 0; audio.thunk(); R.onLand?.(); }
      } else if (R.mode === "bounce") {
        R.t += dt; const u = Math.min(1, R.t / 0.22);
        R.pos = R.to + 10 * Math.sin(u * Math.PI) * (1 - u);
        if (u >= 1) { R.mode = "still"; R.pos = R.to; }
      }
      if (R.mode !== "still" || R.dirty) { paint(R); R.dirty = false; }
      const cell = Math.floor(R.pos / ROW);
      if (cell !== R.lastCell) { R.lastCell = cell; if (R.v > 200 && (tickT -= 1) <= 0) { audio.tick(); tickT = 1; } }
    }
    tickT = Math.max(0, tickT - dt * 30);
    requestAnimationFrame(frame);
  }

  /* ---------- the game ---------- */
  const START = 100, BETS = [1, 2, 3, 5, 10];
  let cents = START, betI = 3, state = "ready", spins = 0, seenRound = 0, outcome = null, slam = null;
  let best = store.get("best", START), seen = store.get("seen", 0);

  const stage = $("stage"), cab = $("cab");
  function hud() {
    $("cents").textContent = cents;
    $("bet").textContent = BETS[betI];
    $("best").textContent = "Most cents " + best;
    $("seen").textContent = "Screamers seen " + seen;
    const busy = state !== "idle";
    $("less").disabled = busy || betI === 0;
    $("more").disabled = busy || betI === BETS.length - 1 || BETS[betI + 1] > cents;
    $("max").disabled = busy || BETS[betI] === Math.min(10, cents);
  }
  function bump(id) { const b = $(id); b.classList.remove("bump"); void b.offsetWidth; b.classList.add("bump"); }
  function setBet(i) {
    i = Math.max(0, Math.min(BETS.length - 1, i));
    while (i > 0 && BETS[i] > cents) i--;
    if (i === betI) return;
    betI = i; audio.bet(); bump("bet"); hud();
  }
  function fitBet() { while (betI > 0 && BETS[betI] > cents) betI--; }

  let sayTimer = 0;
  function say(text, ms = 2600) {
    const el = $("say"); el.textContent = text;
    clearTimeout(sayTimer); sayTimer = setTimeout(() => { el.textContent = ""; }, ms);
  }

  function start() {
    audio.unlock();
    cents = START; betI = 3; spins = 0; seenRound = 0; state = "idle";
    $("ready").hidden = true; $("over").hidden = true; $("table").hidden = true;
    $("win").textContent = "0";
    hud();
  }

  function spin() {
    if (state === "spinning") { slamStop(); return; }
    if (state !== "idle") return;
    audio.unlock();
    const bet = BETS[betI];
    if (cents < bet) { fitBet(); hud(); return; }
    cents -= bet; spins++; state = "spinning";
    $("win").textContent = "0"; $("banner").classList.remove("on"); stage.classList.remove("won", "tense");
    for (const R of reels) R.cells.forEach(c => c.el.classList.remove("won", "hot"));
    $("spin").textContent = "STOP"; $("spin").classList.add("stop");
    const lev = $("lever"); lev.classList.add("pulled"); setTimeout(() => lev.classList.remove("pulled"), 260);
    audio.lever(); hud();

    outcome = roll();
    const o = outcome, tense = isFace(o.line[0]) && o.line[0] === o.line[1];
    const stops = [0.8, 1.15, tense ? 2.75 : 1.5];
    let landed = 0, slammed = false;
    const t0 = performance.now(), timers = [];
    reels.forEach((R, r) => {
      R.mode = "wind"; R.t = 0; R.from = R.pos;
      R.onLand = () => {
        landed++;
        if (r === 1 && tense && !slammed) { stage.classList.add("tense"); audio.tension(stops[2] - stops[1]); markHot(); }
        if (landed === 3) { R.onLand = null; finish(bet); }
      };
      timers.push(setTimeout(() => { if (R.mode === "run" || R.mode === "wind") stopReel(R, o.line[r], 7); }, stops[r] * 1000));
    });
    slam = () => {
      if (performance.now() - t0 < 250) return;     // the first press is the spin itself
      slammed = true; timers.forEach(clearTimeout);
      reels.forEach((R, r) => { if (R.mode === "run" || R.mode === "wind") { if (R.mode === "wind") { R.mode = "run"; R.v = V; } stopReel(R, o.line[r], 2 + r); } });
    };
  }
  function slamStop() { slam?.(); }
  function markHot() {
    const f = outcome.line[0];
    reels.slice(0, 2).forEach(R => { const c = middle(R); if (c && c.sym === f) c.el.classList.add("hot"); });
  }

  async function finish(bet) {
    slam = null; state = "paying";
    $("spin").textContent = "SPIN"; $("spin").classList.remove("stop");
    const o = outcome, won = o.pays * bet;
    stage.classList.remove("tense");
    if (o.kind === "scream") await screamer(o.face);
    else if (o.kind === "peek") peek(o.face);
    if (won > 0) {
      reels.forEach(R => { const c = middle(R); c?.el.classList.add("won"); c?.el.classList.remove("hot"); });
      $("banner").textContent = o.kind === "scream" ? FACES[o.face].name.toUpperCase() + " · " + won : "WIN " + won;
      $("banner").classList.add("on"); stage.classList.add("won");
      audio.win(o.pays >= 8);
      coins(Math.min(18, 4 + won));
      await countUp(won);
      setTimeout(() => { $("banner").classList.remove("on"); stage.classList.remove("won"); }, 1400);
    } else if (o.kind === "nothing") audio.nothing();
    if (cents > best) { best = cents; store.set("best", best); }
    fitBet();
    if (cents < BETS[0]) { await wait(o.kind === "peek" ? 900 : 400); return over(); }
    state = "idle"; hud();
  }

  function countUp(n) {
    return new Promise(ok => {
      let k = 0;
      const step = Math.max(1, Math.round(n / 14));
      const iv = setInterval(() => {
        const d = Math.min(step, n - k); k += d; cents += d;
        $("win").textContent = k; $("cents").textContent = cents; bump("cents");
        if (k % (step * 2) === 0 || k === n) audio.coin();
        if (k >= n) { clearInterval(iv); ok(); }
      }, 55);
    });
  }

  function coins(n) {
    if (reduce) return;
    const host = $("coins");
    for (let i = 0; i < n; i++) {
      const c = document.createElement("span"); c.className = "coin";
      const x0 = 180 + rnd(-60, 60), y0 = 600, x1 = x0 + rnd(-150, 150), peak = rnd(260, 420), dur = rnd(900, 1300);
      c.style.left = x0 - 11 + "px"; c.style.top = y0 + "px";
      host.append(c);
      c.animate([
        { transform: "translate(0,0) rotateY(0deg)" },
        { transform: `translate(${(x1 - x0) / 2}px,${-peak}px) rotateY(540deg)`, offset: 0.45 },
        { transform: `translate(${x1 - x0}px,40px) rotateY(1080deg)` },
      ], { duration: dur, delay: i * 40, easing: "cubic-bezier(.3,.6,.6,1)", fill: "both" }).finished.then(() => c.remove(), () => c.remove());
    }
  }

  /* ---------- the screamer, and the one who looks out ---------- */
  function screamer(f) {
    seen++; seenRound++; store.set("seen", seen);
    const src = `assets/scream/${f}.webp`, face = $("face"), sc = $("scream");
    const ys = [rnd(120, 220), rnd(300, 400)];
    face.innerHTML = `<img src="${src}" alt=""><img class="r" src="${src}" alt=""><img class="g" src="${src}" alt="">`
      + `<span class="lines"></span>`
      + ys.map((y, k) => `<span class="slice" style="top:${y}px;height:${Math.round(rnd(14, 34))}px;transform:translateX(${k ? -22 : 26}px)"><img src="${src}" alt="" style="top:${-y}px"></span>`).join("");
    const lines = face.querySelector(".lines");
    lines.style.webkitMaskImage = lines.style.maskImage = `url(${src})`;
    $("shout").textContent = FACES[f].shout;
    sc.classList.remove("on"); stage.classList.remove("screaming"); void sc.offsetWidth;
    sc.classList.add("on"); stage.classList.add("screaming");
    if (!reduce) { $("static").classList.add("on"); setTimeout(() => $("static").classList.remove("on"), 140); }
    audio.scream();
    return wait(reduce ? 950 : 1150).then(() => {
      sc.classList.remove("on"); stage.classList.remove("screaming");
      if (!reduce) { $("static").classList.add("on"); setTimeout(() => $("static").classList.remove("on"), 90); }
      say(cap(FACES[f].name) + " came out to see who was playing.");
      hud();
    });
  }

  function peek(f) {
    const p = $("peek"), img = p.querySelector("img");
    img.src = `assets/scream/${f}.webp`;
    p.classList.remove("on", "off"); void p.offsetWidth; p.classList.add("on");
    audio.peek();
    setTimeout(() => { p.classList.remove("on"); p.classList.add("off"); }, 650);
    setTimeout(() => say(cap(FACES[f].name) + " looked out of the machine.", 2200), 300);
  }

  function over() {
    state = "over"; hud();
    window.rvBuzz?.("over");
    $("over-line").textContent = seenRound === 0 ? "Nobody came out for you. Nobody leaves." : "Nobody leaves.";
    $("over-stats").textContent = spins + (spins === 1 ? " spin" : " spins") + " · " + seenRound + (seenRound === 1 ? " screamer" : " screamers") + " · most cents " + best;
    $("over").hidden = false;
    $("again").focus({ preventScroll: true });
  }

  /* ---------- the pays card ---------- */
  function paylist() {
    const row = (icons, k, v) => `<li><span class="i">${icons}${k ? `<small>${k}</small>` : ""}</span><span class="v">${v}</span></li>`;
    const icon = s => isFace(s) ? `<img src="assets/faces/${s}.webp" alt="">` : s === "seven" ? `<b class="sl-seven">7</b>` : s === "bar" ? `<b class="sl-barb">BAR</b>` : s === "bell" ? "🔔" : "🍒";
    $("paylist").innerHTML = [
      row(icon("seven").repeat(3), "", "20 × bet"),
      row(icon("bar").repeat(3), "", "8 × bet"),
      row(icon("bell").repeat(3), "", "4 × bet"),
      row(icon("cherry").repeat(3), "", "2 × bet"),
      row(icon("shushworth").repeat(3), "any face", "3 × bet, and it comes out"),
    ].join("");
  }
  function table(open) {
    if (state === "spinning" || state === "paying" || state === "over") return;
    $("table").hidden = !open;
    if (open) $("close").focus({ preventScroll: true });
  }

  /* ---------- the stage fits the screen ---------- */
  const screen = $("screen");
  const fit = () => { stage.style.transform = `scale(${screen.clientWidth / 360})`; };
  new ResizeObserver(fit).observe(screen);
  fit();

  /* ---------- controls ---------- */
  makeReels();
  reels.forEach((R, r) => { R.pos = 0; R.map.set(0, FACE_IDS[r * 2]); R.dirty = true; });
  paylist();
  hud();
  requestAnimationFrame(frame);

  $("spin").addEventListener("click", spin);
  $("lever").addEventListener("click", spin);
  $("less").addEventListener("click", () => setBet(betI - 1));
  $("more").addEventListener("click", () => setBet(betI + 1));
  $("max").addEventListener("click", () => { let i = BETS.length - 1; while (i > 0 && BETS[i] > cents) i--; setBet(i); });
  $("pays").addEventListener("click", () => table(true));
  $("close").addEventListener("click", () => table(false));
  $("play").addEventListener("click", start);
  $("again").addEventListener("click", start);
  addEventListener("keydown", e => {
    if (e.target.closest && e.target.closest("button") && (e.code === "Space" || e.code === "Enter")) return;   // a focused button presses itself
    if (e.code === "Space" || e.code === "Enter") {
      e.preventDefault();
      if (!$("ready").hidden) start(); else if (!$("over").hidden) start(); else if (!$("table").hidden) table(false); else spin();
    } else if (e.code === "ArrowUp" && state === "idle") { e.preventDefault(); setBet(betI + 1); }
    else if (e.code === "ArrowDown" && state === "idle") { e.preventDefault(); setBet(betI - 1); }
    else if (e.code === "Escape") table(false);
  });
  document.addEventListener("visibilitychange", () => { if (document.hidden && audio.ctx) audio.ctx.suspend(); else if (!document.hidden && audio.ctx && state !== "ready") audio.ctx.resume(); });

  $("share").addEventListener("click", async () => {
    const url = "https://rotville.world/games/slots/", label = $("share").querySelector(".tape-label");
    const text = seenRound === 0 ? "I lost every cent to the slot machine of the Lower Sewers Casino on rotville.world, and nobody even came out."
      : "I lost every cent to the slot machine of the Lower Sewers Casino on rotville.world. " + (seenRound === 1 ? "One of them" : seenRound + " of them") + " came out to see who was playing.";
    if (navigator.share) {
      try { await navigator.share({ title: "Slots", text, url }); return; } catch (err) { if (err && err.name === "AbortError") return; }
    }
    try { await navigator.clipboard.writeText(text + " " + url); label.textContent = "Copied"; } catch (err) { label.textContent = "Could not copy"; }
    setTimeout(() => { label.textContent = "Share"; }, 1600);
  });
  // a bot or a promo recording can set the next result through this, on a page opened with #debug
  if (location.hash === "#debug") {
    window.slots = {
      next(kind, face) { forced = draw(OUTCOMES.find(x => x.kind === kind) || { kind: "nothing", pays: 0 }, face); },
      state: () => ({ state, cents, bet: BETS[betI], spins, seen }),
      cents(n) { cents = n; hud(); },
      // stop every reel on the drawn result at once, for a capture where frames do not run
      land() {
        reels.forEach((R, r) => {
          if (R.mode === "still" || R.mode === "bounce" || !outcome) return;
          const i = Math.round(R.pos / ROW) + 1;
          R.map.set(i, outcome.line[r]); R.pos = R.to = i * ROW; R.v = 0; R.mode = "still";
          paint(R); R.onLand?.();
        });
      },
    };
  }

  const soundBtn = $("sound"), upright = matchMedia("(max-width: 599px) and (orientation: portrait)");
  const sayVolume = () => {
    soundBtn.setAttribute("aria-pressed", String(audio.on));
    soundBtn.setAttribute("aria-label", audio.on ? "Sound on" : "Sound off");
    soundBtn.querySelector(".tape-label").textContent = upright.matches ? (audio.on ? "♪ On" : "♪ Off") : audio.on ? "Sound: on" : "Sound: off";
  };
  soundBtn.addEventListener("click", () => { audio.unlock(); audio.set(!audio.on); sayVolume(); });
  addEventListener("resize", sayVolume);
  sayVolume();
})();
