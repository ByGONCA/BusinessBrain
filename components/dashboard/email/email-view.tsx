"use client";

import * as React from "react";
import {
  Mail,
  ExternalLink,
  Inbox,
  Search,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Check,
  Paperclip,
  Plus,
  Loader2,
  Eye,
  FileText,
  Download,
  AlertTriangle,
} from "lucide-react";
import {
  OrganizationIntegration,
  EmailMessageItem,
  EmailAttachmentItem,
} from "@/lib/integrations/types";
import { useLanguage } from "@/lib/i18n";
import { useSettings } from "@/components/dashboard/settings/settings-context";
import {
  resolveSenderLogo,
  getSenderInitials,
  getSenderAvatarPalette,
  cleanSenderName,
} from "@/lib/integrations/sender-logos";
import {
  getEmailMessagesAction,
  getEmailMessageContentAction,
} from "@/lib/integrations/actions";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;

const EXPANDED_SAMPLE_EMAILS: Omit<EmailMessageItem, "accountEmail">[] = [
  {
    id: "em-1",
    sender: "Stripe Billing",
    senderEmail: "billing@stripe.com",
    recipientEmail: "finance@businessbrain.io",
    subject: "Enterprise Billing & Invoice Cycle Complete (INV-2026-098)",
    snippet: "Your subscription renewal has been successfully reconciled. Invoice PDF available.",
    body: `Hello team,\n\nYour monthly payment of €490.00 for Company Brain Enterprise subscription was successfully processed via Mastercard ending in 4242.\n\nTransaction Summary:\n• Reference: INV-2026-098\n• Date: Today, 10:15 AM\n• Net Amount: €398.37\n• VAT (23%): €91.63\n• Total Charged: €490.00\n\nYou can review receipt details and download your tax invoice in your Stripe customer portal.\n\nBest regards,\nStripe Billing Operations`,
    date: "Today",
    time: "10:15",
    unread: true,
    source: "Gmail",
    attachments: [{ name: "stripe_invoice_INV-2026-098.pdf", size: "142 KB" }],
  },
  {
    id: "em-2",
    sender: "Vercel Deployments",
    senderEmail: "notifications@vercel.com",
    recipientEmail: "devs@businessbrain.io",
    subject: "Production Deployment Success (Build #184 — main)",
    snippet: "Domain businessbrain.io deployed successfully to all edge regions with zero errors.",
    body: `Your production deployment is live across 24 edge regions.\n\nBuild Details:\n• Commit: main (security-reconciliation)\n• Domain: businessbrain.io\n• Total build duration: 38s\n• Edge status: 100% healthy, 0 runtime errors\n\nAll static routes and server actions are operational globally.`,
    date: "Today",
    time: "09:40",
    unread: false,
    source: "Gmail",
  },
  {
    id: "em-3",
    sender: "Pedro Santos (Venture Capital)",
    senderEmail: "pedro.santos@venturecap.pt",
    recipientEmail: "founders@businessbrain.io",
    subject: "Re: Q3 Metrics Update & Next Board Briefing",
    snippet: "Strong retention numbers last month. Let's schedule 30 minutes on Thursday to review the pipeline?",
    body: `Hi Gonçalo,\n\nI reviewed the metric report you sent over. The platform's conversion and retention curves look exceptionally healthy, especially in the multi-tenant enterprise segment.\n\nAre you available for a 30-minute sync this Thursday around 3:00 PM to align on Q3 goals and prepare for our next milestone?\n\nBest,\nPedro Santos\nPartner | Venture Capital`,
    date: "Yesterday",
    time: "17:20",
    unread: true,
    source: "Gmail",
  },
  {
    id: "em-4",
    sender: "Security Operations",
    senderEmail: "secops@businessbrain.io",
    recipientEmail: "admin@businessbrain.io",
    subject: "Security Audit Report: 130/130 Automated Checks Passed",
    snippet: "Automated verification for RLS isolation, IDOR prevention, and AES-256 token encryption passed with 0 warnings.",
    body: `Weekly Security & Tenant Hardening Report:\n\nThe automated verification suite completed 130 security tests with a 100% pass rate:\n• PostgreSQL RLS isolation: OK\n• Strict UUID validation & IDOR boundaries: OK\n• AES-256-GCM integration credential encryption: OK\n• Rate-limiting defense & service-role RPC lockdown: OK\n• Browser security headers (CSP, HSTS, X-Frame-Options): OK\n\nNo regressions or vulnerabilities detected.`,
    date: "Yesterday",
    time: "14:10",
    unread: false,
    source: "Outlook",
  },
  {
    id: "em-5",
    sender: "GitHub Notifications",
    senderEmail: "notifications@github.com",
    recipientEmail: "devs@businessbrain.io",
    subject: "[BusinessBrain] Pull Request #48 merged: Multi-account integration & i18n",
    snippet: "Pull Request #48 was reviewed and merged into main by goncalo-ramos.",
    body: `Pull Request #48: 'Multi-account integration cleanup, email pagination & localization' has been merged into main.\n\nSummary of changes:\n- Cleaned integration modal\n- Multi-account connection support with individual deletion\n- Smooth canvas zooming without browser interference\n- Complete English and multilingual localization\n\nAll automated CI checks passed.`,
    date: "Oct 05",
    time: "18:45",
    unread: false,
    source: "Gmail",
  },
  {
    id: "em-6",
    sender: "Supabase Platform",
    senderEmail: "support@supabase.io",
    recipientEmail: "admin@businessbrain.io",
    subject: "Scheduled Database Maintenance Notice: Zero-Downtime Engine Upgrade",
    snippet: "Your PostgreSQL instance will receive kernel security patches during the upcoming weekend maintenance window.",
    body: `Notice of scheduled infrastructure maintenance:\n\nYour production PostgreSQL cluster will receive security patches and index optimizations during low-traffic hours (Sunday 03:00-03:30 UTC).\n\nConnection pooling via Supavisor will keep all existing client sessions active. Zero downtime is expected.\n\nSupabase Team`,
    date: "Oct 04",
    time: "11:00",
    unread: false,
    source: "Gmail",
  },
  {
    id: "em-7",
    sender: "Mariana Costa (TechCorp Pilot)",
    senderEmail: "mariana.costa@techcorp.eu",
    recipientEmail: "founders@businessbrain.io",
    subject: "Customer Feedback: Company Brain Email Context Sync",
    snippet: "Our teams are loving the organizational context layer. Handoffs between sales and engineering are 10x faster.",
    body: `Hi Gonçalo,\n\nJust wanted to send a quick note of appreciation. Connecting our corporate email channels into Company Brain has significantly reduced friction in our cross-functional teams.\n\nWe have a couple of suggestions for the upcoming sprint:\n1. Custom tagging by customer domain\n2. One-click meeting action export to Markdown\n\nKeep up the great momentum!\n\nBest,\nMariana Costa\nHead of Operations | TechCorp`,
    date: "Oct 03",
    time: "16:15",
    unread: true,
    source: "Outlook",
  },
  {
    id: "em-8",
    sender: "Google Cloud Billing",
    senderEmail: "google-billing@google.com",
    recipientEmail: "finance@businessbrain.io",
    subject: "Google Cloud Monthly Statement & API Usage Summary",
    snippet: "Your September API consumption report for Google Workspace & Cloud Identity is ready for review.",
    body: `Your Google Cloud invoice for the BusinessBrain organization is available.\n\nBilled Services:\n• Google Workspace API (Gmail, Calendar, Drive)\n• Identity OAuth 2.0 Verification\n• Cloud CDN & DNS\n\nAccess the Google Cloud Console to download the official receipt.`,
    date: "Oct 02",
    time: "08:30",
    unread: false,
    source: "Gmail",
  },
  {
    id: "em-9",
    sender: "Linear Team",
    senderEmail: "notifications@linear.app",
    recipientEmail: "devs@businessbrain.io",
    subject: "Cycle 14 Completed — 18 issues closed this sprint",
    snippet: "Sprint velocity increased by 24%. Cycle 15 starting tomorrow with focus on knowledge engine.",
    body: `Great job team! Cycle 14 has officially concluded.\n\nSprint Stats:\n• 18 issues resolved\n• 0 unresolved blockers\n• Average time to close: 1.4 days\n\nKey achievements included the new email workspace reader, multi-account settings refactor, and graph canvas gesture zooming.`,
    date: "Oct 01",
    time: "19:00",
    unread: false,
    source: "Outlook",
  },
  {
    id: "em-10",
    sender: "Legal & GDPR Advisory",
    senderEmail: "legal@businessbrain.io",
    recipientEmail: "compliance@businessbrain.io",
    subject: "GDPR Compliance Review: OAuth Token Encryption & Data Retention",
    snippet: "Third-party token storage and user-initiated disconnect flows comply with European data protection regulations.",
    body: `Formal confirmation of GDPR compliance:\n\nThe current implementation of third-party integration token management adheres strictly to GDPR requirements:\n1. Explicit user consent and discrete account selection.\n2. AES-256-GCM symmetric encryption for all at-rest refresh credentials.\n3. Immediate token revocation and permanent database removal upon account disconnection.\n\nThe regulatory register has been updated accordingly.\n\nData Protection Office`,
    date: "Sep 30",
    time: "12:00",
    unread: false,
    source: "Outlook",
  },
  {
    id: "em-11",
    sender: "Slack Notifications",
    senderEmail: "notifications@slack.com",
    recipientEmail: "founders@businessbrain.io",
    subject: "New Channel Created: #enterprise-customer-support",
    snippet: "A dedicated channel was established for high-priority onboarding requests and customer support.",
    body: `The channel #enterprise-customer-support was created and added to your workspace.\n\nAll founders and engineers have been invited. You can configure notification alerts directly in Slack.\n\nSlack Team`,
    date: "Sep 29",
    time: "15:20",
    unread: false,
    source: "Gmail",
  },
  {
    id: "em-12",
    sender: "AWS Cloud Notifications",
    senderEmail: "no-reply-aws@amazon.com",
    recipientEmail: "finance@businessbrain.io",
    subject: "AWS Monthly Billing Statement Available ($18.45 USD)",
    snippet: "Your September invoice for Route53 and edge distribution network is ready for review.",
    body: `Your AWS monthly billing statement for the previous billing period is now available.\n\nTotal charge: $18.45 USD.\nService breakdown: Route 53 DNS records and global SSL certificates.\n\nPlease log into the AWS Billing Dashboard to download the invoice PDF.`,
    date: "Sep 28",
    time: "07:10",
    unread: false,
    source: "Gmail",
  },
  {
    id: "em-13",
    sender: "OpenAI Platform",
    senderEmail: "support@openai.com",
    recipientEmail: "devs@businessbrain.io",
    subject: "Usage Tier Upgraded to Scale 3 (Higher Rate Limits)",
    snippet: "Your organization account has been approved for higher throughput and lower latency tiers.",
    body: `Congratulations! Your organization BusinessBrain has been promoted to Usage Tier 3.\n\nYou now have access to:\n• 10,000 RPM (Requests Per Minute)\n• 2,000,000 TPM (Tokens Per Minute)\n• Priority routing for model fine-tuning endpoints\n\nNo change to your billing method is required.`,
    date: "Sep 27",
    time: "16:40",
    unread: false,
    source: "Gmail",
  },
  {
    id: "em-14",
    sender: "Figma Team",
    senderEmail: "notifications@figma.com",
    recipientEmail: "design@businessbrain.io",
    subject: "Company Brain Design System 2.0 Published to Workspace",
    snippet: "New component library with dark mode tokens, typography scale, and unified iconography.",
    body: `The Design System 2.0 library has been published to your Figma team workspace.\n\nHighlights:\n• Updated geometric node visual assets\n• Accessible contrast ratios for dark and light palettes\n• Reusable dashboard primitives matching Tailwind design tokens\n\nCheck the changelog inside the master file.`,
    date: "Sep 26",
    time: "11:15",
    unread: false,
    source: "Gmail",
  },
  {
    id: "em-15",
    sender: "Cloudflare Security",
    senderEmail: "alerts@cloudflare.com",
    recipientEmail: "secops@businessbrain.io",
    subject: "DDoS Mitigation Summary: 100% Uptime Maintained",
    snippet: "Edge security prevented 4,200 malicious probing requests over the past 7 days with zero impact.",
    body: `Cloudflare Weekly Threat Report:\n\nAll domain endpoints protected with WAF rules and edge caching.\n• Blocked suspicious bots: 4,210\n• Average TTFB: 24ms\n• SSL/TLS status: Strict (100% encrypted traffic)\n\nNo action required.`,
    date: "Sep 25",
    time: "09:00",
    unread: false,
    source: "Outlook",
  },
  {
    id: "em-16",
    sender: "Resend Email Infrastructure",
    senderEmail: "team@resend.com",
    recipientEmail: "devs@businessbrain.io",
    subject: "Transactional Email Deliverability: 99.8% Inbox Placement",
    snippet: "DKIM, SPF, and DMARC verification confirmed for domain businessbrain.io.",
    body: `Your domain DNS records have been verified successfully:\n• SPF: PASS\n• DKIM: PASS (2048-bit RSA key)\n• DMARC: PASS (p=reject policy active)\n\nTransactional delivery rates for password resets and team invites remain at 99.8%.`,
    date: "Sep 24",
    time: "14:30",
    unread: false,
    source: "Gmail",
  },
  {
    id: "em-17",
    sender: "HubSpot CRM",
    senderEmail: "notifications@hubspot.com",
    recipientEmail: "founders@businessbrain.io",
    subject: "New Enterprise Lead: Inbound Inquiry from Horizon Labs",
    snippet: "CTO of Horizon Labs requested an architecture walkthrough for Company Brain knowledge indexing.",
    body: `New lead captured on landing page demo form:\n\n• Name: Alexandre Silva (CTO)\n• Company: Horizon Labs (120 employees)\n• Message: 'Interested in connecting Google Workspace and Slack into a private knowledge base. Need SOC2 compliance details.'\n\nLead record created in CRM.`,
    date: "Sep 23",
    time: "17:50",
    unread: true,
    source: "Outlook",
  },
  {
    id: "em-18",
    sender: "Seedrs Investor Relations",
    senderEmail: "investors@seedrs.com",
    recipientEmail: "founders@businessbrain.io",
    subject: "Angel Syndicate Monthly Update Submission Confirmation",
    snippet: "Your Q3 founder letter was dispatched to all 14 angel investors in the syndicate.",
    body: `Your quarterly investor memo was delivered to syndicate members.\n\nEngagement:\n• 100% open rate within 24 hours\n• 3 investor follow-up inquiries logged\n\nThank you for maintaining transparent investor relations.`,
    date: "Sep 22",
    time: "13:20",
    unread: false,
    source: "Gmail",
  },
  {
    id: "em-19",
    sender: "PostgreSQL Advisory Board",
    senderEmail: "newsletter@postgresweekly.com",
    recipientEmail: "devs@businessbrain.io",
    subject: "Postgres Weekly #512: Best Practices for Multi-Tenant RLS",
    snippet: "Case study on building zero-leak multi-tenant architectures using Row Level Security in production.",
    body: `Welcome to Postgres Weekly #512!\n\nFeatured this week:\n• Designing resilient RLS policies that survive application layer bugs\n• Indexing strategy for composite tenant foreign keys\n• Securing database RPC functions against untrusted public execution`,
    date: "Sep 21",
    time: "10:00",
    unread: false,
    source: "Gmail",
  },
  {
    id: "em-20",
    sender: "Notion Integration Partner",
    senderEmail: "partners@makenotion.com",
    recipientEmail: "devs@businessbrain.io",
    subject: "Notion API Workspace Integration Partnership Accepted",
    snippet: "Your developer credentials have been verified for two-way block sync.",
    body: `Hello BusinessBrain Team,\n\nWe have reviewed your integration application for bidirectional page synchronization. Your OAuth client was approved with standard permissions.\n\nAccess token endpoints are active.`,
    date: "Sep 20",
    time: "15:45",
    unread: false,
    source: "Gmail",
  },
  {
    id: "em-21",
    sender: "Apple Developer Relations",
    senderEmail: "devprograms@apple.com",
    recipientEmail: "admin@businessbrain.io",
    subject: "Apple Developer Program Membership Renewal Complete",
    snippet: "Annual organization certificate enrollment confirmed through September 2027.",
    body: `Your Apple Developer Program membership has been renewed for another 12 months.\n\nAccount: BusinessBrain Technologies Lda.\nEnrolled as: Organization / Company\n\nTeam certificates and signing keys remain active.`,
    date: "Sep 19",
    time: "11:30",
    unread: false,
    source: "Gmail",
  },
  {
    id: "em-22",
    sender: "Brex Corporate Banking",
    senderEmail: "service@brex.com",
    recipientEmail: "finance@businessbrain.io",
    subject: "Monthly Statement: Treasury Yield & Operational Accounts",
    snippet: "Your September account yield accrued 4.85% APY on idle operating funds.",
    body: `Your Brex monthly treasury and banking statement is available for download.\n\n• Treasury Yield Accrued: $1,420.30\n• Card Spend Volume: $4,890.12\n• Active Cards: 4\n\nExport your monthly QuickBooks / Xero reconciliation files anytime from the dashboard.`,
    date: "Sep 18",
    time: "08:15",
    unread: false,
    source: "Outlook",
  },
  {
    id: "em-23",
    sender: "People & HR Operations",
    senderEmail: "hr@businessbrain.io",
    recipientEmail: "founders@businessbrain.io",
    subject: "Q4 Engineering Hiring Pipeline: 3 Final Candidate Interviews",
    snippet: "Senior Fullstack Engineer and AI Systems Lead candidates scheduled for final round reviews.",
    body: `Hi team,\n\nHere is our hiring pipeline summary for the current week:\n• Candidate 1 (Senior Fullstack): Thursday at 11:00 AM\n• Candidate 2 (Security/DevOps): Friday at 2:30 PM\n• Candidate 3 (Product Designer): Friday at 4:00 PM\n\nResumes and evaluation rubrics are attached in the candidate portal.`,
    date: "Sep 17",
    time: "16:00",
    unread: true,
    source: "Outlook",
  },
  {
    id: "em-24",
    sender: "SOC2 Compliance Auditor",
    senderEmail: "audits@vanta.com",
    recipientEmail: "secops@businessbrain.io",
    subject: "SOC2 Type II Readiness Assessment: 98% Evidence Collected",
    snippet: "All automated continuous monitors in AWS, GitHub, and Supabase are operating with zero failing checks.",
    body: `SOC2 Continuous Compliance Assessment:\n\n• Cloud Infrastructure: 100% compliant\n• Employee Device Management: 100% compliant\n• Access Control & Least Privilege: 98% compliant\n• Vulnerability Remediation SLA: 0 open criticals\n\nYour formal audit observation window begins next month.`,
    date: "Sep 16",
    time: "10:45",
    unread: false,
    source: "Outlook",
  },
];

