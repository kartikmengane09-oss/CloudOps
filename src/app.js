const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');

const config = require('./config/environment');
const requestLogger = require('./middleware/logging');
const { notFoundHandler, errorHandler } = require('./middleware/error');
const logStream = require('./utils/logStream');
const morgan = require('morgan');
const routes = require('./routes');

const app = express();

// 1. Parse JSON and URL-encoded bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 2. Request Logging via Morgan (console) + Log Buffer capture (Live Logs terminal)
app.use(requestLogger);
const logFormat = config.nodeEnv === 'production' ? 'combined' : 'dev';
app.use(morgan(logFormat, { stream: logStream }));

// 3. Response Compression using gzip
app.use(compression());

// 4. Security Headers (Helmet) with customized CSP to allow Lucide and Chart.js CDNs
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://unpkg.com", "https://cdn.jsdelivr.net", "'unsafe-inline'"],
      styleSrc: ["'self'", "https://fonts.googleapis.com", "'unsafe-inline'"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https://unpkg.com"],
      connectSrc: ["'self'"]
    }
  }
}));

// 5. CORS configuration with dynamic environment parsing
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like local cURL or tests)
    if (!origin) return callback(null, true);
    
    if (config.allowedOrigins.indexOf(origin) !== -1 || config.allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS policy'));
    }
  },
  credentials: true
}));

// 6. Static asset serving
app.use(express.static(path.join(__dirname, '../public')));

// 7. Route Mounting
app.use(routes);

// 8. Centralized Error Handling middlewares
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
