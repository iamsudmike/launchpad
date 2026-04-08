'use strict';

// ── Bullet ────────────────────────────────────────────────────────────────
class Bullet {
  constructor(x, y, vx, vy, weapon, fromPlayer) {
    this.x = x - 3;
    this.y = y - 2;
    this.w = weapon.explosive ? 8 : 6;
    this.h = weapon.explosive ? 8 : 3;
    this.vx = vx;
    this.vy = vy;
    this.weapon = weapon;
    this.damage = weapon.dmg;
    this.fromPlayer = fromPlayer;
    this.color = weapon.color;
    this.isRocket = !!weapon.explosive;
    this.isBig = weapon.id === 1;
    this.dead = false;
    this.life = 130;
  }

  update(dt, map) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.isRocket) this.vy += 0.08 * dt;
    this.life -= dt;
    if (this.life <= 0) { this.dead = true; return; }

    // Tile collision
    const T = TILE;
    const cx = Math.floor((this.x + this.w / 2) / T);
    const cy = Math.floor((this.y + this.h / 2) / T);
    if (map.isSolid(cx, cy)) { this.dead = true; return; }

    // Out of level bounds
    if (this.x < -80 || this.x > map.width * T + 80 || this.y < -80 || this.y > map.height * T + 80) {
      this.dead = true;
    }
  }
}

// ── Pickup ────────────────────────────────────────────────────────────────
class Pickup {
  constructor(type, x, y, weaponId) {
    this.type = type;
    this.x = x;
    this.y = y;
    this.w = 20;
    this.h = 20;
    this.collected = false;
    this.weaponId = weaponId;

    if (type === 'health') {
      this.label = 'HP+30';
    } else if (type === 'ammo') {
      this.label = 'AMMO';
    } else {
      this.label = WEAPONS[weaponId].name;
    }
  }

  collect(player) {
    this.collected = true;
    if (this.type === 'health') {
      player.addHealth(30);
    } else if (this.type === 'ammo') {
      player.addAmmo(20);
    } else {
      player.pickupWeapon(this.weaponId, WEAPONS[this.weaponId].maxAmmo);
    }
  }
}

// ── Walker ────────────────────────────────────────────────────────────────
class Walker {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.w = 22; this.h = 24;
    this.vx = 0; this.vy = 0;
    this.onGround = false;
    this.facing = true;
    this.hp = 30; this.maxHp = 30;
    this.dead = false;
    this.scoreValue = 100;
    this.type = 'walker';
    this.chargeTimer = 0;
  }

  update(dt, player, bullets, map) {
    this.vy += GRAVITY * dt;
    if (this.vy > 14) this.vy = 14;

    // Gradually ramp up aggressiveness over ~8 seconds after level load
    const diff   = Math.min(1.0, levelTimer / 480);
    const aggro  = 0.35 + 0.65 * diff; // 35% → 100%

    const dx    = player.x + player.w / 2 - (this.x + this.w / 2);
    const distX = Math.abs(dx);
    const distY = Math.abs(player.y - this.y);

    if (distX < 300 && distY < 64) {
      this.facing = dx > 0;
      const speed = (distX < 120 ? 2.0 : 1.2) * aggro;
      this.vx = (this.facing ? 1 : -1) * speed;
    } else {
      this.vx = (this.facing ? 1 : -1) * 0.8 * aggro;
    }

    // Charge every ~3 s when close — only after difficulty ramps up a bit
    this.chargeTimer -= dt;
    if (this.chargeTimer <= 0 && distX < 180 * aggro && distY < 40 && diff > 0.55) {
      this.chargeTimer = 180;
      this.vx = (dx > 0 ? 1 : -1) * 5.5 * aggro;
    }

    const prevVx = this.vx;
    moveAndCollide(this, map);

    // Ledge + wall detection: look ahead proportional to current speed
    if (this.onGround) {
      const T        = TILE;
      const peekDist = Math.max(6, Math.abs(this.vx) * 4);
      const frontX   = this.facing ? this.x + this.w + peekDist : this.x - peekDist;
      const belowTX  = Math.floor(frontX / T);
      const belowTY  = Math.floor((this.y + this.h + 4) / T);
      if (!map.isSolid(belowTX, belowTY) && !map.isPlatform(belowTX, belowTY)) {
        this.facing      = !this.facing;
        this.vx         *= -0.6;           // reverse and dampen
        this.chargeTimer = Math.max(this.chargeTimer, 90); // cancel any in-progress charge
      }
    }
    if (this.vx === 0 && Math.abs(prevVx) > 0.5) this.facing = !this.facing;

    // If somehow fell into a bottomless pit, remove cleanly
    if (this.y > map.height * TILE + 32) { this.dead = true; return; }

    // Contact damage
    if (!player.invincible && rectsOverlap(this, player)) player.takeDamage(12);
  }

  takeDamage(n) {
    this.hp -= n;
    if (this.hp <= 0) { this.hp = 0; this.dead = true; Sound.enemyDie(); }
    else Sound.enemyHit();
  }
}

