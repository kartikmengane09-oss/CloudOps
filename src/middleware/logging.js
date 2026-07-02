const morgan = require('morgan');
const config = require('../config/environment');

// Use Apache-style 'combined' logging format in production, and compact 'dev' logging locally
const format = config.nodeEnv === 'production' ? 'combined' : 'dev';

const requestLogger = morgan(format);

module.exports = requestLogger;
