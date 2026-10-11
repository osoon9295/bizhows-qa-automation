# Playwright Troubleshooting: 늦게 표시되는 팝업으로 인한 체크박스 클릭 Timeout

> **유형:** 실제 간헐적 테스트 실패 / 안정성 개선  
> **대상:** 장바구니 전체 선택 체크박스  
> **확인 환경:** Chromium, Firefox, WebKit

## 1. 문제 상황

장바구니 페이지에 진입한 후 전체 선택을 해제하는 테스트에서 간헐적으로 클릭 시간이 초과되었다.

초기에는 팝업의 `괜찮아요` 버튼이 보일 때만 클릭하도록 작성했다.

```ts
const closeButton = page.getByRole("button", {
  name: "괜찮아요",
  exact: true,
});

if (await closeButton.isVisible()) {
  await closeButton.click();
}
```

그런데 이후 장바구니 체크박스 클릭 단계에서 `TimeoutError`가 발생했다.

---

## 2. 실제 오류 로그

```text
Error: locator.click: Test timeout of 30000ms exceeded

locator resolved to <label data-f="HC-36f1" ...>

<div data-f="MD-35af" ...>
from <div data-f="MP-8f48"> subtree intercepts pointer events
```

이 로그는 체크박스가 존재하지 않는다는 뜻이 아니라, **클릭 대상 위에 다른 요소가 겹쳐 포인터 이벤트를 가로챘다**는 뜻이다.

로그에 나타난 `MD-35af`, `MP-8f48`은 당시 가로챈 요소를 구분하는 단서다. 해당 요소가 어느 팝업인지는 로그만으로 확정하지 않았다.

---

## 3. 문제점 분석

초기의 `isVisible()` 확인은 실행한 **그 순간**에만 팝업이 보이는지 확인한다.

```text
page.goto() 완료
↓
팝업 없음 → isVisible() = false
↓
테스트가 전체 선택 체크박스를 클릭하려고 함
↓
팝업이 늦게 표시되어 클릭 영역을 가림
↓
TimeoutError
```

팝업이 비동기적으로 나타나면 일회성 확인만으로는 놓칠 수 있다.

---

## 4. 브라우저별 재현 양상

사용자가 반복 실행하면서 확인한 현상은 다음과 같다.

- 기존 방식에서 WebKit은 팝업 관련 실패가 상대적으로 자주 관찰되었다.
- 다른 브라우저에서도 약 3~4회 반복 실행 시 간헐적으로 문제가 관찰되었다.
- 동일한 상품 선택 로직이라도 실행 시점과 브라우저에 따라 결과가 달라졌다.

재현 횟수는 측정된 통계값이 아니라 **당시 테스트 과정의 관찰 기록**이다.

---

## 5. 개선 방향: `page.addLocatorHandler()`

예상하지 못한 팝업이 작업 도중 나타날 때 처리하도록 핸들러를 등록했다.

```ts
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
```

핸들러는 매번 버튼을 클릭하는 코드가 아니라, 지정한 요소가 표시되어 Playwright의 관련 동작을 방해할 때 이를 처리하기 위한 장치다.

---

## 6. 강제 클릭을 사용하지 않은 이유

```ts
await selectedLabel.click({ force: true });
```

처럼 처리하면 표면적으로 클릭 오류를 우회하려 할 수 있다.

하지만 실제 사용자에게 팝업이 표시된 상황을 숨기고 클릭할 수 있으므로, 문제 원인을 해결하지 못한다.

이번에는 클릭 자체를 강제로 수행하기보다 **팝업을 닫은 후 정상적인 클릭을 수행**하는 방법을 선택했다.

---

## 7. 자동화 시나리오 설계 반영

```ts
test("장바구니 선택 상태에 따른 주문금액 검증", async ({ page }) => {
  await page.addLocatorHandler(
    page.getByRole("button", { name: "괜찮아요", exact: true }),
    async (closeButton) => {
      await closeButton.click();
    },
  );

  await page.goto("https://www.bizhows.com/ko/v/step3-cart");

  const selectedLabel = page
    .locator("header label")
    .filter({ hasText: /^\d+개 선택$/ });

  await expect(selectedLabel.getByRole("checkbox")).toBeChecked();
  await selectedLabel.click();
});
```

기존 일회성 `isVisible()` 분기는 제거했다.

---

## 8. 결과

개선 이후 **약 6회 반복 실행에서 동일한 팝업 오류가 발견되지 않았다.**

이는 기존 방식보다 안정화된 징후이지만 다음을 뜻하지는 않는다.

```text
6회 통과 ≠ 영구적인 실패 재현 불가
```

장기 안정성은 반복 실행과 브라우저별 결과를 추가로 확인해야 한다.

---

## 9. 배운 점

- `isVisible()`은 특정 시점의 표시 상태를 알려 주며 미래의 표시를 감시하지 않는다.
- 클릭 대상이 찾아져도 다른 요소가 포인터 이벤트를 가로챌 수 있다.
- UI 팝업은 정상 서비스 동작일 수 있으므로 애플리케이션 결함과 테스트 불안정을 구분해야 한다.
- `addLocatorHandler()`를 사용할 때도 실제 방해 요소와 대상 버튼이 맞는지 로그·Trace로 확인해야 한다.

---

## 10. 핵심 정리

```text
일회성 isVisible() 확인
↓
팝업이 늦게 표시되면 놓침
↓
체크박스 클릭 시 pointer event 가로채기
↓
TimeoutError

개선
↓
addLocatorHandler() 등록
↓
방해 팝업 처리 후 정상 클릭
↓
6회 반복에서 동일 실패 미발견
```

> **비동기적으로 나타나는 방해 팝업은 한 번의 가시성 확인보다 동작 시점에 처리하는 방식이 적절했다.**
