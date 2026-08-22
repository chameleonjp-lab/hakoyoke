/** Obsidian Observatory: Babylon rendering only; GameWorld remains integer-grid authoritative. */
import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { LinesMesh } from "@babylonjs/core/Meshes/linesMesh";
import { InstancedMesh } from "@babylonjs/core/Meshes/instancedMesh";
import "@babylonjs/core/Meshes/instancedMesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { GlowLayer } from "@babylonjs/core/Layers/glowLayer";
import { GameWorld } from "./GameWorld";
import { AudioManager, type SoundSignal } from "./AudioManager";
import { loadPuzzles } from "./puzzles";
import { ROLL_HALF, ROLL_SIZE } from "./rollPhysics";
import type { CubeState, GameSnapshot } from "./types";

export interface GameHandle { scene: Scene; dispose(): void; }

interface RenderCube { root: TransformNode; core: Mesh; outline: Mesh; type: CubeState["type"]; }

export async function createGameScene(engine: Engine, canvas: HTMLCanvasElement): Promise<GameHandle> {
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.008, 0.015, 0.035, 1);
  scene.ambientColor = new Color3(0.08, 0.11, 0.18);
  let quality = resolveQuality();
  engine.setHardwareScalingLevel(quality === "LOW" ? 1.6 : quality === "HIGH" ? 1 : 1.25);

  const camera = new ArcRotateCamera("observatory-camera", -Math.PI / 2, 0.91, 16, new Vector3(2, 0, 6), scene);
  camera.fov = 0.69;
  camera.lowerRadiusLimit = 11;
  camera.upperRadiusLimit = 24;
  camera.lowerBetaLimit = 0.72;
  camera.upperBetaLimit = 1.12;
  camera.wheelPrecision = 80;
  camera.attachControl(canvas, false);

  const fill = new HemisphericLight("void-fill", new Vector3(0, 1, 0), scene);
  fill.intensity = 0.58;
  fill.diffuse = Color3.FromHexString("#9AB2CF");
  fill.groundColor = Color3.FromHexString("#030812");
  const key = new DirectionalLight("survey-key", new Vector3(-0.4, -1, 0.36), scene);
  key.position = new Vector3(4, 12, -3);
  key.intensity = 1.72;
  key.diffuse = Color3.FromHexString("#D3E8FF");
  const shadows = new ShadowGenerator(quality === "LOW" ? 512 : 1024, key);
  shadows.useBlurExponentialShadowMap = quality !== "LOW";
  shadows.blurKernel = 12;
  const glow = new GlowLayer("signal-glow", scene, { mainTextureFixedSize: quality === "HIGH" ? 1024 : 512, blurKernelSize: 32 });
  glow.intensity = quality === "LOW" ? 0.28 : 0.48;

  const material = makeMaterials(scene);
  const platform = new PlatformRenderer(scene, material.tile);
  const markers = new MarkerRenderer(scene, material.marker, material.area);
  const effects = new EffectsRenderer(scene, material.marker, material.tile);
  const player = createPlayer(scene, material.player, shadows);
  const cubes = new Map<string, RenderCube>();
  const audio = new AudioManager();
  audio.setEnabled(localStorage.getItem("cubic-ordeal-audio") !== "OFF");
  let world: GameWorld | null = null;
  let latest: GameSnapshot | null = null;

  const onSnapshot = (event: Event) => { latest = (event as CustomEvent<GameSnapshot>).detail; };
  const onGesture = () => audio.unlock();
  const onSignal = (event: Event) => audio.play((event as CustomEvent<SoundSignal>).detail);
  const onSettings = (event: Event) => {
    const detail = (event as CustomEvent<{ key: "quality" | "audio"; value: string }>).detail;
    if (detail.key === "audio") audio.setEnabled(detail.value !== "OFF");
    if (detail.key === "quality") {
      quality = detail.value === "AUTO" ? detectQuality() : detail.value as "LOW" | "NORMAL" | "HIGH";
      engine.setHardwareScalingLevel(quality === "LOW" ? 1.6 : quality === "HIGH" ? 1 : 1.25);
      glow.intensity = quality === "LOW" ? 0.24 : quality === "HIGH" ? 0.54 : 0.42;
      shadows.setDarkness(quality === "LOW" ? 0.18 : 0.32);
    }
  };
  window.addEventListener("cubic:snapshot", onSnapshot);
  window.addEventListener("cubic:user-gesture", onGesture);
  window.addEventListener("cubic:signal", onSignal);
  window.addEventListener("cubic:settings", onSettings);

  const puzzles = await loadPuzzles();
  world = new GameWorld(
    puzzles,
    (snapshot) => window.dispatchEvent(new CustomEvent<GameSnapshot>("cubic:snapshot", { detail: snapshot })),
    (signal) => window.dispatchEvent(new CustomEvent<SoundSignal>("cubic:signal", { detail: signal as SoundSignal })),
  );

  scene.onBeforeRenderObservable.add(() => {
    if (!world) return;
    world.update(scene.getEngine().getDeltaTime() / 1000);
    if (!latest) return;
    platform.sync(latest, material.tile);
    markers.sync(latest);
    syncPlayer(player, latest);
    syncCubes(scene, cubes, latest, material, shadows);
    effects.sync(latest);
    const boardCenter = new Vector3((latest.stage >= 3 ? 2.5 : 2), 0, Math.min(6.3, latest.stats.platformRows * 0.5));
    camera.setTarget(boardCenter.add(effects.cameraShake));
    camera.radius = lerp(camera.radius, Math.max(11.4, latest.stats.platformRows * 0.68 + 4), 0.025);
    if (latest.phase === "CRUSHED") camera.radius = Math.min(25, camera.radius + 0.08);
  });

  return {
    scene,
    dispose() {
      window.removeEventListener("cubic:snapshot", onSnapshot);
      window.removeEventListener("cubic:user-gesture", onGesture);
      window.removeEventListener("cubic:signal", onSignal);
      window.removeEventListener("cubic:settings", onSettings);
      world?.dispose();
      audio.dispose();
      platform.dispose();
      markers.dispose();
      effects.dispose();
      Array.from(cubes.values()).forEach((rendered) => rendered.root.dispose());
      cubes.clear();
      player.dispose();
      shadows.dispose();
      glow.dispose();
    },
  };
}

