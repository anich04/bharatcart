import { test, expect } from "@playwright/test";

/**
 * Happy path: browse → product → add to cart → cart → checkout gate.
 * Runs against the seeded local database.
 */

test("home page shows the catalog", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  // Category nav is populated from the database.
  await expect(page.getByRole("link", { name: "Fashion" }).first()).toBeVisible();
});

test("browse a category, filter and open a product", async ({ page }) => {
  await page.goto("/c/fashion");
  await expect(page.getByRole("heading", { name: "Fashion" })).toBeVisible();

  // Product cards render with rupee prices. Scope to the card — the filter
  // sidebar also contains a "Price (₹)" heading, which is collapsed on mobile.
  const firstCard = page.locator('a[href^="/p/"]').first();
  await expect(firstCard).toBeVisible();
  await expect(firstCard.getByText(/₹/).first()).toBeVisible();

  await firstCard.click();
  await expect(page).toHaveURL(/\/p\//);
  await expect(page.getByRole("button", { name: /add to cart/i })).toBeVisible();
});

test("search finds a product by keyword", async ({ page }) => {
  await page.goto("/search?q=kadai");
  await expect(page.getByText(/Results for/i)).toBeVisible();
  await expect(page.locator('a[href^="/p/"]').first()).toBeVisible();
});

test("search shows an empty state for nonsense", async ({ page }) => {
  await page.goto("/search?q=zzzqqqxyz");
  await expect(page.getByText(/No products found/i)).toBeVisible();
});

test("filters live in the URL and survive a reload", async ({ page }) => {
  await page.goto("/c/fashion?sort=price-asc");
  await expect(page).toHaveURL(/sort=price-asc/);
  await page.reload();
  // The select still reflects the URL state.
  await expect(page.locator("select")).toHaveValue("price-asc");
});

test("guest can add to cart and see it in the cart", async ({ page }) => {
  await page.goto("/p/tusker-triply-kadai");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  await page.getByRole("button", { name: /add to cart/i }).click();
  await expect(page.getByRole("button", { name: /added/i })).toBeVisible();

  await page.goto("/cart");
  await expect(page.getByRole("heading", { name: /your cart/i })).toBeVisible();
  await expect(page.getByText(/Tusker Tri-Ply/i)).toBeVisible();
  await expect(page.getByRole("link", { name: /proceed to checkout/i })).toBeVisible();
});

test("checkout requires signing in", async ({ page }) => {
  await page.goto("/checkout");
  await expect(page).toHaveURL(/\/login/);
});

test("private areas redirect anonymous users to login", async ({ page }) => {
  for (const path of ["/account", "/wishlist", "/admin"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login/);
  }
});

test("product page exposes Product JSON-LD for SEO", async ({ page }) => {
  await page.goto("/p/zaffron-wireless-earbuds");
  const ld = await page.locator('script[type="application/ld+json"]').first().textContent();
  expect(ld).toBeTruthy();
  const parsed = JSON.parse(ld!);
  expect(parsed["@type"]).toBe("Product");
  expect(parsed.offers.priceCurrency).toBe("INR");
});
