/* ===================== STATE ===================== */
const state = {
  role: null,
  theme: 'dark',
  tariff: 8.5,
  tempThreshold: 80,
  spikeThreshold: 25,
  carbonFactor: 0.82, // kg CO2 per kWh (grid average)
  energyToday: 0,
  costToday: 0,
  carbonToday: 0,
  savingsMonth: 18400,
  energyHistory: [], // {t, kw}
  alerts: [],
  reportRange: 'daily',
  users: [
    { name: 'Rahul Kumar', role: 'Admin' },
    { name: 'Priya Sharma', role: 'Factory Manager' },
    { name: 'Arjun Nair', role: 'Operator' },
  ],
  machines: [
    { id: 'M01', name: 'CNC Mill 1', type: 'CNC Machining', on: true, status: 'healthy', temp: 62, power: 18, hours: 1345, health: 92 },
    { id: 'M02', name: 'CNC Mill 2', type: 'CNC Machining', on: true, status: 'warning', temp: 78, power: 21, hours: 2210, health: 68 },
    { id: 'M03', name: 'Compressor Unit A', type: 'Compressor', on: true, status: 'healthy', temp: 55, power: 32, hours: 5600, health: 88 },
    { id: 'M04', name: 'Conveyor Belt A', type: 'Conveyor', on: true, status: 'healthy', temp: 40, power: 6, hours: 3020, health: 95 },
    { id: 'M05', name: 'Injection Molder 1', type: 'Injection Molding', on: true, status: 'fault', temp: 91, power: 27, hours: 4110, health: 41 },
    { id: 'M06', name: 'Welding Robot X', type: 'Robotics', on: true, status: 'healthy', temp: 58, power: 15, hours: 980, health: 90 },
    { id: 'M07', name: 'HVAC Chiller', type: 'HVAC', on: true, status: 'warning', temp: 71, power: 40, hours: 6100, health: 63 },
    { id: 'M08', name: 'Packaging Line B', type: 'Packaging', on: false, status: 'healthy', temp: 30, power: 0, hours: 2440, health: 97 },
  ],
};

let charts = {};

/* ===================== UTIL ===================== */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const round = (n, d = 0) => Number(n.toFixed(d));
const rand = (min, max) => Math.random() * (max - min) + min;
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const fmtMoney = (n) => Math.round(n).toLocaleString('en-IN');
const nowStr = () => new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

function totalPower() {
  return state.machines.filter(m => m.on).reduce((sum, m) => sum + m.power, 0);
}

/* ===================== LOGIN ===================== */
function initLogin() {
  $$('.role-card').forEach(card => {
    card.addEventListener('click', () => {
      state.role = card.dataset.role;
      $('#selectedRoleLabel').textContent = state.role;
      $('.role-grid').classList.add('hidden');
      $('#loginForm').classList.remove('hidden');
    });
  });
  $('#changeRoleBtn').addEventListener('click', () => {
    $('#loginForm').classList.add('hidden');
    $('.role-grid').classList.remove('hidden');
  });
  $('#loginForm').addEventListener('submit', (e) => {
    e.preventDefault();
    enterApp();
  });
  $('#logoutBtn').addEventListener('click', () => {
    $('#appShell').classList.add('hidden');
    $('#loginScreen').classList.remove('hidden');
    $('#loginForm').classList.add('hidden');
    $('.role-grid').classList.remove('hidden');
  });
}

function enterApp() {
  $('#loginScreen').classList.add('hidden');
  $('#appShell').classList.remove('hidden');
  $('#roleBadge').textContent = state.role;
  $('#userAvatar').textContent = state.role.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  renderAll();
  startSimulation();
}

/* ===================== NAV ===================== */
function initNav() {
  $$('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      $$('.nav-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      const page = item.dataset.page;
      $$('.page').forEach(p => p.classList.remove('active'));
      $(`#page-${page}`).classList.add('active');
      $('#pageTitle').textContent = item.textContent.trim().replace(/\d+$/, '');
    });
  });
}

