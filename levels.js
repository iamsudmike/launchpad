'use strict';

// ── TileMap ───────────────────────────────────────────────────────────────
class TileMap {
  constructor(tiles) {
    this.tiles = tiles; // 2D array [row][col]
    this.height = tiles.length;
    this.width  = tiles[0].length;
  }
  get(tx, ty) {
    if (tx < 0 || tx >= this.width || ty < 0 || ty >= this.height) return 1;
    return this.tiles[ty][tx];
  }
  isSolid(tx, ty)    { return this.get(tx, ty) === 1; }
  isPlatform(tx, ty) { return this.get(tx, ty) === 2; }
}

// ── Helpers ───────────────────────────────────────────────────────────────
function fillRow(t, row, x1, x2, v) {
  for (let x = x1; x <= x2; x++) if (x >= 0 && x < t[0].length) t[row][x] = v;
}
function fillCol(t, col, y1, y2, v) {
  for (let y = y1; y <= y2; y++) if (y >= 0 && y < t.length) t[y][col] = v;
}

// ── Level builders ────────────────────────────────────────────────────────
function buildLevel1() {
  const W = 80, H = 15;
  const t = Array.from({length: H}, () => new Array(W).fill(0));

  // Ceiling + floor + walls
  fillRow(t, 0, 0, W - 1, 1);
  fillRow(t, H - 1, 0, W - 1, 1);
  fillCol(t, 0, 0, H - 1, 1);
  fillCol(t, W - 1, 0, H - 1, 1);

  // Ground segments (row 13) with gaps
  fillRow(t, 13, 1,  9,  1);
  fillRow(t, 13, 13, 20, 1);
  fillRow(t, 13, 24, 31, 1);
  fillRow(t, 13, 35, 42, 1);
  fillRow(t, 13, 46, 53, 1);
  fillRow(t, 13, 57, 61, 1);
  // Boss arena — solid floor
  fillRow(t, 13, 62, 78, 1);

  // Mid platforms (solid, row 10)
  fillRow(t, 10, 5,  11, 1);
  fillRow(t, 10, 19, 25, 1);
  fillRow(t, 10, 33, 39, 1);
  fillRow(t, 10, 48, 54, 1);

  // High one-way platforms (row 7)
  fillRow(t, 7, 13, 18, 2);
  fillRow(t, 7, 27, 32, 2);
  fillRow(t, 7, 43, 48, 2);
  fillRow(t, 7, 58, 62, 2);

  // Boss arena platforms
  fillRow(t, 8, 66, 72, 2);
  fillRow(t, 5, 70, 76, 2);

  return t;
}

function buildLevel2() {
  const W = 80, H = 15;
  const t = Array.from({length: H}, () => new Array(W).fill(0));

  fillRow(t, 0, 0, W - 1, 1);
  fillRow(t, H - 1, 0, W - 1, 1);
  fillCol(t, 0, 0, H - 1, 1);
  fillCol(t, W - 1, 0, H - 1, 1);

  // Ground (tighter gaps)
  fillRow(t, 13, 1,  6,  1);
  fillRow(t, 13, 10, 16, 1);
  fillRow(t, 13, 20, 26, 1);
  fillRow(t, 13, 30, 36, 1);
  fillRow(t, 13, 39, 45, 1);
  fillRow(t, 13, 49, 55, 1);
  fillRow(t, 13, 58, 61, 1);
  fillRow(t, 13, 62, 78, 1);

  // Lower solid ledges (row 11)
  fillRow(t, 11, 7,  12, 1);
  fillRow(t, 11, 17, 22, 1);
  fillRow(t, 11, 27, 32, 1);
  fillRow(t, 11, 36, 41, 1);
  fillRow(t, 11, 46, 51, 1);

  // Mid platforms (row 9, one-way)
  fillRow(t, 9, 4,  9,  2);
  fillRow(t, 9, 15, 20, 2);
  fillRow(t, 9, 25, 30, 2);
  fillRow(t, 9, 35, 40, 2);
  fillRow(t, 9, 52, 57, 2);

  // High platforms (row 6, one-way)
  fillRow(t, 6, 10, 15, 2);
  fillRow(t, 6, 23, 28, 2);
  fillRow(t, 6, 43, 49, 2);
  fillRow(t, 6, 59, 63, 2);

  // Solid pillars
  fillCol(t, 20, 9, 13, 1);
  fillCol(t, 41, 9, 13, 1);

  // Boss arena
  fillRow(t, 8, 66, 72, 1);
  fillRow(t, 5, 63, 70, 2);

  return t;
}

