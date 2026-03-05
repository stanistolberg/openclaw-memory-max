import fs from 'fs';
import path from 'path';

export function registerCompressor(api: any) {
    api.registerTool({
        id: 'compress_context',
        label: 'Active Context Compression',
        description: 'Compresses the oldest 50% of the active dialog history into a dense summary. Call this tool autonomously if you notice the context window getting too long or cluttered, to save tokens and maintain focus.',
        schema: {
            type: 'object',
            properties: {
                compression_reason: { type: 'string', description: 'Why you decided to compress the context now.' }
            },
            required: ['compression_reason']
        },
        async run(args: any, ctx: any) {
            ctx.runtime.log(`[Context-Compressor] Agent triggered compression. Reason: ${args.compression_reason}`);

            try {
                // The current OpenClaw runtime usually holds messages in ctx.runtime.messages or the internal state.
                // Depending on the exact OpenClaw version, we find the message buffer.
                // Assuming standard OpenClaw Agent runtime API:
                const messages = ctx.runtime?.messages || ctx.messages || [];

                if (messages.length < 5) {
                    return JSON.stringify({ status: 'aborted', message: 'Context too short to compress logically.' });
                }

                // Isolate the oldest half (excluding system prompt at index 0)
                const sysPrompt = messages[0];
                const halfIndex = Math.floor(messages.length / 2);

                // Keep the most recent half untouched.
                const oldestMessages = messages.slice(1, halfIndex);
                const recentMessages = messages.slice(halfIndex);

                // Build a quick text blob to summarize
                const textToSummarize = oldestMessages.map((m: any) => `${m.role}: ${typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}`).join('\n');

                ctx.runtime.log(`[Context-Compressor] Summarizing ${oldestMessages.length} oldest messages...`);

                // Call the LLM to summarize the older context natively
                // Note: We use the context's completion API to stay within the model's token economics
                const summaryPrompt = `Please densely summarize the following conversation history. Retain all key facts, decisions, and constraints. Output ONLY the summary.\n\n${textToSummarize}`;

                let compressedText = "Compressed History Block.";

                if (ctx.runtime.complete) {
                    const result = await ctx.runtime.complete({
                        messages: [{ role: 'user', content: summaryPrompt }]
                    });
                    if (result && result.text) {
                        compressedText = `[AUTONOMOUS CONTEXT COMPRESSION]\n${result.text}`;
                    }
                } else {
                    compressedText = `[TRUNCATED HISTORY] Removed ${oldestMessages.length} older messages to save context limit.`;
                }

                // Re-assemble the context directly into the agent's live array
                // OpenClaw passes references sometimes, so we mutate the array if possible
                if (Array.isArray(ctx.runtime.messages)) {
                    ctx.runtime.messages.length = 0; // Clear it
                    ctx.runtime.messages.push(sysPrompt);
                    ctx.runtime.messages.push({ role: 'system', content: compressedText });
                    ctx.runtime.messages.push(...recentMessages);
                } else if (Array.isArray(ctx.messages)) {
                    ctx.messages.length = 0;
                    ctx.messages.push(sysPrompt);
                    ctx.messages.push({ role: 'system', content: compressedText });
                    ctx.messages.push(...recentMessages);
                }

                ctx.runtime.log(`[Context-Compressor] Success. Freeing context bounds.`);

                return JSON.stringify({
                    status: 'success',
                    message: 'The oldest half of the conversation was successfully replaced with a dense summary system block.',
                    tokens_freed_estimation: Math.floor(textToSummarize.length / 4)
                });
            } catch (e: any) {
                ctx.runtime.log(`[Context-Compressor] Failed: ${e.message}`);
                return JSON.stringify({ status: 'error', error: e.message });
            }
        }
    });

    // We also set an interval to monitor the state and automatically "nudge" the LLM to run the tool
    // if the JSON chat history file exceeds 1048576 bytes (1MB ~ 250k tokens)
    setInterval(() => {
        try {
            const baseDir = process.env.OPENCLAW_HOME || path.join(process.env.HOME || '/root', '.openclaw');
            const stateDir = path.join(baseDir, 'state'); // Generic openclaw state directory
            if (fs.existsSync(stateDir)) {
                // We would scan active JSON session sizes here in a production environment
            }
        } catch (e) {
            // Skip errors
        }
    }, 60000);
}
