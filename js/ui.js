const CHART_WIDTH = 260;
const CHART_HEIGHT = 100;
const CHART_PAD = { top: 10, right: 8, bottom: 16, left: 32 };

function createChartContext(canvasId) {
  const canvas = document.getElementById(canvasId);
  const ctx = canvas.getContext('2d');
  canvas.width = CHART_WIDTH;
  canvas.height = CHART_HEIGHT;
  return { canvas, ctx };
}

export function initUI(callbacks) {
  const charts = {
    water: createChartContext('chart-water'),
    power: createChartContext('chart-power'),
    flow: createChartContext('chart-flow')
  };

  const gateSlider = document.getElementById('gate-slider');
  const gateVal = document.getElementById('gate-val');
  const manualIndicator = document.getElementById('manual-indicator');
  const weatherBtn = document.getElementById('weather-btn');
  const seasonBtn = document.getElementById('season-btn');
  const viewBtn = document.getElementById('view-btn');
  const coolBtn = document.getElementById('cool-btn');
  const exportBtn = document.getElementById('export-btn');
  const dispatchHint = document.getElementById('dispatch-hint');
  const impactText = document.getElementById('impact-text');
  const predictionContent = document.getElementById('prediction-content');

  const valWater = document.getElementById('val-water');
  const valRpm = document.getElementById('val-rpm');
  const valPower = document.getElementById('val-power');
  const valFlow = document.getElementById('val-flow');
  const valTemp = document.getElementById('val-temp');
  const metricWater = document.getElementById('metric-water');
  const metricTemp = document.getElementById('metric-temp');
  const metricRpm = document.getElementById('metric-rpm');
  const alertOverlay = document.getElementById('alert-overlay');

  const modeAuto = document.getElementById('mode-auto');
  const modeStorage = document.getElementById('mode-storage');
  const modeFlood = document.getElementById('mode-flood');

  const dotTurbine = document.getElementById('dot-turbine');
  const dotPipe = document.getElementById('dot-pipe');
  const dotOverheat = document.getElementById('dot-overheat');
  const repairTurbineBtn = document.getElementById('repair-turbine');
  const repairPipeBtn = document.getElementById('repair-pipe');

  const drillFlashFlood = document.getElementById('drill-flashflood');
  const drillFailure = document.getElementById('drill-failure');
  const drillSpill = document.getElementById('drill-spill');
  const drillStop = document.getElementById('drill-stop');
  const drillPanel = document.getElementById('drill-panel');
  const drillHeader = document.getElementById('drill-header');
  const drillGoals = document.getElementById('drill-goals');
  const drillProgress = document.getElementById('drill-progress');

  const planStorm = document.getElementById('plan-storm');
  const planDrought = document.getElementById('plan-drought');
  const planEmergency = document.getElementById('plan-emergency');
  const planInfo = document.getElementById('plan-info');

  const todoActiveList = document.getElementById('todo-active-list');
  const todoCompletedList = document.getElementById('todo-completed-list');

  const reportOverlay = document.getElementById('report-overlay');
  const reportTitle = document.getElementById('report-title');
  const reportSummary = document.getElementById('report-summary');
  const reportFaultList = document.getElementById('report-fault-list');
  const reportFaults = document.getElementById('report-faults');
  const reportClose = document.getElementById('report-close');
  const exportReportBtn = document.getElementById('export-report-btn');

  let weather = 'sunny';
  let season = 'rainy';
  let currentView = 'external';
  let currentMode = 'auto';
  let isManualGate = false;
  let activePlan = null;
  let completedTodoMap = {};
  let currentReport = null;

  gateSlider.addEventListener('input', () => {
    const val = parseInt(gateSlider.value) / 100;
    gateVal.textContent = Math.round(val * 100) + '%';
    isManualGate = true;
    manualIndicator.style.display = 'inline';
    callbacks.onGateChange(val);
  });

  function setModeButtons(mode) {
    [modeAuto, modeStorage, modeFlood].forEach(b => b.classList.remove('mode-active'));
    if (mode === 'auto') modeAuto.classList.add('mode-active');
    if (mode === 'storage') modeStorage.classList.add('mode-active');
    if (mode === 'flood') modeFlood.classList.add('mode-active');
  }

  const dispatchInfoMap = {
    auto: { hint: '推荐闸门: 55% | 泄洪: 8m以上触发', reason: '自动平衡发电与水位——保持最优发电效率，自动微调闸门' },
    storage: { hint: '推荐闸门: 5% | 泄洪: 8m以上触发', reason: '蓄水优先——关闭闸门，水位将快速上升，适合旱季后补水' },
    flood: { hint: '推荐闸门: 100% | 泄洪: 5m提前触发', reason: '防洪优先——全开闸门并提前触发泄洪，快速降低水位至安全线' }
  };

  modeAuto.addEventListener('click', () => {
    currentMode = 'auto';
    setModeButtons('auto');
    isManualGate = false;
    manualIndicator.style.display = 'none';
    impactText.classList.remove('show');
    callbacks.onDispatchChange('auto');
    dispatchHint.textContent = dispatchInfoMap.auto.hint;
  });

  modeStorage.addEventListener('click', () => {
    currentMode = 'storage';
    setModeButtons('storage');
    isManualGate = false;
    manualIndicator.style.display = 'none';
    impactText.classList.remove('show');
    callbacks.onDispatchChange('storage');
    dispatchHint.textContent = dispatchInfoMap.storage.hint;
  });

  modeFlood.addEventListener('click', () => {
    currentMode = 'flood';
    setModeButtons('flood');
    isManualGate = false;
    manualIndicator.style.display = 'none';
    impactText.classList.remove('show');
    callbacks.onDispatchChange('flood');
    dispatchHint.textContent = dispatchInfoMap.flood.hint;
  });

  weatherBtn.addEventListener('click', () => {
    weather = weather === 'sunny' ? 'rain' : 'sunny';
    weatherBtn.innerHTML = weather === 'rain'
      ? '<span class="weather-icon">🌧️</span> 天气：下雨'
      : '<span class="weather-icon">☀️</span> 天气：晴天';
    if (weather === 'rain') weatherBtn.classList.add('active');
    else weatherBtn.classList.remove('active');
    callbacks.onWeatherChange(weather);
  });

  seasonBtn.addEventListener('click', () => {
    season = season === 'rainy' ? 'dry' : 'rainy';
    seasonBtn.innerHTML = season === 'rainy'
      ? '<span class="season-indicator rainy"></span> 季节：雨季'
      : '<span class="season-indicator dry"></span> 季节：旱季';
    callbacks.onSeasonChange(season);
  });

  viewBtn.addEventListener('click', () => {
    currentView = currentView === 'external' ? 'internal' : 'external';
    viewBtn.innerHTML = currentView === 'internal' ? '🏗️ 视角：大坝内部' : '🏗️ 视角：外部全景';
    if (currentView === 'internal') viewBtn.classList.add('active');
    else viewBtn.classList.remove('active');
    callbacks.onViewChange(currentView);
  });

  coolBtn.addEventListener('click', () => callbacks.onCoolDown());
  repairTurbineBtn.addEventListener('click', () => callbacks.onRepairTurbine());
  repairPipeBtn.addEventListener('click', () => callbacks.onClearPipe());
  exportBtn.addEventListener('click', () => callbacks.onExport());

  drillFlashFlood.addEventListener('click', () => {
    completedTodoMap = {};
    callbacks.onStartDrill('flashFlood');
  });
  drillFailure.addEventListener('click', () => {
    completedTodoMap = {};
    callbacks.onStartDrill('unitFailure');
  });
  drillSpill.addEventListener('click', () => {
    completedTodoMap = {};
    callbacks.onStartDrill('emergencySpill');
  });
  drillStop.addEventListener('click', () => callbacks.onStopDrill());

  planStorm.addEventListener('click', () => callbacks.onApplyPlan('storm'));
  planDrought.addEventListener('click', () => callbacks.onApplyPlan('drought'));
  planEmergency.addEventListener('click', () => callbacks.onApplyPlan('emergency'));

  reportClose.addEventListener('click', () => {
    reportOverlay.classList.remove('visible');
  });

  reportOverlay.addEventListener('click', (e) => {
    if (e.target === reportOverlay) {
      reportOverlay.classList.remove('visible');
    }
  });

  exportReportBtn.addEventListener('click', () => {
    if (currentReport && callbacks.onExportReport) {
      callbacks.onExportReport(currentReport);
    }
  });

  function updateDisplay(state) {
    valWater.textContent = state.waterLevel.toFixed(2);
    valRpm.textContent = Math.round(state.turbineSpeed);
    valPower.textContent = state.powerOutput.toFixed(2);
    valFlow.textContent = state.flowRate.toFixed(2);
    valTemp.textContent = Math.round(state.temperature);

    if (!isManualGate && !state.manualGateOverride) {
      gateSlider.value = Math.round(state.gateOpening * 100);
      gateVal.textContent = Math.round(state.gateOpening * 100) + '%';
    }

    if (state.waterLevel > 9.0) metricWater.className = 'metric-card danger';
    else if (state.waterLevel > 8.0) metricWater.className = 'metric-card warning';
    else metricWater.className = 'metric-card';

    if (state.faults.turbineSeizure.active) metricRpm.className = 'metric-card danger';
    else metricRpm.className = 'metric-card';

    if (state.isOverheating) {
      metricTemp.className = 'metric-card danger';
      coolBtn.disabled = false;
      coolBtn.textContent = '❄️ 紧急冷却！';
    } else if (state.cooling) {
      metricTemp.className = 'metric-card warning';
      coolBtn.disabled = true;
      coolBtn.textContent = '❄️ 冷却中...';
    } else if (state.temperature > 80) {
      metricTemp.className = 'metric-card warning';
      coolBtn.disabled = false;
      coolBtn.textContent = '❄️ 冷却发电机';
    } else {
      metricTemp.className = 'metric-card';
      coolBtn.disabled = state.temperature <= 40;
      coolBtn.textContent = '❄️ 冷却发电机';
    }

    dotTurbine.className = state.faults.turbineSeizure.active ? 'fault-dot fail' : 'fault-dot ok';
    dotPipe.className = state.faults.pipeBlockage.active ? 'fault-dot fail' : 'fault-dot ok';
    dotOverheat.className = state.faults.generatorOverheat.active ? 'fault-dot fail' : 'fault-dot ok';

    repairTurbineBtn.disabled = !state.faults.turbineSeizure.active;
    repairPipeBtn.disabled = !state.faults.pipeBlockage.active;

    if (state.manualGateOverride && !isManualGate) {
      isManualGate = false;
      manualIndicator.style.display = 'none';
    }
  }

  function updatePrediction(pred) {
    if (!pred) {
      predictionContent.textContent = '⏳ 等待调度模式激活...';
      return;
    }

    const info = dispatchInfoMap[pred.mode] || dispatchInfoMap.auto;

    let html = '<span class="pred-highlight">📋 当前调度：' + pred.modeLabel + '</span><br>';
    html += info.reason + '<br>';
    html += '<br><span class="pred-highlight">⏱ 60秒预测：</span><br>';
    html += '水位 <span class="pred-highlight">' + pred.waterLevel.toFixed(2) + 'm</span>';

    if (pred.waterLevel > 8.0) {
      html += ' <span class="pred-warn">⚠警戒</span>';
    }
    if (pred.spillwayOpen) {
      html += ' <span class="pred-danger">🌊泄洪</span>';
    }

    html += ' | 流量 <span class="pred-highlight">' + pred.flowRate.toFixed(0) + 'm³/s</span>';
    html += ' | 功率 <span class="pred-highlight">' + pred.power.toFixed(0) + 'MW</span>';

    predictionContent.innerHTML = html;
  }

  function updateDeviationImpact(deviation) {
    if (deviation && deviation.impact) {
      impactText.textContent = '⚠ ' + deviation.impact;
      impactText.classList.add('show');
    } else {
      impactText.classList.remove('show');
    }
  }

  function updatePlanInfo(planResult) {
    if (!planResult) {
      planInfo.style.display = 'none';
      [planStorm, planDrought, planEmergency].forEach(b => b.classList.remove('active'));
      activePlan = null;
      return;
    }

    const { plan, eta } = planResult;
    activePlan = plan.id;

    [planStorm, planDrought, planEmergency].forEach(b => b.classList.remove('active'));
    if (plan.id === 'storm') planStorm.classList.add('active');
    if (plan.id === 'drought') planDrought.classList.add('active');
    if (plan.id === 'emergency') planEmergency.classList.add('active');

    const etaMin = Math.floor(eta.etaSec / 60);
    const etaSec = eta.etaSec % 60;
    const etaStr = eta.etaSec < 600
      ? etaMin + '分' + etaSec + '秒'
      : '>10分（请持续观察）';

    planInfo.style.display = 'block';
    planInfo.innerHTML = `
      <div style="margin-bottom:2px"><strong>${plan.desc}</strong></div>
      <div>🎯 目标：${plan.target}</div>
      <div>⚙️ 模式：${plan.mode==='flood'?'防洪':plan.mode==='storage'?'蓄水':'自动'} | 闸门：${Math.round(plan.gate*100)}%</div>
      <div>⏱ 预计达标：<span class="eta">${etaStr}</span></div>
      <div style="margin-top:2px;font-size:8px;color:rgba(160,185,230,0.5)">净流量：${eta.netFlow>0?'+':''}${eta.netFlow.toFixed(0)} m³/s</div>
    `;
  }

  function updateDrillPanel(drillStatus) {
    if (!drillStatus) {
      drillPanel.classList.remove('visible');
      drillStop.style.display = 'none';
      return;
    }

    drillPanel.classList.add('visible');
    drillStop.style.display = 'block';

    const modeLabels = {
      flashFlood: '🌧️ 暴雨洪峰演练',
      unitFailure: '🔧 机组故障演练',
      emergencySpill: '🌊 紧急泄洪演练'
    };
    drillHeader.textContent = '🎯 ' + (modeLabels[drillStatus.mode] || '演练进行中');

    let goalsHtml = '';
    drillStatus.goals.forEach(g => {
      goalsHtml += '<div class="drill-goal' + (g.done ? ' done' : '') + '">';
      goalsHtml += '<span class="goal-icon">' + (g.done ? '✅' : '⏳') + '</span>';
      goalsHtml += g.label;
      goalsHtml += '</div>';
    });
    drillGoals.innerHTML = goalsHtml;

    const elapsed = Math.floor(drillStatus.elapsed);
    const min = Math.floor(elapsed / 60);
    const sec = elapsed % 60;
    drillProgress.textContent = drillStatus.completed
      ? '🏆 已完成！耗时 ' + min + '分' + sec + '秒'
      : '进度 ' + drillStatus.doneCount + '/' + drillStatus.totalCount + ' | 已用时 ' + min + '分' + sec + '秒';
  }

  function updateFaultTodoCards(activeFaults, faultLog) {
    if (!activeFaults) {
      todoActiveList.innerHTML = '<div style="font-size:9px;color:rgba(160,185,230,0.3);text-align:center;padding:4px">暂无待处理故障 ✅</div>';
    } else if (activeFaults.length === 0) {
      todoActiveList.innerHTML = '<div style="font-size:9px;color:rgba(160,185,230,0.3);text-align:center;padding:4px">暂无待处理故障 ✅</div>';
    } else {
      let html = '';
      activeFaults.forEach(f => {
        const detectedSec = f.detectedAt ? Math.floor(f.detectedAt) : 0;
        const min = Math.floor(detectedSec / 60);
        const sec = detectedSec % 60;
        html += '<div class="todo-card active">';
        html += '<div>';
        html += '<div class="todo-label">🔴 ' + f.label + '</div>';
        html += '<div class="todo-time">触发时间：' + min + '分' + sec + '秒</div>';
        html += '</div>';
        if (f.type === 'turbineSeizure') {
          html += '<button class="todo-btn repair-btn" id="todo-repair-turbine">维修</button>';
        } else if (f.type === 'pipeBlockage') {
          html += '<button class="todo-btn repair-btn" id="todo-clear-pipe">疏通</button>';
        } else if (f.type === 'generatorOverheat') {
          html += '<button class="todo-btn cool-btn" id="todo-cool">冷却</button>';
        }
        html += '</div>';
      });
      todoActiveList.innerHTML = html;

      const todoRepairTurbine = document.getElementById('todo-repair-turbine');
      const todoClearPipe = document.getElementById('todo-clear-pipe');
      const todoCool = document.getElementById('todo-cool');
      if (todoRepairTurbine) todoRepairTurbine.addEventListener('click', () => callbacks.onRepairTurbine());
      if (todoClearPipe) todoClearPipe.addEventListener('click', () => callbacks.onClearPipe());
      if (todoCool) todoCool.addEventListener('click', () => callbacks.onCoolDown());
    }

    if (faultLog && faultLog.length > 0) {
      const resolved = faultLog.filter(e => e.event === 'resolved');
      if (resolved.length > 0) {
        let html = '';
        resolved.forEach(entry => {
          const min = Math.floor(entry.time / 60);
          const sec = Math.floor(entry.time % 60);
          html += '<div class="todo-card completed">';
          html += '<div>';
          html += '<div class="todo-label">✅ ' + entry.label + ' 已处理</div>';
          html += '<div class="todo-time">完成时间：' + min + '分' + sec + '秒</div>';
          html += '</div>';
          html += '</div>';
        });
        html += '<div style="font-size:9px;color:rgba(160,185,230,0.3);text-align:center;padding:2px">共 ' + resolved.length + ' 条处理记录</div>';
        todoCompletedList.innerHTML = html;
      } else {
        todoCompletedList.innerHTML = '<div style="font-size:9px;color:rgba(160,185,230,0.3);text-align:center;padding:4px">暂无处理记录</div>';
      }
    } else {
      todoCompletedList.innerHTML = '<div style="font-size:9px;color:rgba(160,185,230,0.3);text-align:center;padding:4px">暂无处理记录</div>';
    }
  }

  function showReportOverlay(report) {
    if (!report) return;
    currentReport = report;
    completedTodoMap = {};

    const modeLabels = { flashFlood: '暴雨洪峰', unitFailure: '机组故障', emergencySpill: '紧急泄洪' };
    const modeLabel = modeLabels[report.drillMode] || report.drillMode;
    const elapsedMin = Math.floor(report.elapsed / 60);
    const elapsedSec = Math.floor(report.elapsed % 60);

    reportTitle.textContent = '📊 演练复盘报告 - ' + modeLabel;

    const spillAt = report.spillwayOpenedAt !== null
      ? Math.floor(report.spillwayOpenedAt) + '秒'
      : '未触发';
    const floodAt = report.floodModeAt !== null
      ? Math.floor(report.floodModeAt) + '秒'
      : '未切换';

    reportSummary.innerHTML = `
      <div class="report-summary-item">
        <div class="report-summary-label">🏁 完成状态</div>
        <div class="report-summary-value" style="color:${report.completed?'#00b894':'#fdcb6e'}">${report.completed ? '✅ 全部完成' : '⚠ 部分完成'} (${report.goalsCompleted}/${report.totalGoals})</div>
      </div>
      <div class="report-summary-item">
        <div class="report-summary-label">⏱ 总耗时</div>
        <div class="report-summary-value">${elapsedMin}分${elapsedSec}秒</div>
      </div>
      <div class="report-summary-item">
        <div class="report-summary-label">📈 最高水位</div>
        <div class="report-summary-value" style="color:${report.maxWaterLevel>8.0?'#e94560':'#64b5f6'}">${report.maxWaterLevel.toFixed(2)}m</div>
      </div>
      <div class="report-summary-item">
        <div class="report-summary-label">📉 最低功率</div>
        <div class="report-summary-value">${report.minPower ? report.minPower.toFixed(2) : '0.00'}MW</div>
      </div>
      <div class="report-summary-item">
        <div class="report-summary-label">🌊 泄洪开启</div>
        <div class="report-summary-value" style="font-size:12px">${spillAt}</div>
      </div>
      <div class="report-summary-item">
        <div class="report-summary-label">🛡️ 切换防洪</div>
        <div class="report-summary-value" style="font-size:12px">${floodAt}</div>
      </div>
    `;

    if (report.faultEvents && report.faultEvents.length > 0) {
      reportFaults.style.display = 'block';
      let faultHtml = '';
      report.faultEvents.forEach(f => {
        faultHtml += '<div class="report-fault-row">';
        faultHtml += '<span>' + f.label + '</span>';
        faultHtml += '<span>触发 ' + Math.floor(f.triggeredAt) + 's</span>';
        faultHtml += '<span>' + (f.resolvedAt !== null ? '解除 ' + Math.floor(f.resolvedAt) + 's' : '未处理') + '</span>';
        faultHtml += '<span>' + (f.duration !== null ? '耗时 ' + Math.floor(f.duration) + 's' : '—') + '</span>';
        faultHtml += '</div>';
      });
      reportFaultList.innerHTML = faultHtml;
    } else {
      reportFaults.style.display = 'none';
    }

    reportOverlay.classList.add('visible');
  }

  function hideReportOverlay() {
    reportOverlay.classList.remove('visible');
    currentReport = null;
  }

  function showAlert(alertData) {
    const toast = document.createElement('div');
    toast.className = 'alert-toast ' + (alertData.type === 'info' ? 'info' : '');
    toast.textContent = alertData.text;
    alertOverlay.appendChild(toast);
    setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 4000);
  }

  function renderCharts(chartHistory) {
    renderSingleChart(charts.water, chartHistory, 'waterLevel', { min: 0, max: 10, unit: 'm', color: '#4a90d9' });
    renderSingleChart(charts.power, chartHistory, 'power', { min: 0, max: 750, unit: 'MW', color: '#f0a040' });
    renderSingleChart(charts.flow, chartHistory, 'flowRate', { min: 0, max: 110, unit: 'm³/s', color: '#40c0e0' });
  }

  const faultLogEntries = document.getElementById('fault-log-entries');

  function updateFaultLog(faultLog) {
    if (!faultLog || faultLog.length === 0) {
      faultLogEntries.innerHTML = '<div style="font-size:9px;color:rgba(160,185,230,0.3);text-align:center">暂无事故记录</div>';
      return;
    }

    let html = '';
    faultLog.forEach(entry => {
      const min = Math.floor(entry.time / 60);
      const sec = Math.floor(entry.time % 60);
      const timeStr = min + '分' + sec + '秒';
      const eventLabel = entry.event === 'triggered' ? '🔴 触发' : '✅ 解除';
      html += '<div class="fault-log-entry ' + entry.event + '">';
      html += '<span>' + eventLabel + ' ' + entry.label + '</span>';
      html += '<span class="fault-log-time">' + timeStr + '</span>';
      html += '</div>';
    });
    faultLogEntries.innerHTML = html;
  }

  function setWeatherUI(w, s) {
    weather = w || weather;
    season = s || season;
    weatherBtn.innerHTML = weather === 'rain'
      ? '<span class="weather-icon">🌧️</span> 天气：下雨'
      : '<span class="weather-icon">☀️</span> 天气：晴天';
    if (weather === 'rain') weatherBtn.classList.add('active');
    else weatherBtn.classList.remove('active');
    seasonBtn.innerHTML = season === 'rainy'
      ? '<span class="season-indicator rainy"></span> 季节：雨季'
      : '<span class="season-indicator dry"></span> 季节：旱季';
  }

  function setModeUI(mode) {
    currentMode = mode;
    setModeButtons(mode);
    isManualGate = false;
    manualIndicator.style.display = 'none';
    dispatchHint.textContent = (dispatchInfoMap[mode] || dispatchInfoMap.auto).hint;
  }

  return {
    updateDisplay,
    showAlert,
    renderCharts,
    updatePrediction,
    updateDeviationImpact,
    updateDrillPanel,
    updateFaultLog,
    updateFaultTodoCards,
    updatePlanInfo,
    showReportOverlay,
    hideReportOverlay,
    setWeatherUI,
    setModeUI,
    getCurrentMode: () => currentMode
  };
}

