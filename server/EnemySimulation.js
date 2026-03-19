import { TILE_SIZE, WORLD_WIDTH, WORLD_HEIGHT, TORCH_SUPPRESS_RADIUS,
  WARDEN_HEALTH, WARDEN_DAMAGE, WARDEN_SPEED, WARDEN_KB_RESIST } from '../public/js/constants.js';
import { BLOCK_AIR, BLOCK_TORCH } from '../public/js/blocks.js';

const GRAVITY = 900;
const TERMINAL_VEL = 600;
const SPAWN_INTERVAL = 3;
const MAX_SURFACE = 6;
const MAX_CAVE = 8;
const DESPAWN_DIST = 600;
const ARROW_SPEED = 270;
const ARROW_GRAVITY = 200;

const TYPES = {
  zombie: {
    health: 20, damage: 3, speed: 55, detectRange: 192, attackRange: 19,
    attackCooldown: 1.0, jumpForce: -280, bodyW: 12, bodyH: 28, isSurface: true,
    drops: [{ itemId: 'dirt', min: 1, max: 1, chance: 0.3 }],
  },
  skeleton: {
    health: 16, damage: 2, speed: 45, detectRange: 256, attackRange: 192,
    preferredDist: 96, attackCooldown: 2.5, jumpForce: -280, bodyW: 12, bodyH: 28,
    isSurface: true, ranged: true,
    drops: [{ itemId: 'arrow', min: 1, max: 3, chance: 0.7 }],
  },
  cave_spider: {
    health: 12, damage: 3, speed: 90, detectRange: 128, attackRange: 21,
    attackCooldown: 0.8, jumpForce: -260, bodyW: 16, bodyH: 10, isSurface: false,
    drops: [{ itemId: 'string', min: 1, max: 2, chance: 0.8 }],
  },
  warden: {
    health: WARDEN_HEALTH, damage: WARDEN_DAMAGE, speed: WARDEN_SPEED,
    detectRange: 24 * TILE_SIZE, attackRange: 29,
    attackCooldown: 1.2, jumpForce: -340, bodyW: 18, bodyH: 38, isSurface: true,
    kbResist: WARDEN_KB_RESIST, isWarden: true,
    drops: [
      { itemId: 'diamond', min: 3, max: 6, chance: 1.0 },
      { itemId: 'iron_ingot', min: 4, max: 8, chance: 1.0 },
    ],
  },
};

export class EnemySimulation {
  constructor(room) {
    this.room = room;
    this.enemies = [];
    this.arrows = [];
    this.nextId = 1;
    this.nextArrowId = 1;
    this.spawnTimer = 0;
  }

  tick(dt, isNight, io, code) {
    this.spawnTimer += dt;
    if (this.spawnTimer >= SPAWN_INTERVAL) {
      this.spawnTimer = 0;
      this.trySpawn(isNight, io, code);
    }

    this.updateEnemies(dt, io, code);
    this.updateArrows(dt, io, code);
  }

  getPlayerPositions() {
    const positions = [];
    for (const [id, p] of this.room.players) {
      if (p.x !== undefined && !p.dead && !p.godMode) {
        positions.push({ id, x: p.x, y: p.y });
      }
    }
    return positions;
  }

  nearestPlayer(x, y) {
    let best = null, bestDist = Infinity;
    for (const p of this.getPlayerPositions()) {
      const d = Math.sqrt((p.x - x) ** 2 + (p.y - y) ** 2);
      if (d < bestDist) { bestDist = d; best = p; }
    }
    return best ? { ...best, dist: bestDist } : null;
  }

  isSolid(tx, ty) {
    if (tx < 0 || tx >= WORLD_WIDTH || ty < 0 || ty >= WORLD_HEIGHT) return true;
    const b = this.room.worldData[ty][tx];
    return b !== BLOCK_AIR && b !== BLOCK_TORCH;
  }

  updateEnemies(dt, io, code) {
    const players = this.getPlayerPositions();
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.dead) { this.enemies.splice(i, 1); continue; }

