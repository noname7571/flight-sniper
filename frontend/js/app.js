const API_BASE = '/api';

// State
let routes = [];
let priceChart = null;

// DOM refs
const routeForm = document.getElementById('routeForm');
const routesList = document.getElementById('routesList');
const routeCount = document.getElementById('routeCount');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const historyCard = document.getElementById('historyCard');
const historyRouteSelect = document.getElementById('historyRouteSelect');
const historyTableBody = document.getElementById('historyTableBody');
const refreshHistoryBtn = document.getElementById('refreshHistory');

// Toast - use textContent to prevent XSS
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = 'toast ' + type;
  setTimeout(function() { toast.classList.add('hidden'); }, 4000);
}

// API helpers
async function apiFetch(path, options) {
  if (!options) options = {};
  var headers = { 'Content-Type': 'application/json' };
  if (options.headers) {
    for (var key in options.headers) {
      headers[key] = options.headers[key];
    }
  }
  var fetchOptions = {
    headers: headers,
  };
  if (options.method) fetchOptions.method = options.method;
  if (options.body) fetchOptions.body = options.body;

  var res = await fetch(API_BASE + path, fetchOptions);
  if (!res.ok) {
    var err;
    try { err = await res.json(); } catch(e) { err = { error: res.statusText }; }
    throw new Error(err.error || 'Request failed');
  }
  if (res.status === 204) return null;
  return res.json();
}

// Check server health
async function checkHealth() {
  try {
    await apiFetch('/health');
    statusDot.className = 'status-dot online';
    statusText.textContent = 'Connected';
    return true;
  } catch(e) {
    statusDot.className = 'status-dot offline';
    statusText.textContent = 'Disconnected';
    return false;
  }
}

// Load routes
async function loadRoutes() {
  try {
    routes = await apiFetch('/routes');
    renderRoutes();
    updateHistorySelect();
  } catch (err) {
    showToast('Failed to load routes: ' + err.message, 'error');
  }
}

// Update history dropdown
function updateHistorySelect() {
  historyRouteSelect.innerHTML = '<option value="">Select a route...</option>';
  for (var i = 0; i < routes.length; i++) {
    var opt = document.createElement('option');
    opt.value = routes[i].id;
    opt.textContent = routes[i].origin + ' -> ' + routes[i].destination;
    historyRouteSelect.appendChild(opt);
  }
}

// Render routes using textContent for safety
function renderRoutes() {
  routeCount.textContent = String(routes.length);

  routesList.innerHTML = '';

  if (routes.length === 0) {
    var empty = document.createElement('div');
    empty.className = 'empty-state';
    var p = document.createElement('p');
    p.textContent = 'No routes being monitored yet. Add one above!';
    empty.appendChild(p);
    routesList.appendChild(empty);
    historyCard.style.display = 'none';
    return;
  }

  for (var i = 0; i < routes.length; i++) {
    var route = routes[i];
    var item = document.createElement('div');
    item.className = 'route-item';

    var main = document.createElement('div');
    main.className = 'route-main';

    var dest = document.createElement('div');
    dest.className = 'route-dest';
    dest.textContent = route.origin + ' -> ' + route.destination;
    main.appendChild(dest);

    var meta = document.createElement('div');
    meta.className = 'route-meta';

    var maxSpan = document.createElement('span');
    maxSpan.textContent = 'Max: ' + route.max_price + ' ' + route.currency;
    meta.appendChild(maxSpan);

    var intervalSpan = document.createElement('span');
    intervalSpan.textContent = 'Every ' + route.check_interval_minutes + 'min';
    meta.appendChild(intervalSpan);

    if (route.return_ticket) {
      var rtSpan = document.createElement('span');
      rtSpan.textContent = 'Return';
      var rtTag = document.createElement('span');
      rtTag.className = 'route-detail-tag';
      rtTag.textContent = 'Round trip';
      rtSpan.appendChild(rtTag);
      meta.appendChild(rtSpan);
    }

    if (route.include_destinations) {
      var incSpan = document.createElement('span');
      incSpan.textContent = 'Only: ' + route.include_destinations;
      meta.appendChild(incSpan);
    }

    if (route.exclude_destinations) {
      var excSpan = document.createElement('span');
      excSpan.textContent = 'Exclude: ' + route.exclude_destinations;
      meta.appendChild(excSpan);
    }

    main.appendChild(meta);
    item.appendChild(main);

    var actions = document.createElement('div');
    actions.className = 'route-actions';

    var historyBtn = document.createElement('button');
    historyBtn.className = 'btn btn-secondary';
    historyBtn.textContent = 'History';
    historyBtn.addEventListener('click', function(id) {
      return function() { showHistory(id); };
    }(route.id));
    actions.appendChild(historyBtn);

    var delBtn = document.createElement('button');
    delBtn.className = 'btn btn-danger';
    delBtn.textContent = 'Remove';
    delBtn.addEventListener('click', function(id) {
      return function() { deleteRoute(id); };
    }(route.id));
    actions.appendChild(delBtn);

    item.appendChild(actions);
    routesList.appendChild(item);
  }
}

