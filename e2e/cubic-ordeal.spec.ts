import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
});

test("タイトルからキャンペーンを開始し、HUDと一時停止へ到達できる", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/");
  await expect(page.getByText("CUBIC", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: /CAMPAIGN/ }).click();
  await page.getByRole("button", { name: /CAMPAIGN STAGE 1 TO FINAL/ }).click();
  await page.getByRole("button", { name: /CONFIGURE/ }).click();
  await page.getByRole("button", { name: /BEGIN ORDEAL/ }).click();
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.getByText("SCORE", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /PAUSE/ }).click();
  await expect(page.getByRole("heading", { name: "PAUSED" })).toBeVisible();
  await page.getByRole("button", { name: /RESUME/ }).click();
});

test("CREATEで問題セルを変更し、ローカル保存できる", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /CAMPAIGN/ }).click();
  await page
    .getByRole("button", { name: /CREATE BUILD A CUSTOM ORDEAL/ })
    .click();
  await page.getByRole("button", { name: /CONFIGURE/ }).click();
  await expect(page.getByText("CREATE // LOCAL ARCHIVE")).toBeVisible();
  await page.locator(".editor-cell").first().click();
  await page.getByRole("button", { name: /SAVE/ }).click();
  await expect(
    page.getByText(/CUSTOM ARCHIVEへ保存しました。保存数:/)
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /MIRROR/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /IMPORT/ })).toBeVisible();
});

test("TUTORIALとDUELをそれぞれ開始でき、専用状態がHUDへ出る", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /TUTORIAL/ }).click();
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.getByText(/TRAINING/)).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /QUIT TO MENU/ }).click();
  await page.getByRole("button", { name: /DUEL LOCAL TURN-BASED/ }).click();
  await page.getByRole("button", { name: /CONFIGURE/ }).click();
  await page.getByRole("button", { name: /BEGIN ORDEAL/ }).click();
  await expect(page.getByText("P1 0 : 0 P2", { exact: true })).toBeVisible();
  await expect(page.getByText("TURN P1", { exact: true })).toBeVisible();
});

test("Campaignの状態と設定をlocalStorageへ保存し、Campaign開始時に復帰できる", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /SETTINGS/ }).click();
  await page.locator("select").first().selectOption("LOW");
  await page.locator("select").nth(1).selectOption("OFF");
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem("cubic-ordeal-quality"))
    )
    .toBe("LOW");
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("cubic-ordeal-audio")))
    .toBe("OFF");
  await page.getByRole("button", { name: /BACK/ }).click();
  await page.getByRole("button", { name: /CAMPAIGN/ }).click();
  await page.getByRole("button", { name: /CAMPAIGN STAGE 1 TO FINAL/ }).click();
  await page.getByRole("button", { name: /CONFIGURE/ }).click();
  await page.getByRole("button", { name: /BEGIN ORDEAL/ }).click();
  await page.waitForTimeout(1200);
  await page.reload();
  await page.getByRole("button", { name: /CAMPAIGN/ }).click();
  await page.getByRole("button", { name: /CAMPAIGN STAGE 1 TO FINAL/ }).click();
  await page.getByRole("button", { name: /CONFIGURE/ }).click();
  await page.getByRole("button", { name: /BEGIN ORDEAL/ }).click();
  await expect(page.getByRole("heading", { name: "PAUSED" })).toBeVisible();
});

test("PRACTICE開始後のSAVE、LOAD、STEP、REWINDはCampaign記録と独立して実行できる", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /CAMPAIGN/ }).click();
  await page.getByRole("button", { name: /PRACTICE/ }).click();
  await page.getByRole("button", { name: /CONFIGURE/ }).click();
  await page.getByRole("button", { name: /LOAD ARCHIVE/ }).click();
  await expect(page.getByText("ORDEAL ACTIVE", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /SAVE/ }).click();
  await expect(
    page.getByText("QUICK SAVE STORED", { exact: true })
  ).toBeVisible();
  await page.getByRole("button", { name: /STEP/ }).click();
  await page.getByRole("button", { name: /LOAD/ }).click();
  await expect(
    page.getByText("QUICK SAVE RESTORED", { exact: true })
  ).toBeVisible();
  await page.getByRole("button", { name: /REWIND/ }).click();
  await expect(
    page.getByText("10 SECONDS REWOUND", { exact: true })
  ).toBeVisible();
});

test("プレイヤーが足場外へ出ると即座にゲームオーバーになる", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /TUTORIAL/ }).click();
  await page.waitForTimeout(4200);
  await page.keyboard.down("a");
  await page.waitForTimeout(1100);
  await page.keyboard.up("a");
  await expect(
    page.getByRole("heading", { name: "FALL INTO VOID" })
  ).toBeVisible();
});

