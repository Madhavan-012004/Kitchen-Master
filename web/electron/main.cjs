const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const axios = require('axios');

let mainWindow;
let splashWindow;
let javaProcess;

const isDev = !app.isPackaged;
const API_BASE = 'http://localhost:8080/api';

/**
 * 1. Create Splash Window
 */
function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 500,
    height: 400,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    }
  });

  splashWindow.loadFile(path.join(__dirname, 'splash.html'));
  splashWindow.center();
}

/**
 * 2. Create Main Window (or License Gate)
 */
async function loadApplication() {
  try {
    // Check license status via backend API
    const response = await axios.get(`${API_BASE}/license/status`);
    const status = response.data;

    if (status.valid) {
      showMainWindow();
    } else {
      showLicenseGate(status.hardwareId);
    }
  } catch (err) {
    console.error('Failed to check license status:', err.message);
    // If backend is unreachable, something went wrong during startup
    app.quit();
  } finally {
    if (splashWindow) splashWindow.close();
  }
}

function showMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    icon: path.join(__dirname, '../public/favicon.ico')
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.maximize();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function showLicenseGate(hwId) {
  mainWindow = new BrowserWindow({
    width: 600,
    height: 700,
    resizable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'license-gate.html'));
  mainWindow.once('ready-to-show', () => {
    mainWindow.webContents.send('hw-id', hwId);
  });
}

/**
 * 3. Start Java Backend
 */
function startJavaBackend() {
  return new Promise((resolve, reject) => {
    console.log('Starting Java backend...');
    updateSplash('Starting backend services...', 20);

    // Resolution of Java executable
    let javaBin = 'java';
    if (!isDev) {
      // In production, use bundled JRE
      const jrePath = path.join(process.resourcesPath, 'jre', 'bin', 'java.exe');
      if (fs.existsSync(jrePath)) {
        javaBin = jrePath;
        console.log('Using bundled JRE:', javaBin);
      } else {
        console.warn('Bundled JRE not found at', jrePath, 'falling back to system java');
      }
    }

    // Resolution of JAR path
    let jarPath;
    if (isDev) {
      jarPath = path.join(__dirname, '../../backend2/target/backend2-1.0.0.jar');
    } else {
      jarPath = path.join(process.resourcesPath, 'backend2.jar');
    }

    if (!fs.existsSync(jarPath)) {
        console.error('JAR file not found:', jarPath);
        return reject('JAR file not found');
    }

    // Spawn the Java process with "standalone" profile and STANDALONE flag
    const args = [
        '-Dspring.profiles.active=standalone',
        '-DSTANDALONE=true',
        '-jar', 
        jarPath
    ];

    javaProcess = spawn(javaBin, args);

    javaProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(`[Java]: ${output.trim()}`);
      
      // Look for startup triggers
      if (output.includes('Starting embedded PostgreSQL')) {
        updateSplash('Starting local database...', 40);
      }
      if (output.includes('Initializing Spring Embedded WebServer')) {
        updateSplash('Starting web services...', 70);
      }
      if (output.includes('Started ProBloomApplication')) {
        updateSplash('Ready!', 100);
      }
    });

    javaProcess.stderr.on('data', (data) => {
      console.error(`[Java Error]: ${data.toString().trim()}`);
    });

    javaProcess.on('close', (code) => {
      console.log(`Java process exited with code ${code}`);
      if (code !== 0 && code !== 1) { // 1 is often just a normal kill
        app.quit();
      }
    });

    // Wait for the backend to be ready on port 8080
    let attempts = 0;
    const checkBackend = () => {
      attempts++;
      http.get(`${API_BASE}/status`, (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log('Backend is ready!');
          resolve();
        } else {
          if (attempts < 60) setTimeout(checkBackend, 1000);
          else reject('Backend failed to start in time');
        }
      }).on('error', () => {
        if (attempts < 60) setTimeout(checkBackend, 1000);
        else reject('Backend failed to start in time');
      });
    };

    checkBackend();
  });
}

function updateSplash(status, progress) {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.webContents.send('status-update', { status, progress });
  }
}

/**
 * IPC Handlers
 */
ipcMain.on('upload-license', async (event, filePath) => {
    try {
        const formData = new (require('form-data'))();
        formData.append('file', fs.createReadStream(filePath));

        const response = await axios.post(`${API_BASE}/license/upload`, formData, {
            headers: formData.getHeaders()
        });

        if (response.data.valid) {
            event.reply('upload-success');
        } else {
            event.reply('upload-error', response.data.message || 'Invalid license file');
        }
    } catch (err) {
        event.reply('upload-error', err.response?.data?.message || err.message);
    }
});

ipcMain.on('license-activated', () => {
    if (mainWindow) mainWindow.close();
    showMainWindow();
});

/**
 * App Lifecycle
 */
app.whenReady().then(async () => {
  createSplashWindow();
  
  try {
    await startJavaBackend();
    await loadApplication();
  } catch (err) {
    console.error('Startup Error:', err);
    app.quit();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      loadApplication();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  if (javaProcess) {
    console.log('Killing Java backend process...');
    javaProcess.kill();
  }
});
