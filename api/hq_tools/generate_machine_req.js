/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║         ProBloom ProBloom — License Request Tool       ║
 * ║                                                              ║
 * ║  Run this script ONCE on your server machine.               ║
 * ║  It will generate a  machine.req  file in this folder.      ║
 * ║  Email that file to: support@probloom.in                    ║
 * ║                                                              ║
 * ║  Usage:  node generate_machine_req.js                        ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

const os = require('os');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// ── Get MAC address (matches backend HardwareUtil.java logic) ─────────────────
function getMacAddress() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            // Skip loopback and internal interfaces
            if (iface.internal) continue;
            if (!iface.mac || iface.mac === '00:00:00:00:00:00') continue;
            // Format as AA-BB-CC-DD-EE-FF (matches Java format)
            return iface.mac.toUpperCase().replace(/:/g, '-');
        }
    }
    // Fallback to hostname if no MAC found
    return os.hostname();
}

// ── Hash the MAC address (matches backend HardwareUtil.java logic) ────────────
function getHardwareId(mac) {
    const hash = crypto.createHash('sha256').update(mac).digest('hex');
    return hash.substring(0, 16).toUpperCase();
}

// ── Main ──────────────────────────────────────────────────────────────────────
console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║       ProBloom ProBloom — License Request Tool         ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

console.log('Reading hardware information from this machine...\n');

const mac = getMacAddress();
const hardwareId = getHardwareId(mac);

const requestData = {
    type: 'LICENSE_REQUEST',
    hardwareId: hardwareId,
    requestedAt: new Date().toISOString(),
    appVersion: '1.0.0',
    hostname: os.hostname(),
    platform: os.platform()
};

const outputPath = path.join(__dirname, 'machine.req');
fs.writeFileSync(outputPath, JSON.stringify(requestData, null, 2), 'utf8');

console.log('✔  Hardware ID  : ' + hardwareId);
console.log('✔  Hostname     : ' + os.hostname());
console.log('✔  File created : machine.req\n');

console.log('─────────────────────────────────────────────────────────────');
console.log('  NEXT STEP:');
console.log('  Email the  machine.req  file to:  support@probloom.in');
console.log('  We will send your license file within 24 hours.');
console.log('─────────────────────────────────────────────────────────────\n');
