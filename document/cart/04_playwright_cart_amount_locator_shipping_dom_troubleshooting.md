# Playwright Troubleshooting: 중복 주문금액 텍스트와 배송비 상태별 DOM 차이

> **유형:** 실제 Locator 미탐색 오류 / 동적 UI 구조 대응  
> **대상:** 장바구니 주문금액·상품할인금액·배송비·총금액

## 1. 문제 상황

장바구니 오른쪽 금액 영역에는 `주문 금액`이 두 번 표시되었다.

```text
주문 금액              ← 영역 제목
주문 금액    54,900원   ← 검증할 항목
```

처음에는 `getByText("주문 금액", { exact: true })`로 찾았으나 두 대상을 찾게 되어 특정할 수 없었다.

이후 배송비 금액은 `0원`과 배송비 발생 상태에서 HTML 구조가 달라, 같은 형제 선택자를 적용하면 실패했다.

---

## 2. 주문금액 Locator 문제 분석

실제 DOM의 주요 차이는 다음과 같았다.

```html
<div>
  주문 금액 <span>(VAT포함)</span>
</div>

<div>
  <span>주문 금액</span>
  <span>54,900원</span>
</div>
```

텍스트만 검색하면 영역 제목도 후보가 되지만, **실제 항목명은 span이고 금액은 그다음 형제 span**이라는 구조를 사용할 수 있었다.

---

## 3. 주문금액·할인금액·총금액 개선

```ts
const orderAmount = page
  .locator("span")
  .filter({ hasText: /^주문 금액$/ })
  .locator("+ span");

const discountAmount = page
  .locator("span")
  .filter({ hasText: /^상품 할인 금액$/ })
  .locator("+ span");

const totalAmount = page
  .locator("span")
  .filter({ hasText: /^총 금액$/ })
  .locator("+ span");
```

`+ span`은 해당 요소의 **바로 다음 형제 span**을 지정한다. 해당 관계가 유지되는 영역에서만 사용할 수 있다.

---

## 4. 실제 배송비 오류 로그

처음에는 배송비도 같은 구조라고 가정했다.

```ts
const deliveryCharge = page
  .locator("span")
  .filter({ hasText: /^배송비$/ })
  .locator("+ span");
```

하지만 Chromium, Firefox, WebKit에서 모두 동일하게 실패했다.

```text
Error: expect(locator).toHaveText(expected) failed

Locator: locator('span').filter({ hasText: /^배송비$/ }).locator('+ span')
Expected: "0원"
Timeout: 5000ms
Error: element(s) not found

3 failed (chromium, firefox, webkit)
```

이 실패는 **제품 결함으로 확인된 것이 아니라 테스트 Locator가 요소를 찾지 못한 오류**였다.

---

## 5. 첫 번째 원인: 배송비 문자열 끝의 공백

배송비 0원 상태에서 확인한 HTML은 다음과 같다.

```html
<div>
  <span>배송비 </span>
  <span>0원</span>
</div>
```

`배송비` 뒤에 공백이 있어서 `/^배송비$/`와 일치하지 않았다.

```ts
const deliveryChargeLabel = page
  .locator("span")
  .filter({ hasText: /^배송비\s*$/ });
```

`\s*`는 공백이 0개 이상 포함되는 것을 허용한다.

---

## 6. 두 번째 원인: 배송비 금액에 따라 DOM 구조 변경

**배송비 0원**

```html
<div>
  <span>배송비 </span>
  <span>0원</span>
</div>
```

**배송비 발생 상태**

```html
<summary>
  <div>
    <span>배송비 </span>
    <svg><!-- 아이콘 --></svg>
  </div>
  <span>3,000원</span>
</summary>
```

배송비가 발생한 상태에서는 항목명 span과 금액 span이 직접적인 형제 관계가 아니다. 따라서 `+ span`만으로는 두 상태를 모두 처리할 수 없다.

---

## 7. 개선 방향: `or()`로 두 구조 결합

중간에 XPath로 두 형제 구조를 처리하는 방법도 사용했지만, 유지보수와 가독성을 고려해 CSS 기반 Locator와 `or()`로 변경했다.

```ts
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

await expect(deliveryCharge).toHaveCount(1);
```

- **첫 번째 Locator:** 배송비 0원인 상태의 형제 span
- **두 번째 Locator:** 배송비가 발생한 상태의 summary 직계 자식 span
- **`filter({ has: deliveryChargeLabel })`:** 관련 없는 summary 제외
- **`or()`:** 두 검색 결과를 합침. 둘 다 매칭되면 2개가 될 수 있으므로 개수 검증이 필요함

---

## 8. 결과

- 중복된 `주문 금액` 텍스트는 span의 태그와 형제 관계로 구분했다.
- 배송비 금액 미탐색은 끝 공백과 상태별 DOM 구조 차이가 원인이었다.
- 최종적으로 `or()` 방식으로 전환했고, `toHaveCount(1)` 검증이 통과했다.
- 완성한 장바구니 금액 시나리오도 정상 통과했다고 확인했다.

---

## 9. 배운 점

- 화면 문구가 같아도 HTML 태그와 구조가 다르면 안정적인 Locator를 만들 수 있다.
- 정규표현식의 시작·끝 앵커는 공백 차이에 영향을 받는다.
- 사용자 상태에 따라 동일한 기능의 HTML 구조가 달라질 수 있다.
- `or()`는 조건문처럼 한쪽을 선택하는 것이 아니라 결과를 합치는 연산이다.
- 자동 생성 `data-f` 값에 의존하지 않고 텍스트와 구조를 활용할 수 있었다.

---

## 10. 핵심 정리

```text
"주문 금액" 텍스트 2개
↓
span 항목명 + 다음 형제 span 선택

배송비 0원인데 Locator 실패
↓
"배송비 " 끝 공백 발견
↓
정규표현식 \s* 적용

배송비 발생 시 HTML 구조 변경
↓
+ span만으로 처리 불가
↓
or()로 두 상태 결합 + toHaveCount(1)
```

> **상태가 바뀌는 금액 UI에서는 화면 문자열뿐 아니라 각 상태의 DOM 구조를 확인해야 한다.**
