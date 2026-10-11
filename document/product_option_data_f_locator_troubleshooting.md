# Playwright Troubleshooting: `data-f` 기반 Locator 불안정 문제

## 1. 문제 상황

비즈하우스 종이컵 상품 상세 페이지에서 사이즈별 수량/뚜껑 옵션을 검증하기 위해, 처음에는 DOM에 존재하는 `data-f` 속성을 이용해 드롭다운 목록을 특정했다.

```ts
const quantityDropdown = page.locator('[data-f="OD-41a4"]:visible');
const quantityOptions = quantityDropdown.locator('[data-f="OT-b9e9"]');

await expect(quantityOptions).toHaveText(testCase.quantities);
```

뚜껑 옵션도 같은 방식으로 작성했다.

```ts
const lidDropdown = page.locator('[data-f="OD-41a4"]:visible');
const lidOptions = lidDropdown.locator('[data-f="OT-b9e9"]');

await expect(lidOptions).toHaveText(testCase.lids);
```

하지만 전체 테스트를 다시 실행했을 때 드롭다운 내부 옵션 Locator가 여러 브라우저에서 `0 elements`로 평가되며 테스트가 실패했다.

```text
Expected: ["500", "1000", "2000", "3000", "4000", "5000"]
Received: []
```

---

## 2. 원인 분석

`data-f` 값은 다음과 같은 형태였다.

```html
<div data-f="OD-41a4">
  ...
  <span data-f="OT-b9e9">1000</span>
  ...
</div>
```

처음에는 특정 요소를 잘 구분해 주었기 때문에 안정적인 속성처럼 보였다.

그러나 서비스 내부에서 사용하는 `data-f`는 사용자에게 의미가 있는 속성이나 테스트 전용 식별자가 아니었다.

즉 다음과 같은 가능성이 있었다.

```text
서비스 빌드 또는 UI 컴포넌트 변경
↓
내부 식별 값 변경
↓
기존 data-f 기반 Locator가 더 이상 요소를 찾지 못함
```

테스트 코드가 실제 사용자 관점의 의미가 아니라 서비스 내부 구현 세부사항에 강하게 의존하고 있었다.

---

## 3. DOM을 다시 확인한 결과

드롭다운을 연 상태의 실제 DOM을 더 넓게 확인하자 다음과 같은 접근성 속성이 존재했다.

```html
<button type="button" aria-haspopup="listbox" aria-expanded="true">
  <span>1000</span>
</button>

<div role="listbox">
  <button type="button" role="option" aria-selected="true">
    <span>1000</span>
  </button>

  <button type="button" role="option" aria-selected="false">
    <span>2000</span>
  </button>
</div>
```

즉 드롭다운은 다음과 같이 의미가 정의되어 있었다.

```text
현재 선택값 → button
옵션 목록   → listbox
각 옵션     → option
```

---

## 4. 개선 방향

내부 `data-f` 속성 대신 UI 의미를 기준으로 Locator를 구성했다.

### 변경 전

```ts
const quantityDropdown = page.locator('[data-f="OD-41a4"]:visible');
const quantityOptions = quantityDropdown.locator('[data-f="OT-b9e9"]');
```

### 변경 후

```ts
const quantityDropdownTrigger = page.getByRole("button", {
  name: testCase.defaultQuantity,
  exact: true,
});

await quantityDropdownTrigger.click();

const quantityListbox = page.getByRole("listbox");

await expect(quantityListbox).toBeVisible();
```

뚜껑 역시 같은 방식으로 변경했다.

```ts
const lidDropdownTrigger = page.getByRole("button", {
  name: testCase.defaultLid,
  exact: true,
});

await lidDropdownTrigger.click();

const lidListbox = page.getByRole("listbox");

await expect(lidListbox).toBeVisible();

const lidOptions = lidListbox.getByRole("option");

await expect(lidOptions).toHaveText(testCase.lids);
```

---

## 5. 왜 `getByRole()`을 사용했는가?

`getByRole()`은 DOM 내부의 자동 생성 속성보다 사용자가 실제로 상호작용하는 UI의 의미에 가깝다.

예를 들어:

```ts
page.getByRole("button", { name: "500" });
```

은 다음과 같이 읽을 수 있다.

> `"500"`이라는 이름을 가진 버튼을 찾는다.

반면:

```ts
page.locator('[data-f="DH-427d"]');
```

만 보면 어떤 UI를 의미하는지 코드만으로는 알기 어렵다.

또한 `role="listbox"`, `role="option"`과 같이 서비스가 제공하는 접근성 정보를 사용하면 테스트 의도가 더 명확해진다.

---

## 6. 결과

수량/뚜껑 드롭다운 Locator를 다음 기준으로 변경했다.

```text
내부 data-f 속성
↓
접근성 role + 사용자에게 보이는 값
```

최종적으로:

```ts
getByRole("button")
getByRole("listbox")
getByRole("option")
```

을 중심으로 Locator를 구성할 수 있었고, `data-f`에 직접 의존하던 코드를 제거했다.

최종 전체 실행에서는 상품 상세 옵션 관련 테스트가 Chromium, Firefox, WebKit에서 모두 통과했다.

```text
Running 30 tests using 1 worker
30 passed
```

---

## 7. 배운 점

- DOM에 존재한다고 해서 모든 `data-*` 속성이 안정적인 테스트 식별자인 것은 아니다.
- 외부 서비스에서는 `data-testid`처럼 테스트를 위한 안정적인 속성을 사용할 수 없는 경우가 있다.
- 이 경우 내부 속성보다 `role`, visible text 등 사용자 관점의 Locator를 우선 검토하는 것이 좋다.
- 드롭다운 DOM은 닫힌 상태만 보지 말고 열린 상태에서 더 넓은 부모 구조까지 확인해야 한다.
- Locator는 현재 동작하는지만 보는 것이 아니라 서비스 내부 구현이 변경되었을 때 얼마나 영향을 받는지도 고려해야 한다.

---

## 8. 핵심 정리

이번 문제의 핵심은 다음 문장으로 정리할 수 있다.

> **내부 구현용 속성보다 UI의 의미를 나타내는 접근성 정보를 우선 사용한다.**

처음에는 `data-f`가 간단하고 정확하게 요소를 찾는 것처럼 보였지만, 전체 회귀 실행에서 안정적이지 않았다.

DOM을 다시 확인한 결과 `button`, `listbox`, `option`과 같은 의미 있는 접근성 정보가 존재했고, 이를 기준으로 Locator를 변경해 테스트의 가독성과 유지보수성을 함께 개선했다.
