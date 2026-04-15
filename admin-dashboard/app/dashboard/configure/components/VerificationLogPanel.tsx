"use client";

import React, { useState, useRef, useEffect } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
type LogKind = "success" | "fail" | "agent_trap" | "info";

interface LogEntry {
  id: number;
  ts: string;
  kind: LogKind;
  label: string;
  detail?: string;
}

interface VerificationLogPanelProps {
  backendUrl?: string;
  /** Pass the last generated site_key so we can run a real challenge simulation */
  activeSiteKey?: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function now(): string {
  return new Date().toLocaleTimeString("en-GB", { hour12: false });
}

let nextId = 1;
function makeEntry(kind: LogKind, label: string, detail?: string): LogEntry {
  return { id: nextId++, ts: now(), kind, label, detail };
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
export function VerificationLogPanel({
  backendUrl = "http://localhost:3001",
  activeSiteKey,
}: VerificationLogPanelProps) {
  const [log, setLog] = useState<LogEntry[]>([
    makeEntry("info", "Log initialised — awaiting simulation events."),
  ]);
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to newest entry
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [log]);

  const push = (...entries: LogEntry[]) =>
    setLog((prev) => [...prev, ...entries]);

  // ── Simulate Agent Trap ─────────────────────────────────────────────────
  // The backend agent-trap gate fires BEFORE session lookup, so we can fire
  // this simulation without a real challenge_id.
  const simulateAgentTrap = async () => {
    setBusy(true);
    push(makeEntry("info", "Sending agent-trap payload to /api/verify…"));
    try {
      const res = await fetch(`${backendUrl}/api/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challenge_id: "sim-agent-trap",
          slider_value: 0,
          os_metadata_sync: "TRAP_TRIGGERED", // ← the bait value
        }),
      });
      const data = await res.json();

      if (data.agent_trap) {
        push(
          makeEntry(
            "agent_trap",
            "AGENT TRAP TRIGGERED",
            `reason: ${data.reason ?? "Agent detected via Semantic Trap"}`
          )
        );
      } else {
        // Unexpected — treat as generic fail
        push(makeEntry("fail", "Unexpected response", JSON.stringify(data)));
      }
    } catch (err: any) {
      push(makeEntry("fail", "Network error", err?.message ?? String(err)));
    } finally {
      setBusy(false);
    }
  };

  // ── Simulate Normal Human Pass ──────────────────────────────────────────
  // Needs a real challenge from the backend. Fetches one with ?firstLoad=true
  // then submits the correct slider value.
  const simulateHumanPass = async () => {
    if (!activeSiteKey) {
      push(
        makeEntry(
          "info",
          "No site key — click 'Generate Service' first to get a site key."
        )
      );
      return;
    }
    setBusy(true);
    push(makeEntry("info", `Fetching challenge for site_key ${activeSiteKey.slice(0, 8)}…`));
    try {
      const genRes = await fetch(
        `${backendUrl}/api/generate-challenge/${activeSiteKey}?firstLoad=true`
      );
      if (!genRes.ok) throw new Error(`Generate failed: ${genRes.statusText}`);
      const challenge = await genRes.json();

      push(
        makeEntry(
          "info",
          `Challenge received — target_count from difficulty: ${challenge.difficulty?.targetCount}`
        )
      );

      // Submit correct slider value
      const verRes = await fetch(`${backendUrl}/api/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challenge_id: challenge.challenge_id,
          slider_value: challenge.difficulty?.targetCount ?? 6,
          avg_velocity: 320,
          tremor_score: 45,
          fallback_used: false,
          os_metadata_sync: "", // empty → human, passes trap check
          telemetry: [],
        }),
      });
      const verData = await verRes.json();

