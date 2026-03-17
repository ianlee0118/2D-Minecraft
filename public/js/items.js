import {
  BLOCK_GRASS, BLOCK_DIRT, BLOCK_STONE, BLOCK_WOOD, BLOCK_LEAVES,
  BLOCK_IRON_ORE, BLOCK_PLANKS, BLOCK_CRAFTING_TABLE, BLOCK_FURNACE, BLOCK_TORCH
} from './blocks.js';

export const ITEMS = {
  dirt:            { name: 'Dirt',            maxStack: 64, placesBlock: BLOCK_DIRT,           textureKey: 'block_1' },
  grass:           { name: 'Grass Block',     maxStack: 64, placesBlock: BLOCK_GRASS,          textureKey: 'block_0' },
  stone:           { name: 'Stone',           maxStack: 64, placesBlock: BLOCK_STONE,          textureKey: 'block_2' },
  wood_log:        { name: 'Wood',            maxStack: 64, placesBlock: BLOCK_WOOD,           textureKey: 'block_3' },
  leaves:          { name: 'Leaves',          maxStack: 64, placesBlock: BLOCK_LEAVES,         textureKey: 'block_4' },
  coal:            { name: 'Coal',            maxStack: 64, textureKey: 'item_coal' },
  iron_ore:        { name: 'Iron Ore',        maxStack: 64, placesBlock: BLOCK_IRON_ORE,      textureKey: 'block_6' },
  diamond:         { name: 'Diamond',         maxStack: 64, textureKey: 'item_diamond' },
  planks:          { name: 'Planks',          maxStack: 64, placesBlock: BLOCK_PLANKS,         textureKey: 'block_8' },
  sticks:          { name: 'Sticks',          maxStack: 64, textureKey: 'item_sticks' },
  crafting_table:  { name: 'Crafting Table',  maxStack: 64, placesBlock: BLOCK_CRAFTING_TABLE, textureKey: 'block_9' },
  furnace_item:    { name: 'Furnace',         maxStack: 64, placesBlock: BLOCK_FURNACE,        textureKey: 'block_10' },
  torch:           { name: 'Torch',           maxStack: 64, placesBlock: BLOCK_TORCH,          textureKey: 'block_11' },
  iron_ingot:      { name: 'Iron Ingot',      maxStack: 64, textureKey: 'item_iron_ingot' },

  wooden_pickaxe:  { name: 'Wooden Pickaxe',  maxStack: 1, toolType: 'pickaxe', miningSpeed: 2, maxDurability: 60,  textureKey: 'tool_pickaxe' },
  wooden_axe:      { name: 'Wooden Axe',      maxStack: 1, toolType: 'axe',     miningSpeed: 2, maxDurability: 60,  textureKey: 'tool_axe' },
  wooden_sword:    { name: 'Wooden Sword',    maxStack: 1, toolType: 'sword',   damage: 4,      maxDurability: 60,  textureKey: 'tool_wooden_sword' },
  stone_pickaxe:   { name: 'Stone Pickaxe',   maxStack: 1, toolType: 'pickaxe', miningSpeed: 4, maxDurability: 132, textureKey: 'tool_stone_pickaxe' },
  stone_axe:       { name: 'Stone Axe',       maxStack: 1, toolType: 'axe',     miningSpeed: 4, maxDurability: 132, textureKey: 'tool_stone_axe' },
  stone_sword:     { name: 'Stone Sword',     maxStack: 1, toolType: 'sword',   damage: 5,      maxDurability: 132, textureKey: 'tool_stone_sword' },
  iron_pickaxe:    { name: 'Iron Pickaxe',    maxStack: 1, toolType: 'pickaxe', miningSpeed: 6, maxDurability: 250, textureKey: 'tool_iron_pickaxe' },
  iron_axe:        { name: 'Iron Axe',        maxStack: 1, toolType: 'axe',     miningSpeed: 6, maxDurability: 250, textureKey: 'tool_iron_axe' },
  iron_sword:      { name: 'Iron Sword',      maxStack: 1, toolType: 'sword',   damage: 6,      maxDurability: 250, textureKey: 'tool_iron_sword' },

  diamond_pickaxe: { name: 'Diamond Pickaxe', maxStack: 1, toolType: 'pickaxe', miningSpeed: 9, maxDurability: 500, textureKey: 'tool_diamond_pickaxe' },
  diamond_axe:     { name: 'Diamond Axe',     maxStack: 1, toolType: 'axe',     miningSpeed: 9, maxDurability: 500, textureKey: 'tool_diamond_axe' },
  diamond_sword:   { name: 'Diamond Sword',   maxStack: 1, toolType: 'sword',   damage: 8,      maxDurability: 500, textureKey: 'tool_diamond_sword' },

  bow:             { name: 'Bow',             maxStack: 1, toolType: 'bow',    maxDurability: 384, textureKey: 'tool_bow' },
  arrow:           { name: 'Arrow',           maxStack: 64, textureKey: 'item_arrow' },
  string:          { name: 'String',          maxStack: 64, textureKey: 'item_string' },

  pistol:          { name: 'Pistol',          maxStack: 1, toolType: 'pistol',  damage: 4,      maxDurability: null, textureKey: 'tool_pistol' },

  spawn_zombie:    { name: 'Zombie Spawner',   maxStack: 64, textureKey: 'spawn_zombie',   spawnsEnemy: 'zombie' },
  spawn_skeleton:  { name: 'Skeleton Spawner', maxStack: 64, textureKey: 'spawn_skeleton', spawnsEnemy: 'skeleton' },
  spawn_spider:    { name: 'Spider Spawner',   maxStack: 64, textureKey: 'spawn_spider',   spawnsEnemy: 'cave_spider' },
  spawn_warden:    { name: 'Warden Spawner',   maxStack: 64, textureKey: 'spawn_warden',   spawnsEnemy: 'warden' },
};
