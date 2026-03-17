import { NUM_BLOCK_TYPES } from '../blocks.js';
import { TILE_SIZE } from '../constants.js';

const S = TILE_SIZE;
function lcg(seed) { return ((seed * 1103515245 + 12345) & 0x7fffffff); }

function drawGrass(ctx, ox, oy) {
  let s = 11111;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    s = lcg(s); const r = ((s >> 16) & 0xff) / 255;
    ctx.fillStyle = y < 4 ? (r < 0.4 ? '#3a8c1f' : r < 0.7 ? '#4ca832' : '#5cb83c')
      : y === 4 ? (r < 0.5 ? '#6b8b3e' : '#7a6b3e')
      : (r < 0.3 ? '#7a5c32' : r < 0.7 ? '#8b6a3e' : '#9c7a4e');
    ctx.fillRect(ox + x, oy + y, 1, 1);
  }
}
function drawDirt(ctx, ox, oy) {
  let s = 22222;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    s = lcg(s); const r = ((s >> 16) & 0xff) / 255;
    ctx.fillStyle = r < 0.3 ? '#7a5c32' : r < 0.7 ? '#8b6a3e' : '#9c7a4e';
    ctx.fillRect(ox + x, oy + y, 1, 1);
  }
}
function drawStone(ctx, ox, oy) {
  let s = 33333;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    s = lcg(s); const r = ((s >> 16) & 0xff) / 255;
    ctx.fillStyle = r < 0.25 ? '#666' : r < 0.6 ? '#808080' : r < 0.85 ? '#999' : '#707070';
    ctx.fillRect(ox + x, oy + y, 1, 1);
  }
}
function drawWood(ctx, ox, oy) {
  const bark = ['#6e5028', '#8b6a3e', '#7a5c32', '#8b6a3e'];
  for (let x = 0; x < S; x++) { ctx.fillStyle = bark[Math.floor(x / 4) % 4]; ctx.fillRect(ox + x, oy, 1, S); }
  ctx.fillStyle = '#5c4420'; ctx.fillRect(ox, oy + 4, S, 1); ctx.fillRect(ox, oy + 11, S, 1);
}
function drawLeaves(ctx, ox, oy) {
  let s = 55555;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    s = lcg(s); const r = ((s >> 16) & 0xff) / 255;
    ctx.fillStyle = r < 0.3 ? '#1e5a0a' : r < 0.7 ? '#2d6e12' : '#3a8c1f';
    ctx.fillRect(ox + x, oy + y, 1, 1);
  }
}
function drawOreSpots(ctx, ox, oy, color, seed) {
  let s = seed;
  const next = () => { s = lcg(s); return ((s >> 16) & 0xff) / 255; };
  ctx.fillStyle = color;
  for (let i = 0; i < 4; i++) {
    const sx = Math.floor(next() * 12) + 2, sy = Math.floor(next() * 12) + 2;
    ctx.fillRect(ox + sx, oy + sy, 2, 2);
    if (next() > 0.5) ctx.fillRect(ox + sx + 2, oy + sy, 1, 1);
    if (next() > 0.5) ctx.fillRect(ox + sx, oy + sy + 2, 1, 1);
  }
}
function drawCoalOre(ctx, ox, oy) { drawStone(ctx, ox, oy); drawOreSpots(ctx, ox, oy, '#222', 66666); }
function drawIronOre(ctx, ox, oy) { drawStone(ctx, ox, oy); drawOreSpots(ctx, ox, oy, '#c4a882', 77777); }
function drawDiamondOre(ctx, ox, oy) { drawStone(ctx, ox, oy); drawOreSpots(ctx, ox, oy, '#44d4cc', 88888); }

