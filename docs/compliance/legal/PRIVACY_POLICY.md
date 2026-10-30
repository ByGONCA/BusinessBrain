# BusinessBrain Global Privacy Policy

> **Document Status**: Production Draft  
> **Effective Date**: October 2026  
> **Version**: 1.2  
> `[OWNER_INPUT_REQUIRED: Legal Entity Name, DPO Contact Email, Physical Address]`

---

## 1. Introduction & Controller Identification

This Privacy Policy explains how **BusinessBrain** (`[OWNER_INPUT_REQUIRED: Legal Entity Name]`, &quot;we&quot;, &quot;us&quot;, &quot;our&quot;) processes personal data collected through our platform, websites, and APIs.

For platform user accounts, authentication, and billing management, BusinessBrain acts as the **Data Controller**. For proprietary data uploaded to workspaces by customer team members, your organization acts as the **Data Controller**, and BusinessBrain acts as a **Data Processor** under our Data Processing Agreement.

**Contact Details**:  
Data Protection Officer (DPO): `[OWNER_INPUT_REQUIRED: dpo@businessbrain.io]`  
General Privacy Inquiries: `[OWNER_INPUT_REQUIRED: privacy@businessbrain.io]`  
Registered Address: `[OWNER_INPUT_REQUIRED: Physical Address, Portugal]`

---

## 2. Personal Data We Collect

1. **Identity & Authentication**: Name, email address, password hash, avatar URL, authentication provider ID (Supabase Auth / GitHub OAuth).
2. **Billing & Commercial Details**: Billing address, VAT number, transaction identifiers. Payment cards are tokenized and processed directly by Stripe Payments Europe Ltd. (PCI-DSS Level 1 compliant); full card numbers never touch our servers.
3. **Workspace Collaborator Content**: Documents, notes, meeting summaries, task graphs, activity logs.
4. **Technical & Telemetry**: IP address, user-agent, session identifiers, rate limit counters.

---

## 3. Legal Bases for Processing (GDPR Article 6)

- **Performance of Contract (Art. 6(1)(b))**: Provisioning user accounts, workspace isolation, team collaboration features, and customer support.
- **Legal Obligations (Art. 6(1)(c))**: Retaining mandatory tax, fiscal, and accounting records pursuant to Portugal CIVA Art. 52, CIRC Art. 123.º (10 years) and EU invoicing directives.
- **Legitimate Interests (Art. 6(1)(f))**: Platform security, defense against denial-of-service/brute-force attacks, multi-tenant isolation monitoring.
- **Consent (Art. 6(1)(a))**: Optional product updates and newsletters. Marketing consent is strictly opt-in and unselected by default.

---

## 4. Subprocessor Disclosure & Data Transfers

We partner with the following vetted infrastructure subprocessors:

| Subprocessor | Purpose | Location | Transfer Safeguard |
| :--- | :--- | :--- | :--- |
| **Supabase Inc.** | Core database & authentication hosting | EU (Frankfurt) / US | EU-US Data Privacy Framework / SCC |
| **Stripe Payments Europe Ltd.** | Payment gateway & tax invoicing | Ireland / Global | EU Adequacy Decision / SCC |
| **Vercel Inc.** | Serverless application compute & CDN | Global / EU | EU-US Data Privacy Framework / SCC |
| **Resend Inc.** | Transactional system email dispatch | US | Standard Contractual Clauses (SCC) |

---

## 5. Data Subject Rights & Account Erasure

You have the statutory right under GDPR, CCPA, and LGPD to:
1. **Access & Portability (Art. 15, 20)**: Download an export of your personal profile and workspace data in standard JSON format via Workspace Settings.
2. **Rectification (Art. 16)**: Update profile details directly within the platform.
3. **Erasure / Right to be Forgotten (Art. 17)**: Submit an account erasure request in Settings. Upon confirmation (&quot;DELETE&quot;), personal identifiers are permanently scrubbed. Statutory accounting logs are preserved in anonymized form.
4. **Withdraw Consent**: Unsubscribe from marketing communications at any time.

---

## 6. Security Architecture

We apply comprehensive technical and organizational measures (TOMs), including PostgreSQL Row-Level Security, TLS 1.3 in-transit encryption, AES-256 secret encryption, and strict rate limiting.
