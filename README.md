# openclaw-memory-max

> **SOTA Memory Suite for OpenClaw** — State-of-the-art agentic memory upgrades, packaged as a single installable skillset.

## What This Does

This plugin provides **5 layered memory systems** on top of the standard OpenClaw context engine:

| # | Module | Research Basis | What It Does |
|---|--------|----------------|--------------|
| 1 | **Cross-Encoder Reranker** | ms-marco-MiniLM | Re-ranks retrieved memories by semantic precision |
| 2 | **Semantic YAML Weighter** | N/A | Pins critical 1.0-weight rules from `MEMORY.md` into the system prompt |
| 3 | **Utility-Weighted Retrieval** | MemRL / AgeMem | Scores memories by historical usefulness (`utility_score`), multiplied into the semantic search |
| 4 | **Active Context Compression** | Focus | Agent autonomously compresses the oldest 50% of context into a dense summary when overloaded |
| 5 | **Causal Knowledge Graph** | ActMem | Persistent `cause → action → effect` knowledge graph the agent reads/writes autonomously |

Plus:
- 🌙 **Nightly Sleep-Cycle consolidation** — a cron agent at 03:00 that distills daily logs into `MEMORY.md`

## Tools Exposed to the Agent

| Tool ID | Description |
|---|---|
| `precision_memory_search` | Cross-Encoder search with utility weighting |
| `reward_memory_utility` | Increment a memory's utility score after it proved useful |
| `penalize_memory_utility` | Decrement a memory's utility score after a hallucination |
| `compress_context` | Agent compresses its own context window autonomously |
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
openclaw reload
```

## Audit After Installation

```bash
npm run audit
```

This will verify:
- ✅ `utility_score` column present in `main.sqlite`
- ✅ `causal_graph.json` initialized in the memory store

## Upgrade Safety

All database changes use **non-destructive `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`** patterns.  
Your existing memories are never modified, overwritten, or deleted.

## Structure

```
src/
  index.ts        — Plugin entrypoint (register all modules)
  reranker.ts     — Cross-Encoder + Utility math
  weighter.ts     — Semantic YAML rule pinner
  compressor.ts   — Active context compression tool
  graph.ts        — Causal Knowledge Graph (3 tools)
  db.ts           — SQLite utility_score schema migration
  sleep-cycle.ts  — Nightly consolidation cron
```

## License

MIT
