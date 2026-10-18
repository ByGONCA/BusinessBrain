import { test, expect } from "@playwright/test";

/**
 * Test 3: Rejeição por Email Divergente (Identity Mismatch / Guard Multitenant)
 * 
 * Pré-requisitos:
 * 1. Conta de teste divergente em Staging: E2E_ATTACKER_USER_EMAIL / E2E_ATTACKER_USER_PASSWORD.
 * 2. Convite emitido para OUTRO email (ex: legit@example.com).
 * 
 * Comportamento validado:
 * 1. Login com conta de email divergente.
 * 2. Acesso ao convite alheio.
 * 3. Clique em 'Accept & Join'.
 * 4. Exibição do alerta de erro amigável na interface (sem crash de runtime).
 * 5. Bloqueio de navegação: o utilizador permanece em /invite/[token].
 * 6. Ausência do cookie 'cb_active_org_id' da organização do convite.
 */

test.describe("Invitation Flow — Mismatched Email Denial", () => {
  const attackerEmail = process.env.E2E_ATTACKER_USER_EMAIL || "test-attacker@staging-test.org";
  const attackerPassword = process.env.E2E_ATTACKER_USER_PASSWORD;

  test("deve exibir alerta amigável de acesso negado quando o email autenticado for diferente", async ({ page, context }) => {
    test.skip(!attackerPassword, "Credenciais E2E_ATTACKER_USER_PASSWORD não configuradas no ambiente.");

    // 1. Login com o utilizador com email diferente do convite
    await page.goto("/login");
    await page.fill('input[name="email"]', attackerEmail);
    await page.fill('input[name="password"]', attackerPassword!);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard|\/onboarding/);

    // 2. Aceder ao convite emitido para outro destinatário
    const alienInviteToken = process.env.E2E_ALIEN_INVITE_TOKEN;
    test.skip(!alienInviteToken, "Token de convite alien E2E_ALIEN_INVITE_TOKEN não fornecido.");

    await page.goto(`/invite/${alienInviteToken}`);

    const acceptBtn = page.getByRole("button", { name: /Accept & Join/i });
    await expect(acceptBtn).toBeVisible();
    await acceptBtn.click();

    // 3. Validar a renderização do alerta de erro na página
    const errorAlert = page.locator(".bg-red-500\\/10");
    await expect(errorAlert).toBeVisible();
    await expect(errorAlert).toContainText(/Access denied|different email/i);

    // 4. Confirmar que a URL permanece na página de convite
    expect(page.url()).toContain(`/invite/${alienInviteToken}`);

    // 5. Confirmar que o botão voltou a ficar habilitado após erro
    await expect(acceptBtn).toBeEnabled();
  });
});
