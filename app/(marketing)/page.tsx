import Link from "next/link";
import { Sparkles, ArrowRight, Brain, GitBranch, FolderKanban, Users, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      {/* Navigation Header */}
      <header className="flex h-16 w-full items-center justify-between border-b border-slate-800/80 px-6 sm:px-12 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white shadow-lg shadow-blue-500/20">
            <Sparkles className="h-4 w-4" />
          </div>
          <span className="text-base font-bold tracking-tight text-white">
            Company Brain
          </span>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/pricing">
            <Button variant="ghost" size="sm">
              Pricing
            </Button>
          </Link>
          <Link href="/login">
            <Button variant="ghost" size="sm">
              Sign In
            </Button>
          </Link>
          <Link href="/signup">
            <Button variant="primary" size="sm">
              Start Free Trial
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center sm:px-12">
        <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-400">
          <Sparkles className="h-3.5 w-3.5" />
          <span>7-Day Full Access Free Trial on All Plans</span>
        </div>

        <h1 className="mt-6 max-w-4xl text-4xl font-extrabold tracking-tight text-white sm:text-6xl sm:leading-[1.15]">
          Your company&apos;s memory and intelligence layer.
        </h1>

        <p className="mt-6 max-w-2xl text-base leading-relaxed text-slate-400 sm:text-lg">
          Company Brain unifies institutional knowledge, strategic decisions, projects,
          tasks, meetings, and business context into a single, cohesive operating system.
        </p>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Link href="/signup">
            <Button size="lg" className="w-full gap-2 sm:w-auto">
              <span>Start 7-Day Free Trial</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/pricing">
            <Button variant="outline" size="lg" className="w-full sm:w-auto">
              View Plans & Pricing
            </Button>
          </Link>
        </div>

        {/* Feature Grid */}
        <div className="mt-20 grid w-full max-w-5xl grid-cols-1 gap-6 text-left sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 backdrop-blur-sm">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
              <Brain className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-sm font-semibold text-slate-200">Unified Knowledge</h3>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
              Centralize wikis, documents, and historical memory in one searchable repository.
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 backdrop-blur-sm">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
              <GitBranch className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-sm font-semibold text-slate-200">Decision Registry</h3>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
              Record key business and technical decisions with context, rationale, and impact.
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 backdrop-blur-sm">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
              <FolderKanban className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-sm font-semibold text-slate-200">Projects & Tasks</h3>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
              Connect day-to-day execution directly to strategic company goals and decisions.
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 backdrop-blur-sm">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-sm font-semibold text-slate-200">Multi-Tenant Isolation</h3>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
              Enterprise PostgreSQL RLS guarantees your company data is strictly private.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 px-6 py-8 text-center text-xs text-slate-500">
        Company Brain &copy; {new Date().getFullYear()}. Foundation Phase Active.
      </footer>
    </div>
  );
}
