# Playwright Troubleshooting: 비동기 반환값과 페이지 이동 이후 Locator Timeout

## 1. 문제 상황

비즈하우스 장바구니에서 수집한 상품명을 주문 페이지의 `heading`과 비교하는 과정에서 TypeScript 타입 오류가 발생했다.

```text
'Promise<string>' 형식은 'string | RegExp | undefined' 형식에 할당할 수 없습니다. ts(2322)
```

또한 장바구니 상품 정보를 조회하는 과정에서 `locator.innerText()` 및 `locator.inputValue()`가 제한 시간(30초) 내에 요소를 찾지 못하는 문제가 발생했다.

```text
Error: locator.inputValue: Test timeout of 30000ms exceeded.
```

두 문제는 겉으로는 다르지만, **Locator와 실제 데이터의 차이**를 이해해야 해결할 수 있었다.

---

## 2. 원인 분석: `Promise<string>`과 `string`

처음에는 다음처럼 `innerText()`의 결과를 `await` 없이 변수에 저장했다.

```ts
const firstProductName = firstProduct
  .locator('a[href^="/ko/v/option?"]')
  .innerText();

page.getByRole("heading", {
  name: firstProductName, // Promise<string>이므로 타입 오류
});
```

- `locator()`는 **Locator 객체**를 반환한다.
- `innerText()`는 텍스트를 비동기로 조회하므로 **`Promise<string>`**을 반환한다.
- `getByRole()`의 `name`에는 실제 문자열(`string`)이나 정규식이 필요하다.

따라서 `await`를 붙여 실제 문자열을 확보해야 한다.

---

## 3. 원인 분석: 페이지 이동 후의 Locator 재평가

초기 구현에서는 장바구니에서 만든 `firstProduct` Locator로 **주문 페이지 이동 후** 수량을 조회하는 코드가 있었다.

```ts
const firstProduct = selectedCartItems.nth(0);

await page.getByRole("button", { name: "총 2개 주문하기" }).click();

// 이미 주문 페이지로 이동했지만 장바구니 Locator로 조회 시도
const cartQuantity = Number(
  await firstProduct.locator('input[inputmode="numeric"]').inputValue(),
);
```

Locator는 선언 당시의 요소를 복사해 보관하지 않는다. `inputValue()` 호출 시점의 **현재 페이지 DOM**을 다시 탐색하기 때문에, 주문 페이지에 장바구니 상품 요소가 없다면 Timeout이 발생한다.

별도로 `firstProduct.locator("ul").first().innerText()`에서도 Timeout이 발생한 적이 있었다. 해당 로그만으로는 정확한 원인을 확정할 수 없었으며, 현재 URL과 부모 Locator의 탐색 결과를 점검해야 하는 사례로 남겼다.

---

## 4. 개선 방법

장바구니에서 필요한 값은 페이지 이동 전에 **문자열과 숫자**로 수집했다.

```ts
// Given: 장바구니 페이지
const productName = await firstProduct
  .locator('a[href^="/ko/v/option?"]')
  .innerText();

const quantity = Number(
  await firstProduct.locator('input[inputmode="numeric"]').inputValue(),
);

// When: 주문 페이지 이동
await page.getByRole("button", { name: "총 2개 주문하기" }).click();

// Then: 이동 전 저장한 값으로 검증
await expect(
  page.getByRole("heading", {
    name: productName,
    level: 3,
    exact: true,
  }),
).toBeVisible();
```

> 위 수량 조회 예시는 수량 입력창이 있는 상품에만 적용된다. 입력창이 없는 상품 유형은 별도의 처리 방식이 필요하며, 해당 내용은 `04_dynamic_quantity_validation_troubleshooting.md`에 정리했다.

원인을 좁힐 때는 다음과 같이 현재 상태를 로그로 확인할 수 있다.

```ts
console.log("현재 URL:", page.url());
console.log("선택 상품 수:", await selectedCartItems.count());
console.log("상품 내부 ul 수:", await firstProduct.locator("ul").count());
```

---

## 5. 결과

- 상품명 조회에 `await`를 사용하여 `Promise<string>` 타입 오류를 해소했다.
- 장바구니 상품명·옵션·수량을 페이지 이동 전 수집하는 구조로 정리했다.
- 장바구니에 수량 입력창이 아예 없는 상품에서 발생하는 별도의 Timeout은 위 수정만으로 해결되지 않았으며, 이후 선택적 입력창 처리로 개선했다.

---

## 6. 배운 점

- Locator는 요소의 스냅샷이 아니라 **현재 DOM에서 요소를 찾기 위한 표현**이다.
- 페이지 사이 데이터를 비교하려면 이동 전에 `innerText()`, `inputValue()` 등으로 값을 확정해 저장해야 한다.
- 비동기 메서드의 반환값(`Promise<T>`)과 실제 값(`T`)은 다르다.
- Timeout 로그만으로 렌더링 문제라고 단정하지 않고 **조회 시점, 현재 URL, 탐색 범위**를 함께 확인해야 한다.

---

## 7. 핵심 정리

> **페이지를 넘어서 재사용해야 하는 것은 장바구니 Locator가 아니라 장바구니에서 수집한 데이터다.**
