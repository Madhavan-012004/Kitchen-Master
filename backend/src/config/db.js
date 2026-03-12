const mongoose = require('mongoose');

// ─── Retry Configuration ─────────────────────────────────────────────────────
const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 3000; // start with 3 s, doubles each attempt

/**
 * Returns true when Mongoose reports an active connection.
 */
const isConnected = () => mongoose.connection.readyState === 1;

/**
 * Human-readable error diagnosis to help debug common Atlas issues.
 */
const diagnoseError = (error) => {
  const msg = error.message || '';

  if (msg.includes('querySrv') || msg.includes('ECONNREFUSED') || msg.includes('ENOTFOUND')) {
    console.error('🔍 Diagnosis: DNS resolution failed for the SRV record.');
    console.error('   Possible causes:');
    console.error('   1. Your network/ISP blocks MongoDB SRV DNS lookups.');
    console.error('   2. Your IP has NOT been whitelisted in MongoDB Atlas → Network Access.');
    console.error('   3. The cluster hostname in MONGODB_URI is incorrect.');
    console.error('   Fix: In Atlas dashboard → Network Access → Add IP Address → "Allow Access from Anywhere" (0.0.0.0/0) for testing.');
  } else if (msg.includes('bad auth') || msg.includes('Authentication failed') || msg.includes('SCRAM')) {
    console.error('🔍 Diagnosis: Authentication failed.');
    console.error('   Fix: Double-check the username and password in MONGODB_URI inside your .env file.');
  } else if (msg.includes('IP that isn') || msg.includes('whitelist') || msg.includes('not allowed')) {
    console.error('🔍 Diagnosis: Your current IP address is not whitelisted in Atlas Network Access.');
    console.error('   Fix: Go to Atlas → Security → Network Access → Add your current IP or 0.0.0.0/0.');
  } else if (msg.includes('MONGODB_URI') || !process.env.MONGODB_URI) {
    console.error('🔍 Diagnosis: MONGODB_URI environment variable is missing or empty.');
    console.error('   Fix: Ensure your .env file is present and MONGODB_URI is set correctly.');
  }
};

/**
 * Connects to MongoDB with exponential back-off retry logic.
 * @param {number} attempt - Current attempt number (1-indexed)
 */
const connectDB = async (attempt = 1) => {
  if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI is not defined in environment variables.');
    console.error('   Please check your .env file.');
    return;
  }

  // Mask password in log output for security
  const safeUri = process.env.MONGODB_URI.replace(/:([^@]+)@/, ':<hidden>@');
  console.log(`\n🔌 Connecting to MongoDB... (Attempt ${attempt}/${MAX_RETRIES})`);
  console.log(`   URI: ${safeUri}`);

  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,  // 10 s to find a server
      socketTimeoutMS: 45000,           // 45 s for operations
      connectTimeoutMS: 10000,          // 10 s for initial TCP connection
      heartbeatFrequencyMS: 10000,      // check server health every 10 s
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`   Database: ${conn.connection.name}`);
    console.log(`   State: ${conn.connection.readyState === 1 ? 'Connected' : 'Unknown'}\n`);

    // ── Connection event listeners ─────────────────────────────────
    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️  MongoDB disconnected. Attempting to reconnect...');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB reconnected successfully.');
    });

    mongoose.connection.on('error', (err) => {
      console.error(`❌ MongoDB runtime error: ${err.message}`);
    });

  } catch (error) {
    console.error(`\n❌ MongoDB Connection Error (Attempt ${attempt}/${MAX_RETRIES}): ${error.message}`);
    diagnoseError(error);

    if (attempt < MAX_RETRIES) {
      const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1); // exponential back-off
      console.warn(`⏳ Retrying in ${delay / 1000}s...\n`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return connectDB(attempt + 1);
    } else {
      console.error(`\n❌ Failed to connect to MongoDB after ${MAX_RETRIES} attempts.`);
      console.warn('⚠️  Server will continue running without a database connection.');
      console.warn('   API endpoints requiring the database will return errors until reconnected.\n');
    }
  }
};

module.exports = connectDB;
module.exports.isConnected = isConnected;
