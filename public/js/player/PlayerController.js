import { TILE_SIZE, MOVE_SPEED, SPRINT_SPEED, CROUCH_SPEED, JUMP_VELOCITY, GRAVITY, MAX_HEALTH,
  FALL_DAMAGE_THRESHOLD, FALL_DAMAGE_MULTIPLIER, SPAWN_PROTECTION_TIME, ATTACK_INVULN,
  KNOCKBACK_FORCE } from '../constants.js';
import { BLOCK_AIR } from '../blocks.js';
import { soundManager } from '../audio/SoundManager.js';
import { SpriteAnimator } from '../anim/SpriteAnimator.js';
import { gameLogger } from '../utils/GameLogger.js';
import { isBumEnabled, BUM_JUMP_MULTIPLIER, BUM_FALL_DAMAGE_MULTIPLIER } from '../character/BrownUnderwearMode.js';

const FLY_SPEED = 300;
const DOUBLE_TAP_WINDOW = 350;

export class PlayerController {
  constructor(scene, x, y) {
    gameLogger.log('PlayerController init at', x, y);
    this.scene = scene;
    this.health = MAX_HEALTH;
    this.invulnTime = 0;
    this.lastGroundY = y * TILE_SIZE;
    this.wasOnGround = true;
    this.godMode = false;
    this.flying = false;
    this.crouching = false;
    this.lastSpaceTap = 0;
    this.spaceWasDown = false;
    this.bumMode = isBumEnabled();

    const tex = this.bumMode ? 'bum_player' : 'player';
    this.sprite = scene.physics.add.sprite(
      x * TILE_SIZE + TILE_SIZE / 2,
      y * TILE_SIZE + TILE_SIZE / 2,
      tex
    );
    this.sprite.setOrigin(0.5, 0.5);
    if (this.bumMode) {
      this.sprite.body.setSize(12, 30);
      this.sprite.body.setOffset(2, 8);
    } else {
      this.sprite.body.setSize(12, 28);
      this.sprite.body.setOffset(2, 2);
    }
    this.sprite.body.setGravityY(GRAVITY);
    this.sprite.body.setCollideWorldBounds(true);
    this.sprite.body.setBounce(0);
    this.sprite.body.setMaxVelocityY(600);

    this.anim = new SpriteAnimator(scene, this.sprite, tex, {
      depth: 4,
      showTool: true,
      bobMul: 0.6,
      squash: false,
    });

    this.keys = {
      left:   scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right:  scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      jump:   scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      sprint: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT),
      flyDown: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.COMMA),
      crouch: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.C),
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

  _isSolid(tx, ty) {
    const world = this.scene.worldData;
    if (!world) return true;
    if (tx < 0 || tx >= world[0].length || ty < 0 || ty >= world.length) return true;
    return world[ty][tx] !== BLOCK_AIR;
  }

  _wouldFallOff(dir) {
    const body = this.sprite.body;
    const footTx = Math.floor((this.sprite.x + dir * (body.halfWidth + 1)) / TILE_SIZE);
    const footTy = Math.floor((body.bottom + 1) / TILE_SIZE);
    return !this._isSolid(footTx, footTy);
  }

  update(delta) {
    this.crouching = this.keys.crouch.isDown && !this.flying;
    const sprinting = this.keys.sprint.isDown && !this.crouching;
    const speed = this.crouching ? CROUCH_SPEED : (sprinting ? SPRINT_SPEED : MOVE_SPEED);

    if (this.keys.left.isDown) {
      const blocked = this.crouching && this.sprite.body.blocked.down && this._wouldFallOff(-1);
      if (blocked) {
        this.sprite.body.setVelocityX(0);
      } else {
        this.sprite.body.setVelocityX(-speed);
      }
      this.sprite.setFlipX(true);
    } else if (this.keys.right.isDown) {
      const blocked = this.crouching && this.sprite.body.blocked.down && this._wouldFallOff(1);
      if (blocked) {
        this.sprite.body.setVelocityX(0);
      } else {
        this.sprite.body.setVelocityX(speed);
      }
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
      this.anim.update(delta, {
        moving: Math.abs(this.sprite.body.velocity.x) > 15 || Math.abs(this.sprite.body.velocity.y) > 15,
        onGround: false,
        justLanded: false,
        flipX: this.sprite.flipX,
        crouching: false,
        alpha: 1,
      });
      return;
    }

    const onGround = this.sprite.body.blocked.down;

    if (this.keys.jump.isDown && onGround) {
      const jv = this.bumMode ? JUMP_VELOCITY * BUM_JUMP_MULTIPLIER : JUMP_VELOCITY;
      this.sprite.body.setVelocityY(jv);
      soundManager.play('jump');
    }

    if (this.invulnTime > 0) {
      this.invulnTime -= delta / 1000;
      if (this.invulnTime <= 0) this.invulnTime = 0;
    }

    const justLanded = onGround && !this.wasOnGround;
    const alpha = this.invulnTime > 0 ? (Math.sin(Date.now() / 100) > 0 ? 1 : 0.3) : 1;
    this.anim.update(delta, {
      moving: Math.abs(this.sprite.body.velocity.x) > 15,
      onGround,
      justLanded,
      flipX: this.sprite.flipX,
      crouching: this.crouching,
      alpha,
    });

    if (onGround && !this.wasOnGround) {
      const fallDist = (this.sprite.y - this.lastGroundY) / TILE_SIZE;
      if (fallDist > FALL_DAMAGE_THRESHOLD && this.invulnTime <= 0) {
        const fdm = this.bumMode ? FALL_DAMAGE_MULTIPLIER * BUM_FALL_DAMAGE_MULTIPLIER : FALL_DAMAGE_MULTIPLIER;
        const dmg = Math.min(MAX_HEALTH, Math.floor((fallDist - FALL_DAMAGE_THRESHOLD) * fdm));
        if (dmg > 0) this.takeDamage(dmg);
      }
    }

    if (onGround) this.lastGroundY = this.sprite.y;
    this.wasOnGround = onGround;
  }

  setHeldTool(textureKey) {
    if (this.anim) this.anim.setToolTexture(textureKey);
  }

  takeDamage(amount, fromX, fromY) {
    if (this.godMode || this.invulnTime > 0) return;
    this.health = Math.max(0, this.health - amount);
    this.invulnTime = ATTACK_INVULN;
    if (this.anim) this.anim.setTint(0xff4444);
    this.scene.time.delayedCall(200, () => {
      if (this.anim) this.anim.clearTint();
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
