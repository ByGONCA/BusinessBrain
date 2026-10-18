import { test, expect } from "@playwright/test";

/**
 * Test 2: Aceitação Legítima com Utilizador Autenticado (Dependente de Staging Auth)
 * 
 * Pré-requisitos:
 * 1. Conta de teste autorizada em Staging: E2E_LEGIT_USER_EMAIL / E2E_LEGIT_USER_PASSWORD.
 * 2. Convite pendente emitido para o mesmo email da conta.
 * 
 * Comportamento validado:
 * 1. Login com conta de teste legítima.
 * 2. Acesso a /invite/[token].
 * 3. Botão 'Accept & Join' exibido e clicado.
 * 4. Validação dos atributos do cookie 'cb_active_org_id' (Path=/, HttpOnly, SameSite=lax).
 * 5. Destino final no dashboard ou pricing gating.
 */

test.describe("Invitation Flow — Legitimate Acceptance", () => {
  const legitEmail = process.env.E2E_LEGIT_USER_EMAIL || "test-invitee@staging-test.org";
  const legitPassword = process.env.E2E_LEGIT_USER_PASSWORD;

  test("deve aceitar convite, emitir cookie cb_active_org_id e encaminhar para dashboard", async ({ page, context }) => {
    // Se as credenciais de teste não estiverem no ambiente, saltar defensivamente sem falha falsa
    test.skip(!legitPassword, "Credenciais E2E_LEGIT_USER_PASSWORD não configuradas no ambiente.");

    // 1. Realizar Login Real via formulário
    await page.goto("/login");
    await page.fill('input[name="email"]', legitEmail);
    await page.fill('input[name="password"]', legitPassword!);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard|\/onboarding/);

    // 2. Navegar para o convite legítimo
    const inviteToken = process.env.E2E_TEST_INVITE_TOKEN;
    test.skip(!inviteToken, "Token de convite legítimo E2E_TEST_INVITE_TOKEN não fornecido.");

    await page.goto(`/invite/${inviteToken}`);
    const acceptBtn = page.getByRole("button", { name: /Accept & Join/i });
    await expect(acceptBtn).toBeVisible();

    // 3. Clicar em Aceitar
    await acceptBtn.click();

    // 4. Verificar que a UI entra em carregamento
    await expect(page.getByText(/Joining/i)).toBeVisible();

    // 5. Verificar o cookie 'cb_active_org_id'
    await page.waitForURL(/\/dashboard|\/pricing/);
    const cookies = await context.cookies();
    const activeOrgCookie = cookies.find((c) => c.name === "cb_active_org_id");

    expect(activeOrgCookie).toBeDefined();
    expect(activeOrgCookie?.path).toBe("/");
    expect(activeOrgCookie?.httpOnly).toBe(true);
    expect(activeOrgCookie?.sameSite.toLowerCase()).toBe("lax");
  });
});
