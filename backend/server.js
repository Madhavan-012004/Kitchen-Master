require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const os = require('os');

const connectDB = require('./src/config/db');
const errorHandler = require('./src/middleware/errorHandler');
const kotHandler = require('./src/sockets/kotHandler');

// Routes
const authRoutes = require('./src/routes/authRoutes');
const menuRoutes = require('./src/routes/menuRoutes');
const orderRoutes = require('./src/routes/orderRoutes');
const inventoryRoutes = require('./src/routes/inventoryRoutes');
const analyticsRoutes = require('./src/routes/analyticsRoutes');
const aiRoutes = require('./src/routes/aiRoutes');
const attendanceRoutes = require('./src/routes/attendanceRoutes');

// ─── Connect to MongoDB ─────────────────────────────────────────
connectDB();

// ─── Express App ────────────────────────────────────────────────
const app = express();
const server = http.createServer(app);

// ─── Socket.io ──────────────────────────────────────────────────
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],
    },
    pingTimeout: 60000,
});
kotHandler(io);
app.set('io', io); // Make io accessible in controllers

// ─── Ensure uploads directory exists ────────────────────────────
const uploadDir = process.env.UPLOAD_PATH || './uploads';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// ─── Middleware ──────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.get('/', (req, res) => res.send('🍳 Kitchen Master API is Running! Visit /health for more details.'));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ─── Health Check ────────────────────────────────────────────────
app.get('/health', (req, res) => {
    res.json({
        success: true,
        message: '🍳 Kitchen Master API is running!',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
    });
});

// ─── API Routes ──────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/attendance', attendanceRoutes);

// ─── 404 Handler ────────────────────────────────────────────────
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `Route ${req.method} ${req.originalUrl} not found`,
    });
});

// ─── Global Error Handler ────────────────────────────────────────
app.use(errorHandler);

// ─── Start Server ────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

// Detect LAN IP for Expo Go / phone connectivity
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

server.listen(PORT, '0.0.0.0', () => {
    const lanIP = getLanIP();
    console.log(`\n╔══════════════════════════════════════════════════╗`);
    console.log(`║   🍳  Kitchen Master API Server                  ║`);
    console.log(`╠══════════════════════════════════════════════════╣`);
    console.log(`║   Port     : ${PORT}                                 ║`);
    console.log(`║   Mode     : ${process.env.NODE_ENV}                       ║`);
    console.log(`║   Health   : http://localhost:${PORT}/health          ║`);
    console.log(`║   API Base : http://localhost:${PORT}/api             ║`);
    console.log(`╠══════════════════════════════════════════════════╣`);
    console.log(`║  📱 EXPO GO / PHONE — Enter this in the app:     ║`);
    console.log(`║                                                  ║`);
    console.log(`║   http://${lanIP}:${PORT}${''.padEnd(Math.max(0, 38 - lanIP.length))}║`);
    console.log(`║                                                  ║`);
    console.log(`╚══════════════════════════════════════════════════╝\n`);
});

// ─── Handle unhandled promise rejections ─────────────────────────
process.on('unhandledRejection', (err) => {
    console.error(`❌ Unhandled Rejection: ${err.message}`);
    server.close(() => process.exit(1));
});

module.exports = { app, server };
