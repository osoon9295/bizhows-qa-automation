import { test, expect } from "@playwright/test";
import { parsePrice } from "../../helpers/price";
import { getCartProducts, selectCartProduct } from "../../helpers/cart";

test.use({
  storageState: "playwright/.auth/user.json",
});

test("장바구니 선택 상태에 따른 주문금액을 검증한다.", async ({ page }) => {
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

  const selectedLabel = page
    .locator("label")
    .filter({ hasText: /^(\d+개 선택)$/ });

  const unSelectedLabel = page
    .locator("header label")
    .filter({ hasText: /^전체 선택$/ });

  const products = getCartProducts(page);
  const firstProduct = products.nth(0);
  const secondProduct = products.nth(1);

  const firstOriginalPrice = parsePrice(
    (await firstProduct.locator("s").textContent())!,
  );

  const firstDiscountedPrice = parsePrice(
    (await firstProduct.locator("small + div > span").textContent())!,
  );

  const secondOriginalPrice = parsePrice(
    (await secondProduct.locator("s").textContent())!,
  );

  const secondDiscountedPrice = parsePrice(
    (await secondProduct.locator("small + div > span").textContent())!,
  );

  const cartOrderAmountLocator = page
    .locator("span")
    .filter({ hasText: /^주문 금액$/ })
    .locator("+ span");

  const cartProductDiscountAmountLocator = page
    .locator("span")
    .filter({ hasText: /^상품 할인 금액$/ })
    .locator("+ span");

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

  const cartTotalAmountLocator = page
    .locator("span")
    .filter({ hasText: /^총 금액$/ })
    .locator("+ span");

  await test.step("선택 상품 0개", async () => {
    // Given
    const selectAllCheckbox = selectedLabel.getByRole("checkbox");
    const unSelectAllCheckbox = unSelectedLabel.getByRole("checkbox");

    await expect(selectAllCheckbox).toBeChecked();

    // When
    await selectedLabel.click();

    await expect(unSelectAllCheckbox).not.toBeChecked();

    // Then
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
    // When
    await selectCartProduct(page, 0);

    // Then
    await expect(cartOrderAmountLocator).toHaveText(
      `${firstOriginalPrice.toLocaleString("ko-KR")}원`,
    );

    const expectedDiscount = firstOriginalPrice - firstDiscountedPrice;

    await expect(cartProductDiscountAmountLocator).toHaveText(
      `- ${expectedDiscount.toLocaleString("ko-KR")}원`,
    );

    const deliveryChargeValue = parsePrice(
      (await cartShippingFeeLocator.textContent())!,
    );

    await expect(cartShippingFeeLocator).toHaveCount(1);

    await expect(cartTotalAmountLocator).toHaveText(
      `${(firstOriginalPrice - expectedDiscount + deliveryChargeValue).toLocaleString("ko-KR")}원`,
    );
  });

  await test.step("선택 상품 2개", async () => {
    // When
    await selectCartProduct(page, 1);

    //Then

    const expectedAmount = firstOriginalPrice + secondOriginalPrice;

    await expect(cartOrderAmountLocator).toHaveText(
      `${expectedAmount.toLocaleString("ko-KR")}원`,
    );

    const expectedDiscount =
      firstOriginalPrice +
      secondOriginalPrice -
      (firstDiscountedPrice + secondDiscountedPrice);

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
