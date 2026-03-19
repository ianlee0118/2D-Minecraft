const STORAGE_KEY = 'game_settings';

export const BUM_JUMP_MULTIPLIER = 1.35;
export const BUM_FALL_DAMAGE_MULTIPLIER = 0.5;
export const BUM_POOP_DAMAGE = 6;
export const BUM_POOP_COOLDOWN = 1.2;
export const BUM_POOP_SPEED = 320;
export const BUM_POOP_GRAVITY = 280;
export const BUM_BUS_FIRST_SPAWN_DURATION = 3000;
export const BUM_BUS_RESPAWN_DURATION = 1800;

export function isBumEnabled() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      return !!s.brownUnderwearMode;
    }
  } catch (_) { /* ignore */ }
  return false;
}

export function setBumEnabled(enabled) {
  try {
    let s = {};
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) s = JSON.parse(raw);
    } catch (_) { /* start fresh */ }
    s.brownUnderwearMode = !!enabled;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch (_) { /* storage unavailable */ }
}
