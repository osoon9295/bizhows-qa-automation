# Playwright Troubleshooting: 상품 옵션 Locator Strict Mode 충돌

## 1. 문제 상황

비즈하우스 종이컵 상품 상세 페이지에서 최초 진입 시 기본 사이즈인 `"10온스"`가 표시되는지 검증하기 위해 다음과 같이 Locator를 작성했다.

```ts
const sizeOption = page
  .locator("div")
  .filter({ has: page.getByText("사이즈", { exact: true }) })
  .filter({ has: page.getByText("10온스", { exact: true }) });

await expect(sizeOption).toBeVisible();
```

하지만 테스트 실행 시 Chromium, Firefox, WebKit 모두 다음과 같은 오류가 발생했다.

```text
Error: expect(locator).toBeVisible() failed

strict mode violation:
locator('div')
  .filter({ has: getByText('사이즈', { exact: true }) })
  .filter({ has: getByText('10온스', { exact: true }) })

resolved to 9 elements
```

즉, Playwright가 사이즈 옵션 영역 하나가 아니라 조건을 만족하는 여러 개의 `<div>` 요소를 동시에 찾으면서 어떤 요소를 검증해야 하는지 결정하지 못했다.

---

## 2. 원인 분석

상품 상세 페이지의 옵션 영역은 다음과 같이 여러 단계의 `<div>`로 중첩되어 있었다.

```html
<div>
  ...
  <span>사이즈</span>
  ...
  <div>10온스</div>
  ...
</div>
```

기존 Locator에서 사용한 조건은 다음과 같다.

```ts
page.locator("div")
  .filter({ has: page.getByText("사이즈", { exact: true }) })
  .filter({ has: page.getByText("10온스", { exact: true }) });
```

이 Locator의 의미는 다음과 같다.

> `"사이즈"`와 `"10온스"` 요소를 자손으로 포함하고 있는 모든 `<div>` 요소를 찾는다.

따라서 실제로 원하는 옵션 행뿐 아니라, 해당 영역을 감싸는 상위 컨테이너들까지 모두 조건을 만족했다.

실패 로그에서는 총 9개의 요소가 매칭되었다.

```text
1) 상품 상세 전체를 감싸는 상위 div
2) 상품 정보 영역을 감싸는 div
3) 옵션 영역을 감싸는 div
...
8) 사이즈 옵션 전체 영역
9) 사이즈 + 현재 선택값을 감싸는 영역
```

즉, 텍스트 조건 자체는 맞았지만 Locator 범위가 지나치게 넓었다.

---

## 3. 왜 `strict mode violation`이 발생했는가?

Playwright는 `click()`, `toBeVisible()`과 같이 단일 요소를 대상으로 하는 동작에서 Locator가 여러 요소와 매칭되면 strict mode 오류를 발생시킨다.

이번 Locator는 다음 조건을 사용했다.

```text
div
+
내부에 "사이즈"가 존재
+
내부에 "10온스"가 존재
```

DOM이 중첩되어 있기 때문에 가장 가까운 옵션 행뿐 아니라 그 부모 요소들도 같은 조건을 만족했다.

따라서:

```text
원하는 요소 1개
```

가 아니라:

```text
조건을 만족하는 상위/하위 div 9개
```

가 반환되면서 strict mode violation이 발생했다.

---

## 4. 초기 해결 후보

Inspector에서 `"10온스"` 요소를 직접 선택하면 다음과 같은 Locator가 제안되었다.

```ts
locator("div")
  .filter({ hasText: /^10온스$/ })
  .nth(2);
```

이 방법을 사용하면 현재 DOM에서는 원하는 `"10온스"` 요소를 선택할 수 있다.

하지만 `nth(2)`는 다음과 같은 의미다.

```text
"10온스"를 가진 div 중 세 번째 요소를 선택한다.
```

즉, 대상 요소의 의미가 아니라 DOM 순서에 의존한다.

중간에 동일한 텍스트를 가진 요소가 추가되거나 DOM 구조가 변경되면 세 번째 요소가 더 이상 원하는 대상이 아닐 수 있다.

---

## 5. 개선 방향

