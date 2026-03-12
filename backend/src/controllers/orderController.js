const { v4: uuidv4 } = require('uuid');
const Order = require('../models/Order');
const { deductInventoryForOrder, restoreInventoryForOrder } = require('../services/inventoryService');
const { sendSuccess, sendError, sendPaginated } = require('../utils/responseHelper');

// Generate unique order number
const generateOrderNumber = () => {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `KM-${timestamp}-${random}`;
};

// @desc    Get all orders
// @route   GET /api/orders
exports.getOrders = async (req, res, next) => {
    try {
        const { status, date, page = 1, limit = 20, tableNumber, paymentStatus, orderType, billRequested, billPrinted } = req.query;
        const query = { restaurantId: req.restaurantId };

        if (status) query.status = status;
        if (paymentStatus) query.paymentStatus = paymentStatus;
        if (tableNumber) query.tableNumber = tableNumber;
        if (orderType) query.orderType = orderType;
        if (billRequested !== undefined) query.billRequested = billRequested === 'true';
        if (billPrinted !== undefined) query.billPrinted = billPrinted === 'true';
        if (date) {
            const start = new Date(date);
            start.setHours(0, 0, 0, 0);
            const end = new Date(date);
            end.setHours(23, 59, 59, 999);
            query.createdAt = { $gte: start, $lte: end };
        }

        const skip = (page - 1) * limit;
        const [orders, total] = await Promise.all([
            Order.find(query).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)).lean(),
            Order.countDocuments(query),
        ]);

        return sendPaginated(res, { orders }, total, page, limit);
    } catch (error) {
        next(error);
    }
};

// @desc    Get single order by ID
// @route   GET /api/orders/:id
exports.getOrder = async (req, res, next) => {
    try {
        const order = await Order.findOne({ _id: req.params.id, restaurantId: req.restaurantId });
        if (!order) return sendError(res, 'Order not found', 404);
        return sendSuccess(res, { order });
    } catch (error) {
        next(error);
    }
};

// @desc    Create a new order
// @route   POST /api/orders
exports.createOrder = async (req, res, next) => {
    try {
        const {
            items, tableNumber, subtotal, taxAmount, discountType,
            discountValue, discountAmount, total, paymentMethod,
            customerName, customerPhone, notes, isOffline, offlineId,
        } = req.body;

        if (!items || items.length === 0) {
            return sendError(res, 'Order must have at least one item', 400);
        }

        // Prevent duplicate offline orders
        if (offlineId) {
            const existing = await Order.findOne({ offlineId, restaurantId: req.restaurantId });
            if (existing) {
                return sendSuccess(res, { order: existing }, 'Order already synced', 200);
            }
        }

        const itemsWithUser = items.map(item => ({
            ...item,
            addedBy: req.user._id,
            addedByName: req.user.name
        }));

        const orderType = req.body.orderType || 'dine-in';

        // Auto-generate daily token number for takeaway orders
        let tokenNumber = null;
        if (orderType === 'takeaway') {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            const todayTakeawayCount = await Order.countDocuments({
                restaurantId: req.restaurantId,
                orderType: 'takeaway',
                createdAt: { $gte: today, $lt: tomorrow }
            });
            tokenNumber = `T${String(todayTakeawayCount + 1).padStart(3, '0')}`;
        }

        const order = await Order.create({
            restaurantId: req.restaurantId,
            orderNumber: generateOrderNumber(),
            items: itemsWithUser, tableNumber, subtotal, taxAmount,
            discountType, discountValue, discountAmount, total,
            paymentMethod, customerName, customerPhone, notes,
            orderType,
            tokenNumber,
            status: req.body.status || 'preparing',
            createdBy: req.user._id,
            waiterName: req.user.name,
            isOffline: isOffline || false,
            offlineId: offlineId || null,
            syncedAt: isOffline ? new Date() : null,
        });

        // Auto-deduct inventory
        const inventoryResult = await deductInventoryForOrder(
            items,
            req.restaurantId,
            order._id,
            req.restaurantId
        );

        // Emit KOT via socket.io
        const io = req.app.get('io');
        if (io) {
            io.to(`restaurant:${req.restaurantId}`).emit('kot:new', {
                order: {
                    _id: order._id,
                    orderNumber: order.orderNumber,
                    tableNumber: order.tableNumber,
                    items: order.items,
                    status: order.status,
                    createdAt: order.createdAt,
                },
            });
        }

        return sendSuccess(
            res,
            { order, inventoryResult },
            'Order placed successfully',
            201
        );
    } catch (error) {
        next(error);
    }
};

