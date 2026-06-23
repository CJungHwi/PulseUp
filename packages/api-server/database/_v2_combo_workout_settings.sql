-- =============================================================================
-- COMBO stress/loop 기본 운동 설정 추가
-- =============================================================================
-- 목적:
-- - WorkoutSettings 화면에서 COMBO-STRESS, COMBO-LOOP를 별도 설정으로 관리한다.
-- - 콤보운동: 운동 3개(Row 3개), 마지막 Row에 시간(초)·휴식(초), 각 Row에 반복 횟수.
-- 적용:
--   mysql -u USER -p DBNAME < packages/api-server/database/_v2_combo_workout_settings.sql
-- =============================================================================

INSERT INTO workout_setting (method_type, round, time, rest, water_break, reps, sort_order, is_active)
SELECT 'COMBO-STRESS', 1, 0, 0, 0, 10, 1, TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM workout_setting WHERE method_type = 'COMBO-STRESS' AND round = 1
);

INSERT INTO workout_setting (method_type, round, time, rest, water_break, reps, sort_order, is_active)
SELECT 'COMBO-STRESS', 2, 0, 0, 0, 10, 2, TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM workout_setting WHERE method_type = 'COMBO-STRESS' AND round = 2
);

INSERT INTO workout_setting (method_type, round, time, rest, water_break, reps, sort_order, is_active)
SELECT 'COMBO-STRESS', 3, 60, 20, 0, 10, 3, TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM workout_setting WHERE method_type = 'COMBO-STRESS' AND round = 3
);

INSERT INTO workout_setting (method_type, round, time, rest, water_break, reps, sort_order, is_active)
SELECT 'COMBO-LOOP', 1, 0, 0, 0, 10, 1, TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM workout_setting WHERE method_type = 'COMBO-LOOP' AND round = 1
);

INSERT INTO workout_setting (method_type, round, time, rest, water_break, reps, sort_order, is_active)
SELECT 'COMBO-LOOP', 2, 0, 0, 0, 10, 2, TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM workout_setting WHERE method_type = 'COMBO-LOOP' AND round = 2
);

INSERT INTO workout_setting (method_type, round, time, rest, water_break, reps, sort_order, is_active)
SELECT 'COMBO-LOOP', 3, 60, 20, 0, 10, 3, TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM workout_setting WHERE method_type = 'COMBO-LOOP' AND round = 3
);
