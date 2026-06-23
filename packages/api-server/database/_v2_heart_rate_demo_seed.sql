-- 심박 화면 확인용 가상 데이터 시드
-- 작성일: 2026-06-09
--
-- 목적:
-- 1) workout_history_master.id = '000001' 데모 운동기록 생성
-- 2) 30분(30초 간격 60포인트) 심박 시계열 삽입
-- 3) 내 운동기록·심박 상세 화면 UI 확인
--
-- 대상 사용자:
-- - role = 'user', used = TRUE 인 첫 번째 회원에 연결
-- - 해당 계정으로 로그인 후 /account/workout-records 에서 확인
--
-- 상세 URL:
-- - /account/workout-records/000001/heart-rate
--
-- 적용 순서:
-- - `_v2_heart_rate_participants.sql` 적용 후 실행
-- - 재실행 가능(idempotent): 기존 000001 데모 심박·상세는 삭제 후 재삽입
--
-- USE workout_system;

SET @demo_workout_id = '000001';
SET @demo_user_id = (
  SELECT id
  FROM users
  WHERE role = 'user'
    AND used = TRUE
  ORDER BY created_at ASC
  LIMIT 1
);
SET @demo_workout_date = CURDATE();
SET @demo_base_ts = TIMESTAMP(CONCAT(DATE_FORMAT(@demo_workout_date, '%Y-%m-%d'), ' 09:00:00'));

SELECT
  CASE
    WHEN @demo_user_id IS NULL THEN 'ERROR: role=user 인 활성 회원이 없습니다. 먼저 회원을 생성하세요.'
    ELSE CONCAT('데모 대상 user_id: ', @demo_user_id)
  END AS seed_check;

-- ============================================================================
-- 1. 데모 운동기록 마스터 (000001)
-- ============================================================================

INSERT INTO workout_history_master (
  id,
  user_id,
  date,
  time,
  workout_categories_id,
  workout_scope,
  revision_number,
  method_type,
  method_name,
  memo,
  admin
)
SELECT
  @demo_workout_id,
  @demo_user_id,
  @demo_workout_date,
  '09',
  'HIIT',
  'TOTAL',
  1,
  'circuit',
  '데모 HIIT',
  '심박 화면 확인용 가상 데이터',
  FALSE
WHERE @demo_user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM workout_history_master
    WHERE id = @demo_workout_id
  );

UPDATE workout_history_master
SET
  user_id = @demo_user_id,
  date = @demo_workout_date,
  time = '09',
  workout_categories_id = 'HIIT',
  workout_scope = 'TOTAL',
  method_type = 'circuit',
  method_name = '데모 HIIT',
  memo = '심박 화면 확인용 가상 데이터',
  updated_at = CURRENT_TIMESTAMP
WHERE id = @demo_workout_id
  AND @demo_user_id IS NOT NULL;

-- ============================================================================
-- 2. 데모 운동 상세 (목록 표시용)
-- ============================================================================

DELETE FROM workout_history_detail
WHERE workout_history_master_id = @demo_workout_id;

INSERT INTO workout_history_detail (
  workout_history_master_id,
  seq,
  exercises_id,
  method_round,
  method_rest,
  method_hydration_time,
  duration,
  calories_burned,
  average_heart_rate,
  max_heart_rate,
  notes
)
SELECT
  @demo_workout_id,
  1,
  'demo-burpee',
  '1Round',
  30,
  0,
  600,
  120,
  142,
  176,
  '데모 버피'
WHERE @demo_user_id IS NOT NULL
UNION ALL
SELECT
  @demo_workout_id,
  2,
  'demo-squat',
  '1Round',
  30,
  0,
  600,
  110,
  138,
  168,
  '데모 스쿼트'
WHERE @demo_user_id IS NOT NULL
UNION ALL
SELECT
  @demo_workout_id,
  3,
  'demo-plank',
  '1Round',
  30,
  0,
  600,
  95,
  132,
  160,
  '데모 플랭크'
WHERE @demo_user_id IS NOT NULL;

-- ============================================================================
-- 3. 데모 심박 시계열 (30초 간격 60포인트, 약 30분)
-- ============================================================================

DELETE FROM heart_rate_data
WHERE workout_history_master_id = @demo_workout_id
  AND user_id = @demo_user_id;

INSERT INTO heart_rate_data (
  id,
  user_id,
  workout_history_master_id,
  device_id,
  device_name,
  timestamp,
  heart_rate,
  zone
)
WITH RECURSIVE seq AS (
  SELECT 0 AS n
  UNION ALL
  SELECT n + 1
  FROM seq
  WHERE n < 59
),
calc AS (
  SELECT
    n,
    CASE
      WHEN n <= 10 THEN 82 + (n * 2)
      WHEN n <= 30 THEN 118 + ROUND((n - 10) * 1.6)
      WHEN n <= 45 THEN 158 + ROUND(SIN(n) * 8)
      ELSE GREATEST(95, 152 - ((n - 45) * 3))
    END AS hr
  FROM seq
)
SELECT
  UUID(),
  @demo_user_id,
  @demo_workout_id,
  'ant-demo-000001',
  'HR-DEMO-000001',
  DATE_ADD(@demo_base_ts, INTERVAL n * 30 SECOND),
  hr,
  CASE
    WHEN hr < 100 THEN 'rest'
    WHEN hr < 130 THEN 'fat-burn'
    WHEN hr < 160 THEN 'cardio'
    ELSE 'peak'
  END
FROM calc
WHERE @demo_user_id IS NOT NULL;

SELECT
  '심박 데모 시드 완료' AS message,
  @demo_workout_id AS workout_history_master_id,
  @demo_user_id AS user_id,
  @demo_workout_date AS workout_date,
  (
    SELECT COUNT(*)
    FROM heart_rate_data
    WHERE workout_history_master_id = @demo_workout_id
      AND user_id = @demo_user_id
  ) AS heart_rate_points;
