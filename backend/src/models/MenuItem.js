const mongoose = require('mongoose');

const ingredientSchema = new mongoose.Schema({
    inventoryItemId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Inventory',
        required: true,
    },
    inventoryItemName: String,
    quantityUsed: {
        type: Number,
        required: true,
        min: 0,
    },
    unit: String,
});

const menuItemSchema = new mongoose.Schema(
    {
        restaurantId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        name: {
            type: String,
            required: [true, 'Item name is required'],
            trim: true,
        },
        description: {
            type: String,
            trim: true,
            default: '',
        },
        category: {
            type: String,
            required: [true, 'Category is required'],
            trim: true,
        },
        price: {
            type: Number,
            required: [true, 'Price is required'],
            min: [0, 'Price cannot be negative'],
        },
        taxRate: {
            type: Number,
            default: 0,
            min: 0,
            max: 100,
        },
        imageUrl: {
            type: String,
            default: null,
        },
        isAvailable: {
            type: Boolean,
            default: true,
        },
        isVeg: {
            type: Boolean,
            default: false,
        },
        preparationTime: {
            type: Number, // in minutes
            default: 10,
        },
        ingredients: [ingredientSchema],
        tags: [String],
        sortOrder: {
            type: Number,
            default: 0,
        },
    },
    {
        timestamps: true,
    }
);

// Index for fast category-based queries
menuItemSchema.index({ restaurantId: 1, category: 1 });
menuItemSchema.index({ restaurantId: 1, isAvailable: 1 });

module.exports = mongoose.model('MenuItem', menuItemSchema);