function tickClock() {
  $('#pageClock').textContent = new Date().toLocaleString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/* ===================== THEME ===================== */
function initTheme() {
  $('#darkToggle').addEventListener('click', () => {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', state.theme);
    $('#darkToggle').textContent = state.theme === 'dark' ? '☾' : '☀';
    Object.values(charts).forEach(c => c && c.update());
  });
}

/* ===================== DASHBOARD ===================== */
function seedHistory() {
  const base = totalPower();
  for (let i = 59; i >= 0; i--) {
    state.energyHistory.push({ t: i, kw: round(base + rand(-8, 8), 1) });
  }
}

function pushHistoryPoint() {
  const kw = round(clamp(totalPower() + rand(-6, 6), 5, 300), 1);
  state.energyHistory.push({ t: Date.now(), kw });
  if (state.energyHistory.length > 60) state.energyHistory.shift();
  const intervalHours = 3 / 3600; // 3s tick expressed in hours
  state.energyToday += kw * intervalHours;
  state.costToday = state.energyToday * state.tariff;
  state.carbonToday = state.energyToday * state.carbonFactor;
}

function renderDashboard() {
  const latest = state.energyHistory[state.energyHistory.length - 1];
  $('#livePower').textContent = latest ? round(latest.kw) : 0;
  const prev = state.energyHistory[state.energyHistory.length - 6] || latest;
  const trend = latest && prev ? latest.kw - prev.kw : 0;
  $('#powerTrend').textContent = trend > 1 ? '▲ rising' : trend < -1 ? '▼ falling' : '● steady';
  $('#powerTrend').style.color = trend > 1 ? 'var(--coral)' : trend < -1 ? 'var(--teal)' : 'var(--muted)';

  $('#kpiEnergyToday').textContent = round(state.energyToday, 1);
  $('#kpiCost').textContent = fmtMoney(state.costToday);
  $('#kpiCarbon').textContent = round(state.carbonToday, 1);
  $('#kpiSavings').textContent = fmtMoney(state.savingsMonth);
  $('#kpiEnergyDelta').textContent = '↓ 6% vs. yesterday';
  $('#kpiCostDelta').textContent = `@ ₹${state.tariff}/kWh tariff`;
  $('#kpiCarbonDelta').textContent = '↓ 4% vs. yesterday';
  $('#kpiSavingsDelta').textContent = '↑ 12% vs. last month';

  renderSparkline();
  renderLiveEnergyChart();
  renderStatusSummary();
  renderMachineMiniList();
}

function renderSparkline() {
  const ctx = $('#sparkline');
  const data = state.energyHistory.map(h => h.kw);
  const labels = state.energyHistory.map((_, i) => i);
  if (!charts.spark) {
    charts.spark = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets: [{ data, borderColor: '#F0A202', borderWidth: 2, pointRadius: 0, tension: 0.35, fill: false }] },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: { x: { display: false }, y: { display: false } },
      },
    });
  } else {
    charts.spark.data.labels = labels;
    charts.spark.data.datasets[0].data = data;
    charts.spark.update('none');
  }
}

function renderLiveEnergyChart() {
  const ctx = $('#liveEnergyChart');
  const data = state.energyHistory.map(h => h.kw);
  const labels = state.energyHistory.map((_, i) => `-${state.energyHistory.length - i}`);
  const muted = getComputedStyle(document.documentElement).getPropertyValue('--muted').trim();
  if (!charts.live) {
    charts.live = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets: [{ label: 'kW', data, borderColor: '#1FB6A6', backgroundColor: 'rgba(31,182,166,0.12)', borderWidth: 2, pointRadius: 0, tension: 0.3, fill: true }] },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: muted, maxTicksLimit: 6 }, grid: { display: false } },
          y: { ticks: { color: muted }, grid: { color: 'rgba(128,128,128,0.12)' } },
        },
      },
    });
  } else {
    charts.live.data.labels = labels;
    charts.live.data.datasets[0].data = data;
    charts.live.update('none');
  }
}

function renderStatusSummary() {
  const counts = { healthy: 0, warning: 0, fault: 0 };
  state.machines.forEach(m => { if (m.on) counts[m.status]++; });
  const total = state.machines.filter(m => m.on).length;
  $('#machineStatusCount').textContent = `${total} of ${state.machines.length} running`;
  $('#statusSummary').innerHTML = `
    <div class="status-pill healthy"><b>${counts.healthy}</b>Healthy</div>
    <div class="status-pill warning"><b>${counts.warning}</b>Warning</div>
    <div class="status-pill fault"><b>${counts.fault}</b>Fault</div>
  `;
}

