/**
 * 雪花 · 冬季幻想花几何
 * 纯数学模块，不依赖 three.js。
 */

import { mulberry32 } from './flowerGeometry.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;

export const SNOWFLAKE_PALETTE = {
  ice: [0.82, 0.96, 1.0],
  tip: [0.58, 0.88, 1.0],
  web: [0.52, 0.84, 0.94],
  core: [1.0, 0.78, 0.34],
  dust: [0.58, 0.84, 0.9],
};

export const SNOWFLAKE_VARIANTS = [
  { id: 'fern', label: '羽状' },
  { id: 'plate', label: '板晶' },
  { id: 'leaf', label: '叶瓣' },
  { id: 'cluster', label: '密晶' },
];

export function normalizeSnowflakeVariant(value) {
  const numeric = Number(value);
  if (Number.isFinite(numeric) && `${value}`.trim() !== '') {
    return ((Math.trunc(numeric) % SNOWFLAKE_VARIANTS.length) + SNOWFLAKE_VARIANTS.length)
      % SNOWFLAKE_VARIANTS.length;
  }
  const index = SNOWFLAKE_VARIANTS.findIndex((variant) => variant.id === value);
  return index < 0 ? 0 : index;
}

function addSegment(segments, x1, y1, x2, y2, opts = {}) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.hypot(dx, dy);
  if (length < 1e-5) return;
  segments.push({
    x1,
    y1,
    x2,
    y2,
    length,
    width: opts.width ?? 0.018,
    kind: opts.kind ?? 'branch',
    delay: opts.delay ?? 0.16,
    weight: opts.weight ?? 1,
  });
}

function mixColor(a, b, t) {
  return [
    lerp(a[0], b[0], t),
    lerp(a[1], b[1], t),
    lerp(a[2], b[2], t),
  ];
}

function polarPoint(angle, radius) {
  return [Math.cos(angle) * radius, Math.sin(angle) * radius];
}

function addRing(segments, radius, opts = {}) {
  for (let arm = 0; arm < 6; arm++) {
    const a0 = -Math.PI / 2 + arm * TAU / 6;
    const a1 = -Math.PI / 2 + (arm + 1) * TAU / 6;
    const [x1, y1] = polarPoint(a0, radius);
    const [x2, y2] = polarPoint(a1, radius);
    addSegment(segments, x1, y1, x2, y2, opts);
  }
}

function addPlate(segments, cx, cy, angle, halfLength, halfWidth, opts = {}) {
  const ux = Math.cos(angle);
  const uy = Math.sin(angle);
  const tx = -uy;
  const ty = ux;
  const point = (forward, side) => [
    cx + ux * forward + tx * side,
    cy + uy * forward + ty * side,
  ];
  const points = [
    point(-halfLength, 0),
    point(-halfLength * 0.25, halfWidth),
    point(halfLength * 0.36, halfWidth),
    point(halfLength, 0),
    point(halfLength * 0.36, -halfWidth),
    point(-halfLength * 0.25, -halfWidth),
  ];
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    addSegment(segments, a[0], a[1], b[0], b[1], {
      width: 0.008,
      kind: 'edge',
      weight: 0.34,
      ...opts,
    });
  }
  const back = point(-halfLength * 0.72, 0);
  const front = point(halfLength * 0.78, 0);
  addSegment(segments, back[0], back[1], front[0], front[1], {
    width: halfWidth * 0.72,
    kind: 'plate',
    weight: 1.15,
    ...opts,
  });
}

