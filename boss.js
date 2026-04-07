'use strict';

// ── Boss 1 — THE CRUSHER (ground brute) ──────────────────────────────────
class Boss1 {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.w = 46; this.h = 56;
    this.vx = 0; this.vy = 0;
    this.onGround = false;
    this.facing = false;
    this.hp = 400; this.maxHp = 400;
    this.dead = false;
    this.type = 1;
    this.name = 'THE CRUSHER';
    this.phase = 1;
    this.actionTimer = 60;
    this.action = 'idle';
    this.chargeDir = -1;
    this.shielded = false;
  }

  hitbox() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }

  update(dt, player, bullets) {
    if (this.hp < this.maxHp * 0.5 && this.phase === 1) this.phase = 2;

    this.vy += GRAVITY * dt;
    if (this.vy > 14) this.vy = 14;

    const dx = player.x + player.w / 2 - (this.x + this.w / 2);
    this.facing = dx > 0;
    this.actionTimer -= dt;

    if (this.action === 'idle') {
      this.vx *= 0.85;
      if (this.actionTimer <= 0) {
        const r = Math.random();
        const speed = this.phase >= 2 ? 5.5 : 3.5;
        if (r < 0.45) {
          this.action = 'charge';
          this.chargeDir = dx > 0 ? 1 : -1;
          this.actionTimer = this.phase >= 2 ? 60 : 80;
        } else if (r < 0.7 && this.onGround) {
          this.vy = this.phase >= 2 ? -14 : -12;
          this.vx = dx > 0 ? 2.5 : -2.5;
          this.action = 'jump';
          this.actionTimer = 100;
        } else {
          this.actionTimer = 45;
        }
      }
    } else if (this.action === 'charge') {
      this.vx = this.chargeDir * (this.phase >= 2 ? 5.5 : 3.8);
      if (this.actionTimer <= 0) { this.action = 'idle'; this.actionTimer = 65; }
    } else if (this.action === 'jump') {
      if (this.onGround && this.actionTimer < 85) {
        // Stomp landing
        if (Math.abs(dx) < 160) player.takeDamage(20);
        this.action = 'idle'; this.actionTimer = 50;
      }
      if (this.actionTimer <= 0) { this.action = 'idle'; this.actionTimer = 50; }
    }

    moveAndCollide(this, map);
    if (!player.invincible && rectsOverlap(this, player)) player.takeDamage(18);
  }

  takeDamage(n) { this.hp -= n; if (this.hp <= 0) { this.hp = 0; this.dead = true; } }
}

// ── Boss 2 — TARGETING SYSTEM (flying turret) ─────────────────────────────
class Boss2 {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.w = 48; this.h = 48;
    this.vx = 0; this.vy = 0;
    this.onGround = false;
    this.facing = false;
    this.hp = 600; this.maxHp = 600;
    this.dead = false;
    this.type = 2;
    this.name = 'TARGETING SYSTEM';
    this.phase = 1;
    this.shielded = false;
    this.orbitAngle = 0;
    this.centerX = x + this.w / 2;
    this.centerY = y - 60;
    this.fireTimer = 80;
    this._shieldCycle = 0;
  }

  hitbox() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }

  update(dt, player, bullets) {
    if (this.hp < this.maxHp * 0.6 && this.phase === 1) { this.phase = 2; this.shielded = true; }
    if (this.hp < this.maxHp * 0.3 && this.phase === 2) { this.phase = 3; this.shielded = false; }

    const orbitSpd = this.phase >= 2 ? 0.038 : 0.024;
    this.orbitAngle += orbitSpd * dt;

    // Drift center toward player
    this.centerX += (player.x + player.w / 2 - this.centerX) * 0.006 * dt;
    this.centerY += (player.y - 120 - this.centerY) * 0.004 * dt;
    this.centerY = Math.max(80, Math.min(this.centerY, 280));

    const radius = 150;
    this.x = this.centerX + Math.cos(this.orbitAngle) * radius - this.w / 2;
    this.y = this.centerY + Math.sin(this.orbitAngle) * radius * 0.45 - this.h / 2;
    this.x = Math.max(TILE, Math.min(this.x, map.width * TILE - TILE - this.w));

    this.facing = player.x > this.x;

    // Shield cycles in phase 2
    if (this.phase === 2) {
      this._shieldCycle += dt;
      this.shielded = (Math.floor(this._shieldCycle / 90) % 2 === 0);
    }

    // Fire
    this.fireTimer -= dt;
    const fireRate = this.phase >= 3 ? 28 : (this.phase >= 2 ? 55 : 85);
    if (this.fireTimer <= 0 && !this.shielded) {
      this.fireTimer = fireRate;
      const angle = Math.atan2(player.y - this.y, player.x - this.x);
      const spd = this.phase >= 2 ? 5.5 : 3.8;

      if (this.phase >= 3) {
        // Triple spread
        for (let s = -1; s <= 1; s++) {
          bullets.push(new Bullet(
            this.x + this.w / 2, this.y + this.h / 2,
            Math.cos(angle + s * 0.2) * spd, Math.sin(angle + s * 0.2) * spd,
            { dmg: 11, color: '#FF4400', explosive: false, exr: 0 }, false
          ));
        }
      } else {
        bullets.push(new Bullet(
          this.x + this.w / 2, this.y + this.h / 2,
          Math.cos(angle) * spd, Math.sin(angle) * spd,
          { dmg: 10, color: '#FF4400', explosive: false, exr: 0 }, false
        ));
      }
    }

    if (!player.invincible && rectsOverlap(this, player)) player.takeDamage(20);
  }

  takeDamage(n) {
    if (this.shielded) n = Math.max(1, Math.floor(n * 0.08));
    this.hp -= n;
    if (this.hp <= 0) { this.hp = 0; this.dead = true; }
  }
}

