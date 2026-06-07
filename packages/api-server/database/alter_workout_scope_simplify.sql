-- workout_scope 단순화: route_path, sequence_mode 제거
-- scope_code / scope_name / sort_order / is_active 만 유지

ALTER TABLE workout_scope DROP INDEX uk_route_path;

ALTER TABLE workout_scope
  DROP COLUMN route_path,
  DROP COLUMN sequence_mode;