function buildFernSegments(segments, rand) {
  const radius = 1.66;
  for (let arm = 0; arm < 6; arm++) {
    const angle = -Math.PI / 2 + arm * TAU / 6;
    const [sx, sy] = polarPoint(angle, 0.055);
    const [ex, ey] = polarPoint(angle, radius);
    addSegment(segments, sx, sy, ex, ey, {
      width: 0.024,
      kind: 'arm',
      delay: 0.03 + arm * 0.008,
      weight: 1.42,
    });

    const levels = [
      { at: 0.28, length: 0.41, delay: 0.08 },
      { at: 0.42, length: 0.46, delay: 0.12 },
      { at: 0.56, length: 0.41, delay: 0.16 },
      { at: 0.69, length: 0.33, delay: 0.20 },
      { at: 0.81, length: 0.24, delay: 0.24 },
    ];
    for (const [levelIndex, level] of levels.entries()) {
      const [bx, by] = polarPoint(angle, radius * level.at);
      for (const side of [-1, 1]) {
        const branchAngle = angle + side * (1.02 + levelIndex * 0.045);
        const branchLength = level.length * (0.93 + rand() * 0.13);
        const cx = bx + Math.cos(branchAngle) * branchLength;
        const cy = by + Math.sin(branchAngle) * branchLength;
        addSegment(segments, bx, by, cx, cy, {
          width: 0.015 - levelIndex * 0.0015,
          kind: 'branch',
          delay: level.delay + arm * 0.006,
          weight: 0.88 - levelIndex * 0.08,
        });
        for (let twig = 1; twig <= 2; twig++) {
          const t = twig / 3;
          const fx = lerp(bx, cx, t);
          const fy = lerp(by, cy, t);
          for (const turn of [-1, 1]) {
            const twigAngle = branchAngle + turn * (0.42 + levelIndex * 0.025);
            const twigLength = branchLength * (0.22 + rand() * 0.12);
            addSegment(segments, fx, fy,
              fx + Math.cos(twigAngle) * twigLength,
              fy + Math.sin(twigAngle) * twigLength, {
                width: 0.006,
                kind: 'twig',
                delay: level.delay + 0.05 + arm * 0.006,
                weight: 0.25,
              });
          }
        }
        addSegment(segments, cx, cy, cx + Math.cos(branchAngle) * 0.055,
          cy + Math.sin(branchAngle) * 0.055, {
            width: 0.012,
            kind: 'tip',
            delay: level.delay + 0.07 + arm * 0.006,
            weight: 0.34,
          });
      }
    }

    for (const side of [-1, 1]) {
      const forkAngle = angle + side * 0.62;
      addSegment(segments, ex, ey, ex + Math.cos(forkAngle) * 0.17,
        ey + Math.sin(forkAngle) * 0.17, {
          width: 0.009,
          kind: 'tip',
          delay: 0.31 + arm * 0.006,
          weight: 0.28,
        });
    }
  }
  addRing(segments, 0.34, { width: 0.012, kind: 'web', delay: 0.04, weight: 0.46 });
  addRing(segments, 0.61, { width: 0.008, kind: 'web', delay: 0.12, weight: 0.24 });
}

function buildPlateSegments(segments, rand) {
  const radius = 1.46;
  addRing(segments, 0.31, { width: 0.022, kind: 'edge', delay: 0.03, weight: 0.74 });
  for (let arm = 0; arm < 6; arm++) {
    const angle = -Math.PI / 2 + arm * TAU / 6;
    const [sx, sy] = polarPoint(angle, 0.055);
    const [ex, ey] = polarPoint(angle, radius);
    addSegment(segments, sx, sy, ex, ey, {
      width: 0.028,
      kind: 'arm',
      delay: 0.03 + arm * 0.008,
      weight: 1.35,
    });

    const [bx, by] = polarPoint(angle, radius * 0.82);
    addPlate(segments, bx, by, angle, 0.30, 0.20, {
      delay: 0.13 + arm * 0.007,
    });
    const [mx, my] = polarPoint(angle, radius * 0.47);
    addPlate(segments, mx, my, angle, 0.15, 0.13, {
      delay: 0.08 + arm * 0.007,
    });

    for (const [levelIndex, level] of [0.36, 0.58].entries()) {
      const [px, py] = polarPoint(angle, radius * level);
      for (const side of [-1, 1]) {
        const spikeAngle = angle + side * (0.86 + levelIndex * 0.08);
        const spikeLength = (0.23 + rand() * 0.07) * (1 - levelIndex * 0.22);
        addSegment(segments, px, py,
          px + Math.cos(spikeAngle) * spikeLength,
          py + Math.sin(spikeAngle) * spikeLength, {
            width: 0.024,
            kind: 'blade',
            delay: 0.09 + levelIndex * 0.06 + arm * 0.007,
            weight: 0.78,
          });
      }
    }

    const [gx, gy] = polarPoint(angle, radius * 0.36);
    const [hx, hy] = polarPoint(angle, radius * 0.70);
    addSegment(segments, gx, gy, hx, hy, {
      width: 0.008,
      kind: 'web',
      delay: 0.06 + arm * 0.006,
      weight: 0.22,
    });
  }
}

