"use client";

import * as React from "react";
import { Check, Copy, Terminal, Download, ArrowRight, Laptop, Shield, Zap, Sparkles, Command } from "lucide-react";
import Link from "next/link";

interface VersionData {
  version: string;
  codename: string;
  releaseDate: string;
  tag: string;
  channel: string;
  summary: string;
  highlights: Array<{
    type: "feature" | "perf" | "security";
    title: string;
    description: string;
  }>;
  binaries: Array<{
    label: string;
    arch: string;
    format: string;
    size: string;
    available: boolean;
  }>;
}

const VERSIONS: VersionData[] = [
  {
    version: "0.9.4",
    codename: "OLED Neon Workstation",
    releaseDate: "October 2026",
    tag: "v0.9.4-win",
    channel: "Private Alpha",
    summary:
      "Global shortcut summon palette, hardware-accelerated DirectComposition graph, and DPAPI credential protection.",
    highlights: [
      {
        type: "feature",
        title: "Global Quick-Summon Palette",
        description: "Press Ctrl + Shift + Space anywhere in Windows to capture context or recall decisions without tab-switching.",
      },
      {
        type: "perf",
        title: "DirectComposition 120Hz Canvas",
        description: "Native GPU rendering for company relationship graphs with zero frame drops during deep entity browsing.",
      },
      {
        type: "security",
        title: "DPAPI Encrypted Local Cache",
        description: "Local SQLite memory encrypted using Windows DPAPI, bound strictly to the current Windows user login.",
      },
    ],
    binaries: [
      { label: "Windows x64 Installer", arch: "x64", format: ".msi", size: "64.2 MB", available: true },
      { label: "Windows ARM64 (Surface / Snapdragon)", arch: "arm64", format: ".msi", size: "58.7 MB", available: true },
      { label: "Portable Archive", arch: "x64", format: ".zip", size: "61.0 MB", available: true },
    ],
  },
  {
    version: "0.9.3",
    codename: "Monotonic Journal",
    releaseDate: "September 2026",
    tag: "v0.9.3-win",
    channel: "Alpha 3",
    summary:
      "Embedded local SQLite replication engine with monotonic revision numbering and automatic offline recovery.",
    highlights: [
      {
        type: "feature",
        title: "Monotonic OCC Offline Engine",
        description: "Write wikis and specs on trains or offline flights; edits sync conflict-free upon re-connection.",
      },
      {
        type: "perf",
        title: "Zero-Latency Local Reads",
        description: "Instantaneous sub-millisecond document search powered by local vector-ready SQLite indices.",
      },
      {
        type: "security",
        title: "Isolated Tenant Sandboxing",
        description: "Rigid multi-tenant file partitioning preventing cross-organization cache pollution on shared workstations.",
      },
    ],
    binaries: [
      { label: "Windows x64 Installer", arch: "x64", format: ".msi", size: "63.8 MB", available: false },
      { label: "Windows ARM64", arch: "arm64", format: ".msi", size: "58.1 MB", available: false },
    ],
  },
  {
    version: "0.9.0",
    codename: "Genesis Kernel",
    releaseDate: "August 2026",
    tag: "v0.9.0-win",
    channel: "Foundational Alpha",
    summary:
      "First native Windows runtime with system tray background telemetry and Supabase realtime bidirectional sync.",
    highlights: [
      {
        type: "feature",
        title: "System Tray Telemetry Daemon",
        description: "Runs unobtrusively in the Windows taskbar with instant unread updates and sync notifications.",
      },
      {
        type: "perf",
        title: "Memory Footprint Under 90MB",
        description: "Carefully engineered memory budget utilizing native Windows Webview2 and lightweight Rust daemon.",
      },
      {
        type: "feature",
        title: "Markdown & Block Editor Core",
        description: "Full parity with web workstation blocks, decisions, and GitHub snippet references.",
      },
    ],
    binaries: [
      { label: "Windows x64 Installer", arch: "x64", format: ".msi", size: "61.4 MB", available: false },
    ],
  },
];

