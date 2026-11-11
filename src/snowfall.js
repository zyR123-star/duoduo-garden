import * as THREE from 'three';
import { mulberry32 } from './flowerGeometry.js';
import { SNOWFLAKE_VARIANTS } from './snowflakeGeometry.js';

const TAU = Math.PI * 2;

function strokeLine(ctx, x1, y1, x2, y2, width, style) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.lineWidth = width;
  ctx.strokeStyle = style;
  ctx.stroke();
}

function fillPolygon(ctx, points, fill, stroke = 'rgba(218, 249, 255, 0.62)', width = 1.4) {
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    ctx.stroke();
  }
}

function drawShard(ctx, cx, cy, angle, halfLength, halfWidth) {
  const ux = Math.cos(angle);
  const uy = Math.sin(angle);
  const tx = -uy;
  const ty = ux;
  const at = (forward, side) => [
    cx + ux * forward + tx * side,
    cy + uy * forward + ty * side,
  ];
  fillPolygon(ctx, [
    at(-halfLength, 0),
    at(-halfLength * 0.25, halfWidth),
    at(halfLength * 0.38, halfWidth),
    at(halfLength, 0),
    at(halfLength * 0.38, -halfWidth),
    at(-halfLength * 0.25, -halfWidth),
  ], 'rgba(174, 232, 246, 0.12)');
  strokeLine(ctx, ...at(-halfLength * 0.65, 0), ...at(halfLength * 0.72, 0),
    1.2, 'rgba(230, 252, 255, 0.62)');
}

function drawFernArm(ctx, radius, seed) {
  strokeLine(ctx, 0, -18, 0, -radius, 3.4, 'rgba(229, 252, 255, 0.94)');
  drawShard(ctx, 0, -radius * 0.2, -Math.PI / 2, radius * 0.22, 17);
  const levels = [0.29, 0.43, 0.57, 0.70, 0.82];
  for (const [index, ratio] of levels.entries()) {
    const y = -radius * ratio;
    const length = (58 - index * 7) * (0.92 + 0.08 * Math.sin(seed + index));
    for (const side of [-1, 1]) {
      const ex = side * length;
      const ey = y - length * (0.29 + index * 0.025);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.quadraticCurveTo(side * length * 0.42, y - length * 0.08, ex, ey);
      ctx.strokeStyle = 'rgba(216, 249, 255, 0.78)';
      ctx.lineWidth = index < 2 ? 2.2 : 1.5;
      ctx.stroke();
      for (let feather = 1; feather <= 3; feather++) {
        const t = feather / 4;
        const fx = ex * t;
        const fy = y + (ey - y) * t;
        const featherLength = length * (0.24 - feather * 0.035);
        strokeLine(ctx, fx, fy, fx + side * featherLength * 0.68,
          fy - featherLength, 0.9, 'rgba(193, 241, 251, 0.48)');
      }
      ctx.beginPath();
      ctx.arc(ex, ey, 2.7 + (index % 2), 0, TAU);
      ctx.fillStyle = 'rgba(240, 253, 255, 0.9)';
      ctx.fill();
    }
  }
}

function drawPlateArm(ctx, radius) {
  strokeLine(ctx, 0, -18, 0, -radius, 3.8, 'rgba(225, 251, 255, 0.94)');
  drawShard(ctx, 0, -radius * 0.39, -Math.PI / 2, radius * 0.14, 20);
  drawShard(ctx, 0, -radius * 0.72, -Math.PI / 2, radius * 0.24, 31);
  strokeLine(ctx, 0, -radius * 0.34, 0, -radius * 0.91, 1.2,
    'rgba(255, 255, 255, 0.75)');
  for (const ratio of [0.38, 0.61]) {
    const y = -radius * ratio;
    for (const side of [-1, 1]) {
      fillPolygon(ctx, [
        [0, y],
        [side * 38, y - 14],
        [side * 19, y - 35],
        [0, y - 24],
      ], 'rgba(180, 235, 248, 0.13)');
    }
  }
}

