// Draws a baked exercise motion (agents/CLAUDE/anatomy/bake_app.js): the anatomy preview page's skin view,
// precomputed. Scene, lights and controls match that page; the shader hooks below are its own, re-applied
// from each mesh's extras.fx because glTF cannot carry them.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

type Fx = {
  pull: number;
  pullK: number;
  rim: boolean;
  renderOrder: number;
  depthWrite: boolean;
  colorWrite: boolean;
  transparent: boolean;
  opacity: number;
  side: THREE.Side;
  polygonOffset: [number, number] | null;
};
type Hook = (shader: THREE.WebGLProgramParametersWithUniforms) => void;
const chain = (m: THREE.Material, hook: Hook, key: string) => {
  const prev = m.onBeforeCompile.bind(m),
    prevKey = m.customProgramCacheKey.bind(m);
  m.onBeforeCompile = (sh, r) => {
    prev(sh, r);
    hook(sh);
  };
  m.customProgramCacheKey = () => key + '|' + prevKey();
};
// depth-only nudge towards the camera (worked muscles over the skin above them, clothes over muscles)
const pullHook =
  (d: number, perVertex: boolean): Hook =>
  sh => {
    sh.vertexShader =
      (perVertex ? 'attribute float pullK;\n' : '') +
      sh.vertexShader.replace(
        '#include <project_vertex>',
        `#include <project_vertex>\nmvPosition.xyz += normalize(-mvPosition.xyz) * ${d.toFixed(3)}${perVertex ? ' * pullK' : ''};\ngl_Position = projectionMatrix * mvPosition;`,
      );
  };
// fabric gets denser towards its silhouette
const rimHook: Hook = sh => {
  sh.fragmentShader = sh.fragmentShader.replace(
    '#include <opaque_fragment>',
    'float rimF = pow(1.0 - abs(dot(normalize(vNormal), normalize(vViewPosition))), 2.0);\ndiffuseColor.a = mix(diffuseColor.a, 1.0, rimF);\n#include <opaque_fragment>',
  );
};
// CC fingers use more than 4 bone influences (JOINTS_1/WEIGHTS_1); stock three.js skins with the first 4 only
function fullSkin(mesh: THREE.SkinnedMesh) {
  const a = mesh.geometry.attributes as Record<string, THREE.BufferAttribute>,
    sets = [{ i: 'skinIndex', w: 'skinWeight' }];
  for (let n = 1; a['joints_' + n] && a['weights_' + n]; n++) sets.push({ i: 'joints_' + n, w: 'weights_' + n });
  if (sets.length === 1) return;
  const sw = a.skinWeight;
  for (let v = 0; v < sw.count; v++) {
    // GLTFLoader normalized the first four alone: give them back their share
    let extra = 0;
    for (const s of sets.slice(1)) for (let c = 0; c < 4; c++) extra += a[s.w].getComponent(v, c);
    const share = Math.max(0, 1 - extra);
    for (let c = 0; c < 4; c++) sw.setComponent(v, c, sw.getComponent(v, c) * share);
  }
  sw.needsUpdate = true;
  const decl = sets
    .slice(1)
    .map(s => `attribute vec4 ${s.i}; attribute vec4 ${s.w};`)
    .join('\n');
  const terms = sets
    .flatMap(s => ['x', 'y', 'z', 'w'].map(c => `${s.w}.${c} * getBoneMatrix( ${s.i}.${c} )`))
    .join(' + ');
  for (const m of ([] as THREE.Material[]).concat(mesh.material))
    chain(
      m,
      sh => {
        sh.vertexShader = sh.vertexShader
          .replace(
            '#include <skinning_pars_vertex>',
            `#include <skinning_pars_vertex>\n#ifdef USE_SKINNING\n${decl}\n#endif`,
          )
          .replace(
            '#include <skinning_vertex>',
            `#ifdef USE_SKINNING\nmat4 fullSkin = ${terms};\ntransformed = (bindMatrixInverse * fullSkin * bindMatrix * vec4(transformed, 1.0)).xyz;\n#endif`,
          )
          .replace(
            '#include <skinnormal_vertex>',
            `#ifdef USE_SKINNING\nmat4 fullNormalSkin = bindMatrixInverse * (${terms}) * bindMatrix;\nobjectNormal = (fullNormalSkin * vec4(objectNormal, 0.0)).xyz;\n#ifdef USE_TANGENT\nobjectTangent = (fullNormalSkin * vec4(objectTangent, 0.0)).xyz;\n#endif\n#endif`,
          );
      },
      `full${sets.length}`,
    );
}
function restore(o: THREE.Object3D) {
  const fx = o.userData.fx as Fx | undefined;
  if (!(o as THREE.Mesh).isMesh || !fx) return;
  const mesh = o as THREE.Mesh;
  mesh.frustumCulled = false;
  mesh.renderOrder = fx.renderOrder;
  if (mesh.geometry.attributes._pullk) mesh.geometry.setAttribute('pullK', mesh.geometry.attributes._pullk);
  mesh.material = ([] as THREE.Material[]).concat(mesh.material).map(m => {
    m = m.clone();
    Object.assign(m, {
      depthWrite: fx.depthWrite,
      colorWrite: fx.colorWrite,
      transparent: fx.transparent,
      opacity: fx.opacity,
      side: fx.side,
    });
    if (fx.polygonOffset)
      Object.assign(m, {
        polygonOffset: true,
        polygonOffsetFactor: fx.polygonOffset[0],
        polygonOffsetUnits: fx.polygonOffset[1],
      });
    if (fx.pullK) chain(m, pullHook(fx.pullK, true), 'pullK' + fx.pullK);
    else if (fx.pull) chain(m, pullHook(fx.pull, false), 'pull' + fx.pull);
    if (fx.rim) chain(m, rimHook, 'rim');
    return m;
  })[0]!;
  if ((mesh as THREE.SkinnedMesh).isSkinnedMesh) fullSkin(mesh as THREE.SkinnedMesh);
}

