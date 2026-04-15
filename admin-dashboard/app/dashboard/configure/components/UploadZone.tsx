"use client";

import React, { useState, useCallback } from "react";

interface ParsedSet {
  name: string;
  targetFile: string;
  fillerFiles: string[];
}

interface UploadZoneProps {
  onParsed?: (set: ParsedSet) => void;
}

export function UploadZone({ onParsed }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState<"idle" | "parsing" | "done" | "error">("idle");
  const [parsedSet, setParsedSet] = useState<ParsedSet | null>(null);

  const simulate = useCallback((folderName: string) => {
    setStatus("parsing");
    setTimeout(() => {
      // Mock: pretend the folder contains challenge-3, a target image, and background shapes
      const mock: ParsedSet = {
        name: folderName || "custom-upload-1",
        targetFile: "target.png",
        fillerFiles: ["shape-1.png", "shape-2.png", "shape-3.png"],
      };
      setParsedSet(mock);
      setStatus("done");
      onParsed?.(mock);
    }, 1200);
  }, [onParsed]);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const item = e.dataTransfer.items?.[0];
      const folderName = item?.getAsFile()?.name ?? "uploaded-set";
      simulate(folderName);
    },
    [simulate]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;
      // Derive folder name from the first file's webkitRelativePath
      const firstPath = (files[0] as any).webkitRelativePath as string;
      const folderName = firstPath?.split("/")?.[0] ?? files[0].name;
      simulate(folderName);
    },
    [simulate]
  );

  return (
    <div className="mt-6">
      <label className="block text-sm font-semibold text-slate-700 mb-1">
        Upload Asset Folder
      </label>
      <p className="text-xs text-slate-500 mb-3 font-medium leading-relaxed">
        Folder should contain a{" "}
        <span className="font-semibold text-slate-600">challenge number</span>,{" "}
        <span className="font-semibold text-slate-600">image of the target</span>, and{" "}
        <span className="font-semibold text-slate-600">background shapes</span>.
      </p>

      {/* Drop Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer
          ${isDragging
            ? "border-blue-400 bg-blue-50/60 scale-[1.01]"
            : "border-slate-200 bg-slate-50/60 hover:border-blue-300 hover:bg-blue-50/30"
          }`}
      >
        {/* Hidden native folder input */}
        <input
          id="upload-folder-input"
          type="file"
          /* @ts-ignore – non-standard but widely supported */
          webkitdirectory=""
          multiple
          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
          onChange={handleChange}
        />

        {status === "idle" && (
          <>
            <div className="flex justify-center mb-3">
              <svg className="w-10 h-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-slate-500">Drop folder here or click to browse</p>
            <p className="text-xs text-slate-400 mt-1">Accepted: PNG, JPG, SVG</p>
          </>
        )}

        {status === "parsing" && (
          <div className="flex flex-col items-center gap-3 py-2">
            <svg className="animate-spin w-6 h-6 text-blue-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 100 16v-4l-3 3 3 3v-4a8 8 0 01-8-8z" />
            </svg>
            <p className="text-sm text-blue-600 font-semibold">Parsing assets…</p>
          </div>
        )}

        {status === "done" && parsedSet && (
          <div className="text-left space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-5 h-5 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </span>
              <span className="text-sm font-bold text-slate-700">{parsedSet.name}</span>
            </div>
            <div className="bg-white rounded-lg border border-slate-200 p-3 space-y-1.5 text-xs font-mono text-slate-600">
              <div className="flex items-center gap-2">
                <span className="text-green-500">🎯</span>
                <span className="font-semibold text-slate-700">Target:</span> {parsedSet.targetFile}
              </div>
              {parsedSet.fillerFiles.map((f, i) => (
                <div key={i} className="flex items-center gap-2 text-slate-500">
                  <span>⬜</span>
                  <span className="font-semibold text-slate-600">Shape {i + 1}:</span> {f}
                </div>
              ))}
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); setStatus("idle"); setParsedSet(null); }}
              className="text-xs text-slate-400 hover:text-red-500 transition-colors mt-1"
            >
              Remove
            </button>
          </div>
        )}

        {status === "error" && (
          <p className="text-sm text-red-500 font-medium">Failed to parse folder. Please try again.</p>
        )}
      </div>
    </div>
  );
}
