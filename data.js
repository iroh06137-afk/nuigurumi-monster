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
      // rival = the gender the player didn't pick (default colors). resolved in enterStage
      { id: 'rival', x: 120, rival: {
          girl: { name: 'ユイ', look: 'girl', battle: { sp: 'kitsunen', mul: 1.2, reward: 50 },
            lines: [['あっ {NAME}も ぬいぐるみと たびしてるの？', 'わたしの キツネンと しょうぶよ！']],
            after: [['くやしい… {NAME} つよいね', 'おみせで どうぐも そろえておきなよ']] },
          boy: { name: 'ハルト', look: 'player', battle: { sp: 'kitsunen', mul: 1.2, reward: 50 },
            lines: [['よう {NAME}！ ぬいぐるみと たびしてるのか', 'おれの キツネンと しょうぶだ！']],
            after: [['くっそー… {NAME} やるな！', 'おみせで どうぐも そろえておけよ']] } } },
      { id: 'sota', x: 310, name: 'むしとりの ソウタ', look: 'mushitori', battle: { sp: 'kaerun', mul: 1.15, reward: 40 },
        lines: [['おっ その ぬいぐるみ つよそう！', 'ぼくの カエルンと しょうぶだ！']],
        after: [['まけたー！', 'もっと きたえて くるよ']] },
      { id: 'reika', x: 520, name: 'おねえさん レイカ', look: 'oneesan',
        lines: [['かった どうぐは {BAG}で', 'いつでも つかえるわ'], ['ひとの ぬいぐるみは', 'なかまに できないから きをつけてね']] },
      { id: 'akane', x: 680, name: 'からてかの アカネ', look: 'karate', battle: { sp: 'usagin', mul: 1.3, reward: 60 },
        lines: [['おす！ しゅぎょう ちゅうだ！', 'うでだめし していけ！']],
        after: [['みごとだ…', 'また しゅぎょうして くる！']] },
      { id: 'daichi', x: 980, name: 'ガキだいしょう ダイチ', look: 'gaki', battle: { sp: 'tanukin', mul: 1.5, reward: 100 },
        lines: [['この まちで いちばん つよいのは', 'おれさまの タヌキンだ！'], ['まちを でる まえに', 'おれと しょうぶ しろ！']],
        after: [['ちぇっ… おまえ つよいな', 'さきへ いっていいぞ']] },
    ],
    decor: [ { k: 'lamp', x: 60 }, { k: 'tree', x: 160 }, { k: 'lamp', x: 270 }, { k: 'bush', x: 360 }, { k: 'tree', x: 475 }, { k: 'lamp', x: 580 },
             { k: 'bush', x: 740 }, { k: 'lamp', x: 900 }, { k: 'tree', x: 1060 }, { k: 'lamp', x: 1120 } ],
  },
  {
    // ★ provisional stage after the town (species / boss to be decided)
    id: 'kogen', name: 'わたぐも高原', width: 1300, theme: 'highland', bench: 640,
    spawns: [ { sp: 'usagin', x: 260 }, { sp: 'fukuron', x: 430 }, { sp: 'kaerun', x: 600 }, { sp: 'tanukin', x: 820 }, { sp: 'kitsunen', x: 1000 }, { sp: 'tsumaguro', x: 1150 } ],
    exit: ['このさき', 'あかつち谷'],
    decor: [ { k: 'bush', x: 140 }, { k: 'tree', x: 360 }, { k: 'bush', x: 540 }, { k: 'tree', x: 760 }, { k: 'bush', x: 930 }, { k: 'tree', x: 1100 } ],
  },
  {
    // ★ provisional stage
    id: 'tani', name: 'あかつち谷', width: 1400, theme: 'canyon', bench: 700,
    spawns: [ { sp: 'tanukin', x: 260 }, { sp: 'kitsunen', x: 440 }, { sp: 'tsumaguro', x: 620 }, { sp: 'fukuron', x: 880 }, { sp: 'usagin', x: 1060 }, { sp: 'kaerun', x: 1220 } ],
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
