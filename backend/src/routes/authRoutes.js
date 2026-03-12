const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const {
    register,
    login,
    getMe,
    updateProfile,
    completeOnboarding,
    registerEmployee,
    getEmployees,
    updateEmployee
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

router.post(
    '/register',
    [
        body('name').trim().notEmpty().withMessage('Name is required'),
        body('email').isEmail().withMessage('Valid email is required'),
        body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
        body('restaurantName').trim().notEmpty().withMessage('Restaurant name is required'),
    ],
    register
);

router.post(
    '/employee/register',
    protect,
    [
        body('name').trim().notEmpty().withMessage('Name is required'),
        body('email').isEmail().withMessage('Valid email is required'),
        body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
        body('role').trim().notEmpty().withMessage('Role is required'),
    ],
    registerEmployee
);

router.put('/employee/:id', protect, updateEmployee);

router.post('/login', login);
router.get('/me', protect, getMe);
router.get('/employees', protect, getEmployees);
router.put('/profile', protect, updateProfile);
router.post('/onboarding', protect, completeOnboarding);

module.exports = router;
