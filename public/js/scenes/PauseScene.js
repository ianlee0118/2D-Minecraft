import { GAME_WIDTH, GAME_HEIGHT } from '../constants.js';

export class PauseScene extends Phaser.Scene {
  constructor() { super('PauseScene'); }

  create(data) {
    this.gameScene = data && data.gameScene;
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.65);
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 80, 'PAUSED', {
      fontSize: '36px', fontFamily: 'monospace', color: '#fff'
    }).setOrigin(0.5);

    this.createButton(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 10, 'Resume', () => {
      this.scene.resume('GameScene');
      this.scene.stop();
    });
    this.createButton(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 50, 'Save & Quit', () => {
      if (this.gameScene) this.gameScene.saveGame();
      this.scene.stop('HUDScene');
      this.scene.stop('GameScene');
      this.scene.start('MainMenuScene');
    });

    this.input.keyboard.on('keydown-ESC', () => {
      this.scene.resume('GameScene');
      this.scene.stop();
    });
  }

  createButton(x, y, label, callback) {
    const btn = this.add.text(x, y, label, {
      fontSize: '22px', fontFamily: 'monospace', color: '#eee',
      backgroundColor: '#444', padding: { x: 20, y: 8 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    btn.on('pointerover', () => btn.setBackgroundColor('#666'));
    btn.on('pointerout', () => btn.setBackgroundColor('#444'));
    btn.on('pointerdown', callback);
  }
}
