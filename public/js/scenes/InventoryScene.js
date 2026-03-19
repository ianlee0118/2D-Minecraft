import { GAME_WIDTH, GAME_HEIGHT, HOTBAR_SLOTS, INVENTORY_SLOTS } from '../constants.js';
import { InventoryUI } from '../ui/InventoryUI.js';
import { ITEMS } from '../items.js';
import { findRecipe, consumeIngredients } from '../crafting/CraftingSystem.js';
import { gameLogger } from '../utils/GameLogger.js';

const CSZ = 26;
const CGAP = 2;
const CCOLS = 5;
const CROWS = 8;

export class InventoryScene extends Phaser.Scene {
  constructor() { super('InventoryScene'); }

  create(data) {
    gameLogger.scene('InventoryScene', 'create');
    this.inventory = data.inventory;
    this.player = data.player || null;
    this.craftGrid = [null, null, null, null];
    this.craftResult = null;
    this.creativeOpen = false;
    this.creativeScroll = 0;

    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.7).setDepth(90);
    this.add.text(GAME_WIDTH / 2, 30, 'Inventory', {
      fontSize: '22px', fontFamily: 'monospace', color: '#eee'
    }).setOrigin(0.5).setDepth(100);

    this.ui = new InventoryUI(this);
    const mainX = (GAME_WIDTH - (9 * 32)) / 2;

    this.ui.addGroup('main', {
      x: mainX, y: 210, cols: 9, count: INVENTORY_SLOTS,
      getSlot: i => this.inventory.getSlot(HOTBAR_SLOTS + i),
      setSlot: (i, item) => { this.inventory.slots[HOTBAR_SLOTS + i] = item; },
    });
    this.ui.addGroup('hotbar', {
      x: mainX, y: 320, cols: 9, count: HOTBAR_SLOTS,
      getSlot: i => this.inventory.getSlot(i),
      setSlot: (i, item) => { this.inventory.slots[i] = item; },
    });
    this.ui.addGroup('craft', {
      x: GAME_WIDTH / 2 - 50, y: 70, cols: 2, count: 4,
      getSlot: i => this.craftGrid[i],
      setSlot: (i, item) => { this.craftGrid[i] = item; },
      onChange: () => this.updateCraft(),
    });

    this.add.text(GAME_WIDTH / 2 + 28, 92, '→', {
      fontSize: '24px', fontFamily: 'monospace', color: '#aaa'
    }).setOrigin(0.5).setDepth(100);

    this.ui.addGroup('output', {
      x: GAME_WIDTH / 2 + 50, y: 78, cols: 1, count: 1,
      getSlot: () => this.craftResult,
      setSlot: () => {},
      readOnly: true,
      onTake: () => {
        if (!this.craftResult) return null;
        const recipe = findRecipe(this.craftGrid, 2);
        if (!recipe) return null;
        const result = { ...this.craftResult };
        consumeIngredients(this.craftGrid, 2, recipe);
        this.updateCraft();
        return result;
      },
    });

    this.creativeGfx = this.add.graphics().setDepth(100);
    this.creativeIcons = [];
    for (let i = 0; i < CCOLS * CROWS; i++) {
      this.creativeIcons.push(this.add.image(0, 0, '__DEFAULT').setVisible(false).setDepth(101).setScale(1.3));
    }

    const isGod = this.player && this.player.godMode;
    if (isGod) {
      this.creativeBtn = this.add.text(GAME_WIDTH - 16, 30, '[ Creative ]', {
        fontSize: '12px', fontFamily: 'monospace', color: '#ff0',
        backgroundColor: '#333a', padding: { x: 6, y: 3 },
      }).setOrigin(1, 0.5).setDepth(110).setInteractive({ useHandCursor: true });
      this.creativeBtn.on('pointerdown', () => {
        this.creativeOpen = !this.creativeOpen;
        this.creativeScroll = 0;
      });

      this.dayNightBtn = this.add.text(GAME_WIDTH - 16, 50, '[ Toggle Day/Night ]', {
        fontSize: '10px', fontFamily: 'monospace', color: '#aaf',
        backgroundColor: '#333a', padding: { x: 6, y: 3 },
      }).setOrigin(1, 0.5).setDepth(110).setInteractive({ useHandCursor: true });
      this.dayNightBtn.on('pointerdown', () => {
        const gs = this.scene.get('GameScene');
        const mp = this.scene.get('MultiplayerGameScene');
        const activeScene = (mp && mp.scene.isActive()) ? mp : (gs && gs.scene.isActive()) ? gs : null;
        if (activeScene?.toggleDayNight) activeScene.toggleDayNight();
      });
    }

