# AI Scrum Bot - Setup Guide

## 목차

1. [사전 준비 (Prerequisites)](#1-사전-준비)
2. [MySQL 데이터베이스 실행](#2-mysql-데이터베이스-실행)
3. [Slack App 생성 및 설정](#3-slack-app-생성-및-설정)
4. [OpenAI API Key 발급](#4-openai-api-key-발급)
5. [Jira 연동 설정 (선택)](#5-jira-연동-설정-선택)
6. [환경변수 설정 (.env)](#6-환경변수-설정)
7. [애플리케이션 실행](#7-애플리케이션-실행)
8. [동작 확인](#8-동작-확인)
9. [문제 해결 (Troubleshooting)](#9-문제-해결)

---

## 1. 사전 준비

| 도구 | 최소 버전 | 확인 명령어 |
|------|-----------|------------|
| Node.js | 22+ | `node -v` |
| pnpm | 10+ | `pnpm -v` |
| Docker & Docker Compose | - | `docker compose version` |

```bash
# pnpm이 없으면 설치
corepack enable
corepack prepare pnpm@latest --activate

# 의존성 설치
cd /home/jonsoku/ai-apps/scrum-bot
pnpm install
```

---

## 2. MySQL 데이터베이스 실행

프로젝트 루트에 `docker-compose.yml`이 있습니다. MySQL 8.4를 실행합니다.

```bash
docker compose up -d
```

이 명령으로 다음 설정의 MySQL이 실행됩니다:

| 항목 | 값 |
|------|-----|
| 호스트 | `localhost` |
| 포트 | `3306` |
| 데이터베이스명 | `scrumbot` |
| 사용자 | `scrum` |
| 비밀번호 | `scrum` |
| root 비밀번호 | `rootpassword` |
| 인코딩 | `utf8mb4` |

MySQL이 정상 기동되었는지 확인:

```bash
docker compose ps
# STATUS가 "healthy"인지 확인

# 또는 직접 접속 테스트
docker exec -it scrumbot-mysql mysql -u scrum -pscrum scrumbot -e "SELECT 1;"
```

---

## 3. Slack App 생성 및 설정

### Step 1: Slack App 생성

1. https://api.slack.com/apps 접속
2. **"Create New App"** 클릭
3. **"From scratch"** 선택
4. **App Name**: `Scrum Bot` (원하는 이름)
5. **Workspace**: 사용할 워크스페이스 선택
6. **"Create App"** 클릭

### Step 2: Bot Token Scopes 설정

**OAuth & Permissions** 메뉴로 이동 → **Bot Token Scopes** 섹션:

| Scope | 용도 |
|-------|------|
| `chat:write` | 메시지/Decision Card/Approval Card 발송 |
| `channels:history` | 퍼블릭 채널 메시지 읽기 |
| `groups:history` | 프라이빗 채널 메시지 읽기 |
| `im:history` | DM 메시지 읽기 |
| `mpim:history` | 그룹 DM 메시지 읽기 |
| `app_mentions:read` | @멘션 수신 |
| `commands` | 슬래시 명령어 (`/scrum-review`, `/scrum-draft`) |
| `channels:read` | 채널 정보 조회 (선택) |
| `users:read` | 사용자 정보 조회 (선택) |
| `reactions:read` | 리액션 감지 — 결정 감지에 사용 (선택) |

### Step 3: Socket Mode 활성화

1. **Socket Mode** 메뉴로 이동
2. **"Enable Socket Mode"** 토글 ON
3. **"Basic Information"** → **"App-Level Tokens"** 섹션
4. **"Generate Token and Scopes"** 클릭
5. **Token Name**: `socket-mode` (아무 이름)
6. **Scope**: `connections:write` 추가
7. **"Generate"** 클릭
8. 생성된 `xapp-` 토큰 복사 → **이것이 `SLACK_APP_TOKEN`**

### Step 4: Event Subscriptions 설정

1. **Event Subscriptions** 메뉴 이동
2. **"Enable Events"** 토글 ON
3. Request URL은 비워두기 (Socket Mode에서는 불필요)
4. **"Subscribe to bot events"** 에서 다음 이벤트 추가:

| 이벤트 | 용도 |
|--------|------|
| `message.channels` | 퍼블릭 채널 메시지 수신 |
| `message.groups` | 프라이빗 채널 메시지 수신 |
| `message.im` | DM 수신 |
| `app_mention` | @멘션 수신 |

5. **"Save Changes"** 클릭

### Step 5: Interactivity 활성화

1. **Interactivity & Shortcuts** 메뉴 이동
2. **"Interactivity"** 토글 ON
3. Request URL은 비워두기 (Socket Mode)
4. **"Save Changes"** 클릭

> Block Kit 버튼(승인/거절/Decision Card)이 동작하려면 반드시 필요합니다.

### Step 6: App 설치 및 토큰 획득

1. **OAuth & Permissions** 메뉴 이동
2. **"Install to Workspace"** 클릭
3. 권한 확인 → **"Allow"** 클릭
4. **Bot User OAuth Token** 복사 (`xoxb-` 로 시작) → **이것이 `SLACK_BOT_TOKEN`**

### Step 7: Signing Secret 확인 (선택)

1. **Basic Information** 메뉴 이동
2. **"App Credentials"** 섹션
3. **Signing Secret** 복사 → **이것이 `SLACK_SIGNING_SECRET`**

> Socket Mode에서는 Signing Secret이 필수는 아닙니다.

---

## 4. OpenAI API Key 발급

1. https://platform.openai.com/api-keys 접속
2. **"Create new secret key"** 클릭
3. 이름 지정 → **"Create secret key"** 클릭
4. `sk-` 로 시작하는 키 복사 → **이것이 `OPENAI_API_KEY`**

### 사내/On-Premise LLM 사용 (선택)

OpenAI API 호환 엔드포인트(vLLM, Ollama, Azure OpenAI, LiteLLM 등)를 사용할 수 있습니다.

```dotenv
# 사내 LLM 엔드포인트 (기본값: https://api.openai.com/v1)
OPENAI_BASE_URL=https://your-internal-llm.company.com/v1

# 사내 LLM의 API 키 (sk- 접두사 불필요)
OPENAI_API_KEY=your-internal-api-key

# 사내 LLM에서 사용할 모델명
OPENAI_MODEL=your-model-name
```

| 호환 플랫폼 | `OPENAI_BASE_URL` 예시 |
|---|---|
| vLLM | `http://localhost:8000/v1` |
| Ollama | `http://localhost:11434/v1` |
| Azure OpenAI | `https://{resource}.openai.azure.com/openai/deployments/{deployment}` |
| LiteLLM Proxy | `http://localhost:4000/v1` |
| AWS Bedrock (via proxy) | proxy 서버 URL |

> **주의**: 사내 LLM 사용 시 임베딩 모델(`OPENAI_EMBEDDING_MODEL`)도 해당 엔드포인트에서
> 지원하는 모델로 변경해야 합니다. 임베딩 API가 없으면 컨텍스트 검색 기능이 비활성화됩니다.

### 사용되는 모델

| 모델 | 용도 | 환경변수 |
|------|------|----------|
| `gpt-4o-mini` (기본값) | LangGraph 노드들의 LLM 호출 (분류, 추출, 리뷰, 합성, 드래프트 생성) | `OPENAI_MODEL` |
| `text-embedding-3-small` (기본값) | 컨텍스트 임베딩 및 유사도 검색 | `OPENAI_EMBEDDING_MODEL` |

> `gpt-4o-mini`는 가성비가 좋습니다. 더 높은 품질이 필요하면 `gpt-4o`로 변경하세요.
> 단, 비용이 약 17배 증가합니다 ($0.15/1M → $2.50/1M prompt tokens).

### 비용 참고

| 모델 | Prompt (1M tokens) | Completion (1M tokens) |
|------|-------|------------|
| gpt-4o-mini | $0.15 | $0.60 |
| gpt-4o | $2.50 | $10.00 |
| text-embedding-3-small | $0.02 | - |

`DAILY_BUDGET_USD` 환경변수로 일일 비용 상한을 설정할 수 있습니다 (기본값: $10).

---

## 5. Jira 연동 설정 (선택)

Jira 연동은 **선택사항**입니다. 설정하지 않으면 LangGraph의 `commit_to_jira` 노드가 스킵됩니다.

### Step 1: Jira API Token 생성

1. https://id.atlassian.com/manage-profile/security/api-tokens 접속
2. **"Create API token"** 클릭
3. 라벨 입력 → **"Create"** 클릭
4. 토큰 복사 → **이것이 `JIRA_API_TOKEN`**

### Step 2: 필요한 정보 확인

| 항목 | 확인 방법 | 예시 |
|------|-----------|------|
| `JIRA_BASE_URL` | Jira Cloud 접속 시 URL | `https://your-org.atlassian.net` |
| `JIRA_EMAIL` | Jira 로그인 이메일 | `bot@your-org.com` |
| `JIRA_PROJECT_KEY` | 프로젝트 설정 → Key | `PROJ`, `TEAM`, `DEV` |

### Step 3: Jira Webhook 설정 (선택)

Jira 이슈 변경 시 Slack 알림을 받으려면:

1. Jira → 프로젝트 설정 → **Webhooks**
2. **"Create a Webhook"** 클릭
3. **URL**: `https://your-domain.com/api/jira/webhook` (외부 접근 가능한 URL 필요)
4. **Events**: `Issue: created`, `Issue: updated` 선택
5. `JIRA_NOTIFY_CHANNEL_ID`에 알림을 받을 Slack 채널 ID 설정

> Slack 채널 ID 확인: Slack에서 채널 우클릭 → "Copy link" → URL의 마지막 부분 (예: `C0123456789`)

---

## 6. 환경변수 설정

프로젝트 루트에 `.env` 파일을 생성합니다:

```bash
cp .env.example .env
```

그리고 아래 가이드에 따라 값을 채워 넣습니다.

### 전체 환경변수 목록

```dotenv
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# [필수] Slack 설정
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Bot User OAuth Token (OAuth & Permissions → Bot User OAuth Token)
SLACK_BOT_TOKEN=xoxb-여기에-실제-토큰-입력

# App-Level Token (Basic Information → App-Level Tokens)
SLACK_APP_TOKEN=xapp-여기에-실제-토큰-입력

# Socket Mode 사용 여부 (true 권장)
SLACK_SOCKET_MODE=true

# Signing Secret (Basic Information → App Credentials)
# Socket Mode에서는 필수가 아니지만 설정 권장
SLACK_SIGNING_SECRET=

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# [필수] 데이터베이스
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# docker compose를 사용하면 아래 값 그대로 사용
DATABASE_URL=mysql://scrum:scrum@localhost:3306/scrumbot

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# [필수] OpenAI
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OPENAI_API_KEY=sk-여기에-실제-키-입력

# LLM 모델 (기본값: gpt-4o-mini)
OPENAI_MODEL=gpt-4o-mini

# 임베딩 모델 (기본값: text-embedding-3-small)
# OPENAI_EMBEDDING_MODEL=text-embedding-3-small

# 사내/On-Premise LLM 사용 시 (기본값: https://api.openai.com/v1)
# OPENAI_BASE_URL=https://your-internal-llm.company.com/v1

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# [선택] Jira 연동
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 3개 모두 설정해야 Jira 연동이 활성화됩니다
JIRA_BASE_URL=https://your-org.atlassian.net
JIRA_EMAIL=bot@your-org.com
JIRA_API_TOKEN=여기에-실제-토큰-입력
JIRA_PROJECT_KEY=PROJ

# Jira Webhook 관련
JIRA_WEBHOOK_SECRET=
JIRA_NOTIFY_CHANNEL_ID=

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# [선택] 비용/서버
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 일일 OpenAI API 비용 상한 (USD)
DAILY_BUDGET_USD=10

# 백엔드 서버 포트 (기본값: 8000)
PORT=8000
```

### 최소 실행에 필요한 변수 (Jira 없이)

```dotenv
SLACK_BOT_TOKEN=xoxb-...
SLACK_APP_TOKEN=xapp-...
SLACK_SOCKET_MODE=true
DATABASE_URL=mysql://scrum:scrum@localhost:3306/scrumbot
OPENAI_API_KEY=sk-...
```

이 5개만 있으면 앱이 기동됩니다.

### 프론트엔드 환경변수 (선택)

프론트엔드(`apps/web`)는 Vite를 사용합니다. `apps/web/.env` 파일에:

```dotenv
# 백엔드 API 주소 (기본값: http://localhost:8000)
# 개발 시에는 vite.config.ts의 proxy 설정이 자동 처리하므로 보통 불필요
VITE_API_URL=http://localhost:8000
```

> 개발 환경에서는 `vite.config.ts`에 proxy 설정(`/api → localhost:8000`)이 이미 있으므로
> `VITE_API_URL`을 별도로 설정하지 않아도 됩니다.

---

## 7. 애플리케이션 실행

### 7.1 데이터베이스 테이블 생성

```bash
cd apps/bot
pnpm db:push
```

이 명령으로 MySQL에 17개 테이블이 생성됩니다:
`slack_events`, `summaries`, `context_chunks`, `decisions`, `drafts`,
`jira_sync_log`, `agent_runs`, `jira_issue_snapshots`, `agent_messages`,
`approvals`, `token_usage_log`, `audit_log`, `jira_webhook_events`,
`meeting_minutes`, `system_settings`, `api_keys`, `evaluations`

### 7.2 개발 서버 실행

```bash
# 프로젝트 루트에서
cd /home/jonsoku/ai-apps/scrum-bot

# 백엔드만 실행
pnpm dev:bot

# 프론트엔드만 실행 (별도 터미널)
pnpm dev:web

# 또는 둘 다 동시에
pnpm dev
```

| 서비스 | URL |
|--------|-----|
| 백엔드 API | http://localhost:8000 |
| Swagger API 문서 | http://localhost:8000/api |
| 프론트엔드 대시보드 | http://localhost:5173 (dev) |
| 프론트엔드 (빌드 후 서빙) | http://localhost:8000 (NestJS ServeStatic) |

### 7.3 프론트엔드 빌드 (프로덕션)

```bash
pnpm build:web
```

빌드 후 `apps/web/build/client/`에 정적 파일이 생성되고,
NestJS의 `ServeStaticModule`이 자동으로 이 파일을 서빙합니다.
즉, `pnpm dev:bot`만 실행해도 http://localhost:8000 에서 프론트엔드에 접근 가능합니다.

---

## 8. 동작 확인

### 8.1 서버 헬스 체크

```bash
curl http://localhost:8000/api/health
# 응답: {"status":"ok","timestamp":"..."}
```

### 8.2 Slack 봇 동작 확인

1. Slack에서 봇을 채널에 초대: `/invite @ScrumBot`
2. 채널에 테스트 메시지 전송
3. 서버 로그에 메시지 수신 로그 확인
4. 슬래시 명령어 테스트: `/scrum-review` 또는 `/scrum-draft`

### 8.3 대시보드 확인

1. http://localhost:8000 접속 (빌드 후) 또는 http://localhost:5173 (dev 모드)
2. Dashboard → 최근 활동 확인
3. Meetings → 회의록 업로드 테스트
4. Settings → Slack/Jira 연결 상태 확인

### 8.4 Jira 연동 확인 (설정한 경우)

```bash
# Jira 연결 테스트 — Settings API
curl http://localhost:8000/api/settings
# integrations.jira.connected가 true인지 확인
```

---

## 9. 문제 해결

### Slack 관련

| 증상 | 원인 | 해결 |
|------|------|------|
| `SLACK_BOT_TOKEN` 검증 실패 | 토큰이 `xoxb-`로 시작하지 않음 | OAuth & Permissions에서 Bot Token 재확인 |
| 메시지 수신 안됨 | Event Subscriptions 미설정 | `message.channels` 등 이벤트 구독 추가 후 **Save** |
| 메시지 수신 안됨 | 봇이 채널에 없음 | `/invite @ScrumBot`으로 채널에 초대 |
| 버튼 클릭 무반응 | Interactivity 미활성화 | Interactivity & Shortcuts → ON |
| Socket Mode 연결 실패 | `SLACK_APP_TOKEN` 미설정 또는 만료 | Basic Information → App-Level Tokens에서 재생성 |
| `missing_scope` 에러 | Bot Token Scope 부족 | OAuth & Permissions에서 scope 추가 → **앱 재설치** |

> scope를 추가한 후에는 반드시 **"Reinstall to Workspace"** 를 해야 적용됩니다.

### 데이터베이스 관련

| 증상 | 원인 | 해결 |
|------|------|------|
| `ECONNREFUSED 127.0.0.1:3306` | MySQL 미실행 | `docker compose up -d` |
| `Access denied for user` | 자격 증명 불일치 | `DATABASE_URL`의 user/password가 docker-compose.yml과 일치하는지 확인 |
| `db:push` 실패 | MySQL 아직 기동 중 | `docker compose ps`로 healthy 확인 후 재시도 |
| `Table already exists` | 이미 테이블 존재 | 정상. `db:push`는 기존 테이블을 변경하지 않음 |

### OpenAI 관련

| 증상 | 원인 | 해결 |
|------|------|------|
| `401 Unauthorized` | API Key 잘못됨 | https://platform.openai.com/api-keys 에서 재발급 |
| `429 Too Many Requests` | Rate limit 초과 | 잠시 후 재시도 또는 Usage tier 업그레이드 |
| `Insufficient quota` | 크레딧 소진 | https://platform.openai.com/settings/organization/billing 에서 충전 |
| 비용 초과 경고 | `DAILY_BUDGET_USD` 초과 | 값을 올리거나, 요약/추출만 수행하는 degrade 모드로 자동 전환됨 |

### Jira 관련

| 증상 | 원인 | 해결 |
|------|------|------|
| `JIRA_BASE_URL is not configured` | 환경변수 미설정 | `.env`에 3개 변수 모두 설정 필요 |
| `401` 에러 | email 또는 API token 잘못됨 | https://id.atlassian.com/manage-profile/security/api-tokens 에서 토큰 재생성 |
| 이슈 생성 시 `project not found` | `JIRA_PROJECT_KEY` 불일치 | Jira에서 실제 프로젝트 Key 확인 |
| Webhook 알림 안옴 | `JIRA_NOTIFY_CHANNEL_ID` 미설정 | Slack 채널 ID 설정 필요 |

---

## 환경변수 빠른 참조

| 변수명 | 필수 | 기본값 | 설명 |
|--------|------|--------|------|
| `SLACK_BOT_TOKEN` | **필수** | - | Bot User OAuth Token (`xoxb-`) |
| `SLACK_APP_TOKEN` | **필수** | - | App-Level Token for Socket Mode (`xapp-`) |
| `SLACK_SOCKET_MODE` | 선택 | `true` | Socket Mode 사용 여부 |
| `SLACK_SIGNING_SECRET` | 선택 | - | Slack 요청 서명 검증 |
| `DATABASE_URL` | **필수** | - | MySQL 연결 문자열 |
| `OPENAI_API_KEY` | **필수** | - | OpenAI API 키 |
| `OPENAI_MODEL` | 선택 | `gpt-4o-mini` | LLM 모델명 |
| `OPENAI_EMBEDDING_MODEL` | 선택 | `text-embedding-3-small` | 임베딩 모델명 |
| `OPENAI_BASE_URL` | 선택 | `https://api.openai.com/v1` | OpenAI 호환 API 엔드포인트 (사내 LLM용) |
| `JIRA_BASE_URL` | 선택 | - | Jira Cloud URL |
| `JIRA_EMAIL` | 선택 | - | Jira 인증용 이메일 |
| `JIRA_API_TOKEN` | 선택 | - | Jira API 토큰 |
| `JIRA_PROJECT_KEY` | 선택 | `PROJ` | 기본 프로젝트 키 |
| `JIRA_WEBHOOK_SECRET` | 선택 | - | Jira Webhook 시크릿 |
| `JIRA_NOTIFY_CHANNEL_ID` | 선택 | - | Jira 알림 Slack 채널 ID |
| `DAILY_BUDGET_USD` | 선택 | `10` | 일일 LLM 비용 상한 (USD) |
| `PORT` | 선택 | `8000` | 백엔드 서버 포트 |
| `VITE_API_URL` | 선택 | `http://localhost:8000` | 프론트엔드 API 엔드포인트 |

---

## 10. 토큰 회전 및 만료 정책

### Slack 토큰

| 토큰 | 회전 주기 | 방법 |
|------|-----------|------|
| `SLACK_BOT_TOKEN` (`xoxb-`) | 자동 만료 없음 | Reinstall App 시 갱신. 보안 이슈 시 즉시 재설치 |
| `SLACK_APP_TOKEN` (`xapp-`) | 자동 만료 없음 | Basic Information → App-Level Tokens에서 Revoke → 재생성 |

권장: 분기별 1회 토큰 재생성. `.env` 업데이트 후 서버 재시작.

### OpenAI API Key

| 항목 | 정책 |
|------|------|
| 회전 주기 | 분기별 1회 권장 |
| 방법 | https://platform.openai.com/api-keys → 새 키 생성 → `.env` 교체 → 이전 키 삭제 |
| 비용 보호 | `DAILY_BUDGET_USD` 설정으로 일일 상한 적용 (기본: $10) |
| 사내 LLM | 자체 인증 정책 따름 |

### Jira API Token

| 항목 | 정책 |
|------|------|
| 만료 | Atlassian 정책에 따라 자동 만료될 수 있음 |
| 회전 | https://id.atlassian.com/manage-profile/security/api-tokens 에서 재생성 |
| 권장 | 전용 서비스 계정 (`bot@org.com`) 사용. 개인 계정 사용 금지 |

### 환경변수 보안

- `.env` 파일은 반드시 `.gitignore`에 포함
- 프로덕션 배포 시 환경변수는 시크릿 매니저(Vault, AWS Secrets Manager 등) 사용 권장
- API 키가 로그에 노출되지 않도록 주의 (앱은 키를 로깅하지 않음)
