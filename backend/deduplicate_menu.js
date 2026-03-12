const mongoose = require('mongoose');
require('dotenv').config({ path: 'c:/FILES/KITCHEN MASTER/backend/.env' });

const MenuItem = require('./src/models/MenuItem');

const dbUri = process.env.MONGODB_URI;

async function deduplicate() {
    console.log('Connecting to MongoDB...');
    try {
        await mongoose.connect(dbUri);
        console.log('Connected ✓');

        // Aggregate to find duplicates
        const duplicates = await MenuItem.aggregate([
            {
                $group: {
                    _id: {
                        name: { $trim: { input: "$name" } },
                        category: "$category",
                        restaurantId: "$restaurantId"
                    },
                    count: { $sum: 1 },
                    ids: { $push: "$_id" }
                }
            },
            {
                $match: {
                    count: { $gt: 1 }
                }
            }
        ]);

        console.log(`Found ${duplicates.length} duplicate groups.`);

        let removedCount = 0;
        for (const group of duplicates) {
            // Keep the first one, remove the rest
            const idsToRemove = group.ids.slice(1);
            const result = await MenuItem.deleteMany({ _id: { $in: idsToRemove } });
            removedCount += result.deletedCount;
            console.log(`- Removed ${result.deletedCount} duplicates for "${group._id.name}" in category "${group._id.category}"`);
        }

        console.log(`\nSUCCESS! Total duplicates removed: ${removedCount}`);
        process.exit(0);
    } catch (err) {
        console.error('FAIL:', err.message);
        process.exit(1);
    }
}

deduplicate();
