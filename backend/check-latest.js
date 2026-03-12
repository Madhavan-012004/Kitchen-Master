const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI)
    .then(async () => {
        const Order = require('./src/models/Order');
        const orders = await Order.find().sort({ createdAt: -1 }).limit(5).lean();
        console.log('--- LATEST 5 ORDERS ---');
        orders.forEach(o => console.log(`ID: ${o._id}, Status: ${o.status}, RestID: ${o.restaurantId}`));
        process.exit(0);
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
