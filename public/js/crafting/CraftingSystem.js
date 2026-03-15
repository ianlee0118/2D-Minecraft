import { CRAFTING_RECIPES } from './recipes.js';

function extractPattern(grid, cols) {
  const rows = Math.ceil(grid.length / cols);
  let minR = rows, maxR = -1, minC = cols, maxC = -1;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r * cols + c]) {
        minR = Math.min(minR, r);
        maxR = Math.max(maxR, r);
        minC = Math.min(minC, c);
        maxC = Math.max(maxC, c);
      }
    }
  }
  if (maxR === -1) return null;

  const pattern = [];
  for (let r = minR; r <= maxR; r++) {
    const row = [];
    for (let c = minC; c <= maxC; c++) {
      const item = grid[r * cols + c];
      row.push(item ? item.itemId : null);
    }
    pattern.push(row);
  }
  return { pattern, minR, minC };
}

export function findRecipe(grid, cols) {
  const extracted = extractPattern(grid, cols);
  if (!extracted) return null;
  const { pattern } = extracted;

  for (const recipe of CRAFTING_RECIPES) {
    const rp = recipe.pattern;
    if (pattern.length !== rp.length) continue;
    if (pattern[0].length !== rp[0].length) continue;
    let match = true;
    for (let r = 0; r < rp.length && match; r++) {
      for (let c = 0; c < rp[r].length && match; c++) {
        if (pattern[r][c] !== (rp[r][c] || null)) match = false;
      }
    }
    if (match) return recipe;
  }
  return null;
}

export function consumeIngredients(grid, cols, recipe) {
  const extracted = extractPattern(grid, cols);
  if (!extracted) return;
  const { minR, minC } = extracted;

  for (let r = 0; r < recipe.pattern.length; r++) {
    for (let c = 0; c < recipe.pattern[r].length; c++) {
      if (recipe.pattern[r][c]) {
        const idx = (minR + r) * cols + (minC + c);
        if (grid[idx]) {
          grid[idx].count--;
          if (grid[idx].count <= 0) grid[idx] = null;
        }
      }
    }
  }
}