function renderMachineMiniList() {
  $('#machineMiniList').innerHTML = state.machines.map(m => `
    <div class="mini-row">
      <span class="dot ${m.on ? m.status : 'off'}"></span>
      <span class="name">${m.name}</span>
      <span class="hrs">${m.on ? round(m.temp) + '°C' : 'OFF'}</span>
    </div>
  `).join('');
}

/* ===================== DIGITAL TWIN ===================== */
const twinLayout = [
  { x: 60, y: 60, w: 220, h: 150, label: 'Machining bay' },
  { x: 320, y: 60, w: 220, h: 150, label: 'Assembly & robotics' },
  { x: 60, y: 260, w: 220, h: 150, label: 'Utilities' },
  { x: 320, y: 260, w: 220, h: 150, label: 'Packaging' },
  { x: 600, y: 60, w: 240, h: 350, label: 'Warehouse floor' },
];
const twinPositions = {
  M01: [130, 110], M02: [220, 150],
  M05: [390, 110], M06: [470, 150],
  M03: [130, 320], M07: [220, 360],
  M04: [390, 320], M08: [470, 360],
};

function renderTwin() {
  const svg = $('#twinSvg');
  const zones = twinLayout.map(z => `
    <rect x="${z.x}" y="${z.y}" width="${z.w}" height="${z.h}" rx="10" fill="none" stroke="var(--border)" stroke-width="1.5"/>
    <text x="${z.x + 12}" y="${z.y + 22}" fill="var(--muted)" font-size="12" font-family="IBM Plex Mono, monospace">${z.label}</text>
  `).join('');

  const nodes = state.machines.map(m => {
    const pos = twinPositions[m.id];
    if (!pos) return '';
    const color = !m.on ? 'var(--muted)' : m.status === 'healthy' ? 'var(--teal)' : m.status === 'warning' ? 'var(--amber)' : 'var(--coral)';
    return `
      <g class="twin-node" data-id="${m.id}" style="cursor:pointer">
        <circle cx="${pos[0]}" cy="${pos[1]}" r="16" fill="${color}" opacity="0.18">
          ${m.on ? `<animate attributeName="r" values="14;20;14" dur="2s" repeatCount="indefinite"/>` : ''}
        </circle>
        <circle cx="${pos[0]}" cy="${pos[1]}" r="8" fill="${color}"/>
        <text x="${pos[0]}" y="${pos[1] + 32}" text-anchor="middle" fill="var(--text)" font-size="11" font-family="IBM Plex Sans, sans-serif">${m.name}</text>
      </g>
    `;
  }).join('');

  svg.innerHTML = zones + nodes;
  $$('.twin-node').forEach(node => {
    node.addEventListener('click', () => openMachineModal(node.dataset.id));
  });
}

/* ===================== MACHINE GRID ===================== */
function renderMachineGrid() {
  $('#machineCountLabel').textContent = `${state.machines.length} machines · ${state.machines.filter(m => m.on).length} running`;
  $('#machineGrid').innerHTML = state.machines.map(m => `
    <div class="machine-card" data-id="${m.id}">
      <div class="machine-card-head">
        <div>
          <h4>${m.name}</h4>
          <p>${m.type}</p>
        </div>
        <span class="health-badge ${m.on ? m.status : 'fault'}">${m.on ? m.status : 'offline'}</span>
      </div>
      <div class="machine-card-stats">
        <div>Power<b>${m.on ? round(m.power, 1) : 0} kW</b></div>
        <div>Temperature<b>${m.on ? round(m.temp) : '–'} °C</b></div>
        <div>Running hours<b>${m.hours.toLocaleString('en-IN')}</b></div>
        <div>Health score<b>${m.health}</b></div>
      </div>
      <div class="machine-card-foot">
        <button class="onoff-toggle ${m.on ? 'on' : 'off'}" data-id="${m.id}">${m.on ? '● ON' : '○ OFF'}</button>
        <span class="muted-note" style="margin:0;">tap card for details</span>
      </div>
    </div>
  `).join('');

  $$('.onoff-toggle').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const m = state.machines.find(x => x.id === btn.dataset.id);
      m.on = !m.on;
      renderAll();
    });
  });
  $$('.machine-card').forEach(card => {
    card.addEventListener('click', () => openMachineModal(card.dataset.id));
  });
}

