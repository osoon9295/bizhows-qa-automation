# Playwright Troubleshooting: 페이지 진입 직후 Locator 개수가 0 또는 2로 달라지는 문제

## 1. 문제 상황

비즈하우스 상품 상세 페이지에서 수량 input을 찾기 위해 페이지 진입 직후 textbox의 개수를 확인했다.

초기 확인 코드는 다음과 같았다.

```ts
await page.goto(productUrl);

console.log(await page.getByRole("textbox").count());
```

같은 테스트를 Chromium, Firefox, WebKit에서 반복 실행했는데 textbox 개수가 `0` 또는 `2`로 일정하지 않게 출력되었다.

예:

```text
Chromium : 2 / 2 / 0 / 0
Firefox  : 2 / 0 / 0 / 2
WebKit   : 0 / 2 / 0 / 0
```

테스트 결과 자체는 `12 passed`로 표시되어 처음에는 Locator 동작을 해석하기 어려웠다.

---

## 2. 문제점 분석

`page.goto()`가 완료되었다고 해서 React 기반 상세 페이지의 모든 UI 컴포넌트가 즉시 렌더링되었다는 의미는 아니다.

페이지는 다음과 같은 순서로 준비될 수 있다.

```text
문서 로드
↓
JavaScript 실행
↓
React 초기화
↓
상품 데이터 처리
↓
상세 옵션 영역 렌더링
↓
수량 input 표시
```

따라서 `count()`를 실행하는 시점에 따라 아직 수량 input이 생성되지 않았거나, 검색창과 수량 input이 모두 생성된 상태일 수 있었다.

---

## 3. `count()`를 준비 상태 확인에 사용한 문제

다음 코드는 그 순간 DOM에 몇 개의 textbox가 존재하는지만 반환한다.

```ts
await page.getByRole("textbox").count();
```

하지만 테스트의 실제 목적은:

```text
현재 textbox가 몇 개인가?
```

가 아니라:

```text
수량 입력 필드가 사용 가능한 상태로 표시되었는가?
```

였다.

따라서 페이지 준비 상태를 확인하기 위해 전체 textbox 개수를 사용하는 것은 적절하지 않았다.

---

## 4. 브라우저별 결과가 달랐던 이유

Chromium, Firefox, WebKit은 동일한 페이지를 로드하더라도 JavaScript 실행과 렌더링 완료 시점이 완전히 같지 않을 수 있다.

그 결과 `page.goto()` 직후 바로 DOM 개수를 조회하면 다음과 같은 차이가 발생할 수 있다.

```text
빠르게 렌더링된 경우
→ 검색창 + 수량 input
→ count = 2

아직 상세 영역이 렌더링되지 않은 경우
→ 대상 textbox 없음 또는 아직 확인 불가
→ count = 0
```

즉, 브라우저 기능 차이라기보다 테스트가 너무 이른 시점의 DOM 상태를 조회한 것이 문제의 핵심이었다.

---

## 5. 개선 방향

페이지 전체의 textbox 개수를 기다리는 대신 실제 테스트 대상인 수량 input 자체가 표시될 때까지 기다리도록 변경했다.

```ts
const quantityInput = page.locator('input[maxlength="5"]');

await expect(quantityInput).toBeVisible();
```

Playwright의 web-first Assertion은 조건이 즉시 충족되지 않더라도 일정 시간 동안 재시도한다.

따라서 단순한 순간 조회보다 실제 테스트 대상이 준비되었는지를 확인하는 데 적합하다.

---

## 6. 임의의 대기 시간을 사용하지 않은 이유

다음과 같이 고정 시간을 기다리는 방법도 생각할 수 있다.

```ts
await page.waitForTimeout(2000);
```

하지만 이 방법은 사용하지 않았다.

이유는 다음과 같다.

```text
- 환경에 따라 2초가 부족할 수 있음
- 실제로 200ms 만에 준비되어도 항상 2초를 기다림
- 테스트 실행 시간이 불필요하게 증가함
- UI가 준비되었는지가 아니라 시간만 경과했는지 확인함
```

따라서 시간 기반 대기보다 대상 요소의 상태를 기준으로 기다리는 방식을 선택했다.

---

## 7. 자동화 시나리오 설계 반영

최종 흐름은 다음과 같이 변경했다.

```ts
await page.goto(productUrl);

const quantityInput = page.locator('input[maxlength="5"]');

await expect(quantityInput).toBeVisible();

await quantityInput.fill(testCase.quantity);
await expect(quantityInput).toHaveValue(testCase.expectedValue);
```

즉, 테스트 수행 순서를 다음과 같이 명확히 했다.

```text
상세 페이지 진입
↓
수량 input 표시 확인
↓
수량 입력
↓
기대값 검증
```

---

## 8. 결과

초기에는 `page.goto()` 직후 textbox 개수를 확인해 DOM 준비 상태를 추측했고 브라우저마다 `0`, `2`가 섞여 나타났다.

이를 다음처럼 개선했다.

```text
기존

page.goto()
↓
textbox count 즉시 조회
↓
렌더링 시점에 따라 0 또는 2

개선

page.goto()
↓
수량 input Locator 정의
↓
toBeVisible()로 실제 대상 준비 상태 확인
↓
테스트 동작 수행
```

이후 수량 경계값 테스트는 Chromium, Firefox, WebKit에서 모두 통과했다.

---

## 9. 배운 점

- `page.goto()` 완료와 애플리케이션 UI 렌더링 완료는 동일한 의미가 아니다.
- 동적 UI에서는 페이지 전체 상태보다 실제 테스트 대상 요소가 준비되었는지를 기다리는 것이 중요하다.
- `count()`는 순간 조회이므로 요소 준비 여부를 확인하는 용도로는 적합하지 않을 수 있다.
- 브라우저별 렌더링 속도 차이는 동기화가 부족한 테스트에서 flakiness처럼 보일 수 있다.
- 고정 시간 대기보다 Playwright의 web-first Assertion을 활용하는 것이 안정적이다.
- Assertion이 없는 탐색 단계에서 `passed`가 표시되더라도 기능 검증이 완료되었다는 의미는 아니다.

---

## 10. 핵심 정리

이번 문제의 핵심은 다음과 같이 정리할 수 있다.

```text
page.goto() 직후
textbox count 확인
↓
브라우저와 실행 시점에 따라
0 또는 2 출력

원인
↓
동적 렌더링이 완료되기 전에
순간적인 DOM 상태를 조회

개선
↓
전체 textbox 개수가 아니라
실제 테스트 대상인 수량 input을 지정
↓
toBeVisible()로 준비 상태 확인

결론
↓
시간이나 전체 DOM 상태를 추측하지 말고
테스트 대상 요소의 상태를 기준으로 기다린다.
```

> **동적 페이지에서는 `page.goto()` 이후 바로 테스트하지 말고, 테스트하려는 요소가 실제로 준비되었는지를 기준으로 동기화한다.**
