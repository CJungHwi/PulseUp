-- workout_history_master 테이블에 Dynamic/Static Stretching 마스터 ID 컬럼 추가

ALTER TABLE workout_history_master 
ADD COLUMN dynamic_master_id CHAR(36) NULL COMMENT 'Dynamic Stretching 마스터 ID' AFTER memo,
ADD COLUMN static_master_id CHAR(36) NULL COMMENT 'Static Stretching 마스터 ID' AFTER dynamic_master_id;

-- 인덱스 추가 (조회 성능 향상)
CREATE INDEX idx_dynamic_master_id ON workout_history_master(dynamic_master_id);
CREATE INDEX idx_static_master_id ON workout_history_master(static_master_id);