function openMachineModal(id) {
  const m = state.machines.find(x => x.id === id);
  if (!m) return;
  $('#modalMachineName').textContent = m.name;
  $('#modalMachineType').textContent = `${m.type} · ID ${m.id}`;
  $('#modalMachineStats').innerHTML = `
    <div class="stat">Status<b>${m.on ? m.status : 'offline'}</b></div>
    <div class="stat">Power draw<b>${m.on ? round(m.power, 1) : 0} kW</b></div>
    <div class="stat">Temperature<b>${m.on ? round(m.temp) : '–'} °C</b></div>
    <div class="stat">Running hours<b>${m.hours.toLocaleString('en-IN')}</b></div>
    <div class="stat">Health score<b>${m.health} / 100</b></div>
    <div class="stat">Next service<b>${m.health < 60 ? 'due now' : m.health < 80 ? '~2 weeks' : '~2 months'}</b></div>
  `;
  $('#qrcode').innerHTML = '';
  // eslint-disable-next-line no-undef
  new QRCode($('#qrcode'), { text: `https://gridpulse.demo/machine/${m.id}`, width: 120, height: 120, colorDark: '#0E1420', colorLight: '#ffffff' });
  $('#machineModal').classList.remove('hidden');
}

function initModal() {
  $('#closeMachineModal').addEventListener('click', () => $('#machineModal').classList.add('hidden'));
  $('#machineModal').addEventListener('click', (e) => { if (e.target.id === 'machineModal') $('#machineModal').classList.add('hidden'); });
}

/* ===================== AI ANALYTICS ===================== */
function renderAnalytics() {
  renderPredictionChart();
  renderEffScore();
  renderRanking();
  renderMaintenance();
  renderRecommendations();
}

function renderPredictionChart() {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const history = days.map(() => round(rand(420, 520)));
  const forecastDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const forecast = forecastDays.map(() => round(rand(400, 500)));
  const labels = [...days.map(d => d + ' (past)'), ...forecastDays.map(d => d + ' (fc)')];
  const muted = getComputedStyle(document.documentElement).getPropertyValue('--muted').trim();
  const historyData = [...history, ...Array(7).fill(null)];
  const forecastData = [...Array(6).fill(null), history[6], ...forecast];

  if (!charts.prediction) {
    charts.prediction = new Chart($('#predictionChart'), {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label: 'Actual', data: historyData, borderColor: '#1FB6A6', backgroundColor: 'transparent', borderWidth: 2, pointRadius: 2, spanGaps: false },
          { label: 'Forecast', data: forecastData, borderColor: '#F0A202', borderDash: [5, 4], backgroundColor: 'transparent', borderWidth: 2, pointRadius: 2, spanGaps: false },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color: muted, boxWidth: 10, font: { size: 11 } } } },
        scales: { x: { ticks: { color: muted, maxRotation: 45, autoSkip: false, font: { size: 9 } }, grid: { display: false } }, y: { ticks: { color: muted }, grid: { color: 'rgba(128,128,128,0.12)' } } },
      },
    });
  }
}

function computeEfficiencyScore() {
  const avgHealth = state.machines.reduce((s, m) => s + m.health, 0) / state.machines.length;
  const utilization = state.machines.filter(m => m.on).length / state.machines.length * 100;
  return round(clamp(avgHealth * 0.7 + utilization * 0.3, 0, 100));
}

function renderEffScore() {
  const score = computeEfficiencyScore();
  drawGauge('effScoreChart', score, '#F0A202');
  const label = score >= 80 ? 'Excellent — plant is running efficiently.' : score >= 60 ? 'Good — some machines need attention.' : 'Needs attention — multiple efficiency losses detected.';
  $('#effScoreCaption').textContent = `${score} / 100 · ${label}`;
}

function drawGauge(canvasId, score, color) {
  const key = canvasId;
  const data = [score, 100 - score];
  if (!charts[key]) {
    charts[key] = new Chart($('#' + canvasId), {
      type: 'doughnut',
      data: { datasets: [{ data, backgroundColor: [color, 'rgba(128,128,128,0.15)'], borderWidth: 0 }] },
      options: { responsive: true, maintainAspectRatio: false, circumference: 180, rotation: 270, cutout: '75%', plugins: { legend: { display: false }, tooltip: { enabled: false } } },
    });
  } else {
    charts[key].data.datasets[0].data = data;
    charts[key].update('none');
  }
}

