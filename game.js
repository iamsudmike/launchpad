'use strict';

// ── Constants ─────────────────────────────────────────────────────────────
const CANVAS_W = 800;
const CANVAS_H = 480;
const TILE     = 32;
const GRAVITY  = 0.45;

// ── Globals ───────────────────────────────────────────────────────────────
let canvas, ctx;
let gameState = 'menu'; // menu | playing | boss | levelComplete | gameOver | victory
let currentLevel = 0;
let score  = 0;
let lives  = 3;
let frame  = 0;
let lastTs = 0;

let player, map, enemies, bullets, pickups, boss, explosions;
let camera = {x: 0};
let bossTriggered = false;
let transTimer = 0;  // countdown for level-complete screen

// ── Bootstrap ─────────────────────────────────────────────────────────────
function init() {
  canvas = document.getElementById('c');
  Renderer.init(canvas);
  Input.init();
  requestAnimationFrame(loop);
}

function loadLevel(idx) {
  const lvl = LEVELS[idx];
  map      = new TileMap(lvl.tiles);
  player   = new Player(lvl.startX * TILE, lvl.startY * TILE);
  enemies  = lvl.enemies.map(e => makeEnemy(e.type, e.x * TILE, e.y * TILE));
  pickups  = lvl.pickups.map(p =>
    p.type === 'weapon'
      ? new Pickup('weapon', p.x * TILE, p.y * TILE, p.wid)
      : new Pickup(p.type,   p.x * TILE, p.y * TILE)
  );
  bullets    = [];
  explosions = [];
  boss           = null;
  bossTriggered  = false;
  camera         = {x: 0};
}

function makeEnemy(type, x, y) {
  if (type === 'walker')  return new Walker(x, y);
  if (type === 'flyer')   return new Flyer(x, y);
  if (type === 'shooter') return new Shooter(x, y);
}

function makeBoss(idx, x, y) {
  if (idx === 0) return new Boss1(x, y);
  if (idx === 1) return new Boss2(x, y);
  return new Boss3(x, y);
}

// ── Main loop ─────────────────────────────────────────────────────────────
function loop(ts) {
  const raw = ts - lastTs;
  const dt  = Math.min(raw > 0 ? raw / (1000 / 60) : 1, 3);
  lastTs = ts;
  frame++;

  update(dt);
  render();
  Input.flush();
  requestAnimationFrame(loop);
}

// ── Update ────────────────────────────────────────────────────────────────
function update(dt) {
  switch (gameState) {
    case 'menu':
      if (Input.pressed('Space') || Input.pressed('KeyZ') || Input.pressed('Enter')) {
        score = 0; lives = 3; currentLevel = 0;
        loadLevel(0);
        gameState = 'playing';
      }
      break;

    case 'playing':
    case 'boss':
      updateGame(dt);
      break;

    case 'levelComplete':
      transTimer -= dt;
      if (transTimer <= 0 || Input.pressed('Space') || Input.pressed('KeyZ')) {
        currentLevel++;
        loadLevel(currentLevel);
        gameState = 'playing';
      }
      break;

    case 'gameOver':
    case 'victory':
      if (Input.pressed('Space') || Input.pressed('KeyZ') || Input.pressed('Enter')) {
        gameState = 'menu';
      }
      break;
  }
}

