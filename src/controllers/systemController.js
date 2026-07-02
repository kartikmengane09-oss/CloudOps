'use strict';

/**
 * systemController.js
 * Handles GET /api/system
 *
 * Returns real system-level information gathered from Node.js built-in
 * modules (os, process). The response shape includes a reserved `cloudwatch`
 * key so AWS CloudWatch metric dimensions can be added later without any
 * frontend changes.
 */

const os      = require('os');
const path    = require('path');
const config  = require('../config/environment');

// Resolve Express version once at startup from package.json
let expressVersion = 'unknown';
try {
  const pkgPath = path.join(__dirname, '../../node_modules/express/package.json');
  expressVersion = require(pkgPath).version;
} catch (_) { /* safe fallback */ }

/**
 * GET /api/system
 * Returns full system metadata and runtime diagnostics.
 */
function getSystem(req, res) {
  const memTotal = os.totalmem();
  const memFree  = os.freemem();
  const memUsed  = memTotal - memFree;
  const procMem  = process.memoryUsage();

  const data = {
    // Host identity
    hostname:      os.hostname(),
    platform:      os.platform(),
    architecture:  os.arch(),
    os_release:    os.release(),

    // Runtime
    node_version:       process.version,
    express_version:    expressVersion,
    process_id:         process.pid,
    server_uptime_s:    Math.round(process.uptime()),
    server_time:        new Date().toISOString(),
    server_time_utc:    new Date().toUTCString(),
    timezone:           Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',

    // CPU
    cpu_count:    os.cpus().length,
    cpu_model:    os.cpus()[0]?.model ?? 'N/A',
    load_avg_1m:  parseFloat(os.loadavg()[0].toFixed(4)),
    load_avg_5m:  parseFloat(os.loadavg()[1].toFixed(4)),
    load_avg_15m: parseFloat(os.loadavg()[2].toFixed(4)),

    // Memory (bytes)
    memory: {
      total_bytes:   memTotal,
      free_bytes:    memFree,
      used_bytes:    memUsed,
      used_pct:      parseFloat(((memUsed / memTotal) * 100).toFixed(2)),
      free_pct:      parseFloat(((memFree / memTotal) * 100).toFixed(2)),
      total_gb:      parseFloat((memTotal / 1073741824).toFixed(2)),
      free_gb:       parseFloat((memFree  / 1073741824).toFixed(2)),
    },

    // Process heap memory
    process_memory: {
      rss_mb:          parseFloat((procMem.rss          / 1048576).toFixed(2)),
      heap_total_mb:   parseFloat((procMem.heapTotal     / 1048576).toFixed(2)),
      heap_used_mb:    parseFloat((procMem.heapUsed      / 1048576).toFixed(2)),
      external_mb:     parseFloat((procMem.external      / 1048576).toFixed(2)),
    },

    // App config (from environment)
    environment:        config.environmentName,
    deployment_version: config.deploymentVersion,
    build_number:       config.buildNumber,

    // Reserved for AWS CloudWatch integration — extend here without UI changes
    cloudwatch: {
      enabled:    false,
      namespace:  'DeployPilot/System',
      dimensions: []
    }
  };

  res.json(data);
}

module.exports = { getSystem };