export function WindowsVersionSelector() {
  const [selectedVersion, setSelectedVersion] = React.useState<string>("0.9.4");
  const [copiedWinget, setCopiedWinget] = React.useState(false);

  const active = VERSIONS.find((v) => v.version === selectedVersion) || VERSIONS[0];

  const handleCopyWinget = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText("winget install BusinessBrain.Desktop");
      setCopiedWinget(true);
      setTimeout(() => setCopiedWinget(false), 2000);
    }
  };

  return (
    <div className="w-full">
      {/* Dynamic Version Selector Bar (Linear / Raycast Style Tabs) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#E5E5E0] dark:border-[#1E1E22]">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0">
          <span className="text-xs font-mono uppercase tracking-wider text-[#71717A] mr-2">Release:</span>
          {VERSIONS.map((item) => {
            const isSelected = item.version === selectedVersion;
            return (
              <button
                key={item.version}
                type="button"
                onClick={() => setSelectedVersion(item.version)}
                className={`flex items-center gap-2 rounded-lg px-3 py-1.5 font-mono text-xs font-medium transition-all ${
                  isSelected
                    ? "bg-[#18181B] dark:bg-[#F4F4F5] text-[#FAF9F5] dark:text-[#18181B] shadow-2xs font-semibold"
                    : "text-[#52525B] dark:text-[#A1A1AA] hover:text-[#18181B] dark:hover:text-[#F4F4F5] hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                }`}
              >
                <span>v{item.version}</span>
                {isSelected && (
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                )}
              </button>
            );
          })}
        </div>

        {/* 1-Click Terminal / Winget Command */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-[#E5E5E0] dark:border-[#1E1E22] bg-[#F4F3EE] dark:bg-[#121215] px-3 py-1.5 font-mono text-xs text-[#18181B] dark:text-[#F4F4F5]">
            <Terminal className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
            <span className="select-all">winget install BusinessBrain.Desktop</span>
            <button
              type="button"
              onClick={handleCopyWinget}
              title="Copy winget command"
              className="ml-1 p-1 text-[#71717A] hover:text-[#18181B] dark:hover:text-white transition-colors"
            >
              {copiedWinget ? (
                <Check className="h-3.5 w-3.5 text-emerald-500" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Dynamic Release Details View */}
      <div className="pt-8">
        {/* Version Header Specs */}
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-3 mb-6">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-semibold tracking-tight text-[#18181B] dark:text-[#F4F4F5]">
                v{active.version} &mdash; {active.codename}
              </h2>
              <span className="font-mono text-xs text-blue-600 dark:text-blue-400">
                {active.channel}
              </span>
            </div>
            <p className="mt-1 text-sm text-[#52525B] dark:text-[#A1A1AA] max-w-2xl">
              {active.summary}
            </p>
          </div>
          <span className="font-mono text-xs text-[#71717A] shrink-0">
            Released {active.releaseDate}
          </span>
        </div>

        {/* Feature Highlights Grid - Clean Typographic Rows, NOT generic cards */}
        <div className="divide-y divide-[#E5E5E0] dark:divide-[#1E1E22] border-y border-[#E5E5E0] dark:border-[#1E1E22]">
          {active.highlights.map((h, idx) => (
            <div key={idx} className="py-4.5 flex flex-col md:flex-row md:items-baseline justify-between gap-2 md:gap-8 group">
              <div className="flex items-center gap-2.5 md:w-1/3 shrink-0">
                <span
                  className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                    h.type === "feature"
                      ? "bg-blue-500"
                      : h.type === "perf"
                      ? "bg-emerald-500"
                      : "bg-purple-500"
                  }`}
                />
                <span className="text-sm font-semibold text-[#18181B] dark:text-[#F4F4F5]">
                  {h.title}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-[#52525B] dark:text-[#A1A1AA] md:w-2/3 leading-relaxed">
                {h.description}
              </p>
            </div>
          ))}
        </div>

        {/* Download & Binary Options Matrix */}
        <div className="mt-8 pt-4">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-mono uppercase tracking-wider text-[#71717A]">
              Architecture Packages &amp; Builds:
            </span>
            <span className="text-xs text-[#71717A]">
              SHA-256 Authenticated
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {active.binaries.map((bin, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3.5 rounded-xl border border-[#E5E5E0] dark:border-[#1E1E22] bg-[#FAF9F5] dark:bg-[#121215] text-xs transition-colors hover:border-[#D4D4D8] dark:hover:border-[#27272A]"
              >
                <div>
                  <div className="font-semibold text-[#18181B] dark:text-[#F4F4F5]">
                    {bin.label}
                  </div>
                  <div className="font-mono text-[11px] text-[#71717A] mt-0.5">
                    {bin.format} &bull; {bin.size}
                  </div>
                </div>

                {bin.available ? (
                  <Link
                    href="/signup"
                    className="inline-flex items-center gap-1 font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    <span>Download</span>
                    <Download className="h-3.5 w-3.5" />
                  </Link>
                ) : (
                  <span className="font-mono text-[11px] text-[#71717A]">
                    Archived
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
