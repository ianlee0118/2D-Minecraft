export const CRAFTING_RECIPES = [
  { pattern: [['wood_log']], result: { itemId: 'planks', count: 4 } },
  { pattern: [['planks'], ['planks']], result: { itemId: 'sticks', count: 4 } },
  { pattern: [['planks', 'planks'], ['planks', 'planks']], result: { itemId: 'crafting_table', count: 1 } },
  { pattern: [['coal'], ['sticks']], result: { itemId: 'torch', count: 4 } },

  { pattern: [['planks', 'planks', 'planks'], [null, 'sticks', null], [null, 'sticks', null]], result: { itemId: 'wooden_pickaxe', count: 1 } },
  { pattern: [['planks', 'planks'], ['planks', 'sticks'], [null, 'sticks']], result: { itemId: 'wooden_axe', count: 1 } },
  { pattern: [['planks'], ['planks'], ['sticks']], result: { itemId: 'wooden_sword', count: 1 } },

  { pattern: [['stone', 'stone', 'stone'], [null, 'sticks', null], [null, 'sticks', null]], result: { itemId: 'stone_pickaxe', count: 1 } },
  { pattern: [['stone', 'stone'], ['stone', 'sticks'], [null, 'sticks']], result: { itemId: 'stone_axe', count: 1 } },
  { pattern: [['stone'], ['stone'], ['sticks']], result: { itemId: 'stone_sword', count: 1 } },

  { pattern: [['stone', 'stone', 'stone'], ['stone', null, 'stone'], ['stone', 'stone', 'stone']], result: { itemId: 'furnace_item', count: 1 } },

  { pattern: [['iron_ingot', 'iron_ingot', 'iron_ingot'], [null, 'sticks', null], [null, 'sticks', null]], result: { itemId: 'iron_pickaxe', count: 1 } },
  { pattern: [['iron_ingot', 'iron_ingot'], ['iron_ingot', 'sticks'], [null, 'sticks']], result: { itemId: 'iron_axe', count: 1 } },
  { pattern: [['iron_ingot'], ['iron_ingot'], ['sticks']], result: { itemId: 'iron_sword', count: 1 } },

  { pattern: [['diamond', 'diamond', 'diamond'], [null, 'sticks', null], [null, 'sticks', null]], result: { itemId: 'diamond_pickaxe', count: 1 } },
  { pattern: [['diamond', 'diamond'], ['diamond', 'sticks'], [null, 'sticks']], result: { itemId: 'diamond_axe', count: 1 } },
  { pattern: [['diamond'], ['diamond'], ['sticks']], result: { itemId: 'diamond_sword', count: 1 } },

  { pattern: [[null, 'sticks', 'string'], ['sticks', null, 'string'], [null, 'sticks', 'string']], result: { itemId: 'bow', count: 1 } },
  { pattern: [['iron_ingot'], ['sticks'], ['sticks']], result: { itemId: 'arrow', count: 4 } },

  { pattern: [['iron_ingot', null, 'iron_ingot'], ['diamond', 'iron_ingot', 'diamond'], [null, 'wood_log', null]], result: { itemId: 'pistol', count: 1 } },
];

export const SMELTING_RECIPES = [
  { input: 'iron_ore', output: 'iron_ingot', time: 5 },
];
