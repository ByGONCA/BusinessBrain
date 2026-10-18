import Link from "next/link";
import { cookies } from "next/headers";
import { Particle404Canvas } from "@/components/ui/particle-404-canvas";

export default async function NotFound() {
  // Determine canonical home route based on user session cookies (safe with static generation)
  let homeHref = "/";
  try {
    const cookieStore = await cookies();
    const hasAuthCookie = cookieStore
      .getAll()
      .some((c) => c.name.startsWith("sb-"));
    if (hasAuthCookie) {
      homeHref = "/dashboard";
    }
  } catch {
    homeHref = "/";
  }

  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-[#080607] bg-[radial-gradient(ellipse_80%_80%_at_60%_35%,rgba(90,14,20,0.22)_0%,rgba(8,6,7,0.96)_72%,#080607_100%)] text-foreground font-sans select-none selection:bg-[#ef4444]/25">
      {/* Interactive 404 Particle Constellation Canvas */}
      <Particle404Canvas />

      {/* Responsive Content Overlay */}
      <div className="relative z-10 flex min-h-screen w-full flex-col justify-between p-6 sm:p-12 md:p-16 lg:p-20 pointer-events-none">
        {/* MOBILE VIEW (Top Aligned, per reference screenshot) */}
        <div className="flex sm:hidden flex-col items-start pt-6 pointer-events-auto max-w-md animate-in fade-in duration-300">
          <span className="text-lg font-medium tracking-tight text-[#ef4444]">
            Page not found
          </span>
          <h1 className="mt-2 text-3xl font-normal tracking-tight text-white leading-tight">
            The page you were looking for does not exist or has moved.
          </h1>
          <Link
            href={homeHref}
            className="mt-6 inline-flex items-center justify-center rounded-full bg-[#161112]/90 hover:bg-[#221618] active:scale-[0.98] text-[#f0ebea] hover:text-white px-5 py-2.5 text-xs font-medium border border-[#3c1c21]/80 hover:border-[#58222b] transition-all duration-200 backdrop-blur-md shadow-lg hover:shadow-red-950/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ef4444]"
          >
            Back to home
          </Link>
        </div>

        {/* Placeholder spacer for desktop flex layout */}
        <div className="hidden sm:block" aria-hidden="true" />

        {/* DESKTOP VIEW (Lower-Left Aligned, per reference screenshot) */}
        <div className="hidden sm:flex flex-col items-start mt-auto pointer-events-auto max-w-xl lg:max-w-2xl animate-in fade-in duration-300">
          <span className="text-xl md:text-2xl font-medium tracking-tight text-[#ef4444]">
            Page not found
          </span>
          <h1 className="mt-2.5 text-3xl sm:text-4xl md:text-5xl font-normal tracking-tight text-white leading-[1.15]">
            The page you were looking for does not exist or has moved.
          </h1>
          <Link
            href={homeHref}
            className="mt-7 inline-flex items-center justify-center rounded-full bg-[#161112]/90 hover:bg-[#221618] active:scale-[0.98] text-[#f0ebea] hover:text-white px-6 py-2.5 text-sm font-medium border border-[#3c1c21]/80 hover:border-[#58222b] transition-all duration-200 backdrop-blur-md shadow-lg hover:shadow-red-950/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ef4444]"
          >
            Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}
