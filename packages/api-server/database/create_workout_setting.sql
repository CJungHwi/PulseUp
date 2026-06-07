-- workout_setting 테이블 생성
-- 운동 방식별 기본 설정값을 저장하는 테이블

CREATE TABLE IF NOT EXISTS workout_setting (
    id INT AUTO_INCREMENT PRIMARY KEY,
    method_type VARCHAR(20) NOT NULL COMMENT '운동 방식 (stress, loop, AMRAP, EMOM-STRESS, EMOM-LOOP)',
    round INT NOT NULL COMMENT '라운드 번호',
    time INT NOT NULL COMMENT '운동 시간 (초, AMRAP/EMOM은 분)',
    rest INT NOT NULL COMMENT '휴식 시간 (초, AMRAP/EMOM은 분)',
    water_break INT NOT NULL DEFAULT 0 COMMENT '물보충 시간 (초)',
    reps INT NOT NULL DEFAULT 0 COMMENT '운동 횟수 (AMRAP/EMOM용)',
    is_active BOOLEAN NOT NULL DEFAULT TRUE COMMENT '활성화 여부',
    sort_order INT NOT NULL DEFAULT 0 COMMENT '정렬 순서',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_method_type (method_type),
    INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='운동 방식별 기본 설정값';

-- 기존 테이블에 reps 컬럼 추가 (테이블이 이미 존재하는 경우)
-- ALTER TABLE workout_setting ADD COLUMN reps INT NOT NULL DEFAULT 0 COMMENT '운동 횟수 (AMRAP/EMOM용)' AFTER water_break;

-- 기본 데이터 삽입

-- Stress 방식 (각 운동을 모든 라운드에서 반복)
-- 라운드별 시간이 다름 (60→40→20), 물보충은 마지막 라운드에만
INSERT INTO workout_setting (method_type, round, time, rest, water_break, reps, sort_order) VALUES
('stress', 1, 60, 20, 0, 0, 1),
('stress', 2, 40, 20, 0, 0, 2),
('stress', 3, 20, 20, 60, 0, 3);

-- Loop 방식 (한 라운드에서 모든 운동 순차 실행)
-- 모든 라운드 시간이 동일 (60초), 라운드 끝마다 물보충
INSERT INTO workout_setting (method_type, round, time, rest, water_break, reps, sort_order) VALUES
('loop', 1, 60, 20, 60, 0, 1),
('loop', 2, 60, 20, 60, 0, 2),
('loop', 3, 60, 20, 0, 0, 3);

-- AMRAP 방식 (시간 기반, 분 단위, reps: 기본 운동 횟수)
INSERT INTO workout_setting (method_type, round, time, rest, water_break, reps, sort_order) VALUES
('AMRAP', 1, 12, 1, 0, 30, 1),
('AMRAP', 2, 12, 0, 0, 30, 2);

-- EMOM-STRESS 방식 (운동별 설정 라운드 반복, 분 단위, reps: 기본 운동 횟수)
INSERT INTO workout_setting (method_type, round, time, rest, water_break, reps, sort_order) VALUES
('EMOM-STRESS', 1, 1, 0, 60, 15, 1),
('EMOM-STRESS', 2, 1, 0, 0, 15, 2);

-- EMOM-LOOP 방식 (기존 EMOM과 동일: 라운드별 전체 운동 순차 실행)
INSERT INTO workout_setting (method_type, round, time, rest, water_break, reps, sort_order) VALUES
('EMOM-LOOP', 1, 1, 0, 60, 15, 1),
('EMOM-LOOP', 2, 1, 0, 0, 15, 2);
