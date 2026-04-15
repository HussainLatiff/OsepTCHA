const db = require('./src/db.js');

async function run() {
    try {
        // Enforce the missing telemetry properties exist reliably
        await db.query(`ALTER TABLE configurations ADD COLUMN IF NOT EXISTS telemetry_max_velocity FLOAT DEFAULT 2000.0;`);
        await db.query(`ALTER TABLE configurations ADD COLUMN IF NOT EXISTS telemetry_min_tremor FLOAT DEFAULT 0.5;`);

        // Insert the test widget key into the database mapping directly so it loads
        await db.query(`
            INSERT INTO configurations 
            (site_key, allowed_sets, layout_type, max_items, telemetry_max_velocity, telemetry_min_tremor) 
            VALUES ('c94453df-0fba-4b03-ba4f-974c912740f3', '["emoji-set-1"]', 'grid', 20, 500, 25)
        `);

        console.log('Schema perfectly patched. Mock Configuration registered!');
    } catch (e) {
        // Specifically swallow duplicate key errors if the config exists
        if (e.code === '23505') {
            console.log('Schema perfectly patched. Mock Configuration already registered!');
        } else {
            console.error('Migration failed:', e);
        }
    } finally {
        process.exit();
    }
}

run();
