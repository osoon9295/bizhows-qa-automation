import { expect, type Page, type Locator } from "@playwright/test";

export function getCartProducts(page: Page) {
  return page.locator("div[data-comm-idx]");
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
