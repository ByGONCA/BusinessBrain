import { createClient } from "@supabase/supabase-js";

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const email = `test_dev_${Date.now()}@companybrain.io`;
  const password = "ComplexPassword123!@#";

  console.log("Attempting sign up with:", email);
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    console.error("Sign up error:", error);
  } else {
    console.log("User created:", data.user?.id);
    console.log("Has session:", !!data.session);
  }
}

main().catch(console.error);
