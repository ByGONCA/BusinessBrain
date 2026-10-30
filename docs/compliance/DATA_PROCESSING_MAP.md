# BusinessBrain Data Processing Inventory & Flow Map (ROPA)

> **Regulatory Reference**: Article 30 of the General Data Protection Regulation (EU 2016/679) — Record of Processing Activities (ROPA).  
> **Status**: Verified Operational Inventory  
> **Last Audited**: October 2026

---

## 1. Overview & Processing Roles

- **BusinessBrain as Data Controller**: When processing user credentials, billing account details, and marketing consent for platform accounts.
- **BusinessBrain as Data Processor**: When storing and processing proprietary organizational content (documents, tasks, internal wikis, team notes) on behalf of customer organizations under the [Data Processing Agreement (DPA)](./legal/DATA_PROCESSING_AGREEMENT.md).

---

## 2. Personal Data Categories & Retention Schedules

| Data Category | Specific Data Elements | Data Subjects | Purpose | Legal Basis (GDPR Art. 6) | Retention Period | Statutory Justification |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Identity & Account** | Email, full name, avatar URL, Supabase user UUID, password hash | Registered platform users | Authentication, session management, user profile display | Art. 6(1)(b) — Contract Performance | Duration of active account + 30 days post-erasure request | GDPR Art. 17 right to erasure |
| **Workspace Content** | Documents, company graphs, notes, task titles/descriptions | Organization team members | Knowledge management, team collaboration | Art. 6(1)(b) — Contract Performance | Maintained while workspace is active; deleted within 30 days of workspace deletion | Contractual terms / Customer instructions |
| **Billing & Fiscal Data** | Stripe customer ID, subscription ID, payment method token (last 4 digits, brand, exp), billing country, invoice records | Workspace billing owners | Payment processing, recurring subscriptions, tax compliance | Art. 6(1)(b) — Contract & Art. 6(1)(c) — Legal Obligation | **10 Years** (Portugal/EU) / **7 Years** (US IRS) | Portugal CIVA Art. 52, Art. 123.º CIRC; IRS audit rules. Preserved in immutable form. |
| **Security & Audit Logs** | IP address, timestamp, action type, user UUID, user-agent | All authenticated users | Fraud prevention, rate limiting, intrusion detection, tenant isolation verification | Art. 6(1)(f) — Legitimate Interests | **12 Months** rolling window | GDPR Recital 49 (network and information security) |
| **Marketing Consent** | Email, timestamp of opt-in, consent boolean | Users opting in to updates | Product update emails, newsletters | Art. 6(1)(a) — Consent (Freely Given) | Until consent revoked via 1-click unsubscribe or account deletion | ePrivacy Directive & GDPR Art. 7 |
| **System Cookies** | Session auth token, active organization UUID, UI locale, theme | Site visitors & users | Session persistence, tenant compartmentalization, localization | Art. 6(1)(f) / ePrivacy Art. 5(3) exemption (strictly necessary) | Session duration to 1 year | ePrivacy Directive Art. 5(3) strictly necessary exemption |

---

## 3. Subprocessor Inventory & Transfer Mechanisms

| Subprocessor | Processing Purpose | Entity Location | Processing Location | Transfer Mechanism & Safeguards | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Supabase Inc.** | PostgreSQL Database, Auth, Storage, Edge Functions | Delaware, USA | Frankfurt, Germany (EU-Central-1) / US East (Subject to Dashboard Verification) | EU-US Data Privacy Framework (DPF) & SCC (Pending Executed DPA Sign-off) | **PENDING_DASHBOARD_VERIFICATION** |
| **Stripe Payments Europe Ltd.** | Payment Processing, Invoicing, Tax Calculation | Dublin, Ireland | Ireland / Global Payment Network | Adequacy Decision (Ireland/EU) & SCC for global card processing | **Approved (EU Entity)** |
| **Vercel Inc.** | Next.js Serverless Edge Hosting, DNS, CDN | California, USA | Global Edge Nodes / EU Regional Compute | EU-US Data Privacy Framework (DPF) & SCC (Pending DPA Sign-off) | **PENDING_DPA_SIGNOFF** |
| **Resend Inc.** | Transactional Email Delivery (Verification, Password Reset) | California, USA | US East (AWS) | Standard Contractual Clauses (SCC) (Pending Executed SCC Review) | **PENDING_DPA_SIGNOFF** |

---

## 4. Technical & Organizational Security Measures (TOMs)

1. **Database-Level Isolation**: Every tenant query enforces PostgreSQL Row-Level Security (RLS) linked to verified organization memberships (`organization_id`).
2. **Encryption Standards**:
   - **In-Transit**: Mandatory TLS 1.3 encryption across all public and internal service boundaries. HSTS enforced.
   - **At-Rest**: AES-256 encryption applied at the physical storage layer (AWS RDS/PostgreSQL underlying Supabase) and application-level encryption for sensitive third-party OAuth access tokens.
3. **Deterministic Account Erasure**: Implementation of `requestAccountDeletionAction` ensures complete erasure of personal profiles while preventing sole owners from abandoning active corporate workspaces.
4. **Zero AI Foundation Training**: No customer workspace content or personal records are transmitted to third-party model providers or utilized for training public models.
