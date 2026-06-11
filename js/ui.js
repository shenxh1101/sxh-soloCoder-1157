export function initUI(callbacks) {
  const gateSlider = document.getElementById('gate-slider');
  const gateVal = document.getElementById('gate-val');
  const weatherBtn = document.getElementById('weather-btn');
  const seasonBtn = document.getElementById('season-btn');
  const viewBtn = document.getElementById('view-btn');
  const coolBtn = document.getElementById('cool-btn');
  const exportBtn = document.getElementById('export-btn');
  const valWater = document.getElementById('val-water');
  const valRpm = document.getElementById('val-rpm');
  const valPower = document.getElementById('val-power');
  const valFlow = document.getElementById('val-flow');
  const valTemp = document.getElementById('val-temp');
  const metricWater = document.getElementById('metric-water');
  const metricTemp = document.getElementById('metric-temp');
  const alertOverlay = document.getElementById('alert-overlay');

  let weather = 'sunny';
  let season = 'rainy';
  let currentView = 'external';

  gateSlider.addEventListener('input', () => {
    const val = parseInt(gateSlider.value) / 100;
    gateVal.textContent = Math.round(val * 100) + '%';
    callbacks.onGateChange(val);
  });

  weatherBtn.addEventListener('click', () => {
    weather = weather === 'sunny' ? 'rain' : 'sunny';
    if (weather === 'rain') {
      weatherBtn.innerHTML = '<span class="weather-icon">🌧️</span> 天气：下雨';
      weatherBtn.classList.add('active');
    } else {
      weatherBtn.innerHTML = '<span class="weather-icon">☀️</span> 天气：晴天';
      weatherBtn.classList.remove('active');
    }
    callbacks.onWeatherChange(weather);
  });

  seasonBtn.addEventListener('click', () => {
    season = season === 'rainy' ? 'dry' : 'rainy';
    if (season === 'rainy') {
      seasonBtn.innerHTML = '<span class="season-indicator rainy"></span> 季节：雨季';
    } else {
      seasonBtn.innerHTML = '<span class="season-indicator dry"></span> 季节：旱季';
    }
    callbacks.onSeasonChange(season);
  });

  viewBtn.addEventListener('click', () => {
    currentView = currentView === 'external' ? 'internal' : 'external';
    if (currentView === 'internal') {
      viewBtn.innerHTML = '🏗️ 视角：大坝内部';
      viewBtn.classList.add('active');
    } else {
      viewBtn.innerHTML = '🏗️ 视角：外部全景';
      viewBtn.classList.remove('active');
    }
    callbacks.onViewChange(currentView);
  });

  coolBtn.addEventListener('click', () => {
    callbacks.onCoolDown();
  });

  exportBtn.addEventListener('click', () => {
    callbacks.onExport();
  });

  function updateDisplay(state) {
    valWater.textContent = state.waterLevel.toFixed(2);
    valRpm.textContent = Math.round(state.turbineSpeed);
    valPower.textContent = state.powerOutput.toFixed(2);
    valFlow.textContent = state.flowRate.toFixed(2);
    valTemp.textContent = Math.round(state.temperature);

    if (state.waterLevel > 9.0) {
      metricWater.className = 'metric-card danger';
    } else if (state.waterLevel > 8.0) {
      metricWater.className = 'metric-card warning';
    } else {
      metricWater.className = 'metric-card';
    }

    if (state.isOverheating) {
      metricTemp.className = 'metric-card danger';
      coolBtn.disabled = false;
      coolBtn.textContent = '❄️ 紧急冷却！';
      coolBtn.className = 'cool-btn danger';
    } else if (state.cooling) {
      metricTemp.className = 'metric-card warning';
      coolBtn.disabled = true;
      coolBtn.textContent = '❄️ 冷却中...';
      coolBtn.className = 'cool-btn';
    } else if (state.temperature > 80) {
      metricTemp.className = 'metric-card warning';
      coolBtn.disabled = false;
      coolBtn.textContent = '❄️ 冷却发电机';
      coolBtn.className = 'cool-btn';
    } else {
      metricTemp.className = 'metric-card';
      coolBtn.disabled = true;
      coolBtn.textContent = '❄️ 冷却发电机';
      coolBtn.className = 'cool-btn';
    }
  }

  function showAlert(alertData) {
    const toast = document.createElement('div');
    toast.className = 'alert-toast ' + (alertData.type === 'info' ? 'info' : '');
    toast.textContent = alertData.text;
    alertOverlay.appendChild(toast);
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 4000);
  }

  return { updateDisplay, showAlert };
}