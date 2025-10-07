"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.creditsRouter = exports.checkCredits = exports.CreditService = exports.creditService = void 0;
var credits_service_1 = require("./credits.service");
Object.defineProperty(exports, "creditService", { enumerable: true, get: function () { return credits_service_1.creditService; } });
Object.defineProperty(exports, "CreditService", { enumerable: true, get: function () { return credits_service_1.CreditService; } });
var credits_middleware_1 = require("./credits.middleware");
Object.defineProperty(exports, "checkCredits", { enumerable: true, get: function () { return credits_middleware_1.checkCredits; } });
var credits_routes_1 = require("./credits.routes");
Object.defineProperty(exports, "creditsRouter", { enumerable: true, get: function () { return __importDefault(credits_routes_1).default; } });
//# sourceMappingURL=index.js.map