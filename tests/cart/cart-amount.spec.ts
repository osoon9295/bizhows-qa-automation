import { test, expect } from "@playwright/test";
import { parsePrice } from "../../helpers/price";
import {
  getCartAmountLocators,
  getCartProductPrices,
  getCartProducts,
  selectCartProduct,
} from "../../helpers/cart";

test.use({
  storageState: "playwright/.auth/user.json",
});

test("장바구니 상품 선택 상태에 따라 주문 금액을 검증한다.", async ({ page }) => {
  // Given: 장바구니에 상품 2개가 있고 전체 선택 상태인 페이지에 진입한다.
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

  const selectedCountLabel = page
    .locator("label")
    .filter({ hasText: /^(\d+개 선택)$/ });

  const unselectedCountLabel = page
    .locator("header label")
    .filter({ hasText: /^전체 선택$/ });

  const products = getCartProducts(page);

  await expect(products).toHaveCount(2);

  const firstProduct = products.nth(0);
  const secondProduct = products.nth(1);

  const firstProductPrices = await getCartProductPrices(firstProduct);
  const secondProductPrices = await getCartProductPrices(secondProduct);

  const {
    orderAmount: cartOrderAmountLocator,
    productDiscountAmount: cartProductDiscountAmountLocator,
    shippingFee: cartShippingFeeLocator,
    totalAmount: cartTotalAmountLocator,
  } = getCartAmountLocators(page);

  await test.step("선택 상품 0개", async () => {
    // Given: 장바구니의 모든 상품이 선택된 상태이다.
    const selectAllCheckbox = selectedCountLabel.getByRole("checkbox");
    const unselectAllCheckbox = unselectedCountLabel.getByRole("checkbox");

    await expect(selectAllCheckbox).toBeChecked();

    // When: 전체 선택을 해제한다.
    await selectedCountLabel.click();

    await expect(unselectAllCheckbox).not.toBeChecked();

    // Then: 선택 상품이 없고 주문 금액과 주문하기 버튼이 비활성 상태이다.
    await expect(cartOrderAmountLocator).toHaveText("0원");
    await expect(cartProductDiscountAmountLocator).toHaveText("- 0원");
    await expect(cartShippingFeeLocator).toHaveText("0원");
    await expect(cartTotalAmountLocator).toHaveText("0원");

    await expect(
      page
        .locator("aside")
        .getByRole("button", { name: "주문하기", exact: true }),
    ).toBeDisabled();
  });

  await test.step("선택 상품 1개", async () => {
    // Given: 장바구니 상품 0개가 선택된 상태이다.

    // When: 첫 번째 상품을 선택한다.
    await selectCartProduct(page, 0);

    // Then: 첫 번째 상품의 주문 금액과 할인 금액, 총 금액이 계산된다.
    await expect(cartOrderAmountLocator).toHaveText(
      `${firstProductPrices.originalPrice.toLocaleString("ko-KR")}원`,
    );

    const expectedDiscount =
      firstProductPrices.originalPrice - firstProductPrices.discountedPrice;

    await expect(cartProductDiscountAmountLocator).toHaveText(
      `- ${expectedDiscount.toLocaleString("ko-KR")}원`,
    );

    const deliveryChargeValue = parsePrice(
      (await cartShippingFeeLocator.textContent())!,
    );

    await expect(cartShippingFeeLocator).toHaveCount(1);

    await expect(cartTotalAmountLocator).toHaveText(
      `${(firstProductPrices.originalPrice - expectedDiscount + deliveryChargeValue).toLocaleString("ko-KR")}원`,
    );
  });

  await test.step("선택 상품 2개", async () => {
    // Given: 장바구니 상품 1개가 선택된 상태이다.

    // When: 두 번째 상품을 선택한다.
    await selectCartProduct(page, 1);

    // Then: 두 상품의 주문 금액과 할인 금액, 총 금액이 합산된다.

    const expectedAmount =
      firstProductPrices.originalPrice + secondProductPrices.originalPrice;

    await expect(cartOrderAmountLocator).toHaveText(
      `${expectedAmount.toLocaleString("ko-KR")}원`,
    );

    const expectedDiscount =
      firstProductPrices.originalPrice +
      secondProductPrices.originalPrice -
      (firstProductPrices.discountedPrice +
        secondProductPrices.discountedPrice);

    await expect(cartProductDiscountAmountLocator).toHaveText(
      `- ${expectedDiscount.toLocaleString("ko-KR")}원`,
    );

    const deliveryChargeValue = parsePrice(
      (await cartShippingFeeLocator.textContent())!,
    );

    await expect(cartTotalAmountLocator).toHaveText(
      `${(expectedAmount - expectedDiscount + deliveryChargeValue).toLocaleString("ko-KR")}원`,
    );
  });
});
