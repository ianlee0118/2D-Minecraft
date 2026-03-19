import {
  TILE_SIZE, WORLD_WIDTH, WORLD_HEIGHT,
  PLAYER_REACH, GAME_WIDTH, GAME_HEIGHT, HOTBAR_SLOTS, MAX_HEALTH,
  COAL_BURN_TIME, DAY_LENGTH, NIGHT_START, NIGHT_END,
  MELEE_COOLDOWN, MELEE_RANGE, FIST_DAMAGE, KNOCKBACK_FORCE,
  BOW_DRAW_TIME, ARROW_SPEED, ARROW_DAMAGE, ARROW_GRAVITY, ATTACK_INVULN,
  PISTOL_COOLDOWN, PISTOL_DAMAGE, PISTOL_RANGE, PISTOL_SPEED,
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
import { SpriteAnimator } from '../anim/SpriteAnimator.js';
import { isBumEnabled, BUM_POOP_DAMAGE, BUM_POOP_SPEED, BUM_POOP_GRAVITY, BUM_POOP_COOLDOWN } from '../character/BrownUnderwearMode.js';
import { BusSpawnSequence } from '../character/BusSpawnSequence.js';

function getSmeltRecipe(id) { return SMELTING_RECIPES.find(r => r.input === id) || null; }

const REMOTE_COLORS = [0x55aaff, 0xff55aa, 0xaaff55, 0xffaa55];
const ENEMY_TEXTURES = { zombie: 'enemy_zombie', skeleton: 'enemy_skeleton', cave_spider: 'enemy_spider', warden: 'enemy_warden' };

export class MultiplayerGameScene extends Phaser.Scene {
  constructor() { super('MultiplayerGameScene'); }

  init(data) {
    this.network = data.network;
    this.gameState = data.gameState;
    this.myName = data.myName || 'Player';
  }

  create() {
    gameLogger.info('MultiplayerGameScene.create()');
    const gs = this.gameState;

    const gen = new WorldGenerator(gs.seed);
    const result = gen.generate();
    gameLogger.info('MultiplayerGameScene: world generated');
    this.worldData = result.data;
    this.surfaceHeights = gen.surfaceHeights;

    if (gs.blockChanges) {
      for (const [key, blockId] of Object.entries(gs.blockChanges)) {
        const [tx, ty] = key.split(',').map(Number);
        if (ty >= 0 && ty < WORLD_HEIGHT && tx >= 0 && tx < WORLD_WIDTH) {
          this.worldData[ty][tx] = blockId;
        }
      }
    }

    this.createTilemap();

    this.inventory = new Inventory();
    this.inventory.addItem('wooden_pickaxe', 1);
    this.inventory.addItem('wooden_axe', 1);
    this.inventory.addItem('wooden_sword', 1);
    this.inventory.addItem('dirt', 32);
    this.inventory.addItem('wood_log', 16);
    this.inventory.addItem('torch', 8);
    this.syncInventoryToServer();

    this.player = new PlayerController(this, gs.spawnX, gs.spawnY);
    this.physics.add.collider(this.player.sprite, this.layer);
    this.isDead = false;
    this.killCount = 0;
    this.wardenActive = false;

    this.netDrops = new Map();
    this.dropGroup = this.physics.add.group();
    this.physics.add.collider(this.dropGroup, this.layer);
    this.physics.add.overlap(this.player.sprite, this.dropGroup, (_p, d) => this.tryPickup(d), null, this);

    if (gs.drops) {
      for (const d of gs.drops) this.createDropSprite(d);
    }

    this.furnaces = {};
    for (let y = 0; y < WORLD_HEIGHT; y++) {
      for (let x = 0; x < WORLD_WIDTH; x++) {
        if (this.worldData[y][x] === BLOCK_FURNACE) {
          this.furnaces[`${x},${y}`] = { input: null, fuel: null, output: null, smeltProgress: 0, fuelTime: 0, fuelMaxTime: 0 };
        }
      }
    }

    this.cameras.main.setZoom(2);
    this.cameras.main.setRoundPixels(true);
    this.cameras.main.startFollow(this.player.sprite, true, 0.15, 0.15);
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH * TILE_SIZE, WORLD_HEIGHT * TILE_SIZE);
    this.cameras.main.setBackgroundColor('#87CEEB');
    this.physics.world.setBounds(0, 0, WORLD_WIDTH * TILE_SIZE, WORLD_HEIGHT * TILE_SIZE);

    this.blockHighlight = this.add.graphics();
    this.targetTile = null;
    this.miningTarget = null;
    this.miningProgress = 0;
    this.miningTime = 0;

    this.dayTime = gs.dayTime || 0;
    this.isNight = false;
    this.nightOverlay = this.add.graphics().setDepth(50).setScrollFactor(0);
    this.torchLightGfx = this.add.graphics().setDepth(3);

    this.pvpEnabled = gs.pvpEnabled || false;

    this.remotePlayers = {};
    if (gs.players) {
      for (const p of gs.players) {
        if (p.id !== this.network.id) this.addRemotePlayer(p.id, p.name);
      }
    }

    this.mpEnemies = {};
    if (gs.enemies) {
      for (const e of gs.enemies) this.addEnemySprite(e);
    }

    this.arrowSprites = {};

    this.attackCooldown = 0;
    this.bowDrawing = false;
    this.bowDrawTime = 0;
    this.combat = { bowDrawing: false, bowDrawTime: 0 };

    this.positionTimer = 0;
    this.invSyncTimer = 0;

    this.deathOverlay = null;
    this.deathText = null;
    this.respawnBtn = null;

    this.setupInput();
    this.setupNetworkListeners();

    this.scene.launch('HUDScene', { inventory: this.inventory, player: this.player, gameScene: this });

    this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.BACK_SLASH).on('down', () => {
      this.player.godMode = !this.player.godMode;
      if (this.player.godMode) this.player.health = MAX_HEALTH;
      else this.player.disableFlight();
      this.network.emit('godmode_toggle', { enabled: this.player.godMode });
    });

    this.bumMode = isBumEnabled();
    this.busSpawn = null;
    this.poopCooldown = 0;
    this._poopBullets = [];
    if (this.bumMode) {
      this.busSpawn = new BusSpawnSequence(this, this.player.sprite, false);
      this.player.setSpawnProtection();
      this.network.emit('player_move', {
        x: this.player.sprite.x, y: this.player.sprite.y,
        flipX: false, bumMode: true,
      });
      this.input.keyboard.on('keydown-J', () => {
        if (this.isDead) return;
        if (this.busSpawn && !this.busSpawn.done) return;
        if (!this.player?.sprite?.active) return;
        if (this.poopCooldown > 0) return;
        this.poopCooldown = BUM_POOP_COOLDOWN;
        const px = this.player.sprite.x;
        const py = this.player.sprite.y;
        const flipX = this.player.sprite.flipX;
        const dir = flipX ? -1 : 1;
        const vx = BUM_POOP_SPEED * dir;
        const vy = -BUM_POOP_SPEED * 0.35;
        this.network.emit('fire_poop', { x: px, y: py - 4, vx, vy });
        this.spawnPoopBullet(px + dir * 6, py - 4, vx, vy);
        soundManager.play('poop_throw');
      });
    }

    this.gameState = null;
    gameLogger.info('MultiplayerGameScene.create() complete — bumMode:', !!this.bumMode);
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

  setupInput() {
    this.input.mouse.disableContextMenu();
    this.input.on('pointerdown', (pointer) => {
      if (this.isDead) return;
      if (pointer.rightButtonDown()) {
        const uiOpen = this.scene.isActive('InventoryScene') || this.scene.isActive('CraftingTableScene') || this.scene.isActive('FurnaceScene');
        if (!uiOpen) this.handleRightClick();
      }
    });
    this.input.on('pointerup', (pointer) => {
      if (pointer.button === 0 && this.bowDrawing) this.handleBowRelease();
    });
    this.input.on('wheel', (_p, _go, _dx, dy) => {
      this.inventory.selectedSlot = ((this.inventory.selectedSlot + (dy > 0 ? 1 : -1)) % HOTBAR_SLOTS + HOTBAR_SLOTS) % HOTBAR_SLOTS;
      this.network.emit('select_slot', { slot: this.inventory.selectedSlot });
    });
    for (let i = 0; i < 9; i++) {
      const key = this.input.keyboard.addKey(49 + i);
      key.on('down', () => {
        this.inventory.selectedSlot = i;
        this.network.emit('select_slot', { slot: i });
      });
    }
    this.input.keyboard.on('keydown-ESC', () => this.leaveGame());
    this.input.keyboard.on('keydown-E', () => {
      if (this.scene.isActive('CraftingTableScene') || this.scene.isActive('FurnaceScene')) return;
      if (!this.isDead) this.scene.launch('InventoryScene', { inventory: this.inventory, player: this.player });
    });
  }

  setupNetworkListeners() {
    this.network.on('player_moved', (d) => this.onRemotePlayerMove(d));
    this.network.on('player_joined', (d) => this.addRemotePlayer(d.id, d.name));
    this.network.on('player_left', (d) => this.removeRemotePlayer(d.id));
    this.network.on('player_list', (d) => {
      for (const p of d.players) {
        if (p.id !== this.network.id && !this.remotePlayers[p.id]) {
          this.addRemotePlayer(p.id, p.name);
        }
      }
    });
    this.network.on('block_changed', (d) => this.onBlockChanged(d));
    this.network.on('drop_spawned', (d) => this.createDropSprite(d));
    this.network.on('drop_removed', (d) => this.removeDropSprite(d.dropId));
    this.network.on('drop_picked_up', (d) => {
      this.inventory.addItem(d.itemId, d.count);
      soundManager.play('item_pickup');
      this.syncInventoryToServer();
    });
    this.network.on('player_slot_changed', (d) => {
      const rp = this.remotePlayers[d.id];
      if (rp) rp.slot = d.slot;
    });

    this.network.on('enemies_sync', (enemies) => this.onEnemiesSync(enemies));
    this.network.on('enemy_spawned', (d) => this.addEnemySprite(d));
    this.network.on('enemy_removed', (d) => this.removeEnemySprite(d.id));
    this.network.on('enemy_died', (d) => {
      const me = this.mpEnemies[d.id];
      const wasWarden = me && me.type === 'warden';
      this.removeEnemySprite(d.id);
      soundManager.play(wasWarden ? 'warden_death' : 'enemy_death');
      for (const drop of d.drops) {
        this.createDropSprite(drop);
      }
    });
    this.network.on('enemy_hit', (d) => {
      const me = this.mpEnemies[d.id];
      if (me) {
        if (me.anim) me.anim.setTint(0xff4444);
        soundManager.play(me.type === 'warden' ? 'warden_hit' : 'enemy_hurt');
        this.time.delayedCall(150, () => { if (me.anim) me.anim.clearTint(); });
      }
    });

    this.network.on('warden_spawned', (d) => {
      soundManager.play('warden_spawn');
      this.cameras.main.shake(600, 0.008);
      this.wardenActive = true;
      const hud = this.scene.get('HUDScene');
      if (hud && hud.flashMessage) hud.flashMessage('A WARDEN HAS APPEARED!');
      this.addEnemySprite(d);
    });
    this.network.on('warden_defeated', (d) => {
      this.wardenActive = false;
      const hud = this.scene.get('HUDScene');
      if (hud && hud.flashMessage) hud.flashMessage('The Warden has been defeated!');
    });
    this.network.on('kill_count', (d) => {
      this.killCount = d.total || 0;
    });

    this.network.on('arrow_fired', (d) => this.onArrowFired(d));
    this.network.on('arrow_removed', (d) => this.removeArrowSprite(d.id));

    this.network.on('player_damaged', (d) => {
      if (d.id === this.network.id) {
        this.player.health = d.health;
        this.player.invulnTime = ATTACK_INVULN;
        soundManager.play('player_hurt');
        if (this.player.anim) this.player.anim.setTint(0xff4444);
        this.time.delayedCall(200, () => { if (this.player.anim) this.player.anim.clearTint(); });
        if (d.fromX !== undefined && d.fromY !== undefined) {
          const dx = this.player.sprite.x - d.fromX;
          const dy = this.player.sprite.y - d.fromY;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          this.player.sprite.body.setVelocity(
            (dx / dist) * KNOCKBACK_FORCE,
            Math.min(-100, (dy / dist) * KNOCKBACK_FORCE - 80)
          );
        }
      } else {
        const rp = this.remotePlayers[d.id];
        if (rp) {
          if (rp.anim) rp.anim.setTint(0xff4444);
          this.time.delayedCall(200, () => { if (rp.anim) rp.anim.clearTint(); });
        }
      }
    });

    this.network.on('player_attacked', (d) => {
      if (d.id === this.network.id) return;
    });

    this.network.on('you_died', (d) => {
      this.isDead = true;
      if (d.keptInventory) {
        this.inventory.slots = d.keptInventory.map(s => s ? { ...s } : null);
        while (this.inventory.slots.length < this.inventory.totalSlots) this.inventory.slots.push(null);
      }
      this.player.health = 0;
      this.player.sprite.body.setVelocity(0, 0);
      this.player.sprite.body.setAllowGravity(false);
      this.player.sprite.body.enable = false;
      this.player.sprite.setVisible(false);
      this.cameras.main.stopFollow();
      this.showDeathScreen();
    });
    this.network.on('player_died', (d) => {
      if (d.id === this.network.id) return;
      const rp = this.remotePlayers[d.id];
      if (rp) rp.sprite.setVisible(false);
      for (const drop of d.drops) this.createDropSprite(drop);
    });

    this.network.on('you_respawned', (d) => {
      this.isDead = false;
      this.player.health = d.health;
      this.player.sprite.setVisible(true);
      this.player.sprite.body.enable = true;
      this.player.sprite.body.setAllowGravity(true);
      this.player.sprite.body.setVelocity(0, 0);
      this.player.sprite.setPosition(d.x * TILE_SIZE + TILE_SIZE / 2, d.y * TILE_SIZE + TILE_SIZE / 2);
      this.player.lastGroundY = this.player.sprite.y;
      this.player.invulnTime = 2.5;
      this.attackCooldown = 1.0;
      this.cameras.main.startFollow(this.player.sprite, true, 0.1, 0.1);
      if (d.keptInventory) {
        this.inventory.slots = d.keptInventory.map(s => s ? { ...s } : null);
        while (this.inventory.slots.length < this.inventory.totalSlots) this.inventory.slots.push(null);
      }
      this.hideDeathScreen();
      this.syncInventoryToServer();
      if (this.bumMode) {
        this.busSpawn = new BusSpawnSequence(this, this.player.sprite, true);
      }
    });
    this.network.on('player_respawned', (d) => {
      if (d.id === this.network.id) return;
      const rp = this.remotePlayers[d.id];
      if (rp) {
        rp.sprite.setVisible(true);
        rp.targetX = d.x;
        rp.targetY = d.y;
        rp.sprite.setPosition(d.x, d.y);
      }
    });

    this.network.on('pvp_changed', (d) => {
      this.pvpEnabled = d.enabled;
      const hud = this.scene.get('HUDScene');
      if (hud?.flashMessage) hud.flashMessage(`PvP ${d.enabled ? 'ON' : 'OFF'}`);
    });

    this.network.on('time_changed', (d) => {
      this.dayTime = d.dayTime;
    });
  }

  addRemotePlayer(id, name) {
    if (this.remotePlayers[id]) return;
    const idx = Object.keys(this.remotePlayers).length;
    const sprite = this.physics.add.sprite(0, 0, 'player');
    sprite.setOrigin(0.5, 0.5);
    sprite.body.setAllowGravity(false);
    sprite.body.setImmovable(true);
    sprite.setDepth(4);
    const anim = new SpriteAnimator(this, sprite, 'player', {
      depth: 4, tint: REMOTE_COLORS[idx % REMOTE_COLORS.length],
    });
    const label = this.add.text(0, 0, name || 'Player', {
      fontSize: '8px', fontFamily: 'monospace', color: '#fff',
      stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5, 1).setDepth(5);
    this.remotePlayers[id] = { sprite, anim, label, targetX: 0, targetY: 0, slot: 0, lastX: 0 };
  }

  removeRemotePlayer(id) {
    const rp = this.remotePlayers[id];
    if (!rp) return;
    if (rp.anim) rp.anim.destroy();
    rp.sprite.destroy();
    rp.label.destroy();
    delete this.remotePlayers[id];
  }

  onRemotePlayerMove(d) {
    const rp = this.remotePlayers[d.id];
    if (!rp) return;
    rp.targetX = d.x;
    rp.targetY = d.y;
    rp.sprite.setFlipX(d.flipX);
    if (d.bumMode && !rp.bumMode) {
      rp.bumMode = true;
      if (rp.anim) rp.anim.destroy();
      rp.sprite.setTexture('bum_player');
      const idx = Object.keys(this.remotePlayers).indexOf(d.id);
      rp.anim = new SpriteAnimator(this, rp.sprite, 'bum_player', {
        depth: 4, tint: REMOTE_COLORS[Math.abs(idx) % REMOTE_COLORS.length],
      });
    }
  }

  addEnemySprite(e) {
    const id = e.id;
    if (this.mpEnemies[id] != null) return;
    const texture = ENEMY_TEXTURES[e.type] || 'enemy_zombie';
    const sprite = this.add.sprite(e.x, e.y, texture).setDepth(4).setOrigin(0.5, 0.5);
    const anim = new SpriteAnimator(this, sprite, texture, {
      depth: 4,
      scale: e.type === 'warden' ? 0.75 : undefined,
      showTool: e.type === 'skeleton',
    });
    if (e.type === 'skeleton') {
      anim.setToolTexture(ITEMS.bow.textureKey);
    }
    this.mpEnemies[id] = { sprite, anim, targetX: e.x, targetY: e.y, type: e.type, direction: e.direction ?? 1, lastX: e.x };
  }

  removeEnemySprite(id) {
    const me = this.mpEnemies[id];
    if (!me) return;
    if (me.anim) me.anim.destroy();
    me.sprite.destroy();
    delete this.mpEnemies[id];
  }

  onEnemiesSync(enemies) {
    const seen = new Set();
    for (const e of enemies) {
      const id = e.id;
      seen.add(id);
      seen.add(String(id));
      if (this.mpEnemies[id] == null) {
        this.addEnemySprite(e);
      } else {
        this.mpEnemies[id].targetX = e.x;
        this.mpEnemies[id].targetY = e.y;
        this.mpEnemies[id].direction = e.direction;
      }
    }
    for (const id of Object.keys(this.mpEnemies)) {
      const numId = Number(id);
      if (!seen.has(id) && !seen.has(numId)) this.removeEnemySprite(numId);
    }
  }

  onArrowFired(d) {
    const sprite = this.add.sprite(d.x, d.y, 'arrow_proj').setDepth(6);
    this.arrowSprites[d.id] = { sprite, vx: d.vx, vy: d.vy };
  }

  removeArrowSprite(id) {
    const a = this.arrowSprites[id];
    if (a) { a.sprite.destroy(); delete this.arrowSprites[id]; }
  }

  onBlockChanged({ tx, ty, blockId }) {
    if (tx < 0 || tx >= WORLD_WIDTH || ty < 0 || ty >= WORLD_HEIGHT) return;
    this.worldData[ty][tx] = blockId;
    if (blockId === BLOCK_AIR) {
      this.layer.removeTileAt(tx, ty);
      delete this.furnaces[`${tx},${ty}`];
    } else {
      const tile = this.layer.putTileAt(blockId - 1, tx, ty);
      if (tile) {
        const solid = !BLOCKS[blockId] || BLOCKS[blockId].solid !== false;
        tile.setCollision(solid, solid, solid, solid);
      }
      if (blockId === BLOCK_FURNACE) {
        this.furnaces[`${tx},${ty}`] = { input: null, fuel: null, output: null, smeltProgress: 0, fuelTime: 0, fuelMaxTime: 0 };
      }
    }
  }

  createDropSprite(d) {
    if (this.netDrops.has(d.id)) return;
    const itemDef = ITEMS[d.itemId];
    if (!itemDef) return;
    const sprite = this.dropGroup.create(d.x, d.y, itemDef.textureKey);
    sprite.setScale(0.6);
    sprite.body.setGravityY(400);
    sprite.body.setBounceY(0.3);
    sprite.body.setCollideWorldBounds(true);
    sprite.body.setSize(10, 10);
    sprite.setData('dropId', d.id);
    sprite.setDepth(5);
    this.netDrops.set(d.id, sprite);
  }

  removeDropSprite(dropId) {
    const sprite = this.netDrops.get(dropId);
    if (sprite) { sprite.destroy(); this.netDrops.delete(dropId); }
  }

  tryPickup(dropSprite) {
    if (this.isDead) return;
    const dropId = dropSprite.getData('dropId');
    if (!dropId) return;
    this.network.emit('pickup_drop', { dropId });
  }

  handleDeath() {
    // Handled by server via 'you_died' event
  }

  showDeathScreen() {
    this.hideDeathScreen();
    soundManager.play('player_death');
    const px = this.player.sprite.x;
    const py = this.player.sprite.y;

    this.deathOverlay = this.add.rectangle(px, py, 800, 600, 0x330000, 0.85)
      .setDepth(100);
    this.deathText = this.add.text(px, py - 30, 'You Died!', {
      fontSize: '24px', fontFamily: 'monospace', color: '#ff4444', fontStyle: 'bold',
    }).setDepth(101).setOrigin(0.5);
    this.respawnBtn = this.add.text(px, py + 20, 'Respawn', {
      fontSize: '16px', fontFamily: 'monospace', color: '#eee',
      backgroundColor: '#555', padding: { x: 20, y: 8 },
    }).setDepth(101).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.respawnBtn.on('pointerover', () => this.respawnBtn.setBackgroundColor('#777'));
    this.respawnBtn.on('pointerout', () => this.respawnBtn.setBackgroundColor('#555'));
    this.respawnBtn.on('pointerdown', () => {
      soundManager.play('click');
      this.network.emit('request_respawn');
    });
  }

  hideDeathScreen() {
    if (this.deathOverlay) { this.deathOverlay.destroy(); this.deathOverlay = null; }
    if (this.deathText) { this.deathText.destroy(); this.deathText = null; }
    if (this.respawnBtn) { this.respawnBtn.destroy(); this.respawnBtn = null; }
  }

  update(_time, delta) {
    try {
      if (this.busSpawn && !this.busSpawn.done) {
        this.busSpawn.update(delta);
        this.updatePoopBullets(delta);
        this.updateRemotePlayers();
        this.updateEnemySprites();
        return;
      }
      if (this.isDead) {
        this.updateRemotePlayers();
        this.updateEnemySprites();
        this.updateArrowSprites(delta);
        this.updateDayNight(delta);
        return;
      }

      if (!this.player?.sprite?.active) return;
      this.player.update(delta);
      const heldDef = this.inventory.getSelectedItemDef();
      this.player.setHeldTool(heldDef?.textureKey ?? null);
    this.updateTarget();

    const dt = delta / 1000;
    if (this.attackCooldown > 0) this.attackCooldown -= dt;
    if (this.poopCooldown > 0) this.poopCooldown -= dt;

    const modalOpen = this.scene.isActive('InventoryScene') || this.scene.isActive('CraftingTableScene') || this.scene.isActive('FurnaceScene');

    const pointer = this.input.activePointer;
    const held = this.inventory.getSelectedItemDef();
    const isBow = held && held.toolType === 'bow';
    const isSword = held && held.toolType === 'sword';
    const isPistol = held && held.toolType === 'pistol';

    const isSpawner = held && held.spawnsEnemy;

    if (modalOpen) {
      this.resetMining();
      this._spawnUsed = false;
      this.bowDrawing = false;
      this.bowDrawTime = 0;
    } else if (pointer.leftButtonDown() && !pointer.rightButtonDown()) {
      if (isSpawner && this.targetTile) {
        if (!this._spawnUsed) {
          this._spawnUsed = true;
          const wx = this.targetTile.x * TILE_SIZE + TILE_SIZE / 2;
          const wy = this.targetTile.y * TILE_SIZE + TILE_SIZE / 2;
          this.network.emit('spawn_enemy', { type: held.spawnsEnemy, x: wx, y: wy });
        }
      } else if (isPistol) {
        if (this.attackCooldown <= 0) {
          this.firePistolMP(pointer);
        }
      } else if (isBow) {
        if (!this.bowDrawing) {
          this.bowDrawing = true;
          this.bowDrawTime = 0;
        }
        this.bowDrawTime += dt;
        this.combat.bowDrawing = true;
        this.combat.bowDrawTime = this.bowDrawTime;
      } else if (this.targetTile && this.worldData[this.targetTile.y][this.targetTile.x] !== BLOCK_AIR && !isSword) {
        this.handleMining(delta);
      } else {
        if (this.attackCooldown <= 0 && !isBow) {
          this.performMeleeAttack(held);
        }
        this.resetMining();
      }
    } else if (!modalOpen) {
      this._spawnUsed = false;
      this.resetMining();
      if (!isBow) {
        this.bowDrawing = false;
        this.combat.bowDrawing = false;
      }
    }

    this.positionTimer += delta;
    if (this.positionTimer > 66) {
      this.positionTimer = 0;
      const moveData = {
        x: this.player.sprite.x,
        y: this.player.sprite.y,
        flipX: this.player.sprite.flipX,
      };
      if (this.bumMode) moveData.bumMode = true;
      this.network.emit('player_move', moveData);
    }

    this.invSyncTimer += delta;
    if (this.invSyncTimer > 5000) {
      this.invSyncTimer = 0;
      this.syncInventoryToServer();
    }

    this.updateRemotePlayers();
    this.updateEnemySprites();
    this.updateArrowSprites(delta);
    this.updateBullets(delta);
    this.updatePoopBullets(delta);
    this.updateDayNight(delta);
    this.drawHighlights();
    this.drawTorchLights();
    this.updateFurnaces(delta);
    } catch (err) {
      gameLogger.error('MultiplayerGameScene update:', err);
      gameLogger.logMemory();
    }
  }

  performMeleeAttack(weaponDef) {
    this.attackCooldown = MELEE_COOLDOWN;
    soundManager.play('sword_hit');
    const damage = weaponDef?.damage || (weaponDef?.toolType ? 2 : FIST_DAMAGE);
    const px = this.player.sprite.x;
    const py = this.player.sprite.y;
    const dir = this.player.sprite.flipX ? -1 : 1;

    this.network.emit('melee_attack', { x: px, y: py, damage, direction: dir });

    const range = MELEE_RANGE * TILE_SIZE;
    let hit = false;
    for (const me of Object.values(this.mpEnemies)) {
      if (!me.sprite) continue;
      const dx = me.sprite.x - px;
      const dy = me.sprite.y - py;
      if (Math.sqrt(dx * dx + dy * dy) <= range) { hit = true; break; }
    }

    if (hit && weaponDef && weaponDef.maxDurability) {
      this.inventory.useDurability(this.inventory.selectedSlot);
      this.syncInventoryToServer();
    }
  }

  handleBowRelease() {
    if (!this.bowDrawing) return;
    const held = this.inventory.getSelectedItemDef();
    if (held && held.toolType === 'bow' && this.bowDrawTime >= BOW_DRAW_TIME) {
      this.fireBow();
    }
    this.bowDrawing = false;
    this.bowDrawTime = 0;
    this.combat.bowDrawing = false;
    this.combat.bowDrawTime = 0;
  }

  fireBow() {
    const inv = this.inventory;
    let arrowSlot = -1;
    for (let i = 0; i < inv.slots.length; i++) {
      if (inv.slots[i] && inv.slots[i].itemId === 'arrow') { arrowSlot = i; break; }
    }
    if (arrowSlot === -1) return;

    inv.removeFromSlot(arrowSlot, 1);
    inv.useDurability(inv.selectedSlot);
    soundManager.play('bow_shot');

    const px = this.player.sprite.x;
    const py = this.player.sprite.y - 4;
    const pointer = this.input.activePointer;
    const wp = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const dx = wp.x - px;
    const dy = wp.y - py;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;

    this.network.emit('fire_bow', {
      x: px, y: py,
      vx: (dx / dist) * ARROW_SPEED,
      vy: (dy / dist) * ARROW_SPEED,
      damage: ARROW_DAMAGE,
    });
    this.syncInventoryToServer();
  }

  firePistolMP(pointer) {
    this.attackCooldown = PISTOL_COOLDOWN;
    soundManager.play('pistol_shot');
    const px = this.player.sprite.x;
    const py = this.player.sprite.y - 4;
    const wp = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const dx = wp.x - px, dy = wp.y - py;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const vx = (dx / dist) * PISTOL_SPEED, vy = (dy / dist) * PISTOL_SPEED;

    this.network.emit('fire_pistol', { x: px, y: py, vx, vy });

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
      if (b.life >= b.maxLife) {
        b.sprite.destroy(); this._bullets.splice(i, 1); continue;
      }
      const tx = Math.floor(b.sprite.x / TILE_SIZE);
      const ty = Math.floor(b.sprite.y / TILE_SIZE);
      if (tx >= 0 && tx < WORLD_WIDTH && ty >= 0 && ty < WORLD_HEIGHT &&
          this.worldData[ty][tx] !== BLOCK_AIR) {
        b.sprite.destroy(); this._bullets.splice(i, 1); continue;
      }
    }
  }

  spawnPoopBullet(x, y, vx, vy) {
    const sprite = this.add.image(x, y, 'poop_proj').setDepth(6).setScale(0.8);
    this._poopBullets.push({ sprite, vx, vy, life: 0 });
  }

  updatePoopBullets(delta) {
    if (!this._poopBullets) return;
    const dt = delta / 1000;
    for (let i = this._poopBullets.length - 1; i >= 0; i--) {
      const p = this._poopBullets[i];
      if (!p.sprite?.active) { this._poopBullets.splice(i, 1); continue; }
      p.vy += BUM_POOP_GRAVITY * dt;
      p.sprite.x += p.vx * dt;
      p.sprite.y += p.vy * dt;
      p.sprite.rotation += dt * 6 * (p.vx > 0 ? 1 : -1);
      p.life += dt;
      if (p.life > 4) {
        p.sprite.destroy(); this._poopBullets.splice(i, 1); continue;
      }
      const tx = Math.floor(p.sprite.x / TILE_SIZE);
      const ty = Math.floor(p.sprite.y / TILE_SIZE);
      if (tx < 0 || tx >= WORLD_WIDTH || ty < 0 || ty >= WORLD_HEIGHT ||
          (this.worldData && this.worldData[ty][tx] !== BLOCK_AIR)) {
        p.sprite.destroy(); this._poopBullets.splice(i, 1);
      }
    }
  }

  syncInventoryToServer() {
    this.network.emit('sync_inventory', { inventory: this.inventory.slots.map(s => s ? { ...s } : null) });
  }

  updateRemotePlayers() {
    for (const rp of Object.values(this.remotePlayers)) {
      const prevX = rp.sprite.x;
      rp.sprite.x += (rp.targetX - rp.sprite.x) * 0.25;
      rp.sprite.y += (rp.targetY - rp.sprite.y) * 0.25;
      rp.label.setPosition(rp.sprite.x, rp.sprite.y - 18);
      const moving = Math.abs(rp.sprite.x - prevX) > 0.3;
      if (rp.anim) rp.anim.update(16, { moving, onGround: true, justLanded: false, flipX: rp.sprite.flipX });
    }
  }

  updateEnemySprites() {
    for (const me of Object.values(this.mpEnemies)) {
      const prevX = me.sprite.x;
      me.sprite.x += (me.targetX - me.sprite.x) * 0.3;
      me.sprite.y += (me.targetY - me.sprite.y) * 0.3;
      me.sprite.setFlipX(me.direction < 0);
      const moving = Math.abs(me.sprite.x - prevX) > 0.5;
      if (me.anim) me.anim.update(16, { moving, onGround: true, justLanded: false, flipX: me.direction < 0 });
    }
  }

  updateArrowSprites(delta) {
    const dt = delta / 1000;
    for (const [id, a] of Object.entries(this.arrowSprites)) {
      a.vy += ARROW_GRAVITY * dt;
      a.sprite.x += a.vx * dt;
      a.sprite.y += a.vy * dt;
      a.sprite.rotation = Math.atan2(a.vy, a.vx);
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

    const blockDef = BLOCKS[blockId];
    const held = this.inventory.getSelectedItemDef();
    const newMineTime = this.calcMiningTime(blockDef, held);

    if (!this.miningTarget || this.miningTarget.x !== x || this.miningTarget.y !== y) {
      this.miningTarget = { x, y };
      this.miningProgress = 0;
      this.miningTime = newMineTime;
    } else if (Math.abs(newMineTime - this.miningTime) > 0.001) {
      const ratio = this.miningTime > 0 ? this.miningProgress / this.miningTime : 0;
      this.miningTime = newMineTime;
      this.miningProgress = ratio * newMineTime;
    }

    this.miningProgress += delta / 1000;
    if (!this._lastMineSound) this._lastMineSound = 0;
    this._lastMineSound += delta / 1000;
    if (this._lastMineSound >= 0.25) { this._lastMineSound = 0; soundManager.play('mine_hit'); }
    if (this.miningProgress >= this.miningTime) {
      const held = this.inventory.getSelectedItemDef();
      if (held && (held.toolType === 'pickaxe' || held.toolType === 'axe')) {
        this.inventory.useDurability(this.inventory.selectedSlot);
      }
      soundManager.play('block_break');
      this.network.emit('break_block', { tx: x, ty: y });
      this.resetMining();
      this.syncInventoryToServer();
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

  resetMining() { this.miningTarget = null; this.miningProgress = 0; this.miningTime = 0; }

  handleRightClick() {
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
    this.inventory.removeFromSlot(this.inventory.selectedSlot, 1);
    this.network.emit('place_block', { tx, ty, blockId: itemDef.placesBlock });
    this.syncInventoryToServer();
  }

  updateDayNight(delta) {
    this.dayTime = (this.dayTime + delta / 1000) % DAY_LENGTH;
    const phase = this.dayTime / DAY_LENGTH;
    let darkness = 0;
    if (phase >= NIGHT_START && phase < NIGHT_END) darkness = 0.6;
    else if (phase >= NIGHT_END) darkness = 0.6 * (1 - (phase - NIGHT_END) / (1.0 - NIGHT_END));
    else if (phase >= NIGHT_START - 0.1 && phase < NIGHT_START) darkness = 0.6 * ((phase - (NIGHT_START - 0.1)) / 0.1);
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

  drawHighlights() {
    this.blockHighlight.clear();
    if (!this.targetTile) return;
    const { x: tx, y: ty } = this.targetTile;
    if (this.worldData[ty][tx] === BLOCK_AIR) return;
    this.blockHighlight.lineStyle(1, 0xffffff, 0.8);
    this.blockHighlight.strokeRect(tx * TILE_SIZE, ty * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    if (this.miningTarget && this.miningTime > 0) {
      const progress = Math.min(this.miningProgress / this.miningTime, 1);
      this.blockHighlight.fillStyle(0x000000, progress * 0.6);
      this.blockHighlight.fillRect(this.miningTarget.x * TILE_SIZE, this.miningTarget.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }
  }

  toggleDayNight() {
    this.network.emit('set_time', { time: this.isNight ? 0 : NIGHT_START * DAY_LENGTH });
  }

  leaveGame() {
    this.hideDeathScreen();
    this.network.removeAllGameListeners();
    this.network.disconnect();
    this.scene.stop('HUDScene');
    this.scene.start('MainMenuScene');
  }
}
