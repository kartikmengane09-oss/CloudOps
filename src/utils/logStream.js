'use strict';

/**
 * logStream.js
 * A Node.js Writable stream passed to Morgan as its output destination.
 *
 * Morgan calls stream.write(line) for every HTTP request.
 * We parse the line and append it to the shared logBuffer so that
 * all inbound HTTP requests appear in the Live Logs terminal automatically.
 *
 * Usage (in app.js):
 *   const logStream = require('./utils/logStream');
 *   app.use(morgan('combined', { stream: logStream }));
 */

const { Writable } = require('stream');
const { append } = require('./logBuffer');

const logStream = new Writable({
  /**
   * Morgan writes one log line per request (ends with \n).
   * We trim whitespace and classify as INFO or WARNING based on status code.
   */
  write(chunk, _encoding, callback) {
    const line = chunk.toString().trim();
    if (!line) return callback();

    // Extract HTTP status code immediately after "HTTP/1.x" or "HTTP/2" in the log line.
    // Anchoring on the HTTP protocol string avoids false positives from response byte sizes.
    const statusMatch = line.match(/HTTP\/[\d.]+" (\d{3})/);
    const statusCode  = statusMatch ? parseInt(statusMatch[1], 10) : 0;

    const level = statusCode >= 500 ? 'ERROR'
                : statusCode >= 400 ? 'WARNING'
                : statusCode >= 300 ? 'WARNING'
                : 'INFO';
    append(level, `[HTTP] ${line}`);

    callback();
  }
});

module.exports = logStream;
