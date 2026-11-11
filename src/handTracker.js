/**
 * MediaPipe Hands 封装 + 「手掌张开度 tension」计算
 * ---------------------------------------------------------------
 * 用 @mediapipe/hands（legacy solution）而不是 tasks-vision：
 *   legacy 包的 wasm / tflite 模型全都在同一个 npm 包里，
 *   本地镜像后无需访问任何外部服务；
 *   tasks-vision 需要额外从 storage.googleapis.com 拉 .task 模型，
 *   那条线路在部分地区不通。
 *
 * 如果它加载失败，上层会自动进入「演示模式」，页面不会白屏。
 */

const MP_BASE = new URL('../vendor/mediapipe/hands', import.meta.url).href;
const MP_FALLBACK_BASE = 'https://fastly.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240';
const HAND_ASSET_CACHE = 'duoduo-hand-assets-v1';
const HAND_ASSETS = {
  common: [
    ['hands.binarypb', 550],
    ['hands_solution_packed_assets_loader.js', 8327],
    ['hands_solution_packed_assets.data', 4326731],
    ['hands_solution_simd_wasm_bin.js', 276479],
    ['hands_solution_simd_wasm_bin.wasm', 6026259],
  ],
  full: ['hand_landmark_full.tflite', 5478688],
  lite: ['hand_landmark_lite.tflite', 2071408],
};

/** MediaPipe 的 21 点骨架连线 */
export const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],           // 拇指
  [0, 5], [5, 6], [6, 7], [7, 8],           // 食指
  [5, 9], [9, 10], [10, 11], [11, 12],      // 中指
  [9, 13], [13, 14], [14, 15], [15, 16],    // 无名指
  [13, 17], [17, 18], [18, 19], [19, 20],   // 小指
  [0, 17],                                   // 掌根
];

/* ------------------------------------------------------------------ */
/* 几何小工具                                                          */
/* ------------------------------------------------------------------ */
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, (a.z || 0) - (b.z || 0));
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** 三个点构成的夹角（返回 0~π） */
function jointAngle(a, b, c) {
  const v1x = a.x - b.x, v1y = a.y - b.y;
  const v2x = c.x - b.x, v2y = c.y - b.y;
  const n1 = Math.hypot(v1x, v1y) || 1e-6;
  const n2 = Math.hypot(v2x, v2y) || 1e-6;
  const cos = Math.max(-1, Math.min(1, (v1x * v2x + v1y * v2y) / (n1 * n2)));
  return Math.acos(cos);
}

/* ------------------------------------------------------------------ */
/* tension：手掌张开度                                                  */
/* ------------------------------------------------------------------ */
/**
 * 五指各自算一个「伸展度」，再按权重平均。
 *
 * 每个手指用两个互补的指标：
 *   ① 伸展比 reach = |指尖-腕| / |指根-腕|
 *        握拳 ≈ 1.0~1.25，完全张开 ≈ 2.0~2.3
 *        reachScore = clamp((reach - 1.18) / (2.05 - 1.18), 0, 1)
 *   ② 指节伸直度：PIP 关节夹角 θ
 *        握拳 θ ≈ 50~80°，伸直 θ ≈ 170~180°
 *        straight = clamp((θ/π - 0.33) / (0.66 - 0.33), 0, 1)
 *     加这一项是为了防止「手向镜头倾斜时距离被透视压缩」导致的误判。
 *
 *   ext_f = 0.62 * reachScore + 0.38 * straight
 *   tension = Σ(w_f · ext_f) / Σ w_f
 */
const FINGERS = [
  { name: 'thumb', mcp: 2, pip: 3, tip: 4, w: 0.70 },
  { name: 'index', mcp: 5, pip: 6, tip: 8, w: 1.00 },
  { name: 'middle', mcp: 9, pip: 10, tip: 12, w: 1.00 },
  { name: 'ring', mcp: 13, pip: 14, tip: 16, w: 0.95 },
  { name: 'pinky', mcp: 17, pip: 18, tip: 20, w: 0.85 },
];

export function measureTension(lm) {
  const wrist = lm[0];
  let sum = 0;
  let wsum = 0;
  for (const f of FINGERS) {
    const reach = dist(wrist, lm[f.tip]) / Math.max(1e-6, dist(wrist, lm[f.mcp]));
    const reachScore = clamp01((reach - 1.18) / 0.87);
    const theta = jointAngle(lm[f.mcp], lm[f.pip], lm[f.tip]);
    const straight = clamp01((theta / Math.PI - 0.33) / 0.33);
    const ext = 0.62 * reachScore + 0.38 * straight;
    sum += ext * f.w;
    wsum += f.w;
  }
  return clamp01(sum / wsum);
}

