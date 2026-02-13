# Product Roadmap (ROADMAP.md)

> AI-Augmented Scrum Bot 시스템의 단계별 구축 및 고도화 계획

| Status | Phase | Last Updated | Depends On |
|--------|-------|-------------|------------|
| Draft  | 0-3   | 2026-02-10  | PRD.md     |

---

## Phase 0: 기반 구축 (1주)
**목표**: Slack 메시지를 수집하고 AI로 요약하는 최소 기능(MVP) 구현

### 주요 산출물
- **Slack Bolt 앱**: Socket Mode 기반 메시지 수집 엔진
- **데이터베이스**: MySQL 8 `slack_events` 테이블 및 기본 스키마
- **LangGraph 엔진**: 요약을 위한 기본 3노드 그래프 (Ingest → Summarize → Output)
- **REST API**: NestJS 기반 기본 엔드포인트 3개 (Summaries, Summarize Trigger, Health)
- **프론트엔드**: 1페이지 대시보드 (최근 요약 목록 표시)
- **인프라**: Docker + docker-compose 로컬 환경 및 `scrum-bot.a-jon.org` 배포

### 성공 기준
- Slack 메시지 수집 성공률 99% 이상 유지
- `/scrum-summarize` 명령 응답 시간(P95) 30초 이내
- 대시보드에서 실시간으로 생성된 요약 확인 가능

---

## Phase 1: 자동화 및 흐름 제어 (2주)
**목표**: 결정 사항 감지, Jira 초안 생성 및 인간 승인(HITL) 플로우 구축

### 주요 산출물
- **결정 감지 엔진**: 키워드 및 리액션 기반 다중 신호 감지 로직
- **Draft 관리**: `drafts`, `jira_sync_log` 테이블 구현
- **관리 API/UI**: Draft CRUD API 및 상세 편집/승인 인터페이스
- **Slack Interaction**: Slack 내 승인/거절 카드(Block Kit) 발송 및 처리
- **Jira 연동**: Jira API 연동을 통한 티켓 생성 기능 (Create 전용)
- **상태 보존**: LangGraph 체크포인트 영속화 및 HITL Interrupt 구현

---

## Phase 2: 멀티에이전트 고도화 (4주)
**목표**: 다각도 리뷰 에이전트 도입 및 지식베이스 기반의 의사결정 추적

### 주요 산출물
- **멀티에이전트**: Biz, QA, Design, ScrumMaster 전문 에이전트 노드 구축
- **지식베이스**: 벡터 검색 기반 `context_chunk` 테이블 연동
- **결정 이력 관리**: `decision` 테이블 기반 결정 추적 및 대체(Superseded) 관계 정립
- **Jira 심화 연동**: 티켓 수정/전환(Update/Transition) 및 Jira Webhook 기반 Slack 알림
- **충돌 감지**: `conflict_detect` 노드를 통한 기획/결정 간 상충 자동 발견
- **고급 UI**: 결정 카드 시각화, 실행 타임라인(SSE), 세부 정책 설정 페이지

---

## Phase 3: 운영 성숙 및 최적화 (지속)
**목표**: 시스템 관측성 확보, 품질 평가 자동화 및 비용 최적화

### 주요 산출물
- **관측성**: OTel(OpenTelemetry) 기반 전 과정 트레이싱 및 모니터링
- **비용 관리**: Run별 토큰 사용량 및 비용 추적 시스템
- **품질 평가**: 골든셋 데이터 기반의 회귀 테스트 및 AI 품질 점수화
- **보안 고도화**: Jira OAuth 2.0 전환 및 RBAC(역할 기반 접근 제어) 적용
- **최적화**: 비용 초과 시 자동 하위 모델 전환(Degrade) 정책 적용

---

## Deferred (명시적 제외 범위)
- **완전 자동화**: 인간의 승인 없는 Jira 데이터 변경 (안정성 문제로 제외)
- **코드 리뷰**: 소스 코드 수준의 자동 리뷰 및 리팩토링 (추후 확장 고려)
- **회의 대체**: 대면 회의 자체를 없애는 것 (회의의 목적을 '결정'으로 축소하는 것이 목표)
- **전수 테스트**: 모든 기능에 대한 자동화 테스트 (Phase 3+에서 점진적으로 확대)

---

## Phase별 범위 요약
| Phase | 주요 키워드 | 기간 |
|-------|------------|------|
| Phase 0 | 수집 및 요약 | 1주 |
| Phase 1 | Jira Draft 및 승인 | 2주 |
| Phase 2 | 멀티에이전트 및 지식베이스 | 4주 |
| Phase 3 | 관측성 및 최적화 | 지속 |

## 관련 문서
- [PRD.md](./PRD.md) — 제품 요구사항 정의서
- [ARCHITECTURE.md](./ARCHITECTURE.md) — 시스템 구조 상세
