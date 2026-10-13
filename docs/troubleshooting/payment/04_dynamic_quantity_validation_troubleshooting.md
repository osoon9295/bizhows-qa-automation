# Playwright Troubleshooting: 상품별 수량 입력창 유무와 잘못된 정수 검증식

## 1. 문제 상황

장바구니의 두 상품을 대상으로 같은 수량 Locator를 사용했지만, 두 번째 상품에서 Timeout이 발생했다.

```text
Error: locator.inputValue: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('div[data-comm-idx]')
    .filter({ has: getByRole('checkbox', { checked: true }) })
    .nth(1)
    .locator('input[inputmode="numeric"]')
```

첫 번째 상품은 수량 입력창이 있었지만, 두 번째 상품은 장바구니에서 **별도의 수량 입력창을 노출하지 않는 유형**이었다.

이후 입력창 유무를 확인하는 Helper로 수정했으나, 이번에는 `8`이 출력되는데도 정수 검증 assertion이 실패했다.

```text
8
Expected: true
Received: false
```

---

## 2. 원인 분석: 상품별 UI 구조가 동일하지 않음

관찰한 상품들의 수량 표현 방식은 달랐다.

| 항목 | 바닥 스티커 | 싱글 규격 스티커 |
| --- | --- | --- |
| 장바구니 수량 입력창 | 있음 (`value="8"`) | 확인한 DOM에서 없음 |
| 상품 옵션 중 매수 | 없음 | `매수 : 100 매` |
| 주문 페이지 `수량(건)` | `8` | `1` |

여기서 `매수 : 100 매`는 옵션값이며, **주문 수량 100건**이라는 의미가 아니다.

`inputValue()`는 일치하는 input 요소를 찾을 때까지 기다리기 때문에, 실제로 input이 없는 상품에서는 Timeout이 발생한다.

---

## 3. 개선 방법: 입력창이 있으면 수량 조회, 없으면 null

상품 하나의 Locator를 인자로 받아 내부 입력창만 조회하는 함수를 만들었다.

```ts
import { expect, type Locator } from "@playwright/test";

export async function getCartQuantity(
  product: Locator,
): Promise<number | null> {
  const quantityInput = product.locator('input[inputmode="numeric"]');
  const inputCount = await quantityInput.count();

  // 이 상품에 수량 입력창이 없는 경우
  if (inputCount === 0) return null;

  // 한 상품에 수량 입력창 하나라는 전제 확인
  expect(inputCount).toBe(1);

  const quantity = Number(await quantityInput.inputValue());
  expect(Number.isInteger(quantity) && quantity > 0).toBe(true);

  return quantity;
}
```

`inputCount`는 **장바구니 전체가 아니라 전달받은 상품 한 개 내부의 input 수**다. 따라서 두 상품 각각 input이 하나씩 존재하면 두 함수 호출 모두 `inputCount === 1`을 만족한다.

- `0개`: 해당 상품에 input이 없음 → `null`
- `1개`: 입력된 숫자 반환
- `2개 이상`: 기대한 구조와 다름 → assertion 실패

> 이 Helper는 **현재 확인한 DOM 구조**에 기반한다. 나중에 수량 input이 비동기적으로 나타나거나 상품에 여러 입력창이 존재하면 입력창 유무 판단 시점과 탐색 범위를 재검토해야 한다.

---

## 4. 두 번째 오류: `Number.isInteger()`에 Boolean 전달

처음 작성한 코드는 다음과 같았다.

```ts
expect(Number.isInteger(quantity && quantity > 0)).toBe(true);
```

`quantity = 8`이면 계산 순서는 다음과 같다.

```text
quantity && quantity > 0
→ 8 && true
→ true

Number.isInteger(true)
→ false
```

`Number.isInteger()`에는 숫자가 아니라 `true`가 전달되므로, 화면에서 `8`을 정상적으로 읽어도 assertion은 실패한다.

정수 검증과 양수 검증을 분리해 수정했다.

```ts
expect(Number.isInteger(quantity) && quantity > 0).toBe(true);
```

또는 원인 파악이 쉽도록 아래처럼 두 assertion으로 작성할 수 있다.

```ts
expect(Number.isInteger(quantity)).toBe(true);
expect(quantity).toBeGreaterThan(0);
```

---

## 5. 입력창이 없는 상품을 어떻게 검증할 것인가?

`getCartQuantity()`가 `null`을 반환했다는 것은 **수량이 1이라는 뜻이 아니라, 이 방식으로 수량을 얻을 수 없다는 뜻**이다.

```ts
if (cartItem.quantity !== null) {
  expect(Number(orderQuantity)).toBe(cartItem.quantity);
} else {
  // 별도의 근거 없이 1을 기대하면 안 됨
}
```

실제 테스트 코드에는 `quantity === null`일 때 `expect(Number(orderQuantity)).toBe(1)`로 처리한 버전도 있었다. 하지만 **이것은 '입력창이 없는 상품의 수량은 1건'이라는 서비스 규칙이 확인된 경우에만 타당**하다.

서비스 요구사항이나 화면 동작에서 해당 규칙을 확인하지 못한 상태라면:

- 상품의 다른 독립적인 수량 표시 위치를 찾거나,
- 수량 일치 검증을 별도로 미검증 처리하고,
- 포트폴리오에 어떤 케이스가 검증되지 않았는지 명시해야 한다.

주문 페이지의 `수량(건)` 값을 그대로 기대값으로 사용하면 두 화면의 일치를 독립적으로 검증했다고 보기 어렵다.

---

## 6. 결과

- 입력창이 없는 상품에 `inputValue()`를 호출하여 발생하던 Timeout 원인을 확인했다.
- 상품 내부의 input 유무를 기준으로 수량 또는 `null`을 반환하도록 개선했다.
- `Number.isInteger()`에 Boolean을 전달하던 연산식 오류를 수정했다.
- **입력창 없는 상품의 주문 수량 기대값**은 서비스 규칙 확인이 필요한 전제임을 구분했다.

---

## 7. 배운 점

- 동일한 화면의 상품이라고 해서 DOM 구조가 모두 같지는 않다.
- 조건부 UI는 요소가 없을 수 있음을 모델링해야 한다.
- `null`을 임의 기본값과 혼동하면 테스트가 잘못 통과할 수 있다.
- 콘솔에 정상 숫자가 찍혀도 이후 검증 표현식이 잘못되면 실패할 수 있다.

---

## 8. 핵심 정리

> **동적 테스트는 없는 데이터를 만들어 맞추는 것이 아니라, 화면에서 확보한 데이터와 확인된 규칙만으로 기대결과를 구성해야 한다.**
