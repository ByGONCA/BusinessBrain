import { createClient } from "@supabase/supabase-js";

async function measure() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  console.log("Measuring Supabase individual query latencies...");

  // 1. Measure simple query
  let t0 = performance.now();
  const { data: orgs, error: orgError } = await supabase
    .from("organizations")
    .select("id, name")
    .limit(1);
  let t1 = performance.now();
  console.log(`[1] organizations.select(limit 1): ${(t1 - t0).toFixed(2)}ms`, orgError ? orgError : `found ${orgs?.length}`);

  const orgId = orgs?.[0]?.id;
  if (!orgId) {
    console.log("No organization found.");
    return;
  }
  console.log("Using orgId:", orgId);

  // 2. organization_members query
  t0 = performance.now();
  const { data: members } = await supabase
    .from("organization_members")
    .select("id, organization_id, user_id, role")
    .eq("organization_id", orgId);
  t1 = performance.now();
  console.log(`[2] organization_members.select: ${(t1 - t0).toFixed(2)}ms (found ${members?.length})`);

  // 3. profiles query
  const userIds = members?.map((m) => m.user_id) || [];
  t0 = performance.now();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .in("id", userIds);
  t1 = performance.now();
  console.log(`[3] profiles.select: ${(t1 - t0).toFixed(2)}ms (found ${profiles?.length})`);

  // 4. subscriptions query
  t0 = performance.now();
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("id, plan, status, trial_start, trial_end")
    .eq("organization_id", orgId)
    .maybeSingle();
  t1 = performance.now();
  console.log(`[4] subscriptions.select: ${(t1 - t0).toFixed(2)}ms (${sub?.status})`);

  // 5. pages query
  t0 = performance.now();
  const { data: pages } = await supabase
    .from("pages")
    .select("id, title, position, is_archived")
    .eq("organization_id", orgId)
    .eq("is_archived", false);
  t1 = performance.now();
  console.log(`[5] pages.select (active): ${(t1 - t0).toFixed(2)}ms (found ${pages?.length})`);

  // 6. archived pages query
  t0 = performance.now();
  const { data: archived } = await supabase
    .from("pages")
    .select("id, title")
    .eq("organization_id", orgId)
    .eq("is_archived", true);
  t1 = performance.now();
  console.log(`[6] pages.select (archived): ${(t1 - t0).toFixed(2)}ms (found ${archived?.length})`);

  // Now measure ALL in series vs parallel
  console.log("\n--- BENCHMARK: Series vs Parallel Execution ---");

  t0 = performance.now();
  await supabase.from("organization_members").select("id").eq("organization_id", orgId);
  await supabase.from("subscriptions").select("id").eq("organization_id", orgId);
  await supabase.from("pages").select("id").eq("organization_id", orgId).eq("is_archived", false);
  await supabase.from("pages").select("id").eq("organization_id", orgId).eq("is_archived", true);
  t1 = performance.now();
  console.log(`Series (4 queries sequentially): ${(t1 - t0).toFixed(2)}ms`);

  t0 = performance.now();
  await Promise.all([
    supabase.from("organization_members").select("id").eq("organization_id", orgId),
    supabase.from("subscriptions").select("id").eq("organization_id", orgId),
    supabase.from("pages").select("id").eq("organization_id", orgId).eq("is_archived", false),
    supabase.from("pages").select("id").eq("organization_id", orgId).eq("is_archived", true),
  ]);
  t1 = performance.now();
  console.log(`Parallel (4 queries via Promise.all): ${(t1 - t0).toFixed(2)}ms`);
}

measure().catch(console.error);
