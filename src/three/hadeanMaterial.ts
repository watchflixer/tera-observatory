import * as THREE from 'three';

// An artistic, evolving magma ocean inspired by the Hadean reference. Sampling
// in 3D keeps the pattern continuous at the poles and across the globe's seam.
export function createHadeanMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    side: THREE.DoubleSide,
    vertexShader: `
      varying vec3 vSurface;
      varying vec3 vNormalView;
      varying vec3 vViewDirection;
      void main() {
        vSurface = normalize(position);
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        vNormalView = normalize(normalMatrix * normal);
        vViewDirection = normalize(-viewPosition.xyz);
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying vec3 vSurface;
      varying vec3 vNormalView;
      varying vec3 vViewDirection;

      float hash3(vec3 p) {
        return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
      }
      float noise3(vec3 p) {
        vec3 i = floor(p);
        vec3 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(hash3(i), hash3(i + vec3(1., 0., 0.)), f.x),
                       mix(hash3(i + vec3(0., 1., 0.)), hash3(i + vec3(1., 1., 0.)), f.x), f.y),
                   mix(mix(hash3(i + vec3(0., 0., 1.)), hash3(i + vec3(1., 0., 1.)), f.x),
                       mix(hash3(i + vec3(0., 1., 1.)), hash3(i + vec3(1., 1., 1.)), f.x), f.y), f.z);
      }
      float magmaNoise(vec3 p) {
        float value = 0.0;
        float amplitude = 0.53;
        for (int i = 0; i < 4; i++) {
          value += amplitude * noise3(p);
          p = p * 2.03 + vec3(8.4, 3.7, 5.2);
          amplitude *= 0.5;
        }
        return value;
      }
      void main() {
        vec3 p = normalize(vSurface);
        float t = uTime * 0.16;
        float flow = magmaNoise(p * 3.1 + vec3(t * 0.6, -t * 0.7, t * 0.35));
        vec3 warped = p * 7.0 + vec3(flow * 1.7, -flow, flow * 1.3);
        float detail = magmaNoise(warped + vec3(-t * 1.1, t * 0.8, t));
        float heat = clamp(flow * 0.58 + detail * 0.62, 0.0, 1.0);
        vec3 deep = vec3(0.38, 0.026, 0.004);
        vec3 lava = vec3(1.25, 0.15, 0.008);
        vec3 hot = vec3(1.8, 0.75, 0.08);
        vec3 color = mix(deep, lava, smoothstep(0.24, 0.55, heat));
        color = mix(color, hot, smoothstep(0.49, 0.72, heat));
        color += vec3(1.1, 0.65, 0.22) * smoothstep(0.69, 0.82, heat);
        float facing = clamp(dot(normalize(vNormalView), normalize(vViewDirection)), 0.0, 1.0);
        color *= 0.74 + 0.26 * pow(facing, 0.5);
        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}
