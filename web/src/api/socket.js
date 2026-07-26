import { io } from 'socket.io-client';

const isElectron = window.location.protocol === 'file:';
const isAndroid = /android/i.test(navigator.userAgent);
const socketUrl = 'https://kitchen-master.onrender.com';

const socket = io(socketUrl, {
    path: '/socket.io', // Expressed explicitly to match vite.config proxy
    transports: ['websocket'], // Force websocket immediately to avoid 7-8s polling delay
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
});

console.log("🔌 Attempting to connect to socket server at:", socketUrl);

socket.on('connect', () => {
    console.log("✅ Socket connected successfully! ID:", socket.id);
});

socket.on('connect_error', (err) => {
    console.error("❌ Socket connection failure:", err.message);
});

socket.on('disconnect', (reason) => {
    console.warn("⚠️ Socket disconnected. Reason:", reason);
});

export default socket;
