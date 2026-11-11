/**
 * 雪花 · 粒子渲染层
 */

import THREE from 'three';
import {
  buildSnowflakeParticles,
  buildSnowDust,
  normalizeSnowflakeVariant,
} from './snowflakeGeometry.js';

const DEG = Math.PI / 180;

const SNOWFLAKE_VERT = /* glsl */ `
  attribute vec3  aBud;
  attribute vec3  aBloom;
  attribute vec3  aNBud;
  attribute vec3  aNBloom;
  attribute vec3  aColor;
  attribute float aSize;
  attribute float aSeed;
  attribute float aDelay;

  uniform float uSpread;
  uniform float uTime;
  uniform float uPointScale;
  uniform float uSizeMul;
  uniform float uGain;

  varying vec3 vColor;

  void main() {
    float sd = smoothstep(aDelay, aDelay + 0.52, uSpread);
    vec3 pos = mix(aBud, aBloom, sd);
    vec3 nrm = normalize(mix(aNBud, aNBloom, sd));
    float ph = aSeed * 6.2831853;

    pos += vec3(
      sin(uTime * 0.48 + ph * 2.7),
      cos(uTime * 0.55 + ph * 2.1),
      sin(uTime * 0.42 + ph * 1.8)
    ) * (0.0015 + 0.0035 * sd);

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;

    vec3 wn = normalize(mat3(modelMatrix) * nrm);
    vec3 lightDir = normalize(vec3(-0.36, 0.62, 0.88));
    float facet = 0.62 + 0.56 * pow(abs(dot(wn, lightDir)), 0.72);
    float shimmer = 0.84 + 0.24 * sin(uTime * 2.2 + ph * 7.0);
    float reveal = 0.68 + 0.32 * sd;
    vColor = aColor * facet * shimmer * reveal * uGain;

    gl_PointSize = max(1.0, aSize * uSizeMul * (0.72 + 0.42 * sd) * uPointScale / max(0.001, -mv.z));
  }
`;

const SNOWFLAKE_FRAG = /* glsl */ `
  varying vec3 vColor;

  void main() {
    vec2 p = gl_PointCoord - 0.5;
    float d = length(p) * 2.0;
    if (d > 1.0) discard;
    float core = pow(1.0 - d, 2.6);
    float glint = exp(-abs(p.x) * 18.0) * (1.0 - abs(p.y) * 1.8);
    gl_FragColor = vec4(vColor * (core + max(0.0, glint) * 0.12), 1.0);
  }
`;