function formatDisplayDate(dateStr?: string, timeStr?: string): string {
  if (!dateStr) return "Today";

  // If already relative
  if (dateStr.toLowerCase() === "today") return timeStr || "Today";
  if (dateStr.toLowerCase() === "yesterday") return "Yesterday";

  // If already a time string like "16:08"
  if (/^\d{1,2}:\d{2}/.test(dateStr)) return dateStr;

  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      const now = new Date();
      const isToday =
        d.getDate() === now.getDate() &&
        d.getMonth() === now.getMonth() &&
        d.getFullYear() === now.getFullYear();

      if (isToday) return timeStr || d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

      const yesterday = new Date();
      yesterday.setDate(now.getDate() - 1);
      const isYesterday =
        d.getDate() === yesterday.getDate() &&
        d.getMonth() === yesterday.getMonth() &&
        d.getFullYear() === yesterday.getFullYear();

      if (isYesterday) return "Yesterday";

      return d.toLocaleDateString([], { month: "short", day: "numeric" });
    }
  } catch {
    // fallback
  }

  // Handle format like "10/6/2026"
  const parts = dateStr.split("/");
  if (parts.length === 3) {
    const now = new Date();
    const month = parseInt(parts[0], 10);
    const day = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);
    if (year === now.getFullYear() && month === now.getMonth() + 1 && day === now.getDate()) {
      return timeStr || "Today";
    }
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    if (month >= 1 && month <= 12) {
      return `${months[month - 1]} ${day}`;
    }
  }

  return dateStr;
}

