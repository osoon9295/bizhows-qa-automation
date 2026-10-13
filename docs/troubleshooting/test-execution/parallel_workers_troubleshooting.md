# Playwright Troubleshooting: 병렬 실행 시 검색 결과 렌더링 실패

## 1. 문제 상황

비즈하우스 상품 검색 테스트를 기본 설정으로 실행했을 때 일부 테스트가 실패했다.

```bash
npx playwright test
```

실행 결과:

```text
Running 9 tests using 4 workers
```

검색 동작 자체는 정상적으로 수행되었고 URL의 `keyword` 값도 기대한 값으로 변경되었지만, 검색 결과 개수 문구를 찾는 Assertion에서 실패했다.

예:

```text
Error: expect(locator).toHaveText(expected) failed

Locator: getByText(/검색된 상품 \d+개/)
Timeout: 5000ms
Error: element(s) not found
```

즉, 검색 결과 페이지 이동은 완료되었지만 `"검색된 상품 N개"` 요소가 제한 시간 내에 탐색되지 않았다.

---

## 2. 테스트 코드 자체 문제 여부 확인

먼저 특정 브라우저나 Locator 문제인지 확인하기 위해 브라우저별로 `workers=1` 조건에서 테스트를 실행했다.

### Chromium

```bash
npx playwright test tests/search/search.spec.ts --project=chromium --workers=1
```

결과:

```text
3 passed
```

headed 모드에서도 반복 실행했다.

```bash
npx playwright test tests/search/search.spec.ts --project=chromium --workers=1 --headed
```

결과:

```text
3 passed
```

### Firefox

```bash
npx playwright test tests/search/search.spec.ts --project=firefox --workers=1 --headed
```

결과:

```text
3 passed
```

### WebKit

```bash
npx playwright test tests/search/search.spec.ts --project=webkit --workers=1 --headed
```

결과:

```text
3 passed
```

세 브라우저 모두 단일 worker 환경에서는 정상 통과했다.

---

## 3. 전체 브라우저를 단일 worker로 실행

브라우저별 테스트가 모두 통과한 뒤, 세 브라우저 전체를 `workers=1`로 실행했다.

```bash
npx playwright test tests/search/search.spec.ts --workers=1
```

결과:

```text
Running 9 tests using 1 worker
9 passed
```

동일한 테스트 코드가 다음 조건에서 서로 다른 결과를 보였다.

```text
4 workers 병렬 실행
→ 일부 검색 결과 요소 탐색 실패

1 worker 직렬 실행
→ Chromium / Firefox / WebKit 전체 9개 PASS
```

---

## 4. 원인 판단

현재 확인된 결과만으로 특정 서버 정책이나 Rate Limit을 단정할 수는 없다.

다만 다음 사실은 확인할 수 있었다.

- 테스트 코드와 Locator는 단일 worker 환경에서 반복적으로 정상 동작했다.
- Chromium, Firefox, WebKit 모두 개별 실행 시 통과했다.
- 세 브라우저 전체를 단일 worker로 실행해도 9개 테스트가 모두 통과했다.
- 여러 worker를 사용한 병렬 실행에서만 검색 결과 요소가 제한 시간 내에 탐색되지 않는 현상이 발생했다.

따라서 현재 시점에서는 다음과 같이 판단했다.

> 병렬 실행 환경에서 동시 요청 또는 실행 자원 경쟁으로 인해 검색 결과 렌더링 시점이 불안정해졌을 가능성이 있으며, 테스트 코드 자체나 특정 브라우저 호환성 문제일 가능성은 낮다.

가능한 원인은 다음과 같이 추정할 수 있다.

```text
- 운영 서비스에 대한 동시 요청 증가
- 검색 API 응답 지연
- 네트워크 지연
- 로컬 PC의 CPU / 메모리 자원 경쟁
- 여러 브라우저 동시 실행에 따른 렌더링 지연
```

단, 위 항목들은 현재 로그만으로 확정된 원인은 아니다.

---

## 5. Playwright 설정 확인

