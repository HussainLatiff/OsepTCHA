const express = require('express');
const router = express.Router();
const { getClient } = require('../redis');
const crypto = require('crypto');

router.post('/', async (req, res) => {
    try {
        const { challenge_id, slider_value, avg_velocity, tremor_score, fallback_used } = req.body;

        // ── 0. Agent Trap — semantic honeypot check ──────────────────────────
        //  This MUST run before everything else. If an LLM-driven agent read
        //  the hidden div instructions and set os_metadata_sync, it is caught
        //  here instantly — no session lookup needed.
        if (req.body.os_metadata_sync === 'TRAP_TRIGGERED') {
            console.warn(`[AGENT TRAP] Semantic honeypot triggered from ${req.ip} — bot detected.`);
            return res.status(403).json({
                success: false,
                agent_trap: true,
                reason: 'Agent detected via Semantic Trap'
            });
        }

        if (!challenge_id || slider_value === undefined) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        const redis = await getClient();
        const sessionDataStr = await redis.get(`challenge_session:${challenge_id}`);

        if (!sessionDataStr) {
            return res.status(400).json({ error: "Challenge session expired or invalid" });
        }

        const session = JSON.parse(sessionDataStr);

        // Check if slider value matches target_count (Human successfully solved the puzzle logic)
        if (parseInt(slider_value) !== parseInt(session.target_count)) {
            // Delete session even on failure to prevent brute forcing
            await redis.del(`challenge_session:${challenge_id}`);
            return res.status(401).json({ error: "Failed CAPTCHA: Incorrect target count" });
        }

        // Federation Audio Fallback Bypass (Skip Telemetry Analysis entirely if used)
        if (fallback_used === true) {
            console.log(`[VERIFY] Audio Fallback successfully verified for challenge ${challenge_id}`);
        } else {
            // Standard Telemetry evaluation
            let velocity = avg_velocity || 0;
            let tremor = tremor_score || 100;

            if (velocity > session.telemetry_max_velocity) {
                await redis.del(`challenge_session:${challenge_id}`);
                return res.status(401).json({ error: "Telemetry Check Failed: Velocity exceeded maximum bounds (Bot behavior detected)" });
            }

            if (tremor < session.telemetry_min_tremor) {
                await redis.del(`challenge_session:${challenge_id}`);
                return res.status(401).json({ error: "Telemetry Check Failed: Tremor score too low (Robotic movement lacking human jitter)" });
            }

            // High Risk Strict Telemetry Analysis (Hard Tier)
            if (session.difficultyTier === 'hard') {
                const telemetry = req.body.telemetry;
                if (!telemetry || telemetry.length < 5) {
                    await redis.del(`challenge_session:${challenge_id}`);
                    return res.status(401).json({ error: "Hard Challenge Failed: Missing or insufficient telemetry data for strict analysis" });
                }

                let totalDistance = 0;
                let directionChanges = 0;
                let prevVector = null;
                const velocities = [];

                const firstPt = telemetry[0];
                const lastPt = telemetry[telemetry.length - 1];
                const straightDist = Math.sqrt(Math.pow(lastPt.x - firstPt.x, 2) + Math.pow(lastPt.y - firstPt.y, 2));

                for (let i = 1; i < telemetry.length; i++) {
                    const dt = Math.max(1, telemetry[i].timestamp - telemetry[i - 1].timestamp);
                    const dx = telemetry[i].x - telemetry[i - 1].x;
                    const dy = telemetry[i].y - telemetry[i - 1].y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    
                    totalDistance += dist;
                    velocities.push(dist / dt);

                    if (dist > 0) {
                        const vec = { dx: dx / dist, dy: dy / dist };
                        if (prevVector) {
                            const dp = vec.dx * prevVector.dx + vec.dy * prevVector.dy;
                            if (dp < 0.9) directionChanges++; // 0.9 allows slight curve without triggering tremor, <0.9 is a microtremor
                        }
                        prevVector = vec;
                    }
                }

                const straightLineRatio = totalDistance > 0 ? straightDist / totalDistance : 1;
                const meanV = velocities.reduce((a, b) => a + b, 0) / velocities.length;
                const velocityVariance = velocities.reduce((a, b) => a + Math.pow(b - meanV, 2), 0) / velocities.length;
                const microTremorScore = directionChanges / (telemetry.length - 1);

                if (velocityVariance < 0.05) {
                    await redis.del(`challenge_session:${challenge_id}`);
                    return res.status(401).json({ error: "Hard Challenge Failed: Smooth monotonic movement (Zero trajectory variance)" });
                }

                if (straightLineRatio > 0.9) {
                    await redis.del(`challenge_session:${challenge_id}`);
                    return res.status(401).json({ error: "Hard Challenge Failed: Path geometry perfectly uniform (Straight line detected)" });
                }

                if (microTremorScore < 0.1) {
                    await redis.del(`challenge_session:${challenge_id}`);
                    return res.status(401).json({ error: "Hard Challenge Failed: Insufficient micro-tremors (Missing human handshake)" });
                }
            }
        }

        // Everything passes!
        await redis.del(`challenge_session:${challenge_id}`);

        // Generate secure verification token
        const verification_token = crypto.randomBytes(32).toString('hex');

        return res.status(200).json({
            success: true,
            verification_token
        });

    } catch (error) {
        console.error("Verification error:", error);
        res.status(500).json({ error: "Internal server error during verification" });
    }
});

module.exports = router;
