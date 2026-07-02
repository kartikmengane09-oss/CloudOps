const express = require('express');
const router = express.Router();
const apiRouter = require('./api');

// Mount API routes
// The metrics dashboard calls endpoint patterns directly (e.g. /health, /time, /api/logs)
// So we mount them directly on the root router path to maintain compatibility.
router.use('/', apiRouter);

module.exports = router;
