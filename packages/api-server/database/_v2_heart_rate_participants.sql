-- ============================================
-- 개인별/그룹수업 운동심박수 저장을 위한 스키마 보강
-- ============================================
-- 적용 목적:
-- 1) heart_rate_data를 ANT+ 운영 저장 형식(device_id VARCHAR, device_name, UPSERT UNIQUE)과 정합화
-- 2) 그룹 수업에서 운동 세션별 회원-심박계 매핑을 저장하는 workout_heart_rate_participants 추가
-- 3) save-batch API가 device_id 기준으로 실제 user_id를 결정할 수 있도록 기준 테이블 제공
--
-- 적용 순서:
-- - 기존 운영 DB에는 이 파일을 먼저 적용한 뒤 API 서버 배포
-- - 실제 DB 반영은 프로젝트 규칙에 따라 운영자가 수행

ALTER TABLE heart_rate_data
  MODIFY COLUMN device_id VARCHAR(255) NOT NULL
  COMMENT '기기 ID - BLE/ANT+ 공통 식별자 (예: ant-10771)';

ALTER TABLE heart_rate_data
  ADD COLUMN IF NOT EXISTS device_name VARCHAR(255) NULL
  COMMENT '기기 이름 - ANT+ 표시명 또는 등록명 (예: HR-10771)'
  AFTER device_id;

ALTER TABLE heart_rate_data
  DROP INDEX IF EXISTS idx_unique_heart_rate;

ALTER TABLE heart_rate_data
  ADD UNIQUE INDEX idx_unique_heart_rate (
    user_id,
    workout_history_master_id,
    device_id,
    timestamp
  );

CREATE TABLE IF NOT EXISTS workout_heart_rate_participants (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()) COMMENT '심박 참가자 매핑 고유 ID',
  workout_history_master_id CHAR(36) NOT NULL COMMENT '운동기록 마스터 ID (workout_history_master.id 참조)',
  user_id CHAR(36) NOT NULL COMMENT '참가 회원 ID (users.id 참조)',
  device_id VARCHAR(255) NOT NULL COMMENT '할당된 심박계 ID - heart_rate_data.device_id와 동일 형식',
  device_name VARCHAR(255) NULL COMMENT '할당된 심박계 표시명',
  slot_number INT NULL COMMENT 'Electron ANT+ 슬롯 번호',
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '심박계 배정 일시',
  unassigned_at TIMESTAMP NULL COMMENT '배정 해제 일시',
  is_active BOOLEAN NOT NULL DEFAULT TRUE COMMENT '현재 활성 배정 여부',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '생성일시',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정일시',
  INDEX idx_workout_user_active (workout_history_master_id, user_id, is_active),
  INDEX idx_workout_device_active (workout_history_master_id, device_id, is_active),
  INDEX idx_workout_master (workout_history_master_id),
  INDEX idx_user_id (user_id),
  INDEX idx_device_id (device_id),
  INDEX idx_slot_number (slot_number),
  INDEX idx_is_active (is_active)
) ENGINE=InnoDB COMMENT='운동 세션별 회원-심박계 매핑 - 그룹 수업 개인별 심박 저장 기준';

DELIMITER $$

DROP PROCEDURE IF EXISTS sp_insert_heart_rate_data$$

CREATE PROCEDURE sp_insert_heart_rate_data(
  IN p_user_id CHAR(36),
  IN p_workout_history_master_id CHAR(36),
  IN p_device_id VARCHAR(255),
  IN p_device_name VARCHAR(255),
  IN p_timestamp DATETIME,
  IN p_heart_rate INT,
  IN p_zone VARCHAR(20)
)
BEGIN
  INSERT INTO heart_rate_data (
    user_id,
    workout_history_master_id,
    device_id,
    device_name,
    timestamp,
    heart_rate,
    zone
  ) VALUES (
    p_user_id,
    p_workout_history_master_id,
    p_device_id,
    p_device_name,
    p_timestamp,
    p_heart_rate,
    p_zone
  )
  ON DUPLICATE KEY UPDATE
    device_name = p_device_name,
    heart_rate = p_heart_rate,
    zone = p_zone,
    created_at = CURRENT_TIMESTAMP;
END$$

DELIMITER ;

SELECT '개인별/그룹수업 운동심박수 스키마 보강 완료' AS message;