Inspector를 통해 `"사이즈"`와 `"10온스"`가 함께 들어 있는 옵션 행 전체는 다음 Locator로 하나만 특정할 수 있음을 확인했다.

```ts
const sizeRow = page.getByText("사이즈10온스", {
  exact: true,
});
```

이후 해당 행 내부에서 다시 현재 선택값인 `"10온스"`를 찾도록 범위를 좁혔다.

```ts
const sizeRow = page.getByText("사이즈10온스", {
  exact: true,
});

await expect(sizeRow).toBeVisible();

const sizeValue = sizeRow.getByText("10온스", {
  exact: true,
});

await expect(sizeValue).toBeVisible();
```

Locator 탐색 범위는 다음과 같이 변경되었다.

```text
페이지 전체
↓
"사이즈10온스" 옵션 행
↓
그 안의 "10온스" 선택값
```

즉, 페이지 전체의 모든 `<div>`를 대상으로 조건을 걸기보다 먼저 의미 있는 부모 영역을 특정한 뒤 그 안에서 자식 요소를 찾도록 변경했다.

---

## 6. `.nth()`를 사용하지 않은 이유

다음과 같이 `nth()`를 이용하면 strict mode 오류를 피할 수도 있다.

```ts
page
  .locator("div")
  .filter({ hasText: /^10온스$/ })
  .nth(2);
```

하지만 이 방법은:

> 여러 개가 잡히는 상태에서 현재 DOM 순서를 기준으로 특정 요소를 강제로 선택한다.

는 방식에 가깝다.

DOM 구조가 변경되면 `nth(2)`가 다른 요소를 가리킬 가능성이 있다.

반면 부모 옵션 행을 먼저 특정하고 그 내부에서 값을 찾으면 코드만 보아도 다음 의도를 확인할 수 있다.

```text
사이즈 옵션 영역
→ 현재 표시값 10온스
```

따라서 DOM 순서보다는 UI 구조와 테스트 의도가 드러나는 Locator를 사용하는 쪽이 유지보수에 더 적합하다고 판단했다.

---

## 7. 결과

기존 Locator는 `"사이즈"`와 `"10온스"`를 포함하는 상위 `<div>`까지 모두 선택하여 9개의 요소와 매칭되었다.

Locator의 범위를:

```text
전체 div 탐색
```

에서:

```text
사이즈 옵션 행
→ 내부 선택값
```

으로 좁힌 뒤 단일 요소를 안정적으로 식별할 수 있었다.

이후 사이즈 드롭다운을 여는 동작에서도 동일한 `sizeValue` Locator를 사용할 수 있었다.

---

## 8. 배운 점

- 텍스트 조건이 정확하더라도 DOM이 중첩되어 있으면 여러 상위 요소가 함께 매칭될 수 있다.
- `strict mode violation`은 Locator가 단일 대상을 특정하지 못하고 있다는 중요한 신호다.
- `.nth()`로 강제로 하나를 선택하기 전에 왜 여러 요소가 잡히는지 DOM 구조를 먼저 확인하는 것이 좋다.
- Playwright Locator는 페이지 전체에서 한 번에 찾기보다 **부모 영역 → 자식 요소** 순서로 범위를 좁히면 의도와 안정성이 좋아진다.
- Locator는 단순히 "현재 동작하는가"뿐 아니라 DOM 변경 시에도 유지할 수 있는지 고려해야 한다.
- Inspector가 제안한 Locator를 그대로 사용하는 것보다 테스트 대상의 의미를 기준으로 직접 조합하는 과정이 필요하다.

---

## 9. 핵심 정리

이번 문제의 핵심은 다음 문장으로 정리할 수 있다.

> **Locator 조건이 맞더라도 탐색 범위가 넓으면 안정적인 Locator가 아니다.**

처음 작성한 Locator는 `"사이즈"`와 `"10온스"`라는 올바른 텍스트를 사용했지만, 중첩된 모든 상위 `<div>`까지 함께 선택했다.

실패 로그와 DOM 구조를 확인한 뒤 옵션 행을 먼저 특정하고 그 내부의 선택값을 찾도록 Locator 범위를 단계적으로 좁혀 strict mode 오류를 해결했다.
