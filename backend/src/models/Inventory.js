const mongoose = require('mongoose');

const stockMovementSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['add', 'deduct', 'adjust'],
        required: true,
    },
    quantity: {
        type: Number,
        required: true,
    },
    reason: String,
    orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        default: null,
    },
    performedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    timestamp: {
        type: Date,
        default: Date.now,
    },
});

const inventorySchema = new mongoose.Schema(
    {
        restaurantId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        name: {
            type: String,
            required: [true, 'Inventory item name is required'],
            trim: true,
        },
        category: {
            type: String,
            trim: true,
            default: 'General',
        },
        unit: {
            type: String,
            required: [true, 'Unit is required'],
            enum: ['kg', 'g', 'litre', 'ml', 'piece', 'dozen', 'pack', 'bottle'],
            default: 'kg',
        },
        currentStock: {
            type: Number,
            required: true,
            min: 0,
            default: 0,
        },
        lowStockThreshold: {
            type: Number,
            required: true,
            min: 0,
            default: 1,
        },
        costPerUnit: {
            type: Number,
            default: 0,
            min: 0,
        },
        supplier: {
            name: String,
            phone: String,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        stockMovements: [stockMovementSchema],
        lastRestockedAt: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

// Virtual for low stock alert
inventorySchema.virtual('isLowStock').get(function () {
    return this.currentStock <= this.lowStockThreshold;
});

inventorySchema.set('toJSON', { virtuals: true });
inventorySchema.set('toObject', { virtuals: true });

inventorySchema.index({ restaurantId: 1, name: 1 });

module.exports = mongoose.model('Inventory', inventorySchema);