// ── Flyer ─────────────────────────────────────────────────────────────────
class Flyer {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.w = 28; this.h = 18;
    this.vx = 0; this.vy = 0;
    this.onGround = false;
    this.facing = true;
    this.baseY = y;
    this.phase = Math.random() * Math.PI * 2;
    this.hp = 20; this.maxHp = 20;
    this.dead = false;
    this.scoreValue = 150;
    this.type = 'flyer';
    this.fireTimer = 120 + Math.random() * 60;
    this.diveTimer = 0;
    this.diving = false;
    this.diveVy = 0;
  }

  update(dt, player, bullets, map) {
    const diff  = Math.min(1.0, levelTimer / 480);
    const aggro = 0.35 + 0.65 * diff;

    const dx    = player.x + player.w / 2 - (this.x + this.w / 2);
    const distX = Math.abs(dx);
    this.facing = dx > 0;

    if (this.diving) {
      this.vy += 0.35 * dt;
      this.vx = (dx > 0 ? 1 : -1) * 4 * aggro;
      this.diveTimer -= dt;
      if (this.diveTimer <= 0 || this.y > this.baseY + 160) {
        this.diving = false;
        this.vy = -3;
      }
    } else {
      this.phase += 0.038 * dt;
      this.y = this.baseY + Math.sin(this.phase) * 38;
      this.vx = (dx > 0 ? 1 : -1) * (distX < 300 ? 1.5 : 0.8) * aggro;

      // Dive occasionally when close — only after ramp-up
      if (distX < 80 && diff > 0.5 && Math.random() < 0.004 * dt) {
        this.diving = true;
        this.diveTimer = 55;
        this.vy = 2;
      }
    }

    this.x += this.vx * dt;
    if (this.diving) this.y += this.vy * dt;

    // Keep in bounds
    this.x = Math.max(TILE, Math.min(this.x, map.width * TILE - TILE - this.w));

    // Fire at player — fire rate scales with difficulty
    this.fireTimer -= dt;
    const fireInterval = (160 - 50 * diff) + Math.random() * 30;
    if (this.fireTimer <= 0 && distX < 320 * aggro) {
      this.fireTimer = fireInterval;
      const angle = Math.atan2(player.y - this.y, player.x - this.x);
      bullets.push(new Bullet(
        this.x + this.w / 2, this.y + this.h / 2,
        Math.cos(angle) * 3.5, Math.sin(angle) * 3.5,
        { dmg: 8, color: '#FF4400', explosive: false, exr: 0 }, false
      ));
    }

    if (!player.invincible && rectsOverlap(this, player)) player.takeDamage(8);
  }

  takeDamage(n) {
    this.hp -= n;
    if (this.hp <= 0) { this.hp = 0; this.dead = true; Sound.enemyDie(); }
    else Sound.enemyHit();
  }
}

// ── Shooter ───────────────────────────────────────────────────────────────
class Shooter {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.w = 20; this.h = 28;
    this.vx = 0; this.vy = 0;
    this.onGround = false;
    this.facing = true;
    this.hp = 40; this.maxHp = 40;
    this.dead = false;
    this.scoreValue = 200;
    this.type = 'shooter';
    this.fireTimer = 90 + Math.random() * 60;
  }

  update(dt, player, bullets, map) {
    this.vy += GRAVITY * dt;
    if (this.vy > 14) this.vy = 14;
    this.vx = 0;
    moveAndCollide(this, map);

    // If fell into a pit, remove cleanly
    if (this.y > map.height * TILE + 32) { this.dead = true; return; }

    const diff  = Math.min(1.0, levelTimer / 480);
    const aggro = 0.35 + 0.65 * diff;

    const dx = player.x + player.w / 2 - (this.x + this.w / 2);
    this.facing = dx > 0;

    this.fireTimer -= dt;
    const fireInterval = (130 - 40 * diff) + Math.random() * 20;
    if (this.fireTimer <= 0 && Math.abs(dx) < 320 * aggro) {
      this.fireTimer = fireInterval;
      const dy   = player.y + player.h / 2 - (this.y + this.h / 2);
      const dist = Math.hypot(dx, dy) || 1;
      const spd  = 4.5;
      bullets.push(new Bullet(
        this.x + (this.facing ? this.w + 2 : -4), this.y + 14,
        (dx / dist) * spd, (dy / dist) * spd,
        { dmg: 10, color: '#FF8800', explosive: false, exr: 0 }, false
      ));
    }

    if (!player.invincible && rectsOverlap(this, player)) player.takeDamage(15);
  }

  takeDamage(n) {
    this.hp -= n;
    if (this.hp <= 0) { this.hp = 0; this.dead = true; Sound.enemyDie(); }
    else Sound.enemyHit();
  }
}
