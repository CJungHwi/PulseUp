-- workout_history_master 테이블에 운동시간 요약 컬럼 추가
-- DS, Main, Cool Down, Total 시간을 저장하기 위한 컬럼

ALTER TABLE `workout_history_master`
ADD COLUMN `ds_seconds` INT DEFAULT 0 COMMENT 'Dynamic Stretching 시간 (초)' AFTER `admin`,
ADD COLUMN `main_seconds` INT DEFAULT 0 COMMENT 'Main 운동 시간 (초)' AFTER `ds_seconds`,
ADD COLUMN `cd_seconds` INT DEFAULT 0 COMMENT 'Cool Down 시간 (초)' AFTER `main_seconds`,
ADD COLUMN `total_seconds` INT DEFAULT 0 COMMENT '총 운동 시간 (초)' AFTER `cd_seconds`;
