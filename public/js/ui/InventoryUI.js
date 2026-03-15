import { ITEMS } from '../items.js';

const SZ = 30;
const GAP = 2;

export class InventoryUI {
  constructor(scene) {
    this.scene = scene;
    this.groups = [];
    this.heldItem = null;
    this.gfx = scene.add.graphics().setDepth(100);
    this.icons = [];
    this.counts = [];
    this.durBars = [];
    this.heldIcon = scene.add.image(0, 0, '__DEFAULT').setVisible(false).setDepth(110).setScale(1.5);
    this.heldCount = scene.add.text(0, 0, '', {
      fontSize: '10px', fontFamily: 'monospace', color: '#fff', stroke: '#000', strokeThickness: 2
    }).setVisible(false).setDepth(111);

    this.dragging = false;
    this.dragVisited = new Set();

    scene.input.on('pointermove', (pointer) => {
      if (this.dragging && pointer.rightButtonDown()) this.handleDragOver(pointer);
    });
    scene.input.on('pointerup', (pointer) => {
      if (pointer.button === 2) this.dragging = false;
    });
  }

  addGroup(name, opts) {
    const { x, y, cols, count, getSlot, setSlot, canPlace, readOnly, onTake, onChange } = opts;
    const group = { name, x, y, cols, count, getSlot, setSlot, canPlace, readOnly, onTake, onChange, iconStart: this.icons.length };
    for (let i = 0; i < count; i++) {
      this.icons.push(this.scene.add.image(0, 0, '__DEFAULT').setVisible(false).setDepth(101).setScale(1.5));
      this.counts.push(this.scene.add.text(0, 0, '', {
        fontSize: '10px', fontFamily: 'monospace', color: '#fff', stroke: '#000', strokeThickness: 2
      }).setVisible(false).setDepth(102));
    }
    this.groups.push(group);
    return group;
  }

  slotBounds(group, i) {
    const col = i % group.cols, row = Math.floor(i / group.cols);
    return { x: group.x + col * (SZ + GAP), y: group.y + row * (SZ + GAP), w: SZ, h: SZ };
  }

  render() {
    this.gfx.clear();
    for (const g of this.groups) {
      for (let i = 0; i < g.count; i++) {
        const b = this.slotBounds(g, i);
        const item = g.getSlot(i);
        this.gfx.fillStyle(0x333333, 0.92);
        this.gfx.fillRect(b.x, b.y, b.w, b.h);
        this.gfx.lineStyle(1, 0x888888, 1);
        this.gfx.strokeRect(b.x, b.y, b.w, b.h);

        const idx = g.iconStart + i;
        const icon = this.icons[idx];
        const ct = this.counts[idx];
        if (item) {
          const def = ITEMS[item.itemId];
          if (def) { icon.setTexture(def.textureKey).setPosition(b.x + b.w / 2, b.y + b.h / 2).setVisible(true); }
          if (item.count > 1) { ct.setText(String(item.count)).setPosition(b.x + b.w - 2, b.y + b.h - 2).setOrigin(1, 1).setVisible(true); }
          else ct.setVisible(false);
          if (item.durability !== undefined && def && def.maxDurability) {
            const ratio = item.durability / def.maxDurability;
            const color = ratio > 0.5 ? 0x00cc00 : ratio > 0.25 ? 0xcccc00 : 0xcc0000;
            this.gfx.fillStyle(color, 1);
            this.gfx.fillRect(b.x + 2, b.y + b.h - 4, (b.w - 4) * ratio, 2);
          }
        } else {
          icon.setVisible(false);
          ct.setVisible(false);
        }
      }
    }
    const ptr = this.scene.input.activePointer;
    if (this.heldItem) {
      const def = ITEMS[this.heldItem.itemId];
      if (def) this.heldIcon.setTexture(def.textureKey).setPosition(ptr.x, ptr.y).setVisible(true);
      if (this.heldItem.count > 1) this.heldCount.setText(String(this.heldItem.count)).setPosition(ptr.x + 10, ptr.y + 10).setVisible(true);
      else this.heldCount.setVisible(false);
    } else {
      this.heldIcon.setVisible(false);
      this.heldCount.setVisible(false);
    }
  }

  findSlotAt(px, py) {
    for (const g of this.groups) {
      for (let i = 0; i < g.count; i++) {
        const b = this.slotBounds(g, i);
        if (px >= b.x && px < b.x + b.w && py >= b.y && py < b.y + b.h) {
          return { group: g, idx: i };
        }
      }
    }
    return null;
  }

  handleClick(pointer) {
    if (pointer.button === 2) return this.handleRightClick(pointer);
    const hit = this.findSlotAt(pointer.x, pointer.y);
    if (hit) { this.clickSlot(hit.group, hit.idx); return true; }
    return false;
  }

