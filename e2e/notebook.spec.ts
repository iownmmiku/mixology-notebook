import { test as base, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

const test = base.extend<{ browserErrors: string[] }>({
  browserErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await use(errors);
      expect(errors, "the app should not throw browser errors").toEqual([]);
    },
    { auto: true },
  ],
});

async function navigate(page: Page, label: string) {
  await page.getByRole("button", { name: label, exact: true }).click();
}
async function seed(page: Page, values: Record<string, string>) {
  await page.addInitScript((entries) => {
    for (const [key, value] of Object.entries(entries)) {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
    }
  }, values);
}
async function openFlower(page: Page) {
  await page.getByLabel("搜索配方", { exact: true }).fill("花招");
  await page.getByRole("button", { name: "查看花招配方", exact: true }).click();
}

async function mockAndroidBackup(page: Page, failWrite = false) {
  await page.addInitScript((shouldFail) => {
    const nativeWindow = window as typeof window & {
      androidBridge?: object;
      Capacitor?: object;
      backupCalls?: {
        plugin: string;
        method: string;
        options: Record<string, unknown>;
      }[];
    };
    nativeWindow.androidBridge = {};
    nativeWindow.backupCalls = [];
    nativeWindow.Capacitor = {
      PluginHeaders: [
        {
          name: "Filesystem",
          methods: [{ name: "writeFile", rtype: "promise" }],
        },
        { name: "Share", methods: [{ name: "share", rtype: "promise" }] },
        {
          name: "App",
          methods: [
            { name: "addListener", rtype: "callback" },
            { name: "removeListener", rtype: "promise" },
          ],
        },
      ],
      nativeCallback: () => Promise.resolve("test-listener"),
      nativePromise: async (
        plugin: string,
        method: string,
        options: Record<string, unknown>,
      ) => {
        nativeWindow.backupCalls!.push({ plugin, method, options });
        if (plugin === "Filesystem") {
          if (shouldFail) throw new Error("设备缓存写入失败");
          return {
            uri: `file:///data/user/0/com.mixology.notebook/cache/${options.path}`,
          };
        }
        return { activityType: "test-save-target" };
      },
    };
  }, failWrite);
}

test("collected recipes keep source links, top-up amounts and fractional measures", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("搜索配方", { exact: true }).fill("自行车");
  await page
    .getByRole("button", { name: "查看自行车配方", exact: true })
    .click();
  await expect(page.getByRole("link", { name: /Liquor.com/ })).toHaveAttribute(
    "href",
    "https://www.liquor.com/recipes/bicicletta/",
  );
  const soda = page
    .locator(".ingredient-list > div")
    .filter({ has: page.getByText("苏打水", { exact: true }) });
  await expect(soda.locator("strong")).toHaveText("适量");
  await page.getByRole("button", { name: "增加份量", exact: true }).click();
  await expect(soda.locator("strong")).toHaveText("适量");
  await expect(
    page
      .locator(".ingredient-list > div")
      .filter({ has: page.getByText("干白葡萄酒", { exact: true }) })
      .locator("strong"),
  ).toHaveText("135 ml");
  await page.keyboard.press("Escape");
  await page.getByLabel("搜索配方", { exact: true }).fill("改良威士忌");
  await page
    .getByRole("button", { name: "查看改良威士忌鸡尾酒配方", exact: true })
    .click();
  const absinthe = page
    .locator(".ingredient-list > div")
    .filter({ has: page.getByText("苦艾酒", { exact: true }) });
  await expect(absinthe.locator("strong")).toHaveText("0.125 茶匙");
  await page.getByRole("button", { name: "增加份量", exact: true }).click();
  await expect(absinthe.locator("strong")).toHaveText("0.1875 茶匙");
});

test("new mocktails appear in the alcohol-free filter with preparation and provenance", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "无酒精", exact: true }).click();
  await page.getByLabel("搜索配方", { exact: true }).fill("石榴莫吉托");
  await page
    .getByRole("button", { name: "查看石榴莫吉托无酒精版配方", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: /BBC Good Food/ }),
  ).toHaveAttribute(
    "href",
    "https://www.bbcgoodfoodme.com/recipes/pomegranate-mojito-mocktail/",
  );
  await expect(page.getByText(/石榴籽分装进冰格/)).toBeVisible();
  await expect(page.getByText("166.7 ml", { exact: true })).toBeVisible();
});

test("catalog search, source and quantities work without horizontal overflow", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /发现你的下一杯/ }),
  ).toBeVisible();
  await openFlower(page);
  await expect(page.getByText("7.5 ml", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /IBA/ })).toHaveAttribute(
    "href",
    "https://iba-world.com/iba-cocktail/hanky-panky/",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByLabel("搜索配方", { exact: true }).fill("不存在的鸡尾酒名字");
  await expect(page.getByText(/没有找到/)).toBeVisible();
});

