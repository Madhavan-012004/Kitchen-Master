/**
 * ProBloom — Electron Main Process
 *
 * Boot sequence:
 *  Stage 1 → Detect Java & PostgreSQL (system-wide or bundled portable)
 *  Stage 2 → If portable PG: initdb + pg_ctl start
 *  Stage 3 → Wait for PostgreSQL to accept connections
 *  Stage 4 → Spawn Spring Boot backend JAR
 *  Stage 5 → Wait for backend /api/status → 200, then open Login
 */

'use strict';

const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const { spawn, execSync, execFile } = require('child_process');
const http = require('http');
const net = require('net');
const fs = require('fs');

// ─── Constants ─────────────────────────────────────────────────────────────────
const isDev = !app.isPackaged;
const APP_DATA_DIR = path.join(app.getPath('appData'), 'ProBloom');
const LOG_DIR = path.join(APP_DATA_DIR, 'logs');
const DB_DIR = path.join(APP_DATA_DIR, 'db');
const LOG_FILE = path.join(LOG_DIR, 'startup.log');
const API_BASE = 'http://localhost:48182/api';
const PG_PORT = 15432;

// ─── Resource Paths ────────────────────────────────────────────────────────────
function resourcesPath() {
  return isDev
    ? path.join(__dirname, '../')             // dev: 'web' folder (where jre/pgsql are)
    : process.resourcesPath;                  // prod: inside .asar resources
}

function jreBin() {
  return path.join(resourcesPath(), 'jre', 'bin', 'java.exe');
}

function pgBinDir() {
  return path.join(resourcesPath(), 'pgsql', 'bin');
}

function pythonBinDir() {
  return path.join(resourcesPath(), 'python');
}

// ─── Logging ───────────────────────────────────────────────────────────────────
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

const logStream = fs.createWriteStream(LOG_FILE, { flags: 'a' });
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  logStream.write(line);
  console.log(msg);
}

// ─── State ────────────────────────────────────────────────────────────────────
let splashWindow = null;
let mainWindow = null;
let javaProcess = null;
let usingBundledPg = false;

// ─── Splash ───────────────────────────────────────────────────────────────────
function createSplash() {
  splashWindow = new BrowserWindow({
    width: 520,
    height: 420,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    webPreferences: { nodeIntegration: true, contextIsolation: false },
  });
  splashWindow.loadFile(path.join(__dirname, 'splash.html'));
  splashWindow.center();
}

function updateSplash(status, progress, stage, isError) {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.webContents.send('status-update', { status, progress, stage: stage || 'db', isError: !!isError });
  }
}

// ─── Utility: check if a CLI command exists in PATH ───────────────────────────
function commandExists(cmd) {
  try {
    execSync(`where ${cmd}`, { stdio: 'ignore' });
    return true;
  } catch { return false; }
}

// ─── Utility: wait for a TCP port to be open ─────────────────────────────────
function waitForPort(port, host, timeoutMs) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    const attempt = () => {
      const sock = new net.Socket();
      sock.setTimeout(1000);
      sock.connect(port, host, () => { sock.destroy(); resolve(); });
      sock.on('error', () => {
        sock.destroy();
        if (Date.now() < deadline) setTimeout(attempt, 1000);
        else reject(new Error(`Port ${port} on ${host} not open after ${timeoutMs}ms`));
      });
      sock.on('timeout', () => {
        sock.destroy();
        if (Date.now() < deadline) setTimeout(attempt, 1000);
        else reject(new Error(`Timeout waiting for port ${port}`));
      });
    };
    attempt();
  });
}

