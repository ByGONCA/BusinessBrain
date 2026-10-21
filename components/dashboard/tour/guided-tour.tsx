"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  X,
  Check,
  Building2,
  Search,
  BookOpen,
  Plus,
  Network,
  CreditCard,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { saveTourStepAction, completeTourAction } from "@/lib/onboarding/actions";
import { useSidebar } from "@/components/dashboard/sidebar-context";

export interface TourStep {
  id: string;
  selector: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  preferredPlacement?: "right" | "bottom" | "top" | "left";
}

const TOUR_STEPS: TourStep[] = [
  {
    id: "org-switcher",
    selector: '[data-tour="org-switcher"]',
    title: "Your Company Workspace",
    description:
      "All your company's knowledge, decisions, and teams live here, secured with PostgreSQL Row Level Security.",
    icon: Building2,
    preferredPlacement: "right",
  },
  {
    id: "search-bar",
    selector: '[data-tour="search-bar"]',
    title: "Global Search & Quick Find",
    description:
      "Press Ctrl+K (or Cmd+K) anytime to instantly find any doc, decision, person, or project across your company.",
    icon: Search,
    preferredPlacement: "right",
  },
  {
    id: "knowledge-tree",
    selector: '[data-tour="knowledge-tree"]',
    title: "Company Knowledge Tree",
    description:
      "Organize engineering wikis, product specs, and company SOPs into flexible, nested hierarchies.",
    icon: BookOpen,
    preferredPlacement: "right",
  },
  {
    id: "new-page-btn",
    selector: '[data-tour="new-page-btn"]',
    title: "Create Knowledge & Decisions",
    description:
      "Click here to instantly draft a new document, write an ADR, or record an important business decision.",
    icon: Plus,
    preferredPlacement: "right",
  },
  {
    id: "company-map",
    selector: '[data-tour="company-map"]',
    title: "Company Map & Connections",
    description:
      "Explore how decisions connect to projects, team members, and documentation in a real-time living graph.",
    icon: Network,
    preferredPlacement: "right",
  },
  {
    id: "settings-billing",
    selector: '[data-tour="settings-billing"]',
    title: "Settings & Free Trial",
    description:
      "Manage integrations, customize company branding, invite colleagues, and view your 7-day trial status.",
    icon: CreditCard,
    preferredPlacement: "right",
  },
  {
    id: "help-menu",
    selector: '[data-tour="help-menu"]',
    title: "Help Center & Tour Restart",
    description:
      "Need guidance later? Revisit keyboard shortcuts or restart this interactive tutorial anytime right here.",
    icon: HelpCircle,
    preferredPlacement: "top",
  },
];

interface GuidedTourProps {
  initialTourCompleted: boolean;
  initialTourStep?: number;
}

