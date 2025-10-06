/**
 * Application Constants and Configuration
 * Centralized location for all constants used in the backend
 * All environment variables are loaded and validated here
 */

// Load and validate environment variables
require('dotenv').config();

// Validate required environment variables
const validateEnvironment = () => {
    const missingVars = [];
    const requiredVars = [
        'GEMINI_API_KEY',
        'NODE_ENV',
        'PORT'
    ];

    requiredVars.forEach(varName => {
        if (!process.env[varName]) {
            missingVars.push(varName);
        }
    });

    if (missingVars.length > 0) {
        console.error('❌ Missing required environment variables:', missingVars.join(', '));
        console.log('💡 Please check your .env file or set these variables');
        process.exit(1);
    }
};

validateEnvironment();

// API Configuration Constants
const API_CONFIG = {
    MAX_CODE_LENGTH: parseInt(process.env.MAX_CODE_LENGTH) || 15000,
    MAX_FILE_NAME_LENGTH: parseInt(process.env.MAX_FILE_NAME_LENGTH) || 255,
    MAX_FRAMEWORK_NAME_LENGTH: parseInt(process.env.MAX_FRAMEWORK_NAME_LENGTH) || 100,
    REQUEST_TIMEOUT: parseInt(process.env.AI_REQUEST_TIMEOUT) || 45000, // 45 seconds
    MAX_RETRY_ATTEMPTS: parseInt(process.env.AI_MAX_RETRIES) || 3,
    HEALTH_CHECK_TIMEOUT: 10000, // 10 seconds
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: parseInt(process.env.PORT) || 3000,
    HOST: process.env.HOST || '0.0.0.0',
    FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173'
};

// AI Service Constants
const AI_SERVICE = {
    MODEL_NAME: process.env.AI_MODEL_NAME || "gemini-2.0-flash-exp",
    API_KEY: process.env.GEMINI_API_KEY,
    TEMPERATURE: 0.1,
    MAX_OUTPUT_TOKENS: 8192,
    TOP_P: 0.8,
    TOP_K: 40,
    SAFETY_SETTINGS: [
        {
            category: "HARM_CATEGORY_HARASSMENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
        },
        {
            category: "HARM_CATEGORY_HATE_SPEECH", 
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
        },
        {
            category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
        },
        {
            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
        }
    ]
};

// Supported Programming Languages with their file extensions
const SUPPORTED_LANGUAGES = {
    javascript: ['js', 'jsx', 'mjs', 'cjs'],
    typescript: ['ts', 'tsx'],
    python: ['py', 'pyw'],
    java: ['java'],
    cpp: ['cpp', 'cc', 'cxx', 'c++'],
    c: ['c'],
    csharp: ['cs'],
    go: ['go'],
    rust: ['rs'],
    php: ['php'],
    ruby: ['rb'],
    swift: ['swift'],
    kotlin: ['kt', 'kts'],
    html: ['html', 'htm'],
    css: ['css'],
    sql: ['sql'],
    r: ['r'],
    shell: ['sh', 'bash'],
    powershell: ['ps1'],
    perl: ['pl'],
    lua: ['lua'],
    dart: ['dart'],
    scala: ['scala'],
    haskell: ['hs']
};

// Common Frameworks for context-aware reviews
const SUPPORTED_FRAMEWORKS = [
    // JavaScript/TypeScript Frameworks
    'react', 'vue', 'angular', 'nextjs', 'nuxt', 'svelte', 'express', 'nest', 'fastify',
    // Python Frameworks
    'django', 'flask', 'fastapi', 'pandas', 'numpy', 'tensorflow', 'pytorch',
    // Java Frameworks
    'spring', 'springboot', 'hibernate', 'jakarta', 'junit', 'mockito',
    // C# Frameworks
    'aspnet', 'entityframework', 'xunit', 'nunit',
    // Mobile Frameworks
    'reactnative', 'flutter', 'xamarin', 'ionic',
    // Other Frameworks
    'laravel', 'rails', 'gin', 'echo', 'rocket'
];