/** 手掌中心（腕 + 四个掌指关节的平均） */
function palmCenter(lm) {
  const ids = [0, 5, 9, 13, 17];
  let x = 0, y = 0;
  for (const i of ids) { x += lm[i].x; y += lm[i].y; }
  return { x: x / ids.length, y: y / ids.length };
}

/**
 * 从 21 点解出上层要用的所有量
 * 归一化坐标（0~1，已按 selfieMode 镜像）
 */
export function buildHandState(lm, handedness = '') {
  const palm = palmCenter(lm);
  const palmSize = dist(lm[0], lm[9]);
  return {
    present: true,
    landmarks: lm,
    handedness,
    tension: measureTension(lm),
    palm,
    palmSize,
    tip: { x: lm[8].x, y: lm[8].y },      // 食指指尖
    thumbTip: { x: lm[4].x, y: lm[4].y },
  };
}

/* ------------------------------------------------------------------ */
/* HandTracker                                                         */
/* ------------------------------------------------------------------ */
export class HandTracker {
  constructor(opts = {}) {
    this._mobile = this._isMobile();
    this.modelComplexity = opts.modelComplexity ?? (this._mobile ? 0 : 1);
    this.onStatus = opts.onStatus || (() => {});
    this.holdMs = opts.holdMs ?? (this._mobile ? 700 : 260);
    this.state = null;
    this.lastSeen = 0;
    this.busy = false;
    this.ready = false;
    this.failed = false;
    this.frames = 0;
    this._hands = null;
    this._lastSend = 0;
    this.assetBase = location.hostname.endsWith('github.io')
      && navigator.onLine
      && !navigator.serviceWorker?.controller
      ? MP_FALLBACK_BASE
      : MP_BASE;
    this.assetUrls = new Map();
    this._loadedBytes = 0;
    this._totalBytes = 0;
  }

  _isMobile() {
    return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  }