      if (verData.success) {
        push(
          makeEntry(
            "success",
            "Human Verified ✓",
            `token: ${verData.verification_token?.slice(0, 16)}…`
          )
        );
      } else {
        push(
          makeEntry(
            "fail",
            "Verification failed",
            verData.error ?? JSON.stringify(verData)
          )
        );
      }
    } catch (err: any) {
      push(makeEntry("fail", "Network error", err?.message ?? String(err)));
    } finally {
      setBusy(false);
    }
  };

  // ── Simulate Wrong Answer ───────────────────────────────────────────────
  const simulateWrongAnswer = async () => {
    if (!activeSiteKey) {
      push(makeEntry("info", "No site key — generate a configuration first."));
      return;
    }
    setBusy(true);
    push(makeEntry("info", "Simulating wrong slider value…"));
    try {
      const genRes = await fetch(
        `${backendUrl}/api/generate-challenge/${activeSiteKey}?firstLoad=true`
      );
      if (!genRes.ok) throw new Error(`Generate failed: ${genRes.statusText}`);
      const challenge = await genRes.json();

      const wrongSlider =
        (challenge.difficulty?.targetCount ?? 6) + 3; // intentionally wrong

      const verRes = await fetch(`${backendUrl}/api/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challenge_id: challenge.challenge_id,
          slider_value: wrongSlider,
          avg_velocity: 280,
          tremor_score: 30,
          fallback_used: false,
          os_metadata_sync: "",
          telemetry: [],
        }),
      });
      const verData = await verRes.json();
      push(
        makeEntry(
          "fail",
          "Incorrect count submitted",
          verData.error ?? JSON.stringify(verData)
        )
      );
    } catch (err: any) {
      push(makeEntry("fail", "Network error", err?.message ?? String(err)));
    } finally {
      setBusy(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  const kindMeta: Record<LogKind, { dot: string; label: string; text: string; bg: string; border: string }> = {
    success:    { dot: "bg-emerald-400", label: "bg-emerald-100 text-emerald-700",  text: "text-emerald-800", bg: "bg-emerald-50",   border: "border-emerald-200" },
    fail:       { dot: "bg-red-400",     label: "bg-red-100 text-red-700",          text: "text-red-800",     bg: "bg-red-50",       border: "border-red-200"     },
    agent_trap: { dot: "bg-red-600",     label: "bg-red-600 text-white",            text: "text-red-900",     bg: "bg-red-50",       border: "border-red-400"     },
    info:       { dot: "bg-slate-300",   label: "bg-slate-100 text-slate-500",      text: "text-slate-500",   bg: "bg-transparent",  border: "border-transparent" },
  };

  return (
    <div className="w-full bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
      {/* Panel header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-bold text-slate-300 tracking-widest uppercase">
            Verification Event Log
          </span>
        </div>
        <button
          onClick={() => setLog([makeEntry("info", "Log cleared.")])}
          className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors font-mono"
        >
          CLEAR
        </button>
      </div>

      {/* Log scroll area */}
      <div className="h-52 overflow-y-auto px-4 py-3 space-y-1.5 font-mono text-xs" style={{ scrollbarWidth: "thin" }}>
        {log.map((entry) => {
          const m = kindMeta[entry.kind];
          return (
            <div
              key={entry.id}
              className={`flex items-start gap-2 rounded-md px-2 py-1.5 border ${m.bg} ${m.border} transition-all`}
            >
              {/* Timestamp */}
              <span className="text-slate-500 shrink-0 mt-px">{entry.ts}</span>

              {/* Status dot */}
              <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${m.dot}`} />

              {/* Badge + message */}
              <div className="flex-1 min-w-0">
                {entry.kind === "agent_trap" ? (
                  <span className={`inline-block font-black text-[11px] tracking-wider px-2 py-0.5 rounded ${m.label}`}>
                    {entry.label}
                  </span>
                ) : (
                  <span className={`font-semibold ${m.text}`}>{entry.label}</span>
                )}
                {entry.detail && (
                  <p className="text-slate-400 truncate mt-0.5">{entry.detail}</p>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Simulation buttons */}
      <div className="border-t border-slate-800 px-4 py-3 grid grid-cols-3 gap-2">
        <button
          id="sim-btn-human"
          onClick={simulateHumanPass}
          disabled={busy}
          className="flex items-center justify-center gap-1.5 text-[11px] font-bold py-2 px-3 rounded-lg
                     bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50
                     text-white transition-colors"
        >
          ✓ Human
        </button>

        <button
          id="sim-btn-wrong"
          onClick={simulateWrongAnswer}
          disabled={busy}
          className="flex items-center justify-center gap-1.5 text-[11px] font-bold py-2 px-3 rounded-lg
                     bg-amber-600 hover:bg-amber-500 disabled:opacity-50
                     text-white transition-colors"
        >
          ✗ Wrong
        </button>

        <button
          id="sim-btn-agent-trap"
          onClick={simulateAgentTrap}
          disabled={busy}
          className="flex items-center justify-center gap-1.5 text-[11px] font-bold py-2 px-3 rounded-lg
                     bg-red-700 hover:bg-red-600 disabled:opacity-50
                     text-white transition-colors"
        >
          🕸 Trap
        </button>
      </div>

      <p className="text-[10px] text-slate-600 text-center pb-3 font-mono">
        🕸 Trap fires without a site key · Human / Wrong need Generate Service first
      </p>
    </div>
  );
}