function renderRanking() {
  const sorted = [...state.machines].sort((a, b) => b.health - a.health);
  $('#rankingList').innerHTML = sorted.map((m, i) => `
    <div class="ranking-row">
      <span class="rank">#${i + 1}</span>
      <span class="name">${m.name}</span>
      <span class="ranking-bar"><span style="width:${m.health}%; background:${m.health >= 80 ? 'var(--teal)' : m.health >= 60 ? 'var(--amber)' : 'var(--coral)'}"></span></span>
      <span class="score">${m.health}</span>
    </div>
  `).join('');
}

function renderMaintenance() {
  const due = [...state.machines].sort((a, b) => a.health - b.health).slice(0, 4);
  $('#maintenanceList').innerHTML = due.map(m => {
    const urgency = m.health < 55 ? 'critical' : m.health < 75 ? 'warning' : 'healthy';
    const when = m.health < 55 ? 'Service due now' : m.health < 75 ? 'Service in ~2 weeks' : 'Service in ~6 weeks';
    return `
      <div class="maintenance-item">
        <span class="tag health-badge ${urgency}">${when}</span>
        <span>${m.name} — predicted from vibration & temperature trend (health ${m.health}/100).</span>
      </div>`;
  }).join('');
}

function renderRecommendations() {
  const recs = [];
  const faulty = state.machines.filter(m => m.status === 'fault' && m.on);
  const warm = state.machines.filter(m => m.on && m.temp > state.tempThreshold - 10);
  const idleOn = state.machines.filter(m => m.on && m.power < 8);
  if (faulty.length) recs.push({ tag: 'critical', text: `${faulty.map(m => m.name).join(', ')} showing fault signatures — schedule inspection before next shift.` });
  if (warm.length) recs.push({ tag: 'warning', text: `${warm.map(m => m.name).join(', ')} running warm — consider reducing load or checking cooling.` });
  if (idleOn.length) recs.push({ tag: 'healthy', text: `${idleOn.map(m => m.name).join(', ')} drawing low power while on — verify if it can be powered down to save energy.` });
  recs.push({ tag: 'healthy', text: 'Shifting compressor & HVAC-heavy operations to off-peak hours could reduce today\'s cost by an estimated 8-12%.' });
  $('#aiRecommendations').innerHTML = recs.map(r => `
    <div class="rec-item"><span class="tag health-badge ${r.tag}">tip</span><span>${r.text}</span></div>
  `).join('');
}

/* ===================== ALERTS ===================== */
const alertTemplates = [
  { type: 'critical', icon: '🔥', title: 'Machine overheating', text: (m) => `${m.name} temperature crossed ${round(m.temp)}°C — above safe threshold.` },
  { type: 'warning', icon: '⚡', title: 'High energy usage', text: (m) => `${m.name} is drawing ${round(m.power, 1)} kW, above expected baseline.` },
  { type: 'warning', icon: '🛠', title: 'Maintenance due', text: (m) => `${m.name} health score dropped to ${m.health} — maintenance recommended.` },
  { type: 'critical', icon: '⚠', title: 'Power failure risk', text: (m) => `Voltage fluctuation detected near ${m.name}. Investigate supply line.` },
];

function pushAlert(template, machine) {
  state.alerts.unshift({
    id: Date.now() + Math.random(),
    type: template.type, icon: template.icon, title: template.title,
    text: template.text(machine), time: nowStr(),
  });
  if (state.alerts.length > 30) state.alerts.pop();
}

function maybeAutoAlert() {
  state.machines.forEach(m => {
    if (!m.on) return;
    if (m.temp > state.tempThreshold && Math.random() < 0.3) pushAlert(alertTemplates[0], m);
    if (m.status === 'fault' && Math.random() < 0.15) pushAlert(alertTemplates[2], m);
  });
}

let alertFilter = 'all';
function renderAlerts() {
  const list = alertFilter === 'all' ? state.alerts : state.alerts.filter(a => a.type === alertFilter);
  $('#alertList').innerHTML = list.length ? list.map(a => `
    <div class="alert-card ${a.type}">
      <span class="icon">${a.icon}</span>
      <div class="body">
        <div class="title">${a.title}</div>
        <div>${a.text}</div>
        <div class="meta">${a.time}</div>
      </div>
    </div>
  `).join('') : `<p class="muted-note">No alerts to show.</p>`;
  const critCount = state.alerts.filter(a => a.type === 'critical').length;
  $('#alertNavBadge').textContent = critCount;
  $('#alertNavBadge').classList.toggle('hidden', critCount === 0);
}

