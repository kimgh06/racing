# Falcare Racing (Remix + React Three Fiber + Rapier)

이 저장소는 `@remix-run` 기반의 웹 레이싱 데모입니다.  
`react-three-fiber`, `@react-three/drei`, `@react-three/rapier`를 사용해 3D 씬과 물리를 구현했습니다.

## 개발 환경

```bash
# 의존성 설치
npm install

# 개발 서버 (HMR)
npm run dev
```

기본적으로 `http://localhost:5173` (또는 Remix 설정에 따라 다른 포트)에서 접근할 수 있습니다.

## 프로덕션 빌드

```bash
# 빌드
npm run build

# 로컬에서 프로덕션 서버 실행
npm run start
```

`npm run start`는 `remix-serve build`를 사용합니다. 기본 포트는 `3000`입니다.

## Docker 배포

이 레포에는 프로덕션 배포용 `Dockerfile`과 `docker-compose.yml`이 포함되어 있습니다.

### 1. Docker 이미지 빌드 & 컨테이너 실행

```bash
# 빌드 및 백그라운드 실행
docker compose up --build -d
```

완료 후 브라우저에서 다음 주소로 접속합니다.

- `http://localhost:2313`

### 2. 서비스 이름

`docker-compose.yml`에서 정의된 서비스 이름은 `falcare` 입니다.

```yaml
services:
  falcare:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: falcare
    ports:
      - "2313:3000"
    environment:
      NODE_ENV: production
      PORT: 3000
```

### 3. 유용한 Docker 명령

```bash
# 로그 보기
docker compose logs -f falcare

# 컨테이너 중지
docker compose stop falcare

# 전체 스택 종료
docker compose down
```

## 주요 기술 스택

- **Framework**: Remix (`@remix-run/node`, `@remix-run/react`, `@remix-run/serve`)
- **3D / 렌더링**: `@react-three/fiber`, `@react-three/drei`, `three`
- **물리 엔진**: `@react-three/rapier`, `@dimforge/rapier3d-compat`
- **상태 관리**: `zustand`
- **번들러/빌드**: `@remix-run/dev`, `vite`

## 라이선스

별도 명시가 없다면 개인/학습용 예제로 사용 가능합니다. 프로덕션 사용 시에는 직접 검토 후 적용하세요.


