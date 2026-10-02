/* Every Road. Moo-Goo, the sewer beast that is mostly nose, sniffs every road in a grid of Rotville's blocks. A road
   he walks from one crossing to the next is sniffed and stays damp; a block whose four roads are sniffed he
   remembers, and its cabin comes back to colour. Conelie sits on roads he has not sniffed yet and points him the
   wrong way, so such a road is sniffed from both ends, up to her. If he goes too long without a new smell, he
   forgets, and he cries for no reason. Amidar, with a nose. */
(() => {
  "use strict";
  const W = 270, H = 480;
  const R = 28, CELL = 2;                           // a road about as wide as Moo-Goo is long; sniffed in 2-pixel cells
  let B = 44, P = R + B, NC = P / CELL;             // a block, crossing to crossing, cells a road: 44, 72, 36 in the
                                                    // first towns, 32, 60, 30 in the big one from road 6
  const TOP = 50, BOT = 444;                        // the room the town has on the screen, under the channel and the score
  const WET = 9;                                    // half the width of the damp he leaves
  const DIRV = [[1, 0], [0, 1], [-1, 0], [0, -1]];  // right, down, left, up
  const DIRN = { right: 0, down: 1, left: 2, up: 3 };
  const FACE8 = ["r", "dr", "d", "dl", "l", "ul", "u", "ur"];
  const PLOTS = ["cabin", "log", "wood", "cabin2", "log2"];
  // the yards' own colours, taken from the plot render: grass and kerb, remembered and forgotten
  const GRASS = [137, 153, 118], KERB = [232, 227, 220], GRASS_DIM = [72, 76, 79], KERB_DIM = [117, 119, 126];
  // a new smell gives back a little more than walking to it cost, so only the roads he already knows drain him
  const NEW_SMELL = 1.25, GAIN_BLOCK = 0.03;
  const LINES = {
    start: "Moo-Goo sniffs every road in Rotville.",
    cone: "Conelie is pointing the wrong way.",
    clear: "Every road. He will remember every one.",
    end: "Moo-Goo forgot. He cried for no reason.",
  };
  const $ = id => document.getElementById(id);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[(Math.random() * a.length) | 0];
  const cv = $("c"), g = cv.getContext("2d");
  g.imageSmoothingEnabled = false;
  const screen = $("screen");
  const store = {
    get(k, d) { try { const v = localStorage.getItem("everyroad." + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem("everyroad." + k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
  };

  /* ---------- the roads, from a stroll round nine blocks to the whole town, then a less patient town ---------- */
  // c x r blocks of b pixels, `cut` inner roads not there (a new layout every road); his speed in pixels a second; how
  // fast he forgets with nothing new (a whole memory in 1/drain s); Conelie: `start` of her on roads not yet sniffed
  // when the road begins, one more after every `every` blocks remembered, `more` of those at most, and every `hop`
  // seconds one of her moves to another road he still has to sniff. The user, 2026-10-02: from the second road two at
  // least, a few more as it goes, one more every road; and "A new town every road".
  const LEVELS = [
    { c: 3, r: 3, b: 44, cut: 0, speed: 54, drain: 1 / 45, start: 0, every: 0, more: 0, hop: 0 },
    { c: 3, r: 4, b: 44, cut: 0, speed: 56, drain: 1 / 48, start: 2, every: 4, more: 1, hop: 0 },
    { c: 3, r: 5, b: 44, cut: 0, speed: 58, drain: 1 / 44, start: 3, every: 4, more: 2, hop: 0 },
    { c: 3, r: 5, b: 44, cut: 3, speed: 60, drain: 1 / 40, start: 4, every: 3, more: 2, hop: 16 },
    { c: 3, r: 5, b: 44, cut: 4, speed: 62, drain: 1 / 36, start: 5, every: 3, more: 3, hop: 13 },
    { c: 4, r: 6, b: 32, cut: 5, speed: 64, drain: 1 / 32, start: 6, every: 3, more: 3, hop: 11 },
  ];
  function levelOf(n) {
    if (n < LEVELS.length) return LEVELS[n];
    const k = n - LEVELS.length + 1, last = LEVELS[LEVELS.length - 1];
    return { ...last, cut: Math.min(10, last.cut + k), speed: Math.min(84, last.speed + k * 2), drain: last.drain * Math.pow(1.06, k),
             start: Math.min(12, last.start + k), hop: Math.max(6, last.hop - k) };
  }

  /* ---------- state ---------- */
  let state = "load";                               // load, ready, play, pause, clear, forget, over
  let lv = 0, L = LEVELS[0], cols = 2, rows = 2, X0 = 0, Y0 = 0, UNDER0 = 11, UNDER1 = 25;
  let hseg = [], vseg = [], segs = [], blocks = [], yards = [], cones = [], visited = new Set(), sinceCone = 0;
  let score = 0, best = store.get("best", 0), mem = 1, lit = 0, done = 0;
  let roadsAll = 0, blocksAll = 0, said = {}, clock = 0, stateT = 0, hopAt = 0, coneDue = 0, added = 0, sniffT = 0, sniffAt = 0, dripT = 0, tearT = 0;
  let fx = [];
  const mg = { ci: 0, cj: 0, dir: 0, want: -1, p: 0, moving: false, started: false, face: 0, walk: 0, bump: 0 };
  const nx = i => X0 + R / 2 + i * P, ny = j => Y0 + R / 2 + j * P;
  const baseC = document.createElement("canvas"), wetC = document.createElement("canvas");
  const litC = document.createElement("canvas"), dimC = document.createElement("canvas");   // the yards' ground, both ways
  for (const c of [baseC, wetC, litC, dimC]) { c.width = W; c.height = H; }
  const base = baseC.getContext("2d"), wet = wetC.getContext("2d"), litG = litC.getContext("2d"), dimG = dimC.getContext("2d");
  const shuffle = a => { for (let k = a.length - 1; k > 0; k--) { const r = (Math.random() * (k + 1)) | 0; [a[k], a[r]] = [a[r], a[k]]; } return a; };
  let atlas = null, SPR = {};

  // the road leaving crossing (i, j) in direction d, or null at the edge of the town
  function seg(i, j, d) {
    if (d === 0) return i < cols ? hseg[j][i] : null;
    if (d === 2) return i > 0 ? hseg[j][i - 1] : null;
    if (d === 1) return j < rows ? vseg[j][i] : null;
    return j > 0 ? vseg[j - 1][i] : null;
  }
  function mkSeg(h, i, j) {
    const s = { h, i, j, cells: new Uint8Array(NC), n: 0, done: false, cone: null, x0: nx(i), y0: ny(j) };
    s.mx = s.x0 + (h ? P / 2 : 0); s.my = s.y0 + (h ? 0 : P / 2);
    segs.push(s);
    return s;
  }
  function build() {
    L = levelOf(lv); cols = L.c; rows = L.r; B = L.b; P = R + B; NC = P / CELL;
    UNDER0 = Math.floor((P / 2 - 14) / CELL); UNDER1 = Math.ceil((P / 2 + 14) / CELL);
    const mw = cols * B + (cols + 1) * R, mh = rows * B + (rows + 1) * R;
    X0 = Math.round((W - mw) / 2); Y0 = Math.round(TOP + (BOT - TOP - mh) / 2);
    segs = []; hseg = []; vseg = []; cones = []; visited = new Set();
    for (let j = 0; j <= rows; j++) { const row = []; for (let i = 0; i < cols; i++) row.push(mkSeg(true, i, j)); hseg.push(row); }
    for (let j = 0; j < rows; j++) { const row = []; for (let i = 0; i <= cols; i++) row.push(mkSeg(false, i, j)); vseg.push(row); }
    cut(L.cut || 0);
    makeYards();
    lit = 0; done = 0; mem = 1; hopAt = clock + (L.hop || 0); coneDue = 0; added = 0; sinceCone = 0; fx = [];
    paintBase();
    paintYards();
    wet.clearRect(0, 0, W, H);
  }

  /* ---------- a town laid out its own way ---------- */
  // some inner roads are not there, so the blocks either side of one are a single yard: never a road on the town's
  // edge, never so many that a crossing is cut off, never a yard of more than four blocks
  function cut(n) {
    if (!n) return;
    const inner = [];
    for (let j = 1; j < rows; j++) for (let i = 0; i < cols; i++) inner.push([hseg[j], i]);
    for (let j = 0; j < rows; j++) for (let i = 1; i < cols; i++) inner.push([vseg[j], i]);
    let gone = 0;
    for (const [row, i] of shuffle(inner)) {
      if (gone >= n) break;
      const s = row[i];
      row[i] = null;
      if (connected() && Math.max(...Object.values(sizes())) <= 4) gone++;
      else row[i] = s;
    }
    segs = segs.filter(s => (s.h ? hseg[s.j][s.i] : vseg[s.j][s.i]) === s);
  }
  // which yard each block is in: blocks with no road between them are one yard
  function yardOf() {
    const id = Array.from({ length: cols * rows }, (_, k) => k);
    const find = k => (id[k] === k ? k : (id[k] = find(id[k])));
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      if (i > 0 && !vseg[j][i]) id[find(j * cols + i)] = find(j * cols + i - 1);
      if (j > 0 && !hseg[j][i]) id[find(j * cols + i)] = find((j - 1) * cols + i);
    }
    return id.map((_, k) => find(k));
  }
  function sizes() { const n = {}; for (const r of yardOf()) n[r] = (n[r] || 0) + 1; return n; }
  // each yard: its blocks, the roads round it (one that ends inside it counts once), and the ground it covers -
  // its blocks, the roads that are not there between them, and a crossing with no road left at all
  function makeYards() {
    const root = yardOf(), byRoot = new Map(), v = (Math.random() * PLOTS.length) | 0;
    blocks = [];
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const r = root[j * cols + i];
      if (!byRoot.has(r)) byRoot.set(r, { cells: [], edges: new Set(), rects: [], lit: false, litT: 0 });
      const y = byRoot.get(r), cell = { i, j, plot: PLOTS[(v + i * 2 + j * 3) % PLOTS.length], yard: y };
      y.cells.push(cell); blocks.push(cell);
      for (const e of [hseg[j][i], hseg[j + 1][i], vseg[j][i], vseg[j][i + 1]]) if (e) y.edges.add(e);
      y.rects.push([X0 + R + i * P, Y0 + R + j * P, B, B]);
      if (i > 0 && !vseg[j][i]) y.rects.push([X0 + i * P, Y0 + R + j * P, R, B]);
      if (j > 0 && !hseg[j][i]) y.rects.push([X0 + R + i * P, Y0 + j * P, B, R]);
      if (i > 0 && j > 0 && !vseg[j][i] && !hseg[j][i] && !vseg[j - 1][i] && !hseg[j][i - 1]) y.rects.push([X0 + i * P, Y0 + j * P, R, R]);
    }
    yards = [...byRoot.values()].map(y => ({ ...y, edges: [...y.edges] }));
  }

  /* ---------- the ground: moss round the town, light concrete under it, slab joints and a lip at the kerbs ---------- */
  const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  function paintBase() {
    const im = base.createImageData(W, H), d = im.data;
    const mw = cols * B + (cols + 1) * R, mh = rows * B + (rows + 1) * R;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const k = (y * W + x) * 4, lx = x - X0, ly = y - Y0;
      let r, gg, b;
      if (lx >= 0 && ly >= 0 && lx < mw && ly < mh) {
        const hr = ly % P < R, vr = lx % P < R;
        if (hr || vr) {
          let n = hash(x, y) * 12 - 6;
          if (hr && !vr && (lx % P - R + 9) % 18 === 0) n -= 9;                 // slab joints across a road
          if (vr && !hr && (ly % P - R + 9) % 18 === 0) n -= 9;
          if ((hr && !vr && (ly % P === 0 || ly % P === R - 1)) || (vr && !hr && (lx % P === 0 || lx % P === R - 1))) n -= 16;
          r = 208 + n; gg = 202 + n; b = 191 + n;
        } else { r = 31; gg = 37; b = 26; }
      } else {
        const n = hash(x, y) * 8 - 4, tuft = hash(y, x) > 0.985 ? 10 : 0;
        r = 24 + n; gg = 31 + n + tuft; b = 22 + n;
      }
      d[k] = r; d[k + 1] = gg; d[k + 2] = b; d[k + 3] = 255;
    }
    base.putImageData(im, 0, 0);
  }

  // the yards' ground, once a road: grass, and two pixels of kerb wherever it meets a road; remembered and forgotten
  function paintYards() {
    const own = new Int16Array(W * H).fill(-1);
    yards.forEach((y, n) => { for (const [x0, y0, w, h] of y.rects) for (let yy = y0; yy < y0 + h; yy++) for (let xx = x0; xx < x0 + w; xx++) own[yy * W + xx] = n; });
    const a = litG.createImageData(W, H), b = dimG.createImageData(W, H);
    const near = [[1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0], [0, 2], [0, -2]];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const k = y * W + x;
      if (own[k] < 0) continue;
      const kerb = near.some(([dx, dy]) => { const xx = x + dx, yy = y + dy; return xx < 0 || yy < 0 || xx >= W || yy >= H || own[yy * W + xx] < 0; });
      const n = kerb ? (hash(x, y) * 6 - 3) : (hash(x, y) * 14 - 7) - (hash(y, x) > 0.94 ? 12 : 0);
      const c1 = kerb ? KERB : GRASS, c2 = kerb ? KERB_DIM : GRASS_DIM;
      for (let q = 0; q < 3; q++) { a.data[k * 4 + q] = c1[q] + n; b.data[k * 4 + q] = c2[q] + n * 0.6; }
      a.data[k * 4 + 3] = b.data[k * 4 + 3] = 255;
    }
    litG.putImageData(a, 0, 0); dimG.putImageData(b, 0, 0);
  }

  /* ---------- the damp he leaves, and the green that drips off his nose ---------- */
  function damp(x, y, w, h) {
    wet.fillStyle = "rgba(70, 60, 46, 0.32)";
    wet.fillRect(x, y, w, h);
  }
  function dripMark(x, y) {
    wet.fillStyle = pick(["#9db13c", "#b7c64e", "#7f9531", "#a8bb44"]);
    const s = Math.random() < 0.3 ? 2 : 1;
    wet.fillRect(Math.round(x), Math.round(y), s, s);
  }
  function paintCell(s, k) {
    if (s.cells[k]) return false;
    s.cells[k] = 1; s.n++;
    const ragged = Math.random() < 0.3 ? 1 : 0;
    if (s.h) damp(s.x0 + k * CELL, s.y0 - WET - ragged, CELL, (WET + ragged) * 2);
    else damp(s.x0 - WET - ragged, s.y0 + k * CELL, (WET + ragged) * 2, CELL);
    if (Math.random() < 0.18) {
      if (s.h) dripMark(s.x0 + k * CELL + rnd(0, CELL), s.y0 + rnd(-WET + 2, WET - 2));
      else dripMark(s.x0 + rnd(-WET + 2, WET - 2), s.y0 + k * CELL + rnd(0, CELL));
    }
    return true;
  }
  function visitNode(i, j) {
    const key = i + "," + j;
    if (visited.has(key)) return;
    visited.add(key);
    damp(nx(i) - WET, ny(j) - WET, WET * 2, WET * 2);
  }

  /* ---------- Moo-Goo ---------- */
  function place() {
    Object.assign(mg, { ci: 0, cj: rows, dir: 0, want: -1, p: 0, moving: false, started: false, face: 0, walk: 0, bump: 0 });
    visitNode(0, rows);
  }
  function mgXY() { const [dx, dy] = DIRV[mg.dir]; return [nx(mg.ci) + dx * mg.p, ny(mg.cj) + dy * mg.p]; }
  function hereSeg() { return mg.p > 0 ? seg(mg.ci, mg.cj, mg.dir) : null; }
  function reverse() {
    const [dx, dy] = DIRV[mg.dir];
    mg.ci += dx; mg.cj += dy; mg.p = P - mg.p; mg.dir = (mg.dir + 2) % 4;
  }
  function want(d) {
    if (state === "ready") start();
    mg.want = d;
  }
  function move(dt) {
    if (!mg.moving) {
      if (mg.want >= 0 && seg(mg.ci, mg.cj, mg.want)) {
        mg.dir = mg.want; mg.moving = true;
        if (!mg.started) { mg.started = true; }
      } else return;
    }
    if (mg.want >= 0 && mg.want === (mg.dir + 2) % 4 && mg.p > 0) reverse();
    let left = L.speed * dt;
    while (left > 1e-6 && mg.moving) {
      const s = seg(mg.ci, mg.cj, mg.dir);
      if (!s) { mg.moving = false; break; }
      const p0 = mg.p, p1 = Math.min(P, mg.p + left);
      // Conelie on this road: he gets as far as her and she turns him round
      if (standing(s.cone)) {
        const stop = P / 2 - 14;
        if (p0 <= stop + 0.01 && p1 > stop) { paint(s, p0, stop); mg.p = stop; bump(s.cone); return; }
      }
      paint(s, p0, p1);
      left -= p1 - p0; mg.p = p1;
      if (mg.p >= P - 1e-6) {
        const [dx, dy] = DIRV[mg.dir];
        mg.ci += dx; mg.cj += dy; mg.p = 0;
        visitNode(mg.ci, mg.cj);
        if (mg.want >= 0 && mg.want !== mg.dir && seg(mg.ci, mg.cj, mg.want)) mg.dir = mg.want;
        else if (!seg(mg.ci, mg.cj, mg.dir)) mg.moving = false;
      }
    }
  }
  function paint(s, p0, p1) {
    if (p1 <= p0) return;
    const neg = mg.dir === 2 || mg.dir === 3;
    const a = neg ? P - p1 : p0, b = neg ? P - p0 : p1;
    const k0 = Math.max(0, Math.floor(a / CELL)), k1 = Math.min(NC - 1, Math.ceil(b / CELL) - 1);
    let fresh = 0;
    for (let k = k0; k <= k1; k++) if (paintCell(s, k)) fresh++;
    if (fresh) { mem = Math.min(1, mem + fresh * NEW_SMELL * L.drain * CELL / L.speed); sniffT = 0.35; }
    if (!s.done && sniffed(s)) roadDone(s);
  }
  // Conelie on the road, landed and not in the air; the cells under her; a road she stands on is sniffed when the
  // rest of it is, from both ends
  const standing = c => !!c && !c.hop && !(c.drop > 0.12);
  function sniffed(s) {
    if (s.n >= NC) return true;
    if (!standing(s.cone)) return false;
    for (let k = 0; k < NC; k++) if (!s.cells[k] && (k < UNDER0 || k >= UNDER1)) return false;
    return true;
  }
  function bump(c) {
    reverse();
    mg.want = mg.dir;
    mg.bump = 0.3;
    c.face = mg.dir;
    c.squeak = 0.4;
    audio.squeak();
    if (!said.cone) { said.cone = true; say("cone"); }
  }

  /* ---------- roads and blocks ---------- */
  function roadDone(s) {
    for (let k = 0; k < NC; k++) paintCell(s, k);       // under Conelie too, so the road stays done if she moves
    s.done = true; done++; roadsAll++;
    score += 10;
    audio.tick();
    for (const y of yards) {
      if (y.lit || !y.edges.includes(s) || !y.edges.every(e => e.done)) continue;
      y.lit = true; y.litT = clock; lit += y.cells.length; blocksAll += y.cells.length;
      score += 50 * (lv + 1) * y.cells.length;
      mem = Math.min(1, mem + GAIN_BLOCK * y.cells.length);
      audio.chime();
      for (const c of y.cells) {
        const cx = X0 + R + c.i * P + B / 2, cy = Y0 + R + c.j * P + B / 2;
        for (let k = 0; k < 10; k++) fx.push({ kind: "spark", x: cx + rnd(-B / 3, B / 3), y: cy + rnd(-B / 3, B / 4), vx: rnd(-14, 14), vy: rnd(-34, -12), t: 0, life: rnd(0.5, 0.9), col: pick(["#ffe3d6", "#f2b49c", "#fff4c8", "#ffffff"]) });
      }
      sinceCone += y.cells.length;
      if (L.every && sinceCone >= L.every && added < L.more && lit < blocks.length) { sinceCone = 0; coneDue = clock + 0.5; }
    }
    if (done === segs.length) levelClear();
    hud();
  }

  /* ---------- Conelie: on a road he has not sniffed yet, never where she would cut part of the town off ---------- */
  // every crossing reachable from every other without passing her, so each road keeps both its ends to come from
  function connected() {
    const N = cols + 1, seen = new Uint8Array(N * (rows + 1)), q = [];
    let total = 0;
    for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) {
      if (![0, 1, 2, 3].some(d => seg(i, j, d))) continue;
      total++;
      if (!q.length) { seen[j * N + i] = 1; q.push(i, j); }
    }
    let n = q.length ? 1 : 0;
    for (let h = 0; h < q.length; h += 2) {
      const i = q[h], j = q[h + 1];
      for (let d = 0; d < 4; d++) {
        const s = seg(i, j, d);
        if (!s || s.cone) continue;
        const a = i + DIRV[d][0], b = j + DIRV[d][1], k = b * N + a;
        if (!seen[k]) { seen[k] = 1; n++; q.push(a, b); }
      }
    }
    return n === total;
  }
  // a road he still has to sniff, not the one he is on and not right in front of him
  function spot(except) {
    const [x, y] = mgXY(), here = hereSeg();
    const cand = shuffle(segs.filter(s => !s.done && !s.cone && s !== here && s !== except && Math.hypot(s.mx - x, s.my - y) > P * 1.2));
    for (const s of cand) {
      s.cone = { stub: true };
      const ok = connected();
      s.cone = null;
      if (ok) return s;
    }
    return null;
  }
  // she drops in from above, `delay` seconds from now
  function spawnCone(delay) {
    const s = spot(null);
    if (!s) return false;
    const c = { s, x: s.mx, y: s.my, face: 1, squeak: 0, hop: null, drop: 0.35 + (delay || 0) };
    s.cone = c; cones.push(c);
    return true;
  }
  function landed(c) {
    audio.bonk();
    for (let k = 0; k < 8; k++) fx.push({ kind: "dust", x: c.x + rnd(-8, 8), y: c.y + rnd(-2, 6), vx: rnd(-18, 18), vy: rnd(-10, 2), t: 0, life: rnd(0.3, 0.5), col: "#b8b2a6" });
    if (!c.s.done && sniffed(c.s)) roadDone(c.s);
  }
  function startCones() {
    for (let k = 0; k < L.start; k++) spawnCone(0.3 + k * 0.22);
  }
  // one of her moves to another road he still has to sniff; one sitting on a road he has finished goes first
  function hopCone() {
    const idle = cones.filter(c => c.s.done && standing(c)), busy = cones.filter(standing);
    const c = idle.length ? pick(idle) : busy.length ? pick(busy) : null;
    if (!c) return;
    const from = c.s;
    from.cone = null;
    const s = spot(from);
    if (!s) { from.cone = c; return; }
    c.hop = { fx: c.x, fy: c.y, t: 0 };
    c.s = s; s.cone = c; c.x = s.mx; c.y = s.my;
    audio.hop();
  }

  /* ---------- memory, the level's end, his forgetting ---------- */
  function levelClear() {
    state = "clear"; stateT = 0;
    const bonus = Math.round(mem * 200 * (lv + 1));
    score += bonus;
    audio.clear();
    if (!said.clear) { said.clear = true; say("clear"); }
    banner("ROAD " + (lv + 1) + " SNIFFED", 2.4);
    for (const b of blocks) {
      const cx = X0 + R + b.i * P + B / 2, cy = Y0 + R + b.j * P + B / 2;
      for (let k = 0; k < 5; k++) fx.push({ kind: "spark", x: cx + rnd(-18, 18), y: cy + rnd(-14, 12), vx: rnd(-10, 10), vy: rnd(-30, -10), t: -rnd(0, 0.8), life: rnd(0.6, 1), col: pick(["#ffe3d6", "#fff4c8"]) });
    }
    hud();
  }
  function nextLevel() {
    lv++;
    build(); place(); startCones();
    state = "play"; stateT = 0;
    banner("ROAD " + (lv + 1), 1.6);
    hud();
  }
  function forget() {
    state = "forget"; stateT = 0; mem = 0;
    mg.moving = false;
    audio.forget();
    say("end");
    hud();
  }
  function over() {
    state = "over";
    if (score > best) { best = score; store.set("best", best); }
    $("over-title").textContent = "Moo-Goo forgot.";
    $("over-line").textContent = "He cried for no reason.";
    $("over-stats").textContent = roadsAll + (roadsAll === 1 ? " road" : " roads") + " sniffed · " + blocksAll + (blocksAll === 1 ? " block" : " blocks") + " remembered · road " + (lv + 1) + " · " + fmt(score) + " points";
    $("over").hidden = false;
    hud();
  }
  function start() {
    audio.unlock();
    lv = 0; score = 0; roadsAll = 0; blocksAll = 0; said = {};
    build(); place(); startCones();
    state = "play"; stateT = 0;
    $("ready").hidden = true; $("over").hidden = true;
    say("start");
    banner("ROAD 1", 1.6);
    hud();
  }

  /* ---------- the loop ---------- */
  function update(dt) {
    clock += dt; stateT += dt;
    if (state === "play") {
      move(dt);
      if (mg.started) mem -= L.drain * dt;
      if (coneDue && clock >= coneDue) { coneDue = 0; if (spawnCone(0)) added++; }
      if (L.hop && mg.started && clock >= hopAt && state === "play") { hopAt = clock + L.hop; hopCone(); }
      if (mem <= 0 && state === "play") forget();
    } else if (state === "clear" && stateT > 3) nextLevel();
    else if (state === "forget" && stateT > 2.9) over();
    // his face turns the short way round to where he is going
    const target = mg.dir * 90;
    let diff = ((target - mg.face + 540) % 360) - 180;
    const turn = 720 * dt;
    mg.face = Math.abs(diff) <= turn ? target : (mg.face + Math.sign(diff) * turn + 360) % 360;
    if (mg.moving && state === "play") mg.walk += dt;
    mg.bump = Math.max(0, mg.bump - dt);
    sniffT -= dt;
    for (const c of cones) {
      c.squeak = Math.max(0, c.squeak - dt);
      if (c.drop) { c.drop = Math.max(0, c.drop - dt); if (!c.drop) landed(c); }
      if (c.hop) { c.hop.t += dt; if (c.hop.t >= 0.6) { c.hop = null; landed(c); } }
    }
    // he sniffs as he goes onto new road: a set of three every second and a half, 101's five in turn
    sniffAt -= dt;
    if (state === "play" && sniffT > 0 && sniffAt <= 0) { sniffAt = 1.5; audio.sniff(); }
    // the nose drips as he goes, and a drip lands on the road as a green spot
    if (state === "play" && mg.moving) {
      dripT -= dt;
      if (dripT <= 0) {
        dripT = rnd(0.16, 0.34);
        const [x, y] = mgXY(), [ox, oy] = nose();
        fx.push({ kind: "drip", x: x + ox, y: y + oy, vx: 0, vy: 0, t: 0, life: 0.22, col: "#b7c64e" });
      }
    }
    // when he forgets, he cries
    if (state === "forget") {
      tearT -= dt;
      if (tearT <= 0) {
        tearT = 0.1;
        const [x, y] = mgXY();
        for (const s of [-6, 6]) fx.push({ kind: "tear", x: x + s + rnd(-1, 1), y: y - 14, vx: s * 2, vy: rnd(-14, -2), t: 0, life: 0.8, col: pick(["#9fd3ff", "#cfeaff"]) });
      }
    }
    for (const f of fx) {
      f.t += dt;
      if (f.t < 0) continue;
      if (f.kind === "drip") { f.vy += 60 * dt; f.y += f.vy * dt; if (f.t >= f.life) dripMark(f.x, f.y); }
      else if (f.kind === "tear") { f.vy += 160 * dt; f.x += f.vx * dt; f.y += f.vy * dt; }
      else { f.vy += 40 * dt; f.x += f.vx * dt; f.y += f.vy * dt; }
    }
    fx = fx.filter(f => f.t < f.life);
    hud();
  }
  // where his nose is, from his feet, for the way he faces
  function nose() {
    const a = (Math.round(mg.face / 45) % 8) * 45 * Math.PI / 180;
    return [Math.cos(a) * 12, Math.sin(a) * 7 + 3];
  }

  /* ---------- drawing ---------- */
  function spr(name, x, y) {
    const s = SPR[name];
    if (!s) return;
    g.drawImage(atlas, s[0], s[1], s[2], s[3], Math.round(x - s[4]), Math.round(y - s[5]), s[2], s[3]);
  }
  function shadow(x, y, w, h, a) {
    g.fillStyle = "rgba(24, 16, 10, " + a + ")";
    g.beginPath(); g.ellipse(Math.round(x), Math.round(y), w, h, 0, 0, Math.PI * 2); g.fill();
  }
  function draw() {
    g.drawImage(baseC, 0, 0);
    for (const y of yards) {
      for (const [x0, y0, w, h] of y.rects) g.drawImage(y.lit ? litC : dimC, x0, y0, w, h, x0, y0, w, h);
      if (y.lit && clock - y.litT < 0.7) {
        g.globalAlpha = (1 - (clock - y.litT) / 0.7) * 0.5;
        g.globalCompositeOperation = "lighter";
        for (const [x0, y0, w, h] of y.rects) g.drawImage(litC, x0, y0, w, h, x0, y0, w, h);
        g.globalCompositeOperation = "source-over";
        g.globalAlpha = 1;
      }
    }
    g.drawImage(wetC, 0, 0);
    const kind = B === 44 ? "bld_" : "bld32_";
    for (const c of blocks) {
      const x = X0 + R + c.i * P + B / 2, y = Y0 + R + c.j * P + B, yd = c.yard;
      spr(kind + c.plot + (yd.lit ? "" : "_dim"), x, y - 1);
      if (yd.lit && clock - yd.litT < 0.7) {
        g.globalAlpha = (1 - (clock - yd.litT) / 0.7) * 0.6;
        g.globalCompositeOperation = "lighter";
        spr(kind + c.plot, x, y - 1);
        g.globalCompositeOperation = "source-over";
        g.globalAlpha = 1;
      }
    }
    for (const c of cones) {
      let x = c.x, y = c.y, lift = 0;
      if (c.hop) {
        const t = Math.min(1, c.hop.t / 0.6);
        x = c.hop.fx + (c.x - c.hop.fx) * t; y = c.hop.fy + (c.y - c.hop.fy) * t; lift = Math.sin(t * Math.PI) * 26;
      }
      if (c.drop > 0.35) continue;
      if (c.drop) lift = Math.max(lift, (c.drop / 0.35) * 30);
      shadow(x, y + 5, 9, 3.5, 0.28);
      const wob = c.squeak ? Math.round(Math.sin(c.squeak * 40)) : 0;
      spr(c.squeak ? "cn_squeak" : "cn_" + ["r", "d", "l", "u"][c.face], x + wob, y + 6 - lift);
    }
    const [x, y] = mgXY();
    shadow(x, y + 5, 13, 4.5, 0.26);
    let name;
    if (state === "forget" || state === "over") name = "mg_cry";
    else if (state === "clear") name = "mg_glad";
    else name = "mg_" + FACE8[Math.round(mg.face / 45) % 8] + "_" + (mg.moving && Math.floor(mg.walk * 7) % 2 ? "b" : "a");
    const shake = mg.bump ? Math.round(Math.sin(mg.bump * 60)) : 0;
    spr(name, x + shake, y + 6);
    for (const f of fx) {
      if (f.t < 0) continue;
      const a = f.kind === "drip" ? 1 : Math.max(0, 1 - f.t / f.life);
      g.globalAlpha = a;
      g.fillStyle = f.col;
      g.fillRect(Math.round(f.x), Math.round(f.y), f.kind === "tear" || f.kind === "dust" ? 2 : 1, f.kind === "tear" ? 3 : f.kind === "dust" ? 2 : 1);
      g.globalAlpha = 1;
    }
    if (state === "pause") { g.fillStyle = "rgba(10, 8, 6, 0.45)"; g.fillRect(0, 0, W, H); }
  }

  /* ---------- the set's own writing: score, road, memory, a word in the middle ---------- */
  const fmt = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  let shown = {};
  function hud() {
    const sc = fmt(score), lvl = "ROAD " + (lv + 1), m = Math.max(0, Math.min(1, mem));
    if (shown.sc !== sc) { $("score").textContent = sc; shown.sc = sc; }
    if (shown.lvl !== lvl) { $("level").textContent = lvl; shown.lvl = lvl; }
    const pct = (m * 100).toFixed(1) + "%";
    if (shown.mem !== pct) { $("mem").style.width = pct; shown.mem = pct; }
    const low = state === "play" && mg.started && m < 0.25;
    if (shown.low !== low) { $("mem").parentNode.parentNode.classList.toggle("low", low); shown.low = low; }
    const b = "Best " + fmt(best);
    if (shown.best !== b) { $("best").textContent = b; shown.best = b; }
  }
  let bannerTimer = 0;
  function banner(text, sec) {
    const el = $("banner");
    el.textContent = text;
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
    audio.line(k).then(d => { subTimer = setTimeout(() => { $("sub").textContent = ""; }, (Math.max(d, 1.6) + 0.6) * 1000); });
  }

  /* ---------- sound: the bed, four lines, the rest made on the spot ---------- */
  const audio = {
    ctx: null, on: store.get("sound", true), raw: {}, buf: {}, music: null,
    fetch() {
      for (const [k, f] of [["start", "assets/line-start.mp3"], ["cone", "assets/line-cone.mp3"], ["clear", "assets/line-clear.mp3"],
                            ["end", "assets/line-end.mp3"], ["music", "assets/crackle-waltz.mp3"],
                            ["sniff1", "assets/sniff-1.mp3"], ["sniff2", "assets/sniff-2.mp3"], ["sniff3", "assets/sniff-3.mp3"],
                            ["sniff4", "assets/sniff-4.mp3"], ["sniff5", "assets/sniff-5.mp3"]]) {
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
    // 101's sniffs: its five sets of three, in turn (tools/make-sfx/sniffs.py, size 6, seeds 101 to 145, as 101 made them)
    sniff() {
      if (!this.ctx) return;
      this.sniffN = ((this.sniffN || 0) % 5) + 1;
      this.buf["sniff" + this.sniffN].then(b => {
        if (!b) return;
        const c = this.ctx, s = c.createBufferSource(), e = c.createGain();
        s.buffer = b; e.gain.value = 1.2;
        s.connect(e).connect(this.fxg); s.start();
      });
    },
    tick() { this.tone(880, 870, 0.05, "triangle", 0.045); },
    // a block remembered: two soft bell notes
    chime() { this.tone(659, 655, 0.3, "sine", 0.09); this.tone(988, 985, 0.42, "sine", 0.08, 0.09); this.tone(1319, 1310, 0.3, "sine", 0.03, 0.18); },
    // Conelie, bumped: the cone squeaks
    squeak() { this.tone(1500, 2300, 0.08, "square", 0.035); this.tone(2300, 1700, 0.08, "square", 0.025, 0.08); },
    bonk() { this.tone(240, 150, 0.12, "triangle", 0.09); this.noise(0.08, 0.04, 200, 1200); },
    hop() { this.tone(300, 600, 0.18, "triangle", 0.05); },
    clear() { [523, 659, 784, 1047].forEach((f, k) => this.tone(f, f, 0.22, "sine", 0.07, k * 0.11)); },
    forget() { this.tone(520, 170, 1.5, "sine", 0.1); this.noise(0.7, 0.025, 400, 1300, 0.25); },
  };
  audio.fetch();

  /* ---------- input ---------- */
  const KEYS = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right", KeyW: "up", KeyS: "down", KeyA: "left", KeyD: "right" };
  addEventListener("keydown", e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const d = KEYS[e.code];
    if (d) {
      if (state === "play" || state === "clear" || state === "ready") { e.preventDefault(); if (state !== "ready" || e.target === document.body) want(DIRN[d]); }
    } else if (e.code === "Space" || e.code === "KeyP") {
      if (state === "play" || state === "pause") { e.preventDefault(); pause(state === "play"); }
      else if (state === "ready" && e.target === document.body) { e.preventDefault(); start(); }
    } else if (e.code === "Enter" && (state === "ready" || state === "over") && e.target === document.body) {
      e.preventDefault(); start();
    }
  });
  let touch = null;
  const area = $("area");
  area.addEventListener("touchstart", e => {
    if (e.target.closest("button, a")) { touch = null; return; }
    const t = e.changedTouches[0];
    touch = { x: t.clientX, y: t.clientY };
  }, { passive: true });
  area.addEventListener("touchmove", e => {
    if (!touch) return;
    const t = e.changedTouches[0], dx = t.clientX - touch.x, dy = t.clientY - touch.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;
    if (state === "play" || state === "clear") want(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 0 : 2) : dy > 0 ? 1 : 3);
    touch = { x: t.clientX, y: t.clientY };
  }, { passive: true });
  area.addEventListener("touchend", () => { touch = null; }, { passive: true });
  screen.addEventListener("click", e => { if (state === "pause" && !e.target.closest("button")) pause(false); });
  $("pad").addEventListener("pointerdown", e => {
    const b = e.target.closest("button[data-d]");
    if (!b) return;
    e.preventDefault();
    if (state === "ready" || state === "over") start();
    want(DIRN[b.dataset.d]);
    b.classList.add("on");
    setTimeout(() => b.classList.remove("on"), 120);
  });
  $("play").addEventListener("click", start);
  $("again").addEventListener("click", start);
  $("share").addEventListener("click", async () => {
    const url = "https://rotville.world/games/every-road/";
    const text = "Moo-Goo sniffed " + roadsAll + " roads of Rotville and remembered " + blocksAll + " blocks.";
    const label = $("share").querySelector(".tape-label");
    if (navigator.share) {
      try { await navigator.share({ title: "Every Road", text, url }); return; } catch (err) { if (err && err.name === "AbortError") return; }
    }
    try { await navigator.clipboard.writeText(text + " " + url); label.textContent = "Copied"; } catch (err) { label.textContent = "Could not copy"; }
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
    if (on && state === "play") { state = "pause"; banner("PAUSED", 1); $("banner").classList.remove("on"); $("banner").classList.add("hold"); if (audio.ctx) audio.ctx.suspend(); }
    else if (!on && state === "pause") { state = "play"; $("banner").classList.remove("hold"); if (audio.ctx) audio.ctx.resume(); }
  }
  addEventListener("blur", () => pause(true));
  document.addEventListener("visibilitychange", () => { if (document.hidden) pause(true); });

  /* ---------- load, and a town behind the first card ---------- */
  function attract() {
    lv = 4; build(); lv = 0;
    const walk = [[0, rows, 0], [1, rows, 3], [1, rows - 1, 2], [0, rows - 1, 1], [1, rows - 1, 0], [2, rows - 1, 3]];
    for (const [i, j, d] of walk) {
      const s = seg(i, j, d);
      if (!s) continue;
      for (let k = 0; k < NC; k++) paintCell(s, k);
      s.done = true;
      visitNode(i, j); visitNode(i + DIRV[d][0], j + DIRV[d][1]);
    }
    for (const y of yards) if (y.edges.every(e => e.done)) y.lit = true;
    for (const [i, j, d, face] of [[1, 1, 0, 1], [2, 2, 1, 2]]) {
      const cs = seg(i, j, d);
      if (cs && !cs.done) { const c = { s: cs, x: cs.mx, y: cs.my, face, squeak: 0, hop: null, drop: 0 }; cs.cone = c; cones.push(c); }
    }
    Object.assign(mg, { ci: 2, cj: rows - 1, dir: 3, p: 30, moving: true, started: false, face: 270, walk: 0, bump: 0 });
  }
  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.max(0, Math.min(0.1, (now - last) / 1000));   // a frame can be stamped before the clock started
    last = now;
    if (!atlas) return;
    if (state === "play" || state === "clear" || state === "forget") update(dt);
    else clock += dt;
    draw();
  }
  Promise.all([
    fetch("assets/scene.json").then(r => r.json()),
    new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = "assets/sprites.png"; }),
  ]).then(([scene, img]) => {
    SPR = scene.sprites; atlas = img;
    attract();
    state = "ready";
    hud();
  }).catch(() => { $("sub").textContent = "The picture did not come through. Reload to try again."; });
  requestAnimationFrame(frame);
})();
