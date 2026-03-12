const mongoose = require('mongoose');
require('dotenv').config({ path: 'c:/FILES/KITCHEN MASTER/backend/.env' });

const MenuItem = require('./src/models/MenuItem');

const dbUri = process.env.MONGODB_URI;

const categoriesToRemove = [
    'Thalappakatti Biryani',
    'South Indian Meals',
    'Tiffin & Dosa',
    'Uthappam',
    'Curries'
];

async function cleanup() {
    console.log('Connecting to MongoDB...');
    try {
        await mongoose.connect(dbUri);
        console.log('Connected ✓');

        console.log(`Removing items in categories: ${categoriesToRemove.join(', ')}...`);
        const result = await MenuItem.deleteMany({
            category: { $in: categoriesToRemove }
        });

        console.log(`SUCCESS! Removed ${result.deletedCount} items.`);
        process.exit(0);
    } catch (err) {
        console.error('FAIL:', err.message);
        process.exit(1);
    }
}

cleanup();
