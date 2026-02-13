# SLACK-BOLT.md

> `@slack/bolt` SDK와 `nestjs-slack-bolt` 모듈을 이용한 Slack 연동 및 이벤트 처리 명세

| Status | Phase | Last Updated | Depends On |
|--------|-------|-------------|------------|
| Draft  | 0-1   | 2026-02-10  | ARCHITECTURE.md |

---

## 1. Slack App 설정

시스템 운영을 위해 Slack API Dashboard에서 다음과 같은 설정이 필요합니다.

### 1.1 Bot Token Scopes
봇의 기능을 수행하기 위해 필요한 최소 권한 범위입니다.
- `chat:write`: 메시지 발송 및 Block Kit 응답
- `channels:history`: 공개 채널의 메시지 읽기
- `channels:read`: 채널 목록 및 정보 조회
 - `reactions:read`: 리액션(white_check_mark 등) 감지
- `commands`: 슬래시 커맨드(`/scrum-summarize` 등) 실행
- `users:read`: 사용자 정보 조회

### 1.2 Tokens
- **Bot User OAuth Token (`xoxb-...`)**: API 호출 시 사용
- **App-Level Token (`xapp-...`)**: Socket Mode 연결 시 사용 (`connections:write` 스코프 필요)

### 1.3 Event Subscriptions
Bot Events로 다음 이벤트를 구독해야 합니다.
- `message.channels`: 채널 내 메시지 수집
 - `reaction_added`: 의사결정 신호(white_check_mark) 감지

---

## 2. nestjs-slack-bolt 통합

NestJS 내에서 Slack 기능을 모듈화하여 관리합니다.

### 2.1 SlackModule 구성
```typescript
// src/slack/slack-feature.module.ts
import { Module } from '@nestjs/common';
import { SlackModule } from 'nestjs-slack-bolt';
import { SlackEventsController } from './slack-events.controller';
import { SlackCommandsController } from './slack-commands.controller';
import { SlackActionsController } from './slack-actions.controller';

@Module({
  imports: [
    SlackModule.forRoot({
      // 환경 변수 기반 자동 설정
    })
  ],
  controllers: [
    SlackEventsController,
    SlackCommandsController,
    SlackActionsController
  ],
})
export class SlackFeatureModule {}
```

### 2.2 환경 변수 (Environment Variables)
```bash
# 공통
SLACK_BOT_TOKEN=xoxb-...

# 개발 환경 (Socket Mode)
SLACK_SOCKET_MODE=true
SLACK_APP_TOKEN=xapp-...

# 운영 환경 (HTTP Mode)
SLACK_SOCKET_MODE=false
SLACK_SIGNING_SECRET=...
```

---

## 3. 이벤트 핸들러 패턴

`nestjs-slack-bolt`에서 제공하는 데코레이터를 사용하여 이벤트를 라우팅합니다.

```typescript
// src/slack/slack-events.controller.ts
import { Controller } from '@nestjs/common';
import { Message, Event, SlackEventMiddlewareArgs } from 'nestjs-slack-bolt';
import { IngestService } from '../drafts/ingest.service';

@Controller()
export class SlackEventsController {
  constructor(private readonly ingestService: IngestService) {}
  
  // 모든 채널 메시지 수신 및 수집
  @Message()
  async onMessage({ message, client }: SlackEventMiddlewareArgs<'message'>) {
    // 봇 자신의 메시지는 무시 (nestjs-slack-bolt가 기본 처리하지만 명시적 체크 권장)
    if ('subtype' in message && message.subtype === 'bot_message') return;
    
    await this.ingestService.processMessage(message);
  }
  
  // 특정 리액션 감지 시 의사결정 프로세스 트리거
  @Event('reaction_added')
  async onReaction({ event }: SlackEventMiddlewareArgs<'reaction_added'>) {
    if (event.reaction === 'white_check_mark' || event.reaction === 'white_check_mark') {
      await this.ingestService.markAsDecision(event);
    }
  }
}
```

---

## 4. 슬래시 커맨드

사용자가 명시적으로 봇의 기능을 호출할 때 사용합니다.

