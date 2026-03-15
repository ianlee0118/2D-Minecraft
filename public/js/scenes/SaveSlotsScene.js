import { GAME_WIDTH, GAME_HEIGHT } from '../constants.js';
import { SaveManager } from '../save/SaveManager.js';

export class SaveSlotsScene extends Phaser.Scene {
  constructor() { super('SaveSlotsScene'); }

  create() {
    this.cameras.main.setBackgroundColor('#1a1a2e');
    this.add.text(GAME_WIDTH / 2, 30, 'Singleplayer – Select World', {
      fontSize: '24px', fontFamily: 'monospace', color: '#eee'
    }).setOrigin(0.5);

    this.slots = SaveManager.getAllSlots();
    for (let i = 0; i < 3; i++) this.createSlotCard(i, 80 + i * 110);

    const back = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 40, 'Back', {
      fontSize: '18px', fontFamily: 'monospace', color: '#eee',
      backgroundColor: '#333', padding: { x: 20, y: 8 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    back.on('pointerover', () => back.setBackgroundColor('#555'));
    back.on('pointerout', () => back.setBackgroundColor('#333'));
    back.on('pointerdown', () => this.scene.start('MainMenuScene'));
  }

  createSlotCard(idx, y) {
    const data = this.slots[idx];
    const cx = GAME_WIDTH / 2;

    this.add.rectangle(cx, y + 30, 500, 80, 0x222233, 0.9).setStrokeStyle(1, 0x555555);

    if (data) {
      const date = new Date(data.lastPlayed || data.createdAt);
      const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      this.add.text(cx - 220, y + 10, `World ${idx + 1}  (Seed: ${data.seed})`, {
        fontSize: '14px', fontFamily: 'monospace', color: '#ccc'
      });
      this.add.text(cx - 220, y + 30, `Last played: ${dateStr}`, {
        fontSize: '12px', fontFamily: 'monospace', color: '#888'
      });

      const load = this.add.text(cx + 100, y + 15, 'Load', {
        fontSize: '16px', fontFamily: 'monospace', color: '#eee',
        backgroundColor: '#2a6e2a', padding: { x: 12, y: 6 },
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      load.on('pointerover', () => load.setBackgroundColor('#3a8e3a'));
      load.on('pointerout', () => load.setBackgroundColor('#2a6e2a'));
      load.on('pointerdown', () => this.scene.start('GameScene', { ...data, saveSlot: idx }));

      const del = this.add.text(cx + 190, y + 15, 'Delete', {
        fontSize: '16px', fontFamily: 'monospace', color: '#eee',
        backgroundColor: '#6e2a2a', padding: { x: 12, y: 6 },
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      del.on('pointerover', () => del.setBackgroundColor('#8e3a3a'));
      del.on('pointerout', () => del.setBackgroundColor('#6e2a2a'));
      del.on('pointerdown', () => { SaveManager.deleteSlot(idx); this.scene.restart(); });

    } else {
      this.add.text(cx - 220, y + 20, `World ${idx + 1}  – Empty`, {
        fontSize: '14px', fontFamily: 'monospace', color: '#666'
      });

      const create = this.add.text(cx + 140, y + 15, 'Create New', {
        fontSize: '16px', fontFamily: 'monospace', color: '#eee',
        backgroundColor: '#2a4a6e', padding: { x: 12, y: 6 },
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      create.on('pointerover', () => create.setBackgroundColor('#3a6a8e'));
      create.on('pointerout', () => create.setBackgroundColor('#2a4a6e'));
      create.on('pointerdown', () => {
        const seed = Math.floor(Math.random() * 2147483647);
        this.scene.start('GameScene', { seed, saveSlot: idx, createdAt: Date.now() });
      });
    }
  }
}
