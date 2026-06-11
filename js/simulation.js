const MAX_WATER_LEVEL = 10.0;
const WARNING_LEVEL = 8.0;
const CRITICAL_LEVEL = 9.0;
const RESERVOIR_AREA = 500000;
const BASE_INFLOW = 50;
const MAX_GATE_FLOW = 100;
const SPILLWAY_COEFF = 25;
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
    time: 0,
    lastHistoryTime: 0,
    spillwayAlertSent: false,
    overheatAlertSent: false,
    alertMessages: []
  };
}

export function update(sim, dt) {
  if (dt > 0.5) dt = 0.5;

  sim.time += dt;

  let inflow = BASE_INFLOW;

  if (sim.weather === 'rain') {
    inflow *= 3.0;
  }

  if (sim.season === 'rainy') {
    inflow *= 1.5;
  } else {
    inflow *= 0.5;
  }

  if (sim.weather === 'rain' && sim.season === 'rainy') {
    inflow *= 1.2;
  }

  const gateFlow = sim.gateOpening * MAX_GATE_FLOW;

  let spillFlow = 0;
  if (sim.waterLevel > WARNING_LEVEL) {
    spillFlow = (sim.waterLevel - WARNING_LEVEL) * SPILLWAY_COEFF;
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

  const targetRPM = (gateFlow / MAX_GATE_FLOW) * MAX_RPM;
  const rpmSmooth = 3.0;
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
    if (sim.powerOutput > 0) {
      const heatGen = sim.powerOutput * HEAT_RATE_MW;
      const heatLoss = (sim.temperature - AMBIENT_TEMP) * 0.02;
      sim.temperature += (heatGen - heatLoss) * dt;
    } else {
      if (sim.temperature > AMBIENT_TEMP) {
        sim.temperature -= (sim.temperature - AMBIENT_TEMP) * 0.05 * dt;
      }
    }
  }

  if (sim.temperature > OVERHEAT_TEMP) {
    if (!sim.isOverheating) {
      sim.isOverheating = true;
      if (!sim.overheatAlertSent) {
        sim.alertMessages.push({
          type: 'danger',
          text: '⚠️ 警告：发电机过热！请立即点击冷却按钮！',
          id: Date.now()
        });
        sim.overheatAlertSent = true;
      }
    }
    sim.powerOutput *= 0.5;
  } else {
    sim.isOverheating = false;
    sim.overheatAlertSent = false;
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

  if (sim.time - sim.lastHistoryTime >= 1.0) {
    sim.history.push({
      time: sim.time,
      power: sim.powerOutput,
      waterLevel: sim.waterLevel,
      flowRate: sim.flowRate,
      temperature: sim.temperature,
      weather: sim.weather,
      season: sim.season
    });
    sim.lastHistoryTime = sim.time;
    if (sim.history.length > 3600) {
      sim.history.shift();
    }
  }
}

export function setGateOpening(sim, value) {
  sim.gateOpening = Math.max(0, Math.min(1, value));
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
}

export function getAlertMessages(sim) {
  const msgs = [...sim.alertMessages];
  sim.alertMessages = [];
  return msgs;
}

export function exportCSV(sim) {
  const headers = '时间(s),功率(MW),水位(m),流量(m³/s),温度(°C),天气,季节';
  const rows = sim.history.map(h =>
    `${h.time.toFixed(1)},${h.power.toFixed(2)},${h.waterLevel.toFixed(2)},${h.flowRate.toFixed(2)},${h.temperature.toFixed(1)},${h.weather},${h.season}`
  );
  return [headers, ...rows].join('\n');
}