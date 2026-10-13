import { test, expect } from "@playwright/test";

const cases = [
  { quantity: "1", expectedValue: "1", plusEnabled: true, minusEnabled: false },
  {
    quantity: "9999",
    expectedValue: "9999",
    plusEnabled: false,
    minusEnabled: true,
  },
  { quantity: "0", expectedValue: "1", plusEnabled: true, minusEnabled: false },
  {
    quantity: "10000",
    expectedValue: "9999",
    plusEnabled: false,
    minusEnabled: true,
  },
];

for (const testCase of cases) {
  const plusState = testCase.plusEnabled ? "활성화" : "비활성화";
  const minusState = testCase.minusEnabled ? "활성화" : "비활성화";
  test(`수량 ${testCase.quantity} 입력 시 ${testCase.expectedValue}로 보정되고, - 버튼은 ${minusState}, + 버튼은 ${plusState} 상태가 된다.`, async ({
    page,
  }) => {
    // Given
    await page.goto(
      "https://www.bizhows.com/ko/v/option?code1=7700&code2=200&code3=7346&mock=7700_200_7346_2&from=search&fromSearchKeyword=%EB%AC%B4%EA%B4%91+%EC%8A%A4%ED%85%90+%ED%85%80%EB%B8%94%EB%9F%AC&selectedOptionList=33301085%2C33301112%2C33301111%2C33301110%2C33301108%2C33301107%2C33301101%2C33301099%2C33301603%2C33301106",
    );

    // When
    const quantityInput = page.locator('input[maxlength="5"]');

    await quantityInput.fill(testCase.quantity);

    // Then

    await expect(quantityInput).toHaveValue(testCase.expectedValue);

    const quantityControl = quantityInput.locator("..");

    const minusButton = quantityControl.getByRole("button").first();
    const plusButton = quantityControl.getByRole("button").last();

    if (testCase.plusEnabled) {
      await expect(plusButton).toBeEnabled();
    } else {
      await expect(plusButton).toBeDisabled();
    }

    if (testCase.minusEnabled) {
      await expect(minusButton).toBeEnabled();
    } else {
      await expect(minusButton).toBeDisabled();
    }
  });
}

test("상품 수량 증감 버튼으로 수량을 변경할 수 있다.", async ({ page }) => {
  // Given
  await page.goto(
    "https://www.bizhows.com/ko/v/option?code1=7700&code2=200&code3=7346&mock=7700_200_7346_2&from=search&fromSearchKeyword=%EB%AC%B4%EA%B4%91+%EC%8A%A4%ED%85%90+%ED%85%80%EB%B8%94%EB%9F%AC&selectedOptionList=33301085%2C33301112%2C33301111%2C33301110%2C33301108%2C33301107%2C33301101%2C33301099%2C33301603%2C33301106",
  );

  const quantityInput = page.locator('input[maxlength="5"]');

  await expect(quantityInput).toHaveValue("1");

  // When
  const quantityControl = quantityInput.locator("..");

  const minusButton = quantityControl.getByRole("button").first();
  const plusButton = quantityControl.getByRole("button").last();

  await test.step("+버튼을 누르면 수량이 1 증가한다.", async () => {
    await plusButton.click();
    await expect(quantityInput).toHaveValue("2");
  });

  await test.step("-버튼을 누르면 수량이 1 감소한다.", async () => {
    await minusButton.click();
    await expect(quantityInput).toHaveValue("1");
  });
});
