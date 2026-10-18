import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", disabled, ...props }, ref) => {
    const baseStyles =
      "inline-flex items-center justify-center font-medium rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50 disabled:pointer-events-none";

    const variants = {
      primary:
        "bg-[#F5F5F5] text-[#080809] hover:bg-white shadow-xs active:bg-zinc-200 font-semibold",
      secondary:
        "bg-[#19191B] text-[#F5F5F5] hover:bg-[#202023] border border-[#242427]",
      outline:
        "border border-[#242427] bg-transparent hover:bg-[#1C1C1F] text-[#F5F5F5]",
      ghost:
        "bg-transparent hover:bg-[#1C1C1F] text-[#A1A1AA] hover:text-[#F5F5F5]",
      danger:
        "bg-rose-500/15 text-rose-400 hover:bg-rose-500/25 border border-rose-500/30",
    };

    const sizes = {
      sm: "h-8 px-3 text-xs",
      md: "h-10 px-4 text-sm",
      lg: "h-12 px-6 text-base",
    };

    return (
      <button
        ref={ref}
        disabled={disabled}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";
