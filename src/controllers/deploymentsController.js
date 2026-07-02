'use strict';

/**
 * deploymentsController.js
 * Handles GET /api/deployments
 *
 * Loads deployment history from data/deployments.json at startup (synchronous
 * require — file is small and only read once). Returns the array sorted by
 * timestamp descending (most recent first).
 *
 * Shape is CloudWatch-ready: a `cloudwatch` key is reserved so future
 * EventBridge / CodeDeploy webhook data can extend the response without
 * frontend modifications.
 */

const path = require('path');

// Load once at startup — deterministic, no randomness
let deployments = [];
try {
  deployments = require(path.join(__dirname, '../../data/deployments.json'));
  // Ensure newest first
  deployments.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
} catch (err) {
  console.error('[ERROR] Could not load data/deployments.json:', err.message);
}

/**
 * GET /api/deployments
 * Returns full deployment history.
 */
function getDeployments(req, res) {
  res.json({
    count: deployments.length,
    deployments,
    // Reserved for AWS CodeDeploy / EventBridge extension
    cloudwatch: {
      enabled:    false,
      namespace:  'DeployPilot/Deployments',
      dimensions: []
    }
  });
}

module.exports = { getDeployments };
