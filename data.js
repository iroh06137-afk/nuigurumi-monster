'use strict';
// ぬいぐるみモンスター — data / tuning (prototype v0.1)
// Values follow 企画書 v0.7 §6.2 / §6.4. ★ = provisional.

// 32x32 sprites. native = direction the source art faces (1 = right, -1 = left).
const SPRITES = {
  npc_girl: { src: 'assets/npc/girl.png', native: 1 },
  npc_mushitori: { src: 'assets/npc/mushitori.png', native: 1 },
  npc_gaki: { src: 'assets/npc/gaki.png', native: 1 },
  npc_oneesan: { src: 'assets/npc/oneesan.png', native: 1 },
  npc_karate: { src: 'assets/npc/karate.png', native: 1 },
  hero_girl: { src: 'assets/npc/girl.png', native: 1, walk: { src: 'assets/hero/girl_walk.png', frames: 4, ms: 150 } },
  player:  { src: 'assets/player.png',    native: 1, walk: { src: 'assets/player_walk.png', frames: 4, ms: 150 } },
  goririn: { src: 'assets/goririn.png',   native: 1, walk: { src: 'assets/goririn_walk.png', frames: 4, ms: 150 } },  // near-frontal, symmetric
  kuuko:   { src: 'assets/kuuko.png',     native: 1, walk: { src: 'assets/kuuko_walk.png', frames: 4, ms: 150 } }, // slim white teddy
  tsumaguro: { src: 'assets/tsumaguro.png', native: 1, walk: { src: 'assets/tsumaguro_walk.png', frames: 4, ms: 150 } }, // blacktip shark (hops on pectoral fins)
  kitsunen: { src: 'assets/kitsunen.png', native: 1 }, // fox plush (zako). no walk sheet yet: bobs while moving
  usagin:  { src: 'assets/usagin.png',   native: 1 }, // lop-eared rabbit plush (zako). no walk sheet yet
  kaerun:  { src: 'assets/kaerun.png',   native: 1 }, // frog plush (zako). no walk sheet yet
  fukuron: { src: 'assets/fukuron.png',  native: 1 }, // owl plush (zako). no walk sheet yet
  tanukin: { src: 'assets/tanukin.png',  native: 1 }, // tanuki plush (zako). no walk sheet yet
  kangarun: { src: 'assets/kangarun.png', native: 1 }, // kangaroo plush with ribbon + baby in pouch (rare). no walk sheet yet
  nyankon: { src: 'assets/nyankon.png', native: 1 }, // calico cat plush (after town). no walk sheet yet
  wankon: { src: 'assets/wankon.png', native: 1 }, // puppy plush (after town). no walk sheet yet
  pandan: { src: 'assets/pandan.png', native: 1 }, // panda plush (after town). no walk sheet yet
  pengiin: { src: 'assets/pengiin.png', native: 1 }, // penguin plush (after town). no walk sheet yet
  mokomon: { src: 'assets/mokomon.png', native: 1 }, // sheep (わたぐも高原) plush (after town). no walk sheet yet
  ressan: { src: 'assets/ressan.png', native: 1 }, // red panda (あかつち谷) plush (after town). no walk sheet yet
  // evolved forms (EVOLVE below), all right-facing 32x32
  goririn_evo: { src: 'assets/evo/goririn.png', native: 1, attack: { src: 'assets/evo/goririn_attack.png', frames: 4 }, walk: { src: 'assets/evo/goririn_walk.png', frames: 4, ms: 150 } },
  kuuko_evo: { src: 'assets/evo/kuuko.png', native: 1, attack: { src: 'assets/evo/kuuko_attack.png', frames: 4 }, walk: { src: 'assets/evo/kuuko_walk.png', frames: 4, ms: 150 } },
  tsumaguro_evo: { src: 'assets/evo/tsumaguro.png', native: 1, attack: { src: 'assets/evo/tsumaguro_attack.png', frames: 4 }, walk: { src: 'assets/evo/tsumaguro_walk.png', frames: 4, ms: 150 } },
  oguri_evo: { src: 'assets/evo/oguri.png', native: 1, attack: { src: 'assets/evo/oguri_attack.png', frames: 4 }, walk: { src: 'assets/evo/oguri_walk.png', frames: 4, ms: 150 } },
  kitsunen_evo: { src: 'assets/evo/kitsunen.png', native: 1, attack: { src: 'assets/evo/kitsunen_attack.png', frames: 4 }, walk: { src: 'assets/evo/kitsunen_walk.png', frames: 4, ms: 150 } },
  usagin_evo: { src: 'assets/evo/usagin.png', native: 1, attack: { src: 'assets/evo/usagin_attack.png', frames: 4 }, walk: { src: 'assets/evo/usagin_walk.png', frames: 4, ms: 150 } },
  kangarun_evo: { src: 'assets/evo/kangarun.png', native: 1, attack: { src: 'assets/evo/kangarun_attack.png', frames: 4 }, walk: { src: 'assets/evo/kangarun_walk.png', frames: 4, ms: 150 } },
  kaerun_evo: { src: 'assets/evo/kaerun.png', native: 1, attack: { src: 'assets/evo/kaerun_attack.png', frames: 4 }, walk: { src: 'assets/evo/kaerun_walk.png', frames: 4, ms: 150 } },
  fukuron_evo: { src: 'assets/evo/fukuron.png', native: 1, attack: { src: 'assets/evo/fukuron_attack.png', frames: 4 }, walk: { src: 'assets/evo/fukuron_walk.png', frames: 4, ms: 150 } },
  tanukin_evo: { src: 'assets/evo/tanukin.png', native: 1, attack: { src: 'assets/evo/tanukin_attack.png', frames: 4 }, walk: { src: 'assets/evo/tanukin_walk.png', frames: 4, ms: 150 } },
  nyankon_evo: { src: 'assets/evo/nyankon.png', native: 1, attack: { src: 'assets/evo/nyankon_attack.png', frames: 4 }, walk: { src: 'assets/evo/nyankon_walk.png', frames: 4, ms: 150 } },
  wankon_evo: { src: 'assets/evo/wankon.png', native: 1, attack: { src: 'assets/evo/wankon_attack.png', frames: 4 }, walk: { src: 'assets/evo/wankon_walk.png', frames: 4, ms: 150 } },
  pandan_evo: { src: 'assets/evo/pandan.png', native: 1, attack: { src: 'assets/evo/pandan_attack.png', frames: 4 }, walk: { src: 'assets/evo/pandan_walk.png', frames: 4, ms: 150 } },
  pengiin_evo: { src: 'assets/evo/pengiin.png', native: 1, attack: { src: 'assets/evo/pengiin_attack.png', frames: 4 }, walk: { src: 'assets/evo/pengiin_walk.png', frames: 4, ms: 150 } },
  mokomon_evo: { src: 'assets/evo/mokomon.png', native: 1, attack: { src: 'assets/evo/mokomon_attack.png', frames: 4 }, walk: { src: 'assets/evo/mokomon_walk.png', frames: 4, ms: 150 } },
  ressan_evo: { src: 'assets/evo/ressan.png', native: 1, attack: { src: 'assets/evo/ressan_attack.png', frames: 4 }, walk: { src: 'assets/evo/ressan_walk.png', frames: 4, ms: 150 } },
  oguri:   { src: 'assets/oguri-cap.png', native: -1, walk: { src: 'assets/oguri_walk.png', frames: 4, ms: 150 } }, // faces left; flipped for right
};

