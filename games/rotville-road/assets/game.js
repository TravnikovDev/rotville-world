/* Rotville Road. Farrat, the grey courier rat harnessed to one enormous wheel, sets off down Rotville Road and cannot
   recall where he was going, so he keeps going anyway, on gas. Lean him back over the potholes and forward up the
   hills, flip him in the air for points, boost when it is worth the gas, and reach a jerrycan before the tank runs
   dry. Bins and bags on the road sometimes have cheese in them, and cheese mends a tumble. Three tumbles, or an empty
   tank, and he sits down to remember. Hill Climb Racing, on one wheel. */
(() => {
  "use strict";
  const W = 270, H = 480;
  const FX = 84, FY = 322;                          // where his hub sits on the screen: the road ahead gets the room
  const $ = id => document.getElementById(id);
  const cv = $("c"), g = cv.getContext("2d");
  g.imageSmoothingEnabled = false;
  const store = {
    get(k, d) { try { const v = localStorage.getItem("rotvilleroad." + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem("rotvilleroad." + k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
  };
  const LINES = {
    start: "Farrat sets off down Rotville Road. He cannot recall where to.",
    tumble: "He gets up. He keeps going anyway.",
    best: "Further than ever. Nothing rings a bell.",
    end: "Farrat sits down to remember where he was going.",
    gas: "Out of gas. Farrat does not remember filling up.",
  };
  const BOARDS = ["SOMEWHERE?", "MAYBE HERE?", "NOPE.", "KEEP GOING!", "THAT WAY?", "BACK THERE", "NOT FAR", "ALMOST?",
                  "ROTVILLE ROAD", "WHICH WAY?", "STILL GOING?", "THIS WAY"];
  const GAS_RATE = 1 / 40;                          // a full tank lasts 40 seconds of riding, and a third of that boosting
  const TAU = Math.PI * 2;
  const wrap = a => a - TAU * Math.floor((a + Math.PI) / TAU);

  /* ---------- the road and Farrat: the physics the bots were tuned on ---------- */
  function makeCore(seed) {
    const gen = s0 => { let s = s0 >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
    const C = {
      PPM: 30, WR: 18, RIM: 14,                     // 30 pixels to the metre on the road's signs and his speedometer, so
                                                    // his wheel is 1.2 m across and his pace about 25 km/h
      G: 440,
      COM: [7, -5], I: 130,                         // his centre of mass from the hub, upright (the iron wheel keeps it low)
      TOE: [17, 16.5], HEAD: [20, -28], HEAD_R: 9,  // the front of his foot; his head
      KW: 4000, CW: 70,                             // the tyre on the road
      KT: 3000, CT: 60, TOE_MAX: 1400,              // his toes on the road, and the most they push, so a lip cannot hammer him
      ACC: 360, KD: 5.0, V0: 225, REACH: 3,         // his ride: the most it pushes, how hard it keeps his pace, how near the
                                                    // road his toes must be for it to push at all; it never brakes
      BOOST: 300,                                   // the boost: gas out of his back pushes him along himself, anywhere
      ROLL: 14, DRAG: 0.0016,                       // the tyre rolling, and the air
      LEAN: 3.0, LEAN_ACC: 70, KL: 25, LEAN_BACK: 0.55, LEAN_FWD: 0.45,   // the lean on the road: how fast, how hard, how far
      SPIN: 9, SPIN_ACC: 70,                        // in the air the lean turns him over freely: how fast, how hard
      START: 400,                                   // where he sets off, and the metres start
    };
    // the hills: a chain of segments, each eased from one height to the next with half a cosine, so a crest or a
    // hollow is level at its top and the steepest part of a hill is pi/2 of its average slope. The slopes are capped,
    // and the cap grows with the distance: 0.08 on the first stretch, 0.35 (29 degrees at its steepest) by 450 m,
    // 0.43 by 1500 m and 0.5 (38 degrees) by 3000 m, the hills longer too after the first 450 m.
    const segX = [-1e6, C.START + 500], segY = [0, 0], segR = gen(seed ^ 0x51ED270B);
    let lastS = 0;
    function grow(x) {
      while (segX[segX.length - 1] < x + 400) {
        const x0 = segX[segX.length - 1], d = Math.max(0, (x0 - C.START) / C.PPM);
        const cap = d < 450 ? 0.08 + 0.27 * d / 450 : d < 1500 ? 0.35 + 0.08 * (d - 450) / 1050 : Math.min(0.5, 0.43 + 0.07 * (d - 1500) / 1500);
        const L = d < 450 ? 170 + segR() * 160 : 140 + segR() * 200;
        let sl;
        if (segR() < (d < 900 ? 0.22 : 0.16)) sl = (segR() - 0.5) * 0.06;  // a level stretch to breathe on
        else {
          const dir = lastS > 0.02 ? (segR() < 0.65 ? -1 : 1) : lastS < -0.02 ? (segR() < 0.65 ? 1 : -1) : (segR() < 0.5 ? 1 : -1);
          sl = dir * cap * (0.45 + 0.55 * segR());
        }
        lastS = sl;
        segX.push(x0 + L); segY.push(segY[segY.length - 1] - sl * L);  // the screen's y grows downward: a climb is minus
      }
    }
    function hills(x) {
      if (x <= segX[1]) return 0;
      grow(x);
      let lo = 1, hi = segX.length - 1;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (segX[m] <= x) lo = m; else hi = m; }
      const t = (x - segX[lo]) / (segX[lo + 1] - segX[lo]);
      return segY[lo] + (segY[lo + 1] - segY[lo]) * (1 - Math.cos(Math.PI * t)) / 2;
    }
    // the road's features, a chunk at a time, each chunk from its own seed whatever order they are made in
    const CH = 600, chunks = new Map();
    const level = (x, r) => Math.abs(hills(x + r) - hills(x - r)) / (2 * r);
    function chunk(i) {
      let c = chunks.get(i);
      if (c) return c;
      c = { humps: [], ramps: [], holes: [], pebbles: [], junk: [], signs: [], fences: [], props: [], tufts: [] };
      chunks.set(i, c);
      const rand = gen((seed * 2654435761) ^ (i * 40503 + 977));
      const x0 = i * CH, d = x0 - C.START;
      if (d > 300) {
        // humps: a short rise that throws him at speed, bigger and more of them further on
        if (d > 1800 && rand() < Math.min(0.85, 0.3 + d / 20000)) {
          const x = x0 + 80 + rand() * (CH - 160), w = 70 + rand() * 80, a = Math.min(24, 6 + rand() * 5 + d / 2500);
          if (level(x, w / 2) < 0.1) c.humps.push({ x, w, a });
        }
        // ramps from 40 m: a run-up curving to a lip 18 to 40 pixels up, then a drop; at speed it throws him far enough
        // to turn him over, and slow he goes over the edge
        if (d > 3600 && !c.humps.length && rand() < Math.min(0.6, 0.25 + d / 30000)) {
          const x = x0 + 100 + rand() * (CH - 220), a = Math.min(40, 18 + rand() * 8 + d / 2000), w = 70 + rand() * 40;
          if (level(x, w) < 0.12) c.ramps.push({ x, a, w, drop: a / 1.1 });
        }
        // potholes: none at first, then up to two a chunk, wider and deeper further on
        const nHole = d < 1500 ? 0 : rand() < Math.min(0.95, 0.35 + d / 30000) ? (rand() < Math.min(0.5, d / 60000) ? 2 : 1) : 0;
        for (let k = 0; k < nHole; k++) {
          const x = x0 + 60 + rand() * (CH - 120);
          if (level(x, 30) > 0.15) continue;
          if (c.humps.some(p => Math.abs(p.x - x) < p.w / 2 + 50)) continue;
          if (c.ramps.some(p => x > p.x - p.w - 40 && x < p.x + p.drop + 90)) continue;
          if (c.holes.some(p => Math.abs(p.x - x) < 90)) continue;
          const w = Math.min(34, 18 + rand() * 8 + d / 2500), dep = Math.min(10, 6 + rand() * 3 + d / 6000);
          c.holes.push({ x, w, d: dep, wall: 4 });
        }
        // pebbles, only where the road is nearly level: on a climb one would stop him dead
        const nPeb = Math.floor(rand() * (1 + Math.min(4, d / 4000)) + (d > 800 ? 0.6 : 0));
        for (let k = 0; k < nPeb; k++) {
          const x = x0 + rand() * CH, r = rand() < 0.6 ? 3 : 4.5;
          if (c.holes.some(p => Math.abs(p.x - x) < p.w / 2 + 14)) continue;
          if (c.humps.some(p => Math.abs(p.x - x) < p.w / 2 + 10)) continue;
          if (c.ramps.some(p => x > p.x - p.w - 20 && x < p.x + p.drop + 60)) continue;
          if (level(x, 24) > 0.12) continue;
          c.pebbles.push({ x, r, k: r > 4 ? "pebbleB" : "pebbleA" });
        }
        // a bin bag now and then from 25 m, and from 65 m a dustbin too, on road that is nearly level
        if (d > 2300 && rand() < Math.min(0.55, 0.3 + d / 40000)) {
          const x = x0 + 60 + rand() * (CH - 120), bin = d > 6000 && rand() < 0.4;
          const near = q => Math.abs(q.x - x) < (q.w ? q.w / 2 : 0) + 40;
          const onRamp = c.ramps.some(p => x > p.x - p.w - 40 && x < p.x + p.drop + 80);
          if (level(x, 30) < 0.12 && !onRamp && !c.holes.some(near) && !c.humps.some(near) && !c.pebbles.some(near)) c.junk.push({ x, k: bin ? "bin" : "bag", hit: 0 });
        }
      }
      // what stands beside the road: signposts that have forgotten too, fence, bushes, stumps; tufts in front. The
      // first signpost of every run is the one on his archive card.
      const FIRST = C.START + 1500;
      if (x0 <= FIRST && FIRST < x0 + CH) {
        c.signs.push({ x: FIRST, boards: [{ t: "SOMEWHERE?", dir: 1 }, { t: "MAYBE HERE?", dir: -1 }, { t: "NOPE.", dir: 1 }, { t: "KEEP GOING!", dir: 1 }] });
      } else if (d > 0 && rand() < 0.2) {
        const n = 2 + (rand() < 0.4 ? 1 : 0), boards = [];
        for (let k = 0; k < n; k++) boards.push({ t: BOARDS[(rand() * BOARDS.length) | 0], dir: rand() < 0.5 ? -1 : 1 });
        c.signs.push({ x: x0 + 100 + rand() * (CH - 200), boards });
      }
      if (rand() < 0.45) { const a = x0 + rand() * CH * 0.6; c.fences.push({ a, b: a + 120 + rand() * 260 }); }
      const nProp = 2 + ((rand() * 4) | 0);
      for (let k = 0; k < nProp; k++) c.props.push({ x: x0 + rand() * CH, k: ["bushA", "bushB", "bushA", "stump", "log", "grassA", "grassB", "boulder", "boulderB"][(rand() * 9) | 0] });
      c.props.sort((p, q) => p.x - q.x);
      const nTuft = 3 + ((rand() * 5) | 0);
      for (let k = 0; k < nTuft; k++) c.tufts.push({ x: x0 + rand() * CH, k: rand() < 0.5 ? "grassA" : "grassB" });
      return c;
    }
    function ensure(x) { const i = Math.floor(x / CH); chunk(i - 1); chunk(i); chunk(i + 1); }
    // the road without its holes and pebbles: the hills and the humps (a hump stays inside its own chunk)
    function hBase(x) {
      let y = hills(x);
      const c = chunks.get(Math.floor(x / CH));
      if (c) {
        for (const p of c.humps) {
          const e = Math.abs(x - p.x) / (p.w / 2);
          if (e < 1) y -= p.a * 0.5 * (1 + Math.cos(Math.PI * e));
        }
        for (const p of c.ramps) {                    // the lip is at p.x: up before it on a curve, down after it in a line
          if (x > p.x - p.w && x <= p.x) { const t = (x - (p.x - p.w)) / p.w; y -= p.a * t * t; }
          else if (x > p.x && x < p.x + p.drop) y -= p.a * (1 - (x - p.x) / p.drop);
        }
      }
      return y;
    }
    function holeAt(x, i) {
      let y = 0;
      for (let k = i - 1; k <= i + 1; k++) for (const p of chunks.get(k).holes) {
        const e = p.w / 2 - Math.abs(x - p.x);
        if (e > 0) y += p.d * Math.min(1, e / p.wall);
      }
      return y;
    }
    // the road under his toes: the holes, but not the pebbles, which his feet step over
    function hToe(x) { ensure(x); return hBase(x) + holeAt(x, Math.floor(x / CH)); }
    // the road under his wheel
    function h(x) {
      ensure(x);
      const i = Math.floor(x / CH);
      let y = hBase(x) + holeAt(x, i);
      for (let k = i - 1; k <= i + 1; k++) for (const p of chunks.get(k).pebbles) {
        const dx = x - p.x;
        if (Math.abs(dx) < p.r) y -= Math.sqrt(p.r * p.r - dx * dx);
      }
      return y;
    }
    // the closest point of the road to (px, py), a pixel at a time across [px - span, px + span]
    function closest(px, py, span) {
      let best = 1e9, bx = 0, by = 0;
      const x0 = Math.floor(px - span);
      let y0 = h(x0);
      for (let x = x0 + 1; x <= px + span + 1; x++) {
        const y1 = h(x), dy = y1 - y0;
        let t = ((px - (x - 1)) + (py - y0) * dy) / (1 + dy * dy);
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const qx = x - 1 + t, qy = y0 + t * dy, d2 = (px - qx) * (px - qx) + (py - qy) * (py - qy);
        if (d2 < best) { best = d2; bx = qx; by = qy; }
        y0 = y1;
      }
      return { d: Math.sqrt(best), x: bx, y: by, under: py > h(px) };
    }
    const slopeBase = x => { ensure(x); return (hBase(x + 6) - hBase(x - 6)) / 12; };
    // jerrycans: the first at 90 m, then further apart the further he gets, 150 m apart at first and 390 by 3000 m,
    // each on road that is nearly level and clear of the holes and the junk
    const cans = [], canR = gen(seed ^ 0x2545F491);
    let nextCan = C.START + 90 * C.PPM;
    function cansTo(x) {
      while (nextCan < x + 1200) {
        let cx = nextCan;
        for (let k = 0; k < 40; k++, cx += 8) {
          ensure(cx);
          if (Math.abs(slopeBase(cx)) > 0.2) continue;
          const i = Math.floor(cx / CH);
          let ok = true;
          for (let j = i - 1; j <= i + 1; j++) {
            const c = chunks.get(j);
            if (c.holes.some(p => Math.abs(p.x - cx) < p.w / 2 + 20) || c.junk.some(p => Math.abs(p.x - cx) < 34) ||
                c.ramps.some(p => cx > p.x - p.w - 20 && cx < p.x + p.drop + 30)) ok = false;
          }
          if (ok) break;
        }
        cans.push({ x: cx, got: 0 });
        const d = (nextCan - C.START) / C.PPM;
        nextCan += (150 + 0.08 * d) * C.PPM * (0.85 + 0.3 * canR());
      }
      return cans;
    }

    // Farrat: one rigid body, his wheel rolling free at the hub
    const F = { x: 0, y: 0, vx: 0, vy: 0, th: 0, om: 0, spin: 0, wv: 0, ground: false, toe: false, air: 0, run: 0,
                hubX: 0, hubY: 0, tx: 1, ty: 0, stuck: 0, stuckX: 0, hop: 0, land: 0, airRot: 0, landed: null };
    const rot = (bx, by, th) => [bx * Math.cos(th) - by * Math.sin(th), bx * Math.sin(th) + by * Math.cos(th)];
    function hub() { const [ox, oy] = rot(C.COM[0], C.COM[1], F.th); return [F.x - ox, F.y - oy]; }
    function place(x, v) {
      ensure(x);
      const a = Math.atan(slopeBase(x));
      F.th = a + 0.12; F.om = 0; F.wv = v || 0; F.vx = (v || 0) * Math.cos(a); F.vy = (v || 0) * Math.sin(a);
      F.air = 0; F.airRot = 0; F.landed = null; F.stuck = 0; F.stuckX = x;
      const hy = h(x) - C.WR - 0.5;
      const [ox, oy] = rot(C.COM[0], C.COM[1], F.th);
      F.x = x + ox; F.y = hy + oy; F.hubX = x; F.hubY = hy;
    }
    // one step of dt: lean is -1 (back), 0 or +1 (forward); speed is the pace he rides at; boost is the gas out of
    // his back. Returns why he fell, if he did.
    function step(dt, lean, speed, boost) {
      const [hx, hy] = hub();
      let fx = 0, fy = C.G, tq = 0;
      const rx = hx - F.x, ry = hy - F.y;
      // the tyre
      const q = closest(hx, hy, C.WR + 2);
      let nx, ny, pen;
      if (q.under) { nx = 0; ny = -1; pen = C.WR + (hy - h(hx)); }
      else { pen = C.WR - q.d; nx = (hx - q.x) / (q.d || 1); ny = (hy - q.y) / (q.d || 1); }
      const wasAir = F.air;
      F.ground = pen > -0.6;
      if (pen > 0) {
        const vhx = F.vx - F.om * ry, vhy = F.vy + F.om * rx;
        const vn = vhx * nx + vhy * ny;
        const N = Math.max(0, C.KW * pen - C.CW * vn);
        fx += N * nx; fy += N * ny; tq += rx * (N * ny) - ry * (N * nx);
        const tx = -ny, ty = nx, vt = vhx * tx + vhy * ty;
        const Rr = -C.ROLL * Math.max(-1, Math.min(1, vt / 10));
        fx += Rr * tx; fy += Rr * ty; tq += rx * (Rr * ty) - ry * (Rr * tx);
        F.tx = tx; F.ty = ty; F.wv = vt;
        if (wasAir > 0.2 && vn < -60) F.land = -vn;
      }
      // his toes push straight up, so on a climb they hold him up without pushing him back down it
      const [tox, toy] = rot(C.TOE[0], C.TOE[1], F.th);
      const px = hx + tox, py = hy + toy, gy = hToe(px);
      const depth = py - gy;
      F.toe = depth > 0;
      if (F.toe) {
        const ox = px - F.x, oy = py - F.y;
        const vpy = F.vy + F.om * ox, N = Math.max(0, Math.min(C.TOE_MAX, C.KT * depth - C.CT * -vpy));
        fy -= N; tq += ox * -N;
      }
      // the ride: while his toes are near the road the gas pushes him along it, up to his pace
      F.run = 0;
      if (depth > -C.REACH) {
        const sl = (hBase(px + 4) - hBase(px - 4)) / 8, nl = Math.hypot(sl, 1), ttx = 1 / nl, tty = sl / nl;
        const ox = px - F.x, oy = py - F.y;
        const vt = (F.vx - F.om * oy) * ttx + (F.vy + F.om * ox) * tty;
        const T = Math.max(0, Math.min(C.ACC, C.KD * (speed - vt)));
        fx += T * ttx; fy += T * tty; tq += ox * (T * tty) - oy * (T * ttx);
        F.run = T;
      }
      // the boost: gas out of his back pushes him along himself, on the road or in the air
      if (boost) {
        const bx = Math.cos(F.th) * C.BOOST, by = Math.sin(F.th) * C.BOOST;
        fx += bx; fy += by; tq += rx * by - ry * bx;
      }
      // the air
      const v = Math.hypot(F.vx, F.vy);
      if (v > 1) { const dr = C.DRAG * v; fx -= dr * F.vx; fy -= dr * F.vy; }
      // the lean. On the road the hand that holds him turns him toward a posture, LEAN rad/s at most and as hard as
      // LEAN_ACC allows, and holds him there, LEAN_BACK back from the road under him or LEAN_FWD forward. In the air it
      // turns him over freely, SPIN rad/s at most, and let go he keeps most of his turn.
      const flying = !F.ground && !F.toe && F.air > 0.06;
      const rel = wrap(F.th - Math.atan(slopeBase(hx)));
      if (lean && flying) {
        tq += C.I * Math.max(-C.SPIN_ACC, Math.min(C.SPIN_ACC, C.KL * (lean * C.SPIN - F.om)));
      } else if (lean) {
        const lim = lean < 0 ? -C.LEAN_BACK : C.LEAN_FWD;
        const want = (lean < 0 ? rel > lim : rel < lim) ? lean * C.LEAN : (lim - rel) * 8;
        tq += C.I * Math.max(-C.LEAN_ACC, Math.min(C.LEAN_ACC, C.KL * (want - F.om)));
      } else if (flying) {
        tq -= C.I * 0.4 * F.om;
      }
      F.vx += fx * dt; F.vy += fy * dt; F.om += (tq / C.I) * dt;
      F.x += F.vx * dt; F.y += F.vy * dt; F.th += F.om * dt;
      if (!F.ground && !F.toe) F.airRot += F.om * dt;
      F.th = wrap(F.th);
      if (!F.ground) F.air += dt;
      else { if (F.air > 0.25) F.landed = { rot: F.airRot, air: F.air }; F.air = 0; F.airRot = 0; }
      if (!F.ground) F.wv *= 1 - 0.3 * dt;
      F.spin += (F.wv / C.WR) * dt;
      const [nhx, nhy] = hub();
      F.hubX = nhx; F.hubY = nhy;
      // stuck: the wheel against a lip he cannot roll over from a standstill, so he scrambles, a hop up and on
      if (!F.ground || F.hubX - F.stuckX > 12) { F.stuckX = F.hubX; F.stuck = 0; }
      else if (speed > 0 && (F.stuck += dt) > 1.2) { F.vy -= 190; F.vx += 70; F.stuck = 0; F.hop++; }
      // a tumble: his head on the road, or him on his back on it
      const [ex, ey] = rot(C.HEAD[0], C.HEAD[1], F.th);
      const hd = closest(nhx + ex, nhy + ey, C.HEAD_R + 1);
      const rel2 = wrap(F.th - Math.atan(slopeBase(nhx)));
      if (hd.under || hd.d < C.HEAD_R) return "head";
      if ((F.ground || F.toe) && (rel2 < -2.0 || rel2 > 2.0)) return "back";
      return null;
    }
    // where he gets up after a tumble: the first level ground from x on, clear of holes, humps, pebbles and junk
    function getUp(x) {
      for (let k = 0; k < 400; k++, x += 6) {
        ensure(x + 60);
        if (Math.abs(slopeBase(x)) > 0.15) continue;
        const i = Math.floor(x / CH);
        let clear = true;
        for (let j = i - 1; j <= i + 1 && clear; j++) {
          const c = chunks.get(j);
          if (c.holes.some(p => Math.abs(p.x - x) < p.w / 2 + 45) || c.humps.some(p => Math.abs(p.x - x) < p.w / 2 + 30) ||
              c.pebbles.some(p => Math.abs(p.x - x) < 40) || c.junk.some(p => !p.hit && Math.abs(p.x - x) < 50) ||
              c.ramps.some(p => x > p.x - p.w - 50 && x < p.x + p.drop + 60)) clear = false;
        }
        if (clear) return x;
      }
      return x;
    }
    // his pace: 225 pixels a second to start (27 km/h), rising to 300 (36 km/h) by 2400 m
    const pace = x => C.V0 + 75 * Math.min(1, Math.max(0, (x - C.START) / C.PPM) / 2400);
    return { C, F, h, hBase, chunk, chunks, ensure, slopeBase, place, step, hub, rot, CH, pace, getUp, cansTo };
  }

  /* ---------- state ---------- */
  let state = "load";                               // load, ready, play, pause, tumble, sitting, over
  let K = null, C = null, F = null, seed = 1;
  let bestScore = store.get("bestScore", 0), bestM = store.get("bestM", 0);
  let score = 0, metres = 0, maxX = 0, tumbles = 0, mended = 0, flips = 0, said = {}, bestSaid = false, endCause = "";
  let gas = 1, gasOutT = 0, boosting = false, boostHeld = false, lowWarned = false;
  let clock = 0, stateT = 0, acc = 0, lean = 0, camX = 0, camY = 0, nextMile = 250, shake = 0, kmh = 0, beat = 0;
  let fx = [], pops = [], cheeses = [], flying = [], puffT = 0, dustT = 0, lastHop = 0, flash = 0, lastGain = 0, pending = null;
  let atlas = null, SPR = {};
  const SUB = 1 / 480;                              // the physics step
  const STAGE = { mtn: [], far: [], mid: [], clouds: [] };   // what is behind the road: its shapes for this run
  let bgCam = 0;                                    // the camera's height, followed slowly by the hills behind

  /* ---------- a run ---------- */
  function newRoad(s) {
    seed = s >>> 0;
    K = makeCore(seed); C = K.C; F = K.F;
    K.place(C.START, 0);
    const r = (k, a) => { const x = Math.sin(seed * 0.0001 + k * 12.9898) * 43758.5453; return (x - Math.floor(x)) * a; };
    STAGE.mtn = [[0.007, r(7, 6.28), 26], [0.019, r(8, 6.28), 9], [0.05, r(9, 6.28), 2]];
    STAGE.far = [[0.011, r(1, 6.28), 16], [0.027, r(2, 6.28), 7], [0.061, r(3, 6.28), 3]];
    STAGE.mid = [[0.016, r(4, 6.28), 20], [0.041, r(5, 6.28), 8], [0.09, r(6, 6.28), 3]];
    STAGE.clouds = [];
    for (let k = 0; k < 7; k++) STAGE.clouds.push({ u: r(10 + k, 2400), y: 36 + r(20 + k, 150), w: 22 + r(30 + k, 34) | 0 });
    maxX = F.hubX; metres = 0; nextMile = 250; acc = 0; fx = []; pops = []; cheeses = []; flying = []; lastGain = clock; pending = null;
    camX = F.hubX - FX; camY = F.hubY - FY; bgCam = camY;
    lastHop = 0;
  }
  function start() {
    audio.unlock();
    newRoad((Math.random() * 4294967296) >>> 0);
    score = 0; tumbles = 0; mended = 0; flips = 0; said = {}; bestSaid = false; endCause = "";
    gas = 1; gasOutT = 0; lowWarned = false; boosting = false;
    state = "play"; stateT = 0;
    $("ready").hidden = true; $("over").hidden = true;
    say("start");
    hud();
  }
  function tumble() {
    state = "tumble"; stateT = 0; tumbles++; pending = null;
    if (boosting) { boosting = false; audio.boostStop(); }
    shake = 0.35;
    audio.tumble();
    for (let k = 0; k < 14; k++) dust(F.hubX + (Math.random() - 0.3) * 30, K.h(F.hubX) - 1, (Math.random() - 0.5) * 60, -20 - Math.random() * 40, 0.6);
    hud();
  }
  function getUp() {
    const x = K.getUp(F.hubX + 20);
    K.place(x, K.pace(x) * 0.5);
    state = "play"; stateT = 0; flash = 1.2; lastGain = clock;
    if (!said.tumble) { say("tumble"); said.tumble = true; }
  }
  function end(cause) {
    endCause = cause; state = "sitting"; stateT = 0;
    if (boosting) { boosting = false; audio.boostStop(); }
    say(cause === "gas" ? "gas" : "end");
  }
  function over() {
    state = "over"; stateT = 0;
    const isBest = score > bestScore;
    if (isBest) { bestScore = score; store.set("bestScore", bestScore); }
    if (metres > bestM) { bestM = metres; store.set("bestM", bestM); }
    $("over-title").textContent = endCause === "gas" ? "Farrat ran out of gas." : "Farrat sat down.";
    const line = endCause === "gas" ? "He does not remember filling up." : "He is trying to remember where he was going.";
    $("over-line").textContent = isBest ? "A new best. " + line : line;
    $("over-stats").textContent = fmt(score) + " points · " + fmt(metres) + " m · " + flips + (flips === 1 ? " flip" : " flips") + " · best " + fmt(bestScore);
    $("over").hidden = false;
    hud();
  }

  /* ---------- the loop ---------- */
  // the attract run behind the first card: a careful hand on the lean
  function bot() {
    const ahead = F.air > 0.05 ? 40 : 10;
    const target = Math.atan(K.slopeBase(F.hubX + ahead)) + (F.air > 0.05 ? 0 : 0.08);
    const err = wrap(F.th + F.om * 0.18 - target);
    return err > 0.1 ? -1 : err < -0.1 ? 1 : 0;
  }
  function update(dt) {
    clock += dt; stateT += dt;
    if (shake > 0) shake = Math.max(0, shake - dt);
    if (flash > 0) flash = Math.max(0, flash - dt);
    if (state === "play" || state === "ready") {
      const attract = state === "ready";
      const want = !attract && boostHeld && gas > 0;
      if (want !== boosting) { boosting = want; if (want) audio.boostStart(); else audio.boostStop(); }
      acc += dt;
      const lv = attract ? bot() : lean, sp = attract || gas > 0 ? K.pace(F.hubX) : 0;
      while (acc >= SUB) {
        acc -= SUB;
        const why = K.step(SUB, lv, sp, boosting);
        if (why) {
          if (attract) { K.place(K.getUp(F.hubX + 20), K.pace(F.hubX) * 0.5); continue; }
          acc = 0; tumble(); break;
        }
      }
      if (state === "play" || state === "ready") life(dt);
    } else if (state === "tumble") {
      if (stateT > 1.3) {
        if (tumbles - mended >= 3) end("tumble");
        else getUp();
      }
    } else if (state === "sitting") {
      if (stateT > 1.8) over();
    }
    // the camera: his hub at (FX, FY), lifted toward the road a little way ahead so a climb shows what is over it
    const ahead = K.hBase(F.hubX + 150) - K.hBase(F.hubX);
    const tx = F.hubX - FX, ty = F.hubY - FY + Math.max(-90, Math.min(60, ahead * 0.45));
    camX = tx;
    camY += (ty - camY) * Math.min(1, dt * 3.5);
    if (Math.abs(F.hubY - FY - camY) > 150) camY = F.hubY - FY - Math.sign(F.hubY - FY - camY) * 150;
    bgCam += (camY - bgCam) * Math.min(1, dt / 5);
    // his speed for the set's speedometer, in km/h, and slower for the bed, which plays faster when he goes faster
    const now = state === "play" ? Math.hypot(F.vx, F.vy) * 3.6 / C.PPM : 0;
    kmh += (now - kmh) * Math.min(1, dt * 6);
    beat += (now - beat) * Math.min(1, dt * 1.2);
    audio.tempo(beat);
    for (const f of fx) { f.t += dt; f.x += f.vx * dt; f.y += f.vy * dt; f.vy += (f.g || 0) * dt; }
    fx = fx.filter(f => f.t < f.life);
    for (const p of pops) p.t += dt;
    pops = pops.filter(p => p.t < 1.4);
    // cheese out of a bin or a bag: it bounces and settles on the road
    for (const ch of cheeses) {
      if (ch.rest || ch.got) continue;
      ch.vy += 520 * dt; ch.x += ch.vx * dt; ch.y += ch.vy * dt;
      const floor = K.hBase(ch.x) - 1;
      if (ch.y > floor) { ch.y = floor; if (ch.vy > 70) { ch.vy = -ch.vy * 0.35; ch.vx *= 0.6; } else { ch.vy = 0; ch.rest = true; } }
    }
    // a dustbin and its lid knocked flying
    for (const b of flying) { b.t += dt; b.vy += 520 * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.r += b.vr * dt; }
    flying = flying.filter(b => b.t < 2.2);
  }
  // he touches (x, y) with his wheel or his middle
  function touches(x, y, r) {
    if (Math.hypot(x - F.hubX, y - F.hubY) < C.WR + r) return true;
    const [bx, by] = K.rot(8, -14, F.th);
    return Math.hypot(x - F.hubX - bx, y - F.hubY - by) < 12 + r;
  }
  // the run's events: distance, gas, tricks, cans, junk, cheese, his puffs and the dust
  function life(dt) {
    const playing = state === "play";
    if (F.hubX > maxX + 4) { maxX = F.hubX; lastGain = clock; }
    // twelve seconds without a new metre, stuck under a climb he will not lean into: that is a tumble, and he gets up
    // past it
    if (playing && gas > 0 && clock - lastGain > 12) { lastGain = clock; banner("STUCK", 1.6); tumble(); return; }
    // the gas: it burns while he rides, three times as fast boosting; empty, he rolls on until he stops
    if (playing && gas > 0) {
      gas = Math.max(0, gas - dt * GAS_RATE * (boosting ? 3 : 1));
      if (gas < 0.2 && !lowWarned) { lowWarned = true; audio.low(); }
      if (gas === 0) { gasOutT = 0; banner("NO GAS", 1.6); audio.empty(); }
    }
    if (playing && gas === 0) {
      gasOutT += dt;
      if ((F.ground && Math.hypot(F.vx, F.vy) < 8 && gasOutT > 1.2) || gasOutT > 9) { end("gas"); return; }
    }
    // ten points a metre, a bell every 250
    const m = Math.max(0, Math.floor((maxX - C.START) / C.PPM));
    if (playing && m !== metres) {
      score += (m - metres) * 10;
      metres = m;
      if (metres >= nextMile) { audio.bell(); banner(nextMile + " m", 1.6); nextMile += 250; }
      if (!bestSaid && bestM >= 60 && metres > bestM) { bestSaid = true; say("best"); audio.bell(); }
    }
    // tricks: a landing counts once he has stayed on his wheel a moment
    if (F.landed) { if (playing) pending = { rot: F.landed.rot, air: F.landed.air, t: clock }; F.landed = null; }
    if (pending && clock - pending.t > 0.35) { if (playing) trick(pending); pending = null; }
    // jerrycans
    for (const c of K.cansTo(F.hubX)) {
      if (c.got || Math.abs(c.x - F.hubX) > 40) continue;
      const cy = K.hBase(c.x) - 7;
      if (touches(c.x, cy, 7)) {
        c.got = clock;
        if (playing) { gas = 1; lowWarned = false; gasOutT = 0; score += 50; pop("GAS", c.x, cy - 12, "#f2c94c"); audio.glug(); }
      }
    }
    // bin bags and dustbins: he goes through them unless he jumps them
    const i = Math.floor(F.hubX / K.CH);
    for (let k = i - 1; k <= i + 1; k++) for (const j of K.chunk(k).junk) {
      if (j.hit) continue;
      const bin = j.k === "bin", tall = bin ? 30 : 20, half = bin ? 9 : 8;
      if (Math.abs(j.x - F.hubX) < C.WR + half - 2 && F.hubY + C.WR > K.hBase(j.x) - tall + 4) smash(j, playing);
    }
    // cheese
    for (const ch of cheeses) {
      if (ch.got || !touches(ch.x, ch.y - 3, 5)) continue;
      ch.got = clock;
      if (!playing) continue;
      audio.cheese();
      if (tumbles - mended > 0) { mended++; pop("CHEESE", ch.x, ch.y - 14, "#f2c94c"); banner("MENDED", 1.6); }
      else { score += 500; pop("CHEESE +500", ch.x, ch.y - 14, "#f2c94c"); }
    }
    cheeses = cheeses.filter(ch => !ch.got && ch.x > F.hubX - 500);
    // gas out of his back: a puff now and then while he rides, a stream when he boosts
    if ((playing && gas > 0) || state === "ready") {
      puffT -= dt;
      if (puffT <= 0) {
        puffT = boosting ? 0.035 : 0.28 + Math.random() * 0.3;
        const [ex, ey] = K.rot(-5, -2, F.th);
        const bx = -Math.cos(F.th), by = -Math.sin(F.th), sp = boosting ? 110 + Math.random() * 60 : 22 + Math.random() * 16;
        fx.push({ x: F.hubX + ex, y: F.hubY + ey, vx: F.vx * 0.25 + bx * sp + (Math.random() - 0.5) * 16, vy: F.vy * 0.25 + by * sp - 10 - Math.random() * 10,
                  g: -14, t: 0, life: boosting ? 0.75 : 0.95, col: ["#c6d47c", "#adbf5f", "#97a94f"][(Math.random() * 3) | 0], s: boosting ? 3 : 2, grow: boosting ? 7 : 3, puff: true });
        if (!boosting && playing && F.run > 10) audio.putter();
      }
    }
    // dust off the tyre
    if (F.ground && Math.hypot(F.vx, F.vy) > 60) {
      dustT -= dt;
      if (dustT <= 0) { dustT = 0.06; dust(F.hubX - 6, F.hubY + C.WR - 1, -20 - Math.random() * 30, -8 - Math.random() * 16, 0.35); }
    }
    if (F.land) {
      if (playing) audio.thud(Math.min(1, F.land / 260));
      for (let k = 0; k < 6; k++) dust(F.hubX + (Math.random() - 0.5) * 20, F.hubY + C.WR, (Math.random() - 0.5) * 70, -10 - Math.random() * 30, 0.45);
      F.land = 0;
    }
    if (F.hop !== lastHop) { lastHop = F.hop; if (playing) audio.hop(); }
    // a pebble under the wheel clacks
    for (let k = i - 1; k <= i + 1; k++) for (const p of K.chunk(k).pebbles) {
      if (!p.hit && F.ground && Math.abs(p.x - F.hubX) < 9) { p.hit = 1; if (playing) audio.clack(); }
    }
    audio.roll(playing && F.ground ? Math.min(1, Math.hypot(F.vx, F.vy) / 300) : 0);
  }
  // a landing: whole turns in the air are flips, and a long time up is air
  function trick(p) {
    const turns = Math.floor((Math.abs(p.rot) + 0.6) / TAU);
    let y = F.hubY - 52;
    if (turns >= 1) {
      const pts = [0, 500, 1500, 3000][Math.min(turns, 3)] + Math.max(0, turns - 3) * 2000;
      const name = (turns === 2 ? "DOUBLE " : turns === 3 ? "TRIPLE " : turns > 3 ? turns + "X " : "") + (p.rot < 0 ? "BACKFLIP" : "FRONTFLIP");
      flips += turns; score += pts;
      pop(name + " +" + fmt(pts), F.hubX, y, "#f2c94c");
      audio.flip(turns);
      y += 14;
    }
    if (p.air >= 1.2) {
      const pts = p.air >= 2 ? 600 : 250;
      score += pts;
      pop((p.air >= 2 ? "HUGE AIR +" : "BIG AIR +") + pts, F.hubX, y, "#e8e2cf");
      if (!turns) audio.air();
    }
  }
  function smash(j, playing) {
    j.hit = clock;
    const bin = j.k === "bin", base = K.hBase(j.x), keep = boosting ? 0.93 : bin ? 0.72 : 0.84;
    F.vx *= keep; F.vy *= keep; F.om += boosting ? 0.6 : bin ? 2.2 : 1.2;   // it costs him speed and tips him forward
    shake = Math.max(shake, bin ? 0.25 : 0.12);
    if (bin) {
      flying.push({ k: "binBody", x: j.x, y: base - 12, vx: F.vx * 0.8 + 70, vy: -190, r: 0, vr: 7, t: 0 });
      flying.push({ k: "binLid", x: j.x, y: base - 27, vx: F.vx + 110, vy: -280, r: 0, vr: -12, t: 0 });
    }
    for (let n = 0; n < (bin ? 14 : 10); n++) {
      fx.push({ x: j.x + (Math.random() - 0.5) * 10, y: base - 8 - Math.random() * 12, vx: F.vx * 0.5 + (Math.random() - 0.3) * 120, vy: -60 - Math.random() * 120,
                g: 420, t: 0, life: 0.9, col: ["#1d2420", "#e8e2cf", "#b0413a", "#d9d4c7", "#6f7a3f"][n % 5], s: n % 3 ? 1 : 2 });
    }
    if (Math.random() < (bin ? 0.6 : 0.45)) cheeses.push({ x: j.x + 4, y: base - 14, vx: F.vx * 0.55 + 50, vy: -200, rest: false, got: 0 });
    if (!playing) return;
    if (bin) audio.clang(); else audio.crunch();
    score += bin ? 200 : 100;
    pop(bin ? "BIN +200" : "BAG +100", j.x, base - (bin ? 40 : 30), "#e8e2cf");
  }
  function pop(text, x, y, col) { pops.push({ text, x, y, col, t: 0 }); }
  function dust(x, y, vx, vy, life) {
    fx.push({ x, y, vx, vy, g: 40, t: 0, life, col: Math.random() < 0.5 ? "#c4ad8c" : "#a8916f", s: Math.random() < 0.3 ? 2 : 1 });
  }

  /* ---------- drawing ---------- */
  // a 3 by 5 pixel letter for the signposts, the milestones and the tricks
  const FONT = {
    A: "010101111101101", B: "110101110101110", C: "011100100100011", D: "110101101101110", E: "111100110100111",
    F: "111100110100100", G: "011100101101011", H: "101101111101101", I: "111010010010111", J: "001001001101010",
    K: "101101110101101", L: "100100100100111", M: "101111111101101", N: "110101101101101", O: "010101101101010",
    P: "110101110100100", Q: "010101101110011", R: "110101110101101", S: "011100010001110", T: "111010010010010",
    U: "101101101101111", V: "101101101101010", W: "101101111111101", X: "101101010101101", Y: "101101010010010",
    Z: "111001010100111", 0: "111101101101111", 1: "010110010010111", 2: "110001010100111", 3: "110001010001110",
    4: "101101111001001", 5: "111100110001110", 6: "011100110101010", 7: "111001010010010", 8: "010101010101010",
    9: "010101011001110", "?": "110001010000010", "!": "010010010000010", ".": "000000000000010", "-": "000000111000000",
    "'": "010010000000000", " ": "000000000000000", "+": "000010111010000", ",": "000000000010100",
  };
  function text(c, s, x, y, col, k = 1) {
    c.fillStyle = col;
    for (let n = 0; n < s.length; n++) {
      const gl = FONT[s[n]] || FONT[" "];
      for (let j = 0; j < 15; j++) if (gl[j] === "1") c.fillRect(x + (n * 4 + (j % 3)) * k, y + ((j / 3) | 0) * k, k, k);
    }
  }
  const cache = new Map();
  function canvas(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; return [c, c.getContext("2d")]; }
  // the words that rise off a trick, at twice the size, with a dark edge
  function word(s, col) {
    const key = "w" + s + col;
    if (cache.has(key)) return cache.get(key);
    const [c, x] = canvas(s.length * 8 + 2, 12);
    for (const [dx, dy] of [[0, 1], [2, 1], [1, 0], [1, 2], [2, 2]]) text(x, s, dx, dy, "#1b1410", 2);
    text(x, s, 1, 1, col, 2);
    cache.set(key, c);
    return c;
  }
  // cheese: a wedge with its holes
  function cheeseImg() {
    if (cache.has("cheese")) return cache.get("cheese");
    const [c, x] = canvas(11, 8);
    const rows = ["...........", ".........##", ".......##y#", ".....##yyy#", "...##yyyyy#", ".##yyyoyyy#", "#yyoyyyyoy#", "##########"];
    const col = { "#": "#5a4316", y: "#f2c94c", o: "#c99a2e" };
    rows.forEach((r, yy) => [...r].forEach((ch, xx) => { if (col[ch]) { x.fillStyle = col[ch]; x.fillRect(xx, yy, 1, 1); } }));
    x.fillStyle = "#fbe39a"; x.fillRect(3, 4, 4, 1);
    cache.set("cheese", c);
    return c;
  }
  // a puff of gas: a round of solid pixels with a darker rim, lighter on top
  const PUFF = { "#c6d47c": ["#8d9c4c", "#e1eab0"], "#adbf5f": ["#77873c", "#cfdc8f"], "#97a94f": ["#66752f", "#bccb7a"] };
  function blob(r, col) {
    const key = "b" + r + col;
    if (cache.has(key)) return cache.get(key);
    const n = r * 2 + 1, [c, x] = canvas(n, n), [rim, hi] = PUFF[col];
    const inside = (xx, yy) => xx * xx + yy * yy <= r * r + r * 0.6;
    for (let yy = -r; yy <= r; yy++) for (let xx = -r; xx <= r; xx++) {
      if (!inside(xx, yy)) continue;
      const edge = !inside(xx + 1, yy) || !inside(xx - 1, yy) || !inside(xx, yy + 1) || !inside(xx, yy - 1);
      x.fillStyle = edge ? rim : yy < -r * 0.35 && xx < r * 0.2 ? hi : col;
      x.fillRect(xx + r, yy + r, 1, 1);
    }
    cache.set(key, c);
    return c;
  }
  // a signpost: a post, and boards pointing whichever way someone thought
  function signpost(s) {
    if (s.img) return s.img;
    const ws = s.boards.map(b => b.t.length * 4 - 1 + 8);
    const bw = Math.max(...ws) + 4, top = 2, rows = s.boards.length;
    const hgt = 70 + rows * 11;
    const [c, x] = canvas(bw * 2 + 6, hgt + 2);
    const mid = bw + 3;
    x.fillStyle = "#3a2d22"; x.fillRect(mid - 2, top + 2, 4, hgt - 2);
    x.fillStyle = "#5c4734"; x.fillRect(mid - 1, top + 2, 2, hgt - 2);
    x.fillStyle = "#6f5841"; x.fillRect(mid - 1, top + 2, 1, hgt - 2);
    s.boards.forEach((b, k) => {
      const w = ws[k], y = top + 4 + k * 11, x0 = b.dir > 0 ? mid - 3 : mid + 3 - w;
      // the board, with a point on the side it points to
      x.fillStyle = "#2f241b";
      x.fillRect(x0, y, w, 9);
      if (b.dir > 0) { for (let j = 0; j < 5; j++) x.fillRect(x0 + w + j - 1, y + j, 1, 9 - 2 * j); }
      else { for (let j = 0; j < 5; j++) x.fillRect(x0 - j, y + j, 1, 9 - 2 * j); }
      x.fillStyle = "#b39469";
      x.fillRect(x0 + 1, y + 1, w - 2, 7);
      if (b.dir > 0) { for (let j = 0; j < 4; j++) x.fillRect(x0 + w - 1 + j, y + 1 + j, 1, 7 - 2 * j); }
      else { for (let j = 0; j < 4; j++) x.fillRect(x0 - j, y + 1 + j, 1, 7 - 2 * j); }
      x.fillStyle = "#c9ab7f"; x.fillRect(x0 + 1, y + 1, w - 2, 1);
      x.fillStyle = "#8e7250"; x.fillRect(x0 + 1, y + 7, w - 2, 1);
      text(x, b.t, x0 + 4, y + 2, "#3b2c1f");
      x.fillStyle = "#2a211a"; x.fillRect(mid - 1, y + 4, 1, 1);
    });
    s.img = c; s.ox = mid; s.oy = hgt + 1;
    return c;
  }
  // a milestone: a white stone with the metres on it
  function milestone(n) {
    const key = "ms" + n;
    if (cache.has(key)) return cache.get(key);
    const t = String(n), w = Math.max(13, t.length * 4 + 5), hh = 15;
    const [c, x] = canvas(w, hh);
    x.fillStyle = "#3b3833"; x.fillRect(1, 0, w - 2, hh); x.fillRect(0, 2, w, hh - 2);
    x.fillStyle = "#d9d4c7"; x.fillRect(2, 1, w - 4, hh - 1); x.fillRect(1, 3, w - 2, hh - 3);
    x.fillStyle = "#f1ede2"; x.fillRect(2, 1, w - 4, 1);
    x.fillStyle = "#aba596"; x.fillRect(1, hh - 3, w - 2, 2);
    text(x, t, ((w - (t.length * 4 - 1)) / 2) | 0, 5, "#3b3833");
    cache.set(key, c);
    return c;
  }
  // the furthest so far: a stick and a pennant
  function flag() {
    if (cache.has("flag")) return cache.get("flag");
    const [c, x] = canvas(22, 30);
    x.fillStyle = "#3a2d22"; x.fillRect(2, 2, 2, 28);
    x.fillStyle = "#2a1a17"; x.fillRect(4, 2, 18, 9);
    x.fillStyle = "#b8473a"; x.fillRect(4, 3, 17, 7);
    text(x, "BEST", 5, 4, "#fff1dc");
    cache.set("flag", c);
    return c;
  }
  // the ground, a strip a pixel wide for every column: the verge, the road, the bank under it
  const GT_W = 192, GT_H = 300;
  const [gtC, gt] = canvas(GT_W, GT_H);
  (function paintGround() {
    let s = 7;
    const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let x = 0; x < GT_W; x++) {
      // the far verge: grass, darker at its top
      for (let y = 0; y < 4; y++) { gt.fillStyle = y === 0 ? "#5d7340" : r() < 0.25 ? "#76904f" : "#6a8346"; gt.fillRect(x, y, 1, 1); }
      // the road: packed dirt and gravel, two ruts, a pale crown
      for (let y = 4; y < 18; y++) {
        let c = "#a48d6b";
        if (y === 4) c = "#8f7a5c";
        else if (y === 5) c = "#b39d7a";
        else if (y === 8 || y === 14) c = r() < 0.7 ? "#937c5d" : "#a48d6b";
        else if (y === 11) c = r() < 0.5 ? "#b8a281" : "#ad9674";
        const k = r();
        if (k < 0.06) c = "#c9b593"; else if (k < 0.11) c = "#7f6a4f"; else if (k < 0.14) c = "#bcac8f";
        if (y === 17) c = "#7c6850";
        gt.fillStyle = c; gt.fillRect(x, y, 1, 1);
      }
      // the bank: a grass lip, earth in bands going darker, a stone here and there
      for (let y = 18; y < GT_H; y++) {
        const dd = y - 18;
        let c;
        if (dd < 3) c = r() < 0.3 ? "#6f8a4a" : "#62793f";
        else if (dd < 6) c = r() < 0.25 ? "#566d38" : "#4f6534";
        else {
          const k = Math.min(1, (dd - 6) / 170), band = Math.sin(dd * 0.21 + Math.sin(x * 0.05) * 1.6) * 5;
          const base = [118 - 52 * k + band, 96 - 44 * k + band * 0.8, 70 - 30 * k + band * 0.5];
          const n = r();
          const j = n < 0.07 ? 13 : n < 0.15 ? -9 : 0;
          c = `rgb(${(base[0] + j) | 0},${(base[1] + j) | 0},${(base[2] + j * 0.6) | 0})`;
        }
        gt.fillStyle = c; gt.fillRect(x, y, 1, 1);
      }
    }
    // stones in the earth, lit on top
    for (let k = 0; k < 60; k++) {
      const x = (r() * (GT_W - 4)) | 0, y = 30 + ((r() * (GT_H - 40)) | 0), w = 2 + ((r() * 3) | 0);
      gt.fillStyle = "#5a4c3d"; gt.fillRect(x, y, w, 2);
      gt.fillStyle = "#9b8a72"; gt.fillRect(x, y, w, 1);
    }
    // a few roots under the grass lip
    for (let k = 0; k < 5; k++) {
      let x = (r() * GT_W) | 0, y = 24;
      gt.fillStyle = "#5b4a37";
      for (let j = 0; j < 4 + r() * 5; j++) { gt.fillRect(x, y, 1, 1); y += 1; x += r() < 0.6 ? 0 : r() < 0.5 ? 1 : -1; if (x < 0 || x >= GT_W) break; }
    }
    // a few grass blades leaning over the verge and the bank lip
    for (let k = 0; k < 90; k++) {
      const x = (r() * GT_W) | 0;
      gt.fillStyle = r() < 0.5 ? "#7d9a54" : "#58703c";
      if (r() < 0.5) gt.fillRect(x, 0, 1, 2); else gt.fillRect(x, 18, 1, 3);
    }
  })();
  const [skyC, sky] = canvas(1, H);
  (function paintSky() {
    const grd = sky.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, "#8b9ea3"); grd.addColorStop(0.55, "#c9c7b4"); grd.addColorStop(1, "#ddd2b6");
    sky.fillStyle = grd; sky.fillRect(0, 0, 1, H);
  })();
  function spr(name, x, y) {
    const s = SPR[name];
    if (!s) return;
    g.drawImage(atlas, s[0], s[1], s[2], s[3], Math.round(x - s[4]), Math.round(y - s[5]), s[2], s[3]);
  }
  // a sprite turned about its anchor, for what is knocked flying
  function sprTurned(name, x, y, r) {
    const s = SPR[name];
    if (!s) return;
    g.save(); g.translate(Math.round(x), Math.round(y)); g.rotate(r);
    g.drawImage(atlas, s[0], s[1], s[2], s[3], -Math.round(s[4]), -Math.round(s[5] / 2), s[2], s[3]);
    g.restore();
  }
  const wave = (u, parts) => parts.reduce((a, [f, p, amp]) => a + amp * Math.sin(u * f + p), 0);
  function hillLayer(p, base, parts, col, top, dev, step) {
    for (let sx = 0; sx < W; sx += step) {
      const y = Math.round(base - wave(sx + camX * p, parts) - dev * p);
      if (y >= H) continue;
      g.fillStyle = col; g.fillRect(sx, y, step, H - y);
      g.fillStyle = top; g.fillRect(sx, y, step, 1);
    }
  }
  // a cloud: three or four soft lumps, lit from above
  function cloud(w) {
    const key = "cloud" + w;
    if (cache.has(key)) return cache.get(key);
    const hh = Math.round(w * 0.42) + 4, [c, x] = canvas(w + 4, hh);
    let s0 = w * 131;
    const r = () => { s0 = (s0 * 16807) % 2147483647; return s0 / 2147483647; };
    const lumps = [];
    for (let k = 0; k < 4; k++) lumps.push([4 + r() * (w - 8), hh - 4 - r() * hh * 0.35, w * (0.18 + r() * 0.12)]);
    for (const [shade, dy] of [["#d3cfc1", 1], ["#e9e5d8", 0], ["#f5f2e8", -1]]) {
      x.fillStyle = shade;
      for (const [cx, cy, rr] of lumps) for (let yy = -rr; yy <= 0; yy++) {
        const half = Math.round(Math.sqrt(rr * rr - yy * yy) * (dy < 0 ? 0.7 : 1));
        if (dy < 0 && yy > -rr * 0.35) continue;
        x.fillRect(Math.round(cx - half), Math.round(cy + yy + dy), half * 2, 1);
      }
    }
    cache.set(key, c);
    return c;
  }
  function draw() {
    const ox = Math.round(camX) + (shake ? Math.round((Math.random() - 0.5) * 4) : 0);
    const oy = Math.round(camY) + (shake ? Math.round((Math.random() - 0.5) * 3) : 0);
    g.drawImage(skyC, 0, 0, W, H);
    // behind the road: clouds, mountains, far hills, then near hills with the tops of their trees showing, each moving
    // less the further off it is; when he climbs they sink a little, and drift back as the camera settles
    const dev = Math.max(-200, Math.min(200, camY - bgCam));
    for (const c of STAGE.clouds) {
      const sx = ((((c.u - camX * 0.03) % 2400) + 2400) % 2400) - 60;
      if (sx < -70 || sx > W + 10) continue;
      g.drawImage(cloud(c.w), Math.round(sx), Math.round(c.y - dev * 0.02));
    }
    hillLayer(0.06, 196, STAGE.mtn, "#a5b4b3", "#b6c3c0", dev, 2);
    hillLayer(0.16, 244, STAGE.far, "#93a492", "#a4b49f", dev, 1);
    const p = 0.36, uL = camX * p, slot = 21;
    for (let k = Math.floor(uL / slot) - 2; k <= Math.floor((uL + W) / slot) + 2; k++) {
      const hsh = Math.sin(k * 78.233 + seed * 0.0007) * 43758.5453, fr = hsh - Math.floor(hsh);
      if (fr < 0.38) continue;
      const u = k * slot + fr * 14, sx = u - uL, y = 288 - wave(u, STAGE.mid) - dev * p;
      spr(["treeA", "treeB", "treeC", "treeD"][(fr * 97 | 0) % 4], sx, y + 31);   // sunk in the hill to their crowns
    }
    hillLayer(p, 288, STAGE.mid, "#7b9070", "#8aa07c", dev, 1);
    // the road's layer: what stands on the far verge first
    const x0 = ox - 60, x1 = ox + W + 60;
    const i0 = Math.floor(x0 / K.CH), i1 = Math.floor(x1 / K.CH);
    const vy = x => Math.round(K.hBase(x)) - oy - 10;            // the far verge, where things stand
    const road = x => Math.round(K.hBase(x)) - oy;                // the line the wheel runs on
    for (let i = i0; i <= i1; i++) {
      const c = K.chunk(i);
      for (const f of c.fences) {
        const a = Math.max(f.a, x0), b = Math.min(f.b, x1);
        if (a >= b) continue;
        let px = null, py = null;
        for (let x = Math.ceil(f.a / 22) * 22; x <= f.b; x += 22) {
          const sx = x - ox, base = vy(x);
          if (px !== null && x - 22 >= x0 - 22 && x <= x1 + 22) {
            // two rails from the last post to this one
            for (const [hgt, col, col2] of [[15, "#8b765b", "#4f4133"], [7, "#8b765b", "#4f4133"]]) {
              const steps = sx - px;
              g.fillStyle = col;
              for (let t = 0; t <= steps; t++) g.fillRect(px + t, Math.round(py + (base - py) * (t / steps)) - hgt, 1, 1);
              g.fillStyle = col2;
              for (let t = 0; t <= steps; t++) g.fillRect(px + t, Math.round(py + (base - py) * (t / steps)) - hgt + 1, 1, 1);
            }
          }
          if (x >= x0 && x <= x1) {
            g.fillStyle = "#3b3026"; g.fillRect(sx - 1, base - 19, 3, 20);
            g.fillStyle = "#6b5844"; g.fillRect(sx, base - 19, 1, 19);
            g.fillStyle = "#857057"; g.fillRect(sx - 1, base - 20, 3, 1);
          }
          px = sx; py = base;
        }
      }
      for (const s of c.signs) {
        if (s.x < x0 - 60 || s.x > x1 + 60) continue;
        const im = signpost(s);
        g.drawImage(im, Math.round(s.x - ox - s.ox), vy(s.x) - s.oy + 2);
      }
      for (const pr of c.props) if (pr.x > x0 && pr.x < x1) spr(pr.k, pr.x - ox, vy(pr.x) + 2);
    }
    // milestones every 250 metres, and the furthest so far
    const m0 = Math.max(1, Math.ceil(((x0 - C.START) / C.PPM) / 250)), m1 = Math.floor(((x1 - C.START) / C.PPM) / 250);
    for (let m = m0; m <= m1; m++) {
      const x = C.START + m * 250 * C.PPM, im = milestone(m * 250);
      g.drawImage(im, Math.round(x - ox - im.width / 2), vy(x) - im.height + 2);
    }
    if (bestM > 0) {
      const x = C.START + bestM * C.PPM;
      if (x > x0 && x < x1) g.drawImage(flag(), Math.round(x - ox - 3), vy(x) - 28);
    }
    // the ground
    for (let sx = 0; sx < W; sx++) {
      const x = ox + sx, top = Math.round(K.hBase(x)) - oy - 12;
      if (top >= H) continue;
      const u = ((x % GT_W) + GT_W) % GT_W, hh = Math.min(GT_H, H - top);
      if (hh > 0) g.drawImage(gtC, u, 0, 1, hh, sx, top, 1, hh);
      if (top + GT_H < H) { g.fillStyle = "#2d2519"; g.fillRect(sx, top + GT_H, 1, H - top - GT_H); }
    }
    // the potholes, the pebbles, the jerrycans, the bags and bins on the road
    const holes = [];
    for (let i = i0; i <= i1; i++) {
      const c = K.chunk(i);
      for (const p of c.holes) if (p.x > x0 && p.x < x1) { holes.push(p); hole(p, ox, oy); }
      for (const p of c.pebbles) if (p.x > x0 && p.x < x1) spr(p.k, p.x - ox, road(p.x) + 1);
      for (const j of c.junk) {
        if (j.x < x0 || j.x > x1) continue;
        if (!j.hit) spr(j.k, j.x - ox, road(j.x) + 1);
        else if (j.k === "bag") spr("bagBurst", j.x - ox, road(j.x) + 1);
      }
    }
    for (const c of K.cansTo(ox)) {
      if (c.got || c.x < x0 || c.x > x1) continue;
      spr("can", c.x - ox, road(c.x) + 1);
      if (((clock * 1.3 + c.x * 0.011) % 1) < 0.1) { g.fillStyle = "#fff6d8"; g.fillRect(Math.round(c.x - ox) - 2, road(c.x) - 12, 1, 1); }
    }
    for (const ch of cheeses) if (!ch.got) g.drawImage(cheeseImg(), Math.round(ch.x - ox) - 5, Math.round(ch.y - oy) - 7);
    // his gas, behind him
    for (const f of fx) {
      if (!f.puff) continue;
      const k = f.t / f.life, r = Math.round(f.s + f.grow * k);
      g.globalAlpha = Math.max(0, k < 0.6 ? 0.95 : 0.95 * (1 - k) / 0.4);
      g.drawImage(blob(r, f.col), Math.round(f.x - ox) - r, Math.round(f.y - oy) - r);
    }
    g.globalAlpha = 1;
    // Farrat: the spokes turning behind him, then him; blinking a moment after he gets up
    if (!(flash > 0 && Math.floor(flash * 12) % 2)) farrat(ox, oy);
    // the near lip of a hole goes in front of a wheel that has dropped into it
    for (const p of holes) lip(p, ox, oy);
    for (const b of flying) sprTurned(b.k, b.x - ox, b.y - oy, b.r);
    // tufts on the near bank
    for (let i = i0; i <= i1; i++) for (const t of K.chunk(i).tufts) if (t.x > x0 && t.x < x1) spr(t.k, t.x - ox, road(t.x) + 9);
    for (const f of fx) {
      if (f.puff) continue;
      g.globalAlpha = Math.max(0, 1 - f.t / f.life);
      g.fillStyle = f.col;
      g.fillRect(Math.round(f.x - ox), Math.round(f.y - oy), f.s, f.s);
    }
    g.globalAlpha = 1;
    // what a trick or a pickup was worth, rising off it
    for (const p of pops) {
      const im = word(p.text, p.col), k = p.t / 1.4;
      g.globalAlpha = k < 0.7 ? 1 : Math.max(0, (1 - k) / 0.3);
      g.drawImage(im, Math.round(Math.max(2, Math.min(W - im.width - 2, p.x - ox - im.width / 2))), Math.round(p.y - oy - 20 * k));
    }
    g.globalAlpha = 1;
    if (state === "pause") { g.fillStyle = "rgba(10, 8, 6, 0.45)"; g.fillRect(0, 0, W, H); }
  }
  function hole(p, ox, oy) {
    const rx = p.w / 2, top = Math.round(K.hBase(p.x)) - oy;
    for (let dx = -Math.floor(rx); dx <= Math.floor(rx); dx++) {
      const e = Math.sqrt(Math.max(0, 1 - (dx / rx) * (dx / rx))), sx = Math.round(p.x - ox + dx);
      const up = Math.round(e * 3.5), dn = Math.round(e * 3);
      if (up + dn <= 0) continue;
      g.fillStyle = "#3a2e24"; g.fillRect(sx, top - up, 1, up + dn);
      g.fillStyle = "#2a211a"; g.fillRect(sx, top - up + 1, 1, Math.max(0, up + dn - 2));
      g.fillStyle = "#c2aa83"; g.fillRect(sx, top + dn, 1, 1);
    }
  }
  function lip(p, ox, oy) {
    const rx = p.w / 2, top = Math.round(K.hBase(p.x)) - oy;
    if (Math.abs(F.hubX - p.x) > rx + C.WR) return;
    for (let dx = -Math.floor(rx); dx <= Math.floor(rx); dx++) {
      const x = p.x + dx, e = Math.sqrt(Math.max(0, 1 - (dx / rx) * (dx / rx))), sx = Math.round(x - ox);
      const from = top + Math.round(e * 3) + 1;
      const u = ((Math.round(x) % GT_W) + GT_W) % GT_W, rowTop = Math.round(K.hBase(x)) - oy - 12;
      const r0 = from - rowTop, hh = Math.min(GT_H - r0, H - from);
      if (hh > 0) g.drawImage(gtC, u, r0, 1, hh, sx, from, 1, hh);
    }
  }
  function farrat(ox, oy) {
    const hx = Math.round(F.hubX - ox), hy = Math.round(F.hubY - oy);
    // eight spokes and a hub, turning with the wheel
    g.fillStyle = "#4e4740";
    for (let k = 0; k < 8; k++) {
      const a = F.spin + (k * Math.PI) / 4, ca = Math.cos(a), sa = Math.sin(a);
      for (let r = 3; r <= C.RIM; r++) g.fillRect(Math.round(hx + ca * r - 0.5), Math.round(hy + sa * r - 0.5), 1, 1);
    }
    g.fillStyle = "#2f2a25"; g.fillRect(hx - 2, hy - 2, 5, 5);
    g.fillStyle = "#8a8075"; g.fillRect(hx - 1, hy - 1, 2, 2);
    let deg = Math.round((wrap(F.th) * 180) / Math.PI / 5) * 5;
    if (deg >= 180) deg = -180;
    spr("far_" + (deg < 0 ? "-" : "+") + String(Math.abs(deg)).padStart(3, "0"), hx, hy);
  }

  /* ---------- the set's own writing ---------- */
  const fmt = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  let shown = {};
  function hud() {
    const sc = fmt(score), d = fmt(metres) + " m", left = Math.max(0, 3 - (tumbles - mended));
    const sp = Math.round(kmh / 5) * 5, tier = sp >= 50 ? 2 : sp >= 40 ? 1 : 0;   // rounded to fives
    if (shown.sp !== sp) { $("speed").textContent = sp + " km/h"; shown.sp = sp; }
    if (shown.tier !== tier) { $("speed").classList.toggle("fast", tier === 1); $("speed").classList.toggle("faster", tier === 2); shown.tier = tier; }
    const gp = (Math.max(0, Math.min(1, gas)) * 100).toFixed(1) + "%", low = state === "play" && gas < 0.2;
    if (shown.sc !== sc) { $("score").textContent = sc; shown.sc = sc; }
    if (shown.d !== d) { $("dist").textContent = d; shown.d = d; }
    if (shown.gp !== gp) { $("gas").style.width = gp; shown.gp = gp; }
    if (shown.low !== low) { $("gas").parentNode.parentNode.classList.toggle("low", low); shown.low = low; }
    if (shown.left !== left) {
      shown.left = left;
      [...document.querySelectorAll(".rr-wheel")].forEach((el, k) => el.classList.toggle("gone", k >= left));
      $("wheels").setAttribute("aria-label", left + (left === 1 ? " tumble left" : " tumbles left"));
    }
    const b = "Best " + fmt(bestScore);
    if (shown.best !== b) { $("best").textContent = b; shown.best = b; }
  }
  let bannerTimer = 0;
  function banner(t, sec) {
    const el = $("banner");
    el.textContent = t;
    el.classList.remove("on", "hold");
    void el.offsetWidth;
    el.style.animationDuration = sec + "s";
    el.classList.add("on");
    clearTimeout(bannerTimer);
  }
  let subTimer = 0;
  function say(k) {
    $("sub").textContent = LINES[k];
    clearTimeout(subTimer);
    audio.line(k).then(d => { subTimer = setTimeout(() => { $("sub").textContent = ""; }, (Math.max(d, 1.8) + 0.6) * 1000); });
  }

  /* ---------- sound: the bed, five lines, the rest made on the spot ---------- */
  const audio = {
    ctx: null, on: store.get("sound", true), raw: {}, buf: {}, music: null, bst: null,
    fetch() {
      for (const [k, f] of [["start", "assets/line-start.mp3"], ["tumble", "assets/line-tumble.mp3"], ["best", "assets/line-best.mp3"],
                            ["end", "assets/line-end.mp3"], ["gas", "assets/line-gas.mp3"], ["music", "assets/country-road.mp3"]]) {
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
      this.mus = c.createGain(); this.mus.gain.value = 0.22; this.mus.connect(this.master);
      this.vox = c.createGain(); this.vox.gain.value = 1; this.vox.connect(this.master);
      const n = c.createBuffer(1, c.sampleRate, c.sampleRate), d = n.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = n;
      // the tyre on the dirt: a low rumble that follows his speed
      const s = c.createBufferSource(), bp = c.createBiquadFilter(), gn = c.createGain();
      s.buffer = n; s.loop = true; bp.type = "bandpass"; bp.frequency.value = 260; bp.Q.value = 0.8; gn.gain.value = 0;
      s.connect(bp).connect(gn).connect(this.fxg); s.start();
      this.rollGain = gn; this.rollBp = bp;
      for (const k of Object.keys(this.raw)) {
        this.buf[k] = this.raw[k].then(b => (b ? new Promise(ok => {
          const p = c.decodeAudioData(b, ok, () => ok(null));
          if (p && p.catch) p.catch(() => ok(null));
        }) : null)).catch(() => null);
      }
      this.buf.music.then(b => {
        if (!b || this.music) return;
        const m = c.createBufferSource(); m.buffer = b; m.loop = true; m.connect(this.mus); m.start(); this.music = m;
      });
    },
    set(on) { this.on = on; store.set("sound", on); if (this.master) this.master.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.04); },
    line(k) {
      if (!this.ctx) return Promise.resolve(0);
      return this.buf[k].then(b => {
        if (!b) return 0;
        const c = this.ctx, s = c.createBufferSource(); s.buffer = b; s.connect(this.vox); s.start();
        this.mus.gain.setTargetAtTime(0.09, c.currentTime, 0.08);
        this.mus.gain.setTargetAtTime(0.22, c.currentTime + b.duration + 0.2, 0.3);
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
    roll(k) {
      if (!this.rollGain) return;
      const t = this.ctx.currentTime;
      this.rollGain.gain.setTargetAtTime(k * 0.11, t, 0.08);
      this.rollBp.frequency.setTargetAtTime(180 + k * 260, t, 0.1);
    },
    // the bed plays faster as he does, the way a tape runs fast: 5% from 30 km/h, 15% from 40, 30% from 50
    tempo(k) {
      if (!this.music) return;
      const r = k >= 50 ? 1.3 : k >= 40 ? 1.15 : k >= 30 ? 1.05 : 1;
      if (r !== this.rate) { this.rate = r; this.music.playbackRate.setTargetAtTime(r, this.ctx.currentTime, 0.4); }
    },
    // the gas he rides on: a small pft now and then
    putter() { this.noise(0.04, 0.05, 70, 420); this.tone(95 + Math.random() * 30, 55, 0.06, "sawtooth", 0.02); },
    // the boost: a long rippling parp that wanders in pitch, for as long as it is held
    boostStart() {
      if (!this.ctx || this.bst) return;
      const c = this.ctx, t = c.currentTime;
      const o1 = c.createOscillator(), o2 = c.createOscillator(), lp = c.createBiquadFilter(), am = c.createGain(), out = c.createGain();
      const lfo = c.createOscillator(), lg = c.createGain();
      o1.type = "sawtooth"; o1.frequency.setValueAtTime(64, t); o1.frequency.exponentialRampToValueAtTime(100, t + 0.12);
      o2.type = "square"; o2.frequency.setValueAtTime(49, t);
      lp.type = "lowpass"; lp.frequency.value = 680; lp.Q.value = 5;
      lfo.type = "square"; lfo.frequency.value = 12 + Math.random() * 6; lg.gain.value = 0.5; am.gain.value = 0.5;
      lfo.connect(lg).connect(am.gain);
      out.gain.setValueAtTime(0.0008, t); out.gain.exponentialRampToValueAtTime(0.16, t + 0.04);
      o1.connect(lp); o2.connect(lp); lp.connect(am).connect(out).connect(this.fxg);
      o1.start(t); o2.start(t); lfo.start(t);
      const b = (this.bst = { o1, o2, lfo, out, tm: 0 });
      const wob = () => {
        if (this.bst !== b) return;
        const n = c.currentTime;
        o1.frequency.setTargetAtTime(78 + Math.random() * 48, n, 0.07);
        lfo.frequency.setTargetAtTime(9 + Math.random() * 11, n, 0.1);
        b.tm = setTimeout(wob, 120 + Math.random() * 180);
      };
      wob();
    },
    boostStop() {
      const b = this.bst;
      if (!b) return;
      this.bst = null; clearTimeout(b.tm);
      const t = this.ctx.currentTime;
      b.o1.frequency.setTargetAtTime(46, t, 0.04);
      b.out.gain.setTargetAtTime(0.0008, t + 0.03, 0.05);
      for (const o of [b.o1, b.o2, b.lfo]) o.stop(t + 0.35);
      this.tone(150, 58, 0.11, "sawtooth", 0.05, 0.04);          // and the little pft at the end
    },
    // the tank running dry: a long deflating pffff, and the last of it
    empty() { this.noise(1.2, 0.1, 250, 1500); this.tone(170, 38, 1.1, "sawtooth", 0.05); this.tone(85, 48, 0.1, "square", 0.07, 1.1); },
    low() { this.tone(440, 440, 0.1, "square", 0.035); this.tone(440, 440, 0.1, "square", 0.035, 0.18); },
    glug() { [0, 0.09, 0.18].forEach((w, k) => this.tone(250 - k * 30, 150 - k * 20, 0.08, "sine", 0.13, w)); },
    crunch() { this.noise(0.22, 0.2, 1800, 7000); this.noise(0.1, 0.14, 150, 1100); this.tone(120, 70, 0.1, "sine", 0.1); },
    clang() { [380, 1020, 1910, 2950].forEach((f, k) => this.tone(f, f * 0.98, 0.6 - k * 0.1, "sine", 0.1 / (k + 1))); this.noise(0.05, 0.15, 2000, 9000); },
    cheese() { this.tone(620, 720, 0.08, "square", 0.035); this.tone(660, 780, 0.08, "square", 0.035, 0.12); this.tone(988, 985, 0.35, "sine", 0.06, 0.22); },
    flip(n) { [523, 659, 784, 1047, 1319].slice(0, 2 + Math.min(3, n)).forEach((f, k) => this.tone(f, f, 0.16, "triangle", 0.07, k * 0.07)); },
    air() { this.tone(700, 1100, 0.2, "sine", 0.05); },
    clack() { this.noise(0.05, 0.12, 1400, 6000); this.tone(1100, 700, 0.05, "square", 0.025); },
    thud(k) { this.tone(140, 55, 0.18, "sine", 0.09 + 0.12 * k); this.noise(0.12, 0.05 + 0.08 * k, 80, 900); },
    hop() { this.tone(320, 760, 0.12, "square", 0.04); this.noise(0.06, 0.05, 900, 4000); },
    // a bicycle bell: two rings of two partials
    bell() {
      for (const w of [0, 0.16]) {
        this.tone(2310, 2290, 0.7, "sine", 0.05, w); this.tone(3180, 3150, 0.45, "sine", 0.025, w); this.tone(4620, 4600, 0.2, "sine", 0.01, w);
      }
    },
    tumble() { this.tone(170, 50, 0.3, "sine", 0.2); this.noise(0.35, 0.12, 60, 1200); this.tone(520, 130, 0.7, "triangle", 0.05, 0.12); },
  };
  audio.fetch();

  /* ---------- input: hold back, forward, or the boost ---------- */
  // keys, and fingers: on the screen the left half leans him back and the right half forward, and both halves at once
  // boost; under the set, three buttons
  const keys = { back: false, fwd: false, boost: false }, held = new Map();
  function sum() {
    let b = keys.back, f = keys.fwd, padBoost = false, scrB = false, scrF = false;
    for (const [id, d] of held) {
      const screen = String(id).startsWith("s");
      if (d === 0) padBoost = true;
      else if (d < 0) { b = true; if (screen) scrB = true; }
      else { f = true; if (screen) scrF = true; }
    }
    const both = scrB && scrF;
    boostHeld = keys.boost || padBoost || both;
    lean = both ? 0 : (f ? 1 : 0) - (b ? 1 : 0);
    document.querySelectorAll(".rr-pad button").forEach(el => el.classList.toggle("on",
      (el.dataset.d === "back" && b && !both) || (el.dataset.d === "fwd" && f && !both) || (el.dataset.d === "boost" && boostHeld)));
  }
  const KEYS = { ArrowLeft: "back", KeyA: "back", ArrowRight: "fwd", KeyD: "fwd", ArrowUp: "boost", KeyW: "boost" };
  addEventListener("keydown", e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const d = KEYS[e.code];
    if (d) {
      if (state === "play" || state === "tumble" || state === "pause") { e.preventDefault(); keys[d] = true; sum(); }
      else if (state === "ready" && e.target === document.body) { e.preventDefault(); start(); keys[d] = true; sum(); }
    } else if (e.code === "Space" || e.code === "KeyP") {
      if (state === "play" || state === "pause") { e.preventDefault(); pause(state === "play"); }
      else if (state === "ready" && e.target === document.body) { e.preventDefault(); start(); }
    } else if (e.code === "Enter" && (state === "ready" || state === "over") && e.target === document.body) {
      e.preventDefault(); start();
    }
  });
  addEventListener("keyup", e => { const d = KEYS[e.code]; if (d) { keys[d] = false; sum(); } });
  cv.addEventListener("pointerdown", e => {
    if (state === "pause") { pause(false); return; }
    if (state !== "play" && state !== "tumble") return;
    const r = cv.getBoundingClientRect();
    held.set("s" + e.pointerId, e.clientX - r.left < r.width / 2 ? -1 : 1);
    try { cv.setPointerCapture(e.pointerId); } catch (err) { /* old browsers */ }
    sum();
    e.preventDefault();
  });
  const lift = e => { if (held.delete("s" + e.pointerId)) sum(); };
  cv.addEventListener("pointerup", lift);
  cv.addEventListener("pointercancel", lift);
  cv.addEventListener("lostpointercapture", lift);
  for (const b of document.querySelectorAll(".rr-pad button")) {
    const d = b.dataset.d === "back" ? -1 : b.dataset.d === "boost" ? 0 : 1, id = "p" + b.dataset.d;
    b.addEventListener("pointerdown", e => {
      e.preventDefault();
      if (state === "ready" || state === "over") start();
      if (state === "pause") pause(false);
      held.set(id + e.pointerId, d);
      try { b.setPointerCapture(e.pointerId); } catch (err) { /* old browsers */ }
      sum();
    });
    const up = e => { if (held.delete(id + e.pointerId)) sum(); };
    b.addEventListener("pointerup", up);
    b.addEventListener("pointercancel", up);
    b.addEventListener("lostpointercapture", up);
    b.addEventListener("contextmenu", e => e.preventDefault());
  }
  $("play").addEventListener("click", start);
  $("again").addEventListener("click", start);
  $("share").addEventListener("click", async () => {
    const url = "https://rotville.world/games/rotville-road/";
    const t = "Farrat got " + fmt(metres) + " m down Rotville Road for " + fmt(score) + " points" + (flips ? ", with " + flips + (flips === 1 ? " flip" : " flips") : "") + ". He has forgotten where he was going.";
    const label = $("share").querySelector(".tape-label");
    if (navigator.share) {
      try { await navigator.share({ title: "Rotville Road", text: t, url }); return; } catch (err) { if (err && err.name === "AbortError") return; }
    }
    try { await navigator.clipboard.writeText(t + " " + url); label.textContent = "Copied"; } catch (err) { label.textContent = "Could not copy"; }
    setTimeout(() => { label.textContent = "Share"; }, 1600);
  });
  const soundBtn = $("sound");
  const sayVolume = () => {
    soundBtn.setAttribute("aria-pressed", String(audio.on));
    soundBtn.setAttribute("aria-label", audio.on ? "Sound on" : "Sound off");
    soundBtn.querySelector(".tape-label").textContent = audio.on ? "Sound: on" : "Sound: off";
  };
  soundBtn.addEventListener("click", () => { audio.set(!audio.on); sayVolume(); });
  sayVolume();
  function pause(on) {
    if (on && state === "play") {
      state = "pause"; banner("PAUSED", 1); $("banner").classList.remove("on"); $("banner").classList.add("hold");
      keys.back = keys.fwd = keys.boost = false; held.clear(); sum();
      if (boosting) { boosting = false; audio.boostStop(); }
      if (audio.ctx) audio.ctx.suspend();
    } else if (!on && state === "pause") {
      state = "play"; $("banner").classList.remove("hold");
      if (audio.ctx) audio.ctx.resume();
    }
  }
  addEventListener("blur", () => pause(true));
  document.addEventListener("visibilitychange", () => { if (document.hidden) pause(true); });

  /* ---------- load, and a run already going behind the first card ---------- */
  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.max(0, Math.min(0.1, (now - last) / 1000));   // a frame can be stamped before the clock started
    last = now;
    if (!atlas) return;
    if (state === "play" || state === "ready" || state === "tumble" || state === "sitting") update(dt);
    else clock += dt;
    if (state === "play" || state === "tumble" || state === "sitting") hud();
    draw();
  }
  Promise.all([
    fetch("assets/scene.json").then(r => r.json()),
    new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = "assets/sprites.png"; }),
  ]).then(([scene, img]) => {
    SPR = scene.sprites; atlas = img;
    newRoad(7);
    K.place(C.START + 2000, 160);                   // the attract run starts among the first hills
    camX = F.hubX - FX; camY = F.hubY - FY; bgCam = camY;
    state = "ready";
    hud();
  }).catch(() => { $("sub").textContent = "The picture did not come through. Reload to try again."; });
  requestAnimationFrame(frame);
})();
