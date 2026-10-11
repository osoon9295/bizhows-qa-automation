# Playwright Troubleshooting: 장바구니 금액의 동적 기대값과 총금액 계산식 정정

> **유형:** 테스트 설계·계산식 개선 (실패 로그 확인 사례 아님)  
> **대상:** 선택 상품 1개/2개 시 주문금액·할인금액·총금액

## 1. 문제 상황

장바구니 금액을 자동화할 때 특정 상품 가격을 기대값으로 하드코딩하면, 상품이 바뀌거나 가격이 수정되었을 때 테스트를 재사용하기 어렵다.

또한 상품 1개를 선택한 상태의 총금액 계산 코드를 작성하면서 다음 식을 사용하려고 했다.

```ts
firstOriginalPrice - firstDiscountedPrice + deliveryChargeValue
```

이 식은 **총금액이 아니라 할인금액과 배송비의 합**을 계산한다는 사실을 코드 검토 단계에서 발견했다.

---

## 2. 검증 목표 다시 정리

장바구니에 표시되는 항목은 다음과 같다.

```text
주문금액: 선택 상품의 할인 전 금액 합계
상품할인금액: 할인 전 금액 합계 - 할인 후 금액 합계
배송비: 화면에 표시된 배송비
총금액: 주문금액 - 상품할인금액 + 배송비
```

이 내용은 **이번 테스트에 사용한 상품과 화면에서 관찰한 계산 관계**를 기준으로 정리한 것이다. 서비스 전체의 가격·할인 정책을 일반화하지 않는다.

---

## 3. 상품별 가격 추출

상품명을 고정하지 않고 장바구니의 두 항목을 검색했다.

```ts
const productItems = page.locator("div[data-comm-idx]");
await expect(productItems).toHaveCount(2);

const firstProduct = productItems.nth(0);
const secondProduct = productItems.nth(1);
```

할인 전 가격은 `<s>` 태그, 할인 후 가격은 인접한 가격 영역에서 가져왔다.

```ts
const firstOriginalPriceText = await firstProduct.locator("s").textContent();
const firstDiscountedPriceText = await firstProduct
  .locator("small + div > span")
  .textContent();
```

이 DOM 구조는 **실제로 사용한 할인 상품에서 확인한 구조**이며, 할인이 없는 다른 상품에서도 유지된다고 보장할 수 없다.

---

## 4. 문자열을 숫자로 변환

```ts
function parsePrice(text: string): number {
  return Number(text.replace(/[^\d]/g, ""));
}

const firstOriginalPrice = parsePrice(
  (await firstProduct.locator("s").textContent())!,
);

const firstDiscountedPrice = parsePrice(
  (await firstProduct.locator("small + div > span").textContent())!,
);
```

```text
"47,700원" → 47700
"39,600원" → 39600
```

`parsePrice()`는 이번 테스트처럼 **양수 가격과 양수 할인액을 취급하는 용도**다. 마이너스 기호를 제거하므로 일반적인 음수 금액 파서로 사용하지 않는다.

---

## 5. 총금액 계산식 오류 분석

당시 작성하려던 식:

```ts
firstOriginalPrice - firstDiscountedPrice + deliveryChargeValue
```

이 식에서 `firstOriginalPrice - firstDiscountedPrice`는 할인액이다.

따라서 수정한 식은 다음과 같다.

```ts
const expectedDiscount = firstOriginalPrice - firstDiscountedPrice;

const expectedTotal =
  firstOriginalPrice - expectedDiscount + deliveryChargeValue;
```

같은 결과를 더 간단하게 표현하면 다음과 같다.

```ts
const expectedTotal = firstDiscountedPrice + deliveryChargeValue;
```

---

## 6. 배송비 자체를 검증하지 않은 이유

테스트 과정에서 실제로 관찰한 배송비 동작은 다음과 같다.

- 일부 상품 조합에서 배송비가 묶여 계산되거나 별도 부과되는 양상이 있었다.
- 10만 원 이상인 상황에서 물음표 안내를 열면 `10만 원 이상은 배송비 할인` 취지의 문구를 확인했다.

그러나 **할인 기준이 전체 장바구니인지, 상품별 또는 배송 그룹별인지**까지 확인된 것은 아니다.

따라서 이번 TC에서는 배송비 정책을 임의로 결정하지 않고, **화면에 표시된 배송비를 받아 총합 관계만 검증**하기로 했다.

이 접근은 배송비 **자체**가 잘못 계산된 결함까지 찾아내지는 못한다.

---

## 7. 자동화 시나리오 설계 반영

배송비는 상품을 선택한 **뒤에** 가져온다. 선택 상태에 따라 값이나 HTML 구조가 달라질 수 있기 때문이다.

```ts
// When: 첫 번째 상품 선택 완료

const expectedDiscount = firstOriginalPrice - firstDiscountedPrice;

await expect(orderAmount).toHaveText(
  `${firstOriginalPrice.toLocaleString("ko-KR")}원`,
);

await expect(discountAmount).toHaveText(
  `- ${expectedDiscount.toLocaleString("ko-KR")}원`,
);

const deliveryChargeValue = parsePrice(
  (await deliveryCharge.textContent())!,
);

const expectedTotal =
  firstOriginalPrice - expectedDiscount + deliveryChargeValue;

await expect(totalAmount).toHaveText(
  `${expectedTotal.toLocaleString("ko-KR")}원`,
);
```

선택 상품 2개에서는 다음과 같이 확장했다.

```ts
const expectedOrderAmount = firstOriginalPrice + secondOriginalPrice;
const expectedDiscount = expectedOrderAmount -
  (firstDiscountedPrice + secondDiscountedPrice);

const deliveryChargeValue = parsePrice(
  (await deliveryCharge.textContent())!,
);

const expectedTotal =
  expectedOrderAmount - expectedDiscount + deliveryChargeValue;
```

---

## 8. 결과

- 특정 상품 금액을 하드코딩하지 않고 화면의 상품별 가격에서 기대값을 계산했다.
- 총금액 계산식의 오류 가능성을 코드 검토 과정에서 정정했다.
- 선택 상품 0개 → 1개 → 2개의 주문금액·할인금액·총금액 검증이 정상 통과했다고 확인했다.
- 배송비 정책 검증은 이번 자동화 범위에서 제외하고 **표시 금액의 합계 정합성**을 검증했다.

---

## 9. 배운 점

- 금액을 비교하기 전에 **각 변수의 의미(할인 전/후/할인액)**를 분명히 해야 한다.
- UI에서 추출한 동적 기대값은 가격 변경에 유연하지만 완전히 독립적인 오라클은 아니다.
- 화면의 배송비를 그대로 사용하는 테스트는 **배송비 산정 정책이 아니라 합계 산술**을 확인한다.
- `textContent()`는 `string | null`을 반환하므로 `!` 사용은 실제 null 검증이 아님을 인지해야 한다.
- `toLocaleString("ko-KR")`로 검증할 UI 문자열을 만들 수 있다.

---

## 10. 핵심 정리

```text
고정 가격으로 검증
↓
상품 변경에 취약
↓
상품별 표시 금액 추출 + 숫자 변환

총금액 계산식 작성 중 오류 발견
↓
할인액과 실구매액 혼동
↓
주문금액 - 할인금액 + 표시 배송비로 정정

배송비 정책 미확인
↓
정책 기대값을 임의로 가정하지 않음
↓
표시 배송비 반영 후 총금액 정합성 검증
```

> **기대값 계산에 쓰는 데이터의 의미와 검증 범위를 명시해야 통과 결과를 과대해석하지 않는다.**
