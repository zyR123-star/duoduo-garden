import * as THREE from 'three';
import { Snowflake } from './snowflake.js';
import { SnowflakeBackdrop } from './snowflakeBackdrop.js';
import { Snowfall } from './snowfall.js';
import { SNOWFLAKE_VARIANTS, normalizeSnowflakeVariant } from './snowflakeGeometry.js';
import { HandTracker } from './handTracker.js';
import { HandPreview } from './handPreview.js';

const params = new URLSearchParams(location.search);
const FORCED_SPREAD = params.has('spread')
  ? Math.max(0, Math.min(1, Number(params.get('spread')) || 0))
  : null;
const FORCE_DEMO = params.get('demo') === '1';
const FORCED_VARIANT = normalizeSnowflakeVariant(params.get('variant') ?? 0);
const IS_MOBILE = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
const PARTICLE_COUNT = Math.max(
  3000,
  Math.min(18000, Number(params.get('particles')) || (IS_MOBILE ? 7800 : 12000)),
);
const SNOW_COUNT = Number(params.get('snow')) || (IS_MOBILE ? 14 : 20);
const CAPTURE_DISTANCE = IS_MOBILE ? 112 : 82;

const clamp01 = (value) => (value < 0 ? 0 : value > 1 ? 1 : value);
const smoothstep = (a, b, x) => {
  const t = clamp01((x - a) / (b - a || 1e-9));
  return t * t * (3 - 2 * t);
};
const frameEase = (k, dt) => 1 - Math.pow(1 - k, dt * 60);
const approach = (current, target, dt, tau) =>
  current + (target - current) * (1 - Math.exp(-dt / Math.max(0.001, tau)));

const $ = (id) => document.getElementById(id);

class SnowflakeExperience {
  constructor() {
    this.canvas = $('gl-layer');
    this.intro = $('intro');
    this.hud = $('hud');
    this.phase = 'search';
    this.mode = 'intro';
    this.spread = 0;
    this.targetSpread = 0;
    this.controlTension = 0;
    this.pointerDown = false;
    this.pointerActive = false;
    this.pointer = { x: window.innerWidth * 0.5, y: window.innerHeight * 0.45 };
    this.handVisible = false;
    this.lastHandAt = 0;
    this.captureAge = 0;
    this.captureWorld = new THREE.Vector3();
    this.captureOriginWorld = new THREE.Vector3();
    this.followWorld = new THREE.Vector3();
    this.centerWorld = new THREE.Vector3();
    this.currentVariant = FORCED_VARIANT;
    this.paused = false;
    this.pipOn = true;
    this._pipTick = 0;

    this._initRenderer();
    this._initUI();
    this._bindEvents();

    if (FORCED_SPREAD !== null) {
      this._enterForced();
    } else if (FORCE_DEMO) {
      this.enterDemo();
    }

    this.clock = new THREE.Clock();
    this._tick = this._tick.bind(this);
    this.renderer.setAnimationLoop(this._tick);
  }