기존 `playwright.config.ts`에는 다음과 같이 설정되어 있었다.

```ts
workers: process.env.CI ? 1 : undefined,
```

이 설정의 의미는 다음과 같다.

```text
CI 환경
→ workers = 1

로컬 환경
→ workers를 지정하지 않음
→ Playwright 기본 worker 설정 사용
```

따라서 로컬에서 `npx playwright test`를 실행하면 여러 worker가 사용되었다.

또한 기존 설정에는 다음 옵션도 있었다.

```ts
fullyParallel: true,
```

---

## 6. 최종 설정 변경

이번 프로젝트는 자체 테스트 서버가 아닌 실제 운영 중인 비즈하우스 서비스를 대상으로 한다.

따라서 다음 두 가지를 고려했다.

1. 운영 서비스에 과도한 동시 요청을 보내지 않기
2. 자동화 테스트 실행 안정성 확보

이에 따라 다음처럼 설정을 변경하기로 했다.

```ts
export default defineConfig({
  testDir: "./tests",

  fullyParallel: false,

  forbidOnly: !!process.env.CI,

  retries: process.env.CI ? 2 : 0,

  workers: 1,

  reporter: "html",

  use: {
    trace: "on-first-retry",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
  ],
});
```

핵심 변경 사항:

```ts
fullyParallel: false,
workers: 1,
```

---

## 7. 왜 `workers: 1`을 선택했는가

단순히 테스트 실패를 피하기 위해 설정한 것은 아니다.

이번 프로젝트의 자동화 전략에서 다음 항목을 고려했다.

```text
- 운영 서비스 영향
- 실행 안정성
- 반복 실행 가능성
```

병렬 실행 시 간헐적으로 검색 결과 요소 탐색이 실패했지만, 단일 worker 환경에서는 세 브라우저에서 반복적으로 정상 통과했다.

또한 테스트 대상이 실제 운영 서비스이므로 불필요하게 많은 동시 요청을 발생시키지 않는 것이 적절하다고 판단했다.

따라서 현재 포트폴리오 자동화 범위에서는 `workers: 1`이 더 적합하다고 결정했다.

---

## 8. 포트폴리오 설명 예시

> 테스트 대상이 별도의 QA 환경이 아닌 실제 운영 서비스이므로 운영 서비스에 대한 동시 요청을 최소화하고 실행 안정성을 확보하기 위해 `workers: 1`로 설정하였다. 병렬 실행 환경에서는 검색 결과 렌더링 요소가 제한 시간 내 탐색되지 않는 간헐적 실패가 발생했으나, 동일한 테스트를 단일 worker로 Chromium, Firefox, WebKit에서 실행한 결과 총 9개 테스트가 모두 정상 통과함을 확인하였다.

---

## 9. 배운 점

- 자동화 테스트 실패가 항상 기능 결함이나 Locator 문제를 의미하는 것은 아니다.
- 동일 테스트를 브라우저별, worker 수별로 나누어 실행하면 원인 범위를 좁힐 수 있다.
- Cross-browser 테스트가 모두 통과하더라도 병렬 실행 환경에서는 별도의 안정성 문제가 발생할 수 있다.
- 운영 서비스를 대상으로 자동화할 때는 실행 속도뿐 아니라 서비스 영향도 함께 고려해야 한다.
- `workers`와 `fullyParallel` 설정은 프로젝트 특성에 맞게 의도적으로 선택해야 한다.
- 테스트 환경과 실행 전략도 자동화 품질의 일부다.

---

## 10. 핵심 정리

이번 문제는 다음과 같이 정리할 수 있다.

```text
병렬 실행
→ 검색 결과 요소 탐색 실패

브라우저별 단일 worker 실행
→ 모두 PASS

전체 브라우저 단일 worker 실행
→ 9/9 PASS

결론
→ 현재 프로젝트에서는 workers: 1을 사용해
   운영 서비스 영향과 실행 안정성을 우선한다.
```

> **자동화 테스트의 안정성은 테스트 코드뿐 아니라 실행 환경과 병렬화 전략에도 영향을 받는다.**
