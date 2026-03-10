"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerCausalGraph = registerCausalGraph;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
function getGraphPath() {
    const baseDir = process.env.OPENCLAW_HOME || path_1.default.join(process.env.HOME || '/root', '.openclaw');
    return path_1.default.join(baseDir, 'memory', 'causal_graph.json');
}
function loadGraph() {
    const gPath = getGraphPath();
    if (!fs_1.default.existsSync(gPath)) {
        return { version: '1.0.0', nodes: [] };
    }
    try {
        return JSON.parse(fs_1.default.readFileSync(gPath, 'utf8'));
    }
    catch {
        return { version: '1.0.0', nodes: [] };
    }
}
function saveGraph(graph) {
    const gPath = getGraphPath();
    const dir = path_1.default.dirname(gPath);
    if (!fs_1.default.existsSync(dir))
        fs_1.default.mkdirSync(dir, { recursive: true });
    fs_1.default.writeFileSync(gPath, JSON.stringify(graph, null, 2));
}
function textSimilarity(a, b) {
    const tokensA = new Set(a.toLowerCase().split(/\W+/).filter(Boolean));
    const tokensB = new Set(b.toLowerCase().split(/\W+/).filter(Boolean));
    const intersection = [...tokensA].filter(t => tokensB.has(t)).length;
    const union = new Set([...tokensA, ...tokensB]).size;
    return union === 0 ? 0 : intersection / union;
}
function jsonResult(payload) {
    return {
        content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
        details: payload
    };
}
function registerCausalGraph(api) {
    // Tool 1: Log a causal chain
    api.registerTool({
        name: 'memory_graph_add',
        description: 'Log a causal chain to long-term memory: what caused you to take an action and what the effect was. Call this AFTER you complete any meaningful action (tool use, decision, fix). This trains your future decision-making.',
        parameters: {
            type: 'object',
            properties: {
                cause: { type: 'string', description: 'What situation or trigger prompted the action.' },
                action: { type: 'string', description: 'What you did (tool used, decision made).' },
                effect: { type: 'string', description: 'What happened as a result.' },
                outcome: { type: 'string', enum: ['success', 'failure', 'unknown'], description: 'Did it work?' },
                tags: { type: 'array', items: { type: 'string' }, description: 'Optional topic tags (e.g. ["ssh", "permissions"])' }
            },
            required: ['cause', 'action', 'effect', 'outcome']
        },
        async execute(_toolCallId, args) {
            const graph = loadGraph();
            const node = {
                id: crypto_1.default.randomUUID(),
                cause: args.cause,
                action: args.action,
                effect: args.effect,
                outcome: args.outcome || 'unknown',
                timestamp: Date.now(),
                tags: args.tags || []
            };
            graph.nodes.push(node);
            saveGraph(graph);
            return jsonResult({ status: 'stored', id: node.id, total: graph.nodes.length });
        }
    });
    // Tool 2: Query for similar causal chains
    api.registerTool({
        name: 'memory_graph_query',
        description: 'Query the causal memory graph for past chains relevant to the current situation. Call this BEFORE taking any major action to check if you have relevant learned experience. Returns the top 5 most relevant past cause→action→effect chains.',
        parameters: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'Describe the current situation or intended action.' },
                outcomeFilter: { type: 'string', enum: ['success', 'failure', 'unknown', 'all'], description: 'Filter by outcome type. Default: all.' }
            },
            required: ['query']
        },
        async execute(_toolCallId, args) {
            const graph = loadGraph();
            if (graph.nodes.length === 0) {
                return jsonResult({ status: 'empty', message: 'No causal memory nodes yet.' });
            }
            const outcomeFilter = args.outcomeFilter || 'all';
            let candidates = graph.nodes;
            if (outcomeFilter !== 'all') {
                candidates = candidates.filter(n => n.outcome === outcomeFilter);
            }
            const scored = candidates.map(node => {
                const text = `${node.cause} ${node.action} ${node.effect}`;
                const score = textSimilarity(args.query, text);
                return { score, node };
            });
            scored.sort((a, b) => b.score - a.score);
            const top5 = scored.slice(0, 5);
            return jsonResult({
                status: 'results',
                total_in_db: graph.nodes.length,
                results: top5.map(({ score, node }) => ({
                    score: parseFloat(score.toFixed(4)),
                    outcome: node.outcome,
                    cause: node.cause,
                    action: node.action,
                    effect: node.effect,
                    tags: node.tags,
                    timestamp: new Date(node.timestamp).toISOString()
                }))
            });
        }
    });
    // Tool 3: Get a full summary of everything the agent has learned
    api.registerTool({
        name: 'memory_graph_summary',
        description: 'Returns a digest of all learned causal chains, grouped by outcome. Useful for self-auditing or bootstrapping context at the start of a session.',
        parameters: { type: 'object', properties: {} },
        async execute(_toolCallId, _args) {
            const graph = loadGraph();
            const total = graph.nodes.length;
            const successes = graph.nodes.filter(n => n.outcome === 'success').length;
            const failures = graph.nodes.filter(n => n.outcome === 'failure').length;
            const unknown = graph.nodes.filter(n => n.outcome === 'unknown').length;
            const recentSuccesses = graph.nodes
                .filter(n => n.outcome === 'success')
                .slice(-3)
                .map(n => `• [${n.tags.join(', ') || 'general'}] ${n.action} → ${n.effect}`);
            const recentFailures = graph.nodes
                .filter(n => n.outcome === 'failure')
                .slice(-3)
                .map(n => `• [${n.tags.join(', ') || 'general'}] ${n.action} → ${n.effect}`);
            return jsonResult({
                status: 'ok',
                total,
                successes,
                failures,
                unknown,
                recent_successes: recentSuccesses,
                recent_failures: recentFailures
            });
        }
    });
    console.log('[openclaw-memory-max] Causal Knowledge Graph (3 tools) registered.');
}
