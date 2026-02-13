Jack R <jonsoku.dev@gmail.com>
	
PM 8:46 (1분 전)
	
	
나에게
<pre>
# 2026 AI-Augmented Scrum System
작성일: 2026-02-10
문서 목적: “대화로 설계된 아이디어”를 실제 프로덕션 수준의 SSOT(단일 진실 소스)로 만들기 위한 기획서(PRD) + 상세기획서(SDD: System Detailed Design)

이 문서는 바로 Google Docs에 붙여 넣어도 되고, 그대로 레포의 /docs에 분리 저장해도 된다.


# 0. 문서 관리 정책
이 시스템이 망하는 가장 흔한 이유는 “기획은 있는데 관리가 없다”다. 문서가 코드와 분리되면 2주 안에 거짓말이 된다.

## 0.1 SSOT 규칙
- 규칙 1: “운영 정책/스키마/워크플로우”는 문서가 아니라 코드와 동일한 변경 프로세스를 탄다.
  - 문서 수정 = PR(리뷰) + 버전 태그 + 릴리즈 노트
- 규칙 2: 문서 내 모든 계약(스키마, API, 권한, 정책)은 “정적 스키마 파일”로도 존재해야 한다.
  - 예: /contracts/*.zod.ts, /policies/*.json
- 규칙 3: AI 출력은 문서가 아니다. AI 출력은 “초안(artifact)”이고, 문서/티켓/정책으로 승격되는 순간 HITL 승인이 있어야 한다.

## 0.2 레포 구조(권장)
- Nx 모노레포 기준(선호 스택 반영)
  - apps/api: NestJS
  - apps/web: React + React Router v7 + Vite
  - packages/contracts: DTO/Zod/OpenAPI 스키마
  - packages/policies: 트리거/가드레일/매핑 정책
  - packages/langgraph: 그래프 정의/노드 구현
  - packages/ui: 공통 UI 컴포넌트(TailwindCSS 4)
  - docs: 본 문서들(사람용)

## 0.3 문서 분리 파일명(구글독스/레포 공통)
- DOC-00 문서관리정책
- DOC-01 PRD(기획서)
- DOC-02 SDD-아키텍처
- DOC-03 SDD-데이터모델(ERD/스키마)
- DOC-04 SDD-Slack연동
- DOC-05 SDD-Jira연동
- DOC-06 SDD-LangGraph오케스트레이션
- DOC-07 SDD-에이전트프롬프트팩
- DOC-08 SDD-프론트엔드(RRv7)
- DOC-09 SDD-보안/RBAC/감사로그
- DOC-10 SDD-관측가능성/평가(Observability/Eval)
- DOC-11 SDD-운영/배포/런북
- DOC-12 SDD-테스트전략


# DOC-01 PRD (기획서)

## 1. 문제 정의(현재 상태의 구체적 실패 모드)
- 인력 부족: Biz/QA/Design이 상시 스크럼에 참여하지 못한다.
- 커뮤니케이션 채널 분산: Slack에서 결정/변경이 발생하지만 Jira 반영은 수작업이다.
- 2주 1회 회의의 한계: 회의 1시간으로는 “공유+검토+결정+티켓정리”를 동시에 못 한다.
- 컨텍스트 유실: “왜 이렇게 결정했는지”가 남지 않아 같은 논쟁이 반복된다.
- 책임 소재 불명확: AI가 대체 역할을 할수록 “결정 책임”이 흐려진다.

여기서 핵심은 “AI가 일을 한다”가 아니다.
핵심은 “결정과 실행 사이의 번역(대화→티켓) 비용”이 비싸고, 그 비용이 반복된다는 점이다.

## 2. 목표(반드시 숫자로 검증 가능한 목표)
- 회의 밀도 개선: 정기 회의에서 ‘정보 공유’ 비중을 낮추고 ‘의사결정’ 비중을 높인다.
- 대화→티켓 자동화: Slack/회의록 기반으로 Jira 티켓 초안을 자동 생성/수정한다.
- 비참석 역할의 검토 보강: Biz/QA/Design 관점 검토를 에이전트로 선제 수행한다.
- SSOT 확립: 결정/근거/변경 이력/티켓 상태가 하나의 흐름으로 추적 가능해야 한다.
- 안전장치: AI 환각/오판으로 인한 잘못된 실행을 구조적으로 차단한다.

## 3. 성공 지표(KPI / SLO)
- Decision Fidelity(결정 일치율): AI 요약/추출한 결정이 실제 합의와 일치하는 비율 ≥ 0.95
- Ticket Automation Rate: 신규/수정 티켓 중 “AI 초안 기반” 비율 ≥ 0.60(3개월), ≥ 0.80(6개월)
- Human Override Rate: 승인 후 재수정/롤백 비율 ≤ 0.15(목표), 단 초기에는 높아도 정상
- Meeting Density: 회의 안건 중 “결정 필요” 안건 비중 ≥ 0.70
- Latency SLO: Slack 메시지→초안 생성까지 P95 ≤ 2분(동기 즉시가 아니라도 됨)
- Cost Budget: 스프린트당 LLM 비용 상한(예: X USD) + 초과 시 자동 degrade 정책

## 4. 원칙(프로덕션에서 무너지기 쉬운 지점에 대한 강제 규칙)
- 원칙 1: AI는 의사결정자가 아니다. 실행은 기본적으로 “승인된 정책” 또는 “명시적 인간 승인(HITL)”이 있어야 한다.
- 원칙 2: 모든 AI 출력에는 출처가 있어야 한다(슬랙 퍼머링크, 티켓 키, 회의록 chunk id).
  - 출처가 없으면 “제안”까지만 가능, “수정/생성 실행” 금지.
- 원칙 3: 최신성이 가장 중요하다. 오래된 지식은 자동으로 영향력을 잃어야 한다(Temporal Decay).
- 원칙 4: 통합은 마법이 아니라 계약이다. Slack/Jira/DB/LLM 모두 명시적 스키마로 고정한다.
- 원칙 5: 무한 루프/비용 폭주를 설계로 차단한다(최대 반복, 타임아웃, fallback).

## 5. 사용자/페르소나
- 기획자(Planner): 대화/회의를 티켓으로 정리하는 비용을 줄이고 싶다.
- 개발자(Dev): 모호한 티켓을 싫어한다. 명확한 AC(acceptance criteria)가 필요하다.
- Biz 담당: 우선순위/ROI 관점에서 납득 가능한 근거가 필요하다.
- QA 담당: Edge case와 회귀 영향이 초기부터 반영되길 원한다.
- 운영자(Admin): 토큰/권한/감사 로그/정책 변경을 관리한다.

## 6. 핵심 유즈케이스(유저 스토리 + 완료 조건)
### UC-01 Slack 결정 감지 → 결정 초안 생성 → Jira 반영(승인 기반)
- 트리거: 특정 채널에서 결정 키워드 또는 리액션(예: :white_check_mark:) 발생
- 시스템: 결정 요약 + 영향 범위 + 관련 티켓 후보를 제안
- 완료 조건:
  - Slack 스레드에 “결정 카드”가 생성되고
  - 승인 버튼 클릭 시 Jira 티켓이 생성/수정되며
  - 결정/출처/티켓키가 지식베이스와 감사로그에 기록된다

### UC-02 회의록 업로드 → Action Items 추출 → 티켓 초안 생성
- 입력: 회의록 텍스트(또는 링크/파일)
- 출력: 템플릿 요약 + Jira Draft 목록(JSON) + Biz/QA/Design 리뷰
- 완료 조건: Draft가 대시보드에서 편집 가능, 승인 후 Jira 반영

### UC-03 기획안/티켓 초안 리뷰 요청 → LangGraph 멀티에이전트 리뷰 → 수정 제안
- 입력: Proposal(기획서 텍스트 or 티켓 설명)
- 출력: Biz/QA/Design 리뷰 + 충돌 시 중재안 + Jira Draft 업데이트안
- 완료 조건: 리뷰 결과가 출처 포함, “바로 실행”이 아니라 “승인 가능한 초안”으로 제공

### UC-04 Jira 상태 변경 → Slack 요약/알림
- 트리거: Jira webhook(issue updated/transition)
- 시스템: 관련 Slack 채널에 상태 변경을 게시 + 데일리 요약에 반영
- 완료 조건: 이중 알림/스팸 방지(중복 억제), 링크 포함

## 7. 범위
### In scope
- NestJS 기반 백엔드(통합/오케스트레이션/지식베이스/감사로그)
- React Router v7 대시보드(승인, 초안 편집, 실행 이력)
- Slack Events API + Interactive(버튼 승인)
- Jira REST API v3(생성/수정/전환/코멘트)
- LangGraph.js 오케스트레이션
- PostgreSQL + pgvector(임베딩 기반 검색)
- PII 마스킹 + 최소권한 + 감사로그
- 관측가능성(OTel), 품질 평가(Eval)

### Out of scope(명시적으로 제외)
- “승인 없이” AI가 Jira를 변경하는 완전 자동화
- 코드베이스 전체 자동 리뷰/리팩토링(추후 확장 가능)
- 사람 회의를 완전히 대체(회의 목적은 ‘결정’으로 축소)

## 8. 리스크(미화 금지: 실제로 터지는 것들)
- 환각: 존재하지 않는 티켓/결정을 근거로 실행하려는 시도
- 최신성 붕괴: 2주 전 결정을 현재 결정처럼 취급
- 권한 사고: Slack/Jira 토큰 유출 또는 과권한
- 스팸화: Slack 알림이 많아져 팀이 봇을 음소거
- 책임 회피: “AI가 그랬다”로 결정 책임이 분산
- 비용 폭주: 루프/재시도/대량 임베딩으로 토큰 비용 증가
- 계약 붕괴: Jira 커스텀필드/워크플로우 변경 시 자동화가 깨짐

## 9. 단계 로드맵(현실적인 순서)
- Phase 0(1주): Slack 이벤트 수집 + 단순 요약 + 대시보드에 표시(실행 없음)
- Phase 1(2~4주): 회의록/슬랙 → Jira Draft 생성 + 승인 기반 Create만
- Phase 2(4~6주): Jira Update/Transition + Jira webhook → Slack 요약
- Phase 3(6~10주): LangGraph 멀티에이전트 리뷰 + 충돌 중재 + 체크포인트
- Phase 4(지속): 평가 자동화/정책 고도화/비용 최적화


# DOC-02 SDD-아키텍처(백엔드/프론트 분해)

## 1. 기술 스택(고정)
- Backend: NestJS + TypeScript
- Orchestration: LangGraph.js
- DB: PostgreSQL + pgvector
- Frontend: React 19 + React Router v7 + TailwindCSS 4
- Realtime: SSE 우선, 필요 시 WebSocket
- Contracts: Zod 기반 런타임 검증 + OpenAPI 생성(권장)

## 2. 모듈 경계(불투명한 추상화 금지, 책임 명확화)
### 2.1 Backend(NestJS) 모듈
- IntegrationsSlackModule
  - SlackSignatureVerifier
  - SlackEventsController
  - SlackActionsController
  - SlackClient(발송/Block Kit)
- IntegrationsJiraModule
  - JiraWebhookController
  - JiraClient(REST v3)
  - JiraFieldMapper(설정 기반)
- KnowledgeBaseModule
  - ContextIngestService(정제/청킹/임베딩)
  - RetrieverService(검색/가중치/필터)
  - ConflictDetector(상충 감지)
- OrchestratorModule
  - LangGraphFactory(그래프 생성/버전)
  - NodeServices(Biz/QA/Design/ScrumMaster)
  - CheckpointStore(Postgres)
- ApprovalsModule
  - ApprovalService(HITL)
  - PolicyEngine(“승인 필요 여부” 판단)
- DashboardModule
  - RunsQueryService
  - DraftsQueryService
  - DecisionsQueryService
- ObservabilityModule
  - OTelInterceptor
  - CostMeter
  - AuditLogger

### 2.2 Frontend(React Router v7)
- Routes
  - /dashboard
  - /drafts
  - /decisions
  - /runs/:runId
  - /approvals
  - /settings/integrations
  - /settings/policies
- UI Core
  - DraftEditor(AC 편집)
  - AgentFeedbackPanel(출처/신뢰도 표시)
  - ApprovalQueue(승인/거절/수정)
  - RunTimeline(노드 전이 + 로그)
  - DecisionCards(결정/근거/영향)

## 3. 핵심 데이터 흐름(시퀀스)
### 3.1 Slack 메시지 → 결정 감지 → Draft 생성 → 승인 → Jira 생성
1) SlackEventsController 수신
2) ContextIngestService: PII 마스킹 + 저장 + 임베딩
3) Orchestrator 실행(경량 플로우): classify_intent → extract_actions → draft_jira
4) ApprovalsService: 승인 필요로 큐 적재 + Slack Block Kit 발송
5) 승인 시: JiraClient.createIssue / updateIssue
6) AuditLog 기록 + Decision/Mapping 업데이트

### 3.2 회의록 업로드 → 멀티에이전트 리뷰 → Draft 목록
1) MeetingIngest API로 텍스트 수신
2) ContextIngestService 처리
3) LangGraph 풀 플로우 실행: retrieve_context → biz → qa → design → synthesize → draft
4) 결과를 Draft 저장 + 대시보드 노출
5) 인간이 편집/승인 후 Jira 반영


# DOC-03 SDD-데이터모델(ERD/스키마)

## 1. 설계 원칙
- 원칙 1: “원문(raw)”과 “정제된 조각(chunk)”을 분리 저장한다.
- 원칙 2: AI 출력물은 반드시 run에 귀속된다(나중에 책임/추적 가능).
- 원칙 3: 실행(티켓 생성/수정)은 approval과 audit log로만 일어난다.
- 원칙 4: 임베딩/검색은 ‘도움’이고, 진실은 ‘출처 링크’다.

## 2. 테이블(초안)
### 2.1 slack_message_raw
- id (uuid, pk)
- channel_id (text)
- message_ts (text)  // Slack ts
- thread_ts (text, nullable)
- user_id (text, nullable)
- bot_id (text, nullable)
- text (text)
- permalink (text, nullable)
- raw_json (jsonb)
- ingested_at (timestamptz)

인덱스:
- (channel_id, message_ts) unique
- thread_ts

### 2.2 context_chunk
- id (uuid, pk)
- source_type (enum: SLACK_MESSAGE | MEETING_MINUTES | JIRA_ISSUE | MANUAL_DOC)
- source_id (uuid or text) // slack_message_raw.id 등
- content (text)
- content_hash (text) // 중복 방지
- embedding (vector(N)) // pgvector
- created_at (timestamptz)
- event_time (timestamptz) // 실제 발생 시각
- weight_recency (float)
- weight_confidence (float)
- tags (text[])
- pii_redacted (boolean)
- citations (jsonb) // {type, url, id}[]
인덱스:
- embedding ivfflat/hnsw(선택)
- content_hash unique
- event_time desc

### 2.3 decision
- id (uuid, pk)
- title (text)
- summary (text)
- status (enum: PROPOSED | FINAL | REVOKED | SUPERSEDED)
- effective_from (timestamptz)
- effective_to (timestamptz, nullable)
- source_refs (jsonb) // slack permalinks, meeting ids
- impact_area (text[]) // e.g., ["billing", "auth", "ui"]
- created_by (enum: HUMAN | AI)
- created_at (timestamptz)
- last_confirmed_at (timestamptz, nullable)
- superseded_by (uuid, nullable)

### 2.4 jira_issue_snapshot
- id (uuid, pk)
- jira_cloud_id (text)
- issue_key (text)
- issue_id (text)
- project_key (text)
- summary (text)
- status (text)
- priority (text)
- raw_json (jsonb)
- fetched_at (timestamptz)
인덱스:
- (jira_cloud_id, issue_key) unique

### 2.5 draft_jira_issue
- id (uuid, pk)
- created_from (enum: SLACK | MEETING | MANUAL | JIRA_DIFF)
- source_refs (jsonb)
- payload (jsonb) // Jira API에 보낼 최종 형태(또는 내부 canonical)
- human_editable_payload (jsonb) // UI 편집용 canonical
- status (enum: DRAFT | NEEDS_REVIEW | APPROVED | COMMITTED | REJECTED)
- created_at (timestamptz)
- updated_at (timestamptz)
- approved_by (uuid, nullable)
- committed_issue_key (text, nullable)

### 2.6 agent_run
- id (uuid, pk)
- run_key (text) // 외부 노출용
- graph_version (text)
- trigger_type (enum: SLACK_EVENT | MEETING_UPLOAD | MANUAL_REVIEW | SCHEDULED)
- input_refs (jsonb)
- state_start (jsonb)
- state_end (jsonb)
- status (enum: SUCCESS | FAILED | ABORTED | TIMEOUT)
- error (text, nullable)
- token_usage (jsonb) // provider별
- cost (jsonb)
- started_at (timestamptz)
- ended_at (timestamptz)

### 2.7 agent_message
- id (uuid, pk)
- run_id (uuid, fk agent_run)
- agent_name (enum: CONTEXT | BIZ | QA | DESIGN | SCRUM_MASTER)
- role (enum: SYSTEM | USER | ASSISTANT | TOOL)
- content (text)
- structured_output (jsonb, nullable)
- citations (jsonb) // 출처 목록
- created_at (timestamptz)

### 2.8 approval
- id (uuid, pk)
- approval_type (enum: JIRA_CREATE | JIRA_UPDATE | JIRA_TRANSITION)
- status (enum: PENDING | APPROVED | REJECTED | EXPIRED)
- requested_by (uuid or text)
- requested_via (enum: SLACK | DASHBOARD)
- slack_action_payload (jsonb, nullable)
- draft_id (uuid, fk draft_jira_issue)
- expires_at (timestamptz)
- decided_by (uuid, nullable)
- decided_at (timestamptz, nullable)

### 2.9 audit_log
- id (uuid, pk)
- actor_type (enum: HUMAN | AI | SYSTEM)
- actor_id (text)
- action (text) // e.g., "JIRA_CREATE", "KB_UPSERT"
- target_type (text)
- target_id (text)
- payload (jsonb)
- created_at (timestamptz)
인덱스:
- created_at desc
- actor_type, actor_id

## 3. 데이터 최신성/신뢰도 정책(실제로 중요한 부분)
- weight_recency = f(now - event_time)
- weight_confidence: 출처 종류에 따라 기본값
  - HUMAN 승인 결정: 1.0
  - Jira 티켓 확정 내용: 0.9
  - 회의록 요약(인간 검수 전): 0.7
  - Slack 메시지 단독(확정 신호 없음): 0.6
  - AI 추론만(출처 없음): 0.0(검색 대상 제외)


# DOC-04 SDD-Slack 연동

## 1. Slack 이벤트 범위
- Events API: message.channels, message.groups(필요 채널)
- Interactivity: Block Kit actions(승인/거절/수정)
- Slash commands(선택): /scrum-review, /scrum-draft

## 2. 채널 정책(스팸 방지)
- #pjt-scrum: 데일리/주간 요약만(빈도 제한)
- #pjt-discuss: 리뷰 요청/리스크 분석
- #pjt-decisions: 확정 결정만(신호 강제)
- #pjt-dev-alert: Jira 상태 변경, 배포 알림

## 3. 결정 감지 규칙(“키워드 감지”만으로는 실패한다)
키워드만 감지하면 오탐이 폭발한다. 신호를 다중화해야 한다.

### 3.1 다중 신호(AND/OR) 정책(예시)
- 확정 신호:
  - (키워드: “확정”, “결정”, “진행”, “이대로”, “배포”) AND (리액션: ✅ 또는 :white_check_mark:)
  - 또는 “결정 카드 생성” 버튼 클릭
- 변경 신호:
  - (키워드: “변경”, “수정”, “롤백”, “우선순위”) AND (thread 내 합의 2명 이상)
- 티켓 신호:
  - (키워드: “티켓”, “Jira”, “등록”) OR (/scrum-draft 명령)

## 4. Slack Block Kit(필수 UI)
- Decision Card
  - 결정 요약
  - 영향 범위(태그)
  - 관련 티켓 후보
  - 버튼: [Jira Draft 생성] [결정으로 기록] [무시]
- Approval Card
  - Draft 요약 + 변경 diff(가능하면)
  - 버튼: [승인] [거절] [편집 후 승인(대시보드 링크)]

## 5. 서명 검증/재시도/멱등성
- Slack 요청은 반드시 서명 검증
- 재전송 대비 idempotency key:
  - slack event_id 또는 (channel_id + message_ts) 기반 처리 로그 저장
- Rate limit 대응: 큐잉(BullMQ 등) + 백오프


# DOC-05 SDD-Jira 연동

## 1. 인증 선택(현실적인 선택지)
- 선택 A: Atlassian OAuth 2.0(권장, 운영 난이도 높음, 안전)
- 선택 B: API Token(PAT) + 봇 계정(구현 쉬움, 유출 리스크 큼)

프로덕션 기준이면 A가 맞다. B는 MVP까지는 가능하지만, 장기 운영에서 사고 확률이 높다.

## 2. 내부 Canonical 스키마(중요: Jira 변경에도 내부는 유지)
Jira 필드/커스텀필드가 바뀌면 매핑만 바뀌게 해야 한다.

CanonicalDraft:
- projectKey
- issueType
- summary
- descriptionMd (내부는 md 또는 구조화 텍스트)
- acceptanceCriteria (string[])
- priority (P0~P3)
- labels (string[])
- components (string[])
- dueDate (YYYY-MM-DD, optional)
- links (related issues)
- sourceCitations (Slack/Jira/Meeting refs)

## 3. Jira ADF 변환
Jira Cloud는 description이 ADF를 요구한다.
- 내부 descriptionMd를 ADF로 변환하는 유틸 필요(명시적으로 모듈화)

## 4. 생성/수정/전환 규칙
- Create: Draft → Approval → createIssue
- Update: “기존 티켓과의 연결”이 있을 때만 수행
- Transition: 워크플로우/transition id 매핑 테이블 필요
  - /policies/jira.transitions.json

## 5. 멱등성/중복 방지
- 같은 출처(결정/회의록 chunk)에서 동일 summary로 생성되는 중복을 방지
  - content_hash + projectKey + issueType 기반 dedupe
- Jira 코멘트/업데이트는 “diff 기반”으로 수행(무의미한 업데이트 방지)


# DOC-06 SDD-LangGraph 오케스트레이션

## 1. 그래프 설계 목표
- 단일 모델이 아니라 “역할 분리 + 상태 머신”으로 사고를 강제
- 루프/폭주 방지(최대 반복)
- 인간 승인 지점(interrupt) 내장
- 결과물은 “구조화된 Draft”로 고정(Zod 검증)

## 2. 상태(ScrumState) 정의(개념)
ScrumState:
- input: { type, text, refs[] }
- retrievedContext: { chunks[], decisions[] }
- classifications: { intent, confidence }
- reviews: { biz, qa, design }
- conflicts: { list[] }
- draft: CanonicalDraft | null
- citations: SourceRef[]
- control: { iteration, maxIteration, abortReason? }

## 3. 노드 목록(필수)
- classify_intent
- retrieve_context
- extract_decisions_actions
- biz_review
- qa_review
- design_review
- conflict_detect
- scrum_master_synthesize
- generate_draft
- human_approval_gate (interrupt)
- commit_to_jira (승인 후 실행)

## 4. 엣지(흐름)
- start → classify_intent → retrieve_context → extract_decisions_actions
- extract → (biz → qa → design 순차 또는 병렬)
- design → conflict_detect
- conflict_detect:
  - 충돌 없음: scrum_master_synthesize → generate_draft → approval_gate
  - 충돌 있음: scrum_master_synthesize(중재안 포함) → generate_draft → approval_gate
- approval_gate:
  - 승인: commit_to_jira → end
  - 거절: end(결정/학습 데이터로 저장)
  - 편집 필요: end(수정본 저장, 재승인)

## 5. 실패 정책(반드시 문서화해야 운영이 된다)
- LLM 호출 실패: 재시도 1~2회, 이후 degrade(간단 요약만)
- 컨텍스트 부족: “추가 질문” 대신, 필요한 정보 목록을 output하고 실행 중단
- 출처 없음: Draft 생성은 가능하되 “승인 버튼”은 비활성(대시보드 편집만 허용)
- 비용 초과: 요약/추출만 수행하고 리뷰는 스킵(정책 기반)

## 6. 체크포인트/타임트래블(현실적 사용처)
- “결정 번복” 시, 해당 결정 이전의 상태로 돌아가 재생성
- 단, 자동 롤백은 위험하니 “가시적 비교(diff)”가 먼저다


# DOC-07 SDD-에이전트 프롬프트팩(정교 버전)
요구사항: “그럴듯한 글” 금지. 반드시 구조화 출력 + 출처 + 불확실성 표기.

## 1. 공통 규칙(Common System Constraints)
- 너는 결정권자가 아니다. 실행 지시/확정 표현 금지.
- 출처가 없으면 UNSUPPORTED로 표시하고, 실행 가능한 제안을 금지한다.
- 반드시 구조화된 JSON을 출력한다(스키마 준수).
- 각 주장마다 citations[]로 근거 링크를 첨부한다.
- 불확실하면 “추정”이라고 명시하고 confidence를 낮춰라.
- 데이터에 PII가 의심되면 마스킹 또는 해당 부분을 무시하고 경고를 남겨라.

## 2. Biz Strategy Agent
목표: ROI/우선순위 관점에서 “왜 지금 해야 하는지/하면 안 되는지”를 논리로 찢는다.

입력:
- proposalText
- retrievedContext(decisions, metrics notes, constraints)
출력(JSON):
- decision: { recommendation: "APPROVE|REVISE|REJECT", confidence: 0~1 }
- valueHypothesis: string
- risks: [{type, description, severity: "P0|P1|P2", mitigation}]
- opportunityCost: string
- missingInfo: string[]
- citations: SourceRef[]

실패 방지 포인트:
- “매출 기여” 같은 허언 금지. 근거 없으면 추정으로 내려라.

## 3. QA Guardian Agent
목표: Edge case/회귀/상태머신 관점에서 기획을 깨부순다.

출력(JSON):
- decision: { recommendation: "APPROVE|REVISE|BLOCK", confidence }
- p0TestCases: [{title, steps[], expected[], notes}]
- stateModelRisks: [{scenario, failureMode, detection, mitigation}]
- regressionSurface: string[]
- nonFunctional: {timeouts, retries, idempotency, observability}
- missingInfo: string[]
- citations: SourceRef[]

실패 방지 포인트:
- 테스트 케이스는 “재현 가능”해야 한다(모호한 문장 금지).

## 4. Design System Agent
목표: 디자인 시스템/접근성/일관성 위반을 조기에 잡는다.

출력(JSON):
- decision: { recommendation: "APPROVE|REVISE", confidence }
- uiConstraints: string[]
- a11y: [{issue, severity, fix}]
- componentsMapping: [{suggestedComponent, reason}]
- missingInfo: string[]
- citations: SourceRef[]

실패 방지 포인트:
- 디자인 가이드 출처 없으면 “가정”이라고 표시.

## 5. Scrum Master Agent
목표: 리뷰를 종합해 “개발 가능한 티켓”으로 변환한다.

출력(JSON):
- summaryOneLine: string
- conflicts: [{between, topic, resolutionProposal}]
- canonicalDraft: CanonicalDraft
- rolloutPlan: {phases[], flags?, monitoring}
- acceptanceCriteria: string[]
- traceability: {sourceRefs[], assumptions[]}
- citations: SourceRef[]

강제 규칙:
- canonicalDraft는 Zod 검증을 통과해야 한다. 실패하면 “DRAFT_INVALID”를 반환하고 원인을 구조화해라.


# DOC-08 SDD-프론트엔드(RRv7) 상세기획

## 1. 화면 목표
- AI가 만든 초안을 사람이 빠르게 검증/수정/승인할 수 있게 한다.
- “왜 이 초안이 나왔는지”를 출처로 설명한다(설명 가능성).

## 2. 라우트 설계
- /dashboard
  - 오늘의 변화(Decisions delta), Draft 대기열, 최근 Runs
- /drafts
  - Draft 리스트 + 필터(출처/우선순위/상태)
- /drafts/:id
  - DraftEditor + AgentFeedbackPanel + 출처 링크
  - 승인/거절/수정 후 승인
- /decisions
  - 결정 카드 + superseded 관계 표시
- /runs/:runId
  - RunTimeline(SSE) + 노드별 출력 + 비용/토큰
- /settings/integrations
  - Slack/Jira 연결 상태 + 권한 스코프 표시
- /settings/policies
  - 트리거/가중치/승인 규칙(관리자 전용)

## 3. Loader/Action 패턴(원칙)
- 조회는 loader로, 변경은 action으로.
- 변경(action)은 반드시 approval 생성 또는 approval 실행으로만 연결.
- 클라이언트 fetch 난사 금지. 서버 액션에서 백엔드 호출 단일화.

## 4. 실시간(SSE) 사용처
- run 진행 중: /api/stream/runs/:runId
- draft 생성 중: “초안 생성” 버튼 눌렀을 때 progress 표시

## 5. UX 가드레일
- 승인 버튼 옆에 “출처 X개, 신뢰도 Y”를 강제 표시
- 출처 0개면 승인 버튼 비활성
- 변경사항 diff 제공(가능한 범위에서)


# DOC-09 SDD-보안/RBAC/감사

## 1. RBAC
- Admin: 정책/통합 설정/승인 강제 가능
- Member: Draft 편집/승인(정책 허용 범위)
- Viewer: 조회만

## 2. 시크릿 관리
- 환경변수 직접 저장 금지(최소한 Secrets Manager)
- 토큰 회전/만료 정책 문서화

## 3. 감사로그(필수 이벤트)
- Draft 생성/수정/승인/거절
- Jira create/update/transition 호출(요청/응답 요약)
- Slack 메시지 처리(원문 링크)
- 정책 변경(누가, 무엇을)

## 4. PII 처리
- 저장 전 마스킹(이메일/전화번호/주문번호 등 규칙 기반)
- 원문 raw_json 저장 정책은 보안 등급에 따라 선택(최소화 권장)


# DOC-10 SDD-관측가능성/평가

## 1. OTel 트레이싱
Span 흐름:
SlackEvent → Ingest → Retrieve → LangGraph Nodes → Draft Save → Approval → Jira API

## 2. 비용/품질 계측
- run별 token_usage/cost 저장
- “승인 후 수정량”을 품질 지표로 사용(수정이 많으면 프롬프트/정책이 틀린 것)

## 3. 평가(Eval) 전략
- 골든셋: 과거 회의록/슬랙 스레드에서 정답(결정/티켓)을 만든 데이터셋
- 회귀 테스트: 프롬프트 버전 업데이트 시 score 비교
- 사람 평가: 월 1회 샘플링(정확도/과잉/누락)


# DOC-11 SDD-운영/배포/런북

## 1. 배포 전략
- 초기: 단일 서버 + Postgres
- 확장: 큐(BullMQ) + 워커 분리 + 수평 확장

## 2. 장애 대응
- Slack/Jira API 장애 시: Draft는 생성하되 commit은 중단, 재시도 큐 적재
- DB 장애 시: 수집은 임시 저장(메모리/큐) 후 복구 시 재처리(최대 보존 시간 명시)

## 3. 데이터 보존
- raw 메시지 보존 기간(예: 30~90일)
- chunk/결정/티켓 이력은 장기 보존(필요 시 anonymize)


# DOC-12 SDD-테스트 전략(프로덕션에 필요한 수준)

## 1. 유닛 테스트
- JiraFieldMapper(커스텀필드 매핑)
- TemporalDecay/ConflictDetector
- Zod 스키마 검증(입출력)

## 2. 통합 테스트
- Slack 서명 검증 + 이벤트 처리 멱등성
- Jira API 목킹 + create/update/transition 흐름
- LangGraph 노드별 상태 전이(루프/중단 포함)

## 3. E2E
- “Slack에서 확정 → Draft 생성 → 대시보드 편집 → 승인 → Jira 생성” 전 과정


# 마지막 점검(너무 자주 빠지는 핵심)
1) “실시간”에 집착하면 시스템이 복잡해지고 사고가 난다. 실시간은 ‘수집’만, ‘실행’은 승인 기반으로 느리게 가는 게 맞다.
2) LangGraph를 도입하면 해결되는 게 아니다. 그래프는 구조를 강제할 뿐, 프롬프트/정책/스키마가 엉망이면 더 빨리 망한다.
3) Jira/Slack 스키마 변화는 피할 수 없다. 내부 Canonical 스키마 + 매핑 정책 파일로 방어하지 않으면 유지보수 불가능해진다.

다음 작업(문서 후 바로 개발로 넘어가기 위한 최소 산출물)
- /packages/contracts 에 CanonicalDraft Zod 스키마 확정
- /packages/policies 에 Slack 트리거 정책 + Jira 필드 매핑 정책 JSON 확정
- DB 마이그레이션 초안 작성(위 테이블)
- NestJS 모듈 스캐폴딩 + RRv7 라우트 스캐폴딩