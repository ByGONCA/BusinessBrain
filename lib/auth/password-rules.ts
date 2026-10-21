/**
 * Password Policy Rules & Verification for Company Brain
 * 
 * Enforces security requirements aligned with Supabase Auth policy:
 * - Minimum 8 characters
 * - At least one lowercase letter (a-z)
 * - At least one uppercase letter (A-Z)
 * - At least one number (0-9)
 * - At least one symbol / special character (!@#$%^&*...)
 */

export interface PasswordRequirement {
  id: "length" | "lowercase" | "uppercase" | "number" | "special";
  label: string;
  test: (p: string) => boolean;
}

export const SPECIAL_CHARS_REGEX = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/;

export const PASSWORD_REQUIREMENTS: PasswordRequirement[] = [
  {
    id: "length",
    label: "At least 8 characters",
    test: (p: string) => (p || "").length >= 8,
  },
  {
    id: "lowercase",
    label: "At least one lowercase letter (a-z)",
    test: (p: string) => /[a-z]/.test(p || ""),
  },
  {
    id: "uppercase",
    label: "At least one uppercase letter (A-Z)",
    test: (p: string) => /[A-Z]/.test(p || ""),
  },
  {
    id: "number",
    label: "At least one number (0-9)",
    test: (p: string) => /[0-9]/.test(p || ""),
  },
  {
    id: "special",
    label: "At least one special character (!@#$%...)",
    test: (p: string) => SPECIAL_CHARS_REGEX.test(p || ""),
  },
];

export interface PasswordValidationResult {
  results: Record<PasswordRequirement["id"], boolean>;
  allMet: boolean;
  metCount: number;
  totalCount: number;
  strength: "none" | "weak" | "fair" | "good" | "strong";
  errors: string[];
}

export function checkPasswordRequirements(password: string = ""): PasswordValidationResult {
  const results = {
    length: PASSWORD_REQUIREMENTS[0].test(password),
    lowercase: PASSWORD_REQUIREMENTS[1].test(password),
    uppercase: PASSWORD_REQUIREMENTS[2].test(password),
    number: PASSWORD_REQUIREMENTS[3].test(password),
    special: PASSWORD_REQUIREMENTS[4].test(password),
  };

  const metCount = Object.values(results).filter(Boolean).length;
  const allMet = metCount === PASSWORD_REQUIREMENTS.length;

  const errors: string[] = [];
  PASSWORD_REQUIREMENTS.forEach((req) => {
    if (!results[req.id]) {
      errors.push(req.label);
    }
  });

  let strength: PasswordValidationResult["strength"] = "none";
  if (metCount === 5) {
    strength = "strong";
  } else if (metCount >= 3) {
    strength = "good";
  } else if (metCount >= 2) {
    strength = "fair";
  } else if (metCount >= 1) {
    strength = "weak";
  }

  return {
    results,
    allMet,
    metCount,
    totalCount: PASSWORD_REQUIREMENTS.length,
    strength,
    errors,
  };
}