function buildLevel3() {
  const W = 80, H = 15;
  const t = Array.from({length: H}, () => new Array(W).fill(0));

  fillRow(t, 0, 0, W - 1, 1);
  fillRow(t, H - 1, 0, W - 1, 1);
  fillCol(t, 0, 0, H - 1, 1);
  fillCol(t, W - 1, 0, H - 1, 1);

  // Challenging ground (many gaps)
  fillRow(t, 13, 1,  5,  1);
  fillRow(t, 13, 9,  12, 1);
  fillRow(t, 13, 16, 19, 1);
  fillRow(t, 13, 23, 26, 1);
  fillRow(t, 13, 30, 33, 1);
  fillRow(t, 13, 37, 41, 1);
  fillRow(t, 13, 45, 48, 1);
  fillRow(t, 13, 52, 55, 1);
  fillRow(t, 13, 59, 61, 1);
  fillRow(t, 13, 62, 78, 1);

  // Stagger platforms (row 11, solid)
  fillRow(t, 11, 6,  10, 1);
  fillRow(t, 11, 13, 17, 1);
  fillRow(t, 11, 20, 24, 1);
  fillRow(t, 11, 34, 38, 1);
  fillRow(t, 11, 49, 53, 1);

  // Mid platforms (row 9)
  fillRow(t, 9, 3,   8,  2);
  fillRow(t, 9, 19,  24, 2);
  fillRow(t, 9, 33,  38, 2);
  fillRow(t, 9, 48,  53, 2);

  // High platforms (row 7)
  fillRow(t, 7, 11, 16, 2);
  fillRow(t, 7, 27, 32, 2);
  fillRow(t, 7, 42, 47, 2);
  fillRow(t, 7, 56, 61, 2);

  // Very high (row 4-5)
  fillRow(t, 5, 7,  12, 2);
  fillRow(t, 5, 23, 28, 2);
  fillRow(t, 5, 43, 48, 2);
  fillRow(t, 4, 15, 20, 2);
  fillRow(t, 4, 35, 40, 2);

  // Pillars
  fillCol(t, 28, 8, 13, 1);
  fillCol(t, 51, 8, 13, 1);

  // Boss arena
  fillRow(t, 9, 64, 70, 2);
  fillRow(t, 6, 68, 74, 2);

  return t;
}

// ── Level definitions ─────────────────────────────────────────────────────
const LEVELS = [
  {
    name: 'Level 1: The Dungeon',
    bgTop: '#0a0a1e', bgBot: '#1a0a2e',
    solidColor: '#5a4a3a', solidAccent: '#4a3a2a', platformColor: '#7B5E3C',
    tiles: buildLevel1(),
    startX: 2, startY: 12,
    enemies: [
      {type:'walker',  x:6,  y:12}, {type:'walker',  x:15, y:12},
      {type:'walker',  x:25, y:12}, {type:'walker',  x:36, y:12},
      {type:'walker',  x:47, y:12}, {type:'walker',  x:55, y:12},
      {type:'walker',  x:8,  y:9},  {type:'walker',  x:22, y:9},
      {type:'flyer',   x:16, y:4},  {type:'flyer',   x:32, y:4},
      {type:'flyer',   x:50, y:4},
    ],
    pickups: [
      {type:'health', x:10, y:12},
      {type:'weapon', x:21, y:12, wid:1},
      {type:'health', x:35, y:12},
      {type:'ammo',   x:44, y:12},
      {type:'weapon', x:52, y:12, wid:2},
      {type:'health', x:60, y:12},
    ],
    bossTriggerX: 62,
    bossSpawnX: 72, bossSpawnY: 11,
  },
  {
    name: 'Level 2: The Factory',
    bgTop: '#080d16', bgBot: '#101820',
    solidColor: '#404040', solidAccent: '#303030', platformColor: '#4a6a2a',
    tiles: buildLevel2(),
    startX: 2, startY: 12,
    enemies: [
      {type:'walker',  x:8,  y:12}, {type:'walker',  x:18, y:12},
      {type:'walker',  x:28, y:12}, {type:'walker',  x:38, y:12},
      {type:'walker',  x:49, y:12}, {type:'walker',  x:57, y:12},
      {type:'shooter', x:11, y:10}, {type:'shooter', x:25, y:10},
      {type:'shooter', x:42, y:10}, {type:'shooter', x:57, y:10},
      {type:'flyer',   x:14, y:3},  {type:'flyer',   x:30, y:3},
      {type:'flyer',   x:48, y:3},  {type:'flyer',   x:60, y:3},
    ],
    pickups: [
      {type:'health', x:6,  y:12},
      {type:'ammo',   x:15, y:12},
      {type:'weapon', x:23, y:12, wid:3},
      {type:'health', x:33, y:12},
      {type:'ammo',   x:43, y:12},
      {type:'health', x:55, y:12},
    ],
    bossTriggerX: 62,
    bossSpawnX: 68, bossSpawnY: 8,
  },
  {
    name: 'Level 3: The Fortress',
    bgTop: '#0d0010', bgBot: '#1a0020',
    solidColor: '#2a1a3a', solidAccent: '#1a0a2a', platformColor: '#5a2a7a',
    tiles: buildLevel3(),
    startX: 2, startY: 12,
    enemies: [
      {type:'walker',  x:6,  y:12}, {type:'walker',  x:10, y:12},
      {type:'walker',  x:17, y:12}, {type:'walker',  x:24, y:12},
      {type:'walker',  x:31, y:12}, {type:'walker',  x:38, y:12},
      {type:'walker',  x:46, y:12}, {type:'walker',  x:53, y:12},
      {type:'shooter', x:13, y:10}, {type:'shooter', x:22, y:10},
      {type:'shooter', x:36, y:10}, {type:'shooter', x:50, y:10},
      {type:'shooter', x:58, y:10},
      {type:'flyer',   x:14, y:3},  {type:'flyer',   x:26, y:3},
      {type:'flyer',   x:40, y:3},  {type:'flyer',   x:54, y:3},
    ],
    pickups: [
      {type:'health', x:4,  y:12},
      {type:'ammo',   x:11, y:12},
      {type:'health', x:18, y:12},
      {type:'ammo',   x:25, y:12},
      {type:'health', x:33, y:12},
      {type:'ammo',   x:43, y:12},
      {type:'health', x:50, y:12},
      {type:'ammo',   x:57, y:12},
    ],
    bossTriggerX: 62,
    bossSpawnX: 68, bossSpawnY: 11,
  },
];