const SPECIES = {
  goririn: {
    name: 'ゴリリン', sprite: 'goririn',
    hp: 40, atk: 9, def: 7, spd: 8, recruitBase: 0.15,
    moves: {
      attack: { name: 'ぽかぽかパンチ', power: 10, acc: 0.97 },
      strong: { name: 'ドラミングボム', power: 24, acc: 0.85 },
    },
  },
  kuuko: {  // ★ provisional stats: slim long-legged white teddy, balanced
    name: 'くうこ', sprite: 'kuuko',
    hp: 38, atk: 8, def: 8, spd: 9, recruitBase: 0.12,
    moves: {
      attack: { name: 'ふわふわタッチ', power: 10, acc: 0.97 },
      strong: { name: 'くまくまハグ',   power: 23, acc: 0.85 },
    },
  },
  tsumaguro: {  // ★ provisional stats: blacktip shark plush, hard hitter, frail
    name: 'ツマグロ', sprite: 'tsumaguro',
    hp: 32, atk: 11, def: 5, spd: 10, recruitBase: 0.08,
    moves: {
      attack: { name: 'がぶっとかみつき', power: 11, acc: 0.95 },
      strong: { name: 'ひれアタック',     power: 25, acc: 0.82 },
    },
  },
  kitsunen: {  // ★ provisional: road zako, weaker than the rare cast (user request), easier to recruit
    name: 'キツネン', sprite: 'kitsunen',
    hp: 28, atk: 7, def: 4, spd: 10, recruitBase: 0.20,
    moves: {
      attack: { name: 'しっぽはたき',     power: 9,  acc: 0.97 },
      strong: { name: 'こんこんダッシュ', power: 20, acc: 0.85 },
    },
  },
  usagin: {  // ★ provisional: road zako, weaker than the rare cast; fast but weak hits
    name: 'ウサギン', sprite: 'usagin',
    hp: 26, atk: 6, def: 4, spd: 12, recruitBase: 0.22,
    moves: {
      attack: { name: 'ぴょんキック',     power: 9,  acc: 0.97 },
      strong: { name: 'たれみみビンタ',   power: 19, acc: 0.86 },
    },
  },
  kangarun: {  // ★ provisional: rare (like くうこ/ツマグロ), appears once (夕方の草地)
    name: 'カンガルン', sprite: 'kangarun',
    hp: 36, atk: 9, def: 6, spd: 10, recruitBase: 0.10,
    moves: {
      attack: { name: 'ぴょこぴょこキック', power: 10, acc: 0.96 },
      strong: { name: 'ボクシングパンチ',   power: 24, acc: 0.84 },
    },
  },
  kaerun: {  // ★ provisional: road zako (frog), sturdy but slow-ish
    name: 'カエルン', sprite: 'kaerun',
    hp: 30, atk: 6, def: 5, spd: 9, recruitBase: 0.20,
    moves: {
      attack: { name: 'したペチン',       power: 9,  acc: 0.97 },
      strong: { name: 'ケロケロジャンプ', power: 20, acc: 0.85 },
    },
  },
  fukuron: {  // ★ provisional: road zako (owl), quick
    name: 'フクロン', sprite: 'fukuron',
    hp: 27, atk: 6, def: 5, spd: 11, recruitBase: 0.18,
    moves: {
      attack: { name: 'つばさはたき',     power: 9,  acc: 0.97 },
      strong: { name: 'ホーホーおんぱ',   power: 20, acc: 0.86 },
    },
  },
  tanukin: {  // ★ provisional: road zako (tanuki), tanky and slow
    name: 'タヌキン', sprite: 'tanukin',
    hp: 32, atk: 7, def: 5, spd: 7, recruitBase: 0.18,
    moves: {
      attack: { name: 'ぽんぽこパンチ',   power: 10, acc: 0.96 },
      strong: { name: 'ばけばけアタック', power: 21, acc: 0.84 },
    },
  },
  nyankon: {  // ★ provisional: after-town zako (cat), quick hitter
    name: 'ニャンコン', sprite: 'nyankon',
    hp: 38, atk: 11, def: 6, spd: 13, recruitBase: 0.14,
    moves: {
      attack: { name: 'ねこパンチ',       power: 11, acc: 0.97 },
      strong: { name: 'ひっかきラッシュ', power: 23, acc: 0.85 },
    },
  },
  wankon: {  // ★ provisional: after-town zako (dog), balanced
    name: 'ワンコン', sprite: 'wankon',
    hp: 42, atk: 11, def: 8, spd: 11, recruitBase: 0.14,
    moves: {
      attack: { name: 'あまがみ',         power: 11, acc: 0.96 },
      strong: { name: 'わんわんタックル', power: 24, acc: 0.84 },
    },
  },
  pandan: {  // ★ provisional: after-town (panda), heavy and slow
    name: 'パンダン', sprite: 'pandan',
    hp: 52, atk: 12, def: 10, spd: 6, recruitBase: 0.10,
    moves: {
      attack: { name: 'ささパンチ',       power: 12, acc: 0.95 },
      strong: { name: 'ごろごろプレス',   power: 27, acc: 0.80 },
    },
  },
  pengiin: {  // ★ provisional: after-town (penguin), sturdy
    name: 'ペンギーン', sprite: 'pengiin',
    hp: 40, atk: 10, def: 9, spd: 9, recruitBase: 0.14,
    moves: {
      attack: { name: 'つるつるアタック', power: 11, acc: 0.96 },
      strong: { name: 'こおりスライド',   power: 23, acc: 0.85 },
    },
  },
  mokomon: {  // ★ provisional: わたぐも高原 (sheep), very tanky
    name: 'モコモン', sprite: 'mokomon',
    hp: 46, atk: 9, def: 11, spd: 8, recruitBase: 0.15,
    moves: {
      attack: { name: 'もこもこタックル', power: 10, acc: 0.97 },
      strong: { name: 'わたぐもボム',     power: 22, acc: 0.86 },
    },
  },
  ressan: {  // ★ provisional: あかつち谷 (red panda), fast and strong
    name: 'レッサン', sprite: 'ressan',
    hp: 40, atk: 12, def: 7, spd: 12, recruitBase: 0.12,
    moves: {
      attack: { name: 'しっぽビンタ',     power: 12, acc: 0.96 },
      strong: { name: 'あかつちキック',   power: 25, acc: 0.84 },
    },
  },
  kaido_boss: {  // ★ placeholder boss for ぬいぐるみ街道
    name: 'かいどうの ボス', sprite: 'kitsunen', boss: true,
    hp: 60, atk: 8, def: 6, spd: 8, recruitBase: 0,
    moves: {
      attack: { name: 'おやぶんパンチ',   power: 11, acc: 0.95 },
      strong: { name: 'ぐるぐるアタック', power: 24, acc: 0.85 },
    },
  },
  mori_boss: {
    name: 'もりの ぬし', sprite: 'tanukin', boss: true,
    hp: 72, atk: 10, def: 8, spd: 7, recruitBase: 0,
    moves: {
      attack: { name: 'こかげタックル', power: 12, acc: 0.94 },
      strong: { name: 'どかんハグ',     power: 26, acc: 0.82 },
    },
  },
  hoshi_boss: {
    name: 'ほしの ぬし', sprite: 'tsumaguro', boss: true,
    hp: 88, atk: 12, def: 8, spd: 9, recruitBase: 0,
    moves: {
      attack: { name: 'ほしのかみつき', power: 13, acc: 0.93 },
      strong: { name: 'げっこうアタック', power: 28, acc: 0.80 },
    },
  },
  oguri: {
    name: 'オグリキャップ', sprite: 'oguri',
    hp: 34, atk: 8, def: 5, spd: 11, recruitBase: 0.10,
    moves: {
      attack: { name: 'たいあたり',     power: 10, acc: 0.97 },
      strong: { name: 'ラストスパート', power: 22, acc: 0.85 },
    },
  },
};

