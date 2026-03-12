require('dotenv').config({ path: __dirname + '/.env' });
const mongoose = require('mongoose');

async function check() {
    console.log("Starting DB check script...");
    console.log("URI Length:", process.env.MONGODB_URI ? process.env.MONGODB_URI.length : 0);
    try {
        await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
        console.log('Connected to DB successfully!');
        const db = mongoose.connection.db;

        const allOrders = await db.collection('orders').find().sort({ createdAt: -1 }).limit(5).toArray();
        console.log(`Found ${allOrders.length} recent orders`);
        for (const order of allOrders) {
            console.log(`Order ${order.orderNumber}: status=${order.status}`);
        }
    } catch (e) {
        console.error("DB Connection or Query Error:", e.name, e.message);
    } finally {
        await mongoose.disconnect();
        console.log("Disconnected.");
    }
}
check();
