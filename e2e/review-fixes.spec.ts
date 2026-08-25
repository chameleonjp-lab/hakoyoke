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

test("縦画面の移動領域は下半分に限定され、pause中は入力面を解除する", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await page.getByRole("button", { name: /TUTORIAL/ }).click();
  await expect(page.getByText("ORDEAL ACTIVE", { exact: true })).toBeVisible();

  const zone = page.locator(".touch-zone");
  await expect(zone).toBeVisible();
  const geometry = await zone.evaluate(element => {
    const rect = element.getBoundingClientRect();
    const x = Math.floor(window.innerWidth / 2);
    const topTarget = document.elementFromPoint(
      x,
      Math.floor(window.innerHeight * 0.25)
    );
    const bottomTarget = document.elementFromPoint(
      x,
      Math.floor(window.innerHeight * 0.75)
    );
    return {
      top: rect.top,
      bottom: rect.bottom,
      viewportHeight: window.innerHeight,
      topInZone: Boolean(topTarget?.closest(".touch-zone")),
      bottomInZone: Boolean(bottomTarget?.closest(".touch-zone")),
    };
  });

  expect(geometry.top).toBeGreaterThanOrEqual(
    geometry.viewportHeight / 2 - 1
  );
  expect(geometry.bottom).toBeCloseTo(geometry.viewportHeight, 0);
  expect(geometry.topInZone).toBe(false);
  expect(geometry.bottomInZone).toBe(true);

  const box = await zone.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect(page.locator(".touch-stick.floating")).toBeVisible();
  await page.mouse.up();

  await page.getByRole("button", { name: /PAUSE/ }).click();
  await expect(zone).toHaveCount(0);
  await page.getByRole("button", { name: /RESUME/ }).click();
  await expect(zone).toBeVisible();
});
