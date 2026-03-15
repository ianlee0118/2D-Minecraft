import { GAME_WIDTH, GAME_HEIGHT } from '../constants.js';

export class SettingsScene extends Phaser.Scene {
  constructor() {
    super('SettingsScene');
  }

  create() {
    this.cameras.main.setBackgroundColor('#1a1a2e');

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, 'Settings', {
      fontSize: '32px',
      fontFamily: 'monospace',
      color: '#eee',
    }).setOrigin(0.5);

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 10, 'Coming in a future phase', {
      fontSize: '16px',
      fontFamily: 'monospace',
      color: '#888',
    }).setOrigin(0.5);

    const back = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 70, 'Back', {
      fontSize: '20px',
      fontFamily: 'monospace',
      color: '#eee',
      backgroundColor: '#333',
      padding: { x: 24, y: 10 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    back.on('pointerover', () => back.setBackgroundColor('#555'));
    back.on('pointerout', () => back.setBackgroundColor('#333'));
    back.on('pointerdown', () => this.scene.start('MainMenuScene'));
  }
}
