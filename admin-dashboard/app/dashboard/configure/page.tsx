"use client";

import React, { useState, useEffect } from 'react';
import { UploadZone } from './components/UploadZone';
import { LiveFlowDiagram } from './components/LiveFlowDiagram';
import { VerificationLogPanel } from './components/VerificationLogPanel';

// ─────────────────────────────────────────────────────────────────────────────
// Static challenge catalogue (mirrors backend-engine/src/data/challenges.json)
// ─────────────────────────────────────────────────────────────────────────────
const CHALLENGES = {
    "emoji-set-1": {
        name: "Emoji Challenge 1",
        targetAsset: "http://localhost:3001/assets/emojis/emoji-set-1/target-smile.png",
        fillerAssets: [
            "http://localhost:3001/assets/emojis/emoji-set-1/emoji-1.png",
            "http://localhost:3001/assets/emojis/emoji-set-1/emoji-2.png",
            "http://localhost:3001/assets/emojis/emoji-set-1/emoji-3.png"
        ],
        targetLabel: "😁"
    },
    "emoji-set-2": {
        name: "Emoji Challenge 2",
        targetAsset: "http://localhost:3001/assets/emojis/emoji-set-2/target-tear.png",
        fillerAssets: [
            "http://localhost:3001/assets/emojis/emoji-set-2/emoji-1.png",
            "http://localhost:3001/assets/emojis/emoji-set-2/emoji-2.png",
            "http://localhost:3001/assets/emojis/emoji-set-2/emoji-3.png"
        ],
        targetLabel: "🥲"
    },
    "emoji-set-3": {
        name: "Emoji Challenge 3",
        targetAsset: "http://localhost:3001/assets/emojis/emoji-set-3/target-halfsmile.png",
        fillerAssets: [
            "http://localhost:3001/assets/emojis/emoji-set-3/emoji-1.png",
            "http://localhost:3001/assets/emojis/emoji-set-3/emoji-2.png",
            "http://localhost:3001/assets/emojis/emoji-set-3/emoji-3.png"
        ],
        targetLabel: "😀"
    },
    "shape-set-1": {
        name: "Shapes Challenge 1",
        targetAsset: "http://localhost:3001/assets/shapes/shape-set-1/target-triangle.png",
        fillerAssets: [
            "http://localhost:3001/assets/shapes/shape-set-1/triangle-1.png",
            "http://localhost:3001/assets/shapes/shape-set-1/triangle-2.png",
            "http://localhost:3001/assets/shapes/shape-set-1/triangle-3.png"
        ],
        targetLabel: "green"
    },
    "shape-set-2": {
        name: "Shapes Challenge 2",
        targetAsset: "http://localhost:3001/assets/shapes/shape-set-2/target-circle.png",
        fillerAssets: [
            "http://localhost:3001/assets/shapes/shape-set-2/circle-1.png",
            "http://localhost:3001/assets/shapes/shape-set-2/circle-2.png",
            "http://localhost:3001/assets/shapes/shape-set-2/circle-3.png"
        ],
        targetLabel: "blue"
    }
};

const GRID_OPTIONS = [20, 24, 25, 30, 36];

// ─────────────────────────────────────────────────────────────────────────────
// Layout helpers (ported from backend layoutEngine for Live Preview)
// ─────────────────────────────────────────────────────────────────────────────
function generateGridLayout(maxItems: number) {
    const canvasSize = 400;
    const cols = Math.ceil(Math.sqrt(maxItems));
    const rows = Math.ceil(maxItems / cols);
    const cellWidth = canvasSize / cols;
    const cellHeight = canvasSize / rows;
    const size = Math.min(64, Math.min(cellWidth, cellHeight) * 0.8);
    const layouts: { x: number; y: number; width: number; height: number }[] = [];
    let count = 0;
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (count >= maxItems) break;
            const x = c * cellWidth + (cellWidth - size) / 2;
            const y = r * cellHeight + (cellHeight - size) / 2;
            layouts.push({ x: Math.round(x), y: Math.round(y), width: Math.round(size), height: Math.round(size) });
            count++;
        }
    }
    return layouts;
}