      let closest = null, closestDist = Infinity;
      for (const p of players) {
        const d = Math.sqrt((p.x - e.x) ** 2 + (p.y - e.y) ** 2);
        if (d < closestDist) { closestDist = d; closest = p; }
      }

      const cfg = TYPES[e.type];
      if (!closest && !cfg.isWarden) {
        this.enemies.splice(i, 1);
        io.to(code).emit('enemy_removed', { id: e.id });
        continue;
      }
      if (closest && closestDist > DESPAWN_DIST && !cfg.isWarden) {
        this.enemies.splice(i, 1);
        io.to(code).emit('enemy_removed', { id: e.id });
        continue;
      }

      if (!closest) {
        e.vx = 0;
        this.physicsStep(e, dt);
        continue;
      }

      if (e.targetId && e.targetId !== closest.id) {
        e.retargetCooldown = (e.retargetCooldown || 0) > 0 ? e.retargetCooldown : 1.5;
      }
      e.targetId = closest.id;

      if (e.retargetCooldown > 0) {
        e.retargetCooldown -= dt;
        e.vx = 0;
        this.physicsStep(e, dt);
        continue;
      }

      if (e.invulnTime > 0) e.invulnTime -= dt;
      if (e.attackTimer > 0) e.attackTimer -= dt;

