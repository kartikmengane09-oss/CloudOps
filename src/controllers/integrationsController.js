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
const {S3Client,HeadBucketCommand} = require('@aws-sdk/client-s3');

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
 * AWS EC2: Robust 3-stage detection strategy.
 *
 * Stage 1 – Environment variable signals (instant, no network):
 *   AWS sets known env vars in EC2 user-data scripts, ECS tasks, and Lambda.
 *
 * Stage 2 – IMDSv2 (PUT → GET with token):
 *   Required on instances where HttpTokens=required (enforced by AWS best-practice
 *   and required for all new launches from 2024 onwards). A plain GET returns 401,
 *   which the old code misread as "not EC2".
 *
 * Stage 3 – IMDSv1 plain GET fallback:
 *   For older instances that still allow IMDSv1.
 *
 * Returns a Promise that always resolves (never rejects).
 */
function checkEC2() {
  // ── Stage 1: Instant env-var signals ─────────────────────────────────────
  const execEnv    = process.env.AWS_EXECUTION_ENV;          // set by ECS/Lambda
  const ecsMeta    = process.env.ECS_CONTAINER_METADATA_URI; // ECS task
  const ecsMetaV4  = process.env.ECS_CONTAINER_METADATA_URI_V4;
  const instanceId = process.env.EC2_INSTANCE_ID;            // user-data may set this
  const region     = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION;

  if (instanceId) {
    return Promise.resolve({
      status: 'ok',
      label:  'Running',
      detail: `EC2 detected via EC2_INSTANCE_ID env var. Instance: ${instanceId}${region ? ', Region: ' + region : ''}.`
    });
  }
  if (ecsMeta || ecsMetaV4) {
    return Promise.resolve({
      status: 'ok',
      label:  'Running (ECS)',
      detail: `Running inside an ECS container task. Metadata URI: ${ecsMetaV4 || ecsMeta}`
    });
  }
  if (execEnv && execEnv.startsWith('AWS_')) {
    return Promise.resolve({
      status: 'ok',
      label:  'Running',
      detail: `AWS execution environment detected: ${execEnv}.`
    });
  }

  // ── Stage 2 & 3: Probe IMDS with IMDSv2 → IMDSv1 fallback ───────────────
  const IMDS_HOST    = '169.254.169.254';
  const IMDS_TIMEOUT = 500; // ms — generous enough for a local link-local address

  /**
   * Attempt IMDSv2: PUT /latest/api/token to obtain a session token,
   * then GET /latest/meta-data/instance-id with that token.
   * IMDSv2 is required on all instances with HttpTokens=required (the new default).
   */
  function tryIMDSv2() {
    return new Promise((resolve) => {
      const putReq = http.request(
        {
          method:  'PUT',
          host:    IMDS_HOST,
          path:    '/latest/api/token',
          port:    80,
          timeout: IMDS_TIMEOUT,
          headers: { 'X-aws-ec2-metadata-token-ttl-seconds': '21600' }
        },
        (putRes) => {
          let token = '';
          putRes.on('data', (chunk) => { token += chunk.toString(); });
          putRes.on('end', () => {
            if (putRes.statusCode !== 200 || !token) {
              return resolve(null); // escalate to IMDSv1 fallback
            }
            // Got a token — now fetch instance-id
            const getReq = http.get(
              {
                host:    IMDS_HOST,
                path:    '/latest/meta-data/instance-id',
                port:    80,
                timeout: IMDS_TIMEOUT,
                headers: { 'X-aws-ec2-metadata-token': token.trim() }
              },
              (getRes) => {
                let instanceId = '';
                getRes.on('data', (c) => { instanceId += c.toString(); });
                getRes.on('end', () => {
                  if (getRes.statusCode === 200 && instanceId) {
                    resolve({
                      status: 'ok',
                      label:  'Running',
                      detail: `EC2 IMDSv2 confirmed. Instance ID: ${instanceId.trim()}${region ? ', Region: ' + region : ''}.`
                    });
                  } else {
                    resolve(null);
                  }
                });
              }
            );
            getReq.on('error', () => resolve(null));
            getReq.on('timeout', () => { getReq.destroy(); resolve(null); });
          });
        }
      );
      putReq.on('error', () => resolve(null));
      putReq.on('timeout', () => { putReq.destroy(); resolve(null); });
      putReq.end();
    });
  }

  /**
   * Fallback: IMDSv1 plain GET (for older instances where HttpTokens=optional).
   * A 401 response here means IMDSv2 is required but our PUT somehow failed —
   * we still flag it as EC2 since the endpoint is reachable.
   */
  function tryIMDSv1() {
    return new Promise((resolve) => {
      const hardTimeout = setTimeout(() => {
        resolve({
          status:  'unknown',
          label:   'Not Detected',
          detail:  `IMDS at ${IMDS_HOST} did not respond within ${IMDS_TIMEOUT}ms. Running locally or on a non-AWS provider.`
        });
      }, IMDS_TIMEOUT + 100);

      const req = http.get(
        { host: IMDS_HOST, path: '/latest/meta-data/', port: 80, timeout: IMDS_TIMEOUT },
        (res) => {
          clearTimeout(hardTimeout);
          res.resume();
          if (res.statusCode === 200) {
            resolve({
              status: 'ok',
              label:  'Running',
              detail: `EC2 IMDSv1 confirmed. IMDS responded 200.${region ? ' Region: ' + region : ''}`
            });
          } else if (res.statusCode === 401) {
            // 401 means IMDSv2 is enforced but our PUT failed — still on EC2
            resolve({
              status: 'warn',
              label:  'Running (IMDSv2 only)',
              detail: `EC2 IMDS reachable but IMDSv2 is required (HTTP 401 on IMDSv1). Instance is on EC2.${region ? ' Region: ' + region : ''}`
            });
          } else {
            resolve({
              status:  'unknown',
              label:   'Not Detected',
              detail:  `IMDS returned unexpected HTTP ${res.statusCode}. Cannot confirm EC2.`
            });
          }
        }
      );
      req.on('error', () => {
        clearTimeout(hardTimeout);
        resolve({
          status:  'unknown',
          label:   'Not Detected',
          detail:  'IMDS unreachable. Not running on AWS EC2, or IMDS is disabled on this instance.'
        });
      });
      req.on('timeout', () => {
        clearTimeout(hardTimeout);
        req.destroy();
        resolve({
          status:  'unknown',
          label:   'Not Detected',
          detail:  `IMDS timed out after ${IMDS_TIMEOUT}ms. Running outside AWS EC2.`
        });
      });
    });
  }

  // Run IMDSv2 first; if it resolves null (failed), fall back to IMDSv1
  return tryIMDSv2().then((result) => result !== null ? result : tryIMDSv1());
}