    this.input.mouse.disableContextMenu();
    this.input.on('pointerdown', p => {
      if (this.creativeOpen && this.handleCreativeClick(p)) return;
      this.ui.handleClick(p);
    });
    this.input.on('wheel', (_p, _go, _dx, dy) => {
      if (this.creativeOpen) {
        const allKeys = Object.keys(ITEMS);
        const maxRows = Math.ceil(allKeys.length / CCOLS);
        this.creativeScroll = Phaser.Math.Clamp(
          this.creativeScroll + (dy > 0 ? 1 : -1),
          0, Math.max(0, maxRows - CROWS)
        );
      }
    });
    this.input.keyboard.on('keydown-E', () => this.close());
    this.input.keyboard.on('keydown-ESC', () => this.close());
  }

  updateCraft() {
    const recipe = findRecipe(this.craftGrid, 2);
    this.craftResult = recipe ? { ...recipe.result } : null;
  }

  handleCreativeClick(pointer) {
    const panelX = GAME_WIDTH - 16 - CCOLS * (CSZ + CGAP);
    const panelY = 48;
    const allKeys = Object.keys(ITEMS);
    const startIdx = this.creativeScroll * CCOLS;

    for (let vi = 0; vi < CCOLS * CROWS; vi++) {
      const idx = startIdx + vi;
      if (idx >= allKeys.length) break;
      const col = vi % CCOLS, row = Math.floor(vi / CCOLS);
      const x = panelX + col * (CSZ + CGAP), y = panelY + row * (CSZ + CGAP);
      if (pointer.x >= x && pointer.x < x + CSZ && pointer.y >= y && pointer.y < y + CSZ) {
        const itemId = allKeys[idx];
        const def = ITEMS[itemId];
        const count = def.maxStack === 1 ? 1 : 64;
        const durability = def.maxDurability || null;
        this.inventory.addItem(itemId, count, durability);
        return true;
      }
    }
    return false;
  }

  close() {
    for (let i = 0; i < 4; i++) {
      if (this.craftGrid[i]) {
        this.inventory.addItem(this.craftGrid[i].itemId, this.craftGrid[i].count, this.craftGrid[i].durability);
        this.craftGrid[i] = null;
      }
    }
    this.ui.returnHeldItem(this.inventory);
    this.creativeGfx.destroy();
    this.creativeIcons.forEach(ic => ic.destroy());
    if (this.dayNightBtn) this.dayNightBtn.destroy();
    this.ui.destroy();
    this.scene.stop();
  }

  update() {
    this.ui.render();
    this.renderCreativePanel();
  }

  renderCreativePanel() {
    this.creativeGfx.clear();
    if (!this.creativeOpen) {
      this.creativeIcons.forEach(ic => ic.setVisible(false));
      if (this.creativeBtn) {
        this.creativeBtn.setText('[ Creative ]');
        this.creativeBtn.setColor('#ff0');
      }
      return;
    }

    if (this.creativeBtn) {
      this.creativeBtn.setText('[ Creative ON ]');
      this.creativeBtn.setColor('#0f0');
    }

    const allKeys = Object.keys(ITEMS);
    const panelX = GAME_WIDTH - 16 - CCOLS * (CSZ + CGAP);
    const panelY = 48;
    const panelW = CCOLS * (CSZ + CGAP) + 6;
    const panelH = CROWS * (CSZ + CGAP) + 6;

    this.creativeGfx.fillStyle(0x1a1a2e, 0.95);
    this.creativeGfx.fillRect(panelX - 6, panelY - 6, panelW, panelH);
    this.creativeGfx.lineStyle(1, 0xff0, 0.5);
    this.creativeGfx.strokeRect(panelX - 6, panelY - 6, panelW, panelH);

    const startIdx = this.creativeScroll * CCOLS;
    for (let vi = 0; vi < CCOLS * CROWS; vi++) {
      const idx = startIdx + vi;
      const col = vi % CCOLS, row = Math.floor(vi / CCOLS);
      const x = panelX + col * (CSZ + CGAP), y = panelY + row * (CSZ + CGAP);

      this.creativeGfx.fillStyle(0x2a2a3a, 0.92);
      this.creativeGfx.fillRect(x, y, CSZ, CSZ);
      this.creativeGfx.lineStyle(1, 0x666688, 0.7);
      this.creativeGfx.strokeRect(x, y, CSZ, CSZ);

      const ic = this.creativeIcons[vi];
      if (idx < allKeys.length) {
        const def = ITEMS[allKeys[idx]];
        ic.setTexture(def.textureKey).setPosition(x + CSZ / 2, y + CSZ / 2).setVisible(true);
      } else {
        ic.setVisible(false);
      }
    }

    const maxRows = Math.ceil(allKeys.length / CCOLS);
    if (maxRows > CROWS) {
      const barX = panelX + CCOLS * (CSZ + CGAP) + 1;
      const barH = CROWS * (CSZ + CGAP);
      const thumbH = Math.max(16, barH * (CROWS / maxRows));
      const thumbY = panelY + (barH - thumbH) * (this.creativeScroll / Math.max(1, maxRows - CROWS));
      this.creativeGfx.fillStyle(0x444444, 0.8);
      this.creativeGfx.fillRect(barX, panelY, 4, barH);
      this.creativeGfx.fillStyle(0x999999, 1);
      this.creativeGfx.fillRect(barX, thumbY, 4, thumbH);
    }
  }
}
