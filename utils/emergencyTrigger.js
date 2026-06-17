const emergencyAlertService = require('../services/emergencyAlertService');

function locationFromReading(reading) {
    if (!reading?.location) return undefined;
    if (reading.location.coordinates) {
        return {
            longitude: reading.location.coordinates[0],
            latitude: reading.location.coordinates[1],
        };
    }
    return reading.location;
}

/**
 * After readings are saved, auto-dispatch email alerts for HIGH anxiety or hypercondition.
 */
async function processAutomaticEmergencyAlert(userId, readings, hypercondition) {
    if (!readings || readings.length === 0) return null;

    if (hypercondition?.detected) {
        const latest = readings[readings.length - 1];
        return emergencyAlertService.dispatchEmergencyAlert(userId, {
            triggerReason: hypercondition.reason,
            heartRate: latest?.heartRate,
            temperature: latest?.temperature,
            anxietyLevel: latest?.level,
            location: locationFromReading(latest),
        });
    }

    const highReading = [...readings].reverse().find((r) =>
        emergencyAlertService.isHighAnxietyLevel(r.level)
    );

    if (highReading) {
        return emergencyAlertService.dispatchEmergencyAlert(userId, {
            triggerReason: `anxiety_level:${highReading.level}`,
            heartRate: highReading.heartRate,
            temperature: highReading.temperature,
            anxietyLevel: highReading.level,
            location: locationFromReading(highReading),
        });
    }

    return null;
}

module.exports = { processAutomaticEmergencyAlert };
