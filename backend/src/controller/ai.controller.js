const aiService = require("../services/ai.services");;
const { 
    API_CONFIG, 
    ERROR_CODES, 
    HTTP_STATUS, 
    RESPONSE_MESSAGES,
    LOGGING_CONFIG,
    createValidationError,
} = require("../utils/constants");

/**
 * @class AIController
 * @description Handles AI-powered code review requests
 */
class AIController {
    constructor() {
        // Bind methods to maintain 'this' context
        this.getCodeReview = this.getCodeReview.bind(this);
        this.getSupportedLanguages = this.getSupportedLanguages.bind(this);
        this.healthCheck = this.healthCheck.bind(this);
        this.getSupportedFrameworks = this.getSupportedFrameworks.bind(this);
    }

    /**
     * @method getCodeReview
     * @description Perform comprehensive code review using AI
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next middleware function
     */
    async getCodeReview(req, res, next) {
        const startTime = Date.now();
        let requestId = this.generateRequestId();
        
        try {
            const { code, language, fileName, framework } = req.body;

            // Log request for monitoring (without exposing sensitive code)
            if (LOGGING_CONFIG.ENABLE_REQUEST_LOGGING) {
                console.log(`🔍 [${requestId}] Code Review Request`, {
                    language: language || 'auto',
                    framework: framework || 'none',
                    codeLength: code.length,
                    fileName: fileName || 'none',
                    ip: req.ip,
                    userAgent: req.get('user-agent')?.substring(0, 100)
                });
            }

            // Enhanced code validation
            this.validateCodeInput(code);

            // Perform AI code review with service configuration
            const reviewResult = await aiService.generateContent(code, {
                language,
                fileName,
                framework,
                timeout: API_CONFIG.REQUEST_TIMEOUT
            });
            
            const processingTime = Date.now() - startTime;

            // Log successful processing
            if (LOGGING_CONFIG.ENABLE_REQUEST_LOGGING) {
                console.log(`✅ [${requestId}] Code Review Completed`, {
                    score: reviewResult.overallScore,
                    issuesCount: reviewResult.issues.length,
                    processingTime: `${processingTime}ms`,
                    language: reviewResult.language,
                    framework: reviewResult.framework
                });
            }

            // Send success response
            return res.status(HTTP_STATUS.OK).json({
                success: true,
                message: RESPONSE_MESSAGES.SUCCESS.CODE_REVIEW,
                data: {
                    ...reviewResult,
                    metadata: {
                        requestId: requestId,
                        processingTime: `${processingTime}ms`,
                        timestamp: new Date().toISOString(),
                        codeSize: code.length,
                        language: reviewResult.language,
                        framework: reviewResult.framework,
                        model: aiService.model.modelName
                    }
                }
            });

        } catch (error) {
            const processingTime = Date.now() - startTime;
            
            // Enhanced error logging
            console.error(`❌ [${requestId}] Code Review Error`, {
                message: error.message,
                processingTime: `${processingTime}ms`,
                url: req.originalUrl,
                method: req.method,
                ip: req.ip,
                body: { 
                    codeLength: req.body.code?.length,
                    language: req.body.language,
                    framework: req.body.framework
                },
                stack: LOGGING_CONFIG.LEVEL === 'debug' ? error.stack : undefined
            });

            // Pass to global error handler with enhanced error information
            error.requestId = requestId;
            error.processingTime = processingTime;
            next(error);
        }
    }

