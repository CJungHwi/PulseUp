-- workout_history_plan.circuit_type 확장
-- 목적: AMRAP/EMOM/none 저장 시 ENUM 제약으로 인해 "Data truncated for column 'circuit_type'" 오류가 발생하는 문제 해결
--
-- 적용 방법(사용자가 직접 실행):
--   mysql -u root -p workout_system < database/alter_workout_history_plan_circuit_type.sql
--
-- 주의:
-- - 기존 ENUM('stress','loop') 환경에서도 안전하게 확장되도록 MODIFY로 처리합니다.

ALTER TABLE workout_history_plan
  MODIFY circuit_type ENUM('stress','loop','none','amrap','emom') NOT NULL
  COMMENT '서킷/방식 (stress, loop, none, amrap, emom)';


