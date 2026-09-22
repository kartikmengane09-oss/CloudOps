'use strict';

/**
 * deploymentsController.js
 * Handles GET /api/deployments
 *
 * Deployment history is loaded from data/deployments.json at startup.
 * S3 is used as durable backup storage.
 */

const path = require('path');
const { uploadDeployments } = require('../services/s3Service');

// Load once at startup — deterministic, no randomness
let deployments = [];

try {
  deployments = require(
    path.join(__dirname, '../../data/deployments.json')
  );

  // Ensure newest first
  deployments.sort(
    (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
  );

  // Back up deployment history to S3 without blocking application startup.
  uploadDeployments(deployments)
    .then(() => {
      console.log('[S3] Deployment history backup completed');
    })
    .catch((err) => {
      console.error(
        '[S3] Deployment history backup failed:',
        err.message
      );
    });

} catch (err) {
  console.error(
    '[ERROR] Could not load data/deployments.json:',
    err.message
  );
}

/**
 * GET /api/deployments
 * Returns full deployment history.
 */
function getDeployments(req, res) {
  res.json({
    count: deployments.length,
    deployments,

    // Reserved for AWS CloudWatch / EventBridge extension
    cloudwatch: {
      enabled: false,
      namespace: 'DeployPilot/Deployments',
      dimensions: []
    }
  });
}

module.exports = { getDeployments };