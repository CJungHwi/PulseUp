-- workout_history_master 테이블의 time 컬럼 길이 수정
-- 'ALL' 등의 긴 시간 값을 저장할 수 있도록 VARCHAR 길이 증가

ALTER TABLE workout_history_master 
MODIFY COLUMN time VARCHAR(10) COMMENT '운동 시간 (예: 09, 10, ALL 등)';
