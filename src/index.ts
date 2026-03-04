import { registerReranker } from './reranker';
import { registerWeighter } from './weighter';
import { ensureSleepCycle } from './sleep-cycle';

const memoryMaxPlugin = {
    id: 'openclaw-memory-max',
    name: 'OpenClaw Memory Max (SotA Archive)',
    description: 'The ultimate enterprise-grade memory enhancement suite for OpenClaw. Adds zero-cost Cross-Encoder Reranking, Strict Semantic YAML constraints, and the Nightly Sleep-Cycle API.',
    configSchema: {},
    register(api: any) {
        console.log('[openclaw-memory-max] Initializing State-of-the-Art Memory Cluster...');

        // 1. Hook the Cross-Encoder Precision Search
        registerReranker(api);
        console.log('[openclaw-memory-max] Precision Reranker (ONNX) Localized.');

        // 2. Hook the Semantic 1.0 Strict Weight Tracker
        registerWeighter(api);
        console.log('[openclaw-memory-max] Semantic Rule Weighter Watching MEMORY.md.');

        // 3. Ensure the SQLite Database contains the Autonomous Cron Trigger
        ensureSleepCycle();
        console.log('[openclaw-memory-max] Memory Daemon Hooked. Zero-Hallucination Matrix Active.');
    }
};

export default memoryMaxPlugin;
