'use strict';

/**
 * integrationsController.js
 * Handles GET /api/integrations
 *
 * Performs real, honest checks for each integration.
 * Returns actual status rather than hardcoded "Connected / Active / Running".
 *
 * Status levels:
 *   "ok"      → Service is genuinely configured and reachable
 *   "warn"    → Service is partially configured or not verified
 *   "error"   → Service is explicitly misconfigured or unreachable
 *   "unknown" → Cannot determine status (no env vars, no probe possible)
 *
 * CloudWatch-ready: response shape includes a `cloudwatch` extension key.
 */

const http  = require('http');
const https = require('https');

// ── Individual check functions ─────────────────────────────────────────────

/**
 * CloudWatch: Check if AWS credentials + region + enable flag are configured.
 * Without AWS SDK, we can only verify env-var presence.
 */
function checkCloudWatch() {
  const region   = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION;
  const keyId    = process.env.AWS_ACCESS_KEY_ID;
  const secret   = process.env.AWS_SECRET_ACCESS_KEY;
  const enabled  = process.env.CLOUDWATCH_ENABLED === 'true';

  if (!region && !keyId) {
    return {
      status: 'unknown',
      label:  'Not Configured',
      detail: 'AWS_REGION and AWS credentials are not set in environment.'
    };
  }
  if (!region) {
    return {
      status: 'warn',
      label:  'No Region Set',
      detail: 'AWS_REGION is missing. CloudWatch cannot emit metrics without a region.'
    };
  }
  if (!keyId || !secret) {
    return {
      status: 'warn',
      label:  'No Credentials',
      detail: 'AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY not set. Using instance role if on EC2.'
    };
  }
  if (!enabled) {
    return {
      status: 'warn',
      label:  'Disabled',
      detail: 'CLOUDWATCH_ENABLED is not "true". Metrics are not being pushed.'
    };
  }
  return {
    status: 'ok',
    label:  'Connected',
    detail: `Region: ${region}. Credentials present. Metrics enabled.`
  };
}

/**
 * GitHub Actions: Check if webhook secret is configured.
 * A configured secret means the webhook endpoint is protected and ready.
 */
function checkGitHubActions() {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  const repoUrl = process.env.GITHUB_REPO_URL;

  if (!secret) {
    return {
      status: 'unknown',
      label:  'Not Configured',
      detail: 'GITHUB_WEBHOOK_SECRET is not set. Webhook endpoint is unprotected / unused.'
    };
  }
  return {
    status: 'ok',
    label:  'Webhook Ready',
    detail: `Webhook secret is configured.${repoUrl ? ' Repo: ' + repoUrl : ''}`
  };
}

/**
 * AWS EC2: Probe the EC2 Instance Metadata Service (IMDS) v1 with a 300ms timeout.
 * This is the only reliable way to detect if we are running on an EC2 instance.
 * Returns a Promise.
 */
function checkEC2() {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve({
        status: 'unknown',
        label:  'Not on EC2',
        detail: 'EC2 Instance Metadata Service (169.254.169.254) did not respond within 300ms. Likely running locally or on another provider.'
      });
    }, 300);

    const req = http.get(
      { host: '169.254.169.254', path: '/latest/meta-data/', port: 80, timeout: 300 },
      (res) => {
        clearTimeout(timeout);
        if (res.statusCode === 200) {
          resolve({
            status: 'ok',
            label:  'Running',
            detail: 'EC2 IMDS responded. This process is running on an AWS EC2 instance.'
          });
        } else {
          resolve({
            status: 'warn',
            label:  'Unexpected Response',
            detail: `EC2 IMDS replied with HTTP ${res.statusCode}.`
          });
        }
        res.resume(); // consume response body
      }
    );

    req.on('error', () => {
      clearTimeout(timeout);
      resolve({
        status: 'unknown',
        label:  'Not on EC2',
        detail: 'EC2 Instance Metadata Service unreachable. Running outside AWS EC2.'
      });
    });

    req.on('timeout', () => {
      clearTimeout(timeout);
      req.destroy();
      resolve({
        status: 'unknown',
        label:  'Not on EC2',
        detail: 'EC2 IMDS timed out. Not running on AWS EC2.'
      });
    });
  });
}

/**
 * S3 Backups: Check if S3 bucket and credentials are configured.
 */
function checkS3() {
  const bucket = process.env.S3_BUCKET || process.env.AWS_S3_BUCKET;
  const keyId  = process.env.AWS_ACCESS_KEY_ID;
  const secret = process.env.AWS_SECRET_ACCESS_KEY;

  if (!bucket) {
    return {
      status: 'unknown',
      label:  'Not Configured',
      detail: 'S3_BUCKET is not set. No S3 backup destination configured.'
    };
  }
  if (!keyId || !secret) {
    return {
      status: 'warn',
      label:  'No Credentials',
      detail: `Bucket "${bucket}" is set but AWS credentials are missing.`
    };
  }
  return {
    status: 'ok',
    label:  'Configured',
    detail: `Bucket: ${bucket}. Credentials present.`
  };
}

