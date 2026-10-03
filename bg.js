'use strict';
// Procedural pixel-art background for a 160x90 logical screen (daytime meadow, KV style).
const BG = (() => {
  function rng(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function mk(w, h) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d'); x.imageSmoothingEnabled = false; return [c, x];
  }
  function P(x, X, Y, col) { x.fillStyle = col; x.fillRect(X, Y, 1, 1); }

  // ---- sky: banded gradient with ordered dithering ----
  function makeSky(theme) {
    const [c, x] = mk(160, 60);
    const cols = theme === 'dusk'
      ? ['#2a1a4a', '#4a2468', '#8a3060', '#c44848', '#e87838', '#f0a848', '#f8c870', '#f8d888']
      : theme === 'night'
      ? ['#0a1028', '#101838', '#182048', '#1c2860', '#243070', '#2a3878', '#304080', '#384888']
      : theme === 'forest'
      ? ['#1c4a88', '#2860a0', '#3878b8', '#4a90c8', '#68a8d8', '#88c0e4', '#a8d4ee', '#c0e4f4']
      : ['#2a78dc', '#378aea', '#469cf1', '#5aaef5', '#72c0f8', '#92d2fa', '#b4e2fb', '#c8ecfc'];
    const band = 7;
    for (let y = 0; y < 60; y++) {
      const i = Math.min(cols.length - 1, Math.floor(y / band));
      const nxt = cols[Math.min(cols.length - 1, i + 1)];
      const f = y % band;
      for (let X = 0; X < 160; X++) {
        let col = cols[i];
        if (f === band - 1 && ((X + y) & 1)) col = nxt;
        else if (f === band - 2 && (X % 4 === ((y >> 1) & 1) * 2)) col = nxt;
        P(x, X, y, col);
      }
    }
    return c;
  }

  // ---- sun (static, top-left like the KV) ----
  function makeSun(theme) {
    const [c, x] = mk(25, 25);
    const cx = 12, cy = 12;
    const inner = theme === 'dusk' ? '#ffe0a0' : '#fff7b0';
    const mid = theme === 'dusk' ? '#ff8a3a' : '#ffe24a';
    const outer = theme === 'dusk' ? '#e04820' : '#ffb52e';
    for (let y = 0; y < 25; y++) for (let X = 0; X < 25; X++) {
      const d = Math.hypot(X - cx, y - cy);
      if (d <= 5.2) P(x, X, y, d <= 2.6 ? inner : (d <= 4.2 ? mid : outer));
    }
    const rays = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];
    for (const [dx, dy] of rays) {
      const n = (dx && dy) ? 2 : 3;
      for (let k = 0; k < n; k++) { const r = (dx && dy) ? 6 + k : 7 + k; P(x, cx + dx * r, cy + dy * r, k === 0 ? '#ffe24a' : '#ffd23a'); }
    }
    return c;
  }

  // ---- clouds ----
  function makeCloud(r, w, h) {
    const [c, x] = mk(w, h);
    const n = 3 + Math.floor(r() * 3), circles = [];
    for (let i = 0; i < n; i++) {
      const cx = w * (0.18 + 0.64 * i / (n - 1)) + (r() - 0.5) * 3;
      const edge = (i === 0 || i === n - 1);
      const rad = h * (edge ? 0.38 + r() * 0.12 : 0.55 + r() * 0.35);
      circles.push([cx, h - rad, rad]);
    }
    const inside = (X, Y) => Y >= 0 && Y < h && X >= 0 && X < w &&
      circles.some(([cx, cy, rr]) => (X + 0.5 - cx) ** 2 + (Y + 0.5 - cy) ** 2 <= rr * rr);
    for (let y = 0; y < h; y++) for (let X = 0; X < w; X++) {
      if (!inside(X, y)) continue;
      let col = '#ffffff';
      if (y >= h - 2) col = '#d2e9fb';
      else if (!inside(X + 1, y + 1) || !inside(X, y + 2)) col = '#e2f1fd';
      P(x, X, y, col);
    }
    return c;
  }
  function makeClouds(seed) {
    const r = rng(seed), list = [];
    const period = 420;
    let X = 10;
    while (X < period - 30) {
      const w = 18 + Math.floor(r() * 18), h = 7 + Math.floor(r() * 6);
      list.push({ img: makeCloud(r, w, h), x: X, y: 4 + Math.floor(r() * 26) });
      X += w + 20 + Math.floor(r() * 40);
    }
    return { list, period };
  }

  // ---- hills (periodic strips) ----
  function makeHills(period, baseY, freqs, body, light, speck, seed) {
    const [c, x] = mk(period, 60);
    const r = rng(seed);
    for (let X = 0; X < period; X++) {
      let h = 0;
      for (const [k, a, ph] of freqs) h += a * Math.sin(2 * Math.PI * k * X / period + ph);
      const top = Math.round(baseY - h);
      for (let y = top; y < 60; y++) P(x, X, y, y === top ? light : body);
      if (speck && r() < 0.25) P(x, X, top + 2 + Math.floor(r() * 5), speck);
    }
    return { img: c, period };
  }

  // ---- tree line ----
  function makeTrees(seed) {
    const period = 256;
    const [c, x] = mk(period, 60);
    const r = rng(seed);
    const trees = [];
    let X = 4;
    while (X < period - 4) {
      const rad = 4 + Math.floor(r() * 4);
      if (r() < 0.78) trees.push([X, rad, 53 - Math.floor(r() * 3)]);
      X += rad * 1.5 + Math.floor(r() * 14);
    }
    function tree(cx, rad, base) {
      const cy = base - rad;
      const blobs = [[cx, cy, rad], [cx - rad * 0.6, cy + rad * 0.35, rad * 0.7], [cx + rad * 0.6, cy + rad * 0.35, rad * 0.7], [cx, cy - rad * 0.5, rad * 0.65]];
      for (let y = Math.floor(cy - rad * 1.3); y <= base; y++) for (let X = Math.floor(cx - rad * 1.4); X <= cx + rad * 1.4; X++) {
        if (X < 0 || X >= period) continue;
        if (!blobs.some(([bx, by, br]) => (X + 0.5 - bx) ** 2 + (y + 0.5 - by) ** 2 <= br * br)) continue;
        const s = (X - cx) + (y - cy);
        let col = '#2f7c35';
        if (s < -rad * 0.55) col = '#4fa246';
        else if (s > rad * 0.75) col = '#22612a';
        P(x, X, y, col);
      }
    }
    for (const [cx, rad, base] of trees) for (const dx of [-period, 0, period]) tree(cx + dx, rad, base);
    return { img: c, period };
  }

  // ---- meadow (full world width strip, drawn at y=MEADOW_TOP) ----
  const MEADOW_TOP = 52;
  function makeMeadow(worldW, seed) {
    const MW = worldW + 160, Hm = 90 - MEADOW_TOP;
    const [c, x] = mk(MW, Hm);
    const r = rng(seed);
    const rows = ['#56a83b', '#59ad3d', '#5db23f', '#61b741', '#65bc43', '#69c145', '#6cc547'];
    for (let y = 1; y < Hm; y++) { x.fillStyle = rows[Math.min(rows.length - 1, Math.floor(y / 5))]; x.fillRect(0, y, MW, 1); }
    // ragged horizon edge
    for (let X = 0; X < MW; X++) if (r() < 0.55) P(x, X, 0, r() < 0.5 ? '#4f9f36' : '#56a83b');
    // speckle texture, denser towards the viewer
    const n = Math.floor(MW * Hm * 0.10);
    for (let i = 0; i < n; i++) {
      const y = 1 + Math.floor(Math.sqrt(r()) * (Hm - 1)), X = Math.floor(r() * MW);
      P(x, X, y, r() < 0.6 ? '#4a9a31' : '#80d058');
    }
    // grass blades
    for (let i = 0; i < MW * 1.1; i++) {
      const y = 6 + Math.floor(Math.sqrt(r()) * (Hm - 6)), X = Math.floor(r() * MW);
      const len = y > 20 ? 2 + Math.floor(r() * 2) : 1 + Math.floor(r() * 2);
      x.fillStyle = '#44922d'; x.fillRect(X, y - len, 1, len);
      if (r() < 0.5) P(x, X, y - len, '#8ddb62');
    }
    // flowers
    const FL = [
      ['#ffffff', '#ffd84a'], ['#ffffff', '#ffd84a'], ['#ffe04a', '#ff9f1a'],
      ['#ff9ac8', '#fff0f6'], ['#86bdff', '#ffffff'],
    ];
    const nf = Math.floor(MW * 0.20);
    for (let i = 0; i < nf; i++) {
      const y = 2 + Math.floor(Math.pow(r(), 0.55) * (Hm - 4)), X = 1 + Math.floor(r() * (MW - 2));
      const [petal, center] = FL[Math.floor(r() * FL.length)];
      if (y < 9) { P(x, X, y, petal); continue; }
      P(x, X - 1, y, petal); P(x, X + 1, y, petal); P(x, X, y - 1, petal); P(x, X, y + 1, petal);
      P(x, X, y, center);
      if (y > 16) P(x, X, y + 2, '#3f8a2a');
    }
    return c;
  }

  // ---- road overlay for 'road' theme (placeholder until the 32x32 road tiles arrive) ----
  function addRoad(c, seed, imgs) {
    const x = c.getContext('2d'), MW = c.width, r = rng(seed);
    if (imgs && imgs.road) {   // real tile: 32x8 at screen rows 64..71 (fence etc. are drawn by game.js)
      for (let X = 0; X < MW; X += imgs.road.width) x.drawImage(imgs.road, X, 64 - MEADOW_TOP);
      return;
    }
    const top = 62 - MEADOW_TOP, bot = 72 - MEADOW_TOP;   // screen rows 62..71 (feet row is 67)
    x.fillStyle = '#c9a36a'; x.fillRect(0, top, MW, bot - top);
    x.fillStyle = '#b08a52'; x.fillRect(0, top, MW, 1); x.fillRect(0, bot - 1, MW, 1);
    x.fillStyle = '#dcb880'; x.fillRect(0, top + 1, MW, 1);
    for (let i = 0; i < MW * 0.5; i++) P(x, Math.floor(r() * MW), top + 2 + Math.floor(r() * (bot - top - 3)), r() < 0.5 ? '#b89260' : '#e2c48e');
    // wooden fence along the back edge of the road
    const fy = top - 7;
    for (let X = 0; X < MW; X += 16) {
      x.fillStyle = '#6a4020'; x.fillRect(X, fy, 2, 7);
      x.fillStyle = '#a8703c'; x.fillRect(X, fy, 1, 6);
    }
    x.fillStyle = '#8a5a2e'; x.fillRect(0, fy + 1, MW, 1); x.fillRect(0, fy + 4, MW, 1);
    x.fillStyle = '#b07a44'; for (let X = 0; X < MW; X += 16) { x.fillRect(X + 2, fy + 1, 14, 1); }
  }

  function build(worldW, theme, imgs) {
    const roadish = theme === 'road' || theme === 'town';
    const meadow = makeMeadow(worldW, roadish ? 33 : 21);
    if (roadish) addRoad(meadow, 44, imgs);
    const sky = theme === 'canyon' ? 'dusk' : theme;   // canyon = evening sky with red-earth hills
    const pal = theme === 'canyon' ? { farA: '#b07a5a', farB: '#c8946c', nearA: '#a8683a', nearB: '#c4824a', nearL: '#8a5028' }
      : theme === 'highland' ? { farA: '#9cc0dc', farB: '#b8d4ea', nearA: '#74b864', nearB: '#94d07c', nearL: '#58a048' }
      : theme === 'dusk' ? { farA: '#6a7a6e', farB: '#889888', nearA: '#4a7a38', nearB: '#6a9a4a', nearL: '#3a6828' }
      : theme === 'forest' ? { farA: '#3a6a48', farB: '#4e8060', nearA: '#2e5a32', nearB: '#3e7240', nearL: '#244a28' }
      : theme === 'night' ? { farA: '#2a3a48', farB: '#3a4c5c', nearA: '#1e3a28', nearB: '#2a4e34', nearL: '#163020' }
      : { farA: '#8ccaa6', farB: '#a8dcbc', nearA: '#63ae4d', nearB: '#82c966', nearL: '#4e9a3e' };
    return {
      theme: sky,
      sky: makeSky(sky),
      sun: makeSun(sky),
      clouds: makeClouds(7),
      hillsFar: makeHills(320, 44, [[1, 4, 0.3], [3, 2.5, 1.7], [7, 1, 0.2]], pal.farA, pal.farB, null, 3),
      hillsNear: makeHills(288, 50, [[1, 3, 2.1], [2, 3, 0.4], [5, 1.5, 1.1]], pal.nearA, pal.nearB, pal.nearL, 5),
      trees: makeTrees(theme === 'forest' ? 19 : 11),
      meadow,
      MEADOW_TOP,
    };
  }

  function tile(g, layer, cam, f, W) {
    const off = -(((Math.floor(cam * f)) % layer.period) + layer.period) % layer.period;
    for (let X = off; X < W; X += layer.period) g.drawImage(layer.img, X, 0);
  }

  function draw(g, bg, cam, t, W) {
    g.drawImage(bg.sky, 0, 0);
    if (bg.theme === 'night') {
      const r = BG.rng(9);
      for (let i = 0; i < 28; i++) {
        const sx = (Math.floor(r() * 160) - Math.floor(cam * 0.04) + 160) % 160;
        const sy = 2 + Math.floor(r() * 36);
        g.fillStyle = r() < 0.3 ? '#ffffff' : '#d8e8ff';
        g.fillRect(sx, sy, 1, 1);
      }
    } else if (bg.theme !== 'forest') {
      g.drawImage(bg.sun, bg.theme === 'dusk' ? 118 : 3, bg.theme === 'dusk' ? 18 : 0);
    }
    const cl = bg.clouds;
    for (const c of cl.list) {
      let X = c.x - Math.floor(cam * 0.1 + t * 1.5);
      X = ((X % cl.period) + cl.period) % cl.period - 40;
      if (X < W) g.drawImage(c.img, X, c.y);
    }
    tile(g, bg.hillsFar, cam, 0.15, W);
    tile(g, bg.hillsNear, cam, 0.3, W);
    tile(g, bg.trees, cam, 0.5, W);
    g.drawImage(bg.meadow, cam, 0, W, 90 - bg.MEADOW_TOP, 0, bg.MEADOW_TOP, W, 90 - bg.MEADOW_TOP);
  }

  return { build, draw, rng };
})();
