import { GAME_WIDTH, GAME_HEIGHT } from '../constants.js';
import { soundManager } from '../audio/SoundManager.js';
import { gameLogger } from '../utils/GameLogger.js';

export class DeathScene extends Phaser.Scene {
  constructor() { super('DeathScene'); }

  create() {
    gameLogger.scene('DeathScene', 'create');
    soundManager.play('player_death');
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x330000, 0.8);

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 60, 'You Died!', {
      fontSize: '42px', fontFamily: 'monospace', color: '#ff4444', fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 15, 'You dropped some of your items.', {
      fontSize: '12px', fontFamily: 'monospace', color: '#999',
    }).setOrigin(0.5);

    const btn = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 30, 'Respawn', {
      fontSize: '22px', fontFamily: 'monospace', color: '#eee',
      backgroundColor: '#555', padding: { x: 28, y: 10 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    btn.on('pointerover', () => btn.setBackgroundColor('#777'));
    btn.on('pointerout', () => btn.setBackgroundColor('#555'));
    btn.on('pointerdown', () => {
      soundManager.play('click');
      const game = this.scene.get('GameScene');
      if (game && game.respawn) game.respawn();
      this.scene.resume('GameScene');
      this.scene.stop();
    });
  }
}
