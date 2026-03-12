const express = require('express');
const router = express.Router();
const {
    getInventoryItems, getInventoryItem, createInventoryItem,
    updateInventoryItem, restockItem, deleteInventoryItem,
} = require('../controllers/inventoryController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.route('/').get(getInventoryItems).post(createInventoryItem);
router.route('/:id').get(getInventoryItem).put(updateInventoryItem).delete(deleteInventoryItem);
router.post('/:id/restock', restockItem);

module.exports = router;
