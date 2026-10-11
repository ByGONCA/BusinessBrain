import { notFound } from "next/navigation";
import { verifyAccessOrRedirect } from "@/lib/organizations/entitlements";
import { IconReviewGallery } from "./icon-review-gallery";

export default async function DevIconsReviewPage() {
  // Strictly restricted to development environment
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  // Enforce authenticated active workspace session
  await verifyAccessOrRedirect();

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col gap-1.5 border-b border-border pb-6">
        <div className="flex items-center gap-2.5">
          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20">
            DEV ONLY
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            BusinessBrain Icon System & Asset Audit
          </h1>
        </div>
        <p className="text-xs text-muted-foreground max-w-3xl leading-relaxed">
          Centralized inventory of Phosphor SVG assets located in <code className="text-blue-400 font-mono">public/Icons/</code>,
          official brand marks in <code className="text-blue-400 font-mono">public/Logos/</code>, and side-by-side
          feature mapping across the BusinessBrain application.
        </p>
      </div>

      <IconReviewGallery />
    </div>
  );
}