function makeMaterials(scene: Scene) {
  const tile = new StandardMaterial("basalt-tile", scene);
  tile.diffuseColor = Color3.FromHexString("#294C68");
  tile.emissiveColor = Color3.FromHexString("#0B263A");
  tile.specularColor = Color3.FromHexString("#7ECDEB");
  tile.specularPower = 44;
  const normal = new StandardMaterial("limestone-cube", scene);
  normal.diffuseColor = Color3.FromHexString("#BFC6C6");
  normal.specularColor = Color3.FromHexString("#7D97A8");
  normal.specularPower = 26;
  const veil = new StandardMaterial("veil-cube", scene);
  veil.diffuseColor = Color3.FromHexString("#0A513D");
  veil.emissiveColor = Color3.FromHexString("#097A59");
  veil.specularColor = Color3.FromHexString("#75FFE0");
  const voidCube = new StandardMaterial("void-cube", scene);
  voidCube.diffuseColor = Color3.FromHexString("#070B12");
  voidCube.emissiveColor = Color3.FromHexString("#240726");
  voidCube.specularColor = Color3.FromHexString("#3A0C3E");
  const marker = new StandardMaterial("cyan-marker", scene);
  marker.diffuseColor = Color3.FromHexString("#0E4F67");
  marker.emissiveColor = Color3.FromHexString("#28BEEB");
  marker.alpha = 0.86;
  const area = new StandardMaterial("emerald-area", scene);
  area.diffuseColor = Color3.FromHexString("#0B6A4C");
  area.emissiveColor = Color3.FromHexString("#00BC78");
  area.alpha = 0.45;
  const player = new StandardMaterial("runner-ivory", scene);
  player.diffuseColor = Color3.FromHexString("#E7F0EE");
  player.emissiveColor = Color3.FromHexString("#173C42");
  player.specularColor = Color3.White();
  const makeOutline = (name: string, color: string) => { const edge = new StandardMaterial(name, scene); edge.emissiveColor = Color3.FromHexString(color); edge.diffuseColor = Color3.FromHexString(color); edge.disableLighting = true; edge.wireframe = true; return edge; };
  return { tile, normal, veil, void: voidCube, marker, area, player, normalOutline: makeOutline("limestone-edge", "#EAFEFF"), veilOutline: makeOutline("veil-edge", "#55FFD0"), voidOutline: makeOutline("void-edge", "#FF61D8") };
}

