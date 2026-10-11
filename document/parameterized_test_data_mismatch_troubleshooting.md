# Playwright Troubleshooting: 파라미터화 테스트 데이터 불일치로 인한 Timeout

## 1. 문제 상황

사이즈별 수량 옵션을 하나의 로직으로 검증하기 위해 parameterized test를 작성했다.

```ts
const cases = [
  {
    size: "10온스",
    defaultQuantity: "1000",
    quantities: ["500", "1000", "2000", "3000", "4000", "5000"],
  },
];
```

테스트에서는 `defaultQuantity` 값을 이용해 현재 수량 드롭다운 버튼을 찾았다.

```ts
const quantityDropdownTrigger = page.getByRole("button", {
  name: testCase.defaultQuantity,
  exact: true,
});

await quantityDropdownTrigger.click();
```

전체 실행 결과 10온스 수량 테스트만 Chromium, Firefox, WebKit에서 모두 timeout이 발생했다.

```text
waiting for getByRole('button', { name: '1000', exact: true })

Test timeout of 30000ms exceeded.
```

---

## 2. 원인 분석

실제 서비스에서 10온스의 기본 수량은 `"500"`이었다.

하지만 parameterized test 데이터에는 다음과 같이 작성되어 있었다.

```ts
defaultQuantity: "1000"
```

따라서 테스트 실행 시 Playwright는 `"1000"`이라는 이름의 현재 수량 버튼을 찾았다.

하지만 실제 초기 상태는:

```text
사이즈: 10온스
수량: 500
```

이므로 `"1000"`이라는 이름의 현재 수량 버튼이 존재하지 않았다.

---

## 3. 왜 Timeout이 발생했는가?

Playwright의 `locator.click()`은 대상 요소가 즉시 없다고 바로 실패하지 않고, actionability 조건을 만족하는 요소가 나타날 때까지 기다린다.

즉 테스트는 다음 상태가 되었다.

```text
10온스 페이지 진입
↓
현재 수량 버튼 = 500
↓
테스트 데이터는 1000 버튼 탐색
↓
1000 버튼을 찾을 수 없음
↓
기다림
↓
Test timeout
```

문제는 Locator 문법이 아니라 **테스트 데이터와 실제 서비스 상태의 불일치**였다.

---

## 4. 개선 방향

10온스 테스트 데이터를 실제 기본값과 일치하도록 수정했다.

### 변경 전

```ts
{
  size: "10온스",
  defaultQuantity: "1000",
  quantities: ["500", "1000", "2000", "3000", "4000", "5000"],
}
```

### 변경 후

```ts
{
  size: "10온스",
  defaultQuantity: "500",
  quantities: ["500", "1000", "2000", "3000", "4000", "5000"],
}
```

---

## 5. 디버깅 시 확인 포인트

실패 결과가 특정 케이스에만 집중되어 있었다.

```text
6.5온스 → 통과
8온스   → 통과
10온스  → 실패
16온스  → 통과
```

또한 10온스가 Chromium, Firefox, WebKit에서 동일하게 실패했다.

이 패턴을 통해 브라우저 호환성 문제보다는 **10온스 케이스에만 존재하는 데이터**를 우선 확인할 수 있었다.

---

## 6. Assertion을 먼저 두는 이유

디버깅 과정에서는 다음처럼 바로 `click()`하는 것보다:

```ts
await quantityDropdownTrigger.click();
```

먼저 현재 선택값의 존재를 확인하는 방식도 도움이 된다.

```ts
await expect(quantityDropdownTrigger).toBeVisible();
await quantityDropdownTrigger.click();
```

이렇게 하면 잘못된 테스트 데이터가 들어갔을 때 어떤 요소를 찾지 못했는지 더 빠르게 확인할 수 있다.

---

## 7. 결과

`defaultQuantity` 값을 실제 서비스 상태와 일치시키자 10온스 수량 테스트도 정상적으로 다음 단계로 진행할 수 있었다.

```ts
page.getByRole("button", {
  name: "500",
  exact: true,
});
```

이후 동일한 parameterized test 구조로 6.5온스, 8온스, 10온스, 16온스의 수량 옵션을 검증할 수 있었다.

---

## 8. 배운 점

- parameterized test에서는 테스트 로직뿐 아니라 입력 데이터의 정확성이 중요하다.
- 특정 케이스만 모든 브라우저에서 동일하게 실패하면 해당 케이스의 데이터 오류를 먼저 의심할 수 있다.
- Timeout이라고 해서 반드시 로딩이나 네트워크 문제인 것은 아니다.
- Playwright가 "무엇을 기다리고 있는지" 실패 로그의 Locator를 확인하면 원인을 빠르게 좁힐 수 있다.
- 테스트 데이터는 실제 서비스에서 확인한 상태를 기준으로 작성해야 하며, 추론으로 기본값을 넣지 않는 것이 중요하다.

---

## 9. 핵심 정리

이번 문제의 핵심은 다음 문장으로 정리할 수 있다.

> **Parameterized test의 실패는 테스트 로직뿐 아니라 입력 데이터부터 확인해야 한다.**

10온스 테스트에서만 timeout이 발생했지만 원인은 브라우저나 Locator가 아니라 `defaultQuantity`를 `"1000"`으로 잘못 작성한 데이터 불일치였다.

실제 기본값인 `"500"`으로 수정하면서 같은 테스트 로직을 그대로 유지한 채 문제를 해결했다.