function buildLeafSegments(segments, rand) {
  const radius = 1.68;
  addRing(segments, 0.25, { width: 0.018, kind: 'edge', delay: 0.03, weight: 0.58 });
  for (let arm = 0; arm < 6; arm++) {
    const angle = -Math.PI / 2 + arm * TAU / 6;
    const [sx, sy] = polarPoint(angle, 0.05);
    const [ex, ey] = polarPoint(angle, radius);
    addSegment(segments, sx, sy, ex, ey, {
      width: 0.025,
      kind: 'arm',
      delay: 0.03 + arm * 0.008,
      weight: 1.35,
    });

    const levels = [
      { at: 0.29, length: 0.54, width: 0.052 },
      { at: 0.49, length: 0.45, width: 0.046 },
      { at: 0.67, length: 0.33, width: 0.038 },
    ];
    for (const [levelIndex, level] of levels.entries()) {
      const [bx, by] = polarPoint(angle, radius * level.at);
      for (const side of [-1, 1]) {
        const bladeAngle = angle + side * (0.88 + levelIndex * 0.06);
        const bladeLength = level.length * (0.94 + rand() * 0.11);
        const tipX = bx + Math.cos(bladeAngle) * bladeLength;
        const tipY = by + Math.sin(bladeAngle) * bladeLength;
        addSegment(segments, bx, by, tipX, tipY, {
          width: level.width,
          kind: 'blade',
          delay: 0.09 + levelIndex * 0.055 + arm * 0.007,
          weight: 1.12,
        });
        addSegment(segments, bx, by, tipX, tipY, {
          width: 0.009,
          kind: 'tip',
          delay: 0.12 + levelIndex * 0.055 + arm * 0.007,
          weight: 0.28,
        });
        const [ridgeX, ridgeY] = [
          lerp(bx, tipX, 0.54),
          lerp(by, tipY, 0.54),
        ];
        addSegment(segments, ridgeX, ridgeY,
          ridgeX + Math.cos(bladeAngle + side * 0.58) * level.length * 0.20,
          ridgeY + Math.sin(bladeAngle + side * 0.58) * level.length * 0.20, {
            width: 0.007,
            kind: 'twig',
            delay: 0.15 + levelIndex * 0.05 + arm * 0.007,
            weight: 0.22,
          });
      }
    }

    const [ax, ay] = polarPoint(angle, radius * 0.86);
    const [bx, by] = polarPoint(angle, radius * 1.04);
    addSegment(segments, ax, ay, bx, by, {
      width: 0.061,
      kind: 'blade',
      delay: 0.26 + arm * 0.007,
      weight: 1.18,
    });
  }
}

function buildClusterSegments(segments, rand) {
  const radius = 1.52;
  addRing(segments, 0.27, { width: 0.022, kind: 'edge', delay: 0.03, weight: 0.74 });
  addRing(segments, 0.39, { width: 0.012, kind: 'web', delay: 0.06, weight: 0.36 });
  for (let arm = 0; arm < 6; arm++) {
    const angle = -Math.PI / 2 + arm * TAU / 6;
    const [sx, sy] = polarPoint(angle, 0.04);
    const [ex, ey] = polarPoint(angle, radius);
    addSegment(segments, sx, sy, ex, ey, {
      width: 0.026,
      kind: 'arm',
      delay: 0.03 + arm * 0.007,
      weight: 1.35,
    });

    for (const [levelIndex, at] of [0.30, 0.45, 0.60, 0.74].entries()) {
      const [bx, by] = polarPoint(angle, radius * at);
      for (const side of [-1, 1]) {
        const branchAngle = angle + side * (1.08 + levelIndex * 0.03);
        const branchLength = (0.20 - levelIndex * 0.018) * (0.92 + rand() * 0.15);
        const cx = bx + Math.cos(branchAngle) * branchLength;
        const cy = by + Math.sin(branchAngle) * branchLength;
        addSegment(segments, bx, by, cx, cy, {
          width: 0.014,
          kind: 'branch',
          delay: 0.08 + levelIndex * 0.052 + arm * 0.006,
          weight: 0.58,
        });
        addPlate(segments, cx, cy, branchAngle, 0.115 - levelIndex * 0.009,
          0.061 - levelIndex * 0.004, {
            delay: 0.11 + levelIndex * 0.052 + arm * 0.006,
          });

        const shardAngle = branchAngle + side * 0.64;
        addSegment(segments, cx, cy,
          cx + Math.cos(shardAngle) * (0.10 + rand() * 0.04),
          cy + Math.sin(shardAngle) * (0.10 + rand() * 0.04), {
            width: 0.012,
            kind: 'tip',
            delay: 0.14 + levelIndex * 0.05 + arm * 0.006,
            weight: 0.30,
          });
      }
    }

    const [tx, ty] = polarPoint(angle, radius * 0.92);
    addPlate(segments, tx, ty, angle, 0.16, 0.09, {
      delay: 0.28 + arm * 0.006,
    });
  }
}

