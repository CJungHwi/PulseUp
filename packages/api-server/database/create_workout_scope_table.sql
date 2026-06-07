-- workout_scope 마스터: 운동 저장 시 workout_history_master.workout_scope 분류 코드
-- 각 운동 페이지는 scope 코드를 직접 지정하고, 여기서 사용 여부만 관리한다.

CREATE TABLE IF NOT EXISTS workout_scope (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()) COMMENT '고유 ID',
    scope_code VARCHAR(20) NOT NULL COMMENT '저장/조회 코드 (workout_history_master.workout_scope)',
    scope_name VARCHAR(100) NOT NULL COMMENT '표시명',
    sort_order INT NOT NULL DEFAULT 0 COMMENT '정렬 순서',
    is_active BOOLEAN NOT NULL DEFAULT TRUE COMMENT '사용 여부',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '생성일시',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정일시',
    UNIQUE KEY uk_scope_code (scope_code),
    INDEX idx_is_active (is_active),
    INDEX idx_sort_order (sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='운동 저장 scope 분류 마스터';

INSERT INTO workout_scope (scope_code, scope_name, sort_order, is_active)
SELECT 'TOTAL', '통합 운동', 10, TRUE
WHERE NOT EXISTS (SELECT 1 FROM workout_scope WHERE scope_code = 'TOTAL');

INSERT INTO workout_scope (scope_code, scope_name, sort_order, is_active)
SELECT 'SINGLE', '단일 운동', 20, TRUE
WHERE NOT EXISTS (SELECT 1 FROM workout_scope WHERE scope_code = 'SINGLE');

DELETE FROM workout_scope WHERE scope_code = 'MONTH';
