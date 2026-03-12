const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
    menuItemId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MenuItem',
    },
    name: {
        type: String,
        required: true,
    },
    category: String,
    quantity: {
        type: Number,
        required: true,
        min: 1,
    },
    price: {
        type: Number,
        required: true,
    },
    taxRate: {
        type: Number,
        default: 0,
    },
    notes: {
        type: String,
        default: '',
    },
    status: {
        type: String,
        enum: ['pending', 'preparing', 'ready', 'served'],
        default: 'preparing',
    },
    addedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    addedByName: {
        type: String,
    },
});

const orderSchema = new mongoose.Schema(
    {
        restaurantId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        orderNumber: {
            type: String,
            required: true,
            unique: true,
        },
        tableNumber: {
            type: String,
            default: 'Takeaway',
        },
        items: [orderItemSchema],
        subtotal: {
            type: Number,
            required: true,
            min: 0,
        },
        taxAmount: {
            type: Number,
            default: 0,
        },
        discountType: {
            type: String,
            enum: ['percentage', 'flat', 'none'],
            default: 'none',
        },
        discountValue: {
            type: Number,
            default: 0,
        },
        discountAmount: {
            type: Number,
            default: 0,
        },
        total: {
            type: Number,
            required: true,
            min: 0,
        },
        status: {
            type: String,
            enum: ['pending', 'preparing', 'ready', 'served', 'paid', 'cancelled'],
            default: 'pending',
            index: true,
        },
        paymentMethod: {
            type: String,
            enum: ['cash', 'card', 'upi', 'pending'],
            default: 'pending',
        },
        paymentStatus: {
            type: String,
            enum: ['unpaid', 'paid', 'partial'],
            default: 'unpaid',
        },
        customerName: {
            type: String,
            trim: true,
        },
        customerPhone: {
            type: String,
            trim: true,
        },
        notes: {
            type: String,
            trim: true,
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        waiterName: {
            type: String,
        },
        // Offline sync support
        isOffline: {
            type: Boolean,
            default: false,
        },
        offlineId: {
            type: String, // UUID generated on device
            default: null,
        },
        syncedAt: {
            type: Date,
            default: null,
        },
        kotPrintedAt: {
            type: Date,
            default: null,
        },
        billRequested: {
            type: Boolean,
            default: false,
        },
        billPrinted: {
            type: Boolean,
            default: false,
        },
        billRequestedAt: {
            type: Date,
            default: null,
        },
        orderType: {
            type: String,
            enum: ['dine-in', 'takeaway'],
            default: 'dine-in',
        },
        tokenNumber: {
            type: String,
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

// Compound indexes for analytics queries
orderSchema.index({ restaurantId: 1, createdAt: -1 });
orderSchema.index({ restaurantId: 1, status: 1, createdAt: -1 });
orderSchema.index({ restaurantId: 1, paymentStatus: 1 });

module.exports = mongoose.model('Order', orderSchema);
