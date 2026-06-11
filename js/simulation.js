const MAX_WATER_LEVEL = 10.0;
const WARNING_LEVEL = 8.0;
const CRITICAL_LEVEL = 9.0;
const RESERVOIR_AREA = 6000;
const BASE_INFLOW = 50;
const MAX_GATE_FLOW = 100;
const SPILLWAY_COEFF = 40;
const SPILLWAY_FLOOD_COEFF = 70;
const MAX_RPM = 500;
const MAX_POWER_MW = 700;
const NORMAL_TEMP = 40;
const OVERHEAT_TEMP = 100;
const COOL_RATE = 10;
const AMBIENT_TEMP = 25;

export function createSimulation() {
  return {
    waterLevel: 6.0,
    gateOpening: 0.5,
    manualGateOverride: false,
    weather: 'sunny',
    season: 'rainy',
    turbineSpeed: 0,
    powerOutput: 0,
    flowRate: 0,
    temperature: NORMAL_TEMP,
    isOverheating: false,
    spillwayOpen: false,
    spillwayFlow: 0,
    cooling: false,
    history: [],
    chartHistory: [],
    time: 0,
    lastHistoryTime: 0,
    spillwayAlertSent: false,
    overheatAlertSent: false,
    alertMessages: [],

    dispatchMode: 'auto',
    recommendedGate: 0.6,
    recommendedSpillway: 0,

    faults: {
      turbineSeizure: { active: false, detectedAt: 0, alertSent: false },
      pipeBlockage: { active: false, detectedAt: 0, alertSent: false },
      generatorOverheat: { active: false, detectedAt: 0, alertSent: false }
    },

    faultTriggerTimers: { turbineSeizure: 0, pipeBlockage: 0 },
    reservoirInflow: BASE_INFLOW,

    drillMode: null,
    drillStartTime: 0,
    drillGoals: [],
    drillCompleted: false,

    faultLog: []
  };
}

export function update(sim, dt) {
  if (dt > 0.5) dt = 0.5;
  sim.time += dt;

  let inflow = BASE_INFLOW;
  if (sim.weather === 'rain') inflow *= 3.5;
  if (sim.season === 'rainy') inflow *= 1.8;
  else inflow *= 0.4;
  if (sim.weather === 'rain' && sim.season === 'rainy') inflow *= 1.8;
  sim.reservoirInflow = inflow;

  if (!sim.manualGateOverride) {
    applyDispatchMode(sim);
  }

  if (sim.drillMode) {
    checkDrillGoals(sim);
  }

  let effectiveGateOpening = sim.gateOpening;
  if (sim.faults.pipeBlockage.active) {
    effectiveGateOpening *= 0.3;
  }

  const gateFlow = effectiveGateOpening * MAX_GATE_FLOW;

  let spillFlow = 0;
  const spillThreshold = sim.dispatchMode === 'flood' ? WARNING_LEVEL - 2 : WARNING_LEVEL;
  const effectiveSpillCoeff = sim.dispatchMode === 'flood' ? SPILLWAY_FLOOD_COEFF : SPILLWAY_COEFF;

  if (sim.waterLevel > spillThreshold) {
    spillFlow = (sim.waterLevel - spillThreshold) * effectiveSpillCoeff;
    sim.spillwayOpen = true;
  } else {
    sim.spillwayOpen = false;
  }

  const totalOutflow = gateFlow + spillFlow;
  const dvdt = inflow - totalOutflow;
  sim.waterLevel += (dvdt / RESERVOIR_AREA) * dt;

  if (sim.waterLevel < 0.5) sim.waterLevel = 0.5;
  if (sim.waterLevel > MAX_WATER_LEVEL) sim.waterLevel = MAX_WATER_LEVEL;

  sim.flowRate = gateFlow;
  sim.spillwayFlow = spillFlow;

  let targetRPM = (gateFlow / MAX_GATE_FLOW) * MAX_RPM;
  if (sim.faults.turbineSeizure.active) targetRPM = targetRPM * 0.05;

  const rpmSmooth = sim.faults.turbineSeizure.active ? 1.0 : 3.0;
  sim.turbineSpeed += (targetRPM - sim.turbineSpeed) * rpmSmooth * dt;
  if (sim.turbineSpeed < 0) sim.turbineSpeed = 0;

  sim.powerOutput = (sim.turbineSpeed / MAX_RPM) * MAX_POWER_MW;

  if (sim.cooling) {
    sim.temperature -= COOL_RATE * dt;
    if (sim.temperature <= NORMAL_TEMP) {
      sim.temperature = NORMAL_TEMP;
      sim.cooling = false;
    }
    if (sim.faults.generatorOverheat.active && sim.temperature < OVERHEAT_TEMP * 0.8) {
      resolveFault(sim, 'generatorOverheat');
      sim.isOverheating = false;
    }
  } else {
    if (sim.powerOutput > 0 && !sim.faults.generatorOverheat.active) {
      const heatGen = sim.powerOutput * 0.08;
      const heatLoss = (sim.temperature - AMBIENT_TEMP) * 0.02;
      sim.temperature += (heatGen - heatLoss) * dt;
    } else if (sim.faults.generatorOverheat.active) {
      sim.temperature += 1.5 * dt;
    } else {
      if (sim.temperature > AMBIENT_TEMP) {
        sim.temperature -= (sim.temperature - AMBIENT_TEMP) * 0.05 * dt;
      }
    }
  }

  if (sim.temperature > OVERHEAT_TEMP && !sim.faults.generatorOverheat.active) {
    sim.faults.generatorOverheat.active = true;
    sim.faults.generatorOverheat.detectedAt = sim.time;
    sim.faults.generatorOverheat.alertSent = false;
    sim.isOverheating = true;
    addFaultLogEntry(sim, 'generatorOverheat', 'triggered');
  }
  if (sim.faults.generatorOverheat.active) {
    sim.isOverheating = true;
    sim.powerOutput *= 0.5;
  }

  updateFaultTriggers(sim, dt);
  checkAlerts(sim);
  recordHistory(sim);
}

