import { pipeline } from '@huggingface/transformers';
import { queryChunks, rewardMemory } from './db';

function jsonResult(payload: any) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }],
    details: payload
  };
}

export function registerReranker(api: any) {
  // 1. Register the Cross-Encoder Search with Utility Math
  api.registerTool({
    name: 'precision_memory_search',
    description: 'Search memory with Cross-Encoder precision and Utility Weighting. Resolves complex logical relations.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The exact question.' }
      },
      required: ['query']
    },
    async execute(_toolCallId: string, args: any) {
      const candidates = await queryChunks(100);

      if (candidates.length === 0) {
        return jsonResult({ status: 'empty', memory: 'No explicit DB memories found.' });
      }

      const firstRow = candidates[0];
      const textKey = Object.keys(firstRow).find(k => typeof firstRow[k] === 'string' && firstRow[k].length > 10) || 'text';

      const classifier = await pipeline('text-classification', 'Xenova/ms-marco-MiniLM-L-6-v2');

      let bestDoc = '';
      let bestNodeId = '';
      let highestScore = -1;

      for (const row of candidates) {
        const docText = row[textKey] || '';
        const output = await classifier(args.query, docText);
        const semanticScore = (output as any)[0]?.score || 0;

        const utilityScore = row.utility_score !== undefined ? row.utility_score : 0.5;
        const finalScore = semanticScore * utilityScore;

        if (finalScore > highestScore) {
          highestScore = finalScore;
          bestDoc = docText;
          bestNodeId = row.id || row.rowid || '';
        }
      }

      return jsonResult({
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
    name: 'reward_memory_utility',
    description: 'Increments the utility score of a specific memory ID if it proved highly useful to the user. Call this after verifying a memory was successful or highly relevant.',
    parameters: {
      type: 'object',
      properties: {
        memoryId: { type: 'string', description: 'The ID of the memory to reward.' },
        rewardScalar: { type: 'number', description: 'The amount to increment (usually 0.1 to 0.3)' }
      },
      required: ['memoryId']
    },
    async execute(_toolCallId: string, args: any) {
      const scalar = args.rewardScalar || 0.1;
      const updated = await rewardMemory(args.memoryId, scalar);
      if (updated) {
        return jsonResult({ status: 'success', message: `Rewarded memory ${args.memoryId} by ${scalar}` });
      }
      return jsonResult({ status: 'not_found', message: `Memory ${args.memoryId} not found in any table` });
    }
  });

  // 3. Register the Explicit Utility Penalize Trigger
  api.registerTool({
    name: 'penalize_memory_utility',
    description: 'Decrements the utility score of a specific memory ID if it caused a hallucination or was irrelevant.',
    parameters: {
      type: 'object',
      properties: {
        memoryId: { type: 'string', description: 'The ID of the memory to penalize.' },
        penaltyScalar: { type: 'number', description: 'The amount to decrement (usually -0.1 to -0.3)' }
      },
      required: ['memoryId']
    },
    async execute(_toolCallId: string, args: any) {
      const penalty = -(Math.abs(args.penaltyScalar || 0.1));
      const updated = await rewardMemory(args.memoryId, penalty);
      if (updated) {
        return jsonResult({ status: 'success', message: `Penalized memory ${args.memoryId} by ${penalty}` });
      }
      return jsonResult({ status: 'not_found', message: `Memory ${args.memoryId} not found in any table` });
    }
  });
}
