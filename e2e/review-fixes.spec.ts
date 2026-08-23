import { expect, test } from "@playwright/test";

test("PRACTICEは各Waveに存在する問題番号だけを表示する", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /CAMPAIGN/ }).click();
  await page.getByRole("button", { name: /PRACTICE/ }).click();
  await page.getByRole("button", { name: /CONFIGURE/ }).click();
  const selects = page.locator(".select-grid select");
  await selects.nth(0).selectOption("9");
  await expect(selects.nth(2).locator("option")).toHaveCount(1);
  await selects.nth(0).selectOption("4");
  await expect(selects.nth(2).locator("option")).toHaveCount(2);
});

test("モバイル操作ボタンはPointer Eventsの一経路でMARKを一度だけ処理する", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await page.getByRole("button", { name: /TUTORIAL/ }).click();
  await expect(page.getByText("ORDEAL ACTIVE", { exact: true })).toBeVisible();
  const mark = page.getByRole("button", { name: "MARK" });
  await mark.dispatchEvent("pointerdown", {
    pointerId: 71,
    pointerType: "touch",
    isPrimary: true,
    button: 0,
  });
  await expect(page.getByText("MARK SET", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "CLEAR" })).toBeVisible();
});
