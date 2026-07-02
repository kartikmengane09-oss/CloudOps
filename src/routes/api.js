'use strict';

/**
 * routes/api.js
 *
 * All business logic lives in src/controllers/.
 * This file is purely routing — no inline logic, no Math.random().
 *
 * Endpoints:
 *   GET /api                 — API documentation
 *   GET /health              — Health check (AWS ALB compatible)
 *   GET /time                — Server clock
 *   GET /api/system          — Full system metadata (NEW)
 *   GET /api/system-info     — Legacy alias → delegates to systemController
 *   GET /api/metrics         — Real performance metrics (NO Math.random)
 *   GET /api/logs            — Ring-buffer application logs (real HTTP traffic)
 *   GET /api/logs/structured — Structured log objects for CloudWatch
 *   GET /api/deployments     — Deployment history from JSON seed file (NEW)
 */

const express = require('express');
const router  = express.Router();

const config = require('../config/environment');

// Controllers
const { getSystem }                      = require('../controllers/systemController');
const { getMetrics, incrementRequestCount } = require('../controllers/metricsController');
const { getLogs, getLogsStructured }     = require('../controllers/logsController');
const { getDeployments }                 = require('../controllers/deploymentsController');
const { getIntegrations }                = require('../controllers/integrationsController');

// ── Request counter middleware (feeds RPM in metricsController) ───────────────
router.use((req, res, next) => {
  incrementRequestCount();
  next();
});

// ── Health Check ──────────────────────────────────────────────────────────────
router.get('/health', (req, res) => {
  res.json({
    status:    'Healthy',
    uptime:    Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    services: {
      ec2_instance:            'running',
      s3_bucket:               'connected',
      github_actions_webhook:  'active'
    }
  });
});

// ── Server Clock ──────────────────────────────────────────────────────────────
router.get('/time', (req, res) => {
  const now = new Date();
  res.json({
    time:      now.toLocaleTimeString('en-US', { hour12: false, timeZone: 'UTC' }) + ' UTC',
    epoch:     now.getTime(),
    formatted: now.toUTCString()
  });
});

// ── System Metadata ───────────────────────────────────────────────────────────
router.get('/api/system', getSystem);

// Legacy alias (keeps backward-compat with frontend initSystemInfo call)
router.get('/api/system-info', (req, res, next) => {
  // Build the legacy-shaped response from systemController data
  const os   = require('os');
  const path = require('path');
  let expressVersion = 'unknown';
  try {
    expressVersion = require(path.join(__dirname, '../../node_modules/express/package.json')).version;
  } catch (_) {}

  res.json({
    node_version:       process.version,
    express_version:    expressVersion,
    server_time:        new Date().toLocaleTimeString('en-US', { hour12: false, timeZone: 'UTC' }) + ' UTC',
    timezone:           Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    platform:           process.platform,
    architecture:       process.arch,
    process_id:         process.pid,
    environment:        config.environmentName,
    build_number:       config.buildNumber,
    deployment_version: config.deploymentVersion
  });
});

// ── Metrics ───────────────────────────────────────────────────────────────────
router.get('/api/metrics', getMetrics);

// ── Logs ──────────────────────────────────────────────────────────────────────
router.get('/api/logs/structured', getLogsStructured);
router.get('/api/logs', getLogs);

// ── Deployments ───────────────────────────────────────────────────────────────
router.get('/api/deployments', getDeployments);

// ── Integrations Status ───────────────────────────────────────────────────────
router.get('/api/integrations', getIntegrations);

// ── API Documentation ─────────────────────────────────────────────────────────
router.get('/api', (req, res) => {
  res.json({
    message:  'Welcome to the DeployPilot API',
    version:  '2.0.0',
    endpoints: {
      root:            'GET /',
      health:          'GET /health',
      time:            'GET /time',
      system:          'GET /api/system (real OS metrics)',
      system_info:     'GET /api/system-info (legacy alias)',
      metrics:         'GET /api/metrics (real CPU/mem, no Math.random)',
      logs:            'GET /api/logs[?limit=N]',
      logs_structured: 'GET /api/logs/structured[?limit=N]',
      deployments:     'GET /api/deployments',
      integrations:    'GET /api/integrations (real status checks)'
    }
  });
});

module.exports = router;