  _initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: false,
      antialias: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.renderer.setClearColor(0x031011, 1);
    this.renderer.autoClear = false;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(34, window.innerWidth / window.innerHeight, 0.1, 100);
    this.snowflake = new Snowflake({
      scene: this.scene,
      camera: this.camera,
      count: PARTICLE_COUNT,
      variant: FORCED_VARIANT,
    });
    this.snowflake.root.visible = false;
    this.snowfall = new Snowfall({ count: SNOW_COUNT });
    this.bg = new SnowflakeBackdrop();
    this.pip = new HandPreview($('pip-canvas'));
  }

  _initUI() {
    $('btn-camera').addEventListener('click', () => this.startCamera());
    $('btn-demo').addEventListener('click', () => this.enterDemo());
    $('btn-reset').addEventListener('click', () => this.resetCapture());
    $('btn-pip').addEventListener('click', () => this.setPip(!this.pipOn));
  }

  _bindEvents() {
    window.addEventListener('resize', () => {
      this.renderer.setSize(window.innerWidth, window.innerHeight, false);
      this.snowflake.resize();
      this.snowfall.resize();
      this.pip.resize();
    });
    document.addEventListener('visibilitychange', () => {
      this.paused = document.hidden;
    });

    window.addEventListener('pointermove', (event) => {
      if (this.mode !== 'demo' || this.intro.classList.contains('gone') === false) return;
      this.pointerActive = true;
      this.pointer.x = event.clientX;
      this.pointer.y = event.clientY;
    });

    $('stage').addEventListener('pointerdown', (event) => {
      if (this.mode !== 'demo' || this.intro.classList.contains('gone') === false) return;
      event.preventDefault();
      this.pointerActive = true;
      this.pointer.x = event.clientX;
      this.pointer.y = event.clientY;
      if (this.phase === 'search') {
        this.tryCapture(this.pointer.x, this.pointer.y, 110);
      } else {
        this.pointerDown = true;
      }
    });
    window.addEventListener('pointerup', () => {
      this.pointerDown = false;
    });
    window.addEventListener('pointercancel', () => {
      this.pointerDown = false;
    });
    window.addEventListener('keydown', (event) => {
      if (event.code !== 'Space' || this.phase !== 'captured' || this.mode !== 'demo') return;
      event.preventDefault();
      this.pointerDown = !this.pointerDown;
    });
  }

  hideIntro() {
    this.intro.classList.add('gone');
    this.hud.classList.add('on');
  }

  setIntroNote(text, warn = false) {
    const element = $('intro-note');
    element.textContent = text;
    element.classList.toggle('warn', warn);
  }

  enterDemo() {
    if (this.mode === 'camera') return;
    this.mode = 'demo';
    document.body.dataset.mode = 'demo';
    this.hideIntro();
    $('btn-pip').hidden = true;
    this.setPip(false);
    this._setPrompt('移动鼠标', '追上一朵飘落的雪花，或直接点击捕捉');
  }

  async startCamera() {
    if (this.mode === 'camera') return;
    this.setIntroNote('正在请求摄像头权限…');
    if (!navigator.mediaDevices?.getUserMedia) {
      this.toast('当前浏览器不支持摄像头，已进入演示模式');
      this.enterDemo();
      return;
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: 'user',
          width: { ideal: 960 },
          height: { ideal: 720 },
        },
      });
    } catch (error) {
      this._handleCameraError(error);
      return;
    }

    const video = document.createElement('video');
    video.playsInline = true;
    video.muted = true;
    video.autoplay = true;
    video.srcObject = this.stream;
    this.video = video;
    try {
      await video.play();
    } catch {
      // 点击已经发生在用户手势中，部分浏览器仍可能延迟首帧。
    }

    this.mode = 'camera';
    document.body.dataset.mode = 'camera';
    this.hideIntro();
    $('btn-pip').hidden = false;
    this.pip.resize();
    this.setPip(true);
    this._setPrompt('正在寻找手部', '伸出手，接住一朵飘落的雪花');

    try {
      this.tracker = new HandTracker();
      await this.tracker.init();
      this.tracker.warmup(video).then(() => {
        this._setPrompt('伸出手', '把手掌移向飘落的雪花');
      }).catch((error) => {
        console.warn('[snowflake] hand model warmup failed:', error);
        this._fallbackToDemo('手部模型加载失败 · 已进入演示模式');
      });
    } catch (error) {
      console.warn('[snowflake] hand tracker init failed:', error);
      this._fallbackToDemo('手部识别组件加载失败 · 已进入演示模式');
    }
  }

  _handleCameraError(error) {
    const name = error && error.name;
    let message = '无法访问摄像头，已进入演示模式';
    if (name === 'NotAllowedError' || name === 'SecurityError') message = '摄像头权限被拒绝 · 已进入演示模式';
    else if (name === 'NotFoundError' || name === 'OverconstrainedError') message = '没有找到可用摄像头 · 已进入演示模式';
    else if (name === 'NotReadableError') message = '摄像头被其它程序占用 · 已进入演示模式';
    console.warn('[snowflake] getUserMedia failed:', error);
    this.toast(message, 4200);
    this.enterDemo();
  }

  _fallbackToDemo(message) {
    this.tracker?.close();
    this.tracker = null;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    if (this.video) {
      this.video.pause();
      this.video.srcObject = null;
      this.video = null;
    }
    this.mode = 'demo';
    document.body.dataset.mode = 'demo';
    $('btn-pip').hidden = true;
    this.setPip(false);
    this.toast(message, 5200);
    this._setPrompt('移动鼠标', '追上一朵飘落的雪花');
  }

  setPip(on) {
    this.pipOn = on;
    $('btn-pip').setAttribute('aria-pressed', String(on));
    $('pip').classList.toggle('on', on && this.mode === 'camera');
  }

  toast(text, ms = 2800) {
    const element = $('toast');
    element.textContent = text;
    element.classList.add('on');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => element.classList.remove('on'), ms);
  }

  _setPrompt(title, detail, visible = true) {
    $('prompt-title').textContent = title;
    $('prompt-detail').textContent = detail;
    $('capture-prompt').classList.toggle('on', visible);
  }

  _enterForced() {
    this.mode = 'demo';
    document.body.dataset.mode = 'demo';
    this.phase = 'captured';
    this.captureAge = 10;
    this.controlTension = FORCED_SPREAD;
    this.spread = FORCED_SPREAD;
    this.targetSpread = FORCED_SPREAD;
    this.hideIntro();
    this.currentVariant = this.snowflake.setVariant(FORCED_VARIANT);
    this.snowflake.root.visible = true;
    this.snowflake.root.scale.setScalar(1);
    $('btn-reset').hidden = false;
    $('btn-pip').hidden = true;
    this.setPip(false);
    this._setPrompt('雪花已接住', '按住鼠标 / 屏幕控制');
  }

  _inputPoint(hand) {
    if (this.mode === 'camera' && hand) {
      return {
        x: (1 - hand.palm.x) * window.innerWidth,
        y: hand.palm.y * window.innerHeight,
      };
    }
    if (this.mode === 'demo' && !this.intro.classList.contains('gone')) return null;
    if (this.mode === 'demo' && this.pointerActive) return this.pointer;
    return null;
  }

  _placeReticle(point) {
    const reticle = $('capture-reticle');
    if (!point) {
      reticle.classList.remove('on', 'locked');
      return;
    }
    reticle.style.left = `${point.x}px`;
    reticle.style.top = `${point.y}px`;
    reticle.classList.add('on');
  }

  _burst(x, y) {
    const flash = $('capture-flash');
    flash.style.left = `${x}px`;
    flash.style.top = `${y}px`;
    flash.classList.remove('on');
    void flash.offsetWidth;
    flash.classList.add('on');
  }

  tryCapture(x, y, threshold = 80) {
    if (this.phase !== 'search') return false;
    const nearest = this.snowfall.findNearest(x, y, threshold);
    if (!nearest) return false;

    this.currentVariant = this.snowflake.setVariant(nearest.item.variant);
    this.snowfall.capture(nearest.item);
    this.phase = 'captured';
    this.captureAge = 0;
    this.controlTension = 0;
    this.snowflake.screenToWorld(x, y, this.captureOriginWorld);
    this.snowflake.root.visible = true;
    this.snowflake.root.scale.setScalar(0.13);
    this.snowflake.root.position.copy(this.captureOriginWorld);
    $('btn-reset').hidden = false;
    $('capture-reticle').classList.remove('locked');
    this._burst(x, y);
    const label = SNOWFLAKE_VARIANTS[this.currentVariant].label;
    this._setPrompt(`${label}雪花已接住`, this.mode === 'camera'
      ? '张开手掌，让同一朵晶花展开'
      : '按住鼠标 / 屏幕，让同一朵晶花展开');
    return true;
  }

  resetCapture() {
    this.phase = 'search';
    this.spread = 0;
    this.targetSpread = 0;
    this.controlTension = 0;
    this.captureAge = 0;
    this.pointerDown = false;
    this.pointerActive = false;
    this.snowflake.root.visible = false;
    this.snowflake.root.position.set(0, 0, 0);
    this.snowflake.root.scale.setScalar(1);
    this.snowfall.reset();
    $('btn-reset').hidden = true;
    this._setPrompt(
      this.mode === 'camera' ? '伸出手' : '移动鼠标',
      this.mode === 'camera' ? '接住一朵飘落的雪花' : '追上一朵雪花，或直接点击捕捉',
    );
  }

  _updateSearch(dt, hand, input) {
    const attractor = input && this.phase === 'search' ? input : null;
    const nearest = this.snowfall.update(dt, attractor);
    this._placeReticle(input);
    $('capture-reticle').classList.toggle('locked',
      Boolean(nearest && nearest.distance < CAPTURE_DISTANCE + 18));

    if (input && nearest && nearest.distance < (this.mode === 'demo' ? 105 : CAPTURE_DISTANCE)) {
      if (this.tryCapture(input.x, input.y, this.mode === 'demo' ? 105 : CAPTURE_DISTANCE)) return;
    }

    if (this.mode === 'camera') {
      if (!this.tracker) this._setPrompt('等待手部模型', '模型准备好后伸出手捕捉雪花', this.phase === 'search');
      else if (!hand) this._setPrompt('伸出手', '接住一朵飘落的雪花', this.phase === 'search');
      else this._setPrompt('靠近雪花', '把手掌移到最近的雪花上', this.phase === 'search');
    }
  }

  _updateCaptured(dt, hand, input) {
    this.captureAge += dt;
    this.snowfall.update(dt);
    const reveal = smoothstep(0, 0.82, this.captureAge);
    this.snowflake.root.scale.setScalar(0.13 + reveal * 0.87);
    const settle = smoothstep(0.12, 1.05, this.captureAge);
    this.captureWorld.set(0, 0, 0);

    if (this.captureAge < 1.05) {
      this.snowflake.root.position.lerpVectors(this.captureOriginWorld, this.captureWorld, settle);
    } else if (input) {
      this.snowflake.screenToWorld(input.x, input.y, this.followWorld);
      this.snowflake.screenToWorld(window.innerWidth * 0.5, window.innerHeight * 0.48, this.centerWorld);
      this.followWorld.sub(this.centerWorld).multiplyScalar(0.52);
      this.snowflake.root.position.lerp(this.followWorld, frameEase(0.085, dt));
    } else {
      this.snowflake.root.position.lerp(this.captureWorld, frameEase(0.06, dt));
    }

    const liveTension = this.mode === 'camera'
      ? (hand ? hand.tension : 0)
      : (this.pointerDown ? 1 : 0);
    const tau = this.mode === 'camera' && !hand ? 1.1 : 0.09;
    this.controlTension = approach(this.controlTension, liveTension, dt, tau);

    if (FORCED_SPREAD !== null) {
      this.targetSpread = FORCED_SPREAD;
    } else if (this.captureAge < 0.45) {
      this.targetSpread = 0;
    } else {
      this.targetSpread = smoothstep(0.32, 0.66, this.controlTension);
    }

    this._placeReticle(input);
    $('capture-reticle').classList.add('locked');
    const label = SNOWFLAKE_VARIANTS[this.currentVariant].label;
    const promptTitle = this.mode === 'camera' && !hand
      ? `${label}雪花已接住`
      : `${label}雪花在手中`;
    const promptDetail = this.mode === 'camera'
      ? '移动手掌 · 张开手指让晶枝盛开'
      : '移动鼠标 · 按住鼠标 / 屏幕让晶枝展开';
    this._setPrompt(promptTitle, promptDetail);
  }

  _drawPip(hand) {
    if (!this.pipOn || this.mode !== 'camera') return;
    this.pip.draw({ video: this.video, hand, tension: this.controlTension, dt: 0.016 });
    if (++this._pipTick % 4) return;
    $('pip-num').textContent = this.controlTension.toFixed(2);
    $('pip-fill').style.width = `${(clamp01(this.controlTension) * 100).toFixed(0)}%`;
    $('pip-state').textContent = !this.tracker ? '无模型' : hand ? '跟踪中' : '等待手部';
    $('pip-dot').classList.toggle('live', !!hand);
  }

  _updateHud() {
    $('meter-fill').style.width = `${(this.spread * 100).toFixed(1)}%`;
    $('num-tension').textContent = this.targetSpread.toFixed(2);
    $('num-spread').textContent = this.spread.toFixed(2);
    let state = '飘落';
    if (this.phase === 'captured') {
      state = '冰晶花苞';
      if (this.spread >= 0.68) state = '盛开';
      else if (this.spread >= 0.12) state = '结晶';
    }
    $('state-label').textContent = state;
    $('mode-label').textContent = this.mode === 'camera' ? '实时' : '演示';
    $('hud-dot').classList.toggle('live', this.mode === 'demo' || this.handVisible);
  }

  _tick() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    if (this.paused) return;

    let hand = null;
    if (this.tracker && this.video && !this.paused) {
      this.tracker.update(this.video, performance.now());
      if (this.tracker.isPresent(performance.now())) hand = this.tracker.state;
    }
    this.handVisible = !!hand;
    if (hand) this.lastHandAt = performance.now();
    const input = this._inputPoint(hand);

    if (this.phase === 'search') {
      this._updateSearch(dt, hand, input);
      this.targetSpread = 0;
    } else {
      this._updateCaptured(dt, hand, input);
    }

    this.spread = approach(this.spread, this.targetSpread, dt, 0.16);
    this.snowflake.update(dt, this.spread);
    this.bg.update(dt);

    this.renderer.clear(true, true, true);
    this.bg.render(this.renderer);
    this.snowfall.render(this.renderer);
    this.renderer.render(this.scene, this.camera);
    this._drawPip(hand);
    this._updateHud();
  }
}

function boot() {
  const probe = document.createElement('canvas');
  const gl = probe.getContext('webgl2') || probe.getContext('webgl');
  if (!gl) {
    $('intro-note').textContent = '当前浏览器不支持 WebGL，无法查看雪花';
    $('intro-note').classList.add('warn');
    $('btn-camera').disabled = true;
    $('btn-demo').disabled = true;
    return;
  }

  window.__snowflake = new SnowflakeExperience();
}

boot();
