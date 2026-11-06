import fs from "node:fs";

function getEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const f of [".env", ".env.local"]) {
    if (fs.existsSync(f)) {
      const lines = fs.readFileSync(f, "utf-8").split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eq = trimmed.indexOf("=");
        if (eq > 0) {
          env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
        }
      }
    }
  }
  return env;
}

const env = getEnv();

const checkList = [
  "STRIPE_SECRET_KEY",
  "STRIPE_CONNECT_CLIENT_ID",
  "STRIPE_WEBHOOK_SECRET",
  "GITHUB_CLIENT_ID",
  "GITHUB_CLIENT_SECRET",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "MICROSOFT_CLIENT_ID",
  "MICROSOFT_CLIENT_SECRET",
  "INTEGRATION_TOKEN_ENCRYPTION_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
];

const report = checkList.map((k) => {
  const val = env[k];
  const present = Boolean(val && val.length > 0);
  return {
    variable: k,
    present,
    prefix: present ? val.slice(0, 5) + "..." : "none",
  };
});

console.log(JSON.stringify(report, null, 2));
