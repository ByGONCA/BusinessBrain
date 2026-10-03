async function test() {
  console.log("Sending RSC request with dummy auth cookie...");
  const t0 = performance.now();
  const res = await fetch("http://localhost:3000/dashboard/tasks", {
    headers: {
      "rsc": "1",
      "Cookie": "sb-test-auth-token=dummy_token_value; cb_active_org_id=00000000-0000-0000-0000-000000000000",
    },
    redirect: "manual",
  });
  const t1 = performance.now();
  console.log(`Status: ${res.status}`);
  console.log(`Time: ${(t1 - t0).toFixed(1)}ms`);
  console.log(`Headers:`, Object.fromEntries(res.headers.entries()));
}

test().catch(console.error);
