# BusinessBrain Legal Documents Inventory & Status Ledger

> **Status**: Comprehensive Document Register  
> **Last Audited**: October 2026

---

## 1. Document Inventory

| Document Title | Location | Format | Audience | Status | Last Reviewed | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Terms of Service** | `app/(marketing)/terms/page.tsx` & `docs/compliance/legal/TERMS_OF_SERVICE.md` | Web Route & Markdown | Public / Customers | **Production Draft** | 2026-10-28 | Contains `[OWNER_INPUT_REQUIRED: Legal Entity Name]` placeholder. Linked in signup & footer. |
| **Privacy Policy** | `app/(marketing)/privacy/page.tsx` & `docs/compliance/legal/PRIVACY_POLICY.md` | Web Route & Markdown | Public / Users | **Production Draft** | 2026-10-28 | Includes full subprocessor list, data subject rights, and statutory retention schedule. Linked in signup & footer. |
| **Cookie Policy** | `app/(marketing)/cookies/page.tsx` & `docs/compliance/legal/COOKIE_POLICY.md` | Web Route & Markdown | Public / Visitors | **Production Draft** | 2026-10-28 | Reflects strictly necessary session cookies. Linked in footer. |
| **Data Processing Agreement (DPA)** | `docs/compliance/legal/DATA_PROCESSING_AGREEMENT.md` | Markdown Template | B2B Enterprise Customers | **Draft Template** | 2026-10-28 | Incorporates EU Standard Contractual Clauses (SCC) and GDPR Art. 28 processor obligations. |
| **Subprocessor List** | `docs/compliance/DATA_PROCESSING_MAP.md` | Markdown Record | Regulators / Customers | **Active Record** | 2026-10-28 | Documents Supabase, Stripe, Vercel, Resend with transfer mechanisms. |
| **Regulatory Requirements Register** | `docs/compliance/LEGAL_REQUIREMENTS_REGISTER.json` | JSON Data File | Automated Quality Gates | **Machine Validated** | 2026-10-28 | Integrated into pre-build compliance check (`verify-compliance-gate.ts`). |
