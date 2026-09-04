import { test, expect, type Page } from "@playwright/test";

/**
 * Authenticated end-to-end money path against the seeded development database:
 * sign in → add to cart → COD checkout → order confirmation → order history,
 * then the admin view of the same order.
 *
 * Credentials come from prisma/seed.ts and exist only in local development.
 */
const CUSTOMER = { email: "customer@bharatcart.test", password: "Customer@12345" };
const ADMIN = { email: "admin@bharatcart.test", password: "Admin@12345" };

async function signIn(page: Page, user: { email: string; password: string }) {
  await page.goto("/login");
  await page.getByPlaceholder("Email").fill(user.email);
  await page.getByPlaceholder("Password").fill(user.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

test.describe("checkout", () => {
  test("customer can place a Cash-on-Delivery order", async ({ page }) => {
    await signIn(page, CUSTOMER);

    // Add a known in-stock product to the cart.
    await page.goto("/p/tusker-triply-kadai");
    await page.getByRole("button", { name: /add to cart/i }).click();
    await expect(page.getByRole("button", { name: /added/i })).toBeVisible();

    await page.goto("/cart");
    await expect(page.getByText(/Tusker Tri-Ply/i)).toBeVisible();
    await page.getByRole("link", { name: /proceed to checkout/i }).click();

    // Checkout: the seeded default address is preselected.
    await expect(page).toHaveURL(/\/checkout/);
    await expect(page.getByText(/Delivery address/i)).toBeVisible();
    await expect(page.getByText(/Order summary/i)).toBeVisible();

    // Totals come from the server-side recomputation, with the GST split shown.
    // Scope to the summary aside — the footer also mentions GST.
    const summary = page.locator("aside");
    await expect(summary.getByText(/Inclusive of GST/i)).toBeVisible();
    await expect(summary.getByText(/CGST|IGST/)).toBeVisible();

    // Choose Cash on Delivery and place the order.
    await page.getByText("Cash on Delivery").click();
    const placeOrder = page.getByRole("button", { name: /place order \(cod\)/i });
    await expect(placeOrder).toBeEnabled();
    await placeOrder.click();

    // Confirmation.
    await expect(page).toHaveURL(/\/order\/confirmation\//, { timeout: 20_000 });
    await expect(page.getByRole("heading", { name: /order confirmed/i })).toBeVisible();
    await expect(page.getByText(/BC-\d{4}-/)).toBeVisible();

    // The order now appears in the customer's history.
    await page.goto("/account/orders");
    await expect(page.getByText(/BC-\d{4}-/).first()).toBeVisible();

    // Cart was emptied by the confirmation.
    await page.goto("/cart");
    await expect(page.getByText(/your cart is empty/i)).toBeVisible();
  });

  test("admin can see the dashboard and manage orders", async ({ page }) => {
    await signIn(page, ADMIN);

    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Admin" })).toBeVisible();
    await expect(page.getByText("Revenue")).toBeVisible();
    await expect(page.getByText("Avg. order value")).toBeVisible();

    await page.goto("/admin/orders");
    await expect(page.getByRole("heading", { name: /orders/i })).toBeVisible();

    // Open the most recent order and confirm the management panel renders.
    const firstOrder = page.locator('a[href^="/admin/orders/"]').first();
    if (await firstOrder.count()) {
      await firstOrder.click();
      await expect(page.getByText(/Manage order/i)).toBeVisible();
      await expect(page.getByText(/Delivery address/i)).toBeVisible();
    }

    await page.goto("/admin/products");
    await expect(page.getByRole("heading", { name: /products/i })).toBeVisible();

    await page.goto("/admin/inventory");
    await expect(page.getByRole("heading", { name: /low stock/i })).toBeVisible();
  });

  test("a customer cannot reach the admin area", async ({ page }) => {
    await signIn(page, CUSTOMER);
    await page.goto("/admin");
    // Middleware sends non-admins back to the storefront.
    await expect(page).not.toHaveURL(/\/admin/);
  });
});
