# Playwright Troubleshooting: `test.step()`의 `await` 누락으로 인한 증감 버튼 테스트 실행 순서 문제

## 1. 문제 상황

비즈하우스 무광 스텐 텀블러 상품 상세 페이지에서 수량 증감 버튼을 검증하는 A07 자동화 테스트를 작성했다.

테스트 시나리오는 다음과 같다.

```text
Given : 상품 상세 페이지에 접속하고 수량이 1인 것을 확인한다.
When 1 : + 버튼을 한 번 클릭한다.
Then 1 : 수량이 2로 변경된다.
When 2 : - 버튼을 한 번 클릭한다.
Then 2 : 수량이 1로 변경된다.
```

관련 TC: `TC_DTL_QTY_05`, `TC_DTL_QTY_06`

두 동작을 테스트 리포트에서 구분하기 위해 `test.step()`을 사용했다. 하지만 초기 실행 과정에서 `plusButton`과 관련된 오류가 발생한 것으로 보였다.

당시 코드는 다음과 같았다.

```ts
test.step("+버튼을 누르면 수량이 1 증가한다.", async () => {
  await plusButton.click();
  await expect(quantityInput).toHaveValue("2");
});

test.step("-버튼을 누르면 수량이 1 감소한다.", async () => {
  await minusButton.click();
  await expect(quantityInput).toHaveValue("1");
});
```

**참고:** 당시 오류 로그 전문은 기록하지 못했다. 따라서 특정 Playwright 에러 메시지나 정확한 실패 위치를 확정하지 않고, 코드에서 확인한 문제와 수정 후 결과를 중심으로 정리한다.

---

## 2. 문제점 분석

처음에는 `plusButton` Locator 또는 클릭 처리에 문제가 있는지 의심했다.

해당 버튼은 수량 입력 필드의 부모 요소를 기준으로 찾아왔다.

```ts
const quantityInput = page.locator('input[maxlength="5"]');
const quantityControl = quantityInput.locator("..");

const minusButton = quantityControl.getByRole("button").first();
const plusButton = quantityControl.getByRole("button").last();
```

하지만 코드를 다시 검토하면서 **`test.step()` 호출 앞에 `await`가 없다는 점**을 확인했다.

`test.step()`은 비동기 콜백의 수행을 포함하며 Promise를 반환한다. 호출 결과를 기다리지 않으면 다음 단계가 이전 단계의 완료를 보장받지 못한다.

---

## 3. `test.step()`에 `await`가 필요한 이유

A07은 앞선 동작의 결과를 다음 동작이 사용하는 **상태 의존적 시나리오**다.

```text
수량 1
  ↓ + 버튼 클릭
수량 2 검증 완료
  ↓ - 버튼 클릭
수량 1 검증 완료
```

그런데 `test.step()`을 기다리지 않으면 코드상으로 두 단계가 순서대로 *작성*되어 있어도, 첫 단계의 비동기 작업이 끝나기 전에 두 번째 단계가 시작될 가능성이 있다.

```ts
// 첫 번째 step 완료를 기다리지 않음
test.step("+ 버튼", async () => {
  await plusButton.click();
  await expect(quantityInput).toHaveValue("2");
});

// 첫 번째 step이 완료되기 전에 시작될 수 있음
test.step("- 버튼", async () => {
  await minusButton.click();
  await expect(quantityInput).toHaveValue("1");
});
```

이 경우 발생할 수 있는 문제는 다음과 같다.

- `+` 클릭과 `-` 클릭이 기대한 순서대로 완료되지 않을 수 있음
- 수량이 1인 상태에서 비활성화된 `-` 버튼을 조작하려는 상황이 생길 수 있음
- 테스트 본문이 비동기 단계의 완료 전에 끝날 수 있음
- 어느 단계가 실패했는지 파악하기 어려워질 수 있음

위 내용은 `await` 누락이 유발할 수 있는 **가능한 실패 메커니즘**이며, 당시 로그로 각각이 발생했다고 확인한 것은 아니다.

---

## 4. 개선 방법

각 `test.step()` 앞에 `await`를 추가했다.

```ts
await test.step("+버튼을 누르면 수량이 1 증가한다.", async () => {
  await plusButton.click();
  await expect(quantityInput).toHaveValue("2");
});

await test.step("-버튼을 누르면 수량이 1 감소한다.", async () => {
  await minusButton.click();
  await expect(quantityInput).toHaveValue("1");
});
```

이제 첫 번째 단계의 클릭과 Assertion이 모두 완료된 다음, 두 번째 단계가 시작된다.

---

## 5. 수정 전후 비교

