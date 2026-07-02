const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env located at the root of the project
dotenv.config({ path: path.join(__dirname, '../../.env') });

/**
 * Validated configuration export
 */
const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'production',
  allowedOrigins: (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(','),
  deploymentVersion: process.env.DEPLOYMENT_VERSION || 'v1.0.0 Stable',
  buildNumber: process.env.BUILD_NUMBER || '20260702.48',
  environmentName: process.env.ENVIRONMENT || 'production'
};

// Validate that important configs are available
if (isNaN(config.port)) {
  console.error('[FATAL] Configured PORT is not a valid number. Defaulting to 3000.');
  config.port = 3000;
}

module.exports = config;
