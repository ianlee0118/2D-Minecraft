import { TILE_SIZE, WORLD_WIDTH } from '../constants.js';
import { BUM_BUS_FIRST_SPAWN_DURATION, BUM_BUS_RESPAWN_DURATION } from './BrownUnderwearMode.js';
import { soundManager } from '../audio/SoundManager.js';

export class BusSpawnSequence {
  constructor(scene, playerSprite, isRespawn = false) {
    this.scene = scene;
    this.playerSprite = playerSprite;
    this.done = false;
    this.skippable = false;
    this._skipTimer = 0;

    this.duration = isRespawn ? BUM_BUS_RESPAWN_DURATION : BUM_BUS_FIRST_SPAWN_DURATION;
    this.elapsed = 0;

    const targetX = playerSprite.x;
    const groundY = playerSprite.y;

    const fromLeft = targetX < (WORLD_WIDTH * TILE_SIZE / 2);
    this.dir = fromLeft ? 1 : -1;

    const startX = targetX - this.dir * 120;
    const stopX = targetX - this.dir * 12;

    this.startX = startX;
    this.stopX = stopX;
    this.targetX = targetX;
    this.busY = groundY - 4;

    this.bus = scene.add.image(startX, this.busY, 'bum_bus');
    this.bus.setDepth(10);
    this.bus.setFlipX(this.dir < 0);
    this.bus.setOrigin(0.5, 1);

    playerSprite.setVisible(false);
    if (playerSprite.body) {
      playerSprite.body.enable = false;
    }

    this.label = scene.add.text(targetX, groundY - 40, isRespawn ? '' : 'Special spawn incoming...', {
      fontSize: '8px', fontFamily: 'monospace', color: '#ff0',
      stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(11).setScrollFactor(1);

    soundManager.play('bus_horn');

    this.phase = 'arriving';
  }

  update(delta) {
    if (this.done) return;
    this.elapsed += delta;
    this._skipTimer += delta;

    if (this._skipTimer > 800) this.skippable = true;

    const progress = Math.min(this.elapsed / this.duration, 1);

    if (this.phase === 'arriving') {
      const arriveAt = 0.5;
      if (progress < arriveAt) {
        const t = progress / arriveAt;
        const eased = t < 1 ? 1 - Math.pow(1 - t, 2) : 1;
        this.bus.x = this.startX + (this.stopX - this.startX) * eased;
      } else {
        this.bus.x = this.stopX;
        this.phase = 'dropping';
        this.playerSprite.setPosition(this.stopX + this.dir * 8, this.playerSprite.y);
        this.playerSprite.setVisible(true);
        if (this.playerSprite.body) this.playerSprite.body.enable = true;
        if (this.label) this.label.setText('');
      }
    }

    if (this.phase === 'dropping') {
      const dropStart = 0.5;
      const dropEnd = 0.7;
      if (progress >= dropEnd) {
        this.phase = 'leaving';
        this.playerSprite.setPosition(this.targetX, this.playerSprite.y);
      } else {
        const t = (progress - dropStart) / (dropEnd - dropStart);
        this.playerSprite.x = this.stopX + this.dir * 8 + (this.targetX - this.stopX - this.dir * 8) * t;
      }
    }

    if (this.phase === 'leaving') {
      const leaveStart = 0.7;
      if (progress >= leaveStart) {
        const t = (progress - leaveStart) / (1 - leaveStart);
        const leaveTarget = this.stopX + this.dir * 140;
        this.bus.x = this.stopX + (leaveTarget - this.stopX) * Math.pow(t, 2);
      }
      if (progress >= 1) {
        this.finish();
      }
    }
  }

  skip() {
    if (!this.skippable || this.done) return;
    this.finish();
  }

  finish() {
    if (this.done) return;
    this.done = true;
    this.playerSprite.setPosition(this.targetX, this.playerSprite.y);
    this.playerSprite.setVisible(true);
    if (this.playerSprite.body) this.playerSprite.body.enable = true;
    if (this.bus) { this.bus.destroy(); this.bus = null; }
    if (this.label) { this.label.destroy(); this.label = null; }
  }

  destroy() {
    if (this.bus) { this.bus.destroy(); this.bus = null; }
    if (this.label) { this.label.destroy(); this.label = null; }
  }
}
