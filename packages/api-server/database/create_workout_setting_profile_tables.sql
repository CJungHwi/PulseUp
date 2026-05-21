-- 사용자별 운동 설정/모니터 이미지 기본값 테이블
-- 규칙:
-- 1) 관리자/일반사용자 모두 동일 테이블 사용
-- 2) owner_user_id 로 데이터 소유자 구분
-- 3) 회원가입 시 role='admin' 사용자 1명의 데이터를 신규 사용자로 복사

CREATE TABLE IF NOT EXISTS workout_setting_profile (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    owner_user_id CHAR(36) NOT NULL COMMENT '데이터 소유자(users.id)',
    method_type VARCHAR(20) NOT NULL COMMENT '운동 방식(stress, loop, AMRAP, EMOM)',
    round_no INT NOT NULL COMMENT '라운드 번호',
    time_value INT NOT NULL COMMENT '운동 시간(stress/loop=초, AMRAP/EMOM=분)',
    rest_value INT NOT NULL COMMENT '휴식 시간(stress/loop=초, AMRAP/EMOM=분)',
    water_break INT NOT NULL DEFAULT 0 COMMENT '물보충 시간(초)',
    reps INT NOT NULL DEFAULT 0 COMMENT '기본 횟수(AMRAP/EMOM)',
    sort_order INT NOT NULL DEFAULT 0 COMMENT '정렬 순서',
    is_active BOOLEAN NOT NULL DEFAULT TRUE COMMENT '활성화 여부',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uk_owner_method_round (owner_user_id, method_type, round_no),
    KEY idx_owner_method (owner_user_id, method_type),
    KEY idx_owner_active (owner_user_id, is_active),
    CONSTRAINT fk_workout_setting_profile_owner
      FOREIGN KEY (owner_user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='사용자별 운동 설정 프로필';

CREATE TABLE IF NOT EXISTS monitor_default_image_profile (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    owner_user_id CHAR(36) NOT NULL COMMENT '데이터 소유자(users.id)',
    side VARCHAR(10) NOT NULL COMMENT 'left/right',
    image_url VARCHAR(2048) NOT NULL COMMENT '좌/우 모니터 기본 이미지 URL',
    is_active BOOLEAN NOT NULL DEFAULT TRUE COMMENT '활성화 여부',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uk_owner_side (owner_user_id, side),
    KEY idx_owner (owner_user_id),
    CONSTRAINT fk_monitor_default_image_profile_owner
      FOREIGN KEY (owner_user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='사용자별 모니터 기본 이미지 URL';

-- (선택) 기존 workout_setting 데이터가 있다면, 가장 오래된 admin 1명에게 초기 템플릿으로 주입
INSERT INTO workout_setting_profile (
    owner_user_id, method_type, round_no, time_value, rest_value, water_break, reps, sort_order, is_active
)
SELECT
    u.id AS owner_user_id,
    ws.method_type,
    ws.round AS round_no,
    ws.time AS time_value,
    ws.rest AS rest_value,
    ws.water_break,
    ws.reps,
    ws.sort_order,
    ws.is_active
FROM workout_setting ws
JOIN (
    SELECT id
    FROM users
    WHERE role = 'admin' AND used = TRUE
    ORDER BY created_at ASC
    LIMIT 1
) u
ON 1=1
ON DUPLICATE KEY UPDATE
    time_value = VALUES(time_value),
    rest_value = VALUES(rest_value),
    water_break = VALUES(water_break),
    reps = VALUES(reps),
    sort_order = VALUES(sort_order),
    is_active = VALUES(is_active),
    updated_at = CURRENT_TIMESTAMP;