function updateGame(dt) {
  const lvl = LEVELS[currentLevel];

  player.update(dt, map, bullets);

  // Boss trigger
  if (!bossTriggered && player.x + player.w >= lvl.bossTriggerX * TILE) {
    bossTriggered = true;
    gameState = 'boss';
    boss = makeBoss(currentLevel, lvl.bossSpawnX * TILE, lvl.bossSpawnY * TILE);
  }

  // Boss
  if (boss && !boss.dead) {
    boss.update(dt, player, bullets);
    if (boss.dead) {
      score += 1000 * (currentLevel + 1);
      pickups.push(new Pickup('health', boss.x + 10, boss.y));
      pickups.push(new Pickup('health', boss.x + 40, boss.y));
      gameState = currentLevel >= LEVELS.length - 1 ? 'victory' : 'levelComplete';
      transTimer = 200;
    }
  }

  // Enemies
  for (let i = enemies.length - 1; i >= 0; i--) {
    enemies[i].update(dt, player, bullets, map);
    if (enemies[i].dead) { score += enemies[i].scoreValue; enemies.splice(i, 1); }
  }

  // Bullets
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.update(dt, map);
    if (b.dead) { bullets.splice(i, 1); continue; }

    if (b.fromPlayer) {
      let hit = false;
      for (const e of enemies) {
        if (!hit && !e.dead && rectsOverlap(b, e)) {
          e.takeDamage(b.damage);
          if (b.weapon?.explosive) explode(b.x + b.w / 2, b.y + b.h / 2, b.weapon.exr, b.damage, true);
          b.dead = hit = true;
        }
      }
      if (!hit && boss && !boss.dead && rectsOverlap(b, boss.hitbox())) {
        boss.takeDamage(b.damage);
        if (b.weapon?.explosive) explode(b.x + b.w / 2, b.y + b.h / 2, b.weapon.exr, b.damage, true);
        b.dead = true;
      }
    } else {
      if (!player.invincible && rectsOverlap(b, player)) {
        player.takeDamage(b.damage);
        b.dead = true;
      }
    }
  }
  bullets = bullets.filter(b => !b.dead);

  // Explosions
  for (let i = explosions.length - 1; i >= 0; i--) {
    explosions[i].timer -= dt;
    if (explosions[i].timer <= 0) explosions.splice(i, 1);
  }

  // Pickups
  for (let i = pickups.length - 1; i >= 0; i--) {
    if (!pickups[i].collected && rectsOverlap(pickups[i], player)) pickups[i].collect(player);
    if (pickups[i].collected) pickups.splice(i, 1);
  }

  // Death
  if (player.hp <= 0) {
    if (--lives <= 0) { gameState = 'gameOver'; }
    else { loadLevel(currentLevel); }
    return;
  }

  // Camera
  const levelW = map.width * TILE;
  const target = player.x + player.w / 2 - CANVAS_W / 2;
  camera.x += (target - camera.x) * 0.12;
  camera.x = Math.max(0, Math.min(camera.x, levelW - CANVAS_W));
}

// ── Explosion AOE ─────────────────────────────────────────────────────────
function explode(cx, cy, radius, dmg, fromPlayer) {
  explosions.push({ x: cx, y: cy, r: 0, maxR: radius, timer: 22, maxTimer: 22 });

  if (fromPlayer) {
    enemies.forEach(e => {
      if (Math.hypot(e.x + e.w / 2 - cx, e.y + e.h / 2 - cy) < radius) {
        e.takeDamage(dmg);
        if (e.dead) score += e.scoreValue;
      }
    });
    if (boss && !boss.dead && Math.hypot(boss.x + boss.w / 2 - cx, boss.y + boss.h / 2 - cy) < radius) {
      boss.takeDamage(dmg);
    }
  } else {
    if (!player.invincible && Math.hypot(player.x + player.w / 2 - cx, player.y + player.h / 2 - cy) < radius) {
      player.takeDamage(dmg);
    }
  }
}

// ── Collision helpers ─────────────────────────────────────────────────────
function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x &&
         a.y < b.y + b.h && a.y + a.h > b.y;
}

