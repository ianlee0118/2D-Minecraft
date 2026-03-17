import {
  TILE_SIZE, WORLD_WIDTH, WORLD_HEIGHT,
  PLAYER_REACH, GAME_WIDTH, GAME_HEIGHT, HOTBAR_SLOTS, MAX_HEALTH,
  AUTOSAVE_INTERVAL, COAL_BURN_TIME, DAY_LENGTH, NIGHT_START, NIGHT_END, DAWN_START,
  TORCH_SUPPRESS_RADIUS, PISTOL_COOLDOWN, PISTOL_DAMAGE, PISTOL_RANGE, PISTOL_SPEED,
  WARDEN_KILL_THRESHOLD,
} from '../constants.js';
import { soundManager } from '../audio/SoundManager.js';
import { gameLogger } from '../utils/GameLogger.js';
import { BLOCK_AIR, BLOCK_CRAFTING_TABLE, BLOCK_FURNACE, BLOCK_TORCH, BLOCKS } from '../blocks.js';
import { ITEMS } from '../items.js';
import { SMELTING_RECIPES } from '../crafting/recipes.js';
import { WorldGenerator } from '../world/WorldGenerator.js';
import { Inventory } from '../inventory/Inventory.js';
import { PlayerController } from '../player/PlayerController.js';
import { SaveManager } from '../save/SaveManager.js';
import { EnemyManager } from '../enemies/EnemyManager.js';
import { CombatSystem } from '../combat/CombatSystem.js';

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
    this.surfaceHeights = gen.surfaceHeights;

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
      this.inventory.addItem('wooden_sword', 1);
      this.inventory.addItem('dirt', 32);
      this.inventory.addItem('wood_log', 16);
      this.inventory.addItem('torch', 8);
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

    this.dayTime = this.loadData && this.loadData.dayTime !== undefined ? this.loadData.dayTime : 0;
    this.isNight = false;
    this.nightOverlay = this.add.graphics().setDepth(50).setScrollFactor(0);
    this.torchLightGfx = this.add.graphics().setDepth(3);

    this.enemyManager = new EnemyManager(this);
    this.combat = new CombatSystem(this);

    this.killCount = 0;
    this.wardenUnlocked = false;
    this.wardenActive = false;
    this.wardenSpawnPending = false;

    this.input.mouse.disableContextMenu();
    this.input.on('pointerdown', (pointer) => {
      if (pointer.rightButtonDown()) this.handleRightClick(pointer);
    });
    this.input.on('pointerup', (pointer) => {
      if (pointer.button === 0) this.combat.handleLeftRelease();
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
      this.scene.launch('InventoryScene', { inventory: this.inventory, player: this.player });
    });

    this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.BACK_SLASH).on('down', () => {
      this.player.godMode = !this.player.godMode;
      if (this.player.godMode) {
        this.player.health = MAX_HEALTH;
      } else {
        this.player.disableFlight();
      }
    });

    this.scene.launch('HUDScene', { inventory: this.inventory, player: this.player, gameScene: this });
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
    try {
      if (!this.player?.sprite?.active) return;
      this.player.update(delta);
      this.updateTarget();

    const pointer = this.input.activePointer;
    const held = this.inventory.getSelectedItemDef();
    const isBow = held && held.toolType === 'bow';
    const isSword = held && held.toolType === 'sword';
    const isWeapon = isBow || isSword || (!held || !held.toolType);

    const isPistol = held && held.toolType === 'pistol';

    if (pointer.leftButtonDown() && !pointer.rightButtonDown()) {
      if (held && held.spawnsEnemy && this.targetTile) {
        if (!this._spawnUsed) {
          this._spawnUsed = true;
          const wx = this.targetTile.x * TILE_SIZE + TILE_SIZE / 2;
          const wy = this.targetTile.y * TILE_SIZE + TILE_SIZE / 2;
          this.spawnEnemyAt(held.spawnsEnemy, wx, wy);
        }
      } else if (isPistol) {
        if (this.combat.attackCooldown <= 0) {
          this.firePistolSP(pointer);
        }
      } else if (isBow) {
        if (!this.combat.bowDrawing) this.combat.handleLeftClick(pointer);
      } else if (this.targetTile && this.worldData[this.targetTile.y][this.targetTile.x] !== BLOCK_AIR && !isSword) {
        this.handleMining(delta);
      } else {
        if (this.combat.attackCooldown <= 0) this.combat.handleLeftClick(pointer);
        this.resetMining();
      }
    } else {
      this._spawnUsed = false;
      this.resetMining();
    }

    this.combat.update(delta);
    this.combat.checkPlayerArrowsVsEnemies();
    this.updateBullets(delta);

    this.updateDayNight(delta);
    this.enemyManager.update(delta, this.isNight);

    this.drawHighlights();
    this.drawTorchLights();
    this.updateFurnaces(delta);

    this.autoSaveTimer += delta / 1000;
    if (this.autoSaveTimer >= AUTOSAVE_INTERVAL && this.saveSlot !== null) {
      this.autoSaveTimer = 0;
      this.saveGame();
    }
    } catch (err) {
      gameLogger.error('GameScene update:', err);
      gameLogger.logMemory();
    }
  }

  updateDayNight(delta) {
    this.dayTime = (this.dayTime + delta / 1000) % DAY_LENGTH;
    const phase = this.dayTime / DAY_LENGTH;

    let darkness = 0;
    if (phase >= NIGHT_START && phase < NIGHT_END) {
      darkness = 0.6;
    } else if (phase >= NIGHT_END) {
      const t = (phase - NIGHT_END) / (1.0 - NIGHT_END);
      darkness = 0.6 * (1 - t);
    } else if (phase >= NIGHT_START - 0.1 && phase < NIGHT_START) {
      const t = (phase - (NIGHT_START - 0.1)) / 0.1;
      darkness = 0.6 * t;
    }

    this.isNight = phase >= NIGHT_START && phase < 1.0;

    this.nightOverlay.clear();
    if (darkness > 0.01) {
      this.nightOverlay.fillStyle(0x000022, darkness);
      this.nightOverlay.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    }

    const skyR = Math.floor(135 * (1 - darkness * 0.8));
    const skyG = Math.floor(206 * (1 - darkness * 0.8));
    const skyB = Math.floor(235 * (1 - darkness * 0.7));
    this.cameras.main.setBackgroundColor(Phaser.Display.Color.GetColor(skyR, skyG, skyB));
  }

  drawTorchLights() {
    this.torchLightGfx.clear();
    const cam = this.cameras.main;
    const viewLeft = cam.scrollX - 32;
    const viewRight = cam.scrollX + cam.width / cam.zoom + 32;
    const viewTop = cam.scrollY - 32;
    const viewBottom = cam.scrollY + cam.height / cam.zoom + 32;

    const txMin = Math.max(0, Math.floor(viewLeft / TILE_SIZE));
    const txMax = Math.min(WORLD_WIDTH - 1, Math.ceil(viewRight / TILE_SIZE));
    const tyMin = Math.max(0, Math.floor(viewTop / TILE_SIZE));
    const tyMax = Math.min(WORLD_HEIGHT - 1, Math.ceil(viewBottom / TILE_SIZE));

    for (let ty = tyMin; ty <= tyMax; ty++) {
      for (let tx = txMin; tx <= txMax; tx++) {
        if (this.worldData[ty][tx] === BLOCK_TORCH) {
          const cx = tx * TILE_SIZE + TILE_SIZE / 2;
          const cy = ty * TILE_SIZE + TILE_SIZE / 2;
          const radius = TILE_SIZE * 4;
          this.torchLightGfx.fillStyle(0xffcc33, 0.08);
          this.torchLightGfx.fillCircle(cx, cy, radius);
          this.torchLightGfx.fillStyle(0xffaa00, 0.12);
          this.torchLightGfx.fillCircle(cx, cy, radius * 0.5);
          this.torchLightGfx.fillStyle(0xffdd44, 0.15);
          this.torchLightGfx.fillCircle(cx, cy, radius * 0.25);
        }
      }
    }
  }

  spawnEnemyArrow(fromX, fromY, targetSprite) {
    this.combat.spawnEnemyArrow(fromX, fromY, targetSprite);
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
    if (!this._lastMineSound) this._lastMineSound = 0;
    this._lastMineSound += delta / 1000;
    if (this._lastMineSound >= 0.25) { this._lastMineSound = 0; soundManager.play('mine_hit'); }
    if (this.miningProgress >= this.miningTime) {
      this.breakBlock(x, y);
      this.resetMining();
    }
  }

  calcMiningTime(blockDef, heldItem) {
    if (this.player.godMode) return 0.1;
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
    soundManager.play('block_break');

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
      return;
    }
    if (blockId === BLOCK_FURNACE) {
      const key = `${tx},${ty}`;
      if (!this.furnaces[key]) {
        this.furnaces[key] = { input: null, fuel: null, output: null, smeltProgress: 0, fuelTime: 0, fuelMaxTime: 0 };
      }
      this.scene.launch('FurnaceScene', { inventory: this.inventory, furnace: this.furnaces[key] });
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
    if (remaining === 0) { drop.destroy(); soundManager.play('item_pickup'); }
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
      dayTime: this.dayTime,
    });
    SaveManager.saveSlot(this.saveSlot, data);
  }

  toggleDayNight() {
    const phase = this.dayTime / DAY_LENGTH;
    this.dayTime = phase < NIGHT_START ? NIGHT_START * DAY_LENGTH : 0;
  }

  spawnEnemyAt(type, wx, wy) {
    if (!this.enemyManager) return;
    this.enemyManager.createEnemy(wx, wy, type);
  }

  onEnemyKilled(type) {
    if (type === 'warden') return;
    this.killCount++;
    if (this.killCount === WARDEN_KILL_THRESHOLD && !this.wardenUnlocked) {
      this.wardenUnlocked = true;
      this.triggerWardenEvent();
    }
    if (this.killCount > WARDEN_KILL_THRESHOLD && this.killCount % WARDEN_KILL_THRESHOLD === 0 && !this.wardenActive) {
      this.triggerWardenEvent();
    }
  }

  onWardenKilled() {
    this.wardenActive = false;
    const hud = this.scene.get('HUDScene');
    if (hud && hud.flashMessage) hud.flashMessage('The Warden has been defeated!');
  }

  triggerWardenEvent() {
    if (this.wardenActive) return;
    this.wardenActive = true;
    soundManager.play('warden_spawn');
    this.cameras.main.shake(600, 0.008);

    const hud = this.scene.get('HUDScene');
    if (hud && hud.flashMessage) hud.flashMessage('A WARDEN HAS APPEARED!');

    this.time.delayedCall(1500, () => {
      if (this.enemyManager) this.spawnWardenNearPlayer();
    });
  }

  spawnWardenNearPlayer() {
    const px = this.player.sprite.x;
    const ptx = Math.floor(px / TILE_SIZE);
    for (let r = 8; r < 30; r++) {
      for (const dir of [1, -1]) {
        const tx = ptx + dir * r;
        if (tx < 2 || tx >= WORLD_WIDTH - 2) continue;
        const sy = this.surfaceHeights[tx];
        if (sy <= 2 || sy >= WORLD_HEIGHT - 2) continue;
        if (this.worldData[sy - 1][tx] !== BLOCK_AIR) continue;
        if (this.worldData[sy - 2][tx] !== BLOCK_AIR) continue;
        if (this.worldData[sy - 3][tx] !== BLOCK_AIR) continue;
        const wx = tx * TILE_SIZE + TILE_SIZE / 2;
        const wy = (sy - 3) * TILE_SIZE + TILE_SIZE / 2;
        this.enemyManager.createEnemy(wx, wy, 'warden');
        return;
      }
    }
  }

  firePistolSP(pointer) {
    this.combat.attackCooldown = PISTOL_COOLDOWN;
    soundManager.play('pistol_shot');
    const px = this.player.sprite.x;
    const py = this.player.sprite.y - 4;
    const wp = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const dx = wp.x - px, dy = wp.y - py;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const vx = (dx / dist) * PISTOL_SPEED, vy = (dy / dist) * PISTOL_SPEED;

    if (!this._bullets) this._bullets = [];
    if (this._bullets.length >= 20) return;
    const bullet = this.add.sprite(px, py, 'bullet_proj').setDepth(6);
    const b = { sprite: bullet, vx, vy, life: 0, maxLife: PISTOL_RANGE * TILE_SIZE / PISTOL_SPEED };
    this._bullets.push(b);
  }

  updateBullets(delta) {
    if (!this._bullets) return;
    const dt = delta / 1000;
    for (let i = this._bullets.length - 1; i >= 0; i--) {
      const b = this._bullets[i];
      if (!b?.sprite?.active) { this._bullets.splice(i, 1); continue; }
      b.sprite.x += b.vx * dt;
      b.sprite.y += b.vy * dt;
      b.sprite.rotation = Math.atan2(b.vy, b.vx);
      b.life += dt;

      const tx = Math.floor(b.sprite.x / TILE_SIZE);
      const ty = Math.floor(b.sprite.y / TILE_SIZE);

      if (b.life >= b.maxLife) {
        b.sprite.destroy(); this._bullets.splice(i, 1); continue;
      }

      if (tx >= 0 && tx < WORLD_WIDTH && ty >= 0 && ty < WORLD_HEIGHT &&
          this.worldData[ty][tx] !== BLOCK_AIR) {
        const blockDef = BLOCKS[this.worldData[ty][tx]];
        if (blockDef && blockDef.hardness > 0) {
          this.setBlock(tx, ty, BLOCK_AIR);
          if (blockDef.drops) this.spawnDrop(tx * TILE_SIZE + 8, ty * TILE_SIZE + 8, blockDef.drops);
          soundManager.play('block_break');
        }
        b.sprite.destroy(); this._bullets.splice(i, 1); continue;
      }

      let hitEnemy = false;
      for (const enemy of this.enemyManager.enemies) {
        if (enemy.dead) continue;
        const d = Math.sqrt((b.sprite.x - enemy.sprite.x) ** 2 + (b.sprite.y - enemy.sprite.y) ** 2);
        if (d < TILE_SIZE * 1.2) {
          enemy.takeDamage(PISTOL_DAMAGE, b.sprite.x);
          soundManager.play('enemy_hurt');
          hitEnemy = true; break;
        }
      }
      if (hitEnemy) { b.sprite.destroy(); this._bullets.splice(i, 1); }
    }
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
