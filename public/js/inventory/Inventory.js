import { HOTBAR_SLOTS, INVENTORY_SLOTS } from '../constants.js';
import { ITEMS } from '../items.js';

export class Inventory {
  constructor() {
    this.totalSlots = HOTBAR_SLOTS + INVENTORY_SLOTS;
    this.slots = new Array(this.totalSlots).fill(null);
    this.selectedSlot = 0;
  }

  getSlot(index) { return this.slots[index]; }
  getSelectedItem() { return this.slots[this.selectedSlot]; }

  getSelectedItemDef() {
    const slot = this.getSelectedItem();
    return slot ? ITEMS[slot.itemId] : null;
  }

  addItem(itemId, count = 1, durability = null) {
    const def = ITEMS[itemId];
    if (!def) return count;
    let remaining = count;

    if (def.maxStack > 1) {
      for (let i = 0; i < this.totalSlots && remaining > 0; i++) {
        const slot = this.slots[i];
        if (slot && slot.itemId === itemId && slot.count < def.maxStack) {
          const add = Math.min(remaining, def.maxStack - slot.count);
          slot.count += add;
          remaining -= add;
        }
      }
    }

    for (let i = 0; i < this.totalSlots && remaining > 0; i++) {
      if (!this.slots[i]) {
        const add = Math.min(remaining, def.maxStack);
        const slot = { itemId, count: add };
        if (def.maxDurability) {
          slot.durability = durability !== null ? durability : def.maxDurability;
        }
        this.slots[i] = slot;
        remaining -= add;
      }
    }
    return remaining;
  }

  removeFromSlot(index, count = 1) {
    const slot = this.slots[index];
    if (!slot) return;
    slot.count -= count;
    if (slot.count <= 0) this.slots[index] = null;
  }

  useDurability(index) {
    const slot = this.slots[index];
    if (!slot || slot.durability === undefined) return;
    slot.durability--;
    if (slot.durability <= 0) this.slots[index] = null;
  }

  toJSON() {
    return { slots: this.slots.map(s => s ? { ...s } : null), selectedSlot: this.selectedSlot };
  }

  static fromJSON(json) {
    const inv = new Inventory();
    if (json.slots) {
      inv.slots = json.slots.map(s => s ? { ...s } : null);
      while (inv.slots.length < inv.totalSlots) inv.slots.push(null);
    }
    if (json.selectedSlot !== undefined) inv.selectedSlot = json.selectedSlot;
    return inv;
  }
}
