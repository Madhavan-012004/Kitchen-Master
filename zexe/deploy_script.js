const { exec, spawn } = require('child_process');
const os = require('os');
const fs = require('fs');
const path = require('path');
const http = require('http');

// Configuration
const REPO_ROOT = path.resolve(__dirname, '..');
const APP_PATH = path.join(REPO_ROOT, 'app');
const APP_JSON_PATH = path.join(APP_PATH, 'app.json');
const PORT = 3000; // Landing page port

function getLanIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}

async function startNgrok(port) {
    console.log(`\x1b[36m[Utility] Starting ngrok tunnel on port ${port}...\x1b[0m`);
    return new Promise((resolve, reject) => {
        const ngrok = spawn('npx', ['ngrok', 'http', port.toString()], { shell: true });

        // We need to fetch the public URL from the ngrok API
        setTimeout(() => {
            http.get('http://127.0.0.1:4040/api/tunnels', (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        if (json.tunnels && json.tunnels.length > 0) {
                            resolve(json.tunnels[0].public_url);
                        } else {
                            reject('No tunnels found');
                        }
                    } catch (e) {
                        reject('Failed to parse ngrok API response');
                    }
                });
            }).on('error', (err) => {
                reject('Ngrok API not ready: ' + err.message);
            });
        }, 3000);
    });
}

function updateAppJson(apiUrl) {
    console.log(`\x1b[36m[Utility] Updating app/app.json with API_URL: ${apiUrl}\x1b[0m`);
    if (fs.existsSync(APP_JSON_PATH)) {
        const content = JSON.parse(fs.readFileSync(APP_JSON_PATH, 'utf8'));
        content.expo.extra.API_URL = apiUrl;
        fs.writeFileSync(APP_JSON_PATH, JSON.stringify(content, null, 2));
    }
}

function createLandingPage(lanIP, publicUrl) {
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Kitchen Master - Mobile Setup</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #0A0C18; color: white; text-align: center; padding: 20px; }
            .card { background: #161B33; border-radius: 15px; padding: 25px; margin: 20px auto; max-width: 400px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
            h1 { color: #4C8EFF; margin-bottom: 10px; }
            .step { text-align: left; margin: 15px 0; line-height: 1.5; }
            .badge { background: #4C8EFF; color: white; padding: 2px 8px; border-radius: 4px; font-weight: bold; font-size: 0.9em; }
            .url-box { background: #0A0C18; padding: 10px; border-radius: 8px; font-family: monospace; word-break: break-all; margin: 10px 0; border: 1px solid #4C8EFF; color: #4C8EFF; }
            .footer { margin-top: 30px; font-size: 0.8em; color: #666; }
        </style>
    </head>
    <body>
        <h1>🍳 Kitchen Master</h1>
        <p>Mobile Application Setup</p>

        <div class="card">
            <div class="step">
                <span class="badge">1</span> Install <b>Expo Go</b> from the Play Store or App Store.
            </div>
            <div class="step">
                <span class="badge">2</span> Open the app and go to <b>Settings > Server Setup</b>.
            </div>
            <div class="step">
                <span class="badge">3</span> Enter the following URL:
                <div class="url-box">${publicUrl || `http://${lanIP}:5001`}</div>
            </div>
            <div class="step">
                <span class="badge">4</span> Go back and scan the QR code from the PC terminal.
            </div>
        </div>

        <div class="footer">
            Utility running on ${lanIP}
        </div>
    </body>
    </html>
    `;

    http.createServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
    }).listen(PORT);

    console.log(`\x1b[32m[Utility] Landing page ready at: http://${lanIP}:${PORT}\x1b[0m`);
    if (publicUrl) console.log(`\x1b[32m[Utility] Public link: ${publicUrl}\x1b[0m`);
}

async function main() {
    const lanIP = getLanIP();
    console.log(`\n\x1b[1m\x1b[34m==================================================\x1b[0m`);
    console.log(`\x1b[1m\x1b[34m      KITCHEN MASTER MOBILE DEPLOYMENT          \x1b[0m`);
    console.log(`\x1b[1m\x1b[34m==================================================\x1b[0m\n`);

    let publicUrl = null;
    try {
        // In a real scenario, we might ask the user, but here we'll try to start it
        // If ngrok fails (no auth token), we continue with Local IP
        publicUrl = await startNgrok(5001).catch(err => {
            console.log(`\x1b[33m[Warning] Ngrok skipped: ${err}. Using Local Network only.\x1b[0m`);
            return null;
        });
    } catch (e) { }

    const apiUrl = publicUrl || `http://${lanIP}:5001`;
    updateAppJson(apiUrl);
    createLandingPage(lanIP, publicUrl);

    console.log(`\x1b[36m[Utility] Starting Expo Server...\x1b[0m`);
    const expo = spawn('npx', ['expo', 'start', '--lan'], { cwd: APP_PATH, shell: true, stdio: 'inherit' });

    expo.on('exit', (code) => {
        console.log(`Expo exited with code ${code}`);
        process.exit(code);
    });
}

main();
