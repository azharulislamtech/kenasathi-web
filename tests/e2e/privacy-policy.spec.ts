import { expect, test } from "@playwright/test";

// R2.7: privacy policy in Bangla with the retention rules from the R9.2 data map.
test("privacy policy is Bangla, states retention rules and fits a 390px phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/privacy-policy");
  await expect(page.getByRole("heading", { level: 1, name: "গোপনীয়তা নীতি" })).toBeVisible();
  await expect(page.getByTestId("privacy-promise")).toContainText("প্রচারের মেসেজে ব্যবহার করি না");
  for (const heading of ["অর্ডারের তথ্য", "“আগ্রহ জানান” তালিকা", "WhatsApp খবর", "দেখা, ঠিক করা বা মুছে ফেলার অনুরোধ"]) {
    await expect(page.getByRole("heading", { level: 2, name: heading })).toBeVisible();
  }
  const body = page.locator("body");
  for (const rule of ["২ বছর", "৬ বছর", "৩০ দিন", "৬ মাস", "১২ মাস", "broadcast list"]) {
    await expect(body).toContainText(rule);
  }
  // One number for calls and WhatsApp: a tel: link and a wa.me link.
  const main = page.locator("main");
  await expect(main.locator('a[href="tel:+8801613625686"]')).toHaveText("০১৬১৩-৬২৫৬৮৬");
  await expect(main.locator('a[href="https://wa.me/8801613625686"]')).toHaveText("০১৬১৩-৬২৫৬৮৬");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
