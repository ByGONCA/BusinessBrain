import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { TypographyProvider } from "@/components/theme/typography-provider";
import { LanguageProvider } from "@/lib/i18n/context";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { getTrustedAppUrl } from "@/lib/security/redirects";

export const metadata: Metadata = {
  metadataBase: new URL(getTrustedAppUrl()),
  title: {
    default: "KogSync — The Memory & Intelligence Platform for Modern Companies",
    template: "%s | KogSync",
  },
  description:
    "The memory and intelligence layer for modern companies. Unified knowledge, institutional decisions, automated workflows, and context in one executive platform.",
  applicationName: "KogSync",
  authors: [{ name: "KogSync Team" }],
  keywords: [
    "knowledge management",
    "company brain",
    "institutional memory",
    "decision log",
    "enterprise intelligence",
    "kogsync",
  ],
  openGraph: {
    title: "KogSync — The Memory & Intelligence Platform for Modern Companies",
    description:
      "The memory and intelligence layer for modern companies. Unified knowledge, decisions, and context in one platform.",
    url: "https://kogsync.com",
    siteName: "KogSync",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "KogSync — The Memory & Intelligence Platform for Modern Companies",
    description:
      "The memory and intelligence layer for modern companies. Unified knowledge, decisions, and context in one platform.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

const themeScript = `
  (function() {
    try {
      var saved = localStorage.getItem('ks_theme_mode') || localStorage.getItem('cb_theme_mode');
      var contrast = localStorage.getItem('ks_contrast_mode') || localStorage.getItem('cb_contrast_mode');
      var locale = localStorage.getItem('ks_locale') || localStorage.getItem('cb_locale');
      var typo = localStorage.getItem('ks_typography_settings') || localStorage.getItem('cb_typography_settings');
      var root = document.documentElement;

      var isDark = false;
      if (saved === 'dark') {
        isDark = true;
      } else if (saved === 'light') {
        isDark = false;
      } else {
        isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      }

      if (isDark) {
        root.classList.add('dark');
        root.classList.remove('light');
        root.style.colorScheme = 'dark';
      } else {
        root.classList.add('light');
        root.classList.remove('dark');
        root.style.colorScheme = 'light';
      }

      if (contrast === 'high') {
        root.setAttribute('data-contrast', 'high');
      }
      if (locale) {
        root.lang = locale;
      }
      if (typo) {
        try {
          var parsed = JSON.parse(typo);
          if (parsed.baseFontSize) root.style.setProperty('--cb-font-base', parsed.baseFontSize);
          if (parsed.h1Size) root.style.setProperty('--cb-h1-size', parsed.h1Size);
          if (parsed.h2Size) root.style.setProperty('--cb-h2-size', parsed.h2Size);
          if (parsed.h3Size) root.style.setProperty('--cb-h3-size', parsed.h3Size);
        } catch (e) {}
      }
    } catch (e) {}
  })();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${GeistSans.className} font-sans min-h-screen bg-background text-foreground antialiased selection:bg-blue-600/30 transition-colors duration-150`}>
        <ThemeProvider>
          <TypographyProvider>
            <LanguageProvider>{children}</LanguageProvider>
          </TypographyProvider>
        </ThemeProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
