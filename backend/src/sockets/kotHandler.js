/**
 * Socket.io KOT (Kitchen Order Ticket) Handler
 * Manages real-time communication between POS and Kitchen Display
 */
const kotHandler = (io) => {
    io.on('connection', (socket) => {
        console.log(`🔌 Socket connected: ${socket.id}`);

        // Join restaurant-specific room
        socket.on('join:restaurant', (restaurantId) => {
            if (!restaurantId) return;
            socket.join(`restaurant:${restaurantId}`);
            console.log(`📡 Socket ${socket.id} joined restaurant:${restaurantId}`);
            socket.emit('joined', { room: `restaurant:${restaurantId}`, socketId: socket.id });
        });

        // Join kitchen display room
        socket.on('join:kitchen', (restaurantId) => {
            if (!restaurantId) return;
            socket.join(`restaurant:${restaurantId}`);
            socket.join(`kitchen:${restaurantId}`);
            console.log(`🍳 Kitchen display joined: restaurant:${restaurantId}`);
            socket.emit('kitchen:connected', { restaurantId });
        });

        // Manual KOT status update from kitchen
        socket.on('kot:update', ({ orderId, status, restaurantId }) => {
            io.to(`restaurant:${restaurantId}`).emit('kot:statusUpdate', {
                orderId,
                status,
                updatedAt: new Date().toISOString(),
            });
        });

        // Table call (waiter call from kitchen)
        socket.on('table:ready', ({ tableNumber, orderNumber, restaurantId }) => {
            io.to(`restaurant:${restaurantId}`).emit('table:ready', {
                tableNumber,
                orderNumber,
                message: `Table ${tableNumber} order is ready! (${orderNumber})`,
                timestamp: new Date().toISOString(),
            });
        });

        socket.on('disconnect', () => {
            console.log(`🔌 Socket disconnected: ${socket.id}`);
        });
    });
};

module.exports = kotHandler;
