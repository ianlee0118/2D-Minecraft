import { GAME_WIDTH, GAME_HEIGHT } from '../constants.js';

export class DeathScene extends Phaser.Scene {
  constructor() { super('DeathScene'); }

  create() {
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x550000, 0.7);

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 60, 'You Died!', {
      fontSize: '42px', fontFamily: 'monospace', color: '#ff4444', fontStyle: 'bold'
    }).setOrigin(0.5);

    const btn = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 20, 'Respawn', {
      fontSize: '24px', fontFamily: 'monospace', color: '#eee',
      backgroundColor: '#444', padding: { x: 30, y: 12 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    btn.on('pointerover', () => btn.setBackgroundColor('#666'));
    btn.on('pointerout', () => btn.setBackgroundColor('#444'));
    btn.on('pointerdown', () => {
      const game = this.scene.get('GameScene');
      if (game && game.respawn) game.respawn();
      this.scene.resume('GameScene');
      this.scene.stop();
    });
  }
}
