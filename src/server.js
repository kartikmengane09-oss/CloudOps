const app = require('./app');
const config = require('./config/environment');

const server = app.listen(config.port, () => {
  console.log('========================================');
  console.log(' DeployPilot Dashboard Server Booted');
  console.log(` Port:        ${config.port}`);
  console.log(` Environment: ${config.nodeEnv}`);
  console.log(` URL:         http://localhost:${config.port}`);
  console.log('========================================');
});

/**
 * Graceful Shutdown Handler
 * Safely stops the HTTP listener, allowing in-flight requests to complete.
 */
const shutdown = (signal) => {
  console.log(`\n[INFO] Received signal ${signal}. Starting graceful shutdown...`);

  // Set a safety timeout to force exit after 8 seconds
  const forceTimeout = setTimeout(() => {
    console.error('[ERROR] Graceful shutdown timed out. Forcing process termination.');
    process.exit(1);
  }, 8000);

  server.close(() => {
    console.log('[INFO] Server closed. Active HTTP connections completed.');
    clearTimeout(forceTimeout);
    
    console.log('[INFO] Database and cleanup connections resolved. Exiting.');
    process.exit(0);
  });
};

// Register event listeners for Unix terminate signals
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
