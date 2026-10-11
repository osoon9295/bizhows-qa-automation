import { test, expect } from "@playwright/test";

test("페이지 첫 진입시 기본 옵션이 표시된다.", async ({ page }) => {
  // Given
  await page.goto(
    "https://www.bizhows.com/ko/v/option?code1=9000&code2=200&code3=9101&mock=9000_200_9101&from=megamenu_search",
  );

  // Then
  await expect(
    page.getByRole("button", { name: "10온스", exact: true }),
  ).toBeVisible();

  await expect(
    page.getByRole("button", { name: "없음", exact: true }),
  ).toBeVisible();

  await expect(
    page.getByRole("button", { name: "500", exact: true }),
  ).toBeVisible();
});

const cases = [
  {
    size: "6.5온스",
    defaultLid: "없음",
    lids: ["없음"],
    defaultQuantity: "1000",
    quantities: ["1000", "2000", "3000", "4000", "5000"],
  },
  {
    size: "8온스(품절)",
    defaultLid: "없음",
    lids: [
      "없음",
      "일반형 뚜껑 - 검정(8온스)",
      "일반형 뚜껑 - 흰색(8온스)",
      "개폐형 뚜껑 - 검정(8온스)",
      "개폐형 뚜껑 - 흰색(8온스)",
    ],
    defaultQuantity: "1000",
    quantities: ["1000", "2000", "3000", "4000", "5000"],
  },
  {
    size: "10온스",
    defaultLid: "없음",
    lids: [
      "없음",
      "일반형 뚜껑 - 검정(10온스)",
      "일반형 뚜껑 - 흰색(10온스)",
      "개폐형 뚜껑 - 검정(10온스)",
      "개폐형 뚜껑 - 흰색(10온스)",
    ],
    defaultQuantity: "500",
    quantities: ["500", "1000", "2000", "3000", "4000", "5000"],
  },
  {
    size: "16온스",
    defaultLid: "없음",
    lids: [
      "없음",
      "일반형 뚜껑 - 검정(16온스)",
      "일반형 뚜껑 - 흰색(16온스)",
      "개폐형 뚜껑 - 검정(16온스)",
      "개폐형 뚜껑 - 흰색(16온스)",
    ],
    defaultQuantity: "1000",
    quantities: ["1000", "2000", "3000", "4000", "5000"],
  },
];

for (const testCase of cases) {
  test(`${testCase.size} 수량 옵션을 확인한다.`, async ({ page }) => {
    // Given
    await page.goto(
      "https://www.bizhows.com/ko/v/option?code1=9000&code2=200&code3=9101&mock=9000_200_9101&from=megamenu_search",
    );

    // When - 1. 사이즈 선택
    if (testCase.size !== "10온스") {
      const sizeDropdownTrigger = page.getByRole("button", {
        name: "10온스",
        exact: true,
      });

      await sizeDropdownTrigger.click();

      const size = page.getByRole("button", {
        name: testCase.size,
        exact: true,
      });

      await expect(size).toBeVisible();

      await size.click();

      await expect(
        page.getByRole("button", {
          name: testCase.size,
          exact: true,
        }),
      ).toBeVisible();
    }

    // When - 2. 수량 드롭다운 열기
    const quantityDropdownTrigger = page.getByRole("button", {
      name: testCase.defaultQuantity,
      exact: true,
    });

    await quantityDropdownTrigger.click();

    //  Then
    const quantityListbox = page.getByRole("listbox");

    await expect(quantityListbox).toBeVisible();

    const quantityOptions = quantityListbox
      .locator("span")
      .filter({ hasText: /^\d+$/ });
    await expect(quantityOptions).toHaveText(testCase.quantities);
  });
}

