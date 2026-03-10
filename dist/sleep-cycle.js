"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureSleepCycle = ensureSleepCycle;
const child_process_1 = require("child_process");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const graph_1 = require("./graph");
const episodic_1 = require("./episodic");
function getBaseDir() {
    return process.env.OPENCLAW_HOME || path_1.default.join(process.env.HOME || '/root', '.openclaw');
}
function getScoresPath() {
    return path_1.default.join(getBaseDir(), 'memory', 'utility_scores.json');
}
function getCapturedPath() {
    return path_1.default.join(getBaseDir(), 'memory', 'auto_captured.jsonl');
}
/** Decay utility scores for memories not accessed recently. */
function decayUtilityScores(inactiveDays = 7, decayFactor = 0.99) {
    const scoresPath = getScoresPath();
    if (!fs_1.default.existsSync(scoresPath))
        return 0;
    try {
        const scores = JSON.parse(fs_1.default.readFileSync(scoresPath, 'utf8'));
        let decayed = 0;
        // Simple global decay — in production, per-ID access tracking would be better
        // but requires more storage. This is a reasonable approximation.
        for (const id of Object.keys(scores)) {
            const current = scores[id];
            if (current !== 0.5) { // Only decay non-default scores
                scores[id] = parseFloat((current * decayFactor).toFixed(4));
                if (Math.abs(scores[id] - 0.5) < 0.01)
                    scores[id] = 0.5; // Snap to default
                decayed++;
            }
        }
        fs_1.default.writeFileSync(scoresPath, JSON.stringify(scores, null, 2));
        return decayed;
    }
    catch {
        return 0;
    }
}
/** Truncate auto_captured.jsonl entries older than N days. */
function truncateCaptures(days = 30) {
    const capturePath = getCapturedPath();
    if (!fs_1.default.existsSync(capturePath))
        return 0;
    try {
        const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
        const lines = fs_1.default.readFileSync(capturePath, 'utf8').split('\n').filter(Boolean);
        const kept = [];
        let removed = 0;
        for (const line of lines) {
            try {
                const entry = JSON.parse(line);
                if (entry.timestamp >= cutoff) {
                    kept.push(line);
                }
                else {
                    removed++;
                }
            }
            catch {
                removed++;
            }
        }
        fs_1.default.writeFileSync(capturePath, kept.join('\n') + (kept.length > 0 ? '\n' : ''));
        return removed;
    }
    catch {
        return 0;
    }
}
/** Build a summary of recent auto-captures and episodes for the sleep cycle agent. */
function buildConsolidationContext() {
    const parts = [];
    // Recent auto-captures (last 24h)
    const capturePath = getCapturedPath();
    if (fs_1.default.existsSync(capturePath)) {
        const cutoff = Date.now() - (24 * 60 * 60 * 1000);
        const lines = fs_1.default.readFileSync(capturePath, 'utf8').split('\n').filter(Boolean);
        const recent = [];
        for (const line of lines) {
            try {
                const entry = JSON.parse(line);
                if (entry.timestamp >= cutoff) {
                    recent.push(`- [${entry.source}] ${entry.text.substring(0, 200)}`);
                }
            }
            catch { /* skip */ }
        }
        if (recent.length > 0) {
            parts.push(`AUTO-CAPTURED MEMORIES (last 24h, ${recent.length} items):\n${recent.join('\n')}`);
        }
    }
    // Recent episodes (last 7 days)
    const episodes = (0, episodic_1.readRecentEpisodes)(7);
    if (episodes.length > 0) {
        const epSummaries = episodes.slice(-5).map(ep => {
            const date = new Date(ep.start).toISOString().split('T')[0];
            return `- [${date}] ${ep.summary || 'No summary'} (tools: ${ep.toolsUsed.join(', ') || 'none'})`;
        });
        parts.push(`RECENT SESSIONS (last 7 days, ${episodes.length} total):\n${epSummaries.join('\n')}`);
    }
    return parts.join('\n\n');
}
function ensureSleepCycle() {
    console.log('[openclaw-memory-max] Setting up Sleep-Cycle-Memory cron...');
    const consolidationContext = buildConsolidationContext();
    const contextSection = consolidationContext
        ? `\n\n--- RECENT ACTIVITY (auto-injected by memory-max) ---\n${consolidationContext}\n--- END RECENT ACTIVITY ---`
        : '';
    const message = `You are the Autonomous Sleep Cycle Engine (memory-max v3.0). Execute these steps in order:

1. Read yesterday's log file inside memory/YYYY-MM-DD.md using the bash tool or memory_get.
2. Identify new rules, negative constraints, corrections, or high-signal parameters the user requested.${contextSection}
3. Read the master MEMORY.md file.
4. Synthesize new rules into MEMORY.md using bash or tools. Group them logically. Delete obsolete rules. Deduplicate.
5. If any auto-captured items above contain important rules or corrections NOT already in MEMORY.md, add them.
6. Terminate with NO_REPLY.`;
    const command = `openclaw cron add \
      --name "sleep-cycle-memory" \
      --cron "0 3 * * *" \
      --tz "Europe/Berlin" \
      --session "isolated" \
      --description "Nightly LTM consolidation engine installed by memory-max" \
      --no-deliver \
      --message ${JSON.stringify(message)}`;
    return new Promise((resolve) => {
        // Run maintenance tasks synchronously before setting up cron
        try {
            const graphResult = (0, graph_1.pruneGraph)();
            if (graphResult.removed > 0) {
                console.log(`[openclaw-memory-max] Graph pruned: ${graphResult.removed} nodes removed, ${graphResult.remaining} remaining.`);
            }
            const decayed = decayUtilityScores();
            if (decayed > 0) {
                console.log(`[openclaw-memory-max] Utility decay applied to ${decayed} scores.`);
            }
            const capturesRemoved = truncateCaptures(30);
            if (capturesRemoved > 0) {
                console.log(`[openclaw-memory-max] Truncated ${capturesRemoved} old auto-captures.`);
            }
            const episodesRemoved = (0, episodic_1.truncateEpisodes)(30);
            if (episodesRemoved > 0) {
                console.log(`[openclaw-memory-max] Truncated ${episodesRemoved} old episodes.`);
            }
        }
        catch (e) {
            console.error('[openclaw-memory-max] Maintenance tasks failed:', e.message);
        }
        (0, child_process_1.exec)(command, (error, _stdout, stderr) => {
            if (error) {
                if (stderr.includes('already exists')) {
                    console.log('[openclaw-memory-max] Sleep Cycle cron already exists.');
                }
                else {
                    console.error('[openclaw-memory-max] Sleep Cycle cron setup failed:', error.message);
                }
            }
            else {
                console.log('[openclaw-memory-max] Sleep Cycle cron created successfully.');
            }
            resolve();
        });
    });
}