test("legacy pantry accepts a specific whisky for a general highball", async ({
  page,
}) => {
  await seed(page, {
    "mixology-pantry-v1": JSON.stringify(["苏格兰威士忌", "苏打水"]),
  });
  await page.goto("/");
  await navigate(page, "我的酒柜");
  const highball = page
    .getByRole("button")
    .filter({ has: page.getByText("高球", { exact: true }) });
  await expect(highball).toBeVisible();
  await expect(highball).toContainText(/可调|已备齐|齐了/);
  await highball.click();
  await expect(page.getByText("45 ml", { exact: true })).toBeVisible();
});

test("offline recommendations respect the nonalcoholic condition and open a recipe", async ({
  page,
}) => {
  await page.goto("/");
  await navigate(page, "调酒师");
  await page.getByLabel("给调酒师的消息").fill("推荐一杯无酒精酸甜的酒");
  await page.getByRole("button", { name: "发送消息" }).click();
  const cards = page.locator(".message.assistant .recipe-row");
  await expect(cards).toHaveCount(4);
  for (let index = 0; index < 4; index++)
    await expect(cards.nth(index)).toContainText("无酒精");
  await cards.first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("favorites, making a drink and personal notes survive a reload", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("搜索配方", { exact: true }).fill("花招");
  await page.getByRole("button", { name: "收藏花招", exact: true }).click();
  await page.getByRole("button", { name: "查看花招配方", exact: true }).click();
  await page.getByLabel("个人口味笔记").fill("下次甜味美思减至 40 ml。");
  await page.getByRole("button", { name: "保存笔记", exact: true }).click();
  await page.getByRole("button", { name: /^开始调制/ }).click();
  const steps = page.getByLabel(/完成步骤 \d+/);
  for (let index = 0; index < (await steps.count()); index++)
    await steps.nth(index).click();
  await page
    .getByRole("button", { name: "完成，记入我的手册", exact: true })
    .click();
  await page.reload();
  await navigate(page, "我的手册");
  await expect(
    page
      .getByRole("button")
      .filter({ has: page.getByText("花招", { exact: true }) }),
  ).toBeVisible();
  await page.getByRole("button", { name: "最近调制", exact: true }).click();
  await page
    .getByRole("button")
    .filter({ has: page.getByText("花招", { exact: true }) })
    .click();
  await expect(page.getByLabel("个人口味笔记")).toHaveValue(
    "下次甜味美思减至 40 ml。",
  );
});

test("backup export excludes credentials and an invalid import changes nothing", async ({
  page,
}) => {
  await seed(page, {
    "mixology-pantry-v1": JSON.stringify(["青柠汁"]),
    "mixology-api-settings-v1": JSON.stringify({
      endpoint: "https://example.test/v1/chat/completions",
      apiKey: "test-only-private-key",
      model: "test-model",
    }),
  });
  await page.goto("/");
  await navigate(page, "我的手册");
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出备份", exact: true }).click();
  const download = await downloadEvent;
  const content = await readFile((await download.path())!, "utf8");
  const backup = JSON.parse(content);
  expect(backup.data.pantry).toEqual(["青柠汁"]);
  expect(content).not.toContain("test-only-private-key");
  const before = await page.evaluate(() =>
    localStorage.getItem("mixology-pantry-v1"),
  );
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByLabel("选择备份文件").setInputFiles({
    name: "invalid.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"version":2}'),
  });
  await expect(page.getByRole("status")).toContainText(/未更改|未改变|格式/);
  expect(
    await page.evaluate(() => localStorage.getItem("mixology-pantry-v1")),
  ).toBe(before);
});

test("Android backup writes a UTF-8 cache file and shares that file without credentials", async ({
  page,
}) => {
  await mockAndroidBackup(page);
  await seed(page, {
    "mixology-pantry-v1": JSON.stringify(["青柠汁"]),
    "mixology-api-settings-v1": JSON.stringify({
      endpoint: "https://example.test/v1/chat/completions",
      apiKey: "native-test-secret",
      model: "test-model",
    }),
  });
  await page.goto("/");
  await navigate(page, "我的手册");
  await page.getByRole("button", { name: "导出备份", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(/备份已生成/);
  const calls = await page.evaluate(
    () =>
      (
        window as unknown as {
          backupCalls: {
            plugin: string;
            method: string;
            options: Record<string, unknown>;
          }[];
        }
      ).backupCalls,
  );
  const write = calls.find(
    (call) => call.plugin === "Filesystem" && call.method === "writeFile",
  );
  expect(write?.options).toMatchObject({
    directory: "CACHE",
    encoding: "utf8",
  });
  const content = String(write?.options.data);
  expect(JSON.parse(content).data.pantry).toEqual(["青柠汁"]);
  expect(content).not.toContain("native-test-secret");
  const share = calls.find(
    (call) => call.plugin === "Share" && call.method === "share",
  );
  expect(share?.options.files).toEqual([
    `file:///data/user/0/com.mixology.notebook/cache/${write?.options.path}`,
  ]);
});

test("Android cache write failure does not open share or claim that a backup was saved", async ({
  page,
}) => {
  await mockAndroidBackup(page, true);
  await page.goto("/");
  await navigate(page, "我的手册");
  await page.getByRole("button", { name: "导出备份", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(/无法|失败/);
  const calls = await page.evaluate(
    () =>
      (window as unknown as { backupCalls: { plugin: string }[] }).backupCalls,
  );
  expect(calls.some((call) => call.plugin === "Share")).toBe(false);
  await expect(
    page.getByRole("button", { name: "导出备份", exact: true }),
  ).toBeEnabled();
});

test("switching providers clears an old key and custom provider can be selected", async ({
  page,
}) => {
  await seed(page, {
    "mixology-api-settings-v1": JSON.stringify({
      endpoint: "https://api.deepseek.com/v1/chat/completions",
      apiKey: "test-only-old-key",
      model: "deepseek-chat",
    }),
  });
  await page.goto("/");
  await navigate(page, "调酒师");
  await page.getByRole("button", { name: "对话设置", exact: true }).click();
  await page
    .getByLabel("提供商", { exact: true })
    .selectOption({ label: "OpenAI" });
  await expect(page.getByLabel("API 密钥", { exact: true })).toHaveValue("");
  await page
    .getByLabel("提供商", { exact: true })
    .selectOption({ label: "自定义" });
  await expect(
    page.getByLabel("提供商", { exact: true }).locator("option:checked"),
  ).toHaveText("自定义");
});

test("online chat uses bounded recipe context and handles a mocked provider response", async ({
  page,
}) => {
  await seed(page, {
    "mixology-api-settings-v1": JSON.stringify({
      endpoint: "https://example.test/v1/chat/completions",
      apiKey: "test-only-key",
      model: "test-model",
    }),
  });
  let submitted = false;
  await page.route(
    "https://example.test/v1/chat/completions",
    async (route) => {
      const body = route.request().postDataJSON();
      expect(body.messages[0].content.length).toBeLessThan(8500);
      expect(body.messages.at(-1).content).toBe("推荐一杯无酒精酸甜的酒");
      submitted = true;
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          choices: [
            { message: { content: "模拟回复：可以尝试无酒精青柠苏打。" } },
          ],
        }),
      });
    },
  );
  await page.goto("/");
  await navigate(page, "调酒师");
  await page.getByLabel("给调酒师的消息").fill("推荐一杯无酒精酸甜的酒");
  await page.getByRole("button", { name: "发送消息" }).click();
  await expect(
    page.getByText("模拟回复：可以尝试无酒精青柠苏打。", { exact: true }),
  ).toBeVisible();
  expect(submitted).toBe(true);
});

test("startup preserves damaged personal data and provides a recovery notice", async ({
  page,
}) => {
  await seed(page, { "mixology-custom-recipes-v1": "{broken-json" });
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("原始数据已保留");
  await navigate(page, "我的手册");
  expect(
    await page.evaluate(() =>
      localStorage.getItem("mixology-custom-recipes-v1"),
    ),
  ).toBe("{broken-json");
  await page.reload();
  expect(
    await page.evaluate(() =>
      localStorage.getItem("mixology-custom-recipes-v1"),
    ),
  ).toBe("{broken-json");
});

test("a new personal nonalcoholic recipe saves and survives a reload", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "新建配方", exact: true }).click();
  await page.getByLabel("配方名称").fill("测试青柠苏打");
  await page
    .getByLabel("分类", { exact: true })
    .selectOption({ label: "无酒精" });
  await page.getByLabel("材料 1 名称", { exact: true }).fill("青柠汁");
  await page
    .getByLabel("调制步骤 1", { exact: true })
    .fill("加冰搅拌，按口味加入苏打水。");
  await page
    .getByRole("button", { name: "保存到我的手册", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "测试青柠苏打配方", exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByLabel("搜索配方", { exact: true }).fill("测试青柠苏打");
  await expect(
    page.getByRole("button", { name: "查看测试青柠苏打配方", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "无酒精", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "查看测试青柠苏打配方", exact: true }),
  ).toBeVisible();
});

test("unsaved notes and recipe edits can be kept when closing is cancelled", async ({
  page,
}) => {
  await page.goto("/");
  await openFlower(page);
  await page.getByLabel("个人口味笔记").fill("尚未保存的草稿");
  let notePromptObserved = false;
  page.once("dialog", async (dialog) => {
    notePromptObserved = true;
    await dialog.dismiss();
  });
  await page.getByRole("button", { name: "编辑配方", exact: true }).click();
  expect(notePromptObserved).toBe(true);
  await expect(page.getByLabel("个人口味笔记")).toHaveValue("尚未保存的草稿");
  await page.getByRole("button", { name: "保存笔记", exact: true }).click();
  await page.getByRole("button", { name: "编辑配方", exact: true }).click();
  await page.getByLabel("配方名称").fill("未保存的新名字");
  let editPromptObserved = false;
  page.once("dialog", async (dialog) => {
    editPromptObserved = true;
    await dialog.dismiss();
  });
  await page.getByRole("button", { name: "关闭配方编辑", exact: true }).click();
  expect(editPromptObserved).toBe(true);
  await expect(page.getByLabel("配方名称")).toHaveValue("未保存的新名字");
});
