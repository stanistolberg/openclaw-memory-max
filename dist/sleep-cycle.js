"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureSleepCycle = ensureSleepCycle;
const child_process_1 = require("child_process");
function ensureSleepCycle() {
    console.log('[openclaw-memory-max] Setting up Sleep-Cycle-Memory cron...');
    const command = `openclaw cron add \
      --name "sleep-cycle-memory" \
      --cron "0 3 * * *" \
      --tz "Europe/Berlin" \
      --session "isolated" \
      --description "Nightly LTM consolidation engine installed by memory-max" \
      --no-deliver \
      --message "You are the Autonomous Sleep Cycle Engine. 1. Read yesterday's log file inside memory/YYYY-MM-DD.md using the bash tool or memory_get. 2. Identify new rules, negative constraints, or high-signal parameters the user requested. 3. Read the master MEMORY.md file. 4. Synthesize the new rules into MEMORY.md using bash or tools. Group them logically. Delete obsolete rules. 5. Terminate with NO_REPLY."`;
    return new Promise((resolve) => {
        (0, child_process_1.exec)(command, (error, _stdout, stderr) => {
            if (error) {
                if (stderr.includes('already exists')) {
                    console.log('[openclaw-memory-max] Sleep Cycle cron already exists.');
                }
                else {
                    console.error('[openclaw-memory-max] Sleep Cycle cron setup failed:', error.message);
                }
            }
            else {
                console.log('[openclaw-memory-max] Sleep Cycle cron created successfully.');
            }
            resolve();
        });
    });
}
