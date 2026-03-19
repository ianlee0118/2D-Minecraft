import { GAME_WIDTH, GAME_HEIGHT } from '../constants.js';
import { NetworkManager } from '../network/NetworkManager.js';
import { gameLogger } from '../utils/GameLogger.js';

export class MultiplayerMenuScene extends Phaser.Scene {
  constructor() { super('MultiplayerMenuScene'); }

  create() {
    gameLogger.scene('MultiplayerMenuScene', 'create');
    this.cameras.main.setBackgroundColor('#1a1a2e');
    this.network = new NetworkManager();
    this.playerName = 'P-' + String(Math.floor(Math.random() * 10000)).padStart(4, '0');
    this.codeInput = '';
    this.statusText = null;

    this.add.text(GAME_WIDTH / 2, 40, 'MULTIPLAYER', {
      fontSize: '32px', fontFamily: 'monospace', color: '#4ca832', fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(GAME_WIDTH / 2, 90, `Your name: ${this.playerName}`, {
      fontSize: '13px', fontFamily: 'monospace', color: '#aaa',
    }).setOrigin(0.5);

    this.createButton(GAME_WIDTH / 2, 150, 'Create Room', () => this.createRoom());

    this.add.text(GAME_WIDTH / 2, 210, '— or join with code —', {
      fontSize: '12px', fontFamily: 'monospace', color: '#666',
    }).setOrigin(0.5);

    this.codeDisplay = this.add.text(GAME_WIDTH / 2, 250, '_ _ _ _', {
      fontSize: '28px', fontFamily: 'monospace', color: '#fff', letterSpacing: 8,
    }).setOrigin(0.5);

    this.add.text(GAME_WIDTH / 2, 280, 'Type 4-character room code', {
      fontSize: '10px', fontFamily: 'monospace', color: '#666',
    }).setOrigin(0.5);

    this.joinBtn = this.createButton(GAME_WIDTH / 2, 320, 'Join Room', () => this.joinRoom());
    this.joinBtn.setAlpha(0.4);

    this.createButton(GAME_WIDTH / 2, 400, 'Back', () => {
      this.network.disconnect();
      this.scene.start('MainMenuScene');
    });

    this.statusText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 30, '', {
      fontSize: '12px', fontFamily: 'monospace', color: '#f88',
    }).setOrigin(0.5);

    this.input.keyboard.on('keydown', (e) => this.handleKey(e));
  }

  handleKey(event) {
    if (event.key === 'Backspace' && this.codeInput.length > 0) {
      this.codeInput = this.codeInput.slice(0, -1);
    } else if (this.codeInput.length < 4 && /^[A-Za-z0-9]$/.test(event.key)) {
      this.codeInput += event.key.toUpperCase();
    }
    this.updateCodeDisplay();
  }

  updateCodeDisplay() {
    const chars = this.codeInput.padEnd(4, '_').split('');
    this.codeDisplay.setText(chars.join(' '));
    this.joinBtn.setAlpha(this.codeInput.length === 4 ? 1 : 0.4);
  }

  async createRoom() {
    this.statusText.setText('Connecting...').setColor('#ff0');
    try {
      await this.network.connect();
    } catch {
      this.statusText.setText('Connection failed').setColor('#f88');
      return;
    }
    this.network.on('room_created', (data) => {
      this.scene.start('LobbyScene', {
        network: this.network,
        roomCode: data.code,
        players: data.players,
        isHost: true,
        myName: this.playerName,
        pvpEnabled: data.pvpEnabled || false,
      });
    });
    this.network.emit('create_room', { name: this.playerName });
  }

  async joinRoom() {
    if (this.codeInput.length !== 4) return;
    this.statusText.setText('Connecting...').setColor('#ff0');
    try {
      await this.network.connect();
    } catch {
      this.statusText.setText('Connection failed').setColor('#f88');
      return;
    }
    this.network.on('join_error', (data) => {
      this.statusText.setText(data.message).setColor('#f88');
    });
    this.network.on('player_list', (data) => {
      this.scene.start('LobbyScene', {
        network: this.network,
        roomCode: this.codeInput,
        players: data.players,
        isHost: false,
        myName: this.playerName,
        pvpEnabled: data.pvpEnabled || false,
      });
    });
    this.network.on('game_started', (data) => {
      this.scene.start('MultiplayerGameScene', { network: this.network, gameState: data, myName: this.playerName });
    });
    this.network.emit('join_room', { code: this.codeInput, name: this.playerName });
  }

  createButton(x, y, label, callback) {
    const btn = this.add.text(x, y, label, {
      fontSize: '18px', fontFamily: 'monospace', color: '#eee',
      backgroundColor: '#333', padding: { x: 20, y: 8 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    btn.on('pointerover', () => btn.setBackgroundColor('#555'));
    btn.on('pointerout', () => btn.setBackgroundColor('#333'));
    btn.on('pointerdown', callback);
    return btn;
  }
}
