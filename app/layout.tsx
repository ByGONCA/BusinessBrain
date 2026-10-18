import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { TypographyProvider } from "@/components/theme/typography-provider";
import { LanguageProvider } from "@/lib/i18n/context";

export const metadata: Metadata = {
  title: "Company Brain - Your Company's Memory & Intelligence Layer",
  description:
    "A clean, scalable operating system that brings company knowledge, decisions, projects, meetings, and context together.",
};

const themeScript = `
  (function() {
    try {
      var saved = localStorage.getItem('cb_theme_mode');
      var contrast = localStorage.getItem('cb_contrast_mode');
      var locale = localStorage.getItem('cb_locale');
      var typo = localStorage.getItem('cb_typography_settings');
      var root = document.documentElement;
      root.classList.add('dark');
      root.classList.remove('light');
      root.style.colorScheme = 'dark';
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
      </body>
    </html>
  );
}
