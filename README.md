# openclaw-memory-max `v2.0.0`

> **SOTA Memory Suite for OpenClaw** — Turn your lobster into an agent that actually learns from experience.

## Why This Exists

Out of the box, OpenClaw retrieves memories by embedding similarity — a flat cosine score. That works for simple recall, but it breaks down fast:

- **The same low-quality memory keeps surfacing** because it happens to share keywords with the query. There's no feedback loop — retrieval never learns which memories actually helped.
- **Critical rules get buried** under hundreds of entries. The user wrote "NEVER delete production data" in `MEMORY.md`, but that constraint has the same weight as a note about their favorite editor theme.
- **The agent repeats mistakes** because it has no structured record of what it tried, what worked, and what failed. Every session starts from zero.
- **Long conversations degrade** as the context window fills with stale turns that crowd out the information the agent actually needs right now.

Memory-max solves each of these with a dedicated module, all installable as a single plugin.

## What It Does

Five layered systems that stack on top of OpenClaw's built-in memory:

### 1. Cross-Encoder Reranker
**Problem**: Embedding similarity is fast but imprecise — it retrieves "close enough" results, not the best ones.

**Solution**: After OpenClaw's initial retrieval, memory-max re-scores every candidate using `ms-marco-MiniLM-L-6-v2`, a cross-encoder that reads the query and each memory together as a single sequence. This catches semantic relationships that cosine similarity misses (negation, implication, multi-hop reasoning). Runs entirely locally via ONNX — no API calls.

### 2. Utility-Weighted Retrieval
**Problem**: All memories are treated equally, even the ones that consistently mislead the agent.

**Solution**: Every memory gets a `utility_score` (0.0 to 1.0, default 0.5) that tracks how useful it has been. The final retrieval score is `semantic_score * utility_score` — so a memory that has been rewarded 3x will rank higher than a semantically similar one that was penalized for causing a hallucination. The agent updates scores through explicit `reward_memory_utility` and `penalize_memory_utility` tool calls, creating a reinforcement loop.

Scores are stored in a plugin-owned JSON sidecar file (`utility_scores.json`), completely separate from OpenClaw's database. No risk of data corruption.

**Research basis**: MemRL (reinforcement-weighted memory retrieval), AgeMem (utility decay and scoring).

### 3. Semantic YAML Weighter
**Problem**: High-priority rules ("never do X", "always use Y") compete with low-priority notes in the memory store. There's no way to guarantee critical constraints surface every time.

**Solution**: The weighter monitors `MEMORY.md` for YAML-fenced rule blocks. Any rule with `weight >= 1.0` gets pinned directly into the system prompt as a `CRITICAL CONSTRAINT`, bypassing retrieval entirely. Rules are merged non-destructively using managed delimiters — existing prompt content is preserved.

```markdown
<!--yaml
rules:
  - weight: 1.0
    constraint: "Never delete production data"
  - weight: 1.0
    constraint: "Always confirm before sending external messages"
  - weight: 0.5
    preference: "Prefer TypeScript over JavaScript"
-->
```

Only weight >= 1.0 rules get pinned. Everything else stays in normal retrieval.

### 4. Causal Knowledge Graph
**Problem**: The agent has no structured memory of cause-and-effect. It can't look up "last time I tried X, Y happened" — it has to rediscover failure modes every session.

**Solution**: Three tools (`memory_graph_add`, `memory_graph_query`, `memory_graph_summary`) let the agent build a persistent graph of `cause -> action -> effect` chains tagged with `success`, `failure`, or `unknown`. Before taking a major action, the agent can query the graph for relevant past experience. Token-overlap similarity ranking keeps it dependency-free.

The graph is stored as a JSON file (`causal_graph.json`) in the memory directory. No external database required.

**Research basis**: ActMem (action-conditioned memory for agent decision-making).

### 5. Context Compression Hint
**Problem**: Long conversations fill the context window with stale information, degrading response quality and wasting tokens.

**Solution**: The `compress_context` tool lets the agent signal when it detects context overload. The tool returns an advisory payload that the runtime can act on — keeping compression in the runtime's domain where it can be done safely.

### + Nightly Sleep Cycle
A cron job at 03:00 (configurable timezone) that runs an isolated agent session to:
1. Read yesterday's conversation logs
2. Extract new rules, constraints, and high-signal patterns
3. Synthesize them into `MEMORY.md`
4. Delete obsolete entries

