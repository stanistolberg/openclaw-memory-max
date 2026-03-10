import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { pruneGraph } from './graph';
import { readRecentEpisodes, truncateEpisodes } from './episodic';

function getBaseDir(): string {
    return process.env.OPENCLAW_HOME || path.join(process.env.HOME || '/root', '.openclaw');
}

function getScoresPath(): string {
    return path.join(getBaseDir(), 'memory', 'utility_scores.json');
}

function getCapturedPath(): string {
    return path.join(getBaseDir(), 'memory', 'auto_captured.jsonl');
}

/** Decay utility scores for memories not accessed recently. */
function decayUtilityScores(inactiveDays: number = 7, decayFactor: number = 0.99): number {
    const scoresPath = getScoresPath();
    if (!fs.existsSync(scoresPath)) return 0;

    try {
        const scores: Record<string, number> = JSON.parse(fs.readFileSync(scoresPath, 'utf8'));
        let decayed = 0;

        // Simple global decay — in production, per-ID access tracking would be better
        // but requires more storage. This is a reasonable approximation.
        for (const id of Object.keys(scores)) {
            const current = scores[id];
            if (current !== 0.5) { // Only decay non-default scores
                scores[id] = parseFloat((current * decayFactor).toFixed(4));
                if (Math.abs(scores[id] - 0.5) < 0.01) scores[id] = 0.5; // Snap to default
                decayed++;
            }
        }

        fs.writeFileSync(scoresPath, JSON.stringify(scores, null, 2));
        return decayed;
    } catch {
        return 0;
    }
}

/** Truncate auto_captured.jsonl entries older than N days. */
function truncateCaptures(days: number = 30): number {
    const capturePath = getCapturedPath();
    if (!fs.existsSync(capturePath)) return 0;

    try {
        const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
        const lines = fs.readFileSync(capturePath, 'utf8').split('\n').filter(Boolean);
        const kept: string[] = [];
        let removed = 0;

        for (const line of lines) {
            try {
                const entry = JSON.parse(line);
                if (entry.timestamp >= cutoff) {
                    kept.push(line);
                } else {
                    removed++;
                }
            } catch {
                removed++;
            }
        }

        fs.writeFileSync(capturePath, kept.join('\n') + (kept.length > 0 ? '\n' : ''));
        return removed;
    } catch {
        return 0;
    }
}

/** Build a summary of recent auto-captures and episodes for the sleep cycle agent. */
function buildConsolidationContext(): string {
    const parts: string[] = [];

    // Recent auto-captures (last 24h)
    const capturePath = getCapturedPath();
    if (fs.existsSync(capturePath)) {
        const cutoff = Date.now() - (24 * 60 * 60 * 1000);
        const lines = fs.readFileSync(capturePath, 'utf8').split('\n').filter(Boolean);
        const recent: string[] = [];
        for (const line of lines) {
            try {
                const entry = JSON.parse(line);
                if (entry.timestamp >= cutoff) {
                    recent.push(`- [${entry.source}] ${entry.text.substring(0, 200)}`);
                }
            } catch { /* skip */ }
        }
        if (recent.length > 0) {
            parts.push(`AUTO-CAPTURED MEMORIES (last 24h, ${recent.length} items):\n${recent.join('\n')}`);
        }
    }

    // Recent episodes (last 7 days)
    const episodes = readRecentEpisodes(7);
    if (episodes.length > 0) {
        const epSummaries = episodes.slice(-5).map(ep => {
            const date = new Date(ep.start).toISOString().split('T')[0];
            return `- [${date}] ${ep.summary || 'No summary'} (tools: ${ep.toolsUsed.join(', ') || 'none'})`;
        });
        parts.push(`RECENT SESSIONS (last 7 days, ${episodes.length} total):\n${epSummaries.join('\n')}`);
    }

    return parts.join('\n\n');
}

export function ensureSleepCycle(): Promise<void> {
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
            const graphResult = pruneGraph();
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

            const episodesRemoved = truncateEpisodes(30);
            if (episodesRemoved > 0) {
                console.log(`[openclaw-memory-max] Truncated ${episodesRemoved} old episodes.`);
            }
        } catch (e: any) {
            console.error('[openclaw-memory-max] Maintenance tasks failed:', e.message);
        }

        exec(command, (error, _stdout, stderr) => {
            if (error) {
                if (stderr.includes('already exists')) {
                    console.log('[openclaw-memory-max] Sleep Cycle cron already exists.');
                } else {
                    console.error('[openclaw-memory-max] Sleep Cycle cron setup failed:', error.message);
                }
            } else {
                console.log('[openclaw-memory-max] Sleep Cycle cron created successfully.');
            }
            resolve();
        });
    });
}
