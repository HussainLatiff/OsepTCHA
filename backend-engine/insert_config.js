const db = require('./src/db.js');
async function run() {
    try {
        await db.query(`
            INSERT INTO configurations 
            (id, allowed_sets, layout_type, max_items, telemetry_max_velocity, telemetry_min_tremor) 
            VALUES ('c94453df-0fba-4b03-ba4f-974c912740f3', '["emoji-set-1"]', 'grid', 20, 500, 25) 
            ON CONFLICT (id) DO NOTHING
        `);
        console.log('Dummy config inserted successfully!');
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}
run();
