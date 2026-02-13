# AI-Augmented Scrum Bot: DATA-MODEL.md

> AI 분석 결과와 스크럼 히스토리를 관리하기 위한 점진적 데이터 모델 설계

| Status | Phase | Last Updated | Depends On |
|--------|-------|-------------|------------|
| Draft  | 0-1   | 2026-02-10  | ARCHITECTURE.md |

---

## 1. 설계 원칙
1. **점진적 확장**: Phase 0에서는 최소한의 테이블로 시작하여 복잡도를 제어함.
2. **AI 데이터 비정규화**: AI 출력물(Draft, Metadata)은 잦은 변경에 유연하게 대응하기 위해 `JSON` 타입을 적극 활용함.
3. **출처(Citations) 불변성**: 모든 가공된 데이터는 반드시 원본 메시지의 참조(Link)를 포함함.
4. **HITL 이력 보존**: 누가 어떤 결정을 언제 승인했는지에 대한 기록을 최우선으로 함.

## 2. Phase 0 스키마 (메시지 수집)
메시지 중복 방지와 원문 데이터 보존에 집중합니다.

```sql
CREATE TABLE slack_events (
  id VARCHAR(36) PRIMARY KEY,
  channel_id VARCHAR(255) NOT NULL,
  message_ts VARCHAR(255) NOT NULL,
  thread_ts VARCHAR(255),
  user_id VARCHAR(255),
  event_type VARCHAR(255) NOT NULL DEFAULT 'message',
  text TEXT,
  permalink VARCHAR(2048),
  raw_payload JSON NOT NULL,
  processed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY slack_events_channel_ts_idx (channel_id, message_ts)
);
```

## 3. Phase 1 스키마 (의사결정 및 티켓팅)
AI가 생성한 초안과 실제 Jira 실행 기록을 관리합니다.

```sql
-- AI가 생성한 초안 (결정 사항 또는 티켓 후보)
CREATE TABLE drafts (
  id VARCHAR(36) PRIMARY KEY,
  type VARCHAR(255) NOT NULL,
  source_event_ids JSON,
  content JSON NOT NULL,
  status VARCHAR(255) DEFAULT 'pending',
  approved_by VARCHAR(255),
  executed_at DATETIME,
  metadata JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Jira 연동 기록
CREATE TABLE jira_sync_log (
  id VARCHAR(36) PRIMARY KEY,
  draft_id VARCHAR(36) REFERENCES drafts(id),
  jira_key VARCHAR(255),
  action VARCHAR(255) NOT NULL,
  request_payload JSON,
  response_payload JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## 4. Phase 2+ 스키마 (지능화 및 지식베이스)
멀티 에이전트와 지식 검색(RAG) 기능을 지원합니다.

- **context_chunks**: 벡터 검색을 위한 임베딩 저장 테이블.
- **agent_runs**: LangGraph의 상세 실행 트레이스 (Phase 1까지는 `drafts.metadata`에 인라인).
- **decisions**: 확정된 의사결정 사항의 단일 진실 소스 (SSOT) 테이블.

## 5. 설계 결정 근거
- **JSONB 인라인화**: Phase 1까지는 `agent_run`이나 `approval` 테이블을 별도로 분리하지 않고 `drafts` 테이블 내 `metadata`로 관리하여 쿼리 복잡도를 줄임.
- **Deduplication**: `channel_id`와 `message_ts`의 복합 유니크 키를 통해 Slack의 재전송 이벤트로 인한 중복 수집을 원천 차단함.
- **벡터 검색 도입 시기**: 지식베이스가 1,000개 이상의 유의미한 청크(Chunk)로 쌓였을 때 도입하여 초기 인프라 부담을 줄임.

## 6. 데이터 최신성 및 신뢰도 정책
- **Temporal Decay**: 검색 시 최신 메시지에 높은 가중치를 부여함 (최근 1주일 메시지 가중치 1.0, 1개월 경과 시 0.5).
- **신뢰도 등급**:
  - 인간 승인 결정 (HUMAN_APPROVED): 1.0
  - Jira 티켓 확정 데이터: 0.9
  - 단순 Slack 대화 요약: 0.6
  - 출처 없는 AI 추론: 0.0 (검색 제외)

---

## Phase별 범위
| Phase | 이 문서에서의 범위 |
|-------|--------------------|
| 0     | slack_events 테이블 및 인덱스 |
| 1     | drafts, jira_sync_log 테이블 및 상태 관리 |
| 2+    | 벡터 검색 임베딩 테이블 및 정규화된 에이전트 로그 |

## 관련 문서
- [ARCHITECTURE.md](./ARCHITECTURE.md) — 시스템 구조 및 데이터 흐름
- [JIRA.md](./JIRA.md) — Jira REST API 연동 및 ADF 변환 규격
