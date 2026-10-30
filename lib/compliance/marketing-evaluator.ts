/**
 * Cross-Border Marketing Compliance Evaluator
 *
 * Evaluates commercial campaigns, emails, SMS, and advertising tracking
 * against country-specific statutory regimes without imposing false universal rules.
 */

import {
  MarketingAudience,
  MarketingChannel,
  MarketingComplianceRow,
  RiskLevel,
  ComplianceVerdict,
} from "./types";

export interface CampaignParameters {
  campaign_name: string;
  target_markets: string[];
  channel: MarketingChannel;
  audience: MarketingAudience;
  has_prior_opt_in?: boolean;
  is_existing_customer?: boolean;
  has_clear_opt_out_link?: boolean;
  has_sender_physical_address?: boolean;
  has_commercial_identification?: boolean;
  tracking_pixels_used?: boolean;
}

export function evaluateMarketChannel(
  market: string,
  channel: MarketingChannel,
  audience: MarketingAudience,
  params: Partial<CampaignParameters>
): MarketingComplianceRow {
  const m = market.toUpperCase();

  // 1. UNITED STATES (US)
  if (m === "US") {
    if (channel === "EMAIL") {
      // CAN-SPAM Act (15 U.S.C. § 7701 et seq.)
      const compliant =
        params.has_clear_opt_out_link &&
        params.has_sender_physical_address &&
        params.has_commercial_identification;

      return {
        market: "US",
        channel,
        audience,
        consent_requirement: "Opt-out regime (CAN-SPAM). Prior opt-in is NOT required for commercial email, but functional 30-day opt-out mechanism must be provided and honored within 10 business days.",
        mandatory_disclosures: [
          "Accurate Header Information (From/To/Routing)",
          "Non-deceptive Subject Line",
          "Clear Identification as an Advertisement",
          "Valid Physical Postal Address of Sender",
          "Clear and Conspicuous Opt-Out Mechanism",
        ],
        advertising_restrictions: [
          "California CCPA/CPRA: 'Do Not Sell or Share My Personal Information' notice if behavioral data is transferred",
          "FTC Act Section 5: Truth in Advertising substantiation",
        ],
        personal_data_handling: "Comply with state opt-out requests (California CCPA, Virginia VCDPA, Colorado CPA, Texas TDPSA).",
        language_requirements: "English (standard commercial language).",
        official_sources: [
          "15 U.S.C. § 7704 (CAN-SPAM Act)",
          "16 C.F.R. Part 316 (FTC CAN-SPAM Rule)",
          "Cal. Civ. Code § 1798.120 (CCPA Opt-Out of Sale/Sharing)",
        ],
        risk_level: compliant ? "LOW" : "HIGH",
        verdict: compliant ? "APPROVED" : "APPROVED_WITH_CONDITIONS",
      };
    }

    if (channel === "SMS") {
      // TCPA (47 U.S.C. § 227)
      const hasConsent = params.has_prior_opt_in === true;
      return {
        market: "US",
        channel,
        audience,
        consent_requirement: "Prior express written consent required under TCPA (47 U.S.C. § 227) and FCC rules for autodialed or prerecorded promotional text messages.",
        mandatory_disclosures: ["Sender identity", "Opt-out instructions ('Reply STOP to cancel')", "Msg & Data rates disclosure"],
        advertising_restrictions: ["Do Not Call registry screening", "Time-of-day restrictions (8am - 9pm local recipient time)"],
        personal_data_handling: "Maintain internal opt-out suppression list indefinitely.",
        language_requirements: "English.",
        official_sources: ["47 U.S.C. § 227 (TCPA)", "47 C.F.R. § 64.1200"],
        risk_level: hasConsent ? "LOW" : "CRITICAL",
        verdict: hasConsent ? "APPROVED" : "BLOCKED",
      };
    }
  }

  // 2. EUROPEAN UNION / PORTUGAL (EU / PT)
  if (m === "EU" || m === "PT" || m === "ES" || m === "FR" || m === "DE") {
    if (channel === "EMAIL") {
      // e-Privacy Directive (2002/58/EC Art. 13) & GDPR (Regulation (EU) 2016/679)
      const isSoftOptIn =
        audience === "B2C" &&
        params.is_existing_customer &&
        params.has_clear_opt_out_link;

      const hasConsent = params.has_prior_opt_in === true;

      if (audience === "B2C") {
        const approved = hasConsent || isSoftOptIn;
        return {
          market: m,
          channel,
          audience,
          consent_requirement: isSoftOptIn
            ? "Soft Opt-In Exception (e-Privacy Art. 13(2)): Allowed only for existing customers where contact details were collected during a sale of similar products/services, with clear opt-out given at collection and in each message."
            : "Prior Freely Given, Specific, Informed, Unambiguous Opt-In Consent (GDPR Art. 6(1)(a) & Art. 7, e-Privacy Art. 13(1)). Pre-ticked boxes strictly prohibited.",
          mandatory_disclosures: [
            "Clear identity of the sender/promoter",
            "Valid physical/postal address",
            "Direct unsubscribe link in every communication",
            "Link to Privacy Policy explaining data rights (GDPR Art. 13/14)",
          ],
          advertising_restrictions: [
            "Prohibition of misleading sender name or disguised commercial nature",
            "Germany (UWG § 7): Evidentiary double opt-in (DOI) standard strongly recommended to prove consent in court",
          ],
          personal_data_handling: "Right of withdrawal of consent at any time (GDPR Art. 7(3)) and Right to object to direct marketing (GDPR Art. 21(2)).",
          language_requirements: m === "FR" ? "French required under Toubon Law for French recipients" : "Local language or language agreed with user.",
          official_sources: [
            "Directive 2002/58/EC (e-Privacy Directive), Article 13",
            "Regulation (EU) 2016/679 (GDPR), Articles 6, 7, 13, 21",
            "Portugal: Lei n.º 41/2004, de 18 de agosto (alterada pela Lei n.º 46/2012)",
          ],
          risk_level: approved ? "LOW" : "HIGH",
          verdict: approved ? "APPROVED" : "BLOCKED",
        };
      } else {
        // B2B email in EU
        // Note: National transpositions vary! E.g. UK/ES allow B2B without prior consent if relevant; DE and IT require consent even for B2B under strict UWG/Privacy Code.
        const isStrictCountry = m === "DE";
        return {
          market: m,
          channel,
          audience: "B2B",
          consent_requirement: isStrictCountry
            ? "Strict Opt-In Required (Germany UWG § 7(2) Nr. 2 requires prior express consent even for B2B cold email)."
            : "Opt-out with Legitimate Interest under GDPR Art. 6(1)(f) and national e-Privacy transposition for corporate email, provided message relates strictly to recipient's business function and includes easy opt-out.",
          mandatory_disclosures: ["Company identity & registration number", "Unsubscribe link", "Privacy notice"],
          advertising_restrictions: ["Must be relevant to the recipient's professional role"],
          personal_data_handling: "Respect GDPR Art. 21 right to object.",
          language_requirements: "Local official language or English if international business context.",
          official_sources: [
            "Directive 2002/58/EC, Article 13(5)",
            "Germany: Gesetz gegen den unlauteren Wettbewerb (UWG) § 7",
            "EDPB Guidelines on Direct Marketing",
          ],
          risk_level: "MEDIUM",
          verdict: "APPROVED_WITH_CONDITIONS",
        };
      }
    }
  }

  // 3. UNITED KINGDOM (GB / UK)
  if (m === "GB" || m === "UK") {
    if (channel === "EMAIL") {
      // PECR 2003 (SI 2003/2426) & UK GDPR / Data Protection Act 2018
      const isCorporate = audience === "B2B";
      const hasConsent = params.has_prior_opt_in === true || params.is_existing_customer;

      return {
        market: "GB",
        channel,
        audience,
        consent_requirement: isCorporate
          ? "Corporate Subscribers Exception (PECR Reg 22(1)): Prior consent is NOT required for emails sent to corporate subscribers (Ltd, PLC, LLP, gov bodies), but sender must identify themselves and provide opt-out. UK GDPR applies to personal corporate email addresses (e.g. john.doe@company.com)."
          : "Individual Subscribers: Prior Opt-In required under PECR Reg 22, unless Soft Opt-In applies (existing customers, similar products/services, clear opt-out given).",
        mandatory_disclosures: [
          "Sender identity",
          "Valid contact address",
          "Simple unsubscribe mechanism",
        ],
        advertising_restrictions: ["ASA CAP Code compliance", "CMA Green Claims Code if environmental claims are made"],
        personal_data_handling: "UK GDPR Art. 21 right to object must be processed immediately.",
        language_requirements: "English.",
        official_sources: [
          "Privacy and Electronic Communications Regulations 2003 (PECR), Regulation 22",
          "Data Protection Act 2018 / UK GDPR",
          "ICO Guidance on Direct Marketing using Electronic Mail",
        ],
        risk_level: (isCorporate || hasConsent) ? "LOW" : "HIGH",
        verdict: (isCorporate || hasConsent) ? "APPROVED" : "BLOCKED",
      };
    }
  }

  // 4. CANADA (CA)
  if (m === "CA") {
    // CASL (S.C. 2010, c. 23)
    const hasConsent = params.has_prior_opt_in === true;
    return {
      market: "CA",
      channel,
      audience,
      consent_requirement: "Strict Opt-In Regime (CASL Section 6). Prior express consent required for commercial electronic messages (CEMs) to B2C AND B2B, unless narrow implied consent applies (existing business relationship within 2 years, or inquiry within 6 months).",
      mandatory_disclosures: [
        "Identity of sender and business name",
        "Physical mailing address and either phone number, email, or web address",
        "Functional unsubscribe mechanism active for at least 60 days, processed within 10 business days",
      ],
      advertising_restrictions: [
        "Competition Act Section 74.01 (False or misleading representations)",
        "Quebec Law 25: Express, separate consent for tracking/profiling technologies",
      ],
      personal_data_handling: "PIPEDA and Quebec Law 25 requirements for consent and record-keeping.",
      language_requirements: "English and French (Quebec Charter of the French Language requires French in commercial communications directed at Quebec).",
      official_sources: [
        "An Act to promote the efficiency and adaptability of the Canadian economy (CASL), S.C. 2010, c. 23",
        "CRTC Compliance and Enforcement Regulatory Policy CRTC 2012-183",
        "Quebec Law 25 (CQLR c P-39.1)",
      ],
      risk_level: hasConsent ? "LOW" : "HIGH",
      verdict: hasConsent ? "APPROVED" : "BLOCKED",
    };
  }

  // 5. BRAZIL (BR)
  if (m === "BR") {
    const compliant = params.has_clear_opt_out_link && params.has_commercial_identification;
    return {
      market: "BR",
      channel,
      audience,
      consent_requirement: "Legitimate Interest (LGPD Art. 7(IX)) or Consent (Art. 7(I)). In B2C, Código de Defesa do Consumidor (CDC Art. 37/43) and Self-Regulatory Code (CAPEM) require transparency, clear commercial identification, and immediate opt-out mechanism.",
      mandatory_disclosures: [
        "Clear identification of the promoter and CNPJ/corporate details",
        "Direct and free unsubscribe mechanism",
        "Explanation of how recipient data was collected",
      ],
      advertising_restrictions: [
        "Prohibition of abusive or misleading advertising (CDC Art. 37)",
        "CONAR (Conselho Nacional de Autorregulamentação Publicitária) advertising code",
      ],
      personal_data_handling: "LGPD Art. 18 data subject rights (confirmation, access, deletion, revoking consent).",
      language_requirements: "Portuguese (mandatory for B2C consumer offers under CDC Art. 31).",
      official_sources: [
        "Lei n.º 13.709/2018 (Lei Geral de Proteção de Dados - LGPD)",
        "Lei n.º 8.078/1990 (Código de Defesa do Consumidor - CDC), Arts. 31, 37, 43",
        "Código de Autorregulamentação para a Prática de E-mail Marketing (CAPEM)",
      ],
      risk_level: compliant ? "LOW" : "MEDIUM",
      verdict: compliant ? "APPROVED" : "APPROVED_WITH_CONDITIONS",
    };
  }

  // Default / Other Jurisdictions
  return {
    market: m,
    channel,
    audience,
    consent_requirement: "Jurisdiction-specific investigation required. Do not assume universal opt-in or opt-out without verifying national statutes.",
    mandatory_disclosures: ["Sender identity", "Clear commercial intent", "Direct unsubscribe link"],
    advertising_restrictions: ["Avoid unsubstantiated claims"],
    personal_data_handling: "Ensure verifiable lawful basis and right to object.",
    language_requirements: "Primary language of target market.",
    official_sources: ["Local statutory code and competent consumer protection authority"],
    risk_level: "INDETERMINATE",
    verdict: "INDETERMINATE",
  };
}

export function generateMarketingComplianceMatrix(
  params: CampaignParameters
): MarketingComplianceRow[] {
  const rows: MarketingComplianceRow[] = [];
  for (const market of params.target_markets) {
    rows.push(
      evaluateMarketChannel(market, params.channel, params.audience, params)
    );
  }
  return rows;
}
