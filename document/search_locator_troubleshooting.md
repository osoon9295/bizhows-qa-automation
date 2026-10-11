# Playwright Troubleshooting: 검색 버튼 Locator 충돌

## 1. 문제 상황

비즈하우스 상품 검색 자동화에서 검색 아이콘 클릭 동작을 구현하면서 다음과 같이 Locator를 작성했다.

```ts
const searchButton = page.locator(
  'a[href^="/ko/v/search?keyword="]'
);
```

초기에는 테스트가 정상 통과했지만, 이후 WebKit 실행에서 다음과 같은 오류가 발생했다.

```text
strict mode violation:
locator('a[href^="/ko/v/search?keyword="]')
resolved to 8 elements
```

즉, Playwright가 검색 버튼 하나가 아니라 여러 개의 `<a>` 요소를 동시에 찾으면서 어떤 요소를 클릭해야 할지 결정하지 못했다.

---

## 2. 원인 분석

검색창에 `"다이어리"`를 입력하면 자동완성/추천 검색어가 노출된다.

검색 아이콘뿐 아니라 추천 검색어 링크들도 다음과 같은 URL 패턴을 사용하고 있었다.

```text
/ko/v/search?keyword=다이어리
/ko/v/search?keyword=수첩 다이어리
/ko/v/search?keyword=48절 다이어리
/ko/v/search?keyword=32절 다이어리
...
```

기존 Locator:

```css
a[href^="/ko/v/search?keyword="]
```

의 의미는 다음과 같다.

> `/ko/v/search?keyword=`로 시작하는 모든 `<a>` 요소를 찾는다.

따라서 검색 버튼뿐 아니라 자동완성 링크까지 모두 매칭되었다.

---

## 3. 왜 이전에는 테스트가 통과했는가?

처음에는 Locator가 안정적이어서 통과한 것이 아니라, 실행 타이밍상 우연히 검색 버튼 하나만 잡혔을 가능성이 있다.

예상 가능한 흐름은 다음과 같다.

```text
검색어 입력
↓
자동완성 렌더링 전
↓
검색 버튼만 Locator에 매칭
↓
click 성공
```

반면 실패한 실행에서는 다음과 같은 상황이 발생했을 수 있다.

```text
검색어 입력
↓
자동완성 렌더링 완료
↓
검색 버튼 + 추천 검색어 링크들이 DOM에 존재
↓
총 8개 요소가 Locator에 매칭
↓
strict mode violation 발생
```

따라서 단순한 WebKit 오류라기보다, 기존 Locator가 잠재적으로 너무 넓었고 브라우저별 실행 타이밍 차이로 해당 문제가 드러난 것으로 판단했다.

---

## 4. 초기 해결 시도

검색어를 Locator에 직접 포함시켜 범위를 좁혔다.

```ts
const searchButton = page.locator(
  'a[href^="/ko/v/search?keyword=다이어리"]'
);
```

이 방법으로 테스트는 통과했다.

하지만 다음과 같은 문제가 있었다.

```ts
const keyword = "다이어리";
```

검색 데이터를 나중에 다음처럼 변경하더라도:

```ts
const keyword = "스티커";
```

Locator 내부에는 `"다이어리"`가 하드코딩되어 있기 때문에 함께 수정해야 한다.

즉, 테스트 데이터와 Locator가 강하게 결합된다.

또한 `"다이어리 제작"`처럼 같은 문자열로 시작하는 자동완성 링크가 존재하면 다시 여러 요소가 매칭될 가능성도 있다.

---

## 5. 개선 방향

검색어 자체가 아니라 검색 버튼의 구조적 특징을 이용해 Locator 범위를 좁히는 방향으로 개선했다.

검색 아이콘의 DOM 구조는 다음과 같았다.

```html
<a href="/ko/v/search?keyword=...">
  <i></i>
</a>
```

따라서 다음과 같이 작성할 수 있다.

```ts
const searchButton = page
  .locator('a[href^="/ko/v/search?keyword="]')
  .filter({ has: page.locator("i") });
```

이 Locator의 의미는 다음과 같다.

```text
검색 URL 패턴을 가진 <a> 요소
+
내부에 <i> 아이콘을 가지고 있는 요소
```

즉, 단순히 검색 URL을 가진 모든 링크를 찾는 것이 아니라 검색 아이콘 역할을 하는 링크로 범위를 줄인다.

---

## 6. `.first()`를 사용하지 않은 이유

다음과 같이 첫 번째 요소를 강제로 선택하는 방법도 가능하다.

```ts
page
  .locator('a[href^="/ko/v/search?keyword="]')
  .first();
```

하지만 이 방법은:

> 여러 개가 잡히지만 첫 번째 것을 그냥 클릭한다.

는 방식에 가깝다.

DOM 순서가 변경되면 다른 요소를 클릭할 가능성이 있기 때문에, 대상 요소가 왜 검색 버튼인지 설명할 수 있는 조건을 추가하는 편이 더 안정적이라고 판단했다.

---

## 7. 결과

기존에는 자동완성 링크가 노출되는 시점에 따라 Locator가 1개 또는 여러 개의 요소를 찾을 수 있었다.

Locator를 더 구체적으로 작성함으로써 자동완성 노출 여부와 관계없이 검색 아이콘을 구분할 수 있도록 개선했다.

---

## 8. 배운 점

- 테스트가 한 번 통과했다고 해서 Locator가 안정적이라는 의미는 아니다.
- `strict mode violation`은 하나의 Locator가 여러 요소를 찾았다는 중요한 신호다.
- 자동완성과 같이 동적으로 DOM이 변경되는 UI에서는 실행 시점에 따라 Locator 매칭 결과가 달라질 수 있다.
- `.first()`로 강제로 해결하기보다 대상 요소를 고유하게 식별할 조건을 찾는 것이 좋다.
- 테스트 데이터(`keyword`)와 UI 요소 식별 방식(`searchButton`)은 가능한 한 분리하는 것이 유지보수에 유리하다.
- Cross-browser 테스트는 브라우저 호환성뿐 아니라 불안정한 Locator나 flaky test 가능성을 발견하는 데도 도움이 된다.

---

## 9. 핵심 정리

이번 문제의 핵심은 다음 문장으로 정리할 수 있다.

> **동작하는 Locator와 안정적인 Locator는 다르다.**

처음 작성한 Locator는 일부 실행에서 정상 동작했지만 자동완성 UI가 렌더링되면서 여러 요소를 함께 선택했다.

실패 로그와 DOM 구조를 분석한 뒤, 검색 버튼의 구조적 특징까지 반영하도록 Locator를 구체화하여 테스트 안정성을 개선했다.