function resolveFault(sim, faultName) {
  sim.faults[faultName].active = false;
  sim.faults[faultName].alertSent = false;
  sim.faultTriggerTimers[faultName] = 0;
  addFaultLogEntry(sim, faultName, 'resolved');
}

function addFaultLogEntry(sim, faultName, event) {
  const nameMap = {
    turbineSeizure: '水轮机卡滞',
    pipeBlockage: '输水管堵塞',
    generatorOverheat: '发电机过热'
  };
  sim.faultLog.push({
    fault: faultName,
    label: nameMap[faultName],
    event,
    time: sim.time
  });
}

function applyDispatchMode(sim) {
  switch (sim.dispatchMode) {
    case 'auto':
      sim.recommendedGate = 0.55 + Math.sin(sim.time * 0.03) * 0.05;
      sim.recommendedSpillway = 0;
      sim.gateOpening += (sim.recommendedGate - sim.gateOpening) * 0.03;
      break;
    case 'storage':
      sim.recommendedGate = 0.05;
      sim.recommendedSpillway = 0;
      sim.gateOpening += (sim.recommendedGate - sim.gateOpening) * 0.06;
      break;
    case 'flood':
      sim.recommendedGate = 1.0;
      sim.recommendedSpillway = 1;
      sim.gateOpening += (sim.recommendedGate - sim.gateOpening) * 0.1;
      break;
  }
  sim.gateOpening = Math.max(0, Math.min(1, sim.gateOpening));
}

function updateFaultTriggers(sim, dt) {
  if (!sim.faults.turbineSeizure.active) {
    sim.faultTriggerTimers.turbineSeizure += dt;
    if (sim.turbineSpeed > 200 && sim.faultTriggerTimers.turbineSeizure > 40) {
      if (Math.random() < 0.004) {
        sim.faults.turbineSeizure.active = true;
        sim.faults.turbineSeizure.detectedAt = sim.time;
        sim.faults.turbineSeizure.alertSent = false;
        sim.faultTriggerTimers.turbineSeizure = 0;
        addFaultLogEntry(sim, 'turbineSeizure', 'triggered');
      }
    }
  }

  if (!sim.faults.pipeBlockage.active) {
    sim.faultTriggerTimers.pipeBlockage += dt;
    if (sim.flowRate > 50 && sim.faultTriggerTimers.pipeBlockage > 50) {
      if (Math.random() < 0.003) {
        sim.faults.pipeBlockage.active = true;
        sim.faults.pipeBlockage.detectedAt = sim.time;
        sim.faults.pipeBlockage.alertSent = false;
        sim.faultTriggerTimers.pipeBlockage = 0;
        addFaultLogEntry(sim, 'pipeBlockage', 'triggered');
      }
    }
  }
}

