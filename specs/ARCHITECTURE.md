# AI-Augmented Scrum Bot: ARCHITECTURE.md

> 단순하고 유지보수 가능한 단방향 데이터 흐름 기반의 보트 아키텍처

| Status | Phase | Last Updated | Depends On |
|--------|-------|-------------|------------|
| Draft  | 0-1   | 2026-02-10  | PRD.md     |

---

## 1. 기술 스택 (Tech Stack)
- **Backend**: NestJS (TypeScript) - 단일 프로세스로 Bot과 API 서버 공유
- **Slack SDK**: `@slack/bolt` + `nestjs-slack-bolt` (Event API & Socket Mode 지원)
- **AI Orchestration**: `@langchain/langgraph` (v1.1.4+)
- **Database**: MySQL 8 / Phase 2+: 벡터 검색 확장
- **Frontend**: React 19 + React Router v7 + TailwindCSS 4
- **Communication**: 
  - Internal: `EventEmitter2` (NestJS 내장 이벤트를 통한 모듈 간 디커플링)
  - External: REST API, Slack Socket Mode (Dev) / HTTP Mode (Prod)

## 2. 프로젝트 구조 (pnpm workspace)
```
scrum-bot/
├── apps/
│   ├── bot/          # NestJS + Slack Bolt (단일 통합 백엔드)
│   │   ├── src/
│   │   │   ├── slack/        # Bolt 리스너 (이벤트, 액션, 커맨드)
│   │   │   ├── drafts/       # AI 프로세싱 및 Draft 비즈니스 로직
│   │   │   ├── api/          # Dashboard용 REST API 엔드포인트
│   │   │   ├── shared/       # DB(Drizzle), Config, 공통 유틸리티
│   │   │   └── main.ts       # NestJS + Bolt 부트스트랩
│   │   └── package.json
│   └── web/          # React Router v7 대시보드
│       ├── app/
│       │   ├── routes/       # /dashboard, /drafts, /runs
│       │   └── components/   # UI 원자적 컴포넌트
│       └── package.json
├── specs/            # 명세서 문서들
├── pnpm-workspace.yaml
└── package.json
```

## 3. NestJS 모듈 설계
1. **SlackModule**:
   - `nestjs-slack-bolt`를 래핑하여 Slack 이벤트 수신 및 블록 킷 발송 담당.
   - 수신된 이벤트는 가공 후 `EventEmitter2`를 통해 `DraftsModule`로 전달.
2. **DraftsModule**:
   - 시스템의 두뇌 역할. `LangGraph`를 호출하여 메시지 분석 및 초안 생성.
   - Draft의 상태 관리(Pending, Approved, Executed) 및 Jira 연동 로직 포함.
3. **ApiModule**:
   - 대시보드 웹앱에 데이터를 제공하는 REST 컨트롤러 집합.
4. **SharedModule**:
   - 데이터베이스 커넥션, 환경 변수, 전역 보안 필터 등 공통 기능.

## 4. 단방향 데이터 파이프라인
```
[ Slack Event ] ──┐
                  │ (1) Ingest
[ SlackModule ] <─┘
      │
      │ (2) Emit Event (message_received)
      ▼
[ DraftsModule ] ──┐
                   │ (3) Process (AI / LangGraph)
                   ▼
[ Drafts Table ] <─┘ (4) Store Draft (Status: PENDING)
      │
      │ (5) HITL (Dashboard 편집 또는 Slack 버튼 클릭)
      ▼
[ DraftsModule ] ──┐
                   │ (6) Execute (Jira API 호출)
                   ▼
[ SlackModule ] <──┘ (7) Notify (결과 알림 발송)
```
**핵심 규칙**:
- 각 단계는 다음 단계로 이벤트를 발생시키며, 역방향 의존성(Circular Dependency)을 금지함.
- `EventEmitter2`를 사용하여 모듈 간 직접적인 `Service` 주입을 최소화하고 디커플링 유지.

## 5. Bolt + NestJS 공존 패턴
Socket Mode와 HTTP Mode를 유연하게 전환할 수 있는 구조를 취함.

```typescript
// app.module.ts 예시
@Module({
  imports: [
    SlackModule.forRoot({
      // Socket Mode 설정 (개발용) 또는 HTTP Receiver 설정 (운영용)
    }),
    DraftsModule,
    ApiModule,
    SharedModule,
  ],
})
export class AppModule {}
```
- **개발 환경**: Socket Mode를 사용하여 공개 URL(ngrok 등) 없이 로컬 테스트 가능.
- **운영 환경**: NestJS의 Express 인스턴스에 Bolt Receiver를 마운트하여 단일 포트(8080)로 운영.

## 6. 보안 정책
- **Phase 0**:
  - `SLACK_SIGNING_SECRET`을 통한 Bolt 자동 서명 검증.
  - 모든 API 엔드포인트에 환경 변수 기반 API Key 인증 적용.
- **Phase 1+**:
  - RBAC 도입 (Admin, Member, Viewer).
  - PII (개인정보) 마스킹: LLM 전달 전 규칙 기반 정규표현식 필터링 적용.
  - 모든 Jira 쓰기 작업에 대한 감사 로그(Audit Log) 강제 기록.

---

## Phase별 범위
| Phase | 이 문서에서의 범위 |
|-------|--------------------|
| 0     | 단일 프로세스 아키텍처, 기초 데이터 파이프라인, Socket Mode 연동 |
| 1     | Jira REST API 연동, HITL(승인) 워크플로우 추가 |
| 2+    | LangGraph 멀티 에이전트 확장, pgvector 지식베이스 통합 |

## 관련 문서
- [PRD.md](./PRD.md) — 제품 요구사항 및 목표
- [DATA-MODEL.md](./DATA-MODEL.md) — 스키마 및 데이터 정책
