import { test, expect } from "@playwright/test";

test.use({ storageState: "playwright/.auth/user.json" });

test("저장된 로그인 상태로 Bizhows에 접속할 수 있다.", async ({ page }) => {
  // Given: 저장된 로그인 상태가 적용된 브라우저를 사용한다.
  await page.goto("https://www.bizhows.com/ko");

  // Then: 로그인한 사용자의 메뉴가 표시된다.
  const userMenu = page.getByRole("button", { name: /.+님$/ });
  await expect(userMenu).toBeVisible();
});
