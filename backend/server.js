require('dotenv').config();
const app = require('./src/app');
const { 
    API_CONFIG, 
    RESPONSE_MESSAGES,
    LOGGING_CONFIG 
} = require('./src/utils/constants');

/**
 * Server Configuration with constants integration
 */
const PORT = API_CONFIG.PORT;
const HOST = API_CONFIG.HOST;
const NODE_ENV = API_CONFIG.NODE_ENV;

/**
 * Server Manager Class for better organization
 */
class ServerManager {
    constructor() {
        this.server = null;
        this.isShuttingDown = false;
    }

    /**
     * Setup process event handlers
     */
    setupProcessHandlers() {
        // Graceful shutdown handlers
        process.on('SIGTERM', () => this.gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => this.gracefulShutdown('SIGINT'));
        process.on('SIGUSR2', () => this.gracefulShutdown('SIGUSR2')); // For nodemon

        // Unhandled exception handlers
        process.on('unhandledRejection', this.handleUnhandledRejection.bind(this));
        process.on('uncaughtException', this.handleUncaughtException.bind(this));

        // Memory monitoring (optional)
        if (API_CONFIG.NODE_ENV === 'production') {
            this.setupMemoryMonitoring();
        }
    }

    /**
     * Graceful shutdown handler
     */
    gracefulShutdown(signal) {
        if (this.isShuttingDown) return;
        this.isShuttingDown = true;

        console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);
        console.log('⏳ Waiting for ongoing requests to complete...');

