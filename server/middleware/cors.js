const cors = require('cors');

/**
 * Configure CORS middleware with allowed origins from environment variables
 */
const setupCors = () => {
  // Get allowed origins from environment variable or use default
  const allowedOrigins = process.env.CORS_ORIGINS 
    ? process.env.CORS_ORIGINS.split(',') 
    : ['http://localhost:8000', 'http://10.0.0.207:8000', 'http://localhost:5173'];

  const corsOptions = {
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps, curl requests)
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'OPTIONS'],
    // Include custom Bunny header so browser can forward it without preflight errors
    allowedHeaders: ['Content-Type', 'Authorization', 'AccessKey', 'accesskey'],
    credentials: true
  };

  return cors(corsOptions);
};

module.exports = setupCors;
