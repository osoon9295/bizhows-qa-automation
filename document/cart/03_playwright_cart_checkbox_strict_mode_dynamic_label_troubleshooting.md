# Playwright Troubleshooting: 장바구니 체크박스의 숨김 input과 중복·변경되는 레이블

> **유형:** 실제 클릭 실패 / Strict Mode 오류 / 상태 전이 대응  
> **대상:** 전체 선택 및 개별 상품 체크박스

## 1. 문제 상황

장바구니에서 선택 상품 수에 따라 체크박스 레이블이 바뀌었다.

```text
모두 선택된 상태: "2개 선택"
모두 해제한 상태: "전체 선택"
```

또한 장바구니 체크박스와 보관함 체크박스에 `전체 선택`이라는 동일한 텍스트가 표시되어 Locator가 중복되는 문제도 발생했다.

---

## 2. 체크박스 HTML 구조

실제 UI에서는 체크박스 input이 시각적으로 숨겨져 있고, 바깥쪽 `label`이 클릭 영역이었다.

```html
<label data-react-aria-pressable="true" data-selected="true">
  <span style="clip-path: inset(50%); position: absolute; ...">
    <input type="checkbox" title="" />
  </span>
  <span><!-- 체크 아이콘 --></span>
  <span>2개 선택</span>
</label>
```

그래서 숨겨진 `input`을 직접 클릭하면 주변 요소가 클릭을 가로채는 문제가 나타났다.

---

## 3. 첫 번째 문제: input 직접 클릭

```ts
await page.getByRole("checkbox").click();
```

와 같은 접근은 체크박스의 실제 클릭 타깃이 `label`인 UI에서는 실패할 수 있다.

당시에는 숨겨진 input에서 `intercepts pointer events` 메시지가 관찰되었다.

반면 `toBeChecked()`는 input의 상태를 확인하는 Assertion이므로 계속 사용할 수 있다.

---

## 4. 두 번째 문제: 레이블 텍스트 변경

처음에는 선택 상태의 텍스트로 Locator를 정의했다.

```ts
const selectedLabel = page
  .locator("label")
  .filter({ hasText: /^\d+개 선택$/ });
```

하지만 클릭 후에는 동일한 label의 텍스트가 `전체 선택`으로 바뀐다.

따라서 **동일한 텍스트 필터 Locator를 클릭 전후에 그대로 사용하면**, 클릭 후 기존 조건과 맞지 않는 문제가 생긴다.

---

## 5. 세 번째 문제: `전체 선택`의 중복

```ts
const unSelectedLabel = page
  .locator("label")
  .filter({ hasText: /^전체 선택$/ });
```

이 Locator는 장바구니 전체 선택뿐 아니라 보관함 쪽의 `전체 선택`까지 찾아 2개를 반환했다.

예상 오류는 다음과 같은 형태로 기록되었다.

```text
strict mode violation:
locator(...) resolved to 2 elements
```

단순히 `.first()`로 해결하면 화면 구조에 따른 순서 변화로 다른 체크박스를 선택할 수 있다.

---

## 6. 개선 방향: 레이블 클릭과 영역 제한

당시 DOM에서 장바구니 전체 선택 레이블은 `header` 안에 있었으므로 검색 범위를 좁혔다.

```ts
const selectedLabel = page
  .locator("header label")
  .filter({ hasText: /^\d+개 선택$/ });

const unSelectedLabel = page
  .locator("header label")
  .filter({ hasText: /^전체 선택$/ });
```

`header`는 그때 확인한 실제 DOM 구조에 근거한 범위다. 서비스 UI가 변경되면 적합성을 다시 확인해야 한다.

---

## 7. 자동화 시나리오 설계 반영

```ts
const checkedInput = selectedLabel.getByRole("checkbox");
const uncheckedInput = unSelectedLabel.getByRole("checkbox");

// Given: 전체 선택 상태
await expect(checkedInput).toBeChecked();

// When: 사용자와 같은 방식으로 label 클릭
await selectedLabel.click();

// Then: 선택 해제 상태
await expect(uncheckedInput).not.toBeChecked();
```

개별 상품의 체크박스는 상품을 나타내는 컨테이너 안에서 찾았다.

```ts
const productItems = page.locator("div[data-comm-idx]");
await expect(productItems).toHaveCount(2);

const firstProduct = productItems.nth(0);
const firstLabel = firstProduct.locator("label");

await firstLabel.click();
await expect(firstLabel.getByRole("checkbox")).toBeChecked();
```

`data-comm-idx`는 **값을 하드코딩하지 않고 속성 존재만 사용**해 상품 항목을 검색하는 데 활용했다.

---

## 8. 결과

- 숨겨진 input을 직접 클릭하는 대신 label을 클릭하여 선택 상태를 변경했다.
- `header`로 검색 범위를 제한해 장바구니/보관함의 `전체 선택` 중복을 해소했다.
- 선택 상태가 바뀌어 레이블 텍스트가 변경되는 경우를 별도의 Locator로 처리했다.
- 개별 상품은 상품명 대신 상품 항목 컨테이너를 기준으로 찾는 구조를 구성했다.

---

## 9. 배운 점

- 시각적 체크박스와 실제 HTML input의 클릭 가능 영역이 다를 수 있다.
- 클릭 동작과 상태 검증은 서로 다른 요소를 사용해도 된다.
- Playwright Locator는 선언 시점의 요소를 고정하지 않고 동작 시점에 다시 탐색한다.
- 동일 텍스트가 여러 영역에 존재하면 의미 있는 상위 영역으로 범위를 좁히는 편이 안전하다.
- `.nth()`는 상품 구분이 중요하지 않고 **2개 항목을 전제로 하는 시나리오**에서 사용했다.

---

## 10. 핵심 정리

```text
숨겨진 input 직접 클릭
↓
클릭 가로채기

"2개 선택" Locator 재사용
↓
클릭 후 "전체 선택"으로 텍스트 변경

"전체 선택" 전체 검색
↓
장바구니 + 보관함 중복 → strict mode violation

개선
↓
header로 범위 제한
↓
label 클릭 + input 체크 상태 검증
```

> **체크박스 테스트에서는 DOM 클릭 구조, 상태 변화에 따른 텍스트, 동일한 이름의 다른 컨트롤을 함께 고려한다.**
