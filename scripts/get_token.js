/**
 * get_token.js
 * Run this to get a JWT token for your simulation scripts.
 * Usage: node scripts/get_token.js <email> <password>
 */

const API_URL = 'http://localhost:3000/api';
const email = process.argv[2];
const password = process.argv[3];

if (!email || !password) {
    console.log("Usage: node scripts/get_token.js <email> <password>");
    process.exit(1);
}

async function getToken() {
    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();
        if (response.ok && data.token) {
            console.log("\n>>> YOUR AUTH TOKEN:");
            console.log(data.token);
            console.log("\nCopy this token into your simulate_sensors.js file.");
        } else {
            console.error("Login failed:", data.message || "Unknown error");
        }
    } catch (error) {
        console.error("Connection failed:", error.message);
    }
}

getToken();
