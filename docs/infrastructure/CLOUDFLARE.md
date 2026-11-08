# Cloudflare Infrastructure Specification & Operating Guide

> **Domain**: `kogsync.com`  
> **Managing Entity**: Cloudflare Infrastructure Specialist Sub-Agent (`cloudflare-specialist`)  
> **MCP Implementation**: Dedicated Local Cloudflare API v4 MCP Server (`cloudflare-dns-mcp`)  
> **Status**: Production DNS Configured & Verified (Vercel Apex & Canonical WWW Active)  
> **Last Updated**: November 2026  

---

## 1. Overview & Dedicated MCP Server Architecture

Because standard Cloudflare NPM packages lack DNS/Zone operations and Cloudflare's hosted endpoint requires an interactive OAuth browser flow, we have engineered a **dedicated local Model Context Protocol (MCP) server** specifically for KogSync infrastructure management.

### Key Architecture Details
- **Server Path**: `C:\Users\gonca\.gemini\mcp-servers\cloudflare\index.js` (isolated completely outside the repository).
- **Protocol**: Standard MCP stdio transport using `@modelcontextprotocol/sdk` (v1.32.2) and Node.js native `fetch` over Cloudflare REST API v4 (`https://api.cloudflare.com/client/v4`).
- **Initial Mode**: Strict **READ-ONLY** (`CLOUDFLARE_ALLOW_MUTATIONS` is disabled by default).
- **Scope Restriction**: All zone and record operations dynamically target and resolve strictly to **`kogsync.com`**.
- **Secret Safety**: `CLOUDFLARE_API_TOKEN` is read strictly from `process.env.CLOUDFLARE_API_TOKEN` (or the MCP configuration env block). Credentials are never logged, echoed, or committed.

---

## 2. Available Cloudflare Specialist MCP Tools

| Tool Name | Operation | Security Mode | Description |
| :--- | :--- | :--- | :--- |
| **`cloudflare_verify_token`** | `GET /user/tokens/verify` | Read-Only | Verifies authentication status, validity, and scope of `MCP_AGY`. |
| **`cloudflare_get_zone`** | `GET /zones?name=kogsync.com` | Read-Only | Retrieves zone ID, status, nameservers, and development mode. |
| **`cloudflare_list_dns_records`** | `GET /zones/{id}/dns_records` | Read-Only | Lists all active authoritative records with optional type/name filters. |
| **`cloudflare_get_dnssec`** | `GET /zones/{id}/dnssec` | Read-Only | Retrieves DNSSEC cryptographic state, algorithm, and DS record status. |
| **`cloudflare_get_ssl_settings`** | `GET /zones/{id}/settings/ssl` | Read-Only | Retrieves edge SSL/TLS encryption mode ("full", "strict", etc.). |
| **`cloudflare_create_dns_record`** | `POST /zones/{id}/dns_records` | **Gated Mutation** | Creates DNS records. Blocked unless `CLOUDFLARE_ALLOW_MUTATIONS=true`. |
| **`cloudflare_update_dns_record`** | `PUT /zones/{id}/dns_records/{id}` | **Gated Mutation** | Updates DNS records. Blocked unless `CLOUDFLARE_ALLOW_MUTATIONS=true`. |
| **`cloudflare_delete_dns_record`** | `DELETE /zones/{id}/dns_records/{id}` | **Gated Mutation** | Deletes DNS records. Blocked unless `CLOUDFLARE_ALLOW_MUTATIONS=true`. |

---

## 3. Configuration in `mcp_config.json`

The server is already registered in `C:\Users\gonca\.gemini\config\mcp_config.json`, preserving all existing MCP configurations (`supabase`, `stripe`, `shadcn`, `chrome-devtools`):

```json
{
  "mcpServers": {
    "cloudflare": {
      "command": "node",
      "args": [
        "C:\\Users\\gonca\\.gemini\\mcp-servers\\cloudflare\\index.js"
      ],
      "env": {
        "CLOUDFLARE_API_TOKEN": "<PASTE_YOUR_MCP_AGY_TOKEN_HERE>"
      }
    }
  }
}
```

---

## 4. Verification & Validation Procedure

A non-destructive validation script has been placed at `C:\Users\gonca\.gemini\mcp-servers\cloudflare\validate.js`.

Once you paste your token into `mcp_config.json`:
1. Execute:
   ```powershell
   node "C:\Users\gonca\.gemini\mcp-servers\cloudflare\validate.js"
   ```
2. The validator will:
   - Verify token status against `https://api.cloudflare.com/client/v4/user/tokens/verify`.
   - Retrieve and confirm the `kogsync.com` zone ID.
   - List all authoritative DNS records.
   - Confirm DNSSEC status.
   - Output `SUCCESS: Cloudflare Specialist is fully operational!` without exposing the token value.

---

## 5. Intended DNS & Security Specifications (Recap)

1. **Vercel Edge Routing**:
   - Apex `kogsync.com`: `A` -> `76.76.21.21` (Start as **DNS Only / Gray Cloud**).
   - Canonical `www`: `CNAME` -> `cname.vercel-dns.com` (Start as **DNS Only / Gray Cloud**).
   - Staging `staging`: `CNAME` -> `cname.vercel-dns.com` (DNS Only).
2. **Email DNS Alignment (Resend)**:
   - SPF: `v=spf1 include:amazonses.com ~all` (Do not use `include:resend.com`).
   - DKIM: `resend._domainkey` (Values copied from Resend Dashboard).
   - DMARC: `v=DMARC1; p=none; rua=mailto:dpo@kogsync.com; sp=none; fo=1` (Monitoring phase).
