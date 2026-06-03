/**
 * Migration: 메인 운동 position L/R → A/B (전치 transpose)
 * - prefix A/B = 전반/후반, num 1-3/4-6 = 좌/우 모니터
 * - L1→A1, L4→B1, R1→A4, R4→B4 …
 * - DS/CD는 6개 슬롯 의미가 달라 제외한다.
 *
 * 롤백은 데이터 의미상 불완전 — 백업 후 적용 권장
 */
UPDATE workout_history_detail
SET position = CONCAT(
  IF(CAST(SUBSTRING(position, 2) AS UNSIGNED) <= 3, 'A', 'B'),
  IF(SUBSTRING(position, 1, 1) = 'L',
     ((CAST(SUBSTRING(position, 2) AS UNSIGNED) - 1) % 3) + 1,
     ((CAST(SUBSTRING(position, 2) AS UNSIGNED) - 1) % 3) + 4))
WHERE position REGEXP '^[LR][0-9]+$'
  AND CAST(method_round AS UNSIGNED) BETWEEN 1 AND 98
  AND (exercise_type IS NULL OR exercise_type NOT IN ('DS', 'CD', 'dynamic', 'static', 'cooldown'));

UPDATE workout_exercises
SET position = CONCAT(
  IF(CAST(SUBSTRING(position, 2) AS UNSIGNED) <= 3, 'A', 'B'),
  IF(SUBSTRING(position, 1, 1) = 'L',
     ((CAST(SUBSTRING(position, 2) AS UNSIGNED) - 1) % 3) + 1,
     ((CAST(SUBSTRING(position, 2) AS UNSIGNED) - 1) % 3) + 4))
WHERE position REGEXP '^[LR][0-9]+$'
  AND round BETWEEN 1 AND 98
  AND exercise_type = 'exercise';
