const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'backend2', 'target', 'backend2-1.0.0.jar');
const TMP_DIR = path.join(__dirname, '.build_temp');
const DEST = path.join(TMP_DIR, 'backend2.jar');
const DIST_DIR = path.join(__dirname, 'dist-electron');
const MAX_ATTEMPTS = 10;
const DELAY_MS = 500;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  // Attempt to stop common processes that may lock resources (Windows only)
  try {
    if (process.platform === 'win32') {
      const { execSync } = require('child_process');
      const procsToKill = ['ProBloom.exe', 'java.exe', 'electron.exe'];
      procsToKill.forEach(name => {
        try {
          const list = execSync(`tasklist /FI "IMAGENAME eq ${name}" /NH`, { encoding: 'utf8' });
          if (!/No tasks are running/.test(list) && list.trim()) {
            console.log(`Found running ${name}, attempting to stop it...`);
            execSync(`taskkill /IM ${name} /F`, { stdio: 'ignore' });
            console.log(`Stopped ${name}`);
          }
        } catch (e) {
          // ignore
        }
      });
    }

    // Remove previous build output to avoid copying over locked files
    if (fs.existsSync(DIST_DIR)) {
      await fs.promises.rm(DIST_DIR, { recursive: true, force: true });
      console.log('Removed previous build output at', DIST_DIR);
    }
  } catch (e) {
    console.warn('Warning: failed to remove dist-electron before build:', e.message || e);
  }

  if (!fs.existsSync(SRC)) {
    console.error('Source JAR not found:', SRC);
    process.exit(1);
  }

  if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      if (!fs.existsSync(SRC)) {
        console.error('Source JAR not found:', SRC);
        process.exit(1);
      }
      await fs.promises.copyFile(SRC, DEST);
      console.log('Copied backend JAR to', DEST);
      process.exit(0);
    } catch (err) {
      if (attempt === MAX_ATTEMPTS) {
        console.error('Failed to copy backend JAR after', MAX_ATTEMPTS, 'attempts:', err.message || err);
        console.error('Make sure no process (e.g., a running Java instance or IDE) is locking the file and try again.');
        process.exit(2);
      }
      console.warn(`Attempt ${attempt} failed to copy JAR: ${err.code || err.message}. Retrying in ${DELAY_MS}ms...`);
      await sleep(DELAY_MS);
    }
  }
})();