// @desc    Update order status (for KOT)
// @route   PATCH /api/orders/:id/status
exports.updateOrderStatus = async (req, res, next) => {
    try {
        const { status, paymentMethod, paymentStatus, billRequested } = req.body;

        const update = { status };
        if (paymentMethod) update.paymentMethod = paymentMethod;
        if (paymentStatus) update.paymentStatus = paymentStatus;
        if (status === 'paid') update.paymentStatus = 'paid';

        if (billRequested !== undefined) {
            update.billRequested = billRequested;
            if (billRequested) update.billRequestedAt = new Date();
        }

        const order = await Order.findOneAndUpdate(
            { _id: req.params.id, restaurantId: req.restaurantId },
            update,
            { new: true }
        );

        if (!order) return sendError(res, 'Order not found', 404);

        // If cancelled, restore inventory
        if (status === 'cancelled') {
            await restoreInventoryForOrder(order.items, req.restaurantId, order._id, req.restaurantId);
        }

        const io = req.app.get('io');
        if (io) {
            // Emit status update for kitchen/POS display
            io.to(`restaurant:${req.restaurantId}`).emit('kot:statusUpdate', {
                orderId: order._id,
                orderNumber: order.orderNumber,
                status: order.status,
            });

            // If a bill is requested, notify the desktop billing queue
            if (billRequested) {
                io.to(`restaurant:${req.restaurantId}`).emit('billing:newRequest', { order });
            }
        }

        return sendSuccess(res, { order }, `Order status updated to '${status}'`);
    } catch (error) {
        next(error);
    }
};

// @desc    Mark bill as printed
// @route   PATCH /api/orders/:id/print
exports.markBillPrinted = async (req, res, next) => {
    try {
        const order = await Order.findOneAndUpdate(
            { _id: req.params.id, restaurantId: req.restaurantId },
            { billPrinted: true, billRequested: false },
            { new: true }
        );

        if (!order) return sendError(res, 'Order not found', 404);

        const io = req.app.get('io');
        if (io) {
            io.to(`restaurant:${req.restaurantId}`).emit('billing:printed', {
                orderId: order._id,
                orderNumber: order.orderNumber
            });
        }

        return sendSuccess(res, { order }, 'Bill marked as printed');
    } catch (error) {
        next(error);
    }
};

// @desc    Update individual order item status (for KOT)
// @route   PATCH /api/orders/:id/items/:itemId/status
exports.updateItemStatus = async (req, res, next) => {
    try {
        const { status } = req.body; // e.g., 'ready'

        const order = await Order.findOne({ _id: req.params.id, restaurantId: req.restaurantId });
        if (!order) return sendError(res, 'Order not found', 404);

        const item = order.items.id(req.params.itemId);
        if (!item) return sendError(res, 'Item not found in order', 404);

        item.status = status;

        // Check if ALL items are now ready
        const allReady = order.items.every(i => i.status === 'ready' || i.status === 'served');
        if (allReady && order.status === 'preparing') {
            order.status = 'ready';
        }

        await order.save();

        // Emit item status update for kitchen display & POS
        const io = req.app.get('io');
        if (io) {
            io.to(`restaurant:${req.restaurantId}`).emit('kot:itemUpdate', {
                orderId: order._id,
                itemId: item._id,
                status: item.status,
                orderStatus: order.status,
            });
        }

        return sendSuccess(res, { order }, `Item status updated to '${status}'`);
    } catch (error) {
        next(error);
    }
};

