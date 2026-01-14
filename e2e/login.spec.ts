import { test, expect } from '@playwright/test';

test('login page has title and login form', async ({ page }) => {
    await page.goto('/login');

    // Check title
    await expect(page).toHaveTitle(/SportMaps/);

    // Check for email and password fields
    await expect(page.getByPlaceholder('tu@email.com')).toBeVisible();
    await expect(page.getByPlaceholder('••••••••')).toBeVisible();

    // Check for login button
    await expect(page.getByRole('button', { name: /Iniciar Sesión/i })).toBeVisible();
});

test('navigation to register page', async ({ page }) => {
    await page.goto('/login');

    await page.click('text=Regístrate aquí');

    await expect(page).toHaveURL(/\/register/);
});
