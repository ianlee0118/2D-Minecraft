import { GAME_WIDTH, GAME_HEIGHT, HOTBAR_SLOTS, MAX_HEALTH, DAY_LENGTH, NIGHT_START, BOW_DRAW_TIME, PISTOL_COOLDOWN, WARDEN_KILL_THRESHOLD } from '../constants.js';
import { gameLogger } from '../utils/GameLogger.js';
import { ITEMS } from '../items.js';
import { isBumEnabled } from '../character/BrownUnderwearMode.js';

export class HUDScene extends Phaser.Scene {
  constructor() { super('HUDScene'); }

  create(data) {
    gameLogger.scene('HUDScene', 'create');
    this.inventory = data.inventory;
    this.player = data.player;
    this.gameScene = data.gameScene;
    this.gfx = this.add.graphics();

    this.slotIcons = [];
    this.slotCounts = [];
    for (let i = 0; i < HOTBAR_SLOTS; i++) {
      this.slotIcons.push(this.add.image(0, 0, 'block_0').setVisible(false).setScale(1.8));
      this.slotCounts.push(this.add.text(0, 0, '', {
        fontSize: '11px', fontFamily: 'monospace', color: '#fff', stroke: '#000', strokeThickness: 2,
      }).setVisible(false));
    }

    this.hearts = [];
    for (let i = 0; i < 10; i++) {
      this.hearts.push(this.add.image(0, 0, 'heart_full').setScale(2).setOrigin(0, 0));
    }

    this.msgText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, '', {
      fontSize: '16px', fontFamily: 'monospace', color: '#fff',
      backgroundColor: '#0008', padding: { x: 12, y: 6 },
    }).setOrigin(0.5).setVisible(false).setDepth(10);

