import { TILE_SIZE, GRAVITY, KNOCKBACK_FORCE, WARDEN_HEALTH, WARDEN_DAMAGE, WARDEN_SPEED, WARDEN_KB_RESIST } from '../constants.js';
import { soundManager } from '../audio/SoundManager.js';
import { ITEMS } from '../items.js';
import { SpriteAnimator } from '../anim/SpriteAnimator.js';

const ENEMY_TYPES = {
  zombie: {
    texture: 'enemy_zombie',
    health: 20,
    damage: 3,
    speed: 55,
    detectRange: 12 * TILE_SIZE,
    attackRange: 1.2 * TILE_SIZE,
    attackCooldown: 1.0,
    jumpForce: -280,
    drops: [{ itemId: 'dirt', count: 1, chance: 0.3 }],
    bodyW: 12, bodyH: 28, offX: 2, offY: 2,
    spriteW: 16, spriteH: 30,
    isSurface: true,
  },
  skeleton: {
    texture: 'enemy_skeleton',
    health: 16,
    damage: 2,
    speed: 45,
    detectRange: 16 * TILE_SIZE,
    attackRange: 12 * TILE_SIZE,
    preferredDist: 6 * TILE_SIZE,
    attackCooldown: 2.5,
    jumpForce: -280,
    ranged: true,
    drops: [{ itemId: 'arrow', count: [1, 3], chance: 0.7 }],
    bodyW: 12, bodyH: 28, offX: 2, offY: 2,
    spriteW: 16, spriteH: 30,
    isSurface: true,
  },
  cave_spider: {
    texture: 'enemy_spider',
    health: 12,
    damage: 3,
    speed: 90,
    detectRange: 8 * TILE_SIZE,
    attackRange: 1.3 * TILE_SIZE,
    attackCooldown: 0.8,
    jumpForce: -260,
    drops: [{ itemId: 'string', count: [1, 2], chance: 0.8 }],
    bodyW: 16, bodyH: 10, offX: 2, offY: 1,
    spriteW: 20, spriteH: 12,
    isSurface: false,
  },
  warden: {
    texture: 'enemy_warden',
    health: WARDEN_HEALTH,
    damage: WARDEN_DAMAGE,
    speed: WARDEN_SPEED,
    detectRange: 24 * TILE_SIZE,
    attackRange: 1.8 * TILE_SIZE,
    attackCooldown: 1.2,
    jumpForce: -340,
    kbResist: WARDEN_KB_RESIST,
    drops: [
      { itemId: 'diamond', count: [3, 6], chance: 1.0 },
      { itemId: 'iron_ingot', count: [4, 8], chance: 1.0 },
    ],
    bodyW: 18, bodyH: 38, offX: 3, offY: 2,
    spriteW: 24, spriteH: 40,
    isSurface: true,
    isWarden: true,
  },
};

export { ENEMY_TYPES };

export class Enemy {
  constructor(scene, x, y, type) {
    this.scene = scene;
    this.type = type;
    const cfg = ENEMY_TYPES[type];
    this.cfg = cfg;
    this.health = cfg.health;
    this.attackTimer = 0;
    this.invulnTimer = 0;
    this.dead = false;
    this.direction = Math.random() < 0.5 ? -1 : 1;
    this.stuckTimer = 0;
    this.lastX = x;

    this.sprite = scene.physics.add.sprite(x, y, cfg.texture);
    this.sprite.setOrigin(0.5, 0.5);
    this.sprite.body.setSize(cfg.bodyW, cfg.bodyH);
    this.sprite.body.setOffset(cfg.offX, cfg.offY);
    this.sprite.body.setGravityY(GRAVITY);
    this.sprite.body.setCollideWorldBounds(true);
    this.sprite.body.setBounce(0);
    this.sprite.body.setMaxVelocityY(600);
    this.sprite.setDepth(4);
    this.sprite.setData('enemy', this);
    this.anim = new SpriteAnimator(scene, this.sprite, cfg.texture, {
      depth: 4,
      scale: cfg.isWarden ? 0.75 : undefined,
      showTool: type === 'skeleton',
    });
    if (type === 'skeleton') {
      this.anim.setToolTexture(ITEMS.bow.textureKey);
    }
  }

  update(delta, playerSprite) {
    if (this.dead) return;
    const dt = delta / 1000;
    if (this.attackTimer > 0) this.attackTimer -= dt;
    if (this.invulnTimer > 0) {
      this.invulnTimer -= dt;
      if (this.invulnTimer <= 0) this.invulnTimer = 0;
    }
    const alpha = this.invulnTimer > 0 ? (Math.sin(Date.now() / 60) > 0 ? 1 : 0.4) : 1;
    this.anim.update(delta, {
      moving: Math.abs(this.sprite.body.velocity.x) > 10,
      onGround: this.sprite.body.blocked.down,
      justLanded: false,
      flipX: this.sprite.flipX,
      alpha,
    });

    const player = this.scene.player;
    if (player && player.godMode) {
      this.wander(dt);
      this.handleStuck(dt);
      return;
    }

    const dx = playerSprite.x - this.sprite.x;
    const dy = playerSprite.y - this.sprite.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > this.cfg.detectRange) {
      this.wander(dt);
      return;
    }

