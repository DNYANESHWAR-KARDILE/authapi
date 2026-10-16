const path = require('path');
// Load environment variables from server/.env if present, then cwd
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const authRoutes = require('./routes/authRoutes');

// 1. Validate required environment variables at startup
const requiredEnvVars = ['MONGODB_URI', 'JWT_SECRET'];
const missingVars = requiredEnvVars.filter((key) => !process.env[key]);

if (missingVars.length > 0) {
  console.error(
    `[Startup Warning] Missing critical environment variables: ${missingVars.join(', ')}`
  );
  if (process.env.NODE_ENV === 'production') {
    console.error('[Startup Warning] Please configure these environment variables in your deployment settings.');
  }
}

if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
  console.warn(
    '[Startup Warning] EMAIL_USER or EMAIL_PASS is not configured. Email OTP delivery will fail until configured.'
  );
}

const app = express();
const PORT = process.env.PORT || 5000;

// Trust reverse proxy (Railway, Vercel, load balancers)
// Essential for secure cookies (req.secure) and accurate client IP in express-rate-limit
app.set('trust proxy', 1);

// 2. Dynamic CORS configuration for production and local development
const rawClientUrls = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(',').map((url) => url.trim().replace(/\/+$/, ''))
  : ['http://localhost:5173', 'http://localhost:3000'];

const isProduction = process.env.NODE_ENV === 'production';

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (such as mobile apps, curl, server-to-server, or same-origin)
      if (!origin) return callback(null, true);

      const normalizedOrigin = origin.replace(/\/+$/, '');

      // Check configured client origins
      if (rawClientUrls.includes(normalizedOrigin)) {
        return callback(null, true);
      }

      // In non-production, permit any localhost origin
      if (!isProduction && /^https?:\/\/localhost(:\d+)?$/.test(normalizedOrigin)) {
        return callback(null, true);
      }

      console.warn(`[CORS] Blocked request from unauthorized origin: ${origin}`);
      return callback(new Error(`CORS policy does not allow access from origin ${origin}`));
    },
    credentials: true, // Necessary for HttpOnly cookies across origins
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// 3. Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// 4. API Routes
app.use('/api/auth', authRoutes);

// 5. Health Check Endpoints (Railway uses GET /health)
const getHealthStatus = (req, res) => {
  const isDbReady = mongoose.connection.readyState === 1;
  const status = isDbReady ? 'ok' : 'degraded';

  res.status(200).json({
    status,
    service: 'backend',
    database: isDbReady ? 'connected' : 'disconnected',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
};

app.get('/health', getHealthStatus);
app.get('/api/health', getHealthStatus);

// 6. Global 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `API Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// 7. Global Error Handler (Sanitizes stack traces for safety)
app.use((err, req, res, next) => {
  console.error('[Unhandled Error]:', err.message || err);
  const status = err.status || 500;
  res.status(status).json({
    success: false,
    message:
      process.env.NODE_ENV === 'production'
        ? 'Internal server error.'
        : err.message || 'Something went wrong.',
  });
});

// 8. Connect to MongoDB and start the server
// Listen on 0.0.0.0 so Railway / container ingress can reach the process
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Server] Express listening on port ${PORT} (0.0.0.0)`);
  console.log(`[CORS] Allowed origins: ${rawClientUrls.join(', ')}`);
});

const mongoUri = process.env.MONGODB_URI;

if (mongoUri) {
  mongoose
    .connect(mongoUri, {
      serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of hanging 30s
    })
    .then(() => {
      const host = mongoose.connection.host || 'cluster';
      console.log(`[Database] MongoDB connected successfully to host: ${host}`);
    })
    .catch((error) => {
      console.error(`[Database Error] Could not connect to MongoDB: ${error.message}`);
      console.log(
        '[Notice] Check your MONGODB_URI (e.g. MongoDB Atlas) and ensure Network Access (IP Whitelist) allows connection.'
      );
    });
} else {
  console.warn('[Database Notice] MONGODB_URI is not set. Database operations will be unavailable.');
}

module.exports = app;
