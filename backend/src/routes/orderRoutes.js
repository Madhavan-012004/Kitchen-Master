const express = require('express');
const router = express.Router();
const {
    getOrders, getOrder, createOrder, updateOrderStatus, syncOfflineOrders, updateOrder, updateItemStatus, markBillPrinted, deleteOrder, exportOrdersCSV, splitOrder, combineOrders
} = require('../controllers/orderController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/export/csv', authorize('owner'), exportOrdersCSV);

router.route('/').get(getOrders).post(createOrder);
router.post('/sync-offline', syncOfflineOrders);

// General modification and deletion
router.route('/:id')
    .get(getOrder)
    .put(updateOrder)
    .delete(authorize('owner'), deleteOrder);

// KOT adjustments (allow waiter/kitchen to change status)
router.patch('/:id/status', updateOrderStatus);
router.patch('/:id/items/:itemId/status', updateItemStatus);
router.patch('/:id/print', markBillPrinted);
router.post('/:id/split', splitOrder);
router.post('/:id/combine', combineOrders);

module.exports = router;