    /**
     * @method getSupportedLanguages
     * @description Get list of supported programming languages
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    getSupportedLanguages(req, res) {
        try {
            const supportedLanguages = aiService.getSupportedLanguages();
            const frameworks = aiService.getSupportedFrameworks();
            
            if (LOGGING_CONFIG.ENABLE_REQUEST_LOGGING) {
                console.log('📚 Supported Languages Request', {
                    ip: req.ip,
                    userAgent: req.get('user-agent')?.substring(0, 100)
                });
            }

            return res.status(HTTP_STATUS.OK).json({
                success: true,
                message: RESPONSE_MESSAGES.SUCCESS.LANGUAGES_FETCH,
                data: {
                    languages: Object.keys(supportedLanguages),
                    extensions: supportedLanguages,
                    frameworks: frameworks,
                    totals: {
                        languages: Object.keys(supportedLanguages).length,
                        frameworks: frameworks.length
                    },
                    timestamp: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error('❌ Supported Languages Error:', error);
            
            return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
                success: false,
                message: 'Failed to retrieve supported languages',
                errorCode: ERROR_CODES.INTERNAL_ERROR,
                timestamp: new Date().toISOString()
            });
        }
    }

    /**
     * @method getSupportedFrameworks
     * @description Get list of supported frameworks
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    getSupportedFrameworks(req, res) {
        try {
            const frameworks = aiService.getSupportedFrameworks();
            
            return res.status(HTTP_STATUS.OK).json({
                success: true,
                message: 'Supported frameworks retrieved successfully',
                data: {
                    frameworks: frameworks,
                    total: frameworks.length,
                    timestamp: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error('❌ Supported Frameworks Error:', error);
            
            return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
                success: false,
                message: 'Failed to retrieve supported frameworks',
                errorCode: ERROR_CODES.INTERNAL_ERROR,
                timestamp: new Date().toISOString()
            });
        }
    }

    /**
     * @method healthCheck
     * @description Check AI service health status
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async healthCheck(req, res) {
        const startTime = Date.now();
        
        try {
            const isHealthy = await aiService.healthCheck();
            const responseTime = Date.now() - startTime;
            
            const healthData = {
                status: isHealthy ? 'healthy' : 'unhealthy',
                timestamp: new Date().toISOString(),
                service: 'gemini-ai',
                responseTime: `${responseTime}ms`,
                environment: API_CONFIG.NODE_ENV,
                version: '1.0.0'
            };

            if (LOGGING_CONFIG.ENABLE_REQUEST_LOGGING) {
                console.log(`🏥 Health Check - ${isHealthy ? 'HEALTHY' : 'UNHEALTHY'}`, healthData);
            }

            if (isHealthy) {
                return res.status(HTTP_STATUS.OK).json({
                    success: true,
                    message: RESPONSE_MESSAGES.SUCCESS.HEALTH_CHECK,
                    data: healthData
                });
            } else {
                return res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json({
                    success: false,
                    message: RESPONSE_MESSAGES.ERROR.SERVICE_UNAVAILABLE,
                    data: healthData
                });
            }
        } catch (error) {
            console.error('❌ Health Check Error:', error);
            const responseTime = Date.now() - startTime;
            
            return res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json({
                success: false,
                message: 'AI service health check failed',
                errorCode: ERROR_CODES.HEALTH_CHECK_LIMIT_EXCEEDED,
                data: {
                    status: 'unhealthy',
                    timestamp: new Date().toISOString(),
                    responseTime: `${responseTime}ms`,
                    error: API_CONFIG.NODE_ENV === 'development' ? error.message : undefined
                }
            });
        }
    }

    /**
     * @method validateCodeInput
     * @description Validate code input before processing
     * @param {string} code - Code to validate
     * @throws {Error} - Validation error
     */
    validateCodeInput(code) {
        if (!code || typeof code !== 'string') {
            throw createValidationError('Code must be a non-empty string');
        }

        const trimmedCode = code.trim();
        
        if (trimmedCode.length === 0) {
            throw createValidationError('Code cannot be empty or only whitespace');
        }

        if (trimmedCode.length > API_CONFIG.MAX_CODE_LENGTH) {
            throw createValidationError(
                `Code exceeds maximum allowed size (${API_CONFIG.MAX_CODE_LENGTH} characters)`
            );
        }

        // Check for minimum meaningful content
        const nonWhitespaceLength = trimmedCode.replace(/\s/g, '').length;
        if (nonWhitespaceLength < 10) {
            throw createValidationError('Code must contain meaningful content (at least 10 non-whitespace characters)');
        }

        // Basic check for potentially malicious content (very long lines)
        const lines = trimmedCode.split('\n');
        for (const line of lines) {
            if (line.length > 1000) {
                throw createValidationError('Code contains unusually long lines which may indicate malicious content');
            }
        }
    }

    /**
     * @method generateRequestId
     * @description Generate unique request ID for tracking
     * @returns {string} - Unique request ID
     */
    generateRequestId() {
        return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * @method getServiceStatus
     * @description Get detailed service status information
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async getServiceStatus(req, res) {
        try {
            const [isHealthy, supportedLanguages, supportedFrameworks] = await Promise.all([
                aiService.healthCheck(),
                Promise.resolve(aiService.getSupportedLanguages()),
                Promise.resolve(aiService.getSupportedFrameworks())
            ]);

            const statusData = {
                service: 'code-review-ai',
                status: isHealthy ? 'operational' : 'degraded',
                timestamp: new Date().toISOString(),
                capabilities: {
                    languages: Object.keys(supportedLanguages).length,
                    frameworks: supportedFrameworks.length,
                    maxCodeSize: API_CONFIG.MAX_CODE_LENGTH,
                    timeout: API_CONFIG.REQUEST_TIMEOUT
                },
                environment: API_CONFIG.NODE_ENV,
                version: '1.0.0'
            };

            return res.status(HTTP_STATUS.OK).json({
                success: true,
                message: 'Service status retrieved successfully',
                data: statusData
            });
        } catch (error) {
            console.error('❌ Service Status Error:', error);
            
            return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
                success: false,
                message: 'Failed to retrieve service status',
                errorCode: ERROR_CODES.INTERNAL_ERROR,
                timestamp: new Date().toISOString()
            });
        }
    }
}

// Create controller instance
const aiController = new AIController();

// Export async wrapped methods for better error handling
module.exports = {
    getCodeReview: aiController.getCodeReview.bind(aiController),
    getSupportedLanguages: aiController.getSupportedLanguages.bind(aiController),
    getSupportedFrameworks: aiController.getSupportedFrameworks.bind(aiController),
    healthCheck: aiController.healthCheck.bind(aiController),
    getServiceStatus: aiController.getServiceStatus.bind(aiController)
};