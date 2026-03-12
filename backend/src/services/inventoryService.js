const Inventory = require('../models/Inventory');
const MenuItem = require('../models/MenuItem');

/**
 * Automatically deducts raw materials from inventory
 * when an order is placed, based on MenuItem.ingredients config.
 */
const deductInventoryForOrder = async (orderItems, restaurantId, orderId, performedById) => {
    const results = { deducted: [], failed: [], lowStock: [] };

    for (const item of orderItems) {
        if (!item.menuItemId) continue;

        const menuItem = await MenuItem.findById(item.menuItemId).lean();
        if (!menuItem || !menuItem.ingredients || menuItem.ingredients.length === 0) continue;

        for (const ingredient of menuItem.ingredients) {
            const totalDeduction = ingredient.quantityUsed * item.quantity;

            try {
                const inventoryItem = await Inventory.findOne({
                    _id: ingredient.inventoryItemId,
                    restaurantId,
                });

                if (!inventoryItem) {
                    results.failed.push({
                        itemName: ingredient.inventoryItemName,
                        reason: 'Inventory item not found',
                    });
                    continue;
                }

                const previousStock = inventoryItem.currentStock;
                inventoryItem.currentStock = Math.max(0, previousStock - totalDeduction);

                // Log the movement
                inventoryItem.stockMovements.push({
                    type: 'deduct',
                    quantity: totalDeduction,
                    reason: `Order #${orderId}`,
                    orderId,
                    performedBy: performedById,
                });

                await inventoryItem.save();

                results.deducted.push({
                    inventoryItemId: inventoryItem._id,
                    name: inventoryItem.name,
                    deducted: totalDeduction,
                    remaining: inventoryItem.currentStock,
                });

                // Check low stock
                if (inventoryItem.currentStock <= inventoryItem.lowStockThreshold) {
                    results.lowStock.push({
                        id: inventoryItem._id,
                        name: inventoryItem.name,
                        currentStock: inventoryItem.currentStock,
                        unit: inventoryItem.unit,
                        threshold: inventoryItem.lowStockThreshold,
                    });
                }
            } catch (err) {
                results.failed.push({
                    itemName: ingredient.inventoryItemName,
                    reason: err.message,
                });
            }
        }
    }

    return results;
};

/**
 * Restores inventory if an order is cancelled.
 */
const restoreInventoryForOrder = async (orderItems, restaurantId, orderId, performedById) => {
    for (const item of orderItems) {
        if (!item.menuItemId) continue;

        const menuItem = await MenuItem.findById(item.menuItemId).lean();
        if (!menuItem || !menuItem.ingredients || menuItem.ingredients.length === 0) continue;

        for (const ingredient of menuItem.ingredients) {
            const totalRestore = ingredient.quantityUsed * item.quantity;

            const inventoryItem = await Inventory.findOne({
                _id: ingredient.inventoryItemId,
                restaurantId,
            });

            if (!inventoryItem) continue;

            inventoryItem.currentStock += totalRestore;
            inventoryItem.stockMovements.push({
                type: 'add',
                quantity: totalRestore,
                reason: `Cancelled Order #${orderId}`,
                orderId,
                performedBy: performedById,
            });

            await inventoryItem.save();
        }
    }
};

module.exports = { deductInventoryForOrder, restoreInventoryForOrder };
