const Attendance = require('../models/Attendance');
const User = require('../models/User');
const mongoose = require('mongoose');
const { sendSuccess, sendError } = require('../utils/responseHelper');

/**
 * Haversine formula — returns distance in meters between two lat/lon points.
 */
function getDistanceMeters(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Earth radius in meters
    const toRad = (deg) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// @desc   Employee location heartbeat — checks geofence, auto-checkouts if outside
// @route  POST /api/attendance/ping
exports.pingLocation = async (req, res, next) => {
    try {
        const { latitude, longitude } = req.body;
        if (latitude == null || longitude == null) {
            return sendError(res, 'Location coordinates are required', 400);
        }

        const employee = await User.findById(req.user.id);
        const owner = await User.findById(employee.parentOwnerId);
        if (!owner || !owner.location?.latitude) {
            return sendError(res, 'Restaurant location not configured', 400);
        }

        const distance = getDistanceMeters(
            owner.location.latitude,
            owner.location.longitude,
            latitude,
            longitude
        );

        const radius = owner.geofenceRadius || 500;
        const today = new Date().toISOString().split('T')[0];
        const activeRecord = await Attendance.findOne({
            employeeId: employee._id,
            date: today,
            status: 'active',
        });

        if (distance > radius) {
            // Employee is outside geofence — mark disconnected
            if (activeRecord) {
                const now = new Date();
                const diffMs = now - activeRecord.checkInTime;
                activeRecord.checkOutTime = now;
                activeRecord.disconnectedAt = now;
                activeRecord.totalHours = parseFloat((diffMs / 3600000).toFixed(2));
                activeRecord.status = 'disconnected';
                await activeRecord.save();
            }
            return sendError(res, `You are ${Math.round(distance)}m from the restaurant (limit: ${radius}m). You have been disconnected.`, 403);
        }

        // Still inside — update last ping
        if (activeRecord) {
            activeRecord.lastPingTime = new Date();
            await activeRecord.save();
        }

        return sendSuccess(res, { distance: Math.round(distance), status: 'inside' }, 'Location verified');
    } catch (error) {
        next(error);
    }
};

// @desc   Manual check-out
// @route  POST /api/attendance/checkout
exports.checkOut = async (req, res, next) => {
    try {
        const record = await Attendance.findOne({
            employeeId: req.user.id,
            status: 'active',
        }).sort({ checkInTime: -1 });

        if (!record) return sendError(res, 'No active attendance record found', 404);

        const now = new Date();
        const diffMs = now - record.checkInTime;
        record.checkOutTime = now;
        record.totalHours = parseFloat((diffMs / 3600000).toFixed(2));
        record.status = 'completed';
        await record.save();

        return sendSuccess(res, { record }, `Checked out successfully. Total hours: ${record.totalHours}`);
    } catch (error) {
        next(error);
    }
};

// @desc   Get attendance history for manager/owner view
// @route  GET /api/attendance
exports.getAttendance = async (req, res, next) => {
    try {
        const caller = await User.findById(req.user.id);
        const isOwner = caller.role === 'owner';
        const isManager = caller.role === 'manager';
        if (!isOwner && !isManager) return sendError(res, 'Access denied', 403);

        const ownerId = isOwner ? caller._id : caller.parentOwnerId;
        const { date, employeeId } = req.query;

        const match = { restaurantId: new mongoose.Types.ObjectId(ownerId) };
        if (date) match.date = date;
        if (employeeId) match.employeeId = new mongoose.Types.ObjectId(employeeId);

        const records = await Attendance.aggregate([
            { $match: match },
            {
                $group: {
                    _id: { employeeId: '$employeeId', date: '$date' },
                    totalHours: { $sum: '$totalHours' },
                    sessions: {
                        $push: {
                            checkInTime: '$checkInTime',
                            checkOutTime: '$checkOutTime',
                            status: '$status',
                            hours: '$totalHours'
                        }
                    }
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: '_id.employeeId',
                    foreignField: '_id',
                    as: 'employee'
                }
            },
            { $unwind: '$employee' },
            {
                $project: {
                    _id: 1,
                    date: '$_id.date',
                    totalHours: { $round: ['$totalHours', 2] },
                    sessions: 1,
                    employeeId: {
                        _id: '$employee._id',
                        name: '$employee.name',
                        email: '$employee.email',
                        role: '$employee.role'
                    }
                }
            },
            { $sort: { date: -1, totalHours: -1 } }
        ]);

        return sendSuccess(res, { records }, 'Attendance records aggregated');
    } catch (error) {
        next(error);
    }
};

// @desc   Get currently active/working employees
// @route  GET /api/attendance/active
exports.getActiveEmployees = async (req, res, next) => {
    try {
        const caller = await User.findById(req.user.id);
        const isOwnerOrManager = caller.role === 'owner' || caller.role === 'manager';
        if (!isOwnerOrManager) return sendError(res, 'Access denied', 403);

        const ownerId = caller.role === 'owner' ? caller._id : caller.parentOwnerId;
        const today = new Date().toISOString().split('T')[0];

        const active = await Attendance.find({
            restaurantId: ownerId,
            date: today,
            status: 'active',
        }).populate('employeeId', 'name email role');

        return sendSuccess(res, { active, count: active.length }, 'Active employees fetched');
    } catch (error) {
        next(error);
    }
};

exports.getDistanceMeters = getDistanceMeters;
