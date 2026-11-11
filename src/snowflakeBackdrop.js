import THREE from 'three';

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const FRAG = /* glsl */ `
  precision highp float;
  uniform float uTime;
  varying vec2 vUv;

  void main() {
    vec2 s = vec2(vUv.x, 1.0 - vUv.y);
    vec2 c = s - vec2(0.5, 0.44);
    float r = length(c * vec2(1.0, 0.9));

    vec3 near = vec3(0.024, 0.072, 0.070);
    vec3 mid = vec3(0.006, 0.025, 0.028);
    vec3 far = vec3(0.001, 0.005, 0.007);
    vec3 col = mix(near, mid, smoothstep(0.0, 0.56, r));
    col = mix(col, far, smoothstep(0.42, 1.05, r));

    float glint = 0.010 + 0.004 * sin(uTime * 0.18);
    col += vec3(0.34, 0.78, 0.84) * glint * exp(-r * r * 4.2);
    col += vec3(0.34, 0.16, 0.04) * 0.006 * exp(-dot(c - vec2(0.0, 0.015), c - vec2(0.0, 0.015)) * 30.0);

    float dither = fract(sin(dot(s * 1024.0, vec2(12.9898, 78.233))) * 43758.5453);
    col += (dither - 0.5) * 0.0014;
    gl_FragColor = vec4(col, 1.0);
  }
`;

export class SnowflakeBackdrop {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.uniforms = { uTime: { value: 0 } };
    const material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: VERT,
      fragmentShader: FRAG,
      depthTest: false,
      depthWrite: false,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);
  }

  update(dt) {
    this.uniforms.uTime.value += dt;
  }

  render(renderer) {
    renderer.render(this.scene, this.camera);
  }
}
