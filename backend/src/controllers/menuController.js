const MenuItem = require('../models/MenuItem');
const { sendSuccess, sendError, sendPaginated } = require('../utils/responseHelper');

// @desc    Get all menu items for the restaurant
// @route   GET /api/menu
exports.getMenuItems = async (req, res, next) => {
    try {
        const { category, available, page = 1, limit = 50 } = req.query;
        const query = { restaurantId: req.restaurantId };

        if (category) query.category = category;
        if (available !== undefined) query.isAvailable = available === 'true';

        const skip = (page - 1) * limit;
        const [items, total] = await Promise.all([
            MenuItem.find(query).sort({ category: 1, sortOrder: 1, name: 1 }).skip(skip).limit(parseInt(limit)).lean(),
            MenuItem.countDocuments(query),
        ]);

        // Group by category for easy POS rendering
        const grouped = items.reduce((acc, item) => {
            if (!acc[item.category]) acc[item.category] = [];
            acc[item.category].push(item);
            return acc;
        }, {});

        return sendPaginated(res, { items, grouped, categories: Object.keys(grouped) }, total, page, limit);
    } catch (error) {
        next(error);
    }
};

// @desc    Get single menu item
// @route   GET /api/menu/:id
exports.getMenuItem = async (req, res, next) => {
    try {
        const item = await MenuItem.findOne({ _id: req.params.id, restaurantId: req.restaurantId }).populate(
            'ingredients.inventoryItemId',
            'name currentStock unit'
        );

        if (!item) return sendError(res, 'Menu item not found', 404);
        return sendSuccess(res, { item });
    } catch (error) {
        next(error);
    }
};

// @desc    Create a new menu item
// @route   POST /api/menu
exports.createMenuItem = async (req, res, next) => {
    try {
        const item = await MenuItem.create({ ...req.body, restaurantId: req.restaurantId });
        return sendSuccess(res, { item }, 'Menu item created successfully', 201);
    } catch (error) {
        next(error);
    }
};

// @desc    Update a menu item
// @route   PUT /api/menu/:id
exports.updateMenuItem = async (req, res, next) => {
    try {
        const item = await MenuItem.findOneAndUpdate(
            { _id: req.params.id, restaurantId: req.restaurantId },
            req.body,
            { new: true, runValidators: true }
        );

        if (!item) return sendError(res, 'Menu item not found', 404);
        return sendSuccess(res, { item }, 'Menu item updated successfully');
    } catch (error) {
        next(error);
    }
};

// @desc    Delete a menu item
// @route   DELETE /api/menu/:id
exports.deleteMenuItem = async (req, res, next) => {
    try {
        const item = await MenuItem.findOneAndDelete({ _id: req.params.id, restaurantId: req.restaurantId });
        if (!item) return sendError(res, 'Menu item not found', 404);
        return sendSuccess(res, {}, 'Menu item deleted successfully');
    } catch (error) {
        next(error);
    }
};

// @desc    Bulk import menu items (from AI digitizer)
// @route   POST /api/menu/bulk
exports.bulkCreateMenuItems = async (req, res, next) => {
    try {
        const { items } = req.body;
        if (!Array.isArray(items) || items.length === 0) {
            return sendError(res, 'Items array is required and cannot be empty', 400);
        }

        const menuItems = items.map((item) => ({ ...item, restaurantId: req.restaurantId }));
        const created = await MenuItem.insertMany(menuItems, { ordered: false });

        return sendSuccess(res, { created: created.length, items: created }, `${created.length} menu items imported`, 201);
    } catch (error) {
        next(error);
    }
};

// @desc    Toggle item availability
// @route   PATCH /api/menu/:id/toggle
exports.toggleAvailability = async (req, res, next) => {
    try {
        const item = await MenuItem.findOne({ _id: req.params.id, restaurantId: req.restaurantId });
        if (!item) return sendError(res, 'Menu item not found', 404);

        item.isAvailable = !item.isAvailable;
        await item.save();

        return sendSuccess(res, { item }, `Item marked as ${item.isAvailable ? 'available' : 'unavailable'}`);
    } catch (error) {
        next(error);
    }
};
