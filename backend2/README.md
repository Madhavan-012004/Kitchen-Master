# ProBloom — Java Backend (backend2)

A full Java 17 + Spring Boot 3.2 backend for ProBloom, using **PostgreSQL 15/16** as the database and **Google Gemini 1.5 Flash** for AI features.

---

## 🛠 Prerequisites

| Tool | Version |
|------|---------|
| Java JDK | 17 (LTS) |
| Apache Maven | 3.9+ |
| PostgreSQL | 15 or 16 |

---

## ⚙️ Setup

### 1. Create PostgreSQL Database
```sql
CREATE DATABASE kitchen_master_db;
```

### 2. Configure Environment Variables

Create a `.env` file by copying `.env.example` and fill in your values:
```bash
copy .env.example .env
```

> **Important:** Use the **same `JWT_SECRET`** as your Node.js backend so existing mobile/web sessions remain valid.

### 3. Set Environment Variables (Windows PowerShell)
```powershell
$env:DB_HOST="localhost"
$env:DB_PORT="5432"
$env:DB_NAME="kitchen_master_db"
$env:DB_USER="postgres"
$env:DB_PASSWORD="your_password"
$env:JWT_SECRET="your_jwt_secret_from_node_backend"
$env:GEMINI_API_KEY="your_gemini_api_key"
```

### 4. Run the Application
```powershell
cd "c:\FILES\ProBloom\backend2"
mvn spring-boot:run
```

The server starts on `http://localhost:8080`

---

## 📡 API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/auth/register | Register restaurant owner |
| POST | /api/auth/login | Login |
| GET | /api/auth/me | Get profile |
| PUT | /api/auth/profile | Update profile |
| GET/POST | /api/auth/users | Staff management |
| DELETE | /api/auth/users/:id | Remove staff |
| GET/POST | /api/menu | Menu items CRUD |
| GET | /api/menu/categories | Categories list |
| GET/POST | /api/inventory | Inventory CRUD |
| GET | /api/inventory/low-stock | Low stock alerts |
| POST | /api/inventory/:id/adjust | Adjust stock |
| GET/POST | /api/orders | Orders (active / create) |
| PATCH | /api/orders/:id/status | Update order status |
| PATCH | /api/orders/:id/payment | Update payment |
| POST | /api/orders/:id/bill-request | Request bill |
| POST | /api/orders/sync | Sync offline orders |
| GET | /api/attendance | Today's attendance |
| GET | /api/attendance/history | History with date range |
| POST | /api/attendance/check-in | Employee check-in |
| POST | /api/attendance/check-out | Employee check-out |
| POST | /api/attendance/ping | Geofence heartbeat |
| GET | /api/analytics/dashboard | Dashboard metrics |
| POST | /api/ai/menu-digitizer | Digitize menu image (Gemini) |
| POST | /api/ai/voice-kot | Parse voice order (Gemini) |
| POST | /api/ai/upsell | Upsell suggestions (Gemini) |
| GET | /api/ai/inventory-forecast | Inventory forecast (Gemini) |

---

## 🗄️ Database

JPA auto-creates/updates all tables on startup (`spring.jpa.hibernate.ddl-auto=update`).  
Tables created:
- `users`, `user_assigned_tables`
- `menu_items`, `menu_item_tags`, `item_ingredients`
- `inventory_items`, `stock_movements`
- `orders`, `order_items`
- `attendance`

---

## 🤖 AI Features (Gemini 1.5 Flash)

All AI features from the Node.js backend are fully ported using the Gemini REST API:
- **Menu Digitizer** — Upload a photo of any physical menu, AI extracts all items
- **Voice KOT** — Convert speech-to-text into a structured order
- **Upsell Engine** — Smart item suggestions based on cart + order history
- **Inventory Forecast** — Predict reorder needs based on sales velocity

---

## 🔐 Security Notes

- **BCrypt (strength 12)** — same as Node.js backend, passwords are cross-compatible
- **JWT** — stateless, using the same secret as Node.js so existing sessions work
- **CORS** — all origins allowed (configure `SecurityConfig` for production)
