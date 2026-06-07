-- =============================================================================
-- EMOM stress/loop 기본 운동 설정 추가
-- =============================================================================
-- 목적:
-- - WorkoutSettings 화면에서 EMOM-STRESS, EMOM-LOOP를 별도 설정으로 관리한다.
-- - 기존 EMOM 기록/설정은 보존하고, 새 기본 템플릿이 없을 때만 삽입한다.
-- 적용:
--   mysql -u USER -p DBNAME < packages/api-server/database/_v2_emom_stress_loop_workout_settings.sql
-- =============================================================================

INSERT INTO workout_setting (method_type, round, time, rest, water_break, reps, sort_order, is_active)
SELECT 'EMOM-STRESS', 1, 1, 0, 60, 15, 1, TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM workout_setting WHERE method_type = 'EMOM-STRESS' AND round = 1
);

INSERT INTO workout_setting (method_type, round, time, rest, water_break, reps, sort_order, is_active)
SELECT 'EMOM-STRESS', 2, 1, 0, 0, 15, 2, TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM workout_setting WHERE method_type = 'EMOM-STRESS' AND round = 2
);

INSERT INTO workout_setting (method_type, round, time, rest, water_break, reps, sort_order, is_active)
SELECT 'EMOM-LOOP', 1, 1, 0, 60, 15, 1, TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM workout_setting WHERE method_type = 'EMOM-LOOP' AND round = 1
);

INSERT INTO workout_setting (method_type, round, time, rest, water_break, reps, sort_order, is_active)
SELECT 'EMOM-LOOP', 2, 1, 0, 0, 15, 2, TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM workout_setting WHERE method_type = 'EMOM-LOOP' AND round = 2
);
