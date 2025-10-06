const { 
    ERROR_CODES, 
    HTTP_STATUS, 
    RESPONSE_MESSAGES,
    API_CONFIG,
    LOGGING_CONFIG 
} = require("../utils/constants");

/**
 * Global error handling middleware
 * @param {Error} err - Error object
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Express next function
 */
const errorHandler = (err, req, res, next) => {
    const timestamp = new Date().toISOString();
    
    // Log error with structured information
    console.error('🚨 Global Error Handler:', {
        message: err.message,
        stack: err.stack,
        url: req.originalUrl,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('user-agent'),
        timestamp: timestamp,
        body: LOGGING_CONFIG.LEVEL === 'debug' ? req.body : undefined
    });

    // Default error response
    let errorResponse = {
        success: false,
        message: RESPONSE_MESSAGES.ERROR.CODE_REVIEW_FAILED,
        errorCode: ERROR_CODES.INTERNAL_ERROR,
        timestamp: timestamp,
        path: req.originalUrl
    };

    let statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR;

    // Handle specific error types with centralized error codes
    if (err.name === 'ValidationError') {
        statusCode = HTTP_STATUS.BAD_REQUEST;
        errorResponse.message = 'Validation failed';
        errorResponse.errorCode = ERROR_CODES.VALIDATION_ERROR;
        errorResponse.details = err.details || err.message;
    } else if (err.name === 'SyntaxError' && err.type === 'entity.parse.failed') {
        statusCode = HTTP_STATUS.BAD_REQUEST;
        errorResponse.message = 'Invalid JSON in request body';
        errorResponse.errorCode = ERROR_CODES.INVALID_JSON;
    } else if (err.code === 'LIMIT_FILE_SIZE') {
        statusCode = HTTP_STATUS.PAYLOAD_TOO_LARGE;
        errorResponse.message = 'File too large';
        errorResponse.errorCode = ERROR_CODES.FILE_TOO_LARGE;
    } else if (err.code === 'ECONNREFUSED') {
        statusCode = HTTP_STATUS.SERVICE_UNAVAILABLE;
        errorResponse.message = RESPONSE_MESSAGES.ERROR.SERVICE_UNAVAILABLE;
        errorResponse.errorCode = ERROR_CODES.SERVICE_UNAVAILABLE;
    } else if (err.statusCode && err.statusCode >= 400 && err.statusCode < 500) {
        statusCode = err.statusCode;
        errorResponse.message = err.message || 'Client error';
        errorResponse.errorCode = err.errorCode || ERROR_CODES.INVALID_INPUT;
    }

    // Handle AI service specific errors
    if (err.message.includes('AI service') || err.message.includes('Gemini') || err.message.includes('API key')) {
        statusCode = HTTP_STATUS.SERVICE_UNAVAILABLE;
        errorResponse.message = RESPONSE_MESSAGES.ERROR.SERVICE_UNAVAILABLE;
        errorResponse.errorCode = ERROR_CODES.AI_SERVICE_UNAVAILABLE;
    } else if (err.message.includes('timeout')) {
        statusCode = HTTP_STATUS.GATEWAY_TIMEOUT;
        errorResponse.message = 'Request timeout - please try with a smaller code snippet';
        errorResponse.errorCode = ERROR_CODES.AI_TIMEOUT;
    } else if (err.message.includes('quota') || err.message.includes('rate limit')) {
        statusCode = HTTP_STATUS.TOO_MANY_REQUESTS;
        errorResponse.message = RESPONSE_MESSAGES.ERROR.RATE_LIMIT_EXCEEDED;
        errorResponse.errorCode = ERROR_CODES.RATE_LIMIT_EXCEEDED;
    } else if (err.message.includes('Invalid code') || err.message.includes('Empty code')) {
        statusCode = HTTP_STATUS.BAD_REQUEST;
        errorResponse.message = err.message;
        errorResponse.errorCode = ERROR_CODES.INVALID_INPUT;
    } else if (err.message.includes('too long')) {
        statusCode = HTTP_STATUS.PAYLOAD_TOO_LARGE;
        errorResponse.message = `Code exceeds maximum allowed size (${API_CONFIG.MAX_CODE_LENGTH} characters)`;
        errorResponse.errorCode = ERROR_CODES.PAYLOAD_TOO_LARGE;
    }

    // Include additional details in development
    if (API_CONFIG.NODE_ENV === 'development') {
        errorResponse.stack = err.stack;
        errorResponse.details = err.message;
    }

    // Ensure error response is clean and consistent
    res.status(statusCode).json(this.sanitizeErrorResponse(errorResponse));
};