function checkAlerts(sim) {
  const faultAlertPairs = [
    { fault: 'turbineSeizure', text: '🔧 故障：水轮机卡滞！转速骤降，请点击「维修水轮机」！' },
    { fault: 'pipeBlockage', text: '🚧 故障：输水管堵塞！流量大幅降低，请点击「疏通管道」！' },
    { fault: 'generatorOverheat', text: '🔥 故障：发电机过热！功率减半，请点击「冷却发电机」！' }
  ];

  faultAlertPairs.forEach(({ fault, text }) => {
    if (sim.faults[fault].active && !sim.faults[fault].alertSent) {
      sim.alertMessages.push({ type: 'danger', text, id: Date.now() });
      sim.faults[fault].alertSent = true;
    }
  });

  if (sim.waterLevel > CRITICAL_LEVEL && !sim.spillwayAlertSent) {
    sim.alertMessages.push({ type: 'danger', text: '🌊 危险：水位超警戒线！泄洪道已开启！', id: Date.now() });
    sim.spillwayAlertSent = true;
  }
  if (sim.waterLevel <= CRITICAL_LEVEL) sim.spillwayAlertSent = false;
}

function recordHistory(sim) {
  if (sim.time - sim.lastHistoryTime >= 1.0) {
    const entry = {
      time: sim.time,
      power: sim.powerOutput,
      waterLevel: sim.waterLevel,
      flowRate: sim.flowRate,
      temperature: sim.temperature,
      weather: sim.weather,
      season: sim.season,
      dispatchMode: sim.dispatchMode,
      spillwayOpen: sim.spillwayOpen
    };
    sim.history.push(entry);
    sim.chartHistory.push(entry);
    sim.lastHistoryTime = sim.time;
    if (sim.history.length > 3600) sim.history.shift();
    if (sim.chartHistory.length > 120) sim.chartHistory.shift();
  }
}

export function setGateOpening(sim, value) {
  sim.gateOpening = Math.max(0, Math.min(1, value));
  sim.manualGateOverride = true;
}

export function setDispatchMode(sim, mode) {
  sim.dispatchMode = mode;
  sim.manualGateOverride = false;
  switch (mode) {
    case 'auto': sim.recommendedGate = 0.55; break;
    case 'storage': sim.recommendedGate = 0.05; break;
    case 'flood': sim.recommendedGate = 1.0; break;
  }
}

export function setWeather(sim, weather) { sim.weather = weather; }
export function setSeason(sim, season) { sim.season = season; }

export function startCooling(sim) {
  if (sim.temperature > NORMAL_TEMP) sim.cooling = true;
}

export function repairTurbine(sim) {
  if (sim.faults.turbineSeizure.active) {
    resolveFault(sim, 'turbineSeizure');
    sim.alertMessages.push({ type: 'info', text: '✅ 水轮机已维修完成，恢复正常运行！', id: Date.now() });
  }
}

export function clearPipeBlockage(sim) {
  if (sim.faults.pipeBlockage.active) {
    resolveFault(sim, 'pipeBlockage');
    sim.alertMessages.push({ type: 'info', text: '✅ 输水管道已疏通，流量恢复正常！', id: Date.now() });
  }
}

