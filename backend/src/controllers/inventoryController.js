const mongoose = require('mongoose');
const Inventory = require('../models/Inventory');
const { sendSuccess, sendError, sendPaginated } = require('../utils/responseHelper');

// @desc    Get all inventory items
// @route   GET /api/inventory
exports.getInventoryItems = async (req, res, next) => {
    try {
        const { lowStock, page = 1, limit = 50, category } = req.query;
        const query = { restaurantId: req.restaurantId, isActive: true };

        if (category) query.category = category;
        if (lowStock === 'true') {
            // This filters for items where currentStock <= lowStockThreshold using aggregation
            const items = await Inventory.aggregate([
                { $match: { restaurantId: new mongoose.Types.ObjectId(req.restaurantId), isActive: true } },
                {
                    $addFields: {
                        isLowStock: { $lte: ['$currentStock', '$lowStockThreshold'] },
                    },
                },
                { $match: { isLowStock: true } },
                { $sort: { currentStock: 1 } },
            ]);
            return sendSuccess(res, { items, total: items.length }, 'Low stock items fetched');
        }

        const skip = (page - 1) * limit;
        const [items, total] = await Promise.all([
            Inventory.find(query)
                .select('-stockMovements')
                .sort({ name: 1 })
                .skip(skip)
                .limit(parseInt(limit))
                .lean({ virtuals: true }),
            Inventory.countDocuments(query),
        ]);

        return sendPaginated(res, { items }, total, page, limit);
    } catch (error) {
        next(error);
    }
};

// @desc    Get single inventory item with movement history
// @route   GET /api/inventory/:id
exports.getInventoryItem = async (req, res, next) => {
    try {
        const item = await Inventory.findOne({ _id: req.params.id, restaurantId: req.restaurantId });
        if (!item) return sendError(res, 'Inventory item not found', 404);
        return sendSuccess(res, { item });
    } catch (error) {
        next(error);
    }
};

// @desc    Create inventory item
// @route   POST /api/inventory
exports.createInventoryItem = async (req, res, next) => {
    try {
        const item = await Inventory.create({ ...req.body, restaurantId: req.restaurantId });
        return sendSuccess(res, { item }, 'Inventory item created', 201);
    } catch (error) {
        next(error);
    }
};

// @desc    Update inventory item
// @route   PUT /api/inventory/:id
exports.updateInventoryItem = async (req, res, next) => {
    try {
        const item = await Inventory.findOneAndUpdate(
            { _id: req.params.id, restaurantId: req.restaurantId },
            req.body,
            { new: true, runValidators: true }
        );
        if (!item) return sendError(res, 'Inventory item not found', 404);
        return sendSuccess(res, { item }, 'Inventory item updated');
    } catch (error) {
        next(error);
    }
};

// @desc    Restock inventory item (add stock)
// @route   POST /api/inventory/:id/restock
exports.restockItem = async (req, res, next) => {
    try {
        const { quantity, notes } = req.body;
        if (!quantity || quantity <= 0) {
            return sendError(res, 'Quantity must be greater than 0', 400);
        }

        const item = await Inventory.findOne({ _id: req.params.id, restaurantId: req.restaurantId });
        if (!item) return sendError(res, 'Inventory item not found', 404);

        item.currentStock += quantity;
        item.lastRestockedAt = new Date();
        item.stockMovements.push({
            type: 'add',
            quantity,
            reason: notes || 'Manual restock',
            performedBy: req.restaurantId,
        });

        await item.save();
        return sendSuccess(res, { item }, `Restocked ${quantity} ${item.unit} of ${item.name}`);
    } catch (error) {
        next(error);
    }
};

// @desc    Delete inventory item (soft delete)
// @route   DELETE /api/inventory/:id
exports.deleteInventoryItem = async (req, res, next) => {
    try {
        const item = await Inventory.findOneAndUpdate(
            { _id: req.params.id, restaurantId: req.restaurantId },
            { isActive: false },
            { new: true }
        );
        if (!item) return sendError(res, 'Inventory item not found', 404);
        return sendSuccess(res, {}, 'Inventory item deleted');
    } catch (error) {
        next(error);
    }
};
