import assert from "node:assert/strict";

// Use the same explicit picker as a player; preserve the settings page on return.
export async function chooseMenuLanguage(page, code) {
  await page.locator("#menu-language").click();
  await page.locator(`[data-language="${code}"]`).click();
  await page.locator("#menu-back").click();
  assert.equal(await page.locator("html").getAttribute("lang"), code);
}

export async function cycleToolbarLanguage(page, code) {
  for (let attempts = 0; attempts < 6; attempts++) {
    if ((await page.locator("html").getAttribute("lang")) === code) return;
    await page.locator("#language").click();
  }
  assert.equal(await page.locator("html").getAttribute("lang"), code);
}
