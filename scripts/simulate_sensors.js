/**
 * simulate_sensors.js
 * Run this script to push mock sensor data to your local backend.
 * Usage: node scripts/simulate_sensors.js [state]
 * States: calm, stressed, panic
 */

// Configure your local environment
const API_URL = 'http://localhost:3000/api';
const MOCK_TOKEN = 'YOUR_AUTH_TOKEN'; // Get this using scripts/get_token.js

const scenarios = {
    calm: {
        heartRate: 72,
        hrv: 75,
        temperature: 36.6,
        notes: "Simulation: Feeling relaxed"
    },
    stressed: {
        heartRate: 98,
        hrv: 45,
        temperature: 37.2,
        notes: "Simulation: Work stress"
    },
    panic: {
        heartRate: 125,
        hrv: 25,
        temperature: 37.9,
        notes: "Simulation: Anxious episode"
    }
};

async function sendReading(state) {
    const data = scenarios[state] || scenarios.calm;
    console.log(`\n>>> Simulating state: ${state.toUpperCase()}`);
    console.log(`Data: HR: ${data.heartRate}, HRV: ${data.hrv}, Temp: ${data.temperature}`);

    try {
        const response = await fetch(`${API_URL}/readings`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${MOCK_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        const result = await response.json();
        if (response.ok) {
            console.log(`SUCCESS: Created ${result.data.level} reading.`);
            console.log(`Calculated Score: ${result.data.calculatedScore.toFixed(2)}`);
            if (result.data.alertTriggered) {
                console.log(`⚠️ ALERT TRIGGERED! (Check your app/notifications)`);
            }
        } else {
            console.error(`ERROR (${response.status}):`, result.message || result.error);
        }
    } catch (error) {
        console.error("ERROR:", error.message);
    }
}

const arg = process.argv[2] || 'calm';
sendReading(arg);
