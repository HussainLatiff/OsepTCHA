/**
 * Dynamic Difficulty Scaler
 *
 * Accepts a normalised riskScore (0.0 → 1.0) and the raw PostgreSQL
 * configuration row as its baseline.  Returns a fully-resolved set of
 * challenge parameters that the generation route can use directly.
 *
 * Tiers
 * ─────────────────────────────────────────────────────────────────────
 *  riskScore < 0.3   →  Human / Easy
 *    • targetCount  reduced by 30 % from baseline  (floor 1)
 *    • totalNoise   reduced by 20 % from baseline
 *    • layout stays as configured (falls back to 'strict-grid')
 *
 *  0.3 ≤ riskScore ≤ 0.7  →  Uncertain / Medium
 *    • targetCount  clamped to [6, 8]
 *    • totalNoise   unchanged
 *    • layout promoted to 'dynamic' if currently 'strict-grid'
 *
 *  riskScore > 0.7   →  Bot / Hard
 *    • targetCount  set to the maximum allowed bound  (max_items)
 *    • totalNoise   set to the maximum allowed bound  (max_items)
 *    • layout forced to '2D-colliding' (colliding-physics mode)
 *    • telemetry_max_velocity halved (stricter timing window)
 */

// ---------------------------------------------------------------------------
// Baseline defaults – used when PostgreSQL columns are NULL / 0
// ---------------------------------------------------------------------------
const DEFAULTS = {
    target_count: 6,
    max_items: 20,
    total_noise: 10,          // baseline noise item count
    telemetry_max_velocity: 2000,
    telemetry_min_tremor: 10,
    layout_type: 'strict-grid',
};

/**
 * Build a complete difficulty parameter object from a PostgreSQL config row
 * and a risk score.
 *
 * @param {number} riskScore   - value in [0, 1] (0 = highly human, 1 = bot)
 * @param {Object} baseConfig  - raw row from the `configurations` table
 * @returns {Object} Resolved difficulty parameters for the current request
 */
function getDifficultyParams(riskScore, baseConfig) {
    if (!baseConfig) baseConfig = {};

    // ── 1. Resolve baseline values from Postgres config (with safe fallbacks) ──
    const baseTargetCount      = Math.max(1, baseConfig.target_count           || DEFAULTS.target_count);
    const baseMaxItems         = Math.max(1, baseConfig.max_items              || DEFAULTS.max_items);
    const baseTotalNoise       = Math.max(0, baseConfig.total_noise            || DEFAULTS.total_noise);
    const baseMaxVelocity      = Math.max(1, baseConfig.telemetry_max_velocity || DEFAULTS.telemetry_max_velocity);
    const baseMinTremor        =            baseConfig.telemetry_min_tremor    || DEFAULTS.telemetry_min_tremor;
    const baseLayout           =            baseConfig.layout_type             || DEFAULTS.layout_type;

    let targetCount;
    let totalNoise;
    let maxItems;
    let layoutType;
    let telemetryMaxVelocity;
    let collidingPhysics;
    let difficultyTier;

    // ── 2. Apply tier-based scaling ────────────────────────────────────────────

    if (riskScore < 0.3) {
        // ── EASY (likely human) ────────────────────────────────────────────────
        difficultyTier       = 'easy';
        collidingPhysics     = false;
        targetCount          = Math.max(1, Math.floor(baseTargetCount * 0.70));  // −30 %
        totalNoise           = Math.max(0, Math.floor(baseTotalNoise  * 0.80));  // −20 %
        maxItems             = Math.max(targetCount + 4, Math.floor(baseMaxItems * 0.70));
        layoutType           = (baseLayout === 'strict-grid' || !baseLayout)
                                ? 'strict-grid'
                                : baseLayout;
        telemetryMaxVelocity = baseMaxVelocity;

    } else if (riskScore <= 0.7) {
        // ── MEDIUM (uncertain) ─────────────────────────────────────────────────
        difficultyTier       = 'medium';
        collidingPhysics     = false;
        targetCount          = Math.max(6, Math.min(8, baseTargetCount));
        totalNoise           = baseTotalNoise;
        maxItems             = Math.max(targetCount + 10, baseMaxItems);
        layoutType           = (baseLayout === 'strict-grid' || !baseLayout)
                                ? 'dynamic'
                                : baseLayout;
        telemetryMaxVelocity = baseMaxVelocity;

    } else {
        // ── HARD (likely bot) ──────────────────────────────────────────────────
        difficultyTier       = 'hard';
        collidingPhysics     = true;
        targetCount          = baseMaxItems;                               // maximum allowed bound
        totalNoise           = baseMaxItems;                               // maximum noise bound
        maxItems             = Math.max(baseMaxItems * 2, targetCount + 15);
        layoutType           = '2D-colliding';
        telemetryMaxVelocity = Math.floor(baseMaxVelocity / 2);           // stricter timing window
    }

    // ── 3. Global safety caps ──────────────────────────────────────────────────
    maxItems    = Math.min(100, maxItems);
    targetCount = Math.min(targetCount, maxItems);
    totalNoise  = Math.min(totalNoise,  maxItems);

    return {
        targetCount,
        totalNoise,
        maxItems,
        layoutType,
        telemetryMaxVelocity,
        telemetryMinTremor: baseMinTremor,
        difficultyTier,
        collidingPhysics,
    };
}

module.exports = { getDifficultyParams, DEFAULTS };
