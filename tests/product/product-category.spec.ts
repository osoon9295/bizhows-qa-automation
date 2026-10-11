import { test, expect } from "@playwright/test";

test("상품 제작 전체보기 메뉴를 호버하면 카테고리 메가 메뉴가 노출된다.", async ({
  page,
}) => {
  // Given
  await page.goto("https://www.bizhows.com/ko");

  // When
  await page.getByText("상품 제작 전체보기").hover();

  // Then
  await expect(
    page.getByRole("link", { name: "기업 대량 주문🏢" }),
  ).toBeVisible();
});

test("카테고리 그룹 선택 시 해당 카테고리의 상품 목록 페이지가 표시된다.", async ({
  page,
}) => {
  // Given
  await page.goto("https://www.bizhows.com/ko");
  await page.getByText("상품 제작 전체보기").hover();

  // When
  await page.getByText("우편/엽서봉투").click();

  // Then
  await expect(page).toHaveURL((url) => {
    return url.searchParams.get("categoryName") === "엽서카드/티켓";
  });

  const productCards = page.locator('a[href^="/ko/v/option"]');
  await expect(productCards.first()).toBeVisible();
});

test("카테고리 그룹 하위 상품 선택 시 해당 상품의 상세 페이지가 표시된다.", async ({
  page,
}) => {
  // Given
  await page.goto("https://www.bizhows.com/ko");
  await page.getByText("상품 제작 전체보기").hover();

  await page.pause();

  // When
  await page.getByRole("link", { name: "2단 청첩장", exact: true }).click();

  // Then
  await expect(page).toHaveURL((url) => {
    return url.pathname === "/ko/v/option";
  });
  await expect(page.getByText("2단 청첩장", { exact: true })).toBeVisible();
});
