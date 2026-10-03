import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme/theme-provider";
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
      var isDark = true;
      if (saved === 'light') {
        isDark = false;
      } else if (saved === 'dark') {
        isDark = true;
      } else {
        isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      }
      var root = document.documentElement;
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
    } catch (e) {}
  })();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased selection:bg-blue-600/30 transition-colors duration-150">
        <ThemeProvider>
          <LanguageProvider>{children}</LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
