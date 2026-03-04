# 🦞 openclaw-memory-max
**The Absolute State-of-the-Art Enterprise Memory Engine for OpenClaw.**

This plugin converts the OpenClaw agent's "passive text memory" into a bleeding-edge, zero-hallucination Active Retention Engine. By combining local HuggingFace mathematics, autonomous "Sleep Cycle" orchestration, and strict Semantic priority overrides, `openclaw-memory-max` eliminates token bleed and physically prevents catastrophic forgetting. 

## ✨ Features (3-in-1 Pipeline)

### 1. The Sleep Cycle (Autonomous Consolidation)
Never let your `MEMORY.md` bloat to 10,000 lines again. This plugin automatically injects an isolated `sleep-cycle-memory` Agent into your SQLite orchestration queue. Every morning at 3:00 AM, the agent reads yesterday's logs, extracts new rules, consolidates them logically, and trims the fat. It literally cleans its own brain while you sleep.

### 2. Precision Cross-Encoder Reranking ($0.00 API Cost)
Similarity Vector Searches are noisy. This plugin leverages bleeding-edge Node.js ONNX runtimes (`@xenova/transformers`, `ms-marco-MiniLM`) to mathematically rerank the database. When your agent queries memory, the Plugin grabs the top 20 fuzzy results, runs neural scoring on your exact question, and mathematically deletes the 19 irrelevant ones—feeding the LLM pure truth.

### 3. Semantic Priority Rule Tagging
Tapping into the Gateway bootloader, this plugin allows you to write strictly-weighted YAML rules into your `MEMORY.md`. 
If you assign a rule `weight: 1.0`, the DB search is bypassed entirely, and that constraint is irreversibly bolted into the agent's live System Prompt. The LLM becomes incapable of forgetting critical logic boundaries.

## 🚀 Installation

```bash
git clone https://github.com/yielz_io/openclaw-memory-max.git
cd openclaw-memory-max
chmod +x install.sh
./install.sh
```

Simply restart your OpenClaw daemon properly (`systemctl restart openclaw`, `pm2 restart openclaw`) and watch the bootloader hook the entire Zero-Hallucination RAG matrix.

## 📝 Usage: Semantic Overrides

To lock a negative constraint directly into the active LLM context memory, wrap it in a `<--yaml` block anywhere inside `~/.openclaw/memory/MEMORY.md`.

```yaml
<--yaml
rules:
  - constraint: "Do NOT talk about Operations outside the Ops Telegram."
    weight: 1.0  # Physically pinned into Context Memory!
  - preference: "Use emojis in lists."
    weight: 0.2  # Saved for search context only
-->
```