/**
 * S3 Backups: Check if S3 bucket and credentials are configured.
 */
function checkS3() {
  async function checkS3() {
  const bucket =
    process.env.S3_BUCKET ||
    process.env.AWS_S3_BUCKET ||
    'cloudops-deploypilot-bucket';

  const region =
    process.env.AWS_REGION ||
    process.env.AWS_DEFAULT_REGION ||
    'eu-north-1';

  try {
    const s3 = new S3Client({
      region
    });

    await s3.send(
      new HeadBucketCommand({
        Bucket: bucket
      })
    );

    return {
      status: 'ok',
      label: 'Connected',
      detail: `Bucket: ${bucket}. S3 is reachable using AWS credentials.`
    };
  } catch (err) {
    return {
      status: 'error',
      label: 'Unavailable',
      detail: `Unable to access bucket "${bucket}": ${err.message}`
    };
  }
 }
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
  // Run all checks — EC2 is async (IMDS probe); rest are sync
  const [
    cwResult,
    ghResult,
    ec2Result,
    s3Result,
    nginxResult,
    pm2Result
  ] = await Promise.all([
    Promise.resolve(checkCloudWatch()),
    Promise.resolve(checkGitHubActions()),
    checkEC2(),
    Promise.resolve(checkS3()),
    Promise.resolve(checkNginx(req)),
    Promise.resolve(checkPM2())
  ]);

  const addCss = (r) => ({ ...r, css: STATUS_CSS[r.status] || 'status-unknown' });

  const integrations = {
    cloudwatch:     addCss(cwResult),
    github_actions: addCss(ghResult),
    ec2:            addCss(ec2Result),
    s3:             addCss(s3Result),
    nginx:          addCss(nginxResult),
    pm2:            addCss(pm2Result)
  };

  // Compute overall health
  const statuses = Object.values(integrations).map(i => i.status);
  const overallStatus =
    statuses.every(s => s === 'ok')   ? 'all_ok'  :
    statuses.some(s => s === 'error') ? 'degraded' :
    statuses.some(s => s === 'warn')  ? 'partial'  :
    'unknown';

  res.json({
    overall_status: overallStatus,
    checked_at:     new Date().toISOString(),
    integrations,
    // Reserved for CloudWatch custom metric emission
    cloudwatch: {
      enabled:    false,
      namespace:  'DeployPilot/Integrations',
      dimensions: []
    }
  });
}

module.exports = { getIntegrations };