// Error Codes and Messages
const ERROR_CODES = {
    // Validation Errors
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    INVALID_JSON: 'INVALID_JSON',
    EMPTY_CODE: 'EMPTY_CODE',
    INVALID_INPUT: 'INVALID_INPUT',
    PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
    
    // AI Service Errors
    AI_SERVICE_ERROR: 'AI_SERVICE_ERROR',
    AI_TIMEOUT: 'AI_TIMEOUT',
    AI_QUOTA_EXCEEDED: 'AI_QUOTA_EXCEEDED',
    AI_AUTH_ERROR: 'AI_AUTH_ERROR',
    AI_SERVICE_UNAVAILABLE: 'AI_SERVICE_UNAVAILABLE',
    
    // Rate Limiting Errors
    RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
    HEALTH_CHECK_LIMIT_EXCEEDED: 'HEALTH_CHECK_LIMIT_EXCEEDED',
    
    // General Errors
    INTERNAL_ERROR: 'INTERNAL_ERROR',
    SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
    ROUTE_NOT_FOUND: 'ROUTE_NOT_FOUND',
    FILE_TOO_LARGE: 'FILE_TOO_LARGE',
    ENV_VALIDATION_ERROR: 'ENV_VALIDATION_ERROR'
};

// HTTP Status Codes
const HTTP_STATUS = {
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    PAYLOAD_TOO_LARGE: 413,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_SERVER_ERROR: 500,
    SERVICE_UNAVAILABLE: 503,
    GATEWAY_TIMEOUT: 504
};

// Code Review Issue Categories
const ISSUE_CATEGORIES = {
    SECURITY: 'SECURITY',
    PERFORMANCE: 'PERFORMANCE', 
    MAINTAINABILITY: 'MAINTAINABILITY',
    BUG: 'BUG',
    CODE_STYLE: 'CODE_STYLE',
    BEST_PRACTICE: 'BEST_PRACTICE',
    TESTING: 'TESTING',
    DOCUMENTATION: 'DOCUMENTATION'
};

// Issue Severity Levels
const SEVERITY_LEVELS = {
    CRITICAL: 'CRITICAL',
    HIGH: 'HIGH', 
    MEDIUM: 'MEDIUM',
    LOW: 'LOW',
    INFO: 'INFO'
};

// Rate Limiting Configuration
const RATE_LIMIT_CONFIG = {
    CODE_REVIEW_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || (15 * 60 * 1000), // 15 minutes
    CODE_REVIEW_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 50,
    HEALTH_CHECK_WINDOW_MS: parseInt(process.env.HEALTH_CHECK_LIMIT_WINDOW_MS) || (1 * 60 * 1000), // 1 minute
    HEALTH_CHECK_MAX_REQUESTS: parseInt(process.env.HEALTH_CHECK_MAX_REQUESTS) || 10,
    GENERAL_WINDOW_MS: (15 * 60 * 1000), // 15 minutes
    GENERAL_MAX_REQUESTS: 100
};

// Environment Variables Validation
const REQUIRED_ENV_VARS = [
    'GEMINI_API_KEY',
    'NODE_ENV',
    'PORT'
];

// Response Messages
const RESPONSE_MESSAGES = {
    SUCCESS: {
        CODE_REVIEW: 'Code review completed successfully',
        HEALTH_CHECK: 'AI service is healthy',
        LANGUAGES_FETCH: 'Supported languages retrieved successfully',
        SERVER_RUNNING: 'Server is running successfully'
    },
    ERROR: {
        CODE_REVIEW_FAILED: 'Code analysis failed',
        SERVICE_UNAVAILABLE: 'AI service is temporarily unavailable',
        INVALID_API_KEY: 'Invalid API key configuration',
        RATE_LIMIT_EXCEEDED: 'Too many requests, please try again later',
        MISSING_ENV_VARS: 'Missing required environment variables'
    }
};

// Logging Configuration
const LOGGING_CONFIG = {
    LEVEL: process.env.LOG_LEVEL || 'info',
    ENABLE_REQUEST_LOGGING: process.env.ENABLE_REQUEST_LOGGING !== 'false'
};

// Export all constants
module.exports = {
    API_CONFIG,
    AI_SERVICE,
    SUPPORTED_LANGUAGES,
    SUPPORTED_FRAMEWORKS,
    ERROR_CODES,
    HTTP_STATUS,
    ISSUE_CATEGORIES,
    SEVERITY_LEVELS,
    RATE_LIMIT_CONFIG,
    REQUIRED_ENV_VARS,
    RESPONSE_MESSAGES,
    LOGGING_CONFIG
};