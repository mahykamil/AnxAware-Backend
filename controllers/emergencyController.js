const EmergencyLog = require('../models/EmergencyLog');
const emergencyAlertService = require('../services/emergencyAlertService');

// ─────────────────────────────────────────────────────────────
//  POST /api/emergency/send-alert
//
//  Manual SOS — frontend sends:
//  {
//    location: { latitude, longitude },
//    triggerReason: string,
//    heartRate?: number,
//    temperature?: number,
//    anxietyLevel?: string
//  }
// ─────────────────────────────────────────────────────────────

exports.sendAlert = async (req, res) => {
    try {
        const userId = req.user._id;
        const { location, triggerReason, heartRate, temperature, anxietyLevel } = req.body;

        const user = req.user;
        if (!user.emergencySharingEnabled) {
            return res.status(400).json({
                success: false,
                message: 'Emergency sharing is disabled. Enable it in Settings to send alerts.',
            });
        }

        const result = await emergencyAlertService.dispatchEmergencyAlert(userId, {
            location,
            triggerReason: triggerReason || 'sos_button',
            heartRate,
            temperature,
            anxietyLevel,
            skipCooldown: true,
        });

        if (!result.dispatched) {
            return res.status(400).json({
                success: false,
                message: result.message || 'Could not send emergency alert',
            });
        }

        res.json({
            success: result.success,
            message: result.message,
            logId: result.logId,
            alertStatus: result.alertStatus,
            sentTo: result.sentTo,
            summary: result.summary,
            deliveryResults: result.deliveryResults,
        });
    } catch (error) {
        console.error('❌ Send Alert Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.triggerEmergency = async (req, res) => exports.sendAlert(req, res);

exports.getEmergencyLogs = async (req, res) => {
    try {
        const logs = await EmergencyLog.find({ userId: req.user._id })
            .sort({ createdAt: -1 })
            .limit(50);
        res.json({ success: true, data: logs });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getEmergencyLogById = async (req, res) => {
    try {
        const log = await EmergencyLog.findOne({
            _id: req.params.id,
            userId: req.user._id,
        });

        if (!log) {
            return res.status(404).json({ success: false, message: 'Log not found' });
        }

        res.json({ success: true, data: log });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