      this.runAI(e, closest, closestDist, dt, io, code);
      this.physicsStep(e, dt);
    }
  }

  runAI(e, target, dist, dt, io, code) {
    const cfg = TYPES[e.type];
    if (dist > cfg.detectRange) {
      if (Math.random() < 0.01) e.direction *= -1;
      e.vx = cfg.speed * 0.4 * e.direction;
      this.tryJump(e);
      return;
    }

    const dx = target.x - e.x;
    const dir = dx > 0 ? 1 : -1;
    e.direction = dir;

    if (cfg.ranged) {
      const pref = cfg.preferredDist;
      if (dist < pref * 0.6) e.vx = -cfg.speed * dir;
      else if (dist > pref * 1.4) e.vx = cfg.speed * dir;
      else e.vx = 0;

      if (dist <= cfg.attackRange && e.attackTimer <= 0) {
        e.attackTimer = cfg.attackCooldown;
        this.fireEnemyArrow(e, target, io, code);
      }
    } else {
      if (dist > cfg.attackRange) {
        e.vx = cfg.speed * dir;
      } else {
        e.vx = 0;
        if (e.attackTimer <= 0) {
          e.attackTimer = cfg.attackCooldown;
          const p = this.room.players.get(target.id);
          if (p && !p.dead && !p.spawnProtection) {
            this.room.damagePlayer(target.id, cfg.damage, io, e.x, e.y);
          }
        }
      }
    }
    this.tryJump(e);

    const moved = Math.abs(e.x - e.lastX);
    if (moved < 0.5) {
      e.stuckTimer += dt;
      if (e.stuckTimer > 2) { e.direction *= -1; e.stuckTimer = 0; }
    } else {
      e.stuckTimer = 0;
    }
    e.lastX = e.x;
  }

  physicsStep(e, dt) {
    e.vy = Math.min(e.vy + GRAVITY * dt, TERMINAL_VEL);

    const cfg = TYPES[e.type];
    const hw = cfg.bodyW / 2, hh = cfg.bodyH / 2;

    const newX = e.x + e.vx * dt;
    const leftTx = Math.floor((newX - hw) / TILE_SIZE);
    const rightTx = Math.floor((newX + hw - 1) / TILE_SIZE);
    const topTy = Math.floor((e.y - hh) / TILE_SIZE);
    const botTy = Math.floor((e.y + hh - 1) / TILE_SIZE);

    let xBlocked = false;
    for (let ty = topTy; ty <= botTy; ty++) {
      if (e.vx > 0 && this.isSolid(rightTx, ty)) { xBlocked = true; break; }
      if (e.vx < 0 && this.isSolid(leftTx, ty)) { xBlocked = true; break; }
    }
    if (!xBlocked) e.x = newX;
    else e.blockedX = true;

    const newY = e.y + e.vy * dt;
    const newBotTy = Math.floor((newY + hh) / TILE_SIZE);
    const newTopTy = Math.floor((newY - hh) / TILE_SIZE);
    const lTx = Math.floor((e.x - hw) / TILE_SIZE);
    const rTx = Math.floor((e.x + hw - 1) / TILE_SIZE);

    let yBlocked = false;
    if (e.vy > 0) {
      for (let tx = lTx; tx <= rTx; tx++) {
        if (this.isSolid(tx, newBotTy)) { yBlocked = true; break; }
      }
      if (yBlocked) {
        e.y = newBotTy * TILE_SIZE - hh;
        e.vy = 0;
        e.grounded = true;
      }
    } else if (e.vy < 0) {
      for (let tx = lTx; tx <= rTx; tx++) {
        if (this.isSolid(tx, newTopTy)) { yBlocked = true; break; }
      }
      if (yBlocked) { e.vy = 0; }
    }
    if (!yBlocked) { e.y = newY; e.grounded = false; }

    e.x = Math.max(TILE_SIZE, Math.min(e.x, (WORLD_WIDTH - 1) * TILE_SIZE));
    e.y = Math.max(TILE_SIZE, Math.min(e.y, (WORLD_HEIGHT - 1) * TILE_SIZE));
  }

  tryJump(e) {
    if (e.grounded && e.blockedX) {
      const cfg = TYPES[e.type];
      e.vy = cfg.jumpForce;
      e.grounded = false;
    }
    e.blockedX = false;
  }

  fireEnemyArrow(e, target, io, code) {
    const dx = target.x - e.x;
    const dy = (target.y - 8) - e.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const speed = ARROW_SPEED;
    const arrow = {
      id: this.nextArrowId++,
      x: e.x, y: e.y - 5,
      vx: (dx / dist) * speed,
      vy: (dy / dist) * speed - 40,
      damage: TYPES[e.type].damage,
      fromEnemy: true,
      lifetime: 0,
    };
    this.arrows.push(arrow);
    io.to(code).emit('arrow_fired', { id: arrow.id, x: arrow.x, y: arrow.y, vx: arrow.vx, vy: arrow.vy, fromEnemy: true });
  }

  spawnPlayerArrow(playerId, x, y, vx, vy, damage, io, code) {
    const arrow = {
      id: this.nextArrowId++,
      x, y, vx, vy, damage,
      fromPlayer: playerId,
      lifetime: 0,
    };
    this.arrows.push(arrow);
    io.to(code).emit('arrow_fired', { id: arrow.id, x, y, vx, vy, fromEnemy: false, playerId });
  }

  updateArrows(dt, io, code) {
    for (let i = this.arrows.length - 1; i >= 0; i--) {
      const a = this.arrows[i];
      a.vy += ARROW_GRAVITY * dt;
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      a.lifetime += dt;

      const tx = Math.floor(a.x / TILE_SIZE);
      const ty = Math.floor(a.y / TILE_SIZE);

      if (a.lifetime > 8 || this.isSolid(tx, ty)) {
        this.arrows.splice(i, 1);
        io.to(code).emit('arrow_removed', { id: a.id });
        continue;
      }

      if (a.fromEnemy) {
        for (const [pid, p] of this.room.players) {
          if (p.dead || p.spawnProtection) continue;
          const d = Math.sqrt((a.x - p.x) ** 2 + (a.y - p.y) ** 2);
          if (d < TILE_SIZE * 1.2) {
            this.room.damagePlayer(pid, a.damage, io, a.x, a.y);
            this.arrows.splice(i, 1);
            io.to(code).emit('arrow_removed', { id: a.id });
            break;
          }
        }
      } else if (a.fromPlayer) {
        for (const e of this.enemies) {
          if (e.dead) continue;
          const d = Math.sqrt((a.x - e.x) ** 2 + (a.y - e.y) ** 2);
          if (d < TILE_SIZE * 1.2) {
            this.damageEnemy(e, a.damage, a.x, a.fromPlayer, io, code);
            this.arrows.splice(i, 1);
            io.to(code).emit('arrow_removed', { id: a.id });
            break;
          }
        }
        if (this.room.pvpEnabled) {
          for (const [pid, p] of this.room.players) {
            if (pid === a.fromPlayer || p.dead || p.spawnProtection) continue;
            const d = Math.sqrt((a.x - p.x) ** 2 + (a.y - p.y) ** 2);
            if (d < TILE_SIZE * 1.2) {
              this.room.damagePlayer(pid, a.damage, io, a.x, a.y);
              this.arrows.splice(i, 1);
              io.to(code).emit('arrow_removed', { id: a.id });
              break;
            }
          }
        }
      }
    }
  }

  damageEnemy(e, amount, sourceX, attackerId, io, code) {
    if (e.dead || e.invulnTime > 0) return;
    e.health -= amount;
    const cfg = TYPES[e.type];
    e.invulnTime = (cfg && cfg.isWarden) ? 0.2 : 0.3;

    const resist = (cfg && cfg.kbResist) || 0;
    const kb = (sourceX < e.x ? 220 : -220) * (1 - resist);
    e.vx = kb;
    e.vy = -120 * (1 - resist);

    if (e.health <= 0) {
      e.dead = true;
      const drops = [];
      if (cfg && cfg.drops) {
        for (const d of cfg.drops) {
          if (Math.random() > d.chance) continue;
          const count = d.min + Math.floor(Math.random() * (d.max - d.min + 1));
          const drop = {
            id: this.room.nextDropId++,
            x: e.x, y: e.y,
            itemId: d.itemId, count,
          };
          this.room.drops.set(drop.id, drop);
          drops.push(drop);
        }
      }
      if (attackerId) {
        this.room.recordKill(attackerId, e.type);
      }
      io.to(code).emit('enemy_died', { id: e.id, drops });
    } else {
      io.to(code).emit('enemy_hit', { id: e.id, health: e.health });
    }
  }

  trySpawn(isNight, io, code) {
    const surfaceCount = this.enemies.filter(e => TYPES[e.type].isSurface).length;
    const caveCount = this.enemies.filter(e => !TYPES[e.type].isSurface).length;

    if (isNight && surfaceCount < MAX_SURFACE) {
      this.spawnSurface(io, code);
    }
    if (caveCount < MAX_CAVE) {
      this.spawnCave(io, code);
    }
  }

  spawnSurface(io, code) {
    const players = this.getPlayerPositions();
    if (players.length === 0) return;
    const anchor = players[Math.floor(Math.random() * players.length)];
    const world = this.room.worldData;
    const heights = this.room.surfaceHeights;

    for (let attempt = 0; attempt < 10; attempt++) {
      const dir = Math.random() < 0.5 ? -1 : 1;
      const dist = 15 + Math.floor(Math.random() * 20);
      const tx = Math.floor(anchor.x / TILE_SIZE) + dir * dist;
      if (tx < 2 || tx >= WORLD_WIDTH - 2) continue;

      const sy = heights[tx];
      if (sy <= 2 || sy >= WORLD_HEIGHT - 2) continue;
      if (world[sy - 1][tx] !== BLOCK_AIR || world[sy - 2][tx] !== BLOCK_AIR) continue;
      if (this.isTorchSuppressed(tx, sy)) continue;

      const type = Math.random() < 0.6 ? 'zombie' : 'skeleton';
      const e = this.createEnemy(tx * TILE_SIZE + 8, (sy - 2) * TILE_SIZE + 8, type);
      io.to(code).emit('enemy_spawned', { id: e.id, type: e.type, x: e.x, y: e.y });
      return;
    }
  }

  spawnCave(io, code) {
    const players = this.getPlayerPositions();
    if (players.length === 0) return;
    const anchor = players[Math.floor(Math.random() * players.length)];
    const world = this.room.worldData;
    const heights = this.room.surfaceHeights;
    const ptx = Math.floor(anchor.x / TILE_SIZE);
    const pty = Math.floor(anchor.y / TILE_SIZE);

    for (let attempt = 0; attempt < 15; attempt++) {
      const tx = ptx + Math.floor(Math.random() * 30 - 15);
      const ty = pty + Math.floor(Math.random() * 20 - 5);
      if (tx < 1 || tx >= WORLD_WIDTH - 1 || ty < 1 || ty >= WORLD_HEIGHT - 1) continue;
      if (ty < (heights[tx] || 40) + 6) continue;
      if (world[ty][tx] !== BLOCK_AIR || world[ty - 1][tx] !== BLOCK_AIR) continue;
      if (world[ty + 1][tx] === BLOCK_AIR) continue;

      const wx = tx * TILE_SIZE + 8;
      const wy = ty * TILE_SIZE;
      let tooClose = false;
      for (const p of players) {
        if (Math.sqrt((wx - p.x) ** 2 + (wy - p.y) ** 2) < 8 * TILE_SIZE) { tooClose = true; break; }
      }
      if (tooClose) continue;
      if (this.isTorchSuppressed(tx, ty)) continue;

      const e = this.createEnemy(wx, wy, 'cave_spider');
      io.to(code).emit('enemy_spawned', { id: e.id, type: e.type, x: e.x, y: e.y });
      return;
    }
  }

  isTorchSuppressed(tx, ty) {
    const world = this.room.worldData;
    const r = TORCH_SUPPRESS_RADIUS;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const cx = tx + dx, cy = ty + dy;
        if (cx >= 0 && cx < WORLD_WIDTH && cy >= 0 && cy < WORLD_HEIGHT) {
          if (world[cy][cx] === BLOCK_TORCH) return true;
        }
      }
    }
    return false;
  }

  findValidSpawn(wx, wy) {
    const world = this.room.worldData;
    if (!world) return null;
    let tx = Math.floor(wx / TILE_SIZE);
    let ty = Math.floor(wy / TILE_SIZE);
    if (tx < 0 || tx >= WORLD_WIDTH || ty < 0 || ty >= WORLD_HEIGHT) return null;

    if (this.isSolid(tx, ty)) {
      for (let scanY = ty - 1; scanY >= 0; scanY--) {
        if (!this.isSolid(tx, scanY)) { ty = scanY; break; }
        if (scanY === 0) return null;
      }
    }

    let groundY = null;
    for (let scanY = ty; scanY < WORLD_HEIGHT; scanY++) {
      if (this.isSolid(tx, scanY)) { groundY = scanY; break; }
    }
    if (groundY === null) return null;

    const spawnTy = groundY - 1;
    if (spawnTy < 0 || this.isSolid(tx, spawnTy)) return null;

    return { x: tx * TILE_SIZE + TILE_SIZE / 2, y: spawnTy * TILE_SIZE + TILE_SIZE / 2 };
  }

  createEnemy(x, y, type) {
    const cfg = TYPES[type];
    if (!cfg) return null;
    const e = {
      id: this.nextId++,
      type,
      x, y,
      vx: 0, vy: 0,
      health: cfg.health,
      attackTimer: 0,
      invulnTime: 0,
      direction: Math.random() < 0.5 ? -1 : 1,
      grounded: false,
      blockedX: false,
      stuckTimer: 0,
      lastX: x,
      dead: false,
      targetId: null,
      retargetCooldown: 0,
    };
    this.enemies.push(e);
    return e;
  }

  getState() {
    return this.enemies.filter(e => !e.dead).map(e => ({
      id: e.id, type: e.type,
      x: Math.round(e.x), y: Math.round(e.y),
      direction: e.direction,
      health: e.health,
    }));
  }

  destroyAll() {
    this.enemies = [];
    this.arrows = [];
  }
}
