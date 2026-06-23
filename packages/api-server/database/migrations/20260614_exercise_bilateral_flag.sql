-- Migration: Add bilateral exercise flags
-- 변경 이유: 운동 마스터 기본값과 일자별 운동 구성별 양쪽운동 여부를 분리 저장
-- 적용 순서: 1) 본 스크립트 실행 → 2) sp_insert_vimeo_video, sp_create_exercise,
--          sp_update_exercise, sp_SaveWorkout(sp_save_workout_with_reps.sql — 19-param, reps/DS 저장본),
--          sp_GetWorkoutHistoryDetail,
--          sp_GetWorkoutExercises, sp_GetExercises 재배포

SET @db_name := DATABASE();

SET @sql := (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE exercises ADD COLUMN is_bilateral BOOLEAN NOT NULL DEFAULT FALSE COMMENT ''양쪽운동 여부 (TRUE: 양쪽, FALSE: 단일)'' AFTER video_loop_count',
    'SELECT ''exercises.is_bilateral already exists'' AS message'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'exercises'
    AND COLUMN_NAME = 'is_bilateral'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE workout_history_detail ADD COLUMN is_bilateral BOOLEAN NOT NULL DEFAULT FALSE COMMENT ''운동 구성 내 양쪽운동 여부'' AFTER duration',
    'SELECT ''workout_history_detail.is_bilateral already exists'' AS message'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'workout_history_detail'
    AND COLUMN_NAME = 'is_bilateral'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE workout_exercises ADD COLUMN is_bilateral BOOLEAN NOT NULL DEFAULT FALSE COMMENT ''양쪽운동 여부 (exercise_type이 exercise일 때 사용)'' AFTER duration',
    'SELECT ''workout_exercises.is_bilateral already exists'' AS message'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'workout_exercises'
    AND COLUMN_NAME = 'is_bilateral'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