    if (this.cfg.ranged) {
      this.skeletonAI(dt, dx, dist, playerSprite);
    } else {
      this.meleeAI(dt, dx, dist);
    }

    this.handleStuck(dt);
  }

  meleeAI(dt, dx, dist) {
    const dir = dx > 0 ? 1 : -1;
    this.direction = dir;
    this.sprite.setFlipX(dir < 0);

    if (dist > this.cfg.attackRange) {
      this.sprite.body.setVelocityX(this.cfg.speed * dir);
    } else {
      this.sprite.body.setVelocityX(0);
      this.tryMeleeAttack();
    }
    this.tryJump();
  }

  skeletonAI(dt, dx, dist, playerSprite) {
    const dir = dx > 0 ? 1 : -1;
    this.direction = dir;
    this.sprite.setFlipX(dir < 0);

    const pref = this.cfg.preferredDist;
    if (dist < pref * 0.6) {
      this.sprite.body.setVelocityX(-this.cfg.speed * dir);
    } else if (dist > pref * 1.4) {
      this.sprite.body.setVelocityX(this.cfg.speed * dir);
    } else {
      this.sprite.body.setVelocityX(0);
    }

    if (dist <= this.cfg.attackRange && this.attackTimer <= 0) {
      this.attackTimer = this.cfg.attackCooldown;
      this.scene.spawnEnemyArrow(this.sprite.x, this.sprite.y - 5, playerSprite);
    }
    this.tryJump();
  }

  wander(dt) {
    this.sprite.body.setVelocityX(this.cfg.speed * 0.4 * this.direction);
    this.sprite.setFlipX(this.direction < 0);
    if (Math.random() < 0.01) this.direction *= -1;
    this.tryJump();
  }

  tryJump() {
    const body = this.sprite.body;
    if (body.blocked.down && (body.blocked.left || body.blocked.right)) {
      body.setVelocityY(this.cfg.jumpForce);
    }
  }

  handleStuck(dt) {
    const moved = Math.abs(this.sprite.x - this.lastX);
    if (moved < 0.5) {
      this.stuckTimer += dt;
      if (this.stuckTimer > 2) {
        this.direction *= -1;
        this.stuckTimer = 0;
      }
    } else {
      this.stuckTimer = 0;
    }
    this.lastX = this.sprite.x;
  }

  tryMeleeAttack() {
    if (this.attackTimer > 0) return;
    this.attackTimer = this.cfg.attackCooldown;
    const player = this.scene.player;
    if (player) player.takeDamage(this.cfg.damage, this.sprite.x, this.sprite.y);
  }

  takeDamage(amount, sourceX) {
    if (this.dead || this.invulnTimer > 0) return;
    this.health -= amount;
    this.invulnTimer = 0.3;
    this.anim.setTint(0xff4444);
    this.scene.time.delayedCall(150, () => {
      if (this.anim) this.anim.clearTint();
    });

    const resist = this.cfg.kbResist || 0;
    const kb = (sourceX < this.sprite.x ? KNOCKBACK_FORCE : -KNOCKBACK_FORCE) * (1 - resist);
    this.sprite.body.setVelocityX(kb);
    this.sprite.body.setVelocityY(-120 * (1 - resist));

    soundManager.play(this.cfg.isWarden ? 'warden_hit' : 'enemy_hurt');
    if (this.health <= 0) this.die();
  }

  die() {
    this.dead = true;
    if (this.cfg.isWarden) {
      soundManager.play('warden_death');
      if (this.scene.onWardenKilled) this.scene.onWardenKilled();
    } else {
      soundManager.play('enemy_death');
    }
    if (this.scene.onEnemyKilled) this.scene.onEnemyKilled(this.type);
    for (const drop of this.cfg.drops) {
      if (Math.random() > drop.chance) continue;
      const count = Array.isArray(drop.count)
        ? drop.count[0] + Math.floor(Math.random() * (drop.count[1] - drop.count[0] + 1))
        : drop.count;
      this.scene.spawnDrop(this.sprite.x, this.sprite.y, drop.itemId, count);
    }
    if (this.anim) { this.anim.destroy(); this.anim = null; }
    this.sprite.destroy();
  }

  destroy() {
    if (this.anim) { this.anim.destroy(); this.anim = null; }
    if (this.sprite && this.sprite.active) this.sprite.destroy();
  }
}