class PlatformRenderer {
  private source: Mesh;
  private instances: InstancedMesh[] = [];
  private grid: LinesMesh | null = null;
  private width = 0;
  private rows = 0;
  constructor(private readonly scene: Scene, tileMaterial: StandardMaterial) {
    this.source = MeshBuilder.CreateBox("tile-source", { width: 0.86, depth: 0.86, height: 0.24 }, scene);
    this.source.material = tileMaterial;
    this.source.isVisible = false;
  }
  sync(snapshot: GameSnapshot, tileMaterial: StandardMaterial): void {
    const width = snapshot.boardWidth;
    if (width === this.width && snapshot.stats.platformRows === this.rows) return;
    this.instances.forEach((instance) => instance.dispose());
    this.instances = [];
    this.width = width;
    this.rows = snapshot.stats.platformRows;
    this.source.material = tileMaterial;
    this.grid?.dispose();
    const lines: Vector3[][] = [];
    for (let z = -0.5; z <= this.rows - 0.5; z += 1) lines.push([new Vector3(-0.5, 0.018, z), new Vector3(this.width - 0.5, 0.018, z)]);
    for (let x = -0.5; x <= this.width - 0.5; x += 1) lines.push([new Vector3(x, 0.019, -0.5), new Vector3(x, 0.019, this.rows - 0.5)]);
    this.grid = MeshBuilder.CreateLineSystem("platform-grid", { lines }, this.scene);
    this.grid.color = Color3.FromHexString("#7DD9FA");
    for (let z = 0; z < this.rows; z += 1) {
      for (let x = 0; x < this.width; x += 1) {
        const instance = this.source.createInstance(`tile-${x}-${z}`);
        instance.position.set(x, -0.12, z);
        instance.receiveShadows = true;
        this.instances.push(instance);
      }
    }
  }
  dispose(): void { this.instances.forEach((instance) => instance.dispose()); this.grid?.dispose(); this.source.dispose(); }
}

class MarkerRenderer {
  private marker: Mesh;
  private areaMeshes = new Map<string, Mesh>();
  constructor(scene: Scene, markerMaterial: StandardMaterial, private readonly areaMaterial: StandardMaterial) {
    this.marker = MeshBuilder.CreateTorus("active-mark", { diameter: 0.74, thickness: 0.035, tessellation: 4 }, scene);
    this.marker.material = markerMaterial;
    this.marker.rotation.x = Math.PI / 2;
    this.marker.isVisible = false;
  }
  sync(snapshot: GameSnapshot): void {
    if (snapshot.marker) {
      this.marker.isVisible = true;
      this.marker.position.set(snapshot.marker.x, 0.03, snapshot.marker.z);
      this.marker.rotation.z += 0.025;
    } else this.marker.isVisible = false;
    const active = new Set(snapshot.areas.map((area) => area.id));
    for (const area of snapshot.areas) {
      if (!this.areaMeshes.has(area.id)) {
        const square = MeshBuilder.CreateGround(`area-${area.id}`, { width: 2.86, height: 2.86, subdivisions: 1 }, this.marker.getScene());
        square.material = this.areaMaterial;
        square.position.y = -0.105;
        this.areaMeshes.set(area.id, square);
      }
      const mesh = this.areaMeshes.get(area.id);
      if (mesh) mesh.position.set(area.x, -0.105, area.z);
    }
    Array.from(this.areaMeshes.entries()).forEach(([id, mesh]) => {
      if (!active.has(id)) { mesh.dispose(); this.areaMeshes.delete(id); }
    });
  }
  dispose(): void { this.marker.dispose(); this.areaMeshes.forEach((mesh) => mesh.dispose()); this.areaMeshes.clear(); }
}

