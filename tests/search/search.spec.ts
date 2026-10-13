import { test, expect } from "@playwright/test";

test("검색 아이콘으로 검색하면 검색 결과가 표시된다.", async ({
  page,
}) => {
  const keyword = "다이어리";

  // Given: Bizhows 메인 페이지에 접속하고 검색어를 준비한다.
  await page.goto("https://www.bizhows.com/ko");

  // When: 검색 아이콘을 클릭해 검색을 실행한다.
  const searchInput = page.getByPlaceholder("업종 또는 상품으로 검색해보세요!");
  const searchButton = page
    .locator('a[href^="/ko/v/search?keyword="]')
    .filter({ has: page.locator("i") });

  await searchInput.fill(keyword);
  await searchButton.click();

  // Then: 검색어가 포함된 검색 결과 페이지와 결과 목록이 표시된다.
  await expect(page).toHaveURL((url) => {
    return url.searchParams.get("keyword") === keyword;
  });
  await expect(page.getByText(/검색된 상품 \d+개/)).toHaveText(
    /검색된 상품 [1-9]\d*개/,
  );
});

test("Enter 키로 검색하면 검색 결과가 표시된다.", async ({ page }) => {
  const keyword = "다이어리";

  // Given: Bizhows 메인 페이지에 접속하고 검색어를 준비한다.
  await page.goto("https://www.bizhows.com/ko");

  // When: Enter 키를 눌러 검색을 실행한다.
  const searchInput = page.getByPlaceholder("업종 또는 상품으로 검색해보세요!");

  await searchInput.fill(keyword);
  await searchInput.press("Enter");

  // Then: 검색어가 포함된 검색 결과 페이지와 결과 목록이 표시된다.
  await expect(page).toHaveURL((url) => {
    return url.searchParams.get("keyword") === keyword;
  });
  await expect(page.getByText(/검색된 상품 \d+개/)).toHaveText(
    /검색된 상품 [1-9]\d*개/,
  );
});

test("검색 결과가 없는 검색어를 검색하면 상품 0개가 표시된다.", async ({
  page,
}) => {
  const keyword = "bizhows_qa_no_result_260928_x9q7";

  // Given: Bizhows 메인 페이지에 접속하고 결과가 없는 검색어를 준비한다.
  await page.goto("https://www.bizhows.com/ko");

  // When: 검색 아이콘을 클릭해 검색을 실행한다.
  const searchInput = page.getByPlaceholder("업종 또는 상품으로 검색해보세요!");
  const searchButton = page
    .locator('a[href^="/ko/v/search?keyword="]')
    .filter({ has: page.locator("i") });

  await searchInput.fill(keyword);
  await searchButton.click();

  // Then: 검색 결과가 0개로 표시된다.
  await expect(page).toHaveURL((url) => {
    return url.searchParams.get("keyword") === keyword;
  });
  await expect(page.getByText(/검색된 상품 \d+개/)).toHaveText(
    "검색된 상품 0개",
  );
});
