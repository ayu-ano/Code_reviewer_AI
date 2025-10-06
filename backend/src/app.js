const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { generalLimiter, healthCheckLimiter } = require('./middleware/rateLimiter');
const aiRoutes = require('./routes/ai.routes');
const { 
    API_CONFIG, 
    HTTP_STATUS, 
    RESPONSE_MESSAGES,
    LOGGING_CONFIG 
} = require('./utils/constants');

/**
 * Express application setup with security and middleware configuration
 */
const app = express();

// Security middleware - Helmet with appropriate configuration
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    },
    hsts: API_CONFIG.NODE_ENV === 'production',
    hidePoweredBy: true,
    noSniff: true,
    frameguard: { action: 'deny' }
}));

// CORS configuration - FIXED: Remove problematic options
app.use(cors({
    origin: API_CONFIG.FRONTEND_URL || ['http://localhost:5173', 'http://localhost:3000'],
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false
}));

// Compression middleware
app.use(compression());

// Request logging
if (LOGGING_CONFIG.ENABLE_REQUEST_LOGGING) {
    app.use(morgan(API_CONFIG.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// Body parsing middleware with limits
app.use(express.json({
    limit: '10mb',
    verify: (req, res, buf) => {
        try {
            JSON.parse(buf);
        } catch (e) {
            res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: 'Invalid JSON in request body',
                errorCode: 'INVALID_JSON',
                timestamp: new Date().toISOString()
            });
        }
    }
}));

app.use(express.urlencoded({
    extended: true,
    limit: '10mb'
}));

// Apply general rate limiting to all routes
app.use(generalLimiter);

// Trust proxy for rate limiting and IP detection
if (API_CONFIG.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
}

// Add request metadata
app.use((req, res, next) => {
    req.requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    req.requestTimestamp = new Date().toISOString();
    next();
});

// Health check endpoint
app.get('/health', healthCheckLimiter, (req, res) => {
    res.status(HTTP_STATUS.OK).json({
        success: true,
        message: RESPONSE_MESSAGES.SUCCESS.SERVER_RUNNING,
        data: {
            status: 'operational',
            timestamp: new Date().toISOString(),
            environment: API_CONFIG.NODE_ENV,
            uptime: process.uptime(),
            version: '1.0.0'
        }
    });
});

// API routes
app.use('/api', aiRoutes);

// Root endpoint
app.get('/', (req, res) => {
    res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Code Review AI API Server',
        data: {
            version: '1.0.0',
            timestamp: new Date().toISOString(),
            environment: API_CONFIG.NODE_ENV,
            documentation: `${req.protocol}://${req.get('host')}/api/docs`,
            endpoints: {
                codeReview: {
                    method: 'POST',
                    path: '/api/review',
                    description: 'Perform AI-powered code review'
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
                    description: 'Check service health'
                },
                status: {
                    method: 'GET',
                    path: '/api/status',
                    description: 'Get service status'
                }
            }
        }
    });
});

// Documentation redirect
app.get('/docs', (req, res) => {
    res.redirect('/api/docs');
});

// 404 handler for undefined routes
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(errorHandler);

module.exports = app;