-- 운동 실행 순서 테이블 생성
-- 스트레스 서킷/루프 서킷의 운동 실행 순서를 저장 (운동 + 휴식 + 물보충)

CREATE TABLE IF NOT EXISTS workout_exercises (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()) COMMENT '운동실행순서 고유 ID',
    workout_history_master_id VARCHAR(36) NOT NULL COMMENT '운동기록 마스터 ID (workout_history_master.id 참조)',
    sequence INT NOT NULL COMMENT '전체 실행 순서 (1, 2, 3, ...)',
    round INT NOT NULL COMMENT '라운드 번호',
    exercise_type ENUM('exercise', 'rest', 'water') NOT NULL COMMENT '항목 타입 (exercise: 운동, rest: 휴식, water: 물보충)',
    exercise_id VARCHAR(255) NULL COMMENT '운동 ID (exercise_type이 exercise일 때만 사용)',
    exercise_name VARCHAR(255) NOT NULL COMMENT '운동명 또는 활동명 (운동명, 휴식, 물보충)',
    duration INT NOT NULL COMMENT '지속 시간 (초 단위)',
    is_bilateral BOOLEAN NOT NULL DEFAULT FALSE COMMENT '양쪽운동 여부 (exercise_type이 exercise일 때 사용)',
    position VARCHAR(10) NULL COMMENT '운동 위치 (A1~A6, B1~B6 등, exercise_type이 exercise일 때만 사용)',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '생성일시',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정일시',
    
    -- 인덱스
    INDEX idx_workout_history_master_id (workout_history_master_id),
    INDEX idx_sequence (sequence),
    INDEX idx_round (round),
    INDEX idx_exercise_type (exercise_type),
    INDEX idx_exercise_id (exercise_id),
    
    -- 외래키 제약조건
    FOREIGN KEY (workout_history_master_id) REFERENCES workout_history_master(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='운동 실행 순서 - 스트레스/루프 서킷의 운동+휴식+물보충 실행 순서';
