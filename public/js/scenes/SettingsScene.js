import { GAME_WIDTH, GAME_HEIGHT } from '../constants.js';
import { soundManager } from '../audio/SoundManager.js';
import { gameLogger } from '../utils/GameLogger.js';
import { isBumEnabled, setBumEnabled } from '../character/BrownUnderwearMode.js';

export class SettingsScene extends Phaser.Scene {
  constructor() { super('SettingsScene'); }

  create() {
    gameLogger.scene('SettingsScene', 'create');
    this.cameras.main.setBackgroundColor('#1a1a2e');

    this.add.text(GAME_WIDTH / 2, 30, 'Settings', {
      fontSize: '32px', fontFamily: 'monospace', color: '#eee',
    }).setOrigin(0.5);

    let y = 80;

    this.add.text(140, y, 'SFX Volume', {
      fontSize: '16px', fontFamily: 'monospace', color: '#ccc',
    }).setOrigin(0, 0.5);
    this.volumeBar = this.createSlider(420, y, soundManager.volume, v => {
      soundManager.volume = v;
      soundManager.saveSettings();
    });
    this.volumeLabel = this.add.text(620, y, `${Math.round(soundManager.volume * 100)}%`, {
      fontSize: '14px', fontFamily: 'monospace', color: '#aaa',
    }).setOrigin(0, 0.5);

    y += 40;
    this.add.text(140, y, 'Mute All', {
      fontSize: '16px', fontFamily: 'monospace', color: '#ccc',
    }).setOrigin(0, 0.5);
    this.muteBtn = this.add.text(420, y, soundManager.muted ? '[ MUTED ]' : '[ ON ]', {
      fontSize: '14px', fontFamily: 'monospace',
      color: soundManager.muted ? '#f66' : '#6f6',
      backgroundColor: '#333', padding: { x: 12, y: 4 },
    }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });
    this.muteBtn.on('pointerdown', () => {
      soundManager.muted = !soundManager.muted;
      soundManager.saveSettings();
      this.muteBtn.setText(soundManager.muted ? '[ MUTED ]' : '[ ON ]');
      this.muteBtn.setColor(soundManager.muted ? '#f66' : '#6f6');
    });

    y += 50;
    this.bumEnabled = isBumEnabled();
    this.add.text(140, y, 'Brown Underwear Mode', {
      fontSize: '16px', fontFamily: 'monospace', color: '#da5',
    }).setOrigin(0, 0.5);
    this.bumBtn = this.add.text(420, y, this.bumEnabled ? '[ ON ]' : '[ OFF ]', {
      fontSize: '14px', fontFamily: 'monospace',
      color: this.bumEnabled ? '#fa4' : '#888',
      backgroundColor: '#333', padding: { x: 12, y: 4 },
    }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });
    this.bumBtn.on('pointerdown', () => {
      this.bumEnabled = !this.bumEnabled;
      setBumEnabled(this.bumEnabled);
      this.bumBtn.setText(this.bumEnabled ? '[ ON ]' : '[ OFF ]');
      this.bumBtn.setColor(this.bumEnabled ? '#fa4' : '#888');
      soundManager.play('click');
    });
    y += 18;
    this.add.text(140, y, 'Goofy tall basketball character with special spawn & attack.', {
      fontSize: '9px', fontFamily: 'monospace', color: '#776',
    }).setOrigin(0, 0.5);

    y += 40;
    this.add.text(GAME_WIDTH / 2, y, '— Controls —', {
      fontSize: '18px', fontFamily: 'monospace', color: '#aaa',
    }).setOrigin(0.5);

    const controls = [
      ['A / D', 'Move left / right'],
      ['Space', 'Jump (double-tap: fly in godmode)'],
      ['Shift', 'Sprint'],
      ['C', 'Crouch (slow move, edge-safe)'],
      ['Left Click', 'Mine / Attack / Shoot'],
      ['Right Click', 'Place block / Open station'],
      ['E', 'Open inventory'],
      ['1-9 / Scroll', 'Select hotbar slot'],
      ['J', 'Poop throw (Brown Underwear Mode only)'],
      ['ESC', 'Pause / Menu'],
      ['\\', 'Toggle godmode'],
    ];
    y += 25;
    for (const [key, desc] of controls) {
      this.add.text(160, y, key, {
        fontSize: '11px', fontFamily: 'monospace', color: '#ff0',
      }).setOrigin(0, 0.5);
      this.add.text(340, y, desc, {
        fontSize: '11px', fontFamily: 'monospace', color: '#999',
      }).setOrigin(0, 0.5);
      y += 18;
    }

    const back = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 30, 'Back', {
      fontSize: '20px', fontFamily: 'monospace', color: '#eee',
      backgroundColor: '#333', padding: { x: 24, y: 10 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    back.on('pointerover', () => back.setBackgroundColor('#555'));
    back.on('pointerout', () => back.setBackgroundColor('#333'));
    back.on('pointerdown', () => {
      soundManager.play('click');
      this.scene.start('MainMenuScene');
    });
  }

  createSlider(x, y, initial, onChange) {
    const barW = 160, barH = 8;
    const gfx = this.add.graphics();
    const thumb = this.add.rectangle(x + barW * initial, y, 12, 22, 0xffffff)
      .setInteractive({ draggable: true, useHandCursor: true });

    const drawBar = (val) => {
      gfx.clear();
      gfx.fillStyle(0x333333, 1); gfx.fillRect(x, y - barH / 2, barW, barH);
      gfx.fillStyle(0x44aaff, 1); gfx.fillRect(x, y - barH / 2, barW * val, barH);
    };
    drawBar(initial);

    thumb.on('drag', (_p, dragX) => {
      const clamped = Phaser.Math.Clamp(dragX, x, x + barW);
      thumb.x = clamped;
      const val = (clamped - x) / barW;
      drawBar(val);
      onChange(val);
      if (this.volumeLabel) this.volumeLabel.setText(`${Math.round(val * 100)}%`);
    });
    return { gfx, thumb };
  }
}
