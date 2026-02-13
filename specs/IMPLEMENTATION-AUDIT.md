# Scrum Bot 구현 점검 (ROADMAP 기준)

- 점검 일시: 2026-02-13
- 기준 문서: `specs/ROADMAP.md`
- 점검 방식: 코드 구조/엔드포인트/테스트 실행 결과 기반 정적 점검

## 종합 결론

- **기능 범위 기준으로는 Phase 0~2 대부분이 구현되어 있음**.
- **Phase 3는 부분 구현 상태**(OTel/비용/평가/보안 가드 존재, 운영 자동화 성숙도는 추가 검증 필요).
- **로드맵의 정량 KPI(수집 성공률 99%, P95 30초)는 저장소만으로 검증 불가**(별도 운영 메트릭 필요).
- **현재 테스트는 거의 통과하지만 `DraftService` 관련 단위 테스트 3건 실패**로 회귀 위험이 존재.

## Phase별 구현 점검

### Phase 0 (기반 구축)

- Slack 이벤트/커맨드 핸들링 구현: `@Message`, `@Event`, `/scrum`, `/scrum-draft`, `/scrum-review` 확인.
- 데이터 수집/요약 API 구현: `/api/summaries`, `/api/summarize`, `/health` 확인.
- 기본 저장소 구조 구현: `slack_events`, `summaries` 테이블 확인.
- 배포 아티팩트 존재: `docker-compose.yml`, bot/web/db Dockerfile 확인.
- 대시보드/웹 라우트 존재: `dashboard`, `meetings`, `drafts` 등 라우트 확인.

**판정: 구현됨(정량 KPI는 별도 운영 검증 필요)**

### Phase 1 (자동화 및 흐름 제어)

- 결정 감지: 메시지/리액션 기반 판단 로직 확인.
- Draft CRUD + 승인/거절 API 구현 확인.
- Jira 생성/수정/전환 처리 경로 및 sync log 기록 확인.
- Slack 상호작용 컨트롤러/알림 서비스 및 Approval 노드(HITL interrupt) 확인.

**판정: 구현됨**

### Phase 2 (멀티에이전트 고도화)

- LangGraph에 Biz/QA/Design/Conflict/Synthesize 포함된 멀티노드 그래프 확인.
- `context_chunks`, `decisions`, `agent_runs`, `agent_messages` 등 확장 데이터 모델 확인.
- 결정/실행 이력/설정용 API 및 웹 라우트(`decisions`, `runs`, `settings`) 확인.
- 프롬프트 분리(`biz-review`, `qa-review`, `design-review`, `scrum-master`) 확인.

**판정: 구현됨**

### Phase 3 (운영 성숙 및 최적화)

- OTel 초기화 및 전역 인터셉터 존재.
- 비용 추적(`token_usage_log`, cost service), 자동 평가(eval service), 보존 정책(retention) 존재.
- 인증/권한 가드(Auth/Roles) 존재.
- 다만 SLO 대시보드, 실서비스 부하 기반 최적화 효과는 저장소만으로 확인 불가.

**판정: 부분 구현(운영 검증 필요)**

## 리스크/보완 포인트

1. **테스트 안정성**: `DraftService` 스펙 3건 실패(예외 메시지 기대값 불일치).
2. **운영 KPI 미검증**: 로드맵 성공 기준(성공률/P95)은 코드 저장소 수준에서 증빙 불가.
3. **문서 상태 동기화 필요**: 실제 구현 범위가 ROADMAP의 Draft 상태보다 앞서 있으므로 상태 갱신 검토 권장.

## 실행한 검증 명령

- `pnpm -C apps/bot test -- --runInBand` (실패: 잘못된 인자 전달로 테스트 패턴 미일치)
- `pnpm -C apps/bot test --runInBand` (실패: 23개 스위트 중 1개 실패, 224개 테스트 중 3개 실패)
- `rg "@Controller|@Get\(|@Post\(|@Patch\(" apps/bot/src -g '*.ts'`
- `rg --files | rg -i 'docker-compose|compose|Dockerfile|\\.yml$|\\.yaml$'`

