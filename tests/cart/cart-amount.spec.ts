import { test, expect } from "@playwright/test";

function parsePrice(text: string): number {
  return Number(text.replace(/[^\d]/g, ""));
}

test.use({
  storageState: "playwright/.auth/user.json",
});

test("장바구니 선택 상태에 따른 주문금액 검증", async ({ page }) => {
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

  const productItems = page.locator("div[data-comm-idx]");
  const firstProduct = productItems.nth(0);
  const secondProduct = productItems.nth(1);

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

  const orderAmount = page
    .locator("span")
    .filter({ hasText: /^주문 금액$/ })
    .locator("+ span");

  const discountAmount = page
    .locator("span")
    .filter({ hasText: /^상품 할인 금액$/ })
    .locator("+ span");

  const deliveryChargeLabel = page
    .locator("span")
    .filter({ hasText: /^배송비\s*$/ });

  const deliveryCharge = deliveryChargeLabel
    .locator("+ span")
    .or(
      page
        .locator("summary")
        .filter({ has: deliveryChargeLabel })
        .locator(":scope > span"),
    );

  const sum = page
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
    await expect(orderAmount).toHaveText("0원");
    await expect(discountAmount).toHaveText("- 0원");
    await expect(deliveryCharge).toHaveText("0원");
    await expect(sum).toHaveText("0원");

    await expect(
      page
        .locator("aside")
        .getByRole("button", { name: "주문하기", exact: true }),
    ).toBeDisabled();
  });

  await test.step("선택 상품 1개", async () => {
    // When
    await expect(productItems).toHaveCount(2);

    const firstCheckboxLabel = firstProduct.locator("label");
    const firstCheckbox = firstCheckboxLabel.getByRole("checkbox");

    await expect(firstCheckbox).not.toBeChecked();

    await firstCheckboxLabel.click();

    await expect(firstCheckbox).toBeChecked();

    // Then
    await expect(orderAmount).toHaveText(
      `${firstOriginalPrice.toLocaleString("ko-KR")}원`,
    );

    const expectedDiscount = firstOriginalPrice - firstDiscountedPrice;

    await expect(discountAmount).toHaveText(
      `- ${expectedDiscount.toLocaleString("ko-KR")}원`,
    );

    const deliveryChargeValue = parsePrice(
      (await deliveryCharge.textContent())!,
    );

    await expect(deliveryCharge).toHaveCount(1);

    await expect(sum).toHaveText(
      `${(firstOriginalPrice - expectedDiscount + deliveryChargeValue).toLocaleString("ko-KR")}원`,
    );
  });

  await test.step("선택 상품 2개", async () => {
    // When
    const secondCheckboxLabel = secondProduct.locator("label");
    const secondCheckbox = secondCheckboxLabel.getByRole("checkbox");

    await expect(secondCheckbox).not.toBeChecked();

    await secondCheckboxLabel.click();

    await expect(secondCheckbox).toBeChecked();

    //Then

    const expectedAmount = firstOriginalPrice + secondOriginalPrice;

    await expect(orderAmount).toHaveText(
      `${expectedAmount.toLocaleString("ko-KR")}원`,
    );

    const expectedDiscount =
      firstOriginalPrice +
      secondOriginalPrice -
      (firstDiscountedPrice + secondDiscountedPrice);

    await expect(discountAmount).toHaveText(
      `- ${expectedDiscount.toLocaleString("ko-KR")}원`,
    );

    const deliveryChargeValue = parsePrice(
      (await deliveryCharge.textContent())!,
    );

    await expect(sum).toHaveText(
      `${(expectedAmount - expectedDiscount + deliveryChargeValue).toLocaleString("ko-KR")}원`,
    );
  });
});
