import { Metadata } from "next";
import Link from "next/link";
import { RealDashboardShowcase } from "@/components/landing/real-dashboard-showcase";
import { ArrowLeft, ArrowRight, Sparkles, ShieldCheck } from "lucide-react";
import { ThemeToggle } from "@/components/theme/theme-selector";

export const metadata: Metadata = {
  title: "Interactive Product Demonstration — BusinessBrain",
  description:
    "Experience the actual BusinessBrain application UI directly in your browser. Live force-directed company graph, block editor, and real-time financial telemetry in safe demo mode.",
};

export default function DemoPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#0A0A0B] text-zinc-100 antialiased font-sans">
      {/* Top Standalone Bar */}
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-zinc-800/80 bg-zinc-950/90 px-4 sm:px-6 py-2.5 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Return to Site</span>
          </Link>
          <span className="text-zinc-700">|</span>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold tracking-tight text-white">BusinessBrain Workstation</span>
            <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400 border border-emerald-500/20">
              Interactive Demo
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle />

          <Link
            href="/signup"
            className="flex items-center gap-1.5 rounded-lg bg-white px-3.5 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-zinc-200 transition-colors shadow-2xs"
          >
            <span>Start 3-Day Free Trial</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </header>

      {/* Main Full-Screen Application UI */}
      <main className="flex-1 w-full">
        <RealDashboardShowcase standalone />
      </main>
    </div>
  );
}