function moveAndCollide(e, map) {
  const T = TILE;
  const prevY = e.y;

  // Horizontal
  e.x += e.vx;
  {
    const top = Math.floor(e.y / T);
    const bot = Math.floor((e.y + e.h - 1) / T);
    if (e.vx < 0) {
      const lx = Math.floor(e.x / T);
      for (let ty = top; ty <= bot; ty++) {
        if (map.isSolid(lx, ty)) { e.x = (lx + 1) * T; e.vx = 0; break; }
      }
    } else if (e.vx > 0) {
      const rx = Math.floor((e.x + e.w - 1) / T);
      for (let ty = top; ty <= bot; ty++) {
        if (map.isSolid(rx, ty)) { e.x = rx * T - e.w; e.vx = 0; break; }
      }
    }
  }

  // Vertical
  e.y += e.vy;
  e.onGround = false;
  {
    const lx = Math.floor(e.x / T);
    const rx = Math.floor((e.x + e.w - 1) / T);
    if (e.vy < 0) {
      const ty = Math.floor(e.y / T);
      for (let tx = lx; tx <= rx; tx++) {
        if (map.isSolid(tx, ty)) { e.y = (ty + 1) * T; e.vy = 0; break; }
      }
    } else if (e.vy >= 0) {
      const ty     = Math.floor((e.y + e.h - 1) / T);
      const prevBot = prevY + e.h;
      const platTop = ty * T;
      for (let tx = lx; tx <= rx; tx++) {
        if (map.isSolid(tx, ty)) {
          e.y = ty * T - e.h; e.vy = 0; e.onGround = true; break;
        }
        if (map.isPlatform(tx, ty) && prevBot <= platTop + 2) {
          e.y = platTop - e.h; e.vy = 0; e.onGround = true; break;
        }
      }
    }
  }
}

// ── Render ────────────────────────────────────────────────────────────────
function render() {
  switch (gameState) {
    case 'menu':
      Renderer.drawMenu(frame);
      break;

    case 'playing':
    case 'boss':
      renderGame();
      break;

    case 'levelComplete':
      renderGame();
      Renderer.drawLevelComplete(currentLevel, score);
      break;

    case 'gameOver':
      renderGame();
      Renderer.drawGameOver(score);
      break;

    case 'victory':
      Renderer.drawVictory(score);
      break;
  }
}

function renderGame() {
  const cam = camera.x;
  const lvl = LEVELS[currentLevel];

  Renderer.drawBackground(cam, lvl.bgTop, lvl.bgBot);
  Renderer.drawTiles(map, cam, lvl.solidColor, lvl.solidAccent, lvl.platformColor);

  // Boss gate (wall behind player when boss fight starts)
  if (bossTriggered) {
    const gx = lvl.bossTriggerX * TILE - TILE - cam;
    const ctx = Renderer.ctx;
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(gx, 0, TILE, CANVAS_H);
    ctx.fillStyle = '#FF2200';
    ctx.fillRect(gx, 0, 4, CANVAS_H);
    ctx.fillRect(gx + TILE - 4, 0, 4, CANVAS_H);
  }

  pickups.forEach(p => Renderer.drawPickup(p, cam));
  enemies.forEach(e => Renderer.drawEnemy(e, cam, frame));
  if (boss && !boss.dead) Renderer.drawBoss(boss, cam, frame);
  Renderer.drawPlayer(player, cam, frame);
  bullets.forEach(b => Renderer.drawBullet(b, cam));

  // Explosions
  const ctx = Renderer.ctx;
  explosions.forEach(ex => {
    const t  = 1 - ex.timer / ex.maxTimer;
    const r  = ex.maxR * Math.sqrt(t);
    const bx = ex.x - cam;
    ctx.save();
    ctx.globalAlpha = (1 - t) * 0.9;
    ctx.fillStyle   = t < 0.35 ? '#FFEE44' : '#FF5500';
    ctx.beginPath(); ctx.arc(bx, ex.y, r, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = (1 - t) * 0.45;
    ctx.fillStyle   = '#FF2200';
    ctx.beginPath(); ctx.arc(bx, ex.y, r * 0.55, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  });

  Renderer.drawHUD(player, lives, score, currentLevel, boss);
}

window.addEventListener('load', init);
