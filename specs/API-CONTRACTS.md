# API-CONTRACTS.md

> 대시보드 웹앱 및 외부 시스템과의 통신을 위한 REST API 규격 및 데이터 계약

| Status | Phase | Last Updated | Depends On |
|--------|-------|-------------|------------|
| Draft  | 0-2   | 2026-02-10  | ARCHITECTURE.md |

---

## 1. API 설계 원칙

- **Protocol**: RESTful JSON API
- **Validation**: Zod 스키마를 이용한 요청(Body/Query) 및 응답 검증
- **Authentication**:
  - **Phase 0**: 인증 없음 (내부 네트워크 전용 또는 환경 변수 기반 API Key)
  - **Phase 1+**: JWT 기반 인증 및 RBAC 적용
- **Versioning**: URL 프리픽스 `/api/v1` 사용

---

## 2. Phase 0 엔드포인트 (기초 데이터 확보)

수집된 Slack 데이터 조회 및 수동 요약 기능을 제공합니다.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/events` | 수집된 Slack 이벤트 목록 조회 (필터: channel, date) |
| `POST` | `/api/summarize` | 특정 채널의 대화 내용에 대한 수동 요약 트리거 |
| `GET` | `/api/summaries` | 생성된 요약 결과 목록 조회 |

---

## 3. Phase 1 엔드포인트 (HITL 워크플로우)

티켓 초안(Draft) 관리 및 인간 승인 기능을 제공합니다.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/drafts` | Draft 목록 조회 (필터: status, type, project) |
| `GET` | `/api/drafts/:id` | 특정 Draft 상세 정보 및 관련 컨텍스트 조회 |
| `PATCH` | `/api/drafts/:id` | Draft 내용(Summary, AC 등) 수정 |
| `POST` | `/api/drafts/:id/approve` | Draft 승인 및 Jira 실행(Commit) 트리거 |
| `POST` | `/api/drafts/:id/reject` | Draft 거절 처리 |

---

## 4. Phase 2+ 엔드포인트 (고도화 및 모니터링)

의사결정 이력 및 AI 실행 과정에 대한 가시성을 제공합니다.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/decisions` | 확정된 의사결정 이력 및 영향 범위 조회 |
| `GET` | `/api/runs/:runId` | LangGraph 에이전트 실행 상세 로그 조회 |
| `GET` | `/api/runs/:runId/stream` | 실시간 실행 상태 SSE (Server-Sent Events) 스트림 |

---

## 5. 공통 응답 포맷

모든 API 응답은 일관된 구조를 유지합니다.

### 5.1 성공 응답
```json
{
  "success": true,
  "data": T,
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100
  }
}
```

### 5.2 에러 응답
```json
{
  "success": false,
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Validation failed",
    "details": [
      { "path": "channelId", "message": "Required" }
    ]
  }
}
```

---

## 6. Zod 스키마 예시 (Phase 0)

NestJS 컨트롤러 및 프론트엔드에서 공유할 스키마 정의입니다.

```typescript
import { z } from 'zod';

// POST /api/summarize 요청 스키마
export const SummarizeRequestSchema = z.object({
  channelId: z.string().min(1),
  messageCount: z.number().int().min(1).max(500).default(100),
  contextWindow: z.enum(['24h', '7d', 'all']).default('24h')
});

// GET /api/summaries 응답 데이터 스키마
export const SummaryResponseSchema = z.object({
  id: z.string().uuid(),
  channelId: z.string(),
  summary: z.string(),
  messageCount: z.number(),
  sourceRefs: z.array(z.string()), // Slack permalinks
  createdAt: z.string().datetime(),
  status: z.enum(['PROCESSING', 'COMPLETED', 'FAILED'])
});
```

---

## Phase별 범위
| Phase | 이 문서에서의 범위 |
|-------|--------------------|
| 0     | Events 조회, 수동 Summarize API 구현 |
| 1     | Draft CRUD, Approval/Reject API 추가 |
| 2+    | Decisions 조회, Run 모니터링 및 SSE 스트리밍 지원 |

## 관련 문서
- [ARCHITECTURE.md](./ARCHITECTURE.md) — 모듈 구조
- [DATA-MODEL.md](./DATA-MODEL.md) — DB 테이블 구조
- [JIRA.md](./JIRA.md) — Canonical Draft 상세 규격
