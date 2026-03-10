# openclaw-memory-max `v2.0.0`

> **SOTA Memory Suite for OpenClaw** — State-of-the-art agentic memory upgrades, packaged as a single installable skillset.

## What This Does

This plugin provides **5 layered memory systems** on top of the standard OpenClaw context engine:

| # | Module | Research Basis | What It Does |
|---|--------|----------------|--------------|
| 1 | **Cross-Encoder Reranker** | ms-marco-MiniLM | Re-ranks retrieved memories by semantic precision |
| 2 | **Semantic YAML Weighter** | N/A | Pins critical 1.0-weight rules from `MEMORY.md` into the system prompt |
| 3 | **Utility-Weighted Retrieval** | MemRL / AgeMem | Scores memories by historical usefulness (`utility_score`), multiplied into the semantic search |
| 4 | **Context Compression Hint** | Focus | Agent signals the runtime to compress context when the window is overloaded |
| 5 | **Causal Knowledge Graph** | ActMem | Persistent `cause → action → effect` knowledge graph the agent reads/writes autonomously |

Plus:
- 🌙 **Nightly Sleep-Cycle consolidation** — a cron agent at 03:00 that distills daily logs into `MEMORY.md`

## Tools Exposed to the Agent

| Tool Name | Description |
|---|---|
| `precision_memory_search` | Cross-Encoder search with utility weighting |
| `reward_memory_utility` | Increment a memory's utility score after it proved useful |
| `penalize_memory_utility` | Decrement a memory's utility score after a hallucination |
| `compress_context` | Signal the runtime to compress context when overloaded |
| `memory_graph_add` | Log a `cause → action → effect` causal chain |
| `memory_graph_query` | Retrieve the top 5 most relevant past causal chains |
| `memory_graph_summary` | Get a session digest of all learned causal knowledge |

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

## Audit After Installation

```bash
npm run audit
```

This will verify:
- ✅ `main.sqlite` present (OpenClaw's memory DB)
- ✅ `utility_scores.json` present (plugin-owned sidecar for utility weighting)
- ✅ `causal_graph.json` present (causal knowledge graph)

## Data Safety

This plugin is **read-only** against OpenClaw's `main.sqlite`. It never writes to or modifies the core memory database. Utility scores are stored in a separate sidecar file (`utility_scores.json`) owned exclusively by this plugin.

## Structure

```
src/
  index.ts        — Plugin entrypoint (register all modules)
  reranker.ts     — Cross-Encoder + Utility math
  weighter.ts     — Semantic YAML rule pinner
  compressor.ts   — Context compression hint tool
  graph.ts        — Causal Knowledge Graph (3 tools)
  db.ts           — Read-only SQLite access + utility score sidecar (sql.js / pure WASM)
  sleep-cycle.ts  — Nightly consolidation cron
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
