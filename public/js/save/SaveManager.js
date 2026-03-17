const SAVE_PREFIX = '2dmc_save_';
const MAX_SLOTS = 3;

export class SaveManager {
  static getSaveSlot(slot) {
    try {
      const raw = localStorage.getItem(SAVE_PREFIX + slot);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  static saveSlot(slot, data) {
    try {
      data.lastPlayed = Date.now();
      localStorage.setItem(SAVE_PREFIX + slot, JSON.stringify(data));
      return true;
    } catch { return false; }
  }

  static deleteSlot(slot) {
    try { localStorage.removeItem(SAVE_PREFIX + slot); return true; } catch { return false; }
  }

  static getAllSlots() {
    const slots = [];
    for (let i = 0; i < MAX_SLOTS; i++) slots.push(this.getSaveSlot(i));
    return slots;
  }

  static buildSaveData(gameState) {
    return {
      seed: gameState.seed,
      blockChanges: gameState.blockChanges || {},
      playerX: gameState.playerX,
      playerY: gameState.playerY,
      health: gameState.health,
      inventory: gameState.inventory,
      furnaces: gameState.furnaces || {},
      createdAt: gameState.createdAt || Date.now(),
      lastPlayed: Date.now(),
      dayTime: gameState.dayTime || 0,
    };
  }
}
