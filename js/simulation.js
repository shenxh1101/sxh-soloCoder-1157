const MAX_WATER_LEVEL = 10.0;
const WARNING_LEVEL = 8.0;
const CRITICAL_LEVEL = 9.0;
const RESERVOIR_AREA = 400000;
const BASE_INFLOW = 50;
const MAX_GATE_FLOW = 100;
const SPILLWAY_COEFF = 35;
const SPILLWAY_FLOOD_COEFF = 60;
const MAX_RPM = 500;
const MAX_POWER_MW = 700;
const NORMAL_TEMP = 40;
const OVERHEAT_TEMP = 100;
const HEAT_RATE_MW = 0.08;
const COOL_RATE = 8;
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

    faultTriggerTimers: {
      turbineSeizure: 0,
      pipeBlockage: 0
    },

    reservoirInflow: BASE_INFLOW
  };
}

export function update(sim, dt) {
  if (dt > 0.5) dt = 0.5;
  sim.time += dt;

  let inflow = BASE_INFLOW;
  if (sim.weather === 'rain') inflow *= 3.0;
  if (sim.season === 'rainy') inflow *= 1.5;
  else inflow *= 0.5;
  if (sim.weather === 'rain' && sim.season === 'rainy') inflow *= 1.5;
  sim.reservoirInflow = inflow;

  if (!sim.manualGateOverride) {
    applyDispatchMode(sim);
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

  if (sim.faults.turbineSeizure.active) {
    targetRPM = targetRPM * 0.05;
  }

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
  } else {
    if (sim.powerOutput > 0 && !sim.faults.generatorOverheat.active) {
      const heatGen = sim.powerOutput * HEAT_RATE_MW;
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
  }
  if (sim.faults.generatorOverheat.active) {
    sim.isOverheating = true;
    sim.powerOutput *= 0.5;
  }
  if (!sim.faults.generatorOverheat.active && sim.temperature <= NORMAL_TEMP) {
    sim.isOverheating = false;
  }

  updateFaultTriggers(sim, dt);

  checkAlerts(sim);

  recordHistory(sim);
}

function applyDispatchMode(sim) {
  switch (sim.dispatchMode) {
    case 'auto':
      sim.recommendedGate = 0.55 + Math.sin(sim.time * 0.05) * 0.05;
      sim.recommendedSpillway = 0;
      sim.gateOpening += (sim.recommendedGate - sim.gateOpening) * 0.03;
      break;
    case 'storage':
      sim.recommendedGate = 0.1;
      sim.recommendedSpillway = 0;
      sim.gateOpening += (sim.recommendedGate - sim.gateOpening) * 0.05;
      break;
    case 'flood':
      sim.recommendedGate = 1.0;
      sim.recommendedSpillway = 1;
      sim.gateOpening += (sim.recommendedGate - sim.gateOpening) * 0.08;
      break;
  }
  sim.gateOpening = Math.max(0, Math.min(1, sim.gateOpening));
}

function updateFaultTriggers(sim, dt) {
  if (!sim.faults.turbineSeizure.active) {
    sim.faultTriggerTimers.turbineSeizure += dt;
    if (sim.turbineSpeed > 250 && sim.faultTriggerTimers.turbineSeizure > 45) {
      if (Math.random() < 0.003) {
        sim.faults.turbineSeizure.active = true;
        sim.faults.turbineSeizure.detectedAt = sim.time;
        sim.faults.turbineSeizure.alertSent = false;
        sim.faultTriggerTimers.turbineSeizure = 0;
      }
    }
  }

  if (!sim.faults.pipeBlockage.active) {
    sim.faultTriggerTimers.pipeBlockage += dt;
    if (sim.flowRate > 60 && sim.faultTriggerTimers.pipeBlockage > 60) {
      if (Math.random() < 0.002) {
        sim.faults.pipeBlockage.active = true;
        sim.faults.pipeBlockage.detectedAt = sim.time;
        sim.faults.pipeBlockage.alertSent = false;
        sim.faultTriggerTimers.pipeBlockage = 0;
      }
    }
  }
}

function checkAlerts(sim) {
  if (sim.faults.turbineSeizure.active && !sim.faults.turbineSeizure.alertSent) {
    sim.alertMessages.push({
      type: 'danger',
      text: '🔧 故障：水轮机卡滞！转速骤降，请点击「维修水轮机」！',
      id: Date.now()
    });
    sim.faults.turbineSeizure.alertSent = true;
  }

  if (sim.faults.pipeBlockage.active && !sim.faults.pipeBlockage.alertSent) {
    sim.alertMessages.push({
      type: 'danger',
      text: '🚧 故障：输水管堵塞！流量大幅降低，请点击「疏通管道」！',
      id: Date.now()
    });
    sim.faults.pipeBlockage.alertSent = true;
  }

  if (sim.faults.generatorOverheat.active && !sim.faults.generatorOverheat.alertSent) {
    sim.alertMessages.push({
      type: 'danger',
      text: '🔥 故障：发电机过热！功率减半，请点击「冷却发电机」！',
      id: Date.now()
    });
    sim.faults.generatorOverheat.alertSent = true;
  }

  if (sim.waterLevel > CRITICAL_LEVEL && !sim.spillwayAlertSent) {
    sim.alertMessages.push({
      type: 'danger',
      text: '🌊 危险：水位超警戒线！泄洪道已开启！',
      id: Date.now()
    });
    sim.spillwayAlertSent = true;
  }
  if (sim.waterLevel <= CRITICAL_LEVEL) {
    sim.spillwayAlertSent = false;
  }
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
      dispatchMode: sim.dispatchMode
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
    case 'storage': sim.recommendedGate = 0.1; break;
    case 'flood': sim.recommendedGate = 1.0; break;
  }
}

export function markManualOverride(sim) {
  sim.manualGateOverride = true;
}

export function setWeather(sim, weather) {
  sim.weather = weather;
}

export function setSeason(sim, season) {
  sim.season = season;
}

export function startCooling(sim) {
  if (sim.temperature > NORMAL_TEMP) {
    sim.cooling = true;
  }
  if (sim.faults.generatorOverheat.active && sim.temperature < OVERHEAT_TEMP * 0.8) {
    sim.faults.generatorOverheat.active = false;
    sim.isOverheating = false;
  }
}

export function repairTurbine(sim) {
  if (sim.faults.turbineSeizure.active) {
    sim.faults.turbineSeizure.active = false;
    sim.faultTriggerTimers.turbineSeizure = 0;
    sim.alertMessages.push({
      type: 'info',
      text: '✅ 水轮机已维修完成，恢复正常运行！',
      id: Date.now()
    });
  }
}

export function clearPipeBlockage(sim) {
  if (sim.faults.pipeBlockage.active) {
    sim.faults.pipeBlockage.active = false;
    sim.faultTriggerTimers.pipeBlockage = 0;
    sim.alertMessages.push({
      type: 'info',
      text: '✅ 输水管道已疏通，流量恢复正常！',
      id: Date.now()
    });
  }
}

export function getAlertMessages(sim) {
  const msgs = [...sim.alertMessages];
  sim.alertMessages = [];
  return msgs;
}

export function exportCSV(sim) {
  const headers = '时间(s),功率(MW),水位(m),流量(m³/s),温度(°C),天气,季节,调度模式';
  const rows = sim.history.map(h =>
    `${h.time.toFixed(1)},${h.power.toFixed(2)},${h.waterLevel.toFixed(2)},${h.flowRate.toFixed(2)},${h.temperature.toFixed(1)},${h.weather},${h.season},${h.dispatchMode}`
  );
  return [headers, ...rows].join('\n');
}