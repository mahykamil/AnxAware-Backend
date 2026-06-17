/**
 * Anxiety Scoring Logic Utility
 * This system is for AWARENESS and SELF-MONITORING only.
 * It is NOT a medical diagnostic tool.
 */

// Mock Baseline Values (can be user-specific in the future)
const BASELINES = {
    heartRate: 75,      // bpm
    hrv: 70,            // ms (Root Mean Square of Successive Differences)
    temperature: 32,    // °C (Skin surface temperature)
};

const LEVELS = [
    'very-low',   // 1
    'low',        // 2
    'mild',       // 3
    'moderate',   // 4
    'high',       // 5
    'severe',     // 6
    'extreme'     // 7
];

/**
 * Maps a numeric score (0-1) to one of the 7 discrete levels.
 */
const mapScoreToLevel = (score) => {
    const index = Math.min(Math.floor(score * LEVELS.length), LEVELS.length - 1);
    return LEVELS[index];
};

/**
 * Maps a discrete level string to a numeric value (0-1).
 */
const mapLevelToScore = (level) => {
    const index = LEVELS.indexOf(level);
    if (index === -1) return 0.5; // Default to mid-range if unknown
    return index / (LEVELS.length - 1);
};

/**
 * Calculates normalized physiological deviation (0-1).
 */
const calculatePhysiologicalScore = (vitals = {}) => {
    const { heartRate, hrv, temperature } = vitals;
    let scores = [];

    // Heart Rate: Higher HR usually correlates with stress
    if (heartRate) {
        // Normal resting is 60-100. Assume > 110 starts indicating stress.
        const hrDiff = Math.max(0, heartRate - BASELINES.heartRate);
        const hrScore = Math.min(1, hrDiff / 40); // 40 bpm above baseline is "max" physiological stress
        scores.push(hrScore);
    }

    // HRV: Lower HRV correlates with higher stress
    if (hrv) {
        const hrvDiff = Math.max(0, BASELINES.hrv - hrv);
        const hrvScore = Math.min(1, hrvDiff / 50); // 50 ms drop is "max" physiological stress
        scores.push(hrvScore);
    }

    // Temperature: Slight increase in skin temp can correlate with stress/arousal
    if (temperature) {
        const tempDiff = Math.max(0, temperature - BASELINES.temperature);
        const tempScore = Math.min(1, tempDiff / 4); // 4 degree rise is "max"
        scores.push(tempScore);
    }

    if (scores.length === 0) return 0;

    // Average the available physiological markers
    return scores.reduce((a, b) => a + b, 0) / scores.length;
};

/**
 * Combines all factors into a final score.
 * Respects manual input as the ground truth.
 */
const calculateFinalAnxietyScore = (manualLevel, vitals = {}, durationMinutes = 0) => {
    const manualScore = mapLevelToScore(manualLevel);
    const physioScore = calculatePhysiologicalScore(vitals);

    // Weights: Manual input (70%) + Physiological Data (30%)
    // We prioritize the user's feeling.
    let combinedScore = (manualScore * 0.7) + (physioScore * 0.3);

    // Persistence Safeguard:
    // If baseline anxiety is already high and has lasted, we raise the floor.
    if (durationMinutes > 20 && manualScore > 0.4) {
        combinedScore = Math.max(combinedScore, manualScore + 0.1);
    }

    return Math.min(1, combinedScore);
};

module.exports = {
    BASELINES,
    LEVELS,
    mapScoreToLevel,
    mapLevelToScore,
    calculatePhysiologicalScore,
    calculateFinalAnxietyScore
};