function drawLeafArm(ctx, radius) {
  strokeLine(ctx, 0, -18, 0, -radius, 3.6, 'rgba(227, 251, 255, 0.94)');
  const levels = [
    { ratio: 0.30, length: 76 },
    { ratio: 0.50, length: 64 },
    { ratio: 0.68, length: 48 },
  ];
  for (const [index, level] of levels.entries()) {
    const y = -radius * level.ratio;
    for (const side of [-1, 1]) {
      const tipX = side * level.length;
      const tipY = y - level.length * 0.33;
      ctx.beginPath();
      ctx.moveTo(0, y + 10);
      ctx.quadraticCurveTo(side * level.length * 0.72, y - level.length * 0.03,
        tipX, tipY);
      ctx.quadraticCurveTo(side * level.length * 0.42, y - level.length * 0.46,
        0, y - level.length * 0.20);
      ctx.closePath();
      ctx.fillStyle = 'rgba(181, 235, 247, 0.16)';
      ctx.fill();
      ctx.strokeStyle = index < 2
        ? 'rgba(228, 252, 255, 0.72)'
        : 'rgba(205, 246, 255, 0.58)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      strokeLine(ctx, 0, y, tipX * 0.86, tipY, 1.05,
        'rgba(245, 254, 255, 0.66)');
      for (let ridge = 1; ridge <= 3; ridge++) {
        const t = ridge / 4;
        strokeLine(ctx, tipX * 0.86 * t,
          y + (tipY - y) * t,
          tipX * 0.86 * t + side * 8,
          y + (tipY - y) * t - 14,
          0.75, 'rgba(211, 247, 255, 0.36)');
      }
    }
  }
  drawShard(ctx, 0, -radius * 0.94, -Math.PI / 2, 38, 27);
}

function drawClusterArm(ctx, radius, seed) {
  strokeLine(ctx, 0, -18, 0, -radius, 3.2, 'rgba(224, 250, 255, 0.94)');
  drawShard(ctx, 0, -radius * 0.22, -Math.PI / 2, 28, 19);
  for (const [index, ratio] of [0.31, 0.46, 0.61, 0.75].entries()) {
    const y = -radius * ratio;
    for (const side of [-1, 1]) {
      const angle = -Math.PI / 2 + side * (1.04 + index * 0.028);
      const length = (32 - index * 3) * (0.9 + 0.1 * Math.sin(seed + index));
      const ex = Math.cos(angle) * length;
      const ey = y + Math.sin(angle) * length;
      strokeLine(ctx, 0, y, ex, ey, 1.6, 'rgba(213, 247, 255, 0.72)');
      drawShard(ctx, ex, ey, angle, 12 - index, 7);
      strokeLine(ctx, ex, ey,
        ex + Math.cos(angle + side * 0.68) * 10,
        ey + Math.sin(angle + side * 0.68) * 10,
        1, 'rgba(240, 253, 255, 0.64)');
    }
  }
  drawShard(ctx, 0, -radius * 0.93, -Math.PI / 2, 22, 13);
}

function makeSnowflakeTexture(variant = 0) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.translate(256, 256);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(147, 230, 246, 0.72)';
  ctx.shadowBlur = 10;

  const radius = 214;

  for (let arm = 0; arm < 6; arm++) {
    ctx.save();
    ctx.rotate(arm * TAU / 6 + (variant - 1) * 0.011);
    if (variant === 0) drawFernArm(ctx, radius, arm * 0.73);
    else if (variant === 1) drawPlateArm(ctx, radius);
    else if (variant === 2) drawLeafArm(ctx, radius);
    else drawClusterArm(ctx, radius, arm * 0.61);
    ctx.restore();
  }

  if (variant === 0) {
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, TAU);
  } else {
    fillPolygon(ctx, [
      [-18, -10], [0, -20], [18, -10],
      [18, 10], [0, 20], [-18, 10],
    ], 'rgba(174, 232, 246, 0.14)');
  }
  ctx.fillStyle = 'rgba(255, 248, 225, 0.95)';
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

export class Snowfall {
  constructor({ count = 18, seed = 7201 } = {}) {
    this.rand = mulberry32(seed);
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 10);
    this.camera.position.z = 2;
    this.items = [];
    this.textures = SNOWFLAKE_VARIANTS.map((_, index) => makeSnowflakeTexture(index));

