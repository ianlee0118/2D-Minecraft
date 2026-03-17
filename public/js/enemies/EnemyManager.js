import {
  TILE_SIZE, WORLD_WIDTH, WORLD_HEIGHT,
  MAX_SURFACE_ENEMIES, MAX_CAVE_ENEMIES,
  ENEMY_SPAWN_INTERVAL, ENEMY_DESPAWN_DIST,
  TORCH_SUPPRESS_RADIUS,
} from '../constants.js';
import { BLOCK_AIR, BLOCK_TORCH } from '../blocks.js';
import { Enemy } from './Enemy.js';

export class EnemyManager {
  constructor(scene) {
    this.scene = scene;
    this.enemies = [];
    this.spawnTimer = 0;
  }

  update(delta, isNight) {
    const player = this.scene?.player;
    if (!player?.sprite?.active) return;

    const dt = delta / 1000;
    this.spawnTimer += dt;

    if (this.spawnTimer >= ENEMY_SPAWN_INTERVAL) {
      this.spawnTimer = 0;
      this.trySpawn(isNight);
    }

    const px = player.sprite.x;
    const py = player.sprite.y;

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.dead || !e.sprite?.active) { this.enemies.splice(i, 1); continue; }

      const dist = Math.sqrt((e.sprite.x - px) ** 2 + (e.sprite.y - py) ** 2);
      if (dist > ENEMY_DESPAWN_DIST && !e.cfg.isWarden) {
        e.destroy();
        this.enemies.splice(i, 1);
        continue;
      }

      e.update(delta, player.sprite);
    }
  }

  trySpawn(isNight) {
    const surfaceCount = this.enemies.filter(e => e.cfg.isSurface).length;
    const caveCount = this.enemies.filter(e => !e.cfg.isSurface).length;

    if (isNight && surfaceCount < MAX_SURFACE_ENEMIES) {
      this.spawnSurface();
    }
    if (caveCount < MAX_CAVE_ENEMIES) {
      this.spawnCave();
    }
  }

  spawnSurface() {
    const px = this.scene.player.sprite.x;
    const py = this.scene.player.sprite.y;
    const world = this.scene.worldData;
    const heights = this.scene.surfaceHeights;
    if (!heights) return;

    for (let attempt = 0; attempt < 10; attempt++) {
      const dir = Math.random() < 0.5 ? -1 : 1;
      const dist = 15 + Math.floor(Math.random() * 20);
      const tx = Math.floor(px / TILE_SIZE) + dir * dist;
      if (tx < 2 || tx >= WORLD_WIDTH - 2) continue;

      const sy = heights[tx];
      if (sy <= 2 || sy >= WORLD_HEIGHT - 2) continue;
      if (world[sy - 1][tx] !== BLOCK_AIR || world[sy - 2][tx] !== BLOCK_AIR) continue;

      const wx = tx * TILE_SIZE + TILE_SIZE / 2;
      const wy = (sy - 2) * TILE_SIZE + TILE_SIZE / 2;

      if (this.isTorchSuppressed(tx, sy)) continue;

      const type = Math.random() < 0.6 ? 'zombie' : 'skeleton';
      this.createEnemy(wx, wy, type);
      return;
    }
  }

  spawnCave() {
    const px = this.scene.player.sprite.x;
    const py = this.scene.player.sprite.y;
    const world = this.scene.worldData;
    const heights = this.scene.surfaceHeights;
    if (!heights) return;

    const ptx = Math.floor(px / TILE_SIZE);
    const pty = Math.floor(py / TILE_SIZE);

    for (let attempt = 0; attempt < 15; attempt++) {
      const tx = ptx + Math.floor(Math.random() * 30 - 15);
      const ty = pty + Math.floor(Math.random() * 20 - 5);
      if (tx < 1 || tx >= WORLD_WIDTH - 1 || ty < 1 || ty >= WORLD_HEIGHT - 1) continue;

      const surfY = heights[tx] || 40;
      if (ty < surfY + 6) continue;

      if (world[ty][tx] !== BLOCK_AIR) continue;
      if (world[ty - 1][tx] !== BLOCK_AIR) continue;
      if (world[ty + 1][tx] === BLOCK_AIR) continue;

      const wx = tx * TILE_SIZE + TILE_SIZE / 2;
      const wy = ty * TILE_SIZE;

      const dist = Math.sqrt((wx - px) ** 2 + (wy - py) ** 2);
      if (dist < 8 * TILE_SIZE) continue;

      if (this.isTorchSuppressed(tx, ty)) continue;

      this.createEnemy(wx, wy, 'cave_spider');
      return;
    }
  }

  isTorchSuppressed(tx, ty) {
    const world = this.scene.worldData;
    const r = TORCH_SUPPRESS_RADIUS;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const cx = tx + dx, cy = ty + dy;
        if (cx < 0 || cx >= WORLD_WIDTH || cy < 0 || cy >= WORLD_HEIGHT) continue;
        if (world[cy][cx] === BLOCK_TORCH) return true;
      }
    }
    return false;
  }

  createEnemy(x, y, type) {
    const enemy = new Enemy(this.scene, x, y, type);
    this.scene.physics.add.collider(enemy.sprite, this.scene.layer);
    this.enemies.push(enemy);
    return enemy;
  }

  destroyAll() {
    for (const e of this.enemies) e.destroy();
    this.enemies = [];
  }
}
