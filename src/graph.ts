import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

interface CausalNode {
    id: string;
    cause: string;
    action: string;
    effect: string;
    outcome: 'success' | 'failure' | 'unknown';
    timestamp: number;
    tags: string[];
}

interface CausalGraph {
    version: string;
    nodes: CausalNode[];
}

function getGraphPath(): string {
    const baseDir = process.env.OPENCLAW_HOME || path.join(process.env.HOME || '/root', '.openclaw');
    return path.join(baseDir, 'memory', 'causal_graph.json');
}

function loadGraph(): CausalGraph {
    const gPath = getGraphPath();
    if (!fs.existsSync(gPath)) {
        return { version: '1.0.0', nodes: [] };
    }
    try {
        return JSON.parse(fs.readFileSync(gPath, 'utf8'));
    } catch {
        return { version: '1.0.0', nodes: [] };
    }
}

function saveGraph(graph: CausalGraph): void {
    const gPath = getGraphPath();
    const dir = path.dirname(gPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(gPath, JSON.stringify(graph, null, 2));
}

function textSimilarity(a: string, b: string): number {
    // Lightweight token overlap similarity (no external deps)
    const tokensA = new Set(a.toLowerCase().split(/\W+/).filter(Boolean));
    const tokensB = new Set(b.toLowerCase().split(/\W+/).filter(Boolean));
    const intersection = [...tokensA].filter(t => tokensB.has(t)).length;
    const union = new Set([...tokensA, ...tokensB]).size;
    return union === 0 ? 0 : intersection / union;
}

export function registerCausalGraph(api: any) {

    // Tool 1: Log a causal chain
    api.registerTool({
        id: 'memory_graph_add',
        label: 'Log Causal Memory Chain',
        description: 'Log a causal chain to long-term memory: what caused you to take an action and what the effect was. Call this AFTER you complete any meaningful action (tool use, decision, fix). This trains your future decision-making.',
        schema: {
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
        async run(args: any, ctx: any) {
            ctx.runtime.log(`[CausalGraph] Logging causal chain: ${args.action} → ${args.outcome}`);
            const graph = loadGraph();
            const node: CausalNode = {
                id: crypto.randomUUID(),
                cause: args.cause,
                action: args.action,
                effect: args.effect,
                outcome: args.outcome || 'unknown',
                timestamp: Date.now(),
                tags: args.tags || []
            };
            graph.nodes.push(node);
            saveGraph(graph);
            ctx.runtime.log(`[CausalGraph] Stored node ${node.id}. Total nodes: ${graph.nodes.length}`);
            return JSON.stringify({ status: 'stored', id: node.id, total: graph.nodes.length });
        }
    });

    // Tool 2: Query for similar causal chains
    api.registerTool({
        id: 'memory_graph_query',
        label: 'Query Causal Memory Graph',
        description: 'Query the causal memory graph for past chains relevant to the current situation. Call this BEFORE taking any major action to check if you have relevant learned experience. Returns the top 5 most relevant past cause→action→effect chains.',
        schema: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'Describe the current situation or intended action.' },
                outcomeFilter: { type: 'string', enum: ['success', 'failure', 'unknown', 'all'], description: 'Filter by outcome type. Default: all.' }
            },
            required: ['query']
        },
        async run(args: any, ctx: any) {
            ctx.runtime.log(`[CausalGraph] Querying for: ${args.query}`);
            const graph = loadGraph();

            if (graph.nodes.length === 0) {
                return JSON.stringify({ status: 'empty', message: 'No causal memory nodes yet.' });
            }

            const outcomeFilter = args.outcomeFilter || 'all';

            // Score each node by token overlap
            let candidates = graph.nodes;
            if (outcomeFilter !== 'all') {
                candidates = candidates.filter(n => n.outcome === outcomeFilter);
            }

            const scored = candidates.map(node => {
                const text = `${node.cause} ${node.action} ${node.effect}`;
                const score = textSimilarity(args.query, text);
                return { score, node };
            });

            // Sort descending by relevance
            scored.sort((a, b) => b.score - a.score);
            const top5 = scored.slice(0, 5);

            ctx.runtime.log(`[CausalGraph] Returning top ${top5.length} results (best score: ${top5[0]?.score.toFixed(3)})`);

            return JSON.stringify({
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
        id: 'memory_graph_summary',
        label: 'Causal Memory Summary',
        description: 'Returns a digest of all learned causal chains, grouped by outcome. Useful for self-auditing or bootstrapping context at the start of a session.',
        schema: { type: 'object', properties: {} },
        async run(_args: any, ctx: any) {
            const graph = loadGraph();
            const total = graph.nodes.length;
            const successes = graph.nodes.filter(n => n.outcome === 'success').length;
            const failures = graph.nodes.filter(n => n.outcome === 'failure').length;
            const unknown = graph.nodes.filter(n => n.outcome === 'unknown').length;

            // Build a brief human-readable digest
            const recentSuccesses = graph.nodes
                .filter(n => n.outcome === 'success')
                .slice(-3)
                .map(n => `• [${n.tags.join(', ') || 'general'}] ${n.action} → ${n.effect}`);

            const recentFailures = graph.nodes
                .filter(n => n.outcome === 'failure')
                .slice(-3)
                .map(n => `• [${n.tags.join(', ') || 'general'}] ${n.action} → ${n.effect}`);

            return JSON.stringify({
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
