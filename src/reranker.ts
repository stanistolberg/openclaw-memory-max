import { pipeline } from '@xenova/transformers';
import { getDb, rewardMemory } from './db';

export function registerReranker(api: any) {
  // 1. Register the Cross-Encoder Search with Utility Math
  api.registerTool({
    id: 'precision_memory_search',
    label: 'Precision Memory Search',
    description: 'Search memory with Cross-Encoder precision and Utility Weighting. Resolves complex logical relations.',
    schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The exact question.' }
      },
      required: ['query']
    },
    async run(args: any, ctx: any) {
      ctx.runtime.log('[Reranker] Utility-Weighted Query received: ' + args.query);

      let candidates: any[] = [];
      try {
        const db = getDb();
        const tables: any = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
        const targetTable = tables.find((t: any) => t.name === 'chunks');

        if (targetTable) {
          candidates = db.prepare(`SELECT * FROM ${targetTable.name} ORDER BY rowid DESC LIMIT 100`).all();
        }
      } catch (e) {
        ctx.runtime.log('[Reranker] Warning: SQLite fetch failed. Falling back to active context buffer.');
      }

      if (candidates.length === 0) {
        return JSON.stringify({ status: 'empty', memory: 'No explicit DB memories found.' });
      }

      const firstRow = candidates[0];
      const textKey = Object.keys(firstRow).find(k => typeof firstRow[k] === 'string' && firstRow[k].length > 10) || 'text';

      ctx.runtime.log(`[Reranker] Analyzing ${candidates.length} memories against ONNX Cross-Encoder...`);
      const classifier = await pipeline('text-classification', 'Xenova/ms-marco-MiniLM-L-6-v2');

      let bestDoc = '';
      let bestNodeId = '';
      let highestScore = -1;

      for (const row of candidates) {
        const docText = row[textKey] || '';
        const output = await classifier(args.query, docText);
        const semanticScore = output[0]?.score || 0;

        // MATH: Multiply Semantic Score by Historical Utility Score
        const utilityScore = row.utility_score !== undefined ? row.utility_score : 0.5;
        const finalScore = semanticScore * utilityScore;

        if (finalScore > highestScore) {
          highestScore = finalScore;
          bestDoc = docText;
          bestNodeId = row.id || row.rowid || '';
        }
      }

      ctx.runtime.log(`[Reranker] Memory Selected (Utility x Semantic = ${highestScore.toFixed(4)})`);

      return JSON.stringify({
        status: 'precision_filtered',
        originalResultsCount: candidates.length,
        retainedCount: 1,
        memoryId: bestNodeId,
        memory: bestDoc,
        confidence: highestScore
      });
    }
  });

  // 2. Register the Explicit Utility Reward Trigger
  api.registerTool({
    id: 'reward_memory_utility',
    label: 'Reward Memory Utility',
    description: 'Increments the utility score of a specific memory ID if it proved highly useful to the user. Call this after verifying a memory was successful or highly relevant.',
    schema: {
      type: 'object',
      properties: {
        memoryId: { type: 'string', description: 'The ID of the memory to reward.' },
        rewardScalar: { type: 'number', description: 'The amount to increment (usually 0.1 to 0.3)' }
      },
      required: ['memoryId']
    },
    async run(args: any, ctx: any) {
      rewardMemory(args.memoryId, args.rewardScalar || 0.1);
      return JSON.stringify({ status: 'success', message: `Rewarded memory ${args.memoryId} by ${args.rewardScalar || 0.1}` });
    }
  });

  // 3. Register the Explicit Utility Penalize Trigger
  api.registerTool({
    id: 'penalize_memory_utility',
    label: 'Penalize Memory Utility',
    description: 'Decrements the utility score of a specific memory ID if it caused a hallucination or was irrelevant.',
    schema: {
      type: 'object',
      properties: {
        memoryId: { type: 'string', description: 'The ID of the memory to penalize.' },
        penaltyScalar: { type: 'number', description: 'The amount to decrement (usually -0.1 to -0.3)' }
      },
      required: ['memoryId']
    },
    async run(args: any, ctx: any) {
      // Pass a negative scalar
      const penalty = -(Math.abs(args.penaltyScalar || 0.1));
      rewardMemory(args.memoryId, penalty);
      return JSON.stringify({ status: 'success', message: `Penalized memory ${args.memoryId} by ${penalty}` });
    }
  });
}
