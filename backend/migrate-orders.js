require('dotenv').config({ path: __dirname + '/.env' });
const mongoose = require('mongoose');
const Order = require('./src/models/Order');

async function migrate() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to DB successfully!');

        const result = await Order.updateMany(
            { status: 'pending' },
            { $set: { status: 'preparing' } }
        );

        console.log(`Updated ${result.modifiedCount} pending orders to preparing.`);
    } catch (e) {
        console.error("Migration Error:", e.name, e.message);
    } finally {
        await mongoose.disconnect();
        console.log("Disconnected.");
    }
}
migrate();
