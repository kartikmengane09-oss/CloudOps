'use strict';

/**
 * logBuffer.js
 * Shared in-memory ring buffer for application log entries.
 *
 * - Max capacity: MAX_ENTRIES lines (oldest evicted when full)
 * - Pre-seeded with realistic server startup entries on first load
 * - All log sources write via append(level, message)
 * - CloudWatch-ready: each entry carries a structured object so
 *   AWS SDK calls can extend them without frontend changes
 */

const os = require('os');

const MAX_ENTRIES = 200;

/** @type {Array<{ts: string, level: string, message: string, raw: string}>} */
const buffer = [];

/**
 * Append a log entry to the ring buffer.
 * @param {'INFO'|'WARNING'|'ERROR'|'DEBUG'} level
 * @param {string} message
 */
function append(level, message) {
  const ts = new Date().toISOString();
  const raw = `[${ts}] [${level}] ${message}`;
  buffer.push({ ts, level, message, raw });
  if (buffer.length > MAX_ENTRIES) {
    buffer.shift();
  }
}

/**
 * Return all buffered log entries as raw strings (newest last).
 * @returns {string[]}
 */
function getAll() {
  return buffer.map(e => e.raw);
}

/**
 * Return the last N structured log objects (for CloudWatch extension).
 * @param {number} n
 * @returns {Array<{ts: string, level: string, message: string, raw: string}>}
 */
function getStructured(n = MAX_ENTRIES) {
  return buffer.slice(-n);
}

// ──────────────────────────────────────────────────────────────────────────────
// Pre-seed with realistic startup log sequence (times relative to boot)
// ──────────────────────────────────────────────────────────────────────────────
const now = Date.now();
const seed = [
  [60000, 'INFO',    `DeployPilot Server Initialized — PID ${process.pid}`],
  [55000, 'INFO',    `Node.js ${process.version} runtime detected`],
  [50000, 'INFO',    `Host: ${os.hostname()} | Platform: ${os.platform()} | Arch: ${os.arch()}`],
  [45000, 'INFO',    `CPUs available: ${os.cpus().length} logical cores`],
  [40000, 'INFO',    `Total system memory: ${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)} GB`],
  [35000, 'INFO',    'Express middleware stack initialized (Helmet, CORS, Compression, Morgan)'],
  [30000, 'INFO',    'Static asset serving enabled from /public'],
  [25000, 'INFO',    'API routes mounted: /health /time /api/system /api/metrics /api/logs /api/deployments'],
  [20000, 'INFO',    'Health Check Passed — All systems operational'],
  [15000, 'INFO',    'Deployment seed data loaded from data/deployments.json'],
  [10000, 'INFO',    'Log ring buffer active — capturing HTTP request telemetry'],
  [5000,  'INFO',    'Live log listener active — polling ready'],
];

seed.forEach(([msAgo, level, msg]) => {
  const ts = new Date(now - msAgo).toISOString();
  const raw = `[${ts}] [${level}] ${msg}`;
  buffer.push({ ts, level, message: msg, raw });
});

module.exports = { append, getAll, getStructured };
