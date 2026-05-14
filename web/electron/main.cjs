const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

let mainWindow;
let javaProcess;

const isDev = !app.isPackaged;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    icon: path.join(__dirname, '../public/favicon.ico')
  });

  if (isDev) {
    // In development mode, load from Vite dev server
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    // In production mode, load the bundled React app
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function startJavaBackend() {
  return new Promise((resolve, reject) => {
    console.log('Starting Java backend...');
    
    // Determine the path to the JAR depending on whether we are in dev or prod
    let jarPath;
    if (isDev) {
      jarPath = path.join(__dirname, '../../backend2/target/backend2-1.0.0.jar');
    } else {
      // In production, the jar will be placed in the resources folder by electron-builder
      jarPath = path.join(process.resourcesPath, 'backend2.jar');
    }

    console.log('JAR Path:', jarPath);

    // Spawn the Java process
    javaProcess = spawn('java', ['-jar', jarPath]);

    javaProcess.stdout.on('data', (data) => {
      console.log(`[Java]: ${data.toString().trim()}`);
    });

    javaProcess.stderr.on('data', (data) => {
      console.error(`[Java Error]: ${data.toString().trim()}`);
    });

    javaProcess.on('close', (code) => {
      console.log(`Java process exited with code ${code}`);
    });

    // Wait for the backend to be ready on port 8080
    const checkBackend = () => {
      http.get('http://localhost:8080/actuator/health', (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log('Backend is ready!');
          resolve();
        } else {
          setTimeout(checkBackend, 1000);
        }
      }).on('error', () => {
        setTimeout(checkBackend, 1000);
      });
    };

    // Timeout fallback just in case actuator isn't there but backend started
    setTimeout(() => {
      console.log('Timeout waiting for backend actuator, proceeding anyway...');
      resolve();
    }, 15000);

    checkBackend();
  });
}

app.whenReady().then(async () => {
  // Start backend first
  await startJavaBackend();
  // Then open the window
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Clean up the Java process when Electron quits
app.on('will-quit', () => {
  if (javaProcess) {
    console.log('Killing Java backend process...');
    javaProcess.kill();
  }
});
