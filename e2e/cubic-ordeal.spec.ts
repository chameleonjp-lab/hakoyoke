import { expect, test } from "@playwright/test";
import {
  BLANK_NAME_SESSION_KEY,
  PLAYER_NAME_STORAGE_KEY,
  installGameCanvasStub,
  installRankingMock,
} from "./ranking-mock";

test.beforeEach(async ({ page }) => {
  await installRankingMock(page);
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
});

test("名前が空のままではゲームを開始できない", async ({ page }) => {
  await page.evaluate(
    ({ blankKey, nameKey }) => {
      sessionStorage.setItem(blankKey, "1");
      localStorage.removeItem(nameKey);
    },
    {
      blankKey: BLANK_NAME_SESSION_KEY,
      nameKey: PLAYER_NAME_STORAGE_KEY,
    }
  );
  await page.reload();
  await expect(page.getByLabel("公開表示名（同名可・必須）")).toHaveValue("");
  await page.getByRole("button", { name: /TUTORIAL/ }).click();
  await expect(
    page.getByText("プレイヤー名を入力してください。")
  ).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(0);
});

test("開始RPCの受付前にはキャンペーン本体を開始しない", async ({ page }) => {
  await installGameCanvasStub(page);
  let releaseRequest: (() => void) | undefined;
  const requestGate = new Promise<void>(resolve => {
    releaseRequest = resolve;
  });
  await page.route("**/rest/v1/rpc/start_game_play_v1", async route => {
    await requestGate;
    await route.fallback();
  });

  await page.getByRole("button", { name: /CAMPAIGN/ }).click();
  await page.getByRole("button", { name: /CAMPAIGN STAGE 1 TO FINAL/ }).click();
  await page.getByRole("button", { name: /CONFIGURE/ }).click();
  await page.getByRole("button", { name: /BEGIN ORDEAL/ }).click();
  await expect(
    page.getByText("ランキング対象プレイの開始を確認中…")
  ).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(0);

  releaseRequest?.();
  await expect(page.locator("canvas")).toBeVisible();
});

test("GAME OVERで冪等再送、同率順位、再戦導線を同じ結果画面に保つ", async ({
  page,
}) => {
  await installGameCanvasStub(page);
  await page.addInitScript(() => {
    window.addEventListener(
      "cubic:snapshot",
      event => {
        const detail = (event as CustomEvent<{ e2eResult?: boolean }>).detail;
        if (!detail?.e2eResult) event.stopImmediatePropagation();
      },
      true
    );
  });
  let scoreAttempts = 0;
  await page.route("**/rest/v1/rpc/submit_score_idempotent_v1", async route => {
    scoreAttempts += 1;
    if (scoreAttempts === 1) {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ code: "PT500", message: "temporary" }),
      });
      return;
    }
    await route.fallback();
  });
  await page.reload();
  await page.getByRole("button", { name: /CAMPAIGN/ }).click();
  await page.getByRole("button", { name: /CAMPAIGN STAGE 1 TO FINAL/ }).click();
  await page.getByRole("button", { name: /CONFIGURE/ }).click();
  await page.getByRole("button", { name: /BEGIN ORDEAL/ }).click();
  await expect(page.locator("canvas")).toBeVisible();

  await page.evaluate(() => {
    (window as Window & { e2eCommand?: string }).e2eCommand = undefined;
    window.addEventListener("cubic:command", event => {
      (window as Window & { e2eCommand?: string }).e2eCommand = (
        event as CustomEvent<{ type?: string }>
      ).detail?.type;
    });
    window.dispatchEvent(
      new CustomEvent("cubic:snapshot", {
        detail: {
          e2eResult: true,
          phase: "GAME_OVER",
          mode: "CAMPAIGN",
          banner: "CONTACT LOST",
          stage: 3,
          stats: {
            score: 4200,
            platformRows: 7,
            misses: 2,
          },
        },
      })
    );
  });

  await expect(
    page.getByRole("heading", { name: "CONTACT LOST" })
  ).toBeVisible();
  const rankingItems = page.locator(".ranking-list li");
  await expect(rankingItems).toHaveCount(3);
  await expect(rankingItems.nth(0)).toContainText("1.ALPHA");
  await expect(rankingItems.nth(1)).toContainText("1.BETA");
  const retry = page.getByRole("button", { name: /RETRY SCORE/ });
  await expect(retry).toBeVisible();
  await retry.click();
  await expect(retry).toHaveCount(0);
  await expect(
    page.getByText("ランキングへの登録を確認しました。")
  ).toBeVisible();

  await page
    .getByRole("button", { name: /CONTINUE RESTART CURRENT STAGE/ })
    .click();
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as Window & { e2eCommand?: string }).e2eCommand
      )
    )
    .toBe("campaign-continue");
});

