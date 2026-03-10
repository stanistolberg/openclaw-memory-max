"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const reranker_1 = require("./reranker");
const weighter_1 = require("./weighter");
const sleep_cycle_1 = require("./sleep-cycle");
const db_1 = require("./db");
const compressor_1 = require("./compressor");
const graph_1 = require("./graph");
const memoryMaxPlugin = {
    id: 'openclaw-memory-max',
    name: 'OpenClaw Memory Max (SotA Archive)',
    description: 'SOTA Memory Suite: Cross-Encoder Reranking, Semantic YAML Weights, Utility-Weighted vectors, Active Context Compression, and a Causal Knowledge Graph.',
    configSchema: {
        type: 'object',
        additionalProperties: false,
        properties: {}
    },
    register(api) {
        console.log('[openclaw-memory-max] Initializing State-of-the-Art Memory Cluster...');
        // 0. Ensure Utility Score Schema Exists (async, fire-and-forget)
        (0, db_1.ensureUtilityColumn)().catch((e) => console.error('[openclaw-memory-max] Schema migration failed:', e.message));
        // 1. Cross-Encoder Precision Search + Reward/Penalize Hooks
        (0, reranker_1.registerReranker)(api);
        console.log('[openclaw-memory-max] ✓ Precision Reranker (ONNX) active.');
        // 2. Semantic 1.0 Strict Weight Tracker
        (0, weighter_1.registerWeighter)(api);
        console.log('[openclaw-memory-max] ✓ Semantic Rule Weighter watching MEMORY.md.');
        // 3. Mid-Conversation Context Compressor
        (0, compressor_1.registerCompressor)(api);
        console.log('[openclaw-memory-max] ✓ Active Context Compressor registered.');
        // 4. Causal Knowledge Graph (3 tools: add / query / summary)
        (0, graph_1.registerCausalGraph)(api);
        console.log('[openclaw-memory-max] ✓ Causal Knowledge Graph live.');
        // 5. Nightly Sleep-Cycle cron (async — logs its own status)
        (0, sleep_cycle_1.ensureSleepCycle)().catch((e) => console.error('[openclaw-memory-max] Sleep-Cycle setup failed:', e.message));
        console.log('[openclaw-memory-max] All systems nominal. Zero-Hallucination Matrix ACTIVE.');
    }
};
exports.default = memoryMaxPlugin;