// @desc    Update/Append to an existing order (Running Table)
// @route   PUT /api/orders/:id
exports.updateOrder = async (req, res, next) => {
    try {
        const {
            items, subtotal, taxAmount, discountType,
            discountValue, discountAmount, total, notes
        } = req.body;

        if (!items || items.length === 0) {
            return sendError(res, 'Order must have at least one item', 400);
        }

        const existingOrder = await Order.findOne({ _id: req.params.id, restaurantId: req.restaurantId });
        if (!existingOrder) return sendError(res, 'Order not found', 404);

        if (existingOrder.paymentStatus === 'paid' && req.user.role !== 'owner') {
            return sendError(res, 'Only owners can modify a paid historical order', 403);
        }

        // Very basic inventory handling for modifications:
        // We restore all old items to inventory
        await restoreInventoryForOrder(existingOrder.items, req.restaurantId, existingOrder._id, req.restaurantId);

        // Update the order doc
        // Logic for merging items:
        // 1. If an item has an _id, it's an existing item. We MUST preserve its status unless specifically overridden.
        // 2. If an item doesn't have an _id, it's a NEW add-on. Its status should be 'preparing'.
        const itemsWithStatus = items.map(item => {
            if (item._id) {
                const existingItem = existingOrder.items.id(item._id);
                if (existingItem) {
                    // Status Protection: 
                    // 1. If DB says 'served', keep it as 'served'.
                    // 2. If DB says 'ready', only allow 'served' as an update (prevent moving back to preparing).
                    // 3. Otherwise, use item.status or preserve existing.
                    let statusToSave = item.status || existingItem.status;

                    if (existingItem.status === 'served') {
                        statusToSave = 'served';
                    } else if (existingItem.status === 'ready') {
                        // If it's ready, it can only move to 'served'. Stale 'preparing' updates are ignored.
                        statusToSave = (item.status === 'served') ? 'served' : 'ready';
                    }

                    return {
                        ...item,
                        status: statusToSave,
                        addedBy: existingItem.addedBy,
                        addedByName: existingItem.addedByName
                    };
                }
            }

            // New item (add-on)
            return {
                ...item,
                status: 'preparing',
                addedBy: req.user._id,
                addedByName: req.user.name
            };
        });

        existingOrder.items = itemsWithStatus;
        existingOrder.subtotal = subtotal;
        existingOrder.taxAmount = taxAmount;
        existingOrder.discountType = discountType;
        existingOrder.discountValue = discountValue;
        existingOrder.discountAmount = discountAmount;
        existingOrder.total = total;
        if (notes !== undefined) existingOrder.notes = notes;

        // Overall order status logic: 
        // If there are ANY 'preparing' or 'pending' items, the order status should be 'preparing'.
        const hasPreparing = existingOrder.items.some(i => i.status === 'preparing' || i.status === 'pending');
        if (hasPreparing) {
            existingOrder.status = 'preparing';
        } else {
            const allReady = existingOrder.items.every(i => i.status === 'ready' || i.status === 'served');
            if (allReady) existingOrder.status = 'ready';
        }

        await existingOrder.save();

        // Deduct inventory for the newly updated full list
        const inventoryResult = await deductInventoryForOrder(
            items,
            req.restaurantId,
            existingOrder._id,
            req.restaurantId
        );

        // Emit KOT update to kitchen
        const io = req.app.get('io');
        if (io) {
            io.to(`restaurant:${req.restaurantId}`).emit('kot:update', {
                order: {
                    _id: existingOrder._id,
                    orderNumber: existingOrder.orderNumber,
                    tableNumber: existingOrder.tableNumber,
                    items: existingOrder.items,
                    status: existingOrder.status,
                    updatedAt: existingOrder.updatedAt,
                },
            });
        }

        return sendSuccess(
            res,
            { order: existingOrder, inventoryResult },
            'Running order updated successfully',
            200
        );
    } catch (error) {
        next(error);
    }
};

// @desc    Sync offline orders batch
// @route   POST /api/orders/sync-offline
exports.syncOfflineOrders = async (req, res, next) => {
    try {
        const { orders } = req.body;
        if (!Array.isArray(orders) || orders.length === 0) {
            return sendError(res, 'Orders array is required', 400);
        }

        const results = { synced: [], failed: [], duplicates: [] };

        for (const orderData of orders) {
            try {
                if (orderData.offlineId) {
                    const existing = await Order.findOne({ offlineId: orderData.offlineId, restaurantId: req.restaurantId });
                    if (existing) {
                        results.duplicates.push(orderData.offlineId);
                        continue;
                    }
                }

                const order = await Order.create({
                    ...orderData,
                    restaurantId: req.restaurantId,
                    orderNumber: generateOrderNumber(),
                    createdBy: req.restaurantId,
                    isOffline: true,
                    syncedAt: new Date(),
                });

                await deductInventoryForOrder(orderData.items, req.restaurantId, order._id, req.restaurantId);
                results.synced.push(order._id);
            } catch (err) {
                results.failed.push({ offlineId: orderData.offlineId, error: err.message });
            }
        }

        return sendSuccess(res, results, `Synced ${results.synced.length} orders`);
    } catch (error) {
        next(error);
    }
};

