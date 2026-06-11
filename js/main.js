import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createSimulation, update, setGateOpening, setWeather, setSeason, startCooling, getAlertMessages, exportCSV } from './simulation.js';
import { createScene, updateScene, setSkyColor } from './scene.js';
import { initUI } from './ui.js';

const container = document.getElementById('canvas-container');
const { scene, camera, renderer, sceneObjects } = createScene(container);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 5, -2);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 5;
controls.maxDistance = 45;
controls.maxPolarAngle = Math.PI * 0.45;
controls.minPolarAngle = 0.2;
controls.mouseButtons = {
  LEFT: THREE.MOUSE.ROTATE,
  MIDDLE: THREE.MOUSE.PAN,
  RIGHT: THREE.MOUSE.PAN
};
controls.update();

const sim = createSimulation();

const externalCameraPos = { x: 20, y: 12, z: 18, targetX: 0, targetY: 5, targetZ: -2 };
const internalCameraPos = { x: 0, y: 3.5, z: -2, targetX: 0, targetY: 4, targetZ: -1.5 };
let currentView = 'external';
let viewTransition = 0;
let isTransitioning = false;

function animateCamera() {
  if (!isTransitioning) return;

  viewTransition += 0.025;
  if (viewTransition >= 1) {
    viewTransition = 1;
    isTransitioning = false;
  }

  const t = easeInOutCubic(viewTransition);
  let fromPos, toPos;

  if (currentView === 'internal') {
    fromPos = externalCameraPos;
    toPos = internalCameraPos;
  } else {
    fromPos = internalCameraPos;
    toPos = externalCameraPos;
  }

  const cx = fromPos.x + (toPos.x - fromPos.x) * t;
  const cy = fromPos.y + (toPos.y - fromPos.y) * t;
  const cz = fromPos.z + (toPos.z - fromPos.z) * t;
  const tx = fromPos.targetX + (toPos.targetX - fromPos.targetX) * t;
  const ty = fromPos.targetY + (toPos.targetY - fromPos.targetY) * t;
  const tz = fromPos.targetZ + (toPos.targetZ - fromPos.targetZ) * t;

  camera.position.set(cx, cy, cz);
  controls.target.set(tx, ty, tz);
  controls.update();
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function switchView(view) {
  if (currentView === view && !isTransitioning) return;
  currentView = view;
  isTransitioning = true;
  viewTransition = 0;

  if (view === 'internal') {
    controls.enabled = false;
  } else {
    controls.enabled = true;
  }
}

const { updateDisplay, showAlert } = initUI({
  onGateChange: (val) => setGateOpening(sim, val),
  onWeatherChange: (w) => {
    setWeather(sim, w);
    setSkyColor(scene, w);
  },
  onSeasonChange: (s) => setSeason(sim, s),
  onViewChange: (v) => switchView(v),
  onCoolDown: () => startCooling(sim),
  onExport: () => {
    const csv = exportCSV(sim);
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `水电运行数据_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showAlert({ type: 'info', text: '✅ 运行数据已导出为 CSV 文件！' });
  }
});

let lastTime = performance.now();
let frameAccum = 0;
let frameCount = 0;

function animate() {
  requestAnimationFrame(animate);

  const now = performance.now();
  let dt = (now - lastTime) / 1000;
  lastTime = now;

  if (dt > 0.5) dt = 0.016;

  update(sim, dt);

  animateCamera();

  if (controls.enabled) {
    controls.update();
  }

  updateScene(sceneObjects, sim, dt, currentView === 'internal');

  updateDisplay(sim);

  const alerts = getAlertMessages(sim);
  alerts.forEach(a => showAlert(a));

  renderer.render(scene, camera);

  frameAccum += dt;
  frameCount++;
  if (frameAccum >= 0.3) {
    const fps = Math.round(frameCount / frameAccum);
    frameAccum = 0;
    frameCount = 0;
  }
}

window.addEventListener('resize', () => {
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
});

animate();