function drawPlanks(ctx, ox, oy) {
  const cols = ['#b5894a', '#c49a5c', '#a87d42', '#c49a5c'];
  for (let y = 0; y < S; y++) { ctx.fillStyle = cols[Math.floor(y / 4) % 4]; ctx.fillRect(ox, oy + y, S, 1); }
  ctx.fillStyle = '#8b6a3e'; ctx.fillRect(ox, oy + 3, S, 1); ctx.fillRect(ox, oy + 7, S, 1);
  ctx.fillRect(ox, oy + 11, S, 1); ctx.fillRect(ox, oy + 15, S, 1);
}
function drawCraftingTable(ctx, ox, oy) {
  drawPlanks(ctx, ox, oy);
  ctx.fillStyle = '#5c3d1e'; ctx.fillRect(ox, oy, S, 4);
  ctx.fillStyle = '#8b5e2a'; ctx.fillRect(ox + 1, oy, S - 2, 3);
  ctx.fillStyle = '#444'; ctx.fillRect(ox + 4, oy + 1, 1, 2); ctx.fillRect(ox + 11, oy + 1, 1, 2);
  ctx.fillStyle = '#666'; ctx.fillRect(ox + 7, oy, 2, 3);
}
function drawFurnace(ctx, ox, oy) {
  drawStone(ctx, ox, oy);
  ctx.fillStyle = '#444'; ctx.fillRect(ox + 4, oy + 6, 8, 8);
  ctx.fillStyle = '#333'; ctx.fillRect(ox + 5, oy + 7, 6, 6);
  ctx.fillStyle = '#c63'; ctx.fillRect(ox + 6, oy + 10, 2, 3); ctx.fillRect(ox + 9, oy + 11, 1, 2);
}
function drawTorch(ctx, ox, oy) {
  ctx.fillStyle = '#8b6914'; ctx.fillRect(ox + 7, oy + 5, 2, 9);
  ctx.fillStyle = '#ffcc33'; ctx.fillRect(ox + 6, oy + 2, 4, 4);
  ctx.fillStyle = '#ff9900'; ctx.fillRect(ox + 7, oy + 3, 2, 2);
  ctx.fillStyle = '#ffe066'; ctx.fillRect(ox + 7, oy + 1, 2, 1);
}

const BLOCK_DRAW_FNS = [
  drawGrass, drawDirt, drawStone, drawWood, drawLeaves,
  drawCoalOre, drawIronOre, drawDiamondOre,
  drawPlanks, drawCraftingTable, drawFurnace, drawTorch,
];

function drawToolBase(ctx, handleColor, headColor, headFn) {
  ctx.fillStyle = handleColor;
  for (let i = 0; i < 9; i++) ctx.fillRect(2 + i, 14 - i, 2, 2);
  ctx.fillStyle = headColor;
  headFn(ctx);
}
function pickaxeHead(ctx) { ctx.fillRect(7, 2, 7, 2); ctx.fillRect(7, 4, 2, 3); ctx.fillRect(12, 4, 2, 3); }
function axeHead(ctx) { ctx.fillRect(10, 1, 4, 3); ctx.fillRect(11, 4, 3, 3); }
function swordShape(ctx, bladeColor) {
  ctx.fillStyle = '#8b6914';
  ctx.fillRect(6, 12, 4, 2); ctx.fillRect(7, 14, 2, 2);
  ctx.fillStyle = bladeColor;
  ctx.fillRect(8, 4, 2, 8); ctx.fillRect(7, 3, 4, 2); ctx.fillRect(8, 1, 2, 3);
}

export class BootScene extends Phaser.Scene {
  constructor() { super('BootScene'); }

