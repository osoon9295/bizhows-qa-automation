import { expect, type Page, type Locator } from "@playwright/test";
import { parsePrice } from "./price";

export function getCartProducts(page: Page) {
  return page.locator("div[data-comm-idx]");
}

export function getCartAmountLocators(page: Page) {
  const cartShippingFeeLabel = page
    .locator("span")
    .filter({ hasText: /^배송비\s*$/ });

  return {
    orderAmount: page
      .locator("span")
      .filter({ hasText: /^주문 금액$/ })
      .locator("+ span"),
    productDiscountAmount: page
      .locator("span")
      .filter({ hasText: /^상품 할인 금액$/ })
      .locator("+ span"),
    shippingFee: cartShippingFeeLabel
      .locator("+ span")
      .or(
        page
          .locator("summary")
          .filter({ has: cartShippingFeeLabel })
          .locator(":scope > span"),
      ),
    totalAmount: page
      .locator("span")
      .filter({ hasText: /^총 금액$/ })
      .locator("+ span"),
  };
}

export async function getCartProductPrices(product: Locator) {
  const originalPrice = parsePrice(
    (await product.locator("s").textContent())!,
  );

  const discountedPrice = parsePrice(
    (await product.locator("small + div > span").textContent())!,
  );

  return { originalPrice, discountedPrice };
}

export async function selectCartProduct(page: Page, index: number) {
  const products = getCartProducts(page);
  const product = products.nth(index);

  const label = product.locator("label");
  const checkbox = label.getByRole("checkbox");

  if (!(await checkbox.isChecked())) {
    await label.click();
  }

  await expect(checkbox).toBeChecked();
}

export async function selectTwoCartProducts(page: Page) {
  const products = getCartProducts(page);

  await expect(products).toHaveCount(2);

  await selectCartProduct(page, 0);
  await selectCartProduct(page, 1);
}

export async function getCartQuantity(
  product: Locator,
): Promise<number | null> {
  const quantityInput = product.locator('input[inputmode="numeric"]');

  const inputCount = await quantityInput.count();

  if (inputCount === 0) return null;

  expect(inputCount).toBe(1);

  const quantity = Number(await quantityInput.inputValue());

  expect(Number.isInteger(quantity) && quantity > 0).toBe(true);

  return quantity;
}
