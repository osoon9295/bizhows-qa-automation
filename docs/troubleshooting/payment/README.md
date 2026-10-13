# Bizhows QA Automation — 장바구니 → 주문 페이지 Troubleshooting

이 문서들은 비즈하우스 QA 포트폴리오에서 장바구니 금액 검증 코드를 재사용하여 **주문 페이지 상품·옵션·수량·가격·결제 요약**을 검증하는 자동화를 개발하는 동안 나타난 이슈를 정리한 기록이다.

## 기록 범위

- **이번 대화에서 다룬 장바구니 → 주문 페이지 자동화 개발 및 리팩토링부터 기록**했다.
- 앞선 프로젝트에서 이미 작성한 종이컵 상품 상세 페이지 Locator, 동적 렌더링, Playwright 초기 환경 설정 관련 트러블슈팅은 중복해서 작성하지 않았다.
- 사용자가 제공한 오류 로그와 HTML 구조를 기준으로 작성했으며, 마지막 재실행이 확인되지 않은 수정안은 완료라고 표기하지 않았다.
- 구성 형식: **문제 상황 → 원인 분석 → 개선 방법 → 결과 → 배운 점 → 핵심 정리** (첨부된 예시 문서 참조).

## 문서 목록

| 파일                                                                                                   | 주제                                                          | 대화에서 확인된 상태                                                  |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- | --------------------------------------------------------------------- |
| [01_async_locator_navigation_troubleshooting.md](01_async_locator_navigation_troubleshooting.md)       | `Promise<string>` 타입 오류, 페이지 이동 이후 Locator Timeout | 해결 내용 확인; 초기 `ul` Timeout 세부 원인은 미확정                  |
| [02_locator_scope_and_selector_troubleshooting.md](02_locator_scope_and_selector_troubleshooting.md)   | 잘못된 `ul` 범위, CSS 속성 선택자 오류, 로그 변수 혼동        | 잘못된 선택자와 범위 원인 확인                                        |
| [03_option_order_normalization_troubleshooting.md](03_option_order_normalization_troubleshooting.md)   | 서로 다른 옵션 순서를 객체로 정규화하여 비교                  | 이후 반복문 기반 검증 동작 확인                                       |
| [04_dynamic_quantity_validation_troubleshooting.md](04_dynamic_quantity_validation_troubleshooting.md) | 상품별 수량 input 유무, `Number.isInteger()` 논리식 오류      | 오류 원인/코드 수정 확인; 입력창 없는 상품의 기대 수량 근거 추가 필요 |
| [05_price_dom_locator_troubleshooting.md](05_price_dom_locator_troubleshooting.md)                     | 할인 가격 형제 관계, 결제 요약의 `<summary>` 구조             | DOM 분석 및 수정안 제시; 최종 재실행 결과 미확인                      |
| [06_data_driven_cart_order_refactoring.md](06_data_driven_cart_order_refactoring.md)                   | 상품별 코드 중복 제거, `cartItems` 데이터 기반 반복 검증      | 사용자 테스트 동작 확인; 범용성 제약 존재                             |

## 포트폴리오 활용 시 유의점

- **테스트 코드 오류와 서비스 결함을 구분**한다. 이 기록은 대부분 자동화 코드의 Locator·타입·검증식 설계 문제를 해결한 과정이다.
- 서비스 규칙이 확인되지 않은 `quantity === null → 1` 가정은 확정된 기대결과로 소개하지 않는다.
- 가격 합계 관련 수정 이후에는 실행 환경·브라우저와 실제 Pass/Fail 결과를 별도로 덧붙인다.
- 상품명 중복, 선택 상품 개수 변경, 운영 데이터 의존성 등은 향후 개선 대상으로 관리한다.
