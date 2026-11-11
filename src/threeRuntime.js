const LOCAL_THREE = new URL('../vendor/three/three.module.js', import.meta.url).href;
const REMOTE_THREE = 'https://fastly.jsdelivr.net/npm/three@0.169.0/build/three.module.js';

const preferRemote = location.hostname.endsWith('github.io')
  && navigator.onLine
  && !navigator.serviceWorker?.controller;

let THREE;
try {
  THREE = await import(preferRemote ? REMOTE_THREE : LOCAL_THREE);
} catch {
  THREE = await import(preferRemote ? LOCAL_THREE : REMOTE_THREE);
}

export default THREE;
