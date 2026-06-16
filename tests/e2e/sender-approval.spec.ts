import { test, expect } from "./fixtures";

test.describe("sender approval", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("stealth-preferences", JSON.stringify({ onboardingCompleted: true }));
    });
    await page.goto("/");
  });

  test("approves an unknown sender from the requests folder", async ({ page }) => {
    // Navigate to Requests folder in sidebar
    await page.getByRole("button", { name: "Requests" }).click();

    // Select the 'Message request awaiting approval' email (id=5 in seed data)
    await page.getByText("Message request awaiting approval").click();

    // The SenderRequest widget should be visible
    await expect(page.getByText("Decide who can mail you")).toBeVisible();

    // Approve the sender
    await page.getByRole("button", { name: "Allow sender" }).click();

    // Toast confirms approval
    await expect(page.getByText(/can now mail you/i)).toBeVisible();
  });

  test("blocks an unknown sender and queues postage refund", async ({ page }) => {
    await page.getByRole("button", { name: "Requests" }).click();
    await page.getByText("Message request awaiting approval").click();

    await expect(page.getByText("Decide who can mail you")).toBeVisible();

    await page.getByRole("button", { name: "Block and refund" }).click();

    await expect(page.getByText(/blocked and postage marked for refund/i)).toBeVisible();
  });
});
