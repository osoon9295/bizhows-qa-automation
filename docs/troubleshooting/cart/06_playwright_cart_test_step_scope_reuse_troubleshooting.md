# Playwright Troubleshooting: `test.step()` 간 변수 재사용과 테스트 데이터 준비 순서

> **유형:** 코드 구조·재사용성 개선 (별도 실행 오류 로그는 없음)  
> **대상:** 장바구니 0개 → 1개 → 2개 연속 검증

## 1. 문제 상황

선택 상품 1개 Step에서 상품의 할인 전·후 가격을 가져왔다.

```ts
await test.step("선택 상품 1개", async () => {
  const firstOriginalPrice = /* 첫 번째 상품의 할인 전 가격 */;
  const firstDiscountedPrice = /* 첫 번째 상품의 할인 후 가격 */;
});
```

다음 Step에서 첫 번째 상품 가격을 다시 사용해 두 상품의 합산 금액을 계산하려고 했지만, **이전 Step 내부의 `const`는 다음 Step에서 바로 접근할 수 없다.**

이는 당시 코드 개선 과정에서 확인한 스코프 문제이며, 실제 컴파일 오류 출력은 따로 제공되지 않았다.

---

## 2. 문제점 분석: 블록 스코프

```ts
await test.step("선택 상품 1개", async () => {
  const firstOriginalPrice = 47700;
});

await test.step("선택 상품 2개", async () => {
  // firstOriginalPrice를 여기서 사용할 수 없음
});
```

`const`로 선언한 변수는 해당 `{}` 블록 내부에서만 사용할 수 있다.

각 `test.step()`에 전달하는 콜백은 별도의 블록을 갖는다.

---

## 3. 처음 고려한 대안: 값 다시 가져오기

두 번째 Step에서도 다음처럼 금액을 다시 읽을 수는 있다.

```ts
const firstOriginalPrice = parsePrice(
  (await firstProduct.locator("s").textContent())!,
);
```

그러나 상품 선택 상태만 변경하고 상품 자체의 가격이 변경되지 않는 이번 시나리오에서는 같은 데이터를 반복해서 읽는 코드가 늘어난다.

---

## 4. 개선 방향: 공통 데이터는 Step 바깥에서 준비

```ts
const productItems = page.locator("div[data-comm-idx]");
await expect(productItems).toHaveCount(2);

const firstProduct = productItems.nth(0);
const secondProduct = productItems.nth(1);

const firstOriginalPrice = parsePrice(
  (await firstProduct.locator("s").textContent())!,
);

const firstDiscountedPrice = parsePrice(
  (await firstProduct.locator("small + div > span").textContent())!,
);

const secondOriginalPrice = parsePrice(
  (await secondProduct.locator("s").textContent())!,
);

const secondDiscountedPrice = parsePrice(
  (await secondProduct.locator("small + div > span").textContent())!,
);
```

이 변수들은 같은 `test()` 안의 모든 Step에서 재사용할 수 있다.

---

## 5. `Locator`와 읽어 온 숫자의 차이

```ts
const firstProduct = productItems.nth(0); // Locator

const firstOriginalPrice = parsePrice(
  (await firstProduct.locator("s").textContent())!,
); // number
```

- `firstProduct`: 나중에 사용할 때 대상 요소를 다시 찾는 Locator
- `firstOriginalPrice`: `textContent()`를 실행했던 시점의 숫자 값

상품 수량·옵션 변경이 포함되는 테스트라면 숫자가 달라질 수 있으므로 다시 읽어야 한다.

이번 TC에서는 **체크박스 선택 상태만 바뀌고 개별 상품 가격은 유지된다는 관찰**을 전제로 공통 숫자를 재사용했다.

---

## 6. 사전조건 검증 순서 개선

초기 코드에서는 가격을 먼저 가져온 다음 Step 안에서 상품 수를 확인했다.

```ts
// 가격 추출 후
await test.step("선택 상품 1개", async () => {
  await expect(productItems).toHaveCount(2);
});
```

개선한 순서는 다음과 같다.

```ts
await page.goto("https://www.bizhows.com/ko/v/step3-cart");

const productItems = page.locator("div[data-comm-idx]");
await expect(productItems).toHaveCount(2);

// 이후 두 상품의 가격 추출
```

**두 상품이 준비되었는지 확인한 뒤 가격을 읽어야** 잘못된 테스트 데이터 상태를 먼저 발견할 수 있다.

---

## 7. 자동화 시나리오 설계 반영

```ts
// 공통 상품/가격/금액 Locator 준비

await test.step("선택 상품 0개", async () => {
  // 전체 선택 해제, 모든 금액 0원, 주문 버튼 비활성화
});

await test.step("선택 상품 1개", async () => {
  // 첫 번째 상품 선택
  // firstOriginalPrice, firstDiscountedPrice 활용
});

await test.step("선택 상품 2개", async () => {
  // 두 번째 상품 추가 선택
  const expectedAmount = firstOriginalPrice + secondOriginalPrice;
  const expectedDiscount = expectedAmount -
    (firstDiscountedPrice + secondDiscountedPrice);
  // 합계 Assertion
});
```

`test.step()`은 테스트 내 수행 단계의 이름과 경계를 구분하는 기능이다. **Step 3개를 작성해도 Playwright `test()`는 1개**다.

---

## 8. 결과

- 첫 번째 상품 가격을 두 번째 Step에서 다시 읽지 않고 재사용할 수 있도록 구조를 정리했다.
- 가격 추출 전에 상품 2개 존재 여부를 검증하도록 개선 방향을 정했다.
- 최종적으로 선택 상품 0개 → 1개 → 2개 상태를 검증하는 연속 시나리오가 정상 통과했다고 확인했다.
- 독립적인 TC 세 개가 실행된 것으로 기록하지 않고, **하나의 테스트에서 세 상태를 검증**한 것으로 구분했다.

---

## 9. 배운 점

- `const` 변수의 유효 범위는 선언한 블록에 의해 결정된다.
- 여러 Step이 공유하는 Locator와 변하지 않는 테스트 데이터는 바깥에 정의할 수 있다.
- 실행 중 바뀌는 값(예: 배송비)은 필요한 상태 전환 이후에 읽어야 한다.
- 사전조건 검증은 후속 데이터 조회보다 앞에 두는 편이 실패 원인을 명확하게 한다.
- 테스트 추적성에서 `test.step()`과 독립적인 `test()` 수를 혼동하면 안 된다.

---

## 10. 핵심 정리

```text
Step 내부에서 가격 변수 선언
↓
다음 Step에서 재사용 불가
↓
공통 값을 Step 바깥으로 이동
↓
모든 Step에서 재사용

가격 추출 전에 사전조건 확인
↓
선택 0개 → 1개 → 2개 연속 실행
↓
Playwright test 1개 / test.step 3개
```

> **변하지 않는 공통 데이터는 Step 바깥으로, 상태에 따라 달라지는 값은 해당 Step 안에서 읽는다.**
