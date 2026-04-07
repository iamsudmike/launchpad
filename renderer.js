'use strict';
const Renderer = {
  ctx: null,
  W: 800,
  H: 480,

  init(canvas) {
    this.ctx = canvas.getContext('2d');
  },

  // ── Background ────────────────────────────────────────────────────────────
  drawBackground(camX, bgTop, bgBot) {
    const ctx = this.ctx;
    const grad = ctx.createLinearGradient(0, 0, 0, this.H);
    grad.addColorStop(0, bgTop);
    grad.addColorStop(1, bgBot);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.W, this.H);

    // Parallax pillars (scroll at 0.35× camera)
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    for (let i = 0; i < 14; i++) {
      const px = ((i * 170 - camX * 0.35) % (14 * 170) + 14 * 170) % (14 * 170);
      if (px < this.W + 60) ctx.fillRect(px, 40, 28, this.H - 80);
    }
  },

  // ── Tiles ─────────────────────────────────────────────────────────────────
  drawTiles(map, camX, solidColor, solidAccent, platformColor) {
    const ctx = this.ctx;
    const T = 32;
    const sx0 = Math.max(0, Math.floor(camX / T));
    const sx1 = Math.min(map.width - 1, Math.ceil((camX + this.W) / T));

    for (let ty = 0; ty < map.height; ty++) {
      for (let tx = sx0; tx <= sx1; tx++) {
        const tile = map.get(tx, ty);
        if (!tile) continue;
        const sx = tx * T - camX, sy = ty * T;

        if (tile === 1) {
          ctx.fillStyle = solidColor;
          ctx.fillRect(sx, sy, T, T);
          ctx.fillStyle = solidAccent;
          ctx.fillRect(sx + 2, sy + 2, T - 4, T - 4);
          ctx.fillStyle = 'rgba(255,255,255,0.07)';
          ctx.fillRect(sx, sy, T, 2);
          ctx.fillRect(sx, sy, 2, T);
          ctx.fillStyle = 'rgba(0,0,0,0.15)';
          ctx.fillRect(sx, sy + T - 2, T, 2);
          ctx.fillRect(sx + T - 2, sy, 2, T);
        } else if (tile === 2) {
          ctx.fillStyle = platformColor;
          ctx.fillRect(sx, sy, T, 10);
          ctx.fillStyle = 'rgba(255,255,255,0.18)';
          ctx.fillRect(sx, sy, T, 3);
        }
      }
    }
  },

  // ── Player ────────────────────────────────────────────────────────────────
  drawPlayer(player, camX, frame) {
    const ctx = this.ctx;
    if (player.invincible && Math.floor(frame / 3) % 2 === 1) return;

    const px = Math.floor(player.x - camX);
    const py = Math.floor(player.y);
    const f  = player.facing;

    ctx.save();
    if (!f) { ctx.translate(px + player.w, py); ctx.scale(-1, 1); }
    else    { ctx.translate(px, py); }

    const walk = player.onGround && Math.abs(player.vx) > 0.5;
    const af   = walk ? (Math.floor(frame / 7) % 2) : 0;

    // Legs
    ctx.fillStyle = '#1a3a6b';
    ctx.fillRect(2, 18, 5, af === 0 ? 10 : 13);
    ctx.fillRect(8, 18, 5, af === 0 ? 10 : 8);
    // Boots
    ctx.fillStyle = '#5a3010';
    ctx.fillRect(1, af === 0 ? 25 : 28, 6, 3);
    ctx.fillRect(7, af === 0 ? 25 : 23, 6, 3);
    // Body
    ctx.fillStyle = '#336699';
    ctx.fillRect(2, 8, 11, 11);
    // Shoulder
    ctx.fillStyle = '#4477AA';
    ctx.fillRect(1, 8, 3, 5);
    // Belt
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(2, 17, 11, 2);
    // Head
    ctx.fillStyle = '#FFCC99';
    ctx.fillRect(4, 1, 7, 8);
    // Hair
    ctx.fillStyle = '#5a3010';
    ctx.fillRect(4, 1, 7, 3);
    ctx.fillRect(4, 1, 2, 7);
    // Eye + white
    ctx.fillStyle = '#fff';
    ctx.fillRect(8, 5, 3, 2);
    ctx.fillStyle = '#222';
    ctx.fillRect(9, 5, 2, 2);

    // Weapon
    const w = WEAPONS[player.weaponId];
    ctx.fillStyle = '#555';
    ctx.fillRect(12, 11, 3, 3);
    ctx.fillStyle = w.color;
    if (player.weaponId === 0) {
      ctx.fillRect(14, 11, 5, 2);
    } else if (player.weaponId === 1) {
      ctx.fillRect(13, 10, 7, 4);
    } else if (player.weaponId === 2) {
      ctx.fillStyle = '#444';
      ctx.fillRect(12, 10, 4, 5);
      ctx.fillStyle = w.color;
      ctx.fillRect(15, 11, 7, 2);
    } else if (player.weaponId === 3) {
      ctx.fillStyle = '#555';
      ctx.fillRect(11, 9, 5, 6);
      ctx.fillStyle = w.color;
      ctx.fillRect(15, 10, 5, 4);
    }

    ctx.restore();
  },

  // ── Enemies ───────────────────────────────────────────────────────────────
  drawEnemy(e, camX, frame) {
    if (e.type === 'walker')  this._drawWalker(e, camX, frame);
    else if (e.type === 'flyer')   this._drawFlyer(e, camX, frame);
    else                           this._drawShooter(e, camX, frame);
  },

  _drawWalker(e, camX, frame) {
    const ctx = this.ctx;
    const px = Math.floor(e.x - camX), py = Math.floor(e.y);
    if (px < -60 || px > this.W + 60) return;
    ctx.save();
    if (!e.facing) { ctx.translate(px + e.w, py); ctx.scale(-1, 1); }
    else ctx.translate(px, py);

    const af = Math.floor(frame / 8) % 2;
    ctx.fillStyle = '#800000';
    ctx.fillRect(2, 16, 7, af === 0 ? 8 : 10);
    ctx.fillRect(13, 16, 7, af === 0 ? 8 : 6);
    ctx.fillStyle = '#CC2200';
    ctx.fillRect(2, 4, 18, 14);
    ctx.fillStyle = '#DD4400';
    ctx.fillRect(4, 6, 14, 4);
    ctx.fillRect(4, 12, 14, 3);
    ctx.fillStyle = '#CC2200';
    ctx.fillRect(5, 0, 12, 8);
    ctx.fillStyle = '#FFAA00';
    ctx.fillRect(7, 2, 3, 3);
    ctx.fillRect(13, 2, 3, 3);
    ctx.fillStyle = '#FF2200';
    ctx.fillRect(8, 3, 2, 2);
    ctx.fillRect(14, 3, 2, 2);
    this._hpBar(ctx, e.hp, e.maxHp, 0, -6, e.w);
    ctx.restore();
  },

  _drawFlyer(e, camX, frame) {
    const ctx = this.ctx;
    const px = Math.floor(e.x - camX), py = Math.floor(e.y);
    if (px < -80 || px > this.W + 80) return;
    ctx.save();
    if (!e.facing) { ctx.translate(px + e.w, py); ctx.scale(-1, 1); }
    else ctx.translate(px, py);

    const wf = Math.floor(frame / 5) % 4;
    const wingY = wf < 2 ? 0 : 4;
    ctx.fillStyle = '#7700CC';
    ctx.fillRect(0, wingY, 8, 12 - wingY);
    ctx.fillRect(20, wingY, 8, 12 - wingY);
    ctx.fillStyle = '#9900EE';
    ctx.fillRect(7, 4, 14, 12);
    ctx.fillStyle = '#CC44FF';
    ctx.fillRect(10, 7, 8, 6);
    ctx.fillStyle = '#9900EE';
    ctx.fillRect(10, 0, 8, 6);
    ctx.fillStyle = '#00FFFF';
    ctx.fillRect(11, 1, 2, 3);
    ctx.fillRect(15, 1, 2, 3);
    this._hpBar(ctx, e.hp, e.maxHp, 0, -6, e.w);
    ctx.restore();
  },

  _drawShooter(e, camX, frame) {
    const ctx = this.ctx;
    const px = Math.floor(e.x - camX), py = Math.floor(e.y);
    if (px < -60 || px > this.W + 60) return;
    ctx.save();
    if (!e.facing) { ctx.translate(px + e.w, py); ctx.scale(-1, 1); }
    else ctx.translate(px, py);

    ctx.fillStyle = '#0055AA';
    ctx.fillRect(2, 6, 16, 20);
    ctx.fillStyle = '#0077CC';
    ctx.fillRect(4, 8, 12, 8);
    ctx.fillStyle = '#003388';
    ctx.fillRect(4, 0, 12, 8);
    ctx.fillStyle = '#FFCC99';
    ctx.fillRect(6, 2, 8, 5);
    ctx.fillStyle = '#00AAFF';
    ctx.fillRect(6, 2, 8, 3);
    ctx.fillStyle = '#444';
    ctx.fillRect(16, 10, 4, 4);
    ctx.fillStyle = '#FF8800';
    ctx.fillRect(18, 11, 8, 2);
    this._hpBar(ctx, e.hp, e.maxHp, 0, -6, e.w);
    ctx.restore();
  },

  // ── Bosses ────────────────────────────────────────────────────────────────
  drawBoss(boss, camX, frame) {
    const ctx = this.ctx;
    const px = Math.floor(boss.x - camX);
    const py = Math.floor(boss.y);

    if (boss.type === 1) this._drawBoss1(ctx, boss, px, py, frame);
    else if (boss.type === 2) this._drawBoss2(ctx, boss, px, py, frame);
    else this._drawBoss3(ctx, boss, px, py, frame);

    // Boss HP bar at bottom
    const bw = 400, bx = (this.W - bw) / 2, by = this.H - 30;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(bx - 4, by - 14, bw + 8, 24);
    ctx.fillStyle = '#660000';
    ctx.fillRect(bx, by - 10, bw, 14);
    ctx.fillStyle = '#CC0000';
    ctx.fillRect(bx, by - 10, bw * Math.max(0, boss.hp / boss.maxHp), 14);
    ctx.fillStyle = '#FF4444';
    ctx.fillRect(bx, by - 10, bw * Math.max(0, boss.hp / boss.maxHp) * 0.55, 6);
    ctx.fillStyle = '#fff';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(boss.name, this.W / 2, by - 12);
    ctx.textAlign = 'left';
  },

  _drawBoss1(ctx, boss, px, py, frame) {
    const pulse = Math.floor(frame / 8) % 2;
    const af    = Math.floor(frame / 10) % 2;
    ctx.save();
    if (!boss.facing) { ctx.translate(px + boss.w, py); ctx.scale(-1, 1); }
    else ctx.translate(px, py);

    ctx.fillStyle = '#660000';
    ctx.fillRect(4, 40, 16, af === 0 ? 16 : 20);
    ctx.fillRect(26, 40, 16, af === 0 ? 16 : 12);
    ctx.fillStyle = '#440000';
    ctx.fillRect(2, 54, 20, 6);
    ctx.fillRect(24, 54, 20, 6);
    ctx.fillStyle = '#AA0000';
    ctx.fillRect(4, 12, 38, 30);
    ctx.fillStyle = '#CC1100';
    ctx.fillRect(8, 16, 30, 10);
    ctx.fillStyle = '#881100';
    ctx.fillRect(20, 12, 6, 30);
    ctx.fillStyle = '#FF4400';
    for (let i = 0; i < 3; i++) ctx.fillRect(6 + i * 14, 10, 8, 6);
    ctx.fillStyle = '#880000';
    ctx.fillRect(8, 0, 30, 14);
    ctx.fillStyle = pulse === 0 ? '#FF8800' : '#FFFF00';
    ctx.fillRect(12, 3, 8, 7);
    ctx.fillRect(26, 3, 8, 7);
    ctx.fillStyle = '#FF2200';
    ctx.fillRect(14, 5, 4, 4);
    ctx.fillRect(28, 5, 4, 4);
    ctx.fillStyle = '#FF0000';
    ctx.fillRect(12, 10, 22, 3);
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 4; i++) ctx.fillRect(14 + i * 5, 10, 3, 3);
    ctx.restore();
  },

  _drawBoss2(ctx, boss, px, py, frame) {
    const angle = frame * 0.05;
    ctx.save();
    ctx.translate(px + boss.w / 2, py + boss.h / 2);

    // Rotating arms
    for (let a = 0; a < 2; a++) {
      ctx.save();
      ctx.rotate(angle + a * Math.PI);
      ctx.fillStyle = '#555';
      ctx.fillRect(0, -4, 36, 8);
      ctx.fillStyle = '#FF4400';
      ctx.fillRect(32, -3, 12, 6);
      ctx.restore();
    }
    // Body
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath(); ctx.arc(0, 0, 24, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#333';
    ctx.beginPath(); ctx.arc(0, 0, 20, 0, Math.PI * 2); ctx.fill();
    const pulse = Math.sin(frame * 0.1) * 4;
    ctx.fillStyle = boss.phase >= 2 ? '#FF4400' : '#00AAFF';
    ctx.beginPath(); ctx.arc(0, 0, 10 + pulse, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();

    if (boss.shielded) {
      ctx.strokeStyle = `rgba(0,200,255,${0.5 + Math.sin(frame * 0.15) * 0.3})`;
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(0, 0, 32, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  },

  _drawBoss3(ctx, boss, px, py, frame) {
    ctx.save();
    ctx.translate(px, py);

    // Tentacles
    ctx.fillStyle = boss.phase >= 3 ? '#660066' : '#440044';
    for (let i = 0; i < 4; i++) {
      const ty = 50 + Math.sin(frame * 0.08 + i) * 8;
      ctx.fillRect(4 + i * 15, ty, 10, 16);
    }
    // Body
    ctx.fillStyle = boss.phase >= 2 ? '#220033' : '#330044';
    ctx.fillRect(6, 10, 52, 46);
    ctx.fillStyle = '#440066';
    ctx.fillRect(10, 14, 44, 20);
    // Shield aura
    if (boss.shielded) {
      ctx.fillStyle = `rgba(150,0,255,${0.15 + Math.sin(frame * 0.1) * 0.1})`;
      ctx.fillRect(2, 6, 60, 54);
      ctx.strokeStyle = `rgba(200,0,255,0.6)`;
      ctx.lineWidth = 3;
      ctx.strokeRect(2, 6, 60, 54);
    }
    // Core orb
    const pulse = Math.floor(frame / 6) % 2;
    ctx.fillStyle = boss.phase >= 3 ? '#FF00FF' : (boss.phase >= 2 ? '#AA00FF' : '#6600CC');
    ctx.beginPath(); ctx.arc(32, 30, 14 + pulse * 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = pulse === 0 ? '#FF88FF' : '#FFFFFF';
    ctx.beginPath(); ctx.arc(32, 30, 6, 0, Math.PI * 2); ctx.fill();
    // Eyes
    ctx.fillStyle = '#FF0000';
    ctx.fillRect(14, 16, 8, 6);
    ctx.fillRect(42, 16, 8, 6);
    ctx.fillStyle = '#FFFF00';
    ctx.fillRect(16, 17, 4, 4);
    ctx.fillRect(44, 17, 4, 4);
    // Crown
    ctx.fillStyle = '#220033';
    ctx.fillRect(10, 2, 44, 12);
    ctx.fillStyle = '#660099';
    for (let i = 0; i < 5; i++) ctx.fillRect(10 + i * 10, 0, 6, 6);
    ctx.restore();
  },

  // ── Bullet ────────────────────────────────────────────────────────────────
  drawBullet(b, camX) {
    const ctx = this.ctx;
    const bx = b.x - camX, by = b.y;
    if (bx < -20 || bx > this.W + 20) return;

    if (b.isRocket) {
      ctx.save();
      ctx.translate(bx + b.w / 2, by + b.h / 2);
      ctx.rotate(Math.atan2(b.vy, b.vx));
      ctx.fillStyle = '#555';
      ctx.fillRect(-6, -3, 12, 6);
      ctx.fillStyle = '#FF2200';
      ctx.fillRect(-10, -2, 5, 4);
      ctx.fillStyle = '#FF8800';
      ctx.fillRect(-14, -1, 5, 2);
      ctx.restore();
    } else {
      ctx.fillStyle = b.color;
      const bw = b.isBig ? 9 : 7, bh = b.isBig ? 5 : 3;
      ctx.fillRect(bx, by, bw, bh);
      // Trail
      ctx.fillStyle = b.fromPlayer ? 'rgba(255,220,50,0.25)' : 'rgba(255,100,0,0.25)';
      ctx.fillRect(bx - (b.vx > 0 ? 8 : -8), by, 7, bh);
    }
  },

  // ── Pickup ────────────────────────────────────────────────────────────────
  drawPickup(p, camX) {
    const ctx = this.ctx;
    const px = Math.floor(p.x - camX);
    const py = Math.floor(p.y);
    if (px < -40 || px > this.W + 40) return;

    const bob = Math.sin(Date.now() * 0.003) * 3;
    ctx.save();
    ctx.translate(px, py + bob);

    if (p.type === 'health') {
      ctx.fillStyle = '#CC1111';
      ctx.fillRect(0, 0, p.w, p.h);
      ctx.fillStyle = '#FF3333';
      ctx.fillRect(2, 2, p.w - 4, p.h - 4);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(8, 4, 4, 12);
      ctx.fillRect(4, 8, 12, 4);
    } else if (p.type === 'ammo') {
      ctx.fillStyle = '#665500';
      ctx.fillRect(0, 0, p.w, p.h);
      ctx.fillStyle = '#FFCC00';
      for (let i = 0; i < 3; i++) ctx.fillRect(4 + i * 5, 5, 3, 10);
    } else {
      const w = WEAPONS[p.weaponId];
      ctx.fillStyle = '#111122';
      ctx.fillRect(0, 0, p.w, p.h);
      ctx.fillStyle = w.color;
      ctx.fillRect(3, 8, p.w - 6, 5);
      ctx.fillRect(12, 5, 5, 10);
    }

    ctx.restore();

    // Label
    ctx.fillStyle = '#fff';
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(p.label, px + p.w / 2, py + bob - 3);
    ctx.textAlign = 'left';
  },

  // ── HUD ───────────────────────────────────────────────────────────────────
  drawHUD(player, lives, score, level, boss) {
    const ctx = this.ctx;

    // HP bar
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(8, 8, 154, 18);
    ctx.fillStyle = '#660000';
    ctx.fillRect(10, 10, 150, 14);
    const hpFrac = Math.max(0, player.hp / player.maxHp);
    ctx.fillStyle = hpFrac > 0.5 ? '#22CC22' : (hpFrac > 0.25 ? '#CCAA00' : '#CC2200');
    ctx.fillRect(10, 10, 150 * hpFrac, 14);
    ctx.fillStyle = '#fff';
    ctx.font = '10px monospace';
    ctx.fillText(`HP ${player.hp}/${player.maxHp}`, 12, 21);

    // Lives
    ctx.fillStyle = '#FF8888';
    ctx.font = '12px monospace';
    ctx.fillText(`♥ × ${lives}`, 10, 42);

    // Score
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 14px monospace';
    ctx.fillText(`Score: ${score}`, this.W / 2, 22);
    ctx.fillStyle = '#AAD4FF';
    ctx.font = '11px monospace';
    ctx.fillText(`Level ${level + 1}`, this.W / 2, 38);

    // Weapon panel
    ctx.textAlign = 'right';
    const w = WEAPONS[player.weaponId];
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(this.W - 174, 6, 168, 46);
    ctx.fillStyle = w.color;
    ctx.font = 'bold 13px monospace';
    ctx.fillText(w.name, this.W - 10, 22);
    ctx.fillStyle = '#aaa';
    ctx.font = '11px monospace';
    const ammoStr = player.ammo[player.weaponId] === Infinity ? '∞' : player.ammo[player.weaponId];
    ctx.fillText(`Ammo: ${ammoStr}`, this.W - 10, 38);

    // Weapon slots
    for (let i = 0; i < 4; i++) {
      if (!player.hasWeapon[i]) continue;
      const wx = this.W - 170 + i * 41;
      ctx.fillStyle = i === player.weaponId ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.05)';
      ctx.fillRect(wx, 8, 37, 20);
      ctx.fillStyle = WEAPONS[i].color;
      ctx.font = '9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`[${i + 1}]`, wx + 18, 21);
    }
    ctx.textAlign = 'left';
  },

  // ── Screens ───────────────────────────────────────────────────────────────
  drawMenu(frame) {
    const ctx = this.ctx;
    const grad = ctx.createLinearGradient(0, 0, 0, this.H);
    grad.addColorStop(0, '#06061a');
    grad.addColorStop(1, '#1a061a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.W, this.H);

    // Stars
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    for (let i = 0; i < 60; i++) {
      ctx.fillRect((i * 157.3) % this.W, (i * 83.7) % (this.H - 100), i % 3 === 0 ? 2 : 1, i % 3 === 0 ? 2 : 1);
    }

    ctx.textAlign = 'center';
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 54px monospace';
    ctx.shadowBlur = 22; ctx.shadowColor = '#FF8800';
    ctx.fillText("DAVE'S QUEST", this.W / 2, 145);
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#FF6644';
    ctx.font = '17px monospace';
    ctx.fillText('A SIDE-SCROLLING SHOOTER', this.W / 2, 180);

    if (Math.floor(frame / 28) % 2 === 0) {
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 20px monospace';
      ctx.fillText('PRESS SPACE TO START', this.W / 2, 255);
    }

    ctx.fillStyle = '#888';
    ctx.font = '13px monospace';
    ctx.fillText('A/D or ←/→ : Move     W/↑/Space : Jump', this.W / 2, 318);
    ctx.fillText('Z / X / F  : Shoot    1-4 : Switch Weapon', this.W / 2, 338);

    ctx.fillStyle = '#AAD4FF';
    ctx.font = '12px monospace';
    ctx.fillText('3 Levels  ·  3 Bosses  ·  4 Weapons  ·  3 Enemy Types', this.W / 2, 388);
    ctx.textAlign = 'left';
  },

  drawGameOver(score) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(0, 0, this.W, this.H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FF2222';
    ctx.font = 'bold 52px monospace';
    ctx.shadowBlur = 22; ctx.shadowColor = '#FF0000';
    ctx.fillText('GAME OVER', this.W / 2, 200);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#FFD700';
    ctx.font = '22px monospace';
    ctx.fillText(`Final Score: ${score}`, this.W / 2, 262);
    ctx.fillStyle = '#fff';
    ctx.font = '15px monospace';
    ctx.fillText('Press SPACE to return to menu', this.W / 2, 318);
    ctx.textAlign = 'left';
  },

  drawLevelComplete(level, score) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(0, 0, this.W, this.H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#00FF88';
    ctx.font = 'bold 42px monospace';
    ctx.shadowBlur = 22; ctx.shadowColor = '#00FF88';
    ctx.fillText('LEVEL COMPLETE!', this.W / 2, 196);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#FFD700';
    ctx.font = '22px monospace';
    ctx.fillText(`Score: ${score}`, this.W / 2, 256);
    ctx.fillStyle = '#fff';
    ctx.font = '14px monospace';
    ctx.fillText(`Level ${level + 2} incoming...  Press SPACE to continue`, this.W / 2, 318);
    ctx.textAlign = 'left';
  },

  drawVictory(score) {
    const ctx = this.ctx;
    const grad = ctx.createLinearGradient(0, 0, 0, this.H);
    grad.addColorStop(0, '#001100'); grad.addColorStop(1, '#002200');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, this.W, this.H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 50px monospace';
    ctx.shadowBlur = 25; ctx.shadowColor = '#FFD700';
    ctx.fillText('YOU WIN!', this.W / 2, 176);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#00FF88';
    ctx.font = '22px monospace';
    ctx.fillText('Dave saved the world!', this.W / 2, 238);
    ctx.fillStyle = '#FFD700';
    ctx.font = '22px monospace';
    ctx.fillText(`Final Score: ${score}`, this.W / 2, 288);
    ctx.fillStyle = '#fff';
    ctx.font = '15px monospace';
    ctx.fillText('Press SPACE to play again', this.W / 2, 348);
    ctx.textAlign = 'left';
  },

  // ── Helper ────────────────────────────────────────────────────────────────
  _hpBar(ctx, hp, maxHp, ox, oy, w) {
    ctx.fillStyle = '#333';
    ctx.fillRect(ox, oy, w, 4);
    ctx.fillStyle = hp / maxHp > 0.5 ? '#00CC00' : (hp / maxHp > 0.25 ? '#CCAA00' : '#CC2200');
    ctx.fillRect(ox, oy, w * Math.max(0, hp / maxHp), 4);
  },
};
