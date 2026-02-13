# AI-Augmented Scrum Bot: Speckit Index

> 모든 스펙 문서의 마스터 인덱스. 문서 상태 추적 및 관리 정책을 포함한다.

---

## SSOT (Single Source of Truth) 규칙

1. **문서 = 코드와 동일한 변경 프로세스**: 문서 수정은 PR + 리뷰를 거친다.
2. **스키마/계약은 코드로도 존재**: Zod 스키마, 정책 JSON은 문서와 코드 양쪽에 존재해야 한다.
3. **AI 출력 != 문서**: AI가 생성한 초안은 인간 승인 후에만 문서/티켓으로 승격된다.
4. **Phase 태그 필수**: 모든 요구사항은 Phase(0/1/2/3)가 명시되어야 한다.

---

## 문서 목록

| # | 문서 | 설명 | Phase | Status |
|---|------|------|-------|--------|
| 1 | [PRD.md](./PRD.md) | 문제 정의, 목표, KPI, 페르소나, 유즈케이스, 로드맵 | 0-3 | Draft |
| 2 | [ARCHITECTURE.md](./ARCHITECTURE.md) | 기술 스택, 프로젝트 구조, NestJS 모듈, 단방향 파이프라인, 보안 | 0-1 | Draft |
| 3 | [DATA-MODEL.md](./DATA-MODEL.md) | DB 스키마 (Phase별 점진적), 데이터 정책, 신뢰도/최신성 규칙 | 0-2 | Draft |
| 4 | [SLACK-BOLT.md](./SLACK-BOLT.md) | Slack Bolt SDK 연동, 이벤트/액션/커맨드 핸들러, 결정 감지 | 0-1 | Draft |
| 5 | [JIRA.md](./JIRA.md) | Jira REST API 연동, Canonical Draft, ADF 변환, 멱등성 | 1-2 | Draft |
| 6 | [API-CONTRACTS.md](./API-CONTRACTS.md) | REST API 엔드포인트, Zod 스키마, 요청/응답 계약 | 0-2 | Draft |
| 7 | [AI-ORCHESTRATION.md](./AI-ORCHESTRATION.md) | LangGraph.js 그래프 설계, 상태 스키마, 체크포인팅, 실패 정책 | 0-3 | Draft |
| 8 | [AGENT-PROMPTS.md](./AGENT-PROMPTS.md) | 공통 프롬프트 규칙, Phase 0 요약 프롬프트, Phase 2+ 전문 에이전트 | 0-2 | Draft |
| 9 | [FRONTEND.md](./FRONTEND.md) | React Router v7 라우트, Loader/Action, SSE, UX 가드레일 | 0-2 | Draft |
| 10 | [DEPLOYMENT.md](./DEPLOYMENT.md) | Docker, docker-compose, Cloudflare Tunnel, 환경변수, 장애 대응 | 0 | Draft |
| 11 | [ROADMAP.md](./ROADMAP.md) | Phase 0-3 상세 산출물, 성공 기준, Deferred 항목 | 0-3 | Draft |

---

## 문서 의존성 그래프

```
PRD.md (최상위 — 모든 문서의 근거)
  ├── ARCHITECTURE.md (기술적 구조)
  │     ├── DATA-MODEL.md
  │     ├── SLACK-BOLT.md
  │     ├── JIRA.md (Phase 1+)
  │     ├── API-CONTRACTS.md
  │     └── DEPLOYMENT.md
  ├── AI-ORCHESTRATION.md (AI 워크플로우)
  │     └── AGENT-PROMPTS.md
  ├── FRONTEND.md (대시보드)
  └── ROADMAP.md (실행 계획)
```

---

## Phase별 문서 읽기 가이드

### Phase 0 구현 시 필수 문서 (1주)
1. PRD.md — UC-00, Phase 0 KPI 확인
2. ARCHITECTURE.md — 프로젝트 구조, 모듈 설계
3. DATA-MODEL.md — slack_events 테이블 (1개)
4. SLACK-BOLT.md — Socket Mode 설정, @Message 핸들러, /scrum-summarize
5. API-CONTRACTS.md — Phase 0 엔드포인트 3개
6. AI-ORCHESTRATION.md — 3노드 선형 그래프
7. AGENT-PROMPTS.md — Phase 0 통합 요약 프롬프트
8. DEPLOYMENT.md — Docker + Cloudflare Tunnel

### Phase 1 구현 시 추가 문서 (2주)
- DATA-MODEL.md — drafts, jira_sync_log 테이블
- SLACK-BOLT.md — Block Kit 승인 플로우, 결정 감지
- JIRA.md — API Token 연동, Canonical Draft
- API-CONTRACTS.md — Phase 1 엔드포인트
- FRONTEND.md — /drafts, /drafts/:id, /approvals

### Phase 2+ 구현 시 추가 문서 (4주+)
- AI-ORCHESTRATION.md — 멀티에이전트 노드, conflict_detect
- AGENT-PROMPTS.md — Biz/QA/Design/ScrumMaster 에이전트
- DATA-MODEL.md — context_chunk, decision, agent_run
- FRONTEND.md — /decisions, /runs/:runId, /settings

---

## 문서 관리 절차

### 문서 수정 시
1. 해당 문서의 `Status`를 `Revision`으로 변경
2. `Last Updated` 날짜 갱신
3. 변경 사유를 PR description에 기록
4. 관련 코드 변경이 있으면 동일 PR에 포함

### 상태 정의
| Status | 의미 |
|--------|------|
| Draft | 초안 작성 완료, 리뷰 대기 |
| Reviewed | 리뷰 완료, 구현 가능 |
| Revision | 수정 중 |
| Final | 해당 Phase 구현 완료, 변경 시 PR 필수 |
| Deprecated | 더 이상 유효하지 않음 (superseded 문서 명시) |

---

## 원본 참조

이 speckit은 [spec.md](../spec.md) (694줄)를 기반으로 재구성되었다.
원본은 "최종 상태 비전 문서"로 보존하며, 구현은 이 speckit을 따른다.

### 원본 대비 주요 변경

| 항목 | 원본 (spec.md) | 변경 (speckit) | 이유 |
|------|---------------|---------------|------|
| Slack 연동 | Raw Events API + 수동 서명 검증 | Slack Bolt SDK + nestjs-slack-bolt | 중복 구현 제거, 로컬 개발 편의 |
| 프로젝트 구조 | Nx monorepo (6 packages) | pnpm workspace (2 apps) | 단순성 |
| NestJS 모듈 | 7개 모듈 | 3개 모듈 + Shared | 단순성 |
| DB 테이블 | 9개 (Phase 0부터 전부) | 1 → 3 → 7 (점진적) | 조기 추상화 방지 |
| LangGraph | 11노드 (Phase 0부터) | 3 → 4 → 7 → 11 (점진적) | 복잡도 관리 |
| 보안/RBAC | 독립 문서 | ARCHITECTURE.md 인라인 | Phase 0에서 불필요 |
| 관측가능성 | 독립 문서 | ROADMAP.md에서 언급 | Phase 3 스코프 |
| 테스트 전략 | 독립 문서 | ROADMAP.md에서 언급 | Phase 1+ 스코프 |