export function buildSnowflakeParticles({
  count = 12000,
  seed = 20261111,
  variant = 0,
} = {}) {
  const total = Math.round(clamp(count, 3000, 20000));
  const variantIndex = normalizeSnowflakeVariant(variant);
  const rand = mulberry32(seed + variantIndex * 104729);
  const segments = [];
  if (variantIndex === 0) buildFernSegments(segments, rand);
  else if (variantIndex === 1) buildPlateSegments(segments, rand);
  else if (variantIndex === 2) buildLeafSegments(segments, rand);
  else buildClusterSegments(segments, rand);

  const bud = new Float32Array(total * 3);
  const bloom = new Float32Array(total * 3);
  const normalBud = new Float32Array(total * 3);
  const normalBloom = new Float32Array(total * 3);
  const color = new Float32Array(total * 3);
  const size = new Float32Array(total);
  const seedArr = new Float32Array(total);
  const delay = new Float32Array(total);

  const bodyTarget = Math.floor(total * 0.84);
  const totalWeight = segments.reduce((sum, segment) => sum + segment.length * segment.weight, 0);
  let cursor = 0;

  for (const segment of segments) {
    if (cursor >= bodyTarget) break;
    const quota = Math.max(3, Math.round(bodyTarget * segment.length * segment.weight / totalWeight));
    const dx = segment.x2 - segment.x1;
    const dy = segment.y2 - segment.y1;
    const nx = -dy / segment.length;
    const ny = dx / segment.length;

    for (let j = 0; j < quota && cursor < bodyTarget; j++) {
      const t = clamp((j + rand() * 0.85) / quota, 0, 1);
      const taper = 0.35 + 0.65 * Math.pow(Math.sin(Math.PI * t), 0.38);
      const offset = (rand() - 0.5) * segment.width * 2 * taper;
      const spill = rand() < 0.045 ? 1.7 : 1;
      const px = lerp(segment.x1, segment.x2, t) + nx * offset * spill;
      const py = lerp(segment.y1, segment.y2, t) + ny * offset * spill;
      const pz = (rand() - 0.5) * (0.018 + segment.width * 0.9);
      const theta = Math.atan2(py, px);
      const rr = Math.hypot(px, py);
      const compact = 0.035 + Math.min(0.16, rr * 0.072);

      const i = cursor++;
      bud[i * 3] = Math.cos(theta) * compact * (0.75 + rand() * 0.18);
      bud[i * 3 + 1] = Math.sin(theta) * compact * 1.85 + 0.05;
      bud[i * 3 + 2] = (rand() - 0.5) * 0.075;
      bloom[i * 3] = px;
      bloom[i * 3 + 1] = py;
      bloom[i * 3 + 2] = pz;

      normalBud[i * 3] = Math.cos(theta) * 0.16;
      normalBud[i * 3 + 1] = Math.sin(theta) * 0.16;
      normalBud[i * 3 + 2] = 0.98;
      normalBloom[i * 3] = Math.cos(theta) * 0.12;
      normalBloom[i * 3 + 1] = Math.sin(theta) * 0.12;
      normalBloom[i * 3 + 2] = 0.99;

      let base = SNOWFLAKE_PALETTE.ice;
      if (segment.kind === 'web') base = SNOWFLAKE_PALETTE.web;
      else if (segment.kind === 'tip') base = SNOWFLAKE_PALETTE.tip;
      else if (segment.kind === 'plate') base = mixColor(SNOWFLAKE_PALETTE.ice, SNOWFLAKE_PALETTE.tip, 0.24);
      else if (segment.kind === 'blade') base = mixColor(SNOWFLAKE_PALETTE.ice, SNOWFLAKE_PALETTE.tip, 0.38);
      else if (segment.kind === 'edge') base = mixColor(SNOWFLAKE_PALETTE.ice, SNOWFLAKE_PALETTE.web, 0.28);
      const tipMix = segment.kind === 'arm' ? Math.max(0, t - 0.56) * 0.72 : 0;
      base = mixColor(base, SNOWFLAKE_PALETTE.tip, tipMix);
      const glow = (0.66 + rand() * 0.46) * (segment.kind === 'web' ? 0.72 : 1);
      color[i * 3] = base[0] * glow;
      color[i * 3 + 1] = base[1] * glow;
      color[i * 3 + 2] = base[2] * glow;
      size[i] = 0.009 + rand() * 0.007;
      if (segment.kind === 'plate' || segment.kind === 'blade') size[i] *= 1.14;
      if ((segment.kind === 'branch' || segment.kind === 'tip') && t > 0.84 && rand() < 0.18) {
        size[i] *= 1.65;
      }
      seedArr[i] = rand();
      delay[i] = clamp(segment.delay + rand() * 0.055, 0, 0.72);
    }
  }

  const coreStart = cursor;
  while (cursor < total) {
    const theta = rand() * TAU;
    const coreRadius = 0.035 + Math.pow(rand(), 1.65) * 0.24;
    const warm = rand() < 0.42;
    const i = cursor++;
    bloom[i * 3] = Math.cos(theta) * coreRadius;
    bloom[i * 3 + 1] = Math.sin(theta) * coreRadius * 0.92;
    bloom[i * 3 + 2] = (rand() - 0.5) * 0.045;
    bud[i * 3] = (rand() - 0.5) * 0.055;
    bud[i * 3 + 1] = 0.05 + (rand() - 0.5) * 0.12;
    bud[i * 3 + 2] = (rand() - 0.5) * 0.055;
    normalBud[i * 3] = 0;
    normalBud[i * 3 + 1] = 0;
    normalBud[i * 3 + 2] = 1;
    normalBloom[i * 3] = 0;
    normalBloom[i * 3 + 1] = 0;
    normalBloom[i * 3 + 2] = 1;
    const base = warm ? SNOWFLAKE_PALETTE.core : SNOWFLAKE_PALETTE.ice;
    const glow = 0.30 + rand() * 0.35;
    color[i * 3] = base[0] * glow;
    color[i * 3 + 1] = base[1] * glow;
    color[i * 3 + 2] = base[2] * glow;
    size[i] = 0.007 + rand() * 0.008;
    seedArr[i] = rand();
    delay[i] = 0.02 + rand() * 0.10;
  }

  let maxRadius = 0;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < total; i++) {
    const x = bloom[i * 3];
    const y = bloom[i * 3 + 1];
    maxRadius = Math.max(maxRadius, Math.hypot(x, y));
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }

  return {
    count: total,
    bud,
    bloom,
    normalBud,
    normalBloom,
    color,
    size,
    seed: seedArr,
    delay,
    bounds: {
      radius: maxRadius,
      minY,
      maxY,
      centerY: (minY + maxY) * 0.5,
    },
    stats: {
      arms: 6,
      variant: variantIndex,
      variantId: SNOWFLAKE_VARIANTS[variantIndex].id,
      segments: segments.length,
      core: total - coreStart,
    },
  };
}

export function buildSnowDust(count = 520, seed = 4117) {
  const total = Math.max(0, Math.round(count));
  const rand = mulberry32(seed);
  const pos = new Float32Array(total * 3);
  const size = new Float32Array(total);
  const colors = new Float32Array(total * 3);

  for (let i = 0; i < total; i++) {
    const radius = 0.35 + Math.pow(rand(), 0.55) * 3.2;
    const angle = rand() * TAU;
    pos[i * 3] = Math.cos(angle) * radius;
    pos[i * 3 + 1] = Math.sin(angle) * radius * 0.82;
    pos[i * 3 + 2] = (rand() - 0.5) * 2.4;
    size[i] = 0.006 + rand() * 0.012;
    const glow = 0.18 + rand() * 0.48;
    colors[i * 3] = SNOWFLAKE_PALETTE.dust[0] * glow;
    colors[i * 3 + 1] = SNOWFLAKE_PALETTE.dust[1] * glow;
    colors[i * 3 + 2] = SNOWFLAKE_PALETTE.dust[2] * glow;
  }

  return { count: total, pos, size, colors };
}