// Stamina cost per action (gauge max 100; must be FULL to act). 企画書 §6.4
const COST = { attack: 35, strong: 70, recruit: 50, run: 25, guard: 20, item: 30, swap: 30, special: 60 };

// HUD command buttons, in key order 1..4
const COMMANDS = [   // 2 pages of 4: page 1 = keys 1-4, page 2 = keys 5-8 (↑↓ / Q to flip)
  { kind: 'attack',  label: 'こうげき',     icon: 'sword',  color: '#8a5a2e', dark: '#5a3418' },
  { kind: 'strong',  label: 'つよわざ',     icon: 'bolt',   color: '#3c9a40', dark: '#1f5a22' },
  { kind: 'special', label: 'ひっさつ',     icon: 'star',   color: '#e0662a', dark: '#8a3010' },
  { kind: 'recruit', label: 'なかまにする', icon: 'heart',  color: '#d4588c', dark: '#7a2a4c' },
  { kind: 'guard',   label: 'ぼうぎょ',     icon: 'shield', color: '#6a7a8a', dark: '#3a4450' },
  { kind: 'item',    label: 'どうぐ',       icon: 'potion', color: '#c89a2a', dark: '#7a5a10' },
  { kind: 'swap',    label: 'いれかえ',     icon: 'swap',   color: '#2a9a9a', dark: '#145a5a' },
  { kind: 'run',     label: 'にげる',       icon: 'run',    color: '#4a76bf', dark: '#24407a' },
];

