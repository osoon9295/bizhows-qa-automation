import { test, expect } from "@playwright/test";

test("상품 검색 시 검색 결과가 노출된다. - 검색아이콘 클릭", async ({
  page,
}) => {
  const keyword = "다이어리";

  // Given
  await page.goto("https://www.bizhows.com/ko");

  //When
  const searchInput = page.getByPlaceholder("업종 또는 상품으로 검색해보세요!");
  const searchButton = page
    .locator('a[href^="/ko/v/search?keyword="]')
    .filter({ has: page.locator("i") });

  await searchInput.fill(keyword);
  await searchButton.click();

  // Then
  await expect(page).toHaveURL((url) => {
    return url.searchParams.get("keyword") === keyword;
  });
  await expect(page.getByText(/검색된 상품 \d+개/)).toHaveText(
    /검색된 상품 [1-9]\d*개/,
  );
});

test("상품 검색 시 검색 결과가 노출된다. - Enter", async ({ page }) => {
  const keyword = "다이어리";

  // Given
  await page.goto("https://www.bizhows.com/ko");

  //when
  const searchInput = page.getByPlaceholder("업종 또는 상품으로 검색해보세요!");

  await searchInput.fill(keyword);
  await searchInput.press("Enter");

  // Then
  await expect(page).toHaveURL((url) => {
    return url.searchParams.get("keyword") === keyword;
  });
  await expect(page.getByText(/검색된 상품 \d+개/)).toHaveText(
    /검색된 상품 [1-9]\d*개/,
  );
});

test("결과 없는 검색어를 검색 할 때 검색된 상품 0개가 노출된다.", async ({
  page,
}) => {
  const keyword = "bizhows_qa_no_result_260928_x9q7";

  // Given
  await page.goto("https://www.bizhows.com/ko");

  //when
  const searchInput = page.getByPlaceholder("업종 또는 상품으로 검색해보세요!");
  const searchButton = page
    .locator('a[href^="/ko/v/search?keyword="]')
    .filter({ has: page.locator("i") });

  await searchInput.fill(keyword);
  await searchButton.click();

  // Then
  await expect(page).toHaveURL((url) => {
    return url.searchParams.get("keyword") === keyword;
  });
  await expect(page.getByText(/검색된 상품 \d+개/)).toHaveText(
    "검색된 상품 0개",
  );
});