function createPlayer(scene: Scene, material: StandardMaterial, shadows: ShadowGenerator): TransformNode {
  const root = new TransformNode("runner", scene);
  const torso = MeshBuilder.CreateCylinder("runner-torso", { height: 0.56, diameterTop: 0.3, diameterBottom: 0.38, tessellation: 6 }, scene);
  torso.parent = root;
  torso.position.y = 0.48;
  const head = MeshBuilder.CreateIcoSphere("runner-head", { radius: 0.18, subdivisions: 1 }, scene);
  head.parent = root;
  head.position.y = 0.92;
  const legLeft = MeshBuilder.CreateBox("runner-leg-left", { width: 0.11, height: 0.38, depth: 0.12 }, scene);
  legLeft.parent = root;
  legLeft.position.set(-0.11, 0.16, 0);
  const legRight = legLeft.clone("runner-leg-right");
  legRight.parent = root;
  legRight.position.x = 0.11;
  const forward = MeshBuilder.CreateCylinder("runner-forward", { height: 0.46, diameterTop: 0, diameterBottom: 0.18, tessellation: 4 }, scene);
  forward.parent = root;
  forward.rotation.x = Math.PI / 2;
  forward.position.set(0, 0.42, 0.42);
  [torso, head, legLeft, legRight, forward].forEach((part) => { part.material = material; shadows.addShadowCaster(part); });
  return root;
}

function syncPlayer(player: TransformNode, snapshot: GameSnapshot): void {
  player.position.set(snapshot.player.x, 0.01, snapshot.player.z);
  player.rotation.y = snapshot.player.heading;
  const running = snapshot.phase === "PLAYING" || snapshot.phase === "TUTORIAL";
  player.position.y = running ? Math.sin(performance.now() * 0.012) * 0.025 : 0;
  if (snapshot.phase === "CRUSHED") player.rotation.z = Math.PI * 0.47;
}

function syncCubes(scene: Scene, rendered: Map<string, RenderCube>, snapshot: GameSnapshot, materials: ReturnType<typeof makeMaterials>, shadows: ShadowGenerator): void {
  const active = new Set(snapshot.cubes.map((cube) => cube.id));
  for (const cube of snapshot.cubes) {
    let visual = rendered.get(cube.id);
    if (!visual) {
      const root = new TransformNode(`cube-root-${cube.id}`, scene);
      const core = MeshBuilder.CreateBox(`cube-${cube.id}`, { size: ROLL_SIZE }, scene);
      core.parent = root;
      core.position.set(0, ROLL_HALF, ROLL_HALF);
      core.material = materials[cube.type];
      shadows.addShadowCaster(core);
      const outline = MeshBuilder.CreateBox(`cube-outline-${cube.id}`, { size: ROLL_SIZE * 1.018 }, scene);
      outline.parent = root;
      outline.position.set(0, ROLL_HALF, ROLL_HALF);
      outline.material = cube.type === "normal" ? materials.normalOutline : cube.type === "veil" ? materials.veilOutline : materials.voidOutline;
      if (cube.type === "veil" || cube.type === "void") {
        const ring = MeshBuilder.CreateTorus(`glyph-${cube.id}`, { diameter: 0.56, thickness: 0.035, tessellation: cube.type === "veil" ? 8 : 6 }, scene);
        ring.parent = core;
        ring.rotation.x = Math.PI / 2;
        ring.position.z = ROLL_HALF;
        ring.material = cube.type === "veil" ? materials.area : materials.marker;
        if (cube.type === "void") ring.material = materials.void;
      }
      visual = { root, core, outline, type: cube.type };
      rendered.set(cube.id, visual);
    }
    const p = snapshot.rollProgress;
    visual.root.position.set(cube.x, 0, cube.z - ROLL_HALF);
    visual.root.rotation.x = -p * Math.PI / 2;
    visual.root.rotation.z = 0;
    const sink = cube.captured ? snapshot.captureProgress : 0;
    visual.root.position.y = -sink * 0.82;
    visual.core.scaling.setAll(1 - sink * 0.35);
    visual.outline.scaling.setAll(1 - sink * 0.35);
  }
  Array.from(rendered.entries()).forEach(([id, visual]) => {
    if (!active.has(id)) { visual.root.dispose(); rendered.delete(id); }
  });
}

/** Reuses small meshes for short capture bursts and platform-collapse debris. */
class EffectsRenderer {
  private readonly particleSource: Mesh;
  private readonly debrisSource: Mesh;
  private readonly particles: InstancedMesh[] = [];
  private readonly debris: InstancedMesh[] = [];
  private lastCaptureId = "";
  private captureOrigin = new Vector3();
  private captureStart = -Infinity;
  private lastRows = -1;
  private collapseStart = -Infinity;
  private collapseRow = 0;
  readonly cameraShake = new Vector3();

