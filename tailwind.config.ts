import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "var(--font-geist-sans)",
          '"Geist"',
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "Roboto",
          "sans-serif",
        ],
        mono: [
          "var(--font-geist-mono)",
          '"Geist Mono"',
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace",
        ],
      },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        border: "var(--border)",
        card: "var(--card)",
        "card-foreground": "var(--card-foreground)",
        surface: "var(--card)",
        "surface-secondary": "var(--surface-secondary)",
        "surface-elevated": "var(--surface-elevated)",
        muted: "var(--muted)",
        "muted-foreground": "var(--muted-foreground)",
        "secondary-foreground": "var(--secondary-foreground)",
        accent: "var(--accent)",
        "accent-foreground": "var(--accent-foreground)",
        primary: {
          DEFAULT: "var(--primary)",
          hover: "var(--primary-hover)",
          foreground: "var(--primary-foreground)",
        },
        sidebar: "var(--sidebar)",
        "sidebar-border": "var(--sidebar-border)",
        "border-subtle": "var(--border-subtle)",
        hover: "var(--hover)",
        selected: "var(--selected)",
        disabled: "var(--disabled)",
      },
      transitionDuration: {
        "400": "400ms",
        "600": "600ms",
        "650": "650ms",
        "750": "750ms",
        "800": "800ms",
        "850": "850ms",
        "900": "900ms",
        "950": "950ms",
      },
    },
  },
  plugins: [],
};

export default config;
