const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const User = require('../models/User');
const Attendance = require('../models/Attendance');
const { sendSuccess, sendError } = require('../utils/responseHelper');
const { getDistanceMeters } = require('./attendanceController');

const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRE || '7d',
    });
};

// @desc    Register a new user/restaurant
// @route   POST /api/auth/register
exports.register = async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return sendError(res, errors.array()[0].msg, 400);
        }

        const { name, email, password, restaurantName, phone, latitude, longitude } = req.body;

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return sendError(res, 'Email already registered', 400);
        }

        const location = (latitude != null && longitude != null)
            ? { latitude: parseFloat(latitude), longitude: parseFloat(longitude) }
            : { latitude: null, longitude: null };

        const user = await User.create({ name, email, password, restaurantName, phone, location });
        const token = generateToken(user._id);

        return sendSuccess(
            res,
            { token, user: user.toJSON() },
            'Registration successful! Welcome to Kitchen Master.',
            201
        );
    } catch (error) {
        next(error);
    }
};

// @desc    Register a new employee under an owner
// @route   POST /api/auth/employee/register
exports.registerEmployee = async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return sendError(res, errors.array()[0].msg, 400);
        }

        const { name, email, password, role, assignedTables } = req.body;

        // Ensure user is an owner
        const owner = await User.findById(req.user.id);
        if (!owner || owner.role !== 'owner') {
            return sendError(res, 'Only owners can register employees', 403);
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return sendError(res, 'Email already registered', 400);
        }

        const validRoles = ['manager', 'waiter', 'kitchen', 'inventory', 'biller'];
        if (!validRoles.includes(role)) {
            return sendError(res, 'Invalid employee role provided', 400);
        }

        const employee = await User.create({
            name,
            email,
            password,
            role,
            assignedTables: assignedTables || [],
            parentOwnerId: owner._id,
            restaurantName: owner.restaurantName, // Inherit restaurant name
            onboardingCompleted: true, // Employees don't need onboarding
            subscription: { ...owner.subscription }
        });

        return sendSuccess(
            res,
            { user: employee.toJSON() },
            'Employee registration successful!',
            201
        );
    } catch (error) {
        next(error);
    }
};

// @desc    Update an employee
// @route   PUT /api/auth/employee/:id
exports.updateEmployee = async (req, res, next) => {
    try {
        const owner = await User.findById(req.user.id);
        if (!owner || owner.role !== 'owner') {
            return sendError(res, 'Only owners can update employees', 403);
        }

        const employeeId = req.params.id;
        const { name, role, assignedTables, password } = req.body;

        const validRoles = ['manager', 'waiter', 'kitchen', 'inventory', 'biller'];
        const updateData = {};
        if (name) updateData.name = name;
        if (role && validRoles.includes(role)) updateData.role = role;
        if (assignedTables !== undefined) updateData.assignedTables = assignedTables;
        if (password) {
            // Hash handled by pre-save hook on User model if we findById and save
            const employee = await User.findOne({ _id: employeeId, parentOwnerId: owner._id });
            if (!employee) return sendError(res, 'Employee not found', 404);
            employee.name = updateData.name || employee.name;
            if (updateData.role) employee.role = updateData.role;
            if (updateData.assignedTables !== undefined) employee.assignedTables = updateData.assignedTables;
            employee.password = password;
            await employee.save();
            return sendSuccess(res, { employee }, 'Employee updated successfully');
        }

        const employee = await User.findOneAndUpdate(
            { _id: employeeId, parentOwnerId: owner._id },
            updateData,
            { new: true, runValidators: true }
        );

        if (!employee) {
            return sendError(res, 'Employee not found', 404);
        }

        return sendSuccess(res, { employee }, 'Employee updated successfully');
    } catch (error) {
        next(error);
    }
};