  create() {
    this.genBlockTextures();
    this.genSmallTexture('player', 16, 30, ctx => {
      ctx.fillStyle = '#4a3728'; ctx.fillRect(4, 0, 8, 4);
      ctx.fillStyle = '#d4a574'; ctx.fillRect(4, 4, 8, 5);
      ctx.fillStyle = '#333'; ctx.fillRect(6, 5, 1, 2); ctx.fillRect(9, 5, 1, 2);
      ctx.fillStyle = '#3b82f6'; ctx.fillRect(3, 9, 10, 9);
      ctx.fillStyle = '#d4a574'; ctx.fillRect(1, 10, 2, 7); ctx.fillRect(13, 10, 2, 7);
      ctx.fillStyle = '#4a4a5a'; ctx.fillRect(4, 18, 4, 8); ctx.fillRect(8, 18, 4, 8);
      ctx.fillStyle = '#333'; ctx.fillRect(3, 26, 5, 3); ctx.fillRect(8, 26, 5, 3);
    });

    const toolDefs = [
      ['tool_pickaxe', '#8b6914', '#a07844', pickaxeHead],
      ['tool_axe', '#8b6914', '#a07844', axeHead],
      ['tool_stone_pickaxe', '#8b6914', '#999', pickaxeHead],
      ['tool_stone_axe', '#8b6914', '#999', axeHead],
      ['tool_iron_pickaxe', '#8b6914', '#ccc', pickaxeHead],
      ['tool_iron_axe', '#8b6914', '#ccc', axeHead],
      ['tool_diamond_pickaxe', '#8b6914', '#44d4cc', pickaxeHead],
      ['tool_diamond_axe', '#8b6914', '#44d4cc', axeHead],
    ];
    for (const [key, handle, head, fn] of toolDefs) {
      this.genSmallTexture(key, 16, 16, ctx => drawToolBase(ctx, handle, head, fn));
    }
    this.genSmallTexture('tool_wooden_sword', 16, 16, ctx => swordShape(ctx, '#a07844'));
    this.genSmallTexture('tool_stone_sword', 16, 16, ctx => swordShape(ctx, '#999'));
    this.genSmallTexture('tool_iron_sword', 16, 16, ctx => swordShape(ctx, '#ccc'));
    this.genSmallTexture('tool_diamond_sword', 16, 16, ctx => swordShape(ctx, '#44d4cc'));

    this.genSmallTexture('tool_bow', 16, 16, ctx => {
      ctx.fillStyle = '#8b6914';
      ctx.fillRect(4, 1, 2, 14);
      ctx.fillRect(6, 0, 2, 1); ctx.fillRect(6, 14, 2, 1);
      ctx.fillStyle = '#ccc';
      ctx.fillRect(10, 1, 1, 14);
      ctx.fillRect(8, 0, 2, 1); ctx.fillRect(8, 14, 2, 1);
    });

    this.genItemTexture('item_coal', '#333', '#222', '#444');
    this.genItemTexture('item_diamond', '#44d4cc', '#33b5ae', '#66e8e0');
    this.genItemTexture('item_iron_ingot', '#ccc', '#aaa', '#eee');
    this.genSmallTexture('item_sticks', 16, 16, ctx => {
      ctx.fillStyle = '#8b6914';
      for (let i = 0; i < 10; i++) ctx.fillRect(3 + i, 13 - i, 2, 2);
    });
    this.genSmallTexture('item_arrow', 16, 16, ctx => {
      ctx.fillStyle = '#aaa';
      ctx.fillRect(11, 1, 2, 3);
      ctx.fillStyle = '#8b6914';
      for (let i = 0; i < 10; i++) ctx.fillRect(3 + i, 13 - i, 2, 2);
      ctx.fillStyle = '#ccc';
      ctx.fillRect(12, 2, 2, 1); ctx.fillRect(13, 1, 1, 2);
    });
    this.genSmallTexture('item_string', 16, 16, ctx => {
      ctx.fillStyle = '#ddd';
      ctx.fillRect(4, 3, 1, 3); ctx.fillRect(5, 5, 1, 3);
      ctx.fillRect(6, 7, 1, 3); ctx.fillRect(7, 9, 1, 3);
      ctx.fillRect(8, 8, 1, 3); ctx.fillRect(9, 6, 1, 3);
      ctx.fillRect(10, 4, 1, 3); ctx.fillRect(11, 3, 1, 3);
    });

    this.genSmallTexture('tool_pistol', 16, 16, ctx => {
      ctx.fillStyle = '#555'; ctx.fillRect(3, 5, 10, 4);
      ctx.fillStyle = '#444'; ctx.fillRect(4, 6, 8, 2);
      ctx.fillStyle = '#666'; ctx.fillRect(2, 5, 2, 3);
      ctx.fillStyle = '#8b6914'; ctx.fillRect(7, 9, 4, 5);
      ctx.fillStyle = '#7a5c32'; ctx.fillRect(8, 10, 2, 3);
      ctx.fillStyle = '#777'; ctx.fillRect(6, 9, 1, 2);
    });
    this.genSmallTexture('bullet_proj', 5, 3, ctx => {
      ctx.fillStyle = '#ff0'; ctx.fillRect(0, 0, 5, 3);
      ctx.fillStyle = '#ffa'; ctx.fillRect(1, 1, 3, 1);
    });

    this.genSmallTexture('arrow_proj', 8, 3, ctx => {
      ctx.fillStyle = '#8b6914'; ctx.fillRect(0, 1, 5, 1);
      ctx.fillStyle = '#ccc'; ctx.fillRect(5, 0, 3, 1); ctx.fillRect(5, 1, 3, 1); ctx.fillRect(5, 2, 3, 1);
    });

    this.genSmallTexture('enemy_zombie', 16, 30, ctx => {
      ctx.fillStyle = '#4a6b2a'; ctx.fillRect(4, 0, 8, 4);
      ctx.fillStyle = '#5a8b3a'; ctx.fillRect(4, 4, 8, 5);
      ctx.fillStyle = '#300'; ctx.fillRect(6, 5, 1, 2); ctx.fillRect(9, 5, 1, 2);
      ctx.fillStyle = '#3a5a2a'; ctx.fillRect(3, 9, 10, 9);
      ctx.fillStyle = '#5a8b3a'; ctx.fillRect(1, 10, 2, 7); ctx.fillRect(13, 10, 2, 7);
      ctx.fillStyle = '#3a4a2a'; ctx.fillRect(4, 18, 4, 8); ctx.fillRect(8, 18, 4, 8);
      ctx.fillStyle = '#2a3a1a'; ctx.fillRect(3, 26, 5, 3); ctx.fillRect(8, 26, 5, 3);
    });
    this.genSmallTexture('enemy_skeleton', 16, 30, ctx => {
      ctx.fillStyle = '#ddd'; ctx.fillRect(4, 0, 8, 4);
      ctx.fillStyle = '#eee'; ctx.fillRect(4, 4, 8, 5);
      ctx.fillStyle = '#111'; ctx.fillRect(5, 5, 2, 2); ctx.fillRect(9, 5, 2, 2);
      ctx.fillStyle = '#111'; ctx.fillRect(6, 7, 4, 1);
      ctx.fillStyle = '#bbb'; ctx.fillRect(5, 9, 6, 8);
      ctx.fillStyle = '#ddd'; ctx.fillRect(2, 10, 3, 1); ctx.fillRect(11, 10, 3, 1);
      ctx.fillStyle = '#ccc'; ctx.fillRect(3, 11, 1, 6); ctx.fillRect(12, 11, 1, 6);
      ctx.fillStyle = '#aaa'; ctx.fillRect(5, 17, 2, 9); ctx.fillRect(9, 17, 2, 9);
      ctx.fillStyle = '#999'; ctx.fillRect(4, 26, 3, 3); ctx.fillRect(9, 26, 3, 3);
    });
    this.genSmallTexture('enemy_spider', 20, 12, ctx => {
      ctx.fillStyle = '#3a2020'; ctx.fillRect(6, 2, 8, 8);
      ctx.fillStyle = '#5a3030'; ctx.fillRect(7, 3, 6, 6);
      ctx.fillStyle = '#c00'; ctx.fillRect(8, 4, 2, 2); ctx.fillRect(11, 4, 2, 2);
      ctx.fillStyle = '#2a1515';
      for (let i = 0; i < 4; i++) {
        ctx.fillRect(0 + i, 1 + i * 2, 6, 1);
        ctx.fillRect(14 - i, 1 + i * 2, 6, 1);
      }
    });

    this.genSmallTexture('enemy_warden', 24, 40, ctx => {
      ctx.fillStyle = '#0a2a2a'; ctx.fillRect(4, 0, 16, 6);
      ctx.fillStyle = '#0d3333'; ctx.fillRect(4, 6, 16, 8);
      ctx.fillStyle = '#00ffff'; ctx.fillRect(7, 7, 3, 3); ctx.fillRect(14, 7, 3, 3);
      ctx.fillStyle = '#0a2a2a'; ctx.fillRect(3, 14, 18, 14);
      ctx.fillStyle = '#0d3333'; ctx.fillRect(5, 15, 14, 12);
      ctx.fillStyle = '#073838'; ctx.fillRect(0, 16, 3, 10); ctx.fillRect(21, 16, 3, 10);
      ctx.fillStyle = '#0a2a2a'; ctx.fillRect(5, 28, 6, 10); ctx.fillRect(13, 28, 6, 10);
      ctx.fillStyle = '#082020'; ctx.fillRect(4, 38, 7, 2); ctx.fillRect(13, 38, 7, 2);
      ctx.fillStyle = '#00cccc'; ctx.fillRect(8, 17, 2, 1); ctx.fillRect(14, 17, 2, 1);
      ctx.fillRect(6, 22, 1, 2); ctx.fillRect(17, 22, 1, 2);
      ctx.fillStyle = '#00aaaa'; ctx.fillRect(10, 20, 4, 1);
    });

    this.genSmallTexture('spawn_zombie', 16, 16, ctx => {
      ctx.fillStyle = '#2a3a1a'; ctx.fillRect(0, 0, 16, 16);
      ctx.fillStyle = '#5a8b3a'; ctx.fillRect(2, 2, 12, 12);
      ctx.fillStyle = '#fff'; ctx.font = '10px monospace'; ctx.fillText('Z', 4, 12);
    });
    this.genSmallTexture('spawn_skeleton', 16, 16, ctx => {
      ctx.fillStyle = '#333'; ctx.fillRect(0, 0, 16, 16);
      ctx.fillStyle = '#ddd'; ctx.fillRect(2, 2, 12, 12);
      ctx.fillStyle = '#000'; ctx.font = '10px monospace'; ctx.fillText('S', 4, 12);
    });
    this.genSmallTexture('spawn_spider', 16, 16, ctx => {
      ctx.fillStyle = '#3a1515'; ctx.fillRect(0, 0, 16, 16);
      ctx.fillStyle = '#5a3030'; ctx.fillRect(2, 2, 12, 12);
      ctx.fillStyle = '#fff'; ctx.font = '10px monospace'; ctx.fillText('P', 4, 12);
    });
    this.genSmallTexture('spawn_warden', 16, 16, ctx => {
      ctx.fillStyle = '#0a2a2a'; ctx.fillRect(0, 0, 16, 16);
      ctx.fillStyle = '#0d3333'; ctx.fillRect(2, 2, 12, 12);
      ctx.fillStyle = '#00cccc'; ctx.fillRect(4, 5, 3, 2); ctx.fillRect(9, 5, 3, 2);
      ctx.fillStyle = '#fff'; ctx.font = '10px monospace'; ctx.fillText('W', 5, 12);
    });

    this.genSmallTexture('heart_full', 9, 9, ctx => {
      ctx.fillStyle = '#cc0000';
      ctx.fillRect(1, 0, 3, 1); ctx.fillRect(5, 0, 3, 1);
      ctx.fillRect(0, 1, 9, 2); ctx.fillRect(0, 3, 9, 1);
      ctx.fillRect(1, 4, 7, 1); ctx.fillRect(2, 5, 5, 1);
      ctx.fillRect(3, 6, 3, 1); ctx.fillRect(4, 7, 1, 1);
      ctx.fillStyle = '#ff4444'; ctx.fillRect(1, 1, 2, 1); ctx.fillRect(5, 1, 2, 1);
    });
    this.genSmallTexture('heart_empty', 9, 9, ctx => {
      ctx.fillStyle = '#441111';
      ctx.fillRect(1, 0, 3, 1); ctx.fillRect(5, 0, 3, 1);
      ctx.fillRect(0, 1, 9, 2); ctx.fillRect(0, 3, 9, 1);
      ctx.fillRect(1, 4, 7, 1); ctx.fillRect(2, 5, 5, 1);
      ctx.fillRect(3, 6, 3, 1); ctx.fillRect(4, 7, 1, 1);
    });
    this.genSmallTexture('heart_half', 9, 9, ctx => {
      ctx.fillStyle = '#441111';
      ctx.fillRect(1, 0, 3, 1); ctx.fillRect(5, 0, 3, 1);
      ctx.fillRect(0, 1, 9, 2); ctx.fillRect(0, 3, 9, 1);
      ctx.fillRect(1, 4, 7, 1); ctx.fillRect(2, 5, 5, 1);
      ctx.fillRect(3, 6, 3, 1); ctx.fillRect(4, 7, 1, 1);
      ctx.fillStyle = '#cc0000';
      ctx.fillRect(1, 0, 3, 1); ctx.fillRect(0, 1, 4, 2); ctx.fillRect(0, 3, 4, 1);
      ctx.fillRect(1, 4, 3, 1); ctx.fillRect(2, 5, 2, 1); ctx.fillRect(3, 6, 1, 1);
    });

    this.scene.start('MainMenuScene');
  }

  genBlockTextures() {
    const count = BLOCK_DRAW_FNS.length;
    const tsC = document.createElement('canvas');
    tsC.width = count * S; tsC.height = S;
    const tsCtx = tsC.getContext('2d');
    BLOCK_DRAW_FNS.forEach((fn, i) => fn(tsCtx, i * S, 0));
    this.textures.addCanvas('tiles', tsC);

    BLOCK_DRAW_FNS.forEach((fn, i) => {
      const c = document.createElement('canvas'); c.width = S; c.height = S;
      fn(c.getContext('2d'), 0, 0);
      this.textures.addCanvas('block_' + i, c);
    });
  }

  genSmallTexture(key, w, h, drawFn) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    drawFn(c.getContext('2d'));
    this.textures.addCanvas(key, c);
  }

  genItemTexture(key, main, dark, light) {
    this.genSmallTexture(key, 16, 16, ctx => {
      ctx.fillStyle = main;  ctx.fillRect(5, 4, 6, 8);
      ctx.fillStyle = dark;  ctx.fillRect(6, 5, 4, 6);
      ctx.fillStyle = light; ctx.fillRect(7, 6, 2, 2);
    });
  }
}
