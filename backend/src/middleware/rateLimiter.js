const rateLimit = require('express-rate-limit');
const { 
    RATE_LIMIT_CONFIG, 
    ERROR_CODES, 
    RESPONSE_MESSAGES,
    API_CONFIG,
    LOGGING_CONFIG
} = require("../utils/constants");

/**
 * Simple rate limiter for code review API endpoints
 */
const codeReviewLimiter = rateLimit({
    windowMs: RATE_LIMIT_CONFIG.CODE_REVIEW_WINDOW_MS,
    max: RATE_LIMIT_CONFIG.CODE_REVIEW_MAX_REQUESTS,
    message: {
        success: false,
        message: 'Too many code review requests from this IP, please try again after 15 minutes',
        errorCode: ERROR_CODES.RATE_LIMIT_EXCEEDED
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req, res) => {
        // Skip rate limiting in development for easier testing
        return API_CONFIG.NODE_ENV === 'development';
    },
    handler: (req, res, next, options) => {
        console.warn('🚫 Rate Limit Exceeded:', {
            ip: req.ip,
            url: req.originalUrl,
            method: req.method,
            timestamp: new Date().toISOString()
        });
        res.status(429).json(options.message);
    }
});

/**
 * Strict rate limiter for health check endpoints
 */
const healthCheckLimiter = rateLimit({
    windowMs: RATE_LIMIT_CONFIG.HEALTH_CHECK_WINDOW_MS,
    max: RATE_LIMIT_CONFIG.HEALTH_CHECK_MAX_REQUESTS,
    message: {
        success: false,
        message: 'Too many health check requests',
        errorCode: ERROR_CODES.HEALTH_CHECK_LIMIT_EXCEEDED
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req, res) => {
        return API_CONFIG.NODE_ENV === 'development';
    }
});

/**
 * General API rate limiter for all other endpoints
 */
const generalLimiter = rateLimit({
    windowMs: RATE_LIMIT_CONFIG.GENERAL_WINDOW_MS,
    max: RATE_LIMIT_CONFIG.GENERAL_MAX_REQUESTS,
    message: {
        success: false,
        message: 'Too many requests from this IP, please try again later',
        errorCode: ERROR_CODES.RATE_LIMIT_EXCEEDED
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req, res) => {
        return API_CONFIG.NODE_ENV === 'development';
    }
});

module.exports = {
    codeReviewLimiter,
    healthCheckLimiter,
    generalLimiter
};