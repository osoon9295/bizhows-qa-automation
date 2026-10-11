# Playwright Troubleshooting: 드롭다운 컴포넌트의 Role 구조를 동일하게 가정한 문제

## 1. 문제 상황

수량과 뚜껑 드롭다운의 DOM을 확인한 결과 선택지가 다음과 같이 구성되어 있었다.

```html
<div role="listbox">
  <button type="button" role="option">
    ...
  </button>
</div>
```

따라서 사이즈 드롭다운도 같은 UI 컴포넌트라고 판단하여 기존 Locator를 다음과 같이 변경했다.

### 변경 전

```ts
const size = page.getByRole("button", {
  name: testCase.size,
  exact: true,
});
```

### 변경 후

```ts
const size = page.getByRole("option", {
  name: testCase.size,
  exact: true,
});
```

하지만 전체 실행 결과 사이즈를 변경하는 테스트가 대부분 실패했다.

```text
Locator: getByRole('option', { name: '6.5온스', exact: true })
Expected: visible
Error: element(s) not found
```

같은 현상이 8온스, 16온스에서도 반복되었다.

상태 전이 테스트 역시:

```text
waiting for getByRole('option', { name: '16온스', exact: true })
```

에서 실패했다.

전체 결과는 다음과 같았다.

```text
30 tests
22 failed
8 passed
```

---

## 2. 실패 패턴 분석

실패한 케이스에는 공통점이 있었다.

```text
6.5온스 수량 테스트  → 실패
8온스 수량 테스트    → 실패
16온스 수량 테스트   → 실패

6.5온스 뚜껑 테스트  → 실패
8온스 뚜껑 테스트    → 실패
16온스 뚜껑 테스트   → 실패

사이즈 상태 전이     → 실패
```

반면 기본 사이즈인 10온스는 사이즈 드롭다운을 열어 다른 사이즈를 선택하지 않기 때문에 관련 구간을 지나지 않았다.

즉 많은 실패가 서로 다른 문제가 아니라 **사이즈 선택 Locator 한 곳**에서 시작된 연쇄 실패였다.

---

## 3. 원인 분석

수량/뚜껑 드롭다운에서는 실제 DOM으로 `role="option"`을 확인했다.

하지만 이 정보를 사이즈 드롭다운에도 그대로 적용했다.

문제는:

> 화면에서 비슷하게 보이는 드롭다운이라고 해서 내부 DOM과 접근성 구조까지 동일하다고 보장할 수 없다는 점이다.

실제 테스트에서는 사이즈 선택지가 기존 `button` Locator로 정상 동작했으며, `option`으로 변경한 뒤에는 요소를 찾지 못했다.

따라서 각각의 구조는 다음처럼 달랐다.

```text
사이즈 드롭다운
현재 선택값 → button
선택지       → button

수량 드롭다운
현재 선택값 → button
목록         → listbox
선택지       → option

뚜껑 드롭다운
현재 선택값 → button
목록         → listbox
선택지       → option
```

---

## 4. 왜 오류가 크게 증가했는가?

사이즈 선택 로직은 수량 테스트와 뚜껑 테스트에서 공통으로 사용하고 있었다.

```ts
if (testCase.size !== "10온스") {
  // 사이즈 드롭다운 열기
  // 다른 사이즈 선택
}
```

따라서 사이즈 Locator 하나가 잘못되면:

```text
수량 옵션 검증까지 도달하지 못함
+
뚜껑 옵션 검증까지 도달하지 못함
+
상태 전이 테스트도 진행하지 못함
```

이 되어 전체 실패 개수가 크게 증가했다.

즉:

```text
22개의 독립적인 오류
```

가 아니라:

```text
공통 Locator 한 곳의 오류
→ 22건의 연쇄 실패
```

로 보는 것이 맞았다.

---

## 5. 개선 방향

사이즈 선택지는 실제 동작이 확인된 `button` 기반 Locator로 되돌렸다.

```ts
const sizeDropdownTrigger = page.getByRole("button", {
  name: "10온스",
  exact: true,
});

await sizeDropdownTrigger.click();

const size = page.getByRole("button", {
  name: testCase.size,
  exact: true,
});

await expect(size).toBeVisible();

await size.click();
```

상태 전이 테스트도 동일하게 수정했다.

```ts
const size16Option = page.getByRole("button", {
  name: "16온스",
  exact: true,
});

await size16Option.click();
```

```ts
const size13Option = page.getByRole("button", {
  name: "13온스",
  exact: true,
});

await size13Option.click();
```

---

## 6. 결과

사이즈 선택 Locator를 다시 `button`으로 복구한 뒤 전체 테스트를 실행했다.

```text
Running 30 tests using 1 worker

30 passed
```

Chromium, Firefox, WebKit에서 모두 통과했다.

논리적인 자동화 시나리오는 다음과 같이 구성되어 있다.

```text
기본 옵션 검증                       1개
사이즈별 수량 옵션 검증              4개
사이즈별 뚜껑 옵션 검증              4개
사이즈 변경에 따른 유지/초기화 검증   1개
-----------------------------------------
총 10개 시나리오
× 3 browsers
= 30 executions
```

---

## 7. 배운 점

- 화면에서 같은 종류로 보이는 UI라도 내부 DOM 구조는 서로 다를 수 있다.
- 한 컴포넌트에서 확인한 접근성 속성을 다른 컴포넌트에 그대로 일반화하면 안 된다.
- 대량 실패가 발생했을 때 각 실패를 하나씩 고치기 전에 공통으로 실패하는 코드 경로를 먼저 찾아야 한다.
- parameterized test에서는 공통 로직 하나의 오류가 여러 테스트 실패로 확대될 수 있다.
- 실패 개수보다 **실패 패턴**을 보는 것이 원인 분석에 더 중요하다.
- Locator를 변경할 때는 실제 DOM 또는 Playwright Inspector로 대상 요소의 role을 직접 확인하는 것이 좋다.

---

## 8. 핵심 정리

이번 문제의 핵심은 다음 문장으로 정리할 수 있다.

> **비슷하게 보이는 UI라도 DOM 구조와 접근성 role은 실제로 확인한 뒤 Locator를 결정해야 한다.**

수량/뚜껑 드롭다운에서 `role="option"`이 동작한다는 이유로 사이즈 선택지에도 동일한 구조를 가정했고, 그 결과 공통 사이즈 선택 로직을 사용하는 대부분의 테스트가 연쇄적으로 실패했다.

실패 패턴을 기준으로 공통 원인을 찾고 사이즈 선택지만 실제 구조에 맞는 `button` Locator로 복구한 뒤, 최종적으로 30건의 브라우저 실행이 모두 통과했다.
