const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

// Fail fast if critical secrets are missing
if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET is not set in .env file. Server cannot start securely.');
  process.exit(1);
}

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
const readingsRoutes = require('./routes/readings');
const dialogflowRoutes = require('./routes/dialogflow');

const authRoutes = require('./routes/auth');

app.use('/api/auth', authRoutes);
app.use('/api/readings', readingsRoutes);
app.use('/api/emergency', require('./routes/emergencyRoutes'));
app.use('/api/signals', require('./routes/signals'));
app.use('/api/dialogflow', dialogflowRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'AnxAware Backend API is running' });
});

const MONGODB_URI = process.env.MONGODB_URI;

mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ MongoDB Connected to database: anxaware'))
  .catch(err => {
    console.error('❌ MongoDB Connection Error:', err.message);
    if (err.message.includes('ETIMEOUT')) {
      console.error('👉 TIP: Your machine cannot reach MongoDB Atlas. Please check if your IP is whitelisted in "Network Access" at cloud.mongodb.com');
    }
  });


// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal server error',
      status: err.status || 500
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 API available at http://localhost:${PORT}/api`);
  console.log(`📡 LAN access: use your PC's local IP (e.g. http://192.168.x.x:${PORT}/api)`);

  try {
    const emailService = require('./services/emailService');
    const check = await emailService.verifyConnection();
    if (check.valid) {
      console.log('✅ Email: SMTP connection verified');
    } else {
      console.warn('⚠️  Email: SMTP not ready —', check.error);
      console.warn('   Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM in backend .env');
    }
  } catch (e) {
    console.error('❌ Email startup check error:', e.message);
  }
  console.log("API URL USED:", process.env.EXPO_PUBLIC_API_URL);
});

module.exports = app;
