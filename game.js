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
      scale = forced > 0 ? forced : (Math.floor(fit) >= 3 ? Math.floor(fit) : fit);
      mode = (vw - W * scale) / 2 >= 96 ? 'outside' : 'overlay';
    } else {
      mode = 'portrait';
      const pf = Math.min(vw / W, (vh * 0.5) / H);
      scale = forced > 0 ? forced : (Math.floor(pf) >= 3 ? Math.floor(pf) : pf);
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
  function syncControls() {
    if (!TOUCH) return;
    const st = (G.state === 'field' || G.state === 'map') ? 'field' : G.state === 'title' && !G.nameEdit ? 'title' : 'off';
    const key = st + layout.mode;
    if (key === ctlState) return;
    ctlState = key;
    $jump.textContent = st === 'title' ? 'けってい' : 'ジャンプ'; $swap.textContent = st === 'title' ? 'つぎ' : 'いれかえ';
    const hide = st === 'off' && layout.mode === 'overlay';
    for (const el of [$pad, $acts]) { el.classList.toggle('hide', hide); el.classList.toggle('off', st === 'off' && !hide); }
    if (st === 'off') { touchDir.clear(); for (const el of [$bL, $bR, $jump, $swap]) el.classList.remove('on'); }
  }
  const touchDir = new Map();   // pointerId -> -1 | 1  (multi-touch d-pad)
  function padDir() { let l = false, r = false; for (const d of touchDir.values()) d < 0 ? (l = true) : (r = true); return (r ? 1 : 0) - (l ? 1 : 0); }
  function padSync() { const d = [...touchDir.values()]; $bL.classList.toggle('on', d.includes(-1)); $bR.classList.toggle('on', d.includes(1)); }
  function dirAt(x, y) { const el = document.elementFromPoint(x, y); return el && el.closest('#bL') ? -1 : el && el.closest('#bR') ? 1 : 0; }
  for (const [el, dir] of [[$bL, -1], [$bR, 1]]) {
    el.addEventListener('pointerdown', e => { e.preventDefault(); touchDir.set(e.pointerId, dir); padSync(); if (G.state === 'title') onKey(dir < 0 ? 'ArrowLeft' : 'ArrowRight'); });
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
    el.addEventListener('pointerdown', e => { e.preventDefault(); el.classList.add('on'); if (G.state !== 'title') onKey(code); else if (el === $swap) onKey('ArrowDown'); });
    // title けってい fires on release: opening the name box needs a finished tap for the phone keyboard
    el.addEventListener('pointerup', () => { if (G.state === 'title' && el === $jump && el.classList.contains('on')) titleConfirm(); });
    const up = () => el.classList.remove('on');
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('pointerleave', up);
  }
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
  function loadImg(src) {
    return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('failed to load ' + src)); i.src = (typeof ASSET_DATA !== 'undefined' && ASSET_DATA[src]) ? ASSET_DATA[src] : src; });
  }
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

  // ---------- game state ----------
  const G = {
    state: 'loading', t: 0, cam: 0, camT: 0, shakeT: 0,
    party: [], active: 0, wilds: [], particles: [], pops: [],
    banner: null, fade: 0, fadeSpeed: 0, battle: null, waitMode: true,
    hoverBtn: -1, bg: null, signNear: false, forceRecruit: null,
    stage: 0, unlocked: 1, cleared: [], mapSel: 0, mapPos: null, benchUsed: false, benchNear: false, bgCache: {},
    hasSave: false, muted: false, versus: false, vs: null, saveFlash: 0, 
    coins: 50, items: {}, beaten: [], flags: {}, cookie: false, npcs: [], near: null, talk: null, menu: null,
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
  function buildHero() {
    const gd = HERO_GENDERS[G.gender | 0] || HERO_GENDERS[0], src = SPR[gd.key] || SPR.player;
    const col = (HERO_COLORS[G.hcolor | 0] || HERO_COLORS[0]).c;
    SPR.hero = Object.assign({}, src, { n: recolor(src.n, gd, col), f: recolor(src.f, gd, col) });
    if (src.walk) SPR.hero.walk = { ms: src.walk.ms, frames: src.walk.frames.map(fr => Object.assign({}, fr, { n: recolor(fr.n, gd, col), f: recolor(fr.f, gd, col) })) };
    player.key = 'hero';
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
  const SETUP_ROWS = 6, SETUP = { x: 70, y: 9, w: 86, rowY: 13, rowH: 11 };
  function openSetup() { G.titleScreen = 1; G.titleRow = 0; G.wipeAsk = 0; SFX.blip(); }
  function titleConfirm() {
    if (G.state !== 'title' || G.nameEdit) return;
    if (!G.titleScreen) openSetup(); else titleRowAction(G.titleRow | 0);
  }
  function titleRowAction(row) {
    if (row === 0) { startGame(G.hasSave); return; }
    if (row === 1) { setHero(1, 0); return; }
    if (row === 2) { setHero(0, 1); return; }
    if (row === 3 || row === 4) { openName(row === 4 ? 'r' : 'p'); return; }
    if (row !== 5 || G.wiped) return;
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
  function persist() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        v: 3,
        party: G.party.map(m => ({
          sp: m.sp, hp: Math.round(m.hp), maxHp: m.maxHp, atk: m.atk, def: m.def, spd: m.spd,
          lv: m.lv || 1, xp: m.xp || 0,
        })),
        muted: !!G.muted,
        active: G.active,
        unlocked: G.unlocked,
        cleared: G.cleared,
        stage: G.stage,
        px: Math.round(player.x),
        coins: G.coins | 0, items: G.items, beaten: G.beaten, flags: G.flags, cookie: !!G.cookie,
        savedAt: Date.now(),
      }));
      G.hasSave = true;
      G.saveFlash = 1.2;
    } catch (e) { /* ignore quota / private mode */ }
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
  function grantXp(amt) {
    const m = ally();
    if (!m || amt <= 0) return 0;
    m.xp = (m.xp || 0) + amt;
    let n = 0;
    while (m.xp >= xpNeed(m.lv || 1)) {
      m.xp -= xpNeed(m.lv || 1);
      m.lv = (m.lv || 1) + 1;
      m.maxHp += 4; m.hp = Math.min(m.maxHp, m.hp + 4);
      m.atk += 1; m.def += 1;
      if (m.lv % 2 === 0) m.spd += 1;
      n++;
    }
    return n;
  }
  const SFX = (() => {
    let ctx = null, master = null, bgmGain = null, ticking = false, step = 0, theme = 'title';
    const n2f = n => n <= 0 ? 0 : 440 * Math.pow(2, (n - 69) / 12);
    function ac() {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
        master = ctx.createGain(); master.gain.value = 0.7; master.connect(ctx.destination);
        bgmGain = ctx.createGain(); bgmGain.gain.value = G.muted ? 0 : 0.22; bgmGain.connect(master);
      }
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }
    function tone(dest, freq, dur, type, vol, slide) {
      const c = ac(); if (!c || !freq) return;
      const o = c.createOscillator(), g = c.createGain();
      o.type = type || 'square';
      o.frequency.setValueAtTime(freq, c.currentTime);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, slide), c.currentTime + dur);
      g.gain.setValueAtTime(vol, c.currentTime);
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
      g.gain.setValueAtTime(vol, c.currentTime);
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
      g.gain.setValueAtTime(vol, c.currentTime);
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
      town:   { bpm: 120, lead: [76,79,84,79, 81,79,76,0, 74,77,81,77, 79,76,72,0], bass: [48,55,52,55, 53,57,48,57, 50,53,57,53, 55,59,48,0] },
      map:    { bpm: 88,  lead: [72,0,74,0, 76,0,74,0, 72,0,69,0, 71,0,72,0], bass: [48,0,0,55, 45,0,0,52, 41,0,0,48, 43,0,0,50] },
    };
    function tick() {
      if (!ticking || !ctx) return;
      const song = SONGS[theme] || SONGS.field;
      const beat = 60 / song.bpm / 2;
      const len = song.lead.length;
      if (!G.muted && bgmGain) {
        const lead = song.lead[step % len];
        const bass = song.bass[step % song.bass.length];
        const isBattle = theme === 'battle';
        if (lead) tone(bgmGain, n2f(lead), beat * (isBattle ? 0.55 : 0.85), isBattle ? 'sawtooth' : 'square', isBattle ? 0.08 : 0.07);
        if (bass) tone(bgmGain, n2f(bass), beat * (isBattle ? 0.7 : 0.95), 'square', isBattle ? 0.11 : 0.09);
        if (isBattle && song.drum) {
          const dr = song.drum[step % song.drum.length];
          if (dr === 1) tone(bgmGain, 90, 0.06, 'square', 0.08, 50);
          if (dr === 2) { tone(bgmGain, 220, 0.04, 'square', 0.04); noise(0.05, 0.06, 1800); }
        } else if (step % 4 === 0) tone(bgmGain, 180, 0.04, 'square', 0.03);
      }
      step = (step + 1) % len;
      setTimeout(tick, beat * 1000);
    }
    function start() {
      const c = ac(); if (!c) return;
      applyMute();
      if (!ticking) { ticking = true; step = 0; tick(); }
    }
    function applyMute() {
      if (!bgmGain || !ctx) return;
      bgmGain.gain.cancelScheduledValues(ctx.currentTime);
      bgmGain.gain.setTargetAtTime(G.muted ? 0 : 0.22, ctx.currentTime, 0.05);
    }
    function setTheme(name) {
      if (name && name !== theme) { theme = name; step = 0; }
    }
    function sync() {
      let name = 'field';
      if (G.state === 'title') name = 'title';
      else if (G.state === 'map') name = 'map';
      else if (G.state === 'battle') name = 'battle';
      else {
        const th = STAGES[G.stage] && STAGES[G.stage].theme;
        name = SONGS[th] ? th : 'field';
      }
      setTheme(name);
    }
    return {
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
          setTimeout(() => { if (!G.muted && bgmGain && ctx) bgmGain.gain.setTargetAtTime(0.22, ctx.currentTime, 0.12); }, 1400);
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
  const compKey = () => SPECIES[ally().sp].sprite;

  function spawnWilds() {
    G.wilds = STAGES[G.stage].spawns.map((s, i) => Object.assign(newActor(s.x, -1, SPECIES[s.sp].sprite), newMember(s.sp), {
      home: s.x, spawnX: s.x, alive: true, cool: false, wt: 1 + rand() * 2, wdir: 0, toHome: false, idx: i,
    }));
  }

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
  const stRate = u => TUNING.stBase + u.spd * TUNING.stPerSpd;
  function calcDmg(a, d, mv) { return Math.max(1, Math.round(mv.power * a.atk / (a.atk + d.def) * (0.85 + rand() * 0.3))); }
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
    if (G.state === 'title') {
      if (code === 'KeyN') { wipeSave(); startGame(false); return; }
      if (G.nameEdit) return;
      const ok = ['Enter', 'Space', 'NumpadEnter', 'Digit1'].includes(code);
      if (!G.titleScreen) { if (ok) openSetup(); return; }
      if (['Escape', 'KeyX', 'Backspace'].includes(code)) { G.titleScreen = 0; SFX.blip(); return; }
      if (['ArrowUp', 'KeyW'].includes(code)) { G.titleRow = ((G.titleRow | 0) + SETUP_ROWS - 1) % SETUP_ROWS; G.wipeAsk = 0; SFX.blip(); return; }
      if (['ArrowDown', 'KeyS', 'Tab'].includes(code)) { G.titleRow = ((G.titleRow | 0) + 1) % SETUP_ROWS; G.wipeAsk = 0; SFX.blip(); return; }
      const d = (code === 'ArrowLeft' || code === 'KeyA') ? -1 : (code === 'ArrowRight' || code === 'KeyD') ? 1 : 0;
      if (d && G.titleRow === 1) { setHero(d, 0); return; }
      if (d && G.titleRow === 2) { setHero(0, d); return; }
      if (ok) titleRowAction(G.titleRow | 0);
      return;
    }
    if (G.state === 'versus') { versusKey(code); return; }
    if (code === 'KeyT') { G.waitMode = !G.waitMode; banner(G.waitMode ? 'WAITモード：えらぶ あいだ じかんが とまる' : 'ACTIVEモード：えらぶ あいだも あいては うごく', 1.6); return; }
    if (code === 'KeyM') {
      G.muted = !G.muted; persist(); SFX.setMuted(); SFX.start();
      banner(G.muted ? 'おと オフ' : 'おと オン', 1.1); return;
    }
    if (G.state === 'map') { mapKey(code); return; }
    if (G.state === 'talk') { if (['Enter', 'NumpadEnter', 'Space', 'KeyE', 'KeyX', 'Escape', 'ArrowDown', 'KeyS'].includes(code)) talkNext(); return; }
    if (G.state === 'menu') { menuKey(code); return; }
    if (G.state === 'field') {
      if (['Space', 'ArrowUp', 'KeyW'].includes(code)) jump(player, true);
      if (code === 'KeyC' || code === 'Tab') swapActive();
      if (['Enter', 'NumpadEnter', 'KeyE', 'ArrowDown', 'KeyS'].includes(code) && G.near) interact();
      if (code === 'KeyI') openBag();
      return;
    }
    if (G.state === 'battle') {
      const B = G.battle;
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

  const MSGBOX = { x: 42, y: 72, w: 56, h: 17 };
  const BTN = [0, 1, 2, 3].map(i => ({ x: 98 + i * 14, y: 74, w: 13, h: 13 }));
  const PAGETAB = { x: 154, y: 74, w: 6, h: 13 };
  const cmdPage = () => (G.battle && G.battle.phase !== 'swap' ? (G.battle.sel >> 2) : 0);
  function logicalPos(e) { const r = view.getBoundingClientRect(); return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height]; }
  const inRect = (x, y, b) => b && x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h;
  function btnAt(x, y) { return BTN.findIndex(b => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h); }
  view.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    const [x, y] = logicalPos(e); const i = btnAt(x, y);
    G.hoverBtn = i;
    const active = G.state === 'battle' && G.battle.phase === 'input';
    if (active && i >= 0) G.battle.sel = cmdPage() * 4 + i;
    view.style.cursor = (active && i >= 0) || G.state === 'title' ? 'pointer' : 'default';
  });
  const titleTarget = e => G.state === 'title' && !G.nameEdit && !nameBox.contains(e.target) && !(e.target.closest && e.target.closest('.ctl'));
  window.addEventListener('pointerdown', e => {
    if (!titleTarget(e) || !G.titleScreen) return;
    const [x, y] = logicalPos(e), row = setupRowAt(x, y);
    if (row < 0) return;
    if (row !== G.titleRow) G.wipeAsk = 0;
    G.titleRow = row;
    const d = x < SETUP.x + SETUP.w / 2 ? -1 : 1;
    if (row === 1) setHero(d, 0); else if (row === 2) setHero(0, d);
  });
  // other rows act on release (phone keyboards need a finished tap to focus the name box)
  window.addEventListener('pointerup', e => {
    if (!titleTarget(e)) return;
    if (!G.titleScreen) { openSetup(); return; }
    const [x, y] = logicalPos(e), row = setupRowAt(x, y);
    if (row === 0 || row >= 3) titleRowAction(row);
  });
  view.addEventListener('pointerdown', e => {
    if (G.state === 'title') return;
    e.preventDefault();
    const [x, y] = logicalPos(e);
    if (G.state === 'versus') { versusTap(x, y); return; }
    if (G.chip && inRect(x, y, G.chip)) { onKey('KeyT'); return; }
    if (G.state === 'talk') { talkNext(); return; }
    if (G.state === 'menu' || (G.state === 'battle' && G.battle && G.battle.phase === 'menu')) { menuTap(x, y); return; }
    if (G.state === 'battle' && G.battle && G.battle.phase === 'input' && inRect(x, y, PAGETAB)) { G.battle.sel = (G.battle.sel + 4) % COMMANDS.length; SFX.blip(); return; }
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
    SFX.start();
    if (G.state !== 'title') return;
    const s = fromSave ? readSave() : null;
    if (s && Array.isArray(s.party) && s.party.length) {
      G.party = s.party.filter(m => SPECIES[m.sp]).map(m => newMember(m.sp, m.hp, {
        maxHp: m.maxHp, atk: m.atk, def: m.def, spd: m.spd, lv: m.lv || 1, xp: m.xp || 0,
      }));
      if (!G.party.length) G.party = [newMember('goririn')];
      G.active = Math.max(0, Math.min(s.active | 0, G.party.length - 1));
      G.unlocked = Math.max(1, s.unlocked | 0);
      G.cleared = Array.isArray(s.cleared) ? s.cleared.slice() : [];
      // v2 saves (town briefly sat at map index 2): drop that slot so the field stages line up again
      if ((s.v | 0) === 2 && G.unlocked >= 3) G.unlocked -= 1;
      G.coins = s.coins != null ? s.coins | 0 : 50;
      G.items = s.items && typeof s.items === 'object' ? Object.assign({}, s.items) : {};
      G.beaten = Array.isArray(s.beaten) ? s.beaten.slice() : [];
      G.flags = s.flags && typeof s.flags === 'object' ? Object.assign({}, s.flags) : {};
      G.cookie = !!s.cookie;
      if (s.muted != null) G.muted = !!s.muted;
      const i = Math.max(0, Math.min(s.stage | 0, STAGES.length - 1));
      enterStage(i, { heal: false, startX: s.px });
      return;
    }
    G.state = 'field';
    G.wilds[0].toHome = true;   // the title-screen Oguri trots off to its spot
    banner(STAGES[0].name, 2.2);
    persist();
  }
  // ---------- stages / world map ----------
  function enterStage(i, opts) {
    const st = STAGES[i];
    const heal = !opts || opts.heal !== false;
    G.stage = i; WORLD_W = st.width;
    G.bg = G.bgCache[st.id] || (G.bgCache[st.id] = BG.build(st.width, st.theme, st.theme === 'town' && PROPS.town_road ? Object.assign({}, PROPS, { road: PROPS.town_road }) : PROPS));
    spawnWilds();
    G.npcs = (st.npcs || []).map(n => {
      const d = n.rival ? Object.assign({}, n, n.rival[(G.gender | 0) === 1 ? 'boy' : 'girl'], { name: 'ライバルの ' + rName() }) : n;
      return Object.assign(newActor(n.x, -1, d.look === 'player' ? 'player' : 'npc_' + d.look), { def: d });
    });
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
    banner(st.name + '  セーブした', 1.6);
    persist();
  }
  const VS_LIST = Object.keys(SPECIES).filter(k => !SPECIES[k].boss);
  function startVersus() {
    SFX.start();
    const s = readSave();
    if (s && Array.isArray(s.party) && s.party.length) {
      G.party = s.party.filter(m => SPECIES[m.sp]).map(m => newMember(m.sp, m.maxHp || m.hp, {
        maxHp: m.maxHp, atk: m.atk, def: m.def, spd: m.spd, lv: m.lv || 1, xp: m.xp || 0,
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
    if (code === 'Escape' || code === 'KeyN') { G.state = 'title'; return; }
    if (code === 'KeyF') { V.friend = !V.friend; return; }
    if (code === 'ArrowDown' || code === 'KeyS') V.focus = 1;
    const dir = (code === 'ArrowRight' || code === 'KeyD') ? 1 : (code === 'ArrowLeft' || code === 'KeyA') ? -1 : 0;
    if (dir) {
      if (V.focus === 0) V.mine = (V.mine + dir + G.party.length) % G.party.length;
      else V.opp = (V.opp + dir + VS_LIST.length) % VS_LIST.length;
    }
    if (['Enter', 'Space', 'NumpadEnter', 'Digit1'].includes(code)) launchVersus();
  }
  function versusTap(x, y) {
    const V = G.vs; if (!V) return;
    if (y < 28) { V.focus = 0; V.mine = (V.mine + 1) % G.party.length; }
    else if (y < 38) { V.focus = 1; V.opp = (V.opp + 1) % VS_LIST.length; }
    else if (y < 48) V.friend = !V.friend;
    else if (x > 96) openNet(true);
    else launchVersus();
  }
  function launchVersus() {
    const V = G.vs; if (!V) return;
    G.active = V.mine;
    for (const m of G.party) { m.hp = m.maxHp; m.st = 0; }
    const sp = VS_LIST[V.opp];
    const w = Object.assign(newActor(110, -1, SPECIES[sp].sprite), newMember(sp), {
      alive: true, home: 110, spawnX: 110, cool: false,
    });
    player.x = 36; comp.x = 58; player.face = 1; comp.face = 1;
    G.cam = G.camT = 0;
    G.versus = true;
    G.friend = !!V.friend || G.netRole === 'host';
    if (G.netRole !== 'host') G.netRole = null;
    G.wilds.forEach(w => { w.alpha = 0; });
    G.state = 'field';
    startBattle(w);
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
      G.netRole = 'guest';
      G.friend = true;
      G.versus = true;
      const sp = NET.mine.sp;
      G.party = [newMember(sp)];
      G.active = 0;
      const w = Object.assign(newActor(110, -1, SPECIES[msg.sp].sprite), newMember(msg.sp), { alive: true, home: 110, spawnX: 110 });
      player.x = 36; comp.x = 58;
      G.wilds.forEach(a => { a.alpha = 0; });
      G.state = 'field';
      startBattle(w);
    } else if (msg.t === 'cmd' && G.battle && G.battle.phase === 'input' && G.battle.who === 'opp') {
      choose(COMMANDS.findIndex(c => c.kind === msg.kind));
    } else if (msg.t === 'bye') {
      banner('あいてが きれた', 1.6);
    }
  }
  function beginNetBattle() {
    const opp = NET.opp; if (!opp) return;
    const i = VS_LIST.indexOf(opp.sp);
    G.vs.opp = i >= 0 ? i : 0;
    G.vs.friend = true;
    G.netRole = 'host';
    launchVersus();
    netSend({ t: 'start', sp: G.party[G.active].sp, name: ally().name });
  }
  function openNet(host) {
    if (typeof Peer === 'undefined') { banner('つうしんの よみこみに しっぱい', 2); return; }
    SFX.start();
    const mine = G.party[G.vs.mine] || G.party[0];
    NET.mine = { sp: mine.sp, name: mine.name };
    if (host) {
      NET.code = netCode();
      G.netRole = 'host';
      NET.status = 'へや ' + NET.code;
      NET.peer = new Peer('nmg-' + NET.code);
      NET.peer.on('connection', c => { NET.conn = c; c.on('data', onNet); c.on('open', () => netSend({ t: 'pick', sp: mine.sp, name: mine.name })); });
    } else {
      const code = (window.prompt('あいての へやコード') || '').trim().toLowerCase();
      if (!code) return;
      G.netRole = 'guest';
      NET.status = code + ' に せつぞく中';
      NET.peer = new Peer();
      NET.peer.on('open', () => {
        NET.conn = NET.peer.connect('nmg-' + code);
        NET.conn.on('data', onNet);
        NET.conn.on('open', () => netSend({ t: 'pick', sp: mine.sp, name: mine.name }));
      });
    }
    G.state = 'netroom';
  }

  // ---------- town: people, buildings, shop, items ----------
  function updateNear() {
    const st = STAGES[G.stage];
    G.near = null;
    if (!st.town) return;
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
  function say(name, pages, then) {
    G.talk = { name, pages: pages.map(p => p.map(l => l.replace('{BAG}', bagWord()).replace('{NAME}', pName()))), i: 0, then };
    G.state = 'talk'; player.moving = false; comp.moving = false;
    SFX.blip();
  }
  function talkNext() {
    const t = G.talk; if (!t) { G.state = 'field'; return; }
    t.i++;
    SFX.blip();
    if (t.i < t.pages.length) return;
    G.talk = null; G.state = 'field';
    if (t.then) t.then();
  }
  function interact() {
    const n = G.near; if (!n) return;
    if (n.type === 'npc') {
      const d = n.a.def;
      if (d.battle && !G.beaten.includes(d.id)) say(d.name, d.lines, () => startTrainer(n.a));
      else say(d.name, (d.battle && d.after) || d.lines);
      return;
    }
    const b = n.b;
    if (b.k === 'shop') say(b.name, [['いらっしゃいませ！', 'ゆっくり みていってね']], openShop);
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
  function startTrainer(a) {
    const d = a.def, bt = d.battle;
    const m = newMember(bt.sp);
    m.maxHp = m.hp = Math.round(m.maxHp * bt.mul);
    m.atk = Math.round(m.atk * bt.mul); m.def = Math.round(m.def * bt.mul);
    if (bt.mul >= 1.3) m.spd += 1;
    const side = Math.sign(a.x - player.x) || 1;
    const w = Object.assign(newActor(a.x, -side, SPECIES[bt.sp].sprite), m, {
      alive: true, home: a.x, spawnX: a.x, cool: false, wt: 1, wdir: 0, toHome: false,
      trainer: d.id, trainerName: d.name, reward: bt.reward,
    });
    burst(a.x, GROUND - 12, 'spark', 8, '#ffffff');
    startBattle(w);
  }
  function openShop() { G.menu = { kind: 'shop', sel: 0 }; G.state = 'menu'; }
  function bagList() { return Object.keys(ITEMS).filter(k => (G.items[k] | 0) > 0); }
  function openBag() {
    if (G.state !== 'field') return;
    if (!bagList().length) { banner('どうぐを もっていない', 1.3); return; }
    G.menu = { kind: 'bag', sel: 0 }; G.state = 'menu'; player.moving = false;
  }
  function menuRows() {
    const M = G.menu;
    if (M.kind === 'bswap') return G.party.map((m, i) => 'p' + i).concat(['_close']);
    return (M.kind === 'shop' ? SHOP_LIST : bagList()).concat(['_close']);
  }
  function closeMenu() {
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
    if (M.kind === 'bswap' || M.kind === 'bitem') { battleMenuPick(M, k); return; }
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
    }
    SFX.level();
    G.items[k]--; if (G.items[k] <= 0) delete G.items[k];
    persist();
    const left = menuRows();
    if (left.length <= 1) closeMenu(); else M.sel = Math.min(M.sel, left.length - 1);
  }
  const MENU = { x: 22, y: 12, w: 116, h: 58, row0: 24, rh: 7 };
  function menuTap(x, y) {
    const M = G.menu; if (!M) return;
    if (!inRect(x, y, MENU)) { closeMenu(); return; }
    const i = Math.floor((y - MENU.row0 + 1) / MENU.rh), rows = menuRows();
    if (i < 0 || i >= rows.length) return;
    if (i === M.sel) menuPick(); else M.sel = i;
  }
  function clearStage() {
    const i = G.stage;
    if (!G.cleared.includes(i)) G.cleared.push(i);
    const ni = MAP_NODES.findIndex(n => n.stage === i);
    G.unlocked = Math.max(G.unlocked, ni + 2);
    persist();
    openMap(Math.min(ni + 1, MAP_NODES.length - 1));
  }
  function openMap(sel) {
    G.state = 'map'; G.mapSel = sel; G.battle = null;
    const n = MAP_NODES[Math.max(0, sel - 1)];
    G.mapPos = { x: n.x, y: n.y }; G.fade = 1; G.fadeSpeed = -2;
    player.moving = false;
  }
  function mapKey(code) {
    const max = Math.min(G.unlocked, MAP_NODES.length) - 1;
    if (code === 'ArrowLeft' || code === 'KeyA') G.mapSel = Math.max(0, G.mapSel - 1);
    if (code === 'ArrowRight' || code === 'KeyD') G.mapSel = Math.min(max, G.mapSel + 1);
    if (['Enter', 'Space', 'NumpadEnter', 'ArrowUp', 'KeyW'].includes(code)) mapEnter();
  }
  function mapTap(x, y) {
    const i = MAP_NODES.findIndex(n => Math.abs(n.x - x) < 9 && Math.abs(n.y - y) < 9);
    if (i >= 0 && i < G.unlocked) { if (i === G.mapSel) mapEnter(); else G.mapSel = i; }
    else if (y >= 72) mapEnter();
  }
  function mapEnter() {
    const n = MAP_NODES[G.mapSel];
    if (!n || G.mapSel >= G.unlocked) return;
    if (n.stage == null) { banner(`${n.name}は まだ じゅんびちゅう`, 1.6); return; }
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
  function jump(a, lead) {
    if (a.y !== 0 || a.vy !== 0) return;
    a.vy = -TUNING.jumpV;
    if (lead) { comp.jumpQ = 0.14; SFX.jump(); }
  }
  function physics(a, dt) {
    if (a.jumpQ >= 0) { a.jumpQ -= dt; if (a.jumpQ < 0) { a.jumpQ = -1; jump(a, false); } }
    if (a.y < 0 || a.vy < 0) {
      a.vy += TUNING.gravity * dt; a.y += a.vy * dt;
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
      if (Math.abs(nx - w.home) > 24) { w.wdir = -w.wdir; }
      else { w.x = nx; w.face = w.wdir; }
      w.moving = true;
    } else w.moving = false;
  }
  function updateField(dt) {
    const mv = clamp((down('ArrowRight', 'KeyD') ? 1 : 0) - (down('ArrowLeft', 'KeyA') ? 1 : 0) + padDir(), -1, 1);
    player.moving = mv !== 0;
    if (mv) {
      player.face = mv;
      player.x = clamp(player.x + mv * TUNING.walkSpeed * dt, 10, WORLD_W - 10);
    }
    physics(player, dt); physics(comp, dt);
    followUpdate(dt);
    for (const m of G.party) m.hp = Math.min(m.maxHp, m.hp + TUNING.regenPerSec * dt);
    for (const w of G.wilds) {
      if (!w.alive) continue;
      wildUpdate(w, dt);
      const dx = w.x - player.x;
      if (w.cool) { if (Math.abs(dx) > 110) w.cool = false; continue; }
      if (!w.toHome && Math.abs(dx) < TUNING.encounterDist && player.y === 0) { startBattle(w); return; }
    }
    updateNear();
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
  function startBattle(w) {
    if (ally().hp < 1) G.active = Math.max(0, G.party.findIndex(m => m.hp >= 1));
    comp.key = compKey();
    const side = Math.sign(w.x - player.x) || 1;
    const B = G.battle = {
      w, side, phase: 'intro', q: [], cur: null, sel: 0, runTries: 0, result: null, msg: '',
      allyTX: player.x + side * 26, enemyTX: clamp(player.x + side * 90, 20, WORLD_W - 20),
    };
    if (G.netRole) {
      let s = 12345;
      netRng = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
    }
    G.state = 'battle';
    B.bond = 0; for (const m of G.party) m.guard = false; w.guard = false;
    G.vs = { t: 0, hot: !!(SPECIES[w.sp].boss || w.trainer) };
    SFX.battleStart();
    player.moving = false; player.face = side; player.ox = 0;
    ally().hp = Math.floor(ally().hp);
    ally().st = 25; w.st = 5 + rand() * 30; w.wdir = 0;
    G.camT = clamp(player.x + side * 45 - W / 2, 0, WORLD_W - W);
    banner(G.friend ? `たいせん！ ${w.name} が むかってきた！` : w.trainer ? `${w.trainerName}が しょうぶを しかけてきた！` : (SPECIES[w.sp].boss ? `${w.name}が たちはだかった！` : `やせいの ${w.name}が あらわれた！`), 2.0);
    B.q.push(introAction());
  }
  function* walkTo(a, x, speed) {
    while (Math.abs(a.x - x) > 0.5) {
      const d = x - a.x; a.face = Math.sign(d); a.moving = true;
      a.x += Math.sign(d) * Math.min(Math.abs(d), speed * DT); yield;
    }
    a.x = x; a.moving = false;
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
  function choose(i) {
    const B = G.battle;
    if (!B || B.phase !== 'input') return;
    const kind = COMMANDS[i].kind;
    B.sel = i;
    if (SPECIES[B.w.sp].boss && (kind === 'recruit' || kind === 'run')) {
      banner(kind === 'recruit' ? 'ボスは なかまに できない！' : 'ボスからは にげられない！', 1.4);
      return;
    }
    if (G.friend && (kind === 'recruit' || kind === 'run')) { banner('たいせんでは つかえない', 1.1); return; }
    if (B.w.trainer && (kind === 'recruit' || kind === 'run')) {
      banner(kind === 'recruit' ? 'ひとの ぬいぐるみは なかまに できない！' : 'しょうぶの とちゅうで にげられない！', 1.4);
      return;
    }
    if (G.friend && ['guard', 'item', 'swap', 'special'].includes(kind)) { banner('たいせんでは つかえない', 1.1); return; }
    const a = ally();
    if (kind === 'special' && (B.bond | 0) < 100) { SFX.miss(); banner('きずなゲージが まだ たまっていない', 1.4); return; }
    if (kind === 'item') {
      if (!bagList().length) { SFX.miss(); banner('どうぐを もっていない', 1.2); return; }
      B.phase = 'menu'; G.menu = { kind: 'bitem', sel: 0 }; SFX.blip(); return;
    }
    if (kind === 'swap') {
      if (!G.party.some((m, i) => i !== G.active && m.hp >= 1)) { SFX.miss(); banner('こうたい できる なかまが いない', 1.4); return; }
      B.phase = 'menu'; G.menu = { kind: 'bswap', sel: 0 }; SFX.blip(); return;
    }
    a.guard = false;
    if (G.netRole && (!B.who || B.who === 'me')) netSend({ t: 'cmd', kind });
    B.phase = 'run';
    if (B.who === 'opp') B.q.push(enemyAttack(kind));
    else B.q.push(kind === 'recruit' ? recruitAction() : kind === 'run' ? runAction() : kind === 'guard' ? guardAction() : kind === 'special' ? specialAction() : allyAttack(kind));
  }
  function battleMenuPick(M, k) {
    const B = G.battle, a = ally();
    if (k === '_close') { closeMenu(); return; }
    if (M.kind === 'bswap') {
      const i = +k.slice(1), m = G.party[i];
      if (i === G.active) { banner(`${m.name}は もう たたかっている`, 1.2); return; }
      if (m.hp < 1) { banner(`${m.name}は たおれている`, 1.2); return; }
      G.menu = null; a.guard = false; B.phase = 'run'; B.q.push(swapAction(i)); return;
    }
    const it = ITEMS[k];
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
  function addBond(v) { const B = G.battle; if (!B || G.friend) return; const was = B.bond | 0; B.bond = Math.min(100, (B.bond || 0) + v); if (was < 100 && B.bond >= 100) { banner('きずなゲージ MAX！ ひっさつが つかえる！', 1.6); burst(comp.x, GROUND - 30, 'spark', 10, '#ffb04a'); } }
  function* specialAction() {
    const B = G.battle, a = ally(), e = B.w;
    const base = SPECIES[a.sp].moves.strong;
    const mv = { name: 'きずなの ' + base.name, power: Math.round(base.power * 1.9), acc: 1 };
    a.st -= COST.special; B.bond = 0;
    B.msg = `${a.name}の ひっさつ！`;
    G.cutin = { t: 0, dur: 1.15, key: comp.key, name: base.name, who: a.name };
    SFX.battleStart();
    while (G.cutin && G.cutin.t < G.cutin.dur) yield;
    G.cutin = null;
    banner(`${a.name}の ${mv.name}！`, 1.3);
    yield* strike(comp, a, e, e, mv, 'special');
    if (e.hp <= 0) yield* enemyFaint();
  }
  function aiChoose(e, a) {
    const strong = SPECIES[e.sp].moves.strong;
    const est = strong.power * e.atk / (e.atk + a.def);
    if (a.hp <= est * 1.05 && rand() < 0.7) return 'strong';
    return rand() < 0.3 ? 'strong' : 'attack';
  }
  function* strike(attA, att, defA, def, mv, kind) {
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
    } else { pop(defA.x, GROUND - 38, 'MISS', '#cfe8ff'); SFX.miss(); }
    yield* tween(v => attA.ox = v, attA.ox, 0, 0.2);
    yield* wait(0.35);
  }
  function* allyAttack(kind) {
    const B = G.battle, a = ally(), e = B.w;
    const mv = SPECIES[a.sp].moves[kind];
    a.st -= COST[kind];
    B.msg = `${a.name}の ${mv.name}！`;
    banner(B.msg, 1.3);
    yield* strike(comp, a, e, e, mv, kind);
    if (e.hp <= 0) yield* enemyFaint();
  }
  function* enemyAttack(kind) {
    const B = G.battle, e = B.w, a = ally();
    const mv = SPECIES[e.sp].moves[kind];
    e.st -= COST[kind];
    B.msg = `${e.name}の ${mv.name}！`;
    banner('あいての ' + B.msg, 1.3);
    yield* strike(e, e, comp, a, mv, kind);
    if (a.hp <= 0) yield* allyFaint();
  }
  function* enemyTurn() {
    const B = G.battle, e = B.w, a = ally();
    const kind = aiChoose(e, a), mv = SPECIES[e.sp].moves[kind];
    e.st -= COST[kind];
    B.msg = `${e.name}の ${mv.name}！`;
    banner(B.msg, 1.3);
    yield* strike(e, e, comp, a, mv, kind);
    if (a.hp <= 0) yield* allyFaint();
  }
  function* enemyFaint() {
    const B = G.battle, e = B.w;
    B.phase = 'end'; B.result = 'win';
    const boss = SPECIES[e.sp].boss;
    const xp = Math.max(6, Math.round((e.maxHp + e.atk * 2) * (boss ? 0.55 : e.trainer ? 0.45 : 0.35)));
    const ups = grantXp(xp);
    const coins = G.friend ? 0 : e.trainer ? e.reward : boss ? 30 : Math.max(2, Math.round(xp / 3));
    G.coins += coins;
    if (e.trainer && !G.beaten.includes(e.trainer)) G.beaten.push(e.trainer);
    SFX.win();
    banner(e.trainer ? `${e.trainerName}に かった！ +${coins}コイン`
      : boss ? `${e.name}を たおした！ +${coins}コイン さきへ すすめる！`
      : `${e.name}を たおした！ +${xp}けいけん` + (coins ? ` +${coins}コイン` : ''), 2.2);
    for (let i = 0; i < 8; i++) { e.alpha = i % 2 ? 1 : 0.25; yield* wait(0.08); }
    yield* tween(v => { e.alpha = v; e.oy = (1 - v) * 3; }, 1, 0, 0.4);
    burst(e.x, GROUND - 12, 'spark', 10, '#fff2a0');
    e.alive = false;
    if (ups) { SFX.level(); banner(`${ally().name}は レベル ${ally().lv} に あがった！`, 2.2); yield* wait(1.2); }
    persist();
    yield* wait(1.0);
    endBattle();
  }
  function* allyFaint() {
    const B = G.battle, a = ally();
    if (G.versus) {
      B.phase = 'end'; B.result = 'lose';
      banner(`${a.name}は たおれた…`, 1.8);
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
      B.pending = newMember(e.sp, Math.max(1, Math.floor(e.hp)));
      B.swapSel = 0;
      B.phase = 'swap';
      B.msg = 'だれを おうちに かえす？';
      banner('なかまが いっぱい！ 1〜4で いれかえ ／ 0で やめる', 3.2);
      yield* tween(v => player.ox = v, player.ox, 0, 0.3);
      while (G.battle && G.battle.phase === 'swap') yield* wait(0.05);
    } else {
      B.msg = `${e.name}は そっぽを むいた…`;
      banner(`${e.name}は ぷいっと そっぽを むいた…`, 1.8);
      for (let i = 0; i < 4; i++) { e.face = -e.face; yield* wait(0.18); }
      yield* tween(v => player.ox = v, player.ox, 0, 0.3);
      yield* wait(0.4);
    }
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
    if (!B.swappedOut) G.party.push(newMember(e.sp, Math.max(1, Math.floor(e.hp))));
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
    if (B.w.alive) { B.w.home = B.w.x; B.w.alpha = 1; B.w.moving = false; }
    player.ox = comp.ox = 0; player.moving = comp.moving = false; comp.alpha = 1;
    for (const m of G.party) { m.st = 0; m.guard = false; }
    G.cutin = null;
    B.phase = 'done';
    G.lastResult = B.result;
    if (G.versus) {
      const result = B.result;
      G.versus = false;
      G.friend = false;
      G.wilds.forEach(w => { w.alpha = 1; });
      G.battle = null;
      G.state = 'title';
      persist();
      banner(result === 'win' ? 'たいせん かった！ けいけんを セーブした' : result === 'lose' ? 'たいせん まけ… セーブした' : 'たいせん おわり', 2.2);
      return;
    }
    G.state = 'field';
    G.battle = null;
  }
  function whiteoutReset() {
    G.battle = null; G.state = 'field';
    for (const m of G.party) m.hp = m.maxHp;
    G.active = 0; comp.key = compKey();
    player.x = 40; player.face = 1; player.ox = 0; comp.x = 18; comp.ox = 0; comp.alpha = 1;
    for (const w of G.wilds) if (w.alive) Object.assign(w, { x: w.spawnX, home: w.spawnX, hp: w.maxHp, cool: false, alpha: 1, st: 0 });
    G.cam = G.camT = 0;
    G.fadeSpeed = -1.2;
    banner(`${STAGES[G.stage].name}の いりぐちで めを さました`, 2.4);
    persist();
  }
  function updateBattle(dt) {
    const B = G.battle;
    if (G.hitStop > 0) { G.hitStop -= dt; return; }
    if (G.cutin) G.cutin.t += dt;
    if (B.phase === 'menu') return;
    if (!B.cur && B.q.length) B.cur = B.q.shift();
    if (B.cur) { const r = B.cur.next(); if (r.done) B.cur = null; }
    if (!G.battle || B.phase === 'end' || B.phase === 'intro' || B.phase === 'done' || B.phase === 'swap') return;
    const a = ally(), e = B.w;
    const busy = !!B.cur || B.q.length > 0;
    const waiting = B.phase === 'input';
    if (busy || (waiting && G.waitMode)) return;
    if (!waiting) a.st = Math.min(100, a.st + stRate(a) * dt);
    e.st = Math.min(100, e.st + stRate(e) * dt);
    if (!waiting && a.st >= 100) { B.phase = 'input'; B.who = 'me'; burst(comp.x, GROUND - 30, 'spark', 5, '#ffe24a'); }
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
    if (G.state === 'field') updateField(dt);
    else if (G.state === 'battle') { physics(player, dt); physics(comp, dt); updateBattle(dt); }
    else if (G.state === 'title') { for (const w of G.wilds) w.face = -1; }
    else if (G.state === 'map') updateMap(dt);
    else if (G.state === 'talk' || G.state === 'menu') { physics(player, dt); physics(comp, dt); }
    document.body.classList.toggle('title', G.state === 'title');
    document.body.classList.toggle('has-save', !!G.hasSave);
    animActor(player, dt); animActor(comp, dt);
    for (const w of G.wilds) animActor(w, dt);
    for (const a of G.npcs) animActor(a, dt);
    G.cam += (G.camT - G.cam) * Math.min(1, dt * 6);
    if (Math.abs(G.camT - G.cam) < 0.3) G.cam = G.camT;
    if (G.shakeT > 0) G.shakeT -= dt;
    if (G.flashT > 0) G.flashT -= dt;
    if (G.vs) { G.vs.t += dt; if (G.vs.t > 1.1) G.vs = null; }
    if (G.banner) { G.banner.t -= dt; if (G.banner.t <= 0) G.banner = null; }
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
  function drawActor(a, cam) {
    if (a.alpha <= 0) return;
    const s = SPR[a.key]; const flip = a.face !== s.native;
    const cx = Math.round(a.x + a.ox - cam);
    let x = cx - 16;
    const y = GROUND - 30 + Math.round(a.y + a.oy + a.bob);
    if (a.shake > 0) x += Math.floor(a.shake * 40) % 2 ? 1 : -1;
    // ground shadow
    const shrink = Math.min(6, Math.floor(-a.y / 3));
    const sw = Math.max(6, Math.min(18, s.w - 6) - shrink * 2);
    g.globalAlpha = 0.28 * a.alpha; g.fillStyle = '#1d4a12';
    g.fillRect(cx - (sw >> 1), GROUND, sw, 1); g.fillRect(cx - (sw >> 1) + 2, GROUND + 1, sw - 4, 1);
    g.globalAlpha = a.alpha;
    let fr = s;
    if (s.walk && a.moving && a.y === 0) fr = s.walk.frames[Math.floor(a.walkT * 1000 / s.walk.ms) % s.walk.frames.length];
    g.drawImage(flip ? fr.f : fr.n, x, y);
    if (a.flash > 0 && Math.floor(a.flash * 25) % 2 === 0) g.drawImage(flip ? fr.wf : fr.wn, x, y);
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
    const wall = { shop: '#f8ecd0', clinic: '#f6f4ee', house: '#e8be88' }[b.k] || '#f0e0c0';
    const roof = { shop: '#3c78d8', clinic: '#f07aa8', house: '#c84a3a' }[b.k] || '#8a5a2e';
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
    const art = PROPS.wmap;
    if (art) g.drawImage(art, 0, 0);
    else { if (!MAPBG) MAPBG = buildMapBG(); g.drawImage(MAPBG, 0, 0); }
    // drifting clouds over the sky strip
    if (!art) for (let i = 0; i < 3; i++) {
      const X = Math.round(((i * 61 + G.t * 2) % 200) - 20), Y = 1 + i * 2;
      rect(X, Y + 1, 14, 2, '#ffffff'); rect(X + 3, Y, 7, 1, '#ffffff'); rect(X + 1, Y + 3, 12, 1, '#dcefff');
    }
    // paths: dirt road once opened, faint dots while locked
    for (let k = 0; k < MAP_NODES.length - 1; k++) {
      const a = MAP_NODES[k], b = MAP_NODES[k + 1], n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y));
      const open = k + 1 < G.unlocked;
      if (art) { if (open && PROPS['wseg' + k]) g.drawImage(PROPS['wseg' + k], 0, 0); continue; }
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
      if (sel && Math.floor(G.t * 4) % 2) { g.strokeStyle = '#ffffff'; g.lineWidth = 1; g.strokeRect(n.x - 6.5, n.y - 6.5, 14, 13); }
    });
    // boy on the map (feet on the node)
    const s = SPR[player.key] || SPR.player, p = G.mapPos;
    let fr = s; if (s.walk && player.moving) fr = s.walk.frames[Math.floor(G.t * 1000 / s.walk.ms) % s.walk.frames.length];
    g.drawImage(player.face !== s.native ? fr.f : fr.n, Math.round(p.x) - 16, Math.round(p.y) - 33);
    // text box
    rect(3, 72, 154, 17, '#5a3418'); rect(4, 73, 152, 15, '#f4e4b8');
    const n = MAP_NODES[G.mapSel], name = n.stage != null ? STAGES[n.stage].name : n.name;
    const clr = n.stage != null && G.cleared.includes(n.stage);
    T('ぜんたいマップ', 80, 1, { size: 4, c: '#ffffff', ol: '#1a3a5a', al: 'center' });
    T(name + (clr ? ' ★クリア' : ''), 7, 75);
    T(n.stage == null ? 'まだ じゅんびちゅう' : (TOUCH ? '◀▶で えらぶ ／ ここを タップで はいる' : '←→で えらぶ ／ Enterで はいる'), 7, 81, { c: '#7a5a30' });
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
      if (p.life > 0.15 || Math.floor(p.life * 30) % 2) tiny(s, x, y, p.col, '#2a1a10');
    }
  }
  function drawHUD() {
    const x0 = 2, y0 = 72, w = 156, h = 17;
    rect(x0 + 1, y0, w - 2, h, '#5a3418'); rect(x0, y0 + 1, w, h - 2, '#5a3418');
    rect(x0 + 1, y0 + 1, w - 2, h - 2, '#f4e4b8');
    rect(x0 + 2, y0 + 1, w - 4, 1, '#fff6d8'); rect(x0 + 2, y0 + h - 2, w - 4, 1, '#dcc48e');
    const a = ally(), B = G.battle;
    // hearts = active companion HP (5 hearts, half steps)
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
    // stamina bar / READY
    const bx = 5, by = 80, bw = 35, bh = 7;
    rect(bx, by, bw, bh, '#5a3418'); rect(bx + 1, by + 1, bw - 2, bh - 2, '#d8c498');
    let label = null, lc = '#5a3418';
    if (B) {
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
    } else { label = 'WALK'; lc = '#a08a60'; }
    if (label) T(label, bx + bw / 2, by + 1.5, { al: 'center', c: lc, size: 4 });
    // message box
    rect(43, 74, 53, 13, '#b89058'); rect(44, 75, 51, 11, '#ead7a8'); rect(44, 75, 51, 1, '#d6bf8a');
    // command buttons
    const swapping = B && B.phase === 'swap';
    const enabled = (B && B.phase === 'input') || swapping;
    const page = swapping ? 0 : cmdPage();
    for (let slot = 0; slot < 4; slot++) {
      const ci = page * 4 + slot, c = COMMANDS[ci], b = BTN[slot];
      const sel = swapping ? B.swapSel === slot : (enabled && B.sel === ci);
      const oy = sel ? 1 : 0;
      rect(b.x, b.y + oy, b.w, b.h - oy, '#3a2410');
      rect(b.x + 1, b.y + 1 + oy, b.w - 2, b.h - 2 - oy, c.color);
      if (c.kind === 'special' && B && !swapping) {
        const bond = clamp(B.bond | 0, 0, 100), fh = Math.round((b.h - 2 - oy) * (1 - bond / 100));
        if (bond < 100) rect(b.x + 1, b.y + 1 + oy, b.w - 2, fh, '#7a6a5a');
        else if (Math.floor(G.t * 6) % 2) rect(b.x + 1, b.y + 1 + oy, b.w - 2, b.h - 2 - oy, '#ffb04a');
      }
      rect(b.x + 1, b.y + 1 + oy, b.w - 2, 1, 'rgba(255,255,255,0.35)');
      rect(b.x + 1, b.y + b.h - 2, b.w - 2, 1, c.dark);
      drawPattern(ICONS[c.icon], b.x + 2, b.y + 2 + oy, { w: '#ffffff', y: '#ffe24a' });
      tiny(String(swapping ? slot + 1 : ci + 1), b.x + 1, b.y + 1 + oy, '#ffffff', c.dark);
      if (!enabled) { g.globalAlpha = 0.5; rect(b.x, b.y, b.w, b.h, '#8a8070'); g.globalAlpha = 1; }
      if (sel && Math.floor(G.t * 4) % 2) {
        g.strokeStyle = '#ffe24a'; g.lineWidth = 1; g.strokeRect(b.x - 0.5, b.y + oy - 0.5, b.w + 1, b.h - oy + 1);
      }
    }
    // page tab (flip between the two sets of 4)
    { const t = PAGETAB;
      rect(t.x, t.y, t.w, t.h, '#3a2410'); rect(t.x + 1, t.y + 1, t.w - 2, t.h - 2, enabled && !swapping ? '#f4e4b8' : '#a89878');
      drawPattern(['.#.', '###'], t.x + 1, t.y + 2, { '#': page === 0 ? '#c0a070' : '#5a3418' });
      drawPattern(['###', '.#.'], t.x + 1, t.y + 8, { '#': page === 1 ? '#c0a070' : '#5a3418' });
      rect(t.x + 1, t.y + 5 + 0, t.w - 2, 2, page === 0 ? '#ffd23a' : '#4a76bf'); }
    // message text (hi-res layer)
    let l1 = '', l2 = '';
    if (!B) {
      if (G.near && G.near.type === 'npc') { l1 = G.near.a.def.name; l2 = TOUCH ? 'ここタップ:はなす' : 'Enter:はなす'; }
      else if (G.near && G.near.type === 'bld') { l1 = G.near.b.name; l2 = TOUCH ? 'ここタップ:はいる' : 'Enter:はいる'; }
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
      if (B.who === 'opp') l2 = SPECIES[B.w.sp].moves[c.kind].name;
      else if (c.kind === 'recruit') l2 = B.w.trainer ? 'ひとの こは だめ' : SPECIES[B.w.sp].boss ? 'ボスは なかまに できない' : `せいこう ${Math.round(recruitChance(B.w) * 100)}%` + (G.cookie ? '♪' : '');
      else if (c.kind === 'run' && (SPECIES[B.w.sp].boss || B.w.trainer)) l2 = B.w.trainer ? 'にげられない' : 'ボスからは にげられない';
      else if (c.kind === 'run') l2 = `にげる ${Math.round(runChance(a, B.w, B.runTries) * 100)}%`;
      else if (c.kind === 'guard') l2 = 'ダメージ はんぶん';
      else if (c.kind === 'item') l2 = `もちもの ${bagList().reduce((n, k) => n + (G.items[k] | 0), 0)}こ`;
      else if (c.kind === 'swap') l2 = 'なかまと こうたい';
      else if (c.kind === 'special') l2 = (B.bond | 0) >= 100 ? 'きずなの ' + SPECIES[a.sp].moves.strong.name : `きずな ${Math.floor(B.bond | 0)}%`;
      else l2 = SPECIES[a.sp].moves[c.kind].name;
    } else if (B.cur || B.phase === 'end') { [l1, l2] = wrap2(B.msg, 12); }
    else { l1 = 'スタミナ'; l2 = 'ためちゅう…'; }
    T(l1, 45.5, 76); T(l2, 45.5, 81);
  }

  function drawTalk() {
    const t = G.talk; if (G.state !== 'talk' || !t) return;
    const x = 4, y = 47, w = 152, h = 23;
    const nw = Math.ceil(measure(t.name)) + 8;
    rect(x + 3, y - 7, nw, 8, '#5a3418'); rect(x + 4, y - 6, nw - 2, 7, '#ffd23a');
    T(t.name, x + 7, y - 5);
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
    T(M.kind === 'shop' ? 'ぬいショップ' : M.kind === 'bswap' ? 'いれかえ' : 'どうぐ', x + 5, y + 4, { c: '#c0502a' });
    if (M.kind !== 'bswap') T(`${G.coins}コイン`, x + w - 5, y + 4, { al: 'right' });
    rect(x + 3, y + 10, w - 6, 1, '#e8d8b0');
    const rows = menuRows();
    rows.forEach((k, i) => {
      const yy = row0 + i * rh, sel = i === M.sel;
      if (sel) rect(x + 3, yy - 1, w - 6, rh, '#ffe98a');
      if (sel && Math.floor(G.t * 4) % 2) drawPattern(['#..', '##.', '###', '##.', '#..'], x + 5, yy, { '#': '#c0502a' });
      if (k === '_close') { T(M.kind === 'shop' ? 'でる' : M.kind === 'bswap' || M.kind === 'bitem' ? 'やめる' : 'とじる', x + 10, yy); return; }
      if (M.kind === 'bswap') {
        const m = G.party[+k.slice(1)], out = +k.slice(1) === G.active, down = m.hp < 1;
        T(m.name + (out ? ' (でている)' : ''), x + 10, yy, { c: down ? '#b0a080' : '#4a2c12' });
        T(`Lv${m.lv}`, x + 74, yy, { c: '#7a5a30' });
        T(down ? 'たおれている' : `HP${Math.floor(m.hp)}/${m.maxHp}`, x + w - 5, yy, { al: 'right', c: down ? '#c0502a' : '#4a2c12' });
        return;
      }
      const it = ITEMS[k], have = G.items[k] | 0;
      T(it.name, x + 10, yy);
      if (M.kind === 'shop') { T(`${it.price}`, x + 86, yy, { al: 'right', c: G.coins >= it.price ? '#4a2c12' : '#b0a080' }); T(`もち${have}`, x + w - 5, yy, { al: 'right', c: '#7a5a30' }); }
      else T(`x${have}`, x + w - 5, yy, { al: 'right' });
    });
    const k = rows[M.sel];
    const desc = k === '_close' ? '' : M.kind === 'bswap' ? 'だれと こうたい する？' : ITEMS[k].desc;
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
  function drawBanner() {
    if (!G.banner) return;
    const s = G.banner.text, w = Math.ceil(measure(s)) + 8;
    const x = Math.floor((W - w) / 2), y = 8;
    rect(x + 1, y, w - 2, 9, '#5a3418'); rect(x, y + 1, w, 7, '#5a3418');
    rect(x + 1, y + 1, w - 2, 7, '#fff8e0');
    rect(x + 1, y + 7, w - 2, 1, '#e8d8b0');
    T(s, W / 2, y + 2.5, { al: 'center' });
  }
  function drawTitle() {
    if (G.titleScreen) { drawSetup(); return; }
    T('ぬいぐるみ', 80, 4, { size: 12, c: '#ff6fa8', ol: '#ffffff', ol2: '#5a2040', al: 'center' });
    T('モンスター', 80, 17.5, { size: 12, c: '#5ccf3a', ol: '#ffffff', ol2: '#1f4a18', al: 'center' });
    T('Plush Monsters Adventure', 80, 31, { size: 4, c: '#ffffff', ol: '#2a2a3a', al: 'center' });
    if ((G.t % 1.2) < 0.85) T(TOUCH ? 'けってい で はじめる' : 'ENTER で はじめる', 80, 38, { size: 4, c: '#fff6b0', ol: '#4a2c12', al: 'center' });
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
    const P = SETUP, ph = SETUP_ROWS * P.rowH + 8;
    if (PROPS.ui_frame) drawNine(PROPS.ui_frame, 8, P.x, P.y, P.w, ph);
    else { rect(P.x, P.y, P.w, ph, '#5a3418'); rect(P.x + 1, P.y + 1, P.w - 2, ph - 2, '#f4e4b8'); }
    const asking = G.wipeAsk && G.t - G.wipeAsk < 4;
    const rows = [G.hasSave ? 'つづきから' : 'はじめる', (HERO_GENDERS[G.gender | 0] || HERO_GENDERS[0]).name,
      (HERO_COLORS[G.hcolor | 0] || HERO_COLORS[0]).name, 'なまえ: ' + (G.pname || '？？？'), 'ライバル: ' + rName(),
      G.wiped ? 'けしました' : asking ? 'もういちどで けす' : 'データを けす'];
    rows.forEach((r, i) => {
      const y = P.rowY + i * P.rowH, on = (G.titleRow | 0) === i;
      if (on) {
        if (PROPS.ui_rowbar) drawNine(PROPS.ui_rowbar, 4, P.x + 4, y, P.w - 8, P.rowH);
        else rect(P.x + 2, y, P.w - 4, P.rowH - 1, '#ffd23a');
        if (PROPS.ui_cursor) g.drawImage(PROPS.ui_cursor, (Math.floor(G.t * 3) % 2) * 6, 0, 6, 7, P.x - 7, y + 2, 6, 7);
      }
      const c = i === 5 && (G.wiped || asking) ? '#d0302a' : i === 0 ? '#2a7a1a' : '#5a3418';
      if (i === 1 || i === 2) { T('◀', P.x + 3, y + 1.5, { size: 8, c: '#5a3418' }); T('▶', P.x + P.w - 10, y + 1.5, { size: 8, c: '#5a3418' }); }
      if (i === 2) { const sw = HERO_COLORS[G.hcolor | 0] || HERO_COLORS[0]; rect(P.x + 13, y + 2, 7, 7, '#5a3418'); rect(P.x + 14, y + 3, 5, 5, sw.c); }
      const sz = measure(r, 8) <= P.w - 8 ? 8 : 4;
      T(r, P.x + P.w / 2 + (i === 2 ? 4 : 0), y + (sz === 8 ? 1.5 : 3.5), { size: sz, c, al: 'center' });
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
    T(V.friend ? 'F ともだち対戦' : 'F コンピュータ', 16, 40, { size: 4, c: V.friend ? '#e84878' : '#7a5a38' });
    T(TOUCH ? 'したをタップで開始' : 'ENTER で開始', 16, 48, { size: 4, c: '#7a5a38' });
    T('O オンライン', 100, 48, { size: 4, c: '#3c6ad8' });
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
    if (G.state === 'map') {
      drawMap(); drawBanner();
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
      T(NET.status || 'せつぞく中', 80, 32, { size: 8, c: '#5a3418', al: 'center' });
      T('コードを ともだちに つたえて', 80, 44, { size: 4, c: '#7a5a38', al: 'center' });
      vctx.drawImage(low, 0, 0, W * S, H * S); flushText();
      return;
    }
    let cam = Math.round(G.cam);
    const shake = G.shakeT > 0 ? (Math.floor(G.t * 60) % 2 ? 1 : -1) : 0;
    cam += shake;
    BG.draw(g, G.bg, cam, G.t, W);
    drawRoadProps(cam); drawTown(cam); drawSign(cam); drawBench(cam);
    for (const a of G.npcs) drawActor(a, cam);
    for (const w of G.wilds) if (w.alive && w.alpha > 0) drawActor(w, cam);
    if (G.battle && G.battle.w) drawActor(G.battle.w, cam);
    drawActor(comp, cam);
    drawActor(player, cam);
    if (G.battle && G.battle.phase !== 'done') { drawBars(G.battle.w, G.battle.w, cam); if (comp.alpha > 0) drawBars(comp, ally(), cam); }
    if (G.battle && G.battle.phase !== 'done' && ally().guard && comp.alpha > 0) drawPattern(ICONS.shield, Math.round(comp.x - cam) - 4, GROUND - 42, { w: '#ffffff', y: '#6aa8e8' });
    drawParticles(cam);
    drawNearMark(cam);
    drawBattleFx();
    if (G.state !== 'title') {
      drawHUD(); drawTalk(); drawMenu(); drawBanner();
      // help + party (hi-res text)
      G.chip = null;
      if (TOUCH) {
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
      T(`Lv${m.lv || 1} なかま${G.party.length}/${TUNING.partyMax}`, 158, 1, { size: 4, c: '#ffffff', ol: '#1a3a5a', al: 'right' });
      T(`${G.coins}コイン`, 158, 6, { size: 4, c: '#ffe24a', ol: '#1a3a5a', al: 'right' });
    } else drawTitle();
    vctx.drawImage(low, 0, 0, W * S, H * S);
    flushText();
    if (G.fade > 0) { vctx.globalAlpha = G.fade; vctx.fillStyle = '#ffffff'; vctx.fillRect(0, 0, view.width, view.height); vctx.globalAlpha = 1; }
  }


  // placeholder town people: the boy with his blue clothes recolored (replaced once the human sprites are approved)
  const NPC_LOOKS = { girl: [255, 111, 168], mushitori: [86, 180, 70], oneesan: [160, 96, 214], karate: [236, 236, 228], gaki: [236, 140, 40] };
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
    update(DT); render(); syncControls();
    requestAnimationFrame(frame);
  }
  async function boot() {
    resize();
    await Promise.all(Object.entries(SPRITES).map(([k, s]) => loadImg(s.src).then(img => prepSprite(k, img))));
    await Promise.all(Object.entries(SPRITES).filter(([, s]) => s.walk).map(([k, s]) => loadImg(s.walk.src).then(img => prepWalk(k, img, s.walk)).catch(() => {})));
    await Promise.all(Object.entries(PROP_IMGS).map(([k, src]) => loadImg(src).then(img => { PROPS[k] = img; }).catch(e => console.warn(e))));
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
    if (params.has('skiptitle')) startGame(false);
    requestAnimationFrame(frame);
  }
  // debug / test hooks
  window.NM = { G, openSetup, setHero, openName, closeName, player, comp, interact, openBag, startBattle, choose, enterStage, openMap, clearStage, recruitChance, persist, wipeSave, confirmSwap, get ally() { return ally(); }, get layout() { return layout; }, TOUCH, BTN };
  boot().catch(e => { $err.textContent += String(e) + '\n'; console.error(e); });
})();