    this.godLabel = this.add.text(GAME_WIDTH / 2, 10, 'GOD MODE', {
      fontSize: '14px', fontFamily: 'monospace', color: '#ff0',
      stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5, 0).setVisible(false).setDepth(10);

    this.flyLabel = this.add.text(GAME_WIDTH / 2, 26, 'FLIGHT', {
      fontSize: '11px', fontFamily: 'monospace', color: '#88ccff',
      stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5, 0).setVisible(false).setDepth(10);

    this.crouchLabel = this.add.text(GAME_WIDTH / 2, 26, 'CROUCHING', {
      fontSize: '11px', fontFamily: 'monospace', color: '#ffaa44',
      stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5, 0).setVisible(false).setDepth(10);

    this.dayLabel = this.add.text(GAME_WIDTH - 10, 10, '', {
      fontSize: '11px', fontFamily: 'monospace', color: '#fff',
      stroke: '#000', strokeThickness: 2,
    }).setOrigin(1, 0).setDepth(10);

    this.bowHint = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 60, '', {
      fontSize: '10px', fontFamily: 'monospace', color: '#ccc',
      stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5).setVisible(false).setDepth(10);

    this.pvpLabel = this.add.text(GAME_WIDTH - 10, 28, '', {
      fontSize: '10px', fontFamily: 'monospace', color: '#aaa',
      stroke: '#000', strokeThickness: 2,
    }).setOrigin(1, 0).setDepth(10).setVisible(false);

    this.killLabel = this.add.text(10, 36, '', {
      fontSize: '9px', fontFamily: 'monospace', color: '#ccc',
      stroke: '#000', strokeThickness: 2,
    }).setDepth(10);

    this.wardenLabel = this.add.text(GAME_WIDTH / 2, 48, '', {
      fontSize: '12px', fontFamily: 'monospace', color: '#ff3333',
      stroke: '#000', strokeThickness: 3, fontStyle: 'bold',
    }).setOrigin(0.5, 0).setDepth(10).setVisible(false);

    this.itemNameLabel = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 52, '', {
      fontSize: '10px', fontFamily: 'monospace', color: '#fff',
      stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(10).setVisible(false);
    this._lastSelectedSlot = -1;
    this._itemNameTimer = 0;

    this.bumLabel = this.add.text(10, GAME_HEIGHT - 52, 'BUM  J=Throw', {
      fontSize: '8px', fontFamily: 'monospace', color: '#da5',
      stroke: '#000', strokeThickness: 2,
    }).setDepth(10).setVisible(isBumEnabled());
  }

  flashMessage(msg) {
    this.msgText.setText(msg).setVisible(true).setAlpha(1);
    this.tweens.killTweensOf(this.msgText);
    this.tweens.add({
      targets: this.msgText, alpha: 0, delay: 1200, duration: 600,
      onComplete: () => this.msgText.setVisible(false),
    });
  }

  update(_t, delta) {
    try {
      if (!this.inventory) return;
      this.drawHotbar();
      this.drawHearts();
      this.drawDayNight();
      this.drawBowHint();
      this.drawItemName(delta);
      this.godLabel.setVisible(this.player && this.player.godMode);
      const isCrouching = this.player && this.player.crouching;
      const isFlying = this.player && this.player.flying;
      this.flyLabel.setVisible(isFlying && !isCrouching);
      this.crouchLabel.setVisible(isCrouching && !isFlying);

      if (this.gameScene && this.gameScene.pvpEnabled !== undefined) {
        this.pvpLabel.setVisible(true);
        this.pvpLabel.setText(`PvP: ${this.gameScene.pvpEnabled ? 'ON' : 'OFF'}`);
        this.pvpLabel.setColor(this.gameScene.pvpEnabled ? '#ff8888' : '#88ff88');
      } else {
        this.pvpLabel.setVisible(false);
      }

      if (this.gameScene) {
        const kc = this.gameScene.killCount || 0;
        const next = WARDEN_KILL_THRESHOLD - (kc % WARDEN_KILL_THRESHOLD);
        this.killLabel.setText(`Kills: ${kc}  (Warden: ${kc >= WARDEN_KILL_THRESHOLD ? next === WARDEN_KILL_THRESHOLD ? 'READY' : next : next})`);

        const wa = this.gameScene.wardenActive;
        this.wardenLabel.setVisible(!!wa);
        if (wa) this.wardenLabel.setText('⚠ WARDEN ACTIVE ⚠');
      }
    } catch (err) {
      gameLogger.error('HUDScene update:', err);
    }
  }

  drawHotbar() {
    const slotSize = 36, gap = 3;
    const totalW = HOTBAR_SLOTS * slotSize + (HOTBAR_SLOTS - 1) * gap;
    const startX = (GAME_WIDTH - totalW) / 2;
    const baseY = GAME_HEIGHT - slotSize - 8;
    this.gfx.clear();

    this.gfx.fillStyle(0x111111, 0.7);
    this.gfx.fillRoundedRect(startX - 4, baseY - 4, totalW + 8, slotSize + 8, 4);

    for (let i = 0; i < HOTBAR_SLOTS; i++) {
      const x = startX + i * (slotSize + gap);
      const sel = i === this.inventory.selectedSlot;
      this.gfx.fillStyle(sel ? 0x555555 : 0x1a1a2e, 0.92);
      this.gfx.fillRect(x, baseY, slotSize, slotSize);
      this.gfx.lineStyle(sel ? 2 : 1, sel ? 0xffffff : 0x555555, 1);
      this.gfx.strokeRect(x, baseY, slotSize, slotSize);

      const slot = this.inventory.getSlot(i);
      const icon = this.slotIcons[i];
      const countTxt = this.slotCounts[i];
      if (slot) {
        const def = ITEMS[slot.itemId];
        if (def) { icon.setTexture(def.textureKey).setPosition(x + slotSize / 2, baseY + slotSize / 2).setVisible(true); }
        if (slot.count > 1) {
          countTxt.setText(String(slot.count)).setPosition(x + slotSize - 3, baseY + slotSize - 2).setOrigin(1, 1).setVisible(true);
        } else countTxt.setVisible(false);

        if (slot.durability !== undefined && def && def.maxDurability) {
          const ratio = slot.durability / def.maxDurability;
          const color = ratio > 0.5 ? 0x00cc00 : ratio > 0.25 ? 0xcccc00 : 0xcc0000;
          this.gfx.fillStyle(color, 1);
          this.gfx.fillRect(x + 3, baseY + slotSize - 5, (slotSize - 6) * ratio, 3);
        }
      } else { icon.setVisible(false); countTxt.setVisible(false); }
    }
  }

  drawHearts() {
    if (!this.player) return;
    const hp = this.player.health;
    const startX = 10, startY = 10;
    for (let i = 0; i < 10; i++) {
      const heart = this.hearts[i];
      heart.setPosition(startX + i * 20, startY);
      const hpForHeart = (i + 1) * 2;
      if (hp >= hpForHeart) heart.setTexture('heart_full');
      else if (hp >= hpForHeart - 1) heart.setTexture('heart_half');
      else heart.setTexture('heart_empty');
    }
  }

  drawDayNight() {
    if (!this.gameScene) return;
    const phase = (this.gameScene.dayTime || 0) / DAY_LENGTH;
    const isNight = this.gameScene.isNight;
    const minutes = Math.floor((phase * DAY_LENGTH) / 60);
    const secs = Math.floor((phase * DAY_LENGTH) % 60);
    const timeStr = `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    this.dayLabel.setText(`${isNight ? 'Night' : 'Day'} ${timeStr}`);
    this.dayLabel.setColor(isNight ? '#8888ff' : '#ffff88');
  }

  drawBowHint() {
    const held = this.inventory.getSelectedItemDef();
    if (held && held.toolType === 'bow') {
      const gs = this.gameScene;
      if (gs && gs.combat && gs.combat.bowDrawing) {
        const pct = Math.min(gs.combat.bowDrawTime / BOW_DRAW_TIME, 1);
        const barW = 60;
        this.bowHint.setText('');
        this.gfx.fillStyle(0x333333, 0.8);
        this.gfx.fillRect(GAME_WIDTH / 2 - barW / 2, GAME_HEIGHT - 64, barW, 6);
        const c = pct >= 1 ? 0x44ff44 : 0xffaa44;
        this.gfx.fillStyle(c, 1);
        this.gfx.fillRect(GAME_WIDTH / 2 - barW / 2, GAME_HEIGHT - 64, barW * pct, 6);
      } else {
        this.bowHint.setText('Hold LClick to draw bow').setVisible(true);
      }
    } else if (held?.toolType === 'pistol') {
      this.bowHint.setText('LClick to fire (infinite ammo)').setVisible(true);
    } else {
      this.bowHint.setVisible(false);
    }
  }

  drawItemName(delta) {
    const sel = this.inventory.selectedSlot;
    if (sel !== this._lastSelectedSlot) {
      this._lastSelectedSlot = sel;
      const slot = this.inventory.getSlot(sel);
      const def = slot ? ITEMS[slot.itemId] : null;
      if (def) {
        this.itemNameLabel.setText(def.name).setVisible(true).setAlpha(1);
        this._itemNameTimer = 2000;
      } else {
        this.itemNameLabel.setVisible(false);
      }
    }
    if (this._itemNameTimer > 0) {
      this._itemNameTimer -= delta;
      if (this._itemNameTimer < 500) {
        this.itemNameLabel.setAlpha(this._itemNameTimer / 500);
      }
      if (this._itemNameTimer <= 0) this.itemNameLabel.setVisible(false);
    }
  }
}
