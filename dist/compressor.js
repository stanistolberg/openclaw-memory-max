"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerCompressor = registerCompressor;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
function jsonResult(payload) {
    return {
        content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
        details: payload
    };
}
function registerCompressor(api) {
    api.registerTool({
        name: 'compress_context',
        description: 'Signal that context compression is needed. Call when the context window feels overloaded. Returns an advisory payload — the runtime handles actual compression.',
        parameters: {
            type: 'object',
            properties: {
                compression_reason: { type: 'string', description: 'Why you decided to compress the context now.' }
            },
            required: ['compression_reason']
        },
        async execute(_toolCallId, args) {
            // Note: ctx is not available in the current API shape.
            // Context compression requires runtime message access which may need
            // a factory-based tool registration for access to the plugin context.
            // For now, return a structured result indicating the compression intent.
            return jsonResult({
                status: 'info',
                message: 'Context compression requested. The runtime handles context management natively.',
                reason: args.compression_reason
            });
        }
    });
    // Monitor state directory for oversized sessions
    setInterval(() => {
        try {
            const baseDir = process.env.OPENCLAW_HOME || path_1.default.join(process.env.HOME || '/root', '.openclaw');
            const stateDir = path_1.default.join(baseDir, 'state');
            if (fs_1.default.existsSync(stateDir)) {
                // Scan active JSON session sizes in production
            }
        }
        catch (e) {
            // Skip errors
        }
    }, 60000);
}