test("FINAL RESULTから新しいplay_idで新規キャンペーンを開始できる", async ({
  page,
}) => {
  await installGameCanvasStub(page);
  await page.addInitScript(() => {
    window.addEventListener(
      "cubic:snapshot",
      event => {
        const detail = (event as CustomEvent<{ e2eResult?: boolean }>).detail;
        if (!detail?.e2eResult) event.stopImmediatePropagation();
      },
      true
    );
  });
  await page.reload();
  await page.getByRole("button", { name: /CAMPAIGN/ }).click();
  await page.getByRole("button", { name: /CAMPAIGN STAGE 1 TO FINAL/ }).click();
  await page.getByRole("button", { name: /CONFIGURE/ }).click();
  await page.getByRole("button", { name: /BEGIN ORDEAL/ }).click();
  await expect(page.locator("canvas")).toBeVisible();

  await page.evaluate(() => {
    (window as Window & { e2eCommand?: string }).e2eCommand = undefined;
    window.addEventListener("cubic:command", event => {
      (window as Window & { e2eCommand?: string }).e2eCommand = (
        event as CustomEvent<{ type?: string }>
      ).detail?.type;
    });
    window.dispatchEvent(
      new CustomEvent("cubic:snapshot", {
        detail: {
          e2eResult: true,
          phase: "FINAL_RESULT",
          mode: "CAMPAIGN",
          banner: "OBSERVATION COMPLETE",
          stage: 9,
          stats: {
            score: 12000,
            platformRows: 8,
            misses: 0,
          },
        },
      })
    );
  });

  await expect(
    page.getByRole("heading", { name: "OBSERVATION COMPLETE" })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /CONTINUE RESTART CURRENT STAGE/ })
  ).toHaveCount(0);
  await page.getByRole("button", { name: /NEW CAMPAIGN/ }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as Window & { e2eCommand?: string }).e2eCommand
      )
    )
    .toBe("campaign-new");
});

test("メニューから前回の未送信結果を同じsubmission_idで再送できる", async ({
  page,
}) => {
  await page.evaluate(
    ({ pendingKey }) => {
      localStorage.setItem(
        pendingKey,
        JSON.stringify([
          {
            version: 1,
            submissionId: "33333333-3333-4333-8333-333333333333",
            playId: "22222222-2222-4222-8222-222222222222",
            displayName: "E2E PLAYER",
            gameSlug: "hakoyoke",
            clientVersion: "hakoyoke-20260831-01",
            resultType: "game_over",
            reachedStage: 3,
            score: 4200,
            createdAt: new Date().toISOString(),
            attemptCount: 1,
            state: "retryable_failed",
          },
        ])
      );
    },
    { pendingKey: "chameleonjp_hakoyoke_pending_score_v1" }
  );
  await page.reload();
  const retry = page.getByRole("button", { name: /RETRY UNSENT SCORE/ });
  await expect(retry).toBeVisible();
  await retry.click();
  await expect(retry).toHaveCount(0);
  await expect(
    page.getByText("ランキングへの登録を確認しました。")
  ).toBeVisible();
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
  await page.getByRole("button", { name: /PAUSE/ }).click();
  await expect(page.getByRole("heading", { name: "PAUSED" })).toBeVisible();
  await page.evaluate(() => {
    const target = window as Window & {
      practiceSnapshot?: { cubes: Array<{ z: number }> };
    };
    window.addEventListener("cubic:snapshot", event => {
      target.practiceSnapshot = (
        event as CustomEvent<{ cubes: Array<{ z: number }> }>
      ).detail;
    });
  });
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as Window & { practiceSnapshot?: { cubes: unknown[] } })
            .practiceSnapshot?.cubes.length ?? 0
      )
    )
    .toBeGreaterThan(0);
  const savedFirstCubeZ = await page.evaluate(() => {
    const snapshot = (
      window as Window & {
        practiceSnapshot?: { cubes: Array<{ z: number }> };
      }
    ).practiceSnapshot;
    const savedZ = snapshot?.cubes[0]?.z;
    if (savedZ === undefined) {
      throw new Error("PRACTICE snapshot has no active cubes.");
    }
    const saveButton = Array.from(
      document.querySelectorAll(".practice-tools button")
    ).find(button => button.textContent?.trim() === "SAVE");
    if (!(saveButton instanceof HTMLButtonElement)) {
      throw new Error("PRACTICE SAVE button is unavailable.");
    }
    saveButton.click();
    return savedZ;
  });
  await expect(
    page.getByText("QUICK SAVE STORED", { exact: true })
  ).toBeVisible();
  await page.getByRole("button", { name: /STEP/ }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as Window & {
              practiceSnapshot?: { cubes: Array<{ z: number }> };
            }
          ).practiceSnapshot?.cubes[0]?.z
      )
    )
    .toBeLessThan(savedFirstCubeZ);
  await page.getByRole("button", { name: /LOAD/ }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as Window & {
              practiceSnapshot?: { cubes: Array<{ z: number }> };
            }
          ).practiceSnapshot?.cubes[0]?.z
      )
    )
    .toBe(savedFirstCubeZ);
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
  await expect(page.getByText("ORDEAL ACTIVE", { exact: true })).toBeVisible();
  await page.keyboard.down("a");
  try {
    await expect(
      page.getByRole("heading", { name: "FALL INTO VOID" })
    ).toBeVisible();
  } finally {
    await page.keyboard.up("a");
  }
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
  await expect
    .poll(() =>
      page.evaluate(() =>
        document.elementFromPoint(180, 170)?.tagName.toLowerCase()
      )
    )
    .toBe("canvas");
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

