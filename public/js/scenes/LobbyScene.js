import { GAME_WIDTH, GAME_HEIGHT } from '../constants.js';

export class LobbyScene extends Phaser.Scene {
  constructor() { super('LobbyScene'); }

  init(data) {
    this.network = data.network;
    this.roomCode = data.roomCode;
    this.isHost = data.isHost;
    this.myName = data.myName;
    this.playerData = data.players || [];
    this.pvpEnabled = data.pvpEnabled || false;
  }

  create() {
    this.cameras.main.setBackgroundColor('#1a1a2e');

    this.add.text(GAME_WIDTH / 2, 30, 'LOBBY', {
      fontSize: '28px', fontFamily: 'monospace', color: '#4ca832', fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(GAME_WIDTH / 2, 70, 'Room Code', {
      fontSize: '12px', fontFamily: 'monospace', color: '#888',
    }).setOrigin(0.5);

    this.add.text(GAME_WIDTH / 2, 100, this.roomCode, {
      fontSize: '36px', fontFamily: 'monospace', color: '#ff0', fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(GAME_WIDTH / 2, 135, 'Share this code with friends', {
      fontSize: '10px', fontFamily: 'monospace', color: '#666',
    }).setOrigin(0.5);

    this.add.text(GAME_WIDTH / 2, 170, 'Players', {
      fontSize: '14px', fontFamily: 'monospace', color: '#aaa',
    }).setOrigin(0.5);

    this.playerListTexts = [];
    for (let i = 0; i < 4; i++) {
      const t = this.add.text(GAME_WIDTH / 2, 200 + i * 28, '', {
        fontSize: '16px', fontFamily: 'monospace', color: '#fff',
      }).setOrigin(0.5);
      this.playerListTexts.push(t);
    }

    this.updatePlayerDisplay();

    this.pvpLabel = this.add.text(GAME_WIDTH / 2, 325, '', {
      fontSize: '13px', fontFamily: 'monospace', color: '#aaa',
    }).setOrigin(0.5);
    this.updatePvPLabel();

    if (this.isHost) {
      const pvpBtn = this.add.text(GAME_WIDTH / 2 + 100, 325, '[Toggle]', {
        fontSize: '12px', fontFamily: 'monospace', color: '#8cf',
        backgroundColor: '#333', padding: { x: 6, y: 2 },
      }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });
      pvpBtn.on('pointerdown', () => { this.network.emit('toggle_pvp'); });

      this.startBtn = this.add.text(GAME_WIDTH / 2, 370, 'Start Game', {
        fontSize: '20px', fontFamily: 'monospace', color: '#eee',
        backgroundColor: '#2a6e2a', padding: { x: 24, y: 10 },
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      this.startBtn.on('pointerover', () => this.startBtn.setBackgroundColor('#3a8e3a'));
      this.startBtn.on('pointerout', () => this.startBtn.setBackgroundColor('#2a6e2a'));
      this.startBtn.on('pointerdown', () => { this.network.emit('start_game'); });
    } else {
      this.add.text(GAME_WIDTH / 2, 370, 'Waiting for host to start...', {
        fontSize: '14px', fontFamily: 'monospace', color: '#888',
      }).setOrigin(0.5);
    }

    this.add.text(GAME_WIDTH / 2, 440, 'Leave', {
      fontSize: '14px', fontFamily: 'monospace', color: '#f88',
      backgroundColor: '#333', padding: { x: 16, y: 6 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        this.network.disconnect();
        this.scene.start('MainMenuScene');
      });

    this.network.on('player_list', (data) => {
      this.playerData = data.players;
      if (data.pvpEnabled !== undefined) this.pvpEnabled = data.pvpEnabled;
      this.updatePlayerDisplay();
      this.updatePvPLabel();
    });

    this.network.on('pvp_changed', (data) => {
      this.pvpEnabled = data.enabled;
      this.updatePvPLabel();
    });

    this.network.on('game_started', (data) => {
      this.scene.start('MultiplayerGameScene', {
        network: this.network,
        gameState: data,
        myName: this.myName,
      });
    });
  }

  updatePvPLabel() {
    if (this.pvpLabel) {
      this.pvpLabel.setText(`PvP: ${this.pvpEnabled ? 'ON' : 'OFF'}`);
      this.pvpLabel.setColor(this.pvpEnabled ? '#ff8888' : '#88ff88');
    }
  }

  updatePlayerDisplay() {
    for (let i = 0; i < 4; i++) {
      if (i < this.playerData.length) {
        const p = this.playerData[i];
        const tag = p.isHost ? ' [HOST]' : '';
        const me = p.id === this.network.id ? ' (you)' : '';
        this.playerListTexts[i].setText(`${i + 1}. ${p.name}${tag}${me}`);
        this.playerListTexts[i].setColor(p.isHost ? '#ff0' : '#fff');
      } else {
        this.playerListTexts[i].setText(`${i + 1}. (empty)`);
        this.playerListTexts[i].setColor('#444');
      }
    }
  }
}
