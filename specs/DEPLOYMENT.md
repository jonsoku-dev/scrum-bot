# Deployment Specification (DEPLOYMENT.md)

> Cloudflare Tunnel과 Docker를 활용한 AI-Augmented Scrum Bot 배포 및 운영 가이드

| Status | Phase | Last Updated | Depends On |
|--------|-------|-------------|------------|
| Draft  | 0-3   | 2026-02-10  | ARCHITECTURE.md |

---

## 1. 배포 전략
- **기존 인프라 활용**: ai-apps 레포지토리의 표준 패턴을 따른다.
- **컨테이너화**: Docker를 사용하여 애플리케이션 환경을 격리한다.
- **터널링**: Cloudflare Tunnel을 사용하여 외부 트래픽을 안전하게 내부 서버로 라우팅한다.
- **도메인**: `scrum-bot.a-jon.org`

## 2. Dockerfile (Bot App)
ai-apps의 멀티스테이지 빌드 패턴을 적용하여 최적화된 이미지를 생성한다.

```dockerfile
# Multi-stage build
FROM node:24-alpine AS builder
WORKDIR /app
COPY package*.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:24-alpine AS production
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

EXPOSE 8000
ENV PORT=8000 NODE_ENV=production

HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8000/health || exit 1

CMD ["node", "dist/main.js"]
```

## 3. 개별 Dockerfile 기반 운영
각 앱은 독립적인 Dockerfile을 가지며, docker-compose 없이 개별적으로 빌드/실행한다.

### Bot 실행
```bash
docker build -t scrum-bot-api ./apps/bot
docker run -d --name scrum-bot-api -p 8000:8000 \
  -e SLACK_BOT_TOKEN=${SLACK_BOT_TOKEN} \
  -e SLACK_APP_TOKEN=${SLACK_APP_TOKEN} \
  -e SLACK_SOCKET_MODE=true \
  -e DATABASE_URL=mysql://scrum:scrum@host.docker.internal:3307/scrumbot \
  -e OPENAI_API_KEY=${OPENAI_API_KEY} \
  --restart unless-stopped scrum-bot-api
```

### Web 실행
```bash
docker build -t scrum-bot-web ./apps/web
docker run -d --name scrum-bot-web -p 8001:8001 \
  -e API_URL=http://host.docker.internal:8000 \
  -e PORT=8001 \
  --restart unless-stopped scrum-bot-web
```

### DB 실행 (MySQL 8)
```bash
docker run -d --name scrum-bot-db -p 3307:3306 \
  -e MYSQL_ROOT_PASSWORD=root \
  -e MYSQL_DATABASE=scrumbot \
  -e MYSQL_USER=scrum \
  -e MYSQL_PASSWORD=scrum \
  -v scrumbot-mysql:/var/lib/mysql \
  --restart unless-stopped mysql:8
```

## 4. 환경변수 관리
| 변수 | 필수 | 설명 | 적용 Phase |
|------|------|------|------------|
| SLACK_BOT_TOKEN | Y | Slack Bot API 토큰 | Phase 0 |
| SLACK_APP_TOKEN | dev | Socket Mode 사용을 위한 App 토큰 | Phase 0 |
| SLACK_SIGNING_SECRET | prod | HTTP Mode(Events API) 검증용 시크릿 | Phase 0 |
| SLACK_SOCKET_MODE | Y | true(개발/Socket) / false(운영/HTTP) | Phase 0 |
| DATABASE_URL | Y | MySQL 연결 문자열 | Phase 0 |
| OPENAI_API_KEY | Y | LLM(GPT-4o 등) API 키 | Phase 0 |
| JIRA_BASE_URL | Phase 1 | Jira Cloud 인스턴스 URL | Phase 1 |
| JIRA_API_TOKEN | Phase 1 | Jira API 토큰 (PAT) | Phase 1 |
| JIRA_USER_EMAIL | Phase 1 | Jira 봇 계정 이메일 | Phase 1 |

## 5. Cloudflare Tunnel 설정
- **Tunnel ID**: `d124deb0-5fc2-44a6-99b6-197927bd89e5`
- **Ingress 구성**: `/etc/cloudflared/config.yml`에 아래 내용 추가
  - `hostname: scrum-bot.a-jon.org`
    `path: /api`
    `service: http://localhost:8000`
  - `hostname: scrum-bot.a-jon.org`
    `service: http://localhost:8001`
  - `service: http_status:404`

## 6. Health Check
`GET /health` 엔드포인트는 다음 상태를 반환해야 한다:
```json
{
  "status": "ok",
  "db": "connected",
  "slack": "connected",
  "version": "1.0.0"
}
```

## 7. 장애 대응 전략
- **Slack API 장애**: 메시지 수집이 중단되더라도 기존 데이터 기반 Draft 생성 기능은 유지한다.
- **Jira API 장애**: 승인된 변경 사항을 큐(Queue)에 적재하고 Jira 서비스 복구 시 재시도한다.
- **DB 장애**: 인입되는 이벤트를 메시지 큐에 임시 저장하고 복구 후 순차적으로 처리한다.

---

## Phase별 범위
| Phase | 이 문서에서의 범위 |
|-------|--------------------|
| Phase 0 | Docker 빌드 환경 구축 및 단일 서버 배포 (Socket Mode), 개별 Dockerfile 운영 |
| Phase 1 | Jira 연동 환경 변수 및 큐잉 시스템(BullMQ) 도입 |
| Phase 2+ | 수평 확장(Horizontal Scaling) 및 OTel 기반 관측성 확보 |

## 관련 문서
- [ARCHITECTURE.md](./ARCHITECTURE.md) — 모듈 구성 및 의존 관계