function initAlerts() {
  $$('.alert-filters .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      $$('.alert-filters .chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      alertFilter = chip.dataset.filter;
      renderAlerts();
    });
  });
  $('#simulateAlertBtn').addEventListener('click', () => {
    const template = alertTemplates[Math.floor(rand(0, alertTemplates.length))];
    const machine = state.machines[Math.floor(rand(0, state.machines.length))];
    pushAlert(template, machine);
    renderAlerts();
    const channels = [];
    if ($('#chanSms').checked) channels.push('SMS');
    if ($('#chanWhatsapp').checked) channels.push('WhatsApp');
    if ($('#chanEmail').checked) channels.push('Email');
  });
}

/* ===================== REPORTS ===================== */
function initReports() {
  $$('.report-tabs .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      $$('.report-tabs .chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      state.reportRange = chip.dataset.range;
      renderReports();
    });
  });
  $('#downloadCsv').addEventListener('click', downloadCsv);
  $('#downloadPdf').addEventListener('click', () => window.print());
}

function reportData() {
  const cfg = {
    daily: { labels: ['6am', '9am', '12pm', '3pm', '6pm', '9pm'], energy: 6, cost: 8.5, carbon: 6, unit: 'per slot' },
    weekly: { labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], energy: 7, cost: 8.5, carbon: 7, unit: 'per day' },
    monthly: { labels: ['W1', 'W2', 'W3', 'W4'], energy: 4, cost: 8.5, carbon: 4, unit: 'per week' },
  }[state.reportRange];
  const energy = cfg.labels.map(() => round(rand(300, 520)));
  return { ...cfg, energy };
}

function renderReports() {
  const rd = reportData();
  const totalEnergy = rd.energy.reduce((a, b) => a + b, 0);
  const totalCost = totalEnergy * state.tariff;
  const totalCarbon = totalEnergy * state.carbonFactor;
  $('#reportKpis').innerHTML = `
    <div class="kpi-card"><span class="kpi-label">Total energy (${state.reportRange})</span><span class="kpi-value">${round(totalEnergy)} <small>kWh</small></span></div>
    <div class="kpi-card"><span class="kpi-label">Total cost</span><span class="kpi-value">₹${fmtMoney(totalCost)}</span></div>
    <div class="kpi-card"><span class="kpi-label">Carbon emitted</span><span class="kpi-value">${round(totalCarbon)} <small>kg CO₂</small></span></div>
    <div class="kpi-card accent"><span class="kpi-label">Peak demand</span><span class="kpi-value">${round(Math.max(...rd.energy))} <small>kWh</small></span></div>
  `;
  const muted = getComputedStyle(document.documentElement).getPropertyValue('--muted').trim();
  if (charts.report) charts.report.destroy();
  charts.report = new Chart($('#reportChart'), {
    type: 'bar',
    data: { labels: rd.labels, datasets: [{ label: 'kWh', data: rd.energy, backgroundColor: '#F0A202', borderRadius: 4 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: muted }, grid: { display: false } }, y: { ticks: { color: muted }, grid: { color: 'rgba(128,128,128,0.12)' } } } },
  });

  $('#auditSummary').innerHTML = `
    <div class="aud-row"><span>Highest consuming machine</span><b>${[...state.machines].sort((a, b) => b.power - a.power)[0].name}</b></div>
    <div class="aud-row"><span>Machines flagged for review</span><b>${state.machines.filter(m => m.status !== 'healthy').length}</b></div>
    <div class="aud-row"><span>Average efficiency score</span><b>${computeEfficiencyScore()} / 100</b></div>
    <div class="aud-row"><span>Recommended tariff-shift savings</span><b>₹${fmtMoney(totalCost * 0.1)} / ${state.reportRange}</b></div>
  `;
}

function downloadCsv() {
  const rd = reportData();
  let csv = `Period,Energy (kWh),Cost (INR),Carbon (kg CO2)\n`;
  rd.labels.forEach((l, i) => {
    const e = rd.energy[i];
    csv += `${l},${e},${round(e * state.tariff)},${round(e * state.carbonFactor)}\n`;
  });
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `gridpulse-${state.reportRange}-report.csv`; a.click();
  URL.revokeObjectURL(url);
}

