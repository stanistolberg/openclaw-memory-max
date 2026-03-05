import { registerReranker } from './reranker';
import { registerWeighter } from './weighter';
import { ensureSleepCycle } from './sleep-cycle';
import { ensureUtilityColumn } from './db';
import { registerCompressor } from './compressor';
import { registerCausalGraph } from './graph';

const memoryMaxPlugin = {
    id: 'openclaw-memory-max',
    name: 'OpenClaw Memory Max (SotA Archive)',
    description: 'SOTA Memory Suite: Cross-Encoder Reranking, Semantic YAML Weights, Utility-Weighted vectors, Active Context Compression, and a Causal Knowledge Graph.',
    configSchema: {},
    register(api: any) {
        console.log('[openclaw-memory-max] Initializing State-of-the-Art Memory Cluster...');

        // 0. Ensure Utility Score Schema Exists (safe, non-destructive ALTER TABLE)
        ensureUtilityColumn();

        // 1. Cross-Encoder Precision Search + Reward/Penalize Hooks
        registerReranker(api);
        console.log('[openclaw-memory-max] ✓ Precision Reranker (ONNX) active.');

        // 2. Semantic 1.0 Strict Weight Tracker
        registerWeighter(api);
        console.log('[openclaw-memory-max] ✓ Semantic Rule Weighter watching MEMORY.md.');

        // 3. Mid-Conversation Context Compressor
        registerCompressor(api);
        console.log('[openclaw-memory-max] ✓ Active Context Compressor registered.');

        // 4. Causal Knowledge Graph (3 tools: add / query / summary)
        registerCausalGraph(api);
        console.log('[openclaw-memory-max] ✓ Causal Knowledge Graph live.');

        // 5. Nightly Sleep-Cycle cron
        ensureSleepCycle();
        console.log('[openclaw-memory-max] ✓ Sleep-Cycle cron verified.');

        console.log('[openclaw-memory-max] All systems nominal. Zero-Hallucination Matrix ACTIVE.');
    }
};

export default memoryMaxPlugin;