/**
 * Sanitize error response to ensure consistent structure
 * @param {Object} errorResponse - Raw error response
 * @returns {Object} - Sanitized error response
 */
function sanitizeErrorResponse(errorResponse) {
    const sanitized = { ...errorResponse };
    
    // Remove undefined values
    Object.keys(sanitized).forEach(key => {
        if (sanitized[key] === undefined) {
            delete sanitized[key];
        }
    });

    // Ensure required fields
    if (!sanitized.success) sanitized.success = false;
    if (!sanitized.message) sanitized.message = RESPONSE_MESSAGES.ERROR.CODE_REVIEW_FAILED;
    if (!sanitized.errorCode) sanitized.errorCode = ERROR_CODES.INTERNAL_ERROR;

    return sanitized;
}

/**
 * 404 Not Found middleware
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Express next function
 */
const notFoundHandler = (req, res, next) => {
    const errorResponse = {
        success: false,
        message: `Route ${req.originalUrl} not found`,
        errorCode: ERROR_CODES.ROUTE_NOT_FOUND,
        timestamp: new Date().toISOString(),
        path: req.originalUrl
    };

    if (LOGGING_CONFIG.ENABLE_REQUEST_LOGGING) {
        console.warn('🔍 404 Not Found:', {
            url: req.originalUrl,
            method: req.method,
            ip: req.ip
        });
    }

    res.status(HTTP_STATUS.NOT_FOUND).json(errorResponse);
};

/**
 * Async error handler wrapper
 * @param {Function} fn - Async function to wrap
 * @returns {Function} - Wrapped function with error handling
 */
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Custom error class for application-specific errors
 */
class AppError extends Error {
    constructor(message, errorCode, statusCode) {
        super(message);
        this.name = 'AppError';
        this.errorCode = errorCode || ERROR_CODES.INTERNAL_ERROR;
        this.statusCode = statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR;
        
        // Capture stack trace
        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * Create validation error
 * @param {string} message - Error message
 * @param {Array} details - Validation details
 * @returns {AppError} - Validation error instance
 */
const createValidationError = (message, details = []) => {
    const error = new AppError(
        message || 'Validation failed',
        ERROR_CODES.VALIDATION_ERROR,
        HTTP_STATUS.BAD_REQUEST
    );
    error.details = details;
    return error;
};

/**
 * Create AI service error
 * @param {string} message - Error message
 * @returns {AppError} - AI service error instance
 */
const createAIServiceError = (message) => {
    return new AppError(
        message || RESPONSE_MESSAGES.ERROR.SERVICE_UNAVAILABLE,
        ERROR_CODES.AI_SERVICE_UNAVAILABLE,
        HTTP_STATUS.SERVICE_UNAVAILABLE
    );
};

/**
 * Create rate limit error
 * @param {string} message - Error message
 * @returns {AppError} - Rate limit error instance
 */
const createRateLimitError = (message) => {
    return new AppError(
        message || RESPONSE_MESSAGES.ERROR.RATE_LIMIT_EXCEEDED,
        ERROR_CODES.RATE_LIMIT_EXCEEDED,
        HTTP_STATUS.TOO_MANY_REQUESTS
    );
};

module.exports = {
    errorHandler,
    notFoundHandler,
    asyncHandler,
    AppError,
    createValidationError,
    createAIServiceError,
    createRateLimitError,
    sanitizeErrorResponse
};