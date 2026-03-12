const mongoose = require('mongoose');
require('dotenv').config({ path: 'c:/FILES/KITCHEN MASTER/backend/.env' });

const MenuItem = require('./src/models/MenuItem');
const User = require('./src/models/User');

const dbUri = process.env.MONGODB_URI;

const menuItems = [
    // Dindigul Thalappakatti
    { name: 'Thalappakatti Mutton Biryani (Boneless)', category: 'Thalappakatti Biryani', price: 449, description: 'Authentic Seeraga Samba mutton biryani with boneless chunks', isVeg: false, isAvailable: true },
    { name: 'Thalappakatti Chicken Biryani', category: 'Thalappakatti Biryani', price: 339, description: 'Traditional aromatic chicken biryani cooked in dum style', isVeg: false, isAvailable: true },
    { name: 'Thalappakatti Veg Biryani', category: 'Thalappakatti Biryani', price: 295, description: 'Flavorful slow-cooked vegetable biryani', isVeg: true, isAvailable: true },
    { name: 'Thalappakatti Mushroom Biryani', category: 'Thalappakatti Biryani', price: 295, description: 'Biryani prepared with fresh roasted mushrooms', isVeg: true, isAvailable: true },
    { name: 'Thalappakatti Paneer Biryani', category: 'Thalappakatti Biryani', price: 320, description: 'Biryani with marinated soft paneer cubes', isVeg: true, isAvailable: true },
    { name: 'Moru Moru Stick Chicken', category: 'Starters', price: 369, description: 'Signature crispy fried stick chicken', isVeg: false, isAvailable: true },
    { name: 'Tangri Kebab', category: 'Starters', price: 333, description: 'Juicy chicken drumsticks marinated in spices', isVeg: false, isAvailable: true },
    { name: 'Mutton Kola Urundai', category: 'Starters', price: 280, description: 'Hand-ground spiced mutton mince balls', isVeg: false, isAvailable: true },
    { name: 'Paneer 65', category: 'Starters', price: 289, description: 'Spicy pepper-fried paneer cubes', isVeg: true, isAvailable: true },
    { name: 'Kuska (Biryani Rice)', category: 'Thalappakatti Biryani', price: 220, description: 'Plain aromatic Seeraga Samba biryani rice', isVeg: true, isAvailable: true },

    // Saravana Bhavan
    { name: 'Saravana Special Meals (Thali)', category: 'South Indian Meals', price: 220, description: 'Sweet, Poori, Rice, Sambar, Rasam, Kootu, Poriyal, Curd, Appalam', isVeg: true, isAvailable: true },
    { name: 'Masala Dosa', category: 'Tiffin & Dosa', price: 110, description: 'Golden crispy crepe with spicy potato filling', isVeg: true, isAvailable: true },
    { name: 'Ghee Roast Dosa', category: 'Tiffin & Dosa', price: 130, description: 'Paper thin crepe roasted with pure cow ghee', isVeg: true, isAvailable: true },
    { name: 'Idly (2 Pcs)', category: 'Tiffin & Dosa', price: 60, description: 'Traditional steamed rice and lentil cakes', isVeg: true, isAvailable: true },
    { name: 'Medhu Vada (2 Pcs)', category: 'Tiffin & Dosa', price: 70, description: 'Crispy deep-fried lentil doughnuts', isVeg: true, isAvailable: true },
    { name: 'Ghee Pongal', category: 'Tiffin & Dosa', price: 95, description: 'Mashed rice and moong dal tempered with cashews and ghee', isVeg: true, isAvailable: true },
    { name: 'Mini Ghee Sambar Idly', category: 'Tiffin & Dosa', price: 120, description: '14 small idlies immersed in aromatic ghee sambar', isVeg: true, isAvailable: true },
    { name: 'Onion Uthappam', category: 'Uthappam', price: 105, description: 'Thick rice pancake topped with chopped onions', isVeg: true, isAvailable: true },
    { name: 'Paneer Butter Masala', category: 'Curries', price: 210, description: 'Rich and creamy tomato gravy with paneer cubes', isVeg: true, isAvailable: true },
    { name: 'Filter Coffee', category: 'Beverages', price: 55, description: 'Authentic South Indian degree filter coffee', isVeg: true, isAvailable: true }
];

async function seed() {
    console.log('Connecting to MongoDB...');
    try {
        // Use a 20s timeout for selection and a slightly longer wait
        await mongoose.connect(dbUri, {
            serverSelectionTimeoutMS: 20000,
            connectTimeoutMS: 20000,
        });

        const statusMap = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
        console.log(`Initial Status: ${statusMap[mongoose.connection.readyState]}`);

        if (mongoose.connection.readyState !== 1) {
            console.log('Waiting for "open" event...');
            await new Promise((resolve, reject) => {
                const timer = setTimeout(() => reject(new Error('Connect timeout')), 15000);
                mongoose.connection.once('open', () => {
                    clearTimeout(timer);
                    resolve();
                });
                mongoose.connection.once('error', (err) => {
                    clearTimeout(timer);
                    reject(err);
                });
            });
        }
        console.log('DB Connection Ready ✓');

        console.log('Fetching owner user...');
        // Use a simpler query and .lean() to avoid overhead
        let owner = await User.findOne({ role: 'owner' }).lean();

        if (!owner) {
            console.warn('Owner not found by role, trying any user...');
            owner = await User.findOne({}).lean();
        }

        if (!owner) {
            console.error('No users found in DB! Please register a restaurant first.');
            process.exit(1);
        }
        console.log(`Targeting Restaurant: ${owner.restaurantName} (ID: ${owner._id})`);

        const itemsWithRestaurant = menuItems.map(item => ({
            ...item,
            restaurantId: owner._id,
            taxRate: owner.taxRate || 5
        }));

        console.log(`Inserting ${itemsWithRestaurant.length} items...`);
        // Ordered: false allows some to fail (e.g. duplicates) while others succeed
        const result = await MenuItem.insertMany(itemsWithRestaurant, { ordered: false });
        console.log(`SUCCESS! Created ${result.length} items.`);

        process.exit(0);
    } catch (err) {
        if (err.writeErrors) {
            console.log(`Partial success: ${err.insertedDocs?.length || 0} inserted, but some were skipped (likely duplicates).`);
            process.exit(0);
        }
        console.error('FAIL:', err.message);
        process.exit(1);
    }
}

seed();