function generateDynamicLayout(maxItems: number) {
    const canvasSize = 400;
    const minSize = 24, maxSize = 56, maxRetries = 100;
    const layouts: { x: number; y: number; width: number; height: number }[] = [];
    for (let i = 0; i < maxItems; i++) {
        for (let retry = 0; retry < maxRetries; retry++) {
            const size = Math.floor(Math.random() * (maxSize - minSize + 1)) + minSize;
            const x = Math.floor(Math.random() * (canvasSize - size + 1));
            const y = Math.floor(Math.random() * (canvasSize - size + 1));
            const overlap = layouts.some(item =>
                x < item.x + item.width + 2 && x + size + 2 > item.x &&
                y < item.y + item.height + 2 && y + size + 2 > item.y
            );
            if (!overlap) { layouts.push({ x, y, width: size, height: size }); break; }
        }
    }
    return layouts;
}

// ─────────────────────────────────────────────────────────────────────────────
// Small Toggle Switch component
// ─────────────────────────────────────────────────────────────────────────────
function ToggleSwitch({
    id, checked, onChange, disabled = false,
    colorClass = "bg-blue-500"
}: {
    id: string;
    checked: boolean;
    onChange: (v: boolean) => void;
    disabled?: boolean;
    colorClass?: string;
}) {
    return (
        <button
            id={id}
            role="switch"
            aria-checked={checked}
            disabled={disabled}
            onClick={() => !disabled && onChange(!checked)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-300
        ${checked ? colorClass : 'bg-slate-200'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
            <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform
          ${checked ? 'translate-x-6' : 'translate-x-1'}`}
            />
        </button>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────
export default function ConfigurePage() {
    // ── Challenge composition ─────────────────────────────────────────────────
    const [selectedFolders, setSelectedFolders] = useState<string[]>(['emoji-set-1']);
    const [layoutType, setLayoutType] = useState<'grid' | 'dynamic'>('grid');
    const [targetCount, setTargetCount] = useState<number>(6);
    const [gridIndex, setGridIndex] = useState<number>(0);
    const [dynamicShapes, setDynamicShapes] = useState<number>(20);

    // ── Telemetry ─────────────────────────────────────────────────────────────
    const [zkpVelocity, setZkpVelocity] = useState<number>(2000);
    const [zkpTremor, setZkpTremor] = useState<number>(10);

    // ── Federated toggles ─────────────────────────────────────────────────────
    const [riskEngineActive, setRiskEngineActive] = useState<boolean>(false);
    const [agentTrapActive, setAgentTrapActive] = useState<boolean>(false);
    // Audio Challenge is permanently active — no state toggle needed

    // ── Preview / output ──────────────────────────────────────────────────────
    const [previewLayouts, setPreviewLayouts] = useState<any[]>([]);
    const [generatedScript, setGeneratedScript] = useState<string | null>(null);
    const [generatedJson, setGeneratedJson] = useState<string | null>(null);
    const [activeSiteKey, setActiveSiteKey] = useState<string | null>(null);

    const totalShapes = layoutType === 'grid' ? GRID_OPTIONS[gridIndex] : dynamicShapes;

    // Re-generate preview whenever config changes
    useEffect(() => {
        const coords = layoutType === 'grid'
            ? generateGridLayout(totalShapes)
            : generateDynamicLayout(totalShapes);

        if (selectedFolders.length === 0) { setPreviewLayouts([]); return; }

        const puzzleSetKey = selectedFolders[Math.floor(Math.random() * selectedFolders.length)];
        const setDef = CHALLENGES[puzzleSetKey as keyof typeof CHALLENGES];

        const layoutsWithImages = coords.map((pos, i) => {
            const isTarget = i < targetCount;
            const url = isTarget
                ? setDef.targetAsset
                : setDef.fillerAssets[Math.floor(Math.random() * setDef.fillerAssets.length)];
            return { ...pos, url, isTarget, setKey: puzzleSetKey };
        });

        // Fisher-Yates shuffle
        for (let i = layoutsWithImages.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [layoutsWithImages[i], layoutsWithImages[j]] = [layoutsWithImages[j], layoutsWithImages[i]];
        }

        setPreviewLayouts(layoutsWithImages);
    }, [layoutType, totalShapes, targetCount, selectedFolders]);

    const toggleFolder = (key: string) =>
        setSelectedFolders(prev => prev.includes(key) ? prev.filter(f => f !== key) : [...prev, key]);

    const handleGenerate = async () => {
        const payload = {
            allowed_sets: selectedFolders,
            layout_type: layoutType,
            max_items: totalShapes,
            target_count: targetCount,
            telemetry_max_velocity: zkpVelocity,
            telemetry_min_tremor: zkpTremor
        };
        try {
            const res = await fetch('http://localhost:3001/api/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error("Failed to save config to DB");
            const savedConfig = await res.json();
            const realUuid = savedConfig.site_key || savedConfig.id;
            setActiveSiteKey(realUuid);
            setGeneratedScript(`<script src="http://localhost:5173/src/widget.js?sitekey=${realUuid}" async defer></script>`);
            setGeneratedJson(JSON.stringify(savedConfig, null, 2));
        } catch {
            alert("Ensure your Backend Engine is running on port 3001!");
        }
    };

    const activeSet = previewLayouts.length > 0
        ? CHALLENGES[previewLayouts[0].setKey as keyof typeof CHALLENGES]
        : null;

    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-8 font-sans text-slate-800">
            <div className="max-w-[1400px] mx-auto">

                {/* ── Header (no avatar) ───────────────────────────────────────── */}
                <header className="mb-10 flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-3">
                            <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                            OsepTCHA Dashboard
                        </h1>
                        <p className="text-slate-500 mt-2 text-sm font-medium">
                            Configure and deploy zero-knowledge proof CAPTCHA challenges.
                        </p>
                    </div>
                </header>

                {/* ── 3-Column Layout ───────────────────────────────────────────── */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">

                    {/* ══ Left Column (2/3): Configuration Form ══════════════════ */}
                    <div className="lg:col-span-2 space-y-6">

                        {/* Card 1: Challenge Composition */}
                        <div className="bg-white p-8 rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-slate-100 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-bl-full -z-10 opacity-60" />

                            <h2 className="text-xl font-bold mb-6 text-slate-800 flex items-center gap-2">
                                <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                Challenge Composition
                            </h2>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {/* ── Allowed Asset Sets + Upload ── */}
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-3">
                                        Allowed Asset Sets
                                    </label>
                                    <p className="text-xs text-slate-500 mb-4 font-medium">
                                        Select one or more image sets to compile puzzles from.
                                    </p>
                                    <div className="space-y-3">
                                        {Object.entries(CHALLENGES).map(([key, data]) => (
                                            <label
                                                key={key}
                                                className={`flex items-center space-x-3 p-3 rounded-lg border-2 cursor-pointer transition-all
                                                    ${selectedFolders.includes(key)
                                                        ? 'border-blue-500 bg-blue-50/30'
                                                        : 'border-slate-100 hover:border-slate-200 bg-slate-50/50'}`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={selectedFolders.includes(key)}
                                                    onChange={() => toggleFolder(key)}
                                                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300"
                                                />
                                                <div className="flex items-center gap-3">
                                                    <img src={data.targetAsset} alt={data.name} className="w-6 h-6 object-contain" />
                                                    <span className="text-sm font-medium text-slate-700">{data.name}</span>
                                                </div>
                                            </label>
                                        ))}
                                    </div>

                                    {/* ── Upload Zone ────────────────────────────────── */}
                                    <UploadZone
                                        onParsed={(set) => {
                                            console.log('[UploadZone] parsed set:', set);
                                            // In a real integration this would register the
                                            // new set in CHALLENGES and toggle it on.
                                        }}
                                    />
                                </div>

                                {/* ── Layout Algorithm ── */}
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-3">
                                        Layout Algorithm
                                    </label>
                                    <p className="text-xs text-slate-500 mb-4 font-medium">
                                        Determines how items are positioned mathematically.
                                    </p>
                                    <div className="flex flex-col space-y-3">
                                        <label className={`relative flex cursor-pointer rounded-xl border-2 p-4 transition-all ${layoutType === 'grid' ? 'border-blue-500 bg-blue-50/50' : 'border-slate-100 hover:border-slate-200'}`}>
                                            <input type="radio" name="layout" value="grid" className="sr-only" onChange={() => setLayoutType('grid')} checked={layoutType === 'grid'} />
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                                    <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                                                    </svg>
                                                    Strict Grid Matrix
                                                </span>
                                                <span className="text-xs text-slate-500 mt-1 font-medium">
                                                    Locks items into a cleanly divided mathematical grid. Extremely robust.
                                                </span>
                                            </div>
                                        </label>

                                        <label className={`relative flex cursor-pointer rounded-xl border-2 p-4 transition-all ${layoutType === 'dynamic' ? 'border-blue-500 bg-blue-50/50' : 'border-slate-100 hover:border-slate-200'}`}>
                                            <input type="radio" name="layout" value="dynamic" className="sr-only" onChange={() => setLayoutType('dynamic')} checked={layoutType === 'dynamic'} />
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                                    <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" />
                                                    </svg>
                                                    Dynamic 2D Collision
                                                </span>
                                                <span className="text-xs text-slate-500 mt-1 font-medium">
                                                    Sizes and positions items organically. Harder for basic OCR bots.
                                                </span>
                                            </div>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Card 2: Density Parameters */}
                        <div className="bg-white p-8 rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-slate-100">
                            <h2 className="text-xl font-bold mb-6 text-slate-800 flex items-center gap-2">
                                <svg className="w-5 h-5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                                </svg>
                                Density Parameters
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                                {/* Required Targets */}
                                <div>
                                    <div className="flex justify-between mb-2">
                                        <label className="text-sm font-semibold text-slate-700">Required Targets</label>
                                        <span className="text-sm font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-md">{targetCount}</span>
                                    </div>
                                    <p className="text-xs text-slate-500 mb-4 font-medium">The specific amount of correct objects the user must find.</p>
                                    <input type="range" min="6" max="15" value={targetCount}
                                        onChange={(e) => setTargetCount(parseInt(e.target.value))}
                                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-purple-600 outline-none focus:ring-2 focus:ring-purple-200 transition-all"
                                    />
                                    <div className="flex justify-between text-xs text-slate-400 mt-2 font-medium">
                                        <span>Low (6)</span><span>High (15)</span>
                                    </div>
                                </div>

                                {/* Total Asset Volume */}
                                <div>
                                    <div className="flex justify-between mb-2">
                                        <label className="text-sm font-semibold text-slate-700">Total Asset Volume</label>
                                        <span className="text-sm font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">{totalShapes}</span>
                                    </div>
                                    <p className="text-xs text-slate-500 mb-4 font-medium">Grid mode snaps to perfect rectangles automatically.</p>
                                    {layoutType === 'grid' ? (
                                        <input type="range" min="0" max={GRID_OPTIONS.length - 1} value={gridIndex}
                                            onChange={(e) => setGridIndex(parseInt(e.target.value))}
                                            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600 outline-none focus:ring-2 focus:ring-blue-200 transition-all"
                                        />
                                    ) : (
                                        <input type="range" min="20" max="100" value={dynamicShapes}
                                            onChange={(e) => setDynamicShapes(parseInt(e.target.value))}
                                            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600 outline-none focus:ring-2 focus:ring-blue-200 transition-all"
                                        />
                                    )}
                                    <div className="flex justify-between text-xs text-slate-400 mt-2 font-medium">
                                        <span>Sparse</span><span>Dense</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Card 3: Security & Telemetry */}
                        <div className="bg-white p-8 rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-slate-100">
                            <h2 className="text-xl font-bold mb-6 text-slate-800 flex items-center gap-2">
                                <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                                Security & Telemetry
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                                <div>
                                    <div className="flex justify-between mb-2">
                                        <label className="text-sm font-semibold text-slate-700">Maximum Allowed Velocity</label>
                                        <span className="text-sm font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-md">{zkpVelocity}</span>
                                    </div>
                                    <p className="text-xs text-slate-500 mb-4 font-medium">Limits mouse speed to flag robotic API automations.</p>
                                    <input type="range" min="10" max="1000" value={zkpVelocity}
                                        onChange={(e) => setZkpVelocity(parseInt(e.target.value))}
                                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-red-600 outline-none focus:ring-2 focus:ring-red-200 transition-all"
                                    />
                                    <div className="flex justify-between text-xs text-slate-400 mt-2 font-medium">
                                        <span>Slow</span><span>Instant</span>
                                    </div>
                                </div>
                                <div>
                                    <div className="flex justify-between mb-2">
                                        <label className="text-sm font-semibold text-slate-700">Minimum Tremor Score</label>
                                        <span className="text-sm font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-md">{zkpTremor}</span>
                                    </div>
                                    <p className="text-xs text-slate-500 mb-4 font-medium">Enforces human jitter bounds on cursor trajectories.</p>
                                    <input type="range" min="1" max="100" value={zkpTremor}
                                        onChange={(e) => setZkpTremor(parseInt(e.target.value))}
                                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-red-600 outline-none focus:ring-2 focus:ring-red-200 transition-all"
                                    />
                                    <div className="flex justify-between text-xs text-slate-400 mt-2 font-medium">
                                        <span>Smooth</span><span>Jittery</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ── Card 4: Federated CAPTCHAs ───────────────────────────── */}
                        <div className="bg-white p-8 rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-slate-100">
                            <h2 className="text-xl font-bold mb-2 text-slate-800 flex items-center gap-2">
                                <svg className="w-5 h-5 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                                Federated CAPTCHAs
                            </h2>
                            <p className="text-xs text-slate-500 mb-6 font-medium">
                                Auxiliary modules that extend the core challenge with additional anti-bot layers.
                            </p>

                            <div className="space-y-5">

                                {/* ── Risk Engine toggle ─────────────────────────────── */}
                                <div className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all
                                    ${riskEngineActive ? 'border-blue-400 bg-blue-50/40' : 'border-slate-100 bg-slate-50/50'}`}>
                                    <div className="flex-1 pr-4">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <span className="text-sm font-bold text-slate-800">⚡ Risk Engine</span>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition-colors
                                                ${riskEngineActive ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                                                {riskEngineActive ? 'ACTIVE' : 'INACTIVE'}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-500 font-medium">
                                            Scores each request and scales puzzle difficulty dynamically. Toggle to animate the flow diagram.
                                        </p>
                                    </div>
                                    <ToggleSwitch
                                        id="toggle-risk-engine"
                                        checked={riskEngineActive}
                                        onChange={setRiskEngineActive}
                                        colorClass="bg-blue-500"
                                    />
                                </div>

                                {/* ── Audio Challenge (permanently active, locked) ───── */}
                                <div className="flex items-center justify-between p-4 rounded-xl border-2 border-violet-200 bg-violet-50/40">
                                    <div className="flex-1 pr-4">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <span className="text-sm font-bold text-slate-800">🔊 Audio Challenge</span>
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 flex items-center gap-1">
                                                <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                                                </svg>
                                                Permanently Active
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-500 font-medium">
                                            Accessibility fallback — always available. Connected to the{' '}
                                            <span className="font-semibold text-violet-600">AudioChallenge UI</span> component.
                                        </p>
                                    </div>
                                    {/* Locked checkbox */}
                                    <div className="relative flex items-center justify-center w-11 h-6">
                                        <input
                                            type="checkbox"
                                            checked
                                            disabled
                                            readOnly
                                            className="w-4 h-4 text-violet-600 rounded border-violet-300 opacity-70 cursor-not-allowed"
                                        />
                                        <svg className="absolute -top-1 -right-1 w-3.5 h-3.5 text-violet-500" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                </div>

                                {/* ── Agent Trap toggle ─────────────────────────────── */}
                                <div className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all
                                    ${agentTrapActive ? 'border-violet-400 bg-violet-50/40' : 'border-slate-100 bg-slate-50/50'}`}>
                                    <div className="flex-1 pr-4">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <span className="text-sm font-bold text-slate-800">🕸 Agent Trap</span>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition-colors
                                                ${agentTrapActive ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-500'}`}>
                                                {agentTrapActive ? 'ON' : 'OFF'}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-500 font-medium">
                                            Injects honeypot fields invisible to humans. When ON, a dotted{' '}
                                            <span className="font-semibold text-violet-600">Invisible Layer</span> line appears in the flow diagram.
                                        </p>
                                    </div>
                                    <ToggleSwitch
                                        id="toggle-agent-trap"
                                        checked={agentTrapActive}
                                        onChange={setAgentTrapActive}
                                        colorClass="bg-violet-500"
                                    />
                                </div>

                            </div>
                        </div>

                        {/* Card 5: Integration Webhook */}
                        <div className="bg-slate-900 p-8 rounded-2xl shadow-xl shadow-slate-900/10 border border-slate-800 text-white relative">
                            <div className="flex items-start justify-between">
                                <div>
                                    <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
                                        <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                                        </svg>
                                        Integration Webhook
                                    </h2>
                                    <p className="text-sm text-slate-400 max-w-lg mb-6 leading-relaxed">
                                        Persist this configuration to your PostgreSQL instances and generate the static drop-in HTML widget payload containing your site's secure cryptographic UUID.
                                    </p>
                                </div>
                                <button
                                    id="btn-generate-service"
                                    onClick={handleGenerate}
                                    className="bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold py-3 px-8 rounded-xl shadow-lg shadow-blue-500/30 transition-all flex items-center gap-2"
                                >
                                    Generate Service
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                </button>
                            </div>

                            {generatedScript && (
                                <div className="mt-6 border-t border-slate-700 pt-6">
                                    <p className="text-xs text-slate-400 mb-2 font-mono uppercase tracking-wider">
                                        Simulated Config Storage Payload:
                                    </p>
                                    <div className="p-4 bg-black/50 border border-slate-800 rounded-xl overflow-x-auto relative mb-5">
                                        <pre className="text-xs text-blue-300 whitespace-pre-wrap font-mono">{generatedJson}</pre>
                                    </div>
                                    <p className="text-xs text-slate-400 mb-2 font-mono uppercase tracking-wider">
                                        Integration Script Embedded Snippet:
                                    </p>
                                    <div className="p-4 bg-black/50 border border-slate-800 rounded-xl overflow-x-auto relative group">
                                        <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <span className="text-xs font-bold text-slate-500 bg-slate-800 px-2 py-1 rounded">COPIED</span>
                                        </div>
                                        <code className="text-sm text-green-400 whitespace-nowrap font-mono selection:bg-green-900">
                                            {generatedScript}
                                        </code>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ══ Right Column (1/3): Live Preview + Flow Diagram ════════ */}
                    <div className="lg:col-span-1">
                        <div className="sticky top-8 flex flex-col items-center gap-6 w-full">

                            {/* ── Client Simulation Preview ─────────────────────── */}
                            <div className="w-full">
                                <div className="w-full flex justify-between items-end mb-4 px-2">
                                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Client Simulation</h3>
                                    <div className="flex gap-1.5">
                                        <div className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                                        <div className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                                        <div className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                                    </div>
                                </div>

                                {selectedFolders.length === 0 ? (
                                    <div className="w-full h-[320px] bg-slate-100 rounded-2xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center p-8 text-center text-slate-500 shadow-sm">
                                        <svg className="w-12 h-12 mb-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                        <p className="font-semibold text-sm">No assets selected</p>
                                        <p className="text-xs mt-1">Select at least one challenge set.</p>
                                    </div>
                                ) : (
                                    <div className="bg-white rounded-2xl shadow-2xl shadow-slate-200/50 relative overflow-hidden flex flex-col border border-slate-200 w-full">
                                        {/* Widget header */}
                                        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-white shadow-sm">
                                            <span className="font-bold text-slate-800 text-sm tracking-tight">OsepTCHA Security</span>
                                            <span className="w-5 h-5 bg-green-100 text-green-600 rounded-full flex items-center justify-center border border-green-200 shadow-sm">
                                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                </svg>
                                            </span>
                                        </div>

                                        <div className="bg-slate-50 p-3 text-center text-sm font-semibold text-slate-700 border-b border-slate-100 flex gap-2 items-center justify-center">
                                            Count the number of
                                            {activeSet && (
                                                <span className="text-lg bg-white px-2 py-0.5 rounded shadow-sm border border-slate-200">
                                                    {activeSet.targetLabel}
                                                </span>
                                            )}
                                        </div>

                                        {/* Canvas — 1:1 square matching the 400×400 coordinate space */}
                                        {/*
                                          The layout engine always produces x/y in [0, 400].
                                          paddingBottom:100% makes the div a perfect square at
                                          any column width, so no items ever overflow or clip.
                                          Items are positioned as a fraction of that coordinate
                                          space (item.x/400 × 100%), keeping pixel widths/heights
                                          as-is since the column is wide enough to fit them.
                                        */}
                                        <div
                                            className="relative bg-white pointer-events-none border-b border-slate-100 overflow-hidden"
                                            style={{ width: '100%', paddingBottom: '100%' }}
                                        >
                                            <div className="absolute inset-0">
                                                {previewLayouts.map((item, i) => (
                                                    <img
                                                        key={i}
                                                        src={item.url}
                                                        alt="asset"
                                                        className="absolute select-none drop-shadow-sm"
                                                        style={{
                                                            left: `${(item.x / 400) * 100}%`,
                                                            top: `${(item.y / 400) * 100}%`,
                                                            width: item.width,
                                                            height: item.height,
                                                            objectFit: 'contain'
                                                        }}
                                                    />
                                                ))}
                                            </div>
                                        </div>

                                        {/* Mock slider footer */}
                                        <div className="p-4 bg-slate-50 flex flex-col gap-3">
                                            <div className="flex items-center gap-3">
                                                <span className="text-slate-400 font-medium text-sm">0</span>
                                                <div className="flex-1 h-2 relative bg-slate-200 rounded-full overflow-hidden">
                                                    <div className="absolute left-0 top-0 h-full w-1/3 bg-blue-500 rounded-full" />
                                                </div>
                                                <span className="text-slate-400 font-medium text-sm">20</span>
                                            </div>
                                            <button className="w-full bg-slate-800 hover:bg-slate-700 text-white font-semibold py-2 rounded-lg text-sm transition-colors cursor-default">
                                                Verify Context
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* ── Live Architecture Flow Diagram ────────────────── */}
                            <div className="w-full bg-white rounded-2xl border border-slate-100 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.08)] p-5">
                                <div className="flex items-center gap-2 mb-4">
                                    <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                            d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest">
                                        Architecture Flow
                                    </h3>
                                </div>

                                <LiveFlowDiagram
                                    riskEngineActive={riskEngineActive}
                                    agentTrapActive={agentTrapActive}
                                />

                                <p className="text-[11px] text-slate-400 mt-3 text-center font-medium">
                                    Toggle <span className="font-semibold text-blue-500">Risk Engine</span> or{' '}
                                    <span className="font-semibold text-violet-500">Agent Trap</span> above to animate the diagram.
                                </p>
                            </div>

                            {/* ── Verification Event Log ────────────────────── */}
                            <VerificationLogPanel
                                backendUrl="http://localhost:3001"
                                activeSiteKey={activeSiteKey}
                            />

                            <p className="text-xs text-slate-400 font-medium max-w-[300px] text-center">
                                This preview maps the exact bounding coordinates calculated by your Postgres Backend Engine using live mathematical layout simulation.
                            </p>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
