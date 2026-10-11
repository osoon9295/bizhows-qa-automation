# Playwright Troubleshooting: 수량 입력 필드의 의미 기반 Locator 부족 문제

## 1. 문제 상황

비즈하우스 상품 상세 페이지에서 상품 수량 경계값을 자동화하기 위해 수량 입력 필드를 특정해야 했다.

수량 영역의 DOM은 다음과 같았다.

```html
<input maxlength="5" data-f="QI-af4e" class="css-1lmqoh7" value="1" />
```

처음에는 Playwright 권장 방식에 맞게 `getByRole("textbox")`를 이용해 수량 입력 필드를 찾으려고 했다.

예:

```ts
page.getByRole("textbox");
```

하지만 상세 페이지에는 헤더의 검색창도 textbox로 인식되어 수량 입력 필드만 고유하게 특정할 수 없었다.

---

## 2. 문제점 분석

수량 입력 필드에는 다음과 같은 의미 기반 식별자가 없었다.

```text
- label
- aria-label
- name
- placeholder
- data-testid
```

DOM에는 `data-f`, `class`, `maxlength`가 있었지만 각각 다음과 같은 고민이 있었다.

```text
data-f="QI-af4e"
→ 자동 생성 값일 가능성이 있어 변경에 취약할 수 있음

class="css-1lmqoh7"
→ CSS-in-JS에서 생성된 클래스처럼 보여 안정성이 낮음

maxlength="5"
→ 수량이라는 의미를 직접 표현하지는 않지만 기능적인 HTML 속성임
```

따라서 단순히 동작하는 Locator가 아니라 운영 서비스에서 상대적으로 변경 가능성이 낮은 Locator를 선택할 필요가 있었다.

---

## 3. `getByRole("textbox")`만 사용하기 어려운 이유

다음 코드는 접근성 기반 Locator라는 장점이 있다.

```ts
const textboxes = page.getByRole("textbox");
```

하지만 이 페이지에서는 헤더 검색창과 수량 입력 필드가 모두 textbox로 인식되었다.

즉, 테스트 목적은:

```text
페이지에 textbox가 존재하는가?
```

가 아니라:

```text
상품 수량 입력 필드를 특정할 수 있는가?
```

였다.

`nth()`를 사용해 두 번째 textbox를 선택하는 방법도 가능하지만, 페이지에 다른 textbox가 추가되면 순서가 변경될 수 있어 사용하지 않기로 했다.

---

## 4. 자동 생성 속성 사용 여부 검토

다음과 같은 Locator도 기술적으로는 사용할 수 있었다.

```ts
page.locator('[data-f="QI-af4e"]');
```

또는:

```ts
page.locator('.css-1lmqoh7');
```

하지만 `data-f`와 CSS class는 서비스 내부 구현이나 빌드 과정에서 변경될 가능성이 있다고 판단했다.

특히 이번 포트폴리오는 운영 중인 외부 서비스를 대상으로 하므로 개발팀에 `data-testid` 추가를 요청할 수 없었다.

따라서 현재 DOM에서 확인할 수 있는 속성 중 기능과 관련된 속성을 우선 검토했다.

---

## 5. 개선 방향

수량 입력 필드에 존재하는 `maxlength="5"` 속성을 사용했다.

```ts
const quantityInput = page.locator('input[maxlength="5"]');
```

그리고 해당 Locator가 수량 입력 필드를 정상적으로 가리키는지 확인하기 위해 가시성 Assertion을 추가했다.

```ts
await expect(quantityInput).toBeVisible();
```

필요한 경우 다음과 같이 현재 페이지에서 Locator가 하나만 존재하는지도 확인할 수 있다.

```ts
await expect(quantityInput).toHaveCount(1);
```

`maxlength`가 수량이라는 의미를 직접 표현하는 최적의 식별자는 아니지만, 현재 페이지에서는 자동 생성 가능성이 높은 속성보다 상대적으로 설명 가능한 선택이라고 판단했다.

---

## 6. 다른 방법을 사용하지 않은 이유

### 1. `getByRole("textbox").nth(1)`

```ts
page.getByRole("textbox").nth(1);
```

현재 DOM 순서에 의존하기 때문에 다른 textbox가 추가되면 잘못된 요소를 선택할 가능성이 있다.

### 2. 검색창을 제외한 input 선택

```ts
page.locator('input:not([placeholder="업종 또는 상품으로 검색해보세요!"])');
```

이 방식은 "수량 입력 필드"가 아니라 "검색창이 아닌 input"을 의미하므로 테스트 목적과 직접 연결되지 않는다.

### 3. 생성 class 또는 `data-f`

```ts
page.locator('[data-f="QI-af4e"]');
page.locator('.css-1lmqoh7');
```

현재는 동작하더라도 내부 구현 변경에 더 민감할 수 있다고 판단했다.

---

## 7. 자동화 시나리오 설계 반영

최종적으로 수량 입력 필드는 다음과 같이 정의했다.

```ts
const quantityInput = page.locator('input[maxlength="5"]');
```

수량 경계값은 parameterized test의 데이터로 관리했다.

```ts
const cases = [
  { quantity: "1", expectedValue: "1" },
  { quantity: "9999", expectedValue: "9999" },
  { quantity: "0", expectedValue: "1" },
  { quantity: "10000", expectedValue: "9999" },
];
```

입력 후에는 input의 텍스트가 아니라 value를 검증했다.

```ts
await quantityInput.fill(testCase.quantity);
await expect(quantityInput).toHaveValue(testCase.expectedValue);
```

---

## 8. 결과

초기에는 접근성 기반 Locator인 `getByRole("textbox")`를 사용하려 했지만, 헤더 검색창과 수량 입력 필드를 구분할 수 없었다.

따라서 다음과 같이 개선했다.

```text
기존

getByRole("textbox")
↓
검색창과 수량 입력 필드가 함께 선택됨

개선

input[maxlength="5"]
↓
수량 입력 필드 직접 선택
↓
가시성 및 고유성 확인
```

이를 통해 자동 생성 가능성이 높은 class와 `data-f`에 직접 의존하지 않고 수량 입력 필드를 특정할 수 있었다.

---

## 9. 배운 점

- Playwright의 role 기반 Locator가 항상 가장 좋은 답은 아니며, 페이지의 접근성 정보가 부족하면 다른 기준이 필요하다.
- Locator는 단순히 현재 동작하는 것보다 테스트 대상의 의미와 변경 가능성을 함께 고려해야 한다.
- `nth()`처럼 DOM 순서에 의존하는 방법은 가능하면 피하는 것이 좋다.
- 외부 운영 서비스에서는 `data-testid`를 직접 추가할 수 없으므로 주어진 DOM 안에서 가장 설명 가능한 Locator를 선택해야 한다.
- 완벽한 Locator가 없는 경우 선택 이유와 한계를 명확히 설명할 수 있는 것이 중요하다.

---

## 10. 핵심 정리

이번 문제의 핵심은 다음과 같이 정리할 수 있다.

```text
수량 input에 의미 기반 식별자 없음
↓
getByRole("textbox") 사용 검토
↓
헤더 검색창과 중복

자동 생성 가능성이 있는
class / data-f 사용은 지양
↓
기능 속성 maxlength="5" 사용
↓
수량 input을 직접 특정

결론
↓
완벽한 Locator가 없는 환경에서는
변경 가능성과 테스트 목적을 비교해
가장 설명 가능한 Locator를 선택
```

> **Locator 선택은 "동작하는 선택자"를 찾는 것이 아니라, 테스트 목적을 유지하면서 변경 가능성을 최소화하는 과정이다.**