// Add route
async function addRoute(data) {
  try {
    var route = await apiFetch('/routes', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    routes.push(route);
    renderRoutes();
    updateHistorySelect();
    showToast('Now monitoring ' + route.origin + ' -> ' + route.destination);
    return true;
  } catch (err) {
    showToast('Failed to add route: ' + err.message, 'error');
    return false;
  }
}

// Delete route
async function deleteRoute(id) {
  try {
    await apiFetch('/routes/' + id, { method: 'DELETE' });
    routes = routes.filter(function(r) { return r.id !== id; });
    renderRoutes();
    updateHistorySelect();
    showToast('Route removed');
  } catch (err) {
    showToast('Failed to remove route: ' + err.message, 'error');
  }
}

// Show price history for a route
async function showHistory(routeId) {
  historyCard.style.display = 'block';
  historyRouteSelect.value = String(routeId);
  await loadHistory(routeId);
}

// Load and display price history
async function loadHistory(routeId) {
  try {
    var history = await apiFetch('/routes/' + routeId + '/history?limit=100');

    // Build chart
    buildPriceChart(history);

    // Build table
    historyTableBody.innerHTML = '';
    if (history.length === 0) {
      var row = document.createElement('tr');
      var cell = document.createElement('td');
      cell.colSpan = 4;
      cell.textContent = 'No price history yet. Waiting for next check cycle...';
      cell.style.textAlign = 'center';
      cell.style.color = 'var(--text-secondary)';
      row.appendChild(cell);
      historyTableBody.appendChild(row);
      return;
    }

    for (var i = 0; i < history.length; i++) {
      var rec = history[i];
      var row = document.createElement('tr');
      row.innerHTML =
        '<td>' + escapeHtml(rec.checked_at || '-') + '</td>' +
        '<td><strong>' + rec.price + ' ' + rec.currency + '</strong></td>' +
        '<td>' + escapeHtml(rec.airline || '-') + '</td>' +
        '<td>' + (rec.direct ? 'Direct' : 'Transfer') + '</td>';
      historyTableBody.appendChild(row);
    }
  } catch (err) {
    showToast('Failed to load history: ' + err.message, 'error');
  }
}

// Build price chart using Chart.js
function buildPriceChart(history) {
  var ctx = document.getElementById('priceChart').getContext('2d');

  if (priceChart) {
    priceChart.destroy();
  }

  var labels = history.map(function(r) { return r.checked_at ? r.checked_at.slice(0, 16) : ''; }).reverse();
  var prices = history.map(function(r) { return r.price; }).reverse();

  if (labels.length === 0) {
    labels = ['No data'];
    prices = [0];
  }

  priceChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Price (' + (history[0]?.currency || 'EUR') + ')',
        data: prices,
        borderColor: '#4f8cf7',
        backgroundColor: 'rgba(79, 140, 247, 0.1)',
        fill: true,
        tension: 0.3,
        pointRadius: 4,
        pointBackgroundColor: '#4f8cf7',
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
      },
      scales: {
        x: {
          ticks: { color: '#9aa0ab', maxTicksLimit: 10 },
          grid: { color: 'rgba(46, 51, 72, 0.5)' },
        },
        y: {
          ticks: { color: '#9aa0ab' },
          grid: { color: 'rgba(46, 51, 72, 0.5)' },
        },
      },
    },
  });
}

// Safe HTML escaping
function escapeHtml(str) {
  if (!str) return '';
  var div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Form submit handler
routeForm.addEventListener('submit', async function(e) {
  e.preventDefault();

  var includeRaw = document.getElementById('includeDestinations').value.trim();
  var excludeRaw = document.getElementById('excludeDestinations').value.trim();

  var data = {
    origin: document.getElementById('origin').value.trim().toUpperCase(),
    destination: document.getElementById('destination').value.trim().toUpperCase(),
    max_price: parseFloat(document.getElementById('maxPrice').value),
    email: document.getElementById('email').value.trim() || null,
    discord_webhook: document.getElementById('discordWebhook').value.trim() || null,
    check_interval_minutes: parseInt(document.getElementById('checkInterval').value),
    include_destinations: includeRaw || null,
    exclude_destinations: excludeRaw || null,
    return_ticket: document.getElementById('returnTicket').checked,
  };

  var success = await addRoute(data);
  if (success) {
    routeForm.reset();
    document.getElementById('returnTicket').checked = false;
  }
});

// Auto-uppercase IATA inputs
document.getElementById('origin').addEventListener('input', function() {
  this.value = this.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
});
document.getElementById('destination').addEventListener('input', function() {
  this.value = this.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
});

// Auto-uppercase filter inputs
document.getElementById('includeDestinations').addEventListener('input', function() {
  this.value = this.value.toUpperCase().replace(/[^A-Z,]/g, '');
});
document.getElementById('excludeDestinations').addEventListener('input', function() {
  this.value = this.value.toUpperCase().replace(/[^A-Z,]/g, '');
});

// History route select change
historyRouteSelect.addEventListener('change', function() {
  if (this.value) {
    loadHistory(parseInt(this.value));
  } else {
    historyCard.style.display = 'none';
  }
});

// Refresh history button
refreshHistoryBtn.addEventListener('click', function() {
  if (historyRouteSelect.value) {
    loadHistory(parseInt(historyRouteSelect.value));
  }
});

// Initialize
async function init() {
  var healthy = await checkHealth();
  if (healthy) {
    await loadRoutes();
  }
  setInterval(checkHealth, 30000);
}

init();
