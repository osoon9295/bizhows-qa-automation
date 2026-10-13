# Playwright Troubleshooting: 상품 가격과 결제 요약 영역의 DOM 구조 차이

## 1. 문제 상황

장바구니에서 사용하던 할인 가격 Locator를 주문 페이지에 적용하려고 했지만, 두 페이지의 HTML 구조가 달랐다.

```ts
// 장바구니에서는 사용했던 구조
product.locator("small + div > span");
```

또한 주문 페이지의 결제 요약에서 `주문금액`은 `+ span`으로 조회할 수 있었지만, `상품 할인 금액`과 `배송비`는 같은 방식으로 조회할 수 없었다.

이번 문제는 숫자 변환 함수가 아니라 **형제 요소의 방향과 부모-자식 구조를 잘못 가정한 Locator**에 있었다.

---

## 2. `small + div > span`의 정확한 의미

```css
small + div > span
```

| 문법 | 의미 |
| --- | --- |
| `small` | `<small>` 요소 |
| `+ div` | 그 뒤에 **바로 이어지는 형제** `<div>` |
| `> span` | 해당 `<div>`의 **직계 자식** `<span>` |

즉 아래처럼 생긴 구조를 찾는 선택자다.

```html
<small>127,200원</small>
<div><span>105,600원</span></div>
```

하지만 제공된 주문 페이지의 실제 가격 구조는 다음과 같았다.

```html
<div data-f="PS-d37e">
  <div data-f="OP-d37e">105,600원</div>
  <small data-f="DP-d37e">
    <s>127,200원</s>
  </small>
</div>
```

할인 가격이 `<small>` **앞쪽**에 있으며 `<span>`도 아닌 `<div>` 자체의 텍스트이므로 기존 선택자는 일치하지 않는다.

---

## 3. 개선 방법: 할인 전 가격에서 이전 형제 탐색

기존에 잘 찾히던 `<s>` 요소를 기준점으로 삼았다.

```ts
const orderOriginalPrice = parsePrice(
  await orderProduct.locator("s").innerText(),
);

const orderDiscountedPrice = parsePrice(
  await orderProduct
    .locator("s")
    .locator("xpath=../preceding-sibling::div[1]")
    .innerText(),
);

expect(orderOriginalPrice).toBe(cartItem.originalPrice);
expect(orderDiscountedPrice).toBe(cartItem.discountedPrice);
```

탐색 순서는 다음과 같다.

```text
<s>127,200원</s>
  ↑ .. : 부모 <small>
  ← preceding-sibling::div[1] : 앞쪽 형제 <div>105,600원</div>
```

이 방식은 **제공된 주문 페이지의 해당 상품 가격 DOM**을 전제로 한다.

---

## 4. 결제 요약: 같은 금액 항목이라도 DOM 구조가 다름

### 4-1. `주문금액`, `포인트 사용`, `총 금액`

텍스트와 숫자가 형제 `<span>`인 구조였다.

```html
<div>
  <span>주문금액</span>
  <span>134,400원</span>
</div>
```

따라서 다음처럼 바로 다음 형제를 조회할 수 있다.

```ts
const checkoutOrderAmount = parsePrice(
  await page
    .getByText("주문금액", { exact: true })
    .locator("+ span")
    .innerText(),
);
```

> 이 DOM에서 주문 페이지에는 `주문금액`, 장바구니의 다른 영역에는 `주문 금액`처럼 띄어쓰기가 다른 라벨이 있다. `exact: true` 사용 시 정확한 표기를 확인해야 한다.

### 4-2. `상품 할인 금액`, `배송비`

두 항목은 펼침/접힘 UI인 `<details><summary>` 내부에 있었다.

```html
<details>
  <summary>
    <div>
      <span>상품 할인 금액</span>
      <svg><!-- 화살표 아이콘 --></svg>
    </div>
    <span>- 23,100원</span>
  </summary>
</details>
```

라벨 `<span>`과 금액 `<span>`이 **직접 형제 관계가 아니므로** `getByText(...).locator("+ span")`이 맞지 않는다. 아이콘 자체 때문이 아니라 라벨을 감싸는 `<div>`가 추가된 것이 핵심이다.

이를 다음처럼 수정했다.

```ts
const checkoutDiscountLocator = page
  .getByText("상품 할인 금액", { exact: true })
  .locator("xpath=ancestor::summary[1]")
  .locator(":scope > span");

const checkoutShippingLocator = page
  .getByText("배송비", { exact: true })
  .locator("xpath=ancestor::summary[1]")
  .locator(":scope > span");

const checkoutDiscount = parsePrice(await checkoutDiscountLocator.innerText());
const checkoutShipping = parsePrice(await checkoutShippingLocator.innerText());
```

- `ancestor::summary[1]`: 가장 가까운 상위 `<summary>`
- `:scope > span`: **해당 summary의 직계 자식** `<span>` (금액)

---

## 5. 금액 계산에 대한 추가 주의점

기존 `parsePrice()`는 숫자가 아닌 문자를 모두 제거한다.

```ts
export function parsePrice(text: string): number {
  return Number(text.replace(/[^\d]/g, ""));
}
```

따라서 `- 23,100원`은 `23100`이 된다. 이는 할인액을 **양수의 차감 금액**으로 관리하는 모델이라면 맞지만, 이미 음수로 표현하는 모델과 혼용하면 이중 차감 오류가 생길 수 있다.

```ts
const expectedTotalAmount =
  checkoutAmounts.orderAmount -
  checkoutAmounts.productDiscountAmount +
  checkoutAmounts.shippingFee -
  checkoutAmounts.pointsUsed;
```

이 계산은 할인액과 포인트 사용액을 양수로 저장하고, 배송비를 실제 청구액으로 저장한다는 전제다.

또한 장바구니와 주문 페이지의 금액을 단순 비교하는 것과, 최종 합계가 계산식에 맞는지 확인하는 것은 **별도 검증 목적**이다.

---

## 6. 결과

- 주문 페이지의 상품 가격 DOM을 분석해 이전 형제 `<div>`로 할인 가격을 조회하는 Locator를 설계했다.
- 결제 요약의 일반 행과 `<summary>` 행을 구분해 서로 다른 Locator를 적용했다.
- 주문 페이지의 최종 계산식 검증에 필요한 금액 항목 수집 구조를 정리했다.

> 이 대화에는 마지막 결제 요약 Locator 수정 이후의 **전체 테스트 재실행 로그가 없다**. 따라서 이 항목은 '구조 확인 및 수정안 도출'로 기록하고, 실제 통과 여부는 재실행 후 갱신해야 한다.

---

## 7. 배운 점

- CSS의 `+`는 다음 형제만 선택하며 이전 형제를 찾는 문법이 아니다.
- UI 라벨이 같아도 페이지마다 DOM 구조가 다를 수 있다.
- `svg` 유무 자체보다 텍스트와 가격 요소의 **구조적 관계**를 이해해야 한다.
- 금액 부호 처리 규칙은 Locator 검증과 별도로 명확하게 정의해야 한다.

---

## 8. 핵심 정리

> **금액 요소는 라벨 문구만으로 찾기보다, 해당 가격 행의 실제 DOM 관계를 기준으로 찾아야 한다.**
