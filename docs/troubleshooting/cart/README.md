# Bizhows QA: Cart Amount Playwright Troubleshooting

장바구니 주문금액 자동화(`cart-amount.spec.ts`) 작업에서 다룬 문제를 주제별로 정리했다.

## 포함 범위

기존에 별도 문서로 요청했던 **상품 옵션/수량 테스트**, **동적 렌더링 대기**, **병렬 Workers 실행** 관련 트러블슈팅은 중복하지 않았다. 이번 문서는 이후 장바구니 로그인·팝업·체크박스·금액 검증·코드 구성 과정에 해당한다.

## 문서 목록

| 파일 | 주제 | 구분 |
|---|---|---|
| [01 소셜 로그인/Storage State](01_playwright_cart_social_login_storage_state_troubleshooting.md) | 인증 사전조건 재사용 및 세션 만료 | 환경·사전조건 관리 |
| [02 팝업 간헐적 Timeout](02_playwright_cart_popup_timing_flaky_troubleshooting.md) | `isVisible()` → `addLocatorHandler()` | 실제 간헐 실패 |
| [03 체크박스 Strict Mode](03_playwright_cart_checkbox_strict_mode_dynamic_label_troubleshooting.md) | 숨김 input, 클릭 label, 중복/변경 텍스트 | 실제 오류 |
| [04 금액 Locator와 배송비 DOM](04_playwright_cart_amount_locator_shipping_dom_troubleshooting.md) | 항목명 중복, 공백, 상태별 DOM, `or()` | 실제 오류 |
| [05 동적 기대값 계산](05_playwright_cart_dynamic_expected_amount_troubleshooting.md) | `parsePrice`, 할인액·총금액 공식, 배송비 정책 범위 | 설계 개선 |
| [06 Step 변수 재사용](06_playwright_cart_test_step_scope_reuse_troubleshooting.md) | 블록 스코프, 공통 데이터, 데이터 사전조건 | 구조 개선 |

## 작성 기준

- 첨부된 예시 문서의 **1. 문제 상황 ~ 10. 핵심 정리** 구성 유지
- 관찰/로그로 확인된 문제와 코드 리뷰에서 선제적으로 개선한 사항 구분
- 제품 결함으로 확정되지 않은 문제를 **서비스 결함으로 표기하지 않음**
- `6회 반복 성공` 등 관찰 범위를 넘는 안정성 보장 표현 사용하지 않음
- 인증 파일(`playwright/.auth/user.json`) 원본을 포함하지 않음
