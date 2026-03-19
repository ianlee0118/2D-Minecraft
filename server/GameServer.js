import { Room } from './Room.js';
import { TILE_SIZE, MELEE_RANGE, FIST_DAMAGE, ARROW_SPEED, ARROW_DAMAGE, MAX_HEALTH,
  PISTOL_DAMAGE, PISTOL_SPEED, PISTOL_RANGE } from '../public/js/constants.js';
import { BUM_POOP_DAMAGE } from '../public/js/character/BrownUnderwearMode.js';

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export class GameServer {
  constructor(io) {
    this.io = io;
    this.rooms = new Map();
    this.playerRooms = new Map();
    io.on('connection', (socket) => this.onConnection(socket));
  }

  onConnection(socket) {
    socket.on('create_room', (data) => this.onCreateRoom(socket, data));
    socket.on('join_room', (data) => this.onJoinRoom(socket, data));
    socket.on('start_game', () => this.onStartGame(socket));
    socket.on('player_move', (data) => this.onPlayerMove(socket, data));
    socket.on('break_block', (data) => this.onBreakBlock(socket, data));
    socket.on('place_block', (data) => this.onPlaceBlock(socket, data));
    socket.on('pickup_drop', (data) => this.onPickupDrop(socket, data));
    socket.on('select_slot', (data) => this.onSelectSlot(socket, data));
    socket.on('melee_attack', (data) => this.onMeleeAttack(socket, data));
    socket.on('fire_bow', (data) => this.onFireBow(socket, data));
    socket.on('fire_pistol', (data) => this.onFirePistol(socket, data));
    socket.on('fire_poop', (data) => this.onFirePoop(socket, data));
    socket.on('request_respawn', () => this.onRequestRespawn(socket));
    socket.on('toggle_pvp', () => this.onTogglePvP(socket));
    socket.on('sync_inventory', (data) => this.onSyncInventory(socket, data));
    socket.on('spawn_enemy', (data) => this.onSpawnEnemy(socket, data));
    socket.on('set_time', (data) => this.onSetTime(socket, data));
    socket.on('godmode_toggle', (data) => this.onGodmodeToggle(socket, data));
    socket.on('disconnect', () => this.onDisconnect(socket));
  }

  getRoom(socketId) {
    const code = this.playerRooms.get(socketId);
    return code ? this.rooms.get(code) : null;
  }

  playerList(room) {
    const list = [];
    for (const [id, data] of room.players) {
      list.push({ id, name: data.name, isHost: id === room.hostId });
    }
    return list;
  }

  onCreateRoom(socket, { name }) {
    let code;
    do { code = generateCode(); } while (this.rooms.has(code));

    const room = new Room(code, socket.id, name || 'Player');
    this.rooms.set(code, room);
    this.playerRooms.set(socket.id, code);
    socket.join(code);

    socket.emit('room_created', {
      code,
      players: this.playerList(room),
      pvpEnabled: room.pvpEnabled,
    });
  }

  onJoinRoom(socket, { code, name }) {
    const upper = (code || '').toUpperCase();
    const room = this.rooms.get(upper);
    if (!room) return socket.emit('join_error', { message: 'Room not found' });
    if (room.players.size >= 4) return socket.emit('join_error', { message: 'Room is full (max 4)' });

    room.players.set(socket.id, { name: name || 'Player', health: MAX_HEALTH });
    this.playerRooms.set(socket.id, upper);
    socket.join(upper);

    const players = this.playerList(room);
    this.io.to(upper).emit('player_list', { players, pvpEnabled: room.pvpEnabled });

    if (room.started) {
      room.killCounts[socket.id] = { zombie: 0, skeleton: 0, cave_spider: 0, total: 0 };
      const gs = this.buildGameState(room, socket.id);
      socket.emit('game_started', gs);
    }
  }

  onStartGame(socket) {
    const room = this.getRoom(socket.id);
    if (!room || room.hostId !== socket.id || room.started) return;

    room.start(this.io);
    const spawns = room.findSpawnPoints(room.players.size);
    let i = 0;
    for (const [pid] of room.players) {
      const p = room.players.get(pid);
      const sp = spawns[i] || spawns[0];
      p.spawnPoint = sp;
      p.x = sp.x * TILE_SIZE + TILE_SIZE / 2;
      p.y = sp.y * TILE_SIZE + TILE_SIZE / 2;
      p.dead = false;
      p.spawnProtection = false;
      i++;
    }

    for (const [pid] of room.players) {
      this.io.to(pid).emit('game_started', this.buildGameState(room, pid));
    }
  }

  buildGameState(room, playerId) {
    const spawn = room.players.get(playerId)?.spawnPoint;
    if (!spawn) {
      const sp = room.findSpawnPoints(1);
      const p = room.players.get(playerId);
      p.spawnPoint = sp[0] || { x: 160, y: 38 };
      p.x = p.spawnPoint.x * TILE_SIZE + TILE_SIZE / 2;
      p.y = p.spawnPoint.y * TILE_SIZE + TILE_SIZE / 2;
    }
    const s = room.players.get(playerId).spawnPoint;
    return {
      seed: room.seed,
      blockChanges: room.blockChanges,
      spawnX: s.x,
      spawnY: s.y,
      dayTime: room.dayTime,
      drops: Array.from(room.drops.values()),
      players: this.playerList(room),
      pvpEnabled: room.pvpEnabled,
      enemies: room.enemySim ? room.enemySim.getState() : [],
    };
  }

  onPlayerMove(socket, data) {
    const code = this.playerRooms.get(socket.id);
    const room = this.rooms.get(code);
    if (!room) return;

    const p = room.players.get(socket.id);
    if (p) {
      p.x = data.x;
      p.y = data.y;
      if (data.bumMode) p.bumMode = true;
    }

    const out = { id: socket.id, x: data.x, y: data.y, flipX: data.flipX };
    if (data.bumMode) out.bumMode = true;
    socket.to(code).emit('player_moved', out);
  }

  onBreakBlock(socket, { tx, ty }) {
    const room = this.getRoom(socket.id);
    if (!room?.started) return;
    const result = room.breakBlock(tx, ty);
    if (!result) return;

    const code = this.playerRooms.get(socket.id);
    this.io.to(code).emit('block_changed', { tx, ty, blockId: 0 });

    if (result.drop) {
      this.io.to(code).emit('drop_spawned', result.drop);
    }
  }

  onPlaceBlock(socket, { tx, ty, blockId }) {
    const room = this.getRoom(socket.id);
    if (!room?.started) return;
    const code = this.playerRooms.get(socket.id);

    if (room.placeBlock(tx, ty, blockId)) {
      this.io.to(code).emit('block_changed', { tx, ty, blockId });
    }
  }

  onPickupDrop(socket, { dropId }) {
    const room = this.getRoom(socket.id);
    if (!room) return;
    const drop = room.pickupDrop(dropId);
    if (!drop) return;

    const code = this.playerRooms.get(socket.id);
    socket.emit('drop_picked_up', { dropId, itemId: drop.itemId, count: drop.count });
    this.io.to(code).emit('drop_removed', { dropId });
  }

  onSelectSlot(socket, { slot }) {
    const code = this.playerRooms.get(socket.id);
    if (!code) return;
    socket.to(code).emit('player_slot_changed', { id: socket.id, slot });
  }

  onMeleeAttack(socket, { x, y, damage, direction }) {
    const room = this.getRoom(socket.id);
    if (!room?.started || !room.enemySim) return;
    const code = this.playerRooms.get(socket.id);
    const range = MELEE_RANGE * TILE_SIZE;

    let hitEnemy = false;
    for (const e of room.enemySim.enemies) {
      if (e.dead) continue;
      const d = Math.sqrt((e.x - x) ** 2 + (e.y - y) ** 2);
      if (d <= range) {
        room.enemySim.damageEnemy(e, damage, x, socket.id, this.io, code);
        hitEnemy = true;
      }
    }

    if (room.pvpEnabled) {
      for (const [pid, p] of room.players) {
        if (pid === socket.id || p.dead || p.spawnProtection) continue;
        if (p.x === undefined) continue;
        const d = Math.sqrt((p.x - x) ** 2 + (p.y - y) ** 2);
        if (d <= range) {
          room.damagePlayer(pid, damage, this.io, x, y);
        }
      }
    }

    this.io.to(code).emit('player_attacked', { id: socket.id, x, y, direction });
  }

  onFireBow(socket, { x, y, vx, vy, damage }) {
    const room = this.getRoom(socket.id);
    if (!room?.started || !room.enemySim) return;
    const code = this.playerRooms.get(socket.id);
    room.enemySim.spawnPlayerArrow(socket.id, x, y, vx, vy, damage || ARROW_DAMAGE, this.io, code);
  }

  onFirePistol(socket, { x, y, vx, vy }) {
    const room = this.getRoom(socket.id);
    if (!room?.started || !room.enemySim) return;
    const code = this.playerRooms.get(socket.id);
    const dx = vx, dy = vy;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx = dx / dist, ny = dy / dist;
    const maxDist = PISTOL_RANGE * TILE_SIZE;
    const step = TILE_SIZE;

    for (let d = 0; d < maxDist; d += step) {
      const bx = x + nx * d, by = y + ny * d;
      const tx = Math.floor(bx / TILE_SIZE), ty = Math.floor(by / TILE_SIZE);

      if (tx < 0 || tx >= room.worldWidth || ty < 0 || ty >= room.worldHeight) break;
      if (room.getBlock(tx, ty) !== 0) {
        const result = room.breakBlock(tx, ty);
        if (result) {
          this.io.to(code).emit('block_changed', { tx, ty, blockId: 0 });
          if (result.drop) this.io.to(code).emit('drop_spawned', result.drop);
        }
        break;
      }

      let hitSomething = false;
      for (const e of room.enemySim.enemies) {
        if (e.dead) continue;
        const ed = Math.sqrt((e.x - bx) ** 2 + (e.y - by) ** 2);
        if (ed < TILE_SIZE * 1.5) {
          room.enemySim.damageEnemy(e, PISTOL_DAMAGE, bx, socket.id, this.io, code);
          hitSomething = true; break;
        }
      }
      if (hitSomething) break;

      if (room.pvpEnabled) {
        for (const [pid, p] of room.players) {
          if (pid === socket.id || p.dead || p.spawnProtection) continue;
          if (p.x === undefined) continue;
          const pd = Math.sqrt((p.x - bx) ** 2 + (p.y - by) ** 2);
          if (pd < TILE_SIZE * 1.5) {
            room.damagePlayer(pid, PISTOL_DAMAGE, this.io, bx, by);
            hitSomething = true; break;
          }
        }
      }
      if (hitSomething) break;
    }
  }

  onFirePoop(socket, { x, y, vx, vy }) {
    const room = this.getRoom(socket.id);
    if (!room?.started || !room.enemySim) return;
    const code = this.playerRooms.get(socket.id);

    const dx = vx, dy = vy;
    const speed = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx = dx / speed, ny = dy / speed;
    const maxDist = 14 * TILE_SIZE;
    const step = TILE_SIZE;

    for (let d = 0; d < maxDist; d += step) {
      const bx = x + nx * d;
      const by = y + ny * d + 0.5 * 280 * Math.pow(d / speed, 2);
      const tx = Math.floor(bx / TILE_SIZE), ty = Math.floor(by / TILE_SIZE);
      if (tx < 0 || tx >= room.worldWidth || ty < 0 || ty >= room.worldHeight) break;
      if (room.getBlock(tx, ty) !== 0) break;

      let hit = false;
      for (const e of room.enemySim.enemies) {
        if (e.dead) continue;
        const ed = Math.sqrt((e.x - bx) ** 2 + (e.y - by) ** 2);
        if (ed < TILE_SIZE * 1.5) {
          room.enemySim.damageEnemy(e, BUM_POOP_DAMAGE, bx, socket.id, this.io, code);
          hit = true; break;
        }
      }
      if (hit) break;
    }
  }

  onRequestRespawn(socket) {
    const room = this.getRoom(socket.id);
    if (!room?.started) return;
    const p = room.players.get(socket.id);
    if (!p || !p.dead) return;

    const result = room.respawnPlayer(socket.id);
    if (!result) return;

    const code = this.playerRooms.get(socket.id);
    socket.emit('you_respawned', result);
    this.io.to(code).emit('player_respawned', {
      id: socket.id,
      x: result.x * TILE_SIZE + TILE_SIZE / 2,
      y: result.y * TILE_SIZE + TILE_SIZE / 2,
    });
  }

  onTogglePvP(socket) {
    const room = this.getRoom(socket.id);
    if (!room || room.hostId !== socket.id) return;

    room.pvpEnabled = !room.pvpEnabled;
    const code = this.playerRooms.get(socket.id);
    this.io.to(code).emit('pvp_changed', { enabled: room.pvpEnabled });
  }

  onSyncInventory(socket, { inventory }) {
    const room = this.getRoom(socket.id);
    if (!room) return;
    const p = room.players.get(socket.id);
    if (p) p.inventory = inventory;
  }

  onSpawnEnemy(socket, { type, x, y }) {
    const room = this.getRoom(socket.id);
    if (!room?.started || !room.enemySim) return;
    const validTypes = ['zombie', 'skeleton', 'cave_spider', 'warden'];
    if (!validTypes.includes(type)) return;
    const code = this.playerRooms.get(socket.id);
    const pos = room.enemySim.findValidSpawn(x, y);
    if (!pos) return;
    const e = room.enemySim.createEnemy(pos.x, pos.y, type);
    if (!e) return;
    const payload = { id: e.id, type: e.type, x: e.x, y: e.y, direction: e.direction };
    this.io.to(code).emit('enemy_spawned', payload);
  }

  onSetTime(socket, { time }) {
    const room = this.getRoom(socket.id);
    if (!room?.started) return;
    room.dayTime = time || 0;
    const code = this.playerRooms.get(socket.id);
    this.io.to(code).emit('time_changed', { dayTime: room.dayTime });
  }

  onGodmodeToggle(socket, { enabled }) {
    const room = this.getRoom(socket.id);
    if (!room) return;
    const p = room.players.get(socket.id);
    if (p) p.godMode = !!enabled;
  }

  onDisconnect(socket) {
    const code = this.playerRooms.get(socket.id);
    this.playerRooms.delete(socket.id);
    if (!code) return;

    const room = this.rooms.get(code);
    if (!room) return;

    room.players.delete(socket.id);
    delete room.killCounts[socket.id];

    if (room.players.size === 0) {
      room.destroy();
      this.rooms.delete(code);
      return;
    }

    if (room.hostId === socket.id) {
      room.hostId = room.players.keys().next().value;
    }
    this.io.to(code).emit('player_left', { id: socket.id });
    this.io.to(code).emit('player_list', { players: this.playerList(room), pvpEnabled: room.pvpEnabled });
  }
}
