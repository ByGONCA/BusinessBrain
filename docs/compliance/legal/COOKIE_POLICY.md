# BusinessBrain Cookie & Session Storage Policy

> **Document Status**: Production Draft  
> **Effective Date**: October 2026  
> **Regulatory Reference**: Directive 2002/58/EC (ePrivacy Directive) as amended by Directive 2009/136/EC; Regulation (EU) 2016/679 (GDPR).

---

## 1. Principles of Transparency

BusinessBrain prioritizes user privacy and zero unauthorized tracking. We do not use third-party advertising cookies, behavioral tracking scripts, or data broker pixels.

---

## 2. Cookie Classification

Cookies deployed on BusinessBrain fall into two operational categories:

### A. Strictly Necessary Cookies (Exempt from Prior Consent under ePrivacy Art. 5(3))

These cookies are strictly required to operate the secure multi-tenant platform and authenticate sessions:

| Cookie Identifier | Origin | Lifecycle | Purpose |
| :--- | :--- | :--- | :--- |
| `sb-*-auth-token` | First-Party (Supabase) | Session / Persistent | Manages cryptographic session tokens and CSRF verification. |
| `cb_active_org_id` | First-Party | 1 Year | Holds the active workspace UUID to enforce tenant isolation. |

### B. Functional & Preference Cookies

These cookies store user interface display settings:

| Cookie Identifier | Origin | Lifecycle | Purpose |
| :--- | :--- | :--- | :--- |
| `cb_locale` | First-Party | 1 Year | Preserves selected UI language (EN, PT, ES, FR). |
| `cb_theme` | First-Party | 1 Year | Preserves selected visual theme (light, dark, system). |

---

## 3. Disabling Cookies

Because strictly necessary cookies are fundamental to authenticating accounts and securing tenant boundaries, disabling them in browser settings will cause the platform to fail to authenticate or function properly.