function cleanHtmlEntities(str?: string): string {
  if (!str) return "";
  return str
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Strips executable scripts, forms, dangerous protocols, and meta refreshes
 * from untrusted incoming email HTML while preserving safe styling and formatting.
 */
export function sanitizeEmailHtml(html: string): string {
  if (!html || typeof html !== "string") return "";

  let sanitized = html;

  // 1. Strip script tags and their contents
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");

  // 2. Strip object, embed, applet tags and their contents
  sanitized = sanitized.replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, "");
  sanitized = sanitized.replace(/<embed\b[^>]*>/gi, "");
  sanitized = sanitized.replace(/<applet\b[^<]*(?:(?!<\/applet>)<[^<]*)*<\/applet>/gi, "");

  // 3. Strip forms and form elements to prevent phishing credential harvesting
  sanitized = sanitized.replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, "");

  // 4. Strip dangerous meta tags (meta refresh, redirects, CSP override) and base tags
  sanitized = sanitized.replace(/<meta[^>]*http-equiv[^>]*>/gi, "");
  sanitized = sanitized.replace(/<base[^>]*>/gi, "");

  // 5. Strip inline event handlers (e.g. onload, onerror, onclick, onmouseover)
  sanitized = sanitized.replace(/\s+on[a-z]{3,20}\s*=\s*(['"][^'"]*['"]|[^\s>]+)/gi, "");

  // 6. Neutralize dangerous URL schemes in href, src, action (javascript:, vbscript:, data:text/html)
  sanitized = sanitized.replace(
    /\b(href|src)\s*=\s*(['"])\s*(?:javascript|vbscript|data:\s*text\/html)[^'"]*\2/gi,
    '$1="#"'
  );

  // 7. Completely neutralize dark-mode media queries from the incoming HTML
  sanitized = sanitized
    .replace(/@media\s*\([^{}]*prefers-color-scheme\s*:\s*dark[^{}]*\)/gi, "@media (max-width: 0px)")
    .replace(/prefers-color-scheme\s*:\s*dark/gi, "prefers-color-scheme: disabled");

  return sanitized;
}

/**
 * Isolated sandboxed iframe viewer for rich HTML emails.
 * Guarantees zero CSS leakage, native performance, safe script blocking,
 * and automatic responsive sizing.
 */
function EmailHtmlViewer({ html }: { html: string }) {
  const iframeRef = React.useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = React.useState<number>(650);

  const srcDoc = React.useMemo(() => {
    const metaColor = '<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">';
    const metaReferrer = '<meta name="referrer" content="no-referrer">';
    const baseTag = '<base target="_blank" rel="noopener noreferrer">';
    const injectedStyles = `
      <style>
        :root {
          color-scheme: light !important;
          supported-color-schemes: light !important;
        }
        html, body {
          margin: 0 !important;
          background-color: #ffffff !important;
          color: #1a1a1a !important;
          color-scheme: light !important;
        }
        body {
          padding: 16px !important;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          line-height: 1.5;
          word-break: break-word;
        }
        /* Guarantee all text nodes are dark, visible, and never white-on-white */
        p, span, td, th, div, h1, h2, h3, h4, h5, h6, font, li, b, strong, em {
          color: #1a1a1a !important;
        }
        /* Preserve distinct link styling */
        a, a * {
          color: #2563eb !important;
        }
        /* Ensure email illustrations and images load visibly */
        img {
          max-width: 100% !important;
          height: auto !important;
        }
        table {
          max-width: 100% !important;
        }
        /* Neutralize dark-mode white text styles from MJML/Revolut templates */
        [style*="color: #ffffff"], [style*="color:#ffffff"], [style*="color: #fff"], [style*="color:#fff"], [style*="color: rgb(255, 255, 255)"], [style*="color: white"] {
          color: #1a1a1a !important;
        }
      </style>
    `;

    // 1. Sanitize incoming untrusted HTML against XSS and dangerous protocols
    const sanitizedHtml = sanitizeEmailHtml(html);

    // 2. Inject meta at top of head and strong styles at bottom of head (highest cascade priority)
    const metaHeader = `${metaColor}${metaReferrer}${baseTag}`;
    let result = sanitizedHtml;

    if (/<head[^>]*>/i.test(result)) {
      result = result.replace(/<head[^>]*>/i, (m) => `${m}${metaHeader}`);
      if (/<\/head>/i.test(result)) {
        result = result.replace(/<\/head>/i, `${injectedStyles}</head>`);
      } else {
        result = `${result}${injectedStyles}`;
      }
    } else {
      result = `<!DOCTYPE html><html><head>${metaHeader}${injectedStyles}</head><body>${result}</body></html>`;
    }

    return result;
  }, [html]);

  // Dynamically compute and adjust height as images and content load
  React.useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const updateHeight = () => {
      try {
        const doc = iframe.contentDocument;
        if (doc?.body) {
          const bodyHeight = doc.body.scrollHeight;
          const htmlHeight = doc.documentElement.scrollHeight;
          const contentHeight = Math.max(bodyHeight, htmlHeight);
          if (contentHeight > 100) {
            setHeight(Math.min(Math.max(contentHeight + 35, 450), 4500));
          }
        }
      } catch {
        // Ignore cross-origin access issues
      }
    };

    const handleLoad = () => {
      updateHeight();
      try {
        const doc = iframe.contentDocument;
        if (doc) {
          const images = doc.querySelectorAll("img");
          images.forEach((img) => {
            img.addEventListener("load", updateHeight);
            img.addEventListener("error", updateHeight);
          });
          if (typeof window !== "undefined" && window.ResizeObserver && doc.body) {
            const ro = new ResizeObserver(() => updateHeight());
            ro.observe(doc.body);
            return () => ro.disconnect();
          }
        }
      } catch {
        // Ignore
      }
    };

    iframe.addEventListener("load", handleLoad);
    return () => iframe.removeEventListener("load", handleLoad);
  }, [srcDoc]);

  return (
    <div className="w-full rounded-xl border border-zinc-200/90 dark:border-zinc-800 bg-white overflow-hidden shadow-2xs">
      <iframe
        ref={iframeRef}
        srcDoc={srcDoc}
        title="Email content"
        referrerPolicy="no-referrer"
        sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin"
        className="w-full border-0 block bg-white"
        style={{ height: `${height}px`, minHeight: "450px" }}
      />
    </div>
  );
}

