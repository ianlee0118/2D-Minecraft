import { TILE_SIZE, WORLD_WIDTH, WORLD_HEIGHT } from '../constants.js';
import { BLOCK_AIR } from '../blocks.js';
import { BUM_POOP_DAMAGE, BUM_POOP_COOLDOWN, BUM_POOP_SPEED, BUM_POOP_GRAVITY } from './BrownUnderwearMode.js';
import { soundManager } from '../audio/SoundManager.js';

export class PoopAttack {
  constructor(scene) {
    this.scene = scene;
    this.cooldown = 0;
    this.projectiles = [];
  }

  update(delta) {
    const dt = delta / 1000;
    if (this.cooldown > 0) this.cooldown -= dt;

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      if (!p.sprite?.active) { this.projectiles.splice(i, 1); continue; }

      p.vy += BUM_POOP_GRAVITY * dt;
      p.sprite.x += p.vx * dt;
      p.sprite.y += p.vy * dt;
      p.sprite.rotation += dt * 6 * (p.vx > 0 ? 1 : -1);
      p.life += dt;

      if (p.life > 4) {
        p.sprite.destroy(); this.projectiles.splice(i, 1); continue;
      }

      const tx = Math.floor(p.sprite.x / TILE_SIZE);
      const ty = Math.floor(p.sprite.y / TILE_SIZE);
      if (tx < 0 || tx >= WORLD_WIDTH || ty < 0 || ty >= WORLD_HEIGHT) {
        p.sprite.destroy(); this.projectiles.splice(i, 1); continue;
      }
      if (this.scene.worldData && this.scene.worldData[ty][tx] !== BLOCK_AIR) {
        this.spawnSplat(p.sprite.x, p.sprite.y);
        p.sprite.destroy(); this.projectiles.splice(i, 1); continue;
      }

      if (this.scene.enemyManager) {
        let hit = false;
        for (const enemy of this.scene.enemyManager.enemies) {
          if (enemy.dead) continue;
          const dx = p.sprite.x - enemy.sprite.x;
          const dy = p.sprite.y - enemy.sprite.y;
          if (Math.sqrt(dx * dx + dy * dy) < TILE_SIZE * 1.3) {
            enemy.takeDamage(BUM_POOP_DAMAGE, p.sprite.x);
            soundManager.play('poop_splat');
            this.spawnSplat(enemy.sprite.x, enemy.sprite.y);
            hit = true; break;
          }
        }
        if (hit) { p.sprite.destroy(); this.projectiles.splice(i, 1); continue; }
      }
    }
  }

  fire(px, py, flipX) {
    if (this.cooldown > 0) return false;
    if (this.projectiles.length >= 8) return false;
    this.cooldown = BUM_POOP_COOLDOWN;

    const dir = flipX ? -1 : 1;
    const vx = BUM_POOP_SPEED * dir;
    const vy = -BUM_POOP_SPEED * 0.35;

    const sprite = this.scene.add.image(px + dir * 6, py - 4, 'poop_proj');
    sprite.setDepth(6);
    sprite.setScale(0.8);
    this.projectiles.push({ sprite, vx, vy, life: 0 });

    soundManager.play('poop_throw');
    return true;
  }

  spawnSplat(x, y) {
    const splat = this.scene.add.image(x, y, 'poop_splat');
    splat.setDepth(3).setScale(0.7).setAlpha(0.9);
    this.scene.tweens.add({
      targets: splat, alpha: 0, duration: 600, delay: 400,
      onComplete: () => splat.destroy(),
    });
  }

  destroy() {
    for (const p of this.projectiles) {
      if (p.sprite) p.sprite.destroy();
    }
    this.projectiles = [];
  }
}
