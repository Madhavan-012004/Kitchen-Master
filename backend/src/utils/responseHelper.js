const sendSuccess = (res, data = {}, message = 'Success', statusCode = 200) => {
    return res.status(statusCode).json({
        success: true,
        message,
        data,
    });
};

const sendError = (res, message = 'An error occurred', statusCode = 500, data = {}) => {
    return res.status(statusCode).json({
        success: false,
        message,
        data,
    });
};

const sendPaginated = (res, data, total, page, limit, message = 'Success') => {
    return res.status(200).json({
        success: true,
        message,
        data,
        pagination: {
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            pages: Math.ceil(total / limit),
        },
    });
};

module.exports = { sendSuccess, sendError, sendPaginated };
