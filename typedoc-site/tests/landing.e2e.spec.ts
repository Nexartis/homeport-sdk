import { expect, test } from "@playwright/test";

/**
 * Smoke tests for the Homeport SDK docs landing page.
 *
 * Closes NNN-SDK-AUDIT-010: verifies that the branded landing page
 * loads, the install-command tabs work, the copy button emits a
 * "Copied" state, and the TypeDoc `/api/` index resolves.
 */

test.describe("Homeport SDK docs landing", () => {
	test("landing loads with Homeport SDK title", async ({ page }) => {
		await page.goto("/");
		await expect(page).toHaveTitle(/Homeport SDK/);
		await expect(page.locator("h1")).toContainText("Homeport SDK");
	});

	test("install tabs switch package manager and copy button toggles state", async ({ page }) => {
		await page.goto("/");

		const cmd = page.locator("#install-cmd");
		await expect(cmd).toHaveText("pnpm add @nexartis/homeport-sdk");

		await page.getByRole("tab", { name: "npm", exact: true }).click();
		await expect(cmd).toHaveText("npm install @nexartis/homeport-sdk");

		await page.getByRole("tab", { name: "yarn", exact: true }).click();
		await expect(cmd).toHaveText("yarn add @nexartis/homeport-sdk");

		await page.getByRole("tab", { name: "bun", exact: true }).click();
		await expect(cmd).toHaveText("bun add @nexartis/homeport-sdk");

		// Grant clipboard permission in Chromium so navigator.clipboard resolves.
		await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
		await page.getByRole("button", { name: /copy install command/i }).click();
		await expect(page.getByRole("button", { name: /copy install command/i })).toHaveText(/Copied/);
	});

	test("/api/ TypeDoc index resolves", async ({ page }) => {
		const response = await page.request.get("/api/");
		expect(response.ok(), `expected /api/ to be reachable, got ${response.status()}`).toBeTruthy();
	});
});
