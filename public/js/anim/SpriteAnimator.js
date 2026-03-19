/**
 * Lightweight procedural animation via standalone follower sprites.
 * No Containers, no extra textures, no sprite sheets.
 * Each character gets a thin wrapper that manages a bob offset and an optional held-tool sprite.
 */

export class SpriteAnimator {
  constructor(scene, ownerSprite, textureKey, opts = {}) {
    this.scene = scene;
    this.owner = ownerSprite;
    this.animTime = 0;
    this.bobMul = opts.bobMul ?? 1;
    this.squash = opts.squash ?? true;

    this.visual = scene.add.image(ownerSprite.x, ownerSprite.y, textureKey);
    this.visual.setOrigin(0.5, 0.5);
    this.visual.setDepth(opts.depth ?? ownerSprite.depth ?? 4);
    if (opts.scale) this.visual.setScale(opts.scale);
    if (opts.tint != null) this.visual.setTint(opts.tint);

    ownerSprite.setAlpha(0);

    this.tool = null;
    if (opts.showTool) {
      this.tool = scene.add.image(0, 0, '__DEFAULT');
      this.tool.setScale(0.55);
      this.tool.setOrigin(0.5, 0.5);
      this.tool.setDepth((opts.depth ?? 4) + 0.5);
      this.tool.setVisible(false);
    }

    this._lastToolKey = null;
    this._squashing = false;
  }

  update(delta, state = {}) {
    if (!this.owner || !this.owner.active) {
      this.visual.setVisible(false);
      if (this.tool) this.tool.setVisible(false);
      return;
    }

    const dt = delta / 1000;
    this.animTime += dt;

    const vx = this.owner.body?.velocity?.x ?? 0;
    const moving = state.moving ?? (Math.abs(vx) > 15);
    const onGround = state.onGround ?? (this.owner.body?.blocked?.down ?? false);
    const justLanded = state.justLanded ?? false;
    const flipX = state.flipX ?? this.owner.flipX;
    const crouching = state.crouching ?? false;

    let bobY = 0;
    if (crouching && !moving) {
      bobY = 2;
    } else if (crouching) {
      bobY = 2 + Math.sin(this.animTime * 10) * 0.6;
    } else if (moving) {
      bobY = Math.sin(this.animTime * 14) * 1.5;
    } else {
      bobY = Math.sin(this.animTime * 2.5) * 0.5;
    }

    bobY *= this.bobMul;

    if (this.squash && justLanded && !this._squashing) {
      this._squashing = true;
      this.scene.tweens.add({
        targets: this.visual,
        scaleX: (this.visual.scaleX || 1) * 1.15,
        scaleY: (this.visual.scaleY || 1) * 0.85,
        duration: 70,
        yoyo: true,
        ease: 'Quad.easeOut',
        onComplete: () => { this._squashing = false; },
      });
    }

    const vx2 = Math.round(this.owner.x);
    const vy2 = Math.round(this.owner.y + bobY);
    this.visual.setPosition(vx2, vy2);
    this.visual.setFlipX(flipX);
    this.visual.setVisible(this.owner.visible);

    if (state.alpha !== undefined) this.visual.setAlpha(state.alpha);
    if (state.tint !== undefined) this.visual.setTint(state.tint);

    if (this.tool) {
      this._updateTool(flipX, vy2);
    }
  }

  setToolTexture(textureKey) {
    if (!this.tool) return;
    if (!textureKey) {
      this.tool.setVisible(false);
      this._lastToolKey = null;
      return;
    }
    if (textureKey !== this._lastToolKey) {
      if (this.scene.textures.exists(textureKey)) {
        this.tool.setTexture(textureKey);
        this._lastToolKey = textureKey;
      }
    }
    this.tool.setVisible(this.owner.visible);
  }

  _updateTool(flipX, snappedY) {
    if (!this.tool.visible) return;
    const dx = flipX ? -7 : 7;
    this.tool.setPosition(Math.round(this.owner.x) + dx, snappedY - 2);
    this.tool.setFlipX(flipX);
  }

  setTint(color) { this.visual.setTint(color); }
  clearTint() { this.visual.clearTint(); }
  setAlpha(a) { this.visual.setAlpha(a); }

  destroy() {
    if (this.visual) { this.visual.destroy(); this.visual = null; }
    if (this.tool) { this.tool.destroy(); this.tool = null; }
  }
}