        // Close server to new connections
        if (this.server) {
            this.server.close((err) => {
                if (err) {
                    console.error('❌ Error during server close:', err);
                    process.exit(1);
                }

                console.log('✅ HTTP server closed');
                
                // Close any other resources here (database connections, etc.)
                this.closeResources()
                    .then(() => {
                        console.log('✅ All resources closed gracefully');
                        console.log('🎯 Graceful shutdown completed');
                        process.exit(0);
                    })
                    .catch(error => {
                        console.error('❌ Error closing resources:', error);
                        process.exit(1);
                    });
            });

            // Force shutdown after 15 seconds if graceful shutdown takes too long
            setTimeout(() => {
                console.log('⚠️ Forcing shutdown after timeout');
                process.exit(1);
            }, 15000);
        } else {
            process.exit(0);
        }
    }

    /**
     * Handle unhandled promise rejections
     */
    handleUnhandledRejection(reason, promise) {
        console.error('🚨 Unhandled Promise Rejection:', {
            reason: reason?.message || reason,
            stack: reason?.stack,
            promise: promise?.constructor?.name,
            timestamp: new Date().toISOString()
        });

        // In production, exit after logging
        if (API_CONFIG.NODE_ENV === 'production') {
            process.exit(1);
        }
        // In development, we might want to continue for debugging
    }

    /**
     * Handle uncaught exceptions
     */
    handleUncaughtException(error) {
        console.error('🚨 Uncaught Exception:', {
            message: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString(),
            memory: process.memoryUsage()
        });

        // Always exit for uncaught exceptions
        process.exit(1);
    }

    /**
     * Close external resources
     */
    async closeResources() {
        const resources = [];
        
        // Add any resource cleanup here
        // Example: await database.close();
        
        return Promise.allSettled(resources);
    }

    /**
     * Setup memory monitoring
     */
    setupMemoryMonitoring() {
        const memoryCheckInterval = setInterval(() => {
            const memoryUsage = process.memoryUsage();
            const usedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
            const totalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);

            // Log if memory usage is high
            if (usedMB > 500) { // 500MB threshold
                console.warn('⚠️ High memory usage:', {
                    used: `${usedMB}MB`,
                    total: `${totalMB}MB`,
                    timestamp: new Date().toISOString()
                });
            }

            // Clear interval during shutdown
            if (this.isShuttingDown) {
                clearInterval(memoryCheckInterval);
            }
        }, 30000); // Check every 30 seconds
    }

    /**
     * Start the server
     */
    start() {
        return new Promise((resolve, reject) => {
            try {
                this.server = app.listen(PORT, HOST, (error) => {
                    if (error) {
                        reject(error);
                        return;
                    }

                    this.onServerStart();
                    resolve(this.server);
                });

                this.setupServerHandlers();

            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Setup server event handlers
     */
    setupServerHandlers() {
        if (!this.server) return;

        // Server error handling
        this.server.on('error', this.handleServerError.bind(this));

        // Keep-alive timeout configuration
        this.server.keepAliveTimeout = 65000; // 65 seconds
        this.server.headersTimeout = 66000; // 66 seconds

        // Connection tracking (optional)
        if (LOGGING_CONFIG.LEVEL === 'debug') {
            this.server.on('connection', (socket) => {
                console.log('🔗 New connection:', socket.remoteAddress);
            });
        }
    }

    /**
     * Handle server errors
     */
    handleServerError(error) {
        switch (error.code) {
            case 'EADDRINUSE':
                console.error(`❌ Port ${PORT} is already in use`);
                console.log('💡 Troubleshooting tips:');
                console.log(`   - Use a different port: PORT=3001 npm start`);
                console.log(`   - Find and kill process: lsof -ti:${PORT} | xargs kill -9`);
                console.log(`   - Wait a moment and try again`);
                break;

            case 'EACCES':
                console.error(`❌ Permission denied for port ${PORT}`);
                console.log('💡 Try using a port above 1024:');
                console.log(`   - PORT=8080 npm start`);
                break;

            case 'EADDRNOTAVAIL':
                console.error(`❌ Host ${HOST} is not available`);
                console.log('💡 Try using a different host:');
                console.log(`   - HOST=localhost npm start`);
                break;

            default:
                console.error('❌ Server error:', {
                    code: error.code,
                    message: error.message,
                    stack: error.stack
                });
        }

        process.exit(1);
    }

    /**
     * Called when server successfully starts
     */
    onServerStart() {
        const startupTime = new Date().toISOString();
        
        console.log(`
🎉 Code Review AI Server Started Successfully!

📍 Environment: ${NODE_ENV}
🌐 Server URL: http://${HOST}:${PORT}
📊 API Base: http://${HOST}:${PORT}/api
🏥 Health Check: http://${HOST}:${PORT}/health
📚 Documentation: http://${HOST}:${PORT}/api/docs
⏰ Started: ${startupTime}
📦 Version: 1.0.0

💡 Available Endpoints:
   POST /api/review     - Analyze code with AI
   GET  /api/languages  - Get supported languages  
   GET  /api/frameworks - Get supported frameworks
   GET  /api/health     - Check service health
   GET  /api/status     - Get service status

🔧 Configuration:
   Max Code Size: ${API_CONFIG.MAX_CODE_LENGTH} chars
   Request Timeout: ${API_CONFIG.REQUEST_TIMEOUT}ms
   Rate Limiting: Enabled
   Logging: ${LOGGING_CONFIG.LEVEL}

Server is ready to accept requests! 🚀
        `);

        // Log memory usage on startup
        if (LOGGING_CONFIG.ENABLE_REQUEST_LOGGING) {
            const memory = process.memoryUsage();
            console.log('💾 Initial Memory Usage:', {
                heapUsed: `${Math.round(memory.heapUsed / 1024 / 1024)}MB`,
                heapTotal: `${Math.round(memory.heapTotal / 1024 / 1024)}MB`,
                rss: `${Math.round(memory.rss / 1024 / 1024)}MB`
            });
        }
    }
}

/**
 * Main server startup function
 */
async function startServer() {
    const serverManager = new ServerManager();
    
    try {
        // Setup process handlers first
        serverManager.setupProcessHandlers();
        
        // Start the server
        await serverManager.start();
        
    } catch (error) {
        console.error('💥 Failed to start server:', error);
        process.exit(1);
    }
}

// Start the server if this file is run directly
if (require.main === module) {
    startServer();
}

// Export for testing
module.exports = { ServerManager, startServer };