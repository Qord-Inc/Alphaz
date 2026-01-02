const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

// Import routes - organized by feature area
// Core routes (authentication, webhooks, LinkedIn, transcription)
const userRoutes = require('./routes/core/userRoutes');
const webhookRoutes = require('./routes/core/webhookRoutes');
const linkedinRoutes = require('./routes/core/linkedinRoutes');
const transcriptionRoutes = require('./routes/core/transcriptionRoutes');

// Monitor routes (analytics, organization data)
const analyticsRoutes = require('./routes/monitor/analyticsRoutes');
const organizationAnalyticsRoutes = require('./routes/monitor/organizationAnalyticsRoutes');

// Create routes (AI chat, embeddings, feedback, scheduled drafts)
const embeddingsRoutes = require('./routes/create/embeddingsRoutes');
const threadsRoutes = require('./routes/create/threadsRoutes');
const feedbackRoutes = require('./routes/create/feedbackRoutes');
const scheduledDraftsRoutes = require('./routes/create/scheduledDraftsRoutes');

// Check-in routes
const checkinRoutes = require('./routes/checkin/checkinRoutes');

// Personalization routes (user persona, interview)
const personaRoutes = require('./routes/personalization/personaRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or Postman)
    if (!origin) return callback(null, true);
    
    // Allow localhost on any port and deployed frontend
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
      process.env.FRONTEND_URL
    ].filter(Boolean);
    
    if (allowedOrigins.indexOf(origin) !== -1 || origin.includes('localhost')) {
      callback(null, true);
    } else {
      callback(null, true); // Allow all for now, but log for debugging
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// Body parsing middleware - note: webhook routes need raw body
app.use('/api/webhooks', webhookRoutes); // Apply webhook routes before body parser
app.use(bodyParser.json({ limit: '50mb' })); // Increased for audio base64 payloads
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// API routes
app.use('/api', userRoutes);
app.use('/api', linkedinRoutes);
app.use('/api', transcriptionRoutes);
app.use('/api', analyticsRoutes);
app.use('/api/analytics', organizationAnalyticsRoutes);
app.use('/api/embeddings', embeddingsRoutes);
app.use('/api', threadsRoutes);
app.use('/api', feedbackRoutes);
app.use('/api', checkinRoutes);
app.use('/api/persona', personaRoutes);
app.use('/api', scheduledDraftsRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    environment: process.env.NODE_ENV || 'development'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});

module.exports = app;