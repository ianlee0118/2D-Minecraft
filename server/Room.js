import { WorldGenerator } from '../public/js/world/WorldGenerator.js';
import { WORLD_WIDTH, WORLD_HEIGHT, TILE_SIZE, DAY_LENGTH, NIGHT_START, MAX_HEALTH, SPAWN_PROTECTION_TIME,
  WARDEN_KILL_THRESHOLD } from '../public/js/constants.js';
import { BLOCK_AIR, BLOCK_FURNACE, BLOCKS } from '../public/js/blocks.js';
import { EnemySimulation } from './EnemySimulation.js';

const TICK_MS = 50;
const ENEMY_SYNC_INTERVAL = 100;

export class Room {
  constructor(code, hostId, hostName) {
    this.code = code;
    this.hostId = hostId;
    this.players = new Map();
    this.players.set(hostId, { name: hostName, health: MAX_HEALTH });
    this.started = false;
    this.seed = Math.floor(Math.random() * 2147483647);
    this.worldData = null;
    this.surfaceHeights = null;
    this.blockChanges = {};
    this.drops = new Map();
    this.nextDropId = 1;
    this.dayTime = 0;
    this.furnaces = {};
    this.tickInterval = null;
    this.pvpEnabled = false;
    this.killCounts = {};
    this.worldTotalKills = 0;
    this.enemySim = null;
    this.io = null;
    this.lastSyncTime = 0;
    this.wardenActive = false;
  }

  start(io) {
    this.io = io;
    const gen = new WorldGenerator(this.seed);
    const result = gen.generate();
    this.worldData = result.data;
    this.surfaceHeights = gen.surfaceHeights;
    this.started = true;

    this.enemySim = new EnemySimulation(this);

    for (const [id] of this.players) {
      this.killCounts[id] = { zombie: 0, skeleton: 0, cave_spider: 0, total: 0 };
    }

    this.tickInterval = setInterval(() => this.tick(), TICK_MS);
  }

  tick() {
    if (!this.started || !this.io) return;
    const dt = TICK_MS / 1000;
    this.dayTime = (this.dayTime + dt) % DAY_LENGTH;

    const phase = this.dayTime / DAY_LENGTH;
    const isNight = phase >= NIGHT_START && phase < 1.0;

    for (const [, p] of this.players) {
      if (p.spawnProtection) {
        p.spawnProtectionTimer -= dt;
        if (p.spawnProtectionTimer <= 0) {
          p.spawnProtection = false;
        }
      }
    }

    this.enemySim.tick(dt, isNight, this.io, this.code);

    this.lastSyncTime += TICK_MS;
    if (this.lastSyncTime >= ENEMY_SYNC_INTERVAL) {
      this.lastSyncTime = 0;
      this.io.to(this.code).emit('enemies_sync', this.enemySim.getState());
    }
  }

  damagePlayer(playerId, amount, io, fromX, fromY) {
    const p = this.players.get(playerId);
    if (!p || p.dead || p.spawnProtection) return;

    p.health = Math.max(0, p.health - amount);
    io.to(this.code).emit('player_damaged', { id: playerId, health: p.health, fromX, fromY });

    if (p.health <= 0) {
      this.handlePlayerDeath(playerId, io);
    }
  }

  handlePlayerDeath(playerId, io) {
    const p = this.players.get(playerId);
    if (!p) return;
    p.dead = true;
    p.health = 0;

    const droppedItems = [];
    if (p.inventory) {
      for (let i = 0; i < p.inventory.length; i++) {
        const slot = p.inventory[i];
        if (slot && Math.random() < 0.5) {
          const drop = {
            id: this.nextDropId++,
            x: p.x || 0, y: p.y || 0,
            itemId: slot.itemId, count: slot.count,
          };
          this.drops.set(drop.id, drop);
          droppedItems.push(drop);
          p.inventory[i] = null;
        }
      }
    }

    io.to(this.code).emit('player_died', {
      id: playerId,
      drops: droppedItems,
    });

    io.to(playerId).emit('you_died', {
      keptInventory: p.inventory,
    });
  }

  respawnPlayer(playerId) {
    const p = this.players.get(playerId);
    if (!p) return null;

    let spawnPt = null;

    const livingPlayers = [];
    for (const [id, pl] of this.players) {
      if (id !== playerId && !pl.dead && pl.x !== undefined) {
        livingPlayers.push(pl);
      }
    }

    if (livingPlayers.length > 0) {
      const buddy = livingPlayers[Math.floor(Math.random() * livingPlayers.length)];
      const btx = Math.floor(buddy.x / TILE_SIZE);
      for (let r = 1; r < 20; r++) {
        for (const dx of [r, -r]) {
          const tx = btx + dx;
          if (tx < 0 || tx >= WORLD_WIDTH) continue;
          const sy = this.surfaceHeights[tx];
          if (sy <= 2 || sy >= WORLD_HEIGHT - 2) continue;
          if (this.worldData[sy - 1][tx] !== BLOCK_AIR) continue;
          if (this.worldData[sy - 2][tx] !== BLOCK_AIR) continue;
          spawnPt = { x: tx, y: sy - 2 };
          break;
        }
        if (spawnPt) break;
      }
    }

    if (!spawnPt) {
      const pts = this.findSpawnPoints(1);
      spawnPt = pts[0] || { x: Math.floor(WORLD_WIDTH / 2), y: 38 };
    }

    p.dead = false;
    p.health = MAX_HEALTH;
    p.x = spawnPt.x * TILE_SIZE + TILE_SIZE / 2;
    p.y = spawnPt.y * TILE_SIZE + TILE_SIZE / 2;
    p.spawnProtection = true;
    p.spawnProtectionTimer = SPAWN_PROTECTION_TIME;

    return {
      x: spawnPt.x,
      y: spawnPt.y,
      health: MAX_HEALTH,
      keptInventory: p.inventory,
    };
  }

