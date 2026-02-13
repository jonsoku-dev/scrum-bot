# AI-ORCHESTRATION.md

> LangGraph.js를 이용한 스크럼 워크플로우 자동화 및 에이전트 오케스트레이션 설계

| Status | Phase | Last Updated | Depends On |
|--------|-------|-------------|------------|
| Draft  | 0-3   | 2026-02-10  | ARCHITECTURE.md, AGENT-PROMPTS.md |

---

## 1. 그래프 설계 목표
기존의 단일 LLM 호출 방식에서 벗어나, LangGraph.js를 활용하여 다음과 같은 목표를 달성한다.
- 단일 모델이 아니라 “역할 분리 + 상태 머신”으로 사고를 강제
- 루프/폭주 방지(최대 반복 횟수 제한)
- 인간 승인 지점(interrupt) 내장으로 신뢰성 확보
- 결과물은 “구조화된 Draft”로 고정하여 Zod 검증 수행

---

## 2. 상태 스키마 (Zod 기반)
워크플로우의 상태를 정의하는 `ScrumState` 스키마는 다음과 같다.

```typescript
import { z } from 'zod';

const ScrumState = z.object({
  // 입력 데이터
  input: z.object({
    type: z.enum(['slack_message', 'meeting_minutes', 'manual']),
    text: z.string(),
    sourceRefs: z.array(z.object({ 
      type: z.string(), 
      url: z.string(), 
      id: z.string() 
    })),
  }),
  // AI 분석 결과 (의도 분류)
  classification: z.object({
    intent: z.enum(['decision', 'action_item', 'discussion', 'question']),
    confidence: z.number().min(0).max(1),
  }).nullable().default(null),
  // 추출된 액션 아이템
  actions: z.array(z.object({
    type: z.string(),
    description: z.string(),
    assignee: z.string().optional(),
  })).default([]),
  // 생성된 Jira 드래프트 (CanonicalDraft)
  draft: z.any().nullable().default(null), 
  // 전문가 리뷰 결과 (Phase 2+)
  reviews: z.object({
    biz: z.any().nullable(),
    qa: z.any().nullable(),
    design: z.any().nullable(),
  }).default({ biz: null, qa: null, design: null }),
  // 워크플로우 제어 변수
  control: z.object({
    iteration: z.number().default(0),
    maxIteration: z.number().default(3),
    abortReason: z.string().optional(),
  }),
});
```

---

## 3. Phase 0: 3노드 선형 그래프
초기 단계에서는 단순한 선형 구조로 시작하여 핵심 기능을 검증한다.

```typescript
import { StateGraph, START, END, MemorySaver } from '@langchain/langgraph';

const graph = new StateGraph({ state: ScrumState })
  .addNode('classify', classifyIntent)     // 의도 분류
  .addNode('extract', extractActions)      // 액션/결정 추출
  .addNode('draft', generateDraft)         // 요약/초안 생성
  .addEdge(START, 'classify')
  .addEdge('classify', 'extract')
  .addEdge('extract', 'draft')
  .addEdge('draft', END);

// Phase 0: 메모리 내 체크포인터 사용
const app = graph.compile({ checkpointer: new MemorySaver() });
```
*참고: Phase 0에서는 성능 최적화를 위해 classify, extract, draft를 하나의 LLM 호출로 합칠 수 있으나, 향후 확장을 위해 노드를 분리하여 설계한다.*

---

## 4. Phase 1: +HITL interrupt
인간의 개입(Human-In-The-Loop)을 추가하여 신뢰도를 높이고, 영속적인 상태 관리를 도입한다.

```typescript
import { interrupt } from "@langchain/langgraph";

const approvalGate = async (state) => {
  // 사용자의 검토를 위해 실행 중단
  const decision = interrupt({
    message: '초안을 검토해주세요',
    draft: state.draft,
    citations: state.input.sourceRefs,
  });
  return { approved: decision.approved };
};

graph.addNode('approval', approvalGate);
graph.addEdge('draft', 'approval');
// 승인 시 종료, 반려/수정 시 재생성 로직 추가 가능
```

### DB 기반 체크포인터로 전환 (영속성)
```typescript
import { MySQLSaver } from '@langchain/langgraph-checkpoint-mysql';

const checkpointer = MySQLSaver.fromConnString(process.env.DATABASE_URL);
await checkpointer.setup();

const app = graph.compile({ checkpointer });
```

---

## 5. Phase 2: +멀티에이전트 리뷰
비즈니스, QA, 디자인 전문가 에이전트를 추가하여 초안의 품질을 다각도로 검토한다.

- **병렬 실행**: `extract` 노드 이후 여러 리뷰 노드를 동시에 실행한다.
- **집계(Aggregation)**: 모든 리뷰 결과를 `synthesize` 노드에서 통합한다.

```typescript
graph.addNode('biz_review', bizReviewNode);
graph.addNode('qa_review', qaReviewNode);
graph.addNode('design_review', designReviewNode);
graph.addNode('conflict_detect', conflictDetectNode);

// 병렬 에지 설정
graph.addEdge('extract', ['biz_review', 'qa_review', 'design_review']);
graph.addEdge(['biz_review', 'qa_review', 'design_review'], 'conflict_detect');
```

---

## 6. Phase 3: 전체 11노드 그래프
최종적으로 모든 기능이 통합된 복합 그래프 구조를 완성한다.

**워크플로우 경로:**
`classify` → `retrieve_context` → `extract` → [`biz`, `qa`, `design`] → `conflict_detect` → `synthesize` → `draft` → `approval` → `commit`

---

## 7. 실패 정책
운영 안정성을 위해 다음과 같은 실패 정책을 준수한다.
- **LLM 호출 실패**: 재시도 1-2회 수행 후, 지속 실패 시 간단 요약 모드로 Degrade 실행.
- **컨텍스트 부족**: 추가 정보가 필요할 경우 무리하게 생성하지 않고 필요 정보 목록을 출력하며 실행 중단.
- **출처 없음**: 초안 생성은 허용하되, 승인 버튼을 비활성화하고 대시보드 편집만 허용.
- **비용 초과**: 설정된 토큰 예산 초과 시 요약/추출만 수행하고 에이전트 리뷰 단계 스킵.

---

## 8. 체크포인팅 전략
- **Phase 0**: `MemorySaver` 사용 (프로세스 재시작 시 휘발).
- **Phase 1+**: DB 기반 체크포인터 사용 (DB 영속 저장).
- **thread_id 정책**: `scrum-{triggerType}-{timestamp}` 형식을 사용하여 개별 실행 단위를 추적하고 타임트래블(상태 복원) 기능을 지원한다.

---

## Phase별 범위
| Phase | 이 문서에서의 범위 |
|-------|--------------------|
| Phase 0 | 3노드 선형 그래프 구축 및 메모리 기반 체크포인팅 |
| Phase 1 | HITL interrupt 및 DB 기반 체크포인터 도입 |
| Phase 2 | 멀티에이전트 병렬 리뷰 및 충돌 감지 로직 추가 |
| Phase 3 | 전체 11노드 통합 및 고도화된 컨텍스트 검색 |

## 관련 문서
- [AGENT-PROMPTS.md](./AGENT-PROMPTS.md) — 에이전트별 상세 프롬프트 및 출력 스키마 정의
- [ARCHITECTURE.md](./ARCHITECTURE.md) — 시스템 전체 아키텍처 및 모듈 구조 설명
