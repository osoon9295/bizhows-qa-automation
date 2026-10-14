import { test, expect } from "@playwright/test";
import {
  getCartAmountLocators,
  getCartProducts,
  getCartQuantity,
  selectTwoCartProducts,
} from "../../helpers/cart";
import { parseOptions } from "../../helpers/options";
import { parsePrice } from "../../helpers/price";

test.use({
  storageState: "playwright/.auth/user.json",
});

test("장바구니와 주문 페이지의 상품 데이터가 일치한다.", async ({
  page,
}) => {
  // Given: 장바구니에 상품 2개를 선택하고 상품 데이터와 금액을 저장한다.
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

  const selectedCartItemCount = await selectedCartItems.count();

  expect(selectedCartItemCount).toBe(2);

  const cartItems: {
    name: string;
    options: Record<string, string>;
    quantity: number | null;
    originalPrice: number;
    discountedPrice: number;
  }[] = [];

  for (let i = 0; i < selectedCartItemCount; i++) {
    const product = selectedCartItems.nth(i);

    const name = await product.locator('a[href^="/ko/v/option?"]').innerText();

    const optionsText = await product.locator("ul").first().innerText();
    const options = parseOptions(optionsText.split("|"));

    const quantity = await getCartQuantity(product);

    const originalPrice = parsePrice(
      (await product.locator("s").textContent())!,
    );

    const discountedPrice = parsePrice(
      (await product.locator("small + div > span").textContent())!,
    );

    cartItems.push({ name, options, quantity, originalPrice, discountedPrice });
  }

  await expect(
    page.locator("label").filter({ hasText: /^(\d+개 선택)$/ }),
  ).toHaveText(`${selectedCartItemCount}개 선택`);

  const {
    orderAmount: cartOrderAmountLocator,
    productDiscountAmount: cartProductDiscountAmountLocator,
    shippingFee: cartShippingFeeLocator,
    totalAmount: cartTotalAmountLocator,
  } = getCartAmountLocators(page);

  const cartOrderAmount = parsePrice(await cartOrderAmountLocator.innerText());

  const cartProductDiscountAmount = parsePrice(
    await cartProductDiscountAmountLocator.innerText(),
  );

  const cartShippingFee = parsePrice(await cartShippingFeeLocator.innerText());

  const cartTotalAmount = parsePrice(await cartTotalAmountLocator.innerText());

  const cartAmounts = {
    orderAmount: cartOrderAmount,
    productDiscountAmount: cartProductDiscountAmount,
    shippingFee: cartShippingFee,
    totalAmount: cartTotalAmount,
  };

  // When: 선택한 상품의 주문을 진행한다.
  await page
    .getByRole("button", {
      name: `총 ${selectedCartItemCount}개 주문하기`,
      exact: true,
    })
    .click();

  // Then: 주문 페이지의 상품 정보와 금액이 장바구니와 일치한다.
  await expect(page).toHaveURL("https://www.bizhows.com/ko/v/step4-address");

  await expect(
    page.getByRole("heading", { name: /^주문상품 \(\d+\)$/, exact: true }),
  ).toHaveText(`주문상품 (${selectedCartItemCount})`);

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

    const orderOriginalPriceText = await orderProduct
      .locator("s")
      .textContent();

    const orderOriginalPrice = parsePrice(orderOriginalPriceText!);

    expect(orderOriginalPrice).toBe(cartItem.originalPrice);

    const discountedPriceText = await orderProduct
      .locator("s")
      .locator("xpath=../preceding-sibling::div[1]")
      .textContent();

    const orderDiscountedPrice = parsePrice(discountedPriceText!);
    expect(orderDiscountedPrice).toBe(cartItem.discountedPrice);
  }

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

  const expectedTotalAmount =
    checkoutAmounts.orderAmount -
    checkoutAmounts.productDiscountAmount +
    checkoutAmounts.shippingFee -
    checkoutAmounts.pointsUsed;

  expect(expectedTotalAmount).toBe(checkoutAmounts.totalAmount);
});
