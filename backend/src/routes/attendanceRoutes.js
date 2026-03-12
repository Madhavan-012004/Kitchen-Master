const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
    pingLocation,
    checkOut,
    getAttendance,
    getActiveEmployees,
} = require('../controllers/attendanceController');

router.use(protect);

router.post('/ping', pingLocation);
router.post('/checkout', checkOut);
router.get('/', getAttendance);
router.get('/active', getActiveEmployees);

module.exports = router;
