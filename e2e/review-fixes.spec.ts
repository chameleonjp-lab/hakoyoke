import { expect, test } from "@playwright/test";
import { installRankingMock } from "./ranking-mock";

async function completeTutorialMovementGate(
  page: import("@playwright/test").Page
) {
  await expect(page.getByText("TRAINING 1 / 8", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "MARK" })).toBeDisabled();
  await page.keyboard.down("ArrowRight");
  await page.waitForTimeout(100);
  await page.keyboard.up("ArrowRight");
  await expect(page.getByText("TRAINING 2 / 8", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "MARK" })).toBeEnabled();
}

test.beforeEach(async ({ page }) => {
  await installRankingMock(page);
});

test("CREATEは一般的な画面サイズで最終操作までスクロールできる", async ({
  page,
}) => {
  for (const viewport of [
    { width: 1280, height: 720 },
    { width: 870, height: 400 },
    { width: 320, height: 480 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await page.getByRole("button", { name: /CAMPAIGN/ }).click();
    await page
      .getByRole("button", { name: /CREATE BUILD A CUSTOM ORDEAL/ })
      .click();
    await page.getByRole("button", { name: /CONFIGURE/ }).click();
    const testButton = page.getByRole("button", { name: /TEST ORDEAL/ });
    await testButton.scrollIntoViewIfNeeded();
    await expect(testButton).toBeVisible();
    const bounds = await testButton.boundingBox();
    expect(bounds).not.toBeNull();
    if (bounds) {
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
      expect(bounds.y).toBeGreaterThanOrEqual(0);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height);
    }
  }
});

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
  await completeTutorialMovementGate(page);
  const mark = page.getByRole("button", { name: "MARK" });
  await mark.dispatchEvent("pointerdown", {
    pointerId: 71,
    pointerType: "touch",
    isPrimary: true,
    button: 0,
  });
  await expect(page.getByText("TRAINING 3 / 8", { exact: true })).toBeVisible();
  const activeMark = page.getByRole("button", { name: "MARK" });
  await activeMark.dispatchEvent("pointerdown", {
    pointerId: 72,
    pointerType: "touch",
    isPrimary: true,
    button: 0,
  });
  await expect(page.getByText("MARK SET", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "CLEAR" })).toBeVisible();
  await expect(page.getByRole("button", { name: "CLEAR" })).toHaveAttribute(
    "aria-label",
    "CLEAR"
  );
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

  expect(geometry.top).toBeGreaterThanOrEqual(geometry.viewportHeight / 2 - 1);
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

test("移動中の解除イベントが画面側へ届いてもプレイヤーが停止する", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/?demo");
  await expect(page.getByText("ORDEAL ACTIVE", { exact: true })).toBeVisible();
  await page.evaluate(() => {
    window.addEventListener("cubic:snapshot", event => {
      (window as Window & { latestSnapshot?: unknown }).latestSnapshot = (
        event as CustomEvent
      ).detail;
    });
  });

  const zone = page.locator(".touch-zone");
  await zone.dispatchEvent("pointerdown", {
    pointerId: 121,
    pointerType: "touch",
    isPrimary: true,
    button: 0,
    clientX: 180,
    clientY: 680,
  });
  await zone.dispatchEvent("pointermove", {
    pointerId: 121,
    pointerType: "touch",
    isPrimary: true,
    button: 0,
    clientX: 180,
    clientY: 620,
  });
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as Window & {
              latestSnapshot?: { player: { z: number } };
            }
          ).latestSnapshot?.player.z ?? 0
      )
    )
    .toBeGreaterThan(0.9);

  await page.evaluate(() => {
    window.dispatchEvent(
      new PointerEvent("pointerup", { pointerId: 121, pointerType: "touch" })
    );
  });
  const stoppedAt = await page.evaluate(
    () =>
      (window as Window & { latestSnapshot?: { player: { z: number } } })
        .latestSnapshot?.player.z ?? 0
  );
  await page.waitForTimeout(240);
  const afterRelease = await page.evaluate(
    () =>
      (window as Window & { latestSnapshot?: { player: { z: number } } })
        .latestSnapshot?.player.z ?? 0
  );
  expect(Math.abs(afterRelease - stoppedAt)).toBeLessThan(0.08);
});
