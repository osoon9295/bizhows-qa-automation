# Playwright Troubleshooting: 상품별 중복 검증 코드를 데이터 기반 반복문으로 개선

## 1. 문제 상황

장바구니 → 주문 페이지 데이터 일치 테스트의 초기 버전에는 다음과 같은 변수가 각각 존재했다.

```ts
const firstCartProduct = selectedCartItems.nth(0);
const secondCartProduct = selectedCartItems.nth(1);

const firstCartOptions = /* 첫 번째 상품 옵션 */;
const secondCartOptions = /* 두 번째 상품 옵션 */;

const firstOrderProduct = /* 첫 번째 주문상품 */;
const secondOrderProduct = /* 두 번째 주문상품 */;
```

상품명·옵션·수량·가격을 각각 읽고 검증하는 코드가 두 번 반복되었다. 상품의 개수가 늘어나거나 검증 항목이 추가되면 같은 로직을 다시 복사해야 하는 구조였다.

---

## 2. 원인 분석

반복되는 로직의 **동작은 동일**하고, 달라지는 것은 상품의 인덱스와 각 상품의 데이터뿐이었다.

따라서 상품별 정보를 하나의 객체로 묶은 다음 배열로 수집하면, 두 상품의 검증 코드를 공통화할 수 있다고 판단했다.

상품별 데이터와 전체 금액은 서로 다른 목적이므로 별도로 구성했다.

```text
cartItems    → 각 상품의 이름 / 옵션 / 수량 / 원가 / 할인 후 가격
cartAmounts  → 장바구니 주문금액 / 할인액 / 배송비 / 총금액
checkoutAmounts → 주문 페이지 주문금액 / 할인액 / 배송비 / 포인트 / 총금액
```

---

## 3. 개선 방법: Given에서 상품 데이터를 배열로 수집

```ts
const selectedCartItemCount = await selectedCartItems.count();

const cartItems: {
  name: string;
  options: Record<string, string>;
  quantity: number | null;
  originalPrice: number;
  discountedPrice: number;
}[] = [];

for (let i = 0; i < selectedCartItemCount; i++) {
  const product = selectedCartItems.nth(i);

  const name = await product
    .locator('a[href^="/ko/v/option?"]')
    .innerText();

  const optionsText = await product.locator("ul").first().innerText();
  const options = parseOptions(optionsText.split("|"));

  const quantity = await getCartQuantity(product);
  const originalPrice = parsePrice(await product.locator("s").innerText());
  const discountedPrice = parsePrice(
    await product.locator("small + div > span").innerText(),
  );

  cartItems.push({ name, options, quantity, originalPrice, discountedPrice });
}
```

`for`문을 사용한 이유는 Playwright의 `nth(i)`가 **인덱스**를 필요로 하기 때문이다.

---

## 4. 개선 방법: Then에서 저장된 상품을 반복 검증

```ts
for (const cartItem of cartItems) {
  const orderHeading = page.getByRole("heading", {
    name: cartItem.name,
    level: 3,
    exact: true,
  });

  await expect(orderHeading).toBeVisible();
  const orderProduct = orderHeading.locator("xpath=ancestor::li[1]");

  const optionTexts = await orderProduct.locator("ul > li").allInnerTexts();
  const orderOptions = parseOptions(optionTexts);
  const { "수량(건)": orderQuantity, ...restOptions } = orderOptions;

  expect(restOptions).toEqual(cartItem.options);

  if (cartItem.quantity !== null) {
    expect(Number(orderQuantity)).toBe(cartItem.quantity);
  }

  const orderOriginalPrice = parsePrice(
    await orderProduct.locator("s").innerText(),
  );
  expect(orderOriginalPrice).toBe(cartItem.originalPrice);
}
```

`for...of`는 수집한 상품 객체를 하나씩 꺼내 사용한다. 코드 예시에서는 **독립 근거를 확보하지 못한 `quantity === null` 항목의 수량 검증을 수행하지 않는다**. 이는 통과 처리와 같지 않으므로 추후 검증 누락 관리가 필요하다.

---

## 5. Helper 재사용의 범위

기존 `cart-amount.spec.ts`에서는 `0개 → 1개 → 2개` 선택 상태에 따라 금액을 검증했다. 반면 주문 페이지 검증에서는 상품 두 개가 선택된 **최종 상태**만 필요했다.

따라서 기존 테스트 전체를 다른 테스트에서 호출하지 않고, 의미 있는 공통 동작만 Helper로 분리했다.

```ts
getCartProducts(page);            // 장바구니 상품 Locator 반환
selectCartProduct(page, index);   // 특정 상품 선택 상태 보장
selectTwoCartProducts(page);      // 두 상품 선택 상태 준비
getCartQuantity(product);         // 상품별 수량 input 조회 또는 null
```

테스트끼리는 독립적으로 실행하고, 로그인 상태는 `storageState`를 이용해 설정했다. 단, 실제 장바구니 데이터 자체는 서로 다른 테스트에서 공유될 수 있으므로 병렬 실행 또는 테스트 데이터 변경의 영향은 따로 고려해야 한다.

---

## 6. 결과와 남은 제약

사용자는 반복문 도입 뒤 **테스트가 정상 동작하고 코드가 크게 줄었다**고 확인했다.

다만 이 개선을 '아무 상품이나 어떤 개수든 검증하는 완전한 범용 테스트'로 기술해서는 안 된다.

1. `selectTwoCartProducts()`는 여전히 **장바구니 상품이 정확히 2개**라는 조건을 가진다.
2. 주문상품을 **상품명만으로 식별**하기 때문에 같은 상품명에 옵션만 다른 항목이 존재하면 모호해진다.
3. 수량 input이 없는 상품에 대해 `1`을 기대하는 로직은 서비스 규칙을 확인해야 한다.
4. 운영 서비스의 장바구니 데이터 변경과 주문 페이지 정책 변경은 테스트 안정성에 영향을 줄 수 있다.

---

## 7. 배운 점

- 같은 검증 동작이 상품 수만큼 반복되면 데이터와 로직을 분리하는 것이 유리하다.
- **공통 동작은 Helper**, **TC의 기대결과는 테스트 코드**에 두면 역할을 구분하기 쉽다.
- `cartItems`에 실제 데이터를 저장하면 페이지 이동 후에도 비교에 사용할 수 있다.
- 반복문 적용으로 중복은 줄지만, 상품 식별 기준과 사전조건의 한계까지 자동으로 해결되지는 않는다.

---

## 8. 핵심 정리

> **첫 번째·두 번째 상품별 코드를 복사하기보다, 상품을 데이터로 수집하고 동일한 검증 규칙을 반복한다.**