function renderSingleChart(chartObj, history, key, opts) {
  const { ctx, canvas } = chartObj;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const pw = w - CHART_PAD.left - CHART_PAD.right;
  const ph = h - CHART_PAD.top - CHART_PAD.bottom;

  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= 4; i++) {
    const y = CHART_PAD.top + (ph / 4) * i;
    ctx.beginPath();
    ctx.moveTo(CHART_PAD.left, y);
    ctx.lineTo(w - CHART_PAD.right, y);
    ctx.stroke();
    ctx.fillStyle = 'rgba(160,185,230,0.35)';
    ctx.font = '8px Consolas, Monaco, monospace';
    ctx.textAlign = 'right';
    const val = opts.max - (opts.max - opts.min) / 4 * i;
    ctx.fillText(val.toFixed(0), CHART_PAD.left - 4, y + 3);
  }

  if (!history || history.length < 2) return;

  const maxTime = history[history.length - 1].time;
  const minTime = Math.max(0, maxTime - 120);
  const visible = history.filter(h => h.time >= minTime);
  if (visible.length < 2) return;

  ctx.strokeStyle = opts.color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  let firstPoint = true;
  for (const h of visible) {
    const x = CHART_PAD.left + ((h.time - minTime) / Math.max(1, maxTime - minTime)) * pw;
    const y = CHART_PAD.top + ph - ((h[key] - opts.min) / (opts.max - opts.min)) * ph;
    const clampedX = Math.min(w - CHART_PAD.right, Math.max(CHART_PAD.left, x));
    const clampedY = Math.min(CHART_PAD.top + ph, Math.max(CHART_PAD.top, y));
    if (firstPoint) { ctx.moveTo(clampedX, clampedY); firstPoint = false; }
    else ctx.lineTo(clampedX, clampedY);
  }
  ctx.stroke();

  const lastH = history[history.length - 1];
  const lx = CHART_PAD.left + ((lastH.time - minTime) / Math.max(1, maxTime - minTime)) * pw;
  const ly = CHART_PAD.top + ph - ((lastH[key] - opts.min) / (opts.max - opts.min)) * ph;
  const clx = Math.min(w - CHART_PAD.right, Math.max(CHART_PAD.left, lx));
  const cly = Math.min(CHART_PAD.top + ph, Math.max(CHART_PAD.top, ly));
  ctx.fillStyle = opts.color;
  ctx.beginPath();
  ctx.arc(clx, cly, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '9px Consolas, Monaco, monospace';
  ctx.textAlign = 'left';
  const label = lastH[key].toFixed(1) + ' ' + opts.unit;
  ctx.fillText(label, clx + 6, cly - 4);
}