"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const reranker_1 = require("./reranker");
const weighter_1 = require("./weighter");
const sleep_cycle_1 = require("./sleep-cycle");
const db_1 = require("./db");
const compressor_1 = require("./compressor");
const graph_1 = require("./graph");
const hooks_1 = require("./hooks");
const episodic_1 = require("./episodic");
const memoryMaxPlugin = {
    id: 'openclaw-memory-max',
    name: 'OpenClaw Memory Max (SotA)',
    description: 'SOTA Memory Suite v3: Auto-Recall Hooks, Cross-Encoder Reranking, Multi-Hop Deep Search, Semantic Causal Graph with Dedup/Pruning, Episodic Session Memory, Utility-Weighted Vectors, YAML Rule Pinning, and Nightly Sleep-Cycle Consolidation.',
    configSchema: {
        type: 'object',
        additionalProperties: false,
        properties: {
            enableRulePinning: { type: 'boolean', default: false },
            enableAutoCapture: { type: 'boolean', default: true },
            enableAutoRecall: { type: 'boolean', default: true }
        }
    },
    register(api) {
        console.log('[openclaw-memory-max] Initializing SOTA Memory Cluster v3...');
        // Read plugin config (OpenClaw passes it via api.config or api.getConfig())
        const config = api.config || api.getConfig?.() || {};
        const enableRulePinning = config.enableRulePinning ?? false;
        const enableAutoCapture = config.enableAutoCapture ?? true;
        const enableAutoRecall = config.enableAutoRecall ?? true;
        console.log(`[openclaw-memory-max] Config: rulePinning=${enableRulePinning}, autoCapture=${enableAutoCapture}, autoRecall=${enableAutoRecall}`);
        // 0. Ensure Utility Score Schema Exists (async, fire-and-forget)
        (0, db_1.ensureUtilityColumn)().catch((e) => console.error('[openclaw-memory-max] Schema migration failed:', e.message));
        // 1. Cross-Encoder Precision Search + Deep Search + Reward/Penalize
        (0, reranker_1.registerReranker)(api);
        console.log('[openclaw-memory-max] ✓ Precision Reranker + Deep Multi-Hop Search active.');
        // 2. Semantic 1.0 Strict Weight Tracker (opt-in only)
        if (enableRulePinning) {
            (0, weighter_1.registerWeighter)(api);
            console.log('[openclaw-memory-max] ✓ Semantic Rule Weighter watching MEMORY.md (opted in).');
        }
        else {
            console.log('[openclaw-memory-max] ⊘ Rule Pinning disabled (opt-in via config.enableRulePinning).');
        }
        // 3. Context Compressor (wired to before_compaction rescue data)
        (0, compressor_1.registerCompressor)(api);
        console.log('[openclaw-memory-max] ✓ Context Compressor registered.');
        // 4. Causal Knowledge Graph (semantic search, dedup, pruning)
        (0, graph_1.registerCausalGraph)(api);
        console.log('[openclaw-memory-max] ✓ Causal Knowledge Graph live (semantic + dedup).');
        // 5. Lifecycle Hooks: auto-recall, auto-capture, compaction rescue
        (0, hooks_1.registerHooks)(api, { enableAutoCapture, enableAutoRecall });
        // 6. Episodic Memory: session segmentation
        (0, episodic_1.registerEpisodic)(api);
        // 7. Sleep Cycle: in-process maintenance scheduler
        (0, sleep_cycle_1.ensureSleepCycle)().catch((e) => console.error('[openclaw-memory-max] Sleep-Cycle setup failed:', e.message));
        console.log('[openclaw-memory-max] All systems nominal. SOTA Memory Matrix ACTIVE.');
    }
};
exports.default = memoryMaxPlugin;
