export const BLOCK_AIR = 0;
export const BLOCK_GRASS = 1;
export const BLOCK_DIRT = 2;
export const BLOCK_STONE = 3;
export const BLOCK_WOOD = 4;
export const BLOCK_LEAVES = 5;
export const BLOCK_COAL_ORE = 6;
export const BLOCK_IRON_ORE = 7;
export const BLOCK_DIAMOND_ORE = 8;
export const BLOCK_PLANKS = 9;
export const BLOCK_CRAFTING_TABLE = 10;
export const BLOCK_FURNACE = 11;
export const BLOCK_TORCH = 12;

export const BLOCKS = [
  null,
  { id: 1,  name: 'Grass',          hardness: 1.5, preferredTool: null,      drops: 'dirt' },
  { id: 2,  name: 'Dirt',           hardness: 1,   preferredTool: null,      drops: 'dirt' },
  { id: 3,  name: 'Stone',          hardness: 4,   preferredTool: 'pickaxe', drops: 'stone' },
  { id: 4,  name: 'Wood',           hardness: 2,   preferredTool: 'axe',     drops: 'wood_log' },
  { id: 5,  name: 'Leaves',         hardness: 0.5, preferredTool: null,      drops: 'leaves' },
  { id: 6,  name: 'Coal Ore',       hardness: 4,   preferredTool: 'pickaxe', drops: 'coal' },
  { id: 7,  name: 'Iron Ore',       hardness: 5,   preferredTool: 'pickaxe', drops: 'iron_ore' },
  { id: 8,  name: 'Diamond Ore',    hardness: 6,   preferredTool: 'pickaxe', drops: 'diamond' },
  { id: 9,  name: 'Planks',         hardness: 2,   preferredTool: 'axe',     drops: 'planks' },
  { id: 10, name: 'Crafting Table', hardness: 2.5, preferredTool: 'axe',     drops: 'crafting_table', interactable: true },
  { id: 11, name: 'Furnace',        hardness: 3.5, preferredTool: 'pickaxe', drops: 'furnace_item',   interactable: true },
  { id: 12, name: 'Torch',          hardness: 0,   preferredTool: null,      drops: 'torch',          solid: false },
];

export const NUM_BLOCK_TYPES = BLOCKS.length - 1;