function makeGlowTexture(size = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.16, 'rgba(235,252,255,0.8)');
  gradient.addColorStop(0.42, 'rgba(137,218,241,0.24)');
  gradient.addColorStop(0.76, 'rgba(84,167,190,0.05)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export class Snowflake {
  constructor({ scene, camera, count = 12000, variant = 0 }) {
    this.scene = scene;
    this.camera = camera;
    this.fov = 34;
    this.time = 0;
    this.bounds = null;
    this.count = count;
    this.variant = normalizeSnowflakeVariant(variant);
    this.points = null;
    this.dust = null;

    this.root = new THREE.Group();
    this.root.rotation.set(-0.08, 0.16, -0.035);
    scene.add(this.root);

    this._build();
    this.resize();
  }

  _build() {
    const data = buildSnowflakeParticles({ count: this.count, variant: this.variant });
    this.bounds = data.bounds;
    this.data = data;

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(data.bud.slice(), 3));
    geometry.setAttribute('aBud', new THREE.BufferAttribute(data.bud, 3));
    geometry.setAttribute('aBloom', new THREE.BufferAttribute(data.bloom, 3));
    geometry.setAttribute('aNBud', new THREE.BufferAttribute(data.normalBud, 3));
    geometry.setAttribute('aNBloom', new THREE.BufferAttribute(data.normalBloom, 3));
    geometry.setAttribute('aColor', new THREE.BufferAttribute(data.color, 3));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(data.size, 1));
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(data.seed, 1));
    geometry.setAttribute('aDelay', new THREE.BufferAttribute(data.delay, 1));

    this.uniforms = {
      uSpread: { value: 0 },
      uTime: { value: 0 },
      uPointScale: { value: 800 },
      uSizeMul: { value: 1.18 },
      uGain: { value: 0.92 },
    };

    const material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: SNOWFLAKE_VERT,
      fragmentShader: SNOWFLAKE_FRAG,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    });

    this.points = new THREE.Points(geometry, material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 2;
    this.root.add(this.points);

    this.haloTexture = makeGlowTexture();
    this.outerHalo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.haloTexture,
      color: 0x8edff4,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      opacity: 0.18,
    }));
    this.outerHalo.scale.setScalar(3.6);
    this.outerHalo.position.z = -0.2;
    this.outerHalo.renderOrder = 1;
    this.root.add(this.outerHalo);

    this.coreHalo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.haloTexture,
      color: 0xffd27d,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      opacity: 0.26,
    }));
    this.coreHalo.scale.setScalar(0.75);
    this.coreHalo.renderOrder = 3;
    this.root.add(this.coreHalo);

    const dust = buildSnowDust(Math.round(this.count * 0.045));
    const dustGeometry = new THREE.BufferGeometry();
    dustGeometry.setAttribute('position', new THREE.BufferAttribute(dust.pos, 3));
    dustGeometry.setAttribute('aSize', new THREE.BufferAttribute(dust.size, 1));
    dustGeometry.setAttribute('color', new THREE.BufferAttribute(dust.colors, 3));
    this.dust = new THREE.Points(
      dustGeometry,
      new THREE.PointsMaterial({
        size: 0.024,
        map: this.haloTexture,
        vertexColors: true,
        transparent: true,
        opacity: 0.48,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
        toneMapped: false,
      }),
    );
    this.dust.frustumCulled = false;
    this.dust.renderOrder = 0;
    this.scene.add(this.dust);
  }

  setVariant(variant) {
    const next = normalizeSnowflakeVariant(variant);
    if (next === this.variant && this.points) return next;
    this._clearBuild();
    this.variant = next;
    this._build();
    this.resize();
    return next;
  }

  _clearBuild() {
    if (!this.points) return;
    this.root.remove(this.points, this.outerHalo, this.coreHalo);
    this.scene.remove(this.dust);
    this.points.geometry.dispose();
    this.points.material.dispose();
    this.dust.geometry.dispose();
    this.dust.material.dispose();
    this.outerHalo.material.dispose();
    this.coreHalo.material.dispose();
    this.haloTexture.dispose();
    this.points = null;
    this.dust = null;
  }

  resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const aspect = width / height;
    const tan = Math.tan(this.fov * 0.5 * DEG);
    const horizontalFov = 2 * Math.atan(tan * aspect);
    const radius = this.bounds.radius * 1.08;
    const distance = Math.max(radius / tan, radius / Math.tan(horizontalFov * 0.5));

    this.camera.fov = this.fov;
    this.camera.aspect = aspect;
    this.camera.position.set(0, 0, distance);
    this.camera.lookAt(0, 0, 0);
    this.camera.updateProjectionMatrix();

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.uniforms.uPointScale.value = (height * dpr * 0.5) / tan;
  }

  update(dt, spread) {
    this.time += dt;
    this.uniforms.uSpread.value = spread;
    this.uniforms.uTime.value = this.time;

    this.outerHalo.material.opacity = 0.08 + spread * 0.16;
    this.outerHalo.scale.setScalar(2.8 + spread * 1.5);
    this.coreHalo.material.opacity = 0.16 + spread * 0.34;
    this.coreHalo.scale.setScalar(0.55 + spread * 0.55);
    this.dust.rotation.z += dt * 0.012;
  }

  screenToWorld(sx, sy, out = new THREE.Vector3()) {
    const aspect = window.innerWidth / window.innerHeight;
    const halfHeight = this.camera.position.z * Math.tan(this.fov * 0.5 * DEG);
    out.set(
      (sx / window.innerWidth * 2 - 1) * halfHeight * aspect,
      (-sy / window.innerHeight * 2 + 1) * halfHeight,
      0,
    );
    return out;
  }

  dispose() {
    this._clearBuild();
    this.scene.remove(this.root);
  }
}
