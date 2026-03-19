import { GAME_WIDTH, GAME_HEIGHT } from '../constants.js';
import { soundManager } from '../audio/SoundManager.js';
import { gameLogger } from '../utils/GameLogger.js';

export class PauseScene extends Phaser.Scene {
  constructor() { super('PauseScene'); }

  create(data) {
    gameLogger.scene('PauseScene', 'create');
    this.gameScene = data && data.gameScene;
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.7);

    this.add.text(GAME_WIDTH / 2, 100, 'PAUSED', {
      fontSize: '36px', fontFamily: 'monospace', color: '#fff',
    }).setOrigin(0.5);

    this.createButton(GAME_WIDTH / 2, 200, 'Resume', () => {
      this.scene.resume('GameScene');
      this.scene.stop();
    });
    this.createButton(GAME_WIDTH / 2, 260, 'Save & Quit', () => {
      if (this.gameScene) this.gameScene.saveGame();
      this.scene.stop('HUDScene');
      this.scene.stop('GameScene');
      this.scene.start('MainMenuScene');
    });

    const volLabel = this.add.text(GAME_WIDTH / 2 - 60, 340, `Vol: ${Math.round(soundManager.volume * 100)}%`, {
      fontSize: '13px', fontFamily: 'monospace', color: '#aaa',
    }).setOrigin(0.5);
    const muteBtn = this.add.text(GAME_WIDTH / 2 + 60, 340, soundManager.muted ? '[Unmute]' : '[Mute]', {
      fontSize: '13px', fontFamily: 'monospace', color: '#8cf',
      backgroundColor: '#333', padding: { x: 6, y: 2 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    muteBtn.on('pointerdown', () => {
      soundManager.muted = !soundManager.muted;
      soundManager.saveSettings();
      muteBtn.setText(soundManager.muted ? '[Unmute]' : '[Mute]');
      volLabel.setText(`Vol: ${soundManager.muted ? 'MUTED' : Math.round(soundManager.volume * 100) + '%'}`);
    });

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 30, 'ESC to resume', {
      fontSize: '11px', fontFamily: 'monospace', color: '#666',
    }).setOrigin(0.5);

    this.input.keyboard.on('keydown-ESC', () => {
      this.scene.resume('GameScene');
      this.scene.stop();
    });
  }

  createButton(x, y, label, callback) {
    const btn = this.add.text(x, y, label, {
      fontSize: '20px', fontFamily: 'monospace', color: '#eee',
      backgroundColor: '#444', padding: { x: 24, y: 10 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    btn.on('pointerover', () => btn.setBackgroundColor('#666'));
    btn.on('pointerout', () => btn.setBackgroundColor('#444'));
    btn.on('pointerdown', () => { soundManager.play('click'); callback(); });
  }
}
