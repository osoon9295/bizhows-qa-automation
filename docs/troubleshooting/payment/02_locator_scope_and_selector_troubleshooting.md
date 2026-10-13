# Playwright Troubleshooting: 잘못된 선택자와 과도하게 넓은 Locator 범위

## 1. 문제 상황

주문 페이지의 첫 번째 상품 옵션을 조회하기 위해 아래처럼 작성했다.

```ts
const firstOrderOptionTexts = await page
  .locator("section")
  .locator("ul")
  .nth(0)
  .locator(":scope > li")
  .allInnerTexts();

const firstOrderOptions = parseOptions(firstOrderOptionTexts);
expect(firstCartOptions).toEqual(firstOrderOptions);
```

그러나 실제로 추출된 주문 옵션은 상품 옵션이 아니라 페이지의 다른 메뉴 항목이었다.

```text
Expected:
  { "디자인허브": "", "미리캔버스": "", "프린트허브": "" }
Received:
  { "모양": "정사각형", "부자재": "고무 망치",
    "사이즈": "600x600mm", "원단": "투명 시트" }
```

별도의 수량 Locator에서는 CSS 선택자의 따옴표가 빠져 구문 오류도 발생했다.

```text
Unexpected token "" while parsing css selector "input[inputmode=\"numeric]"
```

---

## 2. 원인 분석: `section ul`의 범위가 너무 넓었다

`page.locator("section").locator("ul").nth(0)`는 **주문상품 영역의 첫 번째 옵션 목록**이 아니라, 페이지에서 조건에 일치하는 여러 `ul` 중 첫 번째를 잡을 수 있다.

이 사례에서는 상품 옵션이 아닌 `디자인허브`, `미리캔버스`, `프린트허브` 메뉴를 가져왔다.

상품 정보는 화면 전체에서 `ul`을 찾는 것보다 **상품명을 기준으로 해당 상품 항목을 먼저 특정**한 뒤 내부 옵션을 조회해야 했다.

---

## 3. 개선 방법: 상품명에서 가장 가까운 상품 `<li>` 찾기

제공된 주문 페이지 DOM은 상품 이름 `h3`가 각 상품 항목인 `<li>` 안에 포함된 구조였다.

```html
<li>
  <div>
    <h3>바닥 스티커</h3>
    <ul>
      <li>원단 : 투명 시트</li>
      <li>사이즈 : 600x600mm</li>
      <li>부자재 : 고무 망치</li>
      <li>모양 : 정사각형</li>
      <li>수량(건) : 8</li>
    </ul>
  </div>
</li>
```

먼저 상품명을 찾은 다음 상위 상품 항목과 그 내부 옵션 목록으로 범위를 좁혔다.

```ts
const orderProductName = page.getByRole("heading", {
  name: cartItem.name,
  level: 3,
  exact: true,
});

await expect(orderProductName).toBeVisible();

const orderProduct = orderProductName.locator(
  "xpath=ancestor::li[1]",
);

const orderOptionTexts = await orderProduct
  .locator("ul > li")
  .allInnerTexts();
```

- `ancestor::li[1]`: 현재 요소를 감싸는 가장 가까운 상위 `<li>`
- `ul > li`: 해당 상품 내부의 `ul`의 직계 자식 `<li>`

동일한 이름으로 등록된 상품 항목이 여러 개라면 `getByRole("heading", { name })`이 여러 요소를 찾을 수 있다. 현재 방식은 **상품명이 유일할 때** 적합하고, 중복 상품명은 옵션 등의 추가 식별 기준이 필요하다.

---

## 4. CSS 속성 선택자 구문 오류

실패한 선택자는 다음과 같았다.

```ts
// 잘못된 코드: 값 뒤의 따옴표 누락
product.locator('input[inputmode="numeric]');
```

수정한 코드는 다음과 같다.

```ts
product.locator('input[inputmode="numeric"]');
```

CSS 속성 선택자는 `태그[속성="값"]`처럼 여는 따옴표와 닫는 따옴표의 짝을 맞춰야 한다.

이는 요소가 보이지 않아 발생한 Timeout과 달리 **Locator 자체를 해석할 수 없는 문법 오류**였다.

---

## 5. 디버깅 시 함께 발생한 로그 출력 실수

처음에는 다음처럼 두 로그에 같은 변수를 사용했다.

```ts
console.log("장바구니", firstCartOptions);
console.log("주문", firstCartOptions); // 잘못된 변수
```

실제 비교 대상이 출력되도록 수정했다.

```ts
console.log("장바구니", firstCartOptions);
console.log("주문", firstOrderOptions);
```

검증에서 `expect(received).toEqual(expected)`를 사용한다면 실패 diff에서 `Received`는 **왼쪽 인자**, `Expected`는 **오른쪽 인자**에 대응한다.

---

## 6. 결과

- 광범위한 `section ul` 탐색이 잘못된 메뉴 텍스트를 가져오는 문제임을 확인했다.
- 상품명 → 상품 `<li>` → 옵션 `<li>` 순서로 탐색 범위를 변경했다.
- 수량 input 선택자의 누락된 따옴표를 수정했다.
- 원인을 분석할 때 콘솔 로그의 실제 변수와 assertion 좌우 인자를 함께 점검하도록 개선했다.

---

## 7. 배운 점

- `nth(0)`은 첫 번째 **의도한 요소**가 아니라 첫 번째 **매칭 요소**를 선택한다.
- Locator는 가능한 한 의미 있는 상위 영역에서 출발해 범위를 좁힌다.
- `getByRole()`과 상품별 컨테이너 범위 지정은 자동 생성 클래스/속성에 대한 의존을 줄인다.
- 오류 유형(구문 오류/Timeout/Assertion 실패)에 따라 점검할 지점이 다르다.

---

## 8. 핵심 정리

> **잘못된 요소를 정확히 읽는 것보다, 먼저 올바른 상품 영역을 선택하는 것이 중요하다.**
