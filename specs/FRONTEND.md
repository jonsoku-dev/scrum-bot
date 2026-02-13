# Frontend Specification (FRONTEND.md)

> AI가 생성한 초안을 검증, 수정, 승인하기 위한 React Router v7 기반 대시보드 인터페이스

| Status | Phase | Last Updated | Depends On |
|--------|-------|-------------|------------|
| Draft  | 0-2   | 2026-02-10  | API-CONTRACTS.md, ARCHITECTURE.md |

---

## 1. 화면 목표
- AI가 만든 초안을 사람이 빠르게 검증/수정/승인할 수 있게 한다.
- “왜 이 초안이 나왔는지”를 출처(Citations)를 통해 명확히 설명하여 설명 가능성(Explainability)을 확보한다.

## 2. Phase별 라우트 설계

### Phase 0: 기반 대시보드 (1페이지)
- `/dashboard`: 채널별 최근 요약 목록 + "요약 생성" 버튼
  - **Loader**: `GET /api/summaries` 호출하여 요약 리스트 및 상태 조회
  - **Action**: `POST /api/summarize` 호출하여 수동 요약 프로세스 트리거
  - **UI**: TailwindCSS 4를 활용한 간단한 카드 리스트 형태

### Phase 1: 자동화 프로세스 (+3페이지)
- `/drafts`: 생성된 Jira Draft 리스트 및 필터 기능 (상태, 타입, 출처별)
- `/drafts/:id`: Draft 상세 편집기 (DraftEditor). 출처 링크(Citations) 연동 및 승인/거절 플로우 처리
- `/approvals`: 승인 대기 중인 항목들의 집중 처리 대기열

### Phase 2+: 고도화 및 설정 (+3페이지)
- `/decisions`: 확정된 결정 사항 카드 리스트. Superseded(대체됨) 관계를 시각화하여 결정 이력 추적
- `/runs/:runId`: LangGraph 실행 타임라인 (RunTimeline). SSE를 통해 각 노드별 처리 현황 및 로그 실시간 표시
- `/settings`: Slack/Jira 연동 상태 확인 및 시스템 운영 정책(Trigger, Weight 등) 설정

## 3. 데이터 통신 패턴
- **조회 (Read)**: React Router v7의 `loader`를 사용하여 서버 사이드에서 데이터를 사전에 가져온 후 렌더링한다.
- **변경 (Write)**: `action`을 사용하여 데이터를 변경한다. 승인(Approval) 생성 및 실행 요청은 모두 이 패턴을 따른다.
- **클라이언트 Fetch 제한**: 컴포넌트 내부에서의 무분별한 `useEffect` 기반 fetch 사용을 금지하고, React Router v7의 데이터 액션 구조로 단일화한다.

## 4. 실시간 알림 및 상태 (SSE)
Phase 1부터 적용:
- `/api/runs/:runId/stream`: LangGraph 에이전트의 실행 진행 상황을 실시간 스트리밍
- Draft 생성 프로세스 중 사용자에게 실시간 Progress Bar 제공

## 5. UX 가드레일 (UX Guardrails)
- **신뢰도 표시**: 모든 승인 버튼 옆에 "출처 X개, 신뢰도 Y%" 지표를 강제로 표시하여 사용자 판단을 돕는다.
- **승인 제한**: 출처(Source Reference)가 0개인 항목은 승인 버튼을 비활성화하고 대시보드에서의 수동 편집만 허용한다.
- **변경 내역 시각화**: 가능한 경우 기존 티켓 정보와 AI 제안서 간의 Diff(차이점)를 시각적으로 제공한다.

---

## Phase별 범위
| Phase | 이 문서에서의 범위 |
|-------|--------------------|
| Phase 0 | /dashboard 라우트 구현 및 기본 요약 리스트 표시 |
| Phase 1 | Draft 관리(/drafts, /drafts/:id) 및 승인 대기열(/approvals) 구현 |
| Phase 2 | 결정 추적(/decisions), 실행 타임라인(/runs/:runId), 설정(/settings) 구현 |

## 관련 문서
- [API-CONTRACTS.md](./API-CONTRACTS.md) — 서버-클라이언트 간 데이터 규격
- [ARCHITECTURE.md](./ARCHITECTURE.md) — 전체 시스템 구조 및 모듈 책임
