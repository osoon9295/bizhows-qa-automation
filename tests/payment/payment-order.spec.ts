import { test, expect } from "@playwright/test";
import {
  getCartProducts,
  getCartQuantity,
  selectTwoCartProducts,
} from "../../helpers/cart";
import { parseOptions } from "../../helpers/options";

test.use({
  storageState: "playwright/.auth/user.json",
});

test("장바구니페이지의 상품 데이터와 주문페이지의 상품 데이터가 일치한다.", async ({
  page,
}) => {
  // Given
  await page.addLocatorHandler(
    page.getByRole("button", {
      name: "괜찮아요",
      exact: true,
    }),
    async (closeButton) => {
      await closeButton.click();
    },
  );

  await page.goto("https://www.bizhows.com/ko/v/step3-cart");

  await selectTwoCartProducts(page);

  const cartProducts = getCartProducts(page);

  const selectedCartItems = cartProducts.filter({
    has: page.getByRole("checkbox", { checked: true }),
  });

  const firstCartProduct = selectedCartItems.nth(0);
  const secondCartProduct = selectedCartItems.nth(1);

  // 장바구니 - 상품 아이템 개수
  const selectedCartItemCount = await selectedCartItems.count();

  expect(selectedCartItemCount).toBe(2);

  await expect(
    page.locator("label").filter({ hasText: /^(\d+개 선택)$/ }),
  ).toHaveText(`${selectedCartItemCount}개 선택`);

  await expect(
    page.getByRole("button", {
      name: `총 ${selectedCartItemCount}개 주문하기`,
      exact: true,
    }),
  ).toBeVisible();

  // 장바구니 - 상품 아이템 이름
  const firstCartProductName = await firstCartProduct
    .locator('a[href^="/ko/v/option?"]')
    .innerText();
  const secondCartProductName = await secondCartProduct
    .locator('a[href^="/ko/v/option?"]')
    .innerText();

  // 장바구니 - 상품 아이템 옵션
  const firstCartProductOptionsText = await firstCartProduct
    .locator("ul")
    .first()
    .innerText();

  const secondCartProductOptionsText = await secondCartProduct
    .locator("ul")
    .first()
    .innerText();

  const firstCartOptions = parseOptions(firstCartProductOptionsText.split("|"));
  const secondCartOptions = parseOptions(
    secondCartProductOptionsText.split("|"),
  );

  const firstCartQuantity = await getCartQuantity(firstCartProduct);
  const secondCartQuantity = await getCartQuantity(secondCartProduct);

  // When
  await page.getByRole("button", { name: "총 2개 주문하기" }).click();

  // Then
  await expect(page).toHaveURL("https://www.bizhows.com/ko/v/step4-address");

  // 1. 주문상품 개수가 선택한 상품 개수인 2개와 일치한다.
  await expect(
    page.getByRole("heading", { name: /^주문상품 \(\d+\)$/, exact: true }),
  ).toHaveText(`주문상품 (${selectedCartItemCount})`);

  // 2. 주문상품명은 장바구니에서 선택한 상품명과 각각 일치한다.
  await expect(
    page.getByRole("heading", {
      name: firstCartProductName,
      level: 3,
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: secondCartProductName,
      level: 3,
      exact: true,
    }),
  ).toBeVisible();

  // 3. 주문상품 옵션은 장바구니에서 선택한 상품 옵션과 각각 일치한다.
  const firstOrderProduct = page
    .getByRole("heading", {
      name: firstCartProductName,
      level: 3,
      exact: true,
    })
    .locator("xpath=ancestor::li[1]");

  const secondOrderProduct = page
    .getByRole("heading", {
      name: secondCartProductName,
      level: 3,
      exact: true,
    })
    .locator("xpath=ancestor::li[1]");

  const firstOrderOptionTexts = await firstOrderProduct
    .locator("ul>li")
    .allInnerTexts();

  const secondOrderOptionTexts = await secondOrderProduct
    .locator("ul>li")
    .allInnerTexts();

  const firstOrderOptions = parseOptions(firstOrderOptionTexts);
  const secondOrderOptions = parseOptions(secondOrderOptionTexts);

  const { "수량(건)": firstOrderQuantity, ...firstOrderRest } =
    firstOrderOptions;
  const { "수량(건)": secondOrderQuantity, ...secondOrderRest } =
    secondOrderOptions;

  expect(firstCartOptions).toEqual(firstOrderRest);
  expect(secondCartOptions).toEqual(secondOrderRest);

  if (firstCartQuantity !== null) {
    expect(Number(firstOrderQuantity)).toBe(firstCartQuantity);
  } else {
    expect(Number(firstOrderQuantity)).toBe(1);
  }

  if (secondCartQuantity !== null) {
    expect(Number(secondOrderQuantity)).toBe(secondCartQuantity);
  } else {
    expect(Number(secondOrderQuantity)).toBe(1);
  }

  // 4. 주문상품별 금액은 장바구니에서 선택한 상품별 금액과 각각 일치한다.

  // 5. 최종 결제금액은 장바구니에서 계산된 주문금액과 일치한다.
});
