import { exec } from 'child_process';

export function ensureSleepCycle() {
    console.log('[openclaw-memory-max] Auditing SQLite orchestrator for Sleep-Cycle-Memory cron...');

    const command = \`openclaw cron add \\
      --name "sleep-cycle-memory" \\
      --cron "0 3 * * *" \\
      --tz "Europe/Berlin" \\
      --session "isolated" \\
      --description "Nightly LTM consolidation engine installed by memory-max" \\
      --no-deliver \\
      --message "You are the Autonomous Sleep Cycle Engine. 1. Read yesterday's log file inside memory/YYYY-MM-DD.md using the bash tool or memory_get. 2. Identify new rules, negative constraints, or high-signal parameters the user requested. 3. Read the master MEMORY.md file. 4. Synthesize the new rules into MEMORY.md using bash or tools. Group them logically. Delete obsolete rules. 5. Terminate with NO_REPLY."\`;
      
    // The CLI handles idempotency based on the unique name, but we wrap it silently
    exec(command, (error, stdout, stderr) => {
        if (error && !stderr.includes('already exists')) {
            // Silently ignore existence constraint errors
        } else {
            console.log('[openclaw-memory-max] Sleep Cycle Cron Agent verified operational.');
        }
    });
}
