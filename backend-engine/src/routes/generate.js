const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../db');
const { calculateRiskScore } = require('../utils/riskScorer');
const { getDifficultyParams } = require('../utils/difficultyScaler');
const { generateGridLayout, generateDynamicLayout, generateCollidingLayout } = require('../services/layoutEngine');
const challengesData = require('../data/challenges.json');
const { getClient } = require('../redis');

router.get('/:site_key', async (req, res) => {
    try {
        const { site_key } = req.params;

        // ── 1. Load baseline bounds from PostgreSQL ─────────────────────────
        const query = `SELECT * FROM configurations WHERE site_key = $1;`;
        const result = await db.query(query, [site_key]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Configuration not found for the provided site_key" });
        }

        const config = result.rows[0];

        // In raw pg, jsonb might be returned as an object or a string depending on the driver config
        if (typeof config.allowed_sets === 'string') {
            try { config.allowed_sets = JSON.parse(config.allowed_sets); } catch (e) { }
        }

        // ── 2. Resolve risk score ───────────────────────────────────────────
        //
        //  Three modes:
        //
        //  a) firstLoad=true  — The widget's very first request on page open.
        //     No real behavioural signals exist yet, so we skip the Risk Engine
        //     and the Difficulty Scaler entirely.  The challenge is built
        //     strictly from the PostgreSQL config bounds.
        //
        //  b) simulatedRisk=<float>  — Admin Dashboard Puzzle Preview.
        //     Bypasses the live Risk Engine with a caller-supplied value.
        //
        //  c) Normal flow  — calculateRiskScore() runs on subsequent requests
        //     (i.e. after a failed verification) when real signals exist.

        const isFirstLoad = req.query?.firstLoad === 'true';
        let riskScore;
        let skipScaling = false;

        if (isFirstLoad) {
            // Strict baseline — no scaling applied
            skipScaling = true;
            riskScore = null;
            console.log(`[RISK ENGINE] firstLoad — skipping risk engine & scaler for ${req.ip}`);
        } else {
            const simulatedRisk = req.query?.simulatedRisk;

            if (simulatedRisk !== undefined) {
                const parsed = parseFloat(simulatedRisk);
                if (isNaN(parsed) || parsed < 0 || parsed > 1) {
                    return res.status(400).json({
                        error: "simulatedRisk must be a number in the range [0, 1]"
                    });
                }
                riskScore = parsed;
                console.log(`[RISK ENGINE] simulatedRisk override: ${riskScore.toFixed(2)} for ${req.ip}`);
            } else {
                let signals = req.body?.signals;
                if (!signals && req.query?.signals) {
                    try { signals = JSON.parse(req.query.signals); } catch (e) { }
                }
                riskScore = calculateRiskScore(req, signals);
                console.log(`[RISK ENGINE] Calculated score: ${riskScore.toFixed(2)} for ${req.ip}`);
            }
        }

        // ── 3. Dynamic Difficulty Scaler ────────────────────────────────────
        //
        //  On firstLoad we skip getDifficultyParams() and use the raw
        //  PostgreSQL values directly so the puzzle always opens exactly as
        //  the site owner configured it.
        //
        //  On subsequent requests (retry after failure / Admin preview) the
        //  scaler runs and applies tier adjustments:
        //    • riskScore < 0.3  →  Easy   (targetCount −30 %, noise −20 %)
        //    • riskScore ≤ 0.7  →  Medium (clamped counts, dynamic layout)
        //    • riskScore > 0.7  →  Hard   (max bounds, colliding-physics mode)

        let scaledTargetCount, totalNoise, maxItems, layoutType,
            telemetryMaxVelocity, telemetryMinTremor, difficultyTier, collidingPhysics;

        if (skipScaling) {
            // ── Strict baseline from PostgreSQL (no scaling) ──────────────
            scaledTargetCount  = config.target_count           || 6;
            totalNoise         = config.total_noise            || 10;
            maxItems           = config.max_items              || 20;
            layoutType         = config.layout_type            || 'strict-grid';
            telemetryMaxVelocity = config.telemetry_max_velocity || 2000;
            telemetryMinTremor   = config.telemetry_min_tremor   || 10;
            difficultyTier     = 'baseline';
            collidingPhysics   = (layoutType === '2D-colliding');
            console.log(
                `[DIFFICULTY] tier=baseline (firstLoad) | targetCount=${scaledTargetCount} ` +
                `| noise=${totalNoise} | maxItems=${maxItems} | layout=${layoutType}`
            );
        } else {
            // ── Scaled from risk score ────────────────────────────────────
            const difficulty = getDifficultyParams(riskScore, config);
            ({ targetCount: scaledTargetCount, totalNoise, maxItems, layoutType,
               telemetryMaxVelocity, telemetryMinTremor, difficultyTier,
               collidingPhysics } = difficulty);
            console.log(
                `[DIFFICULTY] tier=${difficultyTier} | targetCount=${scaledTargetCount} ` +
                `| noise=${totalNoise} | maxItems=${maxItems} ` +
                `| layout=${layoutType} | colliding=${collidingPhysics}`
            );
        }

        // ── 4. Pick a random challenge set ──────────────────────────────────
        const { allowed_sets } = config;

        if (!allowed_sets || !Array.isArray(allowed_sets) || allowed_sets.length === 0) {
            console.error("Allowed sets is invalid:", allowed_sets);
            return res.status(500).json({ error: "No allowed sets configured for this site" });
        }

        const randomSetKey = allowed_sets[Math.floor(Math.random() * allowed_sets.length)];
        const challengeDefinition = challengesData[randomSetKey];

        if (!challengeDefinition) {
            console.error(`Missing challenge set in JSON for key: ${randomSetKey}`);
            return res.status(500).json({ error: `Challenge set '${randomSetKey}' not found` });
        }

        const { targetAsset, fillerAssets, targetLabel } = challengeDefinition;

        // ── 5. Randomise final target count within a small upper band ────────
        //  Add a random jitter of up to +4 above the scaled baseline so that
        //  repeated requests never produce identical counts.
        const maxPossibleTargets = Math.min(maxItems, scaledTargetCount + 4);
        const finalTargetCount = (maxPossibleTargets > scaledTargetCount)
            ? Math.floor(Math.random() * (maxPossibleTargets - scaledTargetCount + 1)) + scaledTargetCount
            : scaledTargetCount;

        //  Filler count uses totalNoise (already scaled) instead of the
        //  raw (max_items − targetCount) formula, giving the scaler full
        //  control over the noise level.
        const fillerCount = Math.max(0, Math.min(totalNoise, maxItems - finalTargetCount));

        // ── 6. Build item array ─────────────────────────────────────────────
        const selectedItems = [];

        for (let i = 0; i < finalTargetCount; i++) {
            selectedItems.push({ url: targetAsset, isTarget: true });
        }

        for (let i = 0; i < fillerCount; i++) {
            const randomFiller = fillerAssets[Math.floor(Math.random() * fillerAssets.length)];
            selectedItems.push({ url: randomFiller, isTarget: false });
        }

        // Shuffle for unpredictable positions
        selectedItems.sort(() => Math.random() - 0.5);

        // ── 7. Generate layout coordinates ──────────────────────────────────
        const totalSlots = finalTargetCount + fillerCount;
        let layoutCoords;
        if (layoutType === 'strict-grid' || layoutType === 'grid') {
            layoutCoords = generateGridLayout(totalSlots);
        } else if (layoutType === '2D-colliding') {
            layoutCoords = generateCollidingLayout(totalSlots);
        } else {
            layoutCoords = generateDynamicLayout(totalSlots);
        }

        // Merge layout coordinates with selected items
        const finalItems = [];
        for (let i = 0; i < layoutCoords.length && i < selectedItems.length; i++) {
            finalItems.push({
                ...selectedItems[i],
                ...layoutCoords[i]
            });
        }

        // ── 8. Persist session data in Redis (5 min TTL) ────────────────────
        const challenge_id = crypto.randomUUID();
        const prompt = `Count the number of ${targetLabel}`;

        const sessionData = {
            challenge_id,
            target_count: finalTargetCount,
            telemetry_max_velocity: telemetryMaxVelocity,
            telemetry_min_tremor: telemetryMinTremor,
            difficultyTier,
            collidingPhysics,
            riskScore,                   // stored for audit / analytics
            agent_trap: !!(config.agent_trap),  // forwarded to widget via response
            created_at: Date.now()
        };

        const redis = await getClient();
        await redis.setEx(`challenge_session:${challenge_id}`, 300, JSON.stringify(sessionData));

        // ── 9. Respond ───────────────────────────────────────────────────────
        res.status(200).json({
            prompt,
            challenge_id,
            items: finalItems,
            agent_trap: !!(config.agent_trap),  // tells widget whether to inject honeypot
            // Expose difficulty metadata so Admin Puzzle Preview can render
            // the correct UI state when simulatedRisk is toggled.
            difficulty: {
                tier: difficultyTier,
                targetCount: finalTargetCount,
                totalNoise: fillerCount,
                layoutType,
                collidingPhysics,
                riskScore,
            }
        });

    } catch (error) {
        console.error("Error generating challenge:", error);
        res.status(500).json({ error: "Failed to generate challenge" });
    }
});

module.exports = router;