export function GuidedTour({
  initialTourCompleted,
  initialTourStep = 0,
}: GuidedTourProps) {
  const { isCompact, toggleSidebar, isGroupExpanded, toggleGroup } = useSidebar();
  const [mounted, setMounted] = React.useState(false);
  const [isActive, setIsActive] = React.useState(!initialTourCompleted);
  const [currentStepIndex, setCurrentStepIndex] = React.useState(
    Math.min(Math.max(initialTourStep, 0), TOUR_STEPS.length - 1)
  );
  const [targetRect, setTargetRect] = React.useState<DOMRect | null>(null);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Listen to custom event for manual tour restart from help menu
  React.useEffect(() => {
    const handleRestart = () => {
      setCurrentStepIndex(0);
      setIsActive(true);
    };
    window.addEventListener("businessbrain:restart-tour", handleRestart);
    return () => window.removeEventListener("businessbrain:restart-tour", handleRestart);
  }, []);

  // If sidebar is compact, expand it so sidebar targets are visible
  React.useEffect(() => {
    if (isActive && isCompact) {
      toggleSidebar();
    }
  }, [isActive, isCompact, toggleSidebar]);

  // Automatically expand sidebar sections (Pages, Brain) if collapsed when a tour step targets them
  React.useEffect(() => {
    if (!isActive) return;
    const step = TOUR_STEPS[currentStepIndex];
    if (!step) return;

    if (step.id === "knowledge-tree" || step.id === "new-page-btn") {
      if (!isGroupExpanded("pages")) {
        toggleGroup("pages");
      }
    } else if (step.id === "company-map") {
      if (!isGroupExpanded("brain")) {
        toggleGroup("brain");
      }
    }
  }, [isActive, currentStepIndex, isGroupExpanded, toggleGroup]);

  // Recalculate target element position
  const updateTargetRect = React.useCallback(() => {
    if (!isActive) return;
    const step = TOUR_STEPS[currentStepIndex];
    if (!step) return;

    const el = document.querySelector(step.selector);
    if (el) {
      const rect = el.getBoundingClientRect();
      setTargetRect(rect);
      // Ensure element is in view
      el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
    } else {
      // If element not in DOM, fall back to center of screen
      setTargetRect(null);
    }
  }, [isActive, currentStepIndex]);

  // Watch for step changes, window resize, and scroll
  React.useEffect(() => {
    updateTargetRect();
    const handleResize = () => updateTargetRect();
    const handleScroll = () => updateTargetRect();

    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleScroll, true);

    const timer = setTimeout(updateTargetRect, 150);
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleScroll, true);
      clearTimeout(timer);
    };
  }, [updateTargetRect, currentStepIndex]);

  // Keyboard navigation
  React.useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Do not intercept keyboard shortcuts if the user is typing in a form field
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          (activeEl as HTMLElement).isContentEditable)
      ) {
        return;
      }

      if (e.key === "Escape") {
        handleDismiss();
      } else if (e.key === "ArrowRight" || e.key === "Enter") {
        handleNext();
      } else if (e.key === "ArrowLeft") {
        handlePrev();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isActive, currentStepIndex]);

  const handleNext = async () => {
    if (currentStepIndex < TOUR_STEPS.length - 1) {
      const nextIndex = currentStepIndex + 1;
      setCurrentStepIndex(nextIndex);
      saveTourStepAction(nextIndex);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      const prevIndex = currentStepIndex - 1;
      setCurrentStepIndex(prevIndex);
      saveTourStepAction(prevIndex);
    }
  };

  const handleDismiss = async () => {
    setIsActive(false);
    await completeTourAction();
  };

  const handleComplete = async () => {
    setIsActive(false);
    await completeTourAction();
  };

  if (!mounted || !isActive) return null;

  const currentStep = TOUR_STEPS[currentStepIndex];
  const Icon = currentStep.icon;
  const isLast = currentStepIndex === TOUR_STEPS.length - 1;

  // Calculate card position
  let cardStyle: React.CSSProperties = {
    position: "fixed",
    zIndex: 10001,
  };

  const vw = typeof window !== "undefined" ? window.innerWidth : 1024;
  const vh = typeof window !== "undefined" ? window.innerHeight : 768;

  if (vw < 640) {
    // Mobile mode: Anchor card nicely to the bottom of the viewport so it never clips
    cardStyle = {
      ...cardStyle,
      left: "16px",
      right: "16px",
      bottom: "16px",
      top: "auto",
      width: "auto",
      maxWidth: "calc(100vw - 32px)",
    };
  } else if (targetRect) {
    const pad = 8;
    const cardWidth = 340;
    const cardHeight = 220;

    // Prefer right positioning for sidebar items
    let left = targetRect.right + pad + 12;
    let top = targetRect.top;

    // If card overflows viewport horizontally, place on left or below
    if (left + cardWidth > vw - 16) {
      left = Math.max(16, targetRect.left - cardWidth - pad - 12);
    }
    // If overflows vertically
    if (top + cardHeight > vh - 16) {
      top = Math.max(16, vh - cardHeight - 16);
    }

    cardStyle = {
      ...cardStyle,
      left: `${left}px`,
      top: `${top}px`,
      width: `${cardWidth}px`,
    };
  } else {
    // Center card if target rect not found
    cardStyle = {
      ...cardStyle,
      left: "50%",
      top: "50%",
      transform: "translate(-50%, -50%)",
      width: "360px",
    };
  }

  const portalContent = (
    <div className="fixed inset-0 z-[10000] select-none pointer-events-auto">
      {/* Target Cutout Spotlight */}
      {targetRect && (
        <div
          className="fixed rounded-xl ring-2 ring-blue-500 shadow-[0_0_0_9999px_rgba(0,0,0,0.72)] transition-all duration-300 pointer-events-none"
          style={{
            left: `${targetRect.left - 4}px`,
            top: `${targetRect.top - 4}px`,
            width: `${targetRect.width + 8}px`,
            height: `${targetRect.height + 8}px`,
            zIndex: 10000,
          }}
        />
      )}

      {/* Backdrop click barrier */}
      <div
        className="fixed inset-0 bg-transparent"
        onClick={handleDismiss}
        aria-hidden="true"
      />

      {/* Floating Tour Popover */}
      <div
        style={cardStyle}
        className="rounded-2xl border border-[#2E2E34] bg-[#141416]/95 p-5 text-[#F5F5F5] shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#242428]">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/15 text-blue-400 border border-blue-500/25">
              <Icon className="h-4 w-4" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-[#F5F5F5]">
                {currentStep.title}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDismiss}
            className="flex h-6 w-6 items-center justify-center rounded-md text-[#71717A] hover:bg-[#1E1E22] hover:text-[#FAFAFA] transition-colors"
            title="Skip tour (Esc)"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Body Description */}
        <p className="mt-3 text-xs text-[#A1A1AA] leading-relaxed">
          {currentStep.description}
        </p>

        {/* Footer with Step Dots & Controls */}
        <div className="mt-5 flex items-center justify-between pt-3 border-t border-[#242428]">
          {/* Progress dots */}
          <div className="flex items-center gap-1">
            {TOUR_STEPS.map((_, idx) => (
              <span
                key={idx}
                className={`h-1.5 rounded-full transition-all duration-200 ${
                  idx === currentStepIndex
                    ? "w-4 bg-blue-500 shadow-xs shadow-blue-500/50"
                    : idx < currentStepIndex
                    ? "w-1.5 bg-blue-500/50"
                    : "w-1.5 bg-[#2E2E34]"
                }`}
              />
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {currentStepIndex > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handlePrev}
                className="h-7 px-2 text-xs text-[#A1A1AA] hover:text-[#F5F5F5]"
              >
                <ArrowLeft className="h-3 w-3 mr-1" />
                <span>Prev</span>
              </Button>
            )}

            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleNext}
              className="h-7 px-3 text-xs gap-1.5 font-medium"
            >
              <span>{isLast ? "Finish" : "Next"}</span>
              {isLast ? <Check className="h-3 w-3" /> : <ArrowRight className="h-3 w-3" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(portalContent, document.body);
}
