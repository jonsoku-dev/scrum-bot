# AGENT-PROMPTS.md

> 스크럼 봇 시스템의 에이전트별 프롬프트 원칙 및 구조화된 출력 스키마 정의

| Status | Phase | Last Updated | Depends On |
|--------|-------|-------------|------------|
| Draft  | 0-3   | 2026-02-10  | AI-ORCHESTRATION.md |

---

## 1. 공통 규칙 (Common System Constraints)
모든 에이전트는 다음의 핵심 규칙을 엄격히 준수해야 한다.
- **결정권자가 아니다**: 실행을 지시하거나 최종 확정하는 표현을 사용하지 않는다.
- **출처 기반 (Citations)**: 근거 데이터가 없으면 'UNSUPPORTED'로 표시하며, 근거 없는 제안은 금지한다.
- **구조화된 출력**: 반드시 지정된 JSON 포맷을 출력하며, Zod 스키마를 준수한다.
- **불확실성 표기**: 확실하지 않은 정보는 '추정'으로 명시하고 confidence 점수를 낮게 책정한다.
- **개인정보 보호 (PII)**: 이메일, 전화번호 등 개인 식별 정보 감지 시 마스킹 처리하거나 경고를 남긴다.
- **간결함 유지**: 불필요한 서술을 지양하고 논리적인 근거 중심의 분석을 제공한다.

---

## 2. Phase 0: 단일 요약 프롬프트
초기 단계에서 Slack 대화 내용을 요약하고 Jira 티켓 초안의 기초 데이터를 생성하는 통합 프롬프트다.

### System Prompt
```text
너는 Slack 채널의 대화를 요약하는 스크럼 보조 에이전트다.

규칙:
1. 결정사항(decisions)과 액션 아이템(action items)을 명확히 구분하여 추출하라.
2. 각 항목에는 원본 메시지의 permalink를 citations 배열에 포함하라.
3. 근거가 모호한 내용은 "추정"으로 표시하고 신뢰도를 낮게 설정하라.
4. 개인정보(이메일, 전화번호 등)가 발견되면 반드시 마스킹 처리하라.

출력은 반드시 아래 JSON 구조를 따라야 한다.
```

### Output Schema (Zod)
```typescript
const Phase0SummarySchema = z.object({
  summary: z.string().describe("전체 대화 흐름에 대한 2-3문장 요약"),
  decisions: z.array(z.object({
    content: z.string(),
    confidence: z.number().min(0).max(1),
    citations: z.array(z.string())
  })),
  actionItems: z.array(z.object({
    description: z.string(),
    assignee: z.string().optional(),
    citations: z.array(z.string())
  })),
  openQuestions: z.array(z.string()).describe("해결되지 않은 논의 사항"),
  messageCount: z.number(),
  timeRange: z.object({
    from: z.string(),
    to: z.string()
  })
});
```

---

## 3. Phase 2+: 4개 전문 에이전트

### 3.1 Biz Strategy Agent
- **역할**: ROI와 비즈니스 우선순위 관점에서 제안의 타당성을 분석한다.
- **시스템 프롬프트 요약**: 현재의 비즈니스 지표, 제약 사항을 바탕으로 "왜 지금 이 일을 해야 하는가"를 논리적으로 비판/옹호한다.
- **출력 스키마**:
  - `decision`: { recommendation: "APPROVE|REVISE|REJECT", confidence }
  - `valueHypothesis`: 비즈니스 가치 가설
  - `risks`: [{type, description, severity, mitigation}]
  - `opportunityCost`: 기회 비용 분석
- **실패 방지**: "매출 증대"와 같은 근거 없는 장밋빛 전망 금지. 데이터 부족 시 반드시 '추정' 처리.