interface EmailViewProps {
  integrations: OrganizationIntegration[];
  initialMessages?: EmailMessageItem[];
  initialNextPageToken?: string;
  isLiveConnected?: boolean;
}

export function EmailView({
  integrations,
  initialMessages = [],
  initialNextPageToken,
  isLiveConnected = false,
}: EmailViewProps) {
  const { t, interpolate } = useLanguage();
  const { openSettings } = useSettings();

  // Filter connected email channels (Gmail or Outlook)
  const connectedEmailIntegrations = React.useMemo(() => {
    return integrations.filter(
      (i) =>
        (i.provider === "gmail" ||
          i.provider === "outlook" ||
          (i.provider === "google" && i.scopes?.some((s) => s.includes("gmail"))) ||
          (i.provider === "microsoft" && i.scopes?.some((s) => s.includes("mail")))) &&
        i.status === "connected"
    );
  }, [integrations]);

  const hasAnyEmailConnected = connectedEmailIntegrations.length > 0;

  // Selected account in dropdown: Strictly one account at a time (NO "all" option per user request)
  const [selectedAccount, setSelectedAccount] = React.useState<string>(() => {
    return (
      connectedEmailIntegrations[0]?.accountEmail ||
      connectedEmailIntegrations[0]?.providerAccountId ||
      ""
    );
  });

  const [isAccountDropdownOpen, setIsAccountDropdownOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // Search filter
  const [searchQuery, setSearchQuery] = React.useState("");

  // Real Pagination State (10 items per page, cursor-based with Gmail API nextPageToken)
  const [pageIndex, setPageIndex] = React.useState<number>(0);
  const [pageTokens, setPageTokens] = React.useState<Record<number, string | undefined>>({
    0: undefined,
  });
  const [currentNextPageToken, setCurrentNextPageToken] = React.useState<string | undefined>(
    initialNextPageToken
  );
  const [isLoadingPage, setIsLoadingPage] = React.useState<boolean>(false);

  // Active page messages (10 messages received for the current page)
  const [currentEmails, setCurrentEmails] = React.useState<EmailMessageItem[]>(() => {
    if (initialMessages && initialMessages.length > 0) {
      return initialMessages.slice(0, PAGE_SIZE);
    }

    const defaultEmail =
      connectedEmailIntegrations[0]?.accountEmail ||
      connectedEmailIntegrations[0]?.providerAccountId ||
      "founder@businessbrain.io";

    return EXPANDED_SAMPLE_EMAILS.slice(0, PAGE_SIZE).map((msg) => ({
      ...msg,
      accountEmail: defaultEmail,
    }));
  });

  // Email reader state
  const [selectedEmail, setSelectedEmail] = React.useState<EmailMessageItem | null>(null);
  const [readerViewMode, setReaderViewMode] = React.useState<"html" | "text">("html");
  const [isLoadingBody, setIsLoadingBody] = React.useState(false);
  const [reauthNeeded, setReauthNeeded] = React.useState<boolean>(false);

  // In-memory cache for full email contents to avoid redundant network round-trips
  const bodyCacheRef = React.useRef<
    Map<string, { body: string; htmlBody?: string; attachments?: EmailAttachmentItem[] }>
  >(new Map());

  // Active message ID ref to prevent race conditions when switching emails quickly
  const currentOpeningIdRef = React.useRef<string | null>(null);

  // Keep selectedAccount in sync if integrations load or change
  React.useEffect(() => {
    if (connectedEmailIntegrations.length > 0) {
      const currentValid = connectedEmailIntegrations.some(
        (acc) => (acc.accountEmail || acc.providerAccountId) === selectedAccount
      );
      if (!currentValid) {
        setSelectedAccount(
          connectedEmailIntegrations[0].accountEmail ||
            connectedEmailIntegrations[0].providerAccountId
        );
      }
    }
  }, [connectedEmailIntegrations, selectedAccount]);

  // Close dropdown on click outside
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsAccountDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Helper to fetch messages for a specific page and query
  const loadPage = React.useCallback(
    async (targetPageIndex: number, targetToken: string | undefined, search: string) => {
      setIsLoadingPage(true);
      try {
        if (isLiveConnected) {
          const res = await getEmailMessagesAction({
            accountEmail: selectedAccount,
            search: search.trim() || undefined,
            pageToken: targetToken,
          });

          if (res.error === "needs_reauth") {
            setReauthNeeded(true);
          } else {
            setReauthNeeded(false);
          }

          setCurrentEmails(res.messages);
          setCurrentNextPageToken(res.nextPageToken);
          setPageIndex(targetPageIndex);
          if (res.nextPageToken) {
            setPageTokens((prev) => ({ ...prev, [targetPageIndex + 1]: res.nextPageToken }));
          }
        } else {
          setReauthNeeded(false);
          // Fallback dataset pagination (10 items per page without live credentials)
          const allAccountEmails = EXPANDED_SAMPLE_EMAILS.map((msg) => ({
            ...msg,
            accountEmail: selectedAccount,
          })).filter((msg) => {
            if (!search.trim()) return true;
            const q = search.toLowerCase();
            return (
              msg.sender.toLowerCase().includes(q) ||
              msg.subject.toLowerCase().includes(q) ||
              msg.snippet.toLowerCase().includes(q)
            );
          });

          const start = targetPageIndex * PAGE_SIZE;
          const end = start + PAGE_SIZE;
          const slice = allAccountEmails.slice(start, end);
          const hasMore = end < allAccountEmails.length;
          const simulatedNextToken = hasMore ? `page_${targetPageIndex + 1}` : undefined;

          setCurrentEmails(slice);
          setCurrentNextPageToken(simulatedNextToken);
          setPageIndex(targetPageIndex);
          if (simulatedNextToken) {
            setPageTokens((prev) => ({ ...prev, [targetPageIndex + 1]: simulatedNextToken }));
          }
        }
      } catch (err) {
        console.error("Failed to load email page:", err);
      } finally {
        setIsLoadingPage(false);
      }
    },
    [isLiveConnected, selectedAccount]
  );

  // Reload page 0 when selectedAccount or search changes
  React.useEffect(() => {
    setPageTokens({ 0: undefined });
    loadPage(0, undefined, searchQuery);
  }, [selectedAccount, searchQuery, loadPage]);

  // Navigate to Next page
  const handleNextPage = () => {
    if (!currentNextPageToken || isLoadingPage) return;
    const nextIdx = pageIndex + 1;
    loadPage(nextIdx, currentNextPageToken, searchQuery);
  };

  // Navigate to Previous page
  const handlePreviousPage = () => {
    if (pageIndex <= 0 || isLoadingPage) return;
    const prevIdx = pageIndex - 1;
    const prevToken = pageTokens[prevIdx];
    loadPage(prevIdx, prevToken, searchQuery);
  };

  // When opening an email: fetch full body on-demand if it's a live message
  const handleOpenEmail = async (msg: EmailMessageItem) => {
    if (msg.unread) {
      handleToggleRead(msg.id);
    }

    currentOpeningIdRef.current = msg.id;
    setSelectedEmail(msg);

    // If already in client cache, use cached body immediately with zero network latency
    if (bodyCacheRef.current.has(msg.id)) {
      const cached = bodyCacheRef.current.get(msg.id)!;
      setSelectedEmail((prev) =>
        prev && prev.id === msg.id
          ? {
              ...prev,
              body: cached.body || prev.body,
              htmlBody: cached.htmlBody,
              attachments:
                cached.attachments && cached.attachments.length > 0
                  ? cached.attachments
                  : prev.attachments,
            }
          : prev
      );
      if (cached.htmlBody) {
        setReaderViewMode("html");
      }
      setIsLoadingBody(false);
      return;
    }

    // If message is live and body is empty or just snippet, load full body on-demand
    if (isLiveConnected && msg.source === "Gmail") {
      setIsLoadingBody(true);
      try {
        const fullContent = await getEmailMessageContentAction({
          messageId: msg.id,
          accountEmail: selectedAccount,
        });

        // Guard against race conditions: only update if user is still viewing this exact message
        if (fullContent && currentOpeningIdRef.current === msg.id) {
          bodyCacheRef.current.set(msg.id, fullContent);
          setSelectedEmail((prev) =>
            prev && prev.id === msg.id
              ? {
                  ...prev,
                  body: fullContent.body || prev.body,
                  htmlBody: fullContent.htmlBody,
                  attachments:
                    fullContent.attachments && fullContent.attachments.length > 0
                      ? fullContent.attachments
                      : prev.attachments,
                }
              : null
          );
          if (fullContent.htmlBody) {
            setReaderViewMode("html");
          }
        }
      } catch (err) {
        console.warn("Failed to fetch full email body on-demand:", err);
      } finally {
        if (currentOpeningIdRef.current === msg.id) {
          setIsLoadingBody(false);
        }
      }
    }
  };

  // Toggle read status of an email
  const handleToggleRead = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setCurrentEmails((prev) =>
      prev.map((msg) => {
        if (msg.id === id) {
          const nextUnread = !msg.unread;
          if (selectedEmail && selectedEmail.id === id) {
            setSelectedEmail({ ...selectedEmail, unread: nextUnread });
          }
          return { ...msg, unread: nextUnread };
        }
        return msg;
      })
    );
  };

  // If no email is connected at all
  if (!hasAnyEmailConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/60 text-zinc-400 dark:text-zinc-500 mb-4 shadow-2xs">
          <Mail className="h-6 w-6" />
        </div>
        <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          {t.emailPage.noIntegrationsConnected}
        </p>
        <div className="mt-4">
          <button
            type="button"
            onClick={() => openSettings("integrations")}
            className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 px-4 py-2 text-xs font-semibold text-white dark:text-zinc-900 shadow-2xs hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
          >
            <span>{t.emailPage.goToIntegrations}</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  const selectedAccountLabel = selectedAccount || t.emailPage.selectAccount;
  const startNumber = pageIndex * PAGE_SIZE + 1;
  const endNumber = pageIndex * PAGE_SIZE + currentEmails.length;
  const selectedLogo = selectedEmail
    ? resolveSenderLogo(selectedEmail.senderEmail || selectedEmail.sender)
    : null;

  // Active account provider & logo resolution
  const activeIntegration = connectedEmailIntegrations.find(
    (acc) => (acc.accountEmail || acc.providerAccountId) === selectedAccount
  );
  const isGmailActive =
    activeIntegration?.provider === "gmail" ||
    activeIntegration?.provider === "google" ||
    selectedAccount.toLowerCase().includes("@gmail.") ||
    selectedAccount.toLowerCase().includes("@googlemail.");

  const isOutlookActive =
    activeIntegration?.provider === "outlook" ||
    activeIntegration?.provider === "microsoft" ||
    selectedAccount.toLowerCase().includes("@outlook.") ||
    selectedAccount.toLowerCase().includes("@hotmail.") ||
    selectedAccount.toLowerCase().includes("@live.") ||
    selectedAccount.toLowerCase().includes("@msn.");

  const activeAccountLogo = isGmailActive
    ? "/logos/google-gmail.svg"
    : isOutlookActive
    ? "/logos/microsoft-icon.svg"
    : resolveSenderLogo(selectedAccount) || "/logos/google-gmail.svg";

  return (
    <div className="space-y-3 max-w-5xl">
      {/* Top Toolbar: Search Bar on LEFT, Account Selector on RIGHT */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        {/* LEFT: Search bar */}
        <div className="relative flex-1 sm:max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.emailPage.searchPlaceholder}
            className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161618] pl-8 pr-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600"
          />
        </div>

        {/* RIGHT: Dropdown with connected accounts (Strictly single account) */}
        <div className="relative self-end sm:self-auto" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setIsAccountDropdownOpen((prev) => !prev)}
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161618] px-2.5 py-1.5 text-xs font-semibold text-zinc-800 dark:text-zinc-200 shadow-2xs hover:bg-zinc-50 dark:hover:bg-zinc-900/60 transition-colors"
          >
            <div className="flex h-3.5 w-3.5 shrink-0 items-center justify-center overflow-hidden">
              <img src={activeAccountLogo} alt="" className="h-full w-full object-contain" />
            </div>
            <span className="truncate max-w-[240px] font-mono text-xs">{selectedAccountLabel}</span>
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 text-zinc-400 transition-transform duration-150",
                isAccountDropdownOpen && "rotate-180"
              )}
            />
          </button>

          {isAccountDropdownOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-72 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161618] p-1.5 shadow-lg z-30 animate-in fade-in-0 zoom-in-95">
              <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                {t.emailPage.connectedAccounts}
              </div>

              {/* Individual accounts only (Strictly single-account selection) */}
              {connectedEmailIntegrations.map((acc) => {
                const emailAddress = acc.accountEmail || acc.providerAccountId;
                const isSelected = selectedAccount === emailAddress;
                const isGmail =
                  acc.provider === "gmail" ||
                  acc.provider === "google" ||
                  emailAddress.toLowerCase().includes("@gmail.") ||
                  emailAddress.toLowerCase().includes("@googlemail.");
                const isOutlook =
                  acc.provider === "outlook" ||
                  acc.provider === "microsoft" ||
                  emailAddress.toLowerCase().includes("@outlook.") ||
                  emailAddress.toLowerCase().includes("@hotmail.") ||
                  emailAddress.toLowerCase().includes("@live.");
                const accLogo = isGmail
                  ? "/logos/google-gmail.svg"
                  : isOutlook
                  ? "/logos/microsoft-icon.svg"
                  : resolveSenderLogo(emailAddress) || "/logos/google-gmail.svg";

                return (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => {
                      setSelectedAccount(emailAddress);
                      setIsAccountDropdownOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-left transition-colors",
                      isSelected
                        ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                        : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-zinc-100 dark:bg-zinc-800 p-0.5 overflow-hidden">
                        <img src={accLogo} alt="" className="h-full w-full object-contain" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-mono">{emailAddress}</p>
                        <p className="text-[10px] text-zinc-400 font-medium">
                          {isGmail ? "Google Workspace" : "Microsoft Outlook"}
                        </p>
                      </div>
                    </div>
                    {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-zinc-500" />}
                  </button>
                );
              })}

              <div className="my-1 border-t border-zinc-200 dark:border-zinc-800" />

              {/* Manage / Connect Accounts in Settings */}
              <button
                type="button"
                onClick={() => {
                  setIsAccountDropdownOpen(false);
                  openSettings("integrations");
                }}
                className="w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-zinc-800/60 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>{t.emailPage.manageOrConnectMore}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Re-authentication Warning Banner when token is expired */}
      {reauthNeeded && (
        <div className="flex items-center justify-between p-3.5 rounded-xl border border-amber-300 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-200 text-xs shadow-2xs animate-in fade-in-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <p className="truncate">
              A sua sessão do Gmail expirou ou precisa de reautorização. Reconecte a conta para aceder aos emails mais recentes.
            </p>
          </div>
          <button
            type="button"
            onClick={() => openSettings("integrations")}
            className="ml-3 shrink-0 rounded-lg bg-amber-600 dark:bg-amber-500 px-2.5 py-1 text-xs font-semibold text-white hover:bg-amber-700 dark:hover:bg-amber-600 transition-colors shadow-2xs"
          >
            Reconectar
          </button>
        </div>
      )}

      {/* Main Content: Email List or Full Email Reader */}
      {selectedEmail ? (
        /* ================= FULL EMAIL READER VIEW ================= */
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161618] p-5 sm:p-6 shadow-2xs space-y-6 animate-in fade-in-0 duration-150">
          {/* Reader Top Bar */}
          <div className="flex items-center justify-between gap-3 pb-4 border-b border-zinc-200 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => setSelectedEmail(null)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>{t.emailPage.backToInbox}</span>
            </button>

            <div className="flex items-center gap-2">
              {/* Toggle Formatted HTML vs Plain Text when HTML exists */}
              {selectedEmail.htmlBody && (
                <div className="inline-flex items-center rounded-lg border border-zinc-200/90 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 p-0.5">
                  <button
                    type="button"
                    onClick={() => setReaderViewMode("html")}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all duration-150",
                      readerViewMode === "html"
                        ? "bg-zinc-200/90 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-300/50 dark:border-zinc-700/60 font-semibold shadow-2xs"
                        : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
                    )}
                  >
                    <Eye className="h-3.5 w-3.5" />
                    <span>{t.emailPage.formatted}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setReaderViewMode("text")}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all duration-150",
                      readerViewMode === "text"
                        ? "bg-zinc-200/90 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-300/50 dark:border-zinc-700/60 font-semibold shadow-2xs"
                        : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
                    )}
                  >
                    <FileText className="h-3.5 w-3.5" />
                    <span>{t.emailPage.plainText}</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Sender & Recipient Information */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200/80 dark:border-zinc-800">
            <div className="flex items-center gap-3">
              {/* Sender Logo or Initials Monogram Badge in Reader */}
              {(() => {
                const readerName = cleanSenderName(selectedEmail.sender, selectedEmail.senderEmail);
                const readerInitials = getSenderInitials(readerName, selectedEmail.senderEmail);
                const readerPalette = getSenderAvatarPalette(selectedEmail.senderEmail || readerName);
                return (
                  <div
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border shadow-2xs overflow-hidden select-none",
                      selectedLogo
                        ? "bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 p-1.5"
                        : cn(readerPalette.bg, readerPalette.border, readerPalette.text)
                    )}
                  >
                    {selectedLogo ? (
                      <img
                        src={selectedLogo}
                        alt={readerName}
                        className="h-full w-full object-contain"
                        loading="lazy"
                      />
                    ) : (
                      <span className="text-xs font-bold tracking-tight">
                        {readerInitials}
                      </span>
                    )}
                  </div>
                );
              })()}
              <div className="min-w-0">
                <p className="text-xs font-bold text-zinc-900 dark:text-white">
                  {cleanSenderName(selectedEmail.sender, selectedEmail.senderEmail)}{" "}
                  <span className="font-normal text-zinc-500 dark:text-zinc-400">
                    &lt;{selectedEmail.senderEmail}&gt;
                  </span>
                </p>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 font-mono truncate">
                  {t.emailPage.to}: {selectedEmail.recipientEmail || selectedEmail.accountEmail}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center">
              <span className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                {(() => {
                  const date = selectedEmail.date;
                  const time = selectedEmail.time;
                  if (!date || date === time || /^\d{1,2}:\d{2}/.test(date) || date.toLowerCase() === "today") {
                    return time || date;
                  }
                  return `${date}, ${time}`;
                })()}
              </span>
            </div>
          </div>

          {/* Email Subject Headline (positioned below sender) */}
          <div className="pt-1">
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-zinc-900 dark:text-white">
              {selectedEmail.subject}
            </h2>
          </div>

          {/* Email Body Content (Rich HTML with isolated sandboxed iframe or formatted text) */}
          <div className="py-2 relative">
            {isLoadingBody ? (
              <div className="flex items-center justify-center gap-2 py-12 text-zinc-400 text-xs">
                <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                <span>Loading full email content...</span>
              </div>
            ) : readerViewMode === "html" && selectedEmail.htmlBody ? (
              <EmailHtmlViewer html={selectedEmail.htmlBody} />
            ) : (
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30 p-5 text-xs sm:text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed whitespace-pre-line font-sans">
                {selectedEmail.body}
              </div>
            )}
          </div>

          {/* Attachments Section (if any) */}
          {selectedEmail.attachments && selectedEmail.attachments.length > 0 && (
            <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-2.5">
              <div className="flex items-center gap-1.5 text-zinc-500">
                <Paperclip className="h-3.5 w-3.5" />
                <span className="text-[11px] font-semibold uppercase tracking-wider">
                  {t.emailPage.attachments} ({selectedEmail.attachments.length})
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {selectedEmail.attachments.map((att, i) => {
                  const isPdf = att.name.toLowerCase().endsWith(".pdf");
                  const isImage = /\.(png|jpg|jpeg|gif|webp)$/i.test(att.name);
                  const isLive = !!att.attachmentId;

                  const previewUrl = isLive
                    ? `/api/integrations/google/gmail/attachment?messageId=${selectedEmail.id}&attachmentId=${att.attachmentId}&filename=${encodeURIComponent(att.name)}&accountEmail=${encodeURIComponent(selectedEmail.accountEmail || "")}&inline=true`
                    : null;

                  const downloadUrl = isLive
                    ? `/api/integrations/google/gmail/attachment?messageId=${selectedEmail.id}&attachmentId=${att.attachmentId}&filename=${encodeURIComponent(att.name)}&accountEmail=${encodeURIComponent(selectedEmail.accountEmail || "")}&inline=false`
                    : null;

                  return (
                    <div
                      key={i}
                      className="group flex items-center justify-between p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/40 hover:bg-zinc-100/70 dark:hover:bg-zinc-900/70 transition-all shadow-2xs gap-2"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div
                          className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-xs font-bold",
                            isPdf
                              ? "bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-400"
                              : isImage
                              ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                              : "bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20 text-blue-600 dark:text-blue-400"
                          )}
                        >
                          {isPdf ? "PDF" : isImage ? "IMG" : "DOC"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p
                            className="text-xs font-medium text-zinc-900 dark:text-white truncate"
                            title={att.name}
                          >
                            {att.name}
                          </p>
                          <p className="text-[10px] text-zinc-400 font-mono">{att.size}</p>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1 shrink-0">
                        {previewUrl && (
                          <a
                            href={previewUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Visualizar no navegador"
                            className="inline-flex items-center justify-center h-7 w-7 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-300 transition-colors"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </a>
                        )}
                        {downloadUrl ? (
                          <a
                            href={downloadUrl}
                            download={att.name}
                            title="Descarregar ficheiro"
                            className="inline-flex items-center justify-center h-7 w-7 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-300 transition-colors"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </a>
                        ) : (
                          <span className="text-[10px] text-zinc-400">Exemplo</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ================= EMAIL THREADS LIST & REAL PAGINATION ================= */
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161618] shadow-2xs overflow-hidden">
          {isLoadingPage ? (
            <div className="p-12 text-center flex flex-col items-center justify-center space-y-2 text-zinc-400">
              <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
              <p className="text-xs">Loading emails...</p>
            </div>
          ) : currentEmails.length > 0 ? (
            <div className="divide-y divide-zinc-200 dark:divide-zinc-800/80">
              {currentEmails.map((msg) => {
                const displayName = cleanSenderName(msg.sender, msg.senderEmail);
                const logoPath = resolveSenderLogo(msg.senderEmail || msg.sender);
                const initials = getSenderInitials(displayName, msg.senderEmail);
                const palette = getSenderAvatarPalette(msg.senderEmail || displayName);
                const cleanSubject = cleanHtmlEntities(msg.subject);
                const cleanSnippet = cleanHtmlEntities(msg.snippet);
                const formattedDate = formatDisplayDate(msg.date, msg.time);

                return (
                  <div
                    key={msg.id}
                    onClick={() => handleOpenEmail(msg)}
                    className={cn(
                      "group flex items-center justify-between py-2.5 px-3 sm:px-3.5 hover:bg-zinc-50 dark:hover:bg-zinc-900/60 cursor-pointer transition-colors relative",
                      msg.unread && "bg-blue-50/20 dark:bg-blue-950/[0.08]"
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0 pr-3 flex-1">
                      {/* Circular Avatar */}
                      <div
                        className={cn(
                          "relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full select-none overflow-hidden transition-transform duration-150 group-hover:scale-105",
                          logoPath
                            ? "bg-white dark:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-700/80 p-1.5 shadow-2xs"
                            : cn(palette.bg, palette.border, palette.text, "border shadow-2xs")
                        )}
                      >
                        {logoPath ? (
                          <img
                            src={logoPath}
                            alt={displayName}
                            className="h-full w-full object-contain"
                            loading="lazy"
                          />
                        ) : (
                          <span className="text-[11px] font-bold tracking-tight">
                            {initials}
                          </span>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p
                            className={cn(
                              "text-xs truncate max-w-[150px] sm:max-w-[190px] shrink-0",
                              msg.unread
                                ? "font-bold text-zinc-900 dark:text-white"
                                : "font-semibold text-zinc-700 dark:text-zinc-300"
                            )}
                          >
                            {displayName}
                          </p>
                          <span className="text-zinc-300 dark:text-zinc-700 text-[10px]">&bull;</span>
                          <p
                            className={cn(
                              "text-xs truncate",
                              msg.unread
                                ? "font-semibold text-zinc-900 dark:text-zinc-100"
                                : "font-normal text-zinc-600 dark:text-zinc-400"
                            )}
                          >
                            {cleanSubject}
                          </p>
                        </div>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-1 mt-0.5 leading-tight">
                          {cleanSnippet}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-2 text-right pl-2">
                      {msg.attachments && msg.attachments.length > 0 && (
                        <Paperclip className="h-3 w-3 text-zinc-400 shrink-0" />
                      )}
                      <span
                        className={cn(
                          "text-[11px] font-mono whitespace-nowrap tabular-nums",
                          msg.unread
                            ? "font-semibold text-blue-600 dark:text-blue-400"
                            : "text-zinc-400 dark:text-zinc-500"
                        )}
                      >
                        {formattedDate}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-8 text-center space-y-2">
              <Inbox className="h-8 w-8 text-zinc-400 mx-auto" />
              <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                {t.emailPage.noEmailsFound}
              </p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                {t.emailPage.noEmailsFoundDesc}
              </p>
            </div>
          )}

          {/* Real Pagination Controls (10 items per page, cursor-based) */}
          {currentEmails.length > 0 && (
            <div className="flex items-center justify-between gap-2 px-3.5 py-2 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30">
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">
                {interpolate(t.emailPage.showingCount, {
                  start: startNumber,
                  end: endNumber,
                })}
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={pageIndex === 0 || isLoadingPage}
                  onClick={handlePreviousPage}
                  className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161618] px-2.5 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  <span>{t.emailPage.previous}</span>
                </button>

                <button
                  type="button"
                  disabled={!currentNextPageToken || isLoadingPage}
                  onClick={handleNextPage}
                  className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161618] px-2.5 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  <span>{t.emailPage.next}</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
