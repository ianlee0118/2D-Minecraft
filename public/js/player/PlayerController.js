import { TILE_SIZE, MOVE_SPEED, SPRINT_SPEED, JUMP_VELOCITY, GRAVITY, MAX_HEALTH,
  FALL_DAMAGE_THRESHOLD, FALL_DAMAGE_MULTIPLIER, SPAWN_PROTECTION_TIME, ATTACK_INVULN,
  KNOCKBACK_FORCE } from '../constants.js';
import { soundManager } from '../audio/SoundManager.js';

const FLY_SPEED = 300;
const DOUBLE_TAP_WINDOW = 350;

export class PlayerController {
  constructor(scene, x, y) {
    this.scene = scene;
    this.health = MAX_HEALTH;
    this.invulnTime = 0;
    this.lastGroundY = y * TILE_SIZE;
    this.wasOnGround = true;
    this.godMode = false;
    this.flying = false;
    this.lastSpaceTap = 0;
    this.spaceWasDown = false;

    this.sprite = scene.physics.add.sprite(
      x * TILE_SIZE + TILE_SIZE / 2,
      y * TILE_SIZE + TILE_SIZE / 2,
      'player'
    );
    this.sprite.setOrigin(0.5, 0.5);
    this.sprite.body.setSize(12, 28);
    this.sprite.body.setOffset(2, 2);
    this.sprite.body.setGravityY(GRAVITY);
    this.sprite.body.setCollideWorldBounds(true);
    this.sprite.body.setBounce(0);
    this.sprite.body.setMaxVelocityY(600);

    this.keys = {
      left:   scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right:  scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      jump:   scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      sprint: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT),
      flyDown: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.COMMA),
    };
  }

  toggleFlight() {
    if (!this.godMode) return;
    this.flying = !this.flying;
    if (this.flying) {
      this.sprite.body.setGravityY(0);
      this.sprite.body.setVelocityY(0);
      this.sprite.body.setMaxVelocityY(FLY_SPEED);
    } else {
      this.sprite.body.setGravityY(GRAVITY);
      this.sprite.body.setMaxVelocityY(600);
    }
  }

  disableFlight() {
    this.flying = false;
    this.sprite.body.setGravityY(GRAVITY);
    this.sprite.body.setMaxVelocityY(600);
  }

  update(delta) {
    const sprinting = this.keys.sprint.isDown;
    const speed = sprinting ? SPRINT_SPEED : MOVE_SPEED;

    if (this.keys.left.isDown) {
      this.sprite.body.setVelocityX(-speed);
      this.sprite.setFlipX(true);
    } else if (this.keys.right.isDown) {
      this.sprite.body.setVelocityX(speed);
      this.sprite.setFlipX(false);
    } else {
      this.sprite.body.setVelocityX(0);
    }

    const spaceDown = this.keys.jump.isDown;
    if (spaceDown && !this.spaceWasDown && this.godMode) {
      const now = Date.now();
      if (now - this.lastSpaceTap < DOUBLE_TAP_WINDOW) {
        this.toggleFlight();
        this.lastSpaceTap = 0;
      } else {
        this.lastSpaceTap = now;
      }
    }
    this.spaceWasDown = spaceDown;

    if (this.flying) {
      if (this.keys.jump.isDown) {
        this.sprite.body.setVelocityY(-FLY_SPEED);
      } else if (this.keys.flyDown.isDown) {
        this.sprite.body.setVelocityY(FLY_SPEED);
      } else {
        this.sprite.body.setVelocityY(0);
      }
      this.lastGroundY = this.sprite.y;
      return;
    }

    const onGround = this.sprite.body.blocked.down;

    if (this.keys.jump.isDown && onGround) {
      this.sprite.body.setVelocityY(JUMP_VELOCITY);
      soundManager.play('jump');
    }

    if (this.invulnTime > 0) {
      this.invulnTime -= delta / 1000;
      this.sprite.setAlpha(Math.sin(Date.now() / 100) > 0 ? 1 : 0.3);
      if (this.invulnTime <= 0) { this.invulnTime = 0; this.sprite.setAlpha(1); }
    }

    if (onGround && !this.wasOnGround) {
      const fallDist = (this.sprite.y - this.lastGroundY) / TILE_SIZE;
      if (fallDist > FALL_DAMAGE_THRESHOLD && this.invulnTime <= 0) {
        const dmg = Math.min(MAX_HEALTH, Math.floor((fallDist - FALL_DAMAGE_THRESHOLD) * FALL_DAMAGE_MULTIPLIER));
        if (dmg > 0) this.takeDamage(dmg);
      }
    }

    if (onGround) this.lastGroundY = this.sprite.y;
    this.wasOnGround = onGround;
  }

  takeDamage(amount, fromX, fromY) {
    if (this.godMode || this.invulnTime > 0) return;
    this.health = Math.max(0, this.health - amount);
    this.invulnTime = ATTACK_INVULN;
    this.sprite.setTint(0xff4444);
    this.scene.time.delayedCall(200, () => {
      if (this.sprite && this.sprite.active) this.sprite.clearTint();
    });
    if (fromX !== undefined && fromY !== undefined) {
      const dx = this.sprite.x - fromX;
      const dy = this.sprite.y - fromY;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      this.sprite.body.setVelocity(
        (dx / dist) * KNOCKBACK_FORCE,
        Math.min(-100, (dy / dist) * KNOCKBACK_FORCE - 80)
      );
    }
    soundManager.play('player_hurt');
    if (this.health <= 0 && this.scene.handleDeath) {
      soundManager.play('player_death');
      this.scene.handleDeath();
    }
  }

  setSpawnProtection() {
    this.invulnTime = SPAWN_PROTECTION_TIME;
  }
}