  constructor(private readonly scene: Scene, particleMaterial: StandardMaterial, debrisMaterial: StandardMaterial) {
    this.particleSource = MeshBuilder.CreateIcoSphere("capture-signal-source", { radius: 0.055, subdivisions: 1 }, scene);
    this.particleSource.material = particleMaterial;
    this.particleSource.isVisible = false;
    this.debrisSource = MeshBuilder.CreateBox("collapse-fragment-source", { size: 0.13 }, scene);
    this.debrisSource.material = debrisMaterial;
    this.debrisSource.isVisible = false;
    for (let index = 0; index < 18; index += 1) { const particle = this.particleSource.createInstance(`capture-signal-${index}`); particle.isVisible = false; this.particles.push(particle); }
    for (let index = 0; index < 28; index += 1) { const fragment = this.debrisSource.createInstance(`collapse-fragment-${index}`); fragment.isVisible = false; this.debris.push(fragment); }
  }

  sync(snapshot: GameSnapshot): void {
    const now = performance.now() / 1000;
    const captured = snapshot.cubes.find((cube) => cube.captured);
    if (captured && captured.id !== this.lastCaptureId) { this.lastCaptureId = captured.id; this.captureOrigin.set(captured.x, 0.08, captured.z); this.captureStart = now; }
    const captureAge = now - this.captureStart;
    const captureVisible = captureAge >= 0 && captureAge < 0.65;
    this.particles.forEach((particle, index) => {
      particle.isVisible = captureVisible;
      if (!captureVisible) return;
      const angle = index * 2.399;
      const radius = 0.14 + captureAge * (0.72 + (index % 3) * 0.1);
      particle.position.set(this.captureOrigin.x + Math.cos(angle) * radius, this.captureOrigin.y + 0.08 + captureAge * (0.44 + (index % 4) * 0.08), this.captureOrigin.z + Math.sin(angle) * radius);
      particle.scaling.setAll(Math.max(0.08, 1 - captureAge * 1.35));
    });
    if (this.lastRows >= 0 && snapshot.stats.platformRows < this.lastRows) { this.collapseStart = now; this.collapseRow = snapshot.stats.platformRows; }
    this.lastRows = snapshot.stats.platformRows;
    const collapseAge = now - this.collapseStart;
    const collapseVisible = collapseAge >= 0 && collapseAge < 1.05;
    this.debris.forEach((fragment, index) => {
      fragment.isVisible = collapseVisible;
      if (!collapseVisible) return;
      const lane = index % snapshot.boardWidth;
      const spread = Math.floor(index / snapshot.boardWidth) * 0.08;
      fragment.position.set(lane + ((index % 2) ? 0.18 : -0.18), -collapseAge * collapseAge * 3.8 + 0.04, this.collapseRow + spread);
      fragment.rotation.set(collapseAge * (2 + index % 5), collapseAge * (1 + index % 3), collapseAge * (3 + index % 4));
    });
    const shake = collapseVisible ? (1 - collapseAge / 1.05) * 0.09 : 0;
    this.cameraShake.set(Math.sin(now * 57) * shake, Math.cos(now * 41) * shake * 0.45, 0);
  }

  dispose(): void { this.particles.forEach((mesh) => mesh.dispose()); this.debris.forEach((mesh) => mesh.dispose()); this.particleSource.dispose(); this.debrisSource.dispose(); }
}

function detectQuality(): "LOW" | "NORMAL" | "HIGH" {
  const cores = navigator.hardwareConcurrency ?? 4;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  if (cores <= 4 || memory <= 4 || window.innerWidth < 520) return "LOW";
  if (cores >= 8 && memory >= 8) return "HIGH";
  return "NORMAL";
}

function resolveQuality(): "LOW" | "NORMAL" | "HIGH" {
  const stored = localStorage.getItem("cubic-ordeal-quality");
  return stored === "LOW" || stored === "NORMAL" || stored === "HIGH" ? stored : detectQuality();
}

function lerp(from: number, to: number, alpha: number): number { return from + (to - from) * alpha; }
