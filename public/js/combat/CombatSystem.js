import {
  TILE_SIZE, MELEE_COOLDOWN, MELEE_RANGE, FIST_DAMAGE,
  KNOCKBACK_FORCE, BOW_DRAW_TIME, ARROW_SPEED, ARROW_DAMAGE, ARROW_GRAVITY,
} from '../constants.js';
import { ITEMS } from '../items.js';
import { soundManager } from '../audio/SoundManager.js';

export class CombatSystem {
  constructor(scene) {
    this.scene = scene;
    this.attackCooldown = 0;
    this.bowDrawing = false;
    this.bowDrawTime = 0;

    this.playerArrows = scene.physics.add.group();
    this.enemyArrows = scene.physics.add.group();
    scene.physics.add.collider(this.playerArrows, scene.layer, this.arrowHitTerrain, null, this);
    scene.physics.add.collider(this.enemyArrows, scene.layer, this.arrowHitTerrain, null, this);

    scene.physics.add.overlap(this.enemyArrows, scene.player.sprite, this.enemyArrowHitPlayer, null, this);
  }

  update(delta) {
    const dt = delta / 1000;
    if (this.attackCooldown > 0) this.attackCooldown -= dt;

    this.updateArrowRotation(this.playerArrows);
    this.updateArrowRotation(this.enemyArrows);
    this.cleanupArrows(this.playerArrows);
    this.cleanupArrows(this.enemyArrows);

    const held = this.scene.inventory.getSelectedItemDef();
    if (held && held.toolType === 'bow' && this.bowDrawing) {
      this.bowDrawTime += dt;
    }
  }

  handleLeftClick(pointer) {
    const held = this.scene.inventory.getSelectedItemDef();
    if (held && held.toolType === 'bow') {
      this.bowDrawing = true;
      this.bowDrawTime = 0;
      return true;
    }
    return this.meleeAttack(held);
  }

  handleLeftRelease() {
    if (this.bowDrawing) {
      const held = this.scene.inventory.getSelectedItemDef();
      if (held && held.toolType === 'bow' && this.bowDrawTime >= BOW_DRAW_TIME) {
        this.fireBow();
      }
      this.bowDrawing = false;
      this.bowDrawTime = 0;
    }
  }

  meleeAttack(weaponDef) {
    if (this.attackCooldown > 0) return true;
    this.attackCooldown = MELEE_COOLDOWN;

    const player = this.scene.player;
    const damage = weaponDef?.damage || (weaponDef?.toolType ? 2 : FIST_DAMAGE);
    const range = MELEE_RANGE * TILE_SIZE;

    let hit = false;
    for (const enemy of this.scene.enemyManager.enemies) {
      if (enemy.dead) continue;
      const dx = enemy.sprite.x - player.sprite.x;
      const dy = enemy.sprite.y - player.sprite.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= range) {
        enemy.takeDamage(damage, player.sprite.x);
        hit = true;
      }
    }
    soundManager.play(hit ? 'sword_hit' : 'sword_hit');

    if (hit && weaponDef && weaponDef.maxDurability) {
      this.scene.inventory.useDurability(this.scene.inventory.selectedSlot);
    }

    return true;
  }

  fireBow() {
    const inv = this.scene.inventory;
    let arrowSlot = -1;
    for (let i = 0; i < inv.slots.length; i++) {
      const s = inv.slots[i];
      if (s && s.itemId === 'arrow') { arrowSlot = i; break; }
    }
    if (arrowSlot === -1) return;

    inv.removeFromSlot(arrowSlot, 1);
    inv.useDurability(inv.selectedSlot);

    const player = this.scene.player.sprite;
    const pointer = this.scene.input.activePointer;
    const wp = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);

    const dx = wp.x - player.x;
    const dy = wp.y - player.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const vx = (dx / dist) * ARROW_SPEED;
    const vy = (dy / dist) * ARROW_SPEED;

    this.spawnArrow(player.x, player.y - 4, vx, vy, this.playerArrows, ARROW_DAMAGE);
    soundManager.play('bow_shot');
  }

  spawnArrow(x, y, vx, vy, group, damage) {
    const arrow = group.create(x, y, 'arrow_proj');
    arrow.body.setGravityY(ARROW_GRAVITY);
    arrow.body.setVelocity(vx, vy);
    arrow.body.setCollideWorldBounds(true);
    arrow.body.onWorldBounds = true;
    arrow.setData('damage', damage);
    arrow.setData('lifetime', 0);
    arrow.setDepth(6);
    arrow.body.setSize(6, 2);
    return arrow;
  }

  spawnEnemyArrow(fromX, fromY, targetSprite) {
    const dx = targetSprite.x - fromX;
    const dy = (targetSprite.y - 8) - fromY;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const speed = ARROW_SPEED * 0.6;
    const vx = (dx / dist) * speed;
    const vy = (dy / dist) * speed - 40;
    this.spawnArrow(fromX, fromY, vx, vy, this.enemyArrows, 3);
  }

  updateArrowRotation(group) {
    group.children.each(arrow => {
      if (!arrow.active) return;
      arrow.setData('lifetime', (arrow.getData('lifetime') || 0) + 1);
      const vx = arrow.body.velocity.x;
      const vy = arrow.body.velocity.y;
      arrow.rotation = Math.atan2(vy, vx);
      if (vx < 0) arrow.setFlipY(true); else arrow.setFlipY(false);
    });
  }

  cleanupArrows(group) {
    group.children.each(arrow => {
      if (!arrow.active) return;
      if ((arrow.getData('lifetime') || 0) > 300) arrow.destroy();
    });
  }

  checkPlayerArrowsVsEnemies() {
    const enemies = this.scene.enemyManager.enemies;
    this.playerArrows.children.each(arrow => {
      if (!arrow.active) return;
      for (const enemy of enemies) {
        if (enemy.dead || !enemy.sprite.active) continue;
        const dx = arrow.x - enemy.sprite.x;
        const dy = arrow.y - enemy.sprite.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < TILE_SIZE * 1.2) {
          enemy.takeDamage(arrow.getData('damage') || ARROW_DAMAGE, arrow.x);
          arrow.destroy();
          return;
        }
      }
    });
  }

  arrowHitTerrain(arrow) {
    if (arrow && arrow.active) arrow.destroy();
  }

  enemyArrowHitPlayer(playerSprite, arrow) {
    const player = this.scene.player;
    if (player) {
      player.takeDamage(arrow.getData('damage') || 3, arrow.x, arrow.y);
      soundManager.play('player_hurt');
    }
    if (arrow && arrow.active) arrow.destroy();
  }

  destroy() {
    this.playerArrows.destroy(true);
    this.enemyArrows.destroy(true);
  }
}
