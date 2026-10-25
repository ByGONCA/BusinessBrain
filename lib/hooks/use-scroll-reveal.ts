"use client";

import * as React from "react";

export interface ScrollRevealOptions {
  threshold?: number;
  rootMargin?: string;
  triggerOnce?: boolean;
}

/**
 * High-performance, lightweight scroll reveal hook using IntersectionObserver.
 * Strictly respects prefers-reduced-motion and gracefully falls back to instant visibility.
 */
export function useScrollReveal<T extends HTMLElement = HTMLDivElement>(
  options: ScrollRevealOptions = {}
) {
  const { threshold = 0.15, rootMargin = "0px 0px -40px 0px", triggerOnce = true } = options;
  const elementRef = React.useRef<T | null>(null);
  const [isVisible, setIsVisible] = React.useState<boolean>(false);

  React.useEffect(() => {
    // 1. Accessibility: Respect prefers-reduced-motion strictly
    if (typeof window !== "undefined") {
      const prefersReducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;

      if (prefersReducedMotion) {
        setIsVisible(true);
        return;
      }
    }

    const element = elementRef.current;
    if (!element) return;

    // Fallback if IntersectionObserver is unsupported in the current environment
    if (typeof IntersectionObserver === "undefined") {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            if (triggerOnce) {
              observer.unobserve(entry.target);
            }
          } else if (!triggerOnce) {
            setIsVisible(false);
          }
        });
      },
      { threshold, rootMargin }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
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
 */
export function useHeroSequence() {
  const [step, setStep] = React.useState<number>(0);

  React.useEffect(() => {
    // If user prefers reduced motion, reveal everything immediately
    if (typeof window !== "undefined") {
      const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (prefersReduced) {
        setStep(5);
        return;
      }
    }

    const timers: NodeJS.Timeout[] = [];

    // Trigger stage 1 immediately
    setStep(1);

    // Staged sequence with rapid timings (in milliseconds)
    timers.push(setTimeout(() => setStep(2), 80));
    timers.push(setTimeout(() => setStep(3), 180));
    timers.push(setTimeout(() => setStep(4), 280));
    timers.push(setTimeout(() => setStep(5), 380));

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