/* ===================== SUSTAINABILITY ===================== */
const sdgGoals = [
  { n: 7, title: 'Affordable & clean energy', desc: 'Real-time monitoring drives efficient, lower-carbon power use.' },
  { n: 9, title: 'Industry, innovation & infrastructure', desc: 'AI-driven predictive maintenance modernizes factory operations.' },
  { n: 12, title: 'Responsible consumption', desc: 'Machine-level visibility cuts wasted energy and idle draw.' },
  { n: 13, title: 'Climate action', desc: 'Tracked carbon reduction supports measurable climate targets.' },
];

function renderSustainability() {
  const co2Saved = round(state.energyToday * state.carbonFactor * 0.15 + 120);
  $('#sustCarbon').textContent = round(state.carbonToday * 22);
  $('#sustReduction').textContent = 14;
  $('#sustTrees').textContent = round(co2Saved * 30 / 21);
  $('#sustEnergy').textContent = round(state.energyToday * 22 * 0.14);
  drawGauge('greenScoreChart', computeEfficiencyScore(), '#1FB6A6');
  $('#sdgGrid').innerHTML = sdgGoals.map(g => `<div class="sdg-card"><b>SDG ${g.n}</b>${g.title}<br><span class="muted-note" style="margin:4px 0 0;">${g.desc}</span></div>`).join('');
}

/* ===================== SETTINGS ===================== */
function initSettings() {
  $('#tariffInput').value = state.tariff;
  $('#tempThreshold').value = state.tempThreshold;
  $('#spikeThreshold').value = state.spikeThreshold;
  $('#tempThresholdVal').textContent = state.tempThreshold + '°C';
  $('#spikeThresholdVal').textContent = state.spikeThreshold + '%';

  $('#tariffInput').addEventListener('input', (e) => { state.tariff = Number(e.target.value) || 0; });
  $('#tempThreshold').addEventListener('input', (e) => { state.tempThreshold = Number(e.target.value); $('#tempThresholdVal').textContent = state.tempThreshold + '°C'; });
  $('#spikeThreshold').addEventListener('input', (e) => { state.spikeThreshold = Number(e.target.value); $('#spikeThresholdVal').textContent = state.spikeThreshold + '%'; });

  $('#addMachineForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('#newMachineName').value.trim();
    const type = $('#newMachineType').value.trim();
    if (!name || !type) return;
    const id = 'M' + String(state.machines.length + 1).padStart(2, '0');
    state.machines.push({ id, name, type, on: true, status: 'healthy', temp: 45, power: 10, hours: 0, health: 90 });
    e.target.reset();
    renderAll();
  });

  $('#addUserForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('#newUserName').value.trim();
    const role = $('#newUserRole').value;
    if (!name) return;
    state.users.push({ name, role });
    e.target.reset();
    renderSettingsLists();
  });

  renderSettingsLists();
}

function renderSettingsLists() {
  $('#settingsMachineList').innerHTML = state.machines.map(m => `
    <div class="settings-row"><span>${m.name} <span class="muted-note" style="margin:0;">(${m.type})</span></span><button class="del" data-id="${m.id}">✕</button></div>
  `).join('');
  $$('#settingsMachineList .del').forEach(btn => {
    btn.addEventListener('click', () => {
      state.machines = state.machines.filter(m => m.id !== btn.dataset.id);
      renderAll();
    });
  });

  $('#userTable').innerHTML = state.users.map((u, i) => `
    <div class="settings-row"><span>${u.name} <span class="muted-note" style="margin:0;">— ${u.role}</span></span><button class="del" data-i="${i}">✕</button></div>
  `).join('');
  $$('#userTable .del').forEach(btn => {
    btn.addEventListener('click', () => {
      state.users.splice(Number(btn.dataset.i), 1);
      renderSettingsLists();
    });
  });
}

/* ===================== SUPPORT ===================== */
const faqs = [
  { q: 'How often does live data refresh?', a: 'Dashboard readings update every 3 seconds in this demo build to simulate live sensor feeds.' },
  { q: 'How is the Energy Efficiency Score calculated?', a: 'It blends average machine health (70%) with the share of machines currently running efficiently (30%), scaled to 0–100.' },
  { q: 'Can I export reports?', a: 'Yes — use the Export Excel (.csv) or Export PDF buttons on the Reports page.' },
  { q: 'Who can add or remove machines?', a: 'Admin and Factory Manager roles can manage machines and users from Settings.' },
];

