"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GENERATION_STATUSES = exports.GENERATION_STATUS = exports.STYLE_TYPES = exports.STYLE_TYPE = void 0;
exports.STYLE_TYPE = {
    FANTASY: 'FANTASY',
    CYBERPUNK: 'CYBERPUNK',
    ANIME: 'ANIME',
    VINTAGE: 'VINTAGE',
    REALISTIC: 'REALISTIC',
    CARTOON: 'CARTOON',
    MINIMALIST: 'MINIMALIST'
};
exports.STYLE_TYPES = Object.values(exports.STYLE_TYPE);
exports.GENERATION_STATUS = {
    PENDING: 'PENDING',
    PROCESSING: 'PROCESSING',
    COMPLETED: 'COMPLETED',
    FAILED: 'FAILED'
};
exports.GENERATION_STATUSES = Object.values(exports.GENERATION_STATUS);
//# sourceMappingURL=enums.js.map