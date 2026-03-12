const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI)
    .then(async () => {
        const User = require('./src/models/User');
        const Order = require('./src/models/Order');

        // Find the owner/restaurant
        const restaurant = await User.findOne({ role: 'owner' });
        if (!restaurant) {
            console.log('No restaurant found');
            process.exit(1);
        }

        // Create a dummy order
        const dummyOrder = await Order.create({
            restaurantId: restaurant._id,
            orderNumber: 'KOT-TEST-001',
            tableNumber: 'Table 5',
            items: [
                { name: 'Paneer Butter Masala', quantity: 2, price: 250 },
                { name: 'Garlic Naan', quantity: 4, price: 50 },
            ],
            subtotal: 700,
            total: 700,
            status: 'preparing', // This makes it visible in KDS
            notes: 'Test order from System. Make it extra spicy!',
        });

        console.log('Dummy KOT order created:', dummyOrder._id);
        process.exit(0);
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
