const express = require('express');
const router = express.Router();
const {
    getMenuItems, getMenuItem, createMenuItem, updateMenuItem,
    deleteMenuItem, bulkCreateMenuItems, toggleAvailability,
} = require('../controllers/menuController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.route('/').get(getMenuItems).post(createMenuItem);
router.post('/bulk', bulkCreateMenuItems);
router.route('/:id').get(getMenuItem).put(updateMenuItem).delete(deleteMenuItem);
router.patch('/:id/toggle', toggleAvailability);

module.exports = router;
