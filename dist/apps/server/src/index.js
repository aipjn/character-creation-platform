"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const server_1 = require("./server");
if (require.main === module) {
    server_1.serverManager.start().catch((error) => {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    });
}
exports.default = server_1.serverManager;
//# sourceMappingURL=index.js.map