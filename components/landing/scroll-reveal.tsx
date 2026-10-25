"use client";

import * as React from "react";
import { useScrollReveal } from "@/lib/hooks/use-scroll-reveal";

interface ScrollGroupContextValue {
  isTriggered: boolean;
  baseDelay: number;
  staggerInterval: number;
}

const ScrollGroupContext = React.createContext<ScrollGroupContextValue | null>(null);

export interface ScrollRevealProps extends React.HTMLAttributes<HTMLElement> {
  as?: React.ElementType;
  delay?: number; // ms
  duration?: number; // ms
  distance?: number; // px, default 16
  direction?: "up" | "down" | "none";
  threshold?: number;
  rootMargin?: string;
  triggerOnce?: boolean;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

/**
 * Single element or block scroll reveal wrapper.
 * Can be used standalone or inside a ScrollRevealGroup.
 * - Re-animates when user scrolls down into the section from above.
 * - Preserves full stability and visibility during upward scroll.
 */
export function ScrollReveal({
  as: Component = "div",
  delay = 0,
  duration = 850,
  distance = 16,
  direction = "up",
  threshold = 0.08,
  rootMargin = "0px",
  triggerOnce = false,
  className = "",
  style,
  children,
  ...rest
}: ScrollRevealProps) {
  const groupContext = React.useContext(ScrollGroupContext);
  const { ref: localRef, isVisible: isLocalVisible } = useScrollReveal<HTMLElement>({
    threshold,
    rootMargin,
    triggerOnce,
  });

  const isVisible = groupContext ? groupContext.isTriggered : isLocalVisible;
  const computedDelay = groupContext ? groupContext.baseDelay + delay : delay;

  const transformStyle = React.useMemo(() => {
    if (direction === "none") return "none";
    if (direction === "up") return isVisible ? "translateY(0)" : `translateY(${distance}px)`;
    if (direction === "down") return isVisible ? "translateY(0)" : `translateY(-${distance}px)`;
    return "none";
  }, [direction, isVisible, distance]);

  return (
    <Component
      ref={groupContext ? undefined : localRef}
      className={`transition-all ${className}`}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: transformStyle,
        transitionDuration: isVisible ? `${duration}ms` : "0ms",
        transitionDelay: isVisible ? `${computedDelay}ms` : "0ms",
        transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
        willChange: "opacity, transform",
        ...style,
      }}
      {...rest}
    >
      {children}
    </Component>
  );
}

export interface ScrollRevealGroupProps extends React.HTMLAttributes<HTMLElement> {
  as?: React.ElementType;
  threshold?: number;
  rootMargin?: string;
  triggerOnce?: boolean;
  baseDelay?: number;
  staggerInterval?: number;
  className?: string;
  children: React.ReactNode;
}

/**
 * Coordinated section wrapper that cascades staggered reveals to nested
 * ScrollRevealItem or ScrollReveal components.
 */
export function ScrollRevealGroup({
  as: Component = "div",
  threshold = 0.08,
  rootMargin = "0px",
  triggerOnce = false,
  baseDelay = 0,
  staggerInterval = 90,
  className = "",
  children,
  ...rest
}: ScrollRevealGroupProps) {
  const { ref, isVisible } = useScrollReveal<HTMLElement>({
    threshold,
    rootMargin,
    triggerOnce,
  });

  const contextValue = React.useMemo<ScrollGroupContextValue>(
    () => ({
      isTriggered: isVisible,
      baseDelay,
      staggerInterval,
    }),
    [isVisible, baseDelay, staggerInterval]
  );

  return (
    <ScrollGroupContext.Provider value={contextValue}>
      <Component ref={ref} className={className} {...rest}>
        {children}
      </Component>
    </ScrollGroupContext.Provider>
  );
}

export interface ScrollRevealItemProps extends React.HTMLAttributes<HTMLElement> {
  as?: React.ElementType;
  index?: number;
  delayOffset?: number; // extra ms on top of index * staggerInterval
  duration?: number;
  distance?: number;
  direction?: "up" | "down" | "none";
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

/**
 * Child item inside a ScrollRevealGroup with automatic index-based stagger.
 */
export function ScrollRevealItem({
  as: Component = "div",
  index = 0,
  delayOffset = 0,
  duration = 800,
  distance = 16,
  direction = "up",
  className = "",
  style,
  children,
  ...rest
}: ScrollRevealItemProps) {
  const groupContext = React.useContext(ScrollGroupContext);
  const isVisible = groupContext ? groupContext.isTriggered : true;
  const interval = groupContext ? groupContext.staggerInterval : 90;
  const base = groupContext ? groupContext.baseDelay : 0;
  const totalDelay = base + index * interval + delayOffset;

  const transformStyle = React.useMemo(() => {
    if (direction === "none") return "none";
    if (direction === "up") return isVisible ? "translateY(0)" : `translateY(${distance}px)`;
    if (direction === "down") return isVisible ? "translateY(0)" : `translateY(-${distance}px)`;
    return "none";
  }, [direction, isVisible, distance]);

  return (
    <Component
      className={`transition-all ${className}`}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: transformStyle,
        transitionDuration: isVisible ? `${duration}ms` : "0ms",
        transitionDelay: isVisible ? `${totalDelay}ms` : "0ms",
        transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
        willChange: "opacity, transform",
        ...style,
      }}
      {...rest}
    >
      {children}
    </Component>
  );
}
