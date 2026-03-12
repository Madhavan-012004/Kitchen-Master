const mongoose = require('mongoose');
const Order = require('../models/Order');
const Inventory = require('../models/Inventory');
const { sendSuccess, sendError } = require('../utils/responseHelper');

// @desc    Sales analytics summary
// @route   GET /api/analytics/sales
exports.getSalesSummary = async (req, res, next) => {
    try {
        const { period = '7d' } = req.query;
        const restaurantId = req.restaurantId;

        const daysMap = { '1d': 1, '7d': 7, '30d': 30, '90d': 90 };
        const days = daysMap[period] || 7;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const [salesAgg, topItems, revenueByDay] = await Promise.all([
            // Overall summary
            Order.aggregate([
                {
                    $match: {
                        restaurantId: new mongoose.Types.ObjectId(restaurantId),
                        status: { $ne: 'cancelled' },
                        createdAt: { $gte: startDate },
                    },
                },
                {
                    $group: {
                        _id: null,
                        totalOrders: { $sum: 1 },
                        totalRevenue: { $sum: '$total' },
                        totalTax: { $sum: '$taxAmount' },
                        totalDiscount: { $sum: '$discountAmount' },
                        avgOrderValue: { $avg: '$total' },
                    },
                },
            ]),

            // Top-selling items
            Order.aggregate([
                {
                    $match: {
                        restaurantId: new mongoose.Types.ObjectId(restaurantId),
                        status: { $ne: 'cancelled' },
                        createdAt: { $gte: startDate },
                    },
                },
                { $unwind: '$items' },
                {
                    $group: {
                        _id: '$items.name',
                        totalQuantity: { $sum: '$items.quantity' },
                        totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
                    },
                },
                { $sort: { totalQuantity: -1 } },
                { $limit: 10 },
            ]),

            // Revenue by day
            Order.aggregate([
                {
                    $match: {
                        restaurantId: new mongoose.Types.ObjectId(restaurantId),
                        status: { $ne: 'cancelled' },
                        createdAt: { $gte: startDate },
                    },
                },
                {
                    $group: {
                        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                        revenue: { $sum: '$total' },
                        orders: { $sum: 1 },
                    },
                },
                { $sort: { _id: 1 } },
            ]),
        ]);

        const summary = salesAgg[0] || {
            totalOrders: 0, totalRevenue: 0, totalTax: 0,
            totalDiscount: 0, avgOrderValue: 0,
        };

        return sendSuccess(res, { summary, topItems, revenueByDay, period }, 'Sales analytics fetched');
    } catch (error) {
        next(error);
    }
};

// @desc    Low stock alert for dashboard
// @route   GET /api/analytics/low-stock
exports.getLowStockAlerts = async (req, res, next) => {
    try {
        const items = await Inventory.aggregate([
            { $match: { restaurantId: new mongoose.Types.ObjectId(req.restaurantId), isActive: true } },
            {
                $addFields: {
                    isLowStock: { $lte: ['$currentStock', '$lowStockThreshold'] },
                    daysOfStockLeft: {
                        $cond: {
                            if: { $gt: ['$lowStockThreshold', 0] },
                            then: { $divide: ['$currentStock', '$lowStockThreshold'] },
                            else: 99,
                        },
                    },
                },
            },
            { $match: { isLowStock: true } },
            { $sort: { currentStock: 1 } },
            { $project: { stockMovements: 0 } },
        ]);

        return sendSuccess(res, { alerts: items, count: items.length }, 'Low stock alerts fetched');
    } catch (error) {
        next(error);
    }
};

// @desc    Quick Dashboard stats (Revenue, Orders, Active Tables today)
// @route   GET /api/analytics/dashboard
exports.getDashboardStats = async (req, res, next) => {
    try {
        const restaurantId = req.restaurantId;
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        const [todayOrdersAgg, activeTablesCount] = await Promise.all([
            Order.aggregate([
                {
                    $match: {
                        restaurantId: new mongoose.Types.ObjectId(restaurantId),
                        createdAt: { $gte: startOfToday },
                        status: { $ne: 'cancelled' }
                    }
                },
                {
                    $group: {
                        _id: null,
                        todayRevenue: { $sum: '$total' },
                        todayOrders: { $sum: 1 },
                        totalItemsSold: { $sum: { $sum: "$items.quantity" } }
                    }
                }
            ]),
            Order.countDocuments({
                restaurantId,
                status: { $in: ['preparing', 'ready', 'served'] },
            })
        ]);

        const stats = todayOrdersAgg[0] || { todayRevenue: 0, todayOrders: 0, totalItemsSold: 0 };
        return sendSuccess(res, {
            todayRevenue: stats.todayRevenue,
            todayOrders: stats.todayOrders,
            totalItemsSold: stats.totalItemsSold,
            activeTables: activeTablesCount
        }, 'Dashboard stats fetched');
    } catch (error) {
        next(error);
    }
};