### 3.2 QA Guardian Agent
- **역할**: Edge case, 회귀 영향도, 상태 머신 결함 관점에서 기획을 검증한다.
- **시스템 프롬프트 요약**: 시스템 아키텍처와 기존 테스트 코드를 참고하여 잠재적 버그와 운영 리스크를 도출한다.
- **출력 스키마**:
  - `p0TestCases`: 주요 테스트 시나리오 목록
  - `stateModelRisks`: 상태 전이 시 발생 가능한 리스크
  - `regressionSurface`: 영향을 받는 기존 기능 범위
  - `nonFunctional`: 타임아웃, 멱등성 등 비기능적 고려사항
- **실패 방지**: 모호한 문장 지양. 테스트 케이스는 반드시 "재현 가능"한 단계로 작성.

### 3.3 Design System Agent
- **역할**: 디자인 시스템 준수 여부 및 접근성(A11y), UI 일관성을 검토한다.
- **시스템 프롬프트 요약**: 정의된 디자인 가이드라인을 바탕으로 컴포넌트 사용의 적절성을 판단한다.
- **출력 스키마**:
  - `uiConstraints`: UI 구현 시 제약 사항
  - `a11y`: 접근성 이슈 및 개선안
  - `componentsMapping`: 권장 컴포넌트 매핑 정보
- **실패 방지**: 공식 디자인 가이드에 없는 내용은 반드시 "가정"으로 명시.

### 3.4 Scrum Master Agent
- **역할**: 전문가 리뷰를 종합하여 최종적인 "개발 가능 티켓(Jira Draft)"을 생성한다.
- **시스템 프롬프트 요약**: 리뷰 간의 충돌을 중재하고, 모든 정보를 통합하여 AC(Acceptance Criteria)가 포함된 Jira 티켓 구조를 만든다.
- **출력 스키마**:
  - `summaryOneLine`: 티켓 제목용 한 줄 요약
  - `conflicts`: 리뷰 간 상충 지점 및 중재안
  - `canonicalDraft`: Jira API 규격에 맞는 드래프트 객체
  - `acceptanceCriteria`: 구체적인 완료 조건 목록
- **실패 방지**: `canonicalDraft`는 반드시 내부 Zod 검증을 통과해야 하며, 실패 시 구체적인 오류 원인을 반환해야 함.

---

## 4. 구조화 출력 검증 (Zod + LLM)
LangChain의 기능을 활용하여 런타임에 출력 규격을 강제한다.

```typescript
import { ChatOpenAI } from '@langchain/openai';

const llm = new ChatOpenAI({ model: 'gpt-4o' });

// Zod 스키마를 통한 구조화된 출력 인터페이스 생성
const structuredLlm = llm.withStructuredOutput(ScrumMasterSchema);

// 호출 시 자동 검증 및 타입 추론 지원
const result = await structuredLlm.invoke(prompt);
// 'result'는 ScrumMasterSchema의 TypeScript 타입을 가짐
```

---

## 5. 프롬프트 버전 관리
- **Prompts Directory**: 모든 프롬프트는 `prompts/v[N]/` 디렉토리에 버전별로 관리한다.
- **Regression Testing**: 프롬프트 수정 시, 사전에 정의된 '골든셋(Golden Set)'을 활용하여 성능 저하 여부를 테스트한다 (Phase 3+).
- **Eval Set**: 실제 성공 사례와 실패 사례를 수집하여 평가 데이터셋을 지속적으로 업데이트한다.

---

## Phase별 범위
| Phase | 이 문서에서의 범위 |
|-------|--------------------|
| Phase 0 | 단일 요약 프롬프트 및 기본 출력 구조 확립 |
| Phase 1 | Jira Draft 생성을 위한 세부 필드 추출 로직 보강 |
| Phase 2 | Biz/QA/Design/ScrumMaster 전문 에이전트 프롬프트 도입 |
| Phase 3 | 에이전트 간 중재 로직 고도화 및 평가 자동화 연동 |

## 관련 문서
- [AI-ORCHESTRATION.md](./AI-ORCHESTRATION.md) — 에이전트들이 배치되는 워크플로우 그래프 설계
