const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI)
    .then(async () => {
        const Order = require('./src/models/Order');
        const orders = await Order.find({ status: 'preparing' }).lean();
        console.log(`Found ${orders.length} preparing orders.`);
        console.log(JSON.stringify(orders.map(o => ({ id: o._id, rId: o.restaurantId, items: o.items.length })), null, 2));
        process.exit(0);
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
