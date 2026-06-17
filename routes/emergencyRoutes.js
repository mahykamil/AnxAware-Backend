const express = require('express');
const router = express.Router();
const {
    sendAlert,
    triggerEmergency,
    getEmergencyLogs,
    getEmergencyLogById
} = require('../controllers/emergencyController');
const { protect } = require('../middleware/auth');

// ── SOS Alert Endpoints ──
router.post('/send-alert', protect, sendAlert);       // New primary endpoint
router.post('/trigger', protect, triggerEmergency);    // Legacy compatibility

// ── Log Endpoints ──
router.get('/logs', protect, getEmergencyLogs);
router.get('/logs/:id', protect, getEmergencyLogById);

module.exports = router;
