import {
  TILE_SIZE, WORLD_WIDTH, WORLD_HEIGHT,
  PLAYER_REACH, GAME_WIDTH, GAME_HEIGHT, HOTBAR_SLOTS, MAX_HEALTH,
  AUTOSAVE_INTERVAL, COAL_BURN_TIME,
} from '../constants.js';
import { BLOCK_AIR, BLOCK_CRAFTING_TABLE, BLOCK_FURNACE, BLOCK_TORCH, BLOCKS } from '../blocks.js';
import { ITEMS } from '../items.js';
import { SMELTING_RECIPES } from '../crafting/recipes.js';
import { WorldGenerator } from '../world/WorldGenerator.js';
import { Inventory } from '../inventory/Inventory.js';
import { PlayerController } from '../player/PlayerController.js';
import { SaveManager } from '../save/SaveManager.js';

function getSmeltRecipe(id) { return SMELTING_RECIPES.find(r => r.input === id) || null; }

export class GameScene extends Phaser.Scene {
  constructor() { super('GameScene'); }

  init(data) {
    this.saveSlot = data && data.saveSlot !== undefined ? data.saveSlot : null;
    this.seed = data && data.seed ? data.seed : Math.floor(Math.random() * 2147483647);
    this.loadData = data || null;
    this.createdAt = (data && data.createdAt) || Date.now();
  }

  create() {
    const gen = new WorldGenerator(this.seed);
    const result = gen.generate();
    this.worldData = result.data;
    this.originalWorldData = result.data.map(r => [...r]);

    this.blockChanges = {};
    if (this.loadData && this.loadData.blockChanges) {
      for (const [key, blockId] of Object.entries(this.loadData.blockChanges)) {
        const [tx, ty] = key.split(',').map(Number);
        if (ty >= 0 && ty < WORLD_HEIGHT && tx >= 0 && tx < WORLD_WIDTH) {
          this.worldData[ty][tx] = blockId;
        }
        this.blockChanges[key] = blockId;
      }
    }

    this.createTilemap();

    if (this.loadData && this.loadData.inventory) {
      this.inventory = Inventory.fromJSON(this.loadData.inventory);
    } else {
      this.inventory = new Inventory();
      this.inventory.addItem('wooden_pickaxe', 1);
      this.inventory.addItem('wooden_axe', 1);
      this.inventory.addItem('dirt', 32);
      this.inventory.addItem('wood_log', 16);
    }

    const spawnX = this.loadData && this.loadData.playerX !== undefined ? this.loadData.playerX : result.spawnPoint.x;
    const spawnY = this.loadData && this.loadData.playerY !== undefined ? this.loadData.playerY : result.spawnPoint.y;
    this.player = new PlayerController(this, spawnX, spawnY);
    if (this.loadData && this.loadData.health !== undefined) this.player.health = this.loadData.health;
    this.physics.add.collider(this.player.sprite, this.layer);

    this.drops = this.physics.add.group();
    this.physics.add.collider(this.drops, this.layer);
    this.physics.add.overlap(this.player.sprite, this.drops, this.collectDrop, null, this);

    this.furnaces = {};
    if (this.loadData && this.loadData.furnaces) {
      this.furnaces = JSON.parse(JSON.stringify(this.loadData.furnaces));
    }
    for (let y = 0; y < WORLD_HEIGHT; y++) {
      for (let x = 0; x < WORLD_WIDTH; x++) {
        if (this.worldData[y][x] === BLOCK_FURNACE && !this.furnaces[`${x},${y}`]) {
          this.furnaces[`${x},${y}`] = { input: null, fuel: null, output: null, smeltProgress: 0, fuelTime: 0, fuelMaxTime: 0 };
        }
      }
    }

    this.cameras.main.setZoom(2);
    this.cameras.main.startFollow(this.player.sprite, true, 0.1, 0.1);
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH * TILE_SIZE, WORLD_HEIGHT * TILE_SIZE);
    this.cameras.main.setBackgroundColor('#87CEEB');
    this.physics.world.setBounds(0, 0, WORLD_WIDTH * TILE_SIZE, WORLD_HEIGHT * TILE_SIZE);

