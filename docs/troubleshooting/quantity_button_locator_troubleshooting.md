# Playwright Troubleshooting: 수량 증감 버튼의 접근성 식별자 부족 문제

## 1. 문제 상황

비즈하우스 상품 상세 페이지의 수량 경계값 테스트에서는 입력값뿐 아니라 최솟값과 최댓값에서 `-`, `+` 버튼의 활성화 상태도 검증해야 했다.

수량 컨트롤의 DOM 구조는 다음과 같았다.

```html
<div>
  <div>
    <button disabled>
      <i ...></i>
    </button>
  </div>

  <input maxlength="5" value="1" />

  <div>
    <button cursor="pointer">
      <i ...></i>
    </button>
  </div>
</div>
```

하지만 두 버튼에는 화면에 표시되는 텍스트나 `aria-label`이 없었다.

---

## 2. 문제점 분석

버튼 자체에서 사용할 수 있는 속성은 주로 다음과 같았다.

```text
- data-f
- class
- cursor
- 내부 i 태그의 resource
```

하지만 각각 다음과 같은 문제가 있었다.

```text
data-f / class
→ 자동 생성 값일 가능성이 있음

cursor="pointer" / cursor="auto"
→ 버튼의 활성화 상태에 따라 값이 변경될 수 있음

내부 icon resource
→ UI 리소스 구현에 의존함
```

특히 이번 테스트는 버튼의 활성/비활성 상태 자체를 검증하므로 상태에 따라 변경되는 속성을 Locator로 사용하면 테스트 대상 상태와 Locator가 강하게 결합될 수 있었다.

---

## 3. 버튼 자체를 직접 특정하기 어려운 이유

이상적인 DOM이라면 다음과 같이 접근성 이름을 사용할 수 있다.

```html
<button aria-label="수량 감소"></button>
<button aria-label="수량 증가"></button>
```

그렇다면 Playwright에서 다음과 같이 작성할 수 있다.

```ts
page.getByRole("button", { name: "수량 감소" });
page.getByRole("button", { name: "수량 증가" });
```

하지만 실제 서비스의 버튼에는 접근성 이름이 없어 `getByRole("button", { name: ... })` 방식으로 구분할 수 없었다.

---

## 4. 상태 속성을 Locator로 사용하지 않은 이유

`+` 버튼이 활성화되어 있을 때는 다음과 같은 속성이 존재했다.

```html
<button cursor="pointer">
```

하지만 최댓값인 `9999`에서는 `+` 버튼이 비활성화된다.

따라서 다음과 같은 Locator를 사용하면 문제가 발생할 수 있다.

```ts
page.locator('button[cursor="pointer"]');
```

테스트가 확인하려는 상태가 바뀌는 순간 Locator 자체가 다른 버튼을 가리키거나 사라질 수 있기 때문이다.

즉, 테스트 대상의 상태를 Locator 기준으로 사용하는 것은 적합하지 않았다.

---

## 5. 개선 방향

수량 input은 이미 다음 Locator로 특정할 수 있었다.

```ts
const quantityInput = page.locator('input[maxlength="5"]');
```

수량 input과 `-`, `+` 버튼은 같은 부모 컨테이너 안에 있으므로 input을 기준점으로 사용해 수량 컨트롤 영역을 찾았다.

```ts
const quantityControl = quantityInput.locator("..");
```

그 후 수량 컨트롤 내부의 버튼만 대상으로 범위를 좁혔다.

```ts
const minusButton = quantityControl.getByRole("button").first();
const plusButton = quantityControl.getByRole("button").last();
```

이 방식은 페이지 전체의 버튼 순서가 아니라 수량 컨트롤 내부 구조만 사용한다.

---

## 6. 이전/다음 형제 선택 방식 검토

`+` 버튼은 input의 다음 형제 요소에 있으므로 CSS 인접 형제 선택자를 사용할 수도 있었다.

```ts
const plusButton = page.locator(
  'input[maxlength="5"] + div > button'
);
```

하지만 CSS에는 이전 형제를 직접 선택하는 `<`와 같은 선택자가 없다.

따라서 `-` 버튼과 `+` 버튼을 서로 다른 방식으로 찾는 것보다 두 버튼이 포함된 공통 컨테이너를 먼저 찾는 방식이 더 일관적이라고 판단했다.

```text
quantityInput
↓
부모 quantityControl
↓
내부 button 2개
↓
첫 번째 = -
마지막 = +
```

---

## 7. 자동화 시나리오 설계 반영

최종 버튼 Locator는 다음과 같이 구성했다.

```ts
const quantityControl = quantityInput.locator("..");

const minusButton = quantityControl.getByRole("button").first();
const plusButton = quantityControl.getByRole("button").last();
```

그리고 parameterized test의 예상 상태에 따라 활성화 여부를 검증했다.

```ts
if (testCase.plusEnabled) {
  await expect(plusButton).toBeEnabled();
} else {
  await expect(plusButton).toBeDisabled();
}

if (testCase.minusEnabled) {
  await expect(minusButton).toBeEnabled();
} else {
  await expect(minusButton).toBeDisabled();
}
```

경계값별 예상 상태는 다음과 같다.

```text
1     → - 비활성 / + 활성
9999  → - 활성 / + 비활성
0     → 1로 보정 후 - 비활성 / + 활성
10000 → 9999로 보정 후 - 활성 / + 비활성
```

---

## 8. 결과

초기에는 버튼 자체의 `data-f`, class, `cursor` 등을 이용해 Locator를 구성하는 방법을 검토했다.

하지만 다음과 같이 개선했다.

```text
기존 후보

버튼의 data-f / class / cursor 사용
↓
내부 구현 또는 상태 변경에 의존

개선

수량 input을 기준점으로 사용
↓
같은 부모 컨테이너로 범위 제한
↓
컨테이너 내부 button의 순서로 - / + 구분
```

이를 통해 페이지 전체 버튼 구조에 의존하지 않고 수량 컨트롤 내부에서만 `-`, `+` 버튼을 특정할 수 있었다.

---

## 9. 배운 점

- 접근성 이름이 없는 버튼은 버튼 자체보다 주변의 의미 있는 요소와 구조를 활용하는 방법을 고려할 수 있다.
- 테스트에서 검증하려는 상태에 따라 변하는 속성은 Locator 기준으로 사용하지 않는 것이 좋다.
- DOM 관계를 이용할 때는 페이지 전체가 아니라 가능한 좁은 컴포넌트 영역으로 범위를 제한하는 것이 안정적이다.
- `first()`와 `last()`도 순서 의존성이 있으므로 해당 컴포넌트의 구조가 바뀌면 재검토가 필요하다.
- 외부 서비스 자동화에서는 완벽한 접근성 식별자가 없을 때 Locator 선택의 근거와 한계를 설명할 수 있어야 한다.

---

## 10. 핵심 정리

이번 문제의 핵심은 다음과 같이 정리할 수 있다.

```text
수량 - / + 버튼에
텍스트와 aria-label 없음
↓
data-f / class / cursor 사용 검토
↓
내부 구현 및 상태 변화에 의존

수량 input을 기준점으로 사용
↓
부모 수량 컨트롤로 범위 제한
↓
첫 번째 button = -
마지막 button = +

결론
↓
직접 식별이 어려운 요소는
안정적인 주변 요소와 DOM 관계를 이용해
Locator 범위를 좁힌다.
```

> **상태를 검증하는 테스트에서는 상태에 따라 변하는 속성보다, 변하지 않는 구조적 관계를 Locator 기준으로 사용하는 것이 안전하다.**