export type MotionView = { setPlaying(on: boolean): void; dispose(): void };
export async function mountMotion(canvas: HTMLCanvasElement, url: string, target: number[]): Promise<MotionView> {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  const scene = new THREE.Scene(),
    camera = new THREE.PerspectiveCamera(35, 1, 0.05, 50);
  camera.position.set(2.6, 1.6, 2.6);
  const controls = new OrbitControls(camera, canvas);
  Object.assign(controls, { enableDamping: true, minDistance: 0.8, maxDistance: 8, enablePan: false });
  controls.target.fromArray(target);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x77736e, 1.3));
  const sun = new THREE.DirectionalLight(0xffffff, 2.4);
  sun.position.set(2, 4, 3);
  const rim = new THREE.DirectionalLight(0xffffff, 0.9);
  rim.position.set(-3, 2, -3);
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(1.4, 48),
    new THREE.MeshStandardMaterial({ color: 0x9a9690, transparent: true, opacity: 0.25 }),
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(sun, rim, floor);
  const resize = () => {
    const { clientWidth: w, clientHeight: h } = canvas;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  let disposed = false;
  try {
    const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(url);
    if (disposed) throw Error('disposed');
    gltf.scene.traverse(restore);
    scene.add(gltf.scene);
    const mixer = new THREE.AnimationMixer(gltf.scene),
      clock = new THREE.Clock();
    if (gltf.animations[0]) mixer.clipAction(gltf.animations[0]).play();
    mixer.update(0); // start at frame 0, not at the pose the file was exported in
    let playing = true;
    renderer.setAnimationLoop(() => {
      const dt = clock.getDelta();
      if (playing) mixer.update(dt);
      controls.update();
      renderer.render(scene, camera);
    });
    return {
      setPlaying: on => void (playing = on),
      dispose() {
        disposed = true;
        renderer.setAnimationLoop(null);
        observer.disconnect();
        controls.dispose();
        renderer.dispose();
      },
    };
  } catch (error) {
    observer.disconnect();
    controls.dispose();
    renderer.dispose();
    throw error;
  }
}