```typescript
// src/slack/slack-commands.controller.ts
@Controller()
export class SlackCommandsController {
  @Command('/scrum-summarize')
  async summarize({ command, ack, client }) {
    await ack(); // 3초 이내 응답 필수
    
    // LangGraph 호출 및 요약 생성 로직 실행
    // 결과는 chat.postMessage 또는 respond로 발송
  }

  @Command('/scrum-draft')
  async createDraft({ command, ack, client }) {
    await ack();
    // 현재 스레드나 메시지를 기반으로 Jira Draft 생성 트리거
  }
}
```

---

## 5. Block Kit 승인 플로우 (Phase 1+)

의사결정 및 티켓 생성에 인간의 승인(HITL)을 개입시키는 플로우입니다.

### 5.1 카드 구성
- **Decision Card**: 대화 중 포착된 결정을 요약하여 보여줌.
  - 버튼: `[Jira Draft 생성]` `[결정 기록]` `[무시]`
- **Approval Card**: 생성된 Jira Draft를 보여주고 최종 승인 요청.
  - 버튼: `[승인]` `[거절]` `[대시보드에서 편집]`

### 5.2 액션 핸들러
```typescript
// src/slack/slack-actions.controller.ts
@Controller()
export class SlackActionsController {
  @Action('approve_draft')
  async onApprove({ action, ack, body }) {
    await ack();
    // Draft 상태를 APPROVED로 변경 및 Jira 실행 트리거
  }

  @Action('reject_draft')
  async onReject({ action, ack }) {
    await ack();
    // Draft 상태를 REJECTED로 변경
  }
}
```

---

## 6. 결정 감지 규칙 (Multi-signal)

단순 키워드 매칭의 오탐(False Positive)을 방지하기 위해 다중 신호 정책을 사용합니다.

- **확정 신호 (Positive Signal)**: 
  - (키워드: "확정", "결정", "진행", "이대로") **AND** (리액션: white_check_mark)
- **변경 신호 (Change Signal)**:
  - (키워드: "변경", "수정", "우선순위") **AND** (스레드 내 합의 2명 이상 참여)
- **Phase 0 범위**:
  - 자동 감지보다는 `/scrum-summarize`와 같은 수동 트리거를 우선 구현하여 데이터 수집.

---

## 7. 채널 정책

봇의 동작 범위를 제한하여 스팸을 방지합니다.
- `#pjt-scrum`: 요약 보고서 발송 전용.
- `#pjt-discuss`: 봇이 메시지를 상시 수집하고 분석하는 대상 채널.
- `#pjt-decisions`: 확정된 결정 사항만 아카이브되는 채널.

---

## 8. Socket Mode vs HTTP Mode

| 구분 | Socket Mode (Development) | HTTP Mode (Production) |
|------|---------------------------|-------------------------|
| **연결 방식** | WebSocket (Outbound) | HTTPS (Inbound) |
| **공개 URL** | 불필요 | 필요 (Cloudflare Tunnel 권장) |
| **보안** | App Token 기반 | Signing Secret 서명 검증 |
| **특징** | 로컬 개발 및 방화벽 환경에 적합 | 높은 안정성 및 확장성 |

---

## 9. 멱등성 (Idempotency)

Slack은 이벤트 배달을 보장하기 위해 동일한 이벤트를 재전송할 수 있습니다. Bolt SDK가 일부 처리하지만, 비즈니스 로직 레벨에서의 중복 방지가 필요합니다.

- **전략**: `slack_events` 테이블에 `(channel_id + message_ts)` 또는 `event_id`를 UNIQUE 제약 조건으로 저장.
- **처리**: 메시지 처리 전 DB 조회를 통해 이미 처리된 `ts`인지 확인.

---

## Phase별 범위
| Phase | 이 문서에서의 범위 |
|-------|--------------------|
| 0     | Socket Mode 설정, 기초 메시지 수집(@Message), 슬래시 커맨드 수동 트리거 |
| 1     | Block Kit 인터랙션(@Action), 승인/거절 버튼 연동, 자동 결정 감지 로직 |
| 2+    | 멀티 채널 정책 고도화, 복합 액션(모달 편집 등) 추가 |

## 관련 문서
- [ARCHITECTURE.md](./ARCHITECTURE.md) — 전체 시스템 구조
- [API-CONTRACTS.md](./API-CONTRACTS.md) — 백엔드 API 명세
