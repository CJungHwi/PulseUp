-- workout_history_plan.circuit_type 에 AMRAP / EMOM 구분 저장
-- Time-Structured AMRAP·EMOM 저장 시 plan 행에 method와 일치하는 값을 둡니다.
--
-- 적용: mysql -u root -p workout_system < database/alter_workout_history_plan_circuit_type_amrap_emom.sql

ALTER TABLE workout_history_plan
  MODIFY circuit_type ENUM('stress','loop','none','amrap','emom') NOT NULL
  COMMENT '서킷/방식 (stress, loop, none, amrap, emom)';
