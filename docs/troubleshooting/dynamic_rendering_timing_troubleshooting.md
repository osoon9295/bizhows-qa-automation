# Playwright Troubleshooting: 동적 렌더링 타이밍으로 인한 Locator Count 불일치

## 1. 문제 상황

비즈하우스 종이컵 상품 상세 페이지에서 사이즈 옵션 Locator가 하나만 잡히는지 확인하기 위해 다음과 같이 `count()`를 출력했다.

```ts
const sizeRow = page.getByText("사이즈10온스", {
  exact: true,
});

const sizeBox = sizeRow.getByText("10온스", {
  exact: true,
});

console.log(await sizeRow.count());
console.log(await sizeBox.count());
```

동일한 테스트를 Chromium, Firefox, WebKit에서 실행했지만 브라우저 및 실행 시점에 따라 결과가 달랐다.

```text
[chromium] 10온스 수량 옵션 확인
1
1

[chromium] 16온스 수량 옵션 확인
0
0

[firefox] 10온스 수량 옵션 확인
1
1

[firefox] 16온스 수량 옵션 확인
1
1

[webkit] 10온스 수량 옵션 확인
1
1

[webkit] 16온스 수량 옵션 확인
0
0
```

두 테스트 모두 같은 초기 페이지와 같은 `"사이즈10온스"` Locator를 사용하고 있었기 때문에, 테스트 데이터 자체의 차이로 보기 어려웠다.

---

## 2. 원인 분석

테스트는 페이지 진입 직후 바로 Locator 개수를 조회하고 있었다.

```ts
await page.goto("상품 상세 페이지 URL");

const sizeRow = page.getByText("사이즈10온스", {
  exact: true,
});

console.log(await sizeRow.count());
```

`page.goto()`가 완료되었다고 해서 상품 상세 페이지의 모든 동적 UI가 반드시 렌더링을 끝낸 상태라는 의미는 아니다.

페이지 문서 로딩 이후에도 옵션 영역이 클라이언트에서 추가로 렌더링될 수 있다.

따라서 다음과 같은 실행 순서가 발생했을 가능성이 있다고 판단했다.

```text
page.goto() 완료
↓
옵션 UI 렌더링 진행 중
↓
count() 실행
↓
아직 요소가 없음
↓
0 반환
↓
조금 뒤 "사이즈10온스" 렌더링
```

브라우저마다 실행 및 렌더링 속도가 다르기 때문에 동일한 코드에서도 특정 실행에서는 `1`, 다른 실행에서는 `0`이 반환된 것으로 보였다.

---

## 3. 왜 `count()`는 0을 반환했는가?

Playwright Locator는 요소를 찾는 표현식 자체를 저장하고 있지만, `count()`는 해당 시점에 매칭되는 요소 개수를 조회한다.

즉 다음 코드는:

```ts
await sizeRow.count();
```

다음 의미에 가깝다.

> 현재 이 Locator와 매칭되는 요소가 몇 개인가?

원하는 요소가 아직 렌더링되지 않았다면 바로 `0`이 반환될 수 있다.

반면 Playwright의 web-first assertion은 조건이 만족될 때까지 일정 시간 재시도한다.

예를 들어:

```ts
await expect(sizeRow).toBeVisible();
```

은 다음과 같이 동작한다.

```text
요소 확인
↓
아직 보이지 않음
↓
다시 확인
↓
요소 렌더링
↓
visible 조건 만족
↓
다음 코드 진행
```

따라서 단순 조회와 assertion의 동작 차이가 테스트 결과에 영향을 줄 수 있었다.

---

## 4. 왜 브라우저마다 결과가 달랐는가?

초기 실행 결과는 다음과 같았다.

```text
Chromium → 일부 실행에서 0
Firefox  → 1
WebKit   → 일부 실행에서 0
```

하지만 Locator와 테스트 로직은 동일했다.

따라서 특정 브라우저의 DOM 구조 문제라기보다, 각 브라우저의 페이지 렌더링 속도 및 테스트 실행 타이밍 차이로 잠재적인 동기화 문제가 드러난 것으로 판단했다.

즉:

```text
브라우저 A
옵션 렌더링 완료
↓
count()
↓
1
```

