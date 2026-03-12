---
description: How to start the Kitchen Master application (Backend and Frontend)
---

To start the Kitchen Master application, follow these steps:

### 1. Start the Backend Server
Open a new terminal and run:
```powershell
cd 'C:\FILES\KITCHEN MASTER\backend'
npm run dev
```
The backend will print a box showing your **LAN IP address** — for example:
```
║   http://192.168.1.5:5000   ║
```
**Copy that IP** — you'll need it to configure the app on your phone.

---

### 2. Start the Frontend App
Open another terminal and run:
```powershell
cd 'C:\FILES\KITCHEN MASTER\app'
npx expo start --lan --clear
```

> [!IMPORTANT]
> - Your **phone and PC must be on the same Wi-Fi network**
> - Use `--lan` (NOT `--tunnel`) — tunnel requires ngrok which often fails
> - On first run use `--clear` to reset Metro cache. After that just use `npx expo start --lan`

Scan the QR code shown in the terminal with the **Expo Go** app on your phone.

---

### 3. Configure Server IP (First Time Only)
When the app opens on your phone:
1. Tap the **server icon** (🖧) in the **top-right of the Login screen**
2. Enter the LAN IP printed by the backend (e.g. `192.168.1.5`)
3. Tap **Test & Save** — wait for the green ✅ confirmation
4. Go back → Log in normally

> [!TIP]
> The server IP is saved permanently. You only need to set it once per network.

---

### Troubleshooting

| Problem | Fix |
|---|---|
| `'expo' is not recognized` | Use `npx expo start --lan` (not just `expo`) |
| `ngrok tunnel took too long` | Switch from `--tunnel` to `--lan` |
| Bundle fails to load on phone | Make sure phone is on same Wi-Fi as PC |
| Can't reach API after login | Check server IP in the 🖧 settings screen |
