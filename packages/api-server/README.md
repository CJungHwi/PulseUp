# Multi-Monitor Workout System API

운동 비디오 관리 및 멀티 모니터 재생을 위한 REST API 서버입니다.

## 기술 스택

- **Database**: MariaDB with Stored Procedures
- **ORM**: Direct SQL with mysql2 (Prisma 대신)
- **Authentication**: JWT with refresh tokens
- **Framework**: Express.js with TypeScript
- **Validation**: Zod schemas

## 주요 특징

### MariaDB + 저장 프로시저 아키텍처
- **성능 최적화**: 비즈니스 로직을 데이터베이스 레벨에서 처리
- **데이터 무결성**: 데이터베이스 제약조건과 트랜잭션으로 보장
- **확장성**: 최적화된 쿼리와 인덱싱
- **유지보수성**: 저장 프로시저에 집중된 비즈니스 로직

### 핵심 기능
- 사용자 인증 및 관리 (JWT 기반)
- 운동 비디오 CRUD 및 검색
- 플레이리스트 관리 및 비디오 순서 변경
- 운동 세션 추적 및 심박수 모니터링
- 운동 기록 및 통계

## 데이터베이스 구조

### 주요 테이블
- `users` - 사용자 계정 및 인증 정보
- `videos` - 운동 비디오 메타데이터
- `playlists` - 사용자별 운동 플레이리스트
- `playlist_videos` - 플레이리스트-비디오 관계 (순서 포함)
- `workout_sessions` - 활성 및 완료된 운동 세션
- `heart_rate_readings` - 실시간 심박수 데이터
- `workout_history` - 운동 기록 이력
- `heart_rate_sessions` - 집계된 심박수 세션 데이터

### 주요 저장 프로시저
- `sp_create_user` - 사용자 등록
- `sp_authenticate_user` - 사용자 로그인
- `sp_create_playlist` - 플레이리스트 생성
- `sp_add_video_to_playlist` - 순서를 고려한 비디오 추가
- `sp_start_workout_session` - 운동 추적 시작
- `sp_end_workout_session` - 통계와 함께 운동 완료
- `sp_save_heart_rate_batch` - 심박수 데이터 일괄 삽입
- `sp_get_user_workout_stats` - 사용자 통계 생성

## API 엔드포인트

### 인증 (Authentication)
- `POST /api/auth/register` - 회원가입
- `POST /api/auth/login` - 로그인
- `POST /api/auth/refresh` - 액세스 토큰 갱신
- `GET /api/auth/me` - 현재 사용자 정보

### 사용자 (Users)
- `GET /api/users/profile` - 사용자 프로필 조회
- `PUT /api/users/profile` - 사용자 프로필 수정

### 비디오 (Videos)
- `GET /api/videos` - 비디오 목록 조회 (필터링, 페이지네이션)
- `POST /api/videos` - YouTube에서 비디오 추가
- `GET /api/videos/:id` - 비디오 상세 조회
- `PUT /api/videos/:id` - 비디오 메타데이터 수정
- `DELETE /api/videos/:id` - 비디오 삭제

### 플레이리스트 (Playlists)
- `GET /api/playlists` - 사용자 플레이리스트 목록
- `POST /api/playlists` - 플레이리스트 생성
- `GET /api/playlists/:id` - 비디오 포함 플레이리스트 조회
- `PUT /api/playlists/:id` - 플레이리스트 수정
- `DELETE /api/playlists/:id` - 플레이리스트 삭제
- `POST /api/playlists/:id/videos` - 플레이리스트에 비디오 추가
- `DELETE /api/playlists/:id/videos/:videoId` - 비디오 제거
- `PUT /api/playlists/:id/reorder` - 플레이리스트 비디오 순서 변경

### 운동 (Workouts)
- `POST /api/workouts/sessions` - 운동 세션 시작
- `PUT /api/workouts/sessions/:id/end` - 운동 세션 종료
- `POST /api/workouts/sessions/:id/heart-rate` - 심박수 데이터 저장
- `GET /api/workouts/history` - 필터링된 운동 기록 조회
- `GET /api/workouts/stats` - 사용자 운동 통계

### 심박수 (Heart Rate)
- `POST /api/heart-rate-data` - 심박수 측정값 저장
- `GET /api/heart-rate-data/session/:id` - 세션 심박수 데이터 조회
- `GET /api/heart-rate-data/export/:sessionId` - 심박수 데이터 내보내기

## 개발 환경 설정

### 1. 의존성 설치
```bash
npm install
```

### 2. 환경 변수 설정
```bash
cp .env.example .env
# .env 파일을 편집하여 MariaDB 연결 정보 설정
```

### 3. MariaDB 데이터베이스 설정
```bash
# 데이터베이스 및 테이블 생성
mysql -u root -p < database/init.sql
mysql -u root -p < database/schema.sql

# 저장 프로시저 생성
mysql -u root -p workout_system < database/procedures.sql

# 또는 npm 스크립트 사용:
npm run db:init
```

### 4. 개발 서버 실행
```bash
npm run dev
```

## 환경 변수

```env
# MariaDB 데이터베이스 설정
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=workout_system

# API 서버 설정
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# JWT 설정
JWT_SECRET=your_jwt_secret_key_here
JWT_REFRESH_SECRET=your_jwt_refresh_secret_key_here
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# YouTube API (선택사항)
YOUTUBE_API_KEY=your_youtube_api_key
```

## 데이터베이스 명령어

```bash
# 데이터베이스 초기화
npm run db:init

# 스키마만 설정
npm run db:setup

# 저장 프로시저만 설정
npm run db:procedures

# 데이터베이스 연결
mysql -u root -p workout_system
```

## 성능 최적화 기능

- **연결 풀링**: 최적화된 데이터베이스 연결 관리
- **저장 프로시저**: 네트워크 오버헤드 감소
- **인덱싱**: 일반적인 작업에 대한 쿼리 최적화
- **배치 작업**: 효율적인 대량 데이터 처리
- **트랜잭션 관리**: 데이터 무결성을 위한 ACID 준수

## 인증

모든 API 엔드포인트 (인증 관련 제외)는 JWT 토큰이 필요합니다.

```
Authorization: Bearer <your-jwt-token>
```

## 응답 형식

### 성공 응답
```json
{
  "success": true,
  "data": { ... }
}
```

### 에러 응답
```json
{
  "success": false,
  "error": "에러 메시지",
  "details": [ ... ] // 유효성 검사 에러의 경우
}
```