const { body } = require('express-validator');
const { 
    API_CONFIG, 
    SUPPORTED_LANGUAGES, 
    SUPPORTED_FRAMEWORKS,
    ERROR_CODES,
    createValidationError
} = require("../utils/constants");

/**
 * Custom validator for code content
 */
const validateCodeContent = (value) => {
    if (typeof value !== 'string') {
        throw new Error('Code must be a string');
    }
    
    const trimmedValue = value.trim();
    
    if (trimmedValue.length === 0) {
        throw new Error('Code cannot be empty or only whitespace');
    }
    
    if (trimmedValue.length > API_CONFIG.MAX_CODE_LENGTH) {
        throw new Error(`Code must not exceed ${API_CONFIG.MAX_CODE_LENGTH} characters`);
    }
    
    // Check for minimum meaningful code (at least some non-whitespace content)
    const nonWhitespaceLength = trimmedValue.replace(/\s/g, '').length;
    if (nonWhitespaceLength < 5) {
        throw new Error('Code must contain meaningful content (at least 5 non-whitespace characters)');
    }
    
    return true;
};

/**
 * Custom validator for programming language
 */
const validateLanguage = (value) => {
    if (!value) return true; // Optional field
    
    if (typeof value !== 'string') {
        throw new Error('Language must be a string');
    }
    
    const normalizedLanguage = value.toLowerCase().trim();
    
    if (!SUPPORTED_LANGUAGES.hasOwnProperty(normalizedLanguage)) {
        const supportedLanguages = Object.keys(SUPPORTED_LANGUAGES).join(', ');
        throw new Error(`Unsupported language. Supported languages: ${supportedLanguages}`);
    }
    
    return true;
};

/**
 * Custom validator for framework
 */
const validateFramework = (value) => {
    if (!value) return true; // Optional field
    
    if (typeof value !== 'string') {
        throw new Error('Framework must be a string');
    }
    
    const normalizedFramework = value.toLowerCase().trim();
    
    if (!SUPPORTED_FRAMEWORKS.includes(normalizedFramework)) {
        // If framework is not in the supported list, warn but don't block
        console.warn(`⚠️ Unsupported framework detected: ${normalizedFramework}`);
        // We don't throw error here as we want to allow custom frameworks
    }
    
    return true;
};

/**
 * Custom validator for file name
 */
const validateFileName = (value) => {
    if (!value) return true; // Optional field
    
    if (typeof value !== 'string') {
        throw new Error('File name must be a string');
    }
    
    const trimmedName = value.trim();
    
    if (trimmedName.length === 0) {
        throw new Error('File name cannot be empty');
    }
    
    if (trimmedName.length > API_CONFIG.MAX_FILE_NAME_LENGTH) {
        throw new Error(`File name must not exceed ${API_CONFIG.MAX_FILE_NAME_LENGTH} characters`);
    }
    
    // Validate file name format (basic security check)
    const invalidChars = /[<>:"|?*\\/]/;
    if (invalidChars.test(trimmedName)) {
        throw new Error('File name contains invalid characters');
    }
    
    // Check for valid file extension if provided
    const parts = trimmedName.split('.');
    if (parts.length > 1) {
        const extension = parts.pop().toLowerCase();
        let isValidExtension = false;
        
        // Check if extension matches any supported language
        for (const langExtensions of Object.values(SUPPORTED_LANGUAGES)) {
            if (langExtensions.includes(extension)) {
                isValidExtension = true;
                break;
            }
        }
        
        if (!isValidExtension) {
            console.warn(`⚠️ Uncommon file extension: ${extension}`);
        }
    }
    
    return true;
};

/**
 * Validation rules for code review requests
 */
const codeReviewValidation = [
    // Code validation
    body('code')
        .notEmpty()
        .withMessage('Code is required')
        .isString()
        .withMessage('Code must be a string')
        .custom(validateCodeContent)
        .bail() // Stop validation chain if previous validators failed
        .trim()
        .escape(),

    // Language validation
    body('language')
        .optional()
        .isString()
        .withMessage('Language must be a string')
        .custom(validateLanguage)
        .bail()
        .trim()
        .toLowerCase(),

    // File name validation
    body('fileName')
        .optional()
        .isString()
        .withMessage('File name must be a string')
        .custom(validateFileName)
        .bail()
        .trim(),

    // Framework validation
    body('framework')
        .optional()
        .isString()
        .withMessage('Framework must be a string')
        .isLength({ max: API_CONFIG.MAX_FRAMEWORK_NAME_LENGTH })
        .withMessage(`Framework name must not exceed ${API_CONFIG.MAX_FRAMEWORK_NAME_LENGTH} characters`)
        .custom(validateFramework)
        .bail()
        .trim()
        .toLowerCase()
];

/**
 * Sanitization middleware for code review
 */
const sanitizeCodeReview = [
    body('code')
        .trim()
        .escape(),
    
    body('language')
        .optional()
        .trim()
        .toLowerCase()
        .customSanitizer(value => {
            if (!value) return value;
            return value.toLowerCase();
        }),
    
    body('fileName')
        .optional()
        .trim()
        .customSanitizer(value => {
            if (!value) return value;
            // Remove potentially dangerous characters from file name
            return value.replace(/[<>:"|?*\\/]/g, '');
        }),
    
    body('framework')
        .optional()
        .trim()
        .toLowerCase()
        .customSanitizer(value => {
            if (!value) return value;
            return value.toLowerCase();
        })
];

/**
 * Custom validation error formatter
 */
const formatValidationError = (req, res, next) => {
    const errorFormatter = ({ location, msg, param, value, nestedErrors }) => {
        return {
            field: param,
            message: msg,
            value: value,
            location: location
        };
    };

    return (req, res, next) => {
        const errors = validationResult(req).formatWith(errorFormatter);
        
        if (!errors.isEmpty()) {
            const validationErrors = errors.array();
            
            // Log validation errors for monitoring
            console.warn('🔍 Validation Failed:', {
                url: req.originalUrl,
                ip: req.ip,
                errors: validationErrors.map(err => `${err.field}: ${err.message}`)
            });
            
            return next(createValidationError(
                'Request validation failed',
                validationErrors
            ));
        }
        
        next();
    };
};

/**
 * Validate that at least code is provided
 */
const validateRequiredFields = (req, res, next) => {
    if (!req.body.code) {
        return next(createValidationError('Code field is required'));
    }
    
    if (typeof req.body.code !== 'string') {
        return next(createValidationError('Code must be a string'));
    }
    
    next();
};

/**
 * Rate limiting validation (complementary to rate limiter middleware)
 */
const validateRateLimitHeaders = (req, res, next) => {
    const rateLimitRemaining = req.rateLimit?.remaining;
    const rateLimitReset = req.rateLimit?.resetTime;
    
    if (rateLimitRemaining !== undefined && rateLimitRemaining < 1) {
        return next(createValidationError(
            'Rate limit exceeded',
            [{
                field: 'rateLimit',
                message: `Too many requests. Reset at: ${new Date(rateLimitReset).toISOString()}`,
                value: rateLimitRemaining
            }]
        ));
    }
    
    next();
};

module.exports = {
    codeReviewValidation,
    sanitizeCodeReview,
    validateCodeContent,
    validateLanguage,
    validateFramework,
    validateFileName,
    formatValidationError,
    validateRequiredFields,
    validateRateLimitHeaders
};