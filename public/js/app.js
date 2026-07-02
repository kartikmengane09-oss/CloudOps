document.addEventListener('DOMContentLoaded', () => {
  // Initialize Lucide Icons
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }

  // Create Toast Element Dynamically
  const toast = document.createElement('div');
  toast.className = 'toast-indicator';
  toast.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="toast-icon"><polyline points="20 6 9 17 4 12"></polyline></svg>
    <span id="toast-message">Copied to clipboard!</span>
  `;
  document.body.appendChild(toast);

  function showToast(message) {
    const toastMessage = document.getElementById('toast-message');
    toastMessage.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 2500);
  }

  // -------------------------------------------------------------
  // System Info Initialization
  // -------------------------------------------------------------
  async function initSystemInfo() {
    try {
      const response = await fetch('/api/system-info');
      if (!response.ok) throw new Error('Failed to load system metadata');
      const data = await response.json();

      document.getElementById('aside-node').textContent = data.node_version;
      document.getElementById('node-ver-val').textContent = data.node_version;
      document.getElementById('express-ver-val').textContent = data.express_version;
      document.getElementById('platform-val').textContent = data.platform;
      document.getElementById('arch-val').textContent = data.architecture;
      document.getElementById('pid-val').textContent = data.process_id;
      document.getElementById('timezone-val').textContent = data.timezone;
      document.getElementById('version-val').textContent = data.deployment_version;
      document.getElementById('env-val').textContent = data.environment;
      document.getElementById('build-val').textContent = data.build_number;
    } catch (err) {
      console.error('Error fetching system info:', err);
    }
  }
  initSystemInfo();

  // Helper to format process uptime
  function formatUptime(sec) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${h}h ${m}m ${s}s`;
  }

  // -------------------------------------------------------------
  // Chart.js Settings & Initializations
  // -------------------------------------------------------------
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { color: '#1a2332' }, ticks: { color: '#64748b', font: { family: 'Inter', size: 10 } } },
      y: { grid: { color: '#1a2332' }, ticks: { color: '#64748b', font: { family: 'Inter', size: 10 } } }
    },
    elements: {
      point: { radius: 2, hoverRadius: 4 },
      line: { tension: 0.35, borderWidth: 2 }
    }
  };

  const initialLabels = Array(10).fill('');

  // 1. CPU Chart
  const cpuCtx = document.getElementById('cpuChart').getContext('2d');
  const cpuChart = new Chart(cpuCtx, {
    type: 'line',
    data: {
      labels: [...initialLabels],
      datasets: [{
        data: Array(10).fill(0),
        borderColor: '#38bdf8',
        backgroundColor: 'rgba(56, 189, 248, 0.05)',
        fill: true
      }]
    },
    options: chartOptions
  });

  // 2. Memory Chart
  const memCtx = document.getElementById('memChart').getContext('2d');
  const memChart = new Chart(memCtx, {
    type: 'line',
    data: {
      labels: [...initialLabels],
      datasets: [{
        data: Array(10).fill(0),
        borderColor: '#c084fc',
        backgroundColor: 'rgba(192, 132, 252, 0.05)',
        fill: true
      }]
    },
    options: chartOptions
  });

  // 3. Disk Chart (Static volume bar)
  const diskCtx = document.getElementById('diskChart').getContext('2d');
  const diskChart = new Chart(diskCtx, {
    type: 'bar',
    data: {
      labels: ['root (/)', 'var/log', 'home'],
      datasets: [{
        data: [42.4, 28.1, 15.6],
        backgroundColor: ['#fbbf24', '#38bdf8', '#c084fc'],
        borderRadius: 6
      }]
    },
    options: {
      ...chartOptions,
      indexAxis: 'y',
      scales: {
        x: { min: 0, max: 100, grid: { color: '#1a2332' }, ticks: { color: '#64748b' } },
        y: { grid: { display: false }, ticks: { color: '#64748b' } }
      }
    }
  });

  // 4. Network Chart
  const netCtx = document.getElementById('netChart').getContext('2d');
  const netChart = new Chart(netCtx, {
    type: 'line',
    data: {
      labels: [...initialLabels],
      datasets: [
        {
          label: 'Inbound',
          data: Array(10).fill(0),
          borderColor: '#4ade80',
          backgroundColor: 'rgba(74, 222, 128, 0.02)',
          fill: true
        },
        {
          label: 'Outbound',
          data: Array(10).fill(0),
          borderColor: '#38bdf8',
          backgroundColor: 'rgba(56, 189, 248, 0.02)',
          fill: true
        }
      ]
    },
    options: {
      ...chartOptions,
      plugins: { legend: { display: true, labels: { color: '#94a3b8', boxWidth: 10, font: { size: 9 } } } }
    }
  });

  // 5. Response Time Chart
  const rtCtx = document.getElementById('rtChart').getContext('2d');
  const rtChart = new Chart(rtCtx, {
    type: 'bar',
    data: {
      labels: [...initialLabels],
      datasets: [{
        data: Array(10).fill(0),
        backgroundColor: '#38bdf8',
        borderRadius: 4
      }]
    },
    options: chartOptions
  });

  // 6. RPM Chart
  const rpmCtx = document.getElementById('rpmChart').getContext('2d');
  const rpmChart = new Chart(rpmCtx, {
    type: 'line',
    data: {
      labels: [...initialLabels],
      datasets: [{
        data: Array(10).fill(0),
        borderColor: '#fbbf24',
        backgroundColor: 'rgba(251, 191, 36, 0.02)',
        fill: true
      }]
    },
    options: chartOptions
  });

  // 7. Load Test Throughput Chart (Static simulated dataset showing throughput stability)
  const ltCtx = document.getElementById('loadTestChart').getContext('2d');
  new Chart(ltCtx, {
    type: 'line',
    data: {
      labels: ['0s', '10s', '20s', '30s', '40s', '50s', '60s', '70s', '80s', '90s'],
      datasets: [
        {
          label: 'Throughput (req/s)',
          data: [1420, 1450, 1445, 1458, 1452, 1461, 1449, 1455, 1452, 1450],
          borderColor: '#38bdf8',
          yAxisID: 'y'
        },
        {
          label: 'Latency (ms)',
          data: [25, 23, 22, 22, 23, 21, 24, 22, 22, 22.4],
          borderColor: '#fbbf24',
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: true, labels: { color: '#94a3b8' } } },
      scales: {
        x: { grid: { color: '#1a2332' }, ticks: { color: '#64748b' } },
        y: { type: 'linear', position: 'left', grid: { color: '#1a2332' }, ticks: { color: '#38bdf8' } },
        y1: { type: 'linear', position: 'right', grid: { display: false }, ticks: { color: '#fbbf24' } }
      }
    }
  });

  // Helper to push metrics to timeline line charts
  function updateChartData(chart, newValue, datasetIndex = 0) {
    chart.data.datasets[datasetIndex].data.push(newValue);
    chart.data.datasets[datasetIndex].data.shift();
  }

  // -------------------------------------------------------------
  // Dynamic Metrics Polling Logic
  // -------------------------------------------------------------
  async function fetchMetrics() {
    try {
      const response = await fetch('/api/metrics');
      if (!response.ok) throw new Error('Metrics endpoint down');
      const data = await response.json();

      const timeLabel = new Date().toLocaleTimeString('en-US', { hour12: false });

      // Update Overview stats
      document.getElementById('uptime-val').textContent = formatUptime(data.uptime_seconds);
      document.getElementById('latency-val').textContent = `${data.response_time_ms} ms`;
      document.getElementById('connections-val').textContent = data.active_connections;
      document.getElementById('server-clock-val').textContent = new Date().toLocaleTimeString();

      // Update Chart Badges
      document.getElementById('cpu-chart-badge').textContent = `${data.cpu}%`;
      document.getElementById('mem-chart-badge').textContent = `${data.memory}%`;
      document.getElementById('net-chart-badge').textContent = `In: ${data.network_in_mbps} Mbps`;
      document.getElementById('rt-chart-badge').textContent = `${data.response_time_ms}ms`;
      document.getElementById('rpm-chart-badge').textContent = `${data.requests_per_minute} rpm`;

      // Update Charts Time axes
      [cpuChart, memChart, netChart, rtChart, rpmChart].forEach(c => {
        c.data.labels.push(timeLabel);
        c.data.labels.shift();
      });

      // Update Chart Series
      updateChartData(cpuChart, data.cpu);
      updateChartData(memChart, data.memory);
      updateChartData(netChart, parseFloat(data.network_in_mbps), 0);
      updateChartData(netChart, parseFloat(data.network_out_mbps), 1);
      updateChartData(rtChart, data.response_time_ms);
      updateChartData(rpmChart, data.requests_per_minute);

      // Re-render
      cpuChart.update();
      memChart.update();
      netChart.update();
      rtChart.update();
      rpmChart.update();

    } catch (err) {
      console.error('Error fetching metrics:', err);
    }
  }

  // Poll metrics every 5 seconds (per live-API requirement)
  fetchMetrics();
  setInterval(fetchMetrics, 5000);

  // -------------------------------------------------------------
  // Live Log Ticker Panel
  // -------------------------------------------------------------
  let renderedLogCount = 0;
  async function updateLogs() {
    try {
      const response = await fetch('/api/logs');
      if (!response.ok) throw new Error('Logs API failed');
      const data = await response.json();
      const terminal = document.getElementById('log-terminal');

      if (data.logs.length > renderedLogCount) {
        const newLogs = data.logs.slice(renderedLogCount);
        newLogs.forEach(logLine => {
          const lineEl = document.createElement('div');
          lineEl.className = 'terminal-line';

          // Match syntax structure: [ISO-Timestamp] [LEVEL] Message text
          const parts = logLine.match(/^\[(.*?)\] (\[.*?\]) (.*)$/);
          if (parts) {
            const timestamp = parts[1];
            const severity = parts[2];
            const message = parts[3];

            const timeSpan = document.createElement('span');
            timeSpan.className = 'log-time';
            timeSpan.textContent = `[${new Date(timestamp).toLocaleTimeString()}]`;

            const sevSpan = document.createElement('span');
            if (severity.includes('INFO')) {
              sevSpan.className = 'log-info';
            } else if (severity.includes('WARN')) {
              sevSpan.className = 'log-warn';
            } else if (severity.includes('ERROR')) {
              sevSpan.className = 'log-error';
            }
            sevSpan.textContent = severity + ' ';

            const msgSpan = document.createElement('span');
            msgSpan.textContent = message;

            lineEl.appendChild(timeSpan);
            lineEl.appendChild(sevSpan);
            lineEl.appendChild(msgSpan);
          } else {
            lineEl.textContent = logLine;
          }

          terminal.appendChild(lineEl);
        });

        renderedLogCount = data.logs.length;
        // Scroll terminal to base
        terminal.scrollTop = terminal.scrollHeight;
      }
    } catch (err) {
      console.error('Error loading log files:', err);
    }
  }

  // Initial pull and poll every 3 seconds
  updateLogs();
  setInterval(updateLogs, 3000);

  // Clear log trigger
  document.getElementById('clear-logs-btn').addEventListener('click', () => {
    document.getElementById('log-terminal').innerHTML = '';
    renderedLogCount = 0;
    showToast('Terminal logs cleared locally.');
  });

  // -------------------------------------------------------------
  // Deployment History — Dynamic Table Rendering
  // -------------------------------------------------------------
  function formatDeployTime(isoString) {
    try {
      const d = new Date(isoString);
      return d.toISOString().replace('T', ' ').replace('.000Z', '') + ' (UTC)';
    } catch (_) {
      return isoString;
    }
  }

  function statusBadge(status) {
    if (status === 'success') return '<span class="badge badge-success">Success</span>';
    if (status === 'failed')  return '<span class="badge badge-error">Failed</span>';
    return `<span class="badge">${status}</span>`;
  }

  async function fetchDeployments() {
    try {
      const response = await fetch('/api/deployments');
      if (!response.ok) throw new Error('Deployments API failed');
      const data = await response.json();
      const tbody = document.querySelector('.deployment-table tbody');
      if (!tbody) return;

      tbody.innerHTML = data.deployments.map(d => `
        <tr>
          <td class="font-mono text-accent font-semibold">${d.id}</td>
          <td class="font-mono">${d.commit}</td>
          <td><span class="branch-pill">${d.branch}</span></td>
          <td>${statusBadge(d.status)}</td>
          <td>${formatDeployTime(d.timestamp)}</td>
        </tr>
      `).join('');
    } catch (err) {
      console.error('Error fetching deployments:', err);
    }
  }

  // Load deployments immediately and refresh every 30 seconds
  fetchDeployments();
  setInterval(fetchDeployments, 30000);

  // -------------------------------------------------------------
  // Integration Status Panel — Real Badge Updates
  // -------------------------------------------------------------

  // Maps API integration keys → DOM element IDs
  const INTEGRATION_BADGE_IDS = {
    cloudwatch:     'badge-cloudwatch',
    github_actions: 'badge-github-actions',
    ec2:            'badge-ec2',
    s3:             'badge-s3',
    nginx:          'badge-nginx',
    pm2:            'badge-pm2'
  };

  // Maps status level → CSS class
  const STATUS_CLASS = {
    ok:      'status-ok',
    warn:    'status-warn',
    error:   'status-error',
    unknown: 'status-unknown'
  };

  async function fetchIntegrations() {
    try {
      const response = await fetch('/api/integrations');
      if (!response.ok) throw new Error('Integrations API failed');
      const data = await response.json();

      Object.entries(INTEGRATION_BADGE_IDS).forEach(([key, elId]) => {
        const el = document.getElementById(elId);
        if (!el) return;

        const info = data.integrations[key];
        if (!info) return;

        // Update text label
        el.textContent = info.label;

        // Swap CSS class — remove all status classes first, then add correct one
        el.classList.remove('status-ok', 'status-warn', 'status-error', 'status-unknown');
        el.classList.add(STATUS_CLASS[info.status] || 'status-unknown');

        // Set a tooltip title with the detail message
        el.title = info.detail;
      });
    } catch (err) {
      console.error('Error fetching integration statuses:', err);
    }
  }

  // Check integrations immediately on load, then every 10 seconds
  fetchIntegrations();
  setInterval(fetchIntegrations, 10000);

  // -------------------------------------------------------------
  // Infrastructure Component Hover Details
  // -------------------------------------------------------------
  const nodeMetadata = {
    'user': {
      title: 'Client User (Web Browser)',
      desc: 'Renders the static operations HTML dashboard, starts WebSocket/HTTP fetching channels, and schedules Chart.js visual metrics loops.'
    },
    'internet': {
      title: 'Internet Gateway (DNS & VPC NAT Gateway)',
      desc: 'Inbound requests translate via Route 53 and enter the AWS VPC routing layers, ensuring DDoS prevention filters traffic.'
    },
    'nginx': {
      title: 'Nginx Reverse Proxy',
      desc: 'Handles SSL/TLS handshakes, buffers static HTML resources, and forwards node routing commands to Port 3000.'
    },
    'express': {
      title: 'Express Node.js Application',
      desc: 'Coordinates endpoints for system information, process logs, and health status variables, returning JSON diagnostics.'
    },
    'pm2': {
      title: 'PM2 Cluster Manager',
      desc: 'Process supervisor ensuring zero-downtime micro-reloads, resource auto-clustering, memory watchdog thresholds, and log captures.'
    },
    'ec2': {
      title: 'AWS EC2 Compute VM',
      desc: 'Ubuntu Server LTS virtual machine hosting database connections and operational logic inside a private security subnet.'
    },
    'github': {
      title: 'GitHub Repositories',
      desc: 'Source code management system forwarding automated webhook calls to GitHub Actions upon git commit push events.'
    },
    'github-actions': {
      title: 'GitHub Actions (CI/CD Runner)',
      desc: 'Automates deployment jobs: executes code lint validation, initiates test suits, and executes SSH scripts on EC2 compute node.'
    },
    'cloudwatch': {
      title: 'Amazon CloudWatch Daemon',
      desc: 'AWS metrics logging system resolving compute load parameters, storage alarms, network limits, and process console dumps.'
    },
    's3': {
      title: 'Amazon S3 Object Storage',
      desc: 'High durability bucket backing up historical databases, deployment releases, and web system environment variables.'
    }
  };

  const diagNodes = document.querySelectorAll('.diagram-node-card');
  const tooltipTitle = document.getElementById('tooltip-title');
  const tooltipDesc = document.getElementById('tooltip-desc');
  const tooltipBox = document.getElementById('diagram-tooltip');

  diagNodes.forEach(node => {
    node.addEventListener('mouseenter', () => {
      const type = node.getAttribute('data-node');
      const meta = nodeMetadata[type];
      if (meta) {
        tooltipBox.style.borderColor = 'var(--accent-color)';
        tooltipTitle.textContent = meta.title;
        tooltipDesc.textContent = meta.desc;
      }
    });

    node.addEventListener('mouseleave', () => {
      // Return to baseline guidance after short latency
      tooltipBox.style.borderColor = 'var(--border-color)';
    });
  });

  // -------------------------------------------------------------
  // API Tester Panel Console
  // -------------------------------------------------------------
  const btnRunTest = document.getElementById('btn-run-test');
  const apiSelector = document.getElementById('api-endpoint-selector');
  const tStatusVal = document.getElementById('tester-status-val');
  const tTimeVal = document.getElementById('tester-time-val');
  const tIndicatorVal = document.getElementById('tester-indicator-val');
  const tOutputCode = document.getElementById('tester-output-code');

  btnRunTest.addEventListener('click', async () => {
    const route = apiSelector.value;
    
    // Clear outputs, set loading indicators
    tStatusVal.className = 't-val text-secondary';
    tStatusVal.textContent = 'PENDING...';
    tTimeVal.textContent = 'Measuring...';
    tIndicatorVal.innerHTML = '<i data-lucide="loader-2" class="spin-icon text-secondary"></i>';
    if (typeof lucide !== 'undefined') lucide.createIcons();
    tOutputCode.textContent = '// Sending HTTP GET request to backend...';

    const tStart = performance.now();
    try {
      const response = await fetch(route);
      const tEnd = performance.now();
      const elapsed = Math.round(tEnd - tStart);
      const data = await response.json();

      // Update response metrics
      tStatusVal.textContent = `${response.status} ${response.statusText || 'OK'}`;
      tTimeVal.textContent = `${elapsed} ms`;

      if (response.ok) {
        tStatusVal.className = 't-val text-green';
        tIndicatorVal.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>';
      } else {
        tStatusVal.className = 't-val text-error';
        tIndicatorVal.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';
      }

      // Pretty print JSON response payload
      tOutputCode.textContent = JSON.stringify(data, null, 2);

    } catch (err) {
      const tEnd = performance.now();
      const elapsed = Math.round(tEnd - tStart);

      tStatusVal.textContent = 'ERR';
      tStatusVal.className = 't-val text-error';
      tTimeVal.textContent = `${elapsed} ms`;
      tIndicatorVal.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';
      tOutputCode.textContent = JSON.stringify({ error: err.message, status: 'Connection Failed' }, null, 2);
    }
  });

  // Copy tester output JSON payload
  document.getElementById('btn-copy-tester-payload').addEventListener('click', () => {
    const code = tOutputCode.textContent;
    navigator.clipboard.writeText(code).then(() => {
      showToast('API response JSON payload copied.');
    }).catch(() => {
      showToast('Copy failed.');
    });
  });

  // -------------------------------------------------------------
  // Sidebar tab activation (smooth scroll highlighting)
  // -------------------------------------------------------------
  const sidebarLinks = document.querySelectorAll('.sidebar-link');
  const sections = document.querySelectorAll('.viewport-section');

  window.addEventListener('scroll', () => {
    let currentSectionId = 'overview';
    const mainViewport = document.querySelector('.dashboard-viewport');
    
    // Check which section is in view inside the scrollable container
    sections.forEach(sec => {
      const top = sec.offsetTop - 120;
      const height = sec.clientHeight;
      const scrollPos = mainViewport ? mainViewport.scrollTop : window.scrollY;

      if (scrollPos >= top && scrollPos < top + height) {
        currentSectionId = sec.getAttribute('id');
      }
    });

    sidebarLinks.forEach(link => {
      link.classList.remove('active');
      if (link.getAttribute('href') === `#${currentSectionId}`) {
        link.classList.add('active');
      }
    });
  });

});
