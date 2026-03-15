import { GAME_WIDTH, GAME_HEIGHT } from './constants.js';
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
    GameScene, HUDScene, PauseScene,
    InventoryScene, CraftingTableScene, FurnaceScene, DeathScene,
  ],
};

new Phaser.Game(config);
