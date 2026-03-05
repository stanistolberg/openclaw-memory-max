import path from 'path';
import Database from 'better-sqlite3';

export function getDb() {
    const baseDir = process.env.OPENCLAW_HOME || path.join(process.env.HOME || '/root', '.openclaw');
    const dbPath = path.join(baseDir, 'memory', 'main.sqlite');
    return new Database(dbPath);
}

export function ensureUtilityColumn() {
    try {
        const db = getDb();
        const tables: any = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
        console.log('[openclaw-memory-max][db] Auditing tables:', tables.map((t: any) => t.name).join(', '));

        // Target generic tables used by OpenClaw memory
        const targetTable = tables.find((t: any) => t.name === 'chunks');

        if (targetTable) {
            const columns: any = db.prepare(`PRAGMA table_info(${targetTable.name})`).all();
            const hasUtility = columns.some((c: any) => c.name === 'utility_score');

            if (!hasUtility) {
                console.log(`[openclaw-memory-max][db] Upgrading Schema: Injecting 'utility_score' into ${targetTable.name}...`);
                db.prepare(`ALTER TABLE ${targetTable.name} ADD COLUMN utility_score REAL DEFAULT 0.5`).run();
                console.log('[openclaw-memory-max][db] Schema upgrade complete. Dependencies injected safely.');
            } else {
                console.log('[openclaw-memory-max][db] Value-Weighted Schema already active.');
            }
        } else {
            console.log('[openclaw-memory-max][db] Memory table not found. Awaiting context instantiation.');
        }
    } catch (e: any) {
        console.error('[openclaw-memory-max][db] SQLite Audit Failed:', e.message);
    }
}

export function rewardMemory(id: string, scalar: number = 0.1) {
    try {
        const db = getDb();
        const tables: any = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
        const targetTable = tables.find((t: any) => t.name === 'memories' || t.name === 'documents' || t.name === 'episodic_memory');

        if (targetTable) {
            const stmt = db.prepare(`
                UPDATE ${targetTable.name} 
                SET utility_score = MAX(0.0, MIN(1.0, utility_score + ?)) 
                WHERE id = ?
            `);
            const info = stmt.run(scalar, id);
            if (info.changes > 0) {
                console.log(`[openclaw-memory-max][db] Rewarded memory ${id} by ${scalar}`);
            }
        }
    } catch (e: any) {
        console.error('[openclaw-memory-max][db] Failed to reward memory:', e.message);
    }
}
