"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class RabbitError extends Error {
    constructor(code, message, meta) {
        super(`${code} - ${message}`);
        this.code = code;
        this.meta = meta;
    }
    toJSON() {
        return Object.assign({}, (this.meta || {}), { message: this.message, code: this.code });
    }
}
exports.default = RabbitError;
//# sourceMappingURL=error.js.map