반면:

```text
브라우저 B
옵션 렌더링 전
↓
count()
↓
0
```

과 같은 차이가 발생할 수 있었다.

Cross-browser 실행을 하지 않았다면 해당 문제가 쉽게 드러나지 않았을 가능성도 있다.

---

## 5. 개선 방향

Locator 개수를 바로 조회하기 전에 실제 테스트에서 필요한 상태인 `"요소가 화면에 표시됨"`을 먼저 기다리도록 변경했다.

```ts
const sizeRow = page.getByText("사이즈10온스", {
  exact: true,
});

await expect(sizeRow).toBeVisible();

console.log(await sizeRow.count());

const sizeBox = sizeRow.getByText("10온스", {
  exact: true,
});

await expect(sizeBox).toBeVisible();

console.log(await sizeBox.count());
```

즉 실행 순서를 다음과 같이 변경했다.

```text
페이지 진입
↓
사이즈 옵션 행이 표시될 때까지 기다림
↓
count() 확인
↓
10온스 값이 표시될 때까지 기다림
↓
count() 확인
```

테스트에서 단순한 시간 지연을 추가하지 않고, 실제로 필요한 UI 상태를 기준으로 대기했다.

---

## 6. `waitForTimeout()` 대신 Assertion을 사용한 이유

동기화 문제를 해결하기 위해 다음처럼 고정 시간을 기다리는 방법도 생각할 수 있다.

```ts
await page.waitForTimeout(2000);
```

하지만 이 방법은 실제 렌더링 완료 여부와 관계없이 항상 2초를 기다린다.

```text
500ms 만에 렌더링 완료 → 불필요하게 1.5초 추가 대기
3초 후 렌더링 완료 → 2초를 기다려도 실패
```

반면:

```ts
await expect(sizeRow).toBeVisible();
```

은 실제 UI 상태가 만족되면 바로 다음 단계로 진행하고, 아직 준비되지 않았다면 제한 시간 동안 재시도한다.

따라서 고정 sleep보다 테스트 의도가 명확하고 실행 환경에 따른 속도 차이에도 더 유연하다고 판단했다.

---

## 7. 결과

`toBeVisible()`을 먼저 실행하도록 변경한 뒤 Chromium, Firefox, WebKit에서 `sizeRow`와 `sizeBox`가 모두 동일하게 하나씩 탐색되었다.

```text
1
1
```

브라우저별로 발생하던 `0 / 1` 결과 차이가 사라졌고 이후 옵션 선택 테스트를 안정적으로 이어갈 수 있었다.

최종 테스트 코드에서는 `count()` 출력은 디버깅 용도이므로 제거하고, 필요한 UI 상태를 assertion으로 검증하는 형태를 유지했다.

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

---

## 8. 배운 점

- `page.goto()`가 완료되었다고 해서 페이지 내부의 모든 동적 UI 렌더링이 끝났다고 가정하면 안 된다.
- `locator.count()`는 해당 시점의 요소 개수를 확인하는 용도이며, 요소가 나타날 때까지 기다리는 검증이 아니다.
- 동적 UI에서는 고정 sleep보다 `toBeVisible()`과 같은 web-first assertion으로 필요한 상태를 기다리는 것이 좋다.
- 브라우저별 실행 속도 차이는 숨어 있던 동기화 문제나 flaky test 가능성을 드러낼 수 있다.
- 디버깅용 조회 코드와 실제 테스트의 assertion은 목적이 다르므로 구분해서 사용해야 한다.
- Cross-browser 테스트는 호환성 검증뿐 아니라 테스트 코드 자체의 안정성을 확인하는 데도 도움이 된다.

---

## 9. 핵심 정리

이번 문제의 핵심은 다음 문장으로 정리할 수 있다.

> **요소를 찾는 것과 요소가 준비될 때까지 기다리는 것은 다르다.**

처음에는 `page.goto()` 직후 `count()`를 호출하여 브라우저별 렌더링 속도 차이에 따라 `0` 또는 `1`이 반환되었다.

필요한 UI가 실제로 표시될 때까지 `toBeVisible()`로 기다린 뒤 다음 동작을 수행하도록 변경하여 테스트 실행을 안정화했다.