// ─── Stage 2 + 3: PostgreSQL ──────────────────────────────────────────────────
async function startPostgres() {
  updateSplash('Checking database engine…', 10, 'db');

  // Check if PG is already available on the custom port
  const pgAlreadyRunning = await new Promise(r => {
    const sock = new net.Socket();
    sock.setTimeout(500);
    sock.connect(PG_PORT, '127.0.0.1', () => { sock.destroy(); r(true); });
    sock.on('error', () => { sock.destroy(); r(false); });
    sock.on('timeout', () => { sock.destroy(); r(false); });
  });

  if (pgAlreadyRunning) {
    log(`[Stage 2] PostgreSQL already running on ${PG_PORT} — using it.`);
    return;
  }

  // Fall back to bundled portable PostgreSQL
  usingBundledPg = true;
  const binDir = pgBinDir();
  const initdbExe = path.join(binDir, 'initdb.exe');
  const pgCtlExe = path.join(binDir, 'pg_ctl.exe');

  if (!fs.existsSync(initdbExe)) {
    throw new Error(
      'PostgreSQL not found on this system and no bundled portable binaries are present.\n\n' +
      'Please install PostgreSQL 15/16 from https://www.postgresql.org/download/ and restart the application.'
    );
  }

  log('[Stage 2] Using bundled Portable PostgreSQL.');

  // initdb if cluster doesn't exist yet
  if (!fs.existsSync(path.join(DB_DIR, 'PG_VERSION'))) {
    log('[Stage 2] Initialising new database cluster at: ' + DB_DIR);
    updateSplash('Setting up local database (first run)…', 20, 'db');
    try {
      execSync(
        `"${initdbExe}" -D "${DB_DIR}" -U postgres -A trust -E UTF8 --locale=C --no-instructions`,
        {
          stdio: ['ignore', 'pipe', 'pipe'],
          env: { ...process.env, PATH: binDir + ';' + (process.env.PATH || '') },
          timeout: 300000
        }
      );
    } catch (initErr) {
      const stderr = initErr.stderr ? initErr.stderr.toString() : '';
      const stdout = initErr.stdout ? initErr.stdout.toString() : '';
      log('[Stage 2] initdb failed: ' + stderr + stdout);
      throw new Error(
        'Database initialization failed.\n\n' +
        'Command: initdb.exe -D "' + DB_DIR + '"\n' +
        'Error: ' + (stderr || stdout || initErr.message) + '\n\n' +
        'This may be caused by missing Visual C++ Redistributable.\n' +
        'Please install it from: https://aka.ms/vs/17/release/vc_redist.x64.exe'
      );
    }

    // Explicitly configure postgresql.conf to run on the custom port
    const pgConf = path.join(DB_DIR, 'postgresql.conf');
    if (fs.existsSync(pgConf)) {
      fs.appendFileSync(pgConf, `\nport = ${PG_PORT}\n`);
    }

    log('[Stage 2] Cluster initialised.');
  }

  // Start PG
  log('[Stage 2] Starting Portable PostgreSQL…');
  updateSplash('Starting local database engine…', 30, 'db');
  const startLog = path.join(LOG_DIR, 'postgres.log');
  execFile(pgCtlExe, ['start', '-D', DB_DIR, '-l', startLog, '-o', `-p ${PG_PORT}`], {
    env: { ...process.env, PATH: binDir + ';' + (process.env.PATH || '') }
  });

  // Wait up to 30 s for it to be ready
  try {
    await waitForPort(PG_PORT, '127.0.0.1', 30000);
    log('[Stage 3] PostgreSQL is accepting connections.');
  } catch (err) {
    let logTail = 'No log available';
    try {
      if (fs.existsSync(startLog)) {
        const fullLog = fs.readFileSync(startLog, 'utf8');
        const lines = fullLog.split('\n').filter(l => l.trim().length > 0);
        logTail = lines.slice(-10).join('\n');
      }
    } catch (e) {
      logTail = 'Failed to read log: ' + e.message;
    }
    throw new Error(
      'Database engine failed to start on port ' + PG_PORT + '.\n\n' +
      'Last 10 lines of postgres.log:\n' +
      logTail + '\n\n' +
      'Original error: ' + err.message
    );
  }
}