  recordKill(playerId, enemyType) {
    if (enemyType === 'warden') {
      this.wardenActive = false;
      if (this.io) this.io.to(this.code).emit('warden_defeated', { killerId: playerId });
      return;
    }
    if (!this.killCounts[playerId]) {
      this.killCounts[playerId] = { zombie: 0, skeleton: 0, cave_spider: 0, total: 0 };
    }
    this.killCounts[playerId][enemyType] = (this.killCounts[playerId][enemyType] || 0) + 1;
    this.killCounts[playerId].total++;
    this.worldTotalKills++;

    if (this.io) {
      this.io.to(playerId).emit('kill_count', { total: this.killCounts[playerId].total });
    }

    if (this.killCounts[playerId].total === WARDEN_KILL_THRESHOLD ||
        (this.killCounts[playerId].total > WARDEN_KILL_THRESHOLD &&
         this.killCounts[playerId].total % WARDEN_KILL_THRESHOLD === 0)) {
      if (!this.wardenActive) {
        this.spawnWarden(playerId);
      }
    }
  }

  spawnWarden(triggerPlayerId) {
    this.wardenActive = true;
    const p = this.players.get(triggerPlayerId);
    const anchorX = p && p.x !== undefined ? Math.floor(p.x / TILE_SIZE) : Math.floor(WORLD_WIDTH / 2);

    let sx = null, sy = null;
    for (let r = 8; r < 30; r++) {
      for (const dir of [1, -1]) {
        const tx = anchorX + dir * r;
        if (tx < 2 || tx >= WORLD_WIDTH - 2) continue;
        const surfY = this.surfaceHeights[tx];
        if (surfY <= 2 || surfY >= WORLD_HEIGHT - 2) continue;
        if (this.worldData[surfY - 1][tx] !== BLOCK_AIR) continue;
        if (this.worldData[surfY - 2][tx] !== BLOCK_AIR) continue;
        if (this.worldData[surfY - 3][tx] !== BLOCK_AIR) continue;
        sx = tx; sy = surfY - 3;
        break;
      }
      if (sx !== null) break;
    }
    if (sx === null) { this.wardenActive = false; return; }

    const wx = sx * TILE_SIZE + TILE_SIZE / 2;
    const wy = sy * TILE_SIZE + TILE_SIZE / 2;
    const e = this.enemySim.createEnemy(wx, wy, 'warden');
    this.io.to(this.code).emit('warden_spawned', {
      id: e.id, type: 'warden', x: wx, y: wy,
      triggerPlayer: triggerPlayerId,
      totalKills: this.killCounts[triggerPlayerId]?.total || 0,
    });
  }

  findSpawnPoints(count) {
    const points = [];
    const center = Math.floor(WORLD_WIDTH / 2);
    for (let r = 0; r < WORLD_WIDTH / 2 && points.length < count; r++) {
      for (const dx of [r, -r]) {
        const x = center + dx;
        if (x < 0 || x >= WORLD_WIDTH) continue;
        const sy = this.surfaceHeights[x];
        if (sy <= 2 || sy >= WORLD_HEIGHT - 2) continue;
        if (this.worldData[sy - 1][x] !== BLOCK_AIR) continue;
        if (this.worldData[sy - 2][x] !== BLOCK_AIR) continue;
        points.push({ x, y: sy - 2 });
        if (points.length >= count) break;
      }
    }
    return points;
  }

  get worldWidth() { return WORLD_WIDTH; }
  get worldHeight() { return WORLD_HEIGHT; }

  getBlock(tx, ty) {
    if (tx < 0 || tx >= WORLD_WIDTH || ty < 0 || ty >= WORLD_HEIGHT) return BLOCK_AIR;
    return this.worldData[ty][tx];
  }

  breakBlock(tx, ty) {
    if (tx < 0 || tx >= WORLD_WIDTH || ty < 0 || ty >= WORLD_HEIGHT) return null;
    const blockId = this.worldData[ty][tx];
    if (blockId === BLOCK_AIR) return null;

    const blockDef = BLOCKS[blockId];
    this.worldData[ty][tx] = BLOCK_AIR;
    this.blockChanges[`${tx},${ty}`] = BLOCK_AIR;

    if (blockId === BLOCK_FURNACE) {
      delete this.furnaces[`${tx},${ty}`];
    }

    let drop = null;
    if (blockDef && blockDef.drops) {
      drop = {
        id: this.nextDropId++,
        x: tx * TILE_SIZE + TILE_SIZE / 2,
        y: ty * TILE_SIZE,
        itemId: blockDef.drops,
        count: 1,
      };
      this.drops.set(drop.id, drop);
    }
    return { blockDef, drop };
  }

  placeBlock(tx, ty, blockId) {
    if (tx < 0 || tx >= WORLD_WIDTH || ty < 0 || ty >= WORLD_HEIGHT) return false;
    if (this.worldData[ty][tx] !== BLOCK_AIR) return false;

    this.worldData[ty][tx] = blockId;
    this.blockChanges[`${tx},${ty}`] = blockId;

    if (blockId === BLOCK_FURNACE) {
      this.furnaces[`${tx},${ty}`] = { input: null, fuel: null, output: null, smeltProgress: 0, fuelTime: 0, fuelMaxTime: 0 };
    }
    return true;
  }

  pickupDrop(dropId) {
    const drop = this.drops.get(dropId);
    if (!drop) return null;
    this.drops.delete(dropId);
    return drop;
  }

  destroy() {
    if (this.tickInterval) clearInterval(this.tickInterval);
    if (this.enemySim) this.enemySim.destroyAll();
  }
}
