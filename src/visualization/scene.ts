import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { ModelLab as Lab } from '../color/colorConversion';
import { sampleGamut } from './gamut';
import { hexToLab } from '../color/colorConversion';
import { SHELL_COLORS, type ColorEntry, type Observation, type Quality } from '../types';

type Layer = 'gamut' | 'dictionary' | 'candidates' | 'guesses' | 'shells' | 'eliminated';
const position = (lab: Lab) => new THREE.Vector3(lab.a, lab.l, lab.b);

export class LabScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(42, 1, 0.1, 1500);
  private controls: OrbitControls;
  private groups = Object.fromEntries(['gamut', 'dictionary', 'candidates', 'guesses', 'shells', 'eliminated'].map(key => [key, new THREE.Group()])) as Record<Layer, THREE.Group>;
  private dictionary: ColorEntry[] = [];
  private eligible = new Set<number>();
  private observations: Observation[] = [];
  private pickables: THREE.Object3D[] = [];
  private raycaster = new THREE.Raycaster();
  private shells = new Map<number, THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>>();
  private selected: number | null = null;
  private opacity = 0.2;
  private pointSize = 5;
  private observer: ResizeObserver;
  private frame = 0;
  private disposed = false; private dirty = true;
  private pointerDown = new THREE.Vector2();
  private selectionMarker = new THREE.Mesh(new THREE.OctahedronGeometry(3.8), new THREE.MeshBasicMaterial({ color: '#ffffff', wireframe: true, depthTest: false }));

  constructor(private host: HTMLElement, private onPick: (entry: ColorEntry | Observation) => void) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor('#101923');
    this.renderer.domElement.setAttribute('aria-label', 'Interactive Lab color space. Drag to rotate; scroll or pinch to zoom. Use the candidate table for keyboard access.');
    this.renderer.domElement.tabIndex = 0;
    host.prepend(this.renderer.domElement);
    this.scene.add(...Object.values(this.groups));
    this.groups.eliminated.visible = false;
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true; this.controls.addEventListener('change', () => { this.dirty = true; });
    this.controls.minDistance = 70;
    this.controls.maxDistance = 680;
    this.controls.maxPolarAngle = Math.PI * 0.98;
    this.resetCamera();
    this.axes();
    this.selectionMarker.visible = false;
    this.scene.add(this.selectionMarker);
    this.raycaster.params.Points = { threshold: 2.7 };
    this.renderer.domElement.addEventListener('pointerdown', this.onPointerDown);
    this.renderer.domElement.addEventListener('click', this.onClick);
    this.renderer.domElement.addEventListener('keydown', this.onKeyDown);
    this.renderer.domElement.addEventListener('webglcontextlost', this.onContextLost);
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(host);
    this.setQuality('medium');
    this.animate();
  }

  private onContextLost = (event: Event) => {
    event.preventDefault();
    this.host.dispatchEvent(new CustomEvent('scene-error', { detail: 'The 3D context was lost. Reload to restore it; the solver still works.' }));
  };

  private resize() {
    const width = this.host.clientWidth, height = this.host.clientHeight;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix(); this.dirty = true;
  }

  private animate = () => {
    if (this.disposed) return;
    this.frame = requestAnimationFrame(this.animate);
    this.controls.update();
    if (this.dirty) { this.renderer.render(this.scene, this.camera); this.dirty = false; }
  };

  private clear(group: THREE.Group) { this.dirty = true;
    group.traverse(object => {
      const renderable = object as THREE.Mesh;
      renderable.geometry?.dispose();
      if (renderable.material) {
        const materials = Array.isArray(renderable.material) ? renderable.material : [renderable.material];
        for (const material of materials) {
          (material as THREE.SpriteMaterial).map?.dispose();
          material.dispose();
        }
      }
    });
    group.clear();
  }

  private cloud(positions: Float32Array, colors: Float32Array | string, size: number, opacity: number) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    if (typeof colors !== 'string') geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const material = new THREE.PointsMaterial({
      size, sizeAttenuation: false, vertexColors: typeof colors !== 'string',
      color: typeof colors === 'string' ? colors : '#ffffff', transparent: true, opacity,
      depthWrite: false,
    });
    return new THREE.Points(geometry, material);
  }

  private colorCloud(entries: ColorEntry[], size: number, opacity: number) {
    const positions = new Float32Array(entries.length * 3), colors = new Float32Array(entries.length * 3);
    entries.forEach((entry, i) => {
      positions.set([entry.lab.a, entry.lab.l, entry.lab.b], i * 3);
      new THREE.Color(entry.hex).toArray(colors, i * 3);
    });
    const cloud = this.cloud(positions, colors, size, opacity);
    cloud.userData.entries = entries;
    return cloud;
  }

  private label(text: string, at: THREE.Vector3, color = '#aab9cb', scale = 1) {
    const canvas = document.createElement('canvas');
    canvas.width = 640; canvas.height = 96;
    const ctx = canvas.getContext('2d')!;
    ctx.font = '500 32px system-ui';
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.fillText(text, 320, 57);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, sizeAttenuation: false }));
    sprite.position.copy(at);
    sprite.scale.set(0.64 * scale, 0.096 * scale, 1);
    return sprite;
  }

  private axes() {
    const grid = new THREE.GridHelper(220, 11, '#344557', '#233242');
    grid.position.y = -5;
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.6;
    this.scene.add(grid);
    const origin = new THREE.Vector3(0, 0, 0);
    const axes: [THREE.Vector3, string, string][] = [
      [new THREE.Vector3(115, 0, 0), '#ed919e', '+a* red'],
      [new THREE.Vector3(0, 118, 0), '#d7e1f0', 'L* lightness'],
      [new THREE.Vector3(0, 0, 115), '#dfc582', '+b* yellow'],
    ];
    for (const [end, color, title] of axes) {
      const geometry = new THREE.BufferGeometry().setFromPoints([origin, end]);
      this.scene.add(new THREE.Line(geometry, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.65 })));
      this.scene.add(this.label(title, end.clone().multiplyScalar(1.09), color, 0.75));
    }
    this.scene.add(this.label('−a* green', new THREE.Vector3(-111, 0, 0), '#83bcb0', 0.7));
    this.scene.add(this.label('−b* blue', new THREE.Vector3(0, 0, -125), '#88a8e6', 0.7));
    this.scene.add(this.label('0', new THREE.Vector3(0, -3, 0), '#8392a4', 0.5));
    this.scene.add(this.label('100', new THREE.Vector3(-10, 100, 0), '#8392a4', 0.5));
  }

  resetCamera() {
    this.camera.position.set(225, 175, 255);
    this.controls.target.set(4, 48, -3);
    this.controls.update();
  }

  setQuality(quality: Quality) {
    const data = sampleGamut(quality);
    const colors = new Float32Array(data.rgb.length);
    const color = new THREE.Color();
    for (let i = 0; i < data.rgb.length; i += 3) {
      color.setRGB(data.rgb[i], data.rgb[i + 1], data.rgb[i + 2], THREE.SRGBColorSpace).toArray(colors, i);
    }
    this.clear(this.groups.gamut);
    this.groups.gamut.add(this.cloud(data.positions, colors, quality === 'high' ? 1.8 : 2.3, this.observations.length ? 0.13 : 0.42));
  }

  setDictionary(entries: ColorEntry[], pool: ColorEntry[]) { this.dictionary = entries; this.eligible = new Set(pool.map(c => c.id)); }

  setState(candidates: ColorEntry[], observations: Observation[]) {
    this.observations = observations;
    for (const cloud of this.groups.gamut.children) (cloud as THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>).material.opacity = observations.length ? 0.13 : 0.42;
    this.pickables = [];
    this.selectionMarker.visible = false;
    const remaining = new Set(candidates.map(c => c.id));
    this.clear(this.groups.dictionary);
    // Non-target names remain context; eliminated targets have their own toggle.
    const backdrop = observations.length ? this.dictionary.filter(c => !this.eligible.has(c.id)) : this.dictionary;
    const dictionaryPoints = this.colorCloud(backdrop, 2.5, observations.length ? 0.12 : 0.2);
    this.groups.dictionary.add(dictionaryPoints);
    this.pickables.push(dictionaryPoints);
    this.clear(this.groups.candidates);
    const points = this.colorCloud(candidates, observations.length ? this.pointSize + 2 : 3.2, 1);
    this.groups.candidates.add(points);
    if (observations.length && candidates.length <= 300) {
      const halos = this.cloud((points.geometry.getAttribute('position').array as Float32Array).slice(), '#ffffff', this.pointSize + 6, 0.52);
      halos.renderOrder = 1; points.renderOrder = 2; this.groups.candidates.add(halos);
    }
    this.pickables.unshift(points);
    this.clear(this.groups.eliminated);
    this.groups.eliminated.add(this.colorCloud(this.dictionary.filter(c => this.eligible.has(c.id) && !remaining.has(c.id)), 2.5, 0.17));
    this.clear(this.groups.guesses);
    observations.forEach((observation, index) => {
      const color = SHELL_COLORS[index % SHELL_COLORS.length];
      const marker = new THREE.Mesh(new THREE.OctahedronGeometry(2.8), new THREE.MeshBasicMaterial({ color, depthTest: false }));
      const at = position(hexToLab(observation.guessHex));
      marker.position.copy(at);
      marker.userData.observation = observation;
      this.groups.guesses.add(marker);
      this.pickables.unshift(marker);
      this.groups.guesses.add(this.label(String(index + 1) + ' · ' + (observation.guessName ?? observation.guessHex) + ' · ' + observation.displayedScore.toFixed(2) + '%',
        at.clone().add(new THREE.Vector3(0, 8, 0)), color, 0.7));
    });
  }

  clearSurfaces() {
    this.clear(this.groups.shells);
    this.shells.clear();
  }

  addSurface(id: number, positions: Float32Array, color: string) {
    const previous = this.shells.get(id);
    if (previous) { this.groups.shells.remove(previous); previous.geometry.dispose(); previous.material.dispose(); }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: this.opacity, side: THREE.DoubleSide, depthWrite: false,
    }));
    mesh.userData.baseColor = color;
    this.groups.shells.add(mesh);
    this.shells.set(id, mesh);
    this.highlight(this.selected);
  }

  highlight(id: number | null) {
    this.selected = id; this.dirty = true;
    for (const [shellId, shell] of this.shells) shell.material.opacity = this.opacity * (id === null || shellId === id ? 1 : 0.2);
    this.groups.guesses.children.forEach(object => {
      if (object.userData.observation) object.scale.setScalar(object.userData.observation.id === id ? 1.5 : 1);
    });
  }

  selectCandidate(entry: ColorEntry) {
    this.selectionMarker.position.copy(position(entry.lab));
    this.selectionMarker.visible = true; this.dirty = true;
  }

  setLayer(name: Layer, visible: boolean) { this.groups[name].visible = visible; this.dirty = true; }
  setOpacity(opacity: number) { this.opacity = opacity; this.highlight(this.selected); }
  setPointSize(size: number) {
    this.pointSize = size; this.dirty = true;
    this.groups.candidates.children.forEach((child, i) => {
      (child as THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>).material.size = size + (i ? 6 : 2);
    });
  }

  private onPointerDown = (event: PointerEvent) => this.pointerDown.set(event.clientX, event.clientY);
  private onClick = (event: MouseEvent) => {
    if (this.pointerDown.distanceTo(new THREE.Vector2(event.clientX, event.clientY)) > 5) return;
    const bounds = this.renderer.domElement.getBoundingClientRect();
    this.raycaster.setFromCamera(new THREE.Vector2((event.clientX - bounds.left) / bounds.width * 2 - 1, -(event.clientY - bounds.top) / bounds.height * 2 + 1), this.camera);
    const visible = this.pickables.filter(object => object.parent?.visible);
    const hits = this.raycaster.intersectObjects(visible, false);
    for (const hit of hits) {
      const data = hit.object.userData;
      const entry = data.observation ?? (hit.index !== undefined ? data.entries?.[hit.index] : null);
      if (entry) { this.onPick(entry); break; }
    }
  };

  private onKeyDown = (event: KeyboardEvent) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-', 'Home'].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'Home') return this.resetCamera();
    const offset = this.camera.position.clone().sub(this.controls.target);
    const spherical = new THREE.Spherical().setFromVector3(offset);
    if (event.key === 'ArrowLeft') spherical.theta -= 0.12;
    if (event.key === 'ArrowRight') spherical.theta += 0.12;
    if (event.key === 'ArrowUp') spherical.phi -= 0.12;
    if (event.key === 'ArrowDown') spherical.phi += 0.12;
    if (event.key === '+' || event.key === '=') spherical.radius *= 0.9;
    if (event.key === '-') spherical.radius *= 1.1;
    spherical.makeSafe();
    spherical.radius = Math.min(680, Math.max(70, spherical.radius));
    this.camera.position.copy(this.controls.target).add(new THREE.Vector3().setFromSpherical(spherical));
    this.controls.update();
  };

  dispose() {
    this.disposed = true; cancelAnimationFrame(this.frame); this.observer.disconnect(); this.controls.dispose();
    this.scene.traverse(object => {
      const item = object as THREE.Mesh;
      item.geometry?.dispose();
      if (item.material) for (const material of Array.isArray(item.material) ? item.material : [item.material]) {
        (material as THREE.SpriteMaterial).map?.dispose(); material.dispose();
      }
    });
    this.renderer.domElement.removeEventListener('pointerdown', this.onPointerDown);
    this.renderer.domElement.removeEventListener('click', this.onClick);
    this.renderer.domElement.removeEventListener('keydown', this.onKeyDown);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.onContextLost);
    this.renderer.dispose(); this.renderer.domElement.remove();
  }
}
