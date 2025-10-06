const express = require('express');
const { 
    getCodeReview, 
    getSupportedLanguages, 
    getSupportedFrameworks, 
    healthCheck, 
    getServiceStatus 
} = require("../controller/ai.controller");
const { 
    codeReviewValidation, 
    sanitizeCodeReview, 
    formatValidationError,
    validateRequiredFields 
} = require("../middleware/validation");
const { 
    codeReviewLimiter, 
    healthCheckLimiter, 
    generalLimiter,
    getRateLimitStats 
} = require("../middleware/rateLimiter");
const { asyncHandler } = require("../middleware/errorHandler");

const router = express.Router();

/**
 * @route   POST /api/review
 * @description Perform AI-powered code review
 * @access  Public
 * @body    {string} code - Source code to review (required)
 * @body    {string} [language] - Programming language (auto-detected if not provided)
 * @body    {string} [fileName] - File name for language detection
 * @body    {string} [framework] - Framework context for better analysis
 * @returns {Object} Code review results with issues and recommendations
 */
router.post(
    "/review",
    codeReviewLimiter, // Specific rate limiting for code reviews
    sanitizeCodeReview, // Sanitize input data first
    validateRequiredFields, // Basic validation before detailed validation
    codeReviewValidation, // Detailed validation rules
    formatValidationError, // Format validation errors consistently
    asyncHandler(getCodeReview) // Main controller with error handling
);

/**
 * @route   GET /api/languages
 * @description Get list of supported programming languages and frameworks
 * @access  Public
 * @returns {Object} Supported languages, extensions, and frameworks
 */
router.get(
    "/languages",
    generalLimiter, // General rate limiting
    asyncHandler(getSupportedLanguages)
);

/**
 * @route   GET /api/frameworks
 * @description Get list of supported frameworks
 * @access  Public
 * @returns {Object} Supported frameworks list
 */
router.get(
    "/frameworks",
    generalLimiter,
    asyncHandler(getSupportedFrameworks)
);

/**
 * @route   GET /api/health
 * @description Check AI service health status
 * @access  Public
 * @returns {Object} Service health status and metadata
 */
router.get(
    "/health",
    healthCheckLimiter, // Stricter rate limiting for health checks
    asyncHandler(healthCheck)
);

/**
 * @route   GET /api/status
 * @description Get comprehensive service status information
 * @access  Public
 * @returns {Object} Detailed service status, capabilities, and configuration
 */
router.get(
    "/status",
    generalLimiter,
    asyncHandler(getServiceStatus)
);

/**
 * @route   GET /api/rate-limit-stats
 * @description Get rate limit statistics (Admin endpoint)
 * @access  Private
 * @returns {Object} Rate limiting statistics and configuration
 */
router.get(
    "/rate-limit-stats",
    generalLimiter,
    asyncHandler((req, res) => getRateLimitStats(req, res))
);

/**
 * @route   GET /api/
 * @description API root endpoint with documentation
 * @access  Public
 * @returns {Object} API information and available endpoints
 */
router.get(
    "/",
    generalLimiter,
    asyncHandler((req, res) => {
        res.status(200).json({
            success: true,
            message: 'Code Review AI API',
            version: '1.0.0',
            timestamp: new Date().toISOString(),
            endpoints: {
                review: {
                    method: 'POST',
                    path: '/api/review',
                    description: 'Perform AI code review',
                    body: {
                        code: 'string (required)',
                        language: 'string (optional)',
                        fileName: 'string (optional)',
                        framework: 'string (optional)'
                    }
                },
                languages: {
                    method: 'GET',
                    path: '/api/languages',
                    description: 'Get supported programming languages'
                },
                frameworks: {
                    method: 'GET', 
                    path: '/api/frameworks',
                    description: 'Get supported frameworks'
                },
                health: {
                    method: 'GET',
                    path: '/api/health',
                    description: 'Check service health status'
                },
                status: {
                    method: 'GET',
                    path: '/api/status',
                    description: 'Get comprehensive service status'
                }
            },
            documentation: {
                github: 'https://github.com/your-username/code-review-ai',
                apiDocs: '/api/docs', // If you add Swagger later
                support: 'https://github.com/your-username/code-review-ai/issues'
            }
        });
    })
);

/**
 * @route   GET /api/docs
 * @description API documentation endpoint
 * @access  Public
 * @returns {Object} Detailed API documentation
 */
router.get(
    "/docs",
    generalLimiter,
    asyncHandler((req, res) => {
        res.status(200).json({
            success: true,
            message: 'Code Review AI API Documentation',
            version: '1.0.0',
            baseURL: `${req.protocol}://${req.get('host')}/api`,
            endpoints: {
                'POST /review': {
                    description: 'Analyze code and provide AI-powered review',
                    parameters: {
                        body: {
                            code: {
                                type: 'string',
                                required: true,
                                description: 'Source code to analyze',
                                maxLength: 15000
                            },
                            language: {
                                type: 'string',
                                required: false,
                                description: 'Programming language for context',
                                examples: ['javascript', 'python', 'java']
                            },
                            fileName: {
                                type: 'string', 
                                required: false,
                                description: 'File name for language detection',
                                maxLength: 255
                            },
                            framework: {
                                type: 'string',
                                required: false,
                                description: 'Framework for better analysis',
                                examples: ['react', 'django', 'springboot']
                            }
                        }
                    },
                    responses: {
                        200: {
                            description: 'Successful code review',
                            schema: {
                                overallScore: 'number (0-10)',
                                summary: 'string',
                                issues: 'Array<Issue>',
                                positiveAspects: 'Array<string>',
                                recommendations: 'Array<string>'
                            }
                        },
                        400: 'Validation error',
                        429: 'Rate limit exceeded',
                        500: 'Internal server error'
                    }
                },
                'GET /languages': {
                    description: 'Get supported programming languages',
                    responses: {
                        200: {
                            description: 'List of supported languages',
                            schema: {
                                languages: 'Array<string>',
                                extensions: 'Object<string, Array<string>>',
                                frameworks: 'Array<string>'
                            }
                        }
                    }
                },
                'GET /health': {
                    description: 'Check service health status',
                    responses: {
                        200: 'Service is healthy',
                        503: 'Service is unavailable'
                    }
                }
            },
            rateLimiting: {
                'POST /review': '50 requests per 15 minutes',
                'GET /health': '10 requests per minute', 
                'General': '100 requests per 15 minutes'
            },
            limits: {
                maxCodeLength: 15000,
                maxFileNameLength: 255,
                maxFrameworkLength: 100,
                requestTimeout: '45 seconds'
            }
        });
    })
);

// Export router
module.exports = router;