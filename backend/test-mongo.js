require('dotenv').config();
const dns = require('dns');
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI;

async function main() {
    console.log('\n========================================');
    console.log('  Kitchen Master – MongoDB Diagnostics');
    console.log('========================================\n');

    // ── 1. Check env var ──────────────────────────────────────────────
    if (!MONGODB_URI) {
        console.error('❌ MONGODB_URI is not set in .env');
        process.exit(1);
    }
    const masked = MONGODB_URI.replace(/:([^@]+)@/, ':<hidden>@');
    console.log('✅ MONGODB_URI found:', masked);

    // ── 2. Parse hostname from URI ────────────────────────────────────
    let hostname = '';
    try {
        // SRV URIs look like: mongodb+srv://user:pass@cluster.host.net/db
        hostname = MONGODB_URI.split('@')[1].split('/')[0].split('?')[0];
        console.log('🔍 Cluster hostname:', hostname);
    } catch (e) {
        console.error('❌ Could not parse hostname from MONGODB_URI');
    }

    // ── 3. DNS resolution test ────────────────────────────────────────
    if (hostname) {
        console.log('\n--- DNS Test ---');
        await new Promise((resolve) => {
            dns.resolve(hostname, (err, addresses) => {
                if (err) {
                    console.error(`❌ DNS A record FAILED: ${err.code} – ${err.message}`);
                    console.warn('   This usually means a firewall/ISP is blocking DNS, or the hostname is wrong.');
                } else {
                    console.log(`✅ DNS A record resolved: ${addresses.join(', ')}`);
                }
                resolve();
            });
        });

        await new Promise((resolve) => {
            dns.resolveSrv(`_mongodb._tcp.${hostname}`, (err, addrs) => {
                if (err) {
                    console.error(`❌ DNS SRV record FAILED: ${err.code} – ${err.message}`);
                    console.warn('   This means your network cannot resolve MongoDB Atlas SRV records.');
                    console.warn('   Fix options:');
                    console.warn('   • Change DNS to 8.8.8.8 (Google) or 1.1.1.1 (Cloudflare)');
                    console.warn('   • Whitelist your IP in Atlas → Security → Network Access');
                    console.warn('   • Or use a standard mongodb:// URI instead of mongodb+srv://');
                } else {
                    console.log(`✅ DNS SRV record resolved: ${JSON.stringify(addrs)}`);
                }
                resolve();
            });
        });
    }

    // ── 4. Attempt Mongoose connection ───────────────────────────────
    console.log('\n--- Mongoose Connection Test ---');
    try {
        const conn = await mongoose.connect(MONGODB_URI, {
            serverSelectionTimeoutMS: 12000,
            connectTimeoutMS: 12000,
        });
        console.log(`✅ SUCCESS! Host: ${conn.connection.host}`);
        console.log(`   Database: ${conn.connection.name}`);
        await mongoose.disconnect();
        console.log('\n🎉 MongoDB is connected and working correctly!\n');
    } catch (err) {
        console.error(`❌ Mongoose connection FAILED: ${err.message}`);
        if (err.message.includes('Authentication')) {
            console.warn('   Fix: Check username/password in MONGODB_URI (.env file).');
        } else if (err.message.includes('IP') || err.message.includes('whitelist')) {
            console.warn('   Fix: Add your IP to Atlas → Security → Network Access.');
        }
        console.log('');
    }

    process.exit(0);
}

main().catch(console.error);
