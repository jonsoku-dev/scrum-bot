# JIRA.md

> Jira REST API v3를 이용한 티켓 관리 및 초안(Draft) 데이터 모델 명세

| Status | Phase | Last Updated | Depends On |
|--------|-------|-------------|------------|
| Draft  | 1-2   | 2026-02-10  | DATA-MODEL.md |

---

## 1. Phase 범위

**중요**: 본 명세는 **Phase 1**부터 적용됩니다.
- **Phase 0**: Jira 연동 없음. Slack 데이터 수집 및 내부 요약 생성에 집중.
- **Phase 1**: Jira API를 통한 티켓 생성(Create) 및 조회.
- **Phase 2+**: 티켓 수정(Update), 상태 전환(Transition), Webhook 수신.

---

## 2. 인증 전략 (Authentication)

시스템 보안과 구현 편의성을 고려하여 다음과 같이 단계별로 접근합니다.

### 2.1 MVP (Phase 1): API Token (PAT)
- **방법**: Jira 봇 계정을 생성하고 해당 계정의 API Token을 발급받아 사용.
- **장점**: 구현이 매우 빠름 (`Basic Auth` 사용).
- **단점**: 토큰 유출 시 봇 계정의 모든 권한이 노출됨.

### 2.2 운영 (Phase 2+): Atlassian OAuth 2.0
- **방법**: 3-legged OAuth (Authorization Code Flow) 적용.
- **장점**: 사용자별 권한 제어 가능, 보안성 높음.
- **전환 계획**: `JiraAuthService` 인터페이스를 추상화하여 구현체를 교체할 수 있도록 설계.

---

## 3. Canonical Draft 스키마

AI가 생성하고 사람이 검토하는 티켓 초안의 공통 포맷입니다. Jira의 복잡한 스키마를 추상화합니다.

```typescript
import { z } from 'zod';

export const CanonicalDraftSchema = z.object({
  projectKey: z.string().describe('Jira 프로젝트 키 (예: PROJ)'),
  issueType: z.enum(['Story', 'Task', 'Bug']).default('Task'),
  summary: z.string().max(255).describe('티켓 제목'),
  descriptionMd: z.string().describe('Markdown 형식의 본문'),
  acceptanceCriteria: z.array(z.string()).describe('인수 조건 목록'),
  priority: z.enum(['P0', 'P1', 'P2', 'P3']).default('P2'),
  labels: z.array(z.string()).default([]),
  components: z.array(z.string()).default([]),
  dueDate: z.string().optional().describe('YYYY-MM-DD 형식'),
  links: z.array(z.object({
    type: z.string().describe('Blocks, Relates to 등'),
    key: z.string().describe('연결할 티켓 키')
  })).default([]),
  sourceCitations: z.array(z.object({
    type: z.enum(['SLACK', 'MEETING', 'DOC']),
    url: z.string(),
    id: z.string()
  })).describe('근거 데이터 출처')
});

export type CanonicalDraft = z.infer<typeof CanonicalDraftSchema>;
```

---

## 4. Jira ADF 변환

Jira Cloud REST API v3는 본문(description) 포맷으로 **ADF (Atlassian Document Format)**를 요구합니다.

- **Markdown-to-ADF 유틸리티**: 내부에서 관리하는 `descriptionMd`를 ADF JSON 구조로 변환하는 모듈을 구축합니다.
- **라이브러리**: `@atlaskit/adf-utils` 또는 커스텀 변환기를 사용하여 Markdown 요소를 ADF 노드(paragraph, bulletList, codeBlock 등)로 매핑합니다.

---

## 5. CRUD 및 비즈니스 규칙

### 5.1 Create (생성)
- **워크플로우**: `Draft 생성 (AI)` -> `검토 및 승인 (인간)` -> `Jira Issue 생성 (시스템)`
- 승인된 Draft만 `POST /rest/api/3/issue` 호출을 트리거합니다.

### 5.2 Update (수정)
- 기존 티켓과의 명시적 연결(Linked Issue)이 있거나, AI가 기존 티켓 수정을 제안했을 때만 수행합니다.
- 전체 덮어쓰기가 아닌 필요한 필드만 `PUT` 요청으로 업데이트합니다.

### 5.3 Transition (상태 변경)
- `/policies/jira.transitions.json` 파일에 정의된 매핑 테이블을 기반으로 상태 전이를 수행합니다.
- 예: "승인됨" 상태 -> "To Do"로 자동 전이.

---

## 6. 멱등성 및 중복 방지

동일한 논의나 회의록에서 중복된 티켓이 생성되는 것을 방지합니다.

- **Deduplication Key**: `content_hash` + `projectKey` + `issueType` 기반으로 고유 키를 생성합니다.
- **방어 로직**: 
  1. 티켓 생성 전 해당 키로 DB 또는 Jira 검색.
  2. 유사한 `summary`를 가진 오픈 티켓이 이미 존재할 경우, 신규 생성 대신 기존 티켓에 코멘트를 추가하거나 사용자에게 알림.

---

## Phase별 범위
| Phase | 이 문서에서의 범위 |
|-------|--------------------|
| 0     | 해당 없음 (Jira 연동 스킵) |
| 1     | API Token 기반 인증, CanonicalDraft 기반 Issue Create |
| 2+    | OAuth 2.0 전환, Issue Update/Transition, ADF 변환 고도화 |

## 관련 문서
- [DATA-MODEL.md](./DATA-MODEL.md) — 데이터베이스 스키마
- [ARCHITECTURE.md](./ARCHITECTURE.md) — 전체 시스템 아키텍처
