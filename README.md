# 🍳 Kitchen Master - Full Stack Ecosystem

Welcome to the **Kitchen Master** project. This is a comprehensive restaurant management system featuring a Java Spring Boot backend, multiple web interfaces for administration and customers, and a mobile application for staff.

---

## 📁 Project Structure

| Directory | Description | Technology Stack |
|:---|:---|:---|
| [**`backend2`**](./backend2) | Core REST API & Business Logic | Java 17, Spring Boot, PostgreSQL |
| [**`web`**](./web) | Admin Dashboard & POS Web Interface | React, Vite, CSS |
| [**`app`**](./app) | Mobile Staff/Waiter Application | React Native, Expo |
| [**`cous_web`**](./cous_web) | Customer-facing Web Portal | React, Vite |
| [**`website`**](./website) | Marketing & Landing Page | React, Vite |
| [**`zexe`**](./zexe) | Compiled assets & executable scripts | - |

---

## 🚀 Getting Started

To run the full ecosystem, you will need to start the backend first, followed by the specific frontend/app you wish to use.

### 1. Core Backend
The backend must be running for any of the interfaces to work.
```powershell
cd backend2
mvn spring-boot:run
```
*Wait until you see `Started KitchenMasterApplication` in the console.*

### 2. Admin Dashboard & POS (Web)
Used by managers and staff at the counter.
```powershell
cd web
npm run dev
```

### 3. Mobile Staff App (Android/iOS)
Used by waiters for taking orders at tables.
```powershell
cd app
npm start
```
#### **How to view the app:**
*   **Physical Device:** Download the **Expo Go** app from the Google Play Store (Android) or App Store (iOS). Scan the QR code displayed in your terminal.
*   **Emulator:** Use **Android Studio** (for Android) or Xcode (for iOS) to run the app on a virtual device.

> [!TIP]
> Ensure your phone and PC are on the same Wi-Fi network to connect to the backend.

### 4. Customer Web Portal
Used by customers for self-ordering or viewing the menu.
```powershell
cd cous_web
npm run dev
```

### 5. Marketing Website
The public-facing landing page for the restaurant.
```powershell
cd website
npm run dev
```

---

## 🛠 Prerequisites

Ensure you have the following installed on your system:
- **Java JDK 17** (Required for `backend2`)
- **Maven** (Required for `backend2`)
- **Node.js** (Required for all web/app directories)
- **PostgreSQL** (Database for the backend)

---

## 💡 Quick Startup Script
For convenience, you can use the provided PowerShell script to start the core components (Backend + Web Admin) automatically:
```powershell
.\START.ps1
```

---

## 📞 Support & Configuration
If the mobile app cannot connect to the backend:
1. Find your computer's LAN IP (e.g., `192.168.x.x`).
2. In the Mobile App Login screen, tap the **server icon** (🖧) at the top right.
3. Enter your LAN IP and save.
