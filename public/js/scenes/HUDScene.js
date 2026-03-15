import { GAME_WIDTH, GAME_HEIGHT, HOTBAR_SLOTS, MAX_HEALTH } from '../constants.js';
import { ITEMS } from '../items.js';

export class HUDScene extends Phaser.Scene {
  constructor() { super('HUDScene'); }

  create(data) {
    this.inventory = data.inventory;
    this.player = data.player;
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
  }

  flashMessage(msg) {
    this.msgText.setText(msg).setVisible(true).setAlpha(1);
    this.tweens.killTweensOf(this.msgText);
    this.tweens.add({
      targets: this.msgText, alpha: 0, delay: 1200, duration: 600,
      onComplete: () => this.msgText.setVisible(false),
    });
  }

  update() {
    this.drawHotbar();
    this.drawHearts();
  }

  drawHotbar() {
    const slotSize = 36, gap = 3;
    const totalW = HOTBAR_SLOTS * slotSize + (HOTBAR_SLOTS - 1) * gap;
    const startX = (GAME_WIDTH - totalW) / 2;
    const baseY = GAME_HEIGHT - slotSize - 8;
    this.gfx.clear();

    for (let i = 0; i < HOTBAR_SLOTS; i++) {
      const x = startX + i * (slotSize + gap);
      const sel = i === this.inventory.selectedSlot;
      this.gfx.fillStyle(sel ? 0x666666 : 0x222222, 0.88);
      this.gfx.fillRect(x, baseY, slotSize, slotSize);
      this.gfx.lineStyle(sel ? 3 : 1, sel ? 0xffffff : 0x888888, 1);
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
}
