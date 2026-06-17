const Reading = require('../models/Reading');
const scoringLogic = require('../utils/scoringLogic');
const alertService = require('../services/alertService');
const { processAutomaticEmergencyAlert } = require('../utils/emergencyTrigger');
exports.analyzeSignal = async (req, res) => {
    try {
        const { heartRate, hrv, temperature, saveIfElevated = true, location } = req.body;
        const userId = req.user._id;

        if (!heartRate && !hrv && !temperature) {
            return res.status(400).json({
                success: false,
                message: "At least one physiological signal (heartRate, hrv, temperature) is required"
            });
        }

        const vitals = { heartRate, hrv, temperature };

        // 1. Calculate Score directly from signals (no manual input)
        // Since calculateFinalAnxietyScore requires a manual level, we will use calculatePhysiologicalScore 
        // as the primary source of truth for pure json signals
        const physioScore = scoringLogic.calculatePhysiologicalScore(vitals);
        
        // 2. Map score to one of the 7 discrete levels
        const detectedLevel = scoringLogic.mapScoreToLevel(physioScore);

        let savedReading = null;
        let hypercondition = { detected: false };

        // 3. Save reading if requested and if anxiety is non-trivial
        // (Don't spam the DB with 'very-low' unless specifically asked)
        const isElevated = physioScore >= scoringLogic.mapLevelToScore('mild');

        if (saveIfElevated && isElevated) {
            const alertTriggered = alertService.shouldTriggerAlert(userId, physioScore);
            
            savedReading = await Reading.create({
                userId,
                level: detectedLevel,
                heartRate,
                temperature,
                hrv,
                calculatedScore: physioScore,
                alertTriggered,
                timestamp: new Date(),
                source: 'sensor',
                location
            });

            hypercondition = await alertService.checkHypercondition(userId);

            const emergencyAlert = await processAutomaticEmergencyAlert(
                userId,
                [savedReading],
                hypercondition
            );

            if (emergencyAlert?.dispatched) {
                hypercondition._emergencyAlert = emergencyAlert;
            }
        }

        // 4. Return the analysis
        res.json({
            success: true,
            data: {
                signalsReceived: vitals,
                analysis: {
                    physioScore: parseFloat(physioScore.toFixed(3)),
                    detectedLevel,
                    isElevated
                },
                actionTaken: savedReading ? 'saved_to_history' : 'ignored_low_level',
                readingId: savedReading ? savedReading._id : null,
                hypercondition: hypercondition.detected ? hypercondition : undefined,
                emergencyAlert: hypercondition._emergencyAlert || undefined
            }
        });

    } catch (error) {
        console.error('Signal Processing Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};