// @desc    Login user
// @route   POST /api/auth/login
exports.login = async (req, res, next) => {
    try {
        const { email, password, latitude, longitude } = req.body;

        if (!email || !password) {
            return sendError(res, 'Please provide email and password', 400);
        }

        const user = await User.findOne({ email }).select('+password');
        if (!user) {
            return sendError(res, 'Invalid credentials', 401);
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return sendError(res, 'Invalid credentials', 401);
        }

        if (!user.isActive) {
            return sendError(res, 'Account is deactivated. Contact support.', 403);
        }

        // ─── Geo-fence check for non-owner employees ──────────────
        if (user.role !== 'owner') {
            if (latitude == null || longitude == null) {
                return sendError(res, 'Your location is required to clock in. Please enable GPS.', 403);
            }

            const owner = await User.findById(user.parentOwnerId);
            if (!owner) {
                return sendError(res, 'Owner account not found', 500);
            }

            if (!owner.location?.latitude) {
                return sendError(res, 'Restaurant location has not been configured by the owner yet.', 403);
            }

            const distance = getDistanceMeters(
                owner.location.latitude, owner.location.longitude,
                parseFloat(latitude), parseFloat(longitude)
            );

            const radius = owner.geofenceRadius || 500;
            if (distance > radius) {
                return sendError(
                    res,
                    `You are ${Math.round(distance)}m away from the restaurant. Login is only allowed within ${radius}m.`,
                    403
                );
            }

            // ─── Create attendance check-in record ────────────────
            const today = new Date().toISOString().split('T')[0];
            const existingRecord = await Attendance.findOne({
                employeeId: user._id,
                restaurantId: owner._id,
                date: today,
                status: 'active',
            });

            if (!existingRecord) {
                await Attendance.create({
                    employeeId: user._id,
                    restaurantId: owner._id,
                    date: today,
                    checkInTime: new Date(),
                    lastPingTime: new Date(),
                    status: 'active',
                });
            }
        }

        const token = generateToken(user._id);
        return sendSuccess(res, { token, user: user.toJSON() }, 'Login successful');
    } catch (error) {
        next(error);
    }
};

// @desc    Get all employees for the current owner
// @route   GET /api/auth/employees
exports.getEmployees = async (req, res, next) => {
    try {
        const owner = await User.findById(req.user.id);
        if (!owner || owner.role !== 'owner') {
            return sendError(res, 'Only owners can view employees', 403);
        }

        const employees = await User.find({ parentOwnerId: owner._id }).select('-password');
        return sendSuccess(res, { employees }, 'Employees fetched successfully');
    } catch (error) {
        next(error);
    }
};

// @desc    Get current logged-in user
// @route   GET /api/auth/me
exports.getMe = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id);
        return sendSuccess(res, { user }, 'User profile fetched');
    } catch (error) {
        next(error);
    }
};

// @desc    Update restaurant profile
// @route   PUT /api/auth/profile
exports.updateProfile = async (req, res, next) => {
    try {
        const { restaurantName, phone, address, currency, taxRate, onboardingStep, onboardingCompleted, latitude, longitude, geofenceRadius } = req.body;

        const updateFields = { restaurantName, phone, address, currency, taxRate, onboardingStep, onboardingCompleted, geofenceRadius };

        if (latitude != null && longitude != null) {
            updateFields.location = {
                latitude: parseFloat(latitude),
                longitude: parseFloat(longitude)
            };
        }

        const updatedUser = await User.findByIdAndUpdate(
            req.user.id,
            updateFields,
            { new: true, runValidators: true }
        );

        return sendSuccess(res, { user: updatedUser }, 'Profile updated successfully');
    } catch (error) {
        next(error);
    }
};

// @desc    Complete onboarding step
// @route   POST /api/auth/onboarding
exports.completeOnboarding = async (req, res, next) => {
    try {
        const { step, data } = req.body;
        const updateData = { onboardingStep: step, ...data };

        if (step === 3) {
            updateData.onboardingCompleted = true;
        }

        const user = await User.findByIdAndUpdate(req.user.id, updateData, { new: true });
        return sendSuccess(res, { user }, `Onboarding step ${step} completed`);
    } catch (error) {
        next(error);
    }
};
