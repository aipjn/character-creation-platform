"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isTest = exports.isProduction = exports.isDevelopment = exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.config = {
    server: {
        port: parseInt(process.env['PORT'] || '3000', 10),
        host: process.env['HOST'] || 'localhost',
        nodeEnv: (process.env['NODE_ENV'] || 'development'),
    },
    ...(process.env['DATABASE_URL'] && {
        database: {
            url: process.env['DATABASE_URL'],
        },
    }),
    ...(process.env['JWT_SECRET'] && {
        auth: {
            jwtSecret: process.env['JWT_SECRET'],
            jwtExpiresIn: process.env['JWT_EXPIRES_IN'] || '24h',
        },
    }),
    storage: {
        provider: 'local',
        uploadPath: process.env['UPLOAD_PATH'] || './uploads',
        maxFileSize: parseInt(process.env['MAX_FILE_SIZE'] || '10485760', 10),
    },
    gracefulShutdown: {
        timeout: parseInt(process.env['SHUTDOWN_TIMEOUT'] || '30000', 10),
        signals: ['SIGTERM', 'SIGINT', 'SIGUSR2'],
    },
};
const isDevelopment = () => exports.config.server.nodeEnv === 'development';
exports.isDevelopment = isDevelopment;
const isProduction = () => exports.config.server.nodeEnv === 'production';
exports.isProduction = isProduction;
const isTest = () => exports.config.server.nodeEnv === 'test';
exports.isTest = isTest;
//# sourceMappingURL=core.js.map