This is the consolidation step that turns daily interactions into durable long-term memory.

## Tools Exposed to the Agent

| Tool Name | What It Does |
|---|---|
| `precision_memory_search` | Cross-encoder reranking + utility weighting over the full memory store |
| `reward_memory_utility` | Bump a memory's utility score after it proved useful (+0.1 to +0.3) |
| `penalize_memory_utility` | Drop a memory's utility score after it caused a hallucination (-0.1 to -0.3) |
| `compress_context` | Signal the runtime that context compression is needed |
| `memory_graph_add` | Log a cause -> action -> effect chain to the knowledge graph |
| `memory_graph_query` | Search the knowledge graph for relevant past experience (top 5) |
| `memory_graph_summary` | Get a session-start digest of all learned causal knowledge |

## How It's Built

**Pure JavaScript/TypeScript** — no native binaries, no compilation dependencies. This is intentional: OpenClaw's plugin installer uses `npm install --ignore-scripts`, so native modules like `better-sqlite3` or `sharp` would fail silently.

| Component | Implementation | Why |
|---|---|---|
| Cross-encoder | `@huggingface/transformers` (ONNX) | Pure JS, runs locally, no API keys |
| SQLite access | `sql.js` (Emscripten/WASM) | Read-only against OpenClaw's DB, no native build step |
| Utility scores | JSON sidecar file | Plugin-owned, no concurrent-write risk with OpenClaw |
| Knowledge graph | JSON file | Zero dependencies, human-readable |
| YAML parsing | `yaml` | Standard YAML 1.2 parser |

**Architecture principle**: This plugin is **read-only** against OpenClaw's `main.sqlite`. It never writes to, modifies, or locks the core memory database. All plugin state lives in sidecar files (`utility_scores.json`, `causal_graph.json`) that only this plugin touches.

The TypeScript source compiles to CommonJS (`dist/`) and ships with the repo. The build step is `npm run build` (just `tsc`).

## Installation

```bash
# On your OpenClaw server
cd ~/.openclaw/extensions
git clone https://github.com/stanistolberg/openclaw-memory-max
cd openclaw-memory-max
npm install
npm run build
openclaw reload
```

Or use the install script:

```bash
curl -sSL https://raw.githubusercontent.com/stanistolberg/openclaw-memory-max/main/install.sh | bash
```

## Verify Installation

```bash
npm run audit
```

Checks for:
- `main.sqlite` — OpenClaw's memory database
- `utility_scores.json` — plugin-owned utility score sidecar
- `causal_graph.json` — causal knowledge graph

## Project Structure

```
src/
  index.ts        — Plugin entrypoint, registers all modules with OpenClaw
  reranker.ts     — Cross-encoder reranking + utility-weighted retrieval (3 tools)
  weighter.ts     — Semantic YAML rule pinner (watches MEMORY.md every 15s)
  compressor.ts   — Context compression hint tool
  graph.ts        — Causal knowledge graph (3 tools, JSON-backed)
  db.ts           — Read-only SQLite access + utility score sidecar
  sleep-cycle.ts  — Nightly consolidation cron setup
dist/             — Compiled CommonJS output (ships with repo)
```

## Changelog

### 2.0.0
- **Breaking**: Migrated to current OpenClaw plugin API (`name`/`parameters`/`execute` with structured returns)
- **Breaking**: Replaced native deps (`better-sqlite3`, `@xenova/transformers`) with pure-JS alternatives (`sql.js`, `@huggingface/transformers`) for `--ignore-scripts` compatibility
- **Breaking**: Utility scores moved from `main.sqlite` column to plugin-owned sidecar (`utility_scores.json`) — eliminates concurrent-write data loss
- Plugin is now read-only against OpenClaw's `main.sqlite`
- Added `configSchema` to manifest (required by current OpenClaw loader)
- Added TypeScript build step (`npm run build`)
- Fixed template literal parse errors in `weighter.ts` and `sleep-cycle.ts`
- Fixed YAML fence regex in weighter (was matching literal `\n`)
- Fixed destructive `systemPrompt` overwrite — now uses managed-block merge
- Fixed sleep-cycle false-positive logging
- Compressor tool metadata now accurately reflects advisory behavior
- `install.sh` copies plugin manifest and runs build

### 1.1.0
- Initial release

## License

MIT
