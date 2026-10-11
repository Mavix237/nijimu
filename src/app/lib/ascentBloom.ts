import * as THREE from "three";

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;
const fragmentShader = /* glsl */ `
  uniform sampler2D uImage;
  uniform vec2 uStep;
  uniform float uExtract;
  varying vec2 vUv;
  vec3 sampleLight(vec2 uv) { return texture2D(uImage, clamp(uv, 0.0, 1.0)).rgb; }
  void main() {
    if (uExtract > .5) {
      vec3 c = (sampleLight(vUv + uStep * vec2(-1, -1))
        + sampleLight(vUv + uStep * vec2(1, -1))
        + sampleLight(vUv + uStep * vec2(-1, 1))
        + sampleLight(vUv + uStep * vec2(1, 1))) * .25;
      // Ordinary pale water remains below threshold. Only real HDR highlights
      // on the vessel seed the glow, retaining its silhouette and lit folds.
      gl_FragColor = vec4(max(c - vec3(1.0), 0.0), 1.0);
      return;
    }
    vec3 c = sampleLight(vUv) * .227027;
    c += (sampleLight(vUv + uStep * 1.384615) + sampleLight(vUv - uStep * 1.384615)) * .316216;
    c += (sampleLight(vUv + uStep * 3.230769) + sampleLight(vUv - uStep * 3.230769)) * .070270;
    gl_FragColor = vec4(c, 1.0);
  }
`;

/** Quarter-resolution, separable bloom. Runs only during the ascent and reads
 * actual rendered highlights; no projected source, streak or painted halo. */
export function createAscentBloom() {
  const options = { type: THREE.HalfFloatType, depthBuffer: false, stencilBuffer: false };
  const a = new THREE.WebGLRenderTarget(1, 1, options);
  const b = new THREE.WebGLRenderTarget(1, 1, options);
  const uniforms = { uImage: { value: a.texture }, uStep: { value: new THREE.Vector2() }, uExtract: { value: 0 } };
  const material = new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms,
    depthTest: false, depthWrite: false, blending: THREE.NoBlending });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  quad.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(quad);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  return {
    texture: a.texture,
    resize(width: number, height: number) {
      a.setSize(Math.max(1, Math.ceil(width / 4)), Math.max(1, Math.ceil(height / 4)));
      b.setSize(a.width, a.height);
    },
    render(renderer: THREE.WebGLRenderer, source: THREE.Texture, spread: number) {
      uniforms.uImage.value = source;
      uniforms.uExtract.value = 1;
      uniforms.uStep.value.set(.25 / a.width, .25 / a.height);
      renderer.setRenderTarget(a);
      renderer.render(scene, camera);
      uniforms.uExtract.value = 0;
      // The spill grows continuously with emitted energy. Repeated convolution
      // diffuses the silhouette without introducing concentric outlines.
      for (const scale of [1, 2, 4]) {
        const radius = scale * (1 + spread * spread * a.height * .042);
        uniforms.uImage.value = a.texture;
        uniforms.uStep.value.set(radius / a.width, 0);
        renderer.setRenderTarget(b);
        renderer.render(scene, camera);
        uniforms.uImage.value = b.texture;
        uniforms.uStep.value.set(0, radius / a.height);
        renderer.setRenderTarget(a);
        renderer.render(scene, camera);
      }
    },
    dispose() { a.dispose(); b.dispose(); material.dispose(); quad.geometry.dispose(); },
  };
}
