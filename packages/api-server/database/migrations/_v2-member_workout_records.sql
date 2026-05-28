-- 회원 운동기록 종합 화면 지원
-- 작성일: 2026-05-28
--
-- 목적:
-- 1) 지점사용자(user) 메뉴에 "운동기록" 화면(`/account/workout-records`)을 등록한다.
-- 2) 추후 인바디 측정 등록/현황 조회를 위한 `inbody_measurements` 테이블을 준비한다.
-- 3) 기존 사용자에게 user_menu_items 권한을 백필한다.
--
-- 적용 순서:
-- - 기본 스키마 및 메뉴 테이블 생성 후 실행
-- - 재실행 가능(idempotent)
--
-- USE workout_system;

-- ============================================================================
-- 1. 인바디 측정 테이블
-- ============================================================================

CREATE TABLE IF NOT EXISTS inbody_measurements (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()) COMMENT '인바디 측정 고유 ID',
  user_id CHAR(36) NOT NULL COMMENT '측정 사용자 ID (users.id 참조)',
  measured_at DATETIME NOT NULL COMMENT '측정일시',
  height_cm DECIMAL(5,2) NULL COMMENT '신장(cm)',
  weight_kg DECIMAL(5,2) NULL COMMENT '체중(kg)',
  skeletal_muscle_mass DECIMAL(5,2) NULL COMMENT '골격근량(kg)',
  body_fat_percentage DECIMAL(5,2) NULL COMMENT '체지방률(%)',
  bmi DECIMAL(5,2) NULL COMMENT 'BMI',
  memo VARCHAR(255) NULL COMMENT '측정 메모',
  created_by CHAR(36) NULL COMMENT '등록자 ID',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '생성일시',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정일시',
  INDEX idx_inbody_user_measured_at (user_id, measured_at),
  INDEX idx_inbody_created_by (created_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='사용자 인바디 측정 이력';

-- ============================================================================
-- 2. 메뉴 등록
-- ============================================================================

INSERT INTO menus (parent_id, name, name_en, description, menu_type, url, icon, sort_order, is_active, is_visible, target_audience, level)
SELECT NULL, '운동기록', 'Workout Records', '수업 예약/출석, 운동일별 심박 기록, 인바디 현황을 종합적으로 확인합니다.', 'page', '/account/workout-records', 'Activity', 32, TRUE, TRUE, 'user', 1
WHERE NOT EXISTS (
  SELECT 1 FROM menus WHERE url = '/account/workout-records' AND target_audience = 'user'
);

-- ============================================================================
-- 3. 기존 지점사용자 메뉴 권한 백필
-- ============================================================================

INSERT INTO user_menu_items (user_id, menu_id, parent_id, is_enabled, created_at)
SELECT u.userid, m.id, 0, TRUE, CURRENT_TIMESTAMP
FROM users u
INNER JOIN menus m
  ON m.url = '/account/workout-records'
 AND m.target_audience = 'user'
 AND m.is_active = TRUE
 AND m.is_visible = TRUE
WHERE u.role = 'user'
  AND u.used = TRUE
  AND NOT EXISTS (
    SELECT 1
    FROM user_menu_items umi
    WHERE umi.user_id = u.userid
      AND umi.menu_id = m.id
  );