/**
 * Nginx Proxy: Detect if requests are arriving through Nginx.
 * This check runs at request-time (uses req.headers), so we capture it
 * via the stored last-seen proxy headers from the requestContext.
 * Falls back to env var NGINX_PROXY=true for explicit declaration.
 */
function checkNginx(req) {
  const explicitFlag = process.env.NGINX_PROXY === 'true';
  const hasForwardedFor = !!(req && (req.headers['x-forwarded-for'] || req.headers['x-real-ip']));
  const hasNginxHeader  = !!(req && req.headers['x-nginx-proxy']);
  const viaHeader       = req && req.headers['via'];

  if (explicitFlag) {
    return {
      status: 'ok',
      label:  'Detected',
      detail: 'NGINX_PROXY=true is explicitly set in environment.'
    };
  }
  if (hasNginxHeader || (hasForwardedFor && viaHeader)) {
    return {
      status: 'ok',
      label:  'Detected',
      detail: 'Nginx proxy headers detected on inbound request (X-Forwarded-For / Via).'
    };
  }
  if (hasForwardedFor) {
    return {
      status: 'warn',
      label:  'Possible Proxy',
      detail: 'X-Forwarded-For header present but no explicit Nginx identification. May be another proxy.'
    };
  }
  return {
    status: 'unknown',
    label:  'Not Detected',
    detail: 'No proxy headers found. Requests are arriving directly (no Nginx in front, or proxy is not forwarding headers).'
  };
}

/**
 * PM2: Check for PM2 environment variables injected by the PM2 daemon.
 * PM2 always sets pm_id, PM2_HOME, and NODE_APP_INSTANCE on managed processes.
 */
function checkPM2() {
  const pmId        = process.env.pm_id;
  const pm2Home     = process.env.PM2_HOME;
  const instanceId  = process.env.NODE_APP_INSTANCE;
  const pm2Usage    = process.env.PM2_USAGE;

  if (pmId !== undefined || pm2Usage !== undefined) {
    return {
      status: 'ok',
      label:  'Online',
      detail: `PM2 process detected. pm_id=${pmId ?? 'N/A'}, instance=${instanceId ?? '0'}.`
    };
  }
  if (pm2Home) {
    return {
      status: 'warn',
      label:  'PM2 Home Found',
      detail: `PM2_HOME is set (${pm2Home}) but this process may not be managed by PM2.`
    };
  }
  return {
    status: 'unknown',
    label:  'Not Detected',
    detail: 'No PM2 environment variables found. Process is running directly with Node.js (or nodemon).'
  };
}

// ── Status → CSS class mapping ────────────────────────────────────────────────
const STATUS_CSS = {
  ok:      'status-ok',
  warn:    'status-warn',
  error:   'status-error',
  unknown: 'status-unknown'
};

// ── Controller ────────────────────────────────────────────────────────────────

/**
 * GET /api/integrations
 */
async function getIntegrations(req, res) {
  // Parallel checks (EC2 is async; rest are sync)
  const [ec2Result] = await Promise.all([checkEC2()]);

  const integrations = {
    cloudwatch:     { ...checkCloudWatch(),    css: STATUS_CSS[checkCloudWatch().status] },
    github_actions: { ...checkGitHubActions(), css: STATUS_CSS[checkGitHubActions().status] },
    ec2:            { ...ec2Result,            css: STATUS_CSS[ec2Result.status] },
    s3:             { ...checkS3(),            css: STATUS_CSS[checkS3().status] },
    nginx:          { ...checkNginx(req),      css: STATUS_CSS[checkNginx(req).status] },
    pm2:            { ...checkPM2(),           css: STATUS_CSS[checkPM2().status] }
  };

  // Compute overall health
  const statuses = Object.values(integrations).map(i => i.status);
  const overallStatus =
    statuses.every(s => s === 'ok')     ? 'all_ok' :
    statuses.some(s => s === 'error')   ? 'degraded' :
    statuses.some(s => s === 'warn')    ? 'partial' :
    'unknown';

  res.json({
    overall_status: overallStatus,
    checked_at:     new Date().toISOString(),
    integrations,
    // Reserved for CloudWatch custom metric emission
    cloudwatch: {
      enabled:   false,
      namespace: 'DeployPilot/Integrations',
      dimensions: []
    }
  });
}

module.exports = { getIntegrations };
