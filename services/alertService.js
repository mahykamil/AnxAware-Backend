const Reading = require('../models/Reading');
const User = require('../models/User');
const EmergencyLog = require('../models/EmergencyLog');
const scoringLogic = require('../utils/scoringLogic');

// Cooldown storage (in-memory for simple implementation, 
// could be moved to Redis for production scalability)
const userAlertCooldowns = new Map();

const COOLDOWN_PERIOD_MS = 30 * 60 * 1000; // 30 minutes
const ALERT_LEVEL_THRESHOLD = 0.5; // Corresponds to Level 5+ (Moderate/High)

/**
 * Checks if an alert should be triggered for a user.
 * 
 * @param {string} userId 
 * @param {number} score (0-1)
 * @returns {boolean}
 */
const shouldTriggerAlert = (userId, score) => {
    if (score < ALERT_LEVEL_THRESHOLD) return false;

    const now = Date.now();
    const lastAlertTime = userAlertCooldowns.get(userId.toString());

    if (lastAlertTime && (now - lastAlertTime < COOLDOWN_PERIOD_MS)) {
        console.log(`Alert suppressed for user ${userId} (cooldown: ${Math.round((COOLDOWN_PERIOD_MS - (now - lastAlertTime)) / 60000)}m remaining)`);
        return false;
    }

    // Update cooldown window
    userAlertCooldowns.set(userId.toString(), now);
    return true;
};

/**
 * Checks for a hypercondition (sustained high anxiety) purely internally.
 * 
 * @param {string} userId 
 * @returns {Promise<{detected: boolean, reason?: string}>}
 */
const checkHypercondition = async (userId) => {
    try {
        const user = await User.findById(userId);
        if (!user || !user.emergencySharingEnabled) return { detected: false };

        const { threshold, durationMinutes } = user.hyperconditionSettings;
        const thresholdScore = scoringLogic.mapLevelToScore(threshold);

        const startTime = new Date(Date.now() - durationMinutes * 60 * 1000);

        const recentReadings = await Reading.find({
            userId,
            timestamp: { $gte: startTime }
        }).sort({ timestamp: 1 });

        if (recentReadings.length < 2) return { detected: false };

        const allAbove = recentReadings.every(r =>
            scoringLogic.mapLevelToScore(r.level) >= thresholdScore
        );

        if (allAbove) {
            // Check if we already logged an emergency recently to avoid spam
            const lastEmergency = await EmergencyLog.findOne({ userId }).sort({ createdAt: -1 });
            if (lastEmergency && (Date.now() - lastEmergency.createdAt < 30 * 60 * 1000)) {
                return { detected: false };
            }
            return { detected: true, reason: `hypercondition:${threshold}:${durationMinutes}` };
        }

        return { detected: false };
    } catch (error) {
        console.error('Hypercondition Check Error:', error);
        return { detected: false };
    }
};

/**
 * Resets the cooldown for a user manually.
 */
const resetCooldown = (userId) => {
    userAlertCooldowns.delete(userId.toString());
};

module.exports = {
    shouldTriggerAlert,
    checkHypercondition,
    resetCooldown
};
