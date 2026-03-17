import { GAME_WIDTH, GAME_HEIGHT } from './constants.js';
import { gameLogger } from './utils/GameLogger.js';
import { BootScene } from './scenes/BootScene.js';
import { MainMenuScene } from './scenes/MainMenuScene.js';
import { SaveSlotsScene } from './scenes/SaveSlotsScene.js';
import { SettingsScene } from './scenes/SettingsScene.js';
import { GameScene } from './scenes/GameScene.js';
import { HUDScene } from './scenes/HUDScene.js';
import { PauseScene } from './scenes/PauseScene.js';
import { InventoryScene } from './scenes/InventoryScene.js';
import { CraftingTableScene } from './scenes/CraftingTableScene.js';
import { FurnaceScene } from './scenes/FurnaceScene.js';
import { DeathScene } from './scenes/DeathScene.js';
import { MultiplayerMenuScene } from './scenes/MultiplayerMenuScene.js';
import { LobbyScene } from './scenes/LobbyScene.js';
import { MultiplayerGameScene } from './scenes/MultiplayerGameScene.js';

const config = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  pixelArt: true,
  antialias: false,
  backgroundColor: '#1a1a2e',
  physics: {
    default: 'arcade',
    arcade: { gravity: { y: 0 }, debug: false },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [
    BootScene, MainMenuScene, SaveSlotsScene, SettingsScene,
    MultiplayerMenuScene, LobbyScene,
    GameScene, MultiplayerGameScene,
    HUDScene, PauseScene,
    InventoryScene, CraftingTableScene, FurnaceScene, DeathScene,
  ],
};

window.addEventListener('error', (e) => {
  gameLogger.error('Uncaught error:', e.message, e.filename, e.lineno);
  gameLogger.logMemory();
});

window.addEventListener('unhandledrejection', (e) => {
  gameLogger.error('Unhandled promise rejection:', e.reason);
  gameLogger.logMemory();
});

const game = new Phaser.Game(config);
game.events.on('error', (err) => {
  gameLogger.error('Phaser error:', err);
  gameLogger.logMemory();
});
