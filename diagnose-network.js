/**
 * Network Diagnostic Script for AnxAware Backend
 * Run this to check if your setup is correct
 * 
 * Usage: node diagnose-network.js
 */

const os = require('os');
const http = require('http');

console.log('\n🔍 AnxAware Network Diagnostics\n');
console.log('═'.repeat(60));

// 1. Check Network Interfaces
console.log('\n1️⃣  Network Interfaces:');
const interfaces = os.networkInterfaces();
let wifiIP = null;

Object.keys(interfaces).forEach((name) => {
  interfaces[name].forEach((iface) => {
    if (iface.family === 'IPv4' && !iface.internal) {
      console.log(`   ${name}: ${iface.address}`);
      if (name.toLowerCase().includes('wi-fi') || 
          name.toLowerCase().includes('wlan') ||
          name.toLowerCase().includes('wireless')) {
        wifiIP = iface.address;
      }
    }
  });
});

if (wifiIP) {
  console.log(`\n   ✅ WiFi IP detected: ${wifiIP}`);
  console.log(`   📱 Your app expects: 192.168.100.207`);
  
  if (wifiIP === '192.168.100.207') {
    console.log(`   ✅ IP MATCHES! App should work.`);
  } else {
    console.log(`   ❌ IP MISMATCH! App won't connect.`);
    console.log(`\n   🔧 Fix options:`);
    console.log(`      A) Set your laptop IP to: 192.168.100.207`);
    console.log(`      B) Rebuild APK with new IP: ${wifiIP}`);
  }
} else {
  console.log(`   ⚠️  No WiFi IP detected. Check WiFi connection.`);
}

// 2. Check if port 3000 is available
console.log('\n2️⃣  Port 3000 Check:');
const testServer = http.createServer();

testServer.once('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log('   ✅ Port 3000 is IN USE (backend is running)');
  } else {
    console.log(`   ❌ Error: ${err.message}`);
  }
  testServer.close();
  continueChecks();
});

testServer.once('listening', () => {
  console.log('   ⚠️  Port 3000 is AVAILABLE (backend is NOT running)');
  console.log('   💡 Start backend with: npm start');
  testServer.close();
  continueChecks();
});

testServer.listen(3000, '0.0.0.0');

function continueChecks() {
  // 3. Check MongoDB connection (if backend is running)
  console.log('\n3️⃣  Environment Variables:');
  
  require('dotenv').config();
  
  if (process.env.MONGODB_URI) {
    console.log('   ✅ MONGODB_URI is set');
  } else {
    console.log('   ❌ MONGODB_URI is NOT set');
  }
  
  if (process.env.JWT_SECRET) {
    console.log('   ✅ JWT_SECRET is set');
  } else {
    console.log('   ❌ JWT_SECRET is NOT set');
  }
  
  if (process.env.SMTP_HOST) {
    console.log('   ✅ SMTP is configured (emergency emails will work)');
  } else {
    console.log('   ⚠️  SMTP is NOT configured (emergency emails won\'t work)');
  }
  
  // 4. Provide next steps
  console.log('\n4️⃣  Next Steps:');
  console.log('   1. Ensure backend is running: npm start');
  console.log('   2. Test locally: curl http://localhost:3000/api/health');
  
  if (wifiIP) {
    console.log(`   3. Test from LAN: curl http://${wifiIP}:3000/api/health`);
    console.log(`   4. Test from phone browser: http://${wifiIP}:3000/api/health`);
  }
  
  console.log('\n5️⃣  Windows Firewall:');
  console.log('   Run this command as Administrator:');
  console.log('   netsh advfirewall firewall add rule name="AnxAware" dir=in action=allow protocol=TCP localport=3000');
  
  console.log('\n' + '═'.repeat(60));
  console.log('\n📋 Configuration Summary:');
  console.log(`   Expected IP (in APK): 192.168.100.207:3000`);
  console.log(`   Your current IP:      ${wifiIP || 'NOT DETECTED'}:3000`);
  console.log(`   Status:               ${wifiIP === '192.168.100.207' ? '✅ MATCH' : '❌ MISMATCH'}`);
  console.log('\n');
}