test("スマートフォン縦画面でタップ地点に移動キーが出現し、画面上方向へ前進できる", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await page.getByRole("button", { name: /TUTORIAL/ }).click();
  await expect(page.getByRole("button", { name: "AREA" })).toBeVisible();
  await page.evaluate(() => {
    (
      window as Window & { latestSnapshot?: { player: { z: number } } }
    ).latestSnapshot = undefined;
    window.addEventListener("cubic:snapshot", event => {
      (window as Window & { latestSnapshot?: unknown }).latestSnapshot = (
        event as CustomEvent
      ).detail;
    });
  });
  const touchLayer = page.locator(".touch-zone");
  await touchLayer.dispatchEvent("pointerdown", {
    pointerId: 7,
    pointerType: "touch",
    isPrimary: true,
    button: 0,
    clientX: 112,
    clientY: 500,
  });
  await expect(page.locator(".touch-stick.floating")).toBeVisible();
  await expect(page.locator(".touch-stick.floating")).toHaveAttribute(
    "data-origin",
    "112:500"
  );
  await page.waitForTimeout(3900);
  await touchLayer.dispatchEvent("pointermove", {
    pointerId: 7,
    pointerType: "touch",
    isPrimary: true,
    button: 0,
    clientX: 112,
    clientY: 450,
  });
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as Window & { latestSnapshot?: { player: { z: number } } })
            .latestSnapshot?.player.z ?? 0
      )
    )
    .toBeGreaterThan(0.7);
  await touchLayer.dispatchEvent("pointerup", {
    pointerId: 7,
    pointerType: "touch",
    isPrimary: true,
    button: 0,
    clientX: 112,
    clientY: 450,
  });
  await expect(page.locator(".touch-stick.floating")).toHaveCount(0);
});

test("縦画面の上半分スワイプはカメラだけを動かし、下半分の上スワイプは画面奥へ移動する", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.addInitScript(() => {
    (window as Window & { cameraBasis?: unknown }).cameraBasis = undefined;
    window.addEventListener("cubic:camera-basis", event => {
      (window as Window & { cameraBasis?: unknown }).cameraBasis = (
        event as CustomEvent
      ).detail;
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: /TUTORIAL/ }).click();
  await page.waitForTimeout(3_900);
  await page.locator("canvas").dispatchEvent("pointerdown", {
    pointerId: 31,
    pointerType: "touch",
    isPrimary: true,
    button: 0,
    clientX: 180,
    clientY: 170,
  });
  await page.locator("canvas").dispatchEvent("pointermove", {
    pointerId: 31,
    pointerType: "touch",
    isPrimary: true,
    button: 0,
    clientX: 242,
    clientY: 170,
  });
  await page.locator("canvas").dispatchEvent("pointerup", {
    pointerId: 31,
    pointerType: "touch",
    isPrimary: true,
    button: 0,
    clientX: 242,
    clientY: 170,
  });
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as Window & { cameraBasis?: unknown }).cameraBasis
      )
    )
    .not.toBeUndefined();
  await page.evaluate(() => {
    (
      window as Window & { latestSnapshot?: { player: { z: number } } }
    ).latestSnapshot = undefined;
    window.addEventListener("cubic:snapshot", event => {
      (window as Window & { latestSnapshot?: unknown }).latestSnapshot = (
        event as CustomEvent
      ).detail;
    });
  });
  const touchLayer = page.locator(".touch-zone");
  await touchLayer.dispatchEvent("pointerdown", {
    pointerId: 32,
    pointerType: "touch",
    isPrimary: true,
    button: 0,
    clientX: 170,
    clientY: 650,
  });
  await touchLayer.dispatchEvent("pointermove", {
    pointerId: 32,
    pointerType: "touch",
    isPrimary: true,
    button: 0,
    clientX: 170,
    clientY: 590,
  });
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as Window & { latestSnapshot?: { player: { z: number } } })
            .latestSnapshot?.player.z ?? 0
      )
    )
    .toBeGreaterThan(0.7);
  await touchLayer.dispatchEvent("pointerup", {
    pointerId: 32,
    pointerType: "touch",
    isPrimary: true,
    button: 0,
    clientX: 170,
    clientY: 590,
  });
});

test("870×400横画面でタッチ操作を開始・解除してもHUDと盤面が維持される", async ({
  page,
}) => {
  await page.setViewportSize({ width: 870, height: 400 });
  await page.goto("/?demo");
  await expect(page.locator("canvas")).toBeVisible();
  const fast = page.getByRole("button", { name: "FAST" });
  await fast.dispatchEvent("pointerdown", {
    pointerId: 3,
    pointerType: "touch",
    isPrimary: true,
  });
  await fast.dispatchEvent("pointercancel", {
    pointerId: 3,
    pointerType: "touch",
    isPrimary: true,
  });
  await expect(page.getByRole("button", { name: "AREA" })).toBeDisabled();
  await expect(page.getByText("SCORE", { exact: true })).toBeVisible();
});

test("開始後のMARKボタンは設置、対象不在時の解除、状態表示を一貫して行う", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await page.getByRole("button", { name: /TUTORIAL/ }).click();
  await expect(page.getByText("ORDEAL ACTIVE", { exact: true })).toBeVisible();
  const mark = page.getByRole("button", { name: "MARK" });
  if (testInfo.project.name === "webkit") await mark.tap();
  else await mark.click();
  await expect(page.getByText("MARK SET", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "CLEAR" })).toBeVisible();
  const clear = page.getByRole("button", { name: "CLEAR" });
  if (testInfo.project.name === "webkit") await clear.tap();
  else await clear.click();
  await expect(page.getByText("MARK CLEARED", { exact: true })).toBeVisible();
});

test("RUM観測面が初期ロード・3Dランタイム・初回フレームの匿名計測値を表示する", async ({
  page,
}) => {
  await page.goto("/?demo&rum=1");
  const panel = page.getByLabel("Runtime measurement");
  await expect(panel).toBeVisible();
  await expect(panel).toContainText("NAV");
  await expect(panel).toContainText("REQUEST");
  await expect(panel.locator("div").filter({ hasText: "FRAME" })).toContainText(
    /\d+ms/
  );
});
