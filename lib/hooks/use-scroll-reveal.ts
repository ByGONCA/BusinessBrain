"use client";

import * as React from "react";

export interface ScrollRevealOptions {
  threshold?: number;
  rootMargin?: string;
  triggerOnce?: boolean;
}

/**
 * Directional, stable scroll reveal hook using IntersectionObserver.
 * - Staged entrance: Activates smoothly when an element enters the visible viewport from below (or on first view).
 * - Scroll down: Re-animates when user scrolls down into a section after returning from above.
 * - Scroll up: Preserves full stability and visibility of already-revealed content without flickering or hiding.
 * - Off-screen reset: Only resets when the element has completely exited below the bottom of the viewport.
 */
export function useScrollReveal<T extends HTMLElement = HTMLDivElement>(
  options: ScrollRevealOptions = {}
) {
  const { threshold = 0.08, rootMargin = "0px", triggerOnce = false } = options;
  const elementRef = React.useRef<T | null>(null);
  const [isVisible, setIsVisible] = React.useState<boolean>(false);

  React.useEffect(() => {
    // Check prefers-reduced-motion: reduce contract when explicitly requested via accessibility mode
    if (typeof window !== "undefined") {
      const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const isMotionSuppressed = prefersReduced && document.documentElement.dataset.motion === "reduced";
      if (isMotionSuppressed) {
        setIsVisible(true);
        return;
      }
    }

    const element = elementRef.current;
    if (!element) return;

    // Fallback if IntersectionObserver is unsupported
    if (typeof IntersectionObserver === "undefined") {
      setIsVisible(true);
      return;
    }

    const targetThreshold = typeof threshold === "number" ? threshold : 0.08;
    // Observe boundary (0) and entrance threshold (targetThreshold)
    const thresholds = [0, targetThreshold];

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const vh =
            typeof window !== "undefined"
              ? window.innerHeight || document.documentElement.clientHeight
              : 0;
          const rootBottom = entry.rootBounds ? entry.rootBounds.bottom : vh;

          // 1. Element enters or is inside the viewport
          const isEnteringOrInView =
            entry.isIntersecting &&
            (entry.intersectionRatio >= targetThreshold ||
              (entry.boundingClientRect.top < vh - 20 && entry.boundingClientRect.bottom > 20));

          if (isEnteringOrInView) {
            setIsVisible(true);
            if (triggerOnce) {
              observer.unobserve(entry.target);
            }
            return;
          }

          // 2. Element has completely exited BELOW the viewport (user scrolled up above it):
          // The element is 100% off-screen below the bottom edge. Reset it silently so that when
          // the user scrolls down again, it can smoothly re-animate into view.
          const isCompletelyBelow =
            entry.boundingClientRect.top >= vh || entry.boundingClientRect.top >= rootBottom;

          if (!entry.isIntersecting && isCompletelyBelow && !triggerOnce) {
            setIsVisible(false);
            return;
          }

          // 3. Element is ABOVE the viewport (user scrolled down past it):
          // Maintain visibility! Do NOT hide elements above the viewport so that when the user
          // scrolls back up, the content remains completely stable, visible and never flickers.
        });
      },
      { threshold: thresholds, rootMargin }
    );

    observer.observe(element);

    // Passive listener for instant top return (e.g. scrollTo(0) or logo click)
    let rafId: number | null = null;
    const handleScrollCheck = () => {
      if (triggerOnce) return;
      if (window.scrollY < 40) {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
          const el = elementRef.current;
          if (el) {
            const rect = el.getBoundingClientRect();
            if (rect.top >= window.innerHeight) {
              setIsVisible(false);
            }
          }
        });
      }
    };

    window.addEventListener("scroll", handleScrollCheck, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", handleScrollCheck);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [threshold, rootMargin, triggerOnce]);

  return { ref: elementRef, isVisible };
}

/**
 * Sequential Hero Entrance Hook
 * Coordinates a rapid, fluid 5-stage reveal without blank screen latency:
 * 1. Eyebrow badge (0ms)
 * 2. Headline (80ms - visible almost immediately)
 * 3. Subheadline paragraph (180ms)
 * 4. Primary/Secondary CTAs (280ms)
 * 5. Workstation Product Preview (380ms)
 *
 * Runs once per page load and never resets on scroll back to top.
 */
export function useHeroSequence() {
  const [step, setStep] = React.useState<number>(0);

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const isMotionSuppressed = prefersReduced && document.documentElement.dataset.motion === "reduced";
      if (isMotionSuppressed) {
        setStep(5);
        return;
      }
    }

    const timers: NodeJS.Timeout[] = [];

    // Trigger stage 1 immediately
    setStep(1);

    // Staged sequence with relaxed, elegant timings (in milliseconds)
    timers.push(setTimeout(() => setStep(2), 140));
    timers.push(setTimeout(() => setStep(3), 320));
    timers.push(setTimeout(() => setStep(4), 520));
    timers.push(setTimeout(() => setStep(5), 740));

    return () => {
      timers.forEach(clearTimeout);
    };
  }, []);

  return {
    isEyebrowVisible: step >= 1,
    isHeadlineVisible: step >= 2,
    isSubheadlineVisible: step >= 3,
    isCtaVisible: step >= 4,
    isShowcaseVisible: step >= 5,
    currentStep: step,
  };
}