function renderSupport() {
  $('#faqList').innerHTML = faqs.map((f, i) => `
    <div class="faq-item" data-i="${i}">
      <button class="faq-q">${f.q}<span>+</span></button>
      <div class="faq-a">${f.a}</div>
    </div>
  `).join('');
  $$('.faq-item').forEach(item => {
    item.querySelector('.faq-q').addEventListener('click', () => item.classList.toggle('open'));
  });
  $('#feedbackForm').addEventListener('submit', (e) => {
    e.preventDefault();
    alert('Thanks — your feedback was recorded (demo mode, no backend attached).');
    e.target.reset();
  });
}

/* ===================== CHATBOT ===================== */
const chatReplies = [
  { keys: ['overheat', 'temperature', 'hot'], reply: 'To reduce overheating: check coolant flow, clean air filters, and verify ambient ventilation around the affected machine. Consider load-balancing to a cooler unit during peak hours.' },
  { keys: ['save', 'saving', 'reduce cost', 'efficiency'], reply: 'Quick wins: shift compressor and HVAC-heavy loads to off-peak tariff hours, power down idle machines drawing under 8kW, and fix any air leaks in compressed-air lines — these typically cut cost 8-15%.' },
  { keys: ['maintenance', 'service'], reply: 'Machines with a health score below 60 should be scheduled for inspection within the week. Check the AI Analytics tab for the current predictive maintenance list.' },
  { keys: ['carbon', 'co2', 'emission'], reply: 'Your carbon footprint scales directly with grid energy use. Shifting load to renewable-heavy grid hours and cutting idle draw both reduce it — see the Sustainability tab for your current green score.' },
  { keys: ['alert', 'notification'], reply: 'You can manage which channels (SMS, WhatsApp, Email) receive alerts from the Alerts page under Notification channels.' },
];

function botReply(msg) {
  const lower = msg.toLowerCase();
  const match = chatReplies.find(r => r.keys.some(k => lower.includes(k)));
  return match ? match.reply : "I can help with energy-saving tips, maintenance scheduling, alerts, or carbon reduction — try asking about one of those.";
}

function initChatbot() {
  $('#chatToggle').addEventListener('click', () => {
    $('#chatPanel').classList.toggle('hidden');
    if ($('#chatMessages').children.length === 0) {
      addChatMsg('bot', "Hi, I'm the GridPulse AI assistant. Ask me about energy savings, overheating, maintenance, or your carbon footprint.");
    }
  });
  $('#closeChatBtn').addEventListener('click', () => $('#chatPanel').classList.add('hidden'));
  $('#chatForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = $('#chatInput');
    const val = input.value.trim();
    if (!val) return;
    addChatMsg('user', val);
    input.value = '';
    setTimeout(() => addChatMsg('bot', botReply(val)), 400);
  });
}

function addChatMsg(who, text) {
  const div = document.createElement('div');
  div.className = `chat-msg ${who}`;
  div.textContent = text;
  $('#chatMessages').appendChild(div);
  $('#chatMessages').scrollTop = $('#chatMessages').scrollHeight;
}

/* ===================== SIMULATION LOOP ===================== */
function stepMachines() {
  state.machines.forEach(m => {
    if (!m.on) return;
    m.temp = clamp(m.temp + rand(-2, 2.2), 25, 100);
    m.power = clamp(m.power + rand(-1.5, 1.5), 1, 60);
    m.hours += 3 / 3600;
    if (m.temp > state.tempThreshold + 5) m.status = 'fault';
    else if (m.temp > state.tempThreshold - 8) m.status = 'warning';
    else m.status = 'healthy';
    m.health = clamp(round(110 - m.temp * 0.6 - (m.status === 'fault' ? 15 : 0)), 20, 99);
  });
}

function renderAll() {
  renderDashboard();
  renderTwin();
  renderMachineGrid();
  renderAnalytics();
  renderAlerts();
  renderReports();
  renderSustainability();
  renderSettingsLists();
}

function startSimulation() {
  seedHistory();
  renderAll();
  setInterval(() => {
    stepMachines();
    pushHistoryPoint();
    maybeAutoAlert();
    renderDashboard();
    renderTwin();
    renderMachineGrid();
    renderAlerts();
  }, 3000);
  setInterval(tickClock, 1000);
  tickClock();
}

/* ===================== INIT ===================== */
document.addEventListener('DOMContentLoaded', () => {
  initLogin();
  initNav();
  initTheme();
  initModal();
  initAlerts();
  initReports();
  initSettings();
  renderSupport();
  initChatbot();
});