// @desc    Delete order
// @route   DELETE /api/orders/:id
exports.deleteOrder = async (req, res, next) => {
    try {
        const order = await Order.findOneAndDelete({ _id: req.params.id, restaurantId: req.restaurantId });
        if (!order) return sendError(res, 'Order not found', 404);

        return sendSuccess(res, null, 'Order deleted successfully');
    } catch (error) {
        next(error);
    }
};

// @desc    Export orders to CSV
// @route   GET /api/orders/export/csv
exports.exportOrdersCSV = async (req, res, next) => {
    try {
        const orders = await Order.find({ restaurantId: req.restaurantId }).sort({ createdAt: -1 }).lean();

        if (!orders.length) {
            return sendError(res, 'No orders to export', 404);
        }

        const fields = ['orderNumber', 'tableNumber', 'status', 'paymentStatus', 'total', 'createdAt', 'waiterName'];
        const csvRows = [];
        csvRows.push(fields.join(','));

        for (const order of orders) {
            const row = fields.map(field => {
                let val = order[field] || '';
                if (field === 'createdAt') val = new Date(val).toISOString();
                return `"${String(val).replace(/"/g, '""')}"`;
            });
            csvRows.push(row.join(','));
        }

        const csvData = csvRows.join('\n');

        res.status(200).send(csvData);
    } catch (error) {
        next(error);
    }
};

// @desc    Split an order
// @route   POST /api/orders/:id/split
exports.splitOrder = async (req, res, next) => {
    try {
        const { itemIds, newTableNumber } = req.body;
        if (!itemIds || !itemIds.length || !newTableNumber) {
            return sendError(res, 'Item IDs and a new table number are required', 400);
        }

        const order = await Order.findOne({ _id: req.params.id, restaurantId: req.restaurantId });
        if (!order) return sendError(res, 'Original order not found', 404);

        // Find items to move
        const itemsToMoveIds = itemIds.map(id => id.toString());
        const itemsToMove = order.items.filter(item => itemsToMoveIds.includes(item._id?.toString()) || itemsToMoveIds.includes(item.menuItemId?.toString()));
        if (!itemsToMove.length) return sendError(res, 'No valid items found to split', 400);

        // Calculate totals for the new order
        const newSubtotal = itemsToMove.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const newTaxAmount = itemsToMove.reduce((sum, item) => sum + (item.price * item.quantity * (item.taxRate || 0) / 100), 0);
        const newTotal = newSubtotal + newTaxAmount;

        // Create new order
        const newOrder = await Order.create({
            restaurantId: req.restaurantId,
            orderNumber: generateOrderNumber(),
            tableNumber: newTableNumber,
            items: itemsToMove,
            subtotal: newSubtotal,
            taxAmount: newTaxAmount,
            total: newTotal,
            status: order.status,
            customerName: order.customerName,
            customerPhone: order.customerPhone,
            paymentStatus: order.paymentStatus,
            createdBy: req.user._id,
            waiterName: req.user.name
        });

        // Emit new KOT for split order
        const io = req.app.get('io');
        if (io) {
            io.to(`restaurant:${req.restaurantId}`).emit('kot:new', {
                order: {
                    _id: newOrder._id,
                    orderNumber: newOrder.orderNumber,
                    tableNumber: newOrder.tableNumber,
                    items: newOrder.items,
                    status: newOrder.status,
                    createdAt: newOrder.createdAt,
                },
            });
        }

        // Remove items from original order
        order.items = order.items.filter(item => !itemsToMoveIds.includes(item._id?.toString()) && !itemsToMoveIds.includes(item.menuItemId?.toString()));

        // If original order is empty, delete it
        if (order.items.length === 0) {
            const originalId = order._id;
            const originalOrderNumber = order.orderNumber;
            await Order.findByIdAndDelete(order._id);

            // Emit status update to remove original from KOT
            if (io) {
                io.to(`restaurant:${req.restaurantId}`).emit('kot:statusUpdate', {
                    orderId: originalId,
                    orderNumber: originalOrderNumber,
                    status: 'cancelled',
                });
            }

            return sendSuccess(res, { newOrder }, 'Order split successfully: original order was empty and deleted');
        } else {
            // Recalculate original order
            order.subtotal = order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            order.taxAmount = order.items.reduce((sum, item) => sum + (item.price * item.quantity * (item.taxRate || 0) / 100), 0);
            // Simplified discount handling for split (resetting them to avoid complex prorating)
            order.discountAmount = 0;
            order.discountType = 'none';
            order.discountValue = 0;
            order.total = order.subtotal + order.taxAmount;

            await order.save();

            // Emit update for original order
            if (io) {
                io.to(`restaurant:${req.restaurantId}`).emit('kot:update', {
                    order: {
                        _id: order._id,
                        orderNumber: order.orderNumber,
                        tableNumber: order.tableNumber,
                        items: order.items,
                        status: order.status,
                        createdAt: order.createdAt,
                    },
                });
            }

            return sendSuccess(res, { originOrder: order, newOrder }, 'Order split successfully');
        }

    } catch (error) {
        next(error);
    }
};

