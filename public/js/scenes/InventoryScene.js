import { GAME_WIDTH, GAME_HEIGHT, HOTBAR_SLOTS, INVENTORY_SLOTS } from '../constants.js';
import { InventoryUI } from '../ui/InventoryUI.js';
import { findRecipe, consumeIngredients } from '../crafting/CraftingSystem.js';

export class InventoryScene extends Phaser.Scene {
  constructor() { super('InventoryScene'); }

  create(data) {
    this.inventory = data.inventory;
    this.craftGrid = [null, null, null, null];
    this.craftResult = null;

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

    this.input.mouse.disableContextMenu();
    this.input.on('pointerdown', p => this.ui.handleClick(p));
    this.input.keyboard.on('keydown-E', () => this.close());
    this.input.keyboard.on('keydown-ESC', () => this.close());
  }

  updateCraft() {
    const recipe = findRecipe(this.craftGrid, 2);
    this.craftResult = recipe ? { ...recipe.result } : null;
  }

  close() {
    for (let i = 0; i < 4; i++) {
      if (this.craftGrid[i]) {
        this.inventory.addItem(this.craftGrid[i].itemId, this.craftGrid[i].count, this.craftGrid[i].durability);
        this.craftGrid[i] = null;
      }
    }
    this.ui.returnHeldItem(this.inventory);
    this.ui.destroy();
    this.scene.resume('GameScene');
    this.scene.stop();
  }

  update() { this.ui.render(); }
}
