require('dotenv').config();
const express = require('express');
const setupCors = require('./middleware/cors');
const proxyRoutes = require('./routes/proxy');
const app = express();

// Apply CORS middleware first before any routes
app.use(setupCors());

// Parse JSON request bodies
app.use(express.json({ limit: '50mb' }));

// Add specific CORS headers for preflight options requests
app.options('*', (req, res) => {
  res.sendStatus(200);
});

// Add routes
app.use('/api/proxy', proxyRoutes);

// Simple health check endpoint for diagnostics
app.get('/api/auth-check', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});