// @desc    Combine orders
// @route   POST /api/orders/:id/combine
exports.combineOrders = async (req, res, next) => {
    try {
        const { targetOrderId } = req.body;
        if (!targetOrderId) {
            return sendError(res, 'Target Order ID is required', 400);
        }

        const sourceOrder = await Order.findOne({ _id: req.params.id, restaurantId: req.restaurantId });
        const targetOrder = await Order.findOne({ _id: targetOrderId, restaurantId: req.restaurantId });

        if (!sourceOrder) return sendError(res, 'Source order not found', 404);
        if (!targetOrder) return sendError(res, 'Target order not found', 404);

        if (sourceOrder.paymentStatus === 'paid' || targetOrder.paymentStatus === 'paid') {
            return sendError(res, 'Cannot combine paid orders', 400);
        }

        // Add all items from source to target
        const combinedItems = [...targetOrder.items, ...sourceOrder.items];

        // Recalculate target
        targetOrder.items = combinedItems;
        targetOrder.subtotal = targetOrder.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        targetOrder.taxAmount = targetOrder.items.reduce((sum, item) => sum + (item.price * item.quantity * (item.taxRate || 0) / 100), 0);
        // Reset discounts for simplicity on combination
        targetOrder.discountAmount = 0;
        targetOrder.discountType = 'none';
        targetOrder.discountValue = 0;
        targetOrder.total = targetOrder.subtotal + targetOrder.taxAmount;

        // Ensure status reflects new un-made items
        const hasPreparing = targetOrder.items.some(i => i.status === 'preparing' || i.status === 'pending');
        if (hasPreparing) {
            targetOrder.status = 'preparing';
        }

        await targetOrder.save();
        const sourceId = sourceOrder._id;
        const sourceOrderNumber = sourceOrder.orderNumber;
        await Order.findByIdAndDelete(sourceOrder._id);

        // Emit Socket Events
        const io = req.app.get('io');
        if (io) {
            // Remove source from KOT
            io.to(`restaurant:${req.restaurantId}`).emit('kot:statusUpdate', {
                orderId: sourceId,
                orderNumber: sourceOrderNumber,
                status: 'cancelled',
            });
            // Update target in KOT
            io.to(`restaurant:${req.restaurantId}`).emit('kot:update', {
                order: {
                    _id: targetOrder._id,
                    orderNumber: targetOrder.orderNumber,
                    tableNumber: targetOrder.tableNumber,
                    items: targetOrder.items,
                    status: targetOrder.status,
                    createdAt: targetOrder.createdAt,
                },
            });
        }

        return sendSuccess(res, { targetOrder }, 'Orders combined successfully');
    } catch (error) {
        next(error);
    }
};
