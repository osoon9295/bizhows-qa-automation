# Playwright Troubleshooting: 장바구니와 주문 페이지의 옵션 표시 순서 차이

## 1. 문제 상황

비즈하우스의 장바구니 페이지와 주문 페이지는 동일 상품의 옵션을 서로 다른 순서와 HTML 구조로 표시했다.

장바구니에서는 옵션이 한 문자열에 `|`로 연결되었다.

```text
모양 : 정사각형 | 사이즈 : 600x600mm | 원단 : 투명 시트 | 부자재 : 고무 망치
```

주문 페이지에서는 옵션이 개별 `<li>`로 나뉘었고, 순서도 달랐다.

```text
원단 : 투명 시트
사이즈 : 600x600mm
부자재 : 고무 망치
모양 : 정사각형
수량(건) : 8
```

이 문자열을 그대로 비교하면 실제 옵션 값이 동일해도 순서 차이로 인해 테스트가 실패할 수 있었다.

---

## 2. 원인 분석

두 페이지는 같은 비즈니스 정보를 **다른 UI 표현**으로 제공하고 있었다.

| 구분 | 장바구니 | 주문 페이지 |
| --- | --- | --- |
| 옵션 저장 형태 | `|`로 연결된 문자열 | `<li>`별 문자열 배열 |
| 표시 순서 | 모양 → 사이즈 → 원단 → 부자재 | 원단 → 사이즈 → 부자재 → 모양 |
| 수량(건) | 별도 입력창이 있을 수 있음 | 옵션 목록에 표시됨 |

검증 대상은 옵션 문자열 전체가 아니라 **옵션명과 옵션값의 대응 관계**라고 판단했다.

---

## 3. 개선 방법: 옵션을 객체로 정규화

옵션을 `Record<string, string>` 형태로 변환하는 `parseOptions()` Helper를 사용했다.

```ts
export function parseOptions(optionTexts: string[]): Record<string, string> {
  return Object.fromEntries(
    optionTexts.map((text) => {
      const [key, ...valueParts] = text.split(":");

      return [
        key.trim(),
        valueParts.join(":").trim().replace(/\s+/g, " "),
      ];
    }),
  );
}
```

`valueParts.join(":")`를 사용하여 옵션값 자체에 `:`가 포함되더라도 나머지 내용을 보존한다.

장바구니와 주문 페이지에서 각각 수집한 텍스트를 동일한 함수로 변환했다.

```ts
// Given: 장바구니
const cartOptionText = await product.locator("ul").first().innerText();
const cartOptions = parseOptions(cartOptionText.split("|"));

// Then: 주문 페이지 - orderProduct는 해당 상품의 li Locator
const orderOptionTexts = await orderProduct
  .locator("ul > li")
  .allInnerTexts();

const orderOptions = parseOptions(orderOptionTexts);
```

객체는 키의 삽입 순서가 다르더라도 `toEqual()`로 같은 키·값을 비교할 수 있다.

---

## 4. 수량과 옵션을 분리한 이유

주문 페이지에는 `수량(건)`이 옵션 목록에 함께 포함되어 있지만, 장바구니에서는 별도 입력창으로 노출되는 상품이 존재한다.

```ts
const {
  "수량(건)": orderQuantity,
  ...orderRestOptions
} = orderOptions;

expect(orderRestOptions).toEqual(cartOptions);
```

여기서 `...orderRestOptions`는 `수량(건)` 이외의 옵션들을 모은 객체다.

반면 **`매수 : 100 매`**는 상품 제작 규격 옵션이므로 `수량(건)`과 동일하게 취급하지 않았다. 서로 다른 의미의 데이터까지 제거하면 유효한 옵션 검증이 누락된다.

---

## 5. 상품 단위 매칭의 한계

옵션 비교 시에는 `orderProduct`를 상품명으로 찾은 다음, 해당 상품 영역 안의 옵션을 조회했다.

```ts
const orderProduct = page
  .getByRole("heading", {
    name: cartItem.name,
    level: 3,
    exact: true,
  })
  .locator("xpath=ancestor::li[1]");
```

이 방식은 **상품명 중복이 없는 현재 테스트 데이터**에서 활용할 수 있다. 같은 상품명이 옵션만 다르게 두 번 등장하면 `getByRole()`이 여러 개 매칭될 수 있으므로, 나중에는 옵션 조합 등으로 상품 항목을 추가 식별해야 한다.

또한 `Object.fromEntries()`는 같은 옵션명이 반복되면 마지막 값을 남기므로, 옵션 키가 중복되는 상품 구조가 나타나면 현재 정규화 방식의 적합성을 재검토해야 한다.

---

## 6. 결과

- 두 페이지의 표현 형식이 달라도 같은 옵션명·옵션값을 비교할 수 있는 구조를 적용했다.
- 사용자는 이후 상품명·옵션·수량 데이터 수집을 반복문으로 통합한 테스트가 정상 동작한다고 확인했다.
- 수량 입력창이 없는 상품의 수량 자체가 맞는지에 대한 독립 검증은 별도 규칙 확인이 필요하다.

---

## 7. 배운 점

- 화면 문자열의 순서가 다르다고 데이터가 다르다고 판단해서는 안 된다.
- E2E 비교 테스트에서는 UI를 **비교 가능한 공통 데이터 모델**로 정규화하는 과정이 유용하다.
- 상품 옵션과 구매 수량은 의미가 다르므로 별도 속성으로 관리해야 한다.
- 지나친 정규화로 중복 키나 중요한 옵션을 소실하지 않도록 주의해야 한다.

---

## 8. 핵심 정리

> **옵션의 표시 순서를 비교하지 말고, 옵션명과 옵션값의 일치 여부를 검증한다.**