// ── Boss 3 — THE DARK ONE (final boss) ───────────────────────────────────
class Boss3 {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.w = 64; this.h = 64;
    this.vx = 0; this.vy = 0;
    this.onGround = false;
    this.facing = false;
    this.hp = 900; this.maxHp = 900;
    this.dead = false;
    this.type = 3;
    this.name = 'THE DARK ONE';
    this.phase = 1;
    this.shielded = false;
    this.actionTimer = 90;
    this.action = 'idle';
    this.fireTimer = 60;
    this._shieldCycle = 0;
  }

  hitbox() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }

  update(dt, player, bullets) {
    if (this.hp < this.maxHp * 0.6 && this.phase === 1) { this.phase = 2; this.shielded = true; }
    if (this.hp < this.maxHp * 0.3 && this.phase === 2) { this.phase = 3; this.shielded = false; }

    // Shield cycles in phase 2
    if (this.phase === 2) {
      this._shieldCycle += dt;
      this.shielded = (Math.floor(this._shieldCycle / 80) % 2 === 0);
    }

    this.vy += GRAVITY * dt;
    if (this.vy > 14) this.vy = 14;

    const dx = player.x + player.w / 2 - (this.x + this.w / 2);
    this.facing = dx > 0;
    this.actionTimer -= dt;

    if (this.action === 'idle') {
      // Drift toward player
      this.vx += (dx > 0 ? 1 : -1) * 0.08 * dt;
      this.vx = Math.max(-2.5, Math.min(2.5, this.vx));
      if (this.actionTimer <= 0) {
        const r = Math.random();
        if (r < 0.4) {
          this.action = 'dash';
          this.vx = (this.facing ? 1 : -1) * (this.phase >= 3 ? 7 : 5);
          this.actionTimer = 45;
        } else if (r < 0.65 && this.onGround) {
          this.vy = -12;
          this.actionTimer = 75;
        } else {
          this.actionTimer = 55;
        }
      }
    } else if (this.action === 'dash') {
      if (this.actionTimer <= 0) { this.action = 'idle'; this.actionTimer = 80; this.vx *= 0.25; }
    }

    moveAndCollide(this, map);

    // Fire
    this.fireTimer -= dt;
    const fireRate = this.phase >= 3 ? 22 : (this.phase >= 2 ? 38 : 58);
    if (this.fireTimer <= 0 && !this.shielded) {
      this.fireTimer = fireRate;
      const angle = Math.atan2(player.y - this.y, player.x - this.x);

      if (this.phase >= 3) {
        for (let i = -2; i <= 2; i++) {
          bullets.push(new Bullet(
            this.x + this.w / 2, this.y + this.h / 2,
            Math.cos(angle + i * 0.2) * 4.5, Math.sin(angle + i * 0.2) * 4.5,
            { dmg: 14, color: '#FF00FF', explosive: false, exr: 0 }, false
          ));
        }
      } else if (this.phase >= 2) {
        for (const s of [-0.18, 0.18]) {
          bullets.push(new Bullet(
            this.x + this.w / 2, this.y + this.h / 2,
            Math.cos(angle + s) * 4, Math.sin(angle + s) * 4,
            { dmg: 12, color: '#AA00FF', explosive: false, exr: 0 }, false
          ));
        }
      } else {
        bullets.push(new Bullet(
          this.x + this.w / 2, this.y + this.h / 2,
          Math.cos(angle) * 3.5, Math.sin(angle) * 3.5,
          { dmg: 10, color: '#8800CC', explosive: false, exr: 0 }, false
        ));
      }
    }

    if (!player.invincible && rectsOverlap(this, player)) player.takeDamage(25);
  }

  takeDamage(n) {
    if (this.shielded) n = Math.max(1, Math.floor(n * 0.05));
    this.hp -= n;
    if (this.hp <= 0) { this.hp = 0; this.dead = true; }
  }
}
