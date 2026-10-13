import { test, expect } from "@playwright/test";
import {
  getCartProducts,
  getCartQuantity,
  selectTwoCartProducts,
} from "../../helpers/cart";
import { parseOptions } from "../../helpers/options";
import { parsePrice } from "../../helpers/price";

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
    originalPrice: number;
    discountedPrice: number;
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

    // 원래 금액
    const originalPrice = parsePrice(
      (await product.locator("s").textContent())!,
    );

    // 할인된 금액
    const discountedPrice = parsePrice(
      (await product.locator("small + div > span").textContent())!,
    );

    cartItems.push({ name, options, quantity, originalPrice, discountedPrice });
  }

  await expect(
    page.locator("label").filter({ hasText: /^(\d+개 선택)$/ }),
  ).toHaveText(`${selectedCartItemCount}개 선택`);

  // 장바구니 - 결제 금액
  const cartOrderAmountLocator = page
    .locator("span")
    .filter({ hasText: /^주문 금액$/ })
    .locator("+ span");

  const cartOrderAmount = parsePrice(await cartOrderAmountLocator.innerText());

  const cartProductDiscountAmountLocator = page
    .locator("span")
    .filter({ hasText: /^상품 할인 금액$/ })
    .locator("+ span");

  const cartProductDiscountAmount = parsePrice(
    await cartProductDiscountAmountLocator.innerText(),
  );

  const cartShippingFeeLabel = page
    .locator("span")
    .filter({ hasText: /^배송비\s*$/ });

  const cartShippingFeeLocator = cartShippingFeeLabel
    .locator("+ span")
    .or(
      page
        .locator("summary")
        .filter({ has: cartShippingFeeLabel })
        .locator(":scope > span"),
    );

  const cartShippingFee = parsePrice(await cartShippingFeeLocator.innerText());

  const cartTotalAmountLocator = page
    .locator("span")
    .filter({ hasText: /^총 금액$/ })
    .locator("+ span");

  const cartTotalAmount = parsePrice(await cartTotalAmountLocator.innerText());

  const cartAmounts = {
    orderAmount: cartOrderAmount,
    productDiscountAmount: cartProductDiscountAmount,
    shippingFee: cartShippingFee,
    totalAmount: cartTotalAmount,
  };

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

  // 2. 주문내용(제품명, 옵션, 수량, 원래 가격, 할인된 가격)이 선택한 내용과 일치한다.
  for (const cartItem of cartItems) {
    // 제품명
    const orderProductName = page.getByRole("heading", {
      name: cartItem.name,
      level: 3,
      exact: true,
    });

    await expect(orderProductName).toBeVisible();

    const orderProduct = orderProductName.locator("xpath=ancestor::li[1]");

    // 옵션
    const orderOptionTexts = await orderProduct
      .locator("ul>li")
      .allInnerTexts();

    const orderOptions = parseOptions(orderOptionTexts);

    const { "수량(건)": orderQuantity, ...orderRestOptions } = orderOptions;

    expect(orderRestOptions).toEqual(cartItem.options);

    // 수량
    if (cartItem.quantity !== null) {
      expect(Number(orderQuantity)).toBe(cartItem.quantity);
    } else {
      expect(Number(orderQuantity)).toBe(1);
    }

    // 원래 가격
    const orderOriginalPriceText = await orderProduct
      .locator("s")
      .textContent();

    const orderOriginalPrice = parsePrice(orderOriginalPriceText!);

    expect(orderOriginalPrice).toBe(cartItem.originalPrice);

    // 할인된 가격
    const discountedPriceText = await orderProduct
      .locator("s")
      .locator("xpath=../preceding-sibling::div[1]")
      .textContent();

    const orderDiscountedPrice = parsePrice(discountedPriceText!);
    expect(orderDiscountedPrice).toBe(cartItem.discountedPrice);
  }

  // 3. 최종 결제금액은 장바구니에서 계산된 주문금액과 일치한다.
  const checkoutOrderAmountLocator = page
    .getByText("주문금액", { exact: true })
    .locator("+ span");

  const checkoutOrderAmount = parsePrice(
    await checkoutOrderAmountLocator.innerText(),
  );

  const checkoutProductDiscountAmountLocator = page
    .getByText("상품 할인 금액", { exact: true })
    .locator("xpath=ancestor::summary[1]")
    .locator(":scope > span");

  const checkoutProductDiscountAmount = parsePrice(
    await checkoutProductDiscountAmountLocator.innerText(),
  );

  const checkoutShippingFeeLocator = page
    .getByText("배송비", { exact: true })
    .locator("xpath=ancestor::summary[1]")
    .locator(":scope > span");

  const checkoutShippingFee = parsePrice(
    await checkoutShippingFeeLocator.innerText(),
  );

  const checkoutPointsUsedLocator = page
    .getByText("포인트 사용", { exact: true })
    .locator("+ span");

  const checkoutPointsUsed = parsePrice(
    await checkoutPointsUsedLocator.innerText(),
  );

  const checkoutTotalAmountLocator = page
    .getByText("총 금액", { exact: true })
    .locator("+ span");

  const checkoutTotalAmount = parsePrice(
    await checkoutTotalAmountLocator.innerText(),
  );

  const checkoutAmounts = {
    orderAmount: checkoutOrderAmount,
    productDiscountAmount: checkoutProductDiscountAmount,
    shippingFee: checkoutShippingFee,
    pointsUsed: checkoutPointsUsed,
    totalAmount: checkoutTotalAmount,
  };

  expect(checkoutAmounts.orderAmount).toBe(cartAmounts.orderAmount);
  expect(checkoutAmounts.productDiscountAmount).toBe(
    cartAmounts.productDiscountAmount,
  );
  expect(checkoutAmounts.shippingFee).toBe(cartAmounts.shippingFee);

  const expectedTotalAmound =
    checkoutAmounts.orderAmount -
    checkoutAmounts.productDiscountAmount +
    checkoutAmounts.shippingFee -
    checkoutAmounts.pointsUsed;

  expect(expectedTotalAmound).toBe(checkoutAmounts.totalAmount);
});
