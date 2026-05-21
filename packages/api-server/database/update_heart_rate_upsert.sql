-- ============================================
-- heart_rate_data 중복 방지를 위한 UNIQUE 인덱스 추가 및 프로시저 수정
-- ============================================

-- 1. 기존 UNIQUE 인덱스가 있으면 삭제
ALTER TABLE heart_rate_data DROP INDEX IF EXISTS idx_unique_heart_rate;

-- 2. 임시 테이블 생성 (중복 제거된 데이터)
CREATE TEMPORARY TABLE heart_rate_data_temp AS
SELECT 
  MAX(id) as id,
  user_id,
  workout_history_master_id,
  device_id,
  device_name,
  timestamp,
  heart_rate,
  zone,
  MAX(created_at) as created_at
FROM heart_rate_data
GROUP BY user_id, workout_history_master_id, device_id, timestamp;

-- 3. 기존 데이터 모두 삭제
TRUNCATE TABLE heart_rate_data;

-- 4. 중복 제거된 데이터 복원
INSERT INTO heart_rate_data (id, user_id, workout_history_master_id, device_id, device_name, timestamp, heart_rate, zone, created_at)
SELECT id, user_id, workout_history_master_id, device_id, device_name, timestamp, heart_rate, zone, created_at
FROM heart_rate_data_temp;

-- 5. 임시 테이블 삭제
DROP TEMPORARY TABLE heart_rate_data_temp;

-- 6. UNIQUE 인덱스 추가 (같은 시간에 같은 기기의 중복 데이터 방지)
ALTER TABLE heart_rate_data 
  ADD UNIQUE INDEX idx_unique_heart_rate (
    user_id, 
    workout_history_master_id, 
    device_id, 
    timestamp
  );

-- 3. UPSERT 프로시저로 변경 (중복 시 업데이트)
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
  -- 같은 시간에 같은 기기의 데이터가 있으면 업데이트, 없으면 INSERT
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

-- 완료 메시지
SELECT 'heart_rate_data UPSERT 설정 완료 - 중복 데이터 방지' as message;

