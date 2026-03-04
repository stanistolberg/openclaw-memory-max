import fs from 'fs';
import path from 'path';
import yaml from 'yaml';

export function registerWeighter(api: any) {
    // Determine the base openclaw directory
    const baseDir = process.env.OPENCLAW_HOME || path.join(process.env.HOME || '/root', '.openclaw');
    const memoryPath = path.join(baseDir, 'memory/MEMORY.md');
    const configPath = path.join(baseDir, 'openclaw.json');

    // Interval to actively guard the 1.0 boundaries without user input.
    setInterval(() => {
        try {
            if (!fs.existsSync(memoryPath)) return;

            // 1. Read the MEMORY.md file and look for YAML fences
            const text = fs.readFileSync(memoryPath, 'utf8');
            let pinnedOutput = '';

            const match = text.match(/<--yaml\\n([\\s\\S]*?)\\n-->/);
            if (match) {
                const parsed = yaml.parse(match[1]);
                if (parsed && parsed.rules) {
                    const pinned = parsed.rules
                        .filter((r: any) => parseFloat(r.weight) >= 1.0)
                        .map((r: any) => 'CRITICAL CONSTRAINT: ' + (r.constraint || r.rule || r.preference));

                    pinnedOutput = pinned.join('\\n');
                }
            }

            // 2. Read the global config and pin it directly to the fallback framework
            if (pinnedOutput && fs.existsSync(configPath)) {
                const configObj = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                if (!configObj.agents) configObj.agents = {};
                if (!configObj.agents.defaults) configObj.agents.defaults = {};

                // Re-merge with our original resilience rules
                const basePrompt = \`
- Agents NEVER give up at the first obstacle — try alternative approaches, backtrack, and adapt
- Agents NEVER modify logs, evaluation data, or system files unless explicitly instructed
- Agents ALWAYS be transparent about all actions taken
\`;          
            
            const newPrompt = basePrompt + '\\n--- PINNED SEMANTIC MEMORY ---\\n' + pinnedOutput;
            
            // Only write if it actually changed to prevent disk thrashing
            if (configObj.agents.defaults.systemPrompt !== newPrompt) {
               configObj.agents.defaults.systemPrompt = newPrompt;
               fs.writeFileSync(configPath, JSON.stringify(configObj, null, 2));
               console.log('[openclaw-memory-max] Pinned 1.0 Memory Rules perfectly to the Context Layer.');
            }
         }
       } catch (e) {
         // Fast fail silent on JSON/YAML formatting errors
       }
    }, 15000);
}
