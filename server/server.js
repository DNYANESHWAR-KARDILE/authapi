
const path = require('path');

// Load environment variables
require('dotenv').config({
  path: path.resolve(__dirname, '.env'),
});
require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const authRoutes = require('./routes/authRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Trust proxy for Render / Railway
app.set('trust proxy', 1);

// --------------------------------------------------
// ENVIRONMENT VARIABLES
// --------------------------------------------------

const requiredEnvVars = ['MONGODB_URI', 'JWT_SECRET'];

const missingVars = requiredEnvVars.filter(
  (key) => !process.env[key]
);

if (missingVars.length > 0) {
  console.error(
    `[Startup Warning] Missing environment variables: ${missingVars.join(', ')}`
  );
}

if (!process.env.BREVO_API_KEY || !process.env.BREVO_SENDER_EMAIL) {
  console.warn(
    '[Startup Warning] BREVO_API_KEY or BREVO_SENDER_EMAIL is missing. Email OTP delivery will fail.'
  );
}


// --------------------------------------------------
// CORS CONFIGURATION
// --------------------------------------------------

const defaultOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
];

const envOrigins = process.env.CLIENT_URL
  ? process.env.CLIENT_URL
      .split(',')
      .map((url) => url.trim().replace(/\/+$/, ''))
      .filter(Boolean)
  : [];

const allowedOrigins = [
  ...new Set([...defaultOrigins, ...envOrigins]),
];

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests without an Origin header
    if (!origin) {
      return callback(null, true);
    }

    const normalizedOrigin = origin.replace(/\/+$/, '');

    // Allow explicitly configured origins
    if (allowedOrigins.includes(normalizedOrigin)) {
      return callback(null, true);
    }

    // Allow standard Vercel deployment domains
    const isVercelOrigin =
      /^https:\/\/[a-zA-Z0-9_-]+\.vercel\.app$/.test(
        normalizedOrigin
      );

    if (isVercelOrigin) {
      return callback(null, true);
    }

    console.warn(`[CORS] Blocked origin: ${origin}`);

    return callback(new Error('Not allowed by CORS'));
  },

  credentials: true,

  methods: [
    'GET',
    'POST',
    'PUT',
    'PATCH',
    'DELETE',
    'OPTIONS',
  ],

  allowedHeaders: [
    'Content-Type',
    'Authorization',
  ],

  optionsSuccessStatus: 204,
};

// CORS must run before all API routes
app.use(cors(corsOptions));

// Explicitly handle OPTIONS preflight requests
app.options(/.*/, cors(corsOptions));

// --------------------------------------------------
// MIDDLEWARES
// --------------------------------------------------

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// --------------------------------------------------
// ROOT ROUTE
// --------------------------------------------------

app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Authentication API is running',
  });
});

// --------------------------------------------------
// HEALTH CHECK
// --------------------------------------------------

const getHealthStatus = (req, res) => {
  const isDbReady = mongoose.connection.readyState === 1;

  res.status(200).json({
    success: true,
    status: isDbReady ? 'ok' : 'degraded',
    service: 'backend',
    database: isDbReady ? 'connected' : 'disconnected',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
};

app.get('/health', getHealthStatus);
app.get('/api/health', getHealthStatus);

// --------------------------------------------------
// AUTHENTICATION ROUTES
// --------------------------------------------------

app.use('/api/auth', authRoutes);

// --------------------------------------------------
// 404 HANDLER
// --------------------------------------------------

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `API Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// --------------------------------------------------
// GLOBAL ERROR HANDLER
// --------------------------------------------------

app.use((err, req, res, next) => {
  console.error('[Server Error]', err.message || err);

  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({
      success: false,
      message: 'Origin not allowed by CORS',
    });
  }

  return res.status(err.status || 500).json({
    success: false,
    message:
      process.env.NODE_ENV === 'production'
        ? 'Internal server error.'
        : err.message || 'Something went wrong.',
  });
});

// --------------------------------------------------
// DATABASE CONNECTION & SERVER START
// --------------------------------------------------

async function startServer() {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is not configured');
    }

    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
    });

    console.log('[Database] MongoDB connected successfully');

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[Server] Running on port ${PORT}`);
      console.log('[CORS] Allowed origins:', allowedOrigins);
    });
  } catch (error) {
    console.error('[Startup Error]', error.message);
    process.exit(1);
  }
}

startServer();

module.exports = app;
