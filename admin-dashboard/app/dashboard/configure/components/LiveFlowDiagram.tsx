"use client";

import React, { useEffect } from "react";
import { motion, useAnimation, AnimatePresence } from "framer-motion";

interface LiveFlowDiagramProps {
  riskEngineActive: boolean;
  agentTrapActive: boolean;
}

const NODE_W = 140;
const NODE_H = 44;

// Fixed coordinate centres
const RISK_CX = 200;
const RISK_CY = 48;

const CHALLENGE_CX = 200;
const CHALLENGE_CY = 160;

const BACKEND_CX = 80;
const BACKEND_CY = 270;

const CLIENT_CX = 320;
const CLIENT_CY = 270;

const AUDIO_CX = 200;
const AUDIO_CY = 370;

export function LiveFlowDiagram({ riskEngineActive, agentTrapActive }: LiveFlowDiagramProps) {
  const pulseControls = useAnimation();

  // Trigger glow pulse whenever riskEngineActive changes
  useEffect(() => {
    if (riskEngineActive) {
      pulseControls.start({
        opacity: [0, 1, 0.6, 1, 0],
        pathLength: [0, 1],
        transition: { duration: 1.4, ease: "easeInOut", repeat: Infinity, repeatDelay: 0.8 },
      });
    } else {
      pulseControls.stop();
      pulseControls.set({ opacity: 0, pathLength: 0 });
    }
  }, [riskEngineActive, pulseControls]);

  // Line from Risk Engine to Challenge
  const riskToChallengeD = `M ${RISK_CX} ${RISK_CY + NODE_H / 2} L ${CHALLENGE_CX} ${CHALLENGE_CY - NODE_H / 2}`;

  // Line from Challenge to Backend
  const challengeToBackendD = `M ${CHALLENGE_CX - NODE_W / 2} ${CHALLENGE_CY} Q ${BACKEND_CX + 20} ${(CHALLENGE_CY + BACKEND_CY) / 2} ${BACKEND_CX} ${BACKEND_CY - NODE_H / 2}`;

  // Agent trap: Backend → Client (dotted)
  const agentTrapD = `M ${BACKEND_CX + NODE_W / 2} ${BACKEND_CY} L ${CLIENT_CX - NODE_W / 2} ${CLIENT_CY}`;

  // Audio line from Challenge
  const audioLineD = `M ${CHALLENGE_CX} ${CHALLENGE_CY + NODE_H / 2} L ${AUDIO_CX} ${AUDIO_CY - 18}`;

  return (
    <svg
      viewBox="0 0 400 430"
      className="w-full h-auto"
      style={{ minHeight: 320 }}
      aria-label="Live Architecture Flow Diagram"
    >
      <defs>
        {/* Glow filter for animated pulse */}
        <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Subtle node shadow */}
        <filter id="nodeShadow" x="-10%" y="-20%" width="120%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.10" />
        </filter>

        {/* Arrow marker */}
        <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill="#94a3b8" />
        </marker>
        <marker id="arrow-blue" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill="#3b82f6" />
        </marker>
        <marker id="arrow-violet" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill="#8b5cf6" />
        </marker>
      </defs>

      {/* ── Static connector lines ── */}

      {/* Risk → Challenge (static base) */}
      <line
        x1={RISK_CX} y1={RISK_CY + NODE_H / 2}
        x2={CHALLENGE_CX} y2={CHALLENGE_CY - NODE_H / 2}
        stroke="#cbd5e1" strokeWidth={1.5}
        markerEnd="url(#arrow)"
      />

      {/* Challenge → Backend */}
      <path
        d={challengeToBackendD}
        fill="none" stroke="#cbd5e1" strokeWidth={1.5}
        markerEnd="url(#arrow)"
      />

      {/* Challenge → Client */}
      <path
        d={`M ${CHALLENGE_CX + NODE_W / 2} ${CHALLENGE_CY} Q ${CLIENT_CX - 20} ${(CHALLENGE_CY + CLIENT_CY) / 2} ${CLIENT_CX} ${CLIENT_CY - NODE_H / 2}`}
        fill="none" stroke="#cbd5e1" strokeWidth={1.5}
        markerEnd="url(#arrow)"
      />

      {/* Audio line (always visible, muted) */}
      <line
        x1={AUDIO_CX} y1={CHALLENGE_CY + NODE_H / 2}
        x2={AUDIO_CX} y2={AUDIO_CY - 18}
        stroke="#e0e7ff" strokeWidth={1.5}
        strokeDasharray="4 3"
      />

      {/* ── Animated pulse on Risk → Challenge ── */}
      <motion.path
        d={riskToChallengeD}
        fill="none"
        stroke="#3b82f6"
        strokeWidth={3}
        strokeLinecap="round"
        filter="url(#glow)"
        initial={{ opacity: 0, pathLength: 0 }}
        animate={pulseControls}
      />

      {/* ── Agent Trap dotted line (Backend → Client) ── */}
      <AnimatePresence>
        {agentTrapActive && (
          <motion.line
            key="agent-trap"
            x1={BACKEND_CX + NODE_W / 2} y1={BACKEND_CY}
            x2={CLIENT_CX - NODE_W / 2} y2={CLIENT_CY}
            stroke="#8b5cf6"
            strokeWidth={2}
            strokeDasharray="6 4"
            markerEnd="url(#arrow-violet)"
            initial={{ opacity: 0, pathLength: 0 }}
            animate={{ opacity: 1, pathLength: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          />
        )}
      </AnimatePresence>
      {agentTrapActive && (
        <text
          x={(BACKEND_CX + CLIENT_CX) / 2}
          y={BACKEND_CY - 12}
          textAnchor="middle"
          fontSize="9"
          fill="#8b5cf6"
          fontWeight="600"
          letterSpacing="0.5"
        >
          Invisible Layer
        </text>
      )}

      {/* ── Nodes ── */}

      {/* Risk Engine node (square) */}
      <rect
        x={RISK_CX - NODE_W / 2} y={RISK_CY - NODE_H / 2}
        width={NODE_W} height={NODE_H}
        rx={6}
        fill={riskEngineActive ? "#eff6ff" : "#f8fafc"}
        stroke={riskEngineActive ? "#3b82f6" : "#cbd5e1"}
        strokeWidth={riskEngineActive ? 2 : 1.5}
        filter="url(#nodeShadow)"
      />
      <text x={RISK_CX} y={RISK_CY - 6} textAnchor="middle" fontSize="10" fill="#64748b" fontWeight="500">
        ⚡
      </text>
      <text x={RISK_CX} y={RISK_CY + 8} textAnchor="middle" fontSize="11" fill={riskEngineActive ? "#1d4ed8" : "#374151"} fontWeight="700">
        Risk Engine
      </text>

      {/* CAPTCHA Challenge node */}
      <rect
        x={CHALLENGE_CX - NODE_W / 2} y={CHALLENGE_CY - NODE_H / 2}
        width={NODE_W} height={NODE_H}
        rx={8}
        fill="#f0fdf4"
        stroke="#22c55e"
        strokeWidth={1.5}
        filter="url(#nodeShadow)"
      />
      <text x={CHALLENGE_CX} y={CHALLENGE_CY - 6} textAnchor="middle" fontSize="10" fill="#22c55e" fontWeight="500">
        🧩
      </text>
      <text x={CHALLENGE_CX} y={CHALLENGE_CY + 8} textAnchor="middle" fontSize="11" fill="#15803d" fontWeight="700">
        CAPTCHA Challenge
      </text>

      {/* Backend node */}
      <rect
        x={BACKEND_CX - NODE_W / 2} y={BACKEND_CY - NODE_H / 2}
        width={NODE_W} height={NODE_H}
        rx={6}
        fill="#f8fafc"
        stroke="#94a3b8"
        strokeWidth={1.5}
        filter="url(#nodeShadow)"
      />
      <text x={BACKEND_CX} y={BACKEND_CY - 5} textAnchor="middle" fontSize="10" fill="#64748b" fontWeight="500">
        🖥
      </text>
      <text x={BACKEND_CX} y={BACKEND_CY + 9} textAnchor="middle" fontSize="10" fill="#374151" fontWeight="600">
        Backend
      </text>

      {/* Client node */}
      <rect
        x={CLIENT_CX - NODE_W / 2} y={CLIENT_CY - NODE_H / 2}
        width={NODE_W} height={NODE_H}
        rx={6}
        fill="#fefce8"
        stroke="#f59e0b"
        strokeWidth={1.5}
        filter="url(#nodeShadow)"
      />
      <text x={CLIENT_CX} y={CLIENT_CY - 5} textAnchor="middle" fontSize="10" fill="#d97706" fontWeight="500">
        🌐
      </text>
      <text x={CLIENT_CX} y={CLIENT_CY + 9} textAnchor="middle" fontSize="10" fill="#374151" fontWeight="600">
        Client
      </text>

      {/* Audio Challenge node */}
      <rect
        x={AUDIO_CX - 70} y={AUDIO_CY - 18}
        width={140} height={36}
        rx={18}
        fill="#ede9fe"
        stroke="#7c3aed"
        strokeWidth={1.5}
        filter="url(#nodeShadow)"
      />
      <text x={AUDIO_CX} y={AUDIO_CY - 3} textAnchor="middle" fontSize="10" fill="#6d28d9" fontWeight="500">
        🔊
      </text>
      <text x={AUDIO_CX} y={AUDIO_CY + 11} textAnchor="middle" fontSize="10" fill="#4c1d95" fontWeight="700">
        Audio Challenge
      </text>

      {/* "Permanently Active" badge on Audio node */}
      <rect x={AUDIO_CX + 48} y={AUDIO_CY - 28} width={72} height={16} rx={4} fill="#7c3aed" />
      <text x={AUDIO_CX + 84} y={AUDIO_CY - 17} textAnchor="middle" fontSize="7.5" fill="white" fontWeight="700" letterSpacing="0.3">
        PERM. ACTIVE
      </text>
    </svg>
  );
}