    for (let i = 0; i < count; i++) this._createItem(i, true);
    this.resize();
  }

  _createItem(index, initial = false) {
    const rand = this.rand;
    const variant = index % this.textures.length;
    const texture = this.textures[variant];
    const material = new THREE.SpriteMaterial({
      map: texture,
      color: index % 4 === 0 ? 0xd7f6ff : 0xf2fdff,
      transparent: true,
      opacity: 0.62 + rand() * 0.25,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    const sprite = new THREE.Sprite(material);
    const item = {
      nx: 0.08 + rand() * 0.84,
      ny: initial ? rand() * 1.1 : -0.12 - rand() * 0.25,
      scale: 0.08 + rand() * 0.115,
      boost: 1,
      speed: 0.018 + rand() * 0.032,
      drift: (rand() - 0.5) * 0.018,
      phase: rand() * TAU,
      baseOpacity: material.opacity,
      spin: (rand() - 0.5) * 0.45,
      rotation: rand() * TAU,
      variant,
      sprite,
      captured: false,
      fade: 1,
    };
    this.items[index] = item;
    this.scene.add(sprite);
    this._place(item);
    return item;
  }

  _place(item) {
    const aspect = this.camera.right;
    item.sprite.position.x = (item.nx - 0.5) * 2 * aspect;
    item.sprite.position.y = 1 - item.ny * 2;
    item.sprite.position.z = (item.nx * 7.13) % 0.5;
    item.sprite.scale.setScalar(item.scale * item.boost);
    item.sprite.material.rotation = item.rotation;
    item.sprite.material.opacity = item.baseOpacity * item.fade;
  }

  resize() {
    const aspect = window.innerWidth / window.innerHeight;
    this.camera.left = -aspect;
    this.camera.right = aspect;
    this.camera.top = 1;
    this.camera.bottom = -1;
    this.camera.updateProjectionMatrix();
    for (const item of this.items) this._place(item);
  }

  screenPosition(item) {
    return {
      x: item.nx * window.innerWidth,
      y: item.ny * window.innerHeight,
    };
  }

  findNearest(px, py, maxDistance = 90) {
    let nearest = null;
    let best = maxDistance;
    for (const item of this.items) {
      if (item.captured) continue;
      const point = this.screenPosition(item);
      const distance = Math.hypot(point.x - px, point.y - py);
      if (distance < best) {
        best = distance;
        nearest = item;
      }
    }
    return nearest ? { item: nearest, distance: best } : null;
  }

  update(dt, attractor = null) {
    const width = window.innerWidth;
    const height = window.innerHeight;
    for (const item of this.items) {
      if (item.captured) {
        item.fade = Math.max(0, item.fade - dt * 2.8);
        item.scale += dt * 0.12;
      } else {
        item.boost += (1 - item.boost) * Math.min(1, dt * 2.4);
        item.ny += item.speed * dt;
        item.nx += Math.sin(item.phase + item.ny * 8) * item.drift * dt;
        item.rotation += item.spin * dt;
        if (item.ny > 1.15) {
          item.ny = -0.12;
          item.nx = 0.06 + this.rand() * 0.88;
        }
      }
      this._place(item);
    }

    if (!attractor || !Number.isFinite(attractor.x) || !Number.isFinite(attractor.y)) return null;
    const nearest = this.findNearest(attractor.x, attractor.y, 170);
    if (nearest) {
      const point = this.screenPosition(nearest.item);
      const dx = (attractor.x - point.x) / width;
      const dy = (attractor.y - point.y) / height;
      nearest.item.nx += dx * Math.min(1, dt * 3.2);
      nearest.item.ny += dy * Math.min(1, dt * 3.2);
      nearest.item.sprite.material.opacity = Math.min(1, nearest.item.baseOpacity * 1.45);
      nearest.item.boost = Math.max(nearest.item.boost, 1.15);
      this._place(nearest.item);
    }
    return nearest;
  }

  capture(item) {
    if (!item) return;
    item.captured = true;
  }

  reset() {
    for (let i = 0; i < this.items.length; i++) {
      const old = this.items[i];
      this.scene.remove(old.sprite);
      old.sprite.material.dispose();
      this._createItem(i);
    }
  }

  render(renderer) {
    renderer.render(this.scene, this.camera);
  }

  dispose() {
    for (const item of this.items) {
      item.sprite.material.dispose();
    }
    for (const texture of this.textures) texture.dispose();
  }
}
