const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const MenuItem = require('../models/MenuItem');
const Inventory = require('../models/Inventory');
const Order = require('../models/Order');
const aiService = require('../services/aiService');
const { sendSuccess, sendError } = require('../utils/responseHelper');

// @desc    Digitize a physical menu photo → extract items
// @route   POST /api/ai/menu-digitizer
exports.digitizeMenu = async (req, res, next) => {
    try {
        if (!req.file) {
            return sendError(res, 'Please upload a menu image (JPEG, PNG, WebP or HEIC)', 400);
        }

        const imagePath = req.file.path;

        const extractedItems = await aiService.digitizeMenuFromImage(imagePath);

        // Cleanup temp file
        fs.unlink(imagePath, () => { });

        return sendSuccess(
            res,
            { items: extractedItems, count: extractedItems.length },
            `Extracted ${extractedItems.length} menu items. Review and confirm to import.`
        );
    } catch (error) {
        if (req.file) fs.unlink(req.file.path, () => { });
        next(error);
    }
};

// @desc    Parse voice/text → structured order
// @route   POST /api/ai/voice-kot
exports.parseVoiceOrder = async (req, res, next) => {
    try {
        const { text } = req.body;
        if (!text || text.trim().length === 0) {
            return sendError(res, 'Transcribed text is required', 400);
        }

        const availableItems = await MenuItem.find({
            restaurantId: req.restaurantId,
            isAvailable: true,
        }).select('_id name price category').lean();

        const parsedOrder = await aiService.parseVoiceOrder(text, availableItems);

        return sendSuccess(res, { order: parsedOrder }, 'Voice order parsed successfully');
    } catch (error) {
        next(error);
    }
};

// @desc    Smart upsell suggestions based on current cart
// @route   POST /api/ai/upsell
exports.getUpsellSuggestions = async (req, res, next) => {
    try {
        const { cartItems } = req.body;
        if (!cartItems || cartItems.length === 0) {
            return sendError(res, 'Cart items are required', 400);
        }

        const restaurantId = req.restaurantId;

        // Find co-ordered items from order history
        const cartItemNames = cartItems.map((i) => i.name);
        const coOrderedPipeline = await Order.aggregate([
            {
                $match: {
                    restaurantId: new mongoose.Types.ObjectId(restaurantId),
                    'items.name': { $in: cartItemNames },
                    status: { $ne: 'cancelled' },
                },
            },
            { $unwind: '$items' },
            { $match: { 'items.name': { $nin: cartItemNames } } },
            { $group: { _id: '$items.name', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 5 },
        ]);

        const allMenuItems = await MenuItem.find({
            restaurantId,
            isAvailable: true,
        }).select('_id name category').lean();

        const suggestions = await aiService.getUpsellSuggestions(cartItems, allMenuItems, coOrderedPipeline);

        return sendSuccess(res, { suggestions }, 'Upsell suggestions ready');
    } catch (error) {
        next(error);
    }
};

// @desc    Predictive inventory forecast
// @route   GET /api/ai/inventory-forecast
exports.getInventoryForecast = async (req, res, next) => {
    try {
        const restaurantId = req.restaurantId;

        // Get low-stock inventory items
        const lowStockItems = await Inventory.aggregate([
            { $match: { restaurantId: new mongoose.Types.ObjectId(restaurantId), isActive: true } },
            {
                $addFields: {
                    isLowStock: { $lte: ['$currentStock', '$lowStockThreshold'] },
                },
            },
            { $match: { isLowStock: true } },
            { $project: { stockMovements: 0 } },
        ]);

        // Get recent 7-day sales summary
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const salesSummary = await Order.aggregate([
            {
                $match: {
                    restaurantId: new mongoose.Types.ObjectId(restaurantId),
                    status: { $ne: 'cancelled' },
                    createdAt: { $gte: sevenDaysAgo },
                },
            },
            { $unwind: '$items' },
            {
                $group: {
                    _id: '$items.name',
                    totalQty: { $sum: '$items.quantity' },
                },
            },
            { $sort: { totalQty: -1 } },
            { $limit: 20 },
        ]);

        const forecast = await aiService.forecastInventoryNeeds(lowStockItems, salesSummary);

        return sendSuccess(res, { forecast, lowStockCount: lowStockItems.length }, 'Inventory forecast ready');
    } catch (error) {
        next(error);
    }
};