| 구분 | 수정 전 | 수정 후 |
| --- | --- | --- |
| 호출 방식 | `test.step(...)` | `await test.step(...)` |
| 첫 번째 단계 완료 대기 | 보장되지 않음 | 보장됨 |
| 다음 단계 시작 시점 | 앞 단계가 실행 중일 수 있음 | 앞 단계 완료 후 |
| 수량 상태 검증 | 단계 간 순서 문제 가능 | `1 → 2 → 1` 순서대로 검증 |

수정 핵심은 버튼 Locator를 변경한 것이 아니라, **단계별 비동기 작업의 완료를 기다리도록 제어 흐름을 수정한 것**이다.

---

## 6. 최종 A07 코드의 핵심 구조

```ts
test("상품 수량 증감 버튼 기능 확인", async ({ page }) => {
  // Given: 실제 테스트에서는 해당 텀블러 상세 페이지 URL로 이동
  await page.goto(PRODUCT_DETAIL_URL);

  const quantityInput = page.locator('input[maxlength="5"]');
  await expect(quantityInput).toHaveValue("1");

  const quantityControl = quantityInput.locator("..");
  const minusButton = quantityControl.getByRole("button").first();
  const plusButton = quantityControl.getByRole("button").last();

  // When / Then 1
  await test.step("+버튼을 누르면 수량이 1 증가한다.", async () => {
    await plusButton.click();
    await expect(quantityInput).toHaveValue("2");
  });

  // When / Then 2
  await test.step("-버튼을 누르면 수량이 1 감소한다.", async () => {
    await minusButton.click();
    await expect(quantityInput).toHaveValue("1");
  });
});
```

> `PRODUCT_DETAIL_URL`은 코드 구조를 설명하기 위한 자리표시자다. 실제 프로젝트에서는 기존에 사용하던 무광 스텐 텀블러 상세 페이지 URL을 사용한다.

---

## 7. 기존 A06과의 관계

동일한 `product-detail-quantity.spec.ts`에서 다음 두 영역을 각각 독립된 테스트로 검증했다.

| 자동화 ID | 검증 목적 | 검증 방식 |
| --- | --- | --- |
| A06 | 수량 직접 입력 시 경계값 처리 | `1`, `9999`, `0`, `10000` 입력값을 이용한 파라미터화 테스트 |
| A07 | 증감 버튼에 따른 수량 변화 | `+` 클릭 후 `2`, `-` 클릭 후 `1` 검증 |

A07은 A06의 결과에 의존하지 않고 자체적으로 페이지에 진입한 뒤 수량을 확인한다. 같은 파일에서 관리하되 서로 다른 `test()`로 분리해 목적과 실패 결과를 구분했다.

---

## 8. 결과

- 두 `test.step()` 호출에 `await`를 추가했다.
- 수정 후 사용자가 A07 테스트가 정상적으로 동작함을 확인했다.
- 초기에는 버튼 Locator가 원인일 가능성을 의심했지만, 실제로 적용해 효과를 확인한 변경 사항은 `await` 추가였다.
- **오류 로그 전문이 없어 다른 잠재 원인이 전혀 없었다고 단정할 수는 없다.**

---

## 9. 배운 점

- `await`는 단순한 문법 요소가 아니라 테스트 단계의 **실행 순서와 완료 시점**을 제어한다.
- `test.step()`의 콜백 안에서 `await`를 사용했더라도, **바깥의 `test.step()` 호출 자체에도 `await`가 필요**하다.
- 연속 상태 전이(`1 → 2 → 1`)를 검증하는 테스트에서는 선행 단계의 완료가 특히 중요하다.
- 테스트 실패 시 처음 의심한 요소(이번에는 `plusButton`)가 실제 수정 지점과 다를 수 있으므로 Locator뿐 아니라 비동기 흐름도 검토해야 한다.
- A06과 A07은 같은 화면을 대상으로 하더라도 입력 방식과 검증 목적이 달라 별도 테스트로 유지하는 것이 추적성에 유리하다.

---

## 10. 핵심 정리

```text
A07: + 버튼 / - 버튼 순차 검증
              ↓
test.step()으로 단계 구분
              ↓
test.step() 호출에 await 누락
              ↓
단계 간 완료 순서가 보장되지 않음
              ↓
await test.step()으로 변경
              ↓
+ 클릭 및 수량 2 검증 완료
              ↓
- 클릭 및 수량 1 검증 완료
              ↓
수정 후 테스트 정상 동작 확인
```

> **비동기 단계 안에서 `await`를 사용하는 것과, 그 단계를 실행하는 `test.step()` 자체를 `await`하는 것은 모두 중요하다.**
