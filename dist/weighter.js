"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerWeighter = registerWeighter;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const yaml_1 = __importDefault(require("yaml"));
function registerWeighter(api) {
    // Determine the base openclaw directory
    const baseDir = process.env.OPENCLAW_HOME || path_1.default.join(process.env.HOME || '/root', '.openclaw');
    const memoryPath = path_1.default.join(baseDir, 'memory/MEMORY.md');
    const configPath = path_1.default.join(baseDir, 'openclaw.json');
    // Interval to actively guard the 1.0 boundaries without user input.
    setInterval(() => {
        try {
            if (!fs_1.default.existsSync(memoryPath))
                return;
            // 1. Read the MEMORY.md file and look for YAML fences
            const text = fs_1.default.readFileSync(memoryPath, 'utf8');
            let pinnedOutput = '';
            const match = text.match(/<!--yaml\n([\s\S]*?)\n-->/);
            if (match) {
                const parsed = yaml_1.default.parse(match[1]);
                if (parsed && parsed.rules) {
                    const pinned = parsed.rules
                        .filter((r) => parseFloat(r.weight) >= 1.0)
                        .map((r) => 'CRITICAL CONSTRAINT: ' + (r.constraint || r.rule || r.preference));
                    pinnedOutput = pinned.join('\n');
                }
            }
            // 2. Read the global config and merge pinned rules into the fallback framework
            if (pinnedOutput && fs_1.default.existsSync(configPath)) {
                const configObj = JSON.parse(fs_1.default.readFileSync(configPath, 'utf8'));
                if (!configObj.agents)
                    configObj.agents = {};
                if (!configObj.agents.defaults)
                    configObj.agents.defaults = {};
                const basePrompt = `
- Agents NEVER give up at the first obstacle — try alternative approaches, backtrack, and adapt
- Agents NEVER modify logs, evaluation data, or system files unless explicitly instructed
- Agents ALWAYS be transparent about all actions taken
`;
                const pinnedBlock = '\n--- PINNED SEMANTIC MEMORY ---\n' + pinnedOutput;
                const existingPrompt = configObj.agents.defaults.systemPrompt || '';
                // Merge: preserve existing prompt content, replace only our managed section
                const managedStart = '--- PINNED SEMANTIC MEMORY ---';
                const managedEnd = '--- END PINNED SEMANTIC MEMORY ---';
                let newPrompt;
                if (existingPrompt.includes(managedStart)) {
                    // Replace existing managed block
                    const before = existingPrompt.substring(0, existingPrompt.indexOf(managedStart));
                    const afterIdx = existingPrompt.indexOf(managedEnd);
                    const after = afterIdx >= 0 ? existingPrompt.substring(afterIdx + managedEnd.length) : '';
                    newPrompt = before + managedStart + '\n' + pinnedOutput + '\n' + managedEnd + after;
                }
                else if (!existingPrompt) {
                    // No existing prompt — set base + pinned
                    newPrompt = basePrompt + '\n' + managedStart + '\n' + pinnedOutput + '\n' + managedEnd;
                }
                else {
                    // Existing prompt but no managed block — append
                    newPrompt = existingPrompt + '\n' + managedStart + '\n' + pinnedOutput + '\n' + managedEnd;
                }
                // Only write if it actually changed to prevent disk thrashing
                if (configObj.agents.defaults.systemPrompt !== newPrompt) {
                    configObj.agents.defaults.systemPrompt = newPrompt;
                    fs_1.default.writeFileSync(configPath, JSON.stringify(configObj, null, 2));
                    console.log('[openclaw-memory-max] Pinned 1.0 Memory Rules perfectly to the Context Layer.');
                }
            }
        }
        catch (e) {
            // Fast fail silent on JSON/YAML formatting errors
        }
    }, 15000);
}
