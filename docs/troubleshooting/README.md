# Troubleshooting 문서

Playwright 자동화 과정에서 확인한 문제와 해결 방법을 기능별로 정리한다.

## 문서 그룹

| 그룹 | 내용 |
|---|---|
| [Cart](cart/README.md) | 로그인 상태, 장바구니 선택, 주문 금액 검증 |
| [Payment](payment/README.md) | 주문 페이지 상품, 옵션, 수량, 가격 검증 |
| [Product](product/README.md) | 상품 상세 페이지 옵션, 수량, 동적 렌더링 |
| [Category](category/README.md) | 메가메뉴와 상품 목록 탐색 |
| [Search](search/README.md) | 검색 기능과 검색 버튼 Locator |
| [Test Execution](test-execution/README.md) | 병렬 실행과 테스트 구조 |

## 대표 트러블슈팅

포트폴리오에서는 아래 문서부터 확인하는 것을 추천한다. 인증, 테스트 안정성,
Locator 설계, 비즈니스 검증, 데이터 기반 테스트 역량을 대표한다.

| 문서 | 보여주는 역량 |
|---|---|
| [소셜 로그인과 Storage State](cart/01_playwright_cart_social_login_storage_state_troubleshooting.md) | 인증 상태 재사용과 테스트 사전 조건 관리 |
| [동적 렌더링 대기](product/dynamic_rendering_wait_troubleshooting.md) | 비동기 UI의 타이밍 분석과 안정적인 대기 |
| [Locator Strict Mode 해결](product/product_option_locator_strict_mode_troubleshooting.md) | DOM 구조 분석과 안정적인 Locator 설계 |
| [장바구니 금액 검증](cart/04_playwright_cart_amount_locator_shipping_dom_troubleshooting.md) | 할인·배송비·총 금액 등 핵심 비즈니스 로직 검증 |
| [장바구니와 주문 페이지 데이터 비교](payment/06_data_driven_cart_order_refactoring.md) | 데이터 기반 반복 검증과 페이지 간 데이터 일치성 검증 |

## 문서 선택 기준

대표 문서는 다음 기준으로 선정했다.

- 서비스 핵심 흐름과 관련된 문제인가
- 원인 분석과 해결 과정이 명확한가
- 다른 테스트에도 재사용할 수 있는가
- 서로 다른 자동화 역량을 보여주는가
- 비슷한 내용의 문서를 반복하지 않는가
