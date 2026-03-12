const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { sendError } = require('../utils/responseHelper');

const protect = async (req, res, next) => {
    try {
        let token;

        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (!token) {
            return sendError(res, 'Not authorized, no token provided', 401);
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select('-password');

        if (!user || !user.isActive) {
            return sendError(res, 'User not found or deactivated', 401);
        }

        req.user = user;
        req.restaurantId = user.role === 'owner' ? user._id : user.parentOwnerId;
        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return sendError(res, 'Invalid token', 401);
        }
        if (error.name === 'TokenExpiredError') {
            return sendError(res, 'Token expired, please login again', 401);
        }
        return sendError(res, 'Authentication failed', 401);
    }
};

const authorize = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return sendError(res, `Role '${req.user.role}' is not authorized for this action`, 403);
        }
        next();
    };
};

module.exports = { protect, authorize };
