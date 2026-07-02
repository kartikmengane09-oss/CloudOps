'use strict';

/**
 * logsController.js
 * Handles GET /api/logs
 *
 * Serves application log entries from the shared logBuffer ring buffer.
 * Sources of log entries:
 *   1. Pre-seeded startup lines (set in logBuffer.js on require)
 *   2. HTTP request lines captured by Morgan via logStream.js
 *
 * Query params:
 *   ?limit=N   Return the last N entries (default: all, max: 200)
 */

const { getAll, getStructured } = require('../utils/logBuffer');

/**
 * GET /api/logs
 */
function getLogs(req, res) {
  const all    = getAll();
  const limit  = Math.min(parseInt(req.query.limit, 10) || all.length, 200);
  const logs   = all.slice(-limit);

  res.json({
    count: logs.length,
    logs,
    // Reserved for CloudWatch Logs integration — extend without UI changes
    cloudwatch: {
      enabled:    false,
      log_group:  '/deploypilot/application',
      log_stream: `pid-${process.pid}`
    }
  });
}

/**
 * GET /api/logs/structured
 * Returns structured log objects (useful for CloudWatch PutLogEvents payloads).
 */
function getLogsStructured(req, res) {
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
  const logs  = getStructured(limit);
  res.json({ count: logs.length, logs });
}

module.exports = { getLogs, getLogsStructured };