3. **SSL/TLS & Edge Security**:
   - Initial Mode: **Full** (Upgraded to Full Strict only after Vercel origin certificate issuance is verified).
   - HSTS: **Deferred** until all hostnames operate stably on HTTPS for 14+ days.
   - WAF Exception: Narrowly scoped challenge/rate-limit bypass for `POST /api/webhooks/stripe` matching User-Agent `Stripe`, retaining Layer 7 DDoS and application HMAC validation.

---

## 6. Live DNS Records & Configuration Audit (Executed & Verified)

### Authoritative DNS Records

| Type | Name | Content | Proxied | TTL | Cloudflare Record ID | Purpose / Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **CNAME** | `kogsync.com` | `2dcc20b9baaf6c00.vercel-dns-017.com` | No (Gray Cloud) | Auto (1) | `344c6f6e46f050293b502ff0b478a457` | Vercel Apex Migration (CNAME Flattening Active) |
| **CNAME** | `www.kogsync.com` | `2dcc20b9baaf6c00.vercel-dns-017.com` | No (Gray Cloud) | Auto (1) | `a54e9383d563128efbfc92d105e277cf` | Vercel Canonical Migration |

> [!NOTE]
> Cloudflare automatically flattens apex CNAME records into authoritative A/AAAA responses (`64.29.17.1`, `216.198.79.1`), fully complying with RFC specifications while enabling Vercel dynamic anycast routing. Previous apex `A` record (`76.76.21.21`, ID `7b57091f40f3ab47aecf791934c062cc`) was retired during migration.

### Cryptographic & Edge Settings
- **Nameservers**: `leonidas.ns.cloudflare.com`, `ulla.ns.cloudflare.com`
- **DNSSEC**: **Active** (Algorithm 13 ECDSAP256SHA256, Flags 257, Key Tag 2371, Digest `B99F376BAA05DFD54FF82A8041882223D23DC27857F8EBAEF4F8F8D4333DEEEF`).
- **Token Scope & Permissions**: Active token `fa37a2b5...` possesses granular least-privilege permissions for `Zone.DNS` and `Zone.Read`/`DNSSEC.Read`. Edge SSL/TLS settings (`/settings/ssl`) require `Zone.Settings` permissions if managed via API; defaults to Cloudflare Full edge encryption for the zone.
- **SSL/TLS Encryption Mode Upgrade**: Valid Let's Encrypt certificates are active on Vercel origin. Manual dashboard upgrade to **Full (strict)** is documented in Section 8.
- **HSTS Policy**: Active header `Strict-Transport-Security: max-age=63072000; includeSubDomains`. All future subdomains (including `staging.kogsync.com`) must support valid HTTPS before activation.

---

## 8. SSL/TLS Mode & HSTS Policy Guidance

### A. SSL/TLS Upgrade to Full (Strict)
Because Vercel origin servers possess valid, trusted Let's Encrypt certificates for both `kogsync.com` and `www.kogsync.com`:
1. In [Cloudflare Dashboard](https://dash.cloudflare.com/), select `kogsync.com`.
2. Go to **SSL/TLS** -> **Overview**.
3. Select **Full (strict)** encryption mode.
*(Note: Because both records are currently DNS Only/Gray Cloud, traffic flows directly to Vercel without Cloudflare edge interception. Setting Full Strict ensures that if proxying is enabled in the future, edge validation will enforce valid origin certificates without downtime).*

### B. HSTS Architecture & Subdomain Policy
- **Active Header**: `Strict-Transport-Security: max-age=63072000; includeSubDomains`
- **Preload Status**: Omitted (deliberately avoided to prevent irreversible domain-wide lockouts).
- **Subdomain Requirement**: Any future subdomain (e.g. `staging.kogsync.com`) **MUST** serve a valid, trusted SSL/TLS certificate. Browsers that have visited the apex domain will refuse any insecure or self-signed HTTP traffic on subdomains due to `includeSubDomains`.

### Dependencies & Deferred Records
1. **Staging DNS (`staging.kogsync.com`)**:
   - **Status**: Deferred.
   - **Reason**: Vercel token expired and the dedicated staging branch/preview environment association has not yet been isolated. Pointing `staging` directly to Vercel without a designated preview branch risks routing staging traffic into the production deployment.
2. **Resend Email DNS (SPF, DKIM, DMARC)**:
   - **Status**: Deferred.
   - **Reason**: Resend domain API tokens and public DKIM key selectors (`resend._domainkey`) must be retrieved directly from the provisioned Resend dashboard. Under no circumstances should DKIM selectors or cryptographic keys be fabricated. Once the Resend domain is created, standard SPF (`v=spf1 include:amazonses.com ~all`) and Resend DKIM CNAMEs will be provisioned.

---

## 7. Rollback Procedures

Should any routing anomaly occur with production Vercel edge deployment:
1. **Apex Rollback to Legacy A Record**:
   - Delete CNAME record ID `344c6f6e46f050293b502ff0b478a457` (`kogsync.com` -> `2dcc20b9baaf6c00.vercel-dns-017.com`).
   - Re-create Apex `A` record `kogsync.com` -> `76.76.21.21` (DNS Only / Gray Cloud).
2. **Canonical www CNAME Rollback**:
   - Update CNAME record ID `a54e9383d563128efbfc92d105e277cf` back to target `cname.vercel-dns.com` (DNS Only / Gray Cloud).
3. **Emergency DNS Purge / Reset**:
   - Both records are currently operating as **DNS Only** (unproxied), meaning changes resolve at the TTL boundary (300s) directly from authoritative nameservers without Cloudflare edge proxy caching.
   - DNSSEC must remain untouched during rollback to avoid validation failures (`SERVFAIL`) across recursive resolvers.