const TUNING = {
  walkSpeed: 36,          // logical px / s
  jumpV: 118, gravity: 430,
  stBase: 8, stPerSpd: 1.2, // stamina / s = stBase + spd * stPerSpd
  recruitHpWeight: 0.6,   // p = base + weight * (1 - hp/maxHp)
  recruitMin: 0.05, recruitMax: 0.95,
  runBase: 0.70, runSpdWeight: 0.04, runTryBonus: 0.15,
  regenPerSec: 1,         // party HP regen while walking
  encounterDist: 70,
  partyMax: 4,
};

// ---------- evolution ----------
// at lv, a party plush evolves after a battle: new look (sprite key, loaded from SPRITES once the art is in), optional new name, stat bonus.
// an entry does nothing until SPRITES[sprite] exists, so art can be dropped in one plush at a time. ★ names / numbers provisional
const EVOLVE = {};
for (const sp of ['goririn', 'kuuko', 'tsumaguro', 'oguri', 'kitsunen', 'usagin', 'kangarun', 'kaerun',
                  'fukuron', 'tanukin', 'nyankon', 'wankon', 'pandan', 'pengiin', 'mokomon', 'ressan']) {
  EVOLVE[sp] = { lv: 10, sprite: sp + '_evo', name: null, hp: 10, atk: 3, def: 3, spd: 1 };
}

// evolved moves: strong gets a new name (+power), special becomes its own projectile move.
// fx: fire / orb / beam / wave / multi (hits = number of shots; shape: 'glove' | 'orb'). ★ names other than
// オグリ波 / くうこ弾 / 水ビーム / パンチングパンチ are provisional.
const EVO_MOVES = {
  goririn:   { strong: { name: 'メガドラミング', power: 28 },     special: { name: 'メガパンチ',       fx: 'multi', shape: 'glove', hits: 1, col: '#ff7ab0' } },
  kuuko:     { strong: { name: 'ぎゅうぎゅうハグ', power: 27 },   special: { name: 'くうこ弾',         fx: 'orb',   col: '#7ad8ff' } },
  tsumaguro: { strong: { name: 'シャークひれぎり', power: 29 },   special: { name: '水ビーム',         fx: 'beam',  col: '#4ab8ff' } },
  oguri:     { strong: { name: 'ゴールドスパート', power: 26 },   special: { name: 'オグリ波',         fx: 'fire',  col: '#ff8a2a' } },
  kitsunen:  { strong: { name: 'こんこんスラッシュ', power: 24 }, special: { name: 'きつねび',         fx: 'fire',  col: '#6ad0ff' } },
  usagin:    { strong: { name: 'たれみみれんだ', power: 23 },     special: { name: 'にんじんミサイル', fx: 'orb',   col: '#ff9a3a' } },
  kangarun:  { strong: { name: 'ストレートパンチ', power: 28 },   special: { name: 'パンチングパンチ', fx: 'multi', shape: 'glove', hits: 3, col: '#e83a3a' } },
  kaerun:    { strong: { name: 'ケロケロダイブ', power: 24 },     special: { name: 'あわあわバブル',   fx: 'multi', shape: 'orb', hits: 3, col: '#9ee8ff' } },
  fukuron:   { strong: { name: 'よるの はばたき', power: 24 },    special: { name: 'ちょうおんぱ',     fx: 'wave',  col: '#c8a8ff' } },
  tanukin:   { strong: { name: 'ばけばけダイブ', power: 25 },     special: { name: 'はっぱしゅりけん', fx: 'multi', shape: 'orb', hits: 3, col: '#6ad04a' } },
  nyankon:   { strong: { name: 'ひっかきトルネード', power: 27 }, special: { name: 'にゃんにゃんけだま', fx: 'orb', col: '#ffb0d0' } },
  wankon:    { strong: { name: 'わんわんスマッシュ', power: 28 }, special: { name: 'とおぼえ',         fx: 'wave',  col: '#ffe04a' } },
  pandan:    { strong: { name: 'ごろごろメガプレス', power: 31 }, special: { name: 'ささのは みだれうち', fx: 'multi', shape: 'orb', hits: 3, col: '#7ae05a' } },
  pengiin:   { strong: { name: 'こおりスライダー', power: 27 },   special: { name: 'こおりビーム',     fx: 'beam',  col: '#bff0ff' } },
  mokomon:   { strong: { name: 'わたぐもメガボム', power: 26 },   special: { name: 'わたぐもサンダー', fx: 'beam',  col: '#ffe84a' } },
  ressan:    { strong: { name: 'あかつち かかとおとし', power: 29 }, special: { name: 'ほのおの しっぽ', fx: 'fire',  col: '#ff5a2a' } },
};