test("モバイル入力は複数指とブラウザジェスチャーを無視し、解除を取りこぼさない", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await page.getByRole("button", { name: /TUTORIAL/ }).click();
  const zone = page.locator(".touch-zone");
  await expect(zone).toBeVisible();
  await expect(zone).toHaveCSS("touch-action", "none");

  const contextMenuCanceled = await zone.evaluate(element => {
    const event = new Event("contextmenu", {
      bubbles: true,
      cancelable: true,
    });
    return !element.dispatchEvent(event);
  });
  expect(contextMenuCanceled).toBe(true);

  await zone.dispatchEvent("pointerdown", {
    pointerId: 91,
    pointerType: "touch",
    isPrimary: true,
    button: 0,
    clientX: 100,
    clientY: 650,
  });
  await zone.dispatchEvent("pointermove", {
    pointerId: 91,
    pointerType: "touch",
    isPrimary: true,
    button: 0,
    clientX: 100,
    clientY: 600,
  });
  await expect(zone.locator(".touch-stick.floating")).toHaveAttribute(
    "data-origin",
    "100:650"
  );

  await zone.dispatchEvent("pointerdown", {
    pointerId: 92,
    pointerType: "touch",
    isPrimary: false,
    button: 0,
    clientX: 240,
    clientY: 650,
  });
  await expect(zone.locator(".touch-stick.floating")).toHaveAttribute(
    "data-origin",
    "100:650"
  );
  await zone.dispatchEvent("pointercancel", {
    pointerId: 91,
    pointerType: "touch",
    isPrimary: true,
  });
  await expect(zone.locator(".touch-stick.floating")).toHaveCount(0);

  await page.evaluate(() => {
    const target = window as Window & { touchCommands?: unknown[] };
    target.touchCommands = [];
    window.addEventListener("cubic:command", event => {
      const detail = (event as CustomEvent).detail;
      if (detail?.type === "touch-fast") target.touchCommands?.push(detail);
    });
  });
  const fast = page.getByRole("button", { name: "FAST" });
  await fast.dispatchEvent("pointerdown", {
    pointerId: 101,
    pointerType: "touch",
    isPrimary: true,
  });
  await fast.dispatchEvent("pointerdown", {
    pointerId: 102,
    pointerType: "touch",
    isPrimary: false,
  });
  await fast.dispatchEvent("pointerup", {
    pointerId: 102,
    pointerType: "touch",
    isPrimary: false,
  });
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await fast.dispatchEvent("pointerdown", {
    pointerId: 103,
    pointerType: "touch",
    isPrimary: true,
  });
  await fast.dispatchEvent("pointercancel", {
    pointerId: 103,
    pointerType: "touch",
    isPrimary: true,
  });
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as Window & { touchCommands?: unknown[] }).touchCommands
      )
    )
    .toEqual([
      { type: "touch-fast", active: true },
      { type: "touch-fast", active: false },
      { type: "touch-fast", active: true },
      { type: "touch-fast", active: false },
    ]);
});

test("壊れたパズルアーカイブは開始前に安全に停止する", async ({ page }) => {
  await page.route("**/data/puzzles.json", route =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([null]),
    })
  );
  await page.goto("/?demo");

  await expect(page.getByRole("alert")).toContainText(
    "RENDERER // INITIALIZATION FAILED"
  );
  await expect(page.getByRole("button", { name: "RETRY" })).toBeVisible();
  await expect(page.getByText("CUBIC", { exact: false })).toBeVisible();
});
