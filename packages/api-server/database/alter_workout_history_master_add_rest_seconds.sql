-- workout_history_master 테이블에 rest_seconds 컬럼 추가
-- 휴식시간을 저장하기 위한 컬럼

ALTER TABLE `workout_history_master`
ADD COLUMN `rest_seconds` INT DEFAULT 0 COMMENT '휴식 시간 (초)' AFTER `total_seconds`;