// ─── Stage 4: Spring Boot backend ────────────────────────────────────────────
function startBackend() {
  return new Promise((resolve, reject) => {
    updateSplash('Starting backend services…', 45, 'api');

    // Resolve Java binary
    let javaBin = 'java';
    if (!commandExists('java')) {
      const bundledJava = jreBin();
      if (fs.existsSync(bundledJava)) {
        javaBin = bundledJava;
        log('[Stage 4] Using bundled JRE: ' + bundledJava);
      } else {
        return reject(
          'Java is not installed on this system and no bundled JRE was found.\n\n' +
          'Please install Java 17 from https://adoptium.net/ and restart.'
        );
      }
    } else {
      log('[Stage 4] Using system Java.');
    }

    // Resolve JAR
    const jarPath = isDev
      ? path.join(__dirname, '../../backend2/target/backend2-1.0.0.jar')
      : path.join(process.resourcesPath, 'backend2.jar');

    if (!fs.existsSync(jarPath)) {
      return reject('Backend JAR not found at: ' + jarPath);
    }

    log('[Stage 4] Launching Spring Boot JAR: ' + jarPath);

    // ── Cloud DB credentials for offline-first fallback ─────────────────────
    // Read from %APPDATA%/ProBloom/cloud.properties if it exists,
    // otherwise fall back to well-known env vars set during installation.
    let cloudUrl = process.env.OFFLINE_CLOUD_URL || null;
    let cloudUsername = process.env.OFFLINE_CLOUD_USERNAME || null;
    let cloudPassword = process.env.OFFLINE_CLOUD_PASSWORD || null;

    const cloudConfigFile = path.join(APP_DATA_DIR, 'cloud.properties');
    if (fs.existsSync(cloudConfigFile)) {
      try {
        const lines = fs.readFileSync(cloudConfigFile, 'utf8').split('\n');
        for (const line of lines) {
          const eqIdx = line.indexOf('=');
          if (eqIdx === -1) continue;
          const k = line.substring(0, eqIdx).trim();
          const v = line.substring(eqIdx + 1).trim();
          if (k === 'OFFLINE_CLOUD_URL') cloudUrl = v;
          if (k === 'OFFLINE_CLOUD_USERNAME') cloudUsername = v;
          if (k === 'OFFLINE_CLOUD_PASSWORD') cloudPassword = v;
        }
        log('[Stage 4] Cloud DB config loaded from cloud.properties');
      } catch (e) {
        log('[Stage 4] Warning: Could not read cloud.properties: ' + e.message);
      }
    }

    if (cloudUrl) log('[Stage 4] Cloud DB fallback configured: ' + cloudUrl.replace(/:[^@]*@/, ':***@'));
    else log('[Stage 4] No cloud DB configured — offline-only mode');

    const jvmArgs = [
      '-Dspring.profiles.active=electron',
      '-Dspring.jpa.hibernate.ddl-auto=update',
      `-Dspring.datasource.url=jdbc:postgresql://127.0.0.1:${PG_PORT}/postgres`,
      '-Dspring.datasource.username=postgres',
      '-Dspring.datasource.password=',
      '-Dspring.datasource.hikari.connection-timeout=120000',
      `-DPG_BIN_DIR=${pgBinDir()}`,
      `-DPYTHON_BIN_DIR=${pythonBinDir()}`,
      '-DSTANDALONE=true',
      '-Dserver.port=48182',
      '-Dlogging.level.com.probloom=INFO',
      '-Xmx512m',
      // ── Offline-First cloud fallback credentials ──────────────────────────
      ...(cloudUrl ? [`-DOFFLINE_CLOUD_URL=${cloudUrl}`] : []),
      ...(cloudUsername ? [`-DOFFLINE_CLOUD_USERNAME=${cloudUsername}`] : []),
      ...(cloudPassword ? [`-DOFFLINE_CLOUD_PASSWORD=${cloudPassword}`] : []),
      '-jar', jarPath,
    ];

    javaProcess = spawn(javaBin, jvmArgs, { stdio: ['ignore', 'pipe', 'pipe'] });

    let isResolved = false;

    javaProcess.stdout.on('data', d => {
      const line = d.toString().trim();
      log('[Java] ' + line);
      if (line.includes('Started ProBloom')) updateSplash('Application ready!', 90, 'app');
    });

    javaProcess.stderr.on('data', d => log('[Java ERR] ' + d.toString().trim()));

    javaProcess.on('exit', code => {
      log(`[Stage 4] Java process exited with code ${code}`);
      if (!isResolved) {
        let logTail = 'No log available';
        try {
          if (fs.existsSync(LOG_FILE)) {
            const fullLog = fs.readFileSync(LOG_FILE, 'utf8');
            const lines = fullLog.split('\n').filter(l => l.includes('[Java') || l.includes('FATAL'));
            logTail = lines.slice(-15).join('\n');
          }
        } catch (e) { }
        reject(new Error(`Java backend crashed unexpectedly (Code ${code}).\n\nRecent logs:\n${logTail}`));
      }
    });

    let attempts = 0;
    let pollInterval;
    const poll = () => {
      http.get(`${API_BASE}/status`, res => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          log('[Stage 4] Backend is healthy!');
          isResolved = true;
          resolve();
        } else {
          if (++attempts < 300) setTimeout(poll, 1000);
          else reject('Backend failed to become healthy within 5 minutes (300 seconds).');
        }
      }).on('error', () => {
        if (++attempts < 300) setTimeout(poll, 1000);
        else reject('Backend did not respond within 5 minutes (300 seconds).');
      });
    };
    poll();
  });
}

