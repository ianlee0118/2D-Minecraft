import { WORLD_WIDTH, WORLD_HEIGHT } from '../constants.js';
import {
  BLOCK_AIR, BLOCK_GRASS, BLOCK_DIRT, BLOCK_STONE,
  BLOCK_WOOD, BLOCK_LEAVES, BLOCK_COAL_ORE, BLOCK_IRON_ORE, BLOCK_DIAMOND_ORE
} from '../blocks.js';
import { createRNG, fractalNoise1D, fractalNoise2D } from '../utils/noise.js';

export class WorldGenerator {
  constructor(seed) {
    this.seed = seed;
    this.rng = createRNG(seed);
    this.surfaceHeights = new Array(WORLD_WIDTH);
    this.spawnPoint = { x: 0, y: 0 };
  }

  generate() {
    const data = [];
    for (let y = 0; y < WORLD_HEIGHT; y++) {
      data[y] = new Array(WORLD_WIDTH).fill(BLOCK_AIR);
    }

    this.generateTerrain(data);
    this.carveCaves(data);
    this.placeOres(data);
    this.placeTrees(data);
    this.findSpawnPoint();

    return { data, spawnPoint: this.spawnPoint };
  }

  generateTerrain(data) {
    for (let x = 0; x < WORLD_WIDTH; x++) {
      const n = fractalNoise1D(x, this.seed, 64, 3, 0.5);
      const surfaceY = Math.floor(40 + n * 12);
      this.surfaceHeights[x] = Math.max(5, Math.min(WORLD_HEIGHT - 10, surfaceY));

      const sy = this.surfaceHeights[x];
      data[sy][x] = BLOCK_GRASS;

      const dirtDepth = 4 + Math.floor(this.rng() * 3);
      for (let y = sy + 1; y < sy + 1 + dirtDepth && y < WORLD_HEIGHT; y++) {
        data[y][x] = BLOCK_DIRT;
      }
      for (let y = sy + 1 + dirtDepth; y < WORLD_HEIGHT; y++) {
        data[y][x] = BLOCK_STONE;
      }
    }
  }

  carveCaves(data) {
    for (let y = 0; y < WORLD_HEIGHT; y++) {
      for (let x = 0; x < WORLD_WIDTH; x++) {
        if (data[y][x] === BLOCK_AIR || data[y][x] === BLOCK_GRASS) continue;
        if (y < this.surfaceHeights[x] + 4) continue;
        if (y >= WORLD_HEIGHT - 2) continue;

        const cv = fractalNoise2D(x, y, this.seed + 500, 16, 2, 0.5);
        if (Math.abs(cv) < 0.12) {
          data[y][x] = BLOCK_AIR;
        }
      }
    }
  }

  placeOres(data) {
    const rng = createRNG(this.seed + 2000);

    this.scatterOre(data, rng, BLOCK_COAL_ORE, 50, 200, 4, 5);
    this.scatterOre(data, rng, BLOCK_IRON_ORE, 70, 120, 3, 4);
    this.scatterOre(data, rng, BLOCK_DIAMOND_ORE, 100, 35, 2, 3);
  }

  scatterOre(data, rng, oreType, minDepth, count, minSize, maxSize) {
    for (let i = 0; i < count; i++) {
      const x = Math.floor(rng() * WORLD_WIDTH);
      const y = minDepth + Math.floor(rng() * (WORLD_HEIGHT - minDepth - 2));
      if (y >= WORLD_HEIGHT || data[y][x] !== BLOCK_STONE) continue;

      const veinSize = minSize + Math.floor(rng() * (maxSize - minSize + 1));
      const positions = [{ x, y }];
      data[y][x] = oreType;

      for (let j = 0; j < veinSize; j++) {
        const base = positions[Math.floor(rng() * positions.length)];
        const nx = base.x + Math.floor(rng() * 3) - 1;
        const ny = base.y + Math.floor(rng() * 3) - 1;
        if (nx >= 0 && nx < WORLD_WIDTH && ny >= 0 && ny < WORLD_HEIGHT) {
          if (data[ny][nx] === BLOCK_STONE) {
            data[ny][nx] = oreType;
            positions.push({ x: nx, y: ny });
          }
        }
      }
    }
  }

  placeTrees(data) {
    let lastTreeX = -10;
    for (let x = 2; x < WORLD_WIDTH - 2; x++) {
      const forestDensity = fractalNoise1D(x, this.seed + 3000, 40, 2, 0.5);
      if (forestDensity < 0.1) continue;

      const spacing = forestDensity > 0.4 ? 4 : 6;
      if (x - lastTreeX < spacing) continue;
      if (this.rng() > 0.5) continue;

      const sy = this.surfaceHeights[x];
      if (data[sy][x] !== BLOCK_GRASS) continue;

      this.placeTree(data, x, sy);
      lastTreeX = x;
    }
  }

  placeTree(data, baseX, surfaceY) {
    const trunkHeight = 4 + Math.floor(this.rng() * 3);
    const trunkTop = surfaceY - trunkHeight;
    if (trunkTop < 2) return;

    for (let y = surfaceY - 1; y >= trunkTop; y--) {
      if (data[y][baseX] === BLOCK_AIR) {
        data[y][baseX] = BLOCK_WOOD;
      }
    }

    const leafPatterns = [
      { dy: -2, halfW: 1 },
      { dy: -1, halfW: 2 },
      { dy:  0, halfW: 2 },
      { dy:  1, halfW: 1 },
    ];

    for (const { dy, halfW } of leafPatterns) {
      const ly = trunkTop + dy;
      if (ly < 0 || ly >= WORLD_HEIGHT) continue;
      for (let dx = -halfW; dx <= halfW; dx++) {
        const lx = baseX + dx;
        if (lx < 0 || lx >= WORLD_WIDTH) continue;
        if (data[ly][lx] === BLOCK_AIR) {
          data[ly][lx] = BLOCK_LEAVES;
        }
      }
    }
  }

  findSpawnPoint() {
    const center = Math.floor(WORLD_WIDTH / 2);
    for (let r = 0; r < WORLD_WIDTH / 2; r++) {
      for (const dx of [r, -r]) {
        const x = center + dx;
        if (x < 0 || x >= WORLD_WIDTH) continue;
        const sy = this.surfaceHeights[x];
        const forestDensity = fractalNoise1D(x, this.seed + 3000, 40, 2, 0.5);
        if (forestDensity < 0.15) {
          this.spawnPoint = { x, y: sy - 2 };
          return;
        }
      }
    }
    this.spawnPoint = { x: center, y: this.surfaceHeights[center] - 2 };
  }
}