// pixel-art special fx by ドット絵作成くん (cast = attacker 4 frames; shot/hit = 128x32 sheets in assets/fx/<sp>_shot|hit.png).
// cast.spawn = fx anchor inside each 32x32 cast frame (right-facing); fire = order steps that launch a shot; hold = step held until shots land.
const FX_ART = {
  oguri: {"cast": {"order": [0, 1, 2, 3], "dur": [270, 90, 360, 180], "spawn": [[29, 14], [30, 21], [31, 21], [30, 20]], "fire": [1], "hold": 2}, "shot": {"mode": "fly", "ms": 80, "ax": 22, "ay": 16, "spd": 170}, "hit": {"ms": 90}},
  kuuko: {"cast": {"order": [0, 1, 2, 3], "dur": [180, 90, 360, 180], "spawn": [[17, 15], [30, 17], [31, 17], [17, 16]], "fire": [1], "hold": 2}, "shot": {"mode": "fly", "ms": 90, "ax": 21, "ay": 16, "spd": 160}, "hit": {"ms": 90}},
  tsumaguro: {"cast": {"order": [0, 1, 2, 3], "dur": [180, 90, 720, 180], "spawn": [[30, 22], [30, 24], [30, 24], [30, 23]], "fire": [1], "hold": 2}, "shot": {"mode": "beam", "ms": 80, "ax": 0, "ay": 16}, "hit": {"ms": 90}},
  kangarun: {"cast": {"order": [0, 1, 2, 1, 3], "dur": [140, 110, 110, 160], "spawn": [[22, 17], [31, 17], [30, 15], [22, 18]], "fire": [1, 2, 3], "hold": null}, "shot": {"mode": "glove", "ms": 80, "ax": 19, "ay": 16}, "hit": {"ms": 80}},
  goririn: {"cast": {"order": [0, 1, 2, 3], "dur": [220, 80, 320, 200], "spawn": [[28, 7], [30, 17], [31, 17], [28, 26]], "fire": [1], "hold": 2}, "shot": {"mode": "fly", "ms": 80, "ax": 15, "ay": 15, "spd": 220}, "hit": {"ms": 90}},
  kitsunen: {"cast": {"order": [0, 1, 2, 3], "dur": [200, 90, 320, 180], "spawn": [[24, 22], [30, 21], [31, 21], [28, 21]], "fire": [1], "hold": 2}, "shot": {"mode": "fly", "ms": 80, "ax": 21, "ay": 18, "spd": 155}, "hit": {"ms": 90}},
  usagin: {"cast": {"order": [0, 1, 2, 3], "dur": [200, 90, 320, 180], "spawn": [[26, 11], [30, 19], [31, 19], [27, 22]], "fire": [1], "hold": 2}, "shot": {"mode": "fly", "ms": 80, "ax": 20, "ay": 16, "spd": 200}, "hit": {"ms": 90}},
  kaerun: {"cast": {"order": [0, 1, 2, 1, 2, 1, 3], "dur": [220, 120, 110, 180], "spawn": [[25, 14], [26, 13], [25, 13], [25, 13]], "fire": [1, 3, 5], "hold": null}, "shot": {"mode": "fly", "ms": 100, "ax": 18, "ay": 16, "spd": 125}, "hit": {"ms": 80}},
  fukuron: {"cast": {"order": [0, 1, 2, 3], "dur": [220, 90, 400, 180], "spawn": [[26, 11], [26, 11], [26, 11], [26, 11]], "fire": [1], "hold": 2}, "shot": {"mode": "fly", "ms": 70, "ax": 2, "ay": 16, "spd": 200}, "hit": {"ms": 80}},
  tanukin: {"cast": {"order": [0, 1, 2, 1, 2, 1, 3], "dur": [200, 90, 110, 180], "spawn": [[28, 10], [31, 20], [29, 14], [28, 23]], "fire": [1, 3, 5], "hold": null}, "shot": {"mode": "fly", "ms": 60, "ax": 18, "ay": 16, "spd": 220}, "hit": {"ms": 70}},
  nyankon: {"cast": {"order": [0, 1, 2, 3], "dur": [180, 90, 360, 180], "spawn": [[26, 21], [28, 21], [29, 21], [27, 21]], "fire": [1], "hold": 2}, "shot": {"mode": "fly", "ms": 90, "ax": 21, "ay": 17, "spd": 160}, "hit": {"ms": 90}},
  wankon: {"cast": {"order": [0, 1, 2, 3], "dur": [270, 90, 450, 180], "spawn": [[25, 14], [26, 11], [26, 11], [25, 12]], "fire": [1], "hold": 2}, "shot": {"mode": "fly", "ms": 80, "ax": 16, "ay": 16, "spd": 170}, "hit": {"ms": 90}},
  pandan: {"cast": {"order": [0, 1, 2, 1, 3], "dur": [180, 110, 110, 160], "spawn": [[26, 15], [28, 20], [28, 17], [25, 21]], "fire": [1, 2, 3], "hold": null}, "shot": {"mode": "fly", "ms": 70, "ax": 19, "ay": 16, "spd": 220}, "hit": {"ms": 80}},
  pengiin: {"cast": {"order": [0, 1, 2, 3], "dur": [180, 90, 720, 180], "spawn": [[26, 14], [26, 15], [26, 16], [26, 15]], "fire": [1], "hold": 2}, "shot": {"mode": "beam", "ms": 80, "ax": 0, "ay": 16}, "hit": {"ms": 90}},
  mokomon: {"cast": {"order": [0, 1, 2, 3], "dur": [270, 90, 720, 180], "spawn": [[25, 16], [25, 14], [25, 13], [25, 14]], "fire": [1], "hold": 2}, "shot": {"mode": "beam", "ms": 60, "ax": 0, "ay": 16}, "hit": {"ms": 80}},
  ressan: {"cast": {"order": [0, 1, 2, 3], "dur": [220, 90, 300, 180], "spawn": [[6, 17], [8, 11], [8, 10], [8, 13]], "fire": [1], "hold": 2}, "shot": {"mode": "fly", "ms": 80, "ax": 16, "ay": 16, "spd": 190}, "hit": {"ms": 90}},
};

