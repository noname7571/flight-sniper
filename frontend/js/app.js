(function() {
  'use strict';

  const API = '/api';
  let routes = [];
  let priceChart = null;

  // --- DOM refs ---
  const $ = function(id) { return document.getElementById(id); };
  const routeForm = $('routeForm');
  const routesList = $('routesList');
  const routeListContainer = $('routeListContainer');
  const routeCount = $('routeCount');
  const statusDot = $('statusDot');
  const statusText = $('statusText');
  const historyPanel = $('historyPanel');
  const historyRouteSelect = $('historyRouteSelect');
  const historyTableBody = $('historyTableBody');
  const refreshHistoryBtn = $('refreshHistory');
  const panelToggle = $('panelToggle');
  const addRoutePanel = $('addRoutePanel');
  const submitBtn = $('submitBtn');
  const alertsPanel = $('alertsPanel');
  const alertListContainer = $('alertListContainer');
  const alertCountBadge = $('alertCount');
  const alertsEmpty = $('alertsEmpty');

  // --- Stats elements ---
  var statRoutes = $('statRoutes');
  var statAlerts = $('statAlerts');
  var statChecks = $('statChecks');
  var statStatus = $('statStatus');

  // --- Panel toggle ---
  var formCollapsed = false;
  if (panelToggle) {
    panelToggle.addEventListener('click', function() {
      formCollapsed = !formCollapsed;
      var routeFormEl = document.querySelector('.route-form');
      if (routeFormEl) {
        routeFormEl.style.display = formCollapsed ? 'none' : '';
      }
      panelToggle.classList.toggle('collapsed', formCollapsed);
    });
  }

  // --- Toast system ---
  function showToast(message, type) {
    if (!type) type = 'success';
    var container = $('toastContainer');
    var toast = document.createElement('div');
    toast.className = 'toast ' + type;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(function() {
      toast.classList.add('removing');
      setTimeout(function() { toast.remove(); }, 300);
    }, 4000);
  }

  // --- API helper ---
  async function apiFetch(path, options) {
    if (!options) options = {};
    var headers = { 'Content-Type': 'application/json' };
    if (options.headers) {
      for (var key in options.headers) {
        if (options.headers.hasOwnProperty(key)) headers[key] = options.headers[key];
      }
    }
    var opts = { headers: headers };
    if (options.method) opts.method = options.method;
    if (options.body) opts.body = options.body;
    var res = await fetch(API + path, opts);
    if (!res.ok) {
      var err;
      try { err = await res.json(); } catch(e) { err = { error: res.statusText }; }
      throw new Error(err.error || 'Request failed');
    }
    if (res.status === 204) return null;
    return res.json();
  }

  // --- Health check ---
  async function checkHealth() {
    try {
      await apiFetch('/health');
      statusDot.className = 'status-dot online';
      statusText.textContent = 'Connected';
      if (statStatus) statStatus.textContent = 'Online';
      return true;
    } catch(e) {
      statusDot.className = 'status-dot offline';
      statusText.textContent = 'Disconnected';
      if (statStatus) statStatus.textContent = 'Offline';
      return false;
    }
  }

  // --- Load routes ---
  async function loadRoutes() {
    try {
      routes = await apiFetch('/routes');
      renderRoutes();
      updateHistorySelect();
      updateStats();
    } catch (err) {
      showToast('Failed to load routes', 'error');
    }
  }

  // --- Update stats ---
  function updateStats() {
    if (statRoutes) statRoutes.textContent = String(routes.length);
  }

  // --- Update history select ---
  function updateHistorySelect() {
    historyRouteSelect.innerHTML = '<option value="">Select route...</option>';
    for (var i = 0; i < routes.length; i++) {
      var opt = document.createElement('option');
      opt.value = String(routes[i].id);
      opt.textContent = routes[i].origin + ' -> ' + routes[i].destination;
      historyRouteSelect.appendChild(opt);
    }
  }

  // --- Escape HTML (XSS safe) ---
  function esc(str) {
    if (!str) return '';
    var d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  // --- Render routes ---
  function renderRoutes() {
    routeCount.textContent = String(routes.length);

    var empty = document.querySelector('.empty-state');
    routeListContainer.innerHTML = '';

    if (routes.length === 0) {
      if (empty) empty.style.display = '';
      historyPanel.style.display = 'none';
      return;
    }

    if (empty) empty.style.display = 'none';

    for (var i = 0; i < routes.length; i++) {
      var r = routes[i];
      var item = document.createElement('div');
      item.className = 'route-item';
      item.style.animationDelay = (i * 0.05) + 's';

      // Build meta tags
      var metaHtml = '';
      metaHtml += '<span>&#9670; Max ' + esc(String(r.max_price)) + ' ' + esc(r.currency) + '</span>';
      metaHtml += '<span>&#9670; Every ' + esc(String(r.check_interval_minutes)) + 'min</span>';

      if (r.return_ticket) {
        metaHtml += '<span><span class="route-tag route-tag-return">Round trip</span></span>';
      }
      if (r.include_destinations) {
        metaHtml += '<span><span class="route-tag route-tag-inc">Allow: ' + esc(r.include_destinations) + '</span></span>';
      }
      if (r.exclude_destinations) {
        metaHtml += '<span><span class="route-tag route-tag-exc">Exclude: ' + esc(r.exclude_destinations) + '</span></span>';
      }

      item.innerHTML =
        '<div class="route-main">' +
          '<div class="route-dest">' + esc(r.origin) + ' <span class="route-arrow">&rarr;</span> ' + esc(r.destination) + '</div>' +
          '<div class="route-meta">' + metaHtml + '</div>' +
        '</div>' +
        '<div class="route-actions">' +
          '<button class="btn btn-icon-only history-btn" data-id="' + r.id + '" aria-label="History">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>' +
          '</button>' +
          '<button class="btn btn-danger delete-btn" data-id="' + r.id + '">Remove</button>' +
        '</div>';

      routeListContainer.appendChild(item);
    }

    // Attach events
    routeListContainer.querySelectorAll('.history-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        showHistory(parseInt(this.getAttribute('data-id')));
      });
    });

    routeListContainer.querySelectorAll('.delete-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        deleteRoute(parseInt(this.getAttribute('data-id')));
      });
    });
  }

  // --- Add route ---
  async function addRoute(data) {
    submitBtn.disabled = true;
    submitBtn.querySelector('.btn-text').textContent = 'Adding...';
    try {
      var route = await apiFetch('/routes', { method: 'POST', body: JSON.stringify(data) });
      routes.push(route);
      renderRoutes();
      updateHistorySelect();
      updateStats();
      showToast('Now monitoring ' + route.origin + ' -> ' + route.destination);
      return true;
    } catch (err) {
      showToast(err.message, 'error');
      return false;
    } finally {
      submitBtn.disabled = false;
      submitBtn.querySelector('.btn-text').textContent = 'Start Monitoring';
    }
  }

  // --- Delete route ---
  async function deleteRoute(id) {
    try {
      await apiFetch('/routes/' + id, { method: 'DELETE' });
      routes = routes.filter(function(r) { return r.id !== id; });
      renderRoutes();
      updateHistorySelect();
      updateStats();
      showToast('Route removed');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // --- History ---
  async function showHistory(routeId) {
    historyPanel.style.display = '';
    historyRouteSelect.value = String(routeId);
    await loadHistory(routeId);
    historyPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function loadHistory(routeId) {
    try {
      var history = await apiFetch('/routes/' + routeId + '/history?limit=100');
      buildChart(history);
      historyTableBody.innerHTML = '';
      if (history.length === 0) {
        var tr = document.createElement('tr');
        var td = document.createElement('td');
        td.colSpan = 4;
        td.textContent = 'No history yet. Waiting for next check...';
        td.style.textAlign = 'center';
        td.style.color = 'var(--text-muted)';
        tr.appendChild(td);
        historyTableBody.appendChild(tr);
        return;
      }
      for (var i = 0; i < history.length; i++) {
        var rec = history[i];
        var row = document.createElement('tr');
        row.innerHTML =
          '<td>' + esc(rec.checked_at || '-') + '</td>' +
          '<td><strong>' + esc(String(rec.price)) + ' ' + esc(rec.currency) + '</strong></td>' +
          '<td>' + esc(rec.airline || '-') + '</td>' +
          '<td>' + (rec.direct ? 'Direct' : 'Transfer') + '</td>';
        historyTableBody.appendChild(row);
      }
    } catch (err) {
      showToast('Failed to load history', 'error');
    }
  }

  function buildChart(history) {
    var ctx = document.getElementById('priceChart').getContext('2d');
    if (priceChart) { priceChart.destroy(); }

    var labels = history.map(function(r) { return r.checked_at ? r.checked_at.slice(0, 16) : ''; }).reverse();
    var prices = history.map(function(r) { return r.price; }).reverse();

    if (labels.length === 0) {
      labels = ['No data yet'];
      prices = [0];
    }

    priceChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Price',
          data: prices,
          borderColor: '#4f8cf7',
          backgroundColor: function(context) {
            var chart = context.chart;
            var ctx2 = chart.ctx;
            var gradient = ctx2.createLinearGradient(0, 0, 0, chart.height || 260);
            gradient.addColorStop(0, 'rgba(79, 140, 247, 0.2)');
            gradient.addColorStop(1, 'rgba(79, 140, 247, 0.0)');
            return gradient;
          },
          fill: true,
          tension: 0.4,
          pointRadius: 3,
          pointHoverRadius: 5,
          pointBackgroundColor: '#4f8cf7',
          pointBorderColor: '#11141f',
          pointBorderWidth: 2,
          borderWidth: 2,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: {
            ticks: { color: '#575e75', maxTicksLimit: 8, font: { size: 11 } },
            grid: { color: 'rgba(46, 51, 72, 0.3)' },
          },
          y: {
            ticks: { color: '#575e75', font: { size: 11 } },
            grid: { color: 'rgba(46, 51, 72, 0.3)' },
          },
        },
        interaction: {
          intersect: false,
          mode: 'index',
        },
      },
    });
  }

  // --- Form submit ---
  routeForm.addEventListener('submit', async function(e) {
    e.preventDefault();

    var includeRaw = $('includeDestinations').value.trim();
    var excludeRaw = $('excludeDestinations').value.trim();

    var data = {
      origin: $('origin').value.trim().toUpperCase(),
      destination: $('destination').value.trim().toUpperCase(),
      max_price: parseFloat($('maxPrice').value),
      email: $('email').value.trim() || null,
      discord_webhook: $('discordWebhook').value.trim() || null,
      check_interval_minutes: parseInt($('checkInterval').value),
      include_destinations: includeRaw || null,
      exclude_destinations: excludeRaw || null,
      return_ticket: $('returnTicket').checked,
    };

    var success = await addRoute(data);
    if (success) {
      routeForm.reset();
      $('returnTicket').checked = false;
    }
  });

  // --- Auto-uppercase IATA ---
  function setupIataInput(id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', function() {
      this.value = this.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
    });
  }
  setupIataInput('origin');
  setupIataInput('destination');

  function setupFilterInput(id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', function() {
      this.value = this.value.toUpperCase().replace(/[^A-Z, ]/g, '');
    });
  }
  setupFilterInput('includeDestinations');
  setupFilterInput('excludeDestinations');

  // --- History select change ---
  historyRouteSelect.addEventListener('change', function() {
    if (this.value) {
      loadHistory(parseInt(this.value));
    } else {
      historyPanel.style.display = 'none';
    }
  });

  // --- Refresh history ---
  if (refreshHistoryBtn) {
    refreshHistoryBtn.addEventListener('click', function() {
      if (historyRouteSelect.value) {
        loadHistory(parseInt(historyRouteSelect.value));
      }
    });
  }

  // --- Alert History ---
  async function loadAlerts() {
    try {
      var data = await apiFetch('/alerts');
      var countData = await apiFetch('/alerts/count');
      var count = countData.count || 0;

      if (alertCountBadge) alertCountBadge.textContent = String(count);
      if (statAlerts) statAlerts.textContent = String(count);

      if (!alertListContainer) return;

      alertListContainer.innerHTML = '';
      if (alertsEmpty) alertsEmpty.style.display = data.length === 0 ? '' : 'none';

      for (var i = 0; i < data.length; i++) {
        var a = data[i];
        var item = document.createElement('div');
        item.className = 'alert-item';
        item.style.animationDelay = (i * 0.05) + 's';

        var channelClass = 'alert-channel-' + (a.channel || 'unknown');
        var channelLabel = a.channel === 'discord' ? 'Discord' : a.channel === 'email' ? 'Email' : a.channel;

        item.innerHTML =
          '<div class="alert-main">' +
            '<div class="alert-route">' + esc(a.route_origin || '?') + ' <span class="route-arrow">&rarr;</span> ' + esc(a.route_destination || '?') + '</div>' +
            '<div class="alert-meta">' +
              '<span class="alert-price">' + esc(String(a.price)) + ' &euro;</span>' +
              '<span class="alert-threshold">Under ' + esc(String(a.max_price)) + ' &euro;</span>' +
              '<span class="alert-time">' + esc(a.sent_at ? a.sent_at.slice(0, 16) : '') + '</span>' +
            '</div>' +
          '</div>' +
          '<span class="alert-channel ' + channelClass + '">' + channelLabel + '</span>';

        alertListContainer.appendChild(item);
      }
    } catch (err) {
      console.error('Failed to load alerts:', err);
    }
  }

  // --- Init ---
  async function init() {
    var healthy = await checkHealth();
    if (healthy) {
      await loadRoutes();
      await loadAlerts();
    }
    setInterval(checkHealth, 30000);
  }

  init();
})();
