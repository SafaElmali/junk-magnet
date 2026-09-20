import * as THREE from "three";
import { ExpansionView } from "./expansion-view";
import { LightningView } from "./lightning-view";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { SSAOPass } from "three/addons/postprocessing/SSAOPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import {
  type State,
  type Vec,
  type GameEvent,
  orbitPosition,
  MAX_SCRAP,
  ENTITY_LIMITS,
} from "./simulation";

import { CHUNK_SIZE, getChunkProps } from "./world";
import {
  getGraphicsQuality,
  graphicsProfile,
  type GraphicsQuality,
} from "./graphics";

const base = import.meta.env.BASE_URL;
const C = {
  ink: 0x173342,
  cream: 0xfff4d8,
  teal: 0x459b9c,
  rust: 0x8c4e36,
  steel: 0xa2aca6,
};
const mat = (color: number, roughness = 0.65, metalness = 0.05) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness });
const models = new Map<string, THREE.Group>();
const tempV = new THREE.Vector3();
function prepare(group: THREE.Object3D) {
  group.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return group;
}
function instance(name: string, x = 0, y = 0, z = 0, scale = 1) {
  const o = models.get(name)!.clone(true);
  o.position.set(x, y, z);
  o.scale.setScalar(scale);
  prepare(o);
  return o;
}
function box(
  w: number,
  h: number,
  d: number,
  m: THREE.Material,
  x: number,
  y: number,
  z: number,
  r = 0.04,
) {
  const o = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, r), m);
  o.position.set(x, y, z);
  o.castShadow = true;
  o.receiveShadow = true;
  return o;
}
function labelTexture(text: string, width = 512, height = 256) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const c = canvas.getContext("2d")!;
  c.fillStyle = "#fff0cf";
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.font = '800 64px "Barlow Condensed"';
  const lines = text.split("\n");
  lines.forEach((line, i) =>
    c.fillText(line, width / 2, height / 2 + (i - (lines.length - 1) / 2) * 68),
  );
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
export class YardScene {
  composer?: EffectComposer;
  ao?: SSAOPass;
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.OrthographicCamera();
  robot!: THREE.Group;
  private expansion?: ExpansionView;
  floor!: THREE.Mesh;
  sun!: THREE.DirectionalLight;
  enemyBatches: THREE.InstancedMesh[] = [];
  pickupBatches: THREE.InstancedMesh[][] = [];
  shotBatches: THREE.InstancedMesh[][] = [];
  renderedEnemies = 0;
  transform = new THREE.Object3D();
  instanceColor = new THREE.Color();
  orbit: THREE.Group[] = [];
  fx: {
    o: THREE.Object3D;
    vx: number;
    vy: number;
    vz: number;
    life: number;
    max: number;
  }[] = [];
  ring!: THREE.Mesh;
  quality: GraphicsQuality = getGraphicsQuality();
  private robotModels = new Map<State["config"]["robotId"], THREE.Group>();
  private hurtAt = -Infinity;
  private hurtDirection = new THREE.Vector2(0, -1);
  private hurtStrength = 0;
  private hurtRecoil = 0;
  private robotMaterials: {
    material: THREE.MeshStandardMaterial;
    color: THREE.Color;
    emissive: THREE.Color;
    intensity: number;
  }[] = [];
  private hurtRed = new THREE.Color(0xff3b24);
  private hurtWhite = new THREE.Color(0xfff4d8);
  pulse!: THREE.Group;
  private pulseBeam!: THREE.Mesh;
  private pulseCore!: THREE.Mesh;
  private pulseHead!: THREE.Mesh;
  private pulseStart = new THREE.Vector3();
  private pulseEnd = new THREE.Vector3();
  private beamDirection = new THREE.Vector3();
  private beamUp = new THREE.Vector3(0, 1, 0);
  private shotTrails!: THREE.InstancedMesh;
  private shotHeads!: THREE.InstancedMesh;
  private impactBatch!: THREE.InstancedMesh;
  private impacts: { x: number; z: number; life: number }[] = [];
  private barrelAppearances: { x: number; z: number; color: number }[] = [];
  pulseLife = 0;
  clock = 0;
  chunkKey = "";
  tireBatches: THREE.InstancedMesh[] = [];
  salvageBatch!: THREE.InstancedMesh;
  salvageRims!: THREE.InstancedMesh;
  markingBatch!: THREE.InstancedMesh;
  turretTemplate!: THREE.Group;
  turretModels = new Map<number, THREE.Group>();
  abilityFx: {
    o: THREE.Object3D;
    life: number;
    max: number;
    radius: number;
    dispose: boolean;
  }[] = [];
  burstGeometry = new THREE.RingGeometry(0.94, 1, 48);
  burstMaterial = new THREE.MeshBasicMaterial({
    color: 0x71efe0,
    transparent: true,
    opacity: 0.7,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  private lightning = new LightningView(this.scene);
  particles = new THREE.IcosahedronGeometry(0.065, 0);
  sparkMat = mat(0xffd56d, 0.35);
  xpMat = new THREE.MeshStandardMaterial({
    color: 0x248fc6,
    metalness: 0.3,
    roughness: 0.3,
    emissive: 0x0a3952,
    emissiveIntensity: 0.15,
  });
  frustum = new THREE.Frustum();
  projection = new THREE.Matrix4();
  cullSphere = new THREE.Sphere();
  raycaster = new THREE.Raycaster();
  floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  reduced = false;
  mobile = window.matchMedia("(pointer: coarse)").matches;
  constructor(public host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.info.autoReset = false;
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    this.reduced = motionQuery.matches;
    motionQuery.addEventListener("change", (e) => {
      this.reduced = e.matches;
    });
    this.renderer.setPixelRatio(
      graphicsProfile(this.quality, window.devicePixelRatio).pixelRatio,
    );
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.domElement.setAttribute(
      "aria-label",
      "Junk Magnet 3D scrapyard. Move with WASD, arrow keys, or touch. Attacks are automatic.",
    );
    host.prepend(this.renderer.domElement);
    this.scene.background = new THREE.Color(0xdcb394);
    this.scene.fog = new THREE.Fog(0xdcb394, 58, 90);
    this.camera.position.set(0, 23, 25);
    this.camera.lookAt(0, 0, 0);
    this.camera.near = 0.1;
    this.camera.far = 100;
    this.scene.add(new THREE.HemisphereLight(0xf5f8ed, 0x806247, 0.85));
    this.sun = new THREE.DirectionalLight(0xffe0ae, 3.1);
    this.sun.position.set(-12, 22, -8);
    this.sun.castShadow = true;
    Object.assign(this.sun.shadow.camera, {
      left: -24,
      right: 24,
      top: 24,
      bottom: -24,
      near: 1,
      far: 65,
    });
    const shadowSize = graphicsProfile(this.quality).shadowMapSize;
    this.sun.shadow.mapSize.set(shadowSize, shadowSize);
    this.sun.shadow.bias = -0.0003;
    this.sun.shadow.normalBias = 0.03;
    this.sun.shadow.radius = 3;
    this.scene.add(this.sun, this.sun.target);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const env = new RoomEnvironment();
    this.scene.environment = pmrem.fromScene(env, 0.04).texture;
    this.scene.environmentIntensity = 0.32;
    env.dispose();
    pmrem.dispose();
    this.setQuality(this.quality);
  }
  setQuality(quality: GraphicsQuality) {
    this.quality = quality;
    const profile = graphicsProfile(quality, window.devicePixelRatio);
    this.renderer.setPixelRatio(profile.pixelRatio);
    if (this.sun.shadow.mapSize.x !== profile.shadowMapSize) {
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
      this.sun.shadow.mapSize.set(profile.shadowMapSize, profile.shadowMapSize);
      this.sun.shadow.needsUpdate = true;
    }
    if (profile.ambientOcclusion && !this.composer) {
      const target = new THREE.WebGLRenderTarget(1, 1, {
        type: THREE.HalfFloatType,
        samples: profile.samples,
      });
      this.composer = new EffectComposer(this.renderer, target);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.ao = new SSAOPass(this.scene, this.camera, 1, 1, 16);
      this.ao.kernelRadius = 0.85;
      this.ao.minDistance = 0.001;
      this.ao.maxDistance = 0.035;
      this.composer.addPass(this.ao);
      this.composer.addPass(new OutputPass());
    }
    this.composer?.setPixelRatio(profile.pixelRatio);
    this.resize();
  }

  async load(onProgress: (n: number) => void) {
    const names = [
      "robot",
      "robot-scout",
      "robot-volt",
      "enemy-can",
      "container",
      "tire",
      "cone",
      "scrap-saw",
      "scrap-bolt",
      "scrap-nut",
    ];
    let done = 0;
    const loader = new GLTFLoader();
    await Promise.all(
      names.map(async (name) => {
        const g = await loader.loadAsync(`${base}models/${name}.glb`);
        models.set(name, g.scene);
        onProgress(++done / (names.length + 1));
      }),
    );
    const texture = await new THREE.TextureLoader().loadAsync(
      `${base}textures/yard-concrete.png`,
    );
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(5, 5);
    texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    this.floor = new THREE.Mesh(
      new THREE.PlaneGeometry(100, 100),
      new THREE.MeshStandardMaterial({
        map: texture,
        color: 0xe9c4a9,
        roughness: 1,
        metalness: 0,
      }),
    );
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.receiveShadow = true;
    this.scene.add(this.floor);
    onProgress(1);
    if (this.mobile) this.mobileModels();
    this.environment();
    this.enemyBatches = this.modelBatches(
      this.mobile ? "enemy-mobile" : "enemy-can",
      ENTITY_LIMITS.enemies,
    );
    this.pickupBatches = [
      this.modelBatches(
        this.mobile ? "bolt-mobile" : "scrap-bolt",
        ENTITY_LIMITS.pickups,
      ),
      this.modelBatches(
        this.mobile ? "gem-mobile" : "scrap-nut",
        ENTITY_LIMITS.pickups,
        this.xpMat,
      ),
    ];
    this.shotBatches = ["scrap-saw", "scrap-bolt", "scrap-nut"].map((name) =>
      this.modelBatches(name, ENTITY_LIMITS.shots),
    );
    this.robot = new THREE.Group();
    for (const id of ["scrap", "scout", "volt"] as const) {
      const model = instance(id === "scrap" ? "robot" : `robot-${id}`);
      model.name = `robot-${id}`;
      model.visible = id === "scrap";
      this.robotModels.set(id, model);
      this.robot.add(model);
    }
    // GLTF clones normally share materials: isolate the robot before tinting hits.
    const isolated = new Map<THREE.Material, THREE.Material>();
    this.robot.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const clone = (source: THREE.Material) => {
        let material = isolated.get(source);
        if (!material) {
          material = source.clone();
          isolated.set(source, material);
          if (material instanceof THREE.MeshStandardMaterial) {
            this.robotMaterials.push({
              material,
              color: material.color.clone(),
              emissive: material.emissive.clone(),
              intensity: material.emissiveIntensity,
            });
          }
        }
        return material;
      };
      object.material = Array.isArray(object.material)
        ? object.material.map(clone)
        : clone(object.material);
    });
    this.scene.add(this.robot);
    for (let i = 0; i < MAX_SCRAP; i++) {
      const o = instance(
        ["scrap-saw", "scrap-bolt", "scrap-nut"][i % 3],
        0,
        0.7,
        0,
        i % 3 === 0 ? 0.85 : 1.25,
      );
      this.orbit.push(o);
      this.scene.add(o);
    }
    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(1.82, 1.86, 96),
      new THREE.MeshBasicMaterial({
        color: 0x7cd9d0,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.045;
    this.scene.add(this.ring);
    // Actual mesh widths stay readable on Retina and mobile WebGL alike.
    const beamGeometry = new THREE.CylinderGeometry(1, 1, 1, 8);
    const magnetic = new THREE.MeshBasicMaterial({
      color: 0x10ded0,
      toneMapped: false,
    });
    const outline = new THREE.MeshBasicMaterial({
      color: 0x126675,
      toneMapped: false,
    });
    const hot = new THREE.MeshBasicMaterial({
      color: 0xffde72,
      toneMapped: false,
    });
    this.pulse = new THREE.Group();
    this.pulseBeam = new THREE.Mesh(beamGeometry, outline);
    this.pulseCore = new THREE.Mesh(beamGeometry, magnetic);
    this.pulseHead = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.26, 1),
      hot,
    );
    this.pulse.add(this.pulseBeam, this.pulseCore, this.pulseHead);
    this.pulse.visible = false;
    this.scene.add(this.pulse);
    this.shotTrails = new THREE.InstancedMesh(
      beamGeometry,
      magnetic,
      ENTITY_LIMITS.shots,
    );
    this.shotHeads = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(0.13, 0),
      hot,
      ENTITY_LIMITS.shots,
    );
    this.impactBatch = new THREE.InstancedMesh(
      new THREE.RingGeometry(0.7, 1, 16),
      hot,
      24,
    );
    for (const batch of [this.shotTrails, this.shotHeads, this.impactBatch]) {
      batch.count = 0;
      batch.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      batch.frustumCulled = false;
      this.scene.add(batch);
    }
  }
  private mobileModels() {
    // Small screens keep the same silhouettes with inexpensive geometry.
    const steel = mat(C.steel, 0.5, 0.45);
    steel.name = "Brushed steel";
    const dark = mat(0x414746),
      ink = mat(C.ink),
      rubber = mat(0x303b36),
      red = mat(0xed5940);
    const add = (
      group: THREE.Group,
      geometry: THREE.BufferGeometry,
      material: THREE.Material,
      x: number,
      y: number,
      z: number,
    ) => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, y, z);
      group.add(mesh);
      return mesh;
    };
    const can = new THREE.Group();
    add(
      can,
      new THREE.CylinderGeometry(0.31, 0.31, 0.62, 12),
      steel,
      0,
      0.59,
      0,
    );
    for (const y of [0.31, 0.38, 0.81, 0.9]) {
      const rim = new THREE.TorusGeometry(0.313, 0.021, 3, 12);
      rim.rotateX(Math.PI / 2);
      add(can, rim, dark, 0, y, 0);
    }
    add(can, new THREE.BoxGeometry(0.37, 0.24, 0.07), ink, 0, 0.64, 0.298);
    for (const x of [-0.1, 0.1])
      add(can, new THREE.OctahedronGeometry(0.054), red, x, 0.66, 0.35);
    for (const x of [-0.25, 0.25]) {
      add(
        can,
        new THREE.CylinderGeometry(0.037, 0.037, 0.28, 6),
        dark,
        x,
        0.16,
        0,
      );
      add(can, new THREE.BoxGeometry(0.17, 0.11, 0.23), rubber, x, 0.06, 0.06);
      add(
        can,
        new THREE.BoxGeometry(0.06, 0.18, 0.09),
        steel,
        x * 1.52,
        0.37,
        0.01,
      );
    }
    const tab = new THREE.TorusGeometry(0.082, 0.017, 3, 8);
    tab.rotateX(Math.PI / 2);
    add(can, tab, dark, 0, 0.922, 0.01);
    models.set("enemy-mobile", can);
    const gem = new THREE.Group();
    add(gem, new THREE.IcosahedronGeometry(0.23, 0), this.xpMat, 0, 0, 0);
    models.set("gem-mobile", gem);
    const bolt = new THREE.Group();
    add(bolt, new THREE.CylinderGeometry(0.072, 0.072, 0.6, 6), steel, 0, 0, 0);
    add(bolt, new THREE.CylinderGeometry(0.15, 0.15, 0.13, 6), dark, 0, 0.3, 0);
    models.set("bolt-mobile", bolt);
    const tire = new THREE.Group();
    for (const y of [0.13, 0.23, 0.33]) {
      const ring = new THREE.TorusGeometry(0.4, 0.135, 5, 16);
      ring.rotateX(Math.PI / 2);
      add(tire, ring, rubber, 0, y, 0);
    }
    for (let i = 0; i < 16; i++) {
      const angle = (i * Math.PI * 2) / 16;
      const tread = add(
        tire,
        new THREE.BoxGeometry(0.065, 0.25, 0.105),
        dark,
        Math.cos(angle) * 0.519,
        0.23,
        Math.sin(angle) * 0.519,
      );
      tread.rotation.y = -angle;
    }
    models.set("tire-mobile", tire);
  }
  private modelBatches(
    name: string,
    capacity: number,
    override?: THREE.Material,
  ) {
    const source = models.get(name)!;
    source.updateMatrixWorld(true);
    const parts = new Map<THREE.Material, THREE.BufferGeometry[]>();
    source.traverse((o) => {
      if (!(o instanceof THREE.Mesh) || Array.isArray(o.material)) return;
      const geometry = o.geometry.index
        ? o.geometry.toNonIndexed()
        : o.geometry.clone();
      geometry.deleteAttribute("uv1");
      geometry.deleteAttribute("tangent");
      geometry.applyMatrix4(o.matrixWorld);
      const material = override ?? o.material;
      const group = parts.get(material) ?? [];
      group.push(geometry);
      parts.set(material, group);
    });
    return [...parts].map(([material, geometries]) => {
      const merged = mergeGeometries(geometries, false)!;
      geometries.forEach((geometry) => geometry.dispose());
      const batch = new THREE.InstancedMesh(merged, material, capacity);
      batch.count = 0;
      batch.castShadow = !override;
      batch.receiveShadow = true;
      batch.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.scene.add(batch);
      return batch;
    });
  }
  private finishBatch(batches: THREE.InstancedMesh[], count: number) {
    for (const batch of batches) {
      batch.count = count;
      batch.instanceMatrix.needsUpdate = true;
      if (batch.instanceColor) batch.instanceColor.needsUpdate = true;
      batch.computeBoundingSphere();
    }
  }
  environment() {
    // Each GLB material gets one instanced draw, regardless of how far we travel.
    const tire = models.get(this.mobile ? "tire-mobile" : "tire")!;
    tire.updateMatrixWorld(true);
    const byMaterial = new Map<THREE.Material, THREE.BufferGeometry[]>();
    tire.traverse((o) => {
      if (!(o instanceof THREE.Mesh) || Array.isArray(o.material)) return;
      const geo = o.geometry.index
        ? o.geometry.toNonIndexed()
        : o.geometry.clone();
      geo.deleteAttribute("uv1");
      geo.deleteAttribute("tangent");
      geo.applyMatrix4(o.matrixWorld);
      const parts = byMaterial.get(o.material) || [];
      parts.push(geo);
      byMaterial.set(o.material, parts);
    });
    for (const [material, parts] of byMaterial) {
      const geo = mergeGeometries(parts, false)!;
      parts.forEach((part) => part.dispose());
      const mesh = new THREE.InstancedMesh(geo, material, 225);
      mesh.castShadow = mesh.receiveShadow = true;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.tireBatches.push(mesh);
      this.scene.add(mesh);
    }
    this.salvageBatch = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.95, 1, 1, 12),
      mat(0xffffff, 0.7, 0.3),
      75,
    );
    this.salvageBatch.castShadow = this.salvageBatch.receiveShadow = true;
    this.scene.add(this.salvageBatch);
    const rimParts = [0.07, 0.5, 0.93].map((y) => {
      const geometry = new THREE.TorusGeometry(0.97, 0.035, 4, 12);
      geometry.rotateX(Math.PI / 2);
      geometry.translate(0, y - 0.5, 0);
      return geometry;
    });
    const rimGeometry = mergeGeometries(rimParts);
    rimParts.forEach((g) => g.dispose());
    this.salvageRims = new THREE.InstancedMesh(
      rimGeometry!,
      mat(C.steel, 0.5, 0.45),
      75,
    );
    this.salvageRims.castShadow = true;
    this.scene.add(this.salvageRims);
    this.markingBatch = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(0.18, 2.3),
      new THREE.MeshBasicMaterial({
        color: 0xffe3a5,
        transparent: true,
        opacity: 0.28,
        depthWrite: false,
      }),
      100,
    );
    this.scene.add(this.markingBatch);
    const label = new THREE.Mesh(
      new THREE.PlaneGeometry(4.8, 2.4),
      new THREE.MeshBasicMaterial({
        map: labelTexture("SORT / RECYCLE\nYARD 07"),
        transparent: true,
        opacity: 0.25,
        depthWrite: false,
      }),
    );
    label.rotation.x = -Math.PI / 2;
    label.position.set(-3, 0.012, 2);
    this.scene.add(label);
    this.turretTemplate = new THREE.Group();
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.4, 0.54, 0.3, 8),
      mat(C.ink),
    );
    base.position.y = 0.15;
    const head = box(0.62, 0.52, 0.62, mat(C.teal), 0, 0.57, 0, 0.1);
    const barrel = box(0.2, 0.2, 0.72, mat(0xffcf54), 0, 0.67, 0.36);
    this.turretTemplate.add(base, head, barrel);
    this.updateWorld(0, 0);
  }
  private updateWorld(x: number, z: number) {
    const cx = Math.floor((x + CHUNK_SIZE / 2) / CHUNK_SIZE);
    const cz = Math.floor((z + CHUNK_SIZE / 2) / CHUNK_SIZE);
    const key = `${cx},${cz}`;
    if (key === this.chunkKey) return;
    this.chunkKey = key;
    this.floor.position.set(cx * CHUNK_SIZE, 0, cz * CHUNK_SIZE);
    const texture = (this.floor.material as THREE.MeshStandardMaterial).map!;
    texture.offset.set(cx, -cz);
    const transform = new THREE.Object3D();
    this.barrelAppearances = [];
    let tires = 0,
      piles = 0,
      markings = 0;
    for (let dx = -1; dx <= 1; dx++)
      for (let dz = -1; dz <= 1; dz++) {
        for (const prop of getChunkProps(cx + dx, cz + dz)) {
          if (prop.kind === "tires") {
            const scale = prop.radius / 0.55;
            for (let i = 0; i < prop.height; i++) {
              transform.position.set(prop.x, i * 0.4 * scale, prop.z);
              transform.rotation.set(0, prop.rotation + i * 0.6, 0);
              transform.scale.setScalar(scale);
              transform.updateMatrix();
              for (const batch of this.tireBatches)
                batch.setMatrixAt(tires, transform.matrix);
              tires++;
            }
          } else {
            const height = 0.55 + prop.height * 0.25;
            transform.position.set(prop.x, height / 2, prop.z);
            transform.rotation.set(0, prop.rotation, 0);
            transform.scale.set(prop.radius, height, prop.radius);
            transform.updateMatrix();
            this.salvageBatch.setMatrixAt(piles, transform.matrix);
            this.salvageRims.setMatrixAt(piles, transform.matrix);
            this.salvageBatch.setColorAt(
              piles,
              new THREE.Color([C.teal, C.rust, C.steel][prop.colorIndex]),
            );
            this.barrelAppearances.push({
              x: prop.x,
              z: prop.z,
              color: [C.teal, C.rust, C.steel][prop.colorIndex],
            });
            piles++;
          }
        }
        for (let stripe = 0; stripe < 4; stripe++) {
          transform.position.set(
            (cx + dx) * CHUNK_SIZE - 3,
            0.018,
            (cz + dz) * CHUNK_SIZE - 6 + stripe * 4,
          );
          transform.rotation.set(-Math.PI / 2, 0, 0);
          transform.scale.setScalar(1);
          transform.updateMatrix();
          this.markingBatch.setMatrixAt(markings++, transform.matrix);
        }
      }
    for (const batch of this.tireBatches) {
      batch.count = tires;
      batch.instanceMatrix.needsUpdate = true;
      batch.computeBoundingSphere();
    }
    this.salvageBatch.count = piles;
    this.salvageBatch.instanceMatrix.needsUpdate = true;
    if (this.salvageBatch.instanceColor)
      this.salvageBatch.instanceColor.needsUpdate = true;
    this.salvageBatch.computeBoundingSphere();
    this.salvageRims.count = piles;
    this.salvageRims.instanceMatrix.needsUpdate = true;
    this.salvageRims.computeBoundingSphere();
    this.markingBatch.count = markings;
    this.markingBatch.instanceMatrix.needsUpdate = true;
    this.markingBatch.computeBoundingSphere();
  }
  diagnostics() {
    return {
      camera: { x: this.camera.position.x, z: this.camera.position.z - 25 },
      chunks: 9,
      renderedEnemies: this.renderedEnemies,
      fx:
        this.fx.length +
        this.abilityFx.length +
        this.impacts.length +
        this.lightning.diagnostics().arcs,
      attackFx: {
        lightning: this.lightning.diagnostics(),
        pulseVisible: this.pulse?.visible ?? false,
        pulseLife: this.pulseLife,
        pulseWidth: 0.28,
        shotTrails: this.shotTrails?.count ?? 0,
        impacts: this.impacts.length,
        impactLimit: 24,
      },
      barrels: this.barrelAppearances.map((prop) => ({ ...prop })),
      geometries: this.renderer.info.memory.geometries,
      textures: this.renderer.info.memory.textures,
      graphics: {
        quality: this.quality,
        pixelRatio: this.renderer.getPixelRatio(),
        width: this.renderer.domElement.width,
        height: this.renderer.domElement.height,
        postProcessing: graphicsProfile(this.quality).ambientOcclusion,
        shadowMapSize: this.sun.shadow.mapSize.x,
      },
      robotHurt: { strength: this.hurtStrength, recoil: this.hurtRecoil },
    };
  }
  resize() {
    const w = this.host.clientWidth,
      h = this.host.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h);
    const aspect = w / h;
    const small = window.matchMedia("(pointer: coarse)").matches;
    const halfH = small
      ? aspect < 1
        ? 11.4
        : 12 / aspect
      : Math.min(12, 16.9 / aspect);
    this.camera.left = -halfH * aspect;
    this.camera.right = halfH * aspect;
    this.camera.top = halfH;
    this.camera.bottom = -halfH;
    this.camera.updateProjectionMatrix();
    this.composer?.setSize(w, h);
  }
  pointer(x: number, y: number): Vec | null {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.raycaster.setFromCamera(
      new THREE.Vector2(
        ((x - r.left) / r.width) * 2 - 1,
        (-(y - r.top) / r.height) * 2 + 1,
      ),
      this.camera,
    );
    const hit = this.raycaster.ray.intersectPlane(this.floorPlane, tempV);
    return hit ? { x: hit.x, z: hit.z } : null;
  }
  events(events: GameEvent[], s: State) {
    for (const ev of events) {
      if (ev.kind === "hurt") {
        this.hurtAt = s.time;
        const nearest = s.enemies.reduce<
          (typeof s.enemies)[number] | undefined
        >(
          (best, enemy) =>
            !best ||
            Math.hypot(enemy.x - s.player.x, enemy.z - s.player.z) <
              Math.hypot(best.x - s.player.x, best.z - s.player.z)
              ? enemy
              : best,
          undefined,
        );
        this.hurtDirection
          .set(
            nearest ? s.player.x - nearest.x : -s.facing.x,
            nearest ? s.player.z - nearest.z : -s.facing.z,
          )
          .normalize();
      }
      if (ev.kind === "lightning") {
        this.lightning.strike(ev, s.player);
        continue;
      }
      if (ev.kind === "burst" && this.abilityFx.length < 40) {
        const ring = new THREE.Mesh(this.burstGeometry, this.burstMaterial);
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(ev.x, 0.08, ev.z);
        this.scene.add(ring);
        this.abilityFx.push({
          o: ring,
          life: 0.38,
          max: 0.38,
          radius: ev.radius ?? 3,
          dispose: false,
        });
        continue;
      }
      if (ev.kind === "pulse") {
        this.pulseStart.set(
          ev.fromX ?? s.player.x,
          0.75,
          ev.fromZ ?? s.player.z,
        );
        this.pulseEnd.set(ev.x, 1.15, ev.z);
        this.pulseLife = 0.26;
        this.pulse.visible = true;
      }
      if (
        (ev.kind === "hit" || ev.kind === "pulse") &&
        this.impacts.length < 24
      )
        this.impacts.push({ x: ev.x, z: ev.z, life: 0.26 });
      if (ev.kind === "collect") continue;
      const count = ev.kind === "kill" ? 12 : ev.kind === "launch" ? 10 : 4;
      for (let i = 0; i < count && this.fx.length < 160; i++) {
        const o = new THREE.Mesh(this.particles, this.sparkMat);
        o.position.set(ev.x, 0.5, ev.z);
        this.scene.add(o);
        const a = i * 2.4 + this.clock;
        this.fx.push({
          o,
          vx: Math.cos(a) * 2,
          vy: 1.6 + (i % 3) * 0.7,
          vz: Math.sin(a) * 2,
          life: 0.35 + (i % 4) * 0.08,
          max: 0.6,
        });
      }
    }
  }
  private visible(x: number, z: number, radius: number) {
    this.cullSphere.center.set(x, 0.75, z);
    this.cullSphere.radius = radius;
    return this.frustum.intersectsSphere(this.cullSphere);
  }
  render(s: State, dt: number) {
    this.clock += dt;
    if (!this.robot) return;
    this.camera.position.set(s.player.x, 23, s.player.z + 25);
    this.camera.lookAt(s.player.x, 0, s.player.z);
    this.camera.updateMatrixWorld();
    this.projection.multiplyMatrices(
      this.camera.projectionMatrix,
      this.camera.matrixWorldInverse,
    );
    this.frustum.setFromProjectionMatrix(this.projection);
    this.sun.position.set(s.player.x - 12, 22, s.player.z - 8);
    this.sun.target.position.set(s.player.x, 0, s.player.z);
    this.updateWorld(s.player.x, s.player.z);
    this.robot.position.set(
      s.player.x,
      this.reduced ? 0 : Math.sin(s.time * 8) * 0.015,
      s.player.z,
    );
    const facing = Math.atan2(s.facing.x, s.facing.z);
    const diff = Math.atan2(
      Math.sin(facing - this.robot.rotation.y),
      Math.cos(facing - this.robot.rotation.y),
    );
    this.robot.rotation.y += diff * Math.min(1, dt * 14);
    this.robot.visible = true;
    this.expansion ??= new ExpansionView(this.scene);
    this.expansion.update(s);
    for (const [id, model] of this.robotModels)
      model.visible = id === s.config.robotId;
    this.renderRobotHurt(s.time);
    for (let i = 0; i < this.orbit.length; i++) {
      const o = this.orbit[i];
      o.visible = i < s.scrap;
      if (o.visible) {
        const p = orbitPosition(s, i);
        o.position.set(p.x, 0.65 + Math.sin(s.time * 3 + i) * 0.1, p.z);
        o.rotation.set(i % 3 === 1 ? 0.7 : 0, s.time * 4 + i, 0.15);
      }
    }
    this.ring.visible = s.scrap > 0 || s.immunity > 0;
    (this.ring.material as THREE.MeshBasicMaterial).color.setHex(
      s.immunity > 0 ? 0xe55235 : 0x7cd9d0,
    );
    this.ring.position.set(s.player.x, 0.04, s.player.z);
    const orbitPoint = orbitPosition(s, 0);
    this.ring.scale.setScalar(
      Math.hypot(orbitPoint.x - s.player.x, orbitPoint.z - s.player.z) / 1.85,
    );
    this.renderedEnemies = 0;
    const transform = this.transform;
    for (let i = 0; i < s.enemies.length; i++) {
      const e = s.enemies[i];
      if (
        !this.visible(
          e.x,
          e.z,
          e.type === "boss"
            ? 5
            : e.type === "miniboss"
              ? 4
              : e.type === "brute"
                ? 2
                : 1.3,
        )
      )
        continue;
      transform.position.set(
        e.x,
        Math.abs(Math.sin(s.time * 8 + e.seed)) * 0.065,
        e.z,
      );
      transform.rotation.set(
        0,
        Math.atan2(s.player.x - e.x, s.player.z - e.z),
        Math.sin(s.time * 8 + e.seed) * 0.06,
      );
      const k = e.hit > 0 ? 1 + Math.sin(e.hit * 20) * 0.08 : 1;
      if (e.type === "boss") transform.scale.set(k * 3.2, k * 2.9, k * 3.2);
      else if (e.type === "miniboss")
        transform.scale.set(k * 2.4, k * 2.1, k * 2.4);
      else if (e.type === "charger")
        transform.scale.set(k * 0.9, k * 1.2, k * 1.3);
      else if (e.type === "warden")
        transform.scale.set(k * 1.4, k * 1.2, k * 1.4);
      else if (e.type === "brute")
        transform.scale.set(k * 1.85, k * 1.6, k * 1.85);
      else if (e.type === "runner")
        transform.scale.set(k * 0.85, k * 1.2, k * 0.85);
      else transform.scale.setScalar(k * 1.12);
      transform.updateMatrix();
      for (const batch of this.enemyBatches) {
        batch.setMatrixAt(this.renderedEnemies, transform.matrix);
        const metal = /Brushed steel/i.test(
          (batch.material as THREE.Material).name,
        );
        this.instanceColor.setHex(
          metal && e.type !== "can"
            ? e.type === "runner" || e.type === "charger"
              ? 0xff8a55
              : e.type === "boss" || e.type === "miniboss"
                ? 0xf6c873
                : e.type === "warden"
                  ? 0x8b9dc5
                  : 0x62bec6
            : 0xffffff,
        );
        batch.setColorAt(this.renderedEnemies, this.instanceColor);
      }
      this.renderedEnemies++;
    }
    this.finishBatch(this.enemyBatches, this.renderedEnemies);
    const pickupCounts = [0, 0];
    for (const p of s.pickups) {
      if (!this.visible(p.x, p.z, 0.5)) continue;
      const kind = p.kind === "xp" ? 1 : 0;
      transform.position.set(
        p.x,
        0.16 + Math.sin(s.time * 3 + p.id) * 0.04,
        p.z,
      );
      // Tilt metal pickups so the bolt silhouette reads as salvage, not a pin.
      transform.rotation.set(p.kind === "scrap" ? 0.7 : 0, s.time + p.id, 0);
      transform.scale.setScalar(
        p.kind === "scrap" ? 1.1 : (p.value ?? 1) > 3 ? 0.95 : 0.7,
      );
      transform.updateMatrix();
      for (const batch of this.pickupBatches[kind])
        batch.setMatrixAt(pickupCounts[kind], transform.matrix);
      pickupCounts[kind]++;
    }
    this.pickupBatches.forEach((batches, index) =>
      this.finishBatch(batches, pickupCounts[index]),
    );
    const shotCounts = [0, 0, 0];
    let trailCount = 0;
    for (const p of s.shots) {
      if (!this.visible(p.x, p.z, 0.8)) continue;
      const kind = p.kind % 3;
      transform.position.set(p.x, 0.65, p.z);
      transform.rotation.set(s.time * 8, s.time * 12, 0);
      transform.scale.setScalar(1.4);
      transform.updateMatrix();
      for (const batch of this.shotBatches[kind])
        batch.setMatrixAt(shotCounts[kind], transform.matrix);
      shotCounts[kind]++;
      const speed = Math.hypot(p.vx, p.vz) || 1;
      const trailLength = this.reduced ? 0.45 : 0.95;
      this.beamDirection.set(p.vx / speed, 0, p.vz / speed);
      transform.position.set(
        p.x - (this.beamDirection.x * trailLength) / 2,
        0.6,
        p.z - (this.beamDirection.z * trailLength) / 2,
      );
      transform.quaternion.setFromUnitVectors(this.beamUp, this.beamDirection);
      transform.scale.set(0.07, trailLength, 0.07);
      transform.updateMatrix();
      this.shotTrails.setMatrixAt(trailCount, transform.matrix);
      transform.position.set(p.x, 0.65, p.z);
      transform.scale.setScalar(1);
      transform.updateMatrix();
      this.shotHeads.setMatrixAt(trailCount++, transform.matrix);
    }
    this.finishBatch([this.shotTrails, this.shotHeads], trailCount);
    this.shotBatches.forEach((batches, index) =>
      this.finishBatch(batches, shotCounts[index]),
    );
    this.sync(
      this.turretModels,
      s.turrets.map((t) => t.id),
    );
    for (const turret of s.turrets) {
      let model = this.turretModels.get(turret.id);
      if (!model) {
        model = this.turretTemplate.clone(true);
        this.turretModels.set(turret.id, model);
        this.scene.add(model);
      }
      model.position.set(turret.x, 0, turret.z);
      let target = s.enemies[0],
        nearest = Infinity;
      for (const enemy of s.enemies) {
        const d = Math.hypot(enemy.x - turret.x, enemy.z - turret.z);
        if (d < nearest) {
          nearest = d;
          target = enemy;
        }
      }
      if (target)
        model.rotation.y = Math.atan2(target.x - turret.x, target.z - turret.z);
      model.scale.setScalar(turret.life < 1 ? Math.max(0.1, turret.life) : 1);
    }
    this.lightning.update(dt, this.reduced);
    for (const f of this.abilityFx) {
      f.life -= dt;
      if (f.radius)
        f.o.scale.setScalar(f.radius * (0.55 + (1 - f.life / f.max) * 0.45));
      if (f.life <= 0) {
        f.o.removeFromParent();
        if (f.dispose) (f.o as THREE.Line).geometry.dispose();
      }
    }
    this.abilityFx = this.abilityFx.filter((f) => f.life > 0);
    for (const f of this.fx) {
      f.life -= dt;
      f.o.position.x += f.vx * dt;
      f.o.position.y += f.vy * dt;
      f.o.position.z += f.vz * dt;
      f.vy -= 8 * dt;
      f.o.scale.setScalar(Math.max(0.01, f.life / f.max));
      if (f.life <= 0) f.o.removeFromParent();
    }
    this.fx = this.fx.filter((f) => f.life > 0);
    this.pulseLife = Math.max(0, this.pulseLife - dt);
    this.pulse.visible = this.pulseLife > 0;
    if (this.pulse.visible) {
      this.beamDirection.subVectors(this.pulseEnd, this.pulseStart);
      const length = this.beamDirection.length();
      this.beamDirection.normalize();
      for (const [mesh, radius] of [
        [this.pulseBeam, 0.14],
        [this.pulseCore, 0.075],
      ] as const) {
        mesh.position.copy(this.pulseStart).lerp(this.pulseEnd, 0.5);
        // Raise the luminous inner core above its dark silhouette.
        if (mesh === this.pulseCore) mesh.position.y += 0.11;
        mesh.quaternion.setFromUnitVectors(this.beamUp, this.beamDirection);
        mesh.scale.set(radius, length, radius);
      }
      this.pulseHead.position.copy(this.pulseEnd);
      this.pulseHead.scale.setScalar(this.reduced ? 1 : 0.85 + this.pulseLife);
    }
    for (const impact of this.impacts) impact.life -= dt;
    this.impacts = this.impacts.filter((impact) => impact.life > 0);
    this.impacts.forEach((impact, index) => {
      const progress = 1 - impact.life / 0.26;
      transform.position.set(impact.x, 1.35, impact.z);
      transform.rotation.copy(this.camera.rotation);
      transform.scale.setScalar(this.reduced ? 0.38 : 0.2 + progress * 0.45);
      transform.updateMatrix();
      this.impactBatch.setMatrixAt(index, transform.matrix);
    });
    this.finishBatch([this.impactBatch], this.impacts.length);
    this.renderer.info.reset();
    if (this.composer && graphicsProfile(this.quality).ambientOcclusion)
      this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }
  private renderRobotHurt(time: number) {
    // Simulation time keeps feedback frozen in menus, upgrades and pause.
    const age = Math.max(0, time - this.hurtAt);
    const strength = Math.max(0, 1 - age / 0.85);
    this.hurtStrength = strength;
    const tint = !this.reduced && age < 0.075 ? this.hurtWhite : this.hurtRed;
    for (const { material, color, emissive, intensity } of this
      .robotMaterials) {
      material.color.copy(color);
      material.color.lerp(tint, strength * 0.82);
      material.emissive.copy(emissive).lerp(tint, strength * 0.55);
      material.emissiveIntensity = intensity + strength * 0.8;
    }
    const recoil =
      !this.reduced && age < 0.25 ? Math.sin((age / 0.25) * Math.PI) : 0;
    this.hurtRecoil = recoil;
    this.robot.position.x += this.hurtDirection.x * recoil * 0.16;
    this.robot.position.z += this.hurtDirection.y * recoil * 0.16;
    this.robot.rotation.z = recoil * 0.1;
    this.robot.rotation.x = recoil * -0.06;
  }
  private sync<T extends THREE.Object3D>(map: Map<number, T>, ids: number[]) {
    const alive = new Set(ids);
    for (const [id, o] of map)
      if (!alive.has(id)) {
        o.removeFromParent();
        map.delete(id);
      }
  }
  clear() {
    this.lightning.clear();
    this.hurtAt = -Infinity;
    if (this.robot) this.renderRobotHurt(0);
    this.renderedEnemies = 0;
    for (const batch of [
      ...this.enemyBatches,
      ...this.pickupBatches.flat(),
      ...this.shotBatches.flat(),
    ])
      batch.count = 0;
    for (const map of [this.turretModels]) {
      for (const o of map.values()) o.removeFromParent();
      map.clear();
    }
    for (const f of this.fx) f.o.removeFromParent();
    this.fx = [];
    for (const f of this.abilityFx) {
      f.o.removeFromParent();
      if (f.dispose) (f.o as THREE.Line).geometry.dispose();
    }
    this.abilityFx = [];
    this.pulseLife = 0;
    if (this.pulse) this.pulse.visible = false;
    this.impacts = [];
    for (const batch of [this.shotTrails, this.shotHeads, this.impactBatch])
      if (batch) batch.count = 0;
  }
}
