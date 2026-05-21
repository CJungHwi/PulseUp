-- workout_history_detail 테이블에 exercise_type 컬럼 추가
-- exercise_type: 'dynamic', 'main', 'static' 구분

ALTER TABLE workout_history_detail 
ADD COLUMN exercise_type VARCHAR(20) NULL COMMENT '운동 타입 (dynamic: Dynamic Stretching, main: 메인 운동, static: Static Stretching)' 
AFTER position;
