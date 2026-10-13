import { test, expect } from "@playwright/test";

test.use({ storageState: "playwright/.auth/user.json" });

test("저장된 로그인 상태로 Bizhows에 접속할 수 있다.", async ({ page }) => {
  await page.goto("https://www.bizhows.com/ko");

  const userMenu = page.getByRole("button", { name: /.+님$/ });
  await expect(userMenu).toBeVisible();
});
