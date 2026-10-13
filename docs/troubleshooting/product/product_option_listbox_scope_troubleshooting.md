# Playwright Troubleshooting: 드롭다운 옵션 중복 매칭 문제

## 1. 문제 상황

수량 드롭다운에서 `data-f` 기반 Locator를 제거한 뒤, 화면에 보이는 숫자 텍스트만 이용해 옵션을 찾으려고 했다.

```ts
const quantityOptions = page
  .locator("span:visible")
  .filter({
    hasText: /^(500|1000|2000|3000|4000|5000)$/,
  });

await expect(quantityOptions).toHaveText(testCase.quantities);
```

10온스 수량 옵션의 기대값은 다음과 같았다.

```ts
["500", "1000", "2000", "3000", "4000", "5000"]
```

하지만 실제 결과에서는 `"500"`이 두 번 포함되었다.

```text
Expected:
["500", "1000", "2000", "3000", "4000", "5000"]

Received:
["500", "500", "1000", "2000", "3000", "4000", "5000"]
```

---

## 2. 원인 분석

드롭다운을 연 상태에서는 `"500"`이라는 텍스트가 두 군데에 동시에 존재했다.

```text
수량 [500]           ← 현재 선택값

┌─ 드롭다운 목록 ─────┐
│ 500               │ ← 옵션
│ 1000              │
│ 2000              │
│ ...               │
└───────────────────┘
```

즉 다음 Locator는:

```ts
page.locator("span:visible")
```

페이지 전체의 보이는 `<span>`을 대상으로 탐색했다.

따라서:

```text
현재 선택값 500
+
드롭다운 내부 옵션 500
```

을 모두 가져왔다.

---

## 3. 정규식 자체는 문제가 아니었다

사용한 정규식은 숫자 옵션만 선택한다는 목적에는 맞았다.

이후에는 더 일반적으로 다음과 같이 변경할 수 있었다.

```ts
/^\d+$/
```

의미는:

```text
^   문자열 시작
\d  숫자
+   하나 이상
$   문자열 끝
```

즉 문자열 전체가 숫자로만 이루어진 요소를 찾는다.

```text
500          → 매칭
1000         → 매칭
개당 144원   → 매칭되지 않음
```

문제는 정규식이 아니라 **검색 범위가 페이지 전체였다는 점**이었다.

---

## 4. 개선 방향

DOM을 확인한 결과 열린 드롭다운에는 다음 구조가 존재했다.

```html
<div role="listbox">
  <button role="option">
    <span>500</span>
  </button>

  <button role="option">
    <span>1000</span>
    <span>개당 144원</span>
  </button>
</div>
```

따라서 먼저 드롭다운 목록인 `listbox`를 특정하고 그 안에서 숫자 텍스트만 찾도록 범위를 좁혔다.

```ts
const quantityListbox = page.getByRole("listbox");

await expect(quantityListbox).toBeVisible();

const quantityOptions = quantityListbox
  .locator("span")
  .filter({
    hasText: /^\d+$/,
  });

await expect(quantityOptions).toHaveText(testCase.quantities);
```

---

## 5. Locator 범위 변화

### 변경 전

```text
페이지 전체
↓
visible span
↓
숫자로만 이루어진 텍스트
```

이 방식에서는 현재 선택값까지 함께 포함되었다.

### 변경 후

```text
페이지 전체
↓
현재 열린 listbox
↓
그 내부 span
↓
숫자로만 이루어진 텍스트
```

드롭다운 목록 내부로 범위를 제한하면서 현재 선택값을 자연스럽게 제외할 수 있었다.

---

## 6. `.nth()`를 사용하지 않은 이유

중복된 `"500"` 중 두 번째 요소를 선택하면 임시로 해결할 수 있었다.

```ts
quantityOptions.nth(1);
```

하지만 이 방식은 현재 DOM 순서에 의존한다.

DOM 구조가 변경되면 같은 인덱스가 더 이상 원하는 요소를 가리키지 않을 수 있다.

따라서 최종 코드에서는 `.nth()`로 중복을 회피하는 대신 **드롭다운 컨테이너 자체를 먼저 특정하는 방식**을 선택했다.

---

## 7. 결과

수량 옵션 검증은 최종적으로 다음 구조로 정리되었다.

```ts
const quantityDropdownTrigger = page.getByRole("button", {
  name: testCase.defaultQuantity,
  exact: true,
});

await quantityDropdownTrigger.click();

const quantityListbox = page.getByRole("listbox");

await expect(quantityListbox).toBeVisible();

const quantityOptions = quantityListbox
  .locator("span")
  .filter({ hasText: /^\d+$/ });

await expect(quantityOptions).toHaveText(testCase.quantities);
```

페이지 전체에서 숫자 텍스트를 수집하던 방식에서 벗어나, 현재 열린 드롭다운 내부의 수량 옵션만 검증할 수 있게 되었다.

---

## 8. 배운 점

- 텍스트가 정확해도 페이지 전체에서 찾으면 동일한 값이 여러 위치에서 매칭될 수 있다.
- 현재 선택값과 드롭다운 옵션은 같은 텍스트를 동시에 표시할 수 있다.
- 중복 요소가 발생했을 때 `.nth()`로 바로 해결하기보다 왜 중복되는지 DOM 구조를 먼저 확인하는 것이 좋다.
- `listbox`와 같이 의미 있는 부모 컨테이너를 먼저 특정하면 Locator 범위를 안정적으로 좁힐 수 있다.
- 정규식은 Locator의 "조건"을 해결하지만, Locator의 "범위" 문제까지 해결하지는 않는다.

---

## 9. 핵심 정리

이번 문제의 핵심은 다음 문장으로 정리할 수 있다.

> **정확한 텍스트 조건만큼 중요한 것이 Locator의 탐색 범위다.**

처음에는 숫자 텍스트만 찾으면 수량 옵션을 특정할 수 있다고 생각했지만, 현재 선택값과 목록 옵션이 동시에 노출되면서 중복이 발생했다.

`listbox`를 먼저 특정하고 그 내부에서 숫자 옵션을 찾도록 변경하면서 중복 매칭 문제를 해결했다.
