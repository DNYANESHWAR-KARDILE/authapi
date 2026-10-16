require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const authRoutes = require('./routes/authRoutes');

// 1. Validate required environment variables at startup
const requiredEnvVars = ['PORT', 'MONGODB_URI', 'JWT_SECRET'];
const missingVars = requiredEnvVars.filter((key) => !process.env[key]);

if (missingVars.length > 0) {
  console.error(
    `[Startup Warning] Missing environment variables in server/.env: ${missingVars.join(', ')}`
  );
}

const app = express();
const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// 2. CORS configuration for frontend credentials & cookies
app.use(
  cors({
    origin: CLIENT_URL,
    credentials: true, // Crucial for receiving and setting HttpOnly cookies
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

// 5. Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// 6. Global 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `API Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// 7. Global Error Handler (Sanitizes stack traces for safety)
app.use((err, req, res, next) => {
  console.error('[Unhandled Error]:', err);
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
const server = app.listen(PORT, () => {
  console.log(`[Server] Express running at http://localhost:${PORT}`);
  console.log(`[CORS] Accepting requests from: ${CLIENT_URL}`);
});

const mongoUri = process.env.MONGODB_URI;

mongoose
  .connect(mongoUri, {
    serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of hanging 30s
  })
  .then(() => {
    console.log(`[Database] MongoDB connected successfully to ${mongoUri}`);
  })
  .catch((error) => {
    console.error(`[Database Error] Could not connect to MongoDB: ${error.message}`);
    console.log(
      '[Notice] Make sure MongoDB is running or configure your MONGODB_URI (e.g. MongoDB Atlas) in server/.env.'
    );
  });

module.exports = app;