export function predictForward(sim, seconds, mode) {
  let level = sim.waterLevel;
  let gate = sim.gateOpening;
  let inflow = sim.reservoirInflow;
  let dt = 0.5;
  let steps = Math.floor(seconds / dt);

  let predictedGate = gate;
  if (mode === 'auto') predictedGate = 0.55;
  else if (mode === 'storage') predictedGate = 0.05;
  else if (mode === 'flood') predictedGate = 1.0;

  let effectiveGate = predictedGate;
  if (sim.faults.pipeBlockage.active) effectiveGate *= 0.3;

  let gateFlow = effectiveGate * MAX_GATE_FLOW;
  let spillFlow = 0;
  let spillThreshold = (mode === 'flood') ? WARNING_LEVEL - 2 : WARNING_LEVEL;
  let spillCoeff = (mode === 'flood') ? SPILLWAY_FLOOD_COEFF : SPILLWAY_COEFF;

  for (let i = 0; i < steps; i++) {
    if (level > spillThreshold) {
      spillFlow = (level - spillThreshold) * spillCoeff;
    } else {
      spillFlow = 0;
    }
    let totalOut = gateFlow + spillFlow;
    level += ((inflow - totalOut) / RESERVOIR_AREA) * dt;
    if (level < 0.5) level = 0.5;
    if (level > MAX_WATER_LEVEL) level = MAX_WATER_LEVEL;

    gateFlow = effectiveGate * MAX_GATE_FLOW;
    if (sim.faults.turbineSeizure.active) {
      // prediction accounts for fault
    }
  }

  let predictedRPM = (gateFlow / MAX_GATE_FLOW) * MAX_RPM;
  if (sim.faults.turbineSeizure.active) predictedRPM *= 0.05;
  let predictedPower = (predictedRPM / MAX_RPM) * MAX_POWER_MW;

  return {
    waterLevel: level,
    flowRate: gateFlow,
    power: predictedPower,
    spillwayFlow: spillFlow,
    spillwayOpen: level > spillThreshold
  };
}

export function getDeviationImpact(sim, currentGate) {
  const recommended = sim.recommendedGate;
  const diff = currentGate - recommended;

  let predicted = predictForward(sim, 60, sim.dispatchMode);
  let recommendedPredicted = predictForward(sim, 60, sim.dispatchMode);

  let impact = '';
  if (diff > 0.2) {
    impact = `闸门偏大 ${(diff*100).toFixed(0)}%，预计水位下降加快，发电功率偏高`;
  } else if (diff < -0.1) {
    impact = `闸门偏小 ${(Math.abs(diff)*100).toFixed(0)}%，水位可能上升，功率不足`;
  } else if (Math.abs(diff) > 0.05) {
    impact = `闸门略有偏差 ${(diff>0?'+':'')+(diff*100).toFixed(0)}%`;
  }

  return {
    predicted,
    recommendedPredicted,
    impact,
    gateDiff: diff
  };
}

export function startDrill(sim, mode) {
  sim.drillMode = mode;
  sim.drillStartTime = sim.time;
  sim.drillCompleted = false;
  sim.faultLog = [];
  sim.alertMessages = [];

  switch (mode) {
    case 'flashFlood':
      sim.weather = 'rain';
      sim.season = 'rainy';
      sim.waterLevel = 7.2;
      sim.gateOpening = 0.4;
      sim.dispatchMode = 'auto';
      sim.manualGateOverride = false;
      sim.drillGoals = [
        { label: '水位超过警戒线（8m）', key: 'waterCrossWarning', done: false },
        { label: '泄洪道自动开启', key: 'spillwayActivated', done: false },
        { label: '切换到防洪模式', key: 'floodModeActivated', done: false },
        { label: '水位回落至安全线以下（<8m）', key: 'waterBackSafe', done: false }
      ];
      sim.alertMessages.push({ type: 'info', text: '🎯 演练开始：暴雨洪峰来袭，请观察水位变化，及时切换到防洪模式！', id: Date.now() });
      break;

    case 'unitFailure':
      sim.weather = 'sunny';
      sim.season = 'rainy';
      sim.waterLevel = 6.0;
      sim.gateOpening = 0.7;
      sim.dispatchMode = 'auto';
      sim.manualGateOverride = false;
      sim.temperature = 105;
      sim.faults.turbineSeizure.active = true;
      sim.faults.turbineSeizure.detectedAt = sim.time;
      sim.faultTriggerTimers.turbineSeizure = 0;
      sim.faults.pipeBlockage.active = true;
      sim.faults.pipeBlockage.detectedAt = sim.time;
      sim.faultTriggerTimers.pipeBlockage = 0;
      sim.faults.generatorOverheat.active = true;
      sim.faults.generatorOverheat.detectedAt = sim.time;
      sim.isOverheating = true;
      addFaultLogEntry(sim, 'turbineSeizure', 'triggered');
      addFaultLogEntry(sim, 'pipeBlockage', 'triggered');
      addFaultLogEntry(sim, 'generatorOverheat', 'triggered');
      sim.drillGoals = [
        { label: '维修水轮机卡滞故障', key: 'turbineFixed', done: false },
        { label: '疏通输水管堵塞', key: 'pipeFixed', done: false },
        { label: '处理发电机过热（温度<80°C）', key: 'tempRecovered', done: false },
        { label: '功率恢复至安全范围（>200MW）', key: 'powerRestored', done: false }
      ];
      sim.alertMessages.push({ type: 'info', text: '🎯 演练开始：机组多重故障，请依次维修水轮机、疏通管道、冷却发电机！', id: Date.now() });
      break;

    case 'emergencySpill':
      sim.weather = 'sunny';
      sim.season = 'dry';
      sim.waterLevel = 8.5;
      sim.gateOpening = 1.0;
      sim.dispatchMode = 'flood';
      sim.manualGateOverride = false;
      sim.drillGoals = [
        { label: '泄洪道已开启', key: 'spillwayOpen', done: false },
        { label: '水位降至警戒线以下（<8m）', key: 'waterBelowWarning', done: false },
        { label: '水位稳定在安全范围（<7m）', key: 'waterStable', done: false }
      ];
      sim.alertMessages.push({ type: 'info', text: '🎯 演练开始：紧急泄洪！水位已超警戒，泄洪道全开，请观察泄洪效果！', id: Date.now() });
      break;
  }
}

