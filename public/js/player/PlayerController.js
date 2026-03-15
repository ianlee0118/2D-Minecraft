import { TILE_SIZE, MOVE_SPEED, SPRINT_SPEED, JUMP_VELOCITY, GRAVITY, MAX_HEALTH,
  FALL_DAMAGE_THRESHOLD, FALL_DAMAGE_MULTIPLIER, SPAWN_PROTECTION_TIME } from '../constants.js';

export class PlayerController {
  constructor(scene, x, y) {
    this.scene = scene;
    this.health = MAX_HEALTH;
    this.invulnTime = 0;
    this.lastGroundY = y * TILE_SIZE;
    this.wasOnGround = true;

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
    };
  }

  update(delta) {
    const onGround = this.sprite.body.blocked.down;
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

    if (this.keys.jump.isDown && onGround) {
      this.sprite.body.setVelocityY(JUMP_VELOCITY);
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

  takeDamage(amount) {
    if (this.invulnTime > 0) return;
    this.health = Math.max(0, this.health - amount);
    this.sprite.setTint(0xff4444);
    this.scene.time.delayedCall(200, () => {
      if (this.sprite && this.sprite.active) this.sprite.clearTint();
    });
    if (this.health <= 0 && this.scene.handleDeath) {
      this.scene.handleDeath();
    }
  }

  setSpawnProtection() {
    this.invulnTime = SPAWN_PROTECTION_TIME;
  }
}
