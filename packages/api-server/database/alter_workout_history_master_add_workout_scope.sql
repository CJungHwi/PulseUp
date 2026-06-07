-- workout_history_master: Total/Single 페이지 저장 이력 구분
ALTER TABLE workout_history_master
ADD COLUMN workout_scope VARCHAR(20) NOT NULL DEFAULT 'TOTAL'
  COMMENT '운동 페이지 구분 (TOTAL=Totalexercises, SINGLE=Singleexercises)'
  AFTER workout_categories_id;

CREATE INDEX idx_workout_scope ON workout_history_master (workout_scope);

-- 기존 데이터는 Totalexercises 기록으로 간주
UPDATE workout_history_master SET workout_scope = 'TOTAL' WHERE workout_scope IS NULL OR workout_scope = '';
