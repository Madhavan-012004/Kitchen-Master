const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Name is required'],
            trim: true,
            maxlength: [50, 'Name cannot exceed 50 characters'],
        },
        email: {
            type: String,
            required: [true, 'Email is required'],
            unique: true,
            lowercase: true,
            trim: true,
            match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email'],
        },
        password: {
            type: String,
            required: [true, 'Password is required'],
            minlength: [6, 'Password must be at least 6 characters'],
            select: false,
        },
        restaurantName: {
            type: String,
            required: [true, 'Restaurant name is required'],
            trim: true,
        },
        phone: {
            type: String,
            trim: true,
        },
        address: {
            type: String,
            trim: true,
        },
        location: {
            latitude: { type: Number, default: null },
            longitude: { type: Number, default: null },
        },
        geofenceRadius: {
            type: Number,
            default: 500, // meters
        },
        logo: {
            type: String,
            default: null,
        },
        currency: {
            type: String,
            default: 'INR',
        },
        taxRate: {
            type: Number,
            default: 5,
            min: 0,
            max: 100,
        },
        role: {
            type: String,
            enum: ['owner', 'manager', 'waiter', 'kitchen', 'inventory'],
            default: 'owner',
        },
        parentOwnerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null, // Only populated if role !== 'owner'
        },
        assignedTables: [{
            type: String,
        }],
        subscription: {
            plan: {
                type: String,
                enum: ['free', 'pro', 'enterprise'],
                default: 'free',
            },
            startedAt: {
                type: Date,
                default: Date.now,
            },
            expiresAt: {
                type: Date,
                default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days free trial
            },
            isActive: {
                type: Boolean,
                default: true,
            },
        },
        onboardingCompleted: {
            type: Boolean,
            default: false,
        },
        onboardingStep: {
            type: Number,
            default: 1,
            min: 1,
            max: 3,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
    },
    {
        timestamps: true,
    }
);

// Hash password before saving
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

// Remove sensitive fields when converting to JSON
userSchema.methods.toJSON = function () {
    const obj = this.toObject();
    delete obj.password;
    return obj;
};

module.exports = mongoose.model('User', userSchema);
