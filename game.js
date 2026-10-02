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
      $rot.style.top = (top + ch + 18) + 'px';
    }
    fitLabels();
  }
  function fitLabels() {
    for (const el of [$jump, $swap]) { const d = parseInt(el.style.width, 10) || 0; el.style.fontSize = (d >= 74 ? 16 : 12) + 'px'; }
  }
  let ctlState = '';
  function syncControls() {
    if (!TOUCH) return;
    const st = (G.state === 'field' || G.state === 'map') ? 'field' : 'off';
    const key = st + layout.mode;
    if (key === ctlState) return;
    ctlState = key;
    const hide = st === 'off' && layout.mode === 'overlay';
    for (const el of [$pad, $acts]) { el.classList.toggle('hide', hide); el.classList.toggle('off', st === 'off' && !hide); }
    if (st === 'off') { touchDir.clear(); for (const el of [$bL, $bR, $jump, $swap]) el.classList.remove('on'); }
  }
  const touchDir = new Map();   // pointerId -> -1 | 1  (multi-touch d-pad)
  function padDir() { let l = false, r = false; for (const d of touchDir.values()) d < 0 ? (l = true) : (r = true); return (r ? 1 : 0) - (l ? 1 : 0); }
  function padSync() { const d = [...touchDir.values()]; $bL.classList.toggle('on', d.includes(-1)); $bR.classList.toggle('on', d.includes(1)); }
  function dirAt(x, y) { const el = document.elementFromPoint(x, y); return el && el.closest('#bL') ? -1 : el && el.closest('#bR') ? 1 : 0; }
  for (const [el, dir] of [[$bL, -1], [$bR, 1]]) {
    el.addEventListener('pointerdown', e => { e.preventDefault(); touchDir.set(e.pointerId, dir); padSync(); });
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
    el.addEventListener('pointerdown', e => { e.preventDefault(); el.classList.add('on'); if (G.state !== 'title') onKey(code); });
    const up = () => el.classList.remove('on');
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('pointerleave', up);
  }
  // no scrolling / zoom / long-press menu / text selection
  for (const ev of ['touchstart', 'touchmove', 'touchend']) document.addEventListener(ev, e => { if (e.cancelable) e.preventDefault(); }, { passive: false });
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
  const HEROES = [
    { id: 'shota', name: 'しょうた', key: 'player' },
    { id: 'aoi', name: 'あおい', key: 'hero_aoi', hair: [40, 90, 180], shirt: [30, 70, 150] },
    { id: 'hina', name: 'ひな', key: 'hero_hina', hair: [220, 90, 140], shirt: [190, 50, 70] },
    { id: 'ren', name: 'れん', key: 'hero_ren', hair: [40, 36, 34], shirt: [210, 170, 50] },
  ];
  function recolorHero(src, hair, shirt) {
    const [c, x] = mk(src.width, src.height); x.drawImage(src, 0, 0);
    const img = x.getImageData(0, 0, c.width, c.height), d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 20) continue;
      const r = d[i], g = d[i + 1], b = d[i + 2];
      const green = g > r + 8 && g > b;
      const brown = r > g + 10 && g > b && r > 70 && r < 210;
      const col = green ? shirt : brown ? hair : null;
      if (!col) continue;
      const lum = (r + g + b) / 3 / 140;
      d[i] = Math.min(255, col[0] * lum);
      d[i + 1] = Math.min(255, col[1] * lum);
      d[i + 2] = Math.min(255, col[2] * lum);
    }
    x.putImageData(img, 0, 0);
    return c;
  }
  function makeHeroes() {
    const base = SPR.player; if (!base) return;
    for (const h of HEROES) {
      if (!h.hair) continue;
      const n = recolorHero(base.n, h.hair, h.shirt);
      const f = recolorHero(base.f, h.hair, h.shirt);
      const frames = (base.walk ? base.walk.frames : []).map(fr => {
        const nn = recolorHero(fr.n, h.hair, h.shirt);
        const ff = recolorHero(fr.f, h.hair, h.shirt);
        return { n: nn, f: ff, wn: silhouette(nn), wf: silhouette(ff) };
      });
      SPR[h.key] = { n, f, wn: silhouette(n), wf: silhouette(f), native: 1, top: base.top, w: base.w, walk: frames.length ? { frames, ms: base.walk.ms } : null };
    }
  }
  function hero() { return HEROES[G.hero] || HEROES[0]; }
  function applyHero() { player.key = hero().key; }
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
    hasSave: false, muted: false, versus: false, vs: null, saveFlash: 0, hero: 0,
  };
  const SAVE_KEY = 'nm_save_v1';
  function persist() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        v: 1,
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
        hero: G.hero || 0,
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
    const base = SPECIES[e.sp].recruitBase;
    return clamp(base + TUNING.recruitHpWeight * (1 - e.hp / e.maxHp), TUNING.recruitMin, TUNING.recruitMax);
  }
  function runChance(a, e, tries) { return clamp(TUNING.runBase + (a.spd - e.spd) * TUNING.runSpdWeight + TUNING.runTryBonus * tries, 0.1, 0.95); }

  // ---------- input ----------
  const keys = new Set();
  const down = (...codes) => codes.some(c => keys.has(c));
  window.addEventListener('keydown', e => {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'Tab'].includes(e.code)) e.preventDefault();
    if (e.repeat) return;
    keys.add(e.code);
    onKey(e.code);
  });
  window.addEventListener('keyup', e => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());

  function onKey(code) {
    if (G.state === 'title') {
      if (code === 'KeyN') { wipeSave(); startGame(false); return; }
      if (code === 'ArrowLeft' || code === 'KeyA') { G.hero = (G.hero + HEROES.length - 1) % HEROES.length; applyHero(); return; }
      if (code === 'ArrowRight' || code === 'KeyD' || code === 'Digit2') { G.hero = (G.hero + 1) % HEROES.length; applyHero(); return; }
      if (['Enter', 'Space', 'NumpadEnter', 'Digit1'].includes(code)) { startGame(G.hasSave); return; }
      return;
    }
    if (G.state === 'versus') { versusKey(code); return; }
    if (code === 'KeyT') { G.waitMode = !G.waitMode; banner(G.waitMode ? 'WAITモード：えらぶ あいだ じかんが とまる' : 'ACTIVEモード：えらぶ あいだも あいては うごく', 1.6); return; }
    if (code === 'KeyM') {
      G.muted = !G.muted; persist(); SFX.setMuted(); SFX.start();
      banner(G.muted ? 'おと オフ' : 'おと オン', 1.1); return;
    }
    if (G.state === 'map') { mapKey(code); return; }
    if (G.state === 'field') {
      if (['Space', 'ArrowUp', 'KeyW'].includes(code)) jump(player, true);
      if (code === 'KeyC' || code === 'Tab') swapActive();
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
      if (B.phase !== 'input') return;
      const n = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Numpad1: 0, Numpad2: 1, Numpad3: 2, Numpad4: 3 }[code];
      if (n != null) { choose(n); return; }
      if (code === 'ArrowLeft' || code === 'KeyA') B.sel = (B.sel + 3) % 4;
      if (code === 'ArrowRight' || code === 'KeyD') B.sel = (B.sel + 1) % 4;
      if (code === 'Enter' || code === 'Space' || code === 'NumpadEnter') choose(B.sel);
    }
  }

  const BTN = COMMANDS.map((c, i) => ({ x: 98 + i * 15, y: 74, w: 14, h: 13 }));
  function logicalPos(e) { const r = view.getBoundingClientRect(); return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height]; }
  const inRect = (x, y, b) => b && x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h;
  function btnAt(x, y) { return BTN.findIndex(b => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h); }
  view.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    const [x, y] = logicalPos(e); const i = btnAt(x, y);
    G.hoverBtn = i;
    const active = G.state === 'battle' && G.battle.phase === 'input';
    if (active && i >= 0) G.battle.sel = i;
    view.style.cursor = (active && i >= 0) || G.state === 'title' ? 'pointer' : 'default';
  });
  window.addEventListener('pointerdown', e => {
    if (G.state === 'title') {
      e.preventDefault();
      const y = logicalPos(e)[1];
      if (y > 48) { G.hero = (G.hero + 1) % HEROES.length; applyHero(); }
      else startGame(G.hasSave);
    }
  });
  view.addEventListener('pointerdown', e => {
    e.preventDefault();
    if (e.pointerType === 'mouse') view.focus();
    if (G.state === 'title') return;
    const [x, y] = logicalPos(e);
    if (G.state === 'versus') { versusTap(x, y); return; }
    if (G.chip && inRect(x, y, G.chip)) { onKey('KeyT'); return; }
    const i = btnAt(x, y);
    if (G.state === 'battle' && G.battle && G.battle.phase === 'swap') {
      if (i >= 0 && i < G.party.length) confirmSwap(i);
      return;
    }
    if (i >= 0 && G.state === 'battle' && G.battle.phase === 'input') choose(i);
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
      if (s.muted != null) G.muted = !!s.muted;
      if (s.hero != null) G.hero = Math.max(0, Math.min(s.hero | 0, HEROES.length - 1));
      applyHero();
      const i = Math.max(0, Math.min(s.stage | 0, STAGES.length - 1));
      enterStage(i, { heal: false, startX: s.px });
      return;
    }
    G.state = 'field';
    applyHero();
    G.wilds[0].toHome = true;   // the title-screen Oguri trots off to its spot
    banner(STAGES[0].name, 2.2);
    persist();
  }
  // ---------- stages / world map ----------
  function enterStage(i, opts) {
    const st = STAGES[i];
    const heal = !opts || opts.heal !== false;
    G.stage = i; WORLD_W = st.width;
    G.bg = G.bgCache[st.id] || (G.bgCache[st.id] = BG.build(st.width, st.theme, PROPS));
    spawnWilds();
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
    SFX.battleStart();
    player.moving = false; player.face = side; player.ox = 0;
    ally().hp = Math.floor(ally().hp);
    ally().st = 25; w.st = 5 + rand() * 30; w.wdir = 0;
    G.camT = clamp(player.x + side * 45 - W / 2, 0, WORLD_W - W);
    banner(G.friend ? `たいせん！ ${w.name} が むかってきた！` : (SPECIES[w.sp].boss ? `${w.name}が たちはだかった！` : `やせいの ${w.name}が あらわれた！`), 2.0);
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
    if (G.netRole && (!B.who || B.who === 'me')) netSend({ t: 'cmd', kind });
    B.phase = 'run';
    if (B.who === 'opp') B.q.push(enemyAttack(kind));
    else B.q.push(kind === 'recruit' ? recruitAction() : kind === 'run' ? runAction() : allyAttack(kind));
  }
  function aiChoose(e, a) {
    const strong = SPECIES[e.sp].moves.strong;
    const est = strong.power * e.atk / (e.atk + a.def);
    if (a.hp <= est * 1.05 && rand() < 0.7) return 'strong';
    return rand() < 0.3 ? 'strong' : 'attack';
  }
  function* strike(attA, att, defA, def, mv, kind) {
    const dir = Math.sign(defA.x - attA.x) || 1;
    const dist = kind === 'strong' ? 22 : 10;
    if (kind === 'strong') { yield* tween(v => attA.ox = v, 0, -dir * 4, 0.22); yield* wait(0.08); }
    yield* tween(v => attA.ox = v, attA.ox, dir * dist, kind === 'strong' ? 0.1 : 0.13);
    if (rand() < mv.acc) {
      const dmg = calcDmg(att, def, mv);
      def.hp = Math.max(0, def.hp - dmg);
      defA.flash = 0.3; defA.shake = 0.3;
      pop(defA.x, GROUND - 38, dmg, kind === 'strong' ? '#ffdf3a' : '#ffffff');
      burst(defA.x - dir * 6, GROUND - 14, 'hit', kind === 'strong' ? 10 : 5);
      if (kind === 'strong') G.shakeT = 0.3;
      SFX.hit(kind);
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
    const xp = Math.max(6, Math.round((e.maxHp + e.atk * 2) * (SPECIES[e.sp].boss ? 0.55 : 0.35)));
    const ups = grantXp(xp);
    SFX.win();
    banner(SPECIES[e.sp].boss ? `${e.name}を たおした！ さきへ すすめる！` : `${e.name}を たおした！  +${xp}けいけん`, 2.2);
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
    for (const m of G.party) m.st = 0;
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
    animActor(player, dt); animActor(comp, dt);
    for (const w of G.wilds) animActor(w, dt);
    G.cam += (G.camT - G.cam) * Math.min(1, dt * 6);
    if (Math.abs(G.camT - G.cam) < 0.3) G.cam = G.camT;
    if (G.shakeT > 0) G.shakeT -= dt;
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
    if (STAGES[G.stage].theme === 'road' && drawProp('signpost', WORLD_W - 36, cam)) return;
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
    if (st.theme === 'road') {
      const f = PROPS.fence;
      if (f) for (let x = -(((cam % f.width) + f.width) % f.width); x < W; x += f.width) g.drawImage(f, x, EDGE - 30);
    }
    for (const d of st.decor || []) drawProp(d.k, d.x, cam);
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
    rect(0, 0, W, H, '#6cc547');
    for (let i = 0; i < 90; i++) { const X = (i * 53) % W, Y = (i * 29) % 72; rect(X, Y, 2, 1, '#5db23f'); }
    rect(0, 0, W, 8, '#72c0f8');
    // path between nodes
    for (let k = 0; k < MAP_NODES.length - 1; k++) {
      const a = MAP_NODES[k], b = MAP_NODES[k + 1], n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 4);
      for (let j = 1; j < n; j++) rect(Math.round(a.x + (b.x - a.x) * j / n), Math.round(a.y + (b.y - a.y) * j / n), 2, 2, k + 1 < G.unlocked ? '#e8c890' : '#8aa870');
    }
    MAP_NODES.forEach((n, i) => {
      const open = i < G.unlocked, clr = n.stage != null && G.cleared.includes(n.stage), sel = i === G.mapSel;
      rect(n.x - 5, n.y - 3, 11, 7, '#3a2410'); rect(n.x - 4, n.y - 4, 9, 9, '#3a2410');
      rect(n.x - 4, n.y - 3, 9, 7, open ? (clr ? '#ffd23a' : '#f45a5a') : '#9a9a9a');
      rect(n.x - 3, n.y - 3, 7, 1, 'rgba(255,255,255,0.5)');
      if (!open) tiny('?', n.x - 1, n.y - 2, '#ffffff');
      if (clr) drawPattern(['..#..', '#####', '.###.', '#.#.#'], n.x - 2, n.y - 2, { '#': '#ffffff' });
      if (sel && Math.floor(G.t * 4) % 2) { g.strokeStyle = '#ffffff'; g.lineWidth = 1; g.strokeRect(n.x - 6.5, n.y - 5.5, 14, 12); }
    });
    // boy on the map (feet on the node)
    const s = SPR.player, p = G.mapPos;
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
    COMMANDS.forEach((c, i) => {
      const b = BTN[i];
      const sel = swapping ? B.swapSel === i : (enabled && B.sel === i);
      const oy = sel ? 1 : 0;
      rect(b.x, b.y + oy, b.w, b.h - oy, '#3a2410');
      rect(b.x + 1, b.y + 1 + oy, b.w - 2, b.h - 2 - oy, c.color);
      rect(b.x + 1, b.y + 1 + oy, b.w - 2, 1, 'rgba(255,255,255,0.35)');
      rect(b.x + 1, b.y + b.h - 2, b.w - 2, 1, c.dark);
      drawPattern(ICONS[c.icon], b.x + 4, b.y + 2 + oy, { w: '#ffffff', y: '#ffe24a' });
      tiny(String(i + 1), b.x + 1, b.y + 1 + oy, '#ffffff', c.dark);
      if (!enabled) { g.globalAlpha = 0.5; rect(b.x, b.y, b.w, b.h, '#8a8070'); g.globalAlpha = 1; }
      if (sel && Math.floor(G.t * 4) % 2) {
        g.strokeStyle = '#ffe24a'; g.lineWidth = 1; g.strokeRect(b.x - 0.5, b.y + oy - 0.5, b.w + 1, b.h - oy + 1);
      }
    });
    // message text (hi-res layer)
    let l1 = '', l2 = '';
    if (!B) {
      if (G.signNear) { [l1, l2] = STAGES[G.stage].exit; }
      else if (G.benchNear) { l1 = 'ベンチ'; l2 = 'ひとやすみ できた'; }
      else { l1 = `${a.name}`; l2 = `HP ${Math.floor(a.hp)}/${a.maxHp}`; }
    } else if (B.phase === 'intro') { l1 = SPECIES[B.w.sp].boss ? 'ボスの' : 'やせいの'; l2 = B.w.name + '！'; }
    else if (B.phase === 'swap') {
      const m = G.party[B.swapSel];
      l1 = m ? m.name : '？';
      l2 = m ? 'をおうちへ' : '';
    }
    else if (B.phase === 'input') {
      const c = COMMANDS[B.sel];
      l1 = (B.who === 'opp' ? 'あいて ' : '') + `${c.label}`;
      if (B.who === 'opp') l2 = SPECIES[B.w.sp].moves[c.kind].name;
      else if (c.kind === 'recruit') l2 = SPECIES[B.w.sp].boss ? 'ボスは なかまに できない' : `せいこう ${Math.round(recruitChance(B.w) * 100)}%`;
      else if (c.kind === 'run' && SPECIES[B.w.sp].boss) l2 = 'ボスからは にげられない';
      else if (c.kind === 'run') l2 = `にげる ${Math.round(runChance(a, B.w, B.runTries) * 100)}%`;
      else l2 = SPECIES[a.sp].moves[c.kind].name;
    } else if (B.cur || B.phase === 'end') { [l1, l2] = wrap2(B.msg, 12); }
    else { l1 = 'スタミナ'; l2 = 'ためちゅう…'; }
    T(l1, 45.5, 76); T(l2, 45.5, 81);
  }
  function wrap2(msg, n) {
    if (msg.length <= n) return [msg, ''];
    const cut = msg.lastIndexOf(' ', n);
    return cut > 0 ? [msg.slice(0, cut), msg.slice(cut + 1)] : [msg.slice(0, n), msg.slice(n)];
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
    T('ぬいぐるみ', 80, 4, { size: 12, c: '#ff6fa8', ol: '#ffffff', ol2: '#5a2040', al: 'center' });
    T('モンスター', 80, 17.5, { size: 12, c: '#5ccf3a', ol: '#ffffff', ol2: '#1f4a18', al: 'center' });
    T('Plush Monsters Adventure', 80, 31, { size: 4, c: '#ffffff', ol: '#2a2a3a', al: 'center' });
    if ((G.t % 1.2) < 0.85) {
      const line = G.hasSave
        ? (TOUCH ? 'うえタップ つづきから' : 'ENTER つづきから ／ N はじめから')
        : (TOUCH ? 'うえタップで スタート' : 'ENTER で スタート');
      T(line, 80, 38, { size: 4, c: '#fff6b0', ol: '#4a2c12', al: 'center' });
    }
    T(TOUCH ? 'したタップで なかまを きりかえ' : '←→ で なかまを きりかえ', 80, 46, { size: 4, c: '#ffd0e4', ol: '#5a2040', al: 'center' });
    T(hero().name, 80, 54, { size: 8, c: '#ffffff', ol: '#1a3a5a', al: 'center' });
    if (G.hasSave) {
      const s = readSave();
      const st = STAGES[s && s.stage || 0];
      T(`セーブ: ${st ? st.name : ''}  Lv${(s && s.party && s.party[0] && s.party[0].lv) || 1}`, 80, 54, { size: 4, c: '#ffffff', ol: '#1a3a5a', al: 'center' });
    }
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
    drawRoadProps(cam); drawSign(cam); drawBench(cam);
    for (const w of G.wilds) if (w.alive && w.alpha > 0) drawActor(w, cam);
    if (G.battle && G.battle.w) drawActor(G.battle.w, cam);
    drawActor(comp, cam);
    drawActor(player, cam);
    if (G.battle && G.battle.phase !== 'done') { drawBars(G.battle.w, G.battle.w, cam); if (comp.alpha > 0) drawBars(comp, ally(), cam); }
    drawParticles(cam);
    if (G.state !== 'title') {
      drawHUD(); drawBanner();
      // help + party (hi-res text)
      G.chip = null;
      if (TOUCH) {
        if (G.state === 'battle') {
          const lab = G.waitMode ? 'WAIT' : 'ACTIVE', cw = Math.ceil(measure(lab)) + 4;
          G.chip = { x: 0, y: 0, w: cw + 6, h: 10 };   // generous tap area
          rect(1, 1, cw + 2, 7, '#5a3418'); rect(2, 2, cw, 5, G.waitMode ? '#fff8e0' : '#ffd23a');
          T(lab, 4, 2.5, { size: 4, c: '#5a3418' });
          T('ボタンをタップ', cw + 5, 2.5, { size: 4, c: '#ffffff', ol: '#1a3a5a' });
        } else T('ボタンで あるく・ジャンプ・いれかえ', 2, 1, { size: 4, c: '#ffffff', ol: '#1a3a5a' });
      } else {
        const help = G.state === 'battle' ? '1-4/クリック:コマンド ←→+Enter:えらぶ T:' + (G.waitMode ? 'WAIT' : 'ACTIVE') + ' M:おと'
          : '←→/AD:あるく ↑/W/Space:ジャンプ C:いれかえ M:おと';
        T(help, 2, 1, { size: 4, c: '#ffffff', ol: '#1a3a5a' });
      }
      const m = ally();
      T(`Lv${m.lv || 1} なかま ${G.party.length}/${TUNING.partyMax}`, 158, 1, { size: 4, c: '#ffffff', ol: '#1a3a5a', al: 'right' });
    } else drawTitle();
    vctx.drawImage(low, 0, 0, W * S, H * S);
    flushText();
    if (G.fade > 0) { vctx.globalAlpha = G.fade; vctx.fillStyle = '#ffffff'; vctx.fillRect(0, 0, view.width, view.height); vctx.globalAlpha = 1; }
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
    makeHeroes();
    applyHero();
    await Promise.all(Object.entries(PROP_IMGS).map(([k, src]) => loadImg(src).then(img => { PROPS[k] = img; }).catch(e => console.warn(e))));
    try { await document.fonts.load('8px Misaki'); await document.fonts.load("8px 'DotGothic16'"); } catch (e) { console.warn('font load failed', e); }
    G.bg = G.bgCache.oka = BG.build(WORLD_W, STAGES[0].theme);
    G.party = [newMember('goririn')];
    spawnWilds();
    // title composition mirrors the KV: boy + Goririn on the left, Oguri on the right
    G.wilds[0].x = 128; G.wilds[0].face = -1;
    G.state = 'title';
    G.hasSave = !!readSave();
    if (params.has('skiptitle')) startGame(false);
    requestAnimationFrame(frame);
  }
  // debug / test hooks
  window.NM = { G, player, comp, startBattle, choose, enterStage, openMap, clearStage, recruitChance, persist, wipeSave, confirmSwap, get ally() { return ally(); }, get layout() { return layout; }, TOUCH, BTN };
  boot().catch(e => { $err.textContent += String(e) + '\n'; console.error(e); });
})();