  handleRightClick(pointer) {
    const hit = this.findSlotAt(pointer.x, pointer.y);
    if (!hit) return false;
    const { group, idx } = hit;
    if (group.readOnly) { this.clickSlot(group, idx); return true; }

    if (this.heldItem) {
      if (group.canPlace && !group.canPlace(idx, this.heldItem)) return true;
      const current = group.getSlot(idx);
      if (!current) {
        group.setSlot(idx, { ...this.heldItem, count: 1 });
        this.heldItem.count--;
        if (this.heldItem.count <= 0) this.heldItem = null;
      } else if (current.itemId === this.heldItem.itemId && !current.durability) {
        const def = ITEMS[current.itemId];
        if (current.count < def.maxStack) {
          group.setSlot(idx, { ...current, count: current.count + 1 });
          this.heldItem.count--;
          if (this.heldItem.count <= 0) this.heldItem = null;
        }
      }
      if (group.onChange) group.onChange();

      if (this.heldItem && this.heldItem.count > 0) {
        this.dragging = true;
        this.dragVisited.clear();
        this.dragVisited.add(`${group.name}:${idx}`);
      }
    } else {
      const current = group.getSlot(idx);
      if (current) {
        const half = Math.ceil(current.count / 2);
        this.heldItem = { ...current, count: half };
        const remaining = current.count - half;
        group.setSlot(idx, remaining > 0 ? { ...current, count: remaining } : null);
        if (group.onChange) group.onChange();
      }
    }
    return true;
  }

  handleDragOver(pointer) {
    if (!this.heldItem || this.heldItem.count <= 0) { this.dragging = false; return; }
    const hit = this.findSlotAt(pointer.x, pointer.y);
    if (!hit) return;
    const { group, idx } = hit;
    if (group.readOnly) return;

    const key = `${group.name}:${idx}`;
    if (this.dragVisited.has(key)) return;

    if (group.canPlace && !group.canPlace(idx, this.heldItem)) return;

    const current = group.getSlot(idx);
    if (!current) {
      group.setSlot(idx, { ...this.heldItem, count: 1 });
    } else if (current.itemId === this.heldItem.itemId && !current.durability) {
      const def = ITEMS[current.itemId];
      if (current.count >= def.maxStack) return;
      group.setSlot(idx, { ...current, count: current.count + 1 });
    } else {
      return;
    }

    this.dragVisited.add(key);
    this.heldItem.count--;
    if (group.onChange) group.onChange();
    if (this.heldItem.count <= 0) { this.heldItem = null; this.dragging = false; }
  }

  clickSlot(group, idx) {
    const current = group.getSlot(idx);

    if (group.readOnly) {
      if (!current) return;
      if (group.onTake) {
        if (!this.heldItem) {
          const r = group.onTake(idx);
          if (r) this.heldItem = r;
        } else if (this.heldItem.itemId === current.itemId) {
          const def = ITEMS[this.heldItem.itemId];
          if (this.heldItem.count + current.count <= def.maxStack) {
            const r = group.onTake(idx);
            if (r) this.heldItem.count += r.count;
          }
        }
      }
      return;
    }

    if (!this.heldItem) {
      if (current) {
        this.heldItem = { ...current };
        group.setSlot(idx, null);
        if (group.onChange) group.onChange();
      }
    } else {
      if (group.canPlace && !group.canPlace(idx, this.heldItem)) return;
      if (!current) {
        group.setSlot(idx, { ...this.heldItem });
        this.heldItem = null;
        if (group.onChange) group.onChange();
      } else if (current.itemId === this.heldItem.itemId && !current.durability) {
        const def = ITEMS[current.itemId];
        const space = def.maxStack - current.count;
        if (space > 0) {
          const transfer = Math.min(space, this.heldItem.count);
          group.setSlot(idx, { ...current, count: current.count + transfer });
          this.heldItem.count -= transfer;
          if (this.heldItem.count <= 0) this.heldItem = null;
          if (group.onChange) group.onChange();
        }
      } else {
        const tmp = { ...current };
        group.setSlot(idx, { ...this.heldItem });
        this.heldItem = tmp;
        if (group.onChange) group.onChange();
      }
    }
  }

  returnHeldItem(inventory) {
    if (this.heldItem) {
      inventory.addItem(this.heldItem.itemId, this.heldItem.count, this.heldItem.durability);
      this.heldItem = null;
    }
  }

  destroy() {
    this.gfx.destroy();
    this.icons.forEach(i => i.destroy());
    this.counts.forEach(c => c.destroy());
    this.heldIcon.destroy();
    this.heldCount.destroy();
  }
}