// ---------- stages ----------
// width = logical px. theme = background style in bg.js. spawns = wild plush (x = px from the left).
// exit = sign text at the right end (walk past it to clear the stage). bench = full-heal spot. ★ = provisional
const STAGES = [
  {
    id: 'oka', name: 'はじまりの丘', width: 1000, theme: 'day',
    spawns: [ { sp: 'oguri', x: 230 }, { sp: 'kitsunen', x: 340 }, { sp: 'kaerun', x: 450 }, { sp: 'usagin', x: 555 }, { sp: 'tsumaguro', x: 660 }, { sp: 'fukuron', x: 860 } ],
    exit: ['このさき', 'ぬいぐるみ街道'],
  },
  {
    id: 'kaido', name: 'ぬいぐるみ街道', width: 1400, theme: 'road', bench: 680,
    spawns: [ { sp: 'kitsunen', x: 260 }, { sp: 'usagin', x: 400 }, { sp: 'kaerun', x: 540 }, { sp: 'fukuron', x: 820 }, { sp: 'tanukin', x: 960 }, { sp: 'kitsunen', x: 1100 }, { sp: 'kaido_boss', x: 1260 } ],
    exit: ['このさき', '夕方の草地'],
    // decorations stand on the far edge of the road (screen row 63), behind the characters
    decor: [ { k: 'tree', x: 110 }, { k: 'bush', x: 185 }, { k: 'lamp', x: 320 }, { k: 'tree', x: 465 }, { k: 'bush', x: 610 }, { k: 'lamp', x: 750 },
             { k: 'tree', x: 890 }, { k: 'bush', x: 1030 }, { k: 'tree', x: 1170 }, { k: 'lamp', x: 1310 } ],
  },
  {
    id: 'dusk', name: '夕方の草地', width: 1200, theme: 'dusk',
    // ★ placeholder roster until dusk-only species arrive. オグリ/くうこ appear only once in the whole game (丘 / 森)
    spawns: [ { sp: 'tanukin', x: 260 }, { sp: 'usagin', x: 420 }, { sp: 'tsumaguro', x: 600 }, { sp: 'kitsunen', x: 780 }, { sp: 'kangarun', x: 980 } ],
    bench: 540,
    exit: ['このさき', 'ぬいの森'],
  },
  {
    id: 'mori', name: 'ぬいの森', width: 1300, theme: 'forest', bench: 620,
    spawns: [ { sp: 'kitsunen', x: 240 }, { sp: 'kuuko', x: 400 }, { sp: 'tsumaguro', x: 560 }, { sp: 'fukuron', x: 780 }, { sp: 'usagin', x: 940 }, { sp: 'mori_boss', x: 1160 } ],
    exit: ['このさき', 'ほしぞらのはら'],
    decor: [ { k: 'tree', x: 90 }, { k: 'tree', x: 170 }, { k: 'bush', x: 250 }, { k: 'tree', x: 500 }, { k: 'tree', x: 700 }, { k: 'bush', x: 860 }, { k: 'tree', x: 1040 } ],
  },
  {
    id: 'hoshi', name: 'ほしぞらのはら', width: 1300, theme: 'night', bench: 600,
    spawns: [ { sp: 'tanukin', x: 260 }, { sp: 'tsumaguro', x: 440 }, { sp: 'fukuron', x: 640 }, { sp: 'kitsunen', x: 840 }, { sp: 'hoshi_boss', x: 1140 } ],
    exit: ['このさき', 'ぬいぐるみタウン'],
    decor: [ { k: 'bush', x: 120 }, { k: 'lamp', x: 300 }, { k: 'bush', x: 520 }, { k: 'lamp', x: 760 }, { k: 'bush', x: 980 } ],
  },
  {
    // ★ town: no wild plush. people to talk to, shop / clinic / house, trainer battles (people's plush can't be recruited)
    id: 'machi', name: 'ぬいぐるみタウン', width: 1200, theme: 'town', town: true,
    spawns: [],
    exit: ['このさき', 'わたぐも高原'],
    buildings: [
      { k: 'shop',   x: 215, name: 'ぬいショップ' },
      { k: 'clinic', x: 420, name: 'ぬいぐるみびょういん' },
      { k: 'house',  x: 830, name: 'おばあさんの いえ' },
    ],
    // look = placeholder recolor of the boy until the 5 new human sprites are approved
    npcs: [
      // style: fast = cheap hits + spd, guard = guards when hurt, power = strong moves, trick = early special
      // rival = the gender the player didn't pick (default colors). resolved in enterStage
      { id: 'rival', x: 120, rival: {
          girl: { name: 'ユイ', look: 'girl', battle: { style: 'fast', team: [{ sp: 'kitsunen', lv: 7 }, { sp: 'usagin', lv: 10, evo: 1 }], reward: 80 },
            lines: [['あっ {NAME}も ぬいぐるみと たびしてるの？', 'わたしの キツネンと しょうぶよ！']],
            after: [['くやしい… {NAME} つよいね', 'おみせで どうぐも そろえておきなよ']] },
          boy: { name: 'ハルト', look: 'player', battle: { style: 'fast', team: [{ sp: 'kitsunen', lv: 7 }, { sp: 'usagin', lv: 10, evo: 1 }], reward: 80 },
            lines: [['よう {NAME}！ ぬいぐるみと たびしてるのか', 'おれの キツネンと しょうぶだ！']],
            after: [['くっそー… {NAME} やるな！', 'おみせで どうぐも そろえておけよ']] } } },
      { id: 'sota', x: 310, name: 'むしとりの ソウタ', look: 'mushitori', battle: { style: 'guard', team: [{ sp: 'kaerun', lv: 7 }, { sp: 'fukuron', lv: 8 }, { sp: 'tsumaguro', lv: 10, evo: 1 }], reward: 70 },
        lines: [['おっ その ぬいぐるみ つよそう！', 'ぼくの カエルンと しょうぶだ！']],
        after: [['まけたー！', 'もっと きたえて くるよ']] },
      { id: 'reika', x: 520, name: 'おねえさん レイカ', look: 'oneesan',
        lines: [['かった どうぐは {BAG}で', 'いつでも つかえるわ'], ['ひとの ぬいぐるみは', 'なかまに できないから きをつけてね']] },
      { id: 'akane', x: 680, name: 'からてかの アカネ', look: 'karate', battle: { style: 'power', team: [{ sp: 'goririn', lv: 8 }, { sp: 'usagin', lv: 8 }, { sp: 'kangarun', lv: 11, evo: 1 }], reward: 100 },
        lines: [['おす！ しゅぎょう ちゅうだ！', 'うでだめし していけ！']],
        after: [['みごとだ…', 'また しゅぎょうして くる！']] },
      { id: 'daichi', x: 980, name: 'ガキだいしょう ダイチ', look: 'gaki', battle: { style: 'trick', team: [{ sp: 'kitsunen', lv: 9 }, { sp: 'fukuron', lv: 10 }, { sp: 'tanukin', lv: 12, evo: 1 }], reward: 160 },
        lines: [['この まちで いちばん つよいのは', 'おれさまの タヌキンだ！'], ['まちを でる まえに', 'おれと しょうぶ しろ！']],
        after: [['ちぇっ… おまえ つよいな', 'さきへ いっていいぞ']] },
    ],
    decor: [ { k: 'lamp', x: 60 }, { k: 'tree', x: 160 }, { k: 'lamp', x: 270 }, { k: 'bush', x: 360 }, { k: 'tree', x: 475 }, { k: 'lamp', x: 580 },
             { k: 'bush', x: 740 }, { k: 'lamp', x: 900 }, { k: 'tree', x: 1060 }, { k: 'lamp', x: 1120 } ],
  },
  {
    // ★ provisional stage after the town (species / boss to be decided)
    id: 'kogen', name: 'わたぐも高原', width: 1300, theme: 'highland', bench: 640,
    spawns: [ { sp: 'mokomon', x: 260 }, { sp: 'nyankon', x: 430 }, { sp: 'pengiin', x: 600 }, { sp: 'mokomon', x: 820 }, { sp: 'wankon', x: 1000 }, { sp: 'pandan', x: 1150 } ],
    exit: ['このさき', 'あかつち谷'],
    decor: [ { k: 'bush', x: 140 }, { k: 'tree', x: 360 }, { k: 'bush', x: 540 }, { k: 'tree', x: 760 }, { k: 'bush', x: 930 }, { k: 'tree', x: 1100 } ],
  },
  {
    // ★ provisional stage
    id: 'tani', name: 'あかつち谷', width: 1400, theme: 'canyon', bench: 700,
    spawns: [ { sp: 'ressan', x: 260 }, { sp: 'wankon', x: 440 }, { sp: 'nyankon', x: 620 }, { sp: 'ressan', x: 880 }, { sp: 'pandan', x: 1060 }, { sp: 'pengiin', x: 1220 } ],
    exit: ['このさき', 'じゅんびちゅう'],
    decor: [ { k: 'bush', x: 180 }, { k: 'bush', x: 520 }, { k: 'bush', x: 960 }, { k: 'bush', x: 1300 } ],
  },
];
// shop items (price in coins). use: heal = HP of the walking companion, healAll = everyone full, recruit = next なかまにする +
const ITEMS = {
  kizu:   { name: 'きずぐすり',       price: 20, desc: 'つれている こ の HPを 25 かいふく', use: 'heal', amt: 25 },
  genki:  { name: 'げんきドリンク',   price: 60, desc: 'なかま みんなの HPを ぜんぶ かいふく', use: 'healAll' },
  cookie: { name: 'なかよしクッキー', price: 40, desc: 'つぎの なかまにする が +20%', use: 'recruit', amt: 0.2 },
};
const SHOP_LIST = ['kizu', 'genki', 'cookie'];
// road props by ドット絵作成くん (32x32, bottom outline on row 30; road = 32x8 tile for screen rows 64..71)
const PROP_IMGS = {
  town_road: 'assets/town/town_road.png', town_fence: 'assets/town/town_fence.png', town_flowerbed: 'assets/town/town_flowerbed.png', town_lamp: 'assets/town/town_lamp.png', town_tree: 'assets/town/town_tree.png',
  wmap: 'assets/worldmap/worldmap.png', wseg0: 'assets/worldmap/worldmap_path_seg0.png', wseg1: 'assets/worldmap/worldmap_path_seg1.png', wseg2: 'assets/worldmap/worldmap_path_seg2.png', wseg3: 'assets/worldmap/worldmap_path_seg3.png', wseg4: 'assets/worldmap/worldmap_path_seg4.png', wseg5: 'assets/worldmap/worldmap_path_seg5.png', wseg6: 'assets/worldmap/worldmap_path_seg6.png',
  bld_shop: 'assets/town/shop.png', bld_clinic: 'assets/town/hospital.png', bld_house: 'assets/town/grandma_house.png',
  tree: 'assets/props/street_tree.png', fence: 'assets/props/fence.png', signpost: 'assets/props/signpost.png',
  ui_frame: 'assets/ui/ui_frame_9slice.png', ui_rowbar: 'assets/ui/ui_row_highlight_9slice.png', ui_cursor: 'assets/ui/ui_cursor_anim.png',
  bench: 'assets/props/bench.png', bush: 'assets/props/bush.png', lamp: 'assets/props/streetlamp.png', road: 'assets/props/road.png',
};
// world map nodes (160x90 screen; the bottom 18 rows are covered by the text box). stage = index into STAGES, or null = not made yet
// order on the map: 5 field stages -> town (STAGES[5]) -> stages beyond it. stage = index into STAGES
const MAP_NODES = [
  { x: 12,  y: 62, stage: 0 },
  { x: 32,  y: 46, stage: 1 },
  { x: 52,  y: 60, stage: 2 },
  { x: 72,  y: 44, stage: 3 },
  { x: 92,  y: 58, stage: 4 },
  { x: 110, y: 40, stage: 5 },
  { x: 130, y: 54, stage: 6 },
  { x: 148, y: 34, stage: 7 },
];

let WORLD_W = STAGES[0].width;   // current stage width (set by enterStage)

// hero = gender + color (title screen). Color swaps the cap/hoodie/shoes ramp at load time (keeps each pixel's lightness)
const HERO_GENDERS = [
  { key: 'player',    name: 'おとこのこ', ramp: ['#4d72d0', '#4263b9', '#38529d', '#31447f'], base: '#4d72d0', def: 0 },
  { key: 'hero_girl', name: 'おんなのこ', ramp: ['#f6bee2', '#f96ab4', '#d8529c', '#c54385', '#8a2c66'], base: '#f96ab4', def: 5 },
];
const HERO_COLORS = [
  { name: 'あお', c: '#4d72d0' }, { name: 'あか', c: '#d8473a' }, { name: 'みどり', c: '#47a83a' }, { name: 'きいろ', c: '#e6b02a' },
  { name: 'むらさき', c: '#8656cc' }, { name: 'ピンク', c: '#f96ab4' }, { name: 'オレンジ', c: '#ec7f2c' }, { name: 'くろ', c: '#4a4a5a' },
];
