import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createSimulation, update, setGateOpening, setWeather, setSeason, startCooling, getAlertMessages, exportCSV, setDispatchMode, repairTurbine, clearPipeBlockage, predictForward, getDeviationImpact, startDrill, stopDrill, getDrillStatus, getFaultLog, applyDispatchPlan, getActiveFaults, exportDrillReportCSV, DISPATCH_PLANS } from './simulation.js';
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
controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.PAN };
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
  if (viewTransition >= 1) { viewTransition = 1; isTransitioning = false; }
  const t = easeInOutCubic(viewTransition);
  let fromPos, toPos;
  if (currentView === 'internal') { fromPos = externalCameraPos; toPos = internalCameraPos; }
  else { fromPos = internalCameraPos; toPos = externalCameraPos; }
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

function easeInOutCubic(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

function switchView(view) {
  if (currentView === view && !isTransitioning) return;
  currentView = view;
  isTransitioning = true;
  viewTransition = 0;
  controls.enabled = view !== 'internal';
}

const modeLabels = { auto: '自动发电', storage: '蓄水', flood: '防洪' };

const {
  updateDisplay, showAlert, renderCharts,
  updatePrediction, updateDeviationImpact, updateDrillPanel, updateFaultLog,
  updateFaultTodoCards, updatePlanInfo, showReportOverlay, setWeatherUI, setModeUI,
  getCurrentMode
} = initUI({
  onGateChange: (val) => {
    setGateOpening(sim, val);
    const deviation = getDeviationImpact(sim, val);
    updateDeviationImpact(deviation);
  },
  onWeatherChange: (w) => { setWeather(sim, w); setSkyColor(scene, w); },
  onSeasonChange: (s) => setSeason(sim, s),
  onViewChange: (v) => switchView(v),
  onDispatchChange: (mode) => {
    setDispatchMode(sim, mode);
    manualGateOverride = false;
  },
  onCoolDown: () => startCooling(sim),
  onRepairTurbine: () => repairTurbine(sim),
  onClearPipe: () => clearPipeBlockage(sim),
  onStartDrill: (mode) => {
    startDrill(sim, mode);
    if (mode === 'flashFlood') {
      setSkyColor(scene, 'rain');
      setWeatherUI('rain', 'rainy');
      setModeUI('auto');
    }
    if (mode === 'unitFailure') {
      setWeatherUI('sunny', 'rainy');
      setModeUI('auto');
    }
    if (mode === 'emergencySpill') {
      setSkyColor(scene, 'sunny');
      setWeatherUI('sunny', 'dry');
      setModeUI('flood');
    }
  },
  onStopDrill: () => {
    const report = stopDrill(sim);
    if (report) {
      showReportOverlay(report);
    }
  },
  onApplyPlan: (planId) => {
    const result = applyDispatchPlan(sim, planId);
    if (result) {
      updatePlanInfo(result);
      const { plan } = result;
      setModeUI(plan.mode);
      setWeatherUI(plan.weather, plan.season);
      if (plan.weather === 'rain') setSkyColor(scene, 'rain');
      else setSkyColor(scene, 'sunny');
    }
  },
  onExportReport: (report) => {
    const csv = exportDrillReportCSV(report);
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const modeLabels = { flashFlood: '暴雨洪峰', unitFailure: '机组故障', emergencySpill: '紧急泄洪' };
    const modeLabel = modeLabels[report.drillMode] || '演练';
    link.download = `演练复盘报告_${modeLabel}_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showAlert({ type: 'info', text: '✅ 演练复盘报告已导出为 CSV 文件！' });
  },
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

let manualGateOverride = false;
let lastTime = performance.now();
let predictionTimer = 0;

function animate() {
  requestAnimationFrame(animate);
  const now = performance.now();
  let dt = (now - lastTime) / 1000;
  lastTime = now;
  if (dt > 0.5) dt = 0.016;

  update(sim, dt);
  animateCamera();
  if (controls.enabled) controls.update();
  updateScene(sceneObjects, sim, dt, currentView === 'internal');

  updateDisplay(sim);

  predictionTimer += dt;
  if (predictionTimer > 0.5) {
    predictionTimer = 0;
    const pred = predictForward(sim, 60, sim.dispatchMode);
    updatePrediction({
      mode: sim.dispatchMode,
      modeLabel: modeLabels[sim.dispatchMode],
      waterLevel: pred.waterLevel,
      flowRate: pred.flowRate,
      power: pred.power,
      spillwayOpen: pred.spillwayOpen
    });
  }

  const drillStatus = getDrillStatus(sim);
  updateDrillPanel(drillStatus);

  const faultLog = getFaultLog(sim);
  updateFaultLog(faultLog);

  const activeFaults = getActiveFaults(sim);
  updateFaultTodoCards(activeFaults, faultLog);

  const alerts = getAlertMessages(sim);
  alerts.forEach(a => showAlert(a));

  renderCharts(sim.chartHistory);
  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
});

animate();