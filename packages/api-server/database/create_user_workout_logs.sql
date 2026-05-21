-- user_workout_logs 테이블 생성
-- 사용자의 운동 기록을 저장하는 테이블

CREATE TABLE IF NOT EXISTS user_workout_logs (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id VARCHAR(36) NOT NULL,
    exercise_id VARCHAR(36) NOT NULL,
    branch_id VARCHAR(36) NULL,
    duration_minutes INT NOT NULL DEFAULT 0,
    sets_count INT NULL DEFAULT 0,
    reps_count INT NULL DEFAULT 0,
    weight_kg DECIMAL(5,2) NULL DEFAULT 0.00,
    notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- 외래키 제약조건
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE,
    FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL,
    
    -- 인덱스
    INDEX idx_user_workout_logs_user_id (user_id),
    INDEX idx_user_workout_logs_exercise_id (exercise_id),
    INDEX idx_user_workout_logs_created_at (created_at),
    INDEX idx_user_workout_logs_user_date (user_id, created_at)
);

-- 테이블 코멘트
ALTER TABLE user_workout_logs COMMENT = '사용자 운동 기록 테이블';