    this.blockHighlight = this.add.graphics();
    this.targetTile = null;
    this.miningTarget = null;
    this.miningProgress = 0;
    this.miningTime = 0;
    this.autoSaveTimer = 0;

    this.input.mouse.disableContextMenu();
    this.input.on('pointerdown', (pointer) => {
      if (pointer.rightButtonDown()) this.handleRightClick(pointer);
    });

    this.input.on('wheel', (_p, _go, _dx, dy) => {
      this.inventory.selectedSlot = ((this.inventory.selectedSlot + (dy > 0 ? 1 : -1)) % HOTBAR_SLOTS + HOTBAR_SLOTS) % HOTBAR_SLOTS;
    });

    for (let i = 0; i < 9; i++) {
      const key = this.input.keyboard.addKey(49 + i);
      key.on('down', () => { this.inventory.selectedSlot = i; });
    }

    this.input.keyboard.on('keydown-ESC', () => {
      this.saveGame();
      this.scene.launch('PauseScene', { gameScene: this });
      this.scene.pause();
    });

    this.input.keyboard.on('keydown-E', () => {
      this.scene.launch('InventoryScene', { inventory: this.inventory });
      this.scene.pause();
    });

    this.scene.launch('HUDScene', { inventory: this.inventory, player: this.player });
    this.loadData = null;
  }

  createTilemap() {
    const tilemapData = this.worldData.map(row => row.map(b => b === BLOCK_AIR ? -1 : b - 1));
    this.map = this.make.tilemap({ data: tilemapData, tileWidth: TILE_SIZE, tileHeight: TILE_SIZE });
    const tileset = this.map.addTilesetImage('tiles', 'tiles', TILE_SIZE, TILE_SIZE, 0, 0);
    this.layer = this.map.createLayer(0, tileset, 0, 0);
    this.layer.setCollisionBetween(0, 99);
    const torchIdx = BLOCK_TORCH - 1;
    this.layer.forEachTile(t => { if (t.index === torchIdx) t.setCollision(false); });
  }

  update(_time, delta) {
    this.player.update(delta);
    this.updateTarget();

    const pointer = this.input.activePointer;
    if (pointer.leftButtonDown() && !pointer.rightButtonDown()) {
      this.handleMining(delta);
    } else {
      this.resetMining();
    }

    this.drawHighlights();
    this.updateFurnaces(delta);

    this.autoSaveTimer += delta / 1000;
    if (this.autoSaveTimer >= AUTOSAVE_INTERVAL && this.saveSlot !== null) {
      this.autoSaveTimer = 0;
      this.saveGame();
    }
  }

  updateTarget() {
    const pointer = this.input.activePointer;
    const wp = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const tx = Math.floor(wp.x / TILE_SIZE);
    const ty = Math.floor(wp.y / TILE_SIZE);
    if (tx < 0 || tx >= WORLD_WIDTH || ty < 0 || ty >= WORLD_HEIGHT) { this.targetTile = null; return; }
    const dist = Phaser.Math.Distance.Between(this.player.sprite.x, this.player.sprite.y, tx * TILE_SIZE + 8, ty * TILE_SIZE + 8);
    this.targetTile = dist <= PLAYER_REACH * TILE_SIZE ? { x: tx, y: ty } : null;
  }

  handleMining(delta) {
    if (!this.targetTile) { this.resetMining(); return; }
    const { x, y } = this.targetTile;
    const blockId = this.worldData[y][x];
    if (blockId === BLOCK_AIR) { this.resetMining(); return; }

    if (!this.miningTarget || this.miningTarget.x !== x || this.miningTarget.y !== y) {
      this.miningTarget = { x, y };
      this.miningProgress = 0;
      const blockDef = BLOCKS[blockId];
      const held = this.inventory.getSelectedItemDef();
      this.miningTime = this.calcMiningTime(blockDef, held);
    }

    this.miningProgress += delta / 1000;
    if (this.miningProgress >= this.miningTime) {
      this.breakBlock(x, y);
      this.resetMining();
    }
  }

  calcMiningTime(blockDef, heldItem) {
    const h = blockDef.hardness;
    if (h === 0) return 0.05;
    if (!blockDef.preferredTool) return h * 0.5;
    if (heldItem && heldItem.toolType === blockDef.preferredTool) return h / heldItem.miningSpeed;
    return h * 1.0;
  }

  breakBlock(tx, ty) {
    const blockId = this.worldData[ty][tx];
    const blockDef = BLOCKS[blockId];
    if (!blockDef) return;

    if (blockId === BLOCK_FURNACE) {
      const key = `${tx},${ty}`;
      const f = this.furnaces[key];
      if (f) {
        if (f.input) this.spawnDrop(tx * TILE_SIZE + 8, ty * TILE_SIZE + 8, f.input.itemId, f.input.count);
        if (f.fuel) this.spawnDrop(tx * TILE_SIZE + 8, ty * TILE_SIZE + 8, f.fuel.itemId, f.fuel.count);
        if (f.output) this.spawnDrop(tx * TILE_SIZE + 8, ty * TILE_SIZE + 8, f.output.itemId, f.output.count);
        delete this.furnaces[key];
      }
    }

    this.setBlock(tx, ty, BLOCK_AIR);

    if (blockDef.drops) this.spawnDrop(tx * TILE_SIZE + 8, ty * TILE_SIZE + 8, blockDef.drops);

    const held = this.inventory.getSelectedItemDef();
    if (held && (held.toolType === 'pickaxe' || held.toolType === 'axe')) {
      this.inventory.useDurability(this.inventory.selectedSlot);
    }
  }

  setBlock(tx, ty, blockId) {
    this.worldData[ty][tx] = blockId;
    const key = `${tx},${ty}`;
    if (blockId !== this.originalWorldData[ty][tx]) {
      this.blockChanges[key] = blockId;
    } else {
      delete this.blockChanges[key];
    }
    if (blockId === BLOCK_AIR) {
      this.layer.removeTileAt(tx, ty);
    } else {
      const tile = this.layer.putTileAt(blockId - 1, tx, ty);
      if (tile) {
        const solid = !BLOCKS[blockId] || BLOCKS[blockId].solid !== false;
        tile.setCollision(solid, solid, solid, solid);
      }
    }
  }

  resetMining() { this.miningTarget = null; this.miningProgress = 0; this.miningTime = 0; }

  handleRightClick(pointer) {
    if (!this.targetTile) return;
    const { x: tx, y: ty } = this.targetTile;
    const blockId = this.worldData[ty][tx];

    if (blockId === BLOCK_CRAFTING_TABLE) {
      this.scene.launch('CraftingTableScene', { inventory: this.inventory });
      this.scene.pause();
      return;
    }
    if (blockId === BLOCK_FURNACE) {
      const key = `${tx},${ty}`;
      if (!this.furnaces[key]) {
        this.furnaces[key] = { input: null, fuel: null, output: null, smeltProgress: 0, fuelTime: 0, fuelMaxTime: 0 };
      }
      this.scene.launch('FurnaceScene', { inventory: this.inventory, furnace: this.furnaces[key] });
      this.scene.pause();
      return;
    }

    this.handlePlaceBlock();
  }

  handlePlaceBlock() {
    if (!this.targetTile) return;
    const { x: tx, y: ty } = this.targetTile;
    if (this.worldData[ty][tx] !== BLOCK_AIR) return;

    const slot = this.inventory.getSelectedItem();
    if (!slot) return;
    const itemDef = ITEMS[slot.itemId];
    if (!itemDef || !itemDef.placesBlock) return;

    const bx = tx * TILE_SIZE, by = ty * TILE_SIZE;
    const pb = this.player.sprite.body;
    if (!(bx + TILE_SIZE <= pb.x || bx >= pb.x + pb.width || by + TILE_SIZE <= pb.y || by >= pb.y + pb.height)) return;

    const placeId = itemDef.placesBlock;
    this.setBlock(tx, ty, placeId);

    if (placeId === BLOCK_FURNACE) {
      this.furnaces[`${tx},${ty}`] = { input: null, fuel: null, output: null, smeltProgress: 0, fuelTime: 0, fuelMaxTime: 0 };
    }

    this.inventory.removeFromSlot(this.inventory.selectedSlot, 1);
  }

  spawnDrop(wx, wy, itemId, count) {
    count = count || 1;
    const itemDef = ITEMS[itemId];
    if (!itemDef) return;
    const drop = this.drops.create(wx, wy, itemDef.textureKey);
    drop.setScale(0.6);
    drop.body.setGravityY(400);
    drop.body.setBounceY(0.3);
    drop.body.setVelocity(Phaser.Math.Between(-30, 30), -120);
    drop.body.setCollideWorldBounds(true);
    drop.body.setSize(10, 10);
    drop.setData('itemId', itemId);
    drop.setData('count', count);
    drop.setDepth(5);
  }

  collectDrop(_player, drop) {
    const itemId = drop.getData('itemId');
    const count = drop.getData('count') || 1;
    const remaining = this.inventory.addItem(itemId, count);
    if (remaining === 0) drop.destroy();
    else drop.setData('count', remaining);
  }

  updateFurnaces(delta) {
    const dt = delta / 1000;
    for (const key in this.furnaces) {
      const f = this.furnaces[key];
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
            else if (f.output.itemId === recipe.output) f.output.count++;
          }
        } else { f.smeltProgress = 0; }
      } else {
        if (f.fuel && f.input && getSmeltRecipe(f.input.itemId)) {
          f.fuel.count--;
          if (f.fuel.count <= 0) f.fuel = null;
          f.fuelTime = COAL_BURN_TIME;
          f.fuelMaxTime = COAL_BURN_TIME;
        } else { f.smeltProgress = 0; }
      }
    }
  }

  handleDeath() {
    for (let i = 0; i < this.inventory.slots.length; i++) {
      const slot = this.inventory.slots[i];
      if (slot && Math.random() < 0.5) {
        this.spawnDrop(this.player.sprite.x, this.player.sprite.y, slot.itemId, slot.count);
        this.inventory.slots[i] = null;
      }
    }
    this.saveGame();
    this.scene.launch('DeathScene');
    this.scene.pause();
  }

  respawn() {
    const gen = new WorldGenerator(this.seed);
    gen.generate();
    gen.findSpawnPoint();
    const sp = gen.spawnPoint;
    this.player.sprite.setPosition(sp.x * TILE_SIZE + 8, sp.y * TILE_SIZE + 8);
    this.player.health = MAX_HEALTH;
    this.player.setSpawnProtection();
    this.player.lastGroundY = this.player.sprite.y;
  }

  saveGame() {
    if (this.saveSlot === null) return;
    const data = SaveManager.buildSaveData({
      seed: this.seed,
      blockChanges: this.blockChanges,
      playerX: Math.floor(this.player.sprite.x / TILE_SIZE),
      playerY: Math.floor(this.player.sprite.y / TILE_SIZE),
      health: this.player.health,
      inventory: this.inventory.toJSON(),
      furnaces: this.furnaces,
      createdAt: this.createdAt,
    });
    SaveManager.saveSlot(this.saveSlot, data);
  }

  drawHighlights() {
    this.blockHighlight.clear();
    if (!this.targetTile) return;
    const { x: tx, y: ty } = this.targetTile;
    this.blockHighlight.lineStyle(1, 0xffffff, 0.8);
    this.blockHighlight.strokeRect(tx * TILE_SIZE, ty * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    if (this.miningTarget && this.miningTime > 0) {
      const progress = Math.min(this.miningProgress / this.miningTime, 1);
      this.blockHighlight.fillStyle(0x000000, progress * 0.6);
      this.blockHighlight.fillRect(this.miningTarget.x * TILE_SIZE, this.miningTarget.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }
  }
}
