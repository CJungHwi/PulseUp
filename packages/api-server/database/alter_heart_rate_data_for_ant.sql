-- ============================================
-- ANT+ 심박계 지원을 위한 heart_rate_data 테이블 수정
-- ============================================

-- 1. device_id 컬럼 타입 변경 (CHAR(36) → VARCHAR(255))
--    ANT+ 전용: "ant-10771" 형식으로 저장
ALTER TABLE heart_rate_data 
  MODIFY COLUMN device_id VARCHAR(255) NOT NULL 
  COMMENT '기기 ID - ANT+ 전용: ant-{deviceId} 형식 (예: ant-10771)';

-- 2. device_name 컬럼 추가
--    ANT+ 기기명 저장용 (예: HR-10771)
ALTER TABLE heart_rate_data 
  ADD COLUMN device_name VARCHAR(255) NULL 
  COMMENT '기기 이름 - ANT+ 전용 (예: HR-10771)' 
  AFTER device_id;

-- 3. 심박수 데이터 저장 프로시저 생성
DELIMITER $$

DROP PROCEDURE IF EXISTS sp_insert_heart_rate_data$$

CREATE PROCEDURE sp_insert_heart_rate_data(
  IN p_user_id CHAR(36),
  IN p_workout_history_master_id CHAR(36),
  IN p_device_id VARCHAR(255),
  IN p_device_name VARCHAR(255),
  IN p_timestamp TIMESTAMP,
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
  );
END$$

DELIMITER ;

-- 4. 기존 인덱스 확인 (그대로 유지)
-- INDEX idx_device_id (device_id) - VARCHAR(255)로 변경되어도 정상 작동

-- 5. 테스트 데이터 확인 쿼리 (실행하지 않음, 참고용)
-- SELECT 
--   device_id,
--   device_name,
--   COUNT(*) as count,
--   AVG(heart_rate) as avg_hr,
--   MAX(heart_rate) as max_hr
-- FROM heart_rate_data
-- WHERE workout_history_master_id = 'YOUR_MASTER_ID'
-- GROUP BY device_id, device_name
-- ORDER BY device_name;

-- 완료 메시지
SELECT 'ANT+ 심박계 지원을 위한 테이블 수정 완료' as message;

