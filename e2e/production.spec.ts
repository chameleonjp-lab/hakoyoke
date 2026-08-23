import { expect, test } from "@playwright/test";

test("productionで3D盤面・HUD・外部アセットプロキシの設定済み／未設定経路を確認できる", async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", error => pageErrors.push(error.message));

  await page.setViewportSize({ width: 870, height: 400 });
  await page.goto("/?demo", { waitUntil: "networkidle" });
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.getByText("SCORE", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "FAST" })).toBeVisible();
  await page.waitForTimeout(2_000);

  const asset = await page.request.get(
    "/manus-storage/cubic-ordeal-logo_b0288b12.png",
    { maxRedirects: 0 }
  );
  const hasStorageProxyConfig = Boolean(
    process.env.BUILT_IN_FORGE_API_URL && process.env.BUILT_IN_FORGE_API_KEY
  );

  if (hasStorageProxyConfig) {
    expect(asset.status()).toBe(307);
    expect(asset.headers().location).toBeTruthy();
  } else {
    expect(asset.status()).toBe(503);
    expect(asset.headers().location).toBeUndefined();
  }

  expect(pageErrors).toEqual([]);
});