for (const testCase of cases) {
  test(`${testCase.size} 뚜껑 옵션을 확인한다.`, async ({ page }) => {
    // Given
    await page.goto(
      "https://www.bizhows.com/ko/v/option?code1=9000&code2=200&code3=9101&mock=9000_200_9101&from=megamenu_search",
    );

    // When - 1. 사이즈 선택
    if (testCase.size !== "10온스") {
      const sizeDropdownTrigger = page.getByRole("button", {
        name: "10온스",
        exact: true,
      });

      await sizeDropdownTrigger.click();

      const size = page.getByRole("button", {
        name: testCase.size,
        exact: true,
      });

      await expect(size).toBeVisible();

      await size.click();
    }

    // When - 2. 뚜껑 드롭다운 열기
    const lidDropdownTrigger = page.getByRole("button", {
      name: testCase.defaultLid,
      exact: true,
    });

    await lidDropdownTrigger.click();

    //  Then
    const lidListbox = page.getByRole("listbox");

    await expect(lidListbox).toBeVisible();

    const lidOptions = lidListbox.getByRole("option");

    await expect(lidOptions).toHaveText(testCase.lids);
  });
}

test("사이즈 변경시 선택값이 유효하면 유지되고, 유효하지 않으면 기본값으로 초기화된다.", async ({
  page,
}) => {
  // Given 1 : 비즈하우스 상품 인쇄종이컵 상세 페이지에 접속해 있다.
  await page.goto(
    "https://www.bizhows.com/ko/v/option?code1=9000&code2=200&code3=9101&mock=9000_200_9101&from=megamenu_search",
  );
  // Given 2 : 사이즈 10온스, 뚜껑 없음, 수량 500이 기본 선택되어 있다.
  await expect(
    page.getByRole("button", { name: "10온스", exact: true }),
  ).toBeVisible();

  await expect(
    page.getByRole("button", { name: "없음", exact: true }),
  ).toBeVisible();

  await expect(
    page.getByRole("button", { name: "500", exact: true }),
  ).toBeVisible();

  // When 1 : 뚜껑을 "일반형 뚜껑-흰색(10온스)"로 변경한다.
  const lidDropdownTrigger = page.getByRole("button", {
    name: "없음",
    exact: true,
  });

  await lidDropdownTrigger.click();

  const lid = page.getByRole("option", {
    name: "일반형 뚜껑 - 흰색(10온스)",
    exact: true,
  });

  await expect(lid).toBeVisible();

  await lid.click();

  // When 2 : 사이즈를 16온스로 변경한다.
  const size10DropdownTrigger = page.getByRole("button", {
    name: "10온스",
    exact: true,
  });

  await size10DropdownTrigger.click();

  const size16Option = page.getByRole("button", {
    name: "16온스",
    exact: true,
  });

  await size16Option.click();

  // Then : 뚜껑 없음으로 초기화되고 드롭다운 메뉴에서 16온스용 뚜껑 옵션만 표시되고 수량은 1000으로 초기화된다.
  await expect(lidDropdownTrigger).toHaveText("없음");

  await lidDropdownTrigger.click();

  const lidListbox = page.getByRole("listbox");

  await expect(lidListbox).toBeVisible();

  const lidOptions = lidListbox.getByRole("option");

  await expect(lidOptions).toHaveText([
    "없음",
    "일반형 뚜껑 - 검정(16온스)",
    "일반형 뚜껑 - 흰색(16온스)",
    "개폐형 뚜껑 - 검정(16온스)",
    "개폐형 뚜껑 - 흰색(16온스)",
  ]);

  await lidListbox.getByRole("option", { name: "없음", exact: true }).click();

  const quantityDropdownTrigger = page.getByRole("button", {
    name: "1000",
    exact: true,
  });

  await expect(quantityDropdownTrigger).toBeVisible();

  // When 3 : 사이즈를 13온스로 변경한다.
  const size16DropdownTrigger = page.getByRole("button", {
    name: "16온스",
    exact: true,
  });

  await size16DropdownTrigger.click();

  const size13Option = page.getByRole("button", {
    name: "13온스",
    exact: true,
  });

  await size13Option.click();

  // Then: 뚜껑 없음이 유지되고 수량 1000이 유지된다.
  await expect(lidDropdownTrigger).toHaveText("없음");
  await expect(quantityDropdownTrigger).toBeVisible();
});
