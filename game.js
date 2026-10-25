'use strict';
// ぬいぐるみモンスター — browser prototype v0.1
// 160x90 logical canvas, integer-scaled, nearest neighbour. Plain JS, no build step.
(() => {
  const W = 160, H = 90, GROUND = 67;   // GROUND = y of the feet row
  const params = new URLSearchParams(location.search);
  const $err = document.getElementById('err');
  window.addEventListener('error', e => { $err.textContent += (e.message || e) + '\n'; });

  // ---------- canvases ----------
  function mk(w, h, opts) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d', opts); x.imageSmoothingEnabled = false; return [c, x];
  }
  const view = document.getElementById('view');
  const vctx = view.getContext('2d');
  const [low, g] = mk(W, H);
  // Clean downscaling: nearest-neighbour shrinking drops pixel rows/columns (jaggies). Any draw onto the game canvas whose
  // destination is smaller than its source is redirected to a cached copy resampled once at the exact target size by area
  // coverage (alpha-thresholded so edges stay crisp; colour = area-weighted majority palette colour, ties to the lighter),
  // and a 1px outline is restored only just outside the silhouette - faces and interiors are never darkened.
  const DS = new WeakMap();
  const lumOf = ck => (ck >> 16) * 0.3 + ((ck >> 8) & 255) * 0.59 + (ck & 255) * 0.11;
  function downscaled(img, sx, sy, sw, sh, dw, dh) {
    let m = DS.get(img); if (!m) DS.set(img, (m = new Map()));
    const key = sx + ',' + sy + ',' + sw + ',' + sh + ',' + dw + ',' + dh; let c = m.get(key); if (c) return c;
    const [sc, sx2] = mk(sw, sh); sx2.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
    let src; try { src = sx2.getImageData(0, 0, sw, sh).data; } catch (e) { return null; }
    const [dc, dx2] = mk(dw, dh), out = dx2.createImageData(dw, dh), o = out.data, fx = sw / dw, fy = sh / dh;
    const dark = new Float32Array(dw * dh * 4), op = new Uint8Array(dw * dh), hasDark = new Uint8Array(dw * dh), vote = new Map();
    for (let y = 0; y < dh; y++) for (let x = 0; x < dw; x++) {
      const x0 = x * fx, x1 = x0 + fx, y0 = y * fy, y1 = y0 + fy; let r = 0, gg = 0, b = 0, a = 0, ar = 0, best = 1e9, di = -1;
      for (let yy = Math.floor(y0); yy < Math.ceil(y1); yy++) { const wy = Math.min(y1, yy + 1) - Math.max(y0, yy); if (wy <= 0) continue;
        for (let xx = Math.floor(x0); xx < Math.ceil(x1); xx++) { const wx = Math.min(x1, xx + 1) - Math.max(x0, xx); if (wx <= 0) continue;
          const i = (yy * sw + xx) * 4, w = wx * wy, al = src[i + 3] / 255; ar += w; a += al * w;
          if (al > 0.5) { const lum = src[i] * 0.3 + src[i + 1] * 0.59 + src[i + 2] * 0.11, ck = (src[i] << 16) | (src[i + 1] << 8) | src[i + 2];
            vote.set(ck, (vote.get(ck) || 0) + w); if (lum < 80) { const T0 = (X, Y) => X < 0 || Y < 0 || X >= sw || Y >= sh || src[(Y * sw + X) * 4 + 3] < 128;
              if ((T0(xx - 1, yy) || T0(xx + 1, yy) || T0(xx, yy - 1) || T0(xx, yy + 1)) && lum < best) { best = lum; di = i; } } } } }   // only the source's OUTER outline counts
      const j = (y * dw + x) * 4, cov = a / ar;
      if (cov >= 0.45 && vote.size) { let bc = 0, bw = -1; let dw2 = 0, tw2 = 0; for (const [ck, w] of vote) { tw2 += w; if (lumOf(ck) < 80) dw2 += w; }
        const lightOnly = dw2 < tw2 * 0.7;   // dark wins a pixel only when it fills most of it: faces keep their light fill
        for (const [ck, w] of vote) { const l = lumOf(ck); if (lightOnly && l < 80) continue; if (w + l / 2550 > bw) { bw = w + l / 2550; bc = ck; } }   // majority; ties go to the lighter colour   // palette-preserving: the dominant colour of the footprint
        o[j] = bc >> 16; o[j + 1] = (bc >> 8) & 255; o[j + 2] = bc & 255; o[j + 3] = 255; op[y * dw + x] = 1; }
      vote.clear();
      if (di >= 0) { hasDark[y * dw + x] = 1; dark[j] = src[di]; dark[j + 1] = src[di + 1]; dark[j + 2] = src[di + 2]; dark[j + 3] = best; }
    }
    // outer outline only: a pixel on the silhouette edge (touching transparency) whose footprint held the source's outer
    // outline takes that outline colour - 1px, outside edge only. Interior body/face pixels are never darkened.
    for (let y = 0; y < dh; y++) for (let x = 0; x < dw; x++) { const k = y * dw + x; if (!op[k] || !hasDark[k]) continue;
      const edge = x === 0 || y === 0 || x === dw - 1 || y === dh - 1 || !op[k - 1] || !op[k + 1] || !op[k - dw] || !op[k + dw];
      if (edge) { o[k * 4] = dark[k * 4]; o[k * 4 + 1] = dark[k * 4 + 1]; o[k * 4 + 2] = dark[k * 4 + 2]; } }
    dx2.putImageData(out, 0, 0); m.set(key, dc); return dc;
  }
  { const raw = g.drawImage.bind(g);
    g.drawImage = function (img, ...a) {
      let sx = 0, sy = 0, sw, sh, dx, dy, dw, dh;
      if (a.length === 8) [sx, sy, sw, sh, dx, dy, dw, dh] = a; else if (a.length === 4) { [dx, dy, dw, dh] = a; sw = img.width; sh = img.height; } else return raw(img, ...a);
      const tw = Math.round(dw), th = Math.round(dh);
      if (img !== low && tw > 0 && th > 0 && (tw < sw || th < sh) && sw <= 256 && sh <= 256) {
        const mi = tw === 16 && th === 16 && sx === 0 && sy === 0 && sw === img.width && sh === img.height && MINI.get(img);
        if (mi) return raw(mi, Math.round(dx), Math.round(dy));   // hand-drawn 16px mini
        const d = downscaled(img, sx, sy, sw, sh, tw, th); if (d) return raw(d, Math.round(dx), Math.round(dy));
      }
      return raw(img, ...a);
    }; }
  const [txt, tctx] = mk(W, H, { willReadFrequently: true });
  let S = 6, textKey = '';
  // touch UI: ?touch=1 forces it on, ?touch=0 off; otherwise coarse pointer / touch points / narrow viewport
  const TOUCH = params.get('touch') === '1' || (params.get('touch') !== '0' &&
    (matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0 || Math.min(innerWidth, innerHeight) < 500));
  let layout = { mode: 'desktop' };
  function resize() {
    const vw = window.innerWidth, vh = window.innerHeight;
    const forced = parseInt(params.get('scale'), 10);
    const fit = Math.min(vw / W, vh / H);
    let scale, mode = 'desktop';
    if (!TOUCH) {
      scale = forced > 0 ? forced : (Math.floor(fit) >= 1 ? Math.floor(fit) : fit);
    } else if (vw >= vh) {
      scale = forced > 0 ? forced : (Math.floor(fit) >= 2 ? Math.floor(fit) : fit);
      mode = (vw - W * scale) / 2 >= 96 ? 'outside' : 'overlay';
    } else {
      mode = 'portrait';
      const pf = Math.min(vw / W, (vh * 0.5) / H);
      scale = forced > 0 ? forced : (Math.floor(pf) >= 2 ? Math.floor(pf) : (Math.floor(fit) >= 2 ? 2 : pf));
    }
    scale = Math.max(0.5, Math.min(scale, fit));
    const cw = Math.round(W * scale), ch = Math.round(H * scale);
    const left = Math.floor((vw - cw) / 2);
    const top = mode === 'portrait' ? Math.max(12, Math.floor(vh * 0.06)) : Math.floor((vh - ch) / 2);
    S = Math.max(1, Math.ceil(scale - 1e-6));   // internal backing scale (integer); CSS does any fractional part
    view.width = W * S; view.height = H * S;
    txt.width = W * S; txt.height = H * S;
    Object.assign(view.style, { width: cw + 'px', height: ch + 'px', left: left + 'px', top: top + 'px' });
    vctx.imageSmoothingEnabled = false; tctx.imageSmoothingEnabled = false;
    layout = { mode, scale, cw, ch, left, top, vw, vh };
    layoutControls();
    textKey = '';
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 200));
  if (window.visualViewport) visualViewport.addEventListener('resize', resize);

  // ---------- on-screen touch controls ----------
  const $ = id => document.getElementById(id);
  const $pad = $('pad'), $acts = $('acts'), $bL = $('bL'), $bR = $('bR'), $jump = $('jump'), $swap = $('swap'), $rot = $('rotate');
  function place(el, x, y, w, h) { Object.assign(el.style, { left: Math.round(x) + 'px', top: Math.round(y) + 'px', width: Math.round(w) + 'px', height: Math.round(h) + 'px' }); }
  function layoutControls() {
    const b = document.body.classList;
    b.toggle('touch', TOUCH);
    if (!TOUCH) return;
    const { mode, cw, ch, left, top, vw, vh } = layout;
    b.toggle('overlay', mode === 'overlay'); b.toggle('portrait', mode === 'portrait');
    const m = 8;
    if (mode === 'outside') {
      const g = left;                                   // gutter width on each side
      const bw = Math.max(40, Math.min(76, Math.floor((g - 3 * m) / 2)));
      const bh = Math.min(Math.round(ch * 0.42), 120);
      const y = top + ch - bh - 4;
      place($bL, (g - (2 * bw + m)) / 2, y, bw, bh);
      place($bR, (g - (2 * bw + m)) / 2 + bw + m, y, bw, bh);
      const dj = Math.min(g - 2 * m, 86), ds = Math.round(dj * 0.9);
      const rx = left + cw;
      place($jump, rx + (g - dj) / 2, top + ch - dj - 4, dj, dj);
      place($swap, rx + (g - ds) / 2, top + ch - dj - ds - 14, ds, ds);
    } else if (mode === 'overlay') {
      // sits over the bottom HUD corners (hearts / disabled command buttons) in the field; hidden in battle
      const hud = Math.round(ch * 18 / 90);
      const bs = Math.max(48, Math.min(70, hud + 6));
      const y = top + ch - bs - 4;
      place($bL, left + 6, y, bs, bs);
      place($bR, left + 6 + bs + m, y, bs, bs);
      const dj = bs + 6, ds = bs - 4;
      place($jump, left + cw - dj - 6, top + ch - dj - 3, dj, dj);
      place($swap, left + cw - dj - ds - 6 - m, top + ch - ds - 4, ds, ds);
    } else {
      // portrait: controls below the canvas
      const bs = Math.max(60, Math.min(90, Math.floor(vw * 0.2)));
      const y = vh - bs - 28;
      place($bL, 16, y, bs, bs);
      place($bR, 16 + bs + m + 4, y, bs, bs);
      const dj = bs + 8, ds = bs - 6;
      place($jump, vw - dj - 16, y - 4, dj, dj);
      place($swap, vw - dj - ds - 16 - m - 4, y + 4, ds, ds);
      $rot && ($rot.style.top = (top + ch + 18) + 'px');
    }
    fitLabels();
  }
  function fitLabels() {
    for (const el of [$jump, $swap]) { const d = parseInt(el.style.width, 10) || 0; el.style.fontSize = (d >= 74 ? 16 : 12) + 'px'; }
  }
  let ctlState = '';
  // which job the on-screen buttons do right now
  function ctlMode() {
    if (G.hk && G.hk.mode === 'nag') return 'title';   // login prompt: つぎ = next row, けってい = pick
    if (G.state === 'field' && G.near) return 'near';
    if (G.state === 'field' || G.state === 'map') return 'field';
    if (G.state === 'talk' || G.state === 'ending') return 'talk';
    if (G.state === 'title') return G.nameEdit ? 'off' : 'title';
    if (G.state === 'hub') return 'title';
    if (G.state === 'menu' || G.state === 'versus' || G.state === 'netroom') return 'back';
    if (G.state === 'battle' && G.battle) {
      const ph = G.battle.phase;
      if (ph === 'menu' || ph === 'swap') return 'back';
      return 'cmd';
    }
    return 'off';
  }
  // map an on-screen button to a key for menus and battle commands
  function ctlKey(btn) {
    const m = ctlMode(), menu = G.state === 'menu' || (G.battle && G.battle.phase === 'menu');
    if (btn === 'L') return menu ? 'ArrowUp' : 'ArrowLeft';
    if (btn === 'R') return menu ? 'ArrowDown' : 'ArrowRight';
    if (btn === 'A') return 'Enter';
    if (btn === 'B') return m === 'cmd' ? 'Tab' : 'Escape';
  }
  function syncControls() {
    if (!TOUCH) return;
    const st = ctlMode();
    const key = st + layout.mode + (st === 'near' ? G.near.type : '');
    if (key === ctlState) return;
    ctlState = key;
    $jump.textContent = st === 'field' ? 'ジャンプ' : st === 'near' ? (G.near.type === 'npc' ? 'はなす' : 'はいる') : 'けってい';
    $swap.textContent = st === 'field' || st === 'near' ? 'いれかえ' : st === 'talk' ? 'つぎ' : st === 'title' || st === 'cmd' ? 'つぎ' : st === 'back' ? 'もどる' : 'いれかえ';
    const hide = st === 'off' && layout.mode === 'overlay';
    for (const el of [$pad, $acts]) { el.classList.toggle('hide', hide); el.classList.toggle('off', st === 'off' && !hide); }
    if (st === 'off') { touchDir.clear(); for (const el of [$bL, $bR, $jump, $swap]) el.classList.remove('on'); }
  }
  const touchDir = new Map();   // pointerId -> -1 | 1  (multi-touch d-pad)
  function padDir() { let l = false, r = false; for (const d of touchDir.values()) d < 0 ? (l = true) : (r = true); return (r ? 1 : 0) - (l ? 1 : 0); }
  function padSync() { const d = [...touchDir.values()]; $bL.classList.toggle('on', d.includes(-1)); $bR.classList.toggle('on', d.includes(1)); }
  function dirAt(x, y) { const el = document.elementFromPoint(x, y); return el && el.closest('#bL') ? -1 : el && el.closest('#bR') ? 1 : 0; }
  for (const [el, dir] of [[$bL, -1], [$bR, 1]]) {
    el.addEventListener('pointerdown', e => { e.preventDefault(); touchDir.set(e.pointerId, dir); padSync(); const m = ctlMode(); if (m === 'title') onKey(dir < 0 ? 'ArrowLeft' : 'ArrowRight'); else if (m === 'cmd' || m === 'back') onKey(ctlKey(dir < 0 ? 'L' : 'R')); });
  }
  window.addEventListener('pointermove', e => {
    if (!touchDir.has(e.pointerId)) return;
    const d = dirAt(e.clientX, e.clientY);
    if (d) { touchDir.set(e.pointerId, d); padSync(); }   // slide between ← and →
  });
  const padEnd = e => { if (touchDir.delete(e.pointerId)) padSync(); };
  window.addEventListener('pointerup', padEnd);
  window.addEventListener('pointercancel', padEnd);
  for (const [el, code] of [[$jump, 'Space'], [$swap, 'KeyC']]) {
    el.addEventListener('pointerdown', e => { e.preventDefault(); el.classList.add('on'); const m = ctlMode(); if (G.hk && G.hk.mode === 'nag') onKey(el === $jump ? 'Enter' : 'ArrowDown'); else if (G.state === 'hub') onKey(el === $jump ? 'Enter' : 'ArrowRight');   // menu: けってい opens the picked item, つぎ steps to the next
      else if (m === 'title') { if (el === $swap) onKey('ArrowDown'); } else if (m === 'cmd' || m === 'back') onKey(ctlKey(el === $jump ? 'A' : 'B')); else if (m === 'talk') onKey('Enter'); else if (m === 'near' && el === $jump) onKey('Enter'); else onKey(code); });
    // title けってい fires on release: opening the name box needs a finished tap for the phone keyboard
    el.addEventListener('pointerup', () => { if (G.state === 'title' && el === $jump && el.classList.contains('on')) titleConfirm(); });
    const up = () => el.classList.remove('on');
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('pointerleave', up);
  }
  for (const ev of ['touchend', 'pointerup', 'click', 'keydown']) window.addEventListener(ev, () => { if (typeof SFX !== 'undefined') SFX.unlock(); }, { capture: true, passive: true });
  // no scrolling / zoom / long-press menu / text selection
  for (const ev of ['touchstart', 'touchmove', 'touchend']) document.addEventListener(ev, e => { if (e.target && e.target.closest && e.target.closest('#nameBox')) return; if (e.cancelable) e.preventDefault(); }, { passive: false });
  for (const ev of ['contextmenu', 'gesturestart', 'gesturechange', 'dblclick', 'selectstart']) document.addEventListener(ev, e => e.preventDefault());

  // ---------- utils ----------
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  let netRng = null;
  function rand() { return netRng ? netRng() : Math.random(); }
  let DT = 1 / 60;
  function* wait(sec) { let t = 0; while (t < sec) { t += DT; yield; } }
  function* tween(set, from, to, dur, ease = e => 1 - (1 - e) * (1 - e)) {
    let t = 0;
    while (t < dur) { t += DT; set(from + (to - from) * ease(Math.min(1, t / dur))); yield; }
    set(to);
  }
  function rect(x, y, w, h, c) { g.fillStyle = c; g.fillRect(x, y, w, h); }
  function drawPattern(rows, x, y, pal) {
    for (let j = 0; j < rows.length; j++) for (let i = 0; i < rows[j].length; i++) {
      const c = pal[rows[j][i]]; if (c) rect(x + i, y + j, 1, 1, c);
    }
  }

  // ---------- 3x5 bitmap font (logical-resolution numbers / READY / WIN) ----------
  const F3 = {
    '0': '111101101101111', '1': '010110010010111', '2': '111001111100111', '3': '111001111001111',
    '4': '101101111001001', '5': '111100111001111', '6': '111100111101111', '7': '111001010010010',
    '8': '111101111101111', '9': '111101111001111', 'A': '010101111101101', 'B': '110101110101110',
    'C': '011100100100011', 'D': '110101101101110', 'E': '111100110100111', 'F': '111100110100100',
    'G': '011100101101011', 'H': '101101111101101', 'I': '111010010010111', 'J': '001001001101010',
    'K': '101101110101101', 'L': '100100100100111', 'M': '101111101101101', 'N': '110101101101101',
    'O': '010101101101010', 'P': '110101110100100', 'Q': '010101101110011', 'R': '110101110101101',
    'S': '011100010001110', 'T': '111010010010010', 'U': '101101101101111', 'V': '101101101101010',
    'W': '101101111111101', 'X': '101101010101101', 'Y': '101101010010010', 'Z': '111001010100111',
    '!': '010010010000010', '?': '110001010000010', '+': '000010111010000', '-': '000000111000000',
    '/': '001001010100100', ':': '000010000010000', '%': '101001010100101', '.': '000000000000010', ' ': '000000000000000',
  };
  function tinyW(s) { return s.length * 4 - 1; }
  function tiny(s, x, y, col, outline) {
    s = String(s).toUpperCase();
    const draw = (ox, oy, c) => {
      g.fillStyle = c;
      for (let k = 0; k < s.length; k++) {
        const p = F3[s[k]] || F3['?'];
        for (let i = 0; i < 15; i++) if (p[i] === '1') g.fillRect(x + ox + k * 4 + (i % 3), y + oy + Math.floor(i / 3), 1, 1);
      }
    };
    if (outline) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) draw(dx, dy, outline);
    draw(0, 0, col);
  }

  // ---------- hi-res crisp text layer (Misaki 8px bitmap font, snapped to its pixel grid) ----------
  const textOps = [];
  const fontPx = size => 8 * Math.max(1, Math.round(size * S / 8));
  function T(s, x, y, o = {}) { textOps.push([String(s), x, y, o.size || 4, o.c || '#4a2c12', o.ol || null, o.al || 'left', o.ol2 || null]); }
  // greedy word wrap by measured width (breaks at spaces, or inside a word that is too long by itself)
  function wrapW(s, maxW, size = 4) {
    const out = []; let cur = '';
    for (const word of String(s).split(' ')) {
      const tryS = cur ? cur + ' ' + word : word;
      if (measure(tryS, size) <= maxW) { cur = tryS; continue; }
      if (cur) out.push(cur);
      cur = '';
      for (const ch of word) { if (cur && measure(cur + ch, size) > maxW) { out.push(cur); cur = ch; } else cur += ch; }
    }
    if (cur || !out.length) out.push(cur);
    return out;
  }
  function fitW(s, maxW, size = 4) {   // one line, cut with … if it doesn't fit
    s = String(s); if (measure(s, size) <= maxW) return s;
    while (s.length && measure(s + '…', size) > maxW) s = s.slice(0, -1);
    return s + '…';
  }
  function measure(s, size = 4) { tctx.font = fontPx(size) + "px Misaki, 'DotGothic16'"; return tctx.measureText(s).width / S; }
  function flushText() {
    const key = S + '|' + JSON.stringify(textOps);
    if (key !== textKey) {
      textKey = key;
      tctx.clearRect(0, 0, txt.width, txt.height);
      tctx.textBaseline = 'top'; tctx.textAlign = 'left';
      for (const [s, x, y, size, c, ol, al, ol2] of textOps) {
        const fp = fontPx(size), u = fp / 8;
        tctx.font = fp + "px Misaki, 'DotGothic16'";
        const w = tctx.measureText(s).width;
        let X = x * S - (al === 'center' ? w / 2 : al === 'right' ? w : 0);
        X = Math.round(X / u) * u; const Y = Math.round(y * S / u) * u;
        const ring = (r, col) => {
          tctx.fillStyle = col;
          for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (dx || dy) tctx.fillText(s, X + dx * u, Y + dy * u);
        };
        if (ol2) ring(2, ol2);
        if (ol) ring(1, ol);
        tctx.fillStyle = c; tctx.fillText(s, X, Y);
      }
      const id = tctx.getImageData(0, 0, txt.width, txt.height), d = id.data;
      for (let i = 3; i < d.length; i += 4) d[i] = d[i] >= 100 ? 255 : 0;
      tctx.putImageData(id, 0, 0);
    }
    vctx.drawImage(txt, 0, 0);
    textOps.length = 0;
  }

  // ---------- sprites ----------
  const SPR = {};
  // art that isn't drawn yet (world 4, うさひめ, endings): only loaded once embedded in assets-img.js, so no 404s
  const artReady = src => (typeof ASSET_DATA !== 'undefined' && ASSET_DATA[src]) || !/(\/w4\/|worldmap4|usahime|\/ending\/|\/opening\/|\/story\/|\/zukan\/|\/janken\/)/.test(src);
  function loadImg(src) {
    return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('failed to load ' + src)); i.src = (typeof ASSET_DATA !== 'undefined' && ASSET_DATA[src]) ? ASSET_DATA[src] : src; });
  }
  // versus arena backgrounds (160x90, static): day / night picked per match
  const ARENA = {}, EVBG = {};   // EVBG: painted event-stage panoramas (stage.bgImg), only when embedded
  const JKART = {};   // じゃんけん hand icons (8x8); the in-code pixel icons are used until these are embedded
  for (const k of ['gu', 'choki', 'pa']) if (artReady('assets/janken/' + k + '.png')) loadImg('assets/janken/' + k + '.png').then(i => { JKART[k] = i; }).catch(() => {});
  const ZART = {};   // ずかん art: habitat panels (48x48) + page frame (160x78), only when embedded
  for (const k of ['habitat_town', 'habitat_forest', 'habitat_castle', 'habitat_halloween', 'zukan_frame']) if (artReady('assets/zukan/' + k + '.png')) loadImg('assets/zukan/' + k + '.png').then(i => { ZART[k] = i; }).catch(() => {});
  for (const k of ['day', 'night']) loadImg('assets/bg/arena_' + k + '.png').then(i => { ARENA[k] = i; }).catch(() => {});
  function silhouette(src) {
    const [c, x] = mk(32, 32); x.drawImage(src, 0, 0);
    x.globalCompositeOperation = 'source-in'; x.fillStyle = '#ffffff'; x.fillRect(0, 0, 32, 32); return c;
  }
  function prepSprite(key, img) {
    const [n, nx] = mk(32, 32); nx.drawImage(img, 0, 0);
    const [f, fx] = mk(32, 32); fx.translate(32, 0); fx.scale(-1, 1); fx.drawImage(img, 0, 0);
    const d = nx.getImageData(0, 0, 32, 32).data;
    let top = 31, minX = 31, maxX = 0;
    for (let y = 0; y < 32; y++) for (let X = 0; X < 32; X++) if (d[(y * 32 + X) * 4 + 3] > 0) { top = Math.min(top, y); minX = Math.min(minX, X); maxX = Math.max(maxX, X); }
    SPR[key] = { n, f, wn: silhouette(n), wf: silhouette(f), native: SPRITES[key].native, top, w: maxX - minX + 1 };
  }
  // ★ placeholder plush (until assets/<id>.png arrives): simple coloured shape + eyes, 32x32, facing right, 1px dark outline
  function makePh(ph) {
    const [c, x] = mk(32, 32), R = (X, Y, w, h, col) => { x.fillStyle = col; x.fillRect(X, Y, w, h); };
    const blob = (cx, cy, rx, ry, col) => { for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let X = Math.floor(cx - rx); X <= cx + rx; X++) if (((X + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1) R(X, y, 1, 1, col); };
    const eye = (X, Y) => { R(X, Y, 2, 3, '#2a1a2a'); R(X, Y, 1, 1, '#ffffff'); };
    if (ph.shape === 'pumpkin') {
      R(9, 22, 14, 8, ph.acc); R(8, 24, 16, 6, ph.acc); R(10, 22, 12, 1, '#a060e8');   // purple cape
      blob(16, 17, 10, 8, ph.body); for (const lx of [11, 16, 21]) R(lx, 11, 1, 12, '#e06a10');
      R(15, 7, 3, 3, '#3a8a2a'); R(17, 6, 2, 1, '#3a8a2a');
      R(12, 15, 3, 3, '#3a1a08'); R(19, 15, 3, 3, '#3a1a08'); R(13, 15, 1, 1, '#ffe070'); R(20, 15, 1, 1, '#ffe070');
      R(13, 20, 8, 1, '#3a1a08'); R(14, 21, 2, 1, '#3a1a08'); R(18, 21, 2, 1, '#3a1a08');
      R(11, 30, 4, 2, '#5a2a8a'); R(18, 30, 4, 2, '#5a2a8a');
    } else if (ph.shape === 'ghost') {
      blob(16, 14, 9, 9, ph.body); R(7, 14, 19, 14, ph.body);
      for (let X = 7; X < 26; X += 4) R(X, 28, 2, 2, ph.body);
      eye(13, 12); eye(19, 12); R(15, 17, 3, 2, '#2a1a2a');
      R(11, 21, 4, 3, ph.acc); R(18, 21, 4, 3, ph.acc); R(15, 22, 3, 2, '#c85a10');   // orange bow tie
      R(9, 16, 2, 1, '#ffb0c8'); R(23, 16, 2, 1, '#ffb0c8');
    } else {   // mummy
      blob(16, 12, 8, 8, ph.body); R(9, 14, 15, 16, ph.body);
      for (let y = 6; y < 30; y += 3) R(8, y, 17, 1, ph.acc);
      R(17, 10, 5, 4, '#3a2a20'); eye(19, 10);                      // one eye peeking out of the wraps
      R(5, 16, 4, 3, ph.body); R(24, 16, 4, 3, ph.body); R(10, 30, 4, 2, ph.acc); R(19, 30, 4, 2, ph.acc);
    }
    // outline
    const d = x.getImageData(0, 0, 32, 32).data, A = (X, Y) => X >= 0 && Y >= 0 && X < 32 && Y < 32 && d[(Y * 32 + X) * 4 + 3] > 0;
    x.fillStyle = '#2a1a2a';
    for (let Y = 0; Y < 32; Y++) for (let X = 0; X < 32; X++) if (!A(X, Y) && (A(X + 1, Y) || A(X - 1, Y) || A(X, Y + 1) || A(X, Y - 1))) x.fillRect(X, Y, 1, 1);
    return c;
  }
  // walk cycle: horizontal sheet of 32x32 frames (right-facing), mirrored for left
  function prepWalk(key, img, def) {
    const frames = [];
    for (let i = 0; i < def.frames; i++) {
      const [n, nx] = mk(32, 32); nx.drawImage(img, i * 32, 0, 32, 32, 0, 0, 32, 32);
      const [f, fx] = mk(32, 32); fx.translate(32, 0); fx.scale(-1, 1); fx.drawImage(n, 0, 0);
      frames.push({ n, f, wn: silhouette(n), wf: silhouette(f) });
    }
    SPR[key].walk = { frames, ms: def.ms };
  }
  function sheetFrames(img, count, S = 32) {
    const frames = [];
    for (let i = 0; i < count; i++) {
      const [n, nx] = mk(S, S); nx.drawImage(img, i * S, 0, S, S, 0, 0, S, S);
      const [f, fx] = mk(S, S); fx.translate(S, 0); fx.scale(-1, 1); fx.drawImage(n, 0, 0);
      frames.push({ n, f, wn: silhouette(n), wf: silhouette(f) });
    }
    return frames;
  }
  // placeholder crown: a small gold crown drawn on top of the head (frame by frame) for <key>_crown when no real art is registered
  const CROWN_PX = ['.#.#.#.', '.#####.', '#y#y#y#', '#######'];
  function crownFrame(src) {
    const [n, nx] = mk(32, 32); nx.drawImage(src, 0, 0);
    const d = nx.getImageData(0, 0, 32, 32).data; let top = -1, sx = 0, c = 0;
    for (let y = 0; y < 32 && top < 0; y++) for (let x = 0; x < 32; x++) if (d[(y * 32 + x) * 4 + 3] > 0) top = y;
    if (top < 0) top = 8;
    for (let y = top; y < top + 3; y++) for (let x = 0; x < 32; x++) if (d[(y * 32 + x) * 4 + 3] > 0) { sx += x; c++; }
    const cx = Math.round(c ? sx / c : 16) - 3, cy = Math.max(0, top - 3);
    CROWN_PX.forEach((row, j) => [...row].forEach((ch, i) => { if (ch === '.') return; nx.fillStyle = ch === 'y' ? '#e8402a' : (j === 0 ? '#fff28a' : '#ffc820'); nx.fillRect(cx + i, cy + j, 1, 1); }));
    nx.fillStyle = '#7a5200'; nx.fillRect(cx, cy + 4, 7, 1);
    const [f, fx] = mk(32, 32); fx.translate(32, 0); fx.scale(-1, 1); fx.drawImage(n, 0, 0);
    return { n, f, wn: silhouette(n), wf: silhouette(f) };
  }
  function makeCrownSprites() {
    for (const k of ['oguri', 'oguri_evo']) {
      if (!SPR[k] || SPR[k + '_crown'] || (typeof SPRITES !== 'undefined' && SPRITES[k + '_crown'])) continue;
      const S = SPR[k], fr = crownFrame(S.n);
      SPR[k + '_crown'] = Object.assign({}, S, fr, { top: Math.max(0, (S.top | 0) - 3) });
      if (S.walk) SPR[k + '_crown'].walk = { ms: S.walk.ms, frames: S.walk.frames.map(w => crownFrame(w.n)) };
      if (S.attack) SPR[k + '_crown'].attack = S.attack.map(w => crownFrame(w.n));
    }
  }
  const FXIMG = {};   // sp -> { shot: frames, hit: frames } (pixel-art special fx)

  // ---------- game state ----------
  const G = { fx: [],
    state: 'loading', t: 0, cam: 0, camT: 0, shakeT: 0,
    party: [], active: 0, wilds: [], particles: [], pops: [],
    banner: null, fade: 0, fadeSpeed: 0, battle: null, waitMode: true,
    hoverBtn: -1, bg: null, signNear: false, forceRecruit: null,
    stage: 0, unlocked: 1, cleared: [], mapSel: 0, mapPos: null, benchUsed: false, benchNear: false, bgCache: {},
    hasSave: false, muted: false, versus: false, vs: null, saveFlash: 0, 
    coins: 50, items: {}, beaten: [], fought: [], box: [], world: 0, unl: [1, 0], flags: {}, cookie: false, npcs: [], near: null, talk: null, menu: null,
  };
  const SAVE_KEY = 'nm_save_v1', HERO_KEY = 'nm_hero';
  // ---- hero (gender + color) ----
  const hex2rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  function rgb2hsl(r, g, b) {
    r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
    if (mx === mn) return [0, 0, l];
    const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [h / 6, s, l];
  }
  function hsl2rgb(h, s, l) {
    if (!s) return [l * 255, l * 255, l * 255];
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    const f = t => { t = (t + 1) % 1; return 255 * (t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p); };
    return [f(h + 1 / 3), f(h), f(h - 1 / 3)];
  }
  function recolor(src, gd, target) {
    const [c, x] = mk(src.width, src.height); x.drawImage(src, 0, 0);
    if (target.toLowerCase() === gd.base) return c;
    const ramp = new Set(gd.ramp.map(h => hex2rgb(h).join(','))), bl = rgb2hsl(...hex2rgb(gd.base))[2];
    const [th, ts, tl] = rgb2hsl(...hex2rgb(target));
    const id = x.getImageData(0, 0, c.width, c.height), d = id.data;
    for (let i = 0; i < d.length; i += 4) {
      if (!d[i + 3] || !ramp.has(d[i] + ',' + d[i + 1] + ',' + d[i + 2])) continue;
      const l = Math.max(0.06, Math.min(0.94, rgb2hsl(d[i], d[i + 1], d[i + 2])[2] + tl - bl));
      const o = hsl2rgb(th, ts, l); d[i] = o[0]; d[i + 1] = o[1]; d[i + 2] = o[2];
    }
    x.putImageData(id, 0, 0); return c;
  }
  function buildHero(gi, ci, key) {
    const own = !key; key = key || 'hero'; gi = own ? G.gender | 0 : gi | 0; ci = own ? G.hcolor | 0 : ci | 0;
    const gd = HERO_GENDERS[gi] || HERO_GENDERS[0], src = SPR[gd.key] || SPR.player;
    const col = (HERO_COLORS[ci] || HERO_COLORS[0]).c;
    SPR[key] = Object.assign({}, src, { n: recolor(src.n, gd, col), f: recolor(src.f, gd, col) });
    if (src.walk) SPR[key].walk = { ms: src.walk.ms, frames: src.walk.frames.map(fr => Object.assign({}, fr, { n: recolor(fr.n, gd, col), f: recolor(fr.f, gd, col) })) };
    if (own) player.key = 'hero';
  }
  function saveHero() { try { localStorage.setItem(HERO_KEY, JSON.stringify({ g: G.gender | 0, c: G.hcolor | 0, n: G.pname || '', r: G.rname || '' })); } catch (e) {} }
  const pName = () => G.pname || 'きみ';
  const rName = () => G.rname || ((G.gender | 0) === 1 ? 'ハルト' : 'ユイ');
  // name entry (DOM input so phone keyboards work)
  const nameBox = document.getElementById('nameBox'), nameIn = document.getElementById('nameIn');
  function openName(which) {
    G.nameEdit = which;
    document.getElementById('nameLab').textContent = (which === 'r' ? 'ライバルの なまえ' : 'あなたの なまえ') + '（6もじまで）';
    nameIn.value = which === 'r' ? (G.rname || '') : (G.pname || '');
    nameIn.placeholder = which === 'r' ? rName() : 'なまえ';
    G.nameOpenT = performance.now(); nameBox.classList.add('on'); nameIn.focus();
  }
  function closeName(ok) {
    if (!G.nameEdit) return;
    if (ok) { const v = nameIn.value.replace(/\s+/g, '').slice(0, 6); if (G.nameEdit === 'r') G.rname = v; else G.pname = v; saveHero(); SFX.blip(); }
    G.nameEdit = null; nameBox.classList.remove('on'); nameIn.blur(); view.focus();
  }
  nameBox.querySelector('form').addEventListener('submit', e => { e.preventDefault(); if (performance.now() - (G.nameOpenT || 0) > 250) closeName(true); });
  document.getElementById('nameNo').addEventListener('click', () => closeName(false));
  nameIn.addEventListener('keydown', e => { if (e.key === 'Escape') closeName(false); });
  // title = logo screen (G.titleScreen 0) -> setup screen (1): start / gender / color / name / rival / erase
  const SETUP_ROWS = 8, SETUP = { x: 70, y: 6, w: 86, rowY: 10, rowH: 9 };
  const ROW = { start: 0, vs: 1, gender: 2, color: 3, name: 4, rival: 5, hk: 6, erase: 7 };
  function openSetup() { G.titleScreen = 1; G.titleRow = 0; G.wipeAsk = 0; SFX.blip(); }
  function titleConfirm() {
    if (G.hk) { if (G.state === 'title') hkKey('Enter'); return; }
    if (G.state !== 'title' || G.nameEdit || opBlock()) return;
    if (!G.titleScreen) openSetup(); else titleRowAction(G.titleRow | 0);
  }
  function titleRowAction(row) {
    if (row === ROW.start) { startGame(G.hasSave); if (G.state !== 'title') openHub(); return; }
    if (row === ROW.vs) { startVersus(); return; }
    if (row === ROW.gender) { setHero(1, 0); return; }
    if (row === ROW.color) { setHero(0, 1); return; }
    if (row === ROW.name || row === ROW.rival) { openName(row === ROW.rival ? 'r' : 'p'); return; }
    if (row === ROW.hk) { openHk(); return; }
    if (row !== ROW.erase || G.wiped) return;
    if (G.wipeAsk && G.t - G.wipeAsk < 4) {   // second press within 4s: erase everything and restart fresh
      wipeSave(); try { localStorage.removeItem(HERO_KEY); } catch (e) {}
      G.wipeAsk = 0; G.wiped = true;
      setTimeout(() => location.reload(), 900);
      return;
    }
    G.wipeAsk = G.t; SFX.blip();
  }
  function setupRowAt(x, y) {
    if (x < SETUP.x || x >= SETUP.x + SETUP.w) return -1;
    const r = Math.floor((y - SETUP.rowY) / SETUP.rowH); return r >= 0 && r < SETUP_ROWS ? r : -1;
  }
  function setHero(dg, dc) {
    if (dg) { G.gender = ((G.gender | 0) + dg + HERO_GENDERS.length) % HERO_GENDERS.length; G.hcolor = HERO_GENDERS[G.gender].def; }
    if (dc) G.hcolor = ((G.hcolor | 0) + dc + HERO_COLORS.length) % HERO_COLORS.length;
    buildHero();
    try { saveHero(); } catch (e) {}
    SFX.blip();
  }
  const serMember = m => Object.assign({ sp: m.sp, hp: Math.round(m.hp), maxHp: m.maxHp, atk: m.atk, def: m.def, spd: m.spd, lv: capLv(m.lv), xp: m.xp || 0, evo: m.evo ? 1 : 0, name: m.name }, m.crown ? { crown: 1 } : {});
  function persist() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(saveObj()));
      G.hasSave = true;
      G.saveFlash = 1.2;
      cloudSave();
    } catch (e) { /* ignore quota / private mode */ }
  }
  function curUnl() { const u = (G.unl || [1]).slice(); u[G.world | 0] = G.unlocked; while (u.length < MAP_WORLDS.length) u.push(0); return u; }
  function saveObj() {
    return {
        v: 3,
        party: (G.solo ? G.solo.party : G.party).map(serMember),
        box: (G.box || []).map(serMember),
        muted: !!G.muted,
        active: G.solo ? G.solo.active : G.active,
        unlocks: curUnl(),
        unlocked: curUnl()[0], unlocked2: curUnl()[1] | 0,   // old keys kept so older builds can still read the save
        cleared: G.cleared,
        stage: G.stage,
        px: Math.round(player.x),
        coins: G.coins | 0, items: G.items, beaten: G.beaten, flags: G.flags, cookie: !!G.cookie, got: G.got || {},
        hero: { g: G.gender | 0, c: G.hcolor | 0, n: G.pname || '', r: G.rname || '' },
        savedAt: Date.now(),
    };
  }
  // player records -> Supabase (players table via save_player RPC; the public key can only write, not read)
  const CLOUD = { url: 'https://acwibplypgkutrfeuejq.supabase.co', key: 'sb_publishable_H9BXr00nglxIaHOvTeVPlw_mJ8C5vhP', t: null, last: 0 };
  // test browsers (Playwright/webdriver, ?test, localStorage nm_test=1) never write to the real players / saves tables
  const CLOUD_OFF = (() => { try { return !!navigator.webdriver || /[?&]test\b/.test(location.search) || localStorage.getItem('nm_test') === '1'; } catch (e) { return true; } })();
  function cloudId() {
    try {
      let id = localStorage.getItem('nm_pid');
      if (!id) { id = (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => (Math.random() * 16 | 0).toString(16))); localStorage.setItem('nm_pid', id); }
      return id;
    } catch (e) { return null; }
  }
  function cloudSecret() {
    try {
      let s = localStorage.getItem('nm_sec');
      if (!s || !/^[0-9a-f]{32}$/.test(s)) { const b = new Uint8Array(16); crypto.getRandomValues(b); s = [...b].map(v => v.toString(16).padStart(2, '0')).join(''); localStorage.setItem('nm_sec', s); }
      return s;
    } catch (e) { return null; }
  }
  function rpc(name, args) {
    return fetch(CLOUD.url + '/rest/v1/rpc/' + name, { method: 'POST', keepalive: true,
      headers: { apikey: CLOUD.key, 'Content-Type': 'application/json' }, body: JSON.stringify(args) })
      .then(r => { if (!r.ok) throw new Error('http ' + r.status); return r.json(); });
  }
  // full save -> saves table (cloud_put creates the row on first call; later only with the matching secret)
  function cloudPut() {
    if (CLOUD_OFF) return Promise.resolve(false);
    const id = cloudId(), sec = cloudSecret(), d = readSave();
    if (!id || !sec || !d) return Promise.resolve(false);
    return rpc('cloud_put', { p_id: id, p_secret: sec, p_data: d });
  }
  function cloudSave(now) {
    if (typeof fetch === 'undefined' || CLOUD_OFF) return;
    clearTimeout(CLOUD.t);
    const wait = now ? 0 : Math.max(0, 15000 - (Date.now() - CLOUD.last));
    CLOUD.t = setTimeout(() => {
      const id = cloudId(); if (!id) return;
      CLOUD.last = Date.now();
      const F = G.flags || {};
      const p = { id, name: G.pname || '', party: G.party.map(m => ({ sp: m.sp, name: m.name, lv: m.lv | 0, evo: m.evo ? 1 : 0 })),
        cleared: (G.cleared || []).map(i => STAGES[i] ? STAGES[i].name : i), vs_win: F.vsW | 0, vs_lose: F.vsL | 0, coins: G.coins | 0, recruited: F.rec != null ? F.rec | 0 : Math.max(0, G.party.length + (G.box || []).length - 1) };
      fetch(CLOUD.url + '/rest/v1/rpc/save_player', { method: 'POST', keepalive: true,
        headers: { apikey: CLOUD.key, 'Content-Type': 'application/json' }, body: JSON.stringify({ p }) }).catch(() => {});
      cloudPut().catch(() => {});
    }, wait);
  }

  // ---- Google アカウント連携 (supabase-js; optional: game runs without it) ----
  const AUTH = { sb: null, user: null, done: null };
  try {
    if (window.supabase && window.supabase.createClient)
      AUTH.sb = window.supabase.createClient(CLOUD.url, CLOUD.key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' } });
  } catch (e) { AUTH.sb = null; }
  // account messages often arrive on the title screen (no banner there): hold them until the field / map shows
  function abanner(t, d) { if (G.state === 'field' || G.state === 'map') banner(t, d); else G.pendBan = [t, d]; }
  function acctCheck(user) {
    if (!AUTH.sb || !user || AUTH.done === user.id) return;
    AUTH.done = user.id; AUTH.user = user;
    AUTH.sb.rpc('account_get').then(({ data: r, error }) => {
      if (error) throw error;
      if (!r || !r.id) {
        return AUTH.sb.rpc('account_link', { p_id: cloudId(), p_secret: cloudSecret() }).then(({ data: ok, error: e2 }) => {
          if (e2) throw e2;
          abanner(ok ? 'アカウントと れんけい した！' : 'れんけい できなかった', 2.2);
        });
      }
      if (r.id === cloudId()) { abanner('ログイン した', 1.6); return; }
      if (!r.secret || !r.data) { abanner('ログイン した', 1.6); return; }
      if (!G.hk) openHk();
      G.hk = Object.assign(G.hk, { mode: 'acct', sel: 1, got: r });
    }).catch(() => abanner('アカウントの つうしんに しっぱい', 2.2));
  }
  if (AUTH.sb) {
    try {
      AUTH.sb.auth.onAuthStateChange((ev, ses) => {
        const u = ses && ses.user;
        if (ev === 'SIGNED_OUT' || !u) { AUTH.user = null; AUTH.done = null; return; }
        AUTH.user = u;
        if (ev === 'SIGNED_IN' || ev === 'INITIAL_SESSION') setTimeout(() => acctCheck(u), 0);
      });
      AUTH.sb.auth.getSession().then(({ data }) => { AUTH.ready = true; const u = data && data.session && data.session.user; if (u) acctCheck(u); }).catch(() => {});
    } catch (e) {}
  }
  function hkLogin() {
    if (!AUTH.sb) { hkMsg(['ログインの よみこみに', 'しっぱい したよ']); return; }
    const h = G.hk; h.mode = 'busy'; h.lines = ['じゅんびちゅう…'];
    if (!readSave()) persist();
    clearTimeout(CLOUD.t); CLOUD.last = Date.now();
    const go = () => AUTH.sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } })
      .then(({ error }) => { if (error) throw error; }).catch(() => { if (G.hk) hkMsg(['ログイン できなかった']); });
    cloudPut().then(ok => { if (!ok) throw new Error('put'); return go(); })
      .catch(e => { if (G.hk) hkMsg(e && e.message === 'put' ? ['クラウドに おけなかった', 'もういちど ためしてね'] : [hkErr(e)]); });
  }
  // soft Google-login prompt: after the first boss stage is cleared or a plush hits Lv10; shown at most 3 times, 3+ days apart
  const NAG_GAP = 3 * 864e5, NAG_MAX = 3;
  let nagHold = 0;
  function nagArmed() {
    const fb = STAGES.findIndex(st => (st.spawns || []).some(w => SPECIES[w.sp] && SPECIES[w.sp].boss));
    return (fb >= 0 && (G.cleared || []).includes(fb)) || G.party.some(m => (m.lv | 0) >= 10);
  }
  function nagTick(dt) {
    const calm = !G.hk && !G.jkTut && !G.op && !G.tapGate && !G.ending && !G.cs && !G.battle && !G.versus && !(G.fade > 0)
      && (G.state === 'field' || G.state === 'map' || (G.state === 'hub' && G.hub && G.hub.view === 'home' && !G.hub.lb));
    if (!calm) { nagHold = 0; return; }
    if ((nagHold += dt) < 1.2) return;
    nagHold = 0;   // cheap check, ~once a second
    if (!AUTH.sb || !AUTH.ready || AUTH.user || navigator.onLine === false || !nagArmed()) return;
    const N = G.flags.glNag || { n: 0, t: 0 };
    if (N.n >= NAG_MAX || (N.n > 0 && Date.now() - N.t < NAG_GAP)) return;
    G.flags.glNag = { n: N.n + 1, t: Date.now() }; persist();
    openHk(); G.hk.mode = 'nag'; G.hk.sel = 0;
  }
  function hkLogout() {
    const h = G.hk; h.mode = 'busy'; h.lines = ['ログアウトちゅう…'];
    AUTH.sb.auth.signOut().catch(() => {}).then(() => { AUTH.user = null; AUTH.done = null; if (G.hk) hkMsg(['ログアウト したよ', 'データは この きかいに', 'のこってるよ']); });
  }

  // ---- ひきつぎ (transfer code): overlay usable from the title setup and the field bag ----
  const HK = { x: 18, y: 8, w: 124, h: 70, row0: 53, rh: 8 };
  function openHk() {
    G.hk = { mode: 'menu', sel: 0, from: G.state };
    if (G.state === 'field') { G.state = 'menu'; G.menu = null; player.moving = false; }
    SFX.blip();
  }
  function closeHk() {
    const h = G.hk; G.hk = null;
    if (h && h.from === 'field' && G.state === 'menu') G.state = 'field';
    SFX.blip();
  }
  function hkRows() {
    const h = G.hk;
    if (h.mode === 'menu') return ['issue', 'enter', AUTH.user ? 'logout' : 'login', 'close'];
    if (h.mode === 'acct') return ['ause', 'akeep'];
    if (h.mode === 'nag') return ['nlogin', 'later'];
    if (h.mode === 'ask') return ['yes', 'no'];
    if (h.mode === 'busy') return [];
    return ['close'];
  }
  const HK_LAB = { issue: 'コードを はっこう', enter: 'コードを いれる', close: 'とじる', yes: 'はい うわがき する', no: 'やめる',
    login: 'Googleで ログイン', logout: 'ログアウト', ause: 'アカウントの データで あそぶ', akeep: 'いまの データを つかう', later: 'あとで', nlogin: 'ログイン' };
  const hkErr = e => (e && /http/.test(e.message || '')) ? 'サーバーで エラーが でた' : 'つうしん できない…';
  function hkMsg(lines) { G.hk = Object.assign(G.hk || {}, { mode: 'msg', sel: 0, lines }); }
  function hkIssue() {
    const h = G.hk; h.mode = 'busy'; h.lines = ['つうしんちゅう…'];
    if (!readSave()) persist();
    if (!readSave()) { hkMsg(['セーブデータが ないよ']); return; }
    clearTimeout(CLOUD.t); CLOUD.last = Date.now();
    cloudPut().then(ok => {
      if (!ok) throw new Error('put');
      return rpc('issue_code', { p_id: cloudId(), p_secret: cloudSecret() });
    }).then(c => {
      if (!G.hk) return;
      if (!c || typeof c !== 'string') { hkMsg(['コードが つくれなかった', 'もういちど ためしてね']); return; }
      G.hk = Object.assign(G.hk, { mode: 'code', sel: 0, code: c.slice(0, 5) + '-' + c.slice(5) });
      SFX.level();
    }).catch(e => { if (G.hk) hkMsg(e && e.message === 'put' ? ['この きかいの データが', 'クラウドに おけなかった'] : [hkErr(e)]); });
  }
  function hkEnter() {
    const raw = window.prompt('ひきつぎコード（10もじ）') || '';
    const code = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!code) return;
    if (code.length !== 10) { hkMsg(['コードは 10もじ だよ']); return; }
    const h = G.hk; h.mode = 'busy'; h.lines = ['つうしんちゅう…'];
    rpc('redeem_code', { p_code: code }).then(r => {
      if (!G.hk) return;
      if (!r || !r.id || !r.secret || !r.data) { SFX.miss(); hkMsg(['コードが ちがうか', 'きげんが きれてるよ']); return; }
      G.hk = Object.assign(G.hk, { mode: 'ask', sel: 1, got: r });
    }).catch(e => { if (G.hk) hkMsg([hkErr(e)]); });
  }
  function hkApply(msg) {
    const r = G.hk.got;
    try {
      localStorage.setItem('nm_pid', r.id); localStorage.setItem('nm_sec', r.secret);
      localStorage.setItem(SAVE_KEY, JSON.stringify(r.data));
      const hr = r.data.hero; if (hr) localStorage.setItem(HERO_KEY, JSON.stringify(hr));
    } catch (e) { hkMsg(['ほぞん できなかった']); return; }
    clearTimeout(CLOUD.t);
    G.hk = { mode: 'busy', sel: 0, lines: [msg || 'ひきつぎ できた！'] };
    SFX.level();
    setTimeout(() => location.reload(), 900);
  }
  function hkPick() {
    const h = G.hk, k = hkRows()[h.sel];
    if (!k) return;
    if (k === 'close' || k === 'later') { closeHk(); return; }
    if (k === 'issue') { SFX.blip(); hkIssue(); return; }
    if (k === 'enter') { SFX.blip(); hkEnter(); return; }
    if (k === 'yes') { hkApply(); return; }
    if (k === 'login' || k === 'nlogin') { SFX.blip(); hkLogin(); return; }
    if (k === 'logout') { SFX.blip(); hkLogout(); return; }
    if (k === 'ause') { hkApply('よみこみちゅう…'); return; }
    if (k === 'akeep') { SFX.blip(); hkMsg(['いまの データで あそぶよ', 'アカウントの データは', 'そのまま のこるよ']); return; }
    if (k === 'no') { h.mode = 'menu'; h.sel = 1; h.got = null; SFX.blip(); }
  }
  function hkKey(code) {
    const h = G.hk, rows = hkRows();
    if (h.mode === 'busy') return;
    if (['ArrowUp', 'KeyW', 'ArrowLeft', 'KeyA'].includes(code) && rows.length) { h.sel = (h.sel + rows.length - 1) % rows.length; SFX.blip(); }
    else if (['ArrowDown', 'KeyS', 'Tab', 'ArrowRight', 'KeyD', 'KeyC'].includes(code) && rows.length) { h.sel = (h.sel + 1) % rows.length; SFX.blip(); }
    else if (['Escape', 'KeyX', 'Backspace'].includes(code)) { if (h.mode === 'ask') { h.mode = 'menu'; h.sel = 1; } else if (h.mode === 'acct' || h.mode === 'nag') { h.sel = 1; hkPick(); } else if (h.mode === 'menu') closeHk(); else { h.mode = 'menu'; h.sel = 0; } }
    else if (['Enter', 'NumpadEnter', 'Space', 'KeyE', 'Digit1'].includes(code)) hkPick();
  }
  const hkRow0 = () => Math.min(HK.row0, HK.y + HK.h - 1 - hkRows().length * HK.rh);
  function hkRowAt(x, y) {
    const rows = hkRows(), i = Math.floor((y - hkRow0() + 1) / HK.rh);
    return x >= HK.x && x < HK.x + HK.w && i >= 0 && i < rows.length ? i : -1;
  }
  const hkTarget = e => G.hk && !(e.target.closest && (e.target.closest('.ctl') || e.target.closest('#nameBox')));
  window.addEventListener('pointerdown', e => { if (hkTarget(e)) { e.stopImmediatePropagation(); if (e.cancelable) e.preventDefault(); } }, true);
  window.addEventListener('pointerup', e => {
    if (!hkTarget(e)) return;
    e.stopImmediatePropagation();
    const h = G.hk; if (h.mode === 'busy') return;
    const [x, y] = logicalPos(e);
    if (!inRect(x, y, HK)) { if (h.mode !== 'ask' && h.mode !== 'acct') closeHk(); return; }
    const i = hkRowAt(x, y); if (i < 0) return;
    h.sel = i; hkPick();
  }, true);
  function drawHk() {
    const h = G.hk; if (!h) return;
    textOps.length = 0;   // hi-res text is flushed last: drop what sits under the overlay
    const { x, y, w, h: hh, rh } = HK, row0 = hkRow0();
    g.globalAlpha = 0.5; rect(0, 0, W, H, '#14182a'); g.globalAlpha = 1;
    rect(x + 1, y, w - 2, hh, '#5a3418'); rect(x, y + 1, w, hh - 2, '#5a3418');
    rect(x + 1, y + 1, w - 2, hh - 2, '#fff8e0');
    T(h.mode === 'nag' ? 'データを まもろう！' : 'ひきつぎ', x + 5, y + 4, { c: '#c0502a' });
    rect(x + 3, y + 10, w - 6, 1, '#e8d8b0');
    const cx = x + w / 2;
    if (h.mode === 'menu') {
      T('ほかの きかいで つづきが できる', cx, y + 15, { al: 'center' });
      if (AUTH.user) {
        T('Googleで ログインちゅう', cx, y + 22, { al: 'center', c: '#2a8a3a' });
        T('データは アカウントに のこるよ', cx, y + 29, { al: 'center', c: '#7a5a30' });
      } else {
        T('コードで クラウドに セーブした', cx, y + 22, { al: 'center', c: '#7a5a30' });
        T('データを はこぶよ', cx, y + 29, { al: 'center', c: '#7a5a30' });
      }
    } else if (h.mode === 'nag') {
      T('Googleで ログインすると、', cx, y + 15, { al: 'center' });
      T('スマホを かえても', cx, y + 22, { al: 'center' });
      T('つづきから あそべるよ', cx, y + 29, { al: 'center', c: '#2a8a3a' });
    } else if (h.mode === 'code') {
      T(h.code, cx, y + 14, { size: 8, c: '#3c6ad8', al: 'center' });
      T('7にち いない・1かいだけ つかえる', cx, y + 28, { al: 'center' });
      T('あたらしい きかいで いれてね', cx, y + 35, { al: 'center', c: '#7a5a30' });
    } else if (h.mode === 'ask') {
      const d = h.got.data || {}, st = STAGES[d.stage | 0], lv = (d.party && d.party[0] && d.party[0].lv) || 1;
      T(`${(d.hero && d.hero.n) || ''} ${st ? st.name : ''} Lv${lv}`, cx, y + 14, { al: 'center', c: '#3c6ad8' });
      T('いまの データは うわがき', cx, y + 22, { al: 'center', c: '#d0302a' });
      T('されるよ いい？', cx, y + 29, { al: 'center', c: '#d0302a' });
    } else if (h.mode === 'acct') {
      const d = h.got.data || {}, st = STAGES[d.stage | 0], lv = (d.party && d.party[0] && d.party[0].lv) || 1;
      T('アカウントの データが あるよ', cx, y + 14, { al: 'center' });
      T(`${(d.hero && d.hero.n) || ''} ${st ? st.name : ''} Lv${lv}`, cx, y + 22, { al: 'center', c: '#3c6ad8' });
      T('どっちで あそぶ？', cx, y + 30, { al: 'center', c: '#7a5a30' });
    } else {
      (h.lines || []).forEach((l, i) => T(l, cx, y + 17 + i * 7, { al: 'center', c: h.mode === 'msg' ? '#d0302a' : '#4a2c12' }));
    }
    hkRows().forEach((k, i) => {
      const yy = row0 + i * rh, sel = i === h.sel;
      if (sel) rect(x + 3, yy - 1, w - 6, rh - 1, '#ffe98a');
      if (sel && Math.floor(G.t * 4) % 2) drawPattern(['#..', '##.', '###', '##.', '#..'], x + 5, yy, { '#': '#c0502a' });
      T(HK_LAB[k], x + 10, yy, { c: k === 'yes' ? '#d0302a' : k === 'login' || k === 'nlogin' || k === 'ause' ? '#2a8a3a' : k === 'issue' || k === 'enter' ? '#3c6ad8' : '#4a2c12' });
    });
  }
  function readSave() {
    try { return JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) { return null; }
  }
  function wipeSave() {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
    G.hasSave = false;
  }
  function newActor(x, face, key) { return { x, y: 0, vy: 0, face, ox: 0, oy: 0, bob: 0, walkT: 0, moving: false, flash: 0, shake: 0, alpha: 1, key, jumpQ: -1 }; }
  function newMember(sp, hp, extra) {
    const d = SPECIES[sp];
    const m = { sp, name: d.name, maxHp: d.hp, hp: hp == null ? d.hp : hp, atk: d.atk, def: d.def, spd: d.spd, st: 0, lv: 1, xp: 0 };
    if (extra) Object.assign(m, extra);
    if (m.hp > m.maxHp) m.hp = m.maxHp;
    return m;
  }
  function xpNeed(lv) { return 14 + (lv || 1) * 12; }
  const MAX_LV = TUNING.maxLv || 30;
  const capLv = v => Math.max(1, Math.min(MAX_LV, (v | 0) || 1));
  function grantXp(amt, who) {
    const m = who || ally();
    if (!m || amt <= 0) return 0;
    if ((m.lv || 1) >= MAX_LV) { m.lv = MAX_LV; m.xp = 0; return 0; }
    m.xp = (m.xp || 0) + amt;
    let n = 0;
    while (m.xp >= xpNeed(m.lv || 1) && (m.lv || 1) < MAX_LV) {
      m.xp -= xpNeed(m.lv || 1);
      m.lv = (m.lv || 1) + 1;
      m.maxHp += 4; m.hp = Math.min(m.maxHp, m.hp + 4);
      m.atk += 1; m.def += 1;
      if (m.lv % 2 === 0) m.spd += 1;
      n++;
    }
    if (m.lv >= MAX_LV) m.xp = 0;
    return n;
  }
  const SFX = (() => {
    let ctx = null, master = null, bgmGain = null, ticking = false, step = 0, theme = 'title';
    const n2f = n => n <= 0 ? 0 : 440 * Math.pow(2, (n - 69) / 12);
    function ac() {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        // iPhone: play even when the silent switch is on (iOS 17+ audioSession)
        try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
        ctx = new AC();
        master = ctx.createGain(); master.gain.value = 0.7; master.connect(ctx.destination);
        bgmGain = ctx.createGain(); bgmGain.gain.value = G.muted ? 0 : 0.4; bgmGain.connect(master);
      }
      if (ctx.state !== 'running') ctx.resume().catch(() => {});
      return ctx;
    }
    function tone(dest, freq, dur, type, vol, slide) {
      const c = ac(); if (!c || !freq) return;
      const o = c.createOscillator(), g = c.createGain();
      o.type = type || 'square';
      o.frequency.setValueAtTime(freq, c.currentTime);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, slide), c.currentTime + dur);
      g.gain.value = vol; g.gain.setValueAtTime(vol, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
      o.connect(g); g.connect(dest || master);
      o.start(); o.stop(c.currentTime + dur + 0.02);
    }
    function noiseFilt(dur, vol, type, freq, q) {
      const c = ac(); if (!c || G.muted) return;
      const n = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
      const d = n.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const src = c.createBufferSource(); src.buffer = n;
      const f = c.createBiquadFilter(); f.type = type || 'lowpass'; f.frequency.value = freq || 600;
      if (q) f.Q.value = q;
      const g = c.createGain();
      g.gain.value = vol; g.gain.setValueAtTime(vol, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
      src.connect(f); f.connect(g); g.connect(master);
      src.start(); src.stop(c.currentTime + dur + 0.02);
    }
    function beep(freq, dur, type, vol, slide) {
      if (G.muted) return;
      ac();
      tone(master, freq, dur, type, vol == null ? 0.05 : vol, slide);
    }
    function noise(dur, vol, hp) {
      const c = ac(); if (!c || G.muted) return;
      const n = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
      const d = n.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const src = c.createBufferSource(); src.buffer = n;
      const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp || 800;
      const g = c.createGain();
      g.gain.value = vol; g.gain.setValueAtTime(vol, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
      src.connect(f); f.connect(g); g.connect(master);
      src.start(); src.stop(c.currentTime + dur + 0.02);
    }
    // loops. MIDI notes, 0 = rest. battle is 32-step + drums
    const SONGS = {
      title:  { bpm: 96,  lead: [72,0,76,0,79,76,74,0, 72,0,69,0,71,72,74,0], bass: [48,0,48,55, 45,0,47,0, 48,0,48,52, 43,0,45,0] },
      field:  { bpm: 108, lead: [72,74,76,79, 76,74,72,0, 69,71,72,74, 76,72,69,0], bass: [48,52,55,52, 45,48,52,48, 41,45,48,45, 43,47,50,47] },
      road:   { bpm: 112, lead: [74,76,79,81, 79,76,74,0, 71,74,76,79, 76,74,71,0], bass: [50,54,57,54, 47,50,54,50, 43,47,50,47, 45,48,52,48] },
      dusk:   { bpm: 92,  lead: [69,0,72,0, 76,74,72,0, 67,0,71,0, 74,72,69,0], bass: [45,0,45,52, 41,0,43,0, 45,0,48,0, 40,0,43,0] },
      forest: { bpm: 100, lead: [67,71,74,79, 74,71,67,0, 64,67,71,74, 71,67,64,0], bass: [43,47,50,47, 40,43,47,43, 38,43,47,43, 36,40,43,40] },
      night:  { bpm: 84,  lead: [64,0,67,0, 71,69,67,0, 62,0,66,0, 69,67,64,0], bass: [40,0,40,47, 38,0,43,0, 40,0,45,0, 35,0,38,0] },
      battle: {
        bpm: 172,
        lead: [79,0,79,76, 82,0,79,0, 77,0,77,74, 81,0,77,0, 79,82,86,82, 79,76,72,0, 74,77,81,74, 71,74,67,0],
        bass: [36,36,48,36, 34,34,46,34, 32,32,44,32, 31,31,43,34, 36,36,48,36, 34,34,46,34, 29,29,41,29, 31,31,43,31],
        drum: [1,0,2,0, 1,1,2,0, 1,0,2,0, 1,0,2,2, 1,0,2,0, 1,1,2,0, 1,0,2,1, 1,2,2,0],
      },
      boss: {   // A minor, heavier and darker than the normal battle loop
        bpm: 158,
        lead: [69,0,72,0, 71,0,68,0, 69,72,76,75, 74,0,71,0, 69,0,72,0, 71,0,68,0, 65,69,72,71, 68,0,64,0],
        bass: [33,33,45,33, 33,33,44,33, 29,29,41,29, 28,28,40,28, 33,33,45,33, 32,32,44,32, 29,29,41,29, 28,28,40,32],
        drum: [1,0,2,1, 1,0,2,0, 1,1,2,0, 1,0,2,2, 1,0,2,1, 1,0,2,0, 1,1,2,1, 2,1,2,2],
      },
      town:   { bpm: 120, lead: [76,79,84,79, 81,79,76,0, 74,77,81,77, 79,76,72,0], bass: [48,55,52,55, 53,57,48,57, 50,53,57,53, 55,59,48,0] },
      map:    { bpm: 88,  lead: [72,0,74,0, 76,0,74,0, 72,0,69,0, 71,0,72,0], bass: [48,0,0,55, 45,0,0,52, 41,0,0,48, 43,0,0,50] },
      // ---- optional song fields (new themes): intro {lead,bass,drum,harm} played once before the loop, harm = extra voice,
      //      battle: true = battle-style voices + drum kit, leadType / leadVol / harmType / harmVol / harmLen = voice overrides
      // うさひめ (last boss): E minor, intro rising E-F-F#-G hits, then a 64-step loop; bars 7-8 = the mocking 「うーしっしっ」 trill
      usahime: {
        bpm: 180, battle: true, harmType: 'square', harmVol: 0.04, harmLen: 1.8,
        intro: {
          lead: [76,0,0,76, 0,0,76,0, 77,0,0,77, 0,0,77,0, 78,0,0,78, 0,0,78,0, 79,0,83,0, 88,87,86,83],
          bass: [28,0,0,28, 0,0,28,0, 29,0,0,29, 0,0,29,0, 30,0,0,30, 0,0,30,0, 31,31,31,31, 35,35,35,35],
          drum: [1,0,0,1, 0,0,1,0, 1,0,0,1, 0,0,1,0, 1,0,0,1, 0,0,1,0, 1,2,1,2, 2,2,2,2],
          harm: [64,0,0,0, 0,0,0,0, 65,0,0,0, 0,0,0,0, 66,0,0,0, 0,0,0,0, 67,0,0,0, 71,0,0,0],
        },
        lead: [76,0,79,0, 83,0,81,79, 76,0,0,72, 76,79,84,0, 81,0,78,0, 74,0,78,81, 83,0,0,81, 78,0,75,0,
               76,0,79,0, 83,0,88,0, 86,84,83,84, 86,0,84,0, 84,83,81,83, 84,0,81,0, 83,81,83,81, 78,0,75,0],
        bass: [40,40,52,40, 40,40,52,40, 36,36,48,36, 36,36,48,36, 38,38,50,38, 38,38,50,38, 35,35,47,35, 35,35,47,35,
               40,40,52,40, 40,40,52,40, 36,36,48,36, 36,36,48,36, 33,33,45,33, 33,33,45,33, 35,35,47,35, 35,47,35,47],
        drum: [1,0,2,1, 1,0,2,0, 1,0,2,1, 1,0,2,0, 1,0,2,1, 1,0,2,0, 1,0,2,1, 1,1,2,2,
               1,0,2,1, 1,0,2,0, 1,0,2,1, 1,0,2,0, 1,0,2,1, 1,0,2,0, 1,1,2,1, 2,2,2,2],
        harm: [67,0,0,0, 71,0,0,0, 64,0,0,0, 67,0,0,0, 66,0,0,0, 69,0,0,0, 63,0,0,0, 66,0,0,0,
               67,0,0,0, 71,0,0,0, 67,0,0,0, 64,0,0,0, 64,0,0,0, 69,0,0,0, 66,0,0,0, 63,0,0,0],
      },
      // うさひめ powered-up (usahime2, not wired yet — compare with usahime): same E-minor melody + rising intro, on a 16th grid at 192 BPM;
      //   lead retriggers held notes, 「うーしっしっ」 bars get cheeky chromatic flicks; pumping 16th octave bass; hats + crashes;
      //   2nd pass: crash every bar, snare doubling, and a square arpeggio counter-melody (root-octave-5th) for the build
      usahime2: { bpm: 384, battle: true, leadType: 'sawtooth', leadVol: 0.08, harmType: 'square', harmVol: 0.04, harmLen: 3,
        intro: { lead: [76,0,0,0,0,0,76,0,0,0,0,0,76,0,0,0,77,0,0,0,0,0,77,0,0,0,0,0,77,0,0,0,78,0,0,0,0,0,78,0,0,0,0,0,78,0,0,0,79,0,0,0,83,0,0,0,88,0,87,0,86,0,83,0], bass: [28,40,0,0,0,0,28,40,0,0,0,0,28,40,0,0,29,41,0,0,0,0,29,41,0,0,0,0,29,41,0,0,30,42,0,0,0,0,30,42,0,0,0,0,30,42,0,0,31,43,31,43,31,43,31,43,35,47,35,47,35,47,35,47], drum: [3,4,0,0,0,0,1,4,0,0,0,0,1,4,0,0,3,4,0,0,0,0,1,4,0,0,0,0,1,4,0,0,3,4,0,0,0,0,1,4,0,0,0,0,1,4,0,0,1,4,2,4,1,4,2,4,2,4,2,4,2,4,2,4], harm: [64,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,65,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,66,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,67,0,0,0,0,0,0,0,71,0,0,0,0,0,0,0] },
        lead: [76,76,0,0,79,79,0,0,83,83,0,0,81,0,79,0,76,76,0,0,0,0,72,0,76,0,79,0,84,84,0,0,81,81,0,0,78,78,0,0,74,74,0,0,78,0,81,0,83,83,0,0,0,0,81,0,78,78,0,0,75,75,0,0,76,76,0,0,79,79,0,0,83,83,0,0,88,88,0,0,86,0,84,0,83,0,84,0,86,86,0,0,84,84,0,0,84,85,83,84,81,82,83,84,84,85,0,0,81,82,0,0,83,84,81,82,83,84,81,82,78,79,0,0,75,76,0,0,76,76,0,0,79,79,0,0,83,83,0,0,81,0,79,0,76,76,0,0,0,0,72,0,76,0,79,0,84,84,0,0,81,81,0,0,78,78,0,0,74,74,0,0,78,0,81,0,83,83,0,0,0,0,81,0,78,78,0,0,75,75,0,0,76,76,0,0,79,79,0,0,83,83,0,0,88,88,0,0,86,0,84,0,83,0,84,0,86,86,0,0,84,84,0,0,84,85,83,84,81,82,83,84,84,85,0,0,81,82,0,0,83,84,81,82,83,84,81,82,78,79,0,0,75,76,0,0],
        bass: [40,52,40,52,52,64,40,52,40,52,40,52,52,64,40,52,36,48,36,48,48,60,36,48,36,48,36,48,48,60,36,48,38,50,38,50,50,62,38,50,38,50,38,50,50,62,38,50,35,47,35,47,47,59,35,47,35,47,35,47,47,59,35,47,40,52,40,52,52,64,40,52,40,52,40,52,52,64,40,52,36,48,36,48,48,60,36,48,36,48,36,48,48,60,36,48,33,45,33,45,45,57,33,45,33,45,33,45,45,57,33,45,35,47,35,47,47,59,35,47,35,47,47,59,35,47,47,59,40,52,40,52,52,64,40,52,40,52,40,52,52,64,40,52,36,48,36,48,48,60,36,48,36,48,36,48,48,60,36,48,38,50,38,50,50,62,38,50,38,50,38,50,50,62,38,50,35,47,35,47,47,59,35,47,35,47,35,47,47,59,35,47,40,52,40,52,52,64,40,52,40,52,40,52,52,64,40,52,36,48,36,48,48,60,36,48,36,48,36,48,48,60,36,48,33,45,33,45,45,57,33,45,33,45,33,45,45,57,33,45,35,47,35,47,47,59,35,47,35,47,47,59,35,47,47,59],
        drum: [3,4,0,4,2,4,1,4,1,4,0,4,2,4,0,4,1,4,0,4,2,4,1,4,1,4,0,4,2,4,0,4,1,4,0,4,2,4,1,4,1,4,0,4,2,4,0,4,1,4,0,4,2,4,1,4,1,4,1,4,2,4,2,4,1,4,0,4,2,4,1,4,1,4,0,4,2,4,0,4,1,4,0,4,2,4,1,4,1,4,0,4,2,4,0,4,1,4,0,4,2,4,1,4,1,4,0,4,2,4,0,4,1,4,1,4,2,4,1,4,2,4,2,4,2,4,2,4,3,4,0,4,2,2,1,4,1,4,0,4,2,2,0,4,1,4,0,4,2,2,1,4,1,4,0,4,2,2,0,4,3,4,0,4,2,2,1,4,1,4,0,4,2,2,0,4,1,4,0,4,2,2,1,4,1,4,1,4,2,2,2,4,3,4,0,4,2,2,1,4,1,4,0,4,2,2,0,4,1,4,0,4,2,2,1,4,1,4,0,4,2,2,0,4,3,4,0,4,2,2,1,4,1,4,0,4,2,2,0,4,1,4,1,4,2,2,1,4,2,2,1,2,2,2,2,2],
        harm: [67,0,0,0,0,0,0,0,71,0,0,0,0,0,0,0,64,0,0,0,0,0,0,0,67,0,0,0,0,0,0,0,66,0,0,0,0,0,0,0,69,0,0,0,0,0,0,0,63,0,0,0,0,0,0,0,66,0,0,0,0,0,0,0,67,0,0,0,0,0,0,0,71,0,0,0,0,0,0,0,67,0,0,0,0,0,0,0,64,0,0,0,0,0,0,0,64,0,0,0,0,0,0,0,69,0,0,0,0,0,0,0,66,0,0,0,0,0,0,0,63,0,0,0,0,0,0,0,67,0,79,0,74,0,79,0,71,0,83,0,78,0,83,0,64,0,76,0,71,0,76,0,67,0,79,0,74,0,79,0,66,0,78,0,73,0,78,0,69,0,81,0,76,0,81,0,63,0,75,0,70,0,75,0,66,0,78,0,73,0,78,0,67,0,79,0,74,0,79,0,71,0,83,0,78,0,83,0,67,0,79,0,74,0,79,0,64,0,76,0,71,0,76,0,64,0,76,0,71,0,76,0,69,0,81,0,76,0,81,0,66,0,78,0,73,0,78,0,63,0,75,0,70,0,75,0] },
      // せいぎぐん mid-bosses: B♭ major military march, oom-pah bass, snare rolls
      seigi_mid: {
        bpm: 132, battle: true, leadType: 'square', leadVol: 0.08, harmType: 'square', harmVol: 0.035, harmLen: 1.2,
        lead: [70,0,70,70, 74,0,77,0, 82,0,0,0, 77,0,74,0, 75,0,75,75, 79,0,82,0, 77,0,0,77, 79,0,81,0,
               82,0,82,82, 81,0,79,0, 77,0,79,0, 81,0,77,0, 79,0,75,0, 74,0,72,0, 70,0,0,0, 70,70,70,0],
        bass: [46,0,53,0, 46,0,53,0, 46,0,53,0, 46,0,53,0, 39,0,46,0, 39,0,46,0, 41,0,48,0, 41,0,48,0,
               46,0,53,0, 46,0,53,0, 39,0,46,0, 39,0,46,0, 41,0,48,0, 41,0,48,0, 46,0,53,0, 46,46,46,0],
        drum: [1,0,2,0, 1,0,2,2, 1,0,2,0, 1,0,2,2, 1,0,2,0, 1,0,2,2, 1,0,2,0, 1,2,2,2,
               1,0,2,0, 1,0,2,2, 1,0,2,0, 1,0,2,2, 1,0,2,0, 1,0,2,2, 1,2,1,2, 2,2,2,0],
        harm: [62,0,0,0, 65,0,0,0, 62,0,0,0, 65,0,0,0, 63,0,0,0, 67,0,0,0, 65,0,0,0, 69,0,0,0,
               62,0,0,0, 65,0,0,0, 63,0,0,0, 67,0,0,0, 65,0,0,0, 69,0,0,0, 62,0,0,0, 65,0,0,0],
      },
      // true ending: F major, gentle picnic waltz-like phrase with a soft harmony voice
      true_end: {
        bpm: 96, leadVol: 0.06, harmType: 'square', harmVol: 0.03, harmLen: 1.7,
        lead: [72,0,77,0, 76,0,72,0, 74,0,77,0, 81,0,79,0, 77,0,76,0, 74,0,76,0, 77,0,0,0, 76,74,72,0,
               74,0,77,0, 81,0,77,0, 79,0,77,0, 74,0,77,0, 76,0,74,0, 72,0,76,0, 77,0,0,0, 0,0,0,0],
        bass: [41,0,48,0, 53,0,48,0, 46,0,53,0, 58,0,53,0, 48,0,55,0, 60,0,55,0, 41,0,48,0, 53,0,48,0,
               38,0,45,0, 50,0,45,0, 46,0,53,0, 58,0,53,0, 48,0,55,0, 60,0,55,0, 41,0,48,0, 53,0,0,0],
        harm: [69,0,0,0, 65,0,0,0, 70,0,0,0, 74,0,0,0, 67,0,0,0, 72,0,0,0, 69,0,0,0, 65,0,0,0,
               65,0,0,0, 69,0,0,0, 70,0,0,0, 65,0,0,0, 67,0,0,0, 64,0,0,0, 65,0,0,0, 69,0,0,0],
      },
      // ハロウィンの よる event: D minor, swung, spooky-but-cute
      halloween: { bpm: 138, swing: 0.3, leadVol: 0.065, harmType: 'triangle', harmVol: 0.05, harmLen: 1.2, lead: [74,0,77,74,81,0,80,0,79,77,76,0,73,0,69,0,70,0,74,70,77,0,76,74,73,74,76,77,76,0,0,0,74,77,81,77,86,0,85,0,84,82,81,0,79,0,77,0,76,0,73,0,70,0,73,76,74,0,69,0,62,0,0,0], bass: [38,0,45,0,50,0,45,0,33,0,40,0,45,0,40,0,34,0,41,0,46,0,41,0,33,0,40,0,45,0,40,0,38,0,45,0,50,0,45,0,41,0,48,0,53,0,48,0,33,0,40,0,45,0,40,0,38,0,45,0,50,0,45,0], harm: [65,0,0,0,69,0,0,0,61,0,0,0,64,0,0,0,62,0,0,0,65,0,0,0,61,0,0,0,67,0,0,0,65,0,0,0,69,0,0,0,65,0,0,0,69,0,0,0,61,0,0,0,67,0,0,0,62,0,0,0,65,0,0,0] },
      // first-launch opening: gentle F major intro (64 steps = 19.6 s, rising into 「ぼうけんの はじまりだ！」), then an adventurous loop
      opening: { bpm: 98, leadVol: 0.065, harmType: 'triangle', harmVol: 0.05, harmLen: 1.8, intro: { lead: [65,0,0,0,69,0,72,0,77,0,0,0,76,0,72,0,74,0,0,0,72,0,70,0,69,0,0,0,0,0,0,0,65,0,69,0,72,0,77,0,79,0,77,0,76,0,74,0,72,0,74,0,76,0,77,0,79,0,81,0,82,0,84,0], bass: [41,0,0,0,48,0,0,0,36,0,0,0,43,0,0,0,34,0,0,0,41,0,0,0,36,0,0,0,43,0,0,0,41,0,0,0,48,0,0,0,38,0,0,0,45,0,0,0,34,0,0,0,41,0,0,0,36,0,0,0,43,0,0,0], harm: [69,0,0,0,72,0,0,0,67,0,0,0,72,0,0,0,65,0,0,0,70,0,0,0,64,0,0,0,67,0,0,0,69,0,0,0,72,0,0,0,65,0,0,0,69,0,0,0,65,0,0,0,70,0,0,0,64,0,0,0,70,0,0,0] }, lead: [77,0,77,79,81,0,77,0,84,0,82,81,79,0,0,0,82,0,81,79,77,0,74,0,76,77,79,76,72,0,0,0], bass: [41,53,48,53,41,53,48,53,38,50,45,50,38,50,45,50,34,46,41,46,34,46,41,46,36,48,43,48,36,48,43,48], harm: [69,0,72,0,69,0,72,0,65,0,69,0,65,0,69,0,65,0,70,0,65,0,70,0,64,0,67,0,64,0,67,0] },
      // トレーニング: C major workout groove
      training: { bpm: 140, battle: true, leadType: 'square', leadVol: 0.07, lead: [72,0,72,0,79,0,72,0,76,0,79,0,81,79,76,0,74,0,74,0,79,0,74,0,77,0,79,0,83,81,79,0], bass: [36,48,36,48,36,48,43,48,41,53,41,53,41,53,48,53,43,55,43,55,43,55,50,55,43,55,43,55,43,55,50,55], drum: [1,0,2,0,1,0,2,1,1,0,2,0,1,0,2,1,1,0,2,0,1,0,2,1,1,0,2,0,1,0,2,1], harmType: 'triangle', harmVol: 0.045, harmLen: 1.0, harm: [64,0,67,0,64,0,67,0,65,0,69,0,65,0,69,0,62,0,67,0,62,0,67,0,65,0,71,0,65,0,71,0] },
      // ガチャ: bouncy G major 16-step loop
      gacha: { bpm: 150, battle: true, leadType: 'square', leadVol: 0.07, lead: [67,71,74,71,79,0,74,0,69,72,76,72,78,0,74,0], bass: [43,0,55,0,43,0,55,0,45,0,57,0,50,0,62,0], drum: [1,0,2,0,1,2,2,0,1,0,2,0,1,2,2,2], harmType: 'triangle', harmVol: 0.045, harmLen: 1.4, harm: [71,0,0,0,74,0,0,0,72,0,0,0,76,0,0,0] },
      // ライバル (ユイ/ハルト, ambush, co-op): E minor friendly-rivalry battle, square lead
      rival: { bpm: 176, battle: true, leadType: 'square', leadVol: 0.075, harmType: 'sawtooth', harmVol: 0.03, harmLen: 1.2, lead: [76,0,79,81,83,0,81,79,78,0,74,0,76,0,0,0,76,0,79,81,83,0,86,0,84,83,81,79,81,0,0,0,79,0,79,0,81,79,78,0,76,0,76,0,78,76,74,0,72,0,74,0,76,0,78,0,79,81,83,86,88,0,0,0], bass: [40,40,52,40,40,52,47,52,35,35,47,35,35,47,42,47,36,36,48,36,36,48,43,48,38,38,50,38,38,50,45,50,40,40,52,40,40,52,47,52,43,43,55,43,43,55,50,55,45,45,57,45,45,57,52,57,38,38,50,38,38,50,45,50,36,36,48,36,36,48,43,48,38,38,50,38,38,50,45,50,35,35,47,35,35,47,42,47,40,40,52,40,40,52,47,52,36,36,48,36,36,48,43,48,38,38,50,38,38,50,45,50,35,35,47,35,35,47,42,47,40,40,52,40,40,52,47,52], drum: [1,0,2,0,1,1,2,0,1,0,2,1,1,0,2,2,1,0,2,0,1,1,2,0,1,0,2,1,1,0,2,2,1,0,2,0,1,1,2,0,1,0,2,1,1,0,2,2,1,0,2,0,1,1,2,0,1,0,2,1,1,0,2,2], harm: [67,0,0,0,71,0,0,0,66,0,0,0,71,0,0,0,67,0,0,0,72,0,0,0,66,0,0,0,69,0,0,0,67,0,0,0,71,0,0,0,67,0,0,0,71,0,0,0,69,0,0,0,72,0,0,0,66,0,0,0,69,0,0,0,67,0,0,0,72,0,0,0,66,0,0,0,69,0,0,0,66,0,0,0,71,0,0,0,67,0,0,0,71,0,0,0,67,0,0,0,72,0,0,0,69,0,0,0,74,0,0,0,66,0,0,0,71,0,0,0,67,0,0,0,71,0,0,0] },
      // オグリキング v3 (original, driving chiptune final-boss style): D minor, 16th-note steps (bpm 256 = 128 BPM),
      //   4-bar riff with bar roots D-C-Bb-A; hook = repeated root, leap up a minor 10th, fast scale run down (C# leading tone in the A bar);
      //   section B = rapid 16th arpeggios. staccato syncopated octave bass, drums: kick / snare on 2&4 / hats (4) / crash (3), fills.
      oguriking: { bpm: 256, battle: true, leadType: 'square', leadVol: 0.075, harmType: 'square', harmVol: 0.03, harmLen: 6,
        lead: [62,0,62,77,0,0,0,0,76,74,72,69,67,0,69,0,60,0,60,75,0,0,0,0,74,72,70,67,65,0,67,0,58,0,58,73,0,0,0,0,72,70,68,65,63,0,65,0,57,0,57,73,0,0,0,0,71,70,69,66,64,0,61,0,74,77,81,86,74,77,81,86,74,77,81,86,86,0,81,0,72,75,79,84,72,75,79,84,72,75,79,84,84,0,79,0,70,73,77,82,70,73,77,82,70,73,77,82,82,0,77,0,69,73,76,79,69,73,76,79,69,73,76,79,79,76,73,70],
        bass: [38,0,50,0,0,38,50,0,38,0,50,38,0,50,0,50,36,0,48,0,0,36,48,0,36,0,48,36,0,48,0,48,34,0,46,0,0,34,46,0,34,0,46,34,0,46,0,46,33,0,45,0,0,33,45,0,33,0,45,33,0,45,0,45,38,0,50,0,0,38,50,0,38,0,50,38,0,50,0,50,36,0,48,0,0,36,48,0,36,0,48,36,0,48,0,48,34,0,46,0,0,34,46,0,34,0,46,34,0,46,0,46,33,0,45,0,0,33,45,0,33,0,45,33,0,45,0,45],
        drum: [3,0,4,0,2,0,1,4,1,0,4,0,2,0,4,4,1,0,4,0,2,0,1,4,1,0,4,0,2,0,4,4,1,0,4,0,2,0,1,4,1,0,4,0,2,0,4,4,1,0,4,0,2,0,1,4,2,2,1,2,2,2,2,2,3,0,4,0,2,0,1,4,1,0,4,0,2,0,4,4,1,0,4,0,2,0,1,4,1,0,4,0,2,0,4,4,1,0,4,0,2,0,1,4,1,0,4,0,2,0,4,4,2,0,2,0,2,0,1,2,2,2,2,2,2,2,2,2],
        harm: [65,0,0,0,0,0,0,0,69,0,0,0,0,0,0,0,64,0,0,0,0,0,0,0,67,0,0,0,0,0,0,0,62,0,0,0,0,0,0,0,65,0,0,0,0,0,0,0,61,0,0,0,0,0,0,0,64,0,0,0,0,0,0,0,65,0,0,0,0,0,0,0,69,0,0,0,0,0,0,0,64,0,0,0,0,0,0,0,67,0,0,0,0,0,0,0,62,0,0,0,0,0,0,0,65,0,0,0,0,0,0,0,61,0,0,0,0,0,0,0,64,0,0,0,0,0,0,0] },
    };
    // one step of a song as events: ['t', freq, dur, type, vol, slide] = tone on the BGM bus, ['n', dur, vol, hp] = noise (master bus).
    // shared by tick() and the offline renderer (SFX.render) so a render plays exactly what the game plays
    function stepEvents(name, song, part, i) {
      const P = part || song, out = [], beat = 60 / song.bpm / 2;
      const lead = P.lead[i % P.lead.length], bass = P.bass[i % P.bass.length], harm = P.harm && P.harm[i % P.harm.length];
      const isBattle = name === 'battle' || name === 'boss' || !!song.battle;
      if (lead) out.push(['t', n2f(lead), beat * (isBattle ? 0.55 : 0.85), song.leadType || (isBattle ? 'sawtooth' : 'square'), song.leadVol || (isBattle ? 0.08 : 0.07)]);
      if (bass) out.push(['t', n2f(bass), beat * (isBattle ? 0.7 : 0.95), 'square', isBattle ? 0.11 : 0.09]);
      if (harm) out.push(['t', n2f(harm), beat * (song.harmLen || 1.6), song.harmType || 'square', song.harmVol || 0.035]);
      if (isBattle && P.drum) {
        const dr = P.drum[i % P.drum.length];
        if (dr === 1) out.push(['t', 90, 0.06, 'square', 0.08, 50]);
        if (dr === 3) { out.push(['t', 90, 0.08, 'square', 0.09, 45]); out.push(['n', 0.45, 0.06, 3500]); }   // kick + crash
        if (dr === 4) out.push(['n', 0.025, 0.03, 7000]);   // closed hat
        if (dr === 2) { out.push(['t', 220, 0.04, 'square', 0.04]); out.push(['n', 0.05, 0.06, 1800]); }
      } else if (i % 4 === 0) out.push(['t', 180, 0.04, 'square', 0.03]);
      return out;
    }
    let intro = false;
    let gen = 0;
    function tick(my) {
      if (!ticking || !ctx || my !== gen) return;
      const song = SONGS[theme] || SONGS.field;
      const beat = 60 / song.bpm / 2;
      const part = intro && song.intro ? song.intro : song, len = part.lead.length;
      if (!G.muted && bgmGain) for (const e of stepEvents(theme, song, part, step)) { if (e[0] === 't') tone(bgmGain, e[1], e[2], e[3], e[4], e[5]); else noise(e[1], e[2], e[3]); }
      step++;
      if (step >= len) { step = 0; intro = false; }
      setTimeout(tick, (song.swing ? beat * (step % 2 ? 1 + song.swing : 1 - song.swing) : beat) * 1000, my);   // step already advanced: odd = the long on-beat
    }
    // offline render of a theme (OfflineAudioContext, same graph: BGM bus 0.22 -> master 0.7; drum noise straight to master)
    async function render(name, secs, sr) {
      sr = sr || 44100; const song = SONGS[name], c = new OfflineAudioContext(1, Math.ceil(sr * secs), sr);
      const mst = c.createGain(); mst.gain.value = 0.7; mst.connect(c.destination);
      const bus = c.createGain(); bus.gain.value = 0.4; bus.connect(mst);
      let t = 0, st = 0, inIntro = !!song.intro; const beat = 60 / song.bpm / 2;
      while (t < secs) {
        const part = inIntro ? song.intro : song, t0 = t; t = Math.round(t * sr) / sr;   // sample-aligned like the live clock (else a noise burst can start before its gain envelope)
        for (const e of stepEvents(name, song, part, st)) {
          if (e[0] === 't') {
            const [, freq, dur, type, vol, slide] = e, o = c.createOscillator(), g = c.createGain();
            o.type = type || 'square'; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, slide), t + dur);
            g.gain.value = vol; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); o.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 0.02);
          } else {
            const [, dur, vol, hp] = e, b = c.createBuffer(1, Math.floor(sr * dur), sr), d = b.getChannelData(0);
            for (let k = 0; k < d.length; k++) d[k] = Math.random() * 2 - 1;
            const src = c.createBufferSource(); src.buffer = b; const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp || 800;
            const g = c.createGain(); g.gain.value = vol; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
            src.connect(f); f.connect(g); g.connect(mst); src.start(t); src.stop(t + dur + 0.02);
          }
        }
        st++; if (st >= part.lead.length) { st = 0; inIntro = false; }
        t = t0 + (song.swing ? beat * (st % 2 ? 1 + song.swing : 1 - song.swing) : beat);
      }
      return (await c.startRendering()).getChannelData(0);
    }
    function start() {
      const c = ac(); if (!c) return;
      applyMute();
      if (!ticking) { ticking = true; step = 0; tick(gen); }
    }
    // jump straight to the top of a song (opening: music and pictures start together)
    function restart(name) {
      const c = ac(); if (!c) return;
      applyMute(); theme = name; step = 0; intro = !!(SONGS[name] && SONGS[name].intro);
      ticking = true; gen++; tick(gen);
    }
    // iOS: an 'interrupted' / 'suspended' context (home-screen app sent to the background) may be resumed later
    function wake() { if (ctx && ctx.state !== 'running' && ctx.state !== 'closed') ctx.resume().catch(() => {}); }
    function applyMute() {
      if (!bgmGain || !ctx) return;
      bgmGain.gain.cancelScheduledValues(ctx.currentTime);
      bgmGain.gain.setTargetAtTime(G.muted ? 0 : 0.4, ctx.currentTime, 0.05);
    }
    function setTheme(name) {
      if (name && name !== theme) { theme = name; step = 0; intro = !!(SONGS[name] && SONGS[name].intro); }
    }
    function sync() {
      let name = 'field';
      if (G.op) name = 'opening';
      else if (G.state === 'hub' && G.hub && (G.hub.view === 'train' || G.hub.view === 'tgame')) name = 'training';
      else if (G.state === 'hub' && G.hub && G.hub.view === 'gacha') name = 'gacha';
      else if (G.state === 'title' || G.state === 'hub') name = 'title';
      else if (G.state === 'map') name = 'map';
      else if (G.ending && G.ending.id === 'true') name = 'true_end';   // true ending pan + staff roll
      else if (G.state === 'battle') {
        const sp = G.battle && G.battle.w && SPECIES[G.battle.w.sp];
        const B = G.battle, tr = B && B.w && B.w.trainer, rv = B && (B.coop || tr === 'rival' || (tr && String(tr).startsWith('rv_')));   // ライバル: town rival, ambushes, co-op
        name = B && B.final ? 'usahime2' : B && B.w.sp === 'usahime' ? 'usahime' : B && B.w.sp === 'oguriking' ? 'oguriking' : rv ? 'rival' : sp && sp.boss && sp.gate ? 'seigi_mid' : sp && sp.boss ? 'boss' : 'battle';
      }
      else {
        const th = STAGES[G.stage] && STAGES[G.stage].theme;
        name = SONGS[th] ? th : 'field';
      }
      setTheme(name);
    }
    // iOS: (re)start audio inside a real tap; also wakes an 'interrupted' context after the app was in the background
    function unlock() {
      const c = ac(); if (!c) return;
      if (c.state !== 'running') c.resume().catch(() => {});
      try { const b = c.createBuffer(1, 1, 22050), s = c.createBufferSource(); s.buffer = b; s.connect(c.destination); s.start(0); } catch (e) {}
    }
    return {
      unlock, restart, wake, get state() { return ctx ? ctx.state : 'none'; }, render, get theme() { return theme; }, get intro() { return intro; }, songs: SONGS,
      start, sync, setMuted: applyMute,
      jump() { beep(520, 0.12, 'square', 0.04, 280); },
      hit(kind) {
        if (kind === 'strong') {
          // ジュワッ：低い帯域のノイズが広がって残る
          noiseFilt(0.32, 0.18, 'lowpass', 700);
          noiseFilt(0.22, 0.12, 'bandpass', 280, 1.2);
          beep(380, 0.26, 'sine', 0.08, 70);
          beep(160, 0.30, 'triangle', 0.09, 48);
        } else {
          noise(0.06, 0.08, 900);
          beep(210, 0.07, 'square', 0.07, 90);
        }
      },
      pyun() {
        beep(980, 0.10, 'sine', 0.055, 1680);
      },
      hearts() {
        for (let i = 0; i < 4; i++) setTimeout(() => SFX.pyun(), i * 115);
      },
      recruit() {
        if (bgmGain && ctx && !G.muted) {
          bgmGain.gain.cancelScheduledValues(ctx.currentTime);
          bgmGain.gain.setTargetAtTime(0.04, ctx.currentTime, 0.04);
          setTimeout(() => { if (!G.muted && bgmGain && ctx) bgmGain.gain.setTargetAtTime(0.4, ctx.currentTime, 0.12); }, 1400);
        }
        const line = [
          [0, 523], [110, 659], [220, 784], [330, 1046],
          [520, 784], [620, 988], [720, 1318],
        ];
        line.forEach(([t, f]) => setTimeout(() => {
          beep(f, t >= 700 ? 0.32 : 0.14, 'square', 0.07);
          beep(f / 2, t >= 700 ? 0.32 : 0.14, 'triangle', 0.045);
        }, t));
      },
      win() { beep(523, 0.1, 'square', 0.06); setTimeout(() => beep(659, 0.1, 'square', 0.06), 80); setTimeout(() => beep(784, 0.18, 'square', 0.07), 160); },
      level() { beep(392, 0.1, 'square', 0.05); setTimeout(() => beep(523, 0.1, 'square', 0.05), 80); setTimeout(() => beep(784, 0.2, 'square', 0.05), 160); },
      blip() { beep(880, 0.04, 'square', 0.03); },
      buy() { beep(988, 0.06, 'square', 0.05); setTimeout(() => beep(1318, 0.14, 'square', 0.05), 60); },
      miss() { beep(160, 0.08, 'square', 0.04); setTimeout(() => beep(110, 0.14, 'triangle', 0.03, 60), 50); },
      battleStart() {
        beep(196, 0.1, 'square', 0.07);
        setTimeout(() => beep(247, 0.1, 'square', 0.07), 70);
        setTimeout(() => beep(311, 0.12, 'square', 0.08), 140);
        setTimeout(() => { noise(0.1, 0.08, 600); beep(392, 0.16, 'sawtooth', 0.06); }, 220);
      },
    };
  })();
  const player = newActor(40, 1, 'player');
  const comp = newActor(64, 1, 'goririn');
  const ally = () => G.party[G.active];
  // evolved members use their EVOLVE sprite once that art is loaded (?evotest falls back to the base art for testing)
  const EVOTEST = /[?&]evotest/.test(location.search);
  function memberKey(m) {
    const ev = m && m.evo && typeof EVOLVE !== 'undefined' && EVOLVE[m.sp];
    const k = ev && SPR[ev.sprite] ? ev.sprite : SPECIES[m.sp].sprite;
    if (m && m.gold && SPR[k + '_gold']) return k + '_gold';   // ate a でんせつの にんじん (final うさひめ fight)
    return m && m.crown && SPR[k + '_crown'] ? k + '_crown' : k;   // crowned オグリキャップ
  }
  const compKey = () => memberKey(ally());
  function* tryEvolve() {
    const m = ally(), ev = typeof EVOLVE !== 'undefined' && EVOLVE[m.sp];
    if (!ev || m.evo || (m.lv || 1) < ev.lv || !(SPR[ev.sprite] || EVOTEST)) return;
    const before = m.name;
    banner(`おや？ ${before}の ようすが…`, 2.2);
    yield* wait(0.8);
    for (let i = 0; i < 14; i++) { comp.flash = 0.2; yield* wait(0.1 + (i < 7 ? 0.06 : 0)); }
    m.evo = 1;
    if (ev.name) m.name = ev.name;
    m.maxHp += ev.hp || 0; m.hp = m.maxHp; m.atk += ev.atk || 0; m.def += ev.def || 0; m.spd += ev.spd || 0;
    comp.key = compKey();
    burst(comp.x, GROUND - 14, 'spark', 16, '#ffffff'); SFX.level();
    banner(`${before}は ${m.name !== before ? m.name + 'に ' : ''}しんかした！`, 2.4);
    yield* wait(1.6);
  }

  function spawnWilds() {
    G.wilds = STAGES[G.stage].spawns.map((s, i) => (Object.assign(newActor(s.x, -1, SPECIES[s.sp].sprite), s.lv ? trainerMember({ sp: s.sp, lv: s.lv, style: s.style, evo: SPECIES[s.sp].evoOnly || (s.evo ? 1 : 0) }) : newMember(s.sp), {
      home: s.x, spawnX: s.x, alive: !(SPECIES[s.sp].recruitAfter && G.flags && G.flags['joined_' + s.sp]) && !(s.gate && G.flags && G.flags['gate_' + s.gate]), gate: s.gate || null, cool: false, wt: 1 + rand() * 2, wdir: 0, toHome: false, idx: i,
    }, platOf(s))));
    const st = STAGES[G.stage], gs = st.spawns.find(s => s.gate === st.id);
    if (gs && G.flags.usaLoss && !G.flags.w4clear && !G.flags['gate_gold_' + st.id] && !G.friend && !G.versus) {   // return visit: the gold mid-boss waits near the START
      const sp = gs.sp + '_gold';
      G.wilds.push(Object.assign(newActor(150, -1, SPECIES[sp].sprite), trainerMember({ sp, lv: Math.min(30, gs.lv + 3) }), { home: 150, spawnX: 150, alive: true, gate: 'gold_' + st.id, cool: false, wt: 1, wdir: 0, toHome: false, idx: G.wilds.length }));
    }
    for (const w of G.wilds) if (w.sp === 'usahime' && G.flags.w4clear) w.alive = false;
    for (const w of G.wilds) w.key = memberKey(w);   // evolved wilds (evo: 1) show their evolved art when it exists
  }
  // spawn entry with plat: <index> stands / patrols on that platform (only reachable by jumping)
  function platOf(s) {
    const ps = STAGES[G.stage].plats, p = s.plat != null && ps ? ps[s.plat] : null;
    if (!p) return {};
    const x = clamp(s.x, p.x + 6, p.x + p.w - 6);
    return { pl: p, y: -p.h, home: x, spawnX: x, x };
  }
  function putOnPlat(w) { if (w.pl) { w.x = w.home = w.spawnX; w.y = -w.pl.h; w.vy = 0; w.toHome = false; } }

  function banner(text, dur = 1.6) { G.banner = { text, t: dur }; }
  function pop(x, y, text, col) { G.pops.push({ x, y, text, col, life: 0.9 }); }
  function burst(x, y, type, n, col) {
    for (let i = 0; i < n; i++) {
      const a = rand() * Math.PI * 2, sp = 20 + rand() * 40;
      G.particles.push({ type, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 15, life: 0.4 + rand() * 0.4, col });
    }
  }
  function dust(x, dir) {
    for (let i = 0; i < 3; i++) G.particles.push({ type: 'dust', x: x + (rand() - 0.5) * 6, y: GROUND - rand() * 2, vx: -dir * (8 + rand() * 12), vy: -6 - rand() * 8, life: 0.35 + rand() * 0.2 });
  }
  function heartTo(x0, y0, x1, y1, delay) {
    G.particles.push({ type: 'heartTo', x: x0, y: y0, x0, y0, x1, y1, t: -delay, dur: 0.7, life: 99 });
  }

  // ---------- stats / formulas ----------
  function movesOf(m) {
    const base = SPECIES[m.sp].moves, ev = m.evo && typeof EVO_MOVES !== 'undefined' && EVO_MOVES[m.sp];
    return ev ? { attack: base.attack, strong: Object.assign({}, base.strong, ev.strong) } : base;
  }
  const canSp = m => !!(m && (m.evo || m.crown || (SPECIES[m.sp] && SPECIES[m.sp].noEvo)));
  // おやこ おぐり波: crowned オグリキャップ + オグリキング both in your party (the one fighting + the other still standing)
  function oyakoPartner(m) {
    if (typeof CROWN === 'undefined' || !G.battle || m !== ally() || G.friend && G.battle.who === 'opp') return null;
    const want = m.sp === CROWN.sp && m.crown ? (o => o.sp === CROWN.oyako.partner) : m.sp === CROWN.oyako.partner ? (o => o.sp === CROWN.sp && o.crown) : null;
    return want ? G.party.find(o => o !== m && (o.hp >= 1 || G.battle.final) && want(o)) || null : null;   // final うさひめ fight: the fallen partner still joins the finisher
  }
  function specialOf(m) {
    const sp0 = specialBase(m);
    if (typeof CROWN === 'undefined' || !m) return sp0;
    const P = oyakoPartner(m);
    if (P) { const O = CROWN.oyako, gold = m.gold && P.gold && FXIMG.oguriking_gold; return Object.assign({ acc: 1 }, O, { power: Math.round(Math.max(sp0.power, specialBase(P).power) * O.mult), super: true, oyako: P.name }, gold ? { fxSp: 'oguriking_gold', col: '#ffe24a', name: 'きんいろの ' + O.name } : {}); }
    if (m.crown && m.sp === CROWN.sp) { const C = CROWN.special; return Object.assign({ acc: 1 }, C, { power: Math.round(sp0.power * C.mult) }); }
    return sp0;
  }   // evolved, or a never-evolving species (own special at base form)
  function specialBase(m) {
    const st = movesOf(m).strong, ev = canSp(m) && typeof EVO_MOVES !== 'undefined' && EVO_MOVES[m.sp];
    if (ev && ev.special) {
      const sp = Object.assign({ power: Math.round(st.power * 2), acc: 1 }, ev.special, m.evo && ev.special.evo || {}); delete sp.evo;   // special.evo: evolved-form overrides (name / fx art)
      if (ev.super && m.hp > 0 && m.hp <= m.maxHp / 2) return Object.assign(sp, { name: ev.super.name, power: Math.round(sp.power * (ev.super.mult || 1.5)), col: ev.super.col || sp.col, super: true, scale: ev.super.scale || 1.75 });
      return sp;
    }
    return { name: 'きずなの ' + st.name, power: Math.round(st.power * 1.9), acc: 1 };
  }
  const stRate = u => (TUNING.stBase + u.spd * TUNING.stPerSpd) * (u.crown && typeof CROWN !== 'undefined' ? CROWN.stMult : 1);   // crown perk: faster stamina
  // じゃんけん: グー > チョキ > パー > グー (x1.5 / x0.5), every move incl. ひっさつ, both sides, versus too
  const JK_BEATS = { gu: 'choki', choki: 'pa', pa: 'gu' };
  const handOf = m => { const k = m && String(m.sp || '').replace(/_(boss|gold)$/, ''); return (typeof JANKEN !== 'undefined' && (JANKEN[m && m.sp] || JANKEN[k])) || 'gu'; };
  const jkMul = (a, d) => { if (G.battle && G.battle.final) return 1;   // final うさひめ fight stays neutral (balance)
    const x = handOf(a), y = handOf(d); return JK_BEATS[x] === y ? 1.5 : JK_BEATS[y] === x ? 0.5 : 1; };
  function jkPop(att, def, defA) {   // once per move (multi-hit specials land several times)
    const m = jkMul(att, def); if (m === 1 || G.t - (G.jkT || -9) < 0.6) return; G.jkT = G.t;
    G.pops.push({ x: defA.x, y: GROUND - 50, text: m > 1 ? 'こうかばつぐん！' : 'いまひとつ…', col: m > 1 ? '#ff9a3a' : '#c8d8f0', life: 1.2, kana: true });
  }
  const JK_PAT = {
    gu:    ['..####..', '.#wwww#.', '#wwwwww#', '#w#w#w##', '#wwwwww#', '#wwwwww#', '.#wwww#.', '..####..'],
    choki: ['.#...#..', '#w#.#w#.', '#w#.#w#.', '.#w#w#..', '.#wwww#.', '#wwwwww#', '#wwwww#.', '.#####..'],
    pa:    ['.#.#.#..', '#w#w#w#.', '#w#w#w##', '#w#w#ww#', '#wwwww#.', '#wwwww#.', '.#www#..', '..###...'],
  };
  const JK_COL = { gu: '#f45a5a', choki: '#3c6ad8', pa: '#47a83a' };
  function drawJk(h, x, y) {
    if (JKART[h]) { g.drawImage(JKART[h], x, y); return; }
    rect(x, y, 8, 8, JK_COL[h]); drawPattern(JK_PAT[h], x, y, { '#': '#2a1a10', w: '#fff8e0' });
  }

  // ---------- じゃんけん あいしょう tutorial (3 pages; first eligible battle once, or from the ずかん あいしょう button) ----------
  const JKT_N = 3;
  function jkTutArm(B) {
    if (G.jkTut || G.flags.jkTut || !B || B.final || G.versus || tutOn() || B.phase !== 'input') return;
    G.jkTut = { p: 0, t: 0, from: 'battle' };
  }
  function jkTutOpen() { G.fade = 0; G.jkTut = { p: 0, t: 0, from: 'hub' }; SFX.blip(); }
  function jkTutStep(d) {
    const J = G.jkTut; if (!J) return;
    J.p = Math.max(0, J.p + d); SFX.blip();
    if (J.p >= JKT_N) { if (J.from === 'battle') { G.flags.jkTut = 1; persist(); } G.jkTut = null; }
  }
  function jkTutKey(code) {
    if (code === 'ArrowLeft' || code === 'KeyA') jkTutStep(-1);
    else if (['Escape', 'KeyX', 'Backspace'].includes(code) && G.jkTut.p === JKT_N - 1) jkTutStep(1);
    else if (!['ArrowUp', 'ArrowDown', 'KeyW', 'KeyS'].includes(code)) jkTutStep(1);
  }
  function jkBig(h, x, y) {   // badge at 2x (integer nearest-neighbour)
    if (JKART[h]) { g.drawImage(JKART[h], x, y, 16, 16); return; }
    rect(x, y, 16, 16, JK_COL[h]); for (let r = 0; r < 8; r++) for (let q = 0; q < 8; q++) { const ch = (JK_PAT[h][r] || '')[q]; if (ch === '#' || ch === 'w') rect(x + q * 2, y + r * 2, 2, 2, ch === '#' ? '#2a1a10' : '#fff8e0'); }
  }
  function drawJkTut() {
    const J = G.jkTut; if (!J) return;
    textOps.length = 0;   // modal: drop the text underneath
    g.globalAlpha = 0.55; rect(0, 0, W, H, '#14182a'); g.globalAlpha = 1;
    const x = 8, y = 4, w = 144, h = 64, inB = G.state === 'battle';
    rect(x + 1, y, w - 2, h, '#5a3418'); rect(x, y + 1, w, h - 2, '#5a3418'); rect(x + 1, y + 1, w - 2, h - 2, '#fff8e0');
    rect(x + 1, y + 1, w - 2, 9, '#ffd23a');
    T('じゃんけん あいしょう', x + 6, y + 3, { c: '#5a3418' });
    T((J.p + 1) + '/' + JKT_N, x + w - 5, y + 3, { al: 'right', c: '#5a3418' });
    const bob = Math.floor(J.t * 4) % 2;
    if (J.p === 0) {
      T('ぬいもんには グー・チョキ・パー が あるよ', 80, y + 13, { al: 'center' });
      [['gu', 'グー'], ['choki', 'チョキ'], ['pa', 'パー']].forEach(([k, n], i) => { const bx = 28 + i * 40; jkBig(k, bx, y + 21); T(n, bx + 8, y + 39, { al: 'center', c: '#c0502a' }); });
      // mock HP bar with its badge
      const hx = 52, hy = y + 49;
      rect(hx, hy, 22, 4, '#3a2410'); rect(hx + 1, hy + 1, 16, 2, '#5ad04a'); drawJk('gu', hx + 23, hy - 2);
      drawPattern(['#...', '##..', '###.', '##..', '#...'], hx + 34, hy - 1 + bob, { '#': '#c0502a' });
      T('HPバーの よこに でるよ', hx + 40, hy - 1, { c: '#7a5a38' });
    } else if (J.p === 1) {
      T('じゃんけんで つよい ほうが かつよ', 80, y + 13, { al: 'center' });
      const seq = ['gu', 'choki', 'pa', 'gu'];
      seq.forEach((k, i) => { const bx = 22 + i * 32; jkBig(k, bx, y + 21); if (i < 3) T('▶', bx + 24, y + 25, { al: 'center', c: '#c0502a' }); });
      T('グー  ▶  チョキ  ▶  パー  ▶  グー', 80, y + 39, { al: 'center', c: '#7a5a38' });
      T('つよいと ダメージ 1.5ばい！', 80, y + 46, { al: 'center', c: '#e0302a' });
      T('よわいと はんぶん…', 80, y + 52, { al: 'center', c: '#3c6ad8' });
    } else {
      T('わざボタンの しるしを みてね', 80, y + 13, { al: 'center' });
      [[1, '#e0302a', 'つよい'], [-1, '#3c6ad8', 'よわい']].forEach(([u, col, lab], i) => {
        const bx = 36 + i * 64, by = y + 17;
        rect(bx, by, 24, 24, '#3a2410'); rect(bx + 2, by + 2, 20, 20, '#e88a4a');   // a わざボタン at 2x
        (u > 0 ? ['..#..', '.###.', '#####'] : ['#####', '.###.', '..#..']).forEach((row, r) => [...row].forEach((ch, q) => { if (ch === '#') rect(bx + 12 + q * 2, by + 2 + r * 2, 2, 2, col); }));
        T((u > 0 ? '▲' : '▼') + ' ' + lab, bx + 12, by + 26, { al: 'center', c: col });
      });
      T(inB ? 'したの わざボタンに でるよ' : 'たたかいの わざボタンに でるよ', 80, y + 50, { al: 'center', c: '#7a5a38' });
      if (inB) { const b = BTN[0]; drawPattern(['#######', '#yyyyy#', '.#yyy#.', '..#y#..', '...#...'], Math.round(b.x + b.w / 2 - 4), 68 + bob, { '#': '#5a1a1a', y: '#ffe24a' }); }
    }
    T(J.p < JKT_N - 1 ? (TOUCH ? 'タップ / けってい で つぎへ' : 'Enterで つぎへ') : (TOUCH ? 'タップで とじる' : 'Enterで とじる'), x + w - 5, y + h - 7, { al: 'right', size: 4, c: '#a08a60' });
  }
  function calcDmg(a, d, mv) { return Math.max(1, Math.round(mv.power * a.atk * (a._buff || 1) / (a.atk + d.def) * (0.85 + rand() * 0.3) * jkMul(a, d))); }
  // move side effects (せいぎぐん): buff = attack up for this battle (ファンファーレ), heal = recover part of max HP (にんじんスープ)
  function afterMove(att, mv) {
    if (!att || !mv || att.hp <= 0 || !G.battle) return;
    const B = G.battle, A = att === B.w ? B.w : comp;
    if (mv.buff) { att._buff = Math.min(1.6, (att._buff || 1) + mv.buff); banner(`${att.name}の こうげきが あがった！`, 1.4); burst(A.x, GROUND - 20, 'spark', 10, '#ff8a4a'); }
    if (mv.heal) { const v = Math.round(att.maxHp * mv.heal); att.hp = Math.min(att.maxHp, att.hp + v); pop(A.x, GROUND - 40, '+' + v, '#7aff8a'); banner(`${att.name}は げんきを とりもどした！`, 1.4); burst(A.x, GROUND - 16, 'spark', 10, '#7aff8a'); }
  }
  function recruitChance(e) {
    const base = SPECIES[e.sp].recruitBase + (G.cookie ? ITEMS.cookie.amt : 0);
    return clamp(base + TUNING.recruitHpWeight * (1 - e.hp / e.maxHp), TUNING.recruitMin, TUNING.recruitMax);
  }
  function runChance(a, e, tries) { return clamp(TUNING.runBase + (a.spd - e.spd) * TUNING.runSpdWeight + TUNING.runTryBonus * tries, 0.1, 0.95); }

  // ---------- input ----------
  const keys = new Set();
  const down = (...codes) => codes.some(c => keys.has(c));
  window.addEventListener('keydown', e => {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'Tab'].includes(e.code)) e.preventDefault();
    if (e.target && e.target.id === 'nameIn') return;
    if (e.repeat) return;
    keys.add(e.code);
    onKey(e.code);
  });
  window.addEventListener('keyup', e => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());

  function onKey(code) {
    if (G.tapGate) { gateGo(); return; }
    if (G.op) { if (performance.now() - (G.opSkipAt || 0) < 400) return; opEnd(); return; }
    if (G.jkTut) { jkTutKey(code); return; }
    if (G.hk) { hkKey(code); return; }
    if (G.state === 'title') {
      if (code === 'KeyN') { wipeSave(); startGame(false); return; }
      if (G.nameEdit) return;
      const ok = ['Enter', 'Space', 'NumpadEnter', 'Digit1'].includes(code);
      if (!G.titleScreen) { if (code === 'KeyO') { opStart(); return; } if (ok && !opBlock()) openSetup(); return; }
      if (['Escape', 'KeyX', 'Backspace'].includes(code)) { G.titleScreen = 0; SFX.blip(); return; }
      if (['ArrowUp', 'KeyW'].includes(code)) { G.titleRow = ((G.titleRow | 0) + SETUP_ROWS - 1) % SETUP_ROWS; G.wipeAsk = 0; SFX.blip(); return; }
      if (['ArrowDown', 'KeyS', 'Tab'].includes(code)) { G.titleRow = ((G.titleRow | 0) + 1) % SETUP_ROWS; G.wipeAsk = 0; SFX.blip(); return; }
      const d = (code === 'ArrowLeft' || code === 'KeyA') ? -1 : (code === 'ArrowRight' || code === 'KeyD') ? 1 : 0;
      if (d && G.titleRow === ROW.gender) { setHero(d, 0); return; }
      if (d && G.titleRow === ROW.color) { setHero(0, d); return; }
      if (ok) titleRowAction(G.titleRow | 0);
      return;
    }
    if (G.state === 'hub') { hubKey(code); return; }
    if (G.state === 'versus') { versusKey(code); return; }
    if (G.state === 'ending') { if (['Enter', 'NumpadEnter', 'Space', 'KeyE', 'KeyX', 'Escape'].includes(code)) endingSkip(); return; }
    if (G.state === 'netroom') { if (['Escape', 'KeyX', 'Backspace'].includes(code)) closeNet(); return; }
    if (code === 'KeyT') { G.waitMode = !G.waitMode; banner(G.waitMode ? 'WAITモード：えらぶ あいだ じかんが とまる' : 'ACTIVEモード：えらぶ あいだも あいては うごく', 1.6); return; }
    if (code === 'KeyM') {
      G.muted = !G.muted; persist(); SFX.setMuted(); SFX.start();
      banner(G.muted ? 'おと オフ' : 'おと オン', 1.1); return;
    }
    if (G.state === 'map') { mapKey(code); return; }
    if (G.state === 'talk') { if (['Enter', 'NumpadEnter', 'Space', 'KeyE', 'KeyX', 'Escape', 'ArrowDown', 'KeyS'].includes(code)) talkNext(); return; }
    if (G.state === 'menu') { menuKey(code); return; }
    if (G.state === 'field' && G.cs) { if (['Enter', 'NumpadEnter', 'Space', 'KeyE', 'KeyX', 'Escape', 'ArrowDown', 'KeyS'].includes(code)) csSkip(); return; }   // story scene: fast-forward
    if (G.state === 'field') {
      if (['Space', 'ArrowUp', 'KeyW'].includes(code)) jump(player, true);
      if (code === 'KeyC' || code === 'Tab') swapActive();
      if (['Enter', 'NumpadEnter', 'KeyE', 'ArrowDown', 'KeyS'].includes(code) && G.near) interact();
      if (code === 'KeyI') openBag();
      if (code === 'KeyH') { if (G.state === 'field') openHk(); return; }
      return;
    }
    if (G.state === 'battle') {
      const B = G.battle;
      if (tutOn()) {
        if (code === 'ArrowLeft' || code === 'KeyA' || code === 'Backspace') tutStep(-1);
        else if (code === 'Escape' || code === 'KeyX') { B.tut.i = TUT_STEPS.length - 1; tutStep(1); }
        else if (['Enter', 'Space', 'NumpadEnter', 'Tab', 'ArrowRight', 'ArrowDown', 'KeyD', 'KeyE'].includes(code)) tutStep(1);
        return;
      }
      if (B.phase === 'swap') {
        const n = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Numpad1: 0, Numpad2: 1, Numpad3: 2, Numpad4: 3 }[code];
        if (n != null) confirmSwap(n);
        if (code === 'Digit0' || code === 'Escape' || code === 'KeyX') cancelSwap();
        if (code === 'ArrowLeft' || code === 'KeyA') B.swapSel = (B.swapSel + G.party.length - 1) % G.party.length;
        if (code === 'ArrowRight' || code === 'KeyD') B.swapSel = (B.swapSel + 1) % G.party.length;
        if (code === 'Enter' || code === 'Space' || code === 'NumpadEnter') confirmSwap(B.swapSel);
        return;
      }
      if (B.phase === 'menu') { menuKey(code); return; }
      if (B.phase !== 'input') return;
      const NC = COMMANDS.length;
      const n = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Numpad1: 0, Numpad2: 1, Numpad3: 2, Numpad4: 3 }[code];
      if (n != null) { choose(n); return; }
      const n2 = { Digit5: 4, Digit6: 5, Digit7: 6, Digit8: 7, Numpad5: 4, Numpad6: 5, Numpad7: 6, Numpad8: 7 }[code];
      if (n2 != null) { choose(n2); return; }
      if (code === 'ArrowLeft' || code === 'KeyA') B.sel = (B.sel + NC - 1) % NC;
      if (code === 'ArrowRight' || code === 'KeyD') B.sel = (B.sel + 1) % NC;
      if (['ArrowUp', 'ArrowDown', 'KeyW', 'KeyS', 'KeyQ', 'Tab'].includes(code)) { B.sel = (B.sel + 4) % NC; SFX.blip(); }
      if (code === 'Enter' || code === 'Space' || code === 'NumpadEnter') choose(B.sel);
    }
  }

  const MSGBOX = { x: 2, y: 72, w: 52, h: 17 };
  const NBTN = 8, BTN = [...Array(NBTN)].map((_, i) => ({ x: 54 + i * 13, y: 74, w: 12, h: 13 }));
    const cmdPage = () => 0;   // all 8 commands fit on one row now
  function logicalPos(e) { const r = view.getBoundingClientRect(); return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height]; }
  const inRect = (x, y, b) => b && x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h;
  function btnAt(x, y) { return BTN.findIndex(b => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h); }
  view.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    const [x, y] = logicalPos(e); const i = btnAt(x, y);
    G.hoverBtn = i;
    const active = G.state === 'battle' && G.battle.phase === 'input';
    if (active && i >= 0 && !tutOn()) G.battle.sel = cmdPage() * 4 + i;
    view.style.cursor = (active && i >= 0) || G.state === 'title' ? 'pointer' : 'default';
  });
  const titleTarget = e => G.state === 'title' && !G.nameEdit && !G.hk && !nameBox.contains(e.target) && !(e.target.closest && e.target.closest('.ctl'));
  // the gate opens on release (iOS only unlocks audio on touchend / click); swallow the press so nothing underneath reacts
  window.addEventListener('pointerdown', e => { if (G.tapGate) { e.stopImmediatePropagation(); if (e.cancelable) e.preventDefault(); } }, true);
  for (const ev of ['pointerup', 'touchend', 'click']) window.addEventListener(ev, e => { if (G.tapGate) { SFX.unlock(); gateGo(); e.stopImmediatePropagation(); } }, true);
  window.addEventListener('pointerdown', e => { if (G.jkTut && !(e.target.closest && e.target.closest('.ctl'))) { jkTutStep(1); e.stopImmediatePropagation(); if (e.cancelable) e.preventDefault(); } }, true);   // あいしょう pages: tap = next
  window.addEventListener('pointerdown', e => { if (G.op) { opEnd(); e.stopImmediatePropagation(); if (e.cancelable) e.preventDefault(); } }, true);   // any tap skips the opening
  window.addEventListener('pointerdown', e => {
    if (!titleTarget(e) || !G.titleScreen) return;
    const [x, y] = logicalPos(e), row = setupRowAt(x, y);
    if (row < 0) return;
    if (row !== G.titleRow) G.wipeAsk = 0;
    G.titleRow = row;
    const d = x < SETUP.x + SETUP.w / 2 ? -1 : 1;
    if (row === ROW.gender) setHero(d, 0); else if (row === ROW.color) setHero(0, d);
  });
  // other rows act on release (phone keyboards need a finished tap to focus the name box)
  window.addEventListener('pointerup', e => {
    if (!titleTarget(e) || opBlock()) return;
    if (!G.titleScreen) { const [x, y] = logicalPos(e); if (opChipHit(x, y)) opStart(); else openSetup(); return; }
    const [x, y] = logicalPos(e), row = setupRowAt(x, y);
    if (row >= 0 && row !== ROW.gender && row !== ROW.color) titleRowAction(row);
  });
  view.addEventListener('pointerdown', e => {
    if (G.state === 'title') return;
    e.preventDefault();
    if (G.state === 'field' && G.cs) { csSkip(); return; }
    const [x, y] = logicalPos(e);
    if (G.state === 'hub') { hubTap(x, y); return; }
    if (G.state === 'map' && x < 26 && y < 11) { openHub(); return; }   // ホーム chip on the map
    if (G.state === 'versus') { versusTap(x, y); return; }
    if (G.state === 'netroom') { if (y > 56) closeNet(); return; }
    if (G.state === 'ending') { endingSkip(); return; }
    if (G.chip && inRect(x, y, G.chip)) { onKey('KeyT'); return; }
    if (G.state === 'talk') { talkNext(); return; }
    if (G.state === 'battle' && tutOn()) { tutStep(1); return; }
    if (G.state === 'menu' || (G.state === 'battle' && G.battle && G.battle.phase === 'menu')) { menuTap(x, y); return; }
    if (G.state === 'field' && inRect(x, y, MSGBOX)) { if (G.near) interact(); else openBag(); return; }
    const i = btnAt(x, y);
    if (G.state === 'battle' && G.battle && G.battle.phase === 'swap') {
      if (i >= 0 && i < G.party.length) confirmSwap(i);
      return;
    }
    if (i >= 0 && G.state === 'battle' && G.battle.phase === 'input') choose(cmdPage() * 4 + i);
  });

  // ---------- field ----------
  function startGame(fromSave) {
    G.op = null;
    SFX.start();
    if (G.state !== 'title') return;
    const s = fromSave ? readSave() : null;
    G.box = [];
    if (s && Array.isArray(s.party) && s.party.length) {
      G.party = s.party.filter(m => SPECIES[m.sp]).map(m => newMember(m.sp, m.hp, {
        maxHp: m.maxHp, atk: m.atk, def: m.def, spd: m.spd, lv: capLv(m.lv), xp: m.xp || 0, crown: m.crown && m.sp === 'oguri' ? 1 : 0, evo: m.evo && !SPECIES[m.sp].noEvo ? 1 : 0, name: m.evo && m.name && !SPECIES[m.sp].noEvo ? m.name : SPECIES[m.sp].name,
      }));
      if (!G.party.length) G.party = [newMember('goririn')];
      G.box = (Array.isArray(s.box) ? s.box : []).filter(m => SPECIES[m.sp]).map(m => newMember(m.sp, m.hp, {
        maxHp: m.maxHp, atk: m.atk, def: m.def, spd: m.spd, lv: capLv(m.lv), xp: m.xp || 0, crown: m.crown && m.sp === 'oguri' ? 1 : 0, evo: m.evo && !SPECIES[m.sp].noEvo ? 1 : 0, name: m.evo && m.name && !SPECIES[m.sp].noEvo ? m.name : SPECIES[m.sp].name,
      }));
      G.active = Math.max(0, Math.min(s.active | 0, G.party.length - 1));
      G.unlocked = Math.max(1, s.unlocked | 0);
      G.cleared = Array.isArray(s.cleared) ? s.cleared.slice() : [];
      // v2 saves (town briefly sat at map index 2): drop that slot so the field stages line up again
      if ((s.v | 0) === 2 && G.unlocked >= 3) G.unlocked -= 1;
      G.unl = [G.unlocked, s.unlocked2 | 0];
      if (Array.isArray(s.unlocks)) { G.unl = s.unlocks.map(v => v | 0); G.unl[0] = Math.max(1, G.unl[0]); G.unlocked = G.unl[0]; }
      while (G.unl.length < MAP_WORLDS.length) G.unl.push(0);
      // saves from before world 3: already beat しょうこ -> open あくの しろ
      { const oi = STAGES.findIndex(st => st.id === 'oshiro'); if (oi >= 0 && G.cleared.includes(oi) && !(G.unl[2] > 0)) G.unl[2] = 1; }
      { const si = STAGES.findIndex(st => st.id === 'shironaka'), n3 = MAP_W3.findIndex(n => n.stage === si); if (si >= 0 && G.cleared.includes(si) && (G.unl[2] | 0) < n3 + 2) G.unl[2] = n3 + 2; }
      G.solo = null;
      G.world = 0; MAP_NODES = MAP_WORLDS[0];
      G.coins = s.coins != null ? s.coins | 0 : 50;
      G.items = s.items && typeof s.items === 'object' ? Object.assign({}, s.items) : {};
      G.beaten = Array.isArray(s.beaten) ? s.beaten.slice() : [];
      G.got = s.got && typeof s.got === 'object' ? Object.assign({}, s.got) : {};
      G.flags = s.flags && typeof s.flags === 'object' ? Object.assign({}, s.flags) : {};
      G.cookie = !!s.cookie;
      if (s.muted != null) G.muted = !!s.muted;
      const i = Math.max(0, Math.min(s.stage | 0, STAGES.length - 1));
      enterStage(i, { heal: false, startX: s.px });
      if (!G.flags.tut || G.forceTut) G.tutWait = 2.5;
      return;
    }
    G.state = 'field';
    if (!G.flags.tut || G.forceTut) G.tutWait = 2.5;
    G.wilds[0].toHome = true;   // the title-screen Oguri trots off to its spot
    banner(STAGES[0].name, 2.2);
    persist();
  }
  // ---------- stages / world map ----------
  // さいごの はしり: only オグリキャップ comes along (party stashed in G.solo; saves always write the stashed party)
  const ownedOguri = () => G.party.find(m => m.sp === 'oguri') || (G.box || []).find(m => m.sp === 'oguri') || null;
  function startSolo() {
    if (G.solo) return true;
    const o = ownedOguri(); if (!o) return false;
    G.solo = { party: G.party, active: G.active }; G.party = [o]; G.active = 0;
    return true;
  }
  function endSolo() {
    if (!G.solo) return;
    G.party = G.solo.party; G.active = Math.min(G.solo.active, G.party.length - 1); G.solo = null;
    comp.key = compKey();
  }
  function enterStage(i, opts) {
    const st = STAGES[i];
    if (st.soloOguri) startSolo(); else endSolo();
    const heal = !opts || opts.heal !== false;
    G.stage = i; WORLD_W = st.width; G.fought = [];
    { const wi = worldOf(i); if (wi >= 0 && wi !== (G.world | 0)) setWorld(wi); }
    if (st.layers) loadLayers(st);
    G.bg = G.bgCache[st.id] || (G.bgCache[st.id] = BG.build(st.width, st.theme, st.theme === 'town' && PROPS.town_road ? Object.assign({}, PROPS, { road: PROPS.town_road }) : EVBG[st.id] ? Object.assign({}, PROPS, { full: EVBG[st.id] }) : PROPS));
    spawnWilds();
    const oiN = STAGES.findIndex(x => x.id === 'oshiro'), peaceN = oiN >= 0 && G.cleared.includes(oiN);
    const shN = STAGES.findIndex(x => x.id === 'shironaka'), calm = shN >= 0 && G.cleared.includes(shN);
    const SHOW = { minaHome: () => G.flags.cs_snatch && calm, mama: () => true, kotaHome: () => G.flags.cs_kota };
    G.npcs = (st.npcs || []).filter(n => (n.req !== 'peace' || peaceN) && (!n.show || SHOW[n.show]())).map(n => {
      const d = n.rival ? Object.assign({}, n, n.rival[(G.gender | 0) === 1 ? 'boy' : 'girl'], { name: 'ライバルの ' + rName() }) : n;
      return Object.assign(newActor(n.x, -1, d.look === 'player' ? 'player' : 'npc_' + d.look), { def: d });
    });
    const AM = typeof RIVAL_STORY !== 'undefined' && RIVAL_STORY.ambush[st.id];
    if (AM && !G.flags['rv_' + st.id] && !G.ev && !G.friend && !G.versus)   // ライバル ambush (one-time): waits near the stage start
      G.npcs.push(rivalActor(AM.x, { id: 'rv_' + st.id, ambush: true, battle: { style: 'fast', team: AM.team, reward: AM.reward, noBoost: true }, lines: AM.before, after: AM.after }));
    csSetup(st);
    G.near = null; G.talk = null; G.menu = null;
    if (heal) for (const m of G.party) { m.hp = m.maxHp; m.st = 0; }
    else for (const m of G.party) m.st = 0;
    G.active = Math.max(0, G.party.findIndex(m => m.hp >= 1));
    if (G.active < 0) { G.party.forEach(m => m.hp = m.maxHp); G.active = 0; }
    comp.key = compKey();
    const sx = opts && opts.startX != null ? clamp(opts.startX, 20, WORLD_W - 20) : 40;
    Object.assign(player, { x: sx, face: 1, ox: 0, y: 0, vy: 0, moving: false });
    Object.assign(comp, { x: sx - 22, face: 1, ox: 0, y: 0, vy: 0, alpha: 1, moving: false });
    G.cam = G.camT = clamp(sx - 70, 0, Math.max(0, WORLD_W - W)); G.benchUsed = false; G.battle = null;
    G.state = 'field'; G.fade = 1; G.fadeSpeed = -2;
    G.invWait = st.id === 'shironaka' && G.flags.end_oyako && !G.flags.invaded && !G.friend && !G.versus ? 1.0 : 0;
    banner(st.soloOguri && G.solo ? st.name + '  オグリキャップだけで はしりぬけろ！' : st.name + '  セーブした', 1.8);
    persist();
  }
  const VS_LIST = Object.keys(SPECIES).filter(k => !SPECIES[k].boss);
  function startVersus() {
    SFX.start();
    const s = readSave();
    if (s && Array.isArray(s.party) && s.party.length) {
      G.party = s.party.filter(m => SPECIES[m.sp]).map(m => newMember(m.sp, m.hp != null ? m.hp : m.maxHp, {
        maxHp: m.maxHp, atk: m.atk, def: m.def, spd: m.spd, lv: capLv(m.lv), xp: m.xp || 0, crown: m.crown && m.sp === 'oguri' ? 1 : 0, evo: m.evo && !SPECIES[m.sp].noEvo ? 1 : 0, name: m.evo && m.name && !SPECIES[m.sp].noEvo ? m.name : SPECIES[m.sp].name,
      }));
    }
    if (!G.party.length) G.party = [newMember('goririn')];
    G.vs = { mine: Math.min(G.active || 0, G.party.length - 1), opp: 0, focus: 0, friend: false };
    G.state = 'versus';
    G.battle = null;
  }
  function versusKey(code) {
    const V = G.vs; if (!V) return;
    if (code === 'KeyO') { openNet(true); return; }
    if (code === 'KeyJ') { openNet(false); return; }
    if (code === 'Escape' || code === 'KeyN') { vsBack(); return; }
    if (code === 'KeyF') { V.friend = !V.friend; return; }
    if (code === 'ArrowDown' || code === 'KeyS') V.focus = 1;
    if (code === 'ArrowUp' || code === 'KeyW') V.focus = 0;
    if (code === 'Tab') V.focus = V.focus ? 0 : 1;
    const dir = (code === 'ArrowRight' || code === 'KeyD') ? 1 : (code === 'ArrowLeft' || code === 'KeyA') ? -1 : 0;
    if (dir) {
      if (V.focus === 0) V.mine = (V.mine + dir + G.party.length) % G.party.length;
      else V.opp = (V.opp + dir + VS_LIST.length) % VS_LIST.length;
    }
    if (['Enter', 'Space', 'NumpadEnter', 'Digit1'].includes(code)) launchVersus();
  }
  function versusTap(x, y) {
    const V = G.vs; if (!V) return;
    if (y < 30) { V.focus = 0; V.mine = (V.mine + 1) % G.party.length; }
    else if (y < 38) { V.focus = 1; V.opp = (V.opp + 1) % VS_LIST.length; }
    else if (y < 47) V.friend = !V.friend;
    else if (y < 62) { const b = VS_BTNS.find(b => x >= b.x && x < b.x + b.w); if (b) b.act(); }
    else if (y > 64) vsBack();
  }
  const VS_BTNS = [
    { x: 12, w: 42, label: 'はじめる', c: '#2a7a1a', act: () => launchVersus() },
    { x: 58, w: 44, label: 'へやを つくる', c: '#3c6ad8', act: () => openNet(true) },
    { x: 106, w: 42, label: 'へやに はいる', c: '#3c6ad8', act: () => openNet(false) },
  ];
  function closeNet() {
    try { if (NET.conn) { netSend({ t: 'bye' }); NET.conn.close(); } } catch (e) {}
    try { if (NET.peer) NET.peer.destroy(); } catch (e) {}
    NET.peer = NET.conn = null; NET.status = ''; G.netRole = null;
    G.state = 'versus'; SFX.blip();
  }
  function launchVersus() {
    const V = G.vs; if (!V) return;
    G.active = Math.min(V.mine, G.party.length - 1);
    vsPrep();
    const sp = VS_LIST[V.opp], net = G.netRole === 'host' && NET.opp;
    const team = net ? (Array.isArray(net.team) && net.team.length ? net.team.slice(0, TUNING.partyMax).map(vsMember) : [vsMember(net)]) : cpuTeam(sp);
    G.vsTeam = team; G.vsLead = net ? clamp(net.lead | 0, 0, team.length - 1) : 0;
    const w = vsActor(team[G.vsLead]);
    player.x = 32; comp.x = 58; player.face = 1; comp.face = 1;
    G.cam = G.camT = 0;
    G.versus = true;
    G.arena = rand() < 0.5 ? 'day' : 'night';
    G.friend = !!V.friend || G.netRole === 'host';
    if (G.netRole !== 'host') G.netRole = null;
    G.wilds.forEach(w => { w.alpha = 0; });
    G.state = 'field';
    startBattle(w);
  }

  // ---------- versus: full-party (up to partyMax) teams ----------
  // party HP is snapshotted before a match and restored after it, so versus never changes the saved field HP
  function vsPrep() { G.vsHp = G.party.map(m => m.hp); for (const m of G.party) { m.hp = m.maxHp; m.st = 0; m.guard = false; } }
  function vsRestore() { if (!G.vsHp) return; G.party.forEach((m, i) => { if (G.vsHp[i] != null) m.hp = Math.min(m.maxHp, G.vsHp[i]); }); G.vsHp = null; }
  // net payload: the whole party in party order (+ lead index), so swap / next indexes match on both peers
  function vsTeamMsg() { return G.party.slice(0, TUNING.partyMax).map(m => ({ sp: m.sp, name: m.name, lv: m.lv || 1, evo: m.evo ? 1 : 0, crown: m.crown ? 1 : 0, maxHp: m.maxHp, atk: m.atk, def: m.def, spd: m.spd })); }
  function vsMember(t) {
    t = t || {}; const sp = SPECIES[t.sp] && !SPECIES[t.sp].boss ? t.sp : 'goririn', d = SPECIES[sp], n = (v, f) => Math.max(1, Math.min(9999, Math.round(+v) || f));
    const hp = n(t.maxHp, d.hp);
    return { sp, name: String(t.name || d.name).slice(0, 12), lv: capLv(n(t.lv, 1)), evo: t.evo && !SPECIES[sp].noEvo ? 1 : 0, crown: t.crown && sp === 'oguri' ? 1 : 0, maxHp: hp, hp, atk: n(t.atk, d.atk), def: n(t.def, d.def), spd: n(t.spd, d.spd), st: 0 };
  }
  // vs CPU: the picked species leads, the rest are random; same size and levels as your party
  function cpuTeam(first) {
    const lvs = G.party.map(m => m.lv || 1).sort((a, b) => b - a), pool = VS_LIST.filter(k => k !== first), picks = [first];
    while (picks.length < Math.min(TUNING.partyMax, G.party.length) && pool.length) picks.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    return picks.map((sp, i) => {
      const lv = lvs[i] || lvs[0] || 1, eo = SPECIES[sp].evoOnly, ev = typeof EVOLVE !== 'undefined' && EVOLVE[sp];
      const m = trainerMember({ sp, lv: eo ? Math.max(lv, eo) : lv, evo: !!eo || !!(ev && lv >= ev.lv && SPR[ev.sprite]) });
      delete m.spUsed; m.st = 0; return m;
    });
  }
  function vsActor(m) {
    const w = Object.assign(newActor(110, -1, SPECIES[m.sp].sprite), m, { alive: true, home: 110, spawnX: 110, cool: false });
    w.key = memberKey(m); return w;
  }
  // make team member i the opponent's active plush (the old one's HP is written back)
  function oppSet(i) {
    const B = G.battle, e = B.w, T = B.oppTeam;
    if (T[B.oppIdx]) T[B.oppIdx].hp = Math.max(0, e.hp);
    B.oppIdx = i; const m = T[i];
    Object.assign(e, { sp: m.sp, name: m.name, lv: m.lv, evo: m.evo ? 1 : 0, crown: m.crown ? 1 : 0, maxHp: m.maxHp, hp: m.hp, atk: m.atk, def: m.def, spd: m.spd, guard: false, spUsed: false, spSuper: false });
    e.key = memberKey(m);
  }
  function* oppSwapAction(i) {
    const B = G.battle, e = B.w, st = Math.max(0, e.st - COST.swap);
    B.msg = `もどれ ${e.name}！`; banner(B.msg, 1.0);
    yield* tween(v => e.alpha = v, 1, 0, 0.25);
    burst(e.x, GROUND - 12, 'spark', 8, '#ffffff');
    oppSet(i); e.st = st;
    yield* wait(0.25);
    B.msg = `いけっ ${e.name}！`; banner(B.msg, 1.2); SFX.blip();
    yield* tween(v => e.alpha = v, 0, 1, 0.25);
    burst(e.x, GROUND - 14, 'spark', 10, '#ff9ac8');
    yield* wait(0.4);
  }
  // after your plush fainted in versus: the one picked in the (forced) いれかえ menu comes out
  function* sendInAction(i) {
    const B = G.battle, n = G.party[i];
    G.active = i; comp.key = compKey(); n.st = 0; n.guard = false;
    B.msg = `いけっ ${n.name}！`; banner(B.msg, 1.2); SFX.blip();
    yield* tween(v => comp.alpha = v, 0, 1, 0.25);
    burst(comp.x, GROUND - 14, 'spark', 10, '#ffe24a');
    yield* wait(0.5);
    B.phase = 'run'; B.msg = '';
  }
  const NET = { peer: null, conn: null, code: '', status: '' };
  function netSend(msg) { try { if (NET.conn && NET.conn.open) NET.conn.send(msg); } catch (e) {} }
  function netCode() { return Math.random().toString(36).slice(2, 6); }
  function onNet(msg) {
    if (!msg || !msg.t) return;
    if (msg.t === 'pick') {
      NET.opp = msg;
      NET.status = msg.name + ' が きた';
      if (G.netRole === 'host' && NET.mine) beginNetBattle();
    } else if (msg.t === 'start') {
      NET.opp = msg;
      G.netRole = 'guest';
      G.friend = true;
      G.versus = true;
      G.active = clamp(NET.mine && NET.mine.lead | 0, 0, G.party.length - 1);
      vsPrep();
      const team = Array.isArray(msg.team) && msg.team.length ? msg.team.slice(0, TUNING.partyMax).map(vsMember) : [vsMember(msg)];
      G.vsTeam = team; G.vsLead = clamp(msg.lead | 0, 0, team.length - 1);
      const w = vsActor(team[G.vsLead]);
      player.x = 32; comp.x = 58; G.cam = G.camT = 0;
      G.arena = msg.arena === 'night' ? 'night' : 'day';
      G.wilds.forEach(a => { a.alpha = 0; });
      G.state = 'field';
      startBattle(w);
    } else if (G.netRole === 'host' && ['cmd', 'swap', 'next', 'rejoin'].includes(msg.t)) {
      // guest requests: accepted only on the guest's turn; anything else just gets a fresh snapshot back
      const B = G.battle, ok = B && B.oppTeam && B.phase === 'input' && B.who === 'opp';
      if (msg.t === 'cmd' && ok) { const ci = COMMANDS.findIndex(c => c.kind === msg.kind); if (ci >= 0 && !['swap', 'recruit', 'run', 'item'].includes(msg.kind)) choose(ci, true); }
      else if (msg.t === 'swap' && ok) {
        const i = msg.i | 0, m = B.oppTeam[i];
        if (m && i !== B.oppIdx && m.hp >= 1) { netEv({ k: 'swap', side: 'g' }); B.phase = 'run'; B.q.push(oppSwapAction(i)); }
      } else if (msg.t === 'next' && B && B.oppTeam && B.w.hp < 1) B.oppNext = msg.i | 0;   // consumed by enemyFaint
      if (msg.t === 'rejoin' && NET.paused) netResume();
      NET.lastKey = '';   // resend state now
    } else if (G.netRole === 'guest' && msg.t === 'st') {
      if ((msg.seq | 0) <= (NET.rseq | 0)) return;   // stale / out of order
      NET.rseq = msg.seq | 0;
      if (NET.paused) netResume();
      guestApply(msg);
    } else if (G.netRole === 'guest' && msg.t === 'ev') {
      if ((msg.seq | 0) <= (NET.rseq | 0)) return;
      NET.rseq = msg.seq | 0;
      guestEv(msg);
    } else if (msg.t === 'bye') {
      banner('あいてが きれた', 1.6);
    }
  }

  // ---------- online versus: host-authoritative ----------
  // the host runs the only simulation (its own RNG) and streams numbered state snapshots ('st') + action events ('ev');
  // the guest never simulates: it renders the snapshots, and sends requests (cmd / swap / next) on its own turn only.
  function netEv(ev) { if (G.netRole === 'host') netSend(Object.assign({ t: 'ev', seq: ++NET.seq }, ev)); }
  function hostState() {
    const B = G.battle, T = B.oppTeam;
    const pickG = B.w.hp < 1 && T.some((m, i) => i !== B.oppIdx && m.hp >= 1) && B.phase !== 'end' && B.phase !== 'done';
    const inp = B.phase === 'input' || B.phase === 'menu';
    return {
      turn: pickG ? 'pg' : inp ? (B.who === 'opp' ? 'g' : 'h') : null,
      hi: G.active, hh: G.party.map(m => Math.max(0, Math.round(m.hp))),
      gi: B.oppIdx, gh: T.map((m, i) => Math.max(0, Math.round(i === B.oppIdx ? B.w.hp : m.hp))),
      hb: B.bond | 0, gb: B.obond | 0, hg: ally().guard ? 1 : 0, gg: B.w.guard ? 1 : 0,
      ban: G.banner ? G.banner.text : '', res: B.phase === 'end' || B.phase === 'done' ? B.result : null,
    };
  }
  function netHostTick(force) {
    const B = G.battle; if (G.netRole !== 'host' || !G.versus || !B || !B.oppTeam || NET.paused) return;
    const s = hostState(), key = JSON.stringify(s), now = performance.now();
    if (!force && key === NET.lastKey && now - NET.lastSent < 250) return;   // 4/s keepalive carries stamina + acts as checksum
    NET.lastKey = key; NET.lastSent = now;
    netSend(Object.assign({ t: 'st', seq: ++NET.seq, hs: Math.round(ally().st), gs: Math.round(B.w.st) }, s));
  }
  function netHitFx(act, dmg) { act.flash = 0.3; act.shake = 0.5; pop(act.x, GROUND - 38, dmg, '#ffdf3a'); SFX.hit('attack'); }
  function guestApply(s) {
    const B = G.battle; if (!B || !B.oppTeam || B.phase === 'done') return;
    if (B.phase === 'intro' || B.cur) { NET.pend = s; return; }   // finish the intro / current animation first
    const T = B.oppTeam, e = B.w;
    // host's side = opponent here
    if (T[s.hi] && s.hi !== B.oppIdx) { T.forEach((m, i) => { if (s.hh[i] != null) m.hp = s.hh[i]; }); oppSet(s.hi); e.alpha = 1; burst(e.x, GROUND - 14, 'spark', 10, '#ff9ac8'); }
    const pe = e.hp;
    T.forEach((m, i) => { if (i !== B.oppIdx && s.hh[i] != null) m.hp = s.hh[i]; });
    if (s.hh[B.oppIdx] != null) e.hp = s.hh[B.oppIdx];
    if (s.hs != null) e.st = s.hs;
    if (e.hp < pe) netHitFx(e, pe - e.hp);
    // guest's own side
    if (G.party[s.gi] && s.gi !== G.active) { G.active = s.gi; comp.key = compKey(); comp.alpha = 1; burst(comp.x, GROUND - 14, 'spark', 10, '#ffe24a'); }
    const a = ally(), pa = a.hp;
    G.party.forEach((m, i) => { if (s.gh[i] != null) m.hp = s.gh[i]; });
    if (s.gs != null) a.st = s.gs;
    if (s.gb != null) { B.bond = s.gb; B.obond = s.hb; a.guard = !!s.gg; e.guard = !!s.hg; }
    if (a.hp < pa) netHitFx(comp, pa - a.hp);
    e.alpha = e.hp >= 1 ? 1 : 0.25; comp.alpha = a.hp >= 1 ? 1 : 0.25;
    if (s.ban && s.ban !== NET.lastBan) banner(guestBan(s.ban), 1.6);
    NET.lastBan = s.ban;
    if (s.res) { G.menu = null; B.result = s.res === 'win' ? 'lose' : s.res === 'lose' ? 'win' : null; B.phase = 'end'; B.q.push((function* () { yield* wait(1.4); endBattle(); })()); return; }
    const recent = performance.now() - (NET.sentAt || 0) < 2500;   // our request is in flight
    if (s.turn === 'pg') {
      if (!(G.menu && G.menu.forced) && !recent) { B.phase = 'menu'; B.who = 'me'; G.menu = { kind: 'bswap', sel: Math.max(0, G.party.findIndex(m => m.hp >= 1)), forced: true }; }
      return;
    }
    if (G.menu && G.menu.forced) G.menu = null;
    if (s.turn === 'g') { if (B.phase !== 'menu' && !recent) { B.phase = 'input'; B.who = 'me'; } }
    else { if (B.phase === 'menu') G.menu = null; B.phase = s.turn === 'h' ? 'input' : 'run'; B.who = s.turn === 'h' ? 'opp' : null; NET.sentAt = 0; }
  }
  // host banners are written from the host's side: flip あいて / いけっ for the guest
  function guestBan(t) {
    const on = G.battle && G.battle.w.name;
    if (t.startsWith('あいての ')) return t.slice(5);
    if (t.startsWith('あいては ')) return t.slice(5);
    if (t.startsWith('いけっ ')) return 'あいては ' + t.slice(4).replace(/！$/, '') + 'を くりだした！';
    if (on && (t.startsWith(on + 'の ') || t.startsWith(on + 'は '))) return 'あいての ' + t;
    return t;
  }
  function guestEv(ev) {
    const B = G.battle; if (!B) return;
    if (ev.k === 'act') {
      const at = ev.side === 'h' ? B.w : comp, d = Math.sign((ev.side === 'h' ? comp.x : B.w.x) - at.x) || 1;
      B.q.push((function* () { yield* tween(v => at.ox = v, 0, d * 8, 0.12); yield* tween(v => at.ox = v, d * 8, 0, 0.15); })());
    }
  }
  function guestTick() {
    const B = G.battle;
    if (NET.pend && B.phase !== 'intro' && !B.cur && !B.q.length) { const s = NET.pend; NET.pend = null; guestApply(s); }
  }
  // ---------- reconnect (mid-match drop / phone sleep): pause, retry ~60s, host re-sends a full snapshot ----------
  function netPause() {
    if (!G.versus || !G.battle || !G.netRole || NET.paused) return;
    NET.paused = { t: 0, try: 0 };
    banner('つうしんが きれた… つなぎなおしちゅう', 3);
  }
  function netResume() { NET.paused = null; NET.lastKey = ''; banner('つながった！', 1.2); netHostTick(true); }
  function netPausedTick(dt) {
    const P = NET.paused; P.t += dt;
    if (!G.banner || G.banner.t < 0.3) banner('つうしんが きれた… つなぎなおしちゅう', 1.5);
    if (P.t > 60) { NET.paused = null; banner('あいてとの つうしんが きれた', 2.5); const B = G.battle; B.result = null; B.phase = 'end'; endBattle(); return; }
    if (P.t < P.try * 3) return;
    P.try++;
    const p = NET.peer; if (!p || p.destroyed) return;
    if (p.disconnected) { try { p.reconnect(); } catch (e) {} return; }
    if (G.netRole === 'guest' && NET.code && !(NET.conn && NET.conn.open)) {
      try {
        const c = p.connect('nmg-' + NET.code);
        c.on('data', onNet);
        c.on('open', () => { if (NET.conn && NET.conn !== c) try { NET.conn.close(); } catch (e) {} NET.conn = c; netWatch(c); c.send({ t: 'rejoin' }); });
      } catch (e) {}
    }
  }
  function netWatch(c) {
    if (!c || c._nmWatch) return; c._nmWatch = 1;
    c.on('error', () => { if (G.state === 'netroom') NET.status = 'エラー: あいてと つながらなかった'; });
    c.on('close', () => {
      if (c !== NET.conn) return;   // an old connection replaced by a reconnect
      if (G.state === 'netroom') NET.status = 'あいてが いなくなった';
      else if (G.versus && G.battle) netPause();
      else banner('あいてとの つうしんが きれた', 2.5);
    });
  }
  for (const ev of ['visibilitychange', 'pageshow', 'focus']) window.addEventListener(ev, () => { if (!document.hidden) SFX.wake(); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden || !G.versus || !G.battle || !G.netRole) return;
    if (!(NET.conn && NET.conn.open) || (NET.peer && NET.peer.disconnected)) netPause();
    else if (G.netRole === 'guest') netSend({ t: 'rejoin' });   // woke up: ask for a fresh snapshot
  });
  function beginNetBattle() {
    const opp = NET.opp; if (!opp) return;
    const i = VS_LIST.indexOf(opp.sp);
    G.vs.opp = i >= 0 ? i : 0;
    G.vs.friend = true;
    G.netRole = 'host';
    launchVersus();
    netSend({ t: 'start', sp: G.party[G.active].sp, name: ally().name, g: G.gender | 0, c: G.hcolor | 0, arena: G.arena, team: vsTeamMsg(), lead: G.active });
  }
  function openNet(host) {
    if (typeof Peer === 'undefined') { banner('つうしんの よみこみに しっぱい', 2); return; }
    SFX.start();
    const mine = G.party[G.vs.mine] || G.party[0];
    NET.mine = { sp: mine.sp, name: mine.name, lead: G.party.indexOf(mine) };
    if (host) {
      NET.code = netCode();
      G.netRole = 'host';
      NET.status = 'へや ' + NET.code;
      NET.peer = new Peer('nmg-' + NET.code);
      NET.peer.on('connection', c => { if (G.versus && G.battle && NET.conn && NET.conn !== c) { try { NET.conn.close(); } catch (e) {} } NET.conn = c; c.on('data', onNet); netWatch(c); c.on('open', () => (G.versus && G.battle) ? (NET.paused && netResume()) : netSend({ t: 'pick', sp: mine.sp, name: mine.name, g: G.gender | 0, c: G.hcolor | 0, team: vsTeamMsg(), lead: NET.mine.lead })); });
    } else {
      const code = (window.prompt('あいての へやコード') || '').trim().toLowerCase();
      if (!code) return;
      G.netRole = 'guest'; NET.code = code;
      NET.status = code + ' に せつぞく中';
      NET.peer = new Peer();
      NET.peer.on('open', () => {
        NET.conn = NET.peer.connect('nmg-' + code);
        NET.conn.on('data', onNet);
        NET.conn.on('open', () => netSend({ t: 'pick', sp: mine.sp, name: mine.name, g: G.gender | 0, c: G.hcolor | 0, team: vsTeamMsg(), lead: NET.mine.lead }));
      });
    }
    // show why it failed instead of waiting forever
    const ERR = { 'peer-unavailable': 'へやが みつからない（コードを たしかめてね）', 'unavailable-id': 'へやコードが つかわれてる もういちど つくってね', network: 'つうしんが きれた', 'server-error': 'サーバーに つながらない', 'socket-error': 'サーバーに つながらない', 'browser-incompatible': 'この ブラウザでは つかえない', webrtc: 'あいてと つながらなかった' };
    NET.peer.on('error', err => { NET.status = 'エラー: ' + (ERR[err && err.type] || ((err && err.type) || 'ふめい')); banner(NET.status, 3); });
    NET.peer.on('disconnected', () => { if (G.state === 'netroom' && !NET.conn) NET.status = 'サーバーと きれた もういちど ためしてね'; else if (G.versus && G.battle) netPause(); });
    const watchConn = () => netWatch(NET.conn);
    NET.peer.on('connection', () => setTimeout(watchConn, 0));
    if (!host) NET.peer.on('open', () => setTimeout(watchConn, 0));
    const myPeer = NET.peer;
    setTimeout(() => { if (NET.peer === myPeer && G.state === 'netroom' && !host && !(NET.conn && NET.conn.open)) NET.status = 'エラー: 20びょう つながらない（モバイルどうしは つながらない ことがある）'; }, 20000);
    G.state = 'netroom';
  }

  // ---------- あくのしろ story scenes (CASTLE_STORY in data.js): one-time, tap / Enter fast-forwards the animated parts ----------
  // optional art (ドット絵作成くん), only loaded when embedded: kage.png 128x32 (4 flap frames, faces left), jail.png 96x48 (closed / open)
  const CS_ART = {};
  for (const [k, n, S] of [['kage', 4, 32], ['jail', 2, 48]]) if (typeof ASSET_DATA !== 'undefined' && ASSET_DATA['assets/story/' + k + '.png']) loadImg('assets/story/' + k + '.png').then(i => { CS_ART[k] = sheetFrames(i, n, S); }).catch(() => {});
  const CSD = () => typeof CASTLE_STORY !== 'undefined' ? CASTLE_STORY : {};
  const csTxt = p => p.map(pg => pg.map(l => l));
  function csSetup(st) {   // called from enterStage
    G.cs = null; G.csJail = null;
    if (G.ev || G.friend || G.versus || G.solo) return;
    const J = CSD().jail;
    if (J && st.id === J.stage && !G.flags[J.flag]) {
      const a = Object.assign(newActor(J.x, -1, 'npc_kota'), { def: { id: 'kota_cell', name: 'コウタ', talkable: true, onTalk: csJailTalk } });
      G.npcs.push(a); G.csJail = { a, open: 0 };
    }
  }
  function csTrigger() {
    if (G.cs || G.battle || G.talk) return false;
    const st = STAGES[G.stage], D = CSD();
    for (const k of ['snatch', 'merchant']) {
      const c = D[k]; if (!c || st.id !== c.stage || G.flags[c.flag] || player.x < c.at || G.ev || G.friend || G.versus || G.solo) continue;
      player.moving = false; comp.moving = false;
      if (k === 'snatch') {
        const X = Math.min(WORLD_W - 40, player.x + 56);
        const kid = Object.assign(newActor(X, -1, 'npc_child'), { def: { id: 'cs_mina', name: 'ミナ' } }); G.npcs.push(kid);
        G.cs = { k, ph: 0, t: 0, kid, sh: { x: X + 100, y: -60, vis: 0 }, plush: { x: X - 7, y: -14, held: 'kid' } };
      } else {
        const X = Math.min(WORLD_W - 20, player.x + 110);
        const m = Object.assign(newActor(X, -1, 'npc_merchant'), { def: { id: 'cs_merchant', name: 'たびの しょうにん' } }); G.npcs.push(m);
        G.cs = { k, ph: 0, t: 0, m };
      }
      G.camT = clamp(player.x + 30 - W / 2, 0, Math.max(0, WORLD_W - W));
      return true;
    }
    return false;
  }
  const csDone = c => { G.flags[CSD()[c.k].flag] = 1; persist(); };
  function csSkip() { const c = G.cs; if (c && c.dur) c.t = Math.max(c.t, c.dur); }   // jump to the end of the animated beat
  function csNext(c, ph, dur) { c.ph = ph; c.t = 0; c.dur = dur || 0; }
  function updateCS(dt) {
    const c = G.cs; c.t += dt; player.moving = false; comp.moving = false;
    const D = CSD()[c.k], bob = a => { a.bob = a.moving ? -Math.round(Math.abs(Math.sin(G.t * 14))) : 0; };
    if (c.k === 'snatch') {
      const kid = c.kid, sh = c.sh, p = c.plush;
      if (c.ph === 0) { if (!c.dur) c.dur = 0.8; kid.bob = -Math.round(Math.abs(Math.sin(c.t * 8)) * 2); if (c.t >= c.dur) { kid.bob = 0; csNext(c, 1); say('ミナ', D.hello, () => csNext(c, 2, 1.7)); } }
      else if (c.ph === 2) {   // swoop in (0–0.9 s), grab, fly off toward あくの しろ (right, 0.9–1.7 s)
        sh.vis = 1; const X = kid.x;
        if (c.t < 0.9) { const q = c.t / 0.9; sh.x = X + 100 - q * 104; sh.y = -60 + Math.sin(q * Math.PI / 2) * 44; }
        else { if (p.held !== 'sh') { p.held = 'sh'; kid.shake = 0.3; SFX.blip(); } const q = Math.min(1, (c.t - 0.9) / 0.8); sh.x = X - 4 + q * 140; sh.y = -16 - q * 56; }
        if (p.held === 'sh') { p.x = sh.x - 4; p.y = sh.y + 10; }
        if (c.t >= c.dur) { sh.vis = 0; p.held = null; kid.shake = 0; csNext(c, 3); say('ミナ', D.cry, () => say('', D.after, () => csNext(c, 4, 1.4))); }
      } else if (c.ph === 4) {   // ミナ runs home (left) crying
        kid.face = -1; kid.moving = true; kid.x -= 60 * dt; bob(kid); kid.alpha = Math.max(0, 1 - c.t / c.dur);
        if (c.t >= c.dur) { G.npcs = G.npcs.filter(a => a !== kid); G.cs = null; csDone(c); }
      }
    } else if (c.k === 'merchant') {
      const m = c.m;
      if (c.ph === 0) {   // runs in from the right, panting
        if (!c.dur) c.dur = 3; m.face = -1; m.moving = true; m.x -= 80 * dt; bob(m);
        if (m.x <= player.x + 26 || c.t >= c.dur) { m.x = Math.min(m.x, player.x + 26); m.moving = false; m.bob = 0; player.face = 1; csNext(c, 1); say('たびの しょうにん', D.lines, () => csNext(c, 2, 1.6)); }
      } else if (c.ph === 2) {   // and keeps running, back past the player
        m.face = -1; m.moving = true; m.x -= 95 * dt; bob(m); if (m.x < player.x) player.face = -1;
        m.alpha = m.x < G.cam - 10 ? 0 : 1;
        if (c.t >= c.dur || m.x < G.cam - 30) { G.npcs = G.npcs.filter(a => a !== m); G.cs = null; player.face = 1; csDone(c); }
      }
    } else if (c.k === 'jail') {   // cell opens, コウタ hops out, thanks, runs home
      const J = G.csJail, a = J.a;
      if (c.ph === 0) { if (!c.dur) c.dur = 0.9; J.open = Math.min(1, c.t / 0.6); a.y = c.t > 0.6 ? -Math.round(Math.sin(Math.min(1, (c.t - 0.6) / 0.3) * Math.PI) * 6) : 0;
        if (c.t >= c.dur) { J.open = 1; a.y = 0; banner('コウタを たすけだした！', 1.8); SFX.recruit(); csNext(c, 1); say('コウタ', D.free, () => csNext(c, 2, 1.5)); } }
      else if (c.ph === 2) { a.face = -1; a.moving = true; a.x -= 70 * dt; bob(a); a.alpha = Math.max(0, 1 - c.t / c.dur);
        if (c.t >= c.dur) { G.npcs = G.npcs.filter(x => x !== a); G.cs = null; } }
    }
  }
  function csJailTalk(a) {
    const D = CSD().jail; a.face = Math.sign(player.x - a.x) || -1;
    say('コウタ', D.help, () => { G.flags[D.flag] = 1; persist(); a.def.talkable = false; G.near = null; G.cs = { k: 'jail', ph: 0, t: 0 }; });
  }
  function drawKage(x, y, right) {   // くろい かげ: procedural dark cloaked silhouette (or kage.png), screen coords = top-left of 32x32
    const fl = Math.floor(G.t * 8) % 4;
    if (CS_ART.kage) { g.drawImage(CS_ART.kage[fl][right ? 'f' : 'n'], x, y); return; }   // art faces left
    const up = fl % 2 === 0, C = '#1a1024', E = '#3a2450';
    g.globalAlpha = 0.85;
    rect(x + 11, y + 8, 10, 14, C); rect(x + 10, y + 11, 12, 10, C); rect(x + 12, y + 6, 8, 3, C);   // hooded body
    rect(x + 12, y + 22, 2, 4, C); rect(x + 16, y + 22, 2, 5, C); rect(x + 19, y + 22, 2, 3, C);   // ragged cloak tail
    if (up) { rect(x + 2, y + 6, 9, 3, C); rect(x + 21, y + 6, 9, 3, C); rect(x + 4, y + 9, 7, 3, E); rect(x + 21, y + 9, 7, 3, E); rect(x + 1, y + 4, 3, 2, C); rect(x + 28, y + 4, 3, 2, C); }
    else { rect(x + 3, y + 12, 8, 3, C); rect(x + 21, y + 12, 8, 3, C); rect(x + 2, y + 15, 6, 3, E); rect(x + 24, y + 15, 6, 3, E); }
    g.globalAlpha = 1;
    rect(x + 13, y + 12, 2, 2, '#ffe24a'); rect(x + 17, y + 12, 2, 2, '#ffe24a');   // glowing eyes (no mouth: spooky, not scary)
  }
  function drawCsPlush(x, y, right) {   // ミナ's plush = ウサギン, real sprite at native size (32x32, feet on row 30); procedural bunny if the art is missing
    const s = SPR.usagin;
    if (s) { g.drawImage(right ? s.n : s.f, x, y); return; }
    x += 11; y += 20;
    rect(x + 2, y, 2, 4, '#ff9ac0'); rect(x + 5, y, 2, 4, '#ff9ac0'); rect(x + 1, y + 3, 7, 6, '#ff9ac0'); rect(x + 2, y + 9, 5, 1, '#ff9ac0');
    rect(x + 3, y + 1, 1, 2, '#ffd8e8'); rect(x + 3, y + 5, 1, 1, '#3a1a2a'); rect(x + 6, y + 5, 1, 1, '#3a1a2a'); rect(x + 4, y + 7, 2, 1, '#ff5a8a');
  }
  function drawCandy(x, y) {   // ふわふわキャンディ: 8x7 wrapped pink candy (procedural placeholder icon)
    rect(x, y + 2, 2, 3, '#ffd0e4'); rect(x + 6, y + 2, 2, 3, '#ffd0e4'); rect(x + 1, y + 1, 1, 1, '#ffd0e4'); rect(x + 6, y + 5, 1, 1, '#ffd0e4');
    rect(x + 2, y + 1, 4, 5, '#ff6aa8'); rect(x + 3, y, 2, 7, '#ff6aa8'); rect(x + 3, y + 2, 1, 2, '#fff'); rect(x + 4, y + 4, 1, 1, '#c8387a');
  }
  const JAIL_W = 40, JAIL_H = 40;
  function drawJail(cam, front) {   // しろの なか cell around コウタ: back wall behind him, bars in front (bars slide up when opened)
    const J = G.csJail; if (!J && !(G.flags.cs_kota && STAGES[G.stage].id === (CSD().jail || {}).stage)) return;
    const jx = (CSD().jail || {}).x, x = Math.round(jx - cam) - JAIL_W / 2, y = GROUND - JAIL_H + 1, open = J ? J.open : 1;
    if (x > W || x + JAIL_W < 0) return;
    if (!front) { rect(x, y, JAIL_W, JAIL_H, '#3a3448'); for (let r = 0; r < JAIL_H; r += 6) rect(x, y + r, JAIL_W, 1, '#2a2436'); for (let r = 0; r < JAIL_H; r += 12) for (let q = (r / 6) % 2 ? 6 : 0; q < JAIL_W; q += 12) rect(x + q, y + r, 1, 6, '#2a2436'); return; }
    if (CS_ART.jail) { g.drawImage(CS_ART.jail[open >= 1 ? 1 : 0].n, x - 4, GROUND - 47); return; }   // 48x48 closed / open, bottom row on the ground
    rect(x - 2, y - 3, JAIL_W + 4, 3, '#5a5468'); rect(x - 2, y - 3, JAIL_W + 4, 1, '#7a7488');   // lintel
    const lift = Math.round(open * (JAIL_H - 4));
    for (let q = 2; q < JAIL_W; q += 5) { rect(x + q, y, 2, JAIL_H - lift, '#8a8498'); rect(x + q, y, 1, JAIL_H - lift, '#b0aac0'); }
    rect(x, y + JAIL_H - lift - 3, JAIL_W, 2, '#8a8498'); rect(x, y + 10, JAIL_W, 2, lift > 30 ? 'rgba(0,0,0,0)' : '#8a8498');
    if (!open) { rect(x + JAIL_W - 9, y + 18, 5, 6, '#c8a040'); rect(x + JAIL_W - 8, y + 16, 3, 2, '#c8a040'); rect(x + JAIL_W - 7, y + 20, 1, 2, '#5a3a10'); }   // padlock
  }
  function drawCS(cam, front) {
    drawJail(cam, front);
    if (front) { const m = G.npcs.find(a => a.def && a.def.id === 'mina'); if (m) drawCsPlush(Math.round(m.x - cam) - 16 + (m.face > 0 ? 20 : -20), GROUND - 30 + Math.round(m.y), m.face > 0); }   // town: ウサギン back beside ミナ
    const c = G.cs; if (!front || !c || c.k !== 'snatch') return;
    const p = c.plush;
    if (p.held === 'kid') drawCsPlush(Math.round(c.kid.x - cam) - 16 + (c.kid.face > 0 ? 20 : -20), GROUND - 30 + Math.round(c.kid.y), c.kid.face > 0);   // standing at ミナ's feet
    else if (p.held === 'sh') drawCsPlush(Math.round(c.sh.x - cam) - 16, GROUND - 30 + Math.round(c.sh.y) + 4, true);   // dangling under the かげ (ears at its claws)
    if (c.sh.vis) drawKage(Math.round(c.sh.x - cam) - 16, GROUND - 30 + Math.round(c.sh.y), c.plush.held === 'sh');
  }
  // ---------- town: people, buildings, shop, items ----------
  function updateNear() {
    const st = STAGES[G.stage];
    G.near = null;
    if (!st.town) { for (const a of G.npcs) if (a.def.talkable && Math.abs(player.x - a.x) < 20) G.near = { type: 'npc', a }; return; }
    let bd = 1e9;
    for (const a of G.npcs) {
      const dx = player.x - a.x;
      if (Math.abs(dx) < 60) a.face = Math.sign(dx) || a.face;
      if (Math.abs(dx) < 18 && Math.abs(dx) < bd) { bd = Math.abs(dx); G.near = { type: 'npc', a }; }
    }
    for (const b of st.buildings || []) {
      const d = Math.abs(player.x - b.x);
      if (d < 12 && d < bd) { bd = d; G.near = { type: 'bld', b }; }
    }
  }
  const bagWord = () => TOUCH ? 'したの まどタップ' : 'Iキー';
  // ライバル wording: {RIVAL} = rival name, {g:…|b:…} = ユイ (girl) / ハルト (boy) version
  const rivalGirl = () => (G.gender | 0) !== 1;
  const rivalKey = () => rivalGirl() ? 'npc_girl' : 'player';
  const rvText = l => l.replace(/\{NAME\}/g, pName()).replace(/\{RIVAL\}/g, rName()).replace(/\{g:([^|}]*)\|b:([^}]*)\}/g, (_, a, b) => rivalGirl() ? a : b);
  function rivalActor(x, def) { return Object.assign(newActor(x, -1, rivalKey()), { def: Object.assign({ name: 'ライバルの ' + rName(), look: rivalGirl() ? 'girl' : 'player' }, def) }); }
  function say(name, pages, then) {
    G.talk = { name, pages: pages.map(p => p.map(l => rvText(l.replace('{BAG}', bagWord())))), i: 0, then };
    G.state = 'talk'; player.moving = false; comp.moving = false;
    SFX.blip();
  }
  // ---------- talk guests: a plush who speaks but isn't on screen steps in beside the player for the talk ----------
  const SP_BY_NAME = {}; for (const k in SPECIES) if (!SP_BY_NAME[SPECIES[k].name]) SP_BY_NAME[SPECIES[k].name] = k;
  function talkSpeaker(t) {
    const p = t.pages[t.i]; if (!p) return null;
    const m = /^([^「」\s…]+)「/.exec(p[0] || ''); const nm = m ? m[1] : t.name;
    return nm && SP_BY_NAME[nm] ? SP_BY_NAME[nm] : null;
  }
  function onScreen(sp) {
    const vis = a => a && a.alpha > 0 && Math.abs(a.x - (G.cam + W / 2)) < W / 2 + 4;
    if (G.state !== 'title' && ally() && ally().sp === sp && vis(comp)) return true;
    if (G.invader && G.invader.alive && G.invader.sp === sp && vis(G.invader)) return true;
    if ((G.talkGuests || []).some(a => a.sp === sp)) return true;
    return G.wilds.some(w => w.alive && (w.sp === sp || w.sp === sp + '_gold') && (vis(w) || Math.abs(w.x - player.x) < 140)) || (G.npcs || []).some(n => n.def && n.def.sp === sp && vis(n));
  }
  function guestKey(sp) {
    const own = G.party.concat(G.box || [], G.solo ? G.solo.party : []).find(m => m.sp === sp && (m.crown || sp !== 'oguri')) || G.party.concat(G.box || [], G.solo ? G.solo.party : []).find(m => m.sp === sp);
    if (own) return memberKey(own);
    if (sp === 'oguri' && G.flags.end_oyako && SPR.oguri_evo_crown) return 'oguri_evo_crown';
    return SPR[SPECIES[sp].sprite] ? SPECIES[sp].sprite : sp;
  }
  // ---------- invasion carrot staging (driven by the current talk page) ----------
  function updateInvFx(dt) {
    const F = G.invFx, u = G.invader; if (!F || !u) return;
    const p = G.state === 'talk' && G.talk ? G.talk.pages[G.talk.i].join('') : '';
    if (G.state === 'talk' && !G.battle) for (const a of [player, comp]) a.face = Math.sign(u.x - a.x) || a.face;   // everyone faces the せいぎぐん side
    if (p.includes('でんせつの にんじん')) F.gold = Math.max(F.gold, 1);
    if (p.includes('もぐもぐ')) { F.gold = 2; F.eat = Math.min(1, F.eat + dt / 1.2); }
    if (F.eat >= 1) F.glow = true;
    if (p.includes('ひきあげよ') && !F.soldiers) {   // せいぎぐん soldiers grab the pile
      F.pile = false; F.soldiers = [];
      for (let i = 0; i < 3; i++) {
        const x = clamp(u.x + [-34, -18, 16][i], G.cam + 8, G.cam + W - 8);
        const a = Object.assign(newActor(x, -1, SPR.usagihei ? 'usagihei' : 'usagin_evo'), { carrots: 2 + (i % 2) });
        F.soldiers.push(a); burst(x, GROUND - 12, 'spark', 6, '#ffffff');
      }
      u.carrots = 3;
    }
    if (p.includes('にげていった') && F.soldiers && !F.run) {
      F.run = true;
      for (const a of F.soldiers.concat([u])) { a.runV = 90 + rand() * 30; a.face = 1; }
    }
    for (const a of (F.soldiers || []).concat(F.run ? [u] : [])) {
      if (F.run) { a.x += (a.runV || 90) * dt; a.moving = true; a.face = 1; }
      animActor(a, dt);
    }
    if (F.run && u.x > G.cam + W + 40) u.alpha = 0;
    if (F.glow && rand() < dt * 10) burst(u.x + (rand() - 0.5) * 20, GROUND - 4 - rand() * 26, 'spark', 1, rand() < 0.5 ? '#ffe24a' : '#fff6b0');
    if (F.gold === 1 && rand() < dt * 8) burst(u.x - 14, GROUND - 22, 'spark', 1, '#ffe24a');
  }
  let GOLD_CARROT = null;
  function goldCarrot() {
    if (PROPS.gold_carrot) return PROPS.gold_carrot;   // real art
    if (GOLD_CARROT || !PROPS.item_carrot) return GOLD_CARROT;
    const im = PROPS.item_carrot, [c, cx] = mk(im.width, im.height);
    cx.drawImage(im, 0, 0); cx.globalCompositeOperation = 'source-atop'; cx.globalAlpha = 0.6; cx.fillStyle = '#ffd23a'; cx.fillRect(0, 0, im.width, im.height);
    return (GOLD_CARROT = c);
  }
  function drawCarrot(img, x, y, sc = 1) {
    if (!img) return; const w = Math.max(1, Math.round(img.width * sc)), h = Math.max(1, Math.round(img.height * sc));
    g.drawImage(img, Math.round(x - w / 2), Math.round(y - h / 2), w, h);
  }
  function drawInvFx(cam) {
    const F = G.invFx, u = G.invader; if (!F || !u || G.battle) return;
    const C = PROPS.item_carrot;
    if (F.pile && C) {   // the castle's carrot pile behind うさひめ
      const px = u.x - 30 - cam;
      [[0, 0], [8, 0], [16, 0], [4, -6], [12, -6], [8, -12]].forEach(([dx, dy]) => drawCarrot(C, px + dx, GROUND - 6 + dy, 0.75));
    }
    if (F.gold && F.eat < 1) {   // でんせつの にんじん at her mouth, shrinking while she eats
      const sc = 1 - F.eat, wob = F.eat > 0 ? Math.sin(G.t * 30) : 0;
      drawCarrot(goldCarrot(), u.x - 14 - cam + wob, GROUND - 20, sc * (PROPS.gold_carrot ? 0.6 : 1));
    }
    for (const a of (F.soldiers || [])) {
      drawActor(a, cam);
      for (let k = 0; k < a.carrots; k++) drawCarrot(C, a.x - cam - a.face * 6 + (k % 2 ? 2 : -2), GROUND - 20 - k * 5, 0.75);
    }
    if (u.carrots && u.alpha > 0) for (let k = 0; k < u.carrots; k++) drawCarrot(C, u.x - cam - u.face * 8 + (k % 2 ? 2 : -2), GROUND - 22 - k * 5, 0.75);
  }
  function updateTalkGuests(dt) {
    if (G.state === 'talk' && G.talk && !G.ending && !G.battle) {
      G.talkGuestT = 0.4;
      const sp = talkSpeaker(G.talk);
      if (sp && !onScreen(sp)) {
        const list = G.talkGuests || (G.talkGuests = []);
        // stand grounded, ~30px from everyone already there, inside the screen; prefer the side away from the partner
        const lo = G.cam + 14, hi = G.cam + W - 14;
        const taken = [player.x].concat(comp.alpha > 0 ? [comp.x] : [], list.map(a => a.x), G.invader && G.invader.alive ? [G.invader.x] : [], G.invFx && G.invFx.pile && G.invader ? [G.invader.x - 14] : [], G.wilds.filter(w => w.alive).map(w => w.x));
        const free = x => x >= lo && x <= hi && taken.every(t => Math.abs(t - x) >= 24);
        const pref = -(Math.sign(comp.x - player.x) || 1), cands = [];
        for (const sd of [pref, -pref]) for (let d = 30; d <= 110; d += 6) cands.push(player.x + sd * d);
        const x = cands.find(free) ?? clamp(player.x + pref * 30, lo, hi), side = Math.sign(x - player.x) || 1;
        const a = Object.assign(newActor(x, -side, guestKey(sp)), { sp, guest: true });
        list.push(a); burst(x, GROUND - 12, 'spark', 8, '#ffffff');
      }
    } else if (G.talkGuests && (G.talkGuestT -= dt) <= 0) G.talkGuests = null;
    // speakers face the player, except in a confrontation (invasion): then they face the enemy side
    const foe = G.invader && G.invFx ? G.invader : null;
    for (const a of G.talkGuests || []) { a.y = 0; a.vy = 0; a.face = Math.sign((foe ? foe.x : player.x) - a.x) || a.face; animActor(a, dt); }
    if (!foe && G.state === 'talk' && G.talkGuests && G.talkGuests.length) {   // the listener turns to the speaker
      const sp = talkSpeaker(G.talk), a = G.talkGuests.find(x => x.sp === sp);
      if (a) player.face = Math.sign(a.x - player.x) || player.face;
    }
  }
  function talkNext() {
    const t = G.talk; if (!t) { G.state = 'field'; return; }
    t.i++;
    SFX.blip();
    if (t.i < t.pages.length) return;
    G.talk = null; G.state = t.onMap ? 'map' : 'field';
    if (t.then) t.then();
  }
  function interact() {
    const n = G.near; if (!n) return;
    if (n.type === 'npc') {
      const d = n.a.def;
      if (d.onTalk) { d.onTalk(n.a); return; }
      // town trainers: one battle per visit; leaving and re-entering the stage allows a rematch (half coins)
      // town mood: after しょうこ is beaten everyone fears あくの しろ (world 3); 'peace' lines are for after it is cleared
      const cl = id => { const k = STAGES.findIndex(st => st.id === id); return k >= 0 && G.cleared.includes(k); };
      const mood = cl('shironaka') ? 'peace' : cl('oshiro') ? 'fear' : null;
      const lines = (d.home && G.flags.cs_kota && d.home) || (mood && d[mood]) || (mood && d.fear) || d.lines;   // コウタの おかあさん stays worried until he's home
      if (d.giftItem && d.home && G.flags.cs_kota && !G.flags.candyGift) { say(d.name, d.home.concat(d.gift), () => { G.flags.candyGift = 1; G.items[d.giftItem] = (G.items[d.giftItem] | 0) + 1; SFX.recruit(); banner(`${ITEMS[d.giftItem].name}を もらった！`, 2.0); persist(); }); return; }
      if (d.battle && !G.fought.includes(d.id)) say(d.name, G.beaten.includes(d.id) ? [['また しょうぶだ！']].concat(lines.slice(-1)) : lines, () => startTrainer(n.a));
      else say(d.name, (d.battle && d.after) || lines);
      return;
    }
    const b = n.b;
    if (b.k === 'shop') say(b.name, [['いらっしゃいませ！', 'ゆっくり みていってね']], openShop);
    else if (b.k === 'nuihouse') say(b.name, [['ぬいハウスへ ようこそ！', 'ぬいぐるみを あずかるよ'], ['てもちが いっぱいの とき', 'なかまに なった こも ここに くるよ']], openHouse);
    else if (b.k === 'clinic') say(b.name, [['いらっしゃい！', 'ぬいぐるみたちを げんきに するわね']], () => {
      for (const m of G.party) m.hp = m.maxHp;
      burst(comp.x, GROUND - 14, 'spark', 12, '#ffffff'); SFX.level();
      banner('なかま みんな げんきに なった！', 2.0); persist();
    });
    else if (b.k === 'house') {
      if (!G.flags.grandmaGift) say(b.name, [['あら いらっしゃい', 'とおくから よく きたねえ'], ['これ もっていきなさい', '']], () => {
        G.flags.grandmaGift = true; G.items.kizu = (G.items.kizu || 0) + 2;
        SFX.buy(); banner('きずぐすりを 2こ もらった！', 2.0); persist();
      });
      else say(b.name, [['ぬいぐるみと なかよくね', 'つかれたら また おいで']]);
    }
  }
  // a trainer's plush at a given level: same growth as ours (grantXp), times an optional multiplier
  function trainerMember(t) {
    const m = newMember(t.sp), lv = capLv(t.lv), mul = t.mul || 1, style = t.style;
    for (let l = 2; l <= lv; l++) { m.maxHp += 4; m.atk += 1; m.def += 1; if (l % 2 === 0) m.spd += 1; }
    m.maxHp = Math.round(m.maxHp * mul); m.atk = Math.round(m.atk * mul); m.def = Math.round(m.def * mul);
    const ev = t.evo && !SPECIES[t.sp].noEvo && typeof EVOLVE !== 'undefined' && EVOLVE[t.sp];
    if (ev) { m.evo = 1; if (ev.name) m.name = ev.name; m.maxHp += ev.hp || 0; m.atk += ev.atk || 0; m.def += ev.def || 0; m.spd += ev.spd || 0; }
    if (style === 'fast') m.spd += 2;
    if (style === 'guard') m.def += 2;
    m.hp = m.maxHp; m.lv = lv; m.spUsed = false; m.spSuper = false;
    return m;
  }
  function startTrainer(a) {
    const d = a.def, bt = d.battle;
    // after あかつち谷 (world 2 open) every town trainer comes back a bit stronger: +lv, and lv10+ members evolve
    // after もりの おしろ: +townBoost2 lv and each trainer brings their extra plush too
    const oi = STAGES.findIndex(st => st.id === 'oshiro'), late = oi >= 0 && G.cleared.includes(oi);
    const boost = !bt.noBoost && G.world === 0 && G.unl && G.unl[1] > 0 ? (late ? (TUNING.townBoost2 || 12) : (TUNING.townBoost || 6)) : 0;
    const base = (bt.team || [{ sp: bt.sp, lv: 1, mul: bt.mul }]);
    const team = (late && bt.extra ? base.slice(0, -1).concat(bt.extra, base.slice(-1)) : base).slice(0, TUNING.partyMax || 4).map(t => {
      if (!boost) return t;
      const lv = Math.min((TUNING && TUNING.maxLv) || 30, (t.lv || 1) + boost);
      return Object.assign({}, t, { lv: SPECIES[t.sp].evoOnly ? Math.max(lv, SPECIES[t.sp].evoOnly) : lv, evo: t.evo || SPECIES[t.sp].evoOnly || (lv >= 10 && EVOLVE[t.sp] ? 1 : 0) });
    });
    const first = team.shift(), m = trainerMember(Object.assign({ style: bt.style }, first));
    const side = Math.sign(a.x - player.x) || 1;
    const w = Object.assign(newActor(a.x, -side, memberKey(m)), m, {
      alive: true, home: a.x, spawnX: a.x, cool: false, wt: 1, wdir: 0, toHome: false,
      trainer: d.id, trainerName: d.name, style: bt.style, reward: boost ? Math.round(bt.reward * (late ? 2.5 : 1.5)) : bt.reward, team, teamTotal: team.length + 1,
    });
    burst(a.x, GROUND - 12, 'spark', 8, '#ffffff');
    startBattle(w);
    // the trainer steps back behind their plush, facing the player; walks home after the battle
    const B = G.battle;
    a.homeX = a.homeX != null ? a.homeX : a.x;
    a.tx = clamp(B.enemyTX + B.side * 22, 12, WORLD_W - 12); a.tface = -B.side;
    if (B.side > 0) a.tx = Math.min(a.tx, G.camT + W - 10); else a.tx = Math.max(a.tx, G.camT + 10);
    B.trainerActor = a;
  }
  function openShop() { G.menu = { kind: 'shop', sel: 0 }; G.state = 'menu'; }
  const pickKey = (st, pk, i) => st.id + ':' + (pk.id || i);   // G.got key (saved; cloud / ひきつぎ use the same save)
  function bagList() { return Object.keys(ITEMS).filter(k => (G.items[k] | 0) > 0); }
  function openBag() {
    if (G.state !== 'field') return;
    G.menu = { kind: 'bag', sel: 0 }; G.state = 'menu'; player.moving = false;
  }
  function menuRows() {
    const M = G.menu;
    if (M.kind === 'bswap') return swapList(M).map((m, i) => 'p' + i).concat(M.forced ? [] : ['_close']);
    if (M.kind === 'ask') return ['_yes', '_no'];
    if (M.kind === 'house') {
      const box = G.box || [];
      if (M.pi == null) return G.party.map((m, i) => 'p' + i).concat(G.party.length < TUNING.partyMax && box.length ? ['_take'] : [], ['_close']);
      return (M.pi > 0 ? ['_lead'].concat(M.pi > 1 ? ['_up'] : []) : []).concat(box.map((m, j) => 'b' + j), M.pi >= 0 && G.party.length > 1 ? ['_put'] : [], ['_back']);
    }
    if (M.kind === 'mapask') return ['_myes', '_mno'];
    return M.kind === 'shop' ? SHOP_LIST.concat(['_close']) : bagList().concat(canMapBack() ? ['_map', '_home'] : [], ['_hk', '_close']);
  }
  // いれかえ list: your party, or (local friend versus) the opponent's team with the active one's live HP
  function swapList(M) { const B = G.battle; return M && M.opp && B && B.oppTeam ? B.oppTeam.map((m, i) => i === B.oppIdx ? B.w : m) : G.party; }
  // in-stage menu: back to the world map (not in a battle / talk / solo run / story event)
  const canMapBack = () => G.menu && G.menu.kind === 'bag' && G.state === 'menu' && !G.battle && !G.talk && !G.solo && !G.invader && !G.ending && !G.friend && !G.versus;
  function closeMenu() {
    if (G.menu && G.menu.forced) return;   // a fainted plush must be replaced
    G.menu = null;
    if (G.state === 'battle' && G.battle) { if (G.battle.phase === 'menu') G.battle.phase = 'input'; return; }
    G.state = 'field';
  }
  function menuKey(code) {
    const M = G.menu; if (!M) { closeMenu(); return; }
    const rows = menuRows();
    if (code === 'ArrowUp' || code === 'KeyW') M.sel = (M.sel + rows.length - 1) % rows.length;
    if (code === 'ArrowDown' || code === 'KeyS') M.sel = (M.sel + 1) % rows.length;
    if (code === 'Escape' || code === 'KeyX' || code === 'Backspace' || (code === 'KeyI' && M.kind === 'bag')) closeMenu();
    if (['Enter', 'NumpadEnter', 'Space', 'KeyE'].includes(code)) menuPick();
  }
  function menuPick() {
    const M = G.menu, rows = menuRows(), k = rows[M.sel];
    if (k === '_close') { closeMenu(); return; }
    if (k === '_hk') { closeMenu(); openHk(); return; }
    if (k === '_map') { G.menu = { kind: 'mapask', sel: 1 }; SFX.blip(); return; }
    if (k === '_home') { G.menu = null; persist(); openHub(); return; }
    if (k === '_mno') { closeMenu(); return; }
    if (k === '_myes') { G.menu = null; persist(); openMap(Math.max(0, MAP_NODES.findIndex(n => n.stage === G.stage))); banner('マップに もどった', 1.4); return; }
    if (M.kind === 'bswap' || M.kind === 'bitem') { battleMenuPick(M, k); return; }
    if (M.kind === 'house') { housePick(M, k); return; }
    if (M.kind === 'ask') {
      const nm = SPECIES[M.sp].name;
      if (k === '_yes') {
        const eo = SPECIES[M.sp].evoOnly, m = trainerMember({ sp: M.sp, lv: eo ? Math.max(M.lv || 1, eo) : M.lv, evo: !!eo }); delete m.spUsed;
        G.flags['joined_' + M.sp] = 1;
        if (G.party.length < TUNING.partyMax) { G.party.push(m); banner(`${nm}が なかまに なった！`, 2.4); }
        else { (G.box = G.box || []).push(m); banner(`${nm}が なかまに なった！ ぬいハウスへ いったよ`, 2.6); }
        SFX.recruit(); persist();
      } else banner(`${nm}「${SPECIES[M.sp].declineLine || 'そう… また あいましょう'}」`, 2.0);
      closeMenu();
      if (k === '_yes' && M.sp === 'oguriking' && !endCrown()) playEnding('tochu', () => openMap(Math.max(0, MAP_NODES.findIndex(n => n.stage === G.stage))));
      return;
    }
    const it = ITEMS[k];
    if (M.kind === 'shop') {
      if ((G.items[k] | 0) >= 9) { banner('もう もちきれない', 1.2); return; }
      if (G.coins < it.price) { SFX.miss(); banner('コインが たりない…', 1.2); return; }
      G.coins -= it.price; G.items[k] = (G.items[k] | 0) + 1;
      SFX.buy(); banner(`${it.name}を かった！`, 1.2); persist();
      return;
    }
    // bag: use on the walking companion / party
    const a = ally();
    if (it.use === 'heal') {
      if (a.hp >= a.maxHp) { banner(`${a.name}は げんき いっぱい`, 1.2); return; }
      a.hp = Math.min(a.maxHp, a.hp + it.amt);
      burst(comp.x, GROUND - 14, 'spark', 8, '#9af07a'); banner(`${a.name}の HPが かいふくした！`, 1.4);
    } else if (it.use === 'healAll') {
      if (G.party.every(m => m.hp >= m.maxHp)) { banner('みんな げんき いっぱい', 1.2); return; }
      for (const m of G.party) m.hp = m.maxHp;
      burst(comp.x, GROUND - 14, 'spark', 12, '#9af07a'); banner('なかま みんな げんきに なった！', 1.6);
    } else if (it.use === 'recruit') {
      if (G.cookie) { banner('もう たべさせてある', 1.2); return; }
      G.cookie = true; banner('つぎの なかまにする が せいこう しやすい！', 1.8);
    } else if (it.use === 'lvup') {
      if (it.sps && !it.sps.includes(a.sp)) { SFX.miss(); banner(`${a.name}は たべられない… (${it.sps.map(s => SPECIES[s].name).join(' か ')} だけ)`, 2.0); return; }
      if ((a.lv || 1) >= MAX_LV) { banner(`${a.name}は もう これいじょう Lvが あがらない`, 1.6); return; }
      a.lv = (a.lv || 1) + 1; a.xp = 0; a.maxHp += 4; a.hp = Math.min(a.maxHp, a.hp + 4); a.atk += 1; a.def += 1; if (a.lv % 2 === 0) a.spd += 1;
      burst(comp.x, GROUND - 14, 'spark', 12, '#ff9a2a'); banner(`${a.name}は ${it.eat || 'にんじんを たべた'}！ レベル ${a.lv} に あがった！`, 2.0);
      G.items[k]--; if (G.items[k] <= 0) delete G.items[k];
      persist(); closeMenu(); SFX.level();
      G.fieldCo = (function* () { yield* wait(1.4); yield* tryEvolve(); persist(); })();   // normal Lv10 evolution
      return;
    }
    SFX.level();
    G.items[k]--; if (G.items[k] <= 0) delete G.items[k];
    persist();
    const left = menuRows();
    if (left.length <= 2) closeMenu(); else M.sel = Math.min(M.sel, left.length - 1);
  }
  // ぬいハウス: pick a party member, then a stored one to swap with (or あずける); _take pulls one into a free slot
  function openHouse() { G.menu = { kind: 'house', sel: 0, pi: null, top: 0 }; G.state = 'menu'; player.moving = false; }
  function housePick(M, k) {
    const box = G.box = G.box || [];
    if (k === '_back') { M.pi = null; M.sel = 0; M.top = 0; return; }
    if (M.pi == null) {
      if (k === '_take') { M.pi = -1; M.sel = 0; M.top = 0; return; }
      M.pi = +k.slice(1); M.sel = 0; M.top = 0; return;
    }
    const cur = G.party[G.active];
    if (k === '_lead' || k === '_up') {
      const [m] = G.party.splice(M.pi, 1), to = k === '_lead' ? 0 : M.pi - 1;
      G.party.splice(to, 0, m);
      if (k === '_lead') { G.active = 0; comp.key = compKey(); SFX.buy(); persist(); banner(`${m.name}を せんとうに した`, 1.4); M.pi = null; M.sel = 0; M.top = 0; return; }
      banner(`${m.name}を まえに した`, 1.4);
    } else if (k === '_put') {
      const [m] = G.party.splice(M.pi, 1); box.push(m);
      banner(`${m.name}を あずけた`, 1.4);
    } else {
      const j = +k.slice(1), b = box[j];
      if (M.pi < 0) { box.splice(j, 1); G.party.push(b); banner(`${b.name}を つれていく`, 1.4); }
      else { const m = G.party[M.pi]; G.party[M.pi] = b; box[j] = m; banner(`${m.name}と ${b.name}を いれかえた`, 1.4); }
    }
    G.active = Math.max(0, G.party.indexOf(cur));
    if (G.party[G.active] !== cur) G.active = 0;
    comp.key = compKey();
    SFX.buy(); persist();
    M.pi = null; M.sel = 0; M.top = 0;
  }
  const MENU = { x: 22, y: 12, w: 116, h: 58, row0: 24, rh: 7 };
  const MENU_ROWS = 5;   // rows visible at once (the list scrolls when longer)
  function menuTap(x, y) {
    const M = G.menu; if (!M) return;
    if (!inRect(x, y, MENU)) { closeMenu(); return; }
    const i = Math.floor((y - MENU.row0 + 1) / MENU.rh) + (M.top | 0), rows = menuRows();
    if (i < (M.top | 0) || i >= rows.length || i >= (M.top | 0) + MENU_ROWS) return;
    if (i === M.sel) menuPick(); else M.sel = i;
  }
  // two worlds share the map screen; G.unlocked is the shown world's count, G.unl keeps both
  function worldOf(stage) { return MAP_WORLDS.findIndex(w => w.some(n => n.stage === stage)); }
  function setWorld(w) {
    if (!G.unl) G.unl = [G.unlocked];
    while (G.unl.length < MAP_WORLDS.length) G.unl.push(0);
    G.unl[G.world | 0] = G.unlocked;
    G.world = w; MAP_NODES = MAP_WORLDS[w]; G.unlocked = Math.max(w ? 0 : 1, G.unl[w] | 0);
  }
  function clearStage() {
    if (G.ev) { evClear(); return; }   // イベント stage: rewards + back to the hub, no story progress
    const i = G.stage;
    let crownMsg = null;
    if (STAGES[i].soloOguri && G.solo && typeof CROWN !== 'undefined') {
      const o = G.party[0];
      if (o && o.sp === CROWN.sp && !o.crown) {
        o.crown = 1; for (const k of ['maxHp', 'atk', 'def', 'spd']) o[k] = Math.round(o[k] * CROWN.mult); o.hp = o.maxHp;
        crownMsg = `${o.name}は おうの かんむりを てにいれた！ つよさ アップ！ スタミナの たまりが はやく なった！`;
      }
      endSolo();
    }
    if (!G.cleared.includes(i)) G.cleared.push(i);
    const wi = Math.max(0, worldOf(i)); if (wi !== (G.world | 0)) setWorld(wi);
    const ni = MAP_NODES.findIndex(n => n.stage === i);
    G.unlocked = Math.max(G.unlocked, ni + 2);
    G.unl[G.world] = G.unlocked;
    // the last stage of world k opens world k+1
    const nw = G.world + 1;
    if (ni === MAP_NODES.length - 1 && nw < MAP_WORLDS.length && !(G.unl[nw] > 0) && !(nw === 3 && !G.flags.invaded)) {
      G.unl[nw] = 1; persist(); setWorld(nw); openMap(0);
      banner(`あたらしい ちほう「${WORLD_NAMES[nw]}」へ！`, 3); return;
    }
    persist();
    openMap(Math.min(ni + 1, MAP_NODES.length - 1));
    if (crownMsg) playEnding('oyako', () => {
      const back = () => { openMap(Math.min(ni + 1, MAP_NODES.length - 1)); banner(crownMsg, 4); SFX.recruit(); };
      if (!G.flags.invaded && typeof OYAKO_HINT !== 'undefined') say('', OYAKO_HINT, back); else back();
    });
  }
  function openMap(sel) {
    endSolo(); G.ev = null;
    G.state = 'map'; G.mapSel = sel; G.battle = null;
    const n = MAP_NODES[Math.max(0, sel - 1)];
    G.mapPos = { x: n.x, y: n.y }; G.fade = 1; G.fadeSpeed = -2;
    player.moving = false;
  }
  function mapKey(code) {
    if (['Escape', 'KeyX', 'Backspace', 'KeyH'].includes(code)) { openHub(); return; }
    const max = Math.min(G.unlocked, MAP_NODES.length) - 1;
    const left = code === 'ArrowLeft' || code === 'KeyA', right = code === 'ArrowRight' || code === 'KeyD';
    // walk off either end of a world onto the other one
    const w = G.world | 0;
    if (right && canNext()) { setWorld(w + 1); openMap(0); banner(WORLD_NAMES[w + 1], 1.4); return; }
    if (left && w > 0 && G.mapSel === 0) { setWorld(w - 1); const L = MAP_NODES.length - 1; openMap(L); G.mapSel = L; G.mapPos = { x: MAP_NODES[L].x, y: MAP_NODES[L].y }; banner(w - 1 ? WORLD_NAMES[w - 1] : 'ぬいぐるみの くに', 1.4); return; }
    if (left) G.mapSel = Math.max(0, G.mapSel - 1);
    if (right) G.mapSel = Math.min(max, G.mapSel + 1);
    if (['Enter', 'Space', 'NumpadEnter', 'ArrowUp', 'KeyW'].includes(code)) mapEnter();
  }
  function canNext() { const w = G.world | 0; return w + 1 < MAP_WORLDS.length && G.mapSel === MAP_NODES.length - 1 && G.unl && G.unl[w + 1] > 0; }
  function mapTap(x, y) {
    const i = MAP_NODES.findIndex(n => Math.abs(n.x - x) < 9 && Math.abs(n.y - y) < 9);
    if (i >= 0 && i < G.unlocked) { if (i === G.mapSel) mapEnter(); else G.mapSel = i; }
    else if (y >= 72) mapEnter();
  }
  function mapEnter() {
    const n = MAP_NODES[G.mapSel];
    if (!n || G.mapSel >= G.unlocked) return;
    if (n.stage == null) { banner(`${n.name}は まだ じゅんびちゅう`, 1.6); return; }
    if (STAGES[n.stage].soloOguri && !ownedOguri()) { SFX.miss(); banner('オグリキャップが いないと この みちは はしれない…', 2.2); return; }
    enterStage(n.stage);
  }
  let mapPadT = 0;
  function updateMap(dt) {
    // touch d-pad: step selection on press
    const d = padDir();
    if (d && mapPadT <= 0) { mapKey(d < 0 ? 'ArrowLeft' : 'ArrowRight'); mapPadT = 0.3; }
    if (!d) mapPadT = 0; else mapPadT -= dt;
    const n = MAP_NODES[G.mapSel], p = G.mapPos;
    const dx = n.x - p.x, dy = n.y - p.y, dist = Math.hypot(dx, dy);
    if (dist > 0.5) {
      const sp = Math.min(dist, 45 * dt);
      p.x += dx / dist * sp; p.y += dy / dist * sp;
      player.moving = true; if (Math.abs(dx) > 0.5) player.face = Math.sign(dx);
    } else { p.x = n.x; p.y = n.y; player.moving = false; }
  }
  const curPlats = () => (G.state === 'field' || G.state === 'talk' || G.state === 'menu') && !G.battle ? STAGES[G.stage].plats : null;
  function jump(a, lead) {
    if ((a.y !== 0 && !a.plat) || a.vy !== 0) return;
    a.plat = null;
    a.vy = -(STAGES[G.stage] && STAGES[G.stage].highJump ? TUNING.jumpV2 : TUNING.jumpV);
    if (lead) { comp.jumpQ = 0.14; SFX.jump(); }
  }
  function physics(a, dt) {
    if (a.jumpQ >= 0) { a.jumpQ -= dt; if (a.jumpQ < 0) { a.jumpQ = -1; jump(a, false); } }
    const plats = curPlats();
    if (a.plat) {
      const p = a.plat;
      if (!plats || a.x < p.x - 2 || a.x > p.x + p.w + 2) { a.plat = null; a.vy = 1; } else { a.y = -p.h; a.vy = 0; return; }
    }
    if (a.y < 0 || a.vy < 0) {
      const py = a.y;
      a.vy += TUNING.gravity * dt; a.y += a.vy * dt;
      if (a.vy > 0 && plats) for (const p of plats) {
        if (a.x >= p.x - 2 && a.x <= p.x + p.w + 2 && py <= -p.h + 0.01 && a.y >= -p.h) { a.y = -p.h; a.vy = 0; a.plat = p; dust(a.x, 0); return; }
      }
      if (a.y >= 0) { a.y = 0; a.vy = 0; dust(a.x, 0); }
    }
  }
  function swapActive() {
    if (G.party.length < 2) { banner('なかまが まだ 1たいだけ', 1.2); return; }
    let n = G.active;
    for (let k = 0; k < G.party.length; k++) { n = (n + 1) % G.party.length; if (G.party[n].hp > 0) break; }
    if (n === G.active) return;
    G.active = n; comp.key = compKey();
    burst(comp.x, GROUND - 10, 'spark', 8, '#ffffff');
    banner(`${ally().name}が いっしょに あるく`, 1.4);
    persist();
  }
  function followUpdate(dt) {
    const tx = player.x - player.face * 22;
    const d = tx - comp.x;
    if (Math.abs(d) > 1.5) {
      const sp = Math.min(Math.abs(d) * 3.5, TUNING.walkSpeed * 1.45);
      comp.x += Math.sign(d) * sp * dt;
      comp.moving = sp > 6; comp.face = Math.abs(d) > 5 ? Math.sign(d) : player.face;
    } else { comp.moving = false; comp.face = player.face; }
  }
  function camDeadzone() {
    const sx = player.x - G.camT;
    if (sx > 92) G.camT = player.x - 92;
    if (sx < 56) G.camT = player.x - 56;
    G.camT = clamp(G.camT, 0, WORLD_W - W);
  }
  function wildUpdate(w, dt) {
    if (w.toHome) {
      const d = w.home - w.x;
      if (Math.abs(d) < 1) { w.toHome = false; w.moving = false; w.face = -1; return; }
      w.face = Math.sign(d); w.x += Math.sign(d) * Math.min(Math.abs(d), 40 * dt); w.moving = true; return;
    }
    w.wt -= dt;
    if (w.wt <= 0) {
      w.wdir = w.wdir === 0 ? (rand() < 0.5 ? -1 : 1) : 0;
      w.wt = w.wdir ? 0.8 + rand() * 1.2 : 1.2 + rand() * 2;
    }
    if (w.wdir) {
      const nx = w.x + w.wdir * 10 * dt;
      if (Math.abs(nx - w.home) > 24 || (w.pl && (nx < w.pl.x + 6 || nx > w.pl.x + w.pl.w - 6))) { w.wdir = -w.wdir; }
      else { w.x = nx; w.face = w.wdir; }
      w.moving = true;
    } else w.moving = false;
  }
  function updateField(dt) {
    if (G.cs) { updateCS(dt); return; }
    if (csTrigger()) return;
    const mv = clamp((down('ArrowRight', 'KeyD') ? 1 : 0) - (down('ArrowLeft', 'KeyA') ? 1 : 0) + padDir(), -1, 1);
    player.moving = mv !== 0;
    if (mv) {
      player.face = mv;
      player.x = clamp(player.x + mv * TUNING.walkSpeed * dt, 10, WORLD_W - 10);
    }
    physics(player, dt); physics(comp, dt);
    followUpdate(dt);
    for (const m of G.party) m.hp = Math.min(m.maxHp, m.hp + TUNING.regenPerSec * dt);
    for (const a of G.npcs || []) if (a.def.ambush && !a.amTold && !G.fought.includes(a.def.id) && Math.abs(a.x - player.x) < 40) {   // ライバル ambush: walks up and challenges
      a.amTold = 1; a.face = Math.sign(player.x - a.x) || -1; G.camT = clamp((player.x + a.x) / 2 - W / 2, 0, WORLD_W - W);
      say(a.def.name, a.def.lines, () => startTrainer(a)); return;
    }
    for (const w of G.wilds) if (w.alive && w.rare) {   // rare wild (SPECIAL_EVENTS spawn table): sparkles + 「レアだ！」 once in view
      if ((w.spT = (w.spT || 0) - dt) <= 0) { w.spT = 0.45; burst(w.x + (rand() - 0.5) * 16, GROUND - 10 - rand() * 18, 'spark', 2, '#ffe070'); }
      if (!w.rareTold && Math.abs(w.x - player.x) < 100) { w.rareTold = 1; G.pops.push({ x: w.x, y: GROUND - 38, text: 'レアだ！', col: '#ffe070', life: 1.6, kana: true }); SFX.blip(); }
    }
    for (const w of G.wilds) if (w.alive && w.gate && player.x > w.x - 18) { player.x = w.x - 18; if (comp.x > w.x - 20) comp.x = w.x - 20; }   // mid-boss gate: can't pass until beaten
    for (const w of G.wilds) {
      if (!w.alive) continue;
      if (w.gate) { w.face = Math.sign(player.x - w.x) || -1; w.moving = false; }
      else wildUpdate(w, dt);
      if (w.gate && !w.cool && Math.abs(w.x - player.x) < TUNING.encounterDist + 6) {
        w.cool = true; G.camT = clamp((player.x + w.x) / 2 - W / 2, 0, WORLD_W - W);   // frame both for the line
        const CO = coopFor(w), gl = allyLines(SPECIES[w.sp].gate || [[SPECIES[w.sp].name + '「とおさないぞ！」', '']]);
        if (CO) { G.npcs.push(rivalActor(clamp(player.x - 30, 12, WORLD_W - 12), { id: 'rv_coop', lines: CO.win })); say('', gl.concat(CO.talk), () => { w.cool = false; coopStash(CO); startBattle(w); G.battle.coop = true; coopBuddy(); }); return; }
        say('', gl, () => { w.cool = false; startBattle(w); });
        return;
      }
      const dx = w.x - player.x;
      if (w.cool) { if (Math.abs(dx) > 110) w.cool = false; continue; }
      if (!w.toHome && Math.abs(dx) < TUNING.encounterDist && (SPECIES[w.sp].boss || (w.pl ? player.plat === w.pl : player.y === 0))) { if (w.sp === 'usahime' && STAGES[G.stage].id === 'seishiro') { usahimeMeet(w); return; } if (!mindTalk(w)) startBattle(w); return; }
    }
    updateNear();
    for (const [i, pk] of (STAGES[G.stage].pickups || []).entries()) {
      const key = pickKey(STAGES[G.stage], pk, i);
      if ((G.got = G.got || {})[key]) continue;
      if (Math.abs(player.x - pk.x) < 8 && Math.abs(player.y + pk.h) < 10) {
        G.got[key] = 1;
        if (pk.item && ITEMS[pk.item]) {   // one-time item (にんじん): saved in G.got by its id, goes to the bag
          G.items[pk.item] = (G.items[pk.item] | 0) + 1; SFX.recruit();
          if (PROPS['item_' + pk.item + '_get']) (G.pickFx = G.pickFx || []).push({ img: PROPS['item_' + pk.item + '_get'], x: pk.x, y: GROUND - pk.h - 1 - 7, t0: G.t });   // sparkle anchor = centre (8,8) on the carrot centre
          else burst(pk.x, GROUND - pk.h - 8, 'spark', 12, '#ff9a2a');
          banner(`${ITEMS[pk.item].name}を ひろった！ どうぐに いれた`, 1.8);
        } else { G.coins += pk.coins; SFX.buy(); burst(pk.x, GROUND - pk.h - 10, 'spark', 8, '#ffe24a'); pop(pk.x, GROUND - pk.h - 18, '+' + pk.coins, '#ffe24a'); }
        persist();
      }
    }
    G.signNear = Math.abs(player.x - (WORLD_W - 36)) < 22;
    const bx = STAGES[G.stage].bench;
    G.benchNear = bx != null && Math.abs(player.x - bx) < 16;
    if (G.benchNear && !G.benchUsed) {
      G.benchUsed = true;
      for (const m of G.party) m.hp = m.maxHp;
      burst(bx, GROUND - 14, 'spark', 12, '#ffffff');
      banner('ベンチで ひとやすみ。みんな げんきに なった！', 2.2);
      persist();
    }
    G._saveAcc = (G._saveAcc || 0) + dt;
    if (G._saveAcc > 8) { G._saveAcc = 0; persist(); }
    camDeadzone();
    if (player.x >= WORLD_W - 12) { clearStage(); return; }
  }

  // ---------- battle ----------
  // ---------- battle tutorial (first time only: a キツネン shows up and each command is explained) ----------
  const TUT_STEPS = [
    { btn: -1, title: 'バトルの きほん', l1: 'スタミナが まんたんで READY！', l2: 'したの コマンドを えらんでね' },
    { btn: 0, l1: 'すくない スタミナで ふつうの こうげき', l2: 'まよったら これ' },
    { btn: 1, l1: 'スタミナを たくさん つかう つよい わざ', l2: 'ここぞ という ときに' },
    { btn: 2, l1: 'たたかうと きずなゲージが たまる', l2: '100%で なかまの すごい いちげき' },
    { btn: 3, l1: 'こえを かけて なかまに さそう', l2: 'あいての HPが すくないほど せいこう' },
    { btn: 4, l1: 'みを まもって つぎの ダメージを', l2: 'はんぶんに する' },
    { btn: 5, l1: 'もちものを つかう', l2: 'ぬいショップで かえるよ' },
    { btn: 6, l1: 'たたかう なかまを こうたい する', l2: 'HPが へった ときに' },
    { btn: 7, l1: 'バトルから にげる', l2: 'ボスや ひとの こからは にげられない' },
    { btn: -2, title: 'やってみよう！', l1: 'キツネンと たたかってみよう', l2: 'なかまに するのも ありだよ' },
  ];
  function startTutorial() {
    G.tutWait = 0;
    if (G.state !== 'field' || G.battle || !G.party.length) return;
    const x = clamp(player.x + 70 * (player.face || 1), 20, WORLD_W - 20);
    const w = Object.assign(newActor(x, -1, SPECIES.kitsunen.sprite), newMember('kitsunen'), {
      home: x, spawnX: x, alive: true, cool: false, wt: 1, wdir: 0, toHome: false, idx: G.wilds.length, tutMob: true,
    });
    G.wilds.push(w);
    startBattle(w);
    G.battle.tutorial = true;
  }
  function tutStep(d) {
    const B = G.battle, t = B && B.tut; if (!t || !t.on) return;
    t.i = Math.max(0, t.i + d);
    SFX.blip();
    if (t.i >= TUT_STEPS.length) { t.on = false; B.sel = 0; G.flags.tut = 1; persist(); jkTutArm(B); return; }
    const st = TUT_STEPS[t.i]; if (st.btn >= 0) B.sel = st.btn;
  }
  const tutOn = () => !!(G.battle && G.battle.tut && G.battle.tut.on);
  function drawTut() {
    if (G.state !== 'battle' || !tutOn()) return;
    const t = G.battle.tut, st = TUT_STEPS[t.i], c = st.btn >= 0 ? COMMANDS[st.btn] : null;
    const x = 4, y = 2, w = 152, h = 35;
    rect(x + 1, y, w - 2, h, '#5a3418'); rect(x, y + 1, w, h - 2, '#5a3418');
    rect(x + 1, y + 1, w - 2, h - 2, '#fff8e0'); rect(x + 2, y + h - 3, w - 4, 1, '#e8d8b0');
    if (c) {
      const bx = x + 5, by = y + 4;
      rect(bx, by, 11, 11, '#3a2410'); rect(bx + 1, by + 1, 9, 9, c.color);
      drawPattern(ICONS[c.icon], bx + 1, by + 1, { w: '#ffffff', y: '#ffe24a' });
      T((st.btn + 1) + ' ' + c.label, x + 20, y + 4, { size: 8, c: '#c0502a' });
      T('スタミナ ' + COST[c.kind], x + w - 6, y + 6, { size: 4, c: '#7a5a38', al: 'right' });
    } else T(st.title, x + 6, y + 4, { size: 8, c: '#c0502a' });
    T(st.l1, x + 6, y + 15.5); T(st.l2, x + 6, y + 21);
    T((t.i + 1) + '/' + TUT_STEPS.length + (TOUCH ? '  タップで つぎへ' : '  Enterで つぎへ'), x + w - 6, y + h - 8.5, { size: 4, c: '#a08a60', al: 'right' });
    // bouncing arrow at the button (or the stamina bar) being explained
    const bob = Math.floor(G.t * 4) % 2;
    let ax = -1;
    if (st.btn >= 0) ax = BTN[st.btn].x + BTN[st.btn].w / 2 - 2; else if (st.btn === -1) ax = 26;
    if (ax >= 0) drawPattern(['#######', '#yyyyy#', '.#yyy#.', '..#y#..', '...#...'], Math.round(ax) - 1, 66 + bob, { '#': '#5a1a1a', y: '#ffe24a' });
  }
  // ---------- せいぎぐん invasion (story) ----------
  function startInvasion() {
    G.invWait = 0;
    const x = clamp(player.x + 100, 40, WORLD_W - 20), u = Object.assign(newActor(x, -1, 'usahime'), trainerMember({ sp: 'usahime', lv: 30 }), { home: x, spawnX: x, alive: true, cool: true, story: true });
    u.key = 'usahime'; G.invader = u;
    G.invFx = { pile: true, gold: 0, eat: 0, soldiers: null, run: false };
    say('', INVASION.talk, () => { oyakoStash(); startBattle(u); G.battle.story = { turns: 0 }; oyakoBuddy(); });
  }
  // the invasion battle is fought by the おやこ only: stash the party (like the さいごの はしり solo run), use the player's own
  // crowned オグリキャップ / オグリキング (from party or box) or temporary ones, and put everything back exactly afterwards
  function oyakoStash() {
    const all = G.party.concat(G.box || []), keep = [];
    const pick = (sp, build) => {
      const m = all.find(o => o.sp === sp && (sp !== CROWN.sp || o.crown)) || all.find(o => o.sp === sp);
      if (!m) return build();
      keep.push([m, Object.assign({}, m)]); return m;
    };
    const ogLv = (all.find(o => o.sp === CROWN.sp) || { lv: 30 }).lv;
    const O = pick(CROWN.sp, () => Object.assign(trainerMember({ sp: CROWN.sp, lv: ogLv }), { evo: 1 }));
    const K = pick(CROWN.oyako.partner, () => trainerMember({ sp: CROWN.oyako.partner, lv: 30 }));
    if (!O.crown) { O.evo = 1; O.crown = 1; for (const k of ['maxHp', 'atk', 'def', 'spd']) O[k] = Math.round(O[k] * CROWN.mult); }
    for (const m of [O, K]) { m.hp = m.maxHp; m.st = 0; }
    G.solo = { party: G.party, active: G.active, inv: keep };   // saves made meanwhile keep the real party
    G.party = [O, K]; G.active = 0; comp.key = compKey();
  }
  // ライバル co-op (once): the rival's キツネン joins as the 2nd ally for the gold カメタンク at せいぎぐんの みち (same 2-member team + buddy as the おやこ fight)
  const coopFor = w => { const C = typeof RIVAL_STORY !== 'undefined' && RIVAL_STORY.coop; return C && !G.flags.rvCoop && !G.solo && !G.friend && !G.versus && STAGES[G.stage].id === C.stage && w.sp === C.sp + '_gold' ? C : null; };
  function coopStash(C) {
    const A = G.party[G.active] && G.party[G.active].hp >= 1 ? G.party[G.active] : G.party.find(m => m.hp >= 1) || G.party[0];
    const R = trainerMember(C.ace); delete R.spUsed; R.name = rName() + 'の ' + R.name; R.rival = 1;
    G.solo = { party: G.party, active: G.active, inv: [], coop: 1 };   // saves made meanwhile keep the real party
    G.party = [A, R]; G.active = 0; comp.key = compKey();
  }
  function coopBuddy() { const B = G.battle, side = B.side || 1; G.buddy = newActor(clamp(player.x - side * 26, G.camT + 14, G.camT + W - 14), side, memberKey(G.party[1])); }
  function coopRestore() { if (G.solo && G.solo.coop) oyakoRestore(); }
  function oyakoRestore() {
    if (!G.solo || !G.solo.inv) return;
    for (const [m, snap] of G.solo.inv) { for (const k of Object.keys(m)) if (!(k in snap)) delete m[k]; Object.assign(m, snap); }
    endSolo(); G.buddy = null;
  }
  // the partner stands behind the active one during the battle
  function oyakoBuddy() {
    const B = G.battle, side = B.side || 1;
    G.buddy = newActor(clamp(player.x - side * 26, G.camT + 14, G.camT + W - 14), side, 'oguriking');   // behind the player, fully on screen
  }
  // invasion: うさひめ ate the でんせつの にんじん -> takes 1 damage, and the おやこ never drop below 1 HP
  function storyDmg(def, dmg) {
    const B = G.battle; if (!B) return dmg;
    if (B.final && def === B.w && !(B.usa && B.usa.sw) && !B.finMv && oyakoPartner(ally())) {   // the finisher must be the gold おやこ おぐり波
      if (def.hp - dmg < 1) { B.bond = 100; if (!B.finTold) { B.finTold = 1; setTimeout(() => banner(USAHIME.finish, 2.2), 900); } }   // at 1 HP: the bond gauge fills so the finisher is ready
      return Math.min(dmg, Math.max(0, def.hp - 1));
    }
    if (!B.story) return dmg;
    if (def === B.w) {
      B.story.hits = (B.story.hits | 0) + 1;
      if (B.story.hits % 3 === 1) { banner(INVASION.nodmg, 1.6); burst(def.x, GROUND - 18, 'spark', 10, '#ffe24a'); }
      return def.hp > 1 ? 1 : 0;
    }
    return Math.min(dmg, Math.max(0, def.hp - 1));
  }
  const allyLines = pages => pages.map(p => p.map(l => l.replace(/\{ALLY\}/g, ally() ? ally().name : pName())));
  function* storyEnd() {
    const B = G.battle; B.story.done = true;
    if (B.story.kind === 'shiro') {   // うさひめ (invincible) blows the party away -> back to the world map, not a game over
      const e = B.w; banner(USAHIME.blow, 2.4); usaLaugh(e, 2.0); yield* wait(1.6);
      SFX.battleStart(); G.shakeT = 0.8; G.flashT = 0.2; burst(e.x, GROUND - 16, 'spark', 24, '#ffe24a');
      const d = -(B.side || 1), p0 = player.x, c0 = comp.x;
      yield* tween(v => { player.ox = d * v * 120; comp.ox = d * v * 140; player.y = comp.y = -Math.sin(v * Math.PI * 0.8) * 50; }, 0, 1, 0.9);
      banner(USAHIME.blown, 1.6); G.fadeSpeed = 1.4; yield* wait(1.0);
      player.y = comp.y = 0; player.x = p0; comp.x = c0;
      B.phase = 'end'; B.result = 'story';
      endBattle(); return;
    }
    banner(INVASION.stop + ' きょうは ここまでよ！」', 2.2); yield* wait(2.0);
    B.phase = 'end'; B.result = 'story';
    for (const m of G.party) if (m.hp < 1) m.hp = 1;
    endBattle();
  }
  // ---------- うさひめ arc (せいぎぐんの しろ) ----------
  const W4_STAGES = ['seimachi', 'seimichi', 'seishiro'];
  const carrotsBack = () => W4_STAGES.filter(id => G.flags['gate_gold_' + id]).length;
  const usaNode = () => Math.max(0, MAP_W4.findIndex(n => STAGES[n.stage].id === 'seishiro'));
  // laugh: assets/usahime_laugh.png sheet while 「うーしっしっ」 (code hop only if the art is missing)
  function usaLaugh(a, t) { if (a) a.laughT = t; }
  function usahimeMeet(w) {
    w.cool = true; G.camT = clamp((player.x + w.x) / 2 - W / 2, 0, WORLD_W - W);
    if (carrotsBack() >= 3) {
      say('', allyLines(USAHIME.rematch), () => {
        oyakoStash();
        for (const m of G.party) { m.gold = 1; for (const k of ['maxHp', 'atk', 'def', 'spd']) m[k] = Math.round(m[k] * 1.5); m.hp = m.maxHp; }   // gold power-up (undone by oyakoRestore)
        comp.key = compKey(); G.flashT = 0.3; burst(comp.x, GROUND - 14, 'spark', 20, '#ffe24a');
        Object.assign(w, trainerMember({ sp: 'usahime', lv: 30 }), { cool: false });
        const UL = USAHIME.last; w.maxHp = Math.round(w.maxHp * UL.hpMul); w.hp = w.maxHp; w.atk = Math.round(w.atk * UL.atkMul);   // true last boss
        startBattle(w); G.battle.final = true; G.battle.usa = { mad: false, swapped: false, eats: 0, sw: null }; oyakoBuddy();
      });
      return;
    }
    say('', allyLines(G.flags.usaLoss ? USAHIME.again : USAHIME.meet), () => {
      Object.assign(w, trainerMember({ sp: 'usahime', lv: 30 }), { cool: false });
      startBattle(w); G.battle.story = { turns: 0, kind: 'shiro' };
    });
  }
  function usaBlown() {
    const first = !G.flags.usaLoss;
    G.flags.usaLoss = (G.flags.usaLoss | 0) + 1;
    for (const m of G.party) { m.hp = m.maxHp; m.st = 0; }
    persist(); openMap(usaNode());
    if (first) { say('', allyLines(USAHIME.hint), () => {}); G.talk.onMap = true; G.talk.rival = true; }
    else banner('でんせつの にんじんを とりかえさないと かてない…', 2.6);
  }
  function carrotBack() {
    const n = carrotsBack(); SFX.recruit();
    banner(`${USAHIME.got} (${n}/3)`, 2.8);
    if (n >= 3) setTimeout(() => { if (G.state === 'field' || G.state === 'map') banner(USAHIME.all, 3); else G.pendBan = [USAHIME.all, 2]; }, 2800);
    persist();
  }
  function usaFinalOutro(u) {
    u.alive = true; u.alpha = 1; u.oy = 0; u.cool = true; u.hp = 1; u.gold = 0;
    say('', USAHIME.flee, () => {
      usaLaugh(u, 1.4);
      G.fieldCo = (function* () {
        u.face = 1; u.moving = true;
        yield* tween(v => { u.x = u.home + v * 260; }, 0, 1, 1.6);
        u.alive = false;
        say('', USAHIME.wrap, () => {
          oyakoRestore(); for (const m of G.party) { delete m.gold; m.hp = m.maxHp; }
          comp.key = compKey();
          G.flags.w4clear = 1; if (!G.cleared.includes(G.stage)) G.cleared.push(G.stage);
          persist();
          const back = () => { openMap(usaNode()); banner('せいぎぐんの くに クリア！', 3); };
          if (!playEnding('true', back)) back();
        });
      })();
    });
  }
  function invasionOutro() {
    say('', INVASION.outro, () => {
      if (G.invader) { G.invader.alive = false; G.invader = null; }
      oyakoRestore(); G.invFx = null;
      G.flags.invaded = 1;
      if (!G.unl) G.unl = [G.unlocked];
      while (G.unl.length < MAP_WORLDS.length) G.unl.push(0);
      G.unl[G.world | 0] = G.unlocked;
      if (!(G.unl[3] > 0)) G.unl[3] = 1;
      persist(); setWorld(3); openMap(0);
      banner(`あたらしい ちほう「${WORLD_NAMES[3]}」へ！`, 3);
    });
  }
  function startBattle(w) {
    // しょうこ: if くうこ is with us, she calls her little sister over first (くうこ fights on her side until beaten)
    G.mind = null;
    const msp = SPECIES[w.sp].mindSp || (SPECIES[w.sp].mindKuuko && 'kuuko');
    if (msp && !G.friend && !G.versus) {
      const ki = G.party.findIndex(m => m.sp === msp);
      if (ki >= 0 && G.party.some((m, i) => i !== ki && m.hp >= 1)) {
        const k = G.party[ki], cur = G.party[G.active];
        G.party.splice(ki, 1);
        G.active = Math.max(0, G.party.indexOf(cur)); if (G.party[G.active] !== cur) G.active = 0;
        G.mind = { m: k, idx: ki, boss: { sp: w.sp, name: w.name, maxHp: w.maxHp, hp: w.hp, atk: w.atk, def: w.def, spd: w.spd, lv: w.lv, evo: w.evo ? 1 : 0, key: w.key } };
        Object.assign(w, { sp: msp, name: k.name, maxHp: k.maxHp, hp: k.maxHp, atk: k.atk, def: k.def, spd: k.spd, lv: k.lv || 1, evo: k.evo ? 1 : 0, mind: true, spUsed: false, spSuper: false });
        w.key = memberKey(k);
      }
    }
    if (ally().hp < 1) G.active = Math.max(0, G.party.findIndex(m => m.hp >= 1));
    comp.key = compKey();
    const side = Math.sign(w.x - player.x) || 1;
    for (const m of G.party.concat([w])) if (m) delete m._buff;
    if (!G.versus && !G.friend && SPECIES[w.sp]) { G.flags.seen = G.flags.seen || {}; G.flags.seen[w.sp] = 1; }   // ずかん: みつけた
    const B = G.battle = {
      w, side, phase: 'intro', q: [], cur: null, sel: 0, runTries: 0, result: null, msg: '',
      allyTX: player.x + side * 26, enemyTX: clamp(player.x + side * 90, 20, WORLD_W - 20),
    };
    B.oppTeam = null; B.oppIdx = 0; B.oppNext = null;
    if (G.versus && G.vsTeam) { B.oppTeam = G.vsTeam; B.oppIdx = G.vsLead | 0; G.vsTeam = null; }
    netRng = null; NET.seq = 0; NET.rseq = 0; NET.lastKey = ''; NET.lastSent = 0; NET.sentAt = 0; NET.pend = null; NET.paused = null; NET.lastBan = '';
    G.state = 'battle';
    B.bond = 0; B.obond = 0; for (const m of G.party) m.guard = false; w.guard = false;
    G.vs = { t: 0, hot: !!(SPECIES[w.sp].boss || w.trainer) };
    SFX.battleStart();
    player.moving = false; player.face = side; player.ox = 0;
    for (const a of [player, comp, w]) { a.y = 0; a.vy = 0; a.plat = null; }
    ally().hp = Math.floor(ally().hp);
    ally().st = 25; w.st = 5 + rand() * 30; w.wdir = 0;
    G.camT = clamp(player.x + side * 45 - W / 2, 0, WORLD_W - W);
    banner(G.friend ? `たいせん！ ${w.name} が むかってきた！` : w.trainer ? `${w.trainerName}が しょうぶを しかけてきた！` : (SPECIES[w.sp].boss ? `${w.name}が たちはだかった！` : `やせいの ${w.name}が あらわれた！`), 2.0);
    if (!G.friend && !w.trainer && SPECIES[w.sp].taunt && rand() < 0.6) setTimeout(() => { if (G.battle && G.battle.w === w) banner(SPECIES[w.sp].taunt, 2.6); }, 2000);   // smug せいぎぐん grunts
    // versus: the other player stands behind their plush (their own look online, the other gender offline)
    G.oppHero = null;
    if (G.versus) {
      const o = G.netRole && NET.opp && NET.opp.g != null ? NET.opp : { g: (G.gender | 0) ? 0 : 1, c: null };
      const gi = (o.g | 0) % HERO_GENDERS.length, ci = o.c != null ? o.c : HERO_GENDERS[gi].def;
      try { buildHero(gi, ci, 'hero_opp'); } catch (e) {}
      if (SPR.hero_opp) {
        const h = G.oppHero = newActor(clamp(B.enemyTX + side * 60, 8, WORLD_W - 8), -side, 'hero_opp');
        h.tx = clamp(B.enemyTX + side * 22, 8, WORLD_W - 8); h.tface = -side;
        if (side > 0) h.tx = Math.min(h.tx, G.camT + W - 10); else h.tx = Math.max(h.tx, G.camT + 10);
      }
    }
    if (G.mind) banner(`${G.mind.boss.name}が たちはだかった！`, 2.0);
    if (G.mind) {  // しょうこ stands behind the controlled くうこ until くうこ wakes up
      const sd = Math.sign(B.enemyTX - player.x) || 1, k = memberKey(G.mind.boss);
      const h = G.oppHero = newActor(clamp(B.enemyTX + sd * 60, 8, WORLD_W - 8), -sd, k);
      h.tx = clamp(B.enemyTX + sd * 26, 8, WORLD_W - 8); h.tface = -sd;
      if (sd > 0) h.tx = Math.min(h.tx, G.camT + W - 10); else h.tx = Math.max(h.tx, G.camT + 10);
    }
    B.q.push(introAction());
    if (G.mind) B.q.push(mindIntro());
  }
  function* walkTo(a, x, speed) {
    while (Math.abs(a.x - x) > 0.5) {
      const d = x - a.x; a.face = Math.sign(d); a.moving = true;
      a.x += Math.sign(d) * Math.min(Math.abs(d), speed * DT); yield;
    }
    a.x = x; a.moving = false;
  }
  // しょうこ meets くうこ: a short talk on the field before the battle (and the mind control) starts
  function mindTalk(w) {
    const sp = SPECIES[w.sp], msp = sp.mindSp || (sp.mindKuuko && 'kuuko'), k = msp && G.party.find(m => m.sp === msp), T = MIND[w.sp];
    if (!T || G.friend || G.versus) return false;
    if (!k || !G.party.some(m => m !== k && m.hp >= 1)) {   // no mind control possible: noChild talk (if any), then a normal boss battle
      if (!T.noChild) return false;
      w.cool = true; w.toHome = false;
      say('', T.noChild, () => { w.cool = false; startBattle(w); });
      return true;
    }
    w.cool = true; w.toHome = false;
    const K = k.name;
    say('', T.talk.map(l => l.map(x => x.replace(/@/g, K))), () => { w.cool = false; startBattle(w); });
    return true;
  }
  function* mindIntro() {
    const B = G.battle, e = B.w, T = MIND[G.mind.boss.sp] || MIND.shouko;
    B.msg = T.voice;
    banner(T.call.replace(/@/g, e.name), 2.2); yield* wait(2.0);
    for (let i = 0; i < 10; i++) { burst(e.x, GROUND - 16, 'spark', 3, '#b060ff'); e.flash = 0.15; yield* wait(0.12); }
    B.msg = `${e.name}は あやつられている！`;
    banner(`${e.name}は ${T.obey}`, 2.2); yield* wait(2.0);
    B.msg = '';
  }
  // くうこ beaten: she wakes up, comes home, and しょうこ steps in
  function* mindWake(e) {
    const B = G.battle, M = G.mind;
    e.mind = false;
    banner(`${M.m.name}は はっと めを さました！`, 2.0);
    for (let i = 0; i < 6; i++) { e.alpha = i % 2 ? 1 : 0.4; yield* wait(0.1); }
    restoreMind();
    yield* tween(v => { e.alpha = v; if (G.oppHero) G.oppHero.alpha = v; }, 1, 0, 0.35);
    G.oppHero = null;
    Object.assign(e, M.boss, { mind: false, guard: false, st: 5 + rand() * 25, oy: 0, spUsed: false, spSuper: false });
    e.key = SPECIES[M.boss.sp].sprite;
    banner(`${M.m.name}は なかまの ところへ もどった！ ${M.boss.name}が でてきた！`, 2.4);
    burst(e.x, GROUND - 12, 'spark', 10, '#ffffff');
    yield* tween(v => { e.alpha = v; }, 0, 1, 0.4);
    yield* wait(0.6);
    B.phase = 'run'; B.result = null; B.msg = '';
  }
  function restoreMind() {
    const M = G.mind; if (!M) return;
    G.mind = null;
    const cur = G.party[G.active];
    M.m.hp = Math.max(1, Math.round(M.m.maxHp * 0.5));
    G.party.splice(Math.min(M.idx, G.party.length), 0, M.m);
    G.active = Math.max(0, G.party.indexOf(cur));
    G.mindBoss = M.boss;
  }
  function* introAction() {
    const B = G.battle, w = B.w;
    pop(w.x, GROUND - 40, '!', '#ff5a3a');
    const a = walkTo(comp, B.allyTX, 50), b = walkTo(w, B.enemyTX, 40);
    let da = false, db = false;
    while (!da || !db) { if (!da) da = a.next().done; if (!db) db = b.next().done; yield; }
    comp.face = B.side; w.face = -B.side;
    yield* wait(0.3);
    B.phase = 'run';
  }
  function choose(i, fromNet) {
    const B = G.battle;
    if (!B || B.phase !== 'input' || tutOn()) return;
    // online: only the side whose turn it is may act (host decides; the guest only sends requests)
    if (G.netRole && G.versus) {
      if (NET.paused) { banner('つなぎなおしちゅう…', 1.0); return; }
      if (G.netRole === 'host' ? (B.who === 'opp') !== !!fromNet : B.who !== 'me') { SFX.miss(); banner('あいての ばん', 1.0); return; }
    }
    const kind = COMMANDS[i].kind;
    B.sel = i;
    if (G.solo && kind === 'recruit') { banner('いまは なかまに できない！', 1.4); return; }
    if (SPECIES[B.w.sp].boss && (kind === 'recruit' || kind === 'run')) {
      banner(kind === 'recruit' ? 'ボスは なかまに できない！' : 'ボスからは にげられない！', 1.4);
      return;
    }
    if (G.friend && (kind === 'recruit' || kind === 'run')) { banner('たいせんでは つかえない', 1.1); return; }
    if (B.w.trainer && (kind === 'recruit' || kind === 'run')) {
      banner(kind === 'recruit' ? 'ひとの ぬいぐるみは なかまに できない！' : 'しょうぶの とちゅうで にげられない！', 1.4);
      return;
    }
    if (G.friend && kind === 'item') { banner('たいせんでは つかえない', 1.1); return; }
    const a = ally();
    if (kind === 'special' && sideBond() < 100) { SFX.miss(); banner('きずなゲージが まだ たまっていない', 1.4); return; }
    if (kind === 'item') {
      if (!bagList().length) { SFX.miss(); banner('どうぐを もっていない', 1.2); return; }
      B.phase = 'menu'; G.menu = { kind: 'bitem', sel: 0 }; SFX.blip(); return;
    }
    if (kind === 'swap' && B.who === 'opp') {
      if (G.netRole || !B.oppTeam || !B.oppTeam.some((m, i) => i !== B.oppIdx && m.hp >= 1)) { SFX.miss(); banner('こうたい できる なかまが いない', 1.4); return; }
      B.phase = 'menu'; G.menu = { kind: 'bswap', sel: 0, opp: true }; SFX.blip(); return;
    }
    if (kind === 'swap') {
      if (!G.party.some((m, i) => i !== G.active && m.hp >= 1)) { SFX.miss(); banner('こうたい できる なかまが いない', 1.4); return; }
      B.phase = 'menu'; G.menu = { kind: 'bswap', sel: 0 }; SFX.blip(); return;
    }
    if (G.netRole === 'guest' && G.versus) { netSend({ t: 'cmd', kind }); NET.sentAt = performance.now(); B.phase = 'run'; B.who = null; return; }
    a.guard = false;
    if (G.netRole === 'host' && G.versus) netEv({ k: 'act', side: B.who === 'opp' ? 'g' : 'h', kind });
    B.phase = 'run';
    if (B.who === 'opp') B.q.push(kind === 'guard' ? oppGuard() : kind === 'special' ? oppSpecialVs() : enemyAttack(kind));
    else B.q.push(kind === 'recruit' ? recruitAction() : kind === 'run' ? runAction() : kind === 'guard' ? guardAction() : kind === 'special' ? specialAction() : allyAttack(kind));
  }
  function battleMenuPick(M, k) {
    const B = G.battle, a = ally();
    if (k === '_close') { closeMenu(); return; }
    if (M.kind === 'bswap') {
      const i = +k.slice(1), m = swapList(M)[i];
      if (i === (M.opp ? B.oppIdx : G.active) && !M.forced) { banner(`${m.name}は もう たたかっている`, 1.2); return; }
      if (m.hp < 1) { banner(`${m.name}は たおれている`, 1.2); return; }
      G.menu = null;
      if (G.netRole === 'guest' && G.versus) { netSend({ t: M.forced ? 'next' : 'swap', i }); NET.sentAt = performance.now(); B.phase = 'run'; B.who = null; return; }
      if (M.forced) { B.phase = 'run'; B.q.push(sendInAction(i)); return; }
      if (M.opp) { B.w.guard = false; B.phase = 'run'; B.q.push(oppSwapAction(i)); return; }
      a.guard = false; B.phase = 'run'; B.q.push(swapAction(i)); return;
    }
    const it = ITEMS[k];
    if (it.use === 'lvup') { banner('たたかいの あとで つかおう', 1.2); return; }
    if (it.use === 'heal' && a.hp >= a.maxHp) { banner(`${a.name}は げんき いっぱい`, 1.2); return; }
    if (it.use === 'healAll' && G.party.every(m => m.hp >= m.maxHp)) { banner('みんな げんき いっぱい', 1.2); return; }
    if (it.use === 'recruit') {
      if (G.cookie) { banner('もう たべさせてある', 1.2); return; }
      if (B.w.trainer || SPECIES[B.w.sp].boss) { banner('いまは つかえない', 1.2); return; }
    }
    G.menu = null; a.guard = false; B.phase = 'run'; B.q.push(itemAction(k));
  }
  function* guardAction() {
    const B = G.battle, a = ally();
    a.st -= COST.guard; a.guard = true;
    B.msg = `${a.name}は みを まもっている！`;
    banner(B.msg, 1.2);
    SFX.blip(); burst(comp.x, GROUND - 16, 'spark', 6, '#a8d8ff');
    yield* tween(v => comp.oy = v, 0, -2, 0.1); yield* tween(v => comp.oy = v, -2, 0, 0.12);
    addBond(8);
    yield* wait(0.4);
  }
  function* itemAction(k) {
    const B = G.battle, a = ally(), it = ITEMS[k];
    a.st -= COST.item;
    B.msg = `${it.name}を つかった！`;
    banner(B.msg, 1.2);
    player.moving = true; yield* tween(v => player.ox = v, 0, B.side * 4, 0.2); player.moving = false;
    yield* wait(0.2);
    if (it.use === 'heal') { const before = a.hp; a.hp = Math.min(a.maxHp, a.hp + it.amt); pop(comp.x, GROUND - 38, '+' + Math.round(a.hp - before), '#9af07a'); }
    else if (it.use === 'healAll') { for (const m of G.party) m.hp = m.maxHp; pop(comp.x, GROUND - 38, 'FULL', '#9af07a'); }
    else if (it.use === 'recruit') { G.cookie = true; for (let i = 0; i < 3; i++) heartTo(player.x, GROUND - 18, B.w.x, GROUND - 16, i * 0.1); }
    burst(comp.x, GROUND - 14, 'spark', 10, it.use === 'recruit' ? '#ff9ac8' : '#9af07a');
    SFX.level();
    G.items[k]--; if (G.items[k] <= 0) delete G.items[k];
    persist();
    B.msg = it.use === 'recruit' ? `${B.w.name}は クッキーに きょうみしんしん` : `${a.name}は げんきに なった！`;
    banner(B.msg, 1.4);
    yield* tween(v => player.ox = v, player.ox, 0, 0.2);
    yield* wait(0.4);
  }
  function* swapAction(i) {
    const B = G.battle, a = ally(), n = G.party[i];
    const st = Math.max(0, a.st - COST.swap);
    B.msg = `もどれ ${a.name}！`;
    banner(B.msg, 1.0);
    yield* tween(v => comp.alpha = v, 1, 0, 0.25);
    burst(comp.x, GROUND - 12, 'spark', 8, '#ffffff');
    G.active = i; comp.key = compKey(); n.st = st; n.guard = false;
    yield* wait(0.25);
    B.msg = `いけっ ${n.name}！`;
    banner(B.msg, 1.2); SFX.blip();
    yield* tween(v => comp.alpha = v, 0, 1, 0.25);
    burst(comp.x, GROUND - 14, 'spark', 10, '#ffe24a');
    yield* wait(0.4);
  }
  // versus: each side has its own きずな (B.bond = this side / host, B.obond = the other side)
  function sideBond() { const B = G.battle; return B ? ((G.friend && B.who === 'opp' ? B.obond : B.bond) | 0) : 0; }
  function addBond(v, opp) {
    const B = G.battle; if (!B || (opp && !G.friend)) return;
    if (opp) { const w0 = B.obond | 0; B.obond = Math.min(100, (B.obond || 0) + v); if (w0 < 100 && B.obond >= 100) banner('あいての きずなゲージ MAX！', 1.4); return; }
    const was = B.bond | 0; B.bond = Math.min(100, (B.bond || 0) + v); if (was < 100 && B.bond >= 100) { banner('きずなゲージ MAX！ ひっさつが つかえる！', 1.6); burst(comp.x, GROUND - 30, 'spark', 10, '#ffb04a'); } }
  function* specialAction() {
    const B = G.battle, a = ally(), e = B.w;
    const mv = specialOf(a);
    a.st -= COST.special; B.bond = 0;
    B.msg = `${a.name}の ひっさつ！`;
    G.cutin = { t: 0, dur: 1.15, key: comp.key, name: mv.fx ? mv.name : mv.name.replace(/^きずなの /, ''), who: a.name };
    SFX.battleStart();
    while (G.cutin && G.cutin.t < G.cutin.dur) yield;
    G.cutin = null;
    banner(mv.oyako ? `${a.name}と ${mv.oyako}の ${mv.name}！` : `${a.name}の ${mv.name}！`, 1.3);
    if (B.final && mv.oyako) B.finMv = true;
    const fs = mv.fxSp || a.sp;
    const art = mv.fx && canSp(a) && typeof FX_ART !== 'undefined' && FX_ART[fs] && FXIMG[fs] && SPR[comp.key] && (SPR[comp.key].attack || SPECIES[a.sp].noEvo || mv.fxSp);
    if (art) yield* artStrike(comp, a, e, e, mv, FX_ART[fs], fs); else if (mv.fx) yield* fxStrike(comp, a, e, e, mv); else yield* strike(comp, a, e, e, mv, 'special');
    B.finMv = false;
    if (e.hp <= 0) yield* enemyFaint();
  }
  function aiChoose(e, a) {
    const strong = movesOf(e).strong;
    const est = strong.power * e.atk / (e.atk + a.def);
    if (a.hp <= est * 1.05 && rand() < 0.7) return 'strong';
    if (e.style === 'guard' && !e.guard && e.hp < e.maxHp * 0.6 && rand() < 0.35) return 'guard';
    const p = e.style === 'fast' ? 0.12 : e.style === 'power' ? 0.6 : 0.3;
    return rand() < p ? 'strong' : 'attack';
  }
  // a move with fxFrom: '<sp>' plays that species' pixel-art special fx (e.g. オグリキング's strong パンチングパンチ = kangarun's)
  function* strikeOrArt(attA, att, defA, def, mv, kind) {
    const src = mv.fxFrom;
    if (src && typeof FX_ART !== 'undefined' && FX_ART[src] && FXIMG[src] && SPR[attA.key] && SPR[attA.key].attack) yield* artStrike(attA, att, defA, def, mv, FX_ART[src], src);
    else yield* strike(attA, att, defA, def, mv, kind);
  }
  function* strike(attA, att, defA, def, mv, kind) { yield* strike0(attA, att, defA, def, mv, kind); afterMove(att, mv); }
  function* strike0(attA, att, defA, def, mv, kind) {
    const dir = Math.sign(defA.x - attA.x) || 1;
    const big = kind === 'strong' || kind === 'special';
    const dist = kind === 'special' ? 30 : big ? 22 : 10;
    if (big) { yield* tween(v => attA.ox = v, 0, -dir * (kind === 'special' ? 6 : 4), 0.22); yield* wait(0.08); }
    yield* tween(v => attA.ox = v, attA.ox, dir * dist, big ? 0.1 : 0.13);
    if (rand() < mv.acc) {
      let dmg = calcDmg(att, def, mv);
      const crit = kind !== 'special' && rand() < (kind === 'strong' ? 0.12 : 0.08);
      if (kind === 'special') dmg = Math.max(dmg, 8);
      if (crit) dmg = Math.round(dmg * 1.5);
      const guarded = !!def.guard;
      if (guarded) { dmg = Math.max(1, Math.ceil(dmg / 2)); def.guard = false; }
      dmg = storyDmg(def, dmg); jkPop(att, def, defA);
      def.hp = Math.max(0, def.hp - dmg);
      defA.flash = 0.3; defA.shake = crit || kind === 'special' ? 0.5 : 0.3;
      pop(defA.x, GROUND - 38, dmg, crit ? '#ff6a3a' : big ? '#ffdf3a' : '#ffffff');
      if (crit) { pop(defA.x, GROUND - 46, 'CRITICAL!', '#ffe24a'); G.hitStop = 0.14; G.flashT = 0.08; }
      if (guarded) { pop(defA.x, GROUND - 46, 'GUARD', '#a8d8ff'); burst(defA.x, GROUND - 16, 'spark', 6, '#a8d8ff'); }
      if (kind === 'special') { G.hitStop = 0.18; G.flashT = 0.12; burst(defA.x, GROUND - 14, 'spark', 16, '#ffb04a'); }
      burst(defA.x - dir * 6, GROUND - 14, 'hit', kind === 'special' ? 16 : crit ? 12 : big ? 10 : 5);
      if (big || crit) G.shakeT = kind === 'special' ? 0.5 : 0.3;
      SFX.hit(big || crit ? 'strong' : kind);
      if (G.battle) { if (att === ally() && kind !== 'special') addBond(dmg / def.maxHp * 90); if (def === ally()) addBond(dmg / def.maxHp * 110); }
      if (G.battle && G.friend) { if (att === G.battle.w && kind !== 'special') addBond(dmg / def.maxHp * 90, true); if (def === G.battle.w) addBond(dmg / def.maxHp * 110, true); }
    } else { pop(defA.x, GROUND - 38, 'MISS', '#cfe8ff'); SFX.miss(); }
    yield* tween(v => attA.ox = v, attA.ox, 0, 0.2);
    yield* wait(0.35);
  }
  // projectile special (evolved forms): wind up, shoot mv.fx at the target, hit (mv.hits times)
  function* fxStrike(attA, att, defA, def, mv) { yield* fxStrike0(attA, att, defA, def, mv); afterMove(att, mv); }
  function* fxStrike0(attA, att, defA, def, mv) {
    const dir = Math.sign(defA.x - attA.x) || 1, hits = mv.hits || 1;
    yield* tween(v => attA.ox = v, 0, -dir * 4, 0.18); yield* wait(0.06);
    attA.ox = dir * 2;
    let total = Math.max(8, calcDmg(att, def, mv));
    for (let h = 0; h < hits; h++) {
      const f = { type: mv.fx, shape: mv.shape, big: mv.big, col: mv.col || '#ffb04a', dir, t: 0,
        x0: attA.x + dir * 10, x1: defA.x - dir * 4, y: GROUND - 15 + (hits > 1 ? [0, -4, 3][h % 3] : 0),
        dur: mv.fx === 'beam' ? 0.3 : hits > 1 ? 0.26 : mv.fx === 'fire' ? 0.42 : 0.4, hold: mv.fx === 'beam' || mv.fx === 'fire' ? 0.3 : 0 };
      G.fx.push(f); SFX.hit('attack');
      while (f.t < f.dur) yield;
      let dmg = hits > 1 ? Math.max(1, Math.round(total / hits)) : total;
      const guarded = !!def.guard;
      if (guarded) { dmg = Math.max(1, Math.ceil(dmg / 2)); if (h === hits - 1) def.guard = false; }
      dmg = storyDmg(def, dmg); jkPop(att, def, defA);
      def.hp = Math.max(0, def.hp - dmg);
      defA.flash = 0.3; defA.shake = 0.5;
      pop(defA.x, GROUND - 38 - h * 5, dmg, '#ffdf3a');
      if (guarded && h === 0) pop(defA.x, GROUND - 46, 'GUARD', '#a8d8ff');
      G.hitStop = h === hits - 1 ? 0.18 : 0.06; G.flashT = 0.1; G.shakeT = 0.4;
      burst(defA.x - dir * 4, f.y + 1, 'spark', h === hits - 1 ? 16 : 8, f.col);
      burst(defA.x - dir * 6, GROUND - 14, 'hit', 10);
      SFX.hit('strong');
      if (G.battle && def === ally()) addBond(dmg / def.maxHp * 110);
      if (G.battle && G.friend && def === G.battle.w) addBond(dmg / def.maxHp * 110, true);
      while (f.t < f.dur + f.hold) yield;
      G.fx.splice(G.fx.indexOf(f), 1);
      if (def.hp <= 0) break;
    }
    yield* tween(v => attA.ox = v, attA.ox, 0, 0.2);
    yield* wait(0.35);
  }
  // pixel-art special: plays the attacker's cast frames, launches shots on fire steps, holds until they land
  function* artStrike(attA, att, defA, def, mv, A, fxSp) { yield* artStrike0(attA, att, defA, def, mv, A, fxSp); afterMove(att, mv); }
  function* artStrike0(attA, att, defA, def, mv, A, fxSp) {
    const dir = Math.sign(defA.x - attA.x) || 1, C = A.cast, frames = SPR[attA.key].attack, img0 = FXIMG[fxSp || att.sp];
    const sup = !!mv.super, img = { shot: (sup && img0.shotS) || img0.shot, hit: (sup && img0.hitS) || img0.hit };
    const scS = sup && !img0.shotS ? mv.scale || 1.75 : mv.artScale || 1, scH = sup && !img0.hitS ? mv.scale || 1.75 : mv.artScale || 1;
    const hits = C.fire.length, total = Math.max(8, calcDmg(att, def, mv));
    const local = (fi) => { const p = C.spawn[fi]; return { x: attA.x + attA.ox - 16 + (dir > 0 ? p[0] : 31 - p[0]), y: GROUND - 30 + p[1] }; };
    const shots = []; let landed = 0;
    const land = (f) => {
      f.landed = true; landed++;
      let dmg = hits > 1 ? Math.max(1, Math.round(total / hits)) : total;
      const guarded = !!def.guard;
      if (guarded) { dmg = Math.max(1, Math.ceil(dmg / 2)); if (landed === hits) def.guard = false; }
      dmg = storyDmg(def, dmg); jkPop(att, def, defA);
      def.hp = Math.max(0, def.hp - dmg);
      defA.flash = 0.3; defA.shake = 0.5;
      pop(defA.x, GROUND - 38 - (landed - 1) * 5, dmg, '#ffdf3a');
      if (guarded && landed === 1) pop(defA.x, GROUND - 46, 'GUARD', '#a8d8ff');
      const hx = f.mode === 'glove' ? f.x1 + dir * 9 : f.mode === 'beam' ? defA.x - dir * 4 : defA.x - dir * 2;
      const hy = f.mode === 'glove' ? f.y1 : GROUND - 14;
      if (sup) { G.flashT = 0.2; burst(defA.x, GROUND - 16, 'spark', 24, mv.col || '#ff7aff'); }
      if (!f.noHit) G.fx.push({ type: 'ahit', img: img.hit, sc: scH, ms: A.hit.ms, x: hx, y: hy, t: 0, dur: img.hit.length * A.hit.ms / 1000, hold: 0, loopHit: f.mode === 'beam' ? f : null });
      G.hitStop = landed === hits ? (sup ? 0.26 : 0.16) : 0.05; G.flashT = Math.max(G.flashT, 0.08); G.shakeT = sup ? 0.6 : 0.35;
      SFX.hit('strong');
      if (G.battle && def === ally()) addBond(dmg / def.maxHp * 110);
      if (G.battle && G.friend && def === G.battle.w) addBond(dmg / def.maxHp * 110, true);
    };
    const launch = (fi, k) => {
      const p = local(fi), m = A.shot.mode;
      const f = { type: 'ashot', mode: m, img: img.shot, sc: scS, ms: A.shot.ms, ax: A.shot.ax, ay: A.shot.ay, dir, t: 0, hold: 0,
        x0: p.x, y0: p.y, x1: defA.x - dir * 6, y1: p.y };
      if (m === 'fly') { f.y1 = GROUND - 15; f.dur = Math.max(0.15, Math.abs(f.x1 - f.x0) / (A.shot.spd || 170)); }
      else if (m === 'beam') { f.x1 = defA.x - dir * 2; f.dur = 0.14; f.hold = 99; }
      else { const off = [[-22, -7], [-20, 5], [-14, -1]][k % 3]; f.x1 = defA.x + dir * off[0]; f.y1 = GROUND - 14 + off[1]; f.dur = Math.max(0.08, Math.abs(f.x1 - f.x0) / 260); f.hold = 0.12; }
      shots.push(f); G.fx.push(f); SFX.hit('attack');
    };
    // target-anchored magic circle (FX_ART[sp].circle, e.g. まじょネコ): fx anchor (ax,ay) on the target's 32x32 frame point (tx,ty); per-frame layer behind / in front of the target
    const CI = mv.circle && A.circle && img0.circle;
    const circle = () => {
      const c = A.circle, f = { type: 'acircle', img: img0.circle, c, t: 0, x: defA.x + (defA.ox || 0) - 16 + c.tx - c.ax, y: GROUND - 30 + c.ty - c.ay, dur: c.dur.slice(0, c.land).reduce((a, b) => a + b, 0) / 1000, total: c.dur.reduce((a, b) => a + b, 0) / 1000, noHit: true };
      shots.push(f); G.fx.push(f); SFX.hit('attack');
    };
    const tick = () => { for (const f of shots) if (!f.landed && f.t >= f.dur && def.hp > 0) land(f); };
    const hold = function* (sec) { let t = 0; while (t < sec) { tick(); yield; t += DT; } };
    for (let k = 0; k < C.order.length; k++) {
      const fi = C.order[k];
      attA.pose = frames ? frames[fi] : null;   // no cast art (base-form noEvo plush): fire from the standing sprite
      if (CI ? k === A.circle.start : C.fire.includes(k)) CI ? circle() : launch(fi, C.fire.indexOf(k));
      yield* hold(C.dur[fi] / 1000);
      if (k === C.hold) while (shots.some(f => !f.landed) && def.hp > 0) { tick(); yield; }
      if (k === C.hold) for (const f of shots) if (f.mode === 'beam') f.hold = Math.min(f.hold, f.t - f.dur + 0.12);
    }
    attA.pose = null;
    let t = 0; while ((shots.some(f => !f.landed) && def.hp > 0 && t < 1.5) || G.fx.some(f => f.type === 'ahit' || f.type === 'acircle')) { tick(); yield; t += DT; }
    for (const f of shots) { const i = G.fx.indexOf(f); if (i >= 0) G.fx.splice(i, 1); }
    yield* tween(v => attA.ox = v, attA.ox, 0, 0.15);
    yield* wait(0.3);
  }
  function drawArtFx(cam, layer) {
    for (let i = G.fx.length - 1; i >= 0; i--) {
      const f = G.fx[i];
      if (f.type === 'ahit') {
        if (layer !== 'top') continue;
        let fi = Math.floor(f.t * 1000 / f.ms);
        if (f.loopHit && G.fx.includes(f.loopHit)) fi %= 2;
        else if (fi >= f.img.length) { G.fx.splice(i, 1); continue; }
        const sc = f.sc || 1, iw = f.img[fi].n.width, hw = Math.round(iw * sc / 2);
        g.drawImage(f.img[fi].n, Math.round(f.x - cam) - hw, Math.round(f.y) - hw, Math.round(iw * sc), Math.round(iw * sc));
        continue;
      }
      if (f.type === 'acircle') {
        let fi = 0, acc = 0; const ms = f.t * 1000; while (fi < f.c.dur.length - 1 && ms >= acc + f.c.dur[fi]) acc += f.c.dur[fi++];
        if (ms >= f.total * 1000) { if (f.landed) G.fx.splice(i, 1); continue; }
        if ((f.c.layer[fi] === 'front') !== (layer === 'top')) continue;
        g.drawImage(f.img[fi], Math.round(f.x - cam), Math.round(f.y));
        continue;
      }
      if (f.type !== 'ashot' || layer !== 'under') continue;
      const life = f.t - f.dur;
      if (life > f.hold) { if (f.landed) G.fx.splice(i, 1); continue; }
      const fr = f.img[Math.floor(f.t * 1000 / f.ms) % 4], im = f.dir > 0 ? fr.n : fr.f;
      const ax = f.dir > 0 ? f.ax : 31 - f.ax;
      const p = Math.min(1, f.t / f.dur), hx = f.x0 + (f.x1 - f.x0) * p, hy = f.y0 + (f.y1 - f.y0) * p;
      if (f.mode === 'beam') {
        const a = Math.min(f.x0, hx), len = Math.round(Math.abs(hx - f.x0)), y = Math.round(f.y0) - f.ay;
        for (let o = 0; o < len; o += 32) {
          const w = Math.min(32, len - o), sx = f.dir > 0 ? 0 : 32 - w;
          const dx = f.dir > 0 ? Math.round(a - cam) + o : Math.round(a - cam) + len - o - w;
          g.drawImage(im, sx, 0, w, 32, dx, y, w, 32);
        }
      } else if (f.sc && f.sc !== 1) { const S = im.width, sc = f.sc; g.drawImage(im, Math.round(hx - cam - ax * sc), Math.round(hy - f.ay * sc), Math.round(S * sc), Math.round(S * sc)); }
      else g.drawImage(im, Math.round(hx - cam) - ax, Math.round(hy) - f.ay);
    }
  }
  function drawFxShots(cam) {
    for (const f of G.fx || []) {
      if (f.type === 'ashot' || f.type === 'ahit') continue;
      const p = Math.min(1, f.t / f.dur), head = f.x0 + (f.x1 - f.x0) * p, y = Math.round(f.y), d = f.dir;
      const X = v => Math.round(v - cam), tick = Math.floor(f.t * 20);
      const fade = f.t > f.dur ? Math.max(0, 1 - (f.t - f.dur) / Math.max(0.01, f.hold)) : 1;
      g.globalAlpha = fade;
      if (f.type === 'beam') {
        const a = Math.min(f.x0, head), b = Math.max(f.x0, head), w = Math.max(1, Math.round(b - a)), th = 5 + (tick % 2);
        rect(X(a), y - (th >> 1), w, th, f.col); rect(X(a), y - 1, w, 2, '#ffffff');
        rect(X(head) - 3, y - 4, 6, 8, f.col); rect(X(head) - 2, y - 2, 4, 4, '#ffffff');
        rect(X(f.x0) - 2, y - 4, 4, 8, '#ffffff');
      } else if (f.type === 'fire') {
        const n = Math.max(1, Math.floor(Math.abs(head - f.x0) / 5));
        for (let i = 0; i <= n; i++) {
          const x = f.x0 + (head - f.x0) * (i / n), r = 1 + Math.round(3 * i / n) + ((i + tick) % 2);
          const jy = ((i * 7 + tick * 3) % 5) - 2;
          rect(X(x) - r, y + jy - r, r * 2, r * 2, f.col); if (r > 1) rect(X(x) - r + 1, y + jy - r + 1, r * 2 - 2, r * 2 - 2, '#ffe04a');
          if (r > 2) rect(X(x) - 1, y + jy - 1, 2, 2, '#ffffff');
        }
      } else if (f.type === 'wave') {
        for (let k = 0; k < 3; k++) {
          const x = X(head - d * k * 7), h = 4 + k * 2 + (tick % 2);
          rect(x, y - h, 2, h * 2, f.col); rect(x - d, y - h - 1, 2, 2, f.col); rect(x - d, y + h - 1, 2, 2, f.col);
        }
      } else if (f.shape === 'glove') {
        const x = X(head);
        rect(x - 4, y - 3, 7, 7, '#5a1010'); rect(x - 3, y - 2, 5, 5, f.col); rect(x - 2, y - 2, 2, 1, '#ffb0a0');
        rect(x - 4 - d * 3, y - 2, 3, 5, '#ffffff');
        rect(X(head - d * 8), y, 3, 1, '#ffffff'); rect(X(head - d * 12), y - 2, 2, 1, '#ffffff');
      } else {   // orb (also multi with shape 'orb')
        const r = (f.big ? 5 : f.type === 'multi' ? 3 : 4) + (tick % 2);
        for (let k = 1; k <= 3; k++) { const tx = X(head - d * k * 4); rect(tx - 1, y - 1 + ((k + tick) % 3) - 1, 2, 2, f.col); }
        rect(X(head) - r, y - r + 1, r * 2, r * 2 - 2, f.col); rect(X(head) - r + 1, y - r, r * 2 - 2, r * 2, f.col);
        rect(X(head) - r + 2, y - r + 2, r * 2 - 4, r * 2 - 4, '#ffffff');
      }
      g.globalAlpha = 1;
    }
  }
  function* allyAttack(kind) {
    const B = G.battle, a = ally(), e = B.w;
    const mv = movesOf(a)[kind];
    a.st -= COST[kind];
    B.msg = `${a.name}の ${mv.name}！`;
    banner(B.msg, 1.3);
    yield* strikeOrArt(comp, a, e, e, mv, kind);
    if (e.hp <= 0) yield* enemyFaint();
  }
  function* enemyAttack(kind) {
    const B = G.battle, e = B.w, a = ally();
    if (!movesOf(e)[kind]) kind = 'attack';   // unknown / blocked command from the other phone
    const mv = movesOf(e)[kind];
    e.st -= COST[kind];
    B.msg = `${e.name}の ${mv.name}！`;
    banner('あいての ' + B.msg, 1.3);
    yield* strikeOrArt(e, e, comp, a, mv, kind);
    if (a.hp <= 0) yield* allyFaint();
  }
  function* enemyTurn() {
    const B = G.battle, e = B.w, a = ally();
    if (B.story && !B.story.done && ++B.story.turns > (B.story.kind === 'shiro' ? USAHIME.turns : INVASION.turns)) { yield* storyEnd(); return; }
    if (B.story) { e.st = Math.max(e.st, COST.special || COST.strong); yield* enemySpecial(); return; }   // powered up: only せいぎの にんじんシャワー
    if (B.final && B.usa && !B.usa.sw && (yield* usaLastTurn(e))) return;
    const early = e.style === 'trick';
    const ev2 = typeof EVO_MOVES !== 'undefined' && EVO_MOVES[e.sp];
    if (e.evo && ev2 && ev2.super && e.spUsed && !e.spSuper && e.hp > 0 && e.hp <= e.maxHp / 2 && rand() < 0.6) { e.spSuper = true; yield* enemySpecial(); return; }
    if (canSp(e) && !e.spUsed && e.hp < e.maxHp * (early ? 1.01 : 0.75) && rand() < (early ? 0.6 : 0.5)) { yield* enemySpecial(); return; }
    const kind = aiChoose(e, a);
    if (kind === 'guard') { e.st -= COST.guard; e.guard = true; B.msg = `${e.name}は みを まもっている！`; banner(B.msg, 1.2); burst(e.x, GROUND - 16, 'spark', 6, '#a8d8ff'); yield* wait(0.6); return; }
    const mv = movesOf(e)[kind];
    e.st -= COST[kind];
    B.msg = `${e.name}の ${mv.name}！`;
    banner(B.msg, 1.3);
    yield* strikeOrArt(e, e, comp, a, mv, kind);
    if (a.hp <= 0) yield* allyFaint();
  }
  // versus: the other side's ガード / ひっさつ
  function* oppGuard() {
    const B = G.battle, e = B.w;
    e.st -= COST.guard; e.guard = true;
    B.msg = `${e.name}は みを まもっている！`; banner('あいての ' + B.msg, 1.2);
    SFX.blip(); burst(e.x, GROUND - 16, 'spark', 6, '#a8d8ff');
    addBond(8, true); yield* wait(0.6);
  }
  function* oppSpecialVs() {
    const B = G.battle, e = B.w, a = ally(), mv = specialOf(e);
    e.st -= COST.special; B.obond = 0;
    G.cutin = { t: 0, dur: 1.15, key: e.key, name: mv.fx ? mv.name : mv.name.replace(/^きずなの /, ''), who: e.name };
    SFX.battleStart();
    while (G.cutin && G.cutin.t < G.cutin.dur) yield;
    G.cutin = null;
    B.msg = `${e.name}の ${mv.name}！`; banner('あいての ' + B.msg, 1.3);
    const fs = mv.fxSp || e.sp;
    const art = mv.fx && canSp(e) && typeof FX_ART !== 'undefined' && FX_ART[fs] && FXIMG[fs] && SPR[e.key] && (SPR[e.key].attack || SPECIES[e.sp].noEvo || mv.fxSp);
    if (art) yield* artStrike(e, e, comp, a, mv, FX_ART[fs], fs); else if (mv.fx) yield* fxStrike(e, e, comp, a, mv); else yield* strike(e, e, comp, a, mv, 'special');
    if (a.hp <= 0) yield* allyFaint();
  }
  // evolved trainer plush: one projectile special per member
  function* enemySpecial() {
    const B = G.battle, e = B.w, a = ally(), mv = specialOf(e);
    e.spUsed = true; e.st -= COST.special || COST.strong;
    B.msg = `${e.name}の ${mv.name}！`;
    banner('あいての ' + B.msg, 1.4);
    SFX.battleStart(); yield* wait(0.5);
    const fs = mv.fxSp || e.sp;
    const art = mv.fx && typeof FX_ART !== 'undefined' && FX_ART[fs] && FXIMG[fs] && SPR[e.key] && (SPR[e.key].attack || SPECIES[e.sp].noEvo || mv.fxSp);
    if (art) yield* artStrike(e, e, comp, a, mv, FX_ART[fs], fs); else if (mv.fx) yield* fxStrike(e, e, comp, a, mv); else yield* strike(e, e, comp, a, mv, 'special');
    if (a.hp <= 0) yield* allyFaint();
  }
  // ---------- final うさひめ (B.final): 本気モード, soldier swap, carrot heal. B.usa = { mad, swapped, eats, sw: { boss, q } } ----------
  function* usaLastTurn(e) {   // true = the turn was used
    const B = G.battle, U = B.usa, L = USAHIME.last, r = e.hp / e.maxHp, ready = B.finTold || e.hp <= 1;
    if (!U.swapped && !ready && r <= L.swapAt) { yield* usaSwapOut(e); return true; }
    if (!U.mad && r < L.madAt) {
      U.mad = true; banner(L.mad, 2.4); SFX.battleStart(); G.shakeT = 0.5; G.flashT = 0.25;
      burst(e.x, GROUND - 16, 'spark', 18, '#ff3a5a'); usaLaugh(e, 1.2); yield* wait(1.6);
    }
    if (!ready && U.eats < L.eatMax && rand() < (r < 0.3 ? 0.5 : r < 0.7 ? 0.2 : 0)) { yield* usaEat(e); return true; }
    if (U.mad && rand() < L.madSp) { e.st = Math.max(e.st, COST.special || COST.strong); yield* enemySpecial(); return true; }
    return false;
  }
  function* usaEat(e) {
    const B = G.battle, L = USAHIME.last;
    B.usa.eats++; banner(L.eat, 2.0); B.usaEat = { t0: G.t, x: e.x };
    for (let i = 0; i < 6; i++) { e.oy = i % 2 ? -1 : 0; SFX.blip(); yield* wait(0.18); }
    e.oy = 0; B.usaEat = null;
    const amt = Math.round(e.maxHp * L.eatAmt), before = e.hp;
    e.hp = Math.min(e.maxHp, e.hp + amt);
    SFX.level(); burst(e.x, GROUND - 16, 'spark', 14, '#9af07a');
    banner(`うさひめの HPが ${Math.round(e.hp - before)} かいふくした！`, 1.6); yield* wait(1.0);
  }
  const usaHop = function* (e, out) {   // hop out (up + fade) or hop in (drop + appear)
    yield* tween(v => { e.oy = -Math.round(Math.sin(v * Math.PI) * 14) - (out ? Math.round(v * 10) : Math.round((1 - v) * 10)); e.alpha = out ? 1 - v : v; }, 0, 1, 0.45);
    e.oy = 0; e.alpha = out ? 0 : 1;
  };
  function* usaSoldierIn(e, t) {
    const m = trainerMember(Object.assign({ style: 'power' }, t));
    Object.assign(e, m, { key: memberKey(m), guard: false, st: 5 + rand() * 25, gold: 0, spUsed: false, spSuper: false, alpha: 0 });
    banner(`せいぎぐんの ${m.name} Lv${m.lv}が とびだしてきた！`, 1.8); SFX.blip();
    yield* usaHop(e, false); burst(e.x, GROUND - 12, 'spark', 8, '#ffffff'); yield* wait(0.6);
  }
  function* usaSwapOut(e) {
    const B = G.battle, L = USAHIME.last;
    B.usa.swapped = true; banner(L.swap, 2.4); usaLaugh(e, 1.0); yield* wait(1.6);
    const boss = {}; for (const k of ['sp', 'name', 'maxHp', 'hp', 'atk', 'def', 'spd', 'lv', 'evo', 'key', 'style', 'spUsed', 'spSuper']) boss[k] = e[k];
    B.usa.sw = { boss, q: L.soldiers.slice(1) };
    yield* usaHop(e, true); yield* wait(0.2);
    yield* usaSoldierIn(e, L.soldiers[0]);
  }
  function* usaSoldierDown(e) {
    const B = G.battle, S = B.usa.sw, L = USAHIME.last;
    e.hp = 0; banner(`${e.name}を たおした！`, 1.4);
    for (let i = 0; i < 8; i++) { e.alpha = i % 2 ? 1 : 0.25; yield* wait(0.08); }
    yield* tween(v => { e.alpha = v; }, 1, 0, 0.3);
    if (S.q.length) { banner(L.next, 1.8); yield* wait(1.0); yield* usaSoldierIn(e, S.q.shift()); }
    else {
      B.usa.sw = null; Object.assign(e, S.boss, { guard: false, st: 5 + rand() * 25, alpha: 0 });
      banner(L.back, 2.2); SFX.battleStart();
      yield* usaHop(e, false); burst(e.x, GROUND - 14, 'spark', 12, '#ff9ac8'); usaLaugh(e, 0.8); yield* wait(0.8);
    }
    B.phase = 'run'; B.result = null; B.msg = '';
  }
  function drawUsaFx(cam) {
    const B = G.battle; if (!B || !B.final || !B.usa) return;
    const e = B.w;
    if (B.usaEat && PROPS.item_carrot) {   // carrot at her mouth, shrinking bite by bite
      const k = Math.min(1, (G.t - B.usaEat.t0) / 1.1), f = e.face || -1;
      g.globalAlpha = 1 - k * 0.6; drawCarrot(PROPS.item_carrot, Math.round(e.x - cam + f * 12), GROUND - 18 + Math.round(e.oy || 0), k < 0.5 ? 1 : 0.5); g.globalAlpha = 1;
    }
    if (B.usa.mad && !B.usa.sw && e.hp > 0 && e.alpha > 0) {   // 本気モード: red sparks rising around her
      for (let i = 0; i < 6; i++) {
        const q = (G.t * 1.3 + i / 6) % 1, x = Math.round(e.x - cam + Math.sin(i * 2.1 + G.t * 2) * 13), y = Math.round(GROUND - 2 - q * 30);
        g.globalAlpha = 1 - q; rect(x, y, 1, 2, i % 2 ? '#ff3a5a' : '#ffb0c0'); g.globalAlpha = 1;
      }
    }
  }
  function* enemyFaint() {
    const B = G.battle, e = B.w;
    if (B.final && B.usa && B.usa.sw) { yield* usaSoldierDown(e); return; }
    if (B.final) {   // うさひめ beaten for real: scream, then she runs (never reforms)
      B.phase = 'end'; B.result = 'win'; e.hp = 0; e.gold = 0;
      SFX.win(); banner(USAHIME.scream, 2.2); G.shakeT = 0.6; burst(e.x, GROUND - 16, 'spark', 20, '#ffffff');
      for (let i = 0; i < 10; i++) { e.shake = 0.1; yield* wait(0.1); }
      grantXp(Math.round((e.maxHp + e.atk * 2) * 0.55)); G.coins += 100;
      yield* wait(0.8); endBattle(); return;
    }
    if (B.story) { e.hp = 1; yield* storyEnd(); return; }
    if (e.mind && G.mind) { yield* mindWake(e); return; }
    if (G.versus && B.oppTeam) {
      const T = B.oppTeam; T[B.oppIdx].hp = 0;
      if (T.some(m => m.hp >= 1)) {
        banner(`${e.name}を たおした！`, 1.6);
        for (let i = 0; i < 8; i++) { e.alpha = i % 2 ? 1 : 0.25; yield* wait(0.08); }
        yield* tween(v => { e.alpha = v; }, 1, 0, 0.3);
        let i = -1;
        if (G.netRole) {   // the other peer picks; its 'next' message may already be here
          B.msg = 'あいてが えらんでいる…';
          while (B.oppNext == null && G.battle === B) yield;
          if (G.battle !== B) return;
          i = B.oppNext; B.oppNext = null;
        }
        if (!T[i] || T[i].hp < 1) i = T.findIndex(m => m.hp >= 1);
        oppSet(i); e.st = 0; e.oy = 0;
        banner(`あいては ${e.name}を くりだした！`, 1.6); SFX.blip();
        yield* tween(v => { e.alpha = v; }, 0, 1, 0.3);
        burst(e.x, GROUND - 14, 'spark', 10, '#ff9ac8');
        yield* wait(0.5);
        B.phase = 'run'; B.result = null; B.msg = '';
        return;
      }
    }
    B.phase = 'end'; B.result = 'win';
    const boss = SPECIES[e.sp].boss;
    const xp = Math.max(6, Math.round((e.maxHp + e.atk * 2) * (boss ? 0.55 : e.trainer ? 0.45 : 0.35)));
    const ups = grantXp(xp);
    const more = !!(e.trainer && e.team && e.team.length);
    if (more) {
      B.result = null;
      banner(`${e.name}を たおした！ +${xp}けいけん`, 1.6);
      for (let i = 0; i < 8; i++) { e.alpha = i % 2 ? 1 : 0.25; yield* wait(0.08); }
      yield* tween(v => { e.alpha = v; e.oy = (1 - v) * 3; }, 1, 0, 0.4);
      burst(e.x, GROUND - 12, 'spark', 10, '#fff2a0');
      yield* trainerNext(e, ups);
      return;
    }
    const coins = G.friend ? 0 : e.trainer ? (G.beaten.includes(e.trainer) ? Math.round(e.reward / 2) : e.reward) : boss ? 30 : Math.max(2, Math.round(xp / 3));
    G.coins += coins;
    if (e.trainer && !G.fought.includes(e.trainer)) G.fought.push(e.trainer);
    if (e.trainer && !G.beaten.includes(e.trainer)) G.beaten.push(e.trainer);
    SFX.win();
    banner(e.trainer ? `${e.trainerName}に かった！ +${coins}コイン`
      : boss ? `${e.name}を たおした！ +${coins}コイン さきへ すすめる！`
      : `${e.name}を たおした！ +${xp}けいけん` + (coins ? ` +${coins}コイン` : ''), 2.2);
    for (let i = 0; i < 8; i++) { e.alpha = i % 2 ? 1 : 0.25; yield* wait(0.08); }
    yield* tween(v => { e.alpha = v; e.oy = (1 - v) * 3; }, 1, 0, 0.4);
    burst(e.x, GROUND - 12, 'spark', 10, '#fff2a0');
    e.alive = false;
    if (e.gate && !G.friend && !G.versus) { G.flags['gate_' + e.gate] = 1; banner(`${e.name}を たおした！ みちが ひらけた！`, 2.2); }   // mid-boss gate stays open in the save
    if (ups) { SFX.level(); banner(`${ally().name}は レベル ${ally().lv} に あがった！`, 2.2); yield* wait(1.2); yield* tryEvolve(); }
    persist();
    yield* wait(1.0);
    endBattle();
  }
  function* trainerNext(e, ups) {
    const B = G.battle;
    if (ups) { SFX.level(); banner(`${ally().name}は レベル ${ally().lv} に あがった！`, 1.8); yield* wait(1.2); yield* tryEvolve(); }
    yield* wait(0.5);
    const t = e.team.shift(), m = trainerMember(Object.assign({ style: e.style }, t));
    Object.assign(e, m, { key: memberKey(m), guard: false, st: 5 + rand() * 25, oy: 0, alpha: 0 });
    banner(`${e.trainerName}は ${m.name} Lv${m.lv}を くりだした！`, 1.8);
    burst(e.x, GROUND - 12, 'spark', 8, '#ffffff');
    yield* tween(v => { e.alpha = v; }, 0, 1, 0.35);
    yield* wait(0.6);
    B.phase = 'run'; B.result = null; B.msg = '';
  }
  function* allyFaint() {
    const B = G.battle, a = ally();
    if (B.story) { a.hp = 1; comp.alpha = 1; yield* storyEnd(); return; }   // story battle: never a game over
    if (G.versus) {
      banner(`${a.name}は たおれた…`, 1.8);
      const left = G.party.findIndex(m => m.hp >= 1);
      if (left >= 0 && B.oppTeam) {
        for (let i = 0; i < 8; i++) { comp.alpha = i % 2 ? 1 : 0.25; yield* wait(0.08); }
        comp.alpha = 0; a.st = 0;
        yield* wait(0.5);
        B.phase = 'menu'; B.who = 'me'; G.menu = { kind: 'bswap', sel: left, forced: true };
        return;
      }
      B.phase = 'end'; B.result = 'lose';
      yield* wait(1.2);
      endBattle();
      return;
    }
    for (let i = 0; i < 8; i++) { comp.alpha = i % 2 ? 1 : 0.25; yield* wait(0.08); }
    comp.alpha = 0;
    yield* wait(0.8);
    const next = G.party.findIndex(m => m.hp >= 1);
    if (next >= 0) {
      G.active = next; comp.key = compKey(); comp.alpha = 1; ally().st = 0;
      burst(comp.x, GROUND - 10, 'spark', 8, '#ffffff');
      banner(`いけっ ${ally().name}！`, 1.4);
      if (B.phase === 'input') B.phase = 'run';
      yield* wait(0.8);
    } else if (B.final) {   // lost the final: no game over, back to the map with the carrots kept
      B.phase = 'end'; B.result = 'lose';
      banner('めのまえが まっしろに なった…', 2.2); yield* wait(1.4); G.fadeSpeed = 1.4; yield* wait(0.9);
      if (B.usa && B.usa.sw) Object.assign(B.w, B.usa.sw.boss);   // lost during the soldier phase: she is herself again
      G.battle = null; oyakoRestore(); for (const m of G.party) m.hp = m.maxHp;
      openMap(usaNode()); banner(USAHIME.lose, 3); persist();
    } else {
      B.phase = 'end'; B.result = 'lose';
      banner('めのまえが まっしろに なった…', 2.2);
      yield* wait(1.4);
      G.fadeSpeed = 1.4;
      yield* wait(0.9);
      whiteoutReset();
    }
  }
  function* recruitAction() {
    const B = G.battle, a = ally(), e = B.w, dir = B.side;
    a.st -= COST.recruit;
    B.msg = `${e.name}に てを さしのべた…`;
    banner(B.msg, 2.4);
    player.moving = true;
    yield* tween(v => player.ox = v, 0, dir * 4, 0.3);
    player.moving = false;
    SFX.hearts();
    for (let i = 0; i < 5; i++) heartTo(player.x + player.ox + dir * 6, GROUND - 18, e.x, GROUND - 16, i * 0.12);
    yield* wait(1.2);
    const p = recruitChance(e);
    B.lastP = p;
    if (G.cookie) { G.cookie = false; persist(); }
    for (let i = 0; i < 3; i++) { e.shake = 0.25; pop(e.x, GROUND - 36, '?', '#ffffff'); yield* wait(0.5); }
    const ok = G.forceRecruit != null ? G.forceRecruit : rand() < p;
    if (ok && G.party.length < TUNING.partyMax) {
      yield* takeRecruit(e);
    } else if (ok) {
      // party full: the new friend goes to the ぬいハウス in town
      B.swappedOut = true;
      (G.box = G.box || []).push(recruitMember(e));
      yield* takeRecruit(e);
      banner(`${e.name}は ぬいハウスへ いったよ`, 2.6);
      yield* wait(1.2);
    } else {
      B.msg = `${e.name}は そっぽを むいた…`;
      banner(`${e.name}は ぷいっと そっぽを むいた…`, 1.8);
      for (let i = 0; i < 4; i++) { e.face = -e.face; yield* wait(0.18); }
      yield* tween(v => player.ox = v, player.ox, 0, 0.3);
      yield* wait(0.4);
    }
  }
  // a recruited wild joins at lv1 base stats, except evolved-only species (evoOnly): they keep their level and evolved form
  function recruitMember(e) {
    G.flags = G.flags || {}; G.flags.rec = (G.flags.rec != null ? G.flags.rec | 0 : Math.max(0, G.party.length + (G.box || []).length - 1)) + 1;
    const eo = SPECIES[e.sp].evoOnly, hp = Math.max(1, Math.floor(e.hp));
    if (!eo) return newMember(e.sp, hp);
    const m = trainerMember({ sp: e.sp, lv: Math.max(e.lv || 1, eo), evo: true }); delete m.spUsed;
    m.hp = Math.min(m.maxHp, hp);
    return m;
  }
  function* takeRecruit(e) {
    const B = G.battle;
    B.phase = 'end'; B.result = 'recruit';
    for (let i = 0; i < 8; i++) heartTo(e.x, GROUND - 16, e.x + (rand() - 0.5) * 30, GROUND - 34 - rand() * 12, i * 0.05);
    burst(e.x, GROUND - 14, 'spark', 14, '#fff2a0');
    B.msg = `${e.name}が なかまに なった！`;
    SFX.recruit();
    banner(`やった！ ${e.name}が なかまに なった！`, 2.6);
    e.flash = 0.4;
    yield* wait(1.0);
    if (!B.swappedOut) G.party.push(recruitMember(e));
    persist();
    yield* tween(v => e.alpha = v, 1, 0, 0.35);
    burst(e.x, GROUND - 12, 'spark', 8, '#ffffff');
    e.alive = false;
    yield* tween(v => player.ox = v, player.ox, 0, 0.3);
    banner('C キーで つれあるく なかまを いれかえ', 2.0);
    yield* wait(0.5);
    endBattle();
  }
  function confirmSwap(i) {
    const B = G.battle;
    if (!B || B.phase !== 'swap' || i < 0 || i >= G.party.length || !B.pending) return;
    const sent = G.party[i];
    G.party[i] = B.pending;
    B.swappedOut = sent.name;
    if (i === G.active) { comp.key = compKey(); }
    banner(`${sent.name}を おうちに かえして ${B.pending.name}が なかまに！`, 2.4);
    persist();
    B.q.push((function* () {
      yield* takeRecruit(B.w);
    })());
    B.phase = 'run';
  }
  function cancelSwap() {
    const B = G.battle;
    if (!B || B.phase !== 'swap') return;
    B.pending = null;
    B.phase = 'run';
    banner('いまは つれて いかなかった', 1.6);
  }
  function* runAction() {
    const B = G.battle, a = ally(), e = B.w;
    a.st -= COST.run;
    const p = runChance(a, e, B.runTries); B.runTries++;
    B.msg = 'にげだした！';
    banner(B.msg, 1.0);
    player.face = -B.side; comp.face = -B.side;
    if (rand() < p) {
      B.phase = 'end'; B.result = 'run';
      const px = player.x, cx = comp.x;
      player.moving = comp.moving = true;
      dust(player.x, -B.side); dust(comp.x, -B.side);
      yield* tween(v => { player.x = clamp(px + v, 10, WORLD_W - 10); comp.x = cx + v; }, 0, -B.side * 50, 0.8, t => t);
      player.moving = comp.moving = false;
      banner('うまく にげきれた！', 1.5);
      e.cool = true;
      endBattle();
    } else {
      yield* tween(v => player.ox = v, 0, -B.side * 6, 0.2);
      banner('にげられなかった！', 1.3);
      B.msg = 'にげられなかった！';
      player.shake = 0.3;
      yield* wait(0.4);
      player.face = B.side; comp.face = B.side;
      yield* tween(v => player.ox = v, player.ox, 0, 0.2);
      yield* wait(0.2);
    }
  }
  function endBattle() {
    const B = G.battle;
    if (G.mind) { const M = G.mind; restoreMind(); Object.assign(B.w, M.boss, { mind: false }); B.w.key = SPECIES[M.boss.sp].sprite; }
    const need = SPECIES[B.w.sp] && SPECIES[B.w.sp].joinNeed, hasNeed = !need || G.party.concat(G.box || []).some(m => m.sp === need);
    const canJoin = B.result === 'win' && !G.friend && !G.versus && SPECIES[B.w.sp] && SPECIES[B.w.sp].recruitAfter && !(G.flags['joined_' + B.w.sp]);
    const joinAsk = canJoin && hasNeed ? B.w : null;
    const refuse = canJoin && !hasNeed ? B.w : null;   // e.g. オグリキング without オグリキャップ: won't join, stays to be fought again
    const crownTalk = B.result === 'win' && !G.friend && !G.versus && typeof CROWN !== 'undefined' && B.w.sp === CROWN.oyako.partner && !G.flags.crownTalk && ownedOguri();
    G.oppHero = null; G.arena = null;
    if (B.trainerActor) { const t = B.trainerActor; t.tx = t.homeX; t.tface = -1; }
    if (B.w.alive) { B.w.home = B.w.x; B.w.alpha = 1; B.w.moving = false; putOnPlat(B.w); }
    if (B.w.tutMob) G.wilds = G.wilds.filter(w => w !== B.w);
    if (B.tutorial && !G.flags.tut) { G.flags.tut = 1; persist(); }
    player.ox = comp.ox = 0; player.moving = comp.moving = false; comp.alpha = 1;
    for (const m of G.party) { m.st = 0; m.guard = false; }
    G.cutin = null; G.fx = []; comp.pose = null;
    B.phase = 'done';
    G.lastResult = B.result;
    if (G.versus) {
      const result = B.result;
      if (result === 'win' || result === 'lose') { G.flags = G.flags || {}; const k = result === 'win' ? 'vsW' : 'vsL'; G.flags[k] = (G.flags[k] | 0) + 1; }
      if (G.netRole === 'host' && B.oppTeam) netHostTick(true);
      vsRestore(); G.vsTeam = null;
      G.versus = false;
      G.friend = false;
      G.wilds.forEach(w => { w.alpha = 1; });
      G.battle = null;
      G.state = 'title'; if (G.hubVs) openHub();
      persist();
      banner(result === 'win' ? 'たいせん かった！ けいけんを セーブした' : result === 'lose' ? 'たいせん まけ… セーブした' : 'たいせん おわり', 2.2);
      return;
    }
    G.state = 'field';
    G.battle = null;
    if (B.story && B.story.kind === 'shiro') { usaBlown(); return; }
    if (B.story) { invasionOutro(); return; }
    if (B.final) { usaFinalOutro(B.w); return; }
    const coopWin = B.coop && B.result === 'win';
    if (B.coop) { coopRestore(); if (coopWin) { G.flags.rvCoop = 1; persist(); } }
    if (B.result === 'win' && B.w.gate && SPECIES[B.w.sp].gateLose && !G.friend && !G.versus) { say('', allyLines(SPECIES[B.w.sp].gateLose), () => { if (SPECIES[B.w.sp].gold) carrotBack(); if (coopWin) say('', RIVAL_STORY.coop.win, () => {}); }); return; }   // mid-boss: unrepentant after losing
    const rvWin = B.result === 'win' && !G.friend && !G.versus && B.trainerActor && /^rv_/.test(B.trainerActor.def.id || '') ? B.trainerActor : null;
    if (rvWin) { G.flags[rvWin.def.id] = 1; persist(); }
    const jackJoin = B.result === 'win' && !G.friend && !G.versus && B.w.sp === 'jackn_boss' && rand() < JACK_JOIN;
    const join = () => {
      if (rvWin) { say(rvWin.def.name, rvWin.def.after); return; }
      if (jackJoin) { const d = SPECIES.jackn_boss, lv = 1; /* recruits start at Lv1 */ say('ジャックン', d.joinLines, () => { G.menu = { kind: 'ask', sel: 0, sp: 'jackn', lv }; G.state = 'menu'; }); return; }
      if (!joinAsk) return;
      const sp = joinAsk.sp, nm = SPECIES[sp].name, lv = joinAsk.lv || 1;
      say(nm, SPECIES[sp].joinLines || [['…まけたわ。', 'あなたたち つよいのね'], ['わたしも いっしょに', 'つれていって くれる？']], () => { G.menu = { kind: 'ask', sel: 0, sp, lv }; G.state = 'menu'; });
    };
    if (crownTalk) { G.flags.crownTalk = 1; persist(); say('', CROWN.talk, join); }
    else if (refuse) {
      const r = refuse; say(SPECIES[r.sp].name, SPECIES[r.sp].refuseLines, () => {
        Object.assign(r, { alive: true, alpha: 1, oy: 0, hp: r.maxHp, st: 0, guard: false, spUsed: false, spSuper: false, cool: true, toHome: true });   // walk away (>110px) and back to fight again
        playEnding('hitori', () => openMap(Math.max(0, MAP_NODES.findIndex(n => n.stage === G.stage))));   // first time only
      });
    }
    else join();
  }
  function whiteoutReset() {
    coopRestore();
    G.battle = null; G.state = 'field';
    for (const m of G.party) m.hp = m.maxHp;
    G.active = 0; comp.key = compKey();
    player.x = 40; player.face = 1; player.ox = 0; comp.x = 18; comp.ox = 0; comp.alpha = 1;
    for (const w of G.wilds) if (w.alive) { Object.assign(w, { x: w.spawnX, home: w.spawnX, hp: w.maxHp, cool: false, alpha: 1, st: 0 }); putOnPlat(w); }
    G.cam = G.camT = 0;
    G.fadeSpeed = -1.2;
    banner(`${STAGES[G.stage].name}の いりぐちで めを さました`, 2.4);
    persist();
  }
  function updateBattle(dt) {
    const B = G.battle;
    if (G.netRole && G.versus && NET.paused) { netPausedTick(dt); return; }
    if (G.netRole === 'host' && G.versus) netHostTick();
    if (G.hitStop > 0) { G.hitStop -= dt; return; }
    if (G.cutin) G.cutin.t += dt;
    if (G.fx) for (const f of G.fx) f.t += dt;
    if (B.phase === 'menu') return;
    if (!B.cur && B.q.length) B.cur = B.q.shift();
    if (B.cur) { const r = B.cur.next(); if (r.done) B.cur = null; }
    if (G.battle && G.netRole === 'guest' && G.versus) { guestTick(); return; }
    if (!G.battle || B.phase === 'end' || B.phase === 'intro' || B.phase === 'done' || B.phase === 'swap') return;
    const a = ally(), e = B.w;
    const busy = !!B.cur || B.q.length > 0;
    const waiting = B.phase === 'input';
    if (busy || (waiting && G.waitMode) || (B.tut && B.tut.on)) return;
    if (!waiting) a.st = Math.min(100, a.st + stRate(a) * dt);
    e.st = Math.min(100, e.st + stRate(e) * dt);
    if (!waiting && a.st >= 100) { B.phase = 'input'; B.who = 'me'; burst(comp.x, GROUND - 30, 'spark', 5, '#ffe24a'); if (B.tutorial && !B.tut) { B.tut = { on: true, i: 0 }; B.sel = 0; } jkTutArm(B); }
    else if (e.st >= 100) {
      if (G.friend) { B.phase = 'input'; B.who = 'opp'; burst(e.x, GROUND - 30, 'spark', 5, '#ff9ac8'); }
      else B.q.push(enemyTurn());
    }
  }

  // ---------- update ----------
  function animActor(a, dt) {
    if (a.moving) a.walkT += dt;
    if (!a.moving) a.walkT = 0;
    const hasWalk = SPR[a.key] && SPR[a.key].walk;
    a.bob = a.moving && a.y === 0 && !hasWalk ? (Math.floor(a.walkT * 7) % 2 ? -1 : 0) : 0;
    if (a.flash > 0) a.flash -= dt;
    if (a.shake > 0) a.shake -= dt;
  }
  function update(dt) {
    G.t += dt;
    SFX.sync();
    if (G.tapGate) return;
    if (G.op) { G.op.t += dt; if (G.op.t >= OP_END) opEnd(); return; }
    if (G.state === 'field' && G.tutWait > 0 && !G.talk) { G.tutWait -= dt; if (G.tutWait <= 0) startTutorial(); }
    if (G.ending) updateEnding(dt);   // also during the ending talk (true ending pan)
    if (G.battle && G.battle.story && G.battle.w.hp > 0) {   // golden glow while powered up
      const e = G.battle.w; e.gold = (e.gold || 0) + dt;
      if (rand() < dt * 10) burst(e.x + (rand() - 0.5) * 20, GROUND - 4 - rand() * 26, 'spark', 1, rand() < 0.5 ? '#ffe24a' : '#fff6b0');
    }
    // うさひめ laugh (usahime_laugh.png, or a code hop without it) while her line has 「うーしっしっ」 or after usaLaugh()
    { const pg = G.state === 'talk' && G.talk && G.talk.pages[G.talk.i], laughing = pg && /^うさひめ「/.test(pg[0]) && /うーしっしっ|うしやあ/.test(pg.join(''));
      for (const a of G.wilds.concat(G.invader ? [G.invader] : [], G.talkGuests || [])) if (a && a.sp === 'usahime') {
        if (a.laughT > 0) a.laughT -= dt;
        const on = laughing || a.laughT > 0; if (on && !USF.laugh) a.oy = -(Math.floor(G.t * 10) % 2) * 2; else if (a.wasLaugh) a.oy = 0; a.wasLaugh = on;   // with the laugh art the sheet animates instead of the code hop
      } }
    if (G.battle && G.battle.final && !G.battle.auraBroke && !G.vs) {   // after the VS cut-in so the break is visible
        // aura break: usahime_aura_break.png once (code burst without the art)
      G.battle.auraBroke = 1; const e = G.battle.w; G.flashT = 0.1; G.shakeT = 0.4; e.auraBreakT = 0;
      if (!USF.brk) for (let i = 0; i < 3; i++) burst(e.x, GROUND - 16, 'spark', 12, ['#ffe24a', '#ffffff', '#ffb04a'][i]);
    }
    if (G.battle && G.battle.w && G.battle.w.auraBreakT != null) G.battle.w.auraBreakT += dt;
    updateTalkGuests(dt); updateInvFx(dt);
    if (G.buddy) {
      const o = G.party.find((m, i) => i !== G.active);
      if (!G.battle || !o) G.buddy.alpha = 0; else { G.buddy.key = memberKey(o); G.buddy.alpha = o.hp >= 1 ? 1 : 0.4; G.buddy.face = G.battle.side || 1; }
      animActor(G.buddy, dt);
    }
    if (G.state === 'field') updateField(dt);
    if (G.state === 'field' && G.invWait > 0 && (G.invWait -= dt) <= 0) startInvasion();
    if (G.fieldCo && G.state === 'field' && G.fieldCo.next().done) G.fieldCo = null;
    else if (G.state === 'battle') { physics(player, dt); physics(comp, dt); updateBattle(dt); }
    else if (G.state === 'title') { for (const w of G.wilds) w.face = -1; }
    else if (G.state === 'map') updateMap(dt);
    else if (G.state === 'talk' || G.state === 'menu') { physics(player, dt); physics(comp, dt); }
    document.body.classList.toggle('title', G.state === 'title');
    document.body.classList.toggle('has-save', !!G.hasSave);
    animActor(player, dt); animActor(comp, dt);
    for (const w of G.wilds) animActor(w, dt);
    for (const a of G.oppHero ? G.npcs.concat([G.oppHero]) : G.npcs) {
      if (a.tx != null) {
        const d = a.tx - a.x;
        if (Math.abs(d) > 0.5) { a.face = Math.sign(d); a.moving = true; a.x += Math.sign(d) * Math.min(Math.abs(d), 70 * dt); }
        else { a.x = a.tx; a.tx = null; a.moving = false; if (a.tface) a.face = a.tface; a.tface = 0; }
      }
      animActor(a, dt);
    }
    G.cam += (G.camT - G.cam) * Math.min(1, dt * 6);
    if (Math.abs(G.camT - G.cam) < 0.3) G.cam = G.camT;
    if (G.shakeT > 0) G.shakeT -= dt;
    if (G.flashT > 0) G.flashT -= dt;
    if (G.vs) { G.vs.t += dt; if (G.vs.t > 1.1) G.vs = null; }
    if (G.banner) { G.banner.t -= dt; if (G.banner.t <= 0) G.banner = null; }
    if (G.pendBan && (G.state === 'field' || G.state === 'map')) { banner(G.pendBan[0], G.pendBan[1] + 1); G.pendBan = null; }
    G.fade = clamp(G.fade + G.fadeSpeed * dt, 0, 1);
    for (const p of G.particles) {
      if (p.type === 'heartTo') {
        p.t += dt;
        const k = clamp(p.t / p.dur, 0, 1);
        p.x = p.x0 + (p.x1 - p.x0) * k; p.y = p.y0 + (p.y1 - p.y0) * k - Math.sin(k * Math.PI) * 10;
        if (p.t >= p.dur + 0.15) p.life = 0;
      } else {
        p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt;
        p.vy += (p.type === 'dust' ? 10 : 60) * dt; p.vx *= 0.96;
      }
    }
    G.particles = G.particles.filter(p => p.life > 0);
    for (const p of G.pops) { p.life -= dt; p.y -= 12 * dt; }
    G.pops = G.pops.filter(p => p.life > 0);
  }

  // ---------- render ----------
  const HEART = ['.##.##.', '#rr#rr#', '#rrrrr#', '.#rrr#.', '..#r#..', '...#...'];
  const HEART_S = ['.#.#.', '#####', '.###.', '..#..'];
  const ICONS = {
    sword: ['w.......w', '.w.....w.', '..w...w..', '...w.w...', '....w....', '...w.w...', '.yw...wy.', '.yy...yy.', 'y.......y'],
    bolt:  ['.....yy..', '....yy...', '...yy....', '..yyyyy..', '....yy...', '...yy....', '..yy.....', '.yy......', '.y.......'],
    heart: ['.........', '.ww...ww.', 'wwww.wwww', 'wwwwwwwww', 'wwwwwwwww', '.wwwwwww.', '..wwwww..', '...www...', '....w....'],
    star:  ['....y....', '...yyy...', 'yyyyyyyyy', '.yyyyyyy.', '..yyyyy..', '..yyyyy..', '.yyy.yyy.', '.yy...yy.', '.........'],
    shield:['.wwwwwww.', 'wwwwwwwww', 'wwyyyyyww', 'wwyyyyyww', 'wwwyyywww', '.wwwywww.', '..wwwww..', '...www...', '....w....'],
    potion:['...www...', '....w....', '...www...', '..w...w..', '.wyyyyyw.', '.wyyyyyw.', '.wyyyyyw.', '.wyyyyyw.', '..wwwww..'],
    swap:  ['...w.....', '..ww.....', '.wwwwwww.', '..ww.....', '...w.w...', '.....ww..', '.wwwwwww.', '.....ww..', '.....w...'],
    run:   ['.........', '...w.....', '..ww.....', '.wwwwwww.', 'wwwwwwwww', '.wwwwwww.', '..ww.....', '...w.....', '.........'],
  };
  // ---------- world 2: layered backgrounds + platforms (art by ドット絵作成くん, placeholders until it loads) ----------
  const LAYER = {};
  function loadLayers(st) {
    const add = (k, src) => { if (LAYER[k] !== undefined) return; LAYER[k] = null; loadImg(src).then(i => { LAYER[k] = i; }).catch(() => { LAYER[k] = false; }); };
    for (const k of ['far', 'near', 'ground']) if (artReady(st.layers + '_' + k + '.png')) add(st.id + '_' + k, st.layers + '_' + k + '.png');
    if (st.tiles) for (const k of ['l', 'm', 'r']) if (artReady(st.tiles + '_tile_' + k + '.png')) add(st.id + '_tile_' + k, st.tiles + '_tile_' + k + '.png');
  }
  function tileRow(img, cam, par, y) {
    const w = img.width, off = Math.floor(cam * par) % w;
    for (let x = -off; x < W; x += w) g.drawImage(img, x, y);
  }
  function drawLayers(cam) {
    const st = STAGES[G.stage]; if (!st.layers) return false;
    const far = LAYER[st.id + '_far'], near = LAYER[st.id + '_near'], gr = LAYER[st.id + '_ground'];
    if (!far || !gr) return false;
    tileRow(far, cam, 0.2, 0);
    if (near) tileRow(near, cam, 0.6, 0);
    tileRow(gr, cam, 1, 63);
    return true;
  }
  // item pickup sparkle (4 frames x 90ms, once), drawn over the actors
  function drawPickFx(cam) {
    if (G.pickFx) G.pickFx = G.pickFx.filter(f => {
      const fi = Math.floor((G.t - f.t0) * 1000 / 90); if (fi >= 4) return false;
      g.drawImage(f.img, fi * 16, 0, 16, 16, Math.round(f.x - cam) - 8, Math.round(f.y) - 8, 16, 16); return true;
    });
  }
  function drawPlats(cam) {
    const st = STAGES[G.stage]; if (!st.plats) return;
    const tl = LAYER[st.id + '_tile_l'], tm = LAYER[st.id + '_tile_m'], tr = LAYER[st.id + '_tile_r'];
    for (const p of st.plats) {
      const x0 = Math.round(p.x - cam), y0 = GROUND - p.h + 1, n = Math.max(1, Math.round(p.w / 16));
      if (x0 > W || x0 + p.w < 0) continue;
      for (let i = 0; i < n; i++) {
        const img = n === 1 ? tm : i === 0 ? tl : i === n - 1 ? tr : tm;
        if (img) g.drawImage(img, x0 + i * 16, y0);
        else { rect(x0 + i * 16, y0, 16, 8, '#3a2410'); rect(x0 + i * 16 + 1, y0 + 1, 14, 3, '#8ac04a'); rect(x0 + i * 16 + 1, y0 + 4, 14, 3, '#a0743c'); }
      }
    }
    // coin pickups waiting on the platforms
    (st.pickups || []).forEach((pk, i) => {
      if (G.got && G.got[pickKey(st, pk, i)]) return;
      const x = Math.round(pk.x - cam), y = GROUND - pk.h - 12 + (Math.floor(G.t * 3) % 2);
      if (x < -8 || x > W + 8) return;
      if (pk.item) {   // art: PROP_IMGS['item_' + item] (e.g. item_carrot) when drawn; placeholder pixels until then
        const idle = PROPS['item_' + pk.item + '_idle'], im = PROPS['item_' + pk.item];
        if (idle) { const fi = Math.floor(G.t * 1000 / 150) % 4; g.drawImage(idle, fi * 16, 0, 16, 16, x - 8, GROUND - pk.h - 1 - 15, 16, 16); return; }   // anchor bottom-centre (8,15)
        if (im) g.drawImage(im, x - (im.width >> 1), GROUND - pk.h - im.height - 1 + (Math.floor(G.t * 3) % 2));
        else drawPattern(['..g.g', '...g.', '..oo.', '.ooo.', '.oo..', 'oo...', 'o....'], x - 2, y - 2, { g: '#4ac040', o: '#ff8a1a' });
        if (Math.floor(G.t * 2 + i) % 3 === 0) rect(x + 3, y - 3, 1, 1, '#ffffff');
        return;
      }
      drawPattern(['.###.', '#yyy#', '#ywy#', '#yyy#', '.###.'], x - 2, y, { '#': '#8a5a10', y: '#ffd23a', w: '#fff6b0' });
    });
  }
  // ---------- endings: talk (say) on a still picture -> staff roll -> ending name -> map ----------
  const ENDIMG = {};
  const endImg = src => { if (!(typeof ASSET_DATA !== 'undefined' && ASSET_DATA[src])) return null;   // only embedded art (no 404s)
    if (ENDIMG[src] === undefined) { ENDIMG[src] = null; loadImg(src).then(i => { ENDIMG[src] = i; }).catch(() => { ENDIMG[src] = false; }); } return ENDIMG[src] || null; };
  function playEnding(id, then) {
    const D = ENDINGS[id];
    if (!D || G.flags['end_' + id]) { if (then) then(); return false; }
    G.flags['end_' + id] = 1; if (id === 'oyako') G.flags.w4hook = 1;   // w4hook: sequel teaser flag (sequel not built yet)
    persist();
    endImg(D.img); endImg(STAFF_BG);
    G.ending = { id, phase: 'talk', t: 0, then, cam: 0 }; G.menu = null; player.moving = false;
    if (D.crowd) G.ending.crowd = buildCrowd(D);
    say('', D.talk, () => { G.ending.phase = 'roll'; G.ending.t = 0; G.state = 'ending'; });
    return true;
  }
  const ROLL_GAP = 10, rollLen = () => STAFF.length * ROLL_GAP + 90 + 20;
  function updateEnding(dt) {
    const E = G.ending; if (!E) return; E.t += dt;
    const D = ENDINGS[E.id];
    if (D.crowd && E.phase === 'talk' && G.talk) {   // slow pan to the group the current line is about
      const tx = D.pan[Math.min(G.talk.i, D.pan.length - 1)], d = tx - (E.cam || 0);
      E.cam = (E.cam || 0) + Math.sign(d) * Math.min(Math.abs(d), 28 * dt);
      E.peek = G.talk.i >= D.pan.length - 2 ? Math.min(1, (E.peek || 0) + dt * 1.5) : 0;
    }
    if (E.phase === 'roll' && E.t * 12 > rollLen()) endingSkip();
    else if (E.phase === 'name' && E.t > 3) endingSkip();
  }
  function endingSkip() {
    const E = G.ending; if (!E || E.phase === 'talk') return;
    if (E.phase === 'roll') { E.phase = 'name'; E.t = 0; SFX.win(); return; }
    G.ending = null; G.state = 'field';
    if (E.then) E.then(); else openMap(G.mapSel || 0);
  }
  function endSky(dark) {
    const c = dark ? ['#0a0a22', '#141838', '#20244a'] : ['#141a48', '#283070', '#3c4890'];
    for (let i = 0; i < 3; i++) rect(0, i * 20, 160, 20, c[i]);
    rect(0, 60, 160, 30, dark ? '#1a2a1a' : '#2a5a32'); rect(0, 60, 160, 2, dark ? '#2a3a22' : '#4a8a3a');
    for (let i = 0; i < 26; i++) { const x = (i * 53 + 7) % 160, y = (i * 29 + 3) % 56; if ((Math.floor(G.t * 2) + i) % 7) rect(x, y, 1, 1, '#ffffff'); }
    rect(128, 8, 9, 9, '#fff6c8'); rect(127, 10, 11, 5, '#fff6c8'); rect(130, 7, 5, 11, '#fff6c8');
  }
  function endSpr(k, x, right, walk) {
    const s = SPR[k]; if (!s) return;
    let fr = s; if (walk && s.walk) fr = s.walk.frames[Math.floor(G.t * 1000 / s.walk.ms) % s.walk.frames.length];
    g.drawImage((right ? 1 : -1) === s.native ? fr.n : fr.f, Math.round(x) - 16, 70 - 31);
  }
  const endCrown = () => G.party.concat(G.box || []).find(m => m.sp === 'oguri' && m.crown) || null;
  // ---------- true ending: long picnic field, slow pan, plush + humans drawn by code ----------
  function buildCrowd(D) {
    const C = [], has = k => k && SPR[k];
    const add = (k, x, row, act, face, extra) => { if (has(k)) C.push(Object.assign({ k, x, row, act, face, ph: C.length * 1.7 }, extra || {})); };
    const isOyako = m => m.sp === 'oguriking' || (m.sp === 'oguri' && m.crown);
    const crown = endCrown();
    // centre group (start of the pan): オグリキング, the hero, the crowned オグリキャップ
    add('oguriking', 50, 0, 'eat', 1); add(player.key || 'player', 80, 0, 'wave', 1); add(crown ? memberKey(crown) : (SPR.oguri_evo_crown ? 'oguri_evo_crown' : 'oguri'), 110, 0, 'eat', -1);
    // the player's own plush: party first, then the most recent box members
    // せいぎぐん never join the picnic (even if owned): grunts, mid-bosses (and gold forms), うさひめ (she only peeks from the hill)
    const SEIGI = new Set(['usagihei', 'hamuranger', 'poppon', 'hotarun', 'hiyokorappa', 'mogurakouhei', 'arupakacook', 'paoon', 'kametank', 'usaknight', 'usahime']);
    const seigi = sp => SEIGI.has(sp) || SEIGI.has(String(sp).replace(/_gold$/, ''));
    const own = G.party.filter(m => !isOyako(m) && !seigi(m.sp)).concat((G.box || []).slice().reverse().filter(m => !isOyako(m) && !seigi(m.sp)));
    const ownSp = new Set(G.party.concat(G.box || []).map(m => m.sp));
    const wild = Object.keys(SPECIES).filter(k => { const d = SPECIES[k]; return !d.boss && !d.gold && !seigi(k) && !ownSp.has(k) && k !== 'oguri' && has(d.sprite); }).map(k => SPECIES[k].sprite);
    add(rivalKey(), 136, 0, 'wave', -1);   // ライバル joins the picnic next to the hero's group
    const humans = ['npc_girl', 'npc_gaki', 'npc_oneesan', 'npc_mushitori', 'npc_karate', 'npc_akira', (G.gender | 0) === 1 ? 'player' : 'hero_girl'].filter(k => has(k) && k !== rivalKey());
    const acts = ['bob', 'eat', 'walk', 'wave', 'bob', 'eat'];
    let x = 160, ow = 0;
    for (const m of own.slice(0, 8)) { add(memberKey(m), x, 0, acts[ow % acts.length], ow % 2 ? -1 : 1); x += 32; ow++; }
    // humans and plush getting along (pairs)
    x = Math.max(x + 10, 390);
    const pairs = ['share', 'pat', 'sit', 'tag', 'wave', 'share', 'pat'];
    let wi = 0; const pal = () => own.length > 8 + wi ? memberKey(own[8 + wi++]) : wild.length ? wild[(wi++) % wild.length] : 'goririn';
    humans.forEach((h, i) => { if (x > 790) return; const p = pairs[i % pairs.length], pk = pal();
      add(h, x, 0, p, 1, { pair: 'h' }); add(pk, x + (p === 'tag' ? 30 : 24), 0, p, -1, { pair: 'p' }); x += p === 'tag' ? 64 : 56; });
    for (; x < 830; x += 32) add(pal(), x, 0, acts[(x / 32 | 0) % acts.length], (x / 32 | 0) % 2 ? -1 : 1);
    // back row (half size, standing on the far slope): the rest of the plush world
    let bi = 0; for (let bx = 150; bx < 830; bx += 18) { const k = wild.length ? wild[(wi + bi) % wild.length] : null; add(k, bx, 1, acts[bi % acts.length], bi % 2 ? 1 : -1); bi++; }
    return C;
  }
  // true ending: mouth position per sprite (x, y in the 32x32 frame, facing right; mirrored for left). unmapped sprites put the carrot on the ground
  const END_MOUTH = { oguriking: [27, 15], oguri_evo_crown: [28, 20], oguri_crown: [29, 19], oguri_evo_gold: [28, 20], oguriking_gold: [27, 15],
    usagin: [28, 22], usagin_evo: [20, 15], kuuko: [17, 11], goririn: [18, 18], risurin: [28, 16], kitsunen: [28, 21], tsumaguro_evo: [28, 18],
    pengiin: [29, 17], ressan: [29, 19], haririn: [29, 20], hakuchon: [23, 12], lioneru: [18, 14], tanukin: [27, 18], nyankon: [28, 18], wankon: [29, 17] };
  const sideCarrots = {};
  function sideCarrot(face) {   // the 16x16 carrot turned on its side: tip toward the mouth
    const k = face > 0 ? 'r' : 'l'; if (sideCarrots[k]) return sideCarrots[k];
    const im = PROPS.item_carrot, [c, x] = mk(16, 16);
    x.translate(8, 8); x.rotate(face > 0 ? Math.PI / 2 : -Math.PI / 2); x.drawImage(im, -8, -8, 16, 16);
    return (sideCarrots[k] = c);
  }
  function drawCrowd(E, D) {
    const cam = Math.round(E.cam || 0), t = G.t, im = endImg(D.img);
    if (im) g.drawImage(im, -cam, 0);   // 900px painted field; no tiling (the pan stops at its right edge)
    else { endSky(false); rect(0, 20, 160, 70, '#7ac860'); rect(0, 38, 160, 52, '#96d870'); }
    // うさひめ peeks over the far hill (centre x 868, top y 42) at the very end: top-left (850,20) when fully up, clipped at the hill line
    { const ux = 850 - cam, s = SPR.usahime; if (s && ux > -40 && ux < 170) { const up = E.peek || 0, laugh = G.talk && /うーしっしっ/.test(G.talk.pages[G.talk.i].join(''));
      const fr = laugh && USF.laugh ? USF.laugh[Math.floor(t * 1000 / 160) % 4] : s, hop = laugh && !USF.laugh ? Math.floor(t * 10) % 2 : 0;
      g.save(); g.beginPath(); g.rect(ux - 4, 0, 40, 42); g.clip(); g.drawImage(s.native === -1 ? fr.n : fr.f, ux, Math.round(20 + (1 - up) * 22) - hop); g.restore(); } }
    const C = E.crowd || [];
    for (const row of [1, 0]) for (const a of C) {
      if (a.row !== row) continue;
      const sc = row ? 0.5 : 1, gy = row ? 57 : 69, sz = 32 * sc, s = SPR[a.k];
      let x = a.x, face = a.face, yo = 0, walk = false;
      const ph = t + a.ph;
      if (a.act === 'bob' || a.act === 'eat') yo = Math.floor(ph * 2) % 3 === 0 ? -1 : 0;
      if (a.act === 'wave') yo = Math.floor(ph * 3) % 2 ? -2 : 0;
      if (a.act === 'walk') { const v = Math.sin(ph * 0.6); x += v * 10; face = Math.cos(ph * 0.6) >= 0 ? 1 : -1; walk = true; }
      if (a.act === 'tag') { const v = Math.sin(ph * 0.9 - (a.pair === 'p' ? 0.6 : 0)); x += v * 14; face = Math.cos(ph * 0.9) >= 0 ? 1 : -1; walk = true; }
      if (a.act === 'pat' && a.pair === 'h') { x += Math.floor(ph * 2) % 2 ? 3 : 0; }
      if (a.act === 'sit') yo = 2;
      const sx = Math.round(x - cam);
      if (sx < -20 || sx > 180) continue;
      let fr = s; if (walk && s.walk) fr = s.walk.frames[Math.floor(t * 1000 / s.walk.ms) % s.walk.frames.length];
      const img = (face > 0 ? 1 : -1) === s.native ? fr.n : fr.f;
      if (row === 0) { g.globalAlpha = 0.25; rect(sx - 7, gy - 1, 14, 2, '#204010'); g.globalAlpha = 1; }
      if (a.act === 'sit' && a.pair === 'h') rect(sx - 6, gy - 1, 36, 3, '#e8605a');   // a little blanket they share
      g.drawImage(img, sx - sz / 2, gy - sz + 1 + yo, sz, sz);
      const C2 = PROPS.item_carrot, left = sx - sz / 2, top = gy - sz + 1 + yo;
      if (C2 && a.act === 'eat') {
        const M = END_MOUTH[a.k];
        if (M) {   // carrot held sideways in the mouth: tip in the mouth, leaves outward, on the side the plush faces, moving with its bob
          const mx = left + (face > 0 ? M[0] : 31 - M[0]) * sc, my = top + M[1] * sc, cw = 8 * sc, nib = Math.floor(ph * 3) % 2 * sc;
          g.drawImage(sideCarrot(face), face > 0 ? mx - sc - nib : mx - cw + sc + nib, my - cw / 2, cw, cw);
        } else g.drawImage(C2, sx + face * 9 * sc - 4 * sc, gy - 8 * sc, 8 * sc, 8 * sc);   // mouth not mapped: the carrot sits on the ground beside it
      }
      if (C2 && a.act === 'share' && a.pair === 'h') { const k = (Math.sin(ph) + 1) / 2; g.drawImage(C2, left + 21 + k * 4, top + 14, 8, 8); }   // offered from the hand toward the plush
      if (a.pair === 'p' && (a.act === 'pat' || a.act === 'share' || a.act === 'sit') && Math.floor(ph * 1.5) % 3 === 0) drawPattern(['.#.#.', '#####', '.###.', '..#..'], sx - 2, gy - sz - 4, { '#': '#ff6a9a' });   // heart
    }
  }
  function drawEnding() {
    const E = G.ending, D = ENDINGS[E.id];
    if (E.phase === 'talk' && D.crowd) { drawCrowd(E, D); return; }
    if (E.phase === 'talk') {
      const im = endImg(D.img);
      if (im) g.drawImage(im, 0, 0); else {
        endSky(E.id === 'hitori');
        for (const c of D.cast) {
          if (c === 'king') endSpr('oguriking', E.id === 'oyako' ? 66 : 112, E.id === 'oyako', false);
          else if (c === 'crown') { const o = endCrown(); endSpr(o ? memberKey(o) : 'oguri', 96, false, false); }
          else if (c === 'kingAlone') endSpr('oguriking', 60 + Math.min(90, E.t * 6), true, true);
          else if (c === 'party') G.party.filter(m => m.sp !== 'oguriking').slice(0, 3).forEach((m, i) => endSpr(memberKey(m), 30 + i * 24, true, false));
        }
      }
      return;
    }
    const bg = endImg(STAFF_BG);
    if (bg) g.drawImage(bg, 0, 0); else { endSky(true); rect(0, 60, 160, 30, '#10101e'); }
    if (E.phase === 'roll') {
      const y0 = 90 - E.t * 12;
      // the staffroll art has silhouettes from y58 down: the text rises from behind that line and never goes below it
      g.save(); g.beginPath(); g.rect(0, 0, 160, 57); g.clip();
      STAFF.forEach((l, i) => { const y = y0 + i * ROLL_GAP - 32; if (l && y > -8 && y < 58) T(l, 80, y, { size: i === 0 || l === 'つくったひと' ? 8 : 4, c: '#ffffff', ol: '#1a1a3a', al: 'center' }); });
      g.restore();
    }
    // the party walks along the bottom
    const team = G.party.slice(0, 4), span = 160 + team.length * 34;
    team.forEach((m, i) => endSpr(memberKey(m), ((E.t * 18 + (team.length - i) * 34) % span) - 20, true, true));
    if (E.phase === 'name') {
      g.globalAlpha = Math.min(0.6, E.t); rect(0, 22, 160, 26, '#000000'); g.globalAlpha = 1;
      T(D.title, 80, 28, { size: 8, c: '#ffe24a', ol: '#5a3418', al: 'center' });
      T('～ おしまい ～', 80, 40, { size: 4, c: '#ffffff', al: 'center' });
    }
  }
  function drawActor(a, cam) {
    if (a.alpha <= 0) return;
    const s = SPR[a.key]; const flip = a.face !== s.native;
    const cx = Math.round(a.x + a.ox - cam);
    let x = cx - 16;
    const y = GROUND - 30 + Math.round(a.y + a.oy + a.bob);
    if (a.shake > 0) x += Math.floor(a.shake * 40) % 2 ? 1 : -1;
    // ground shadow
    // shadow on whatever is under the actor (ground or a platform top)
    let base = 0;
    const pl = curPlats(); if (pl && a.y < 0) for (const p of pl) if (a.x >= p.x - 2 && a.x <= p.x + p.w + 2 && a.y <= -p.h + 0.5) base = Math.max(base, p.h);
    const shrink = Math.min(6, Math.floor((-a.y - base) / 3));
    const sw = Math.max(6, Math.min(18, s.w - 6) - shrink * 2);
    g.globalAlpha = 0.28 * a.alpha; g.fillStyle = '#1d4a12';
    g.fillRect(cx - (sw >> 1), GROUND - base, sw, 1); g.fillRect(cx - (sw >> 1) + 2, GROUND + 1 - base, sw - 4, 1);
    g.globalAlpha = a.alpha;
    let fr = s;
    if (s.walk && a.moving && (a.y === 0 || a.plat)) fr = s.walk.frames[Math.floor(a.walkT * 1000 / s.walk.ms) % s.walk.frames.length];
    if (a.pose) fr = a.pose;
    const usa = a.sp === 'usahime' && a.key === 'usahime';
    if (usa && a.wasLaugh && USF.laugh) fr = USF.laugh[Math.floor(G.t * 1000 / 160) % 4];
    // invincible (carrot-powered) until all three でんせつの にんじん are back; the rematch plays the break once, then no aura
    if (usa && a.auraBreakT == null && !G.flags.w4clear && carrotsBack() < 3 && USF.aura) g.drawImage(USF.aura[Math.floor(G.t * 1000 / 120) % 4][flip ? 'f' : 'n'], x - 8, y - 8);
    if (a.mind) {   // placeholder aura: purple glow + sparks until ドット絵作成くん's overlay arrives
      const AU = SPR.mind_aura;
      if (AU) g.drawImage(flip ? AU.f : AU.n, x, y);
      else {
        const src = flip ? fr.wf : fr.wn, ck = flip ? '_pf' : '_pn';
        if (src && !fr[ck]) { const [c, x2] = mk(src.width, src.height); x2.drawImage(src, 0, 0); x2.globalCompositeOperation = 'source-in'; x2.fillStyle = '#a040ff'; x2.fillRect(0, 0, c.width, c.height); fr[ck] = c; }
        if (fr[ck]) { g.globalAlpha = 0.55 + 0.25 * Math.sin(G.t * 6); for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) g.drawImage(fr[ck], x + dx, y + dy); g.globalAlpha = a.alpha; }
      }
      if (rand() < 0.15) G.particles.push({ type: 'spark', x: a.x + (rand() - 0.5) * 18, y: GROUND - 8 - rand() * 18, vx: 0, vy: -12, life: 0.5, col: '#c080ff' });
    }
    g.drawImage(flip ? fr.f : fr.n, x, y);
    if (a.flash > 0 && Math.floor(a.flash * 25) % 2 === 0) g.drawImage(flip ? fr.wf : fr.wn, x, y);
    if (usa && a.auraBreakT != null && USF.brk) { const i = Math.floor(a.auraBreakT * 1000 / 70); if (i < 6) g.drawImage(USF.brk[i][flip ? 'f' : 'n'], x - 8, y - 8); }
    g.globalAlpha = 1;
  }
  function drawBars(a, unit, cam) {
    const s = SPR[a.key];
    const cx = Math.round(a.x + a.ox - cam), t = GROUND - 30 + s.top - 9;
    const x = cx - 11;
    rect(x, t, 22, 4, '#2a1a10'); rect(x, t + 3, 22, 3, '#2a1a10');
    const hr = unit.hp / unit.maxHp;
    rect(x + 1, t + 1, 20, 2, '#5a4a40');
    rect(x + 1, t + 1, Math.ceil(20 * hr), 2, hr > 0.5 ? '#5ad448' : hr > 0.25 ? '#f0c830' : '#f04a3a');
    rect(x + 1, t + 1, Math.ceil(20 * hr), 1, hr > 0.5 ? '#9af07a' : hr > 0.25 ? '#ffe68a' : '#ff9a8a');
    rect(x + 1, t + 4, 20, 1, '#3a4a5a');
    const full = unit.st >= 100;
    rect(x + 1, t + 4, Math.floor(20 * unit.st / 100), 1, full ? (Math.floor(G.t * 6) % 2 ? '#ffe24a' : '#fff6b0') : '#48b8f0');
    drawJk(handOf(unit), x + 23, t - 1);
    const VB = G.versus && G.battle && G.battle.oppTeam;
    if (VB) {
      const list = unit === G.battle.w ? swapList({ opp: true }) : G.party;
      if (list.length > 1) list.forEach((m, i) => { const dx = x + i * 5; rect(dx, t - 5, 4, 4, '#2a1a10'); rect(dx + 1, t - 4, 2, 2, m.hp >= 1 ? (unit === G.battle.w ? '#ff6a9a' : '#6ad0ff') : '#5a4a40'); });
    } else if (unit.teamTotal > 1) {
      const left = (unit.hp > 0 ? 1 : 0) + (unit.team ? unit.team.length : 0);
      for (let i = 0; i < unit.teamTotal; i++) {
        const dx = x + i * 4, on = i < left;
        rect(dx, t - 4, 3, 3, '#2a1a10'); rect(dx + 1, t - 3, 1, 1, on ? '#ff6a6a' : '#7a6a60');
      }
    }
  }
  function drawSign(cam) {
    if ((STAGES[G.stage].theme === 'road' || STAGES[G.stage].town) && drawProp('signpost', WORLD_W - 36, cam)) return;
    const x = Math.round(WORLD_W - 36 - cam);
    if (x < -20 || x > W + 20) return;
    rect(x, GROUND - 12, 2, 13, '#6a4020');
    rect(x - 7, GROUND - 17, 16, 8, '#6a4020'); rect(x - 6, GROUND - 16, 14, 6, '#c48a48'); rect(x - 6, GROUND - 16, 14, 1, '#dca060');
    drawPattern(['......#..', '#########', '......#..'], x - 4, GROUND - 15, { '#': '#6a4020' });
  }
  const PROPS = {};
  const EDGE = 63;   // far edge of the road: props' bottom outline (row 30) sits here
  function drawProp(k, wx, cam, bottom = EDGE) {
    const im = PROPS[k]; if (!im) return false;
    const x = Math.round(wx - cam) - (im.width >> 1);
    if (x > -im.width && x < W) g.drawImage(im, x, bottom - 30);
    return true;
  }
  function drawRoadProps(cam) {
    const st = STAGES[G.stage];
    const town = st.theme === 'town';
    if (st.theme === 'road' || town) {
      const f = (town && PROPS.town_fence) || PROPS.fence;
      if (f) for (let x = -(((cam % f.width) + f.width) % f.width); x < W; x += f.width) g.drawImage(f, x, EDGE - 30);
    }
    const TK = { lamp: 'town_lamp', tree: 'town_tree', bush: 'town_flowerbed' };
    for (const d of st.decor || []) drawProp(town && PROPS[TK[d.k]] ? TK[d.k] : d.k, d.x, cam);
  }

  // placeholder buildings drawn in code (46 wide, bottom on the road's far edge) until building art arrives
  const shade = c => ({ '#3c78d8': '#2a5aa8', '#f07aa8': '#d0588a', '#c84a3a': '#a03428' }[c] || c);
  function drawBuilding(b, cam) {
    const cx = Math.round(b.x - cam), x0 = cx - 23, top = EDGE - 33, ol = '#3a2410';
    if (x0 > W + 8 || x0 + 46 < -8) return;
    const bi = PROPS['bld_' + b.k]; if (bi) { g.drawImage(bi, x0, top); return; }
    const wall = { shop: '#f8ecd0', clinic: '#f6f4ee', house: '#e8be88', nuihouse: '#fff0f6' }[b.k] || '#f0e0c0';
    const roof = { shop: '#3c78d8', clinic: '#f07aa8', house: '#c84a3a', nuihouse: '#9a6ad8' }[b.k] || '#8a5a2e';
    // wall
    rect(x0 - 1, top + 7, 48, EDGE - top - 6, ol); rect(x0, top + 8, 46, EDGE - top - 8, wall);
    rect(x0, top + 8, 46, 1, 'rgba(255,255,255,0.4)');
    if (b.k === 'shop') {
      // flat roof + striped awning
      rect(x0 - 2, top + 3, 50, 5, ol); rect(x0 - 1, top + 4, 48, 3, '#8a5a2e');
      for (let i = 0; i < 12; i++) { rect(x0 - 1 + i * 4, top + 9, 4, 5, i % 2 ? '#ffffff' : roof); rect(x0 + i * 4, top + 14, 2, 1, i % 2 ? '#ffffff' : roof); }
      rect(x0 - 1, top + 8, 48, 1, ol);
      // coin sign
      rect(cx - 4, top - 2, 9, 6, ol); rect(cx - 3, top - 1, 7, 4, '#ffd23a'); rect(cx - 1, top, 3, 2, '#c08a1a');
    } else {
      // stepped gable roof
      for (let r = 0; r < 9; r++) {
        const hw = 6 + Math.round(r * 2.3);
        rect(cx - hw - 1, top - 2 + r, hw * 2 + 2, 1, ol);
        if (r > 0) rect(cx - hw, top - 2 + r, hw * 2, 1, r % 3 === 2 ? shade(roof) : roof);
      }
      if (b.k === 'house') { rect(cx + 10, top - 6, 6, 7, ol); rect(cx + 11, top - 5, 4, 6, '#9a5a3a'); }
      if (b.k === 'clinic') drawPattern(['.##.##.', '#rr#rr#', '#rrrrr#', '.#rrr#.', '..#r#..', '...#...'], cx - 3, top + 10, { '#': ol, r: '#ff5a8a' });
    }
    // windows
    for (const wx of [x0 + 4, x0 + 34]) {
      rect(wx - 1, top + 17, 10, 9, ol); rect(wx, top + 18, 8, 7, '#9ad8f8'); rect(wx, top + 18, 8, 2, '#d0f0ff'); rect(wx + 3, top + 18, 1, 7, ol);
    }
    // door
    rect(cx - 5, EDGE - 13, 11, 14, ol); rect(cx - 4, EDGE - 12, 9, 13, b.k === 'clinic' ? '#e87aa0' : '#9a6234');
    rect(cx - 4, EDGE - 12, 9, 1, 'rgba(255,255,255,0.3)'); rect(cx + 2, EDGE - 6, 1, 1, '#ffe24a');
    // step
    rect(cx - 7, EDGE, 15, 1, '#b8a888');
  }
  function drawTown(cam) {
    const st = STAGES[G.stage];
    for (const b of st.buildings || []) drawBuilding(b, cam);
  }
  function drawNearMark(cam) {
    const n = G.near; if (!n || G.state !== 'field') return;
    const bob = Math.floor(G.t * 3) % 2;
    if (n.type === 'npc') {
      const x = Math.round(n.a.x - cam), y = GROUND - 30 + SPR[n.a.key].top - 9 - bob;
      drawPattern(['.#######.', '#wwwwwww#', '#w#w#w#w#', '#wwwwwww#', '.###.###.', '....##...', '....#....'], x - 4, y - 2, { '#': '#3a2410', w: '#ffffff' });
    } else {
      const x = Math.round(n.b.x - cam), y = EDGE - 20 - bob;
      drawPattern(['#####', '.###.', '..#..'], x - 2, y, { '#': '#ffe24a' });
    }
  }
  function drawBench(cam) {
    const bx = STAGES[G.stage].bench; if (bx == null) return;
    if (drawProp('bench', bx, cam)) {
      if (!G.benchUsed && Math.floor(G.t * 3) % 2) { const x = Math.round(bx - cam); rect(x - 1, EDGE - 32, 2, 2, '#ffe24a'); }
      return;
    }
    const x = Math.round(bx - cam) - 10; if (x < -24 || x > W + 4) return;
    rect(x + 2, GROUND - 5, 2, 6, '#5a3418'); rect(x + 16, GROUND - 5, 2, 6, '#5a3418');
    rect(x, GROUND - 7, 20, 3, '#5a3418'); rect(x + 1, GROUND - 6, 18, 1, '#c48a48');
    rect(x + 1, GROUND - 13, 18, 5, '#5a3418'); rect(x + 2, GROUND - 12, 16, 1, '#c48a48'); rect(x + 2, GROUND - 10, 16, 1, '#b07a3c');
    rect(x + 2, GROUND - 8, 2, 1, '#5a3418'); rect(x + 16, GROUND - 8, 2, 1, '#5a3418');
    if (!G.benchUsed && Math.floor(G.t * 3) % 2) { rect(x + 9, GROUND - 19, 2, 2, '#ffe24a'); }
  }
  // ---------- world map (placeholder art until the 160x90 map picture arrives) ----------
  function drawMap() {
    const W = G.world | 0, art = W ? PROPS['wmap' + (W + 1)] : PROPS.wmap;
    if (art) g.drawImage(art, 0, 0);
    else { if (!MAPBG) MAPBG = buildMapBG(); g.drawImage(MAPBG, 0, 0); if (WORLD_TINTS[W]) { g.fillStyle = WORLD_TINTS[W]; g.fillRect(0, 0, 160, 90); } }
    // drifting clouds over the sky strip
    if (!art) for (let i = 0; i < 3; i++) {
      const X = Math.round(((i * 61 + G.t * 2) % 200) - 20), Y = 1 + i * 2;
      rect(X, Y + 1, 14, 2, '#ffffff'); rect(X + 3, Y, 7, 1, '#ffffff'); rect(X + 1, Y + 3, 12, 1, '#dcefff');
    }
    // paths: dirt road once opened, faint dots while locked
    for (let k = 0; k < MAP_NODES.length - 1; k++) {
      const a = MAP_NODES[k], b = MAP_NODES[k + 1], n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y));
      const open = k + 1 < G.unlocked;
      if (art) { const sg = PROPS[(W ? 'w' + (W + 1) + 'seg' : 'wseg') + k]; if (sg) { if (open) g.drawImage(sg, 0, 0); continue; } }
      for (let j = 0; j <= n; j++) {
        const X = Math.round(a.x + (b.x - a.x) * j / n), Y = Math.round(a.y + (b.y - a.y) * j / n);
        if (open) { rect(X - 1, Y - 1, 3, 3, '#a0743c'); }
        else if (j % 4 === 0) rect(X, Y, 1, 1, '#d8f0c0');
      }
      if (open) for (let j = 0; j <= n; j++) {
        const X = Math.round(a.x + (b.x - a.x) * j / n), Y = Math.round(a.y + (b.y - a.y) * j / n);
        rect(X, Y, 1, 1, '#f0d8a0');
      }
    }
    MAP_NODES.forEach((n, i) => {
      const st = STAGES[n.stage], open = i < G.unlocked, clr = n.stage != null && G.cleared.includes(n.stage), sel = i === G.mapSel;
      const fill = open ? (clr ? '#ffd23a' : '#f45a5a') : '#9a9a9a';
      if (st && st.town) {
        // town = a little house instead of a badge
        drawPattern(['....#....', '...#r#...', '..#rrr#..', '.#rrrrr#.', '#rrrrrrr#', '.#wwwww#.', '.#wwdww#.', '.#wwdww#.', '.#######.'], n.x - 4, n.y - 5,
          { '#': '#3a2410', r: open ? '#e04a4a' : '#8a8a8a', w: open ? (clr ? '#ffe98a' : '#fff6e0') : '#c8c8c8', d: '#8a5a2e' });
        if (clr) drawPattern(['#'], n.x, n.y - 2, { '#': '#ffd23a' });
      } else {
        rect(n.x - 5, n.y - 3, 11, 7, '#3a2410'); rect(n.x - 4, n.y - 4, 9, 9, '#3a2410');
        rect(n.x - 4, n.y - 3, 9, 7, fill);
        rect(n.x - 3, n.y - 3, 7, 1, 'rgba(255,255,255,0.5)');
        if (clr) drawPattern(['..#..', '#####', '.###.', '#.#.#'], n.x - 2, n.y - 2, { '#': '#ffffff' });
      }
      if (!open) tiny('?', n.x - 1, n.y - 2, '#ffffff');
      if (st && st.id === 'shironaka' && G.flags.end_oyako && !G.flags.invaded && Math.floor(G.t * 3) % 2) {   // the invasion is waiting here
        if (PROPS.mark_red) g.drawImage(PROPS.mark_red, n.x - 4, n.y - 19, 16, 16);   // art: 32x32, drawn at half size above the node
        else { rect(n.x + 4, n.y - 12, 5, 8, '#5a1010'); rect(n.x + 5, n.y - 11, 3, 6, '#ff3a3a'); tiny('!', n.x + 5, n.y - 11, '#ffffff'); }
      }
      if (st && W === 3 && G.flags.usaLoss && !G.flags.w4clear) {   // うさひめ arc: red ！ = a carrot to take back here; gold ！ on しろ once all 3 are back
        const all = carrotsBack() >= 3;
        if (all && st.id === 'seishiro') { if (PROPS.mark_gold) g.drawImage(PROPS.mark_gold, n.x + 4, n.y - 21 + (Math.floor(G.t * 3) % 2), 16, 16); }
        else if (!G.flags['gate_gold_' + st.id] && Math.floor(G.t * 3) % 2 && PROPS.mark_red) g.drawImage(PROPS.mark_red, n.x + 4, n.y - 21, 16, 16);
      }
      if (sel && Math.floor(G.t * 4) % 2) { g.strokeStyle = '#ffffff'; g.lineWidth = 1; g.strokeRect(n.x - 6.5, n.y - 6.5, 14, 13); }
    });
    // boy on the map (feet on the node)
    const s = SPR[player.key] || SPR.player, p = G.mapPos;
    let fr = s; if (s.walk && player.moving) fr = s.walk.frames[Math.floor(G.t * 1000 / s.walk.ms) % s.walk.frames.length];
    g.drawImage(player.face !== s.native ? fr.f : fr.n, Math.round(p.x) - 16, Math.round(p.y) - 33);
    if (G.talk && G.talk.rival && SPR[rivalKey()]) { const r = SPR[rivalKey()]; g.drawImage(r.native === -1 ? r.n : r.f, 8, 39); }   // ライバル steps in (just under the talk box, left)
    // text box
    rect(3, 72, 154, 17, '#5a3418'); rect(4, 73, 152, 15, '#f4e4b8');
    const n = MAP_NODES[G.mapSel], name = n.stage != null ? STAGES[n.stage].name : n.name;
    const clr = n.stage != null && G.cleared.includes(n.stage);
    T(WORLD_NAMES[W], 80, 1, { size: 4, c: '#ffffff', ol: '#1a3a5a', al: 'center' });
    T(name + (clr ? ' ★クリア' : ''), 7, 75);
    // world-to-world guidance at the ends of the map
    const blink = Math.floor(G.t * 3) % 2;
    const toW2 = canNext(), toW1 = W > 0 && G.mapSel === 0, nN = toW2 && WORLD_NAMES[W + 1], pN = toW1 && WORLD_NAMES[W - 1];
    if (toW2 && blink) T(nN + ' →', 157, 64, { size: 4, c: '#ffffff', ol: '#1a4a2a', al: 'right' });
    if (toW1 && blink) T('← ' + pN, 3, 64, { size: 4, c: '#ffffff', ol: '#1a3a5a' });
    T(n.stage == null ? 'まだ じゅんびちゅう' : (toW2 ? (TOUCH ? `▶で ${nN}へ ／ タップで はいる` : `→で ${nN}へ ／ Enterで はいる`) : toW1 ? (TOUCH ? `◀で ${pN}へ ／ タップで はいる` : `←で ${pN}へ ／ Enterで はいる`) : (TOUCH ? '◀▶で えらぶ ／ ここを タップで はいる' : '←→で えらぶ ／ Enterで はいる')), 7, 81, { c: '#7a5a30' });
  }
  // world-map background, drawn once in code: each place gets its own patch of scenery (placeholder until map art for 8 places)
  let MAPBG = null;
  function buildMapBG() {
    const [c, x] = mk(W, H);
    const R = (X, Y, w, h, col) => { x.fillStyle = col; x.fillRect(X, Y, w, h); };
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const blob = (cx, cy, rx, ry, col, edge) => {
      for (let yy = -ry; yy <= ry; yy++) {
        const hw = Math.round(rx * Math.sqrt(1 - (yy * yy) / (ry * ry)));
        R(cx - hw, cy + yy, hw * 2 + 1, 1, col);
        if (edge) { R(cx - hw - 1, cy + yy, 1, 1, edge); R(cx + hw + 1, cy + yy, 1, 1, edge); }
      }
    };
    const tree = (X, Y, leaf, dark) => { R(X - 1, Y - 4, 3, 1, leaf); R(X - 2, Y - 3, 5, 2, leaf); R(X - 2, Y - 1, 5, 1, dark); R(X, Y, 1, 2, '#6a4020'); };
    const house = (X, Y, roof) => { R(X - 2, Y - 5, 5, 1, roof); R(X - 3, Y - 4, 7, 2, roof); R(X - 2, Y - 2, 5, 3, '#fff6e0'); R(X, Y - 1, 1, 2, '#8a5a2e'); R(X - 3, Y - 4, 7, 1, '#3a2410'); };
    // grass + sky strip + far hills
    R(0, 0, W, H, '#6cc547');
    R(0, 0, W, 9, '#8fd0fa'); R(0, 0, W, 3, '#72c0f8');
    for (let X = 0; X < W; X++) { const hh = 2 + Math.round(2 * Math.sin(X / 9) + Math.sin(X / 4)); R(X, 9 - hh, 1, hh + 1, '#58b03e'); }
    for (let i = 0; i < 140; i++) R(Math.floor(rnd() * W), 10 + Math.floor(rnd() * 62), 2, 1, rnd() < 0.5 ? '#5db23f' : '#7ad455');
    // a pond and a stream for variety
    blob(48, 30, 8, 3, '#4aa0e8', '#3a7ac0'); R(42, 29, 4, 1, '#a8dcff');
    // scenery per place
    for (const n of MAP_NODES) {
      const st = STAGES[n.stage]; if (!st) continue;
      const th = st.theme;
      if (th === 'day') { blob(n.x, n.y + 1, 9, 5, '#8ee06a'); for (let i = 0; i < 6; i++) R(n.x - 8 + Math.floor(rnd() * 16), n.y - 3 + Math.floor(rnd() * 8), 1, 1, rnd() < 0.5 ? '#ffffff' : '#ff9ac8'); }
      else if (th === 'road') { for (let i = -10; i <= 8; i += 3) { R(n.x + i, n.y + 6, 1, 3, '#8a5a2e'); } R(n.x - 10, n.y + 7, 19, 1, '#b07a44'); tree(n.x - 9, n.y - 4, '#3c9a40', '#2a7030'); tree(n.x + 9, n.y - 5, '#3c9a40', '#2a7030'); }
      else if (th === 'dusk') { blob(n.x, n.y + 1, 11, 6, '#e8b848', '#d09a30'); for (let i = 0; i < 10; i++) R(n.x - 9 + Math.floor(rnd() * 18), n.y - 4 + Math.floor(rnd() * 10), 1, 1, '#f8dc80'); }
      else if (th === 'forest') { blob(n.x, n.y, 12, 7, '#3e8a3a'); for (const [dx, dy] of [[-9, -2], [-4, -5], [3, -6], [9, -2], [-7, 5], [7, 5], [0, 7]]) tree(n.x + dx, n.y + dy, '#2e7a32', '#1f5a22'); }
      else if (th === 'night') { blob(n.x, n.y, 11, 7, '#2a3a6a', '#1e2a50'); for (let i = 0; i < 9; i++) R(n.x - 9 + Math.floor(rnd() * 18), n.y - 6 + Math.floor(rnd() * 12), 1, 1, rnd() < 0.4 ? '#ffffff' : '#ffe98a'); }
      else if (th === 'town') { blob(n.x, n.y + 1, 13, 7, '#c8b890', '#a8946a'); R(n.x - 12, n.y + 1, 25, 1, '#b0a07a'); house(n.x - 8, n.y - 1, '#3c78d8'); house(n.x + 8, n.y - 1, '#f07aa8'); house(n.x - 5, n.y + 7, '#c84a3a'); house(n.x + 6, n.y + 7, '#e8902a'); }
      else if (th === 'highland') { blob(n.x, n.y + 1, 11, 6, '#a8e890'); for (const dx of [-8, 0, 8]) { R(n.x + dx - 2, n.y - 7, 5, 1, '#ffffff'); R(n.x + dx - 3, n.y - 6, 7, 1, '#ffffff'); } }
      else if (th === 'canyon') { blob(n.x, n.y + 1, 12, 7, '#c4824a', '#8a5028'); for (const [dx, dy] of [[-8, -3], [7, -4], [-5, 5], [8, 4]]) { R(n.x + dx - 1, n.y + dy - 2, 3, 3, '#a8683a'); R(n.x + dx - 1, n.y + dy - 2, 3, 1, '#e0a070'); } }
    }
    return c;
  }
  function drawParticles(cam) {
    for (const p of G.particles) {
      const x = Math.round(p.x - cam), y = Math.round(p.y);
      if (p.type === 'dust') { g.globalAlpha = clamp(p.life * 2, 0, 0.8); rect(x, y, 2, 2, '#f4f0e0'); g.globalAlpha = 1; }
      else if (p.type === 'hit') { const c = Math.floor(p.life * 20) % 2 ? '#ffffff' : '#ffe24a'; rect(x - 1, y, 3, 1, c); rect(x, y - 1, 1, 3, c); }
      else if (p.type === 'spark') { if (Math.floor(p.life * 16) % 2) { rect(x - 1, y, 3, 1, p.col); rect(x, y - 1, 1, 3, p.col); } }
      else if (p.type === 'heartTo') { if (p.t >= 0) drawPattern(HEART_S, x - 2, y - 2, { '#': '#ff5a9a' }); }
    }
    for (const p of G.pops) {
      const s = String(p.text), x = Math.round(p.x - cam - tinyW(s) / 2), y = Math.round(p.y);
      if (p.kana) { if (p.life > 0.15 || Math.floor(p.life * 30) % 2) T(s, Math.round(p.x - cam), y, { al: 'center', c: p.col }); continue; }   // kana text (「レアだ！」) needs the T() font
      if (p.life > 0.15 || Math.floor(p.life * 30) % 2) tiny(s, x, y, p.col, '#2a1a10');
    }
  }
  function drawHUD() {
    const x0 = 2, y0 = 72, w = 156, h = 17;
    rect(x0 + 1, y0, w - 2, h, '#5a3418'); rect(x0, y0 + 1, w, h - 2, '#5a3418');
    rect(x0 + 1, y0 + 1, w - 2, h - 2, '#f4e4b8');
    rect(x0 + 2, y0 + 1, w - 4, 1, '#fff6d8'); rect(x0 + 2, y0 + h - 2, w - 4, 1, '#dcc48e');
    const a = ally(), B = G.battle;
    // field: hearts = active companion HP. battle: the HP bars above the plushies show it, so the stamina bar takes this row
    if (!B) {
      const halves = Math.ceil(clamp(a.hp / a.maxHp, 0, 1) * 10 - 1e-6);
      for (let i = 0; i < 5; i++) {
        const hv = clamp(halves - i * 2, 0, 2);
        const X = 5 + i * 7, Y = 73;
        drawPattern(HEART, X, Y, { '#': '#5a1a1a', r: '#c9b48a' });
        if (hv > 0) {
          g.save(); g.beginPath(); g.rect(X, Y, hv === 2 ? 7 : 4, 6); g.clip();
          drawPattern(HEART, X, Y, { '#': '#5a1a1a', r: '#e8303a' });
          g.restore();
          rect(X + 1, Y + 1, 1, 1, '#ff9a9a');
        }
      }
    } else {
      // stamina bar / READY
      const bx = 4, by = 73, bw = 49, bh = 6;
      rect(bx, by, bw, bh, '#5a3418'); rect(bx + 1, by + 1, bw - 2, bh - 2, '#d8c498');
      let label = null; const lc = '#5a3418';
      const full = a.st >= 100;
      const fw = Math.floor((bw - 2) * clamp(a.st, 0, 100) / 100);
      if (B.phase === 'end' || B.phase === 'done') {
        rect(bx + 1, by + 1, bw - 2, bh - 2, '#ffd23a');
        label = { win: 'WIN!', recruit: 'GET!', run: 'RUN', lose: 'LOSE' }[B.result] || '';
      } else if (full) {
        const blink = Math.floor(G.t * 4) % 2;
        rect(bx + 1, by + 1, bw - 2, bh - 2, blink ? '#ffd23a' : '#ffe98a');
        if (B.phase === 'input') {
          const cost = COST[COMMANDS[B.sel].kind];
          const cw = Math.round((bw - 2) * cost / 100);
          rect(bx + bw - 1 - cw, by + 1, cw, bh - 2, '#f6a868');
          if (Math.floor(G.t * 4) % 2) rect(bx + bw - 1 - cw, by + 1, 1, bh - 2, '#c0502a');
        }
        label = 'READY';
      } else {
        rect(bx + 1, by + 1, fw, bh - 2, '#48b8f0'); rect(bx + 1, by + 1, fw, 1, '#a0e2ff');
      }
      if (label) T(label, bx + bw / 2, by + 1, { al: 'center', c: lc, size: 4 });
    }
    // message box
    rect(3, 79, 50, 8, '#ead7a8'); rect(3, 79, 50, 1, '#d6bf8a');
    // command buttons (all 8 in one row)
    const swapping = B && B.phase === 'swap';
    const netWait = !!(B && G.netRole && G.versus && (NET.paused || (B.phase === 'input' && B.who === 'opp')));
    const enabled = ((B && B.phase === 'input') || swapping) && !netWait;
    for (let slot = 0; slot < NBTN; slot++) {
      const ci = slot, c = COMMANDS[ci], b = BTN[slot];
      if (!c) continue;
      const usable = swapping ? slot < G.party.length : enabled;
      const sel = swapping ? B.swapSel === slot : (enabled && B.sel === ci);
      const oy = sel ? 1 : 0;
      rect(b.x, b.y + oy, b.w, b.h - oy, '#3a2410');
      rect(b.x + 1, b.y + 1 + oy, b.w - 2, b.h - 2 - oy, c.color);
      if (c.kind === 'special' && B && !swapping) {
        const bond = clamp(sideBond(), 0, 100), fh = Math.round((b.h - 2 - oy) * (1 - bond / 100));
        if (bond < 100) rect(b.x + 1, b.y + 1 + oy, b.w - 2, fh, '#7a6a5a');
        else if (Math.floor(G.t * 6) % 2) rect(b.x + 1, b.y + 1 + oy, b.w - 2, b.h - 2 - oy, '#ffb04a');
      }
      rect(b.x + 1, b.y + 1 + oy, b.w - 2, 1, 'rgba(255,255,255,0.35)');
      rect(b.x + 1, b.y + b.h - 2, b.w - 2, 1, c.dark);
      drawPattern(ICONS[c.icon], b.x + 2, b.y + 2 + oy, { w: '#ffffff', y: '#ffe24a' });
      if (B && !swapping && ['attack', 'strong', 'special'].includes(c.kind)) {   // じゃんけん vs the current target
        const jm = B.who === 'opp' ? jkMul(B.w, a) : jkMul(a, B.w);
        if (jm > 1) drawPattern(['..#..', '.###.', '#####'], b.x + b.w - 6, b.y + 1 + oy, { '#': '#ff4a2a' });
        else if (jm < 1) drawPattern(['#####', '.###.', '..#..'], b.x + b.w - 6, b.y + 1 + oy, { '#': '#3a6ae0' });
      }
      tiny(String(slot + 1), b.x + 1, b.y + 1 + oy, '#ffffff', c.dark);
      if (!usable) { g.globalAlpha = 0.5; rect(b.x, b.y, b.w, b.h, '#8a8070'); g.globalAlpha = 1; }
      if (sel && Math.floor(G.t * 4) % 2) {
        g.strokeStyle = '#ffe24a'; g.lineWidth = 1; g.strokeRect(b.x - 0.5, b.y + oy - 0.5, b.w + 1, b.h - oy + 1);
      }
    }
    // message text (hi-res layer)
    let l1 = '', l2 = '';
    if (!B) {
      if (G.near && G.near.type === 'npc') { l1 = G.near.a.def.name; l2 = TOUCH ? 'はなしかけられる' : 'Enter:はなす'; }
      else if (G.near && G.near.type === 'bld') { l1 = G.near.b.name; l2 = TOUCH ? 'なかに はいれる' : 'Enter:はいる'; }
      else if (G.signNear) { [l1, l2] = STAGES[G.stage].exit; }
      else if (G.benchNear) { l1 = 'ベンチ'; l2 = 'ひとやすみ できた'; }
      else { l1 = `${a.name}`; l2 = `HP ${Math.floor(a.hp)}/${a.maxHp}`; }
    } else if (B.phase === 'intro') { l1 = B.w.trainer ? 'しょうぶ！' : SPECIES[B.w.sp].boss ? 'ボスの' : 'やせいの'; l2 = B.w.name + '！'; }
    else if (B.phase === 'menu') { l1 = G.menu && G.menu.kind === 'bswap' ? 'いれかえ' : 'どうぐ'; l2 = 'えらんでね'; }
    else if (B.phase === 'swap') {
      const m = G.party[B.swapSel];
      l1 = m ? m.name : '？';
      l2 = m ? 'をおうちへ' : '';
    }
    else if (B.phase === 'input') {
      const c = COMMANDS[B.sel];
      l1 = (B.who === 'opp' ? 'あいて ' : '') + `${c.label}`;
      if (['attack', 'strong', 'special'].includes(c.kind)) { const jm = B.who === 'opp' ? jkMul(B.w, a) : jkMul(a, B.w); if (jm !== 1) l1 += jm > 1 ? ' ↑つよい' : ' ↓よわい'; }
      if (B.who === 'opp') { const om = c.kind === 'special' ? (sideBond() >= 100 ? specialOf(B.w) : { name: `きずな ${sideBond()}%` }) : c.kind === 'guard' ? { name: 'ダメージ はんぶん' } : movesOf(B.w)[c.kind]; l2 = om ? om.name : ''; }
      else if (c.kind === 'recruit') l2 = B.w.trainer ? 'ひとの こは だめ' : SPECIES[B.w.sp].boss ? 'ボスは なかまに できない' : `せいこう ${Math.round(recruitChance(B.w) * 100)}%` + (G.cookie ? '♪' : '');
      else if (c.kind === 'run' && (SPECIES[B.w.sp].boss || B.w.trainer)) l2 = B.w.trainer ? 'にげられない' : 'ボスからは にげられない';
      else if (c.kind === 'run') l2 = `にげる ${Math.round(runChance(a, B.w, B.runTries) * 100)}%`;
      else if (c.kind === 'guard') l2 = 'ダメージ はんぶん';
      else if (c.kind === 'item') l2 = `もちもの ${bagList().reduce((n, k) => n + (G.items[k] | 0), 0)}こ`;
      else if (c.kind === 'swap') l2 = 'なかまと こうたい';
      else if (c.kind === 'special') l2 = sideBond() >= 100 ? specialOf(a).name : `きずな ${sideBond()}%`;
      else { const mm = movesOf(a)[c.kind]; l2 = mm ? mm.name : ''; }
    } else if (B.cur || B.phase === 'end') { const ls = wrapW(B.msg, STATUS_W); l1 = ls[0]; l2 = ls.slice(1).join(' '); }
    else { l1 = 'スタミナ'; l2 = 'ためちゅう…'; }
    if (netWait) { if (NET.paused) { l1 = 'つうしんが きれた…'; l2 = 'つなぎなおしちゅう'; } else { l1 = 'あいての ばん'; l2 = 'まってね'; } }
    T(fitW(l1, STATUS_W), 4.5, 79); T(fitW(l2, STATUS_W), 4.5, 83.5);
  }

  const STATUS_W = 48;   // text width of the status box left of the command buttons
  function drawTalk() {
    const t = G.talk; if (G.state !== 'talk' || !t) return;
    const x = 4, y = G.ending && ENDINGS[G.ending.id].crowd ? 2 : G.ending && (G.ending.id === 'oyako' || ENDINGS[G.ending.id].low) ? 64 : 14, w = 152, h = 23;   // top of the screen so the speakers stay visible (ending stills: bottom, so faces aren't covered; the true-ending field: top, over the empty sky)
    if (t.name) {
      const nw = Math.ceil(measure(t.name)) + 8;
      rect(x + 3, y - 7, nw, 8, '#5a3418'); rect(x + 4, y - 6, nw - 2, 7, '#ffd23a');
      T(t.name, x + 7, y - 5);
    }
    rect(x + 1, y, w - 2, h, '#5a3418'); rect(x, y + 1, w, h - 2, '#5a3418');
    rect(x + 1, y + 1, w - 2, h - 2, '#fff8e0'); rect(x + 2, y + h - 3, w - 4, 1, '#e8d8b0');
    const [l1, l2] = t.pages[t.i] || ['', ''];
    T(l1, x + 6, y + 5); T(l2 || '', x + 6, y + 12);
    if (Math.floor(G.t * 3) % 2) drawPattern(['#####', '.###.', '..#..'], x + w - 10, y + h - 7, { '#': '#c0502a' });
  }
  function drawMenu() {
    const M = G.menu; if (!M || !(G.state === 'menu' || (G.battle && G.battle.phase === 'menu'))) return;
    const { x, y, w, h, row0, rh } = MENU;
    rect(x + 1, y, w - 2, h, '#5a3418'); rect(x, y + 1, w, h - 2, '#5a3418');
    rect(x + 1, y + 1, w - 2, h - 2, '#fff8e0');
    T(M.kind === 'shop' ? 'ぬいショップ' : M.kind === 'bswap' ? 'いれかえ' : M.kind === 'house' ? 'ぬいハウス' : M.kind === 'ask' ? SPECIES[M.sp].name : M.kind === 'mapask' ? 'マップに もどる？' : 'どうぐ', x + 5, y + 4, { c: '#c0502a' });
    if (M.kind === 'house') T(`あずけ ${(G.box || []).length}ひき`, x + w - 5, y + 4, { al: 'right' });
    else if (M.kind === 'ask' || M.kind === 'mapask') {}
    else if (M.kind !== 'bswap') T(`${G.coins}コイン`, x + w - 5, y + 4, { al: 'right' });
    rect(x + 3, y + 10, w - 6, 1, '#e8d8b0');
    const rows = menuRows();
    if (M.sel >= rows.length) M.sel = rows.length - 1;
    M.top = Math.max(0, Math.min(M.top | 0, M.sel, rows.length - MENU_ROWS)); if (M.sel >= M.top + MENU_ROWS) M.top = M.sel - MENU_ROWS + 1;
    if (M.top > 0) T('▲', x + w - 5, row0 - 6, { al: 'right', c: '#c0502a' });
    if (M.top + MENU_ROWS < rows.length) T('▼', x + w - 5, row0 + MENU_ROWS * rh - 2, { al: 'right', c: '#c0502a' });
    rows.forEach((k, i) => {
      if (i < M.top || i >= M.top + MENU_ROWS) return;
      const yy = row0 + (i - M.top) * rh, sel = i === M.sel;
      if (sel) rect(x + 3, yy - 1, w - 6, rh, '#ffe98a');
      if (sel && Math.floor(G.t * 4) % 2) drawPattern(['#..', '##.', '###', '##.', '#..'], x + 5, yy, { '#': '#c0502a' });
      if (k === '_close') { T(M.kind === 'shop' || M.kind === 'house' ? 'でる' : M.kind === 'bswap' || M.kind === 'bitem' ? 'やめる' : 'とじる', x + 10, yy); return; }
      if (k === '_back') { T('もどる', x + 10, yy); return; }
      if (k === '_hk') { T('ひきつぎ（ほかの きかいへ）', x + 10, yy, { c: '#3c6ad8' }); return; }
      if (k === '_map') { T('マップに もどる', x + 10, yy, { c: '#3c6ad8' }); return; }
      if (k === '_home') { T('ホームに もどる', x + 10, yy, { c: '#3c6ad8' }); return; }
      if (k === '_myes') { T('はい（マップに もどる）', x + 10, yy, { c: '#3c6ad8' }); return; }
      if (k === '_mno') { T('いいえ', x + 10, yy); return; }
      if (k === '_lead') { T('せんとうに する', x + 10, yy, { c: '#3c6ad8' }); return; }
      if (k === '_up') { T('ひとつ まえへ', x + 10, yy, { c: '#3c6ad8' }); return; }
      if (k === '_put') { T('ここに あずける', x + 10, yy, { c: '#3c6ad8' }); return; }
      if (k === '_take') { T('あずけた こを つれていく', x + 10, yy, { c: '#3c6ad8' }); return; }
      if (k === '_yes') { T('なかまに する', x + 10, yy, { c: '#3c6ad8' }); return; }
      if (k === '_no') { T('こんどに する', x + 10, yy); return; }
      if (M.kind === 'house') {
        const m = k[0] === 'p' ? G.party[+k.slice(1)] : G.box[+k.slice(1)];
        T(m.name, x + 10, yy); T(`Lv${m.lv || 1}`, x + 74, yy, { c: '#7a5a30' }); T(`HP${Math.floor(m.hp)}/${m.maxHp}`, x + w - 5, yy, { al: 'right' });
        return;
      }
      if (M.kind === 'bswap') {
        const m = swapList(M)[+k.slice(1)], out = +k.slice(1) === (M.opp ? G.battle.oppIdx : G.active) && !M.forced, down = m.hp < 1;
        T(m.name + (out ? ' (でている)' : ''), x + 10, yy, { c: down ? '#b0a080' : '#4a2c12' });
        T(`Lv${m.lv}`, x + 74, yy, { c: '#7a5a30' });
        T(down ? 'たおれている' : `HP${Math.floor(m.hp)}/${m.maxHp}`, x + w - 5, yy, { al: 'right', c: down ? '#c0502a' : '#4a2c12' });
        return;
      }
      const it = ITEMS[k], have = G.items[k] | 0;
      if (k === 'candy') drawCandy(x + 2, yy + 1);
      T(it.name, x + 10, yy);
      if (M.kind === 'shop') { T(`${it.price}`, x + 86, yy, { al: 'right', c: G.coins >= it.price ? '#4a2c12' : '#b0a080' }); T(`もち${have}`, x + w - 5, yy, { al: 'right', c: '#7a5a30' }); }
      else T(`x${have}`, x + w - 5, yy, { al: 'right' });
    });
    const k = rows[M.sel];
    const desc = k === '_close' ? '' : M.kind === 'bswap' ? (M.forced ? 'つぎは だれを だす？' : M.opp ? 'あいての こうたい' : 'だれと こうたい する？')
      : M.kind === 'ask' ? 'なかまに する？' : M.kind === 'house' ? (M.pi == null ? 'てもちの だれを かえる？' : M.pi < 0 ? 'だれを つれていく？' : (G.box || []).length ? 'だれと いれかえる？' : 'まだ だれも いないよ') : ITEMS[k] ? ITEMS[k].desc : '';
    rect(x + 3, y + h - 11, w - 6, 1, '#e8d8b0');
    T(desc, x + 5, y + h - 8, { c: '#7a5a30' });
    if (M.kind === 'bag' && G.cookie) T('クッキー こうかちゅう', x + w - 5, y + h - 8 - 0, { al: 'right', c: '#d4588c' });
  }
  function wrap2(msg, n) {
    if (msg.length <= n) return [msg, ''];
    const cut = msg.lastIndexOf(' ', n);
    return cut > 0 ? [msg.slice(0, cut), msg.slice(cut + 1)] : [msg.slice(0, n), msg.slice(n)];
  }
  function drawBattleFx() {
    if (G.vs) {   // battle start: flash, two bands sweep in, "VS"
      const t = G.vs.t;
      if (t < 0.15) { g.globalAlpha = 1 - t / 0.15; rect(0, 0, W, H, '#ffffff'); g.globalAlpha = 1; }
      const k = Math.min(1, t / 0.25), out = t > 0.8 ? (t - 0.8) / 0.3 : 0;
      const c1 = G.vs.hot ? '#c8283a' : '#2a5ad8', c2 = G.vs.hot ? '#ffb020' : '#7ad0ff';
      g.globalAlpha = 1 - out;
      const bw = Math.round(W * k);
      rect(0, 24, bw, 9, '#1a1020'); rect(0, 25, bw, 7, c1);
      rect(W - bw, 37, bw, 9, '#1a1020'); rect(W - bw, 38, bw, 7, c1);
      for (let x = (Math.floor(t * 300) % 12) - 12; x < bw; x += 12) rect(x, 28, 6, 1, c2);
      for (let x = W - (Math.floor(t * 300) % 12); x > W - bw; x -= 12) rect(x, 41, 6, 1, c2);
      if (t > 0.18) T(G.vs.hot ? 'しょうぶ！' : 'バトル！', 80, 30.5, { size: 8, c: '#ffffff', ol: '#1a1020', al: 'center' });
      g.globalAlpha = 1;
    }
    if (G.cutin) {   // special move cut-in
      const c = G.cutin, t = c.t, k = Math.min(1, t / 0.18), out = t > c.dur - 0.2 ? (t - (c.dur - 0.2)) / 0.2 : 0;
      g.globalAlpha = 0.55 * (1 - out); rect(0, 0, W, H, '#100818'); g.globalAlpha = 1 - out;
      const bh = Math.round(30 * k), y0 = 34 - (bh >> 1);
      rect(0, y0 - 1, W, bh + 2, '#ffe24a'); rect(0, y0, W, bh, '#e0662a');
      for (let i = 0; i < 14; i++) { const yy = y0 + ((i * 7 + Math.floor(t * 40)) % Math.max(1, bh)); rect((i * 37 + Math.floor(t * 400)) % (W + 30) - 30, yy, 18, 1, '#ffb04a'); }
      const s = SPR[c.key];
      if (s && bh > 20) { const x = Math.round(-64 + Math.min(1, t / 0.3) * 84); const im = s.native === 1 ? s.n : s.f; g.drawImage(im, x, y0 + bh - im.height * 2 + 2, im.width * 2, im.height * 2); }
      if (t > 0.25) {
        const sz = measure(c.name, 8) <= W - 72 ? 8 : 4, tx = Math.round(W + 4 - Math.min(1, (t - 0.25) / 0.2) * (W - 66));
        T(c.who + 'の きずなの', tx, y0 + 6, { size: 4, c: '#ffffff', ol: '#4a1a08' }); T(c.name, tx, y0 + (sz === 8 ? 14 : 16), { size: sz, c: '#ffffff', ol: '#4a1a08' });
      }
      g.globalAlpha = 1;
    }
    if (G.flashT > 0) { g.globalAlpha = Math.min(1, G.flashT / 0.08) * 0.8; rect(0, 0, W, H, '#ffffff'); g.globalAlpha = 1; }
  }
  // ---------- ホーム (app-style hub between the title and the game) ----------
  const HUB_BTNS = [
    { id: 'quest',  name: 'クエスト',     x: 4,   y: 13, w: 74, h: 31, col: '#f45a5a' },
    { id: 'event',  name: 'イベント',     x: 82,  y: 13, w: 36, h: 31, col: '#ff9a2a' },
    { id: 'zukan',  name: 'ずかん',       x: 121, y: 13, w: 35, h: 31, col: '#47a83a' },
    { id: 'vs',     name: 'たいせん',     x: 4,   y: 47, w: 36, h: 31, col: '#3c6ad8' },
    { id: 'train',  name: 'トレーニング', x: 43,  y: 47, w: 36, h: 31, col: '#8656cc' },
    { id: 'gacha',  name: 'ガチャ',       x: 82,  y: 47, w: 36, h: 31, col: '#f96ab4' },
    { id: 'items',  name: 'アイテム',     x: 121, y: 47, w: 35, h: 31, col: '#e6b02a' },
  ];
  const LB_COINS = [30, 30, 50, 50, 80, 80, 200];   // ログインボーナス: free coins for stamps 1..7 (no purchases anywhere)
  const jstDay = (ms) => new Date((ms == null ? Date.now() : ms) + 9 * 3600e3).toISOString().slice(0, 10);
  function openHub() {
    endSolo(); G.battle = null; G.menu = null; G.talk = null; G.hubVs = false; G.ev = null;
    G.state = 'hub'; G.hub = G.hub && G.hub.view === 'home' ? G.hub : { view: 'home', sel: 0 }; G.hub.view = 'home';
    G.fade = 1; G.fadeSpeed = -2; player.moving = false;
    // daily login bonus (once per JST calendar day; stored in the save, so the cloud save carries it too)
    const L = G.flags.lb = G.flags.lb || { d: '', n: 0 }, today = jstDay();
    if (L.d !== today) { const day = (L.n % 7) + 1; L.d = today; L.n++; const c = LB_COINS[day - 1]; G.coins += c; G.hub.lb = { day, coins: c, t: 0 }; SFX.recruit(); persist(); }
  }
  const DEX = () => Object.keys(SPECIES).filter(k => !SPECIES[k].gold && !SPECIES[k].dexHide && SPR[SPECIES[k].sprite]);
  const ownedSp = () => new Set(G.party.concat(G.box || [], G.solo ? G.solo.party : []).map(m => m.sp));
  const dexCaught = (k, own) => own.has(k) || !!G.flags['joined_' + k];
  const dexSeen = (k, own) => dexCaught(k, own) || !!(G.flags.seen && G.flags.seen[k]);
  const blackCache = {};
  function blackOf(k) {   // ずかん silhouette for みつけた but not yet a なかま
    if (blackCache[k]) return blackCache[k];
    const s = SPR[k]; if (!s) return null; const [c, x] = mk(32, 32); x.drawImage(s.native === 1 ? s.n : s.f, 0, 0);
    x.globalCompositeOperation = 'source-in'; x.fillStyle = '#3a3048'; x.fillRect(0, 0, 32, 32); return (blackCache[k] = c);
  }
  const DEX_COLS = 4, DEX_ROWS = 2, DEX_PAGE = DEX_COLS * DEX_ROWS;
  const hubItems = () => Object.keys(ITEMS);
  function hubAct(id) {
    const H = G.hub; SFX.blip();
    if (id === 'quest') { persist(); if (!G.flags.tut) enterStage(0); else { const w = Math.max(0, worldOf(G.stage)); if (w !== (G.world | 0)) setWorld(w); openMap(Math.max(0, MAP_NODES.findIndex(n => n.stage === G.stage))); } return; }
    if (id === 'vs') { persist(); G.state = 'title'; startVersus(); G.hubVs = true; return; }
    if (id === 'zukan') { H.view = 'zukan'; H.dsel = H.dsel | 0; H.dd = null; return; }
    if (id === 'items') { H.view = 'items'; H.isel = 0; return; }
    if (id === 'train') { H.view = 'train'; H.tm = Math.min(H.tm | 0, G.party.length - 1); H.tt = H.tt | 0; H.tfx = null; return; }
    if (id === 'gacha') { H.view = 'gacha'; H.gn = H.gn | 0; H.odds = false; H.gres = null; return; }
    if (id === 'event') { H.view = 'event'; return; }
  }
  function vsBack() { if (G.hubVs) { vsRestore(); G.versus = false; openHub(); } else G.state = 'title'; }
  function hubKey(code) {
    const H = G.hub; if (!H) return;
    const ok = ['Enter', 'Space', 'NumpadEnter', 'KeyE'].includes(code), back = ['Escape', 'KeyX', 'Backspace'].includes(code);
    if (H.lb) { if (ok || back) { H.lb = null; SFX.blip(); } return; }
    const dx = (code === 'ArrowRight' || code === 'KeyD') - (code === 'ArrowLeft' || code === 'KeyA'), dy = (code === 'ArrowDown' || code === 'KeyS') - (code === 'ArrowUp' || code === 'KeyW');
    if (H.view === 'home') {
      if (dx || dy) { const n = HUB_BTNS.length; H.sel = dy ? (H.sel < 3 ? Math.min(n - 1, H.sel + 3) : Math.max(0, H.sel - 3)) : (H.sel + dx + n) % n; SFX.blip(); }
      if (ok) hubAct(HUB_BTNS[H.sel].id);
      if (back) { G.state = 'title'; G.titleScreen = 0; persist(); }
      return;
    }
    if (H.view === 'tgame') { if (ok || code === 'ArrowUp' || code === 'KeyW') tgTap(H); return; }
    if (H.view === 'gacha' && H.gres) { if (ok || back) gachaNext(H); return; }
    if (H.view === 'gacha' && H.odds) { if (ok || back) H.odds = false; return; }
    if (H.view === 'zukan' && H.dd != null) { if (ok || back) { H.dd = null; SFX.blip(); } else if (dx || dy) dexStep(H, dx || dy); return; }   // けってい / もどる close the page, つぎ flips
    if (H.view === 'zukan' && ok) { H.dd = H.dsel | 0; SFX.blip(); return; }
    if (H.view === 'zukan' && code === 'KeyR') { dexClaim(H); return; }
    if (H.view === 'zukan' && code === 'KeyJ') { jkTutOpen(); return; }
    if (back) { H.view = 'home'; SFX.blip(); return; }
    if (H.view === 'train') { if (dx) H.tm = (H.tm + dx + G.party.length) % G.party.length; if (dy) H.tt = clamp((H.tt | 0) + dy, 0, 2); if (ok) trainBuy(H, H.tt | 0); return; }
    if (H.view === 'gacha') { if (dx || dy) H.gn = H.gn ? 0 : 1; if (ok) gachaPull(H, H.gn ? 10 : 1); if (code === 'KeyO') H.odds = true; return; }
    if (H.view === 'event') { if (dx && evSpecial()) { H.evW = !H.evW; SFX.blip(); } if (ok) evStart(H); return; }
    if (H.view === 'zukan') { const n = DEX().length; H.dsel = Math.max(0, Math.min(n - 1, (H.dsel | 0) + dx + dy * DEX_COLS)); }
    if (H.view === 'items') { const n = hubItems().length; H.isel = Math.max(0, Math.min(n - 1, (H.isel | 0) + dy + dx)); }
  }
  function hubTap(x, y) {
    const H = G.hub; if (!H) return;
    if (H.lb) { H.lb = null; SFX.blip(); return; }
    if (H.view === 'tgame') { tgTap(H); return; }   // tap anywhere = lift
    if (H.view === 'gacha' && H.gres) { gachaNext(H); return; }
    if (H.view === 'gacha' && H.odds) { H.odds = false; return; }
    if (H.view !== 'home') {
      if (H.view === 'zukan' && H.dd == null && y < 11 && x >= 80 && x < 114) { jkTutOpen(); return; }
      if (y < 11 && x < 30) { if (H.view === 'zukan' && H.dd != null) H.dd = null; else H.view = 'home'; SFX.blip(); return; }   // もどる (ずかん page -> list first)
      const hit = r => x >= r[0] && x < r[0] + r[2] && y >= r[1] && y < r[1] + r[3];
      if (H.view === 'train') { G.party.forEach((m, i) => { if (hit(TR_CARD(i))) { H.tm = i; SFX.blip(); } }); TR_TIERS.forEach((t, i) => { if (hit(TR_BTN(i))) { H.tt = i; trainBuy(H, i); } }); return; }
      if (H.view === 'gacha') { if (hit(GA_BTN[0])) { H.gn = 0; gachaPull(H, 1); } else if (hit(GA_BTN[1])) { H.gn = 1; gachaPull(H, 10); } else if (hit(GA_BTN[2])) { H.odds = true; SFX.blip(); } return; }
      if (H.view === 'event') { if (evTab(H, x, y)) return; if (hit(EV_BTN)) evStart(H); return; }
      if (H.view === 'zukan' && H.dd != null) { if (y >= 70 && x >= 120) dexStep(H, x >= 140 ? 1 : -1); return; }
      if (H.view === 'zukan' && y >= 80 && x >= 116) { dexClaim(H); return; }
      if (H.view === 'zukan') {
        if (x >= 142 && y >= 12 && y < 46) { H.dsel = Math.max(0, (H.dsel | 0) - DEX_PAGE); return; }
        if (x >= 142 && y >= 46 && y < 80) { H.dsel = Math.min(DEX().length - 1, (H.dsel | 0) + DEX_PAGE); return; }
        const c = Math.floor((x - 2) / 35), r = Math.floor((y - 12) / 34);
        if (c >= 0 && c < DEX_COLS && r >= 0 && r < DEX_ROWS) { const i = Math.floor((H.dsel | 0) / DEX_PAGE) * DEX_PAGE + r * DEX_COLS + c; if (i < DEX().length) { H.dsel = i; H.dd = i; SFX.blip(); } }
      }
      if (H.view === 'items') { const i = Math.floor((y - 13) / 9); if (i >= 0 && i < hubItems().length) H.isel = i; }
      return;
    }
    const i = HUB_BTNS.findIndex(b => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h);
    if (i < 0) return;
    if (i === H.sel || TOUCH) { H.sel = i; hubAct(HUB_BTNS[i].id); }
  }
  function hubFrame(x, y, w, h, fill) {
    rect(x + 1, y, w - 2, h, '#5a3418'); rect(x, y + 1, w, h - 2, '#5a3418'); rect(x + 1, y + 1, w - 2, h - 2, fill);
  }
  function hubTop(title, back) {
    rect(0, 0, 160, 11, '#5a3418'); rect(0, 10, 160, 1, '#ffd23a');
    if (back) { hubFrame(2, 1, 26, 9, '#fff8e0'); T('もどる', 15, 3, { al: 'center', c: '#5a3418' }); }
    T(title, back ? 31 : 4, 3, { c: '#ffffff' });
    drawPattern(['.###.', '#yyy#', '#y#y#', '#yyy#', '.###.'], 120, 3, { '#': '#a8740a', y: '#ffd23a' });
    T(`${G.coins | 0}コイン`, 157, 3, { al: 'right', c: '#ffe98a' });
  }
  function drawHub() {
    const H = G.hub || { view: 'home', sel: 0 };
    // soft sky + grass backdrop
    for (let i = 0; i < 9; i++) rect(0, i * 10, 160, 10, ['#bfe6ff', '#c8eaff', '#d2eeff', '#dcf2ff', '#e6f6ff', '#e8f6d8', '#d8f0c0', '#c8e8a8', '#b8e098'][i]);
    for (let i = 0; i < 6; i++) { const X = Math.round((i * 47 + G.t * 3) % 200) - 20; rect(X, 14 + (i % 3) * 22, 12, 3, '#ffffff'); rect(X + 3, 13 + (i % 3) * 22, 6, 1, '#ffffff'); }
    if (H.view === 'zukan') return drawZukan(H);
    if (H.view === 'items') return drawHubItems(H);
    if (H.view === 'train') return drawTrain(H);
    if (H.view === 'tgame') return drawTGame(H);
    if (H.view === 'gacha') return drawGacha(H);
    if (H.view === 'event') return drawEvent(H);
    hubTop(`ホーム  ${pName()}`, false);
    if (!H.lb) HUB_BTNS.forEach((b, i) => {
      const sel = i === H.sel, bob = sel ? (Math.floor(G.t * 3) % 2) : 0;
      hubFrame(b.x, b.y - bob, b.w, b.h, sel ? '#ffe98a' : '#fff8e0');
      rect(b.x + 2, b.y - bob + 2, b.w - 4, 2, b.col);
      const cx = b.x + b.w / 2, iy = b.y - bob + 5;
      const ic = k => { const s = SPR[k]; if (s) g.drawImage(s.native === 1 ? s.n : s.f, Math.round(cx - 8), iy, 16, 16); };
      const IC = ICON16[{ quest: 'menu_quest', event: 'menu_event', zukan: 'menu_zukan', vs: 'menu_taisen', train: 'menu_training', gacha: 'menu_gacha', items: 'menu_item' }[b.id]];
      if (IC) g.drawImage(IC, Math.round(cx - 8), iy);   // hand-drawn 16x16 at 1x
      else if (b.id === 'quest') { const m = PROPS.wmap; if (m) { g.drawImage(m, 0, 0, m.width, m.height, b.x + 4, iy, 30, 17); } ic(player.key || 'player'); const s = SPR.oguri_evo_crown || SPR.oguri; if (s) g.drawImage(s.n, b.x + b.w - 22, iy, 16, 16); }
      else if (b.id === 'event') { const c = PROPS.gold_carrot || PROPS.item_carrot; if (c) g.drawImage(c, cx - 8, iy, 16, 16); }
      else if (b.id === 'zukan') { rect(cx - 7, iy + 1, 14, 15, '#3a7a2a'); rect(cx - 6, iy + 2, 12, 13, '#f0f8e0'); rect(cx - 1, iy + 2, 1, 13, '#3a7a2a'); for (let l = 0; l < 4; l++) { rect(cx - 5, iy + 4 + l * 3, 3, 1, '#a8c890'); rect(cx + 1, iy + 4 + l * 3, 4, 1, '#a8c890'); } rect(cx + 3, iy, 2, 5, '#e84a4a'); }
      else if (b.id === 'vs') { const a = SPR.goririn, o = SPR.kuuko; if (a) g.drawImage(a.n, cx - 15, iy, 16, 16); if (o) g.drawImage(o.f, cx - 1, iy, 16, 16); }
      else if (b.id === 'train') ic('kangarun');
      else if (b.id === 'gacha') { rect(cx - 6, iy + 1, 12, 7, '#f96ab4'); rect(cx - 6, iy + 8, 12, 7, '#fff6f0'); rect(cx - 6, iy + 8, 12, 1, '#5a3418'); rect(cx - 1, iy + 7, 3, 3, '#5a3418'); }
      else if (b.id === 'items') { const c = PROPS.item_carrot; if (c) g.drawImage(c, cx - 12, iy + 1, 14, 14); rect(cx + 2, iy + 5, 8, 10, '#9af07a'); rect(cx + 4, iy + 3, 4, 2, '#5a3418'); }
      T(b.name, cx, b.y - bob + b.h - 9, { al: 'center', c: '#4a2c12' });
      if (b.soon) { rect(b.x + b.w - 21, b.y - bob - 2, 19, 7, '#8a8a8a'); T('じゅんび', b.x + b.w - 11.5, b.y - bob - 1, { al: 'center', c: '#ffffff' }); }   // tag on the top edge, clear of the icon
    });
    const L = G.flags.lb; if (!H.lb) T(`ログインボーナス ${L ? ((L.n - 1) % 7) + 1 : 0}/7 にちめ`, 80, 81, { al: 'center', c: '#3a5a20' });
    if (H.lb) drawLoginBonus(H.lb);
  }
  function drawLoginBonus(lb) {
    lb.t += 1 / 60;
    g.globalAlpha = 0.55; rect(0, 0, 160, 90, '#000000'); g.globalAlpha = 1;
    hubFrame(10, 8, 140, 74, '#fff8e0'); rect(12, 10, 136, 11, '#f45a5a');
    T('ログインボーナス！', 80, 12, { al: 'center', c: '#ffffff', ol: '#7a1a1a' });
    for (let i = 0; i < 7; i++) {
      const x = 16 + i * 19, y = 26, got = i < lb.day, today = i === lb.day - 1;
      hubFrame(x, y, 17, 28, today ? '#ffe98a' : got ? '#ffeedd' : '#f4f0e8');
      T(`${i + 1}`, x + 8.5, y + 2, { al: 'center', c: '#7a5a30' });
      if (i === 6) { const c = PROPS.gold_carrot || PROPS.item_carrot; if (c) g.drawImage(c, x + 1, y + 7, 15, 15); }
      else drawPattern(['.###.', '#yyy#', '#y#y#', '#yyy#', '.###.'], x + 6, y + 10, { '#': '#a8740a', y: '#ffd23a' });
      T(`${LB_COINS[i]}`, x + 8.5, y + 21, { al: 'center', c: '#4a2c12' });
      if (got && (!today || lb.t > 0.4)) {   // stamp (today's lands after a moment)
        const sc = today ? Math.max(1, 2.2 - (lb.t - 0.4) * 4) : 1;
        g.save(); g.globalAlpha = 0.85; g.strokeStyle = '#e0302a'; g.lineWidth = 1.2; g.beginPath(); g.arc(x + 8.5, y + 14, 6 * sc, 0, Math.PI * 2); g.stroke(); g.restore();
        if (sc === 1) T('◎', x + 8.5, y + 11, { al: 'center', c: '#e0302a' });
      }
    }
    T(`${lb.day}にちめ！ ${lb.coins}コイン もらった！`, 80, 59, { al: 'center', c: '#c0502a', size: 8 });
    T(Math.floor(G.t * 2) % 2 ? 'タップで とじる' : '', 80, 72, { al: 'center', c: '#7a5a30' });
  }
  // ---- ずかん helpers ----
  const HAB = { town: 'ぬいぐるみの くに', forest: 'もりの くに', castle: 'あくの しろ', seigi: 'せいぎぐんの くに', halloween: 'ハロウィン' };
  let dexHabMap = null;
  function dexHab(k) {   // where a plush first shows up (stage spawns), as a habitat key
    if (!dexHabMap) {
      dexHabMap = {};
      for (const st of STAGES) for (const w of st.spawns || []) {
        const sp = SPECIES[w.sp] ? w.sp : String(w.sp).replace(/_boss$/, ''); if (dexHabMap[sp]) continue;
        dexHabMap[sp] = st.event ? 'halloween' : st.world === 3 ? 'seigi' : st.world === 2 ? 'castle' : st.world === 1 || st.theme === 'forest' ? 'forest' : 'town';
      }
    }
    return dexHabMap[k] || (SPECIES[k] && SPECIES[k].limited ? 'halloween' : 'town');
  }
  const dexHabArt = h => ZART['habitat_' + (h === 'seigi' ? 'castle' : h)];
  function dexType(k) {
    const s = SPECIES[k], v = [['パワー', s.atk], ['ガード', s.def], ['スピード', s.spd], ['タフ', s.hp / 4]];
    return v.reduce((a, b) => b[1] > a[1] ? b : a)[0];
  }
  function dexEvo(k) {   // evolved art shown beside the base form (not for noEvo plush or self-mapped evolutions)
    const ev = typeof EVOLVE !== 'undefined' && EVOLVE[k], s = SPECIES[k];
    return ev && !s.noEvo && ev.sprite !== s.sprite && SPR[ev.sprite] ? ev : null;
  }
  const dexSpoiler = k => dexHab(k) === 'seigi' || k === 'usahime';   // unseen せいぎぐん plush stay a plain ？ (no silhouette spoiler)
  const DEX_RW = [[0.25, 100], [0.5, 200], [0.75, 300], [1, 500]];   // ぜんぶの 25/50/75/100% あつめた -> coins (once each, G.flags.dexRw)
  function dexRwNext() {
    const list = DEX(), own = ownedSp(), got = list.filter(k => dexCaught(k, own)).length, done = G.flags.dexRw || [];
    for (let i = 0; i < DEX_RW.length; i++) if (!done.includes(i)) return { i, need: Math.ceil(list.length * DEX_RW[i][0]), coins: DEX_RW[i][1], pct: DEX_RW[i][0] * 100, ok: got >= Math.ceil(list.length * DEX_RW[i][0]) };
    return null;
  }
  function dexClaim(H) {
    const r = dexRwNext(); if (!r || !r.ok) return;
    G.flags.dexRw = (G.flags.dexRw || []).concat(r.i); G.coins += r.coins; persist(); SFX.recruit();
    H.dmsg = { text: `${r.pct}% たっせい！ ${r.coins}コイン もらった！`, t: G.t };
  }
  function dexStep(H, d) { const n = DEX().length; H.dd = ((H.dd | 0) + d + n) % n; H.dsel = H.dd; SFX.blip(); }
  function dexArt(k, x, y, caught, seen) {   // 32x32 at 1x: the art, a code-made silhouette, or ？
    const sp = SPECIES[k].sprite, s = SPR[sp];
    if (caught) g.drawImage(s.native === 1 ? s.n : s.f, x, y);
    else if (seen || !dexSpoiler(k)) { const b = blackOf(sp); if (b) g.drawImage(b, x, y); }
    else T('?', x + 16, y + 13, { al: 'center', c: '#b0a080' });
  }
  function drawZukan(H) {
    if (H.dd != null) return drawZukanPage(H);
    const list = DEX(), own = ownedSp(), seen = list.filter(k => dexSeen(k, own)).length, got = list.filter(k => dexCaught(k, own)).length;
    const page = Math.floor((H.dsel | 0) / DEX_PAGE), pages = Math.ceil(list.length / DEX_PAGE);
    hubTop(`ずかん  ${page + 1}/${pages}`, true);
    hubFrame(80, 1, 34, 9, '#ffe98a'); T('あいしょう', 97, 3, { al: 'center', c: '#c0502a' });
    for (let j = 0; j < DEX_PAGE; j++) {
      const i = page * DEX_PAGE + j, k = list[i]; if (!k) break;
      const x = 2 + (j % DEX_COLS) * 35, y = 12 + Math.floor(j / DEX_COLS) * 34, sel = i === H.dsel;   // 34x33 cells: the 32px art at 1x, never shrunk
      hubFrame(x, y, 34, 33, sel ? '#ffe98a' : '#fff8e0');
      dexArt(k, x + 1, y, dexCaught(k, own), dexSeen(k, own));
      if (dexSeen(k, own)) drawJk(handOf({ sp: k }), x + 25, y + 24);
      if (SPECIES[k].limited && dexSeen(k, own)) { rect(x + 15, y + 1, 18, 7, '#e0302a'); T('げんてい', x + 24, y + 2, { al: 'center', c: '#ffffff' }); }
    }
    hubFrame(142, 12, 16, 33, '#fff8e0'); hubFrame(142, 46, 16, 33, '#fff8e0');
    T('◀', 150, 25, { al: 'center', c: page > 0 ? '#c0502a' : '#d8c8a8' }); T('▶', 150, 59, { al: 'center', c: page < pages - 1 ? '#c0502a' : '#d8c8a8' });
    if (H.dmsg && G.t - H.dmsg.t < 2.5) { T(H.dmsg.text, 80, 81, { al: 'center', c: '#c0502a' }); return; }
    T(`みつけた${seen} / あつめた${got} / ぜんぶ${list.length}`, 3, 81, { c: '#4a2c12' });
    const r = dexRwNext();
    if (r && r.ok) { const on = Math.floor(G.t * 3) % 2; hubFrame(117, 80, 41, 10, on ? '#ffd23a' : '#ffe98a'); T('ごほうび！', 137.5, 81, { al: 'center', c: '#c0502a' }); }
    else if (r) T(`つぎ ${r.need}たい`, 158, 81, { al: 'right', c: '#7a5a30' });
    else T('コンプリート！', 158, 81, { al: 'right', c: '#2a7a1a' });
  }
  function dexBox(k, x, y, sprKey, show) {   // 48x48 habitat panel, plush at (8,6) so the feet sit on the ground line
    const art = dexHabArt(dexHab(k));
    if (art) g.drawImage(art, x, y); else { hubFrame(x, y, 48, 48, '#cfeaff'); rect(x + 1, y + 38, 46, 9, '#8ccf6a'); }
    if (show === 'art') { const s = SPR[sprKey]; g.drawImage(s.native === 1 ? s.n : s.f, x + 8, y + 6); }
    else dexArt(k, x + 8, y + 6, false, show === 'seen');
  }
  function drawZukanPage(H) {
    const list = DEX(), own = ownedSp(), i = H.dd | 0, k = list[i]; if (!k) { H.dd = null; return; }
    const S0 = SPECIES[k], c = dexCaught(k, own), sn = dexSeen(k, own), ev = c && dexEvo(k);
    hubTop(`No.${String(i + 1).padStart(3, '0')} ${sn ? S0.name : '？？？'}`, true);
    rect(0, 11, 160, 79, '#fff8e0');
    if (ZART.zukan_frame) g.drawImage(ZART.zukan_frame, 0, 12); else hubFrame(0, 12, 160, 78, '#fff8e0');
    dexBox(k, 8, 20, S0.sprite, c ? 'art' : sn ? 'seen' : 'none');
    let cx = 62;
    if (ev) { T('▶', 58, 40, { al: 'center', c: '#c0502a' }); dexBox(k, 62, 20, ev.sprite, 'art'); cx = 114; }
    const L = (s, y, col) => T(s, cx, y, { c: col || '#4a2c12' });
    if (sn) {
      L(`タイプ ${dexType(k)}`, 20); drawJk(handOf({ sp: k }), Math.min(150, cx + Math.ceil(measure(`タイプ ${dexType(k)}`)) + 3), 19);
      L('すみか', 28, '#7a5a30'); L(HAB[dexHab(k)], 35);
      if (S0.limited) { rect(cx, 43, 18, 7, '#e0302a'); T('げんてい', cx + 9, 44, { al: 'center', c: '#ffffff' }); }
    } else L('？？？', 20);
    if (c) { const m = movesOf({ sp: k }); L('わざ', 52, '#7a5a30'); L(m.attack.name, 59); L(m.strong.name, 66); }
    const desc = c ? (typeof ZUKAN_DESC !== 'undefined' && ZUKAN_DESC[k]) || '' : sn ? 'なかまに なると くわしく わかるよ' : 'まだ みつけて いない…';
    wrapW(desc, 110).slice(0, 2).forEach((ln, j) => T(ln, 8, 71 + j * 7, { c: '#4a2c12' }));
    hubFrame(121, 72, 17, 12, '#ffe98a'); T('◀', 129.5, 74, { al: 'center', c: '#c0502a' });
    hubFrame(140, 72, 17, 12, '#ffe98a'); T('▶', 148.5, 74, { al: 'center', c: '#c0502a' });
  }
  function drawHubItems(H) {
    hubTop('アイテム', true);
    const ks = hubItems();
    hubFrame(3, 12, 154, 52, '#fff8e0');
    ks.forEach((k, i) => {
      const y = 13 + i * 9, sel = i === (H.isel | 0), n = G.items[k] | 0;
      if (sel) rect(5, y, 150, 9, '#ffe98a');
      T(ITEMS[k].name, 10, y + 2, { c: n ? '#4a2c12' : '#b0a080' }); T(`×${n}`, 150, y + 2, { al: 'right', c: n ? '#4a2c12' : '#b0a080' });
    });
    hubFrame(3, 66, 154, 22, '#fff8e0');
    const it = ITEMS[ks[H.isel | 0]];
    if (it) { T(it.desc, 8, 69, { c: '#4a2c12' }); T(it.price ? `ショップで ${it.price}コイン ／ つかうのは ぼうけんの どうぐから` : 'ぼうけんの とちゅうで ひろえる', 8, 78, { c: '#7a5a30' }); }
  }
  // ---------- トレーニング: pay coins -> EXP for one party plush (Lv cap respected) ----------
  const TR_TIERS = [{ c: 50, xp: 40, n: 'ちょっと' }, { c: 150, xp: 140, n: 'しっかり' }, { c: 400, xp: 420, n: 'みっちり' }];
  const TR_CARD = i => [3 + i * 39, 13, 37, 42], TR_BTN = i => [3 + i * 52, 58, 50, 22];
  // tier -> minigame tuning: gauge speed (sweeps of the bar per second), zone half-width, perfect half-width (fractions of the bar)
  const TG_TUNE = [{ spd: 0.8, zone: 0.16, perf: 0.05 }, { spd: 1.2, zone: 0.11, perf: 0.035 }, { spd: 1.7, zone: 0.075, perf: 0.022 }];
  const TG_REPS = 10, TG_JUDGE = { p: 1, g: 0.6, m: 0 };
  function trainBuy(H, i) {   // pay, then play the lifting minigame (EXP is granted at the end)
    const m = G.party[H.tm | 0], T0 = TR_TIERS[i]; if (!m || !T0) return;
    if ((m.lv || 1) >= MAX_LV) { banner(`${m.name}は もう Lv${MAX_LV}！ これいじょう あがらないよ`, 2); SFX.blip(); return; }
    if ((G.coins | 0) < T0.c) { banner('コインが たりないよ…', 1.6); SFX.blip(); return; }
    G.coins -= T0.c; persist(); G.banner = null;
    H.view = 'tgame'; H.tg = { tier: i, mi: H.tm | 0, rep: 0, res: [], combo: 0, best: 0, t0: G.t, zc: 0.3 + rand() * 0.4, lift: -9, judge: null, done: false };
    SFX.buy();
  }
  const tgPos = tg => { const p = ((G.t - tg.t0) * TG_TUNE[tg.tier].spd * 2) % 2; return p < 1 ? p : 2 - p; };
  function tgTap(H) {
    const tg = H.tg; if (!tg) return;
    if (tg.done) { tgFinish(H); return; }
    if (G.t - tg.lift < 0.45) return;   // still lifting
    const U = TG_TUNE[tg.tier], d = Math.abs(tgPos(tg) - tg.zc), j = d <= U.perf ? 'p' : d <= U.zone ? 'g' : 'm';
    tg.res.push(j); tg.lift = G.t; tg.judge = { j, t: G.t }; tg.combo = j === 'm' ? 0 : tg.combo + 1; tg.best = Math.max(tg.best, tg.combo);
    if (j === 'p') SFX.buy(); else if (j === 'g') SFX.hit(); else SFX.miss();
    tg.rep++;
    if (tg.rep >= TG_REPS) {
      const m = G.party[tg.mi], base = TR_TIERS[tg.tier].xp, score = tg.res.reduce((a, r) => a + TG_JUDGE[r], 0) / TG_REPS;
      tg.exp = Math.round(base * score); tg.rate = score >= 0.9 ? 'S' : score >= 0.7 ? 'A' : score >= 0.45 ? 'B' : 'C';
      tg.done = G.t + 0.5; setTimeout(() => SFX.win(), 500);
    } else { tg.zc = 0.3 + rand() * 0.4; tg.t0 = G.t - rand() * 0.5; }
  }
  function tgFinish(H) {   // close the result: grant the EXP (capped at Lv30 by grantXp), back to the list with the level-up effect
    const tg = H.tg; if (G.t < tg.done) return;
    const m = G.party[tg.mi], lv0 = m.lv || 1, n = tg.exp > 0 ? grantXp(tg.exp, m) : 0;
    H.view = 'train'; H.tg = null; H.tfx = { i: tg.mi, t0: G.t, n, xp: tg.exp, lv: m.lv };
    if (n) { SFX.level(); banner(`${m.name}は Lv${lv0} → Lv${m.lv}に なった！`, 2); } else SFX.blip();
    persist();
  }
  const HOLD = new WeakMap();
  function holdBox(img) {   // opaque bounding box + body colour (most common opaque colour) of a 32x32 sprite, cached
    let b = HOLD.get(img); if (b) return b;
    const d = img.getContext('2d').getImageData(0, 0, img.width, img.height).data; let x0 = 99, x1 = -1, y0 = 99, y1 = -1; const cnt = new Map();
    for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) { const i = (y * img.width + x) * 4; if (d[i + 3] < 128) continue;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      const lum = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11; if (lum > 60) { const k = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2]; cnt.set(k, (cnt.get(k) || 0) + 1); } }
    let bc = 0xc08060, bn = 0; for (const [k, n] of cnt) if (n > bn) { bn = n; bc = k; }
    const hex = v => '#' + v.toString(16).padStart(6, '0'), hi = ((Math.min(255, (bc >> 16) + 40)) << 16) | ((Math.min(255, ((bc >> 8) & 255) + 40)) << 8) | Math.min(255, (bc & 255) + 40);
    b = { x0, x1, y0, y1, col: hex(bc), hi: hex(hi) }; HOLD.set(img, b); return b;
  }
  function drawTGame(H) {
    const tg = H.tg, m = G.party[tg.mi], T0 = TR_TIERS[tg.tier], U = TG_TUNE[tg.tier];
    rect(0, 11, 160, 79, '#fff0d8'); rect(0, 62, 160, 28, '#e8c890'); rect(0, 62, 160, 1, '#b08a50');
    hubTop(`トレーニング  ${T0.n}`, false);
    const s = SPR[memberKey(m)] || SPR[SPECIES[m.sp].sprite], lt = G.t - tg.lift, up = lt < 0.45 ? Math.sin(lt / 0.45 * Math.PI) : 0;
    const img = s && (s.native === 1 ? s.n : s.f), bb = img ? holdBox(img) : { x0: 8, x1: 24, y0: 4, y1: 31, col: '#c08060' };
    const px = 64, py = 30, J0 = tg.judge, miss = J0 && J0.j === 'm' && lt < 0.45, k = lt < 0.45 ? lt / 0.45 : 1;
    // lift: squash (0-25%), stretch up (25-60%), settle; miss: wobble + dip
    const sq = k < 0.25 ? Math.sin(k / 0.25 * Math.PI) : 0, st = !miss && k >= 0.25 && k < 1 ? Math.sin((k - 0.25) / 0.75 * Math.PI) : 0;
    const dh = Math.round(-2 * sq + 2 * st), wob = miss ? Math.round(Math.sin(lt * 40) * 1.5) : 0;
    if (img) g.drawImage(img, px + wob - (sq > 0.3 ? 1 : 0), py - dh, 32 + (sq > 0.3 ? 2 : 0), 32 + dh);   // bottom stays on the floor
    // hold point from the sprite's opaque box: centred, 55% down; on a lift it rises to head height (box top + 4), stays in the paws
    const hx = px + Math.round((bb.x0 + bb.x1) / 2) + wob, restY = py + Math.round(bb.y0 + (bb.y1 - bb.y0) * 0.55), headY = py + bb.y0 + 4;
    const hy = Math.round(miss ? restY + 3 * Math.sin(k * Math.PI) : restY - (restY - headY) * st - dh * 0.5 * (1 - st) + 2 * sq);
    const ic = HART['t' + tg.tier];
    if (ic) g.drawImage(ic, hx - 8, hy - 8);
    rect(hx - 4, hy - 1, 3, 3, '#3a2418'); rect(hx + 1, hy - 1, 3, 3, '#3a2418');   // paws gripping the bar (inside the plates)
    rect(hx - 4, hy - 1, 2, 2, bb.col); rect(hx + 2, hy - 1, 2, 2, bb.col); rect(hx - 4, hy - 1, 2, 1, bb.hi); rect(hx + 2, hy - 1, 2, 1, bb.hi);
    const J = tg.judge, jt = J ? G.t - J.t : 9;
    if (jt < 0.6 && !tg.done) {
      if (J.j === 'p') for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2, r = 8 + jt * 30; rect(Math.round(px + 16 + Math.cos(a) * r), Math.round(py + 14 + Math.sin(a) * r * 0.7), 2, 2, k % 2 ? '#ffe24a' : '#ffffff'); }
      else for (let k = 0; k < 3; k++) rect(px + 4 + k * 12, py + 4 + Math.round(jt * 20) + k, 1, 2, '#5ab0ff');   // sweat drops
      T(J.j === 'p' ? 'パーフェクト！' : J.j === 'g' ? 'グッド！' : 'ミス…', 122, 42 - Math.round(jt * 8), { al: 'center', c: J.j === 'p' ? '#ff6a2a' : J.j === 'g' ? '#2a7a1a' : '#7a7a8a', ol: '#ffffff' });
    }
    T(`${Math.min(tg.rep + (tg.done ? 0 : 1), TG_REPS)}/${TG_REPS}かいめ`, 6, 15, { c: '#5a3418' });
    if (tg.combo >= 2) T(`${tg.combo}コンボ！`, 154, 15, { al: 'right', c: '#ff6a2a' });
    for (let k = 0; k < TG_REPS; k++) { const r = tg.res[k]; rect(6 + k * 5, 23, 4, 4, r === 'p' ? '#ffb020' : r === 'g' ? '#5ac85a' : r === 'm' ? '#9a9aa8' : '#e8d8b8'); }
    // gauge
    const gx = 14, gy = 68, gw = 132, gh = 9;
    hubFrame(gx - 2, gy - 2, gw + 4, gh + 4, '#5a3418'); rect(gx, gy, gw, gh, '#3a2a20');
    const glow = 0.75 + 0.25 * Math.sin(G.t * 8);
    g.globalAlpha = glow; rect(Math.round(gx + (tg.zc - U.zone) * gw), gy, Math.round(U.zone * 2 * gw), gh, '#5ac85a'); g.globalAlpha = 1;
    rect(Math.round(gx + (tg.zc - U.perf) * gw), gy, Math.max(2, Math.round(U.perf * 2 * gw)), gh, '#ffd23a');
    if (!tg.done) { const mx = Math.round(gx + tgPos(tg) * gw); rect(mx - 1, gy - 3, 3, gh + 6, '#ffffff'); rect(mx, gy - 2, 1, gh + 4, '#c0502a'); }
    T(tg.done ? '' : 'どこでも タップで もちあげ！', 80, 81, { al: 'center', c: '#5a3418' });
    if (tg.done) {
      hubFrame(30, 26, 100, 52, '#fff8e0');
      T('けっか', 80, 29, { al: 'center', c: '#c0502a' });
      T(tg.rate, 80, 37, { al: 'center', size: 8, c: { S: '#ff6a2a', A: '#e0a020', B: '#3c6ad8', C: '#7a7a8a' }[tg.rate], ol: '#5a3418' });
      const np = tg.res.filter(r => r === 'p').length, ng = tg.res.filter(r => r === 'g').length;
      T(`パーフェクト${np}  グッド${ng}  ミス${TG_REPS - np - ng}`, 80, 53, { al: 'center', c: '#4a2c12' });
      T(`けいけんち +${tg.exp}EXP`, 80, 61, { al: 'center', c: '#8656cc' });
      if (G.t >= tg.done) T('タップで つぎへ', 80, 69, { al: 'center', c: '#9a8a70' });
    }
  }
  function drawTrain(H) {
    hubTop('トレーニング', true);
    G.party.forEach((m, i) => {
      const [x, y, w, h] = TR_CARD(i), sel = i === (H.tm | 0), s = SPR[memberKey(m)] || SPR[SPECIES[m.sp].sprite];
      hubFrame(x, y, w, h, sel ? '#ffe98a' : '#fff8e0');
      const fx = H.tfx && H.tfx.i === i ? G.t - H.tfx.t0 : 9;
      const hop = fx < 0.6 && H.tfx.n ? -Math.round(Math.sin(fx / 0.6 * Math.PI) * 4) : 0;
      if (s) g.drawImage(s.native === 1 ? s.n : s.f, x + 2, y + 1 + hop);
      T(m.name, x + w / 2, y + 33, { al: 'center', c: '#4a2c12' });
      T(`Lv${m.lv || 1}`, x + 3, y + 2, { c: (m.lv || 1) >= MAX_LV ? '#c0502a' : '#3c6ad8', ol: '#fff8e0' });
      if (fx < 1.4) {   // level-up effect: sparkles + rising text
        const k = fx / 1.4;
        if (H.tfx.n) for (let j = 0; j < 6; j++) { const a = j / 6 * Math.PI * 2 + fx * 4, r = 6 + k * 12; rect(Math.round(x + 18 + Math.cos(a) * r), Math.round(y + 17 + Math.sin(a) * r * 0.8), 2, 2, j % 2 ? '#ffe24a' : '#ffffff'); }
        g.globalAlpha = Math.max(0, 1 - k * 0.8);
        T(H.tfx.n ? 'Lvアップ！' : `+${H.tfx.xp}EXP`, x + w / 2, Math.round(y + 14 - k * 10), { al: 'center', c: H.tfx.n ? '#ff6a2a' : '#2a7a1a', ol: '#ffffff' });
        g.globalAlpha = 1;
      }
    });
    TR_TIERS.forEach((t, i) => {
      const [x, y, w, h] = TR_BTN(i), sel = i === (H.tt | 0), ic = HART['t' + i];
      hubFrame(x, y, w, h, sel ? '#e8dcff' : '#fff8e0');
      if (ic) g.drawImage(ic, x + 2, y + 3);
      T(`${t.c}コイン`, x + 20, y + 4, { c: (G.coins | 0) >= t.c ? '#4a2c12' : '#b0a080' });
      T(`+${t.xp}EXP`, x + 20, y + 12, { c: '#8656cc' });
    });
    const m = G.party[H.tm | 0];
    if (m) T((m.lv || 1) >= MAX_LV ? `${m.name}は Lv${MAX_LV}(さいだい)` : `${m.name}  つぎの Lvまで ${xpNeed(m.lv || 1) - (m.xp | 0)}EXP`, 80, 82, { al: 'center', c: '#3a5a20' });
  }
  // ---------- ガチャ: in-game coins only; non-boss, non-せいぎぐん plush or items; odds shown ----------
  const GACHA_SEIGI = new Set(['usagihei', 'hamuranger', 'poppon', 'hotarun', 'hiyokorappa', 'mogurakouhei', 'arupakacook', 'paoon', 'kametank', 'usaknight', 'usahime']);
  const gachaPool = () => Object.keys(SPECIES).filter(k => { const d = SPECIES[k]; return !d.boss && !d.limited && !d.gate && !d.gold && !d.evoOnly && !d.recruitAfter && !GACHA_SEIGI.has(k) && k !== 'oguri' && k !== 'oguriking' && SPR[d.sprite]; });
  const GACHA_COST = { 1: 100, 10: 900 }, GACHA_DUP = 40;
  const GACHA_ODDS = [   // はいしゅつりつ (sums to 100)
    { p: 25, k: 'plush', label: 'ぬいぐるみ' },
    { p: 35, k: 'item', id: 'kizu', n: 2, label: 'きずぐすり ×2' },
    { p: 20, k: 'item', id: 'genki', n: 1, label: 'げんきドリンク' },
    { p: 15, k: 'item', id: 'cookie', n: 1, label: 'なかよしクッキー' },
    { p: 5, k: 'coin', n: 50, label: '50コイン' },
  ];
  const GA_BTN = [[66, 15, 90, 19], [66, 37, 90, 19], [66, 59, 90, 13]];
  function gachaRoll() {
    let r = rand() * 100; const o = GACHA_ODDS.find(o => (r -= o.p) < 0) || GACHA_ODDS[1];
    if (o.k === 'plush') {
      const pool = gachaPool(), sp = pool[Math.floor(rand() * pool.length)];
      if (ownedSp().has(sp)) { G.coins += GACHA_DUP; return { k: 'plush', sp, dup: 1 }; }
      const m = newMember(sp); (G.flags.seen = G.flags.seen || {})[sp] = 1;
      if (G.party.length < TUNING.partyMax) { G.party.push(m); return { k: 'plush', sp, to: 'party' }; }
      (G.box = G.box || []).push(m); return { k: 'plush', sp, to: 'box' };
    }
    if (o.k === 'item') { G.items[o.id] = (G.items[o.id] | 0) + o.n; return { k: 'item', id: o.id, n: o.n }; }
    G.coins += o.n; return { k: 'coin', n: o.n };
  }
  function gachaPull(H, n) {
    const c = GACHA_COST[n]; if (!c) return;
    if ((G.coins | 0) < c) { banner(`コインが たりないよ… (${c}コイン ひつよう)`, 1.8); SFX.blip(); return; }
    G.coins -= c; const list = []; for (let i = 0; i < n; i++) list.push(gachaRoll());
    H.gres = { list, t0: G.t }; G.flags.gachaN = (G.flags.gachaN | 0) + n; SFX.blip(); persist();
  }
  const GA_OPEN = [200, 90, 90, 120, 100, 240];   // capsule frames (ms); the prize shows after the last one
  function gachaNext(H) {
    const t = (G.t - H.gres.t0) * 1000, total = GA_OPEN.reduce((a, b) => a + b, 0);
    if (t < total) { H.gres.t0 = G.t - total / 1000; return; }   // tap during the animation: skip to the prize
    H.gres = null; SFX.blip();
  }
  function prizeIcon(r, x, y) {   // 16x16
    if (r.k === 'plush') { const s = SPR[SPECIES[r.sp].sprite]; if (s) g.drawImage(s.native === 1 ? s.n : s.f, x, y, 16, 16); }
    else if (r.k === 'item') { const ic = ICON16.menu_item; if (ic) g.drawImage(ic, x, y); else rect(x + 4, y + 4, 8, 10, '#ff9ac0'); }
    else drawPattern(['..####..', '.#yyyy#.', '#yy##yy#', '#y#yy#y#', '#y#yy#y#', '#yy##yy#', '.#yyyy#.', '..####..'], x + 4, y + 4, { '#': '#a8740a', y: '#ffd23a' });
  }
  const prizeText = r => r.k === 'plush' ? (r.dup ? `${SPECIES[r.sp].name}  もう いるので ${GACHA_DUP}コイン` : `${SPECIES[r.sp].name}が ${r.to === 'party' ? 'なかまに なった！' : 'ぬいハウスに きたよ！'}`)
    : r.k === 'item' ? `${ITEMS[r.id].name} ×${r.n}` : `${r.n}コイン`;
  function drawGacha(H) {
    hubTop('ガチャ', true);
    if (H.odds || H.gres) return drawGachaOver(H);   // text sits on its own layer, so overlays replace the base screen instead of covering it
    hubFrame(4, 14, 58, 58, '#ffe8f4');
    if (HART.machine) g.drawImage(HART.machine, 9, 19 + (H.gres ? 0 : (Math.floor(G.t * 2) % 2))); else { rect(17, 22, 32, 30, '#f96ab4'); rect(21, 26, 24, 16, '#bfe6ff'); }
    const lab = ['1かい まわす', '10かい まわす', 'はいしゅつりつ'];
    GA_BTN.forEach((b, i) => {
      const sel = i === (H.gn | 0) && i < 2; hubFrame(b[0], b[1], b[2], b[3], i === 2 ? '#e8f4ff' : sel ? '#ffe98a' : '#fff8e0');
      if (i < 2) { const c = GACHA_COST[i ? 10 : 1]; T(lab[i], b[0] + 6, b[1] + 3, { c: '#4a2c12' }); T(`${c}コイン`, b[0] + b[2] - 5, b[1] + 11, { al: 'right', c: (G.coins | 0) >= c ? '#c0502a' : '#b0a080' }); }
      else T(lab[i], b[0] + b[2] / 2, b[1] + 3, { al: 'center', c: '#3c6ad8' });
    });
    T('コインは ぼうけんや ログインボーナスで もらえるよ', 80, 79, { al: 'center', c: '#7a5a30' });
  }
  function drawGachaOver(H) {
    if (H.odds) {
      hubFrame(14, 13, 132, 74, '#fff8e0'); T('はいしゅつりつ', 80, 16, { al: 'center', c: '#c0502a' });
      GACHA_ODDS.forEach((o, i) => { T(o.label, 22, 26 + i * 8, { c: '#4a2c12' }); T(`${o.p}%`, 138, 26 + i * 8, { al: 'right', c: '#4a2c12' }); });
      const n = gachaPool().length;
      T(`ぬいぐるみは ${n}しゅるいから おなじ かくりつ`, 80, 67, { al: 'center', c: '#7a5a30' });
      T(`もう いる こは ${GACHA_DUP}コインに かわるよ`, 80, 75, { al: 'center', c: '#7a5a30' });
      return;
    }
    if (!H.gres) return;
    // result: capsule-open animation, then the prize(s)
    rect(0, 11, 160, 79, '#3a2a48'); for (let i = 0; i < 12; i++) rect((i * 37 + Math.floor(G.t * 8)) % 160, 14 + (i * 23) % 70, 1, 1, '#ffe98a');
    const t = (G.t - H.gres.t0) * 1000, L = H.gres.list;
    let acc = 0, fi = GA_OPEN.findIndex(d => (acc += d) > t);
    if (fi >= 0) {
      const fr = HART.capsule && HART.capsule[fi];
      if (fr) g.drawImage(fr.n, 64, 56 - 26 - 4 + (fi === 1 ? -1 : 0)); else { rect(70, 36, 20, 10, '#e84a4a'); rect(70, 46, 20, 10, '#ffffff'); }
      if (L.length > 1) T(`×${L.length}`, 100, 46, { c: '#ffffff', ol: '#2a1a30' });
      return;
    }
    if (L.length === 1) {
      const r = L[0]; hubFrame(20, 18, 120, 62, '#fff8e0');
      if (r.k === 'plush') { const s = SPR[SPECIES[r.sp].sprite]; if (s) g.drawImage(s.native === 1 ? s.n : s.f, 64, 22); if (!r.dup) T('NEW!', 104, 24, { c: '#ff4a6a' }); }
      else prizeIcon(r, 72, 30);
      T(prizeText(r), 80, 58, { al: 'center', c: '#4a2c12' });
      T('タップで とじる', 80, 70, { al: 'center', c: '#9a8a70' });
      return;
    }
    hubFrame(3, 13, 154, 75, '#fff8e0');
    L.forEach((r, i) => {
      const x = 6 + (i % 5) * 30, y = 16 + Math.floor(i / 5) * 28; hubFrame(x, y, 28, 26, r.k === 'plush' && !r.dup ? '#ffe98a' : '#fffdf4');
      prizeIcon(r, x + 6, y + 2);
      T(r.k === 'plush' ? (r.dup ? `+${GACHA_DUP}` : 'NEW!') : r.k === 'item' ? `×${r.n}` : `+${r.n}`, x + 14, y + 18, { al: 'center', c: r.k === 'plush' && !r.dup ? '#ff4a6a' : '#7a5a30' });
    });
    const nw = L.filter(r => r.k === 'plush' && !r.dup).map(r => SPECIES[r.sp].name);
    T(nw.length ? `あたらしい なかま: ${nw.slice(0, 3).join('・')}${nw.length > 3 ? ' ほか' : ''}` : 'あたらしい なかまは いなかった…', 80, 73, { al: 'center', c: '#4a2c12' });
    T('タップで とじる', 80, 81, { al: 'center', c: '#9a8a70' });
  }
  // ---------- イベント: weekly rotation by JST day of week; existing stage + stronger wilds; coin rewards ----------
  const EVENTS = [   // index = day of week (0 = にちようび)
    { stage: 'oka',   name: 'はらっぱ だいさくせん', lv: 6 },
    { stage: 'kaido', name: 'かいどう ラッシュ',     lv: 9 },
    { stage: 'mori',  name: 'もりの たんけんたい',   lv: 12 },
    { stage: 'hoshi', name: 'ほしぞら ナイト',       lv: 15 },
    { stage: 'kogen', name: 'わたぐも チャレンジ',   lv: 18 },
    { stage: 'tani',  name: 'あかつち バトル',       lv: 21 },
    { stage: 'mayoi', name: 'まよいの もり だいぼうけん', lv: 24 },
  ];
  const EV_COINS = 120, EV_FIRST = 300, EV_BTN = [48, 71, 64, 15], DOW = ['にち', 'げつ', 'か', 'すい', 'もく', 'きん', 'ど'];
  const jstDow = () => new Date(Date.now() + 9 * 3600e3).getUTCDay();
  const evToday = () => Object.assign({ dow: jstDow() }, EVENTS[jstDow()]);
  const evFirstDone = () => !!(G.flags.evd && G.flags.evd.d === jstDay());
  // ★ limited-time events (data.js SPECIAL_EVENTS): featured at the top of the イベント screen until `until`
  const JACK_JOIN = 0.4;   // chance that ジャックン asks to join after beating the boss
  const evSpecial = () => (typeof SPECIAL_EVENTS === 'undefined' ? [] : SPECIAL_EVENTS).find(e => Date.now() <= Date.parse(e.until) && STAGES.some(s => s.id === e.stage)) || null;
  const evRoll = T => { let r = rand() * T.reduce((a, s) => a + s.w, 0); for (const s of T) if ((r -= s.w) < 0) return s; return T[T.length - 1]; };
  const evSpDaily = S => !!(G.flags['evs_' + S.id] === jstDay());
  const evPick = H => { const S = evSpecial(); return S && !H.evW ? S : null; };   // H.evW = weekly tab chosen
  const EV_TABS = [[3, 44, 76, 9], [81, 44, 76, 9]];
  function evStart(H) {
    if (!G.flags.tut) { banner('まずは クエストで ぼうけんを はじめよう！', 2); return; }
    const S = H ? evPick(H) : null;
    if (S) {   // special: the stage's own spawns / levels / boss stay as designed
      const i = STAGES.findIndex(s => s.id === S.stage); if (i < 0) return;
      persist(); const ret = G.stage; enterStage(i); G.ev = Object.assign({ ret, special: true }, S);
      if (S.spawn) for (const w of G.wilds) {   // weighted random wild slots (the boss stays)
        if (w.gate || w.story || SPECIES[w.sp].boss) continue;
        const r = evRoll(S.spawn); Object.assign(w, trainerMember({ sp: r.sp, lv: w.lv })); w.key = memberKey(w); w.rare = !!r.rare;
      }
      banner(`「${S.name}」 スタート！ おくの ボスを たおそう`, 2.6); return;
    }
    const E = evToday(), i = STAGES.findIndex(s => s.id === E.stage); if (i < 0) return;
    persist(); const ret = G.stage; enterStage(i); G.ev = Object.assign({ ret }, E);
    for (const w of G.wilds) {
      const d = SPECIES[w.sp];
      if (w.gate || d.boss || w.story) { w.alive = false; continue; }   // no bosses / story fights in the event
      Object.assign(w, trainerMember({ sp: w.sp, lv: E.lv })); w.key = memberKey(w);
    }
    banner(`イベント「${E.name}」 スタート！ ゴールを めざそう`, 2.6);
  }
  function evClear() {
    const E = G.ev, ret = E.ret; G.ev = null; G.stage = ret;
    if (E.special) {
      const today = jstDay(), first = G.flags['evs_' + E.id] !== today, once = !G.flags['evonce_' + E.id];
      G.flags['evs_' + E.id] = today; G.flags['evonce_' + E.id] = 1; G.flags.evN = (G.flags.evN | 0) + 1;
      const c = E.coins + (first ? E.daily : 0) + (once ? E.once : 0); G.coins += c;
      persist(); openHub(); SFX.recruit();
      banner(`「${E.name}」 クリア！ ${c}コイン ゲット！${once ? ' (はじめての クリア +' + E.once + ')' : ''}${first ? ' (きょう はじめて +' + E.daily + ')' : ''}`, 4);
      return;
    }
    const F = G.flags.evd = G.flags.evd || { d: '', n: 0 }, today = jstDay(), first = F.d !== today;
    F.d = today; F.n = first ? 1 : (F.n | 0) + 1; G.flags.evN = (G.flags.evN | 0) + 1;
    const c = EV_COINS + (first ? EV_FIRST : 0); G.coins += c;
    persist(); openHub(); SFX.recruit();
    banner(`イベント クリア！ ${c}コイン ゲット！${first ? ' (きょう はじめての クリア ボーナス +' + EV_FIRST + ')' : ''}`, 3.6);
  }
  function evTab(H, x, y) {   // returns true when a tab was hit
    if (!evSpecial()) return false;
    const hit = r => x >= r[0] && x < r[0] + r[2] && y >= r[1] && y < r[1] + r[3];
    if (hit(EV_TABS[0])) { H.evW = false; SFX.blip(); return true; }
    if (hit(EV_TABS[1])) { H.evW = true; SFX.blip(); return true; }
    return false;
  }
  function drawEvent(H) {
    hubTop('イベント', true);
    const SP = evSpecial(), S = evPick(H);
    const E = evToday(), st = STAGES.find(s => s.id === (S ? S.stage : E.stage)), nx = EVENTS[(E.dow + 1) % 7];
    if (S) {   // featured special banner: night sky + moon + pumpkins (until event art arrives)
      hubFrame(0, 11, 160, 32, '#2a1640'); rect(1, 12, 158, 30, '#241238');
      for (let i = 0; i < 14; i++) rect((i * 37 + 11) % 156 + 2, 13 + (i * 13) % 16, 1, 1, '#e0c8ff');
      rect(132, 15, 14, 14, '#ff9a2a'); rect(131, 17, 16, 10, '#ff9a2a'); rect(134, 14, 10, 16, '#ff9a2a'); rect(135, 17, 3, 3, '#f08020');
      for (const px of [4, 148]) { rect(px, 34, 8, 6, '#ff8a1e'); rect(px + 3, 33, 2, 1, '#3a8a2a'); rect(px + 2, 36, 1, 1, '#ffe070'); rect(px + 5, 36, 1, 1, '#ffe070'); }
      T(S.banner, 79.5, 11 + 6, { al: 'center', c: '#ffb04a' });
      T(S.tag, 79.5, 11 + 16, { al: 'center', c: '#e0c8ff' });
      const left = Math.max(0, Math.ceil((Date.parse(S.until) - Date.now()) / 86400e3));
      T(`あと ${left}にち`, 4, 13, { c: '#ffffff' });
      if (S.spawn) {   // spawn rates: equal weights are grouped (「…32%ずつ」), rare ones get a ★
        const by = {}; for (const s of S.spawn) if (!s.rare) (by[s.w] = by[s.w] || []).push(SPECIES[s.sp].name);
        const txt = Object.entries(by).map(([w, n]) => n.join('・') + ' ' + w + (n.length > 1 ? '%ずつ' : '%')).concat(S.spawn.filter(s => s.rare).map(s => '★' + SPECIES[s.sp].name + ' ' + s.w + '%')).join('  ');
        T(txt, 79.5, 11 + 24, { al: 'center', c: '#ffe070' });
      }
    } else {
      if (HART.banner) g.drawImage(HART.banner, 0, 11); else hubFrame(0, 11, 160, 32, '#ffe8b0');
      T(E.name, 79.5, 11 + 12, { al: 'center', c: '#c0502a' });
    }
    let iy = 44;
    if (SP) {   // tabs: とくべつ / まいにち
      EV_TABS.forEach((r, i) => { const on = (i === 0) === !!S; hubFrame(r[0], r[1], r[2], r[3], on ? (i ? '#ffd23a' : '#ffa84a') : '#e8dcc0'); T(i ? 'まいにちの イベント' : '★ げんてい', r[0] + r[2] / 2, r[1] + 2, { al: 'center', c: on ? '#5a3418' : '#9a8a70' }); });
      iy = 54;
    }
    hubFrame(3, iy, 154, 70 - iy, '#fff8e0');
    const L = SP ? [iy + 2, iy + 9] : [47, 55, 63];
    if (S) {
      T(`ステージ: ${st.name}  てき Lv${S.lv}`, 7, L[0], { c: '#4a2c12' });
      const once = !G.flags['evonce_' + S.id], day = evSpDaily(S);
      T(`クリア ${S.coins}`, 7, L[1], { c: '#4a2c12' });
      T(once ? `はじめて +${S.once}！` : 'はじめて: もらったよ', 79, L[1], { al: 'center', c: once ? '#ff6a2a' : '#9a8a70' });
      T(day ? 'きょう: もらったよ' : `きょう +${S.daily}`, 153, L[1], { al: 'right', c: day ? '#9a8a70' : '#ff6a2a' });
    } else {
      T(`${DOW[E.dow]}ようびの ステージ: ${st ? st.name : ''}  てき Lv${E.lv}`, 7, L[0], { c: '#4a2c12' });
      T(`クリア: ${EV_COINS}コイン`, 7, L[1], { c: '#4a2c12' });
      T(evFirstDone() ? 'きょうの ボーナスは もらったよ' : `きょう はじめて: +${EV_FIRST}コイン！`, 153, L[1], { al: 'right', c: evFirstDone() ? '#9a8a70' : '#ff6a2a' });
      if (!SP) T(`あしたは「${nx.name}」`, 7, L[2], { c: '#7a5a30' });
    }
    const b = EV_BTN, bob = Math.floor(G.t * 3) % 2; hubFrame(b[0], b[1] - bob, b[2], b[3], S ? '#ffa84a' : '#ffd23a'); T('ちょうせん！', b[0] + b[2] / 2, b[1] + 4 - bob, { al: 'center', c: '#5a3418' });
  }
  function drawMapHomeChip() { hubFrame(2, 1, 23, 9, '#fff8e0'); T('ホーム', 13.5, 3, { al: 'center', c: '#5a3418' }); }
  function drawBanner() {
    if (!G.banner || G.state === 'talk') return;   // the talk box sits where the banner would
    // long text wraps onto more lines (centred) and the box grows to fit, so nothing runs off the 160px screen
    const lines = wrapW(G.banner.text, W - 14), LH = 6;
    const w = Math.ceil(Math.max(...lines.map(l => measure(l)))) + 8, h = 9 + (lines.length - 1) * LH;
    const x = Math.floor((W - w) / 2), y = 8;
    rect(x + 1, y, w - 2, h, '#5a3418'); rect(x, y + 1, w, h - 2, '#5a3418');
    rect(x + 1, y + 1, w - 2, h - 2, '#fff8e0');
    rect(x + 1, y + h - 2, w - 2, 1, '#e8d8b0');
    lines.forEach((l, i) => T(l, W / 2, y + 2.5 + i * LH, { al: 'center' }));
  }
  // ---- opening cutscene (first launch; replay from the title) ----
  const OP_KEY = 'nm_opening_seen', OPART = {};
  for (const [k, f] of [['kingdom', 'op_kingdom'], ['run', 'op_run_loop'], ['room', 'op_room'], ['logo', 'title_logo']]) if (artReady('assets/opening/' + f + '.png')) loadImg('assets/opening/' + f + '.png').then(i => { OPART[k] = i; }).catch(() => {});
  const OP = [
    { t: 0, kind: 'kingdom', text: ['ぬいぐるみの くにでは', 'ぬいもんたちが へいわに くらしていた'] },
    { t: 6.5, kind: 'run', text: ['ぬいもんは もりにも のはらにも', 'いたるところに すんでいる'] },
    { t: 13, kind: 'room', text: ['ある ひ… きみの へやの', 'ぬいぐるみが ひかりだした！'] },
    { t: 19, kind: 'start' },
  ], OP_END = 24, OP_CHIP = [2, 82, 34, 7];
  const opSeen = () => { try { return !!localStorage.getItem(OP_KEY); } catch (e) { return true; } };
  function opStart() { G.op = { t: 0 }; G.fade = 0; SFX.unlock(); SFX.restart('opening'); }
  // first launch: iOS keeps Web Audio silent until a tap, so ask for one before the opening
  function gateGo() { if (!G.tapGate) return; G.tapGate = false; G.opSkipAt = performance.now(); opStart(); }
  function drawTapGate() {
    const t = performance.now() / 1000;
    opBg(OPART.kingdom, OPART.kingdom ? (OPART.kingdom.width - 160) >> 1 : 0);
    g.globalAlpha = 0.35; rect(0, 0, 160, 90, '#14161f'); g.globalAlpha = 1;
    if (!opLogo(6)) { const s = 'ぬいぐるみモンスター'; T(s, Math.round(80 - measure(s) / 2), 14); }
    opSpr('oguri', 64, 66 + Math.round(-Math.abs(Math.sin(t * 4)) * 3), true, false, t);
    {
      const s = 'タップして スタート', w = Math.ceil(measure(s)) + 12, x = 80 - (w >> 1), y = 72;
      const a = 0.55 + 0.45 * Math.abs(Math.sin(t * 2.4));
      rect(x + 1, y, w - 2, 11, '#5a3418'); rect(x, y + 1, w, 9, '#5a3418'); rect(x + 1, y + 1, w - 2, 9, '#ffd23a'); rect(x + 2, y + 8, w - 4, 1, '#d8a82a');
      g.globalAlpha = a; T(s, x + 6, y + 3); g.globalAlpha = 1;
    }
  }
  function opEnd() {
    if (!G.op) return;
    G.op = null; G.opSkipAt = performance.now(); G.fade = 0.8; G.fadeSpeed = -2;
    try { localStorage.setItem(OP_KEY, '1'); } catch (e) {}
  }
  const opBlock = () => !!G.op || performance.now() - (G.opSkipAt || 0) < 500;
  const opChipHit = (x, y) => { const c = OP_CHIP; return x >= c[0] && x < c[0] + c[2] && y >= c[1] && y < c[1] + c[3]; };
  function opSpr(key, x, foot, faceRight, walking, t) {   // native-size draw, feet on `foot`
    const s = SPR[key]; if (!s) return;
    const flip = (faceRight ? 1 : -1) !== s.native, wk = walking && s.walk;
    const fr = wk ? wk.frames[Math.floor(t * 1000 / wk.ms) % wk.frames.length] : s;
    const y = Math.round(foot) - 31;
    g.globalAlpha = 0.3; g.fillStyle = '#000000'; g.fillRect(Math.round(x) + 9, y + 30, 14, 2); g.globalAlpha = 1;
    g.drawImage(flip ? fr.f : fr.n, Math.round(x), y);
  }
  function opBox(lines, a) {   // kana text box at the top (the art keeps floors / feet in the lower half)
    if (!lines || a <= 0) return;
    g.globalAlpha = Math.min(1, a);
    const x = 4, y = 3, w = 152, h = 23;
    rect(x + 1, y, w - 2, h, '#5a3418'); rect(x, y + 1, w, h - 2, '#5a3418'); rect(x + 1, y + 1, w - 2, h - 2, '#fff8e0'); rect(x + 2, y + h - 3, w - 4, 1, '#e8d8b0');
    g.globalAlpha = 1;
    if (a >= 1) { T(lines[0], x + 6, y + 5); T(lines[1] || '', x + 6, y + 12); }
  }
  const opPan = st => OPART.kingdom ? Math.round((OPART.kingdom.width - 160) * (0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, st / 6.5)))) : 0;   // slow left→right pan
  function opBg(img, ox) {   // fallback: plain sky / grass when the art is missing
    if (img) { g.drawImage(img, -ox, 0); if (img.width - ox < 160) g.drawImage(img, img.width - ox, 0); return; }
    rect(0, 0, 160, 62, '#9adcff'); rect(0, 62, 160, 28, '#6cc850');
  }
  function opLogo(y) {
    const L = OPART.logo; if (!L) return false;
    g.drawImage(L, (160 - L.width) >> 1, y); return true;
  }
  function drawOpening() {
    const t = G.op.t;
    let si = 0; for (let i = 0; i < OP.length; i++) if (t >= OP[i].t) si = i;
    const S = OP[si], st = t - S.t, nextT = si + 1 < OP.length ? OP[si + 1].t : OP_END, k = S.kind;
    if (k === 'kingdom') {
      const pan = opPan(st); opBg(OPART.kingdom, pan);
      const pals = ['goririn', 'kuuko', 'tsumaguro', 'kitsunen', 'usagin', 'nyankon', 'pengiin', 'wankon'].filter(p => SPR[p]);
      const span = Math.max(190, (OPART.kingdom ? OPART.kingdom.width : 160) + 30);
      pals.forEach((p, i) => {   // idle / wander along the ground, in world space so they pan with the town
        const walk = i % 2 === 0, dir = i % 4 === 0 ? 1 : -1;
        let x = 8 + i * Math.floor((span - 30) / pals.length); if (walk) x = ((x + dir * st * 10) % span + span) % span - 30;
        opSpr(p, x - pan, 72 + (i % 3) * 3 - (walk ? 0 : Math.round(Math.abs(Math.sin(st * 3 + i)) * 2)), walk ? dir > 0 : i % 3 !== 0, walk, st + i * 0.13);
      });
    } else if (k === 'run') {
      const off = Math.floor(st * 30), R = OPART.run, w = R ? R.width : 160;
      opBg(R, off % w);
      const foot = 67;   // op_run_loop ground line
      [['kinokon', 190, 1], ['fukuron', 300, -1], ['hakuchon', 420, -1], ['usagin', 520, 1]].forEach(([p, X, f], i) => {   // wild plush idling as we pass
        if (SPR[p]) opSpr(p, X - off, foot - Math.round(Math.abs(Math.sin(st * 2.5 + i)) * 2), f > 0, false, st);
      });
      opSpr('oguri', 62, foot - Math.round(Math.abs(Math.sin(st * 9))), true, true, st);   // oguri-cap.png faces left (native -1) → flipped
    } else {
      opBg(OPART.room, 0);
      const ra = !!OPART.room, rt = t - OP[2].t, glow = rt > 2.2 && rt < 4.4, moving = rt > 4.4;
      opSpr(SPR.hero ? 'hero' : 'player', 40, 80, true, false, st);
      // the plush sits on the bookcase's middle shelf (feet y=46) → glows → flash → hops down → walks to the hero
      const j = moving ? Math.min(1, (rt - 4.4) / 0.7) : 0;
      const px = (ra ? 110 : 100) - Math.round(j * 14) - (j >= 1 ? Math.min(24, Math.round((rt - 5.1) * 14)) : 0);
      const foot = Math.round((ra ? 46 : 80) + j * ((ra ? 80 : 80) - (ra ? 46 : 80)) - Math.sin(j * Math.PI) * 12);
      if (glow) {
        g.globalAlpha = 0.25 + 0.25 * Math.sin(rt * 14); rect(px + 4, foot - 29, 24, 30, '#fff6b0'); g.globalAlpha = 1;
        for (let i = 0; i < 5; i++) { const q = (rt * 1.7 + i / 5) % 1, sx = px + 16 + Math.round(Math.sin(i * 2.4 + rt * 3) * 12), sy = Math.round(foot - 4 - q * 30); if (Math.floor(rt * 16 + i) % 2) { rect(sx - 1, sy, 3, 1, '#ffe24a'); rect(sx, sy - 1, 1, 3, '#ffe24a'); } }
      }
      opSpr('goririn', px, foot, false, j >= 1, rt);
      if (rt > 4.3 && rt < 4.6) { g.globalAlpha = 1 - (rt - 4.3) / 0.3; rect(0, 0, 160, 90, '#ffffff'); g.globalAlpha = 1; }   // flash
    }
    if (k === 'start') {
      const a = Math.min(1, st / 0.6);
      g.globalAlpha = a * 0.45; rect(0, 0, 160, 90, '#14182a'); g.globalAlpha = 1;
      if (a >= 1) { const lg = opLogo(8); T('ぼうけんの はじまりだ！', 80, lg ? 52 : 38, { size: 8, c: '#ffe24a', ol: '#ffffff', ol2: '#5a2040', al: 'center' }); }
      const out = t - (OP_END - 1.2); if (out > 0) { g.globalAlpha = Math.min(1, out / 1.2); rect(0, 0, 160, 90, '#ffffff'); g.globalAlpha = 1; }
    } else {
      const lines = k === 'room' && t - OP[2].t > 4.6 ? ['…うごいた！？', ''] : S.text;
      opBox(lines, Math.min(st - 0.4, nextT - t) * 3);
    }
    if (si === 0 && st < 0.6) { g.globalAlpha = 1 - st / 0.6; rect(0, 0, 160, 90, '#000000'); g.globalAlpha = 1; }   // fade in
    if (t > 1) T(TOUCH ? 'タップで スキップ' : 'キーで スキップ', 158, 84, { size: 4, c: '#ffffff', ol: '#1a3a5a', al: 'right' });
  }
  function drawTitle() {
    if (G.titleScreen) { drawSetup(); return; }
    { const c = OP_CHIP; rect(c[0], c[1], c[2], c[3], '#5a3418'); rect(c[0] + 1, c[1] + 1, c[2] - 2, c[3] - 2, '#fff8e0'); T('▶オープニング', c[0] + c[2] / 2, c[1] + 1.5, { size: 4, c: '#5a3418', al: 'center' }); }
    const ly = opLogo(1) ? OPART.logo.height - 28 : 0;   // title_logo.png at native size, centred
    if (!ly && !OPART.logo) {
      T('ぬいぐるみ', 80, 4, { size: 12, c: '#ff6fa8', ol: '#ffffff', ol2: '#5a2040', al: 'center' });
      T('モンスター', 80, 17.5, { size: 12, c: '#5ccf3a', ol: '#ffffff', ol2: '#1f4a18', al: 'center' });
    }
    T('Plush Monsters Adventure', 80, 31 + ly, { size: 4, c: '#ffffff', ol: '#2a2a3a', al: 'center' });
    if ((G.t % 1.2) < 0.85) T(TOUCH ? 'けってい で はじめる' : 'ENTER で はじめる', 80, 38 + ly, { size: 4, c: '#fff6b0', ol: '#4a2c12', al: 'center' });
    if (G.hasSave) {
      const s = readSave();
      const st = STAGES[s && s.stage || 0];
      T(`セーブ: ${st ? st.name : ''}  Lv${(s && s.party && s.party[0] && s.party[0].lv) || 1}`, 80, 80, { size: 4, c: '#ffffff', ol: '#1a3a5a', al: 'center' });
    }
  }
  function drawNine(img, s, x, y, w, h) {
    const D = (sx, sy, dx, dy, dw, dh) => { if (dw > 0 && dh > 0) g.drawImage(img, sx, sy, s, s, dx, dy, dw, dh); };
    D(s, s, x + s, y + s, w - 2 * s, h - 2 * s);
    D(s, 0, x + s, y, w - 2 * s, s); D(s, 2 * s, x + s, y + h - s, w - 2 * s, s);
    D(0, s, x, y + s, s, h - 2 * s); D(2 * s, s, x + w - s, y + s, s, h - 2 * s);
    D(0, 0, x, y, s, s); D(2 * s, 0, x + w - s, y, s, s); D(0, 2 * s, x, y + h - s, s, s); D(2 * s, 2 * s, x + w - s, y + h - s, s, s);
  }
  function drawSetup() {
    // dim the scene, big hero on the left, framed menu on the right
    g.globalAlpha = 0.6; rect(0, 0, W, H, '#14182a'); g.globalAlpha = 1;
    const s = SPR.hero || SPR.player, wk = s.walk;
    const fr = wk ? wk.frames[Math.floor(G.t * 1000 / wk.ms) % wk.frames.length] : s;
    g.globalAlpha = 0.35; g.fillStyle = '#000000'; g.fillRect(18, 77, 40, 2); g.globalAlpha = 1;
    g.drawImage(s.native === -1 ? fr.f : fr.n, 6, 15, 64, 64);
    T(pName(), 38, 81, { size: 4, c: '#ffffff', ol: '#1a3a5a', al: 'center' });
    const P = SETUP, ph = SETUP_ROWS * P.rowH + 7;
    if (PROPS.ui_frame) drawNine(PROPS.ui_frame, 8, P.x, P.y, P.w, ph);
    else { rect(P.x, P.y, P.w, ph, '#5a3418'); rect(P.x + 1, P.y + 1, P.w - 2, ph - 2, '#f4e4b8'); }
    const asking = G.wipeAsk && G.t - G.wipeAsk < 4;
    const rows = [G.hasSave ? 'つづきから' : 'はじめる', 'たいせん', (HERO_GENDERS[G.gender | 0] || HERO_GENDERS[0]).name,
      (HERO_COLORS[G.hcolor | 0] || HERO_COLORS[0]).name, 'なまえ: ' + (G.pname || '？？？'), 'ライバル: ' + rName(), 'ひきつぎ',
      G.wiped ? 'けしました' : asking ? 'もういちどで けす' : 'データを けす'];
    rows.forEach((r, i) => {
      const y = P.rowY + i * P.rowH, on = (G.titleRow | 0) === i;
      if (on) {
        if (PROPS.ui_rowbar) drawNine(PROPS.ui_rowbar, 4, P.x + 4, y, P.w - 8, P.rowH);
        else rect(P.x + 2, y, P.w - 4, P.rowH - 1, '#ffd23a');
        if (PROPS.ui_cursor) g.drawImage(PROPS.ui_cursor, (Math.floor(G.t * 3) % 2) * 6, 0, 6, 7, P.x - 7, y + 2, 6, 7);
      }
      const c = i === ROW.erase && (G.wiped || asking) ? '#d0302a' : i === ROW.start ? '#2a7a1a' : i === ROW.vs || i === ROW.hk ? '#3c6ad8' : '#5a3418';
      if (i === ROW.gender || i === ROW.color) { T('◀', P.x + 3, y + 1.5, { size: 8, c: '#5a3418' }); T('▶', P.x + P.w - 10, y + 1.5, { size: 8, c: '#5a3418' }); }
      if (i === ROW.color) { const sw = HERO_COLORS[G.hcolor | 0] || HERO_COLORS[0]; rect(P.x + 13, y + 2, 7, 7, '#5a3418'); rect(P.x + 14, y + 3, 5, 5, sw.c); }
      const sz = measure(r, 8) <= P.w - 8 ? 8 : 4;
      T(r, P.x + P.w / 2 + (i === ROW.color ? 4 : 0), y + (sz === 8 ? 0.5 : 2.5), { size: sz, c, al: 'center' });
    });
    T(TOUCH ? 'つぎ:えらぶ ◀▶:かえる けってい:きめる' : '↑↓:えらぶ ←→:かえる Enter:きめる X:もどる', 80, 1, { size: 4, c: '#ffffff', ol: '#1a3a5a', al: 'center' });
  }
  function drawVersus() {
    const V = G.vs || { mine: 0, opp: 0, focus: 0 };
    rect(8, 6, 144, 58, '#5a3418');
    rect(10, 8, 140, 54, '#fff6e4');
    T('たいせん', 80, 10, { size: 8, c: '#e84878', ol: '#ffffff', al: 'center' });
    const mine = G.party[V.mine] || G.party[0];
    const opp = SPECIES[VS_LIST[V.opp]];
    T((V.focus === 0 ? '▶ ' : '  ') + 'じぶん  ' + (mine ? mine.name : '?') + ' Lv' + ((mine && mine.lv) || 1), 16, 24, { size: 4, c: '#5a3418' });
    T((V.focus === 1 ? '▶ ' : '  ') + 'あいて  ' + (opp ? opp.name : '?'), 16, 32, { size: 4, c: '#5a3418' });
    T((TOUCH ? '' : 'F ') + (V.friend ? 'ともだちが うごかす' : 'コンピュータが うごかす'), 16, 40, { size: 4, c: V.friend ? '#e84878' : '#7a5a38' });
    for (const b of VS_BTNS) {
      rect(b.x, 48, b.w, 12, '#5a3418'); rect(b.x + 1, 49, b.w - 2, 10, b.c);
      T(b.label, b.x + b.w / 2, 51, { size: 4, c: '#ffffff', al: 'center' });
    }
    T(TOUCH ? 'タップで えらぶ / もどる' : 'Enter:はじめる  O:へやを つくる  J:へやに はいる  Esc:もどる', 80, 66, { size: 4, c: '#ffffff', ol: '#1a3a5a', al: 'center' });
    const mineSp = mine && mine.sp;
    const oppSp = VS_LIST[V.opp];
    const blit = (sp, x, face) => {
      const s = SPR[SPECIES[sp] && SPECIES[sp].sprite];
      if (!s) return;
      g.drawImage(face < 0 ? s.f : s.n, x, 18, 16, 16);
    };
    if (mineSp) blit(mineSp, 118, 1);
    if (oppSp) blit(oppSp, 136, -1);
  }
  function render() {
    if (G.tapGate) { drawTapGate(); vctx.drawImage(low, 0, 0, W * S, H * S); flushText(); return; }
    if (G.op) { drawOpening(); vctx.drawImage(low, 0, 0, W * S, H * S); flushText(); return; }
    if (G.ending) {
      drawEnding(); drawTalk();
      vctx.drawImage(low, 0, 0, W * S, H * S); flushText();
      return;
    }
    if (G.state === 'hub') {
      drawHub(); drawBanner(); drawJkTut(); drawHk();
      vctx.drawImage(low, 0, 0, W * S, H * S); flushText();
      if (G.fade > 0) { vctx.globalAlpha = G.fade; vctx.fillStyle = '#ffffff'; vctx.fillRect(0, 0, view.width, view.height); vctx.globalAlpha = 1; }
      return;
    }
    if (G.state === 'map' || (G.state === 'talk' && G.talk && G.talk.onMap)) {
      drawMap(); drawMapHomeChip(); drawBanner(); if (G.state === 'talk') drawTalk(); drawHk();
      vctx.drawImage(low, 0, 0, W * S, H * S); flushText();
      if (G.fade > 0) { vctx.globalAlpha = G.fade; vctx.fillStyle = '#ffffff'; vctx.fillRect(0, 0, view.width, view.height); vctx.globalAlpha = 1; }
      return;
    }
    if (G.state === 'versus') {
      BG.draw(g, G.bg, 0, G.t, W);
      drawVersus();
      vctx.drawImage(low, 0, 0, W * S, H * S); flushText();
      return;
    }
    if (G.state === 'netroom') {
      BG.draw(g, G.bg, 0, G.t, W);
      rect(8, 16, 144, 40, '#5a3418');
      rect(10, 18, 140, 36, '#fff6e4');
      T('オンラインたいせん', 80, 22, { size: 4, c: '#3c6ad8', al: 'center' });
      { const st = NET.status || 'せつぞく中', long = st.length > 11, parts = long ? st.replace('（', '\n（').replace(': ', ':\n').split('\n') : [st];
        parts.forEach((l, i) => T(l, 80, (long ? 29 : 32) + i * 6, { size: long ? 4 : 8, c: '#5a3418', al: 'center' }));
        if (!long) T(G.netRole === 'host' ? 'この コードを ともだちに つたえて' : 'あいてを まってるよ', 80, 44, { size: 4, c: '#7a5a38', al: 'center' }); }
      rect(60, 60, 40, 12, '#5a3418'); rect(61, 61, 38, 10, '#a05a3a');
      T('やめる', 80, 63, { size: 4, c: '#ffffff', al: 'center' });
      vctx.drawImage(low, 0, 0, W * S, H * S); flushText();
      return;
    }
    let cam = Math.round(G.cam);
    const shake = G.shakeT > 0 ? (Math.floor(G.t * 60) % 2 ? 1 : -1) : 0;
    cam += shake;
    const arena = G.versus && G.battle && G.arena && ARENA[G.arena];
    if (arena) g.drawImage(arena, -cam, 0);
    else {
      if (!drawLayers(cam)) BG.draw(g, G.bg, cam, G.t, W);
      drawPlats(cam);
      drawRoadProps(cam); drawTown(cam); drawSign(cam); drawBench(cam);
      drawCS(cam, false);
      for (const a of G.npcs) drawActor(a, cam);
      drawCS(cam, true);
      for (const w of G.wilds) if (w.alive && w.alpha > 0) drawActor(w, cam);
      drawUsaFx(cam);
      if (G.invader && !G.battle && G.invader.alive) drawActor(G.invader, cam);
      if (G.talkGuests && !G.battle) for (const a of G.talkGuests) drawActor(a, cam);
      drawInvFx(cam);
    }
    drawArtFx(cam, 'under');
    if (G.battle && G.battle.w) drawActor(G.battle.w, cam);
    drawActor(comp, cam);
    drawActor(player, cam);
    if (G.oppHero && G.battle) drawActor(G.oppHero, cam);
    if (G.buddy && G.battle && G.buddy.alpha > 0) drawActor(G.buddy, cam);
    if (G.battle && G.battle.phase !== 'done') { drawBars(G.battle.w, G.battle.w, cam); if (comp.alpha > 0) drawBars(comp, ally(), cam); }
    if (G.battle && G.battle.phase !== 'done' && ally().guard && comp.alpha > 0) drawPattern(ICONS.shield, Math.round(comp.x - cam) - 4, GROUND - 42, { w: '#ffffff', y: '#6aa8e8' });
    drawFxShots(cam);
    drawArtFx(cam, 'top');
    drawParticles(cam);
    if (!G.battle) drawPickFx(cam);
    drawNearMark(cam);
    drawBattleFx();
    if (G.state !== 'title') {
      drawHUD(); drawTalk(); drawMenu(); drawBanner(); drawTut();
      // help + party (hi-res text)
      G.chip = null;
      if (tutOn()) { /* the tutorial box covers the top: no help line */ }
      else if (TOUCH) {
        if (G.state === 'battle') {
          const lab = G.waitMode ? 'WAIT' : 'ACTIVE', cw = Math.ceil(measure(lab)) + 4;
          G.chip = { x: 0, y: 0, w: cw + 6, h: 10 };   // generous tap area
          rect(1, 1, cw + 2, 7, '#5a3418'); rect(2, 2, cw, 5, G.waitMode ? '#fff8e0' : '#ffd23a');
          T(lab, 4, 2.5, { size: 4, c: '#5a3418' });
          T('ボタンをタップ', cw + 5, 2.5, { size: 4, c: '#ffffff', ol: '#1a3a5a' });
        } else T(G.state === 'menu' ? 'タップで えらぶ ／ そとを タップで とじる' : G.state === 'talk' ? 'タップで つぎへ' : 'ボタン:あるく・ジャンプ ／ まどタップ:どうぐ', 2, 1, { size: 4, c: '#ffffff', ol: '#1a3a5a' });
      } else {
        const help = G.state === 'battle' ? '1-8:コマンド ←→:えらぶ ↑↓:きりかえ T:' + (G.waitMode ? 'WAIT' : 'ACTIVE') + ' M:おと'
          : G.state === 'menu' ? '↑↓:えらぶ Enter:けってい X:とじる'
          : G.state === 'talk' ? 'Enter:つぎへ'
          : '←→:あるく ↑/Space:ジャンプ C:いれかえ I:どうぐ' + (STAGES[G.stage].town ? ' Enter:はなす' : '');
        T(help, 2, 1, { size: 4, c: '#ffffff', ol: '#1a3a5a' });
      }
      const m = ally();
      if (!tutOn()) T(`Lv${m.lv || 1} なかま${G.party.length}/${TUNING.partyMax}`, 158, 1, { size: 4, c: '#ffffff', ol: '#1a3a5a', al: 'right' });
      if (!tutOn()) T(`${G.coins}コイン`, 158, 6, { size: 4, c: '#ffe24a', ol: '#1a3a5a', al: 'right' });
    } else drawTitle();
    if (G.state === 'battle') drawJkTut();
    drawHk();
    vctx.drawImage(low, 0, 0, W * S, H * S);
    flushText();
    if (G.fade > 0) { vctx.globalAlpha = G.fade; vctx.fillStyle = '#ffffff'; vctx.fillRect(0, 0, view.width, view.height); vctx.globalAlpha = 1; }
  }


  // placeholder town people: the boy with his blue clothes recolored (replaced once the human sprites are approved)
  const NPC_LOOKS = { girl: [255, 111, 168], mushitori: [86, 180, 70], oneesan: [160, 96, 214], karate: [236, 236, 228], gaki: [236, 140, 40],
    child: [255, 160, 200], merchant: [150, 110, 60], mama: [230, 120, 90], kota: [90, 200, 220] };   // story people: until assets/story/*.png arrive
  function makeNpcSprites() {
    const src = SPR.player; if (!src) return;
    for (const [look, col] of Object.entries(NPC_LOOKS)) {
      const key = 'npc_' + look; if (SPR[key]) continue;
      const [n, nx] = mk(32, 32); nx.drawImage(src.n, 0, 0);
      const id = nx.getImageData(0, 0, 32, 32), d = id.data;
      for (let i = 0; i < d.length; i += 4) {
        if (!d[i + 3]) continue;
        const r = d[i], gg = d[i + 1], b = d[i + 2];
        if (b > r + 25 && b > gg + 5) { const f = Math.min(1.2, b / 210); d[i] = Math.min(255, col[0] * f); d[i + 1] = Math.min(255, col[1] * f); d[i + 2] = Math.min(255, col[2] * f); }
      }
      nx.putImageData(id, 0, 0);
      const [f, fx] = mk(32, 32); fx.translate(32, 0); fx.scale(-1, 1); fx.drawImage(n, 0, 0);
      SPR[key] = { n, f, wn: silhouette(n), wf: silhouette(f), native: src.native, top: src.top, w: src.w };
    }
  }
  // ---------- boot ----------
  let last = 0;
  function frame(now) {
    const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now; DT = dt || 1 / 60;
    nagTick(DT);
    if (G.jkTut) { G.jkTut.t += DT; if (G.fade > 0 && G.fadeSpeed < 0) G.fade = Math.max(0, G.fade + G.fadeSpeed * DT); } else update(DT);   // あいしょう pages pause everything
    render(); syncControls();
    requestAnimationFrame(frame);
  }
  // hand-drawn 16x16 art (assets/icons16): hub menu icons, and optional mini_<sprite id> plush minis. Only embedded files
  // are loaded (no 404s). A mini replaces any 16px draw of that plush's 32px frame; without one the downscaler is used.
  const ICON16 = {}, MINI = new WeakMap(), USF = {}, HART = {};
  async function loadIcons16() {
    if (typeof ASSET_DATA === 'undefined') return;
    const keys = Object.keys(ASSET_DATA).filter(k => k.indexOf('assets/icons16/') === 0);
    await Promise.all(keys.map(k => loadImg(k).then(img => {
      const id = k.slice(15, -4);
      if (img.width !== 16 || img.height !== 16) return;
      if (id.indexOf('mini_') === 0) {
        const s = SPR[id.slice(5)]; if (!s) return;
        const [n, nx] = mk(16, 16); nx.drawImage(img, 0, 0);
        const [f, fx] = mk(16, 16); fx.translate(16, 0); fx.scale(-1, 1); fx.drawImage(img, 0, 0);
        MINI.set(s.n, n); MINI.set(s.f, f);
      } else ICON16[id] = img;
    }).catch(() => {})));
  }
  async function boot() {
    resize();
    if (typeof SPRITES_PENDING !== 'undefined') for (const [k, s] of Object.entries(SPRITES_PENDING)) if (artReady(s.src)) SPRITES[k] = s;
    if (typeof SPRITES_PH !== 'undefined') for (const [k, s] of Object.entries(SPRITES_PH)) if (typeof ASSET_DATA !== 'undefined' && ASSET_DATA[s.src]) SPRITES[k] = s;
    await Promise.all(Object.entries(SPRITES).map(([k, s]) => loadImg(s.src).then(img => prepSprite(k, img))));
    if (typeof SPRITES_PH !== 'undefined') for (const [k, s] of Object.entries(SPRITES_PH)) if (!SPR[k]) { SPRITES[k] = { native: 1 }; prepSprite(k, makePh(s.ph)); }
    if (typeof ASSET_DATA !== 'undefined') await Promise.all(STAGES.filter(st => st.bgImg && ASSET_DATA[st.bgImg]).map(st => loadImg(st.bgImg).then(img => { EVBG[st.id] = img; }).catch(() => {})));
    await Promise.all(Object.entries(SPRITES).filter(([, s]) => s.walk).map(([k, s]) => loadImg(s.walk.src).then(img => prepWalk(k, img, s.walk)).catch(() => {})));
    await Promise.all(Object.entries(SPRITES).filter(([, s]) => s.attack).map(([k, s]) => loadImg(s.attack.src).then(img => { SPR[k].attack = sheetFrames(img, s.attack.frames); }).catch(() => {})));
    makeCrownSprites();
    await loadIcons16();
    // うさひめ fx art (only when embedded): laugh 32x32x4 @160ms loop, aura 48x48x4 @120ms loop, aura break 48x48x6 @70ms once
    if (typeof ASSET_DATA !== 'undefined') await Promise.all([['machine', 'assets/gacha_machine.png'], ['capsule', 'assets/gacha_capsule_open.png', 6, 32], ['t0', 'assets/training_small.png'],
      ['t1', 'assets/training_medium.png'], ['t2', 'assets/training_large.png'], ['banner', 'assets/event_banner.png']]
      .filter(([, src]) => ASSET_DATA[src]).map(([k, src, n, S]) => loadImg(src).then(img => { HART[k] = n ? sheetFrames(img, n, S) : img; }).catch(() => {})));
    if (typeof ASSET_DATA !== 'undefined') await Promise.all([['laugh', 'assets/usahime_laugh.png', 4, 32], ['aura', 'assets/usahime_aura.png', 4, 48], ['brk', 'assets/usahime_aura_break.png', 6, 48]]
      .filter(([, src]) => ASSET_DATA[src]).map(([k, src, n, S]) => loadImg(src).then(img => { USF[k] = sheetFrames(img, n, S); }).catch(() => {})));
    if (typeof FX_ART !== 'undefined') await Promise.all(Object.keys(FX_ART).map(sp => Promise.all([loadImg('assets/fx/' + sp + '_shot.png'), loadImg('assets/fx/' + sp + '_hit.png')])
      .then(([a, b]) => { FXIMG[sp] = { shot: sheetFrames(a, 4), hit: sheetFrames(b, FX_ART[sp].hit.n || 4, FX_ART[sp].hit.size || 32) }; }).catch(() => {})));
    // optional 'super' fx art (e.g. 超はかいおぐり波): only when embedded in ASSET_DATA, so no 404s; else the normal fx is drawn scaled up
    if (typeof FX_ART !== 'undefined') await Promise.all(Object.keys(FX_ART).filter(sp => FXIMG[sp] && FX_ART[sp].circle).map(sp => loadImg(FX_ART[sp].circle.src).then(img => {
      const c = FX_ART[sp].circle; FXIMG[sp].circle = c.dur.map((_, i) => { const [cv, x] = mk(c.fw, c.fh); x.drawImage(img, i * c.fw, 0, c.fw, c.fh, 0, 0, c.fw, c.fh); return cv; });
    }).catch(() => {})));
    if (typeof FX_ART !== 'undefined' && typeof ASSET_DATA !== 'undefined') await Promise.all(Object.keys(FX_ART).filter(sp => FXIMG[sp]).map(sp => {
      const ks = 'assets/fx/' + sp + '_shot_super.png', kh = 'assets/fx/' + sp + '_hit_super.png', H = FX_ART[sp].hitSuper || FX_ART[sp].hit;
      return Promise.all([ASSET_DATA[ks] ? loadImg(ks).then(i => { FXIMG[sp].shotS = sheetFrames(i, 4, Math.round(i.height)); }) : 0,
                          ASSET_DATA[kh] ? loadImg(kh).then(i => { FXIMG[sp].hitS = sheetFrames(i, H.n || 4, Math.round(i.height)); }) : 0]).catch(() => {});
    }));
    await Promise.all(Object.entries(PROP_IMGS).filter(([, src]) => artReady(src)).map(([k, src]) => loadImg(src).then(img => { PROPS[k] = img; }).catch(e => console.warn(e))));
    makeNpcSprites();
    try { await document.fonts.load('8px Misaki'); await document.fonts.load("8px 'DotGothic16'"); } catch (e) { console.warn('font load failed', e); }
    G.bg = G.bgCache.oka = BG.build(WORLD_W, STAGES[0].theme);
    G.party = [newMember('goririn')];
    spawnWilds();
    // title composition mirrors the KV: boy + Goririn on the left, Oguri on the right
    G.wilds[0].x = 128; G.wilds[0].face = -1;
    G.state = 'title';
    G.hasSave = !!readSave();
    G.gender = 0; G.hcolor = 0; G.titleRow = 0; G.titleScreen = 0;
    try { const h = JSON.parse(localStorage.getItem(HERO_KEY) || 'null'); if (h && typeof h === 'object') { G.gender = (h.g | 0) % HERO_GENDERS.length; G.hcolor = (h.c | 0) % HERO_COLORS.length; G.pname = String(h.n || '').slice(0, 6); G.rname = String(h.r || '').slice(0, 6); } } catch (e) {}
    if (params.has('hero')) { const [g, c] = params.get('hero').split(',').map(v => parseInt(v, 10) || 0); G.gender = g % HERO_GENDERS.length; G.hcolor = c % HERO_COLORS.length; }
    buildHero();
    if (params.has('tut')) { G.forceTut = true; }
    if (params.has('skiptitle')) startGame(false);
    else if (!opSeen() && !params.has('noop')) G.tapGate = true;
    requestAnimationFrame(frame);
  }
  // debug / test hooks
  window.NM = { SPR, trainBuy, tgTap, TG_TUNE, gachaPull, gachaNext, evStart, evToday, evSpecial, GACHA_POOL: () => gachaPool(), TR_TIERS, EVENTS, USF, get carrots() { return carrotsBack(); }, hasMini: k => !!(SPR[k] && MINI.get(SPR[k].n)), openHub, hubKey, hubTap, jstDay, SFX, playEnding, startGame, usahimeMeet, carrotsBack, mapKey, menuPick, get menuRows() { return G.menu ? menuRows() : []; }, measure, wrapW, G, openSetup, setHero, openName, closeName, player, comp, interact, openBag, startBattle, choose, enterStage, openMap, clearStage, recruitChance, persist, wipeSave, confirmSwap, startTrainer, grantXp, tryEvolve, startVersus, closeNet, openNet, NET, get ally() { return ally(); }, get layout() { return layout; }, TOUCH, BTN, openHk, closeHk, AUTH, acctCheck, cloudPut, saveObj, get hk() { return G.hk; } };
  boot().catch(e => { $err.textContent += String(e) + '\n'; console.error(e); });
})();