export function stopDrill(sim) {
  if (!sim.drillMode) return;
  sim.alertMessages.push({ type: 'info', text: sim.drillCompleted ? '🏆 演练完成！所有目标已达成。' : '⏹️ 演练已手动终止。', id: Date.now() });
  sim.drillMode = null;
  sim.drillGoals = [];
  sim.drillCompleted = false;
}

function checkDrillGoals(sim) {
  let allDone = true;

  sim.drillGoals.forEach(goal => {
    if (goal.done) return;

    switch (goal.key) {
      case 'waterCrossWarning':
        goal.done = sim.waterLevel > WARNING_LEVEL;
        break;
      case 'spillwayActivated':
      case 'spillwayOpen':
        goal.done = sim.spillwayOpen;
        break;
      case 'floodModeActivated':
        goal.done = sim.dispatchMode === 'flood';
        break;
      case 'waterBackSafe':
      case 'waterBelowWarning':
        goal.done = sim.waterLevel < WARNING_LEVEL && sim.drillGoals.find(g => g.key === 'spillwayActivated' || g.key === 'spillwayOpen')?.done;
        break;
      case 'waterStable':
        goal.done = sim.waterLevel < 7.0;
        break;
      case 'turbineFixed':
        goal.done = !sim.faults.turbineSeizure.active;
        break;
      case 'pipeFixed':
        goal.done = !sim.faults.pipeBlockage.active;
        break;
      case 'tempRecovered':
        goal.done = sim.temperature < 80;
        break;
      case 'powerRestored':
        goal.done = sim.powerOutput > 200;
        break;
    }
    if (!goal.done) allDone = false;
  });

  if (allDone && !sim.drillCompleted) {
    sim.drillCompleted = true;
    sim.alertMessages.push({ type: 'info', text: '🏆 演练完成！所有目标已达成！', id: Date.now() });
  }
}

export function getDrillStatus(sim) {
  if (!sim.drillMode) return null;
  const elapsed = sim.time - sim.drillStartTime;
  const doneCount = sim.drillGoals.filter(g => g.done).length;
  const totalCount = sim.drillGoals.length;
  return {
    mode: sim.drillMode,
    elapsed,
    goals: sim.drillGoals,
    doneCount,
    totalCount,
    completed: sim.drillCompleted
  };
}

export function getFaultLog(sim) {
  return sim.faultLog;
}

export function getAlertMessages(sim) {
  const msgs = [...sim.alertMessages];
  sim.alertMessages = [];
  return msgs;
}

export function exportCSV(sim) {
  const headers = '时间(s),功率(MW),水位(m),流量(m³/s),温度(°C),天气,季节,调度模式,泄洪';
  const rows = sim.history.map(h =>
    `${h.time.toFixed(1)},${h.power.toFixed(2)},${h.waterLevel.toFixed(2)},${h.flowRate.toFixed(2)},${h.temperature.toFixed(1)},${h.weather},${h.season},${h.dispatchMode},${h.spillwayOpen ? '是' : '否'}`
  );
  return [headers, ...rows].join('\n');
}