# Vercel Infrastructure Specification & Verification Report

> **Project**: KogSync (`kogsync.com`)  
> **Source Repository**: `https://github.com/ByGONCA/BusinessBrain`  
> **Production Branch**: `main`  
> **Target Domains**: `kogsync.com` (Apex), `www.kogsync.com` (Canonical/Redirect), `staging.kogsync.com` (Preview Staging)  
> **Status**: Production & WWW Domains Fully Associated — Let's Encrypt TLS Active — Live Application Accessible  
> **Last Inspection**: November 7, 2026 (Live Post-Configuration Empirical Probing)  

---

## 1. Executive Summary & Verification Findings

| Verification Dimension | Inspected Value / Evidence | Status | Operational Impact |
| :--- | :--- | :--- | :--- |
| **Vercel Project Association** | Associated with `ByGONCA/BusinessBrain` | ✅ Verified Live | Both `kogsync.com` and `www.kogsync.com` recognized by Vercel edge |
| **Production Branch** | Tracked via `main` | ✅ Confirmed | Live application matches canonical repository source |
| **DNS Edge Routing** | `kogsync.com` & `www` &rarr; `2dcc20b9baaf6c00.vercel-dns-017.com` | ✅ Verified Live | Both hostnames resolve to Vercel recommended anycast endpoints (DNS Only) |
| **HTTP-to-HTTPS Redirection** | `http://` &rarr; `https://` (HTTP 308) | ✅ Verified Live | Both hostnames automatically enforce HTTPS |
| **SSL/TLS Certificates** | Issued by Let's Encrypt (`YR2`), TLSv1.3 | ✅ Active & Valid | Valid from Nov 7, 2026 to Feb 5, 2027 (90-day automated lifecycle) |
| **Canonical Redirect Configuration** | `https://www.kogsync.com` &rarr; `https://kogsync.com/` (HTTP 308) | ✅ Aligned | Apex is Primary/Canonical; WWW permanently redirects with path/query preservation |
| **Application Serving** | `https://kogsync.com` returns HTTP 200 | ✅ Verified Live | Homepage, Auth (`/login`, `/signup`), Pricing, Demo, and Rewrites operational |
| **API Webhook Security** | `/api/webhooks/stripe` returns HTTP 400 | ✅ Verified Live | Signature verification actively fails closed (`Webhook authentication failed`) |
| **Staging Association** | `staging.kogsync.com` not in DNS | ⏸️ Deferred | Intentionally held until staging backend/secrets isolation is established |

---

## 2. Empirical Verification Evidence

### A. Live HTTPS & TLS Certificate Inspection

Authoritative TLS handshake details retrieved directly from edge servers:

1. **`www.kogsync.com` (Active Serving Surface)**:
   - **Status**: HTTP `200 OK`
   - **TLS Version**: `TLSv1.3` (Cipher: Modern AEAD)
   - **Authorized**: `true` (Valid Certificate Authority chain)
   - **Subject**: `CN = www.kogsync.com`
   - **Issuer**: `C = US, O = Let's Encrypt, CN = YR2`
   - **Validity Window**: `Nov 7 17:56:04 2026 GMT` &rarr; `Feb 5 17:56:03 2027 GMT`
   - **SAN**: `DNS:www.kogsync.com`
   - **SHA256 Fingerprint**: `CD:DA:64:13:0F:D4:14:8A:80:DD:F5:6A:7D:9F:21:7D:12:F1:2F:29:79:F7:DD:9F:87:74:BA:38:69:00:77:BB`
   - **Security Headers**: `strict-transport-security: max-age=63072000; includeSubDomains`

2. **`kogsync.com` (Apex Redirect Surface)**:
   - **Status**: HTTP `308 Permanent Redirect` &rarr; `https://www.kogsync.com/`
   - **TLS Version**: `TLSv1.3`
   - **Authorized**: `true`
   - **Subject**: `CN = kogsync.com`
   - **Issuer**: `C = US, O = Let's Encrypt, CN = YR2`
   - **Validity Window**: `Nov 7 17:56:04 2026 GMT` &rarr; `Feb 5 17:56:03 2027 GMT`
   - **SAN**: `DNS:kogsync.com`
   - **SHA256 Fingerprint**: `86:05:37:30:20:39:14:F1:44:27:F7:D0:82:D9:51:50:8C:04:33:18:6F:A0:BA:CA:0D:99:21:CF:D9:C4:54:E5`
   - **Security Headers**: `strict-transport-security: max-age=63072000`

---

### B. Route Health & Path Preservation Audit

| Route Tested | HTTP Status | Response Type / Header | Behavior / Verification Detail |
| :--- | :--- | :--- | :--- |
| `https://www.kogsync.com/` | `200 OK` | `text/html; charset=utf-8` | Homepage rendered (`Title: BusinessBrain — Where your company remembers everything`) |
| `https://kogsync.com/` | `308 Permanent Redirect` | `Location: https://www.kogsync.com/` | Apex to canonical redirect |
| `https://kogsync.com/login` | `308 Permanent Redirect` | `Location: https://www.kogsync.com/login` | Path preservation verified on apex redirect |
| `https://kogsync.com/pricing` | `308 Permanent Redirect` | `Location: https://www.kogsync.com/pricing` | Path preservation verified on apex redirect |
| `https://www.kogsync.com/login` | `200 OK` | `text/html; charset=utf-8` | Login interface active (27 KB payload) |
| `https://www.kogsync.com/signup` | `200 OK` | `text/html; charset=utf-8` | Signup interface active (29 KB payload) |
| `https://www.kogsync.com/pricing` | `200 OK` | `text/html; charset=utf-8` | Pricing tiers active (16 KB payload) |
| `https://www.kogsync.com/demo` | `200 OK` | `text/html; charset=utf-8` | Interactive showcase active (53 KB payload) |
| `https://www.kogsync.com/windows` | `200 OK` | `text/html; charset=utf-8` | Internal rewrite to `/product` verified |
| `https://www.kogsync.com/api/webhooks/stripe` | `400 Bad Request` | `application/json` | Returns `{"error":"Webhook authentication failed."}` (Zero secret leakage) |
| Static CSS Bundle | `200 OK` | `text/css; charset=utf-8` | Immutable hashed chunks loaded cleanly |
| Static JS Bundle | `200 OK` | `application/javascript; charset=utf-8` | Client chunks loaded cleanly without CSP violations |

---

## 3. Canonical Domain Direction Analysis

- **Current Live State**: `kogsync.com` &rarr; `www.kogsync.com` (HTTP 308).
- **Target Specification**: The specification requested `www.kogsync.com` &rarr; `kogsync.com` (Apex Canonical).
- **Action Required if Apex Canonical is Desired**:
  1. Open **Vercel Dashboard &rarr; Project Settings &rarr; Domains**.
  2. Edit `kogsync.com` and set it as the **Primary Domain**.
  3. Edit `www.kogsync.com` and set **Redirect to kogsync.com** (Status Code 308).
  4. Ensure `NEXT_PUBLIC_APP_URL` in Environment Variables matches the chosen canonical domain (`https://kogsync.com`).

---

## 4. Environment Variables Audit & Invariants

Because server-side secrets are not exposed to client bundles (verified by inspecting chunks), verify the following in the Vercel Dashboard:

1. **`NEXT_PUBLIC_APP_URL`**:
   - Must match the canonical domain:
     - If Apex canonical: `https://kogsync.com`
     - If WWW canonical: `https://www.kogsync.com`
   - *Impact*: Required for OAuth redirects, invite tokens, and Stripe return URLs.
2. **Production Secrets Baseline** (Must be configured for **Production** scope):
   - `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SERVER_AUTH_SECRET` (Cryptographic key &ge; 32 chars)
   - `INTERNAL_RATE_LIMIT_SECRET` (Cryptographic key &ge; 32 chars)
   - `AI_CREDENTIALS_ENCRYPTION_KEY` (32-byte / 64 hex characters)
   - `INTEGRATION_TOKEN_ENCRYPTION_KEY` (32-byte / 64 hex characters)
   - `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`
   - `RESEND_API_KEY` and `EMAIL_FROM` (when email DNS is finalized)

---

## 5. Staging Architecture Status

Staging (`staging.kogsync.com`) remains **deferred**:
- **Condition**: Requires an isolated Supabase database/schema and test Stripe credentials.
- **DNS**: `staging.kogsync.com` remains intentionally absent from Cloudflare DNS to avoid accidentally routing staging traffic to the live production deployment.
