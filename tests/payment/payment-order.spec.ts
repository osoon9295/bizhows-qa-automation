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

  // 장바구니 - 상품 아이템 개수
  const selectedCartItemCount = await selectedCartItems.count();

  expect(selectedCartItemCount).toBe(2);

  // 장바구니 - 상품 데이터 저장
  const cartItems: {
    name: string;
    options: Record<string, string>;
    quantity: number | null;
  }[] = [];

  for (let i = 0; i < selectedCartItemCount; i++) {
    const product = selectedCartItems.nth(i);

    // 상품명
    const name = await product.locator('a[href^="/ko/v/option?"]').innerText();

    // 옵션
    const OptionsText = await product.locator("ul").first().innerText();
    const options = parseOptions(OptionsText.split("|"));

    // 수량
    const quantity = await getCartQuantity(product);

    cartItems.push({ name, options, quantity });
  }

  await expect(
    page.locator("label").filter({ hasText: /^(\d+개 선택)$/ }),
  ).toHaveText(`${selectedCartItemCount}개 선택`);

  // When
  await page
    .getByRole("button", {
      name: `총 ${selectedCartItemCount}개 주문하기`,
      exact: true,
    })
    .click();

  // Then
  await expect(page).toHaveURL("https://www.bizhows.com/ko/v/step4-address");

  // 1. 주문상품 개수가 선택한 상품 개수인 2개와 일치한다.
  await expect(
    page.getByRole("heading", { name: /^주문상품 \(\d+\)$/, exact: true }),
  ).toHaveText(`주문상품 (${selectedCartItemCount})`);

  // 2. 주문내용(제품명, 옵션, 수량)이 선택한 내용과 일치한다.
  for (const cartItem of cartItems) {
    const orderProductName = page.getByRole("heading", {
      name: cartItem.name,
      level: 3,
      exact: true,
    });

    await expect(orderProductName).toBeVisible();

    const orderProduct = orderProductName.locator("xpath=ancestor::li[1]");

    const orderOptionTexts = await orderProduct
      .locator("ul>li")
      .allInnerTexts();

    const orderOptions = parseOptions(orderOptionTexts);

    const { "수량(건)": orderQuantity, ...orderRestOptions } = orderOptions;

    expect(orderRestOptions).toEqual(cartItem.options);

    if (cartItem.quantity !== null) {
      expect(Number(orderQuantity)).toBe(cartItem.quantity);
    } else {
      expect(Number(orderQuantity)).toBe(1);
    }
  }

  // 3. 주문상품별 금액은 장바구니에서 선택한 상품별 금액과 각각 일치한다.
});
