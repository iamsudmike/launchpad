'use strict';
class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.w = 14;
    this.h = 28;
    this.vx = 0;
    this.vy = 0;
    this.onGround = false;
    this.facing = true; // true = right

    this.hp = 100;
    this.maxHp = 100;
    this.invincible = false;
    this.invTimer = 0;

    this.weaponId = 0;
    this.hasWeapon = [true, false, false, false];
    this.ammo = [Infinity, 0, 0, 0];
    this.fireCooldown = 0;
    this.coyoteTime = 0;
  }

  update(dt, map, bullets) {
    // Weapon switch via digit keys
    const digit = Input.digit();
    if (digit >= 0 && digit < 4 && this.hasWeapon[digit]) {
      this.weaponId = digit;
    }

    // Horizontal movement
    if (Input.left()) {
      this.vx = -3.5;
      this.facing = false;
    } else if (Input.right()) {
      this.vx = 3.5;
      this.facing = true;
    } else {
      this.vx *= 0.72;
      if (Math.abs(this.vx) < 0.1) this.vx = 0;
    }

    // Coyote time
    if (this.onGround) this.coyoteTime = 7;
    else if (this.coyoteTime > 0) this.coyoteTime -= dt;

    // Jump
    if (Input.jumpPressed() && this.coyoteTime > 0) {
      this.vy = -11;
      this.coyoteTime = 0;
    }
    // Variable jump height
    if (!Input.jump() && this.vy < -4) this.vy = -4;

    // Gravity
    this.vy += GRAVITY * dt;
    if (this.vy > 14) this.vy = 14;

    moveAndCollide(this, map);

    // Shooting
    if (this.fireCooldown > 0) this.fireCooldown -= dt * (1000 / 60);
    if (Input.shoot() && this.fireCooldown <= 0) this._shoot(bullets);

    // Invincibility countdown
    if (this.invincible) {
      this.invTimer -= dt;
      if (this.invTimer <= 0) this.invincible = false;
    }
  }

  _shoot(bullets) {
    const w = WEAPONS[this.weaponId];
    if (w.maxAmmo !== Infinity && this.ammo[this.weaponId] <= 0) {
      this.weaponId = 0; // fall back to pistol
      return;
    }
    this.fireCooldown = w.rate;
    if (w.maxAmmo !== Infinity) {
      this.ammo[this.weaponId] = Math.max(0, this.ammo[this.weaponId] - 1); // 1 per blast, regardless of pellet count
    }

    const dir = this.facing ? 1 : -1;
    const bx  = this.x + (this.facing ? this.w + 2 : -6);
    const by  = this.y + 11;

    if (w.explosive)      Sound.shootRocket();
    else if (w.id === 1)  Sound.shootBig();
    else                  Sound.shoot();

    for (let i = 0; i < w.cnt; i++) {
      const angle = (i - (w.cnt - 1) / 2) * w.spread;
      bullets.push(new Bullet(bx, by, dir * w.spd * Math.cos(angle), w.spd * Math.sin(angle), w, true));
    }
  }

  takeDamage(amount) {
    if (this.invincible) return;
    this.hp = Math.max(0, this.hp - amount);
    this.invincible = true;
    this.invTimer = 90;
    Sound.playerHurt();
  }

  pickupWeapon(id, ammoAmt) {
    this.hasWeapon[id] = true;
    if (WEAPONS[id].maxAmmo !== Infinity) {
      this.ammo[id] = Math.min((this.ammo[id] || 0) + ammoAmt, WEAPONS[id].maxAmmo * 2);
    }
    this.weaponId = id;
    Sound.pickup();
  }

  addHealth(amount) {
    this.hp = Math.min(this.maxHp, this.hp + amount);
    Sound.pickup();
  }

  addAmmo(amount) {
    for (let i = 1; i < 4; i++) {
      if (this.hasWeapon[i] && WEAPONS[i].maxAmmo !== Infinity) {
        this.ammo[i] = Math.min(this.ammo[i] + amount, WEAPONS[i].maxAmmo * 2);
      }
    }
  }
}
