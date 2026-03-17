import { GAME_WIDTH, GAME_HEIGHT } from '../constants.js';
import { soundManager } from '../audio/SoundManager.js';

export class MainMenuScene extends Phaser.Scene {
  constructor() { super('MainMenuScene'); }

  create() {
    this.cameras.main.setBackgroundColor('#1a1a2e');

    this.add.text(GAME_WIDTH / 2, 100, '2D MINECRAFT', {
      fontSize: '40px', fontFamily: 'monospace', color: '#4ca832', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.add.text(GAME_WIDTH / 2, 150, 'A blocky sandbox adventure', {
      fontSize: '14px', fontFamily: 'monospace', color: '#888',
    }).setOrigin(0.5);

    this.createButton(GAME_WIDTH / 2, 240, 'Singleplayer', () => {
      this.scene.start('SaveSlotsScene');
    });
    this.createButton(GAME_WIDTH / 2, 300, 'Multiplayer', () => {
      this.scene.start('MultiplayerMenuScene');
    });
    this.createButton(GAME_WIDTH / 2, 360, 'Settings', () => {
      this.scene.start('SettingsScene');
    });

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 20, 'Phase 7 – The Warden  |  v7.0', {
      fontSize: '11px', fontFamily: 'monospace', color: '#555',
    }).setOrigin(0.5);
  }

  createButton(x, y, label, callback, disabled = false) {
    const btn = this.add.text(x, y, label, {
      fontSize: '20px', fontFamily: 'monospace', color: disabled ? '#666' : '#eee',
      backgroundColor: disabled ? '#2a2a3a' : '#333', padding: { x: 24, y: 10 },
    }).setOrigin(0.5);
    if (!disabled) {
      btn.setInteractive({ useHandCursor: true });
      btn.on('pointerover', () => btn.setBackgroundColor('#555'));
      btn.on('pointerout', () => btn.setBackgroundColor('#333'));
      btn.on('pointerdown', () => { soundManager.play('click'); callback(); });
    }
  }
}
