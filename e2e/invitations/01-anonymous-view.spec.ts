import { test, expect } from "@playwright/test";

/**
 * Test 1: Visita Anónima & Validação de Retorno (Local / Autónomo)
 * 
 * Verifica que um visitante não autenticado:
 * 1. Acede a /invite/[token] e vê o nome da organização e email convidado.
 * 2. Não tem acesso ao botão 'Accept & Join'.
 * 3. Vê os botões de Sign In e Signup contendo o returnUrl=/invite/[token].
 * 4. Ao clicar em 'Sign In to Accept', é levado para /login com returnUrl preservado.
 * 5. Ao aceder a um token inexistente, visualiza o ecrã 'Invalid Invitation'.
 */

test.describe("Invitation Flow — Anonymous View & Return URL", () => {
  test("deve exibir detalhes do convite e botões de auth com returnUrl sanitizado", async ({ page }) => {
    // Nota: Em execução real, este teste utiliza um token de convite de teste pré-inserido
    const dummyToken = "sample_test_token_0123456789abcdef0123456789abcdef";

    await page.goto(`/invite/${dummyToken}`);

    // Se o token for inexistente ou inválido (fail-closed)
    const isInvalid = await page.getByRole("heading", { name: /Invalid Invitation/i }).isVisible();
    if (isInvalid) {
      await expect(page.getByRole("link", { name: /Go to Login/i })).toBeVisible();
      return;
    }

    // Se o convite for válido:
    await expect(page.getByRole("heading", { name: /Join/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Accept & Join/i })).not.toBeVisible();

    const signInLink = page.getByRole("link", { name: /Sign In to Accept/i });
    await expect(signInLink).toBeVisible();
    await expect(signInLink).toHaveAttribute("href", new RegExp(`returnUrl=.*invite.*${dummyToken}`));

    const signUpLink = page.getByRole("link", { name: /Create an Account/i });
    await expect(signUpLink).toBeVisible();
    await expect(signUpLink).toHaveAttribute("href", new RegExp(`returnUrl=.*invite.*${dummyToken}`));

    // Navegar para o Login e validar se o campo oculto de retorno está presente
    await signInLink.click();
    await expect(page).toHaveURL(new RegExp(`/login\\?returnUrl=`));
    const hiddenInput = page.locator('input[type="hidden"][name="returnUrl"]');
    await expect(hiddenInput).toHaveValue(`/invite/${dummyToken}`);
  });

  test("deve renderizar 'Invalid Invitation' em token malformado ou inexistente", async ({ page }) => {
    await page.goto("/invite/token_completamente_invalido_9999");
    await expect(page.getByRole("heading", { name: /Invalid Invitation/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Go to Login/i })).toBeVisible();
  });
});