// ─── Stage 5: Open Login window ───────────────────────────────────────────────
function openMainWindow() {
  updateSplash('Loading ProBloom…', 100, 'app');

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    show: false,
    icon: isDev
      ? path.join(__dirname, '../src/assets/LOGO.jpeg')
      : path.join(process.resourcesPath, 'app-icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false, // Prevents background processes from pausing and losing focus
    },
  });

  if (isDev) {
    // Dev: Vite dev server runs on 5173; route to /login
    mainWindow.loadURL('http://localhost:5173/login');
    mainWindow.webContents.openDevTools();
  } else {
    // Prod: load compiled React bundle, hash-route to #/login
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'), {
      hash: '/login',
    });
  }

  mainWindow.once('ready-to-show', () => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.destroy(); // Ensure splash window is completely annihilated to prevent hidden focus stealing
      splashWindow = null;
    }
    mainWindow.show();
    mainWindow.maximize();
    mainWindow.focus(); // Explicitly focus the main window
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ─── Fatal error UI ───────────────────────────────────────────────────────────
function showFatalError(msg) {
  if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close();
  dialog.showErrorBox('ProBloom — Startup Error', String(msg));
  app.quit();
}

// ─── App lifecycle ────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  createSplash();
  log('=== ProBloom startup ===');

  try {
    await startPostgres();        // Stage 2 + 3
    await startBackend();         // Stage 4
    openMainWindow();             // Stage 5
  } catch (err) {
    log('FATAL: ' + err);
    showFatalError(err);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  // Gracefully stop the Java backend
  if (javaProcess) {
    log('[Shutdown] Killing Java backend...');
    javaProcess.kill('SIGTERM');
  }

  // Stop the bundled portable PostgreSQL
  if (usingBundledPg) {
    const pgCtlExe = path.join(pgBinDir(), 'pg_ctl.exe');
    try {
      if (fs.existsSync(pgCtlExe)) {
        log('[Shutdown] Stopping Portable PostgreSQL...');
        execSync(`"${pgCtlExe}" stop -D "${DB_DIR}" -m fast`, { stdio: 'ignore' });
      }
    } catch (e) {
      log('[Shutdown] pg_ctl stop error: ' + e.message);
    }
  }
});
