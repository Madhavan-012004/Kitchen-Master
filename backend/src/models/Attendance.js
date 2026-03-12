const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema(
    {
        employeeId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        restaurantId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        date: {
            type: String, // YYYY-MM-DD
            required: true,
        },
        checkInTime: {
            type: Date,
            required: true,
        },
        checkOutTime: {
            type: Date,
            default: null,
        },
        totalHours: {
            type: Number,
            default: 0, // Calculated on checkout
        },
        status: {
            type: String,
            enum: ['active', 'completed', 'disconnected'],
            default: 'active',
        },
        lastPingTime: {
            type: Date,
            default: null,
        },
        disconnectedAt: {
            type: Date,
            default: null,
        },
    },
    { timestamps: true }
);

// Compound index so we can quickly find today's attendance for an employee
attendanceSchema.index({ employeeId: 1, date: 1 });

module.exports = mongoose.model('Attendance', attendanceSchema);
