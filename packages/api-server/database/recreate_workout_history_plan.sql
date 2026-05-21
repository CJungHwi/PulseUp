-- workout_history_plan 테이블 재생성
-- 새로운 구조: circuit_type/workout_history_master_id/round/time/rest/hydration

-- 기존 테이블 삭제 (있다면)
DROP TABLE IF EXISTS workout_history_plan;

-- 새로운 구조로 테이블 생성
CREATE TABLE workout_history_plan (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    workout_history_master_id VARCHAR(36) NOT NULL,
    circuit_type ENUM('stress', 'loop', 'none', 'amrap', 'emom') NOT NULL COMMENT '서킷/방식 (stress, loop, none, amrap, emom)',
    round INT NOT NULL COMMENT '라운드 번호',
    time INT NOT NULL COMMENT '운동 시간 (초)',
    rest INT NOT NULL COMMENT '휴식 시간 (초)',
    hydration INT NOT NULL COMMENT '물보충 시간 (초)',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (workout_history_master_id) REFERENCES workout_history_master(id) ON DELETE CASCADE,
    
    INDEX idx_workout_history_plan_master_id (workout_history_master_id),
    INDEX idx_workout_history_plan_round (round)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='운동 계획 테이블 - 서킷 구성 정보';
