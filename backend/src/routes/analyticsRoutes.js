const express = require('express');
const router = express.Router();
const { getSalesSummary, getLowStockAlerts, getDashboardStats } = require('../controllers/analyticsController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/dashboard', getDashboardStats);
router.get('/sales', getSalesSummary);
router.get('/low-stock', getLowStockAlerts);

module.exports = router;