  async init() {
    this.onStatus({ phase: 'loading', message: '正在加载手部识别模型…' });
    await this._loadScript();
    await this._prepareAssets();
    if (!window.Hands) throw new Error('MediaPipe Hands 未就绪');

    const hands = new window.Hands({
      locateFile: (file) => this.assetUrls.get(file) || `${this.assetBase}/${file}`,
    });
    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: this.modelComplexity,
      minDetectionConfidence: 0.6,
      minTrackingConfidence: 0.55,
      selfieMode: true, // 保持山茶阶段已验证的镜像逻辑
    });
    hands.onResults((results) => this._onResults(results));

    this._hands = hands;
    this.ready = true;
    return true;
  }

  _loadScript() {
    if (window.Hands) return Promise.resolve();
    return this._loadScriptFrom(this.assetBase)
      .catch(() => {
        this.assetBase = this.assetBase === MP_BASE ? MP_FALLBACK_BASE : MP_BASE;
        return this._loadScriptFrom(this.assetBase);
      });
  }

  _loadScriptFrom(base) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = `${base}/hands.js`;
      s.crossOrigin = 'anonymous';
      s.async = true;
      const timer = setTimeout(() => {
        s.remove();
        reject(new Error('加载 MediaPipe 超时'));
      }, 20000);
      s.onload = () => { clearTimeout(timer); resolve(); };
      s.onerror = () => {
        clearTimeout(timer);
        reject(new Error('无法加载本地 MediaPipe Hands'));
      };
      document.head.appendChild(s);
    });
  }

  _assetCacheKey(file) {
    return new Request(new URL(`./__duoduo_hand_assets__/${HAND_ASSET_CACHE}/${file}`, location.href));
  }

  _reportAssetProgress(file) {
    const percent = this._totalBytes
      ? Math.min(100, Math.round((this._loadedBytes / this._totalBytes) * 100))
      : 0;
    const loadedMb = (this._loadedBytes / 1048576).toFixed(1);
    const totalMb = (this._totalBytes / 1048576).toFixed(1);
    this.onStatus({
      phase: 'loading',
      message: `正在加载手部模型 ${percent}% · ${loadedMb}/${totalMb} MB`,
      file,
      percent,
      loaded: this._loadedBytes,
      total: this._totalBytes,
    });
  }

  async _openAssetCache() {
    try {
      return await caches.open(HAND_ASSET_CACHE);
    } catch {
      return null;
    }
  }

  async _downloadAsset(file, expectedBytes) {
    const url = `${this.assetBase}/${file}`;
    const controller = new AbortController();
    let stallTimer = 0;
    const resetStallTimer = () => {
      clearTimeout(stallTimer);
      stallTimer = setTimeout(() => controller.abort(), 20000);
    };
    resetStallTimer();
    try {
      const response = await fetch(url, {
        cache: 'force-cache',
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`资源下载失败：${file}`);
      resetStallTimer();

      let blob;
      if (response.body?.getReader) {
        const reader = response.body.getReader();
        const chunks = [];
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          resetStallTimer();
          chunks.push(value);
          this._loadedBytes += value.byteLength;
          this._reportAssetProgress(file);
        }
        blob = new Blob(chunks, { type: response.headers.get('content-type') || '' });
      } else {
        blob = await response.blob();
        this._loadedBytes += blob.size || expectedBytes;
        this._reportAssetProgress(file);
      }
      return { blob, response };
    } finally {
      clearTimeout(stallTimer);
    }
  }

  async _prepareAssets() {
    const modelFile = this.modelComplexity === 0 ? HAND_ASSETS.lite : HAND_ASSETS.full;
    const files = [...HAND_ASSETS.common, modelFile];
    this._totalBytes = files.reduce((sum, [, size]) => sum + size, 0);
    this._loadedBytes = 0;
    const cache = await this._openAssetCache();

    for (const [file, expectedBytes] of files) {
      const key = this._assetCacheKey(file);
      let blob = null;
      let response = null;
      try {
        const cached = await cache?.match(key);
        if (cached) {
          blob = await cached.blob();
          this._loadedBytes += blob.size || expectedBytes;
          this._reportAssetProgress(file);
        }
      } catch {
        blob = null;
      }

      if (!blob) {
        try {
          ({ blob, response } = await this._downloadAsset(file, expectedBytes));
        } catch (error) {
          this.assetBase = this.assetBase === MP_BASE ? MP_FALLBACK_BASE : MP_BASE;
          try {
            ({ blob, response } = await this._downloadAsset(file, expectedBytes));
          } catch {
            throw error;
          }
        }
        if (cache) {
          try {
            await cache.put(key, new Response(blob, {
              headers: response?.headers || { 'Content-Type': blob.type || 'application/octet-stream' },
            }));
          } catch {
            // 缓存不可用时仍使用本次下载的 Blob。
          }
        }
      }

      this.assetUrls.set(file, URL.createObjectURL(blob));
    }
  }

  _onResults(results) {
    this.frames++;
    const lm = results.multiHandLandmarks && results.multiHandLandmarks[0];
    if (lm && lm.length === 21 && !lm.some((p) => Number.isNaN(p.x))) {
      const handed = results.multiHandedness?.[0]?.label || '';
      this.state = buildHandState(lm, handed);
      this.lastSeen = performance.now();
    } else {
      this.state = null;
    }
    if (this.frames === 1) this.onStatus({ phase: 'ready', message: '识别已就绪' });
  }

  /**
   * 预热：真正跑一次推理，确认 wasm / 模型都能加载。
   * legacy Hands 的首次 send 才会去拉模型，所以必须「真发一帧」才知道能不能用。
   */
  async warmup(video, timeoutMs = 60000) {
    if (!this.ready) throw new Error('HandTracker 未初始化');
    this.busy = true;
    try {
      const t0 = performance.now();
      while (this.frames === 0) {
        if (performance.now() - t0 > timeoutMs) throw new Error('手部模型加载超时');
        try {
          await this._hands.send({ image: video });
        } catch (err) {
          throw new Error(`手部模型资源加载失败：${err && err.message ? err.message : err}`);
        }
        if (this.frames === 0) await new Promise((r) => setTimeout(r, 150));
      }
    } finally {
      this.busy = false;
    }
    return true;
  }
  /** 每帧调用；内部自己节流 + 防重入 */
  update(video, now = performance.now()) {
    if (!this.ready || this.busy || !video || video.readyState < 2) return;
    if (now - this._lastSend < 28) return; // ≈ 30fps 足够
    this._lastSend = now;
    this.busy = true;
    const t0 = performance.now();
    this._hands
      .send({ image: video })
      .catch(() => {})
      .finally(() => {
        this.busy = false;
        this.cost = performance.now() - t0;
      });
  }

  /** 手是否仍然在画面里（用于超时隐藏） */
  isPresent(now = performance.now(), holdMs = this.holdMs) {
    return !!this.state && now - this.lastSeen < holdMs;
  }

  close() {
    try { this._hands?.close(); } catch { /* noop */ }
    for (const url of this.assetUrls.values()) URL.revokeObjectURL(url);
    this.assetUrls.clear();
    this._hands = null;
    this.ready = false;
  }
}


