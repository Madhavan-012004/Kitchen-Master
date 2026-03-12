require('dotenv').config({ path: './.env' });
const mongoose = require('mongoose');
const Order = require('./src/models/Order');

async function test() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected.');
        const paidOrders = await Order.find({ paymentStatus: 'paid' }).lean();
        console.log('Total Paid Orders:', paidOrders.length);
        if (paidOrders.length > 0) {
            console.log('Sample Order:', {
                id: paidOrders[0]._id,
                status: paidOrders[0].status,
                paymentStatus: paidOrders[0].paymentStatus,
                restaurantId: paidOrders[0].restaurantId
            });
        }
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}
test();
