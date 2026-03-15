import { GAME_WIDTH, GAME_HEIGHT, HOTBAR_SLOTS, INVENTORY_SLOTS, COAL_BURN_TIME } from '../constants.js';
import { InventoryUI } from '../ui/InventoryUI.js';
import { SMELTING_RECIPES } from '../crafting/recipes.js';
import { ITEMS } from '../items.js';

function getSmeltRecipe(itemId) {
  return SMELTING_RECIPES.find(r => r.input === itemId) || null;
}

export class FurnaceScene extends Phaser.Scene {
  constructor() { super('FurnaceScene'); }

  create(data) {
    this.inventory = data.inventory;
    this.furnace = data.furnace;

    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.7).setDepth(90);
    this.add.text(GAME_WIDTH / 2, 22, 'Furnace', {
      fontSize: '22px', fontFamily: 'monospace', color: '#eee'
    }).setOrigin(0.5).setDepth(100);

    this.ui = new InventoryUI(this);
    const cx = GAME_WIDTH / 2;
    const mainX = (GAME_WIDTH - (9 * 32)) / 2;

    this.ui.addGroup('input', {
      x: cx - 50, y: 55, cols: 1, count: 1,
      getSlot: () => this.furnace.input,
      setSlot: (_, item) => { this.furnace.input = item; },
      canPlace: (_, item) => !!getSmeltRecipe(item.itemId),
    });
    this.ui.addGroup('fuel', {
      x: cx - 50, y: 120, cols: 1, count: 1,
      getSlot: () => this.furnace.fuel,
      setSlot: (_, item) => { this.furnace.fuel = item; },
      canPlace: (_, item) => item.itemId === 'coal',
    });
    this.ui.addGroup('output', {
      x: cx + 40, y: 85, cols: 1, count: 1,
      getSlot: () => this.furnace.output,
      setSlot: () => {},
      readOnly: true,
      onTake: () => {
        if (!this.furnace.output) return null;
        const r = { ...this.furnace.output };
        this.furnace.output = null;
        return r;
      },
    });

    this.ui.addGroup('main', {
      x: mainX, y: 200, cols: 9, count: INVENTORY_SLOTS,
      getSlot: i => this.inventory.getSlot(HOTBAR_SLOTS + i),
      setSlot: (i, item) => { this.inventory.slots[HOTBAR_SLOTS + i] = item; },
    });
    this.ui.addGroup('hotbar', {
      x: mainX, y: 310, cols: 9, count: HOTBAR_SLOTS,
      getSlot: i => this.inventory.getSlot(i),
      setSlot: (i, item) => { this.inventory.slots[i] = item; },
    });

    this.progressGfx = this.add.graphics().setDepth(105);
    this.input.mouse.disableContextMenu();
    this.input.on('pointerdown', p => this.ui.handleClick(p));
    this.input.keyboard.on('keydown-E', () => this.close());
    this.input.keyboard.on('keydown-ESC', () => this.close());
  }

  update(_t, delta) {
    this.updateSmelt(delta);
    this.ui.render();
    this.drawProgress();
  }

  updateSmelt(delta) {
    const f = this.furnace;
    const dt = delta / 1000;

    if (f.fuelTime > 0) {
      f.fuelTime -= dt;
      if (f.input && getSmeltRecipe(f.input.itemId)) {
        const recipe = getSmeltRecipe(f.input.itemId);
        f.smeltProgress += dt;
        if (f.smeltProgress >= recipe.time) {
          f.smeltProgress = 0;
          f.input.count--;
          if (f.input.count <= 0) f.input = null;
          if (!f.output) f.output = { itemId: recipe.output, count: 1 };
          else if (f.output.itemId === recipe.output) {
            const def = ITEMS[recipe.output];
            if (f.output.count < def.maxStack) f.output.count++;
          }
        }
      } else {
        f.smeltProgress = 0;
      }
    } else {
      if (f.fuel && f.input && getSmeltRecipe(f.input.itemId)) {
        f.fuel.count--;
        if (f.fuel.count <= 0) f.fuel = null;
        f.fuelTime = COAL_BURN_TIME;
        f.fuelMaxTime = COAL_BURN_TIME;
      } else {
        f.smeltProgress = 0;
      }
    }
  }

  drawProgress() {
    const g = this.progressGfx;
    g.clear();
    const cx = GAME_WIDTH / 2;
    const f = this.furnace;

    if (f.fuelMaxTime > 0 && f.fuelTime > 0) {
      const ratio = f.fuelTime / f.fuelMaxTime;
      g.fillStyle(0xff6600, 1);
      g.fillRect(cx - 45, 102 + 15 * (1 - ratio), 20, 15 * ratio);
    }
    g.lineStyle(1, 0x888888, 1);
    g.strokeRect(cx - 45, 102, 20, 15);

    const recipe = f.input ? getSmeltRecipe(f.input.itemId) : null;
    if (recipe && f.smeltProgress > 0) {
      const ratio = f.smeltProgress / recipe.time;
      g.fillStyle(0x00cc00, 1);
      g.fillRect(cx - 5, 92, 35 * ratio, 8);
    }
    g.lineStyle(1, 0x888888, 1);
    g.strokeRect(cx - 5, 92, 35, 8);

    this.add.text ? void 0 : void 0;
  }

  close() {
    this.ui.returnHeldItem(this.inventory);
    this.progressGfx.destroy();
    this.ui.destroy();
    this.scene.resume('GameScene');
    this.scene.stop();
  }
}
