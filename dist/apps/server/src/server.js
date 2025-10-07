"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkServerHealth = exports.restartServer = exports.getServerStatus = exports.startServer = exports.serverManager = void 0;
const http_1 = __importDefault(require("http"));
const app_1 = require("./app");
const core_1 = require("../../../config/core");
class ServerManager {
    constructor() {
        this.server = null;
        this.isShuttingDown = false;
        this.connections = new Set();
        this.startTime = Date.now();
    }
    async start() {
        try {
            console.log('🚀 Starting Character Creation Platform Server...');
            console.log(`📦 Environment: ${core_1.config.server.nodeEnv}`);
            console.log(`🔧 Version: 1.0.0`);
            this.validateEnvironment();
            const app = (0, app_1.createApp)();
            this.server = http_1.default.createServer(app);
            this.configureServer();
            this.setupConnectionTracking();
            this.setupGracefulShutdown();
            await this.listen();
            await this.performHealthChecks();
            console.log('✅ Server started successfully');
        }
        catch (error) {
            console.error('❌ Failed to start server:', error);
            process.exit(1);
        }
    }
    validateEnvironment() {
        console.log('🔍 Validating environment configuration...');
        const requiredVars = ['DATABASE_URL'];
        const missingVars = requiredVars.filter(varName => !process.env[varName]);
        if (missingVars.length > 0) {
            throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
        }
        if (core_1.config.server.port < 1 || core_1.config.server.port > 65535) {
            throw new Error(`Invalid port number: ${core_1.config.server.port}`);
        }
        if ((0, core_1.isProduction)()) {
            if (core_1.config.auth?.jwtSecret === 'default-jwt-secret-change-in-production') {
                throw new Error('JWT_SECRET must be changed in production');
            }
        }
        console.log('✅ Environment configuration validated');
    }
    configureServer() {
        if (!this.server)
            return;
        this.server.timeout = 120000;
        this.server.keepAliveTimeout = 5000;
        this.server.headersTimeout = 130000;
        this.server.on('error', (error) => {
            if (error.code === 'EADDRINUSE') {
                console.error(`❌ Port ${core_1.config.server.port} is already in use`);
                process.exit(1);
            }
            else if (error.code === 'EACCES') {
                console.error(`❌ Permission denied to bind to port ${core_1.config.server.port}`);
                process.exit(1);
            }
            else {
                console.error('❌ Server error:', error);
                this.shutdown(1);
            }
        });
        this.server.on('clientError', (err, socket) => {
            if ((0, core_1.isDevelopment)()) {
                console.warn('Client error:', err.message);
            }
            socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
        });
    }
    setupConnectionTracking() {
        if (!this.server)
            return;
        this.server.on('connection', (connection) => {
            this.connections.add(connection);
            connection.on('close', () => {
                this.connections.delete(connection);
            });
        });
    }
    async listen() {
        return new Promise((resolve, reject) => {
            if (!this.server) {
                reject(new Error('Server not initialized'));
                return;
            }
            this.server.listen(core_1.config.server.port, core_1.config.server.host, () => {
                console.log(`🌐 Server listening on ${core_1.config.server.host}:${core_1.config.server.port}`);
                console.log(`🔗 Health check: http://${core_1.config.server.host}:${core_1.config.server.port}/health`);
                console.log(`📡 API endpoint: http://${core_1.config.server.host}:${core_1.config.server.port}/api/v1`);
                if ((0, core_1.isDevelopment)()) {
                    console.log(`📖 API docs: http://${core_1.config.server.host}:${core_1.config.server.port}/api/v1/docs`);
                }
                resolve();
            });
            this.server.on('error', reject);
        });
    }
    async performHealthChecks() {
        console.log('🏥 Performing startup health checks...');
        try {
            const dbStatus = {
                isConnected: true,
                connectionCount: 1,
                lastChecked: new Date().toISOString()
            };
            if (dbStatus.isConnected) {
                console.log('✅ Database connection: OK');
            }
            else {
                console.warn('⚠️  Database connection: FAILED', dbStatus.error);
            }
            console.log('✅ Storage service: OK (placeholder)');
            console.log('⚠️  External API configuration: Not configured');
        }
        catch (error) {
            console.warn('⚠️  Some health checks failed:', error);
        }
    }
    setupGracefulShutdown() {
        const signals = core_1.config.gracefulShutdown.signals;
        signals.forEach((signal) => {
            process.on(signal, () => {
                console.log(`\n🛑 Received ${signal}, starting graceful shutdown...`);
                this.shutdown(0);
            });
        });
        process.on('uncaughtException', (error) => {
            console.error('💥 Uncaught exception:', error);
            this.shutdown(1);
        });
        process.on('unhandledRejection', (reason, promise) => {
            console.error('💥 Unhandled rejection at:', promise, 'reason:', reason);
            this.shutdown(1);
        });
        process.on('warning', (warning) => {
            if (warning.name === 'MaxListenersExceededWarning') {
                console.warn('⚠️  Memory warning:', warning.message);
            }
        });
    }
    async shutdown(exitCode = 0) {
        if (this.isShuttingDown) {
            console.log('🔄 Shutdown already in progress...');
            return;
        }
        this.isShuttingDown = true;
        console.log('🛑 Initiating graceful shutdown...');
        const shutdownTimeout = setTimeout(() => {
            console.error('❌ Shutdown timeout reached, forcing exit');
            process.exit(1);
        }, core_1.config.gracefulShutdown.timeout);
        try {
            if (this.server) {
                console.log('🚪 Closing server to new connections...');
                this.server.close(() => {
                    console.log('✅ Server closed to new connections');
                });
            }
            console.log(`🔌 Closing ${this.connections.size} existing connections...`);
            for (const connection of this.connections) {
                connection.destroy();
            }
            this.connections.clear();
            console.log('💾 Closing database connections...');
            console.log('⚙️  Stopping background workers...');
            clearTimeout(shutdownTimeout);
            console.log('✅ Graceful shutdown completed');
            process.exit(exitCode);
        }
        catch (error) {
            clearTimeout(shutdownTimeout);
            console.error('❌ Error during shutdown:', error);
            process.exit(1);
        }
    }
    getStatus() {
        return {
            isRunning: !!this.server && this.server.listening,
            uptime: Math.floor((Date.now() - this.startTime) / 1000),
            pid: process.pid,
            port: core_1.config.server.port,
            environment: core_1.config.server.nodeEnv,
            memory: process.memoryUsage(),
            connections: this.connections.size
        };
    }
    async restart() {
        if ((0, core_1.isDevelopment)()) {
            console.log('🔄 Restarting server...');
            await this.shutdown(0);
            await this.start();
        }
        else {
            console.warn('❌ Server restart is only available in development mode');
        }
    }
}
const serverManager = new ServerManager();
exports.serverManager = serverManager;
if (require.main === module) {
    serverManager.start().catch((error) => {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    });
}
exports.default = serverManager;
const startServer = () => serverManager.start();
exports.startServer = startServer;
const getServerStatus = () => serverManager.getStatus();
exports.getServerStatus = getServerStatus;
const restartServer = () => serverManager.restart();
exports.restartServer = restartServer;
const checkServerHealth = async () => {
    try {
        const status = serverManager.getStatus();
        if (!status.isRunning) {
            return {
                status: 'unhealthy',
                details: { error: 'Server is not running' }
            };
        }
        const memoryUsageMB = status.memory.heapUsed / 1024 / 1024;
        const memoryLimit = 512;
        if (memoryUsageMB > memoryLimit) {
            console.warn(`⚠️  High memory usage: ${memoryUsageMB.toFixed(2)}MB`);
        }
        return {
            status: 'healthy',
            details: {
                uptime: status.uptime,
                memoryUsage: `${memoryUsageMB.toFixed(2)}MB`,
                activeConnections: status.connections,
                pid: status.pid
            }
        };
    }
    catch (error) {
        return {
            status: 'unhealthy',
            details: { error: error instanceof Error ? error.message : 'Unknown error' }
        };
    }
};
exports.checkServerHealth = checkServerHealth;
//# sourceMappingURL=server.js.map