const express = require('express');
const router = express.Router();
const db = require('../db');

// CREATE: Generate a new configuration
router.post('/', async (req, res) => {
  try {
    const {
      allowed_sets = ["emoji_set_1"],
      layout_type = "grid",
      max_items = 10,
      target_count = 6,
      telemetry_max_velocity = 2000.0,
      telemetry_min_tremor = 0.5
    } = req.body;

    // Convert allowed_sets array to JSON for PostgreSQL JSONB
    const setsJson = JSON.stringify(allowed_sets);

    const query = `
      INSERT INTO configurations (allowed_sets, layout_type, max_items, target_count, telemetry_max_velocity, telemetry_min_tremor)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;
    const values = [setsJson, layout_type, max_items, target_count, telemetry_max_velocity, telemetry_min_tremor];

    const result = await db.query(query, values);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Error creating configuration:", error);
    res.status(500).json({ error: "Failed to create configuration" });
  }
});

// READ: Get a configuration by site_key
router.get('/:site_key', async (req, res) => {
  try {
    const { site_key } = req.params;
    console.log(`Fetching config for site_key: '${site_key}' (length: ${site_key.length})`);

    const query = `SELECT * FROM configurations WHERE site_key = $1;`;
    const result = await db.query(query, [site_key]);

    if (result.rows.length === 0) {
      console.error(`=> No rows found for ${site_key}`);
      return res.status(404).json({ error: "Configuration not found" });
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error("Error fetching configuration:", error);
    res.status(500).json({ error: "Failed to fetch configuration" });
  }
});

// UPDATE: Update a configuration by site_key
router.put('/:site_key', async (req, res) => {
  try {
    const { site_key } = req.params;
    const {
      allowed_sets,
      layout_type,
      max_items,
      target_count,
      telemetry_max_velocity,
      telemetry_min_tremor
    } = req.body;

    const updates = [];
    const values = [];
    let queryIndex = 1;

    if (allowed_sets !== undefined) {
      updates.push(`allowed_sets = $${queryIndex++}`);
      values.push(JSON.stringify(allowed_sets));
    }
    if (layout_type !== undefined) {
      updates.push(`layout_type = $${queryIndex++}`);
      values.push(layout_type);
    }
    if (max_items !== undefined) {
      updates.push(`max_items = $${queryIndex++}`);
      values.push(max_items);
    }
    if (target_count !== undefined) {
      updates.push(`target_count = $${queryIndex++}`);
      values.push(target_count);
    }
    if (telemetry_max_velocity !== undefined) {
      updates.push(`telemetry_max_velocity = $${queryIndex++}`);
      values.push(telemetry_max_velocity);
    }
    if (telemetry_min_tremor !== undefined) {
      updates.push(`telemetry_min_tremor = $${queryIndex++}`);
      values.push(telemetry_min_tremor);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(site_key);

    const query = `
      UPDATE configurations
      SET ${updates.join(', ')}
      WHERE site_key = $${queryIndex}
      RETURNING *;
    `;

    const result = await db.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Configuration not found" });
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error("Error updating configuration:", error);
    res.status(500).json({ error: "Failed to update configuration" });
  }
});

module.exports